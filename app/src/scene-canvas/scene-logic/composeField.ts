// src/scene-canvas/scene-logic/composeField.ts

import { currentViewportDeviceType, getLandscapeCountScale, type DeviceType } from "../shared/responsiveness";
import { resolvePaddingSpec } from "../scene-rules/canvas-padding";
import type { CanvasPaddingSpec } from "../scene-rules/canvas-padding";
import { makeCenteredSquareGrid, usedRowsFromSpec } from "../grid-layout/buildGrid";
import type { GridMetrics } from "../grid-layout/gridMetrics";
import { SHAPES } from "../scene-rules/shapeCatalog";
import { footprintForShape } from "../scene-rules/shapeFootprints";
import { stableItemId, interpolatePct } from "../scene-rules/placement-rules/index";
import type { DeviceCount, PlacementZone, PointPlacement, ScenePlacementRules } from "../scene-rules/placement-rules/index";

import type { ComposeOpts, ComposeResult, PoolItem, FootRect } from "./types";
import { clamp01 } from "./math";
import { placePoolItems } from "./place";

const CENTER_PLACEMENT_KEY = -2000;

function resolveDeviceCount(
  count: DeviceCount | undefined,
  device: DeviceType,
  fallbackWhenMissing: number
) {
  if (!count) return fallbackWhenMissing;
  return count[device] ?? 0;
}

function formatKeyNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(4).replace(/\.?0+$/, "");
}

function occurrenceKey(base: string, seen: Map<string, number>) {
  const occurrence = seen.get(base) ?? 0;
  seen.set(base, occurrence + 1);
  return occurrence === 0 ? base : `${base}#${String(occurrence)}`;
}

function pointPlacementKey(shape: string, point: PointPlacement) {
  return [
    "point",
    shape,
    `x:${formatKeyNumber(point.xK)}`,
    `y:${formatKeyNumber(point.yK)}`,
  ].join("|");
}

function zonePlacementKey(shape: string, zone: PlacementZone) {
  const horizontal = zone.horizontalK ?? [0, 1];
  return [
    "zone",
    shape,
    `v:${formatKeyNumber(zone.verticalK[0])}-${formatKeyNumber(zone.verticalK[1])}`,
    `h:${formatKeyNumber(horizontal[0])}-${formatKeyNumber(horizontal[1])}`,
  ].join("|");
}

function hasExplicitShapePlacement(
  rule: ComposeOpts["placements"][keyof ComposeOpts["placements"]]
): boolean {
  if (!rule || Array.isArray(rule) || "kind" in rule) return false;
  const r = rule as { center?: unknown; points?: unknown[]; zones?: unknown[] };
  return "center" in r ||
    (Array.isArray(r.points) && r.points.length > 0) ||
    (Array.isArray(r.zones) && r.zones.length > 0);
}

function buildPresetPool(
  opts: ComposeOpts,
  device: DeviceType,
  landscapeScale: number
): PoolItem[] {
  const preset = opts.placements.preset;
  if (preset?.kind !== "zone-communities") return [];

  const t = clamp01(opts.liveAvg);
  const queues: PoolItem[][] = [];
  const zoneIdCounts = new Map<string, number>();

  preset.zones.forEach((zone, zoneIdx) => {
    let stableZoneKey: string | null = null;
    const resolveStableZoneKey = () => {
      if (stableZoneKey) return stableZoneKey;

      const zoneIdBase = zone.id || `zone-${String(zoneIdx)}`;
      const zoneIdOccurrence = zoneIdCounts.get(zoneIdBase) ?? 0;
      zoneIdCounts.set(zoneIdBase, zoneIdOccurrence + 1);
      stableZoneKey = zoneIdOccurrence === 0
        ? zoneIdBase
        : `${zoneIdBase}#${String(zoneIdOccurrence)}`;
      return stableZoneKey;
    };

    for (const shape of SHAPES) {
      if (hasExplicitShapePlacement(opts.placements[shape])) continue;

      const rule = zone.shapes[shape];
      if (!rule) continue;

      const baseCount = resolveDeviceCount(rule.count, device, 0);
      const pct = interpolatePct(rule.quota, t);
      const bandScale = zone.band === "sky" ? 1 : landscapeScale;
      const count = Math.max(0, Math.round(baseCount * pct / 50 * bandScale));
      if (count <= 0) continue;

      const size = footprintForShape(shape);
      const radiusX = zone.radius.xTiles ?? zone.radius.tiles * (zone.radius.xDistort ?? 1);
      const radiusY = zone.radius.yTiles ?? zone.radius.tiles * (zone.radius.yDistort ?? 1);
      const radiusShape = zone.radius.shape ?? "ellipse";
      const queue: PoolItem[] = [];

      for (let i = 0; i < count; i++) {
        queue.push({
          id: stableItemId(shape, resolveStableZoneKey(), i),
          shape,
          size,
          communityZone: {
            band: zone.band,
            centerX: zone.center.x,
            centerY: zone.center.y,
            radiusShape,
            radiusX,
            radiusY,
          },
        });
      }

      queues.push(queue);
    }
  });

  const items: PoolItem[] = [];
  let round = 0;
  let found = true;

  while (found) {
    found = false;
    for (const queue of queues) {
      const item = (queue as (PoolItem | undefined)[])[round];
      if (item !== undefined) {
        items.push(item);
        found = true;
      }
    }
    round += 1;
  }

  return items;
}

