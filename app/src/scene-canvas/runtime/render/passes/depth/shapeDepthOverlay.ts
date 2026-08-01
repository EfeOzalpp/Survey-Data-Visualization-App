import type { EngineFieldItem } from "../../../engine/field";
import type { PLike } from "../../../p/makeP";
import { shapeRegistrySupportsRenderPass, type ShapeRegistry } from "../../../shape-adapter/registry";
import { copyRuntimeShapeOptionsInto } from "../../../shape-adapter/options";
import type { RuntimeShapeOptions } from "../../../shape-adapter/types";
import type { ShapeDepthMaskCachePolicy } from "../../cache-policy";
import type { RGB } from "../../../../shared/math";
import { footprintToPx } from "../../../../modifiers/index";
import { clamp01, finiteNumber } from "../../../../shared/math";
import {
  shapeIdentity,
  shapeLifecycle,
  shapePass,
  shapeProjection,
  shapeStyle,
} from "../../../../shapes/options";
import { createDepthMaskDebugTracker } from "../../../debug";
import { drawItemFromRegistry } from "../../../shape-adapter/draw";
import { liveAvgBucketAvg, liveAvgBucketId } from "../shape/cache/bitmapKeys";
import {
  canvasDpr,
  createOffscreenCache,
  maxCachePixelsForCanvas,
  pixelSizeForBounds,
  snapBoundsToDevicePixels,
  type OffscreenBounds,
  type OffscreenCacheEntry,
} from "../../cache/offscreenCache";

type MaskBounds = OffscreenBounds;
type CachedMask = OffscreenCacheEntry;

interface ShapeDepthOverlay {
  color: RGB;
  blend: number;
}

// Shapes whose canopy/crown is authored to rise well above their footprint's
// top edge (see e.g. trees.ts TREES.layout.maxOverflowTopK + tall poplar
// canopies). The generic `pad` below is sized off cell size, not footprint
// height, so on multi-row footprints it undershoots this overflow and clips
// the top of the shape's cached mask/selection-highlight canvas even though
// the live color draw (unclipped) renders the full shape.
const EXTRA_TOP_PAD_K: Record<string, number> = {
  trees: 0.5,
};

function resolveMaskBounds(item: EngineFieldItem, rEff: number, opts: RuntimeShapeOptions): MaskBounds | null {
  const projection = shapeProjection(opts);
  const cell = finiteNumber(projection.cell, rEff);
  const cellW = finiteNumber(projection.cellW, cell);
  const cellH = finiteNumber(projection.cellH, cell);

  const rect = item.footprint
    ? footprintToPx(item.footprint, projection)
    : { x: item.x - rEff, y: item.y - rEff, w: rEff * 2, h: rEff * 2 };
  if (rect.w <= 0 || rect.h <= 0) return null;

  // A little breathing room catches roof overhangs and anti-aliased edges.
  // This is still item-sized, not a full-scene canvas.
  const pad = Math.ceil(Math.max(8, rEff * 0.65, Math.max(cellW, cellH) * 0.7));
  const topPad = pad + Math.ceil(rect.h * (EXTRA_TOP_PAD_K[item.shape] ?? 0));
  return {
    x: Math.floor(rect.x - pad),
    y: Math.floor(rect.y - topPad),
    w: Math.ceil(rect.w + pad * 2),
    h: Math.ceil(rect.h + topPad + pad),
  };
}

function rounded(value: number | undefined, precision = 10) {
  return String(Math.round(finiteNumber(value, 0) * precision) / precision);
}

function footprintKey(item: EngineFieldItem) {
  const f = item.footprint;
  return f ? `${String(f.r0)},${String(f.c0)},${String(f.w)},${String(f.h)}` : "none";
}

function colorKey(color: RGB) {
  return `${String(color.r)},${String(color.g)},${String(color.b)}`;
}

function depthOverlayFromOptions(opts: RuntimeShapeOptions): ShapeDepthOverlay | null {
  const pass = shapePass(opts);
  const color = pass.depthTintColor;
  const blend = pass.depthTintK;
  if (!color || typeof blend !== "number" || !Number.isFinite(blend) || blend <= 0) return null;
  return { color, blend: clamp01(blend) };
}

function maskCacheKey(args: {
  item: EngineFieldItem;
  rEff: number;
  opts: RuntimeShapeOptions;
  bounds: MaskBounds;
  dpr: number;
  color: RGB;
}) {
  const { item, rEff, opts, bounds, dpr, color } = args;
  const projection = shapeProjection(opts);
  const style = shapeStyle(opts);
  const identity = shapeIdentity(opts);
  return [
    item.id,
    item.shape,
    footprintKey(item),
    rounded(rEff),
    rounded(projection.cell),
    rounded(projection.cellW),
    rounded(projection.cellH),
    String(identity.shapeOccurrenceIndex ?? 0),
    String(liveAvgBucketId(style.liveAvg)),
    String(style.darkMode ? 1 : 0),
    rounded(bounds.x),
    rounded(bounds.y),
    rounded(bounds.w),
    rounded(bounds.h),
    rounded(dpr, 100),
    colorKey(color),
  ].join("|");
}

