import {
  BACKGROUNDS,
  type BackgroundAnchorContext,
  type BackgroundSpec,
  type LinearGradientSpec,
  type RadialGradientSpec,
} from "../../../../scene-rules/backgrounds";
import type { SceneLookupKey } from "../../../../scene-rules/lookup";
import type { PLike } from "../../../p/makeP";
import { resolveBackgroundStops } from "./anchors";
import { resolveStopColor } from "../shared/color";
import { createStarGeometryCache, drawStars } from "../atmosphere/stars";
import { drawLinearStopSurface } from "./surface";

function resolveOuterRadius(p: PLike, outer: RadialGradientSpec["outer"]) {
  if (outer === "diag") return Math.hypot(p.width, p.height);
  return Math.max(1, outer.k) * Math.max(p.width, p.height);
}

function resolveLinearPoints(p: PLike, spec: LinearGradientSpec) {
  return {
    x1: p.width * spec.from.xK,
    y1: p.height * spec.from.yK,
    x2: p.width * spec.to.xK,
    y2: p.height * spec.to.yK,
  };
}

function resolveBackgroundSpec(
  sceneLookup: SceneLookupKey,
  override: BackgroundSpec | null
): BackgroundSpec {
  return override ?? BACKGROUNDS[sceneLookup];
}

// Draw the base sky/ground fill and gradient overlays.
// Runtime usually caches this pass and draws animated stars separately.
export function drawBackground(
  p: PLike,
  sceneLookup: SceneLookupKey,
  override: BackgroundSpec | null = null,
  alpha = 1,
  liveAvg = 0.5,
  skipStars = false,
  anchors?: BackgroundAnchorContext,
  getStars?: ReturnType<typeof createStarGeometryCache>
) {
  const spec = resolveBackgroundSpec(sceneLookup, override);
  const ctx = p.drawingContext;

  if (alpha >= 1) {
    p.background(spec.base);
  } else {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = spec.base;
    ctx.fillRect(0, 0, p.width, p.height);
    ctx.restore();
  }

  const overlay = spec.overlay;
  if (overlay) {
    if (overlay.kind === "solid") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = overlay.color;
      ctx.fillRect(0, 0, p.width, p.height);
      ctx.restore();
    } else if (overlay.kind === "linear") {
      const t = p.millis() / 1000;
      const needsSurfaceStops = overlay.stops.some((stop) =>
        !!stop.rightRgba || stop.blendFromPrevious === false || stop.blendToNext === false
      );
      const drewSurface = needsSurfaceStops
        ? drawLinearStopSurface(p, ctx, overlay, alpha, liveAvg, t, anchors)
        : false;

      if (!drewSurface) {
        const { x1, y1, x2, y2 } = resolveLinearPoints(p, overlay);
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        for (const resolved of resolveBackgroundStops(overlay.stops, t, anchors)) {
          const { stop, k } = resolved;
          g.addColorStop(k, resolveStopColor(stop.rgba, stop.liveBlend, liveAvg));
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, p.width, p.height);
        ctx.restore();
      }
    } else {
      const cx = p.width * overlay.center.xK;
      const cy = p.height * overlay.center.yK;
      const inner = Math.min(p.width, p.height) * overlay.innerK;
      const outer = resolveOuterRadius(p, overlay.outer);

      const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
      for (const resolved of resolveBackgroundStops(overlay.stops, p.millis() / 1000, anchors)) {
        const { stop, k } = resolved;
        g.addColorStop(k, resolveStopColor(stop.rgba, stop.liveBlend, liveAvg));
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, p.width, p.height);
      ctx.restore();
    }
  }

  if (!skipStars && spec.stars) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Direct callers can still draw stars here, but the main loop passes a cache.
    const starGeometry = getStars ?? createStarGeometryCache();
    drawStars(p, ctx, spec.stars, liveAvg, starGeometry);
    ctx.restore();
  }
}

