// src/scene-canvas/runtime/render/cache-policy/index.ts

import type { RenderCachePolicy } from "./types";

export type {
  FarShapeBitmapCachePolicy,
  ShapeDepthMaskCachePolicy,
  RenderCachePolicy,
} from "./types";

// Distance-based bitmap caching freezes tiny far-away shapes after their first stable draw.
// This keeps small background details cheap without changing the authored shape files.
const FAR_SHAPE_BITMAP_ALWAYS_LIVE = [
  "snow",
  "power",
  "sun",
  "house",
  "sea",
  "clouds",
  "carFactory",
] as const;

// Depth masks are cache-stable by default. Animated color details keep moving
// in the live color pass; the depth tint layer should not rebuild every frame.
// Kept in sync with FAR_SHAPE_BITMAP_ALWAYS_LIVE: any shape whose color pass
// draws live every frame must also rebake its mask live, or the cached
// silhouette (quantized to liveAvg buckets) drifts from the live geometry
// (e.g. house's liveAvg-driven chimney toggle).
const SHAPE_DEPTH_MASK_ALWAYS_LIVE = [
  "power",
  "sea",
  "carFactory",
  "clouds",
  "snow",
  "sun",
  "house",
] as const;

// Cache policy for runtime-rendered shape bitmaps and depth masks.
export const DEFAULT_RENDER_CACHE_POLICY: RenderCachePolicy = {
  farShapeBitmap: {
    enabled: true,
    farSizeK: 0.7,
    // Far-shape bitmap memory scales with the canvas instead of a fixed item count.
    maxPixelsPerCanvasPixel: 5,
    // Avoid click-time liveAvg changes rebaking every distant desktop shape in one frame.
    maxBakesPerFrame: 48,
    // These shapes keep moving or emitting particles, so distance caching would freeze them.
    alwaysLiveShapes: FAR_SHAPE_BITMAP_ALWAYS_LIVE,
    // Clouds stay animated while readable, but tiny horizon clouds can freeze.
    cacheBelowSizeK: {
      clouds: 0.4,
      snow: 0.3,
      power: 0.2,
      house: 0.25,
      carFactory: 0.25,
    },
  },
  shapeDepthMask: {
    // Total cached mask backing pixels scale with the visible canvas.
    // This avoids one fixed number being too small for desktop or too large for mobile.
    maxPixelsPerCanvasPixel: 5,
    // Missing masks warm in over multiple frames instead of all baking at startup.
    maxBakesPerFrame: 12,
    // Skip nearly invisible overlays. They still cost a mask lookup/blit,
    // and row-count changes can otherwise create sharp performance cliffs.
    minBlend: 0.08,
    // Opt-in only. Default masks stay cached to avoid liveAvg-driven rebuild churn.
    alwaysLiveShapes: SHAPE_DEPTH_MASK_ALWAYS_LIVE,
  },
};
