import {
  BACKGROUNDS,
  type BackgroundSpec,
} from "../../../../scene-rules/backgrounds";
import type { SceneLookupKey } from "../../../../scene-rules/lookup";
import type { PLike } from "../../../p/makeP";
import { clamp01 } from "../../../../shared/math";
import { mix } from "../shared/color";

interface StarParticle {
  x: number;
  y: number;
  r: number;
  hz: number;
  phase: number;
}

function hash01(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function coprimeStride(count: number): number {
  if (count <= 2) return 1;
  const target = Math.max(1, Math.round(count * 0.6180339887498948));

  for (let offset = 0; offset < count; offset += 1) {
    const hi = target + offset;
    if (hi < count && gcd(hi, count) === 1) return hi;

    const lo = target - offset;
    if (lo > 0 && gcd(lo, count) === 1) return lo;
  }

  return 1;
}

function starX(index: number, count: number, width: number, stride: number): number {
  if (count <= 1) return width * hash01(index + 1.11);

  const stripe = (index * stride) % count;
  return ((stripe + hash01(index + 1.11)) / count) * width;
}

function isRangePair(
  value: [number, number] | readonly [[number, number], [number, number]]
): value is readonly [[number, number], [number, number]] {
  return Array.isArray(value[0]);
}

function resolveStarRange(
  value: [number, number] | readonly [[number, number], [number, number]],
  liveAvg: number
): readonly [number, number] {
  if (!isRangePair(value)) return value;
  return [
    mix(value[0][0], value[1][0], clamp01(liveAvg)),
    mix(value[0][1], value[1][1], clamp01(liveAvg)),
  ] as const;
}

function resolveStarCount(
  count: NonNullable<BackgroundSpec["stars"]>["count"],
  liveAvg: number
) {
  return Math.max(
    0,
    Math.round(
      typeof count === "number"
        ? count
        : mix(count[0], count[1], clamp01(liveAvg))
    )
  );
}

function resolveMaxStarCount(count: NonNullable<BackgroundSpec["stars"]>["count"]) {
  return Math.max(
    0,
    Math.round(typeof count === "number" ? count : Math.max(count[0], count[1]))
  );
}

export function createStarGeometryCache() {
  let lastKey = "";
  const stars: StarParticle[] = [];

  const getStars = function getStars(args: {
    width: number;
    height: number;
    spec: NonNullable<BackgroundSpec["stars"]>;
  }): StarParticle[] {
    const { width, height, spec } = args;
    const maxY = height * spec.topBandK;
    const starCount = resolveMaxStarCount(spec.count);
    const flickerRange = resolveStarRange(spec.flickerHz, 1);

    const key = [
      String(width),
      String(height),
      String(starCount),
      String(spec.topBandK),
      String(spec.minR),
      String(spec.maxR),
      String(flickerRange[0]),
      String(flickerRange[1]),
    ].join("|");

    if (key === lastKey) return stars;

    stars.length = 0;
    const xStride = coprimeStride(starCount);
    for (let i = 0; i < starCount; i += 1) {
      stars.push({
        x: starX(i, starCount, width, xStride),
        y: hash01(i + 7.73) * maxY,
        r: spec.minR + (spec.maxR - spec.minR) * hash01(i + 15.37),
        hz: flickerRange[0] + (flickerRange[1] - flickerRange[0]) * hash01(i + 23.91),
        phase: hash01(i + 31.17) * Math.PI * 2,
      });
    }

    lastKey = key;
    return stars;
  };

  return Object.assign(getStars, {
    clear() {
      lastKey = "";
      stars.length = 0;
    },
  });
}

export function drawStars(
  p: PLike,
  ctx: CanvasRenderingContext2D,
  spec: NonNullable<BackgroundSpec["stars"]>,
  liveAvg: number,
  getStars: ReturnType<typeof createStarGeometryCache>
) {
  const t = p.millis() / 1000;
  const stars = getStars({
    width: p.width,
    height: p.height,
    spec,
  });

  const activeCount = Math.min(stars.length, resolveStarCount(spec.count, liveAvg));
  const alphaRange = resolveStarRange(spec.alpha, liveAvg);

  ctx.save();

  for (let i = 0; i < activeCount; i += 1) {
    const star = stars[i];
    const twinkle = 0.5 + 0.5 * Math.sin(t * star.hz * Math.PI * 2 + star.phase);
    const alpha = alphaRange[0] + (alphaRange[1] - alphaRange[0]) * twinkle;

    ctx.fillStyle = `rgba(245, 248, 255, ${String(alpha)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function resolveBackgroundSpec(
  sceneLookup: SceneLookupKey,
  override: BackgroundSpec | null
): BackgroundSpec {
  return override ?? BACKGROUNDS[sceneLookup];
}

// Live star pass. The background cache skips stars because their alpha changes every frame.
export function drawBackgroundStarsOnly(
  p: PLike,
  sceneLookup: SceneLookupKey,
  override: BackgroundSpec | null = null,
  alpha = 1,
  liveAvg = 0.5,
  getStars: ReturnType<typeof createStarGeometryCache>
) {
  const spec = resolveBackgroundSpec(sceneLookup, override);
  if (!spec.stars) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawStars(p, ctx, spec.stars, liveAvg, getStars);
  ctx.restore();
}
