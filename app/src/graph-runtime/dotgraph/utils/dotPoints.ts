// src/graph-runtime/dotgraph/utils/dotPoints.ts

import type { Vec3, GeneratePositionsOptions } from "./positions";
import { generatePositions } from "./positions";
import { sampleStops, rgbString } from "../../../lib/utils/color-and-interpolation";

export interface SurveyResponseLike {
  _id?: string;
  avgWeight?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  q5?: number;
  soloMessage?: string;
  __dotSlotIndex?: number;
  __dotSlotCapacity?: number;
}

export interface DotPoint {
  position: Vec3;
  originalPosition: Vec3;
  color: string;
  averageWeight: number;
  _id?: string;
}

export interface DotPointsOptions extends GeneratePositionsOptions {
  colorForAverage?: (avg: number) => string;
  personalizedEntryId?: string | null;
  showPersonalized?: boolean;

  minDistance?: number;
  spreadOverride?: number;
}

const defaultColorForAverage = (avg: number) => rgbString(sampleStops(avg));

const hashFromString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const hashUnit = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
};

const computeLocalAvg = (response: SurveyResponseLike): number | undefined => {
  const vals = [response.q1, response.q2, response.q3, response.q4, response.q5]
    .filter((value): value is number => Number.isFinite(value));
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

function normalizedSlotIndex(response: SurveyResponseLike, fallbackIndex: number): number {
  const slotIndex = response.__dotSlotIndex;
  return typeof slotIndex === "number" && Number.isFinite(slotIndex) && slotIndex >= 0
    ? Math.floor(slotIndex)
    : fallbackIndex;
}

function resolvePositionCapacity(data: SurveyResponseLike[]) {
  let capacity = data.length;
  for (let i = 0; i < data.length; i += 1) {
    const response = data[i];
    const slotIndex = normalizedSlotIndex(response, i);
    capacity = Math.max(capacity, slotIndex + 1);
    if (
      typeof response.__dotSlotCapacity === "number" &&
      Number.isFinite(response.__dotSlotCapacity)
    ) {
      capacity = Math.max(capacity, Math.floor(response.__dotSlotCapacity));
    }
  }
  return Math.max(0, capacity);
}

export function computeDotPoints(
  data: SurveyResponseLike[],
  opts: DotPointsOptions = {}
): DotPoint[] {
  const safe = Array.isArray(data) ? data : [];
  const n = safe.length;
  if (n === 0) return [];

  const {
    colorForAverage = defaultColorForAverage,
    personalizedEntryId,
    showPersonalized = false,

    minDistance = 2.5,
    spreadOverride,

    // pass-through to generatePositions
    baseRadius,
    densityK,
    maxRadiusCap,
    yaw,
    pitch,
    roll,
    jitterAmp,
    relaxPasses,
    relaxStrength,
    seed,

    tightRefN,
    baseRadiusTight,
    tightMaxAlpha,
    tightCurve,
  } = opts;

  const positionCapacity = resolvePositionCapacity(safe);
  const base = generatePositions(
    positionCapacity,
    minDistance,
    spreadOverride,
    {
      baseRadius,
      densityK,
      maxRadiusCap,
      yaw,
      pitch,
      roll,
      jitterAmp,
      relaxPasses,
      relaxStrength,
      seed,
      tightRefN,
      baseRadiusTight,
      tightMaxAlpha,
      tightCurve,
    }
  );

  const pts: DotPoint[] = safe.map((response, i) => {
    const rawAvg =
      typeof response.avgWeight === 'number' && Number.isFinite(response.avgWeight)
        ? response.avgWeight
        : computeLocalAvg(response);

    // Guarantee a real number no matter what:
    const avg: number =
      typeof rawAvg === 'number' && Number.isFinite(rawAvg) ? rawAvg : 0.5;

    const slotIndex = normalizedSlotIndex(response, i);
    const pos: Vec3 = base[slotIndex];

    return {
      position: pos,
      originalPosition: pos,
      color: colorForAverage(avg),
      averageWeight: avg,
      _id: response._id,
    };
  });

  if (showPersonalized && personalizedEntryId) {
    const mine = pts.find((p) => p._id === personalizedEntryId);
    if (mine) {
      mine.position = [0, 0, 0];
      mine.originalPosition = [0, 0, 0];

      // Ensure no other shape spawns inside the clear zone around the
      // personalized shape. Any shape closer than CLEAR_RADIUS is pushed
      // radially outward to the boundary.
      const CLEAR_RADIUS = 22;
      const FRONT_CORRIDOR_RADIUS = 26;
      for (const pt of pts) {
        if (pt._id === personalizedEntryId) continue;
        const [x, y, z] = pt.position;
        const dist = Math.hypot(x, y, z);
        if (dist < CLEAR_RADIUS) {
          const scale = dist < 0.001 ? 1 : CLEAR_RADIUS / dist;
          const pushed: Vec3 = [x * scale, y * scale, z * scale];
          pt.position = pushed;
          pt.originalPosition = pushed;
        }

        // Initial camera looks down the z axis toward the personalized shape.
        // Keep that first-open sightline clear; later user rotation can move
        // shapes through this view naturally.
        if (pt.position[2] > 0) {
          const [px, py, pz] = pt.position;
          const planarDist = Math.hypot(px, py);
          if (planarDist < FRONT_CORRIDOR_RADIUS) {
            const fallbackSeed = hashFromString(pt._id ?? `${String(px)}:${String(py)}:${String(pz)}`);
            const fallbackAngle = hashUnit(fallbackSeed) * Math.PI * 2;
            const dirX = planarDist < 0.001 ? Math.cos(fallbackAngle) : px / planarDist;
            const dirY = planarDist < 0.001 ? Math.sin(fallbackAngle) : py / planarDist;
            const pushed: Vec3 = [
              dirX * FRONT_CORRIDOR_RADIUS,
              dirY * FRONT_CORRIDOR_RADIUS,
              pz,
            ];
            pt.position = pushed;
            pt.originalPosition = pushed;
          }
        }
      }
    }
  }

  return pts;
}
