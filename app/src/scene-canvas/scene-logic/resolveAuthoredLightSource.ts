import { currentViewportDeviceType, type DeviceType } from "../shared/responsiveness";
import { interpolatePct, type DeviceCount, type ScenePlacementRules } from "../scene-rules/placement-rules";
import type { SceneShapeLightSource } from "./shapeLightSource";

function resolveActiveDeviceCount(
  count: DeviceCount | undefined,
  device: DeviceType,
  fallbackWhenMissing = 0
) {
  if (!count) return fallbackWhenMissing;
  return count[device] ?? 0;
}

function hasActiveCount(
  count: DeviceCount | undefined,
  quota: Parameters<typeof interpolatePct>[0],
  device: DeviceType,
  liveAvg: number | undefined,
  fallbackWhenMissing = 0
) {
  const baseCount = resolveActiveDeviceCount(count, device, fallbackWhenMissing);
  if (baseCount <= 0) return false;

  const t = typeof liveAvg === "number" && Number.isFinite(liveAvg) ? liveAvg : 0.5;
  return Math.round(baseCount * interpolatePct(quota, t) / 50) > 0;
}

export function resolveAuthoredLightSource(
  placements: ScenePlacementRules,
  liveAvg: number | undefined,
  ruleWidthPx: number,
  ruleDevice?: DeviceType
): SceneShapeLightSource | null {
  const device = ruleDevice ?? currentViewportDeviceType(ruleWidthPx);
  const sunRule = placements.sun;

  if (sunRule?.center && hasActiveCount(sunRule.center.count, sunRule.quota, device, liveAvg, 1)) {
    return {
      xK: sunRule.center.xK ?? 0.5,
      yK: sunRule.center.yK ?? 0.5,
      paletteClosenessK: 0.9,
    };
  }

  for (const point of sunRule?.points ?? []) {
    if (!hasActiveCount(point.count, sunRule?.quota, device, liveAvg, 1)) continue;
    return {
      xK: point.xK,
      yK: point.yK,
      paletteClosenessK: 0.9,
    };
  }

  for (const zone of sunRule?.zones ?? []) {
    if (!hasActiveCount(zone.count, sunRule?.quota, device, liveAvg)) continue;
    const horizontal = zone.horizontalK ?? [0, 1];
    return {
      xK: (horizontal[0] + horizontal[1]) / 2,
      yK: (zone.verticalK[0] + zone.verticalK[1]) / 2,
      paletteClosenessK: 0.9,
    };
  }

  const zones = placements.preset?.kind === "zone-communities"
    ? placements.preset.zones
    : [];

  for (const zone of zones) {
    const sun = zone.shapes.sun;
    if (!sun || !hasActiveCount(sun.count, sun.quota, device, liveAvg)) continue;
    return {
      xK: zone.center.x,
      yK: zone.center.y,
      paletteClosenessK: 0.9,
    };
  }

  return null;
}

