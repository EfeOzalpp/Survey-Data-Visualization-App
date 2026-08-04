// src/scene-canvas/shapes/clouds.ts

import {
  oscillateSaturation,
  rgbToHsl,
  hslToRgb,
  cssToRgbViaCanvas,
  makeArchLobes,
  displacementOsc,
  blendRGB,
  stepAndDrawParticles,
  particleBucketRange,
  particleDepthAlpha,
  particleDepthSizeScale,
  particleRowBucket,
  clamp01,
  resolveRangeValue,
  applyDepthTint,
  applyShapeMods,
  footprintToPx,
  finiteNumber,
  rowHeightAt,
  rowWidthAt,
  shapeHash32,
} from "../modifiers/index";
import type { NumberRange, RGB } from "../modifiers/index";
import type { ShapeCanvas, ShapeDrawOptions, ShapePalette } from "./types";
import {
  shapeIdentity,
  shapeLifecycle,
  shapeParticles,
  shapePass,
  shapeProjection,
  shapeSprite,
  shapeStyle,
} from "./options";

type CloudPaletteTheme = "warm" | "cool";

interface CloudsPalette extends ShapePalette {
  default: RGB;
  rain: RGB;
}

interface CloudsOptions extends ShapeDrawOptions<CloudsPalette> {
  paletteTheme?: CloudPaletteTheme;
  drawRain?: boolean;
  drawCloudBody?: boolean;
  cloudBlend?: number;
  rainBlend?: number;
  cloudCss?: string;
  rainCss?: string;
  oscAmp?: number;
  oscSpeed?: number;
  oscPhase?: number;
  dispAmp?: number;
  dispAmpY?: number;
  dispScale?: number;
  dispSpeed?: number;
  cloudAlpha?: number;
}

// Tunables.
const RAIN = {
  enabled: true as boolean,
  spawnX0: 0.12, spawnX1: 0.88,
  spawnY0: 0.22, spawnY1: 0.0,

  angleMin: Math.PI * 0.48,
  angleMax: Math.PI * 0.52,
  speedMin: [260, 140],
  speedMax: [300, 160],
  gravity: 0,
  accelX: 0,
  accelY: 0,

  jitterPos: [3, 0],
  jitterAngle: [0.36, 0],

  count: [24, 18],
  sizeMin: [1.1, 1.2],
  sizeMax: [1.2, 1.4],
  lengthMin: [2, 5],
  lengthMax: [3.5, 7.5],

  lifeMin: 4,
  lifeMax: 5,
  fadeInFrac: 0.15,
  fadeOutFrac: 0.25,
  warmStartSec: 1.2,

  fadeLeft: 12,
  fadeRight: 12,
  fadeTop: 8,
  fadeBottom: 32,

  alpha: [100, 220],
  blend: [0.02, 0.1],
} satisfies {
  enabled: boolean;
  spawnX0: number;
  spawnX1: number;
  spawnY0: number;
  spawnY1: number;
  angleMin: number;
  angleMax: number;
  speedMin: NumberRange;
  speedMax: NumberRange;
  gravity: number;
  accelX: number;
  accelY: number;
  jitterPos: NumberRange;
  jitterAngle: NumberRange;
  count: NumberRange;
  sizeMin: NumberRange;
  sizeMax: NumberRange;
  lengthMin: NumberRange;
  lengthMax: NumberRange;
  lifeMin: number;
  lifeMax: number;
  fadeInFrac: number;
  fadeOutFrac: number;
  warmStartSec: number;
  fadeLeft: number;
  fadeRight: number;
  fadeTop: number;
  fadeBottom: number;
  alpha: NumberRange;
  blend: NumberRange;
};