function buildRulePool(opts: ComposeOpts, device: DeviceType, landscapeScale: number): PoolItem[] {
  const { placements, liveAvg } = opts;
  const t = clamp01(liveAvg);
  const items: PoolItem[] = [];

  for (const shape of SHAPES) {
    const rule = placements[shape];
    if (!rule) continue;

    const pct = interpolatePct(rule.quota, t);
    const size = footprintForShape(shape);
    const pointKeyCounts = new Map<string, number>();
    const zoneKeyCounts = new Map<string, number>();

    if (rule.center) {
      const baseCount = resolveDeviceCount(rule.center.count, device, 1);
      const count = Math.max(0, Math.round(baseCount * pct / 50 * landscapeScale));

      for (let i = 0; i < count; i++) {
        items.push({
          id: stableItemId(shape, CENTER_PLACEMENT_KEY, i),
          shape,
          size,
          center: {
            xK: rule.center.xK ?? 0.5,
            yK: rule.center.yK ?? 0.5,
            scale: rule.center.scale ?? 1,
          },
        });
      }
    }

    rule.points?.forEach((pointPlacement) => {
      const baseCount = resolveDeviceCount(pointPlacement.count, device, 1);
      const count = Math.max(0, Math.round(baseCount * pct / 50 * landscapeScale));
      if (count <= 0) return;

      const pointKey = occurrenceKey(pointPlacementKey(shape, pointPlacement), pointKeyCounts);

      for (let i = 0; i < count; i++) {
        items.push({
          id: stableItemId(shape, pointKey, i),
          shape,
          size,
          point: {
            xK: pointPlacement.xK,
            yK: pointPlacement.yK,
          },
        });
      }
    });

    rule.zones?.forEach((zone, zoneIdx) => {
      const baseCount = resolveDeviceCount(zone.count, device, 0);
      const count = Math.max(0, Math.round(baseCount * pct / 50 * landscapeScale));
      if (count <= 0) return;

      const zoneKey = occurrenceKey(zonePlacementKey(shape, zone), zoneKeyCounts);

      for (let i = 0; i < count; i++) {
        items.push({
          id: stableItemId(shape, zoneKey, i),
          shape,
          zoneIndex: zoneIdx,
          size,
        });
      }
    });
  }

  return items;
}

function buildPool(opts: ComposeOpts, device: DeviceType, landscapeScale: number): PoolItem[] {
  const rulePool = buildRulePool(opts, device, landscapeScale);

  if (opts.placements.preset?.kind === "zone-communities") {
    return [...rulePool, ...buildPresetPool(opts, device, landscapeScale)];
  }

  return rulePool;
}

// All serializable fields needed by placePoolItems — spec.forbidden is kept as-is here
// but stripped before sending across the worker boundary (see compose-worker-host.ts).
export interface FieldPrelude {
  pool: PoolItem[];
  spec: CanvasPaddingSpec;
  device: DeviceType;
  rows: number;
  cols: number;
  cell: number;
  cellW: number;
  cellH: number;
  ox: number | undefined;
  oy: number | undefined;
  metrics: GridMetrics | undefined;
  canvas: { w: number; h: number };
  usedRows: number;
  salt: number;
  placements: ScenePlacementRules;
  reservedFootprints: FootRect[];
}

export function buildFieldPrelude(opts: ComposeOpts): FieldPrelude | null {
  const w = Math.round(opts.canvas.w);
  const h = Math.round(opts.canvas.h);
  const ruleW = Math.round(opts.ruleWidthPx ?? w);

  const device = opts.ruleDevice ?? currentViewportDeviceType(ruleW);
  const landscapeScale = opts.ruleDevice === undefined
    ? getLandscapeCountScale(device, opts.landscapeCountScale)
    : 1;
  const spec = resolvePaddingSpec(ruleW, opts.padding);

  const { cell, cellW, cellH, ox, oy, rows, cols, metrics } = makeCenteredSquareGrid({
    w,
    h,
    rows: spec.rows,
    useTopRatio: spec.useTopRatio ?? 1,
    horizonPos: spec.horizonPos,
  });

  if (!rows || !cols || !cell) return null;

  const usedRows = usedRowsFromSpec(rows, spec.useTopRatio);
  const salt =
    typeof opts.salt === "number"
      ? opts.salt
      : (rows * 73856093) ^ (cols * 19349663);

  const pool = buildPool(opts, device, landscapeScale);

  return {
    pool,
    spec,
    device,
    rows,
    cols,
    cell,
    cellW,
    cellH,
    ox,
    oy,
    metrics,
    canvas: { w, h },
    usedRows,
    salt,
    placements: opts.placements,
    reservedFootprints: opts.reservedFootprints ?? [],
  };
}

export function composeField(opts: ComposeOpts): ComposeResult {
  const prelude = buildFieldPrelude(opts);
  if (!prelude) return { placed: [] };
  const { placed } = placePoolItems(prelude);
  return { placed };
}
