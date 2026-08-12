import type {
  BackgroundAnchorContext,
  BackgroundSpec,
} from "../../../../scene-rules/backgrounds";
import type { SceneLookupKey } from "../../../../scene-rules/lookup";
import type { PLike } from "../../../p/makeP";
import {
  clearOffscreenEntry,
  createOffscreenCache,
  drawCanvasLayer,
  getOrCreateCanvasLayer,
} from "../../cache/offscreenCache";
import { backgroundAnchorCacheKey } from "./anchors";
import { drawBackground } from "./background";

// Offscreen cache for background base + overlay; stars stay live because they animate.
export function createBgCache() {
  const cache = createOffscreenCache();
  let cacheKey = "";
  let lastOverride: BackgroundSpec | null | undefined = undefined;

  const drawBgCached = function drawBgCached(
    p: PLike,
    sceneLookup: SceneLookupKey,
    override: BackgroundSpec | null,
    liveAvg: number,
    anchors?: BackgroundAnchorContext,
    compositeAlpha = 1
  ) {
    const w = p.width;
    const h = p.height;
    const { entry, targetChanged } = getOrCreateCanvasLayer(cache, p);
    if (targetChanged) cacheKey = "";

    const liveAvgQ = Math.round(liveAvg * 100);
    const key = [
      String(w),
      String(h),
      sceneLookup,
      String(liveAvgQ),
      backgroundAnchorCacheKey(anchors),
    ].join("|");

    if (key !== cacheKey || override !== lastOverride) {
      const offCtx = entry.ctx;
      clearOffscreenEntry(entry);
      const fakeP = {
        drawingContext: offCtx,
        width: entry.bounds.w,
        height: entry.bounds.h,
        millis: () => 0,
        background: (color: string) => {
          offCtx.fillStyle = color;
          offCtx.fillRect(0, 0, entry.bounds.w, entry.bounds.h);
        },
      } as unknown as PLike;
      drawBackground(fakeP, sceneLookup, override, 1, liveAvg, true, anchors);
      cacheKey = key;
      lastOverride = override;
    }

    drawCanvasLayer(p, entry, compositeAlpha);
  };

  return Object.assign(drawBgCached, {
    clear() {
      cache.clear();
      cacheKey = "";
      lastOverride = undefined;
    },
  });
}