// lerp-able cloud tuning
const CLOUDS = {
  widthEnv:   [0.72, 0.86],
  heightEnv:  [0.24, 0.88],
  spreadX:    [0.72, 0.82],
  arcLift:    [0.12, 0.38],
  rBaseK:     [0.36, 0.46],
  rJitter:    [0.08, 0.14],
  lobeCount:  [6, 9],

  sCap:       [0.14, 0.24],
  oscAmp:     [0.2, 0.12],
  oscSpeed:   [0.32, 0.26],

  wobbleAmp:  [1.4, 1.0],
  blend:      [0.4, 0.08],
} satisfies Record<string, NumberRange>;

const WOBBLE = { ampScale: [0.8, 0.95] } satisfies { ampScale: NumberRange };

// Exponent applied to u for the cloud-body geometry ranges above (all of
// which grow toward u=1): u^gamma with gamma < 1 front-loads the ramp so
// clouds read as visibly bigger/fluffier well before u actually reaches 1.
const CLOUDS_SHAPE_GAMMA = 0.5;

// Palettes.
const CLOUDS_BASE_PALETTE: CloudsPalette = {
  default: { r: 236, g: 238, b: 242 },
  rain: { r: 20, g: 165, b: 255 },
};

const CLOUDS_DARK_PALETTE: CloudsPalette = {
  default: { r: 139, g: 140, b: 185 },
  rain: { r: 11, g: 104, b: 195 },
};

const CLOUDS_WARM_PALETTE: CloudsPalette = {
  default: { r: 248, g: 238, b: 226 },
  rain: { r: 30, g: 158, b: 228 },
};

const CLOUDS_COOL_PALETTE: CloudsPalette = {
  default: { r: 228, g: 236, b: 248 },
  rain: { r: 15, g: 148, b: 238 },
};

// Helpers.
function cloudRowContext(t: number) {
  return {
    width: particleBucketRange(t, 1.10, 1.0),
    height: particleBucketRange(t, 1.46, 1.0),
    overlap: particleBucketRange(t, 0.78, 1.0),
    radius: particleBucketRange(t, 1.52, 1.0),
    lobeCount: particleBucketRange(t, 0.90, 1.0),
    arcLift: particleBucketRange(t, 0.56, 1.0),
    radiusFromWidth: particleBucketRange(t, 1.42, 2.35),
    radiusJitter: particleBucketRange(t, 0.38, 1.0),
    centerSpacing: particleBucketRange(t, 1.05, 1.20),
    wobbleAmp: particleBucketRange(t, 0.08, 1.0),
    wobbleHz: particleBucketRange(t, 0.10, 1.0),
    lobeDrift: particleBucketRange(t, 0.14, 1.0),
  };
}

function rainRowContextScale(t: number) {
  return {
    size: particleBucketRange(t, 0.26, 1.0),
    length: particleBucketRange(t, 0.34, 1.0),
    motion: particleBucketRange(t, 0.05, 1.0),
    life: particleBucketRange(t, 1.58, 1.0),
    count: particleBucketRange(t, 0.62, 1.0),
  };
}

