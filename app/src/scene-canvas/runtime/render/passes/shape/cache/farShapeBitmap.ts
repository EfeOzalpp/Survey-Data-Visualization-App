import type { EngineFieldItem } from "../../../../engine/field";
import type { PLike } from "../../../../p/makeP";
import { shapeRegistrySupportsRenderPass, type ShapeRegistry } from "../../../../shape-adapter/registry";
import { copyRuntimeShapeOptionsInto } from "../../../../shape-adapter/options";
import type { RuntimeShapeOptions } from "../../../../shape-adapter/types";
import type { GridMetrics } from "../../../../geometry/gridCache";
import { createFarShapeCacheDebugTracker } from "../../../../debug";
import type { FarShapeBitmapCachePolicy } from "../../../cache-policy";
import {
  footprintToPx,
  gradientColor,
  VIVID_COLOR_STOPS,
  type SceneLightContext,
} from "../../../../../modifiers/index";
import { selectScale } from "../../../../../modifiers/global-event-driven/select";
import { finiteNumber, type RGB } from "../../../../../shared/math";
import { hashString32 } from "../../../../../shared/hash32";
import {
  shapeLifecycle,
  shapePass,
  shapeProjection,
  shapeStyle,
} from "../../../../../shapes/options";
import { drawItemFromRegistry } from "../../../../shape-adapter/draw";
import { resolveShapeDepthColor, resolveShapeDepthMaxBlend } from "../../depth";
import {
  liveAvgBucketAvg,
  liveAvgBucketId,
  paletteKey,
  rgbKey,
  rounded,
  shapeBitmapCacheKey,
  shapeBitmapFallbackKey,
} from "./bitmapKeys";
import {
  allowsFarShapeBitmapCache,
  isFarCacheCandidate,
  isSharedFarStampShape,
  SHARED_FAR_STAMP_SIZE_K,
} from "./policy";
import {
  canvasDpr,
  createOffscreenCache,
  maxCachePixelsForCanvas,
  pixelSizeForBounds,
  snapBoundsToDevicePixels,
  type OffscreenBounds,
  type OffscreenCacheEntry,
} from "../../../cache/offscreenCache";

type ShapeBitmapBounds = OffscreenBounds;
type CachedShapeBitmap = OffscreenCacheEntry;
interface ShapeBitmapOverlay {
  color: RGB;
  blend: number;
}
const TREE_STAMP_VARIANTS = 8;
const TREE_STAMP_SIZE_BUCKET_PX = 8;
const TREE_STAMP_LIGHT_COORD_BUCKETS = 8;
const TREE_STAMP_LIGHT_INTENSITY = {
  sun: 1.22,
  moon: 0.88,
} as const;

function bucketSizePx(value: number) {
  return Math.max(TREE_STAMP_SIZE_BUCKET_PX, Math.round(value / TREE_STAMP_SIZE_BUCKET_PX) * TREE_STAMP_SIZE_BUCKET_PX);
}

function sharedStampVariantSlot(item: EngineFieldItem) {
  return hashString32(`${item.shape}|${item.id}`) % TREE_STAMP_VARIANTS;
}

function suppressCurrentDepthOverlay(opts: RuntimeShapeOptions) {
  const pass = opts.pass ?? (opts.pass = {});
  pass.depthTintColor = undefined;
  pass.depthTintK = undefined;
}

function depthOverlayFromOptions(opts: RuntimeShapeOptions) {
  const pass = shapePass(opts);
  const color = pass.depthTintColor;
  const blend = finiteNumber(pass.depthTintK, 0);
  if (!color || blend <= 0) return null;
  return {
    color,
    blend: Math.max(0, Math.min(1, blend)),
  };
}

function quantizeTreeLightCoord(value: number) {
  const clamped = Math.max(-2, Math.min(3, finiteNumber(value, 0)));
  return Math.round(clamped * TREE_STAMP_LIGHT_COORD_BUCKETS) / TREE_STAMP_LIGHT_COORD_BUCKETS;
}

function treeStampLightSignature(
  light: SceneLightContext | null | undefined,
  itemBounds: ShapeBitmapBounds
) {
  if (!light) return "none";
  const relX = quantizeTreeLightCoord((light.sourceX - itemBounds.x) / Math.max(1, itemBounds.w));
  const relY = quantizeTreeLightCoord((light.sourceY - itemBounds.y) / Math.max(1, itemBounds.h));
  return [
    light.kind,
    rounded(relX, 100),
    rounded(relY, 100),
    rounded(light.intensity, 100),
    rounded(light.paletteClosenessK, 100),
  ].join(",");
}