function maskFallbackKey(args: {
  item: EngineFieldItem;
  bounds: MaskBounds;
  dpr: number;
  color: RGB;
}) {
  const { item, bounds, dpr, color } = args;
  return [
    item.id,
    item.shape,
    footprintKey(item),
    rounded(bounds.x),
    rounded(bounds.y),
    rounded(bounds.w),
    rounded(bounds.h),
    rounded(dpr, 100),
    colorKey(color),
  ].join("|");
}

function isAlwaysLiveDepthMask(policy: ShapeDepthMaskCachePolicy, shape: string) {
  return policy.alwaysLiveShapes.includes(shape);
}

// Secondary map keyed by item.id so the hit-test path can look up any cached mask
// without knowing the full cache key (colour, dpr, bounds, etc.).
interface HitMaskEntry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bounds: OffscreenBounds;
  dpr: number;
}

export function createShapeDepthOverlayRenderer(getPolicy: () => ShapeDepthMaskCachePolicy) {
  const cache = createOffscreenCache<MaskBounds>();
  const fallbackKeys = new Map<string, string>();
  const hitMasks = new Map<string, HitMaskEntry>();
  const bakeOpts: RuntimeShapeOptions = {};
  const debug = createDepthMaskDebugTracker();
  let frameTimeMs = Number.NaN;
  let bakesThisFrame = 0;

  function registerHitMask(itemId: string, entry: OffscreenCacheEntry) {
    const dpr = entry.canvas.width / Math.max(1, entry.bounds.w);
    hitMasks.set(itemId, { canvas: entry.canvas, ctx: entry.ctx, bounds: entry.bounds, dpr });
  }

  function clearCache() {
    const clearedCount = cache.clear();
    fallbackKeys.clear();
    hitMasks.clear();
    debug.markCleared(clearedCount);
  }

  function syncRenderTarget(p: PLike, dpr: number) {
    const result = cache.syncRenderTarget(p, dpr);
    if (result.changed) {
      fallbackKeys.clear();
      hitMasks.clear();
      debug.markCleared(result.cleared);
    }
  }

  // Returns true if (cssX, cssY) falls on an opaque pixel of the shape's mask,
  // false if it's transparent, or null if no mask is cached yet (caller should
  // fall back to rect-based hit detection).
  function sampleHitMask(itemId: string, cssX: number, cssY: number): boolean | null {
    const mask = hitMasks.get(itemId);
    if (!mask) return null;
    const cx = Math.round((cssX - mask.bounds.x) * mask.dpr);
    const cy = Math.round((cssY - mask.bounds.y) * mask.dpr);
    if (cx < 0 || cy < 0 || cx >= mask.canvas.width || cy >= mask.canvas.height) return false;
    try {
      return mask.ctx.getImageData(cx, cy, 1, 1).data[3] > 0;
    } catch {
      return null;
    }
  }

  function syncFrameBudget(timeMs: number) {
    if (timeMs === frameTimeMs) return;
    frameTimeMs = timeMs;
    bakesThisFrame = 0;
  }

  function trimCacheToPolicy(p: PLike, policy: ShapeDepthMaskCachePolicy) {
    const trimmed = cache.trim(maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel));
    debug.markTrimmed(trimmed);
  }

  function bakeMask(args: {
    entry: CachedMask;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    color: RGB;
    timeMs: number;
    dpr: number;
    quantizeLiveAvg: boolean;
  }) {
    const { entry, shapeRegistry, item, rEff, opts, color, timeMs, dpr, quantizeLiveAvg } = args;
    const { ctx, p: maskP, bounds, canvas } = entry;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    maskP.__tick(timeMs);
    copyRuntimeShapeOptionsInto(bakeOpts, opts);
    const style = bakeOpts.style ?? (bakeOpts.style = {});
    const lifecycle = bakeOpts.lifecycle ?? (bakeOpts.lifecycle = {});
    const particles = bakeOpts.particles ?? (bakeOpts.particles = {});
    const pass = bakeOpts.pass ?? (bakeOpts.pass = {});
    // Match the far-bitmap cache: bake with the quantized liveAvg so the mask
    // silhouette always corresponds to the same variant as the visible bitmap.
    // Skip quantizing on the always-live rebake path: that path re-bakes every
    // frame to track the live color draw exactly, and a bucketed liveAvg there
    // gives shapes with time-integrated motion (e.g. power's rotor speed) a
    // persistently different rate than the live draw, so the error compounds
    // every frame into unbounded drift instead of a one-off rounding gap.
    if (!style.gradientRGBOverrideActive && quantizeLiveAvg) {
      style.liveAvg = liveAvgBucketAvg(style.liveAvg);
    }
    style.alpha = 255;
    lifecycle.rootAppearK = 1;
    particles.particleStore = undefined;
    pass.renderPass = "depthMask";
    pass.maskColor = color;
    pass.maskAlpha = 255;
    pass.depthTintColor = undefined;
    pass.depthTintK = undefined;

    maskP.push();
    maskP.translate(-bounds.x, -bounds.y);
    drawItemFromRegistry(shapeRegistry, maskP, item, rEff, bakeOpts);
    maskP.pop();

    pass.renderPass = "color";
    pass.maskColor = undefined;
    pass.maskAlpha = undefined;
  }

  const drawShapeDepthOverlay = function drawShapeDepthOverlay(args: {
    p: PLike;
    shapeRegistry: ShapeRegistry;
    item: EngineFieldItem;
    rEff: number;
    opts: RuntimeShapeOptions;
    shapeWasDrawnLive: boolean;
    overlayOverride?: ShapeDepthOverlay;
  }) {
    const { p, shapeRegistry, item, rEff, opts, shapeWasDrawnLive, overlayOverride } = args;
    const policy = getPolicy();
    const timeMs = shapeLifecycle(opts).timeMs ?? performance.now();
    syncFrameBudget(timeMs);

    debug.markCall();
    if (!shapeRegistrySupportsRenderPass(shapeRegistry, item.shape, "depthMask")) {
      debug.markSkippedUnsupported();
      debug.maybeLog(cache.size, cache.pixels);
      return;
    }
    if ((shapeLifecycle(opts).rootAppearK ?? 1) < 0.995) {
      debug.markSkippedAppear();
      debug.maybeLog(cache.size, cache.pixels);
      return;
    }
    const lc = shapeLifecycle(opts);
    if ((lc.selectK ?? 0) > 0 && !overlayOverride) {
      debug.maybeLog(cache.size, cache.pixels);
      return;
    }

    const overlay = overlayOverride ?? depthOverlayFromOptions(opts);
    if (!overlay) return;
    if (overlay.blend < policy.minBlend) {
      debug.markSkippedBlend();
      debug.maybeLog(cache.size, cache.pixels);
      return;
    }

    const dpr = canvasDpr(p);
    syncRenderTarget(p, dpr);

    const roughBounds = resolveMaskBounds(item, rEff, opts);
    if (!roughBounds) {
      debug.markSkippedBounds();
      debug.maybeLog(cache.size, cache.pixels);
      return;
    }
    const bounds = snapBoundsToDevicePixels(roughBounds, dpr);

    const key = maskCacheKey({ item, rEff, opts, bounds, dpr, color: overlay.color });
    const fallbackKey = maskFallbackKey({ item, bounds, dpr, color: overlay.color });
    // Keep the mask animation policy matched to the visible shape.
    // If far-shape LOD froze the color pass, the depth mask must freeze too.
    const alwaysLiveMask = overlayOverride != null || (shapeWasDrawnLive && isAlwaysLiveDepthMask(policy, item.shape));
    let entry = cache.get(key);

    if (!entry) {
      const maskPixels = pixelSizeForBounds(bounds, dpr).pixels;
      if (maskPixels > maxCachePixelsForCanvas(p, policy.maxPixelsPerCanvasPixel)) {
        debug.markSkippedTooLarge();
        debug.maybeLog(cache.size, cache.pixels);
        return;
      }
      if (bakesThisFrame >= policy.maxBakesPerFrame) {
        const staleKey = fallbackKeys.get(fallbackKey);
        const staleEntry = staleKey ? cache.get(staleKey) : undefined;
        if (staleEntry) {
          entry = staleEntry;
          debug.markReused();
        } else {
          if (staleKey) fallbackKeys.delete(fallbackKey);
          debug.markSkippedWarmupBudget();
          debug.maybeLog(cache.size, cache.pixels);
          return;
        }
      } else {
        entry = cache.createEntry(bounds, dpr);
        bakesThisFrame += 1;
        debug.markCreated(entry.pixels);
        debug.markBaked();
        bakeMask({
          entry,
          shapeRegistry,
          item,
          rEff,
          opts,
          color: overlay.color,
          timeMs: shapeLifecycle(opts).timeMs ?? performance.now(),
          dpr,
          quantizeLiveAvg: !alwaysLiveMask,
        });
        cache.set(key, entry);
        fallbackKeys.set(fallbackKey, key);
        trimCacheToPolicy(p, policy);
      }
    } else {
      debug.markReused();
      if (alwaysLiveMask) {
        debug.markBaked();
        bakeMask({
          entry,
          shapeRegistry,
          item,
          rEff,
          opts,
          color: overlay.color,
          timeMs: shapeLifecycle(opts).timeMs ?? performance.now(),
          dpr,
          quantizeLiveAvg: false,
        });
      }
      cache.touch(key, entry);
      fallbackKeys.set(fallbackKey, key);
    }

    registerHitMask(item.id, entry);
    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalAlpha = overlay.blend;
    ctx.drawImage(entry.canvas, entry.bounds.x, entry.bounds.y, entry.bounds.w, entry.bounds.h);
    ctx.restore();
    debug.markDrawn();
    debug.maybeLog(cache.size, cache.pixels);
  };

  return {
    draw: drawShapeDepthOverlay,
    sampleHitMask,
    clear: clearCache,
  };
}
