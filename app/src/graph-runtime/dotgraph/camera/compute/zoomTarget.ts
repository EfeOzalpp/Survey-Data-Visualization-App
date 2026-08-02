// src/graph-runtime/dotgraph/camera/compute/zoomTarget.ts

export function computeInitialZoomTarget(params: {
  count: number;
  isSmallScreen: boolean;
  isTabletLike: boolean;
  thresholds: { mobile: number; tablet: number; desktop: number };
  minRadius: number;
  maxRadius: number;
}) {
  const { count, isSmallScreen, isTabletLike, minRadius, maxRadius } = params;

  // Normalize count over the expected 1..300 range
  const clampedCount = Math.max(1, Math.min(300, count));
  const t = (clampedCount - 1) / 299;

  // Front-loaded curve: going from 1->50 shapes triggers most of the pullback;
  // 50->300 adds a gradual further zoom-out. Power < 1 makes the curve concave.
  const curved = Math.pow(t, 0.4);

  // Mobile stays noticeably closer throughout - tighter near + far bounds.
  const near = isSmallScreen ? 80 : isTabletLike ? 105 : 125;
  const far  = isSmallScreen ? 270 : isTabletLike ? 355 : 430;

  const target = near + curved * (far - near);
  return Math.max(minRadius, Math.min(maxRadius, target));
}