function makeTreeStampLightContext(args: {
  stampBounds: ShapeBitmapBounds;
  itemBounds: ShapeBitmapBounds;
  sceneLight: SceneLightContext | null | undefined;
  darkMode: boolean;
}): SceneLightContext {
  const { stampBounds, itemBounds, sceneLight, darkMode } = args;
  const safeW = Math.max(1, stampBounds.w);
  const safeH = Math.max(1, stampBounds.h);
  const relX = sceneLight
    ? quantizeTreeLightCoord((sceneLight.sourceX - itemBounds.x) / Math.max(1, itemBounds.w))
    : 0.5;
  const relY = sceneLight
    ? quantizeTreeLightCoord((sceneLight.sourceY - itemBounds.y) / Math.max(1, itemBounds.h))
    : -0.12;
  return {
    sourceX: safeW * relX,
    sourceY: safeH * relY,
    kind: sceneLight?.kind ?? (darkMode ? "moon" : "sun"),
    intensity: sceneLight?.intensity ?? (darkMode ? TREE_STAMP_LIGHT_INTENSITY.moon : TREE_STAMP_LIGHT_INTENSITY.sun),
    paletteClosenessK: sceneLight?.paletteClosenessK ?? 0.55,
    sceneW: safeW,
    sceneH: safeH,
    sceneDiag: Math.max(1, Math.hypot(safeW, safeH)),
    lightColor: sceneLight?.lightColor ?? (darkMode
      ? { r: 198, g: 220, b: 255 }
      : { r: 255, g: 222, b: 168 }),
    shadowColor: sceneLight?.shadowColor ?? (darkMode
      ? { r: 58, g: 76, b: 108 }
      : { r: 88, g: 114, b: 150 }),
  };
}

function sceneLightForMode(
  light: SceneLightContext | null | undefined,
  darkMode: boolean
): SceneLightContext | null {
  if (!light) return null;
  return {
    ...light,
    kind: darkMode ? "moon" : "sun",
    intensity: darkMode ? TREE_STAMP_LIGHT_INTENSITY.moon : TREE_STAMP_LIGHT_INTENSITY.sun,
    lightColor: darkMode
      ? { r: 198, g: 220, b: 255 }
      : { r: 255, g: 222, b: 168 },
    shadowColor: darkMode
      ? { r: 58, g: 76, b: 108 }
      : { r: 88, g: 114, b: 150 },
  };
}

function oppositeDepthOverlay(opts: RuntimeShapeOptions, overlay: { color: RGB; blend: number }) {
  const currentDarkMode = shapeStyle(opts).darkMode === true;
  const nextDarkMode = !currentDarkMode;
  const currentMaxBlend = resolveShapeDepthMaxBlend(currentDarkMode);
  const nextMaxBlend = resolveShapeDepthMaxBlend(nextDarkMode);
  const blend = currentMaxBlend > 0
    ? overlay.blend * (nextMaxBlend / currentMaxBlend)
    : overlay.blend;
  return {
    darkMode: nextDarkMode,
    color: resolveShapeDepthColor(nextDarkMode),
    blend: Math.max(0, Math.min(1, blend)),
  };
}

function liveAvgKey(liveAvg: number | undefined) {
  return String(liveAvgBucketId(liveAvg));
}

// Shapes authored with a canopy/crown that rises above their own footprint
// (see trees.ts TREES.layout.maxOverflowTopK). Padding below is sized off
// cell size, not footprint height, so multi-row footprints need extra top
// room or this overflow gets clipped out of the cached bitmap/mask.
const EXTRA_TOP_PAD_K: Record<string, number> = {
  trees: 0.5,
};

function resolveShapeBounds(item: EngineFieldItem, rEff: number, opts: RuntimeShapeOptions): ShapeBitmapBounds | null {
  const projection = shapeProjection(opts);
  const cell = finiteNumber(projection.cell, rEff);
  const cellW = finiteNumber(projection.cellW, cell);
  const cellH = finiteNumber(projection.cellH, cell);

  const rect = item.footprint
    ? footprintToPx(item.footprint, projection)
    : { x: item.x - rEff, y: item.y - rEff, w: rEff * 2, h: rEff * 2 };
  if (rect.w <= 0 || rect.h <= 0) return null;

  // The cache is item-sized. Padding catches overhangs, strokes, and anti-aliasing.
  const pad = Math.ceil(Math.max(8, rEff * 0.75, Math.max(cellW, cellH) * 0.8));
  const topPad = pad + Math.ceil(rect.h * (EXTRA_TOP_PAD_K[item.shape] ?? 0));
  return {
    x: Math.floor(rect.x - pad),
    y: Math.floor(rect.y - topPad),
    w: Math.ceil(rect.w + pad * 2),
    h: Math.ceil(rect.h + topPad + pad),
  };
}

function resolveShapeRect(item: EngineFieldItem, rEff: number, opts: RuntimeShapeOptions) {
  const projection = shapeProjection(opts);
  return item.footprint
    ? footprintToPx(item.footprint, projection)
    : { x: item.x - rEff, y: item.y - rEff, w: rEff * 2, h: rEff * 2 };
}