// Draw
export function drawClouds(
  p: ShapeCanvas,
  _cx: number,
  _cy: number,
  _r: number,
  opts: CloudsOptions = {}
): void {
  const projection = shapeProjection(opts);
  const style = shapeStyle(opts);
  const lifecycle = shapeLifecycle(opts);
  const identity = shapeIdentity(opts);
  const sprite = shapeSprite(opts);
  const particles = shapeParticles(opts);
  const pass = shapePass(opts);

  const darkMode = style.darkMode === true;
  const pal = style.palette ?? (darkMode ? CLOUDS_DARK_PALETTE
    : opts.paletteTheme === 'warm' ? CLOUDS_WARM_PALETTE
    : opts.paletteTheme === 'cool' ? CLOUDS_COOL_PALETTE
    : CLOUDS_BASE_PALETTE);
  const cell = projection.cell;
  const f = projection.footprint;
  if (!cell || !f) return;

  const t = ((typeof lifecycle.timeMs === 'number' ? lifecycle.timeMs : p.millis()) / 1000);
  const seedKey =
    (identity.seedKey ?? identity.seed)
    ?? `clouds|${String(f.r0)}:${String(f.c0)}|${String(f.w)}x${String(f.h)}`;
  const seed = shapeHash32(String(seedKey)) | 0;
  const u = clamp01(style.liveAvg ?? 0.5);
  const uShape = Math.pow(u, CLOUDS_SHAPE_GAMMA);

  // Prefer the explicit dt from painter; fall back to p.deltaTime.
  const dt = Math.max(
    0.001,
    typeof lifecycle.dtSec === "number" && Number.isFinite(lifecycle.dtSec) ? lifecycle.dtSec : ((p.deltaTime || 16) / 1000)
  );
  const drawRain = opts.drawRain !== false;
  const drawCloudBody = opts.drawCloudBody !== false;

  // Texture-pixel scaling for sprite textures
  const visualRow = f.r0 + f.h - 1;
  const rowBucket = particleRowBucket(f, projection);
  const rainRowBucket = rowBucket;
  const cloudRow = cloudRowContext(rowBucket.t);
  const rainScale = rainRowContextScale(rainRowBucket.t);
  const rainDepthSizeK = particleDepthSizeScale(rainRowBucket);
  const pixelScale = typeof sprite.particlePixelScale === "number" && Number.isFinite(sprite.particlePixelScale)
    ? Math.max(0.25, sprite.particlePixelScale)
    : Math.max(1, (sprite.pixelScale ?? sprite.coreScaleMult ?? 1));
  const sizeK = rainScale.size * rainDepthSizeK * Math.pow(pixelScale, 1.15);
  const lengthK = rainScale.length * rainDepthSizeK * Math.pow(pixelScale, 1.05);
  const motionK = rainScale.motion * pixelScale;
  // Not scaled by pixelScale: motionK boosts speed but the spawn rect stays
  // fixed size, so a boosted life outlives the time a particle can actually
  // stay inside the rect. That leaves particles exiting/respawning before
  // fadeInFrac (a fraction of life) finishes ramping in, reading as
  // persistently faint at higher scaleBoost values. Keeping life unboosted
  // holds the fade-in target well under the particle's real dwell time.
  const lifeK = rainScale.life;
  const countK = rainScale.count * Math.sqrt(pixelScale);

  // Layout base
  // Sky footprints span multiple rows. Use the same bottom/depth row as
  // footprintToPx so near-horizon clouds shrink like other near-horizon items.
  const visualCellW = rowWidthAt(visualRow, projection);
  const { x: fpX, y: y0, w: fpW } = footprintToPx(f, projection);
  const wTop = f.w * visualCellW;
  const anchorX = fpX + fpW / 2;
  const x0 = anchorX - wTop / 2;
  const hTop = rowHeightAt(visualRow, projection);
  const anchorY = y0 + hTop * 0.60;

  // Resolve cloud geometry
  const wEnv = wTop * resolveRangeValue(CLOUDS.widthEnv, uShape) * cloudRow.width;
  const hEnv = hTop * resolveRangeValue(CLOUDS.heightEnv, uShape) * cloudRow.height;
  const spreadXBase = resolveRangeValue(CLOUDS.spreadX, uShape) * cloudRow.overlap;
  const arcLift = resolveRangeValue(CLOUDS.arcLift, uShape) * cloudRow.arcLift;
  const rJitter = resolveRangeValue(CLOUDS.rJitter, uShape) * cloudRow.radiusJitter;
  const lobeCount = Math.max(4, Math.round(resolveRangeValue(CLOUDS.lobeCount, uShape) * cloudRow.lobeCount));
  const rBaseFromHeight = hTop * resolveRangeValue(CLOUDS.rBaseK, uShape) * cloudRow.radius;
  const rBaseFromWidth = wEnv / Math.max(4.5, lobeCount * cloudRow.radiusFromWidth);
  const rBase = Math.max(rBaseFromHeight, rBaseFromWidth);
  const continuitySpan = Math.max(
    rBase * 1.85,
    (lobeCount - 1) * rBase * cloudRow.centerSpacing
  );
  const spreadX = Math.max(0.22, Math.min(spreadXBase, continuitySpan / Math.max(1, wEnv)));

  const lobes = makeArchLobes(
    anchorX, anchorY, wEnv, hEnv,
    { count: lobeCount, spreadX, arcLift, rBase, rJitter, seed }
  );

  const cloudBlendDefault = resolveRangeValue(CLOUDS.blend, u);
  const cloudBlend = typeof opts.cloudBlend === 'number' ? opts.cloudBlend : cloudBlendDefault;

  const baseTint =
    (typeof opts.cloudCss === 'string' && opts.cloudCss.trim().length > 0)
      ? cssToRgbViaCanvas(p, opts.cloudCss)
      : blendRGB(pal.default, style.gradientRGB ?? undefined, cloudBlend);

  const sMax = Math.max(0, Math.min(1, resolveRangeValue(CLOUDS.sCap, u)));
  const { h, s, l } = rgbToHsl(baseTint);
  const capped = hslToRgb({
    h,
    s: Math.min(s, sMax),
    l,
  });

  const cloudRgb = applyDepthTint(oscillateSaturation(capped, t, {
    amp:   (typeof opts.oscAmp === 'number' ? opts.oscAmp : resolveRangeValue(CLOUDS.oscAmp, u)),
    speed: (typeof opts.oscSpeed === 'number' ? opts.oscSpeed : resolveRangeValue(CLOUDS.oscSpeed, u)),
    phase: opts.oscPhase ?? 0,
  }), pass);

  // Wobble
  const wobbleK = resolveRangeValue(CLOUDS.wobbleAmp, u) * resolveRangeValue(WOBBLE.ampScale, u) * cloudRow.wobbleAmp;
  const ampX = (opts.dispAmp ?? Math.min(12, Math.max(6, Math.round(hTop * 0.12)))) * wobbleK;
  const ampY = (typeof opts.dispAmpY === 'number' ? opts.dispAmpY : Math.round(ampX * 0.85)) * wobbleK;
  const ampS = Math.max(0, Math.min(0.25, opts.dispScale ?? 0.12)) * wobbleK;
  const fX = Math.max(0.01, (opts.dispSpeed ?? 0.22) * cloudRow.wobbleHz);
  const fY = fX * 0.85;
  const fS = fX * 0.60;
  const groupDrift = displacementOsc(t, -1, {
    ampX: ampX * 0.72,
    ampY: ampY * 0.72,
    ampScale: ampS * 0.28,
    freqX: fX * 0.72,
    freqY: fY * 0.72,
    freqScale: fS * 0.72,
    seed,
  });
  const lobeDriftK = cloudRow.lobeDrift;

  // Appear envelope for the cloud shape
  const appear = applyShapeMods({
    p,
    x: anchorX, y: anchorY, r: Math.min(wTop, hTop),
    opts: {
      alpha: finiteNumber(opts.cloudAlpha, 235),
      timeMs: lifecycle.timeMs,
      rootAppearK: lifecycle.rootAppearK,
      selectK: lifecycle.selectK,
    },
    mods: {
      appear: { anchor: 'center', ease: 'back', backOvershoot: 1.2 },
    }
  });

  const cloudAlpha = typeof appear.alpha === 'number' ? appear.alpha : finiteNumber(opts.cloudAlpha, 235);

  // Rain under clouds
  if (drawRain && RAIN.enabled) {
    const rect = { x: x0, y: y0 + hTop * 0.5, w: wTop, h: hTop * 2.5 };

    const speedMin    = resolveRangeValue(RAIN.speedMin, u) * motionK;
    const speedMax    = resolveRangeValue(RAIN.speedMax, u) * motionK;
    const jitterPos   = resolveRangeValue(RAIN.jitterPos, u);
    const jitterAngle = resolveRangeValue(RAIN.jitterAngle, u);
    const count       = Math.max(8, Math.floor(resolveRangeValue(RAIN.count, u) * countK));

    const sizeMin     = resolveRangeValue(RAIN.sizeMin, u)   * sizeK;
    const sizeMax     = Math.max(sizeMin, resolveRangeValue(RAIN.sizeMax, u) * sizeK);
    const lengthMin   = resolveRangeValue(RAIN.lengthMin, u) * lengthK;
    const lengthMax   = Math.max(lengthMin, resolveRangeValue(RAIN.lengthMax, u) * lengthK);

    const baseAlpha   = Math.round(resolveRangeValue(RAIN.alpha, u));
    const syncedAlpha = Math.round(baseAlpha * (cloudAlpha / 255));

    const rainBlend =
      typeof opts.rainBlend === 'number'
        ? opts.rainBlend
        : resolveRangeValue(RAIN.blend, 1 - u);

    const rainTint =
      (typeof opts.rainCss === 'string' && opts.rainCss.trim().length > 0)
        ? cssToRgbViaCanvas(p, opts.rainCss)
        : blendRGB(pal.rain, style.gradientRGB ?? undefined, rainBlend);

    const depthRainTint = applyDepthTint(rainTint, pass, 0.7);
    const rainColor = { r: depthRainTint.r, g: depthRainTint.g, b: depthRainTint.b, a: syncedAlpha };

    stepAndDrawParticles(p, {
      store: particles.particleStore,
      key: `cloud-rain:${String(seedKey)}`,
      rect,
      mode: 'line',
      color: rainColor,
      depthAlpha: particleDepthAlpha(rainRowBucket),

      spawn: { x0: RAIN.spawnX0, x1: RAIN.spawnX1, y0: RAIN.spawnY0, y1: RAIN.spawnY1 },
      angle: { min: RAIN.angleMin, max: RAIN.angleMax },

      speed: { min: speedMin, max: speedMax },
      gravity: RAIN.gravity,
      accel: { x: RAIN.accelX, y: RAIN.accelY },

      jitter: { pos: jitterPos, velAngle: jitterAngle },

      count,
      size: { min: sizeMin, max: sizeMax },
      length: { min: lengthMin, max: lengthMax },
      sizeHz: 8,
      lenHz: 6,

      thicknessScale: sizeK,

      lifetime: { min: RAIN.lifeMin * lifeK, max: RAIN.lifeMax * lifeK },
      fadeInFrac: RAIN.fadeInFrac,
      fadeOutFrac: RAIN.fadeOutFrac,
      // Sprite mode boosts particle speed via motionK (== pixelScale) without
      // boosting the spawn rect, so particles cross it faster and the warm-up
      // loop covers fewer respawn cycles per second of warm time. Scale the
      // warm-up window by the same pixelScale so it still settles before the
      // sprite bake snapshots a single frame. pixelScale is 1 outside sprite
      // mode, so this is a no-op for the live scene.
      warmStartSec: RAIN.warmStartSec * pixelScale,

      edgeFadePx: { left: RAIN.fadeLeft, right: RAIN.fadeRight, top: RAIN.fadeTop, bottom: RAIN.fadeBottom },
      respawn: true,
    }, dt);
  }

  // Clouds above rain
  if (drawCloudBody) {
    p.push();
    p.translate(appear.x, appear.y);
    p.scale(appear.scaleX, appear.scaleY);
    p.translate(-anchorX, -anchorY);

    p.noStroke();
    p.fill(cloudRgb.r, cloudRgb.g, cloudRgb.b, cloudAlpha);

    for (const l of lobes) {
      const { dx, dy, sc } = displacementOsc(t, l.i, {
        ampX: ampX * lobeDriftK,
        ampY: ampY * lobeDriftK,
        ampScale: ampS * Math.max(0.35, lobeDriftK),
        freqX: fX,
        freqY: fY,
        freqScale: fS,
        seed
      });
      const lx = l.x;
      const ly = l.y;
      const rr = l.r * sc * 2;
      const cx2 = lx + groupDrift.dx + dx;
      const cy2 = ly + groupDrift.dy + dy;
      p.circle(cx2, cy2, rr);
    }
    p.pop();
  }
}
