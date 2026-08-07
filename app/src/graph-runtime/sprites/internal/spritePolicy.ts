// graph-runtime/sprites/internal/spritePolicy.ts
import { sampleShapeForAvg } from '../selection/shapeForAvg';
import type { ShapeKey, SpriteAssignment, SpriteBleed, SpriteFootprint } from '../types';
import {
  forcedSpriteAvg,
  forcedSpriteAvgCacheKey,
  forcedSpriteShape,
  forcedSpriteShapeCacheKey,
  spriteQuantizationDisabled,
} from '../../debug/spriteFlags';
import {
  bumpSpriteCacheMetric,
  recordSpriteBucket,
} from '../../debug/spriteCacheMetrics';

// Sprite policy turns score data into stable cacheable sprite identity:
// shape, color bucket, and visual variant.
const SPRITE_TINT_BUCKETS = 10;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

// Scores are biased downward before bucketing so high-emission visuals do not
// overuse the brightest/highest tint buckets.
const BIAS_GAMMA = 1.8;
function biasDown(t: number, gamma = BIAS_GAMMA) {
  return Math.pow(clamp01(t), Math.max(1, gamma));
}
function rawBucketIdFromAvg(avg: number) {
  const t = Number.isFinite(avg) ? avg : 0.5;
  const tb = biasDown(t);
  return Math.min(SPRITE_TINT_BUCKETS - 1, Math.floor(tb * SPRITE_TINT_BUCKETS));
}
const REMAP: number[] = [0, 0, 1, 1, 2, 3, 4, 6, 6, 6];
function adjustedBucketId(id: number) {
  return REMAP[Math.max(0, Math.min(9, id))] ?? 0;
}
// REMAP only ever produces 6 distinct ids (0,1,2,3,4,6 — 5 is skipped, 7/8/9
// collapse into 6), so treating them as if spread across the full 0-9 span
// (dividing by SPRITE_TINT_BUCKETS) caps the top bucket's avg at 0.65 no
// matter how good the real score is. Rank them among the ids REMAP can
// actually produce instead, so the top bucket still reaches close to 1.
const DISTINCT_ADJUSTED_IDS = Array.from(new Set(REMAP)).sort((a, b) => a - b);
function bucketMidpoint(id: number) {
  const rank = DISTINCT_ADJUSTED_IDS.indexOf(id);
  const rankSafe = rank === -1 ? 0 : rank;
  return (rankSafe + 0.5) / DISTINCT_ADJUSTED_IDS.length;
}

export function quantizeAvgWithDownshift(avg: number) {
  if (spriteQuantizationDisabled()) {
    bumpSpriteCacheMetric('quantizationDisabledCalls');
    const unclamped = clamp01(Number.isFinite(avg) ? avg : 0.5);
    const bucketId = Math.round(unclamped * 1000);
    recordSpriteBucket(bucketId);
    return { bucketId, bucketAvg: unclamped };
  }

  bumpSpriteCacheMetric('quantizationCalls');
  const base = rawBucketIdFromAvg(avg);
  const adj = adjustedBucketId(base);
  recordSpriteBucket(adj);
  return { bucketId: adj, bucketAvg: bucketMidpoint(adj) };
}

// Variant slots let repeated shapes share the same drawer while still looking varied.
export const DEFAULT_VARIANT_SLOTS = 8;

export function resolveSpriteAvgForDebug(avg: number | undefined) {
  const fallbackAvg = typeof avg === 'number' && Number.isFinite(avg) ? avg : 0.5;
  return forcedSpriteAvg() ?? fallbackAvg;
}

function hash01(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

export function pickVariantSlot(seedStr: string, slots = DEFAULT_VARIANT_SLOTS) {
  const s = Math.max(1, slots | 0);
  return Math.floor(hash01(seedStr) * s) % s;
}

// Texture keys include every input that changes pixels. If a value affects art,
// it belongs in the key.
export function makeStaticKey(args: {
  shape: ShapeKey;
  tileSize: number;
  dpr: number;
  alpha: number;
  bucketId: number;
  variant: number;
  darkMode?: boolean;
  pixelScaleBoost?: number;
  footprint?: SpriteFootprint;
  bleed?: SpriteBleed;
}) {
  const { shape, tileSize, dpr, alpha, bucketId, variant, darkMode, pixelScaleBoost, footprint, bleed } = args;
  const boostSuffix = pixelScaleBoost !== undefined && pixelScaleBoost !== 1
    ? `|PX${String(pixelScaleBoost)}`
    : '';
  const geometrySuffix = footprint
    ? `|FP${String(footprint.w)}x${String(footprint.h)}|BL${String(bleed?.top ?? 0)},${String(bleed?.right ?? 0)},${String(bleed?.bottom ?? 0)},${String(bleed?.left ?? 0)}`
    : '';
  return [
    'SPRITE',
    shape,
    `B${String(bucketId)}`,
    `V${String(variant)}`,
    String(tileSize),
    String(dpr),
    String(alpha),
    `STATIC_NATIVE${darkMode ? '|DK' : ''}${boostSuffix}${geometrySuffix}`,
  ].join('|');
}

export function makeSpriteSeedKey(args: {
  shape: ShapeKey;
  bucketId: number;
  variant: number;
}) {
  const { shape, bucketId, variant } = args;
  return ['SPRITE_SEED', shape, `B${String(bucketId)}`, `V${String(variant)}`].join('|');
}

export function chooseShape(args: { avg: number; seed?: string | number; orderIndex?: number }) {
  const forced = forcedSpriteShape();
  if (forced) return forced;
  const avg = resolveSpriteAvgForDebug(args.avg);
  const t = clamp01(Number.isFinite(avg) ? avg : 0.5);
  return sampleShapeForAvg(t, args.seed ?? t, args.orderIndex);
}

const _assignmentCache = new Map<string, SpriteAssignment>();

// Cache by respondent + section so the same entry does not shapeshift during rerenders.
export function getOrAssignShapeEntry(
  entryId: string,
  sectionKey: string,
  avg: number,
  seed: string | number,
  orderIndex: number,
  variantSlots = DEFAULT_VARIANT_SLOTS
): SpriteAssignment {
  const cacheKey = `${entryId}|${sectionKey}|${forcedSpriteShapeCacheKey()}|${forcedSpriteAvgCacheKey()}`;
  const hit = _assignmentCache.get(cacheKey);
  if (hit) {
    bumpSpriteCacheMetric('assignmentCacheHits');
    return hit;
  }
  bumpSpriteCacheMetric('assignmentCacheMisses');

  const effectiveAvg = resolveSpriteAvgForDebug(avg);
  const shape = chooseShape({ avg: effectiveAvg, seed, orderIndex });
  const { bucketId, bucketAvg } = quantizeAvgWithDownshift(effectiveAvg);
  const vSeed = `${shape}|B${String(bucketId)}|${String(seed)}|${String(orderIndex)}`;
  const variant = pickVariantSlot(vSeed, Math.max(1, variantSlots));

  const assignment: SpriteAssignment = { shape, variant, bucketId, bucketAvg, sourceAvg: clamp01(effectiveAvg) };
  _assignmentCache.set(cacheKey, assignment);
  return assignment;
}

export function resolveDpr(fallback = 1) {
  return typeof window !== 'undefined'
    ? Math.min(1.5, window.devicePixelRatio)
    : fallback;
}