function blitWithAppear(
  ctx: CanvasRenderingContext2D,
  appearK: number,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (appearK >= 0.999) {
    ctx.drawImage(canvas, x, y, w, h);
    return;
  }
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * appearK;
  ctx.drawImage(canvas, x, y, w, h);
  ctx.globalAlpha = prev;
}

export function createFarShapeBitmapRenderer(getPolicy: () => FarShapeBitmapCachePolicy) {
  const cache = createOffscreenCache<ShapeBitmapBounds>();
  const treeStampCache = createOffscreenCache<ShapeBitmapBounds>();
  const treeStampMaskCache = createOffscreenCache<ShapeBitmapBounds>();
  const treeStampFallbackKeys = new Map<string, string>();
  const treeStampMaskFallbackKeys = new Map<string, string>();
  const fallbackKeys = new Map<string, string>();
  const bakeOpts: RuntimeShapeOptions = {};
  const stampBakeOpts: RuntimeShapeOptions = {};
  const stampPrewarmOpts: RuntimeShapeOptions = {};
  let tintScratchCanvas: HTMLCanvasElement | null = null;
  let tintScratchCtx: CanvasRenderingContext2D | null = null;
  const debug = createFarShapeCacheDebugTracker();
  let frameTimeMs = Number.NaN;
  let bakesThisFrame = 0;

  function updateDebugState() {
    debug.updateState({
      genericCacheSize: cache.size,
      genericCachePixels: cache.pixels,
      stampCacheSize: treeStampCache.size,
      stampCachePixels: treeStampCache.pixels,
      stampMaskCacheSize: treeStampMaskCache.size,
      stampMaskCachePixels: treeStampMaskCache.pixels,
      genericFallbackKeys: fallbackKeys.size,
      stampFallbackKeys: treeStampFallbackKeys.size,
      stampMaskFallbackKeys: treeStampMaskFallbackKeys.size,
    });
  }

  function clearCache() {
    const cleared =
      cache.clear() +
      treeStampCache.clear() +
      treeStampMaskCache.clear();
    treeStampFallbackKeys.clear();
    treeStampMaskFallbackKeys.clear();
    fallbackKeys.clear();
    debug.markCleared(cleared);
    updateDebugState();
  }

  function syncFrameBudget(timeMs: number) {
    if (timeMs === frameTimeMs) return;
    frameTimeMs = timeMs;
    bakesThisFrame = 0;
  }

  function trimCacheToPolicy(p: PLike, policy: FarShapeBitmapCachePolicy) {
    const maxPixels = maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel);
    const trimmed =
      cache.trim(maxPixels) +
      treeStampCache.trim(maxPixels) +
      treeStampMaskCache.trim(maxPixels);
    if (trimmed > 0) debug.markTrimmed(trimmed);
    updateDebugState();
  }

  function treeStampKey(args: {
    item: EngineFieldItem;
    opts: RuntimeShapeOptions;
    stampBounds: ShapeBitmapBounds;
    itemBounds: ShapeBitmapBounds;
    dpr: number;
  }) {
    const { item, opts, stampBounds, itemBounds, dpr } = args;
    const style = shapeStyle(opts);
    const f = item.footprint;
    return [
      "tree-stamp-v1",
      item.shape,
      `v:${String(sharedStampVariantSlot(item))}`,
      f ? `fp:${String(f.w)}x${String(f.h)}` : "fp:none",
      `size:${rounded(stampBounds.w)}x${rounded(stampBounds.h)}`,
      liveAvgKey(style.liveAvg),
      String(style.darkMode ? 1 : 0),
      rounded(style.exposure),
      rounded(style.contrast),
      rounded(style.blend),
      paletteKey(style),
      treeStampLightSignature(style.lightCtx, itemBounds),
      rounded(dpr, 100),
    ].join("|");
  }

  function treeStampFallbackKey(args: {
    item: EngineFieldItem;
    stampBounds: ShapeBitmapBounds;
    dpr: number;
  }) {
    const { item, stampBounds, dpr } = args;
    const f = item.footprint;
    return [
      "tree-stamp-fallback-v1",
      item.shape,
      `v:${String(sharedStampVariantSlot(item))}`,
      f ? `fp:${String(f.w)}x${String(f.h)}` : "fp:none",
      `size:${rounded(stampBounds.w)}x${rounded(stampBounds.h)}`,
      rounded(dpr, 100),
    ].join("|");
  }

  function bakeTreeStamp(args: {
    entry: CachedShapeBitmap;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    itemBounds: ShapeBitmapBounds;
    itemRect: { x: number; y: number; w: number; h: number };
    renderPass: "color" | "depthMask";
    maskColor?: RGB;
    dpr: number;
  }) {
    const { entry, shapeRegistry, item, rEff, opts, itemBounds, itemRect, renderPass, maskColor, dpr } = args;
    const { canvas, ctx, p: stampP, bounds } = entry;
    const footprint = item.footprint;
    if (!footprint) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scaleX = bounds.w / Math.max(1, itemBounds.w);
    const scaleY = bounds.h / Math.max(1, itemBounds.h);
    const pixelFootprint = {
      x: (itemRect.x - itemBounds.x) * scaleX,
      y: (itemRect.y - itemBounds.y) * scaleY,
      w: Math.max(1, itemRect.w * scaleX),
      h: Math.max(1, itemRect.h * scaleY),
    };
    const cellW = pixelFootprint.w / Math.max(1, footprint.w);
    const cellH = pixelFootprint.h / Math.max(1, footprint.h);
    const cell = Math.max(1, Math.min(cellW, cellH));
    const bucketAvg = liveAvgBucketAvg(shapeStyle(opts).liveAvg);
    const sourceStyle = shapeStyle(opts);
    const darkMode = sourceStyle.darkMode === true;

    stampP.__tick(shapeLifecycle(opts).timeMs ?? performance.now());
    copyRuntimeShapeOptionsInto(stampBakeOpts, opts);
    stampBakeOpts.projection = {
      cell,
      cellW,
      cellH,
      footprint: { r0: 0, c0: 0, w: footprint.w, h: footprint.h },
      pixelFootprint,
    };
    const style = stampBakeOpts.style ?? (stampBakeOpts.style = {});
    if (!style.gradientRGBOverrideActive) {
      style.liveAvg = bucketAvg;
      style.gradientRGB = gradientColor(VIVID_COLOR_STOPS, bucketAvg).rgb;
    }
    style.lightCtx = makeTreeStampLightContext({
      stampBounds: bounds,
      itemBounds,
      sceneLight: sourceStyle.lightCtx,
      darkMode,
    });
    style.alpha = renderPass === "depthMask" ? 255 : 235;
    const lifecycle = stampBakeOpts.lifecycle ?? (stampBakeOpts.lifecycle = {});
    const particles = stampBakeOpts.particles ?? (stampBakeOpts.particles = {});
    const pass = stampBakeOpts.pass ?? (stampBakeOpts.pass = {});
    const identity = stampBakeOpts.identity ?? (stampBakeOpts.identity = {});
    const sprite = stampBakeOpts.sprite ?? (stampBakeOpts.sprite = {});
    lifecycle.rootAppearK = 1;
    lifecycle.selectK = 0;
    particles.particleStore = undefined;
    pass.renderPass = renderPass;
    pass.maskColor = renderPass === "depthMask" ? maskColor : undefined;
    pass.maskAlpha = renderPass === "depthMask" ? 255 : undefined;
    pass.depthTintColor = undefined;
    pass.depthTintK = undefined;
    identity.seedKey = `far-${item.shape}-stamp|B${String(liveAvgBucketId(style.liveAvg))}|V${String(sharedStampVariantSlot(item))}`;
    identity.shapeOccurrenceIndex = sharedStampVariantSlot(item);
    sprite.fitToFootprint = true;
    sprite.spriteMode = true;
    sprite.disableParticleDepthTint = true;

    drawItemFromRegistry(
      shapeRegistry,
      stampP,
      {
        id: identity.seedKey,
        shape: item.shape,
        x: bounds.w / 2,
        y: bounds.h / 2,
        footprint: stampBakeOpts.projection.footprint,
        pixelFootprint,
      },
      Math.max(rEff, cell),
      stampBakeOpts
    );
  }

  function prewarmOppositeTreeStampMask(args: {
    p: PLike;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    bounds: ShapeBitmapBounds;
    stampBounds: ShapeBitmapBounds;
    itemRect: { x: number; y: number; w: number; h: number };
    dpr: number;
    policy: FarShapeBitmapCachePolicy;
    overlay: { color: RGB; blend: number };
  }) {
    const {
      p,
      shapeRegistry,
      item,
      rEff,
      opts,
      bounds,
      stampBounds,
      itemRect,
      dpr,
      policy,
      overlay,
    } = args;
    if (bakesThisFrame >= policy.maxBakesPerFrame) return;

    const opposite = oppositeDepthOverlay(opts, overlay);
    if (opposite.blend <= 0) return;

    copyRuntimeShapeOptionsInto(stampPrewarmOpts, opts);
    const sourceStyle = shapeStyle(opts);
    const style = stampPrewarmOpts.style ?? (stampPrewarmOpts.style = {});
    style.darkMode = opposite.darkMode;
    style.lightCtx = sceneLightForMode(sourceStyle.lightCtx, opposite.darkMode);

    const stampKey = treeStampKey({
      item,
      opts: stampPrewarmOpts,
      stampBounds,
      itemBounds: bounds,
      dpr,
    });
    const key = `${stampKey}|mask:${rgbKey(opposite.color)}`;
    if (treeStampMaskCache.get(key)) return;

    const maskPixels = pixelSizeForBounds(stampBounds, dpr).pixels;
    const maxPixels = maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel);
    if (maskPixels > maxPixels) {
      debug.markStampMaskTooLarge();
      updateDebugState();
      return;
    }

    const entry = treeStampMaskCache.createEntry(stampBounds, dpr);
    bakesThisFrame += 1;
    debug.markStampMaskCreated(entry.pixels);
    debug.markStampMaskBake();
    bakeTreeStamp({
      entry,
      shapeRegistry,
      item,
      rEff,
      opts: stampPrewarmOpts,
      itemBounds: bounds,
      itemRect,
      renderPass: "depthMask",
      maskColor: opposite.color,
      dpr,
    });
    treeStampMaskCache.set(key, entry);
    debug.markTrimmed(treeStampMaskCache.trim(maxPixels));
    updateDebugState();
  }

  function drawTreeStampMask(args: {
    p: PLike;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    bounds: ShapeBitmapBounds;
    stampBounds: ShapeBitmapBounds;
    itemRect: { x: number; y: number; w: number; h: number };
    dpr: number;
    policy: FarShapeBitmapCachePolicy;
    stampKey: string;
    stampFallbackKey: string;
    overlay: { color: RGB; blend: number };
  }) {
    const {
      p,
      shapeRegistry,
      item,
      rEff,
      opts,
      bounds,
      stampBounds,
      itemRect,
      dpr,
      policy,
      stampKey,
      stampFallbackKey,
      overlay,
    } = args;
    const key = `${stampKey}|mask:${rgbKey(overlay.color)}`;
    const fallbackKey = `${stampFallbackKey}|mask:${rgbKey(overlay.color)}`;
    let entry = treeStampMaskCache.get(key);

    if (!entry) {
      debug.markStampMaskMiss();
      const maskPixels = pixelSizeForBounds(stampBounds, dpr).pixels;
      const maxPixels = maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel);
      if (maskPixels > maxPixels) {
        debug.markStampMaskTooLarge();
        updateDebugState();
        return;
      }

      if (bakesThisFrame >= policy.maxBakesPerFrame) {
        const staleKey = treeStampMaskFallbackKeys.get(fallbackKey);
        if (!staleKey) {
          debug.markStampMaskBudgetSkip();
          updateDebugState();
          return;
        }
        const staleEntry = treeStampMaskCache.get(staleKey);
        if (!staleEntry) {
          treeStampMaskFallbackKeys.delete(fallbackKey);
          debug.markStampMaskBudgetSkip();
          updateDebugState();
          return;
        }
        entry = staleEntry;
        debug.markStampMaskStaleDrawn();
        treeStampMaskCache.touch(staleKey, staleEntry);
      } else {
        entry = treeStampMaskCache.createEntry(stampBounds, dpr);
        bakesThisFrame += 1;
        debug.markStampMaskCreated(entry.pixels);
        debug.markStampMaskBake();
        bakeTreeStamp({
          entry,
          shapeRegistry,
          item,
          rEff,
          opts,
          itemBounds: bounds,
          itemRect,
          renderPass: "depthMask",
          maskColor: overlay.color,
          dpr,
        });
        treeStampMaskCache.set(key, entry);
        treeStampMaskFallbackKeys.set(fallbackKey, key);
        debug.markTrimmed(treeStampMaskCache.trim(maxPixels));
        updateDebugState();
      }
    } else {
      debug.markStampMaskHit();
      treeStampMaskCache.touch(key, entry);
      treeStampMaskFallbackKeys.set(fallbackKey, key);
    }

    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalAlpha = overlay.blend;
    ctx.drawImage(entry.canvas, bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.restore();
    debug.markStampMaskDrawn();
    prewarmOppositeTreeStampMask({
      p,
      shapeRegistry,
      item,
      rEff,
      opts,
      bounds,
      stampBounds,
      itemRect,
      dpr,
      policy,
      overlay,
    });
    updateDebugState();
  }

  function drawCachedBitmapBrightnessOverlay(args: {
    p: PLike;
    canvas: HTMLCanvasElement;
    x: number;
    y: number;
    w: number;
    h: number;
    alpha: number;
    alphaScale?: number;
  }) {
    const alpha = Math.max(0, Math.min(0.5, args.alpha)) *
      Math.max(0, Math.min(1, args.alphaScale ?? 1));
    if (alpha <= 0.001) return;

    // Cached far shapes are frozen bitmaps. Reusing the same bitmap guarantees
    // hover cannot redraw a different seeded or time-animated variant.
    const ctx = args.p.drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(args.canvas, args.x, args.y, args.w, args.h);
    ctx.restore();
  }

  function getTintScratch(source: HTMLCanvasElement) {
    if (typeof document === "undefined") return null;
    if (!tintScratchCanvas || !tintScratchCtx) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      tintScratchCanvas = canvas;
      tintScratchCtx = ctx;
    }
    if (tintScratchCanvas.width !== source.width || tintScratchCanvas.height !== source.height) {
      tintScratchCanvas.width = source.width;
      tintScratchCanvas.height = source.height;
    }
    return { canvas: tintScratchCanvas, ctx: tintScratchCtx };
  }

  function drawCachedBitmapTintOverlay(args: {
    p: PLike;
    canvas: HTMLCanvasElement;
    x: number;
    y: number;
    w: number;
    h: number;
    overlay: ShapeBitmapOverlay;
    alphaScale?: number;
  }) {
    const alpha = Math.max(0, Math.min(1, args.overlay.blend)) *
      Math.max(0, Math.min(1, args.alphaScale ?? 1));
    if (alpha <= 0.001) return;

    const scratch = getTintScratch(args.canvas);
    if (!scratch) return;

    const { canvas, ctx } = scratch;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(args.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = `rgb(${String(args.overlay.color.r)}, ${String(args.overlay.color.g)}, ${String(args.overlay.color.b)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";

    const target = args.p.drawingContext;
    target.save();
    target.globalAlpha = alpha;
    target.drawImage(canvas, args.x, args.y, args.w, args.h);
    target.restore();
  }

  function drawSharedFarTreeStamp(args: {
    p: PLike;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    bounds: ShapeBitmapBounds;
    dpr: number;
    policy: FarShapeBitmapCachePolicy;
    brightnessAlpha: number;
    selectedOverlay?: ShapeBitmapOverlay;
  }): boolean {
    const { p, shapeRegistry, item, rEff, opts, bounds, dpr, policy } = args;
    if (!isSharedFarStampShape(item)) return false;
    debug.markStampCandidate();

    const itemRect = resolveShapeRect(item, rEff, opts);
    if (itemRect.w <= 0 || itemRect.h <= 0) {
      suppressCurrentDepthOverlay(opts);
      updateDebugState();
      return true;
    }

    const stampBounds = {
      x: 0,
      y: 0,
      w: bucketSizePx(bounds.w),
      h: bucketSizePx(bounds.h),
    };
    const key = treeStampKey({ item, opts, stampBounds, itemBounds: bounds, dpr });
    const fallbackKey = treeStampFallbackKey({ item, stampBounds, dpr });
    let entry = treeStampCache.get(key);
    let drewColor = false;

    if (!entry) {
      debug.markStampMiss();
      const stampPixels = pixelSizeForBounds(stampBounds, dpr).pixels;
      const maxPixels = maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel);
      if (stampPixels > maxPixels) {
        debug.markStampTooLarge();
        suppressCurrentDepthOverlay(opts);
        updateDebugState();
        return true;
      }
      if (bakesThisFrame >= policy.maxBakesPerFrame) {
        let staleDrawEntry: CachedShapeBitmap | null = null;
        const staleKey = treeStampFallbackKeys.get(fallbackKey);
        if (staleKey) {
          const staleEntry = treeStampCache.get(staleKey);
          if (staleEntry) {
            treeStampCache.touch(staleKey, staleEntry);
            p.drawingContext.drawImage(staleEntry.canvas, bounds.x, bounds.y, bounds.w, bounds.h);
            debug.markStampStaleDrawn();
            staleDrawEntry = staleEntry;
            drewColor = true;
          } else {
            treeStampFallbackKeys.delete(fallbackKey);
          }
        }
        if (drewColor && staleDrawEntry) {
          const overlay = args.selectedOverlay ?? depthOverlayFromOptions(opts);
          if (overlay) {
            drawTreeStampMask({
              p,
              shapeRegistry,
              item,
              rEff,
              opts,
              bounds,
              stampBounds,
              itemRect,
              dpr,
              policy,
              stampKey: key,
              stampFallbackKey: fallbackKey,
              overlay,
            });
          }
          drawCachedBitmapBrightnessOverlay({
            p,
            canvas: staleDrawEntry.canvas,
            x: bounds.x,
            y: bounds.y,
            w: bounds.w,
            h: bounds.h,
            alpha: args.brightnessAlpha,
          });
        }
        if (!drewColor) debug.markStampBudgetSkip();
        if (drewColor) debug.markStampDrawn();
        suppressCurrentDepthOverlay(opts);
        updateDebugState();
        return true;
      }

      entry = treeStampCache.createEntry(stampBounds, dpr);
      bakesThisFrame += 1;
      debug.markStampCreated(entry.pixels);
      debug.markStampBake();
      bakeTreeStamp({
        entry,
        shapeRegistry,
        item,
        rEff,
        opts,
        itemBounds: bounds,
        itemRect,
        renderPass: "color",
        dpr,
      });
      treeStampCache.set(key, entry);
      treeStampFallbackKeys.set(fallbackKey, key);
      debug.markTrimmed(treeStampCache.trim(maxPixels));
      updateDebugState();
    } else {
      debug.markStampHit();
      treeStampCache.touch(key, entry);
      treeStampFallbackKeys.set(fallbackKey, key);
    }

    p.drawingContext.drawImage(entry.canvas, bounds.x, bounds.y, bounds.w, bounds.h);
    debug.markStampDrawn();
    const overlay = args.selectedOverlay ?? depthOverlayFromOptions(opts);
    if (overlay) {
      drawTreeStampMask({
        p,
        shapeRegistry,
        item,
        rEff,
        opts,
        bounds,
        stampBounds,
        itemRect,
        dpr,
        policy,
        stampKey: key,
        stampFallbackKey: fallbackKey,
        overlay,
      });
    }
    drawCachedBitmapBrightnessOverlay({
      p,
      canvas: entry.canvas,
      x: bounds.x,
      y: bounds.y,
      w: bounds.w,
      h: bounds.h,
      alpha: args.brightnessAlpha,
    });
    // The shared stamp uses a canonical variant seed. The normal depth overlay
    // would redraw this item's original randomized tree geometry on top of it.
    suppressCurrentDepthOverlay(opts);
    updateDebugState();
    return true;
  }

  function bakeShape(args: {
    // Upstream params: cache-miss draw data from drawFarShapeBitmap.
    entry: CachedShapeBitmap;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    dpr: number;
    // End params.
  }) {
    const { entry, shapeRegistry, item, rEff, opts, dpr } = args;
    const { canvas, ctx, p: bitmapP, bounds } = entry;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bitmapP.__tick(shapeLifecycle(opts).timeMs ?? performance.now());
    copyRuntimeShapeOptionsInto(bakeOpts, opts);
    const style = bakeOpts.style ?? (bakeOpts.style = {});
    const lifecycle = bakeOpts.lifecycle ?? (bakeOpts.lifecycle = {});
    const particles = bakeOpts.particles ?? (bakeOpts.particles = {});
    const pass = bakeOpts.pass ?? (bakeOpts.pass = {});
    if (!style.gradientRGBOverrideActive) {
      const bucketAvg = liveAvgBucketAvg(style.liveAvg);
      style.liveAvg = bucketAvg;
      style.gradientRGB = gradientColor(VIVID_COLOR_STOPS, bucketAvg).rgb;
    }
    lifecycle.rootAppearK = 1;
    lifecycle.selectK = 0;
    particles.particleStore = undefined;
    pass.renderPass = "color";
    pass.maskColor = undefined;
    pass.maskAlpha = undefined;

    bitmapP.push();
    bitmapP.translate(-bounds.x, -bounds.y);
    drawItemFromRegistry(shapeRegistry, bitmapP, item, rEff, bakeOpts);
    bitmapP.pop();
  }

  const drawFarShapeBitmap = function drawFarShapeBitmap(args: {
    // Upstream params: live item draw request from engine/loop.ts.
    p: PLike;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    gridMetrics?: GridMetrics;
    brightnessAlpha?: number;
    selectedOverlay?: ShapeBitmapOverlay;
    // End params.
  }): boolean {
    const { p, shapeRegistry, item, rEff, opts, gridMetrics, brightnessAlpha = 0, selectedOverlay } = args;
    debug.markCall();
    const policy = getPolicy();
    if (!policy.enabled) {
      debug.markSkippedDisabled();
      updateDebugState();
      return false;
    }
    if (!allowsFarShapeBitmapCache(item, policy, gridMetrics)) {
      debug.markSkippedPolicy();
      updateDebugState();
      return false;
    }

    const isFarCandidate = isFarCacheCandidate(item, gridMetrics, policy.farSizeK);
    if (!isFarCandidate) {
      debug.markSkippedNotFar();
      updateDebugState();
      return false;
    }

    const lc = shapeLifecycle(opts);
    const selectK = lc.selectK ?? 0;

    const dpr = canvasDpr(p);
    const target = cache.syncRenderTarget(p, dpr);
    if (target.changed) {
      fallbackKeys.clear();
      debug.markRenderTargetCleared(target.cleared);
    }

    syncFrameBudget(shapeLifecycle(opts).timeMs ?? performance.now());

    const roughBounds = resolveShapeBounds(item, rEff, opts);
    if (!roughBounds) {
      debug.markSkippedBounds();
      updateDebugState();
      return false;
    }
    const bounds = snapBoundsToDevicePixels(roughBounds, dpr);

    // Scale the cached bitmap via canvas transform when selected, rather than
    // bypassing to a live render. This keeps the visual variant (stamp seed or
    // baked key) identical to the unselected state; no pop on click.
    // try/finally guarantees the restore on every return path inside.
    if (selectK > 0) {
      const s = selectScale(selectK);
      const rect = resolveShapeRect(item, rEff, opts);
      const pivotX = rect.x + rect.w / 2;
      const pivotY = rect.y + rect.h;
      p.drawingContext.save();
      p.drawingContext.translate(pivotX, pivotY);
      p.drawingContext.scale(s, s);
      p.drawingContext.translate(-pivotX, -pivotY);
    }
    try {
      trimCacheToPolicy(p, policy);
      const isSharedStampCandidate = isFarCacheCandidate(
        item,
        gridMetrics,
        Math.min(policy.farSizeK, SHARED_FAR_STAMP_SIZE_K)
      );
      if (isSharedStampCandidate) {
        const drewSharedStamp = drawSharedFarTreeStamp({
          p,
          shapeRegistry,
          item,
          rEff,
          opts,
          bounds,
          dpr,
          policy,
          brightnessAlpha,
          selectedOverlay,
        });
        if (drewSharedStamp) return true;
      }

      const appearK = shapeLifecycle(opts).rootAppearK ?? 1;

      const key = shapeBitmapCacheKey({ item, rEff, opts, bounds, dpr });
      const fallbackKey = shapeBitmapFallbackKey({ item, rEff, opts, bounds, dpr });
      let entry = cache.get(key);

      if (!entry) {
        debug.markGenericMiss();
        const bitmapPixels = pixelSizeForBounds(bounds, dpr).pixels;
        const maxPixels = maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel);
        if (bitmapPixels > maxPixels) {
          debug.markGenericTooLarge();
          updateDebugState();
          return false;
        }

        if (bakesThisFrame >= policy.maxBakesPerFrame) {
          const staleKey = fallbackKeys.get(fallbackKey);
          const staleEntry = staleKey ? cache.get(staleKey) : undefined;
          if (staleKey && staleEntry) {
            cache.touch(staleKey, staleEntry);
            debug.markGenericStaleDrawn();
            debug.markGenericDrawn();
            blitWithAppear(p.drawingContext, appearK, staleEntry.canvas, staleEntry.bounds.x, staleEntry.bounds.y, staleEntry.bounds.w, staleEntry.bounds.h);
            if (selectedOverlay) {
              drawCachedBitmapTintOverlay({
                p,
                canvas: staleEntry.canvas,
                x: staleEntry.bounds.x,
                y: staleEntry.bounds.y,
                w: staleEntry.bounds.w,
                h: staleEntry.bounds.h,
                overlay: selectedOverlay,
                alphaScale: appearK,
              });
            } else if (shapeRegistrySupportsRenderPass(shapeRegistry, item.shape, "depthMask")) {
              drawCachedBitmapBrightnessOverlay({
                p,
                canvas: staleEntry.canvas,
                x: staleEntry.bounds.x,
                y: staleEntry.bounds.y,
                w: staleEntry.bounds.w,
                h: staleEntry.bounds.h,
                alpha: brightnessAlpha,
                alphaScale: appearK,
              });
            }
            updateDebugState();
            return true;
          }

          if (staleKey) fallbackKeys.delete(fallbackKey);
          debug.markGenericBudgetSkip();
          updateDebugState();
          return false;
        }

        entry = cache.createEntry(bounds, dpr);
        bakesThisFrame += 1;
        debug.markGenericCreated(entry.pixels);
        debug.markGenericBake();
        bakeShape({ entry, shapeRegistry, item, rEff, opts, dpr });
        cache.set(key, entry);
        fallbackKeys.set(fallbackKey, key);
        debug.markTrimmed(cache.trim(maxPixels));
        updateDebugState();
      } else {
        debug.markGenericHit();
        cache.touch(key, entry);
        fallbackKeys.set(fallbackKey, key);
      }

      blitWithAppear(p.drawingContext, appearK, entry.canvas, entry.bounds.x, entry.bounds.y, entry.bounds.w, entry.bounds.h);
      if (selectedOverlay) {
        drawCachedBitmapTintOverlay({
          p,
          canvas: entry.canvas,
          x: entry.bounds.x,
          y: entry.bounds.y,
          w: entry.bounds.w,
          h: entry.bounds.h,
          overlay: selectedOverlay,
          alphaScale: appearK,
        });
      } else if (shapeRegistrySupportsRenderPass(shapeRegistry, item.shape, "depthMask")) {
        drawCachedBitmapBrightnessOverlay({
          p,
          canvas: entry.canvas,
          x: entry.bounds.x,
          y: entry.bounds.y,
          w: entry.bounds.w,
          h: entry.bounds.h,
          alpha: brightnessAlpha,
          alphaScale: appearK,
        });
      }
      debug.markGenericDrawn();
      updateDebugState();
      return true;
    } finally {
      if (selectK > 0) p.drawingContext.restore();
    }
  };

  return Object.assign(drawFarShapeBitmap, {
    clear: clearCache,
  });
}
