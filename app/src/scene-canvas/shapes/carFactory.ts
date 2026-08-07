// src/scene-canvas/shapes/carFactory.ts

import {
  applySrgbExposureContrast,
  beginFitScale,
  clamp01,
  resolveRangeValue,
  blendRGB,
  clampBrightness,
  clampSaturation,
  applyShapeMods,
  stepAndDrawPuffs,
  footprintToPx,
  particleDepthAlpha,
  particleDepthSizeScale,
  particleRowBucket,
  particleSizePerspectiveScale,
  particleMotionPerspectiveScale,
  rgbaCss,
  endFitScale,
  finiteNumber,
  fitScaleToRectWidth,
  roundedRectPath,
  seeded01,
  shapeColorForRenderPass,
  shouldDrawInRenderPass,
  smoothstep01,
} from "../modifiers/index";
import type { NumberRange, RGB } from "../modifiers/index";

import { drawCarAsset } from "./car";
import type { CarVariant } from "./car";
import type { ShapeCanvas, ShapeDrawOptions, ShapePalette, ShapeSeed } from "./types";
import {
  shapeIdentity,
  shapeLifecycle,
  shapeParticles,
  shapePass,
  shapeProjection,
  shapeSprite,
  shapeStyle,
} from "./options";

interface CarFactoryPalette extends ShapePalette {
  grass: RGB;
  building: RGB;
  frame: RGB;
  window: RGB;
  chimney: RGB;
  roof: RGB;
  solarPanel: RGB;
}

interface CarFactoryOptions extends ShapeDrawOptions<CarFactoryPalette> {
  carVariantList?: readonly CarVariant[];
  carVariantCycleMs?: number;
  carVariantFadeMs?: number;
}

interface CarFactoryTuning {
  towardOneGamma: number;
  blendK: NumberRange;
  grass: {
    colorBlend: NumberRange;
    satRange: NumberRange;
  };
  grassHk: number;
  grassTopRadiusK: number;
  slabHeightK: number;
  factoryWFrac: number;
  gapPx: number;
  framePadK: number;
  windowPadK: number;
  frameRadiusPx: number;
  windowRadiusPx: number;
  windowStrokePx: NumberRange;
  carSidePadK: number;
  carScaleBoost: number;
  chimWFrac: number;
  chimTopNarrowK: number;
  chimRadiusPx: number;
  chimHeightFrac: number;
  bodyScaleXRange: NumberRange;
  chimScaleYRange: NumberRange;
  roofHk: number;
  roofOverhangK: number;
  roofRadiusPx: number;
  smoke: {
    count: NumberRange;
    sizeMin: NumberRange;
    sizeMax: NumberRange;
    lifeMin: NumberRange;
    lifeMax: NumberRange;
    alpha: NumberRange;
    dir: "up";
    spreadAngle: NumberRange;
    speedMin: NumberRange;
    speedMax: NumberRange;
    gravity: NumberRange;
    drag: NumberRange;
    jitterPos: NumberRange;
    jitterAngle: NumberRange;
    fadeInFrac: number;
    fadeOutFrac: number;
    edgeFadePx: { left: number; right: number; top: number; bottom: number };
    sizeHz: number;
    base: RGB;
    blendK: NumberRange;
    brightnessRange: NumberRange;
    colWk: number;
    colHk: number;
  };
  panels: {
    count: number;
    widthFracBase: number;
    heightFracOfRoof: number;
    sideMarginFrac: number;
    gapFracOfPW: number;
    cornerFrac: number;
    tiltDeg: number;
  };
  chimCap: {
    overhangPx: number;
    thicknessPx: number;
    radiusPx: number;
    shadeK: number;
    lipPx: number;
    lipAlpha: number;
  };
  carVariantList: readonly CarVariant[];
  carVariantCycleMs: number;
  carVariantFadeMs: number;
}

// Tunables.
const CF: CarFactoryTuning = {
  // Exponent applied to u for structural params (body/chimney scale, panel
  // coverage): u^gamma with gamma < 1 front-loads the ramp so the factory
  // looks close to "maxed out" well before u actually reaches 1.
  towardOneGamma: 0.5,

  // General (non-grass) gradient blend strength.
  blendK: [0.3, 0.02],

  // Grass: match villa behavior (colorBlend + sat clamp)
  grass: {
    colorBlend: [0.18, 0.14],
    satRange: [0.00, 0.14],
  },

  // grass
  grassHk: 1/3,
  grassTopRadiusK: 0.06,

  // overall slab tuning
  slabHeightK: 1.15,

  // factory vs chimney layout
  factoryWFrac: 0.75,
  gapPx: 4,

  // frame/window pads
  framePadK: 0.18,
  windowPadK: 0.10,
  frameRadiusPx: 6,
  windowRadiusPx: 4,

  // thinner stroke overall
  windowStrokePx: [0.4, 0.9],

  // car fit
  carSidePadK: 0.06,
  carScaleBoost: 0.72,

  // chimney shape
  chimWFrac: 0.22,
  chimTopNarrowK: 0.82,
  chimRadiusPx: 3,

  /* Tunables */
  chimHeightFrac: 0.62, // shorter baseline

  // Body: X-only clamp (lerped by liveAvg)
  bodyScaleXRange: [1, 1.33],

  // Chimney: Y-only clamp (lerped by liveAvg) - decreasing range
  chimScaleYRange: [1, 0],

  // Roof
  roofHk: 0.08,
  roofOverhangK: 0.06,
  roofRadiusPx: 6,

  // Smoke (puffs)
  smoke: {
    count:       [62, 0],
    sizeMin:     [4.5, 0.0],
    sizeMax:     [12.0, 1.0],
    lifeMin:     [5, 2.0],
    lifeMax:     [10, 4.0],
    alpha:       [235, 0],

    dir:         'up',
    spreadAngle: [0.90, 0.22],

    speedMin:    [12, 10],
    speedMax:    [28, 18],
    gravity:     [-12, -6],
    drag:        [0.60, 0.70],

    jitterPos:   [0.80, 0.25],
    jitterAngle: [0.4, 0.06],

    fadeInFrac:  0.10,
    fadeOutFrac: 3,
    edgeFadePx:  { left: 6, right: 0, top: 4, bottom: 12 },

    sizeHz:      4,

    base:        { r: 120, g: 130, b: 140 },
    blendK:      [0.30, 0.06],
    brightnessRange: [0.60, 0.40],

    colWk: 0.16,
    colHk: 2.60,
  },

  // Solar panels
  panels: {
    count: 5,
    widthFracBase: 0.19,
    heightFracOfRoof: 0.80,
    sideMarginFrac: 0.06,
    gapFracOfPW: 0.20,
    cornerFrac: 0.12,
    tiltDeg: 30,
  },

  // Chimney cap
  chimCap: {
    overhangPx: 3,
    thicknessPx: 12,
    radiusPx: 2,
    shadeK: 0.88,     // slightly darker than chimney body
    lipPx: 1,         // tiny top lip (0 disables)
    lipAlpha: 200,
  },

  // Car variant cycle + crossfade using shapeMods.scale (bottom-center)
  carVariantList: ["suv", "sedan", "jeep"],
  carVariantCycleMs: 3000,  // total time per variant
  carVariantFadeMs: 300,    // 0.3s fade-out and 0.3s fade-in
};

// Palettes.
const CAR_FACTORY_BASE_PALETTE: CarFactoryPalette = {
  grass: { r: 120, g: 180, b: 110 },
  building: { r: 208, g: 210, b: 214 },
  frame: { r: 180, g: 182, b: 188 },
  window: { r: 220, g: 226, b: 236 },
  chimney: { r: 172, g: 174, b: 180 },
  roof: { r: 160, g: 162, b: 168 },
  solarPanel: { r: 180, g: 205, b: 235 },
};

const CAR_FACTORY_DARK_PALETTE: CarFactoryPalette = {
  grass: { r: 80, g: 100, b: 126 },
  building: { r: 114, g: 133, b: 164 },
  frame: { r: 99, g: 115, b: 144 },
  window: { r: 120, g: 143, b: 181 },
  chimney: { r: 94, g: 110, b: 138 },
  roof: { r: 88, g: 102, b: 129 },
  solarPanel: { r: 99, g: 129, b: 180 },
};

// Local helpers.
function clampLerped(range: NumberRange, u: number): number {
  const lo = Math.min(range[0], range[1]);
  const hi = Math.max(range[0], range[1]);
  const v = resolveRangeValue(range, u);
  return Math.max(lo, Math.min(hi, v));
}

export function drawCarFactory(
  p: ShapeCanvas,
  _x: number,
  _y: number,
  _r: number,
  opts: CarFactoryOptions = {}
): void {
  const projection = shapeProjection(opts);
  const style = shapeStyle(opts);
  const lifecycle = shapeLifecycle(opts);
  const identity = shapeIdentity(opts);
  const sprite = shapeSprite(opts);
  const particles = shapeParticles(opts);
  const pass = shapePass(opts);
  const darkMode = style.darkMode === true;

  const pal = style.palette ?? (darkMode ? CAR_FACTORY_DARK_PALETTE : CAR_FACTORY_BASE_PALETTE);
  const cell = projection.cell, f = projection.footprint;
  if (!cell || !f) return;
  const seedKey: ShapeSeed = (identity.seedKey ?? identity.seed) ?? `carFactory|${String(f.r0)}:${String(f.c0)}|${String(f.w)}x${String(f.h)}`;

  // Sprite mode: auto when fitToFootprint (texture path) or explicit override.
  const isSprite = !!sprite.fitToFootprint || !!sprite.spriteMode;

  const u   = clamp01(style.liveAvg ?? 0.5);
  // Structural params (body/chimney scale, panel coverage) read this instead of
  // raw `u` so the factory reads as visibly "maxed out" well before u hits 1,
  // rather than tracking u linearly the whole way there.
  const uToward1 = Math.pow(u, CF.towardOneGamma);
  const a   = finiteNumber(style.alpha, 235);
  const ex  = finiteNumber(style.exposure, 1);
  const ct  = finiteNumber(style.contrast, 1);
  const tMs = typeof lifecycle.timeMs === 'number' ? lifecycle.timeMs : p.millis();
  const renderPass = pass.renderPass ?? "color";
  const maskColor = pass.maskColor;
  const requestedMaskAlpha =
    typeof pass.maskAlpha === "number" && Number.isFinite(pass.maskAlpha)
      ? pass.maskAlpha
      : a;
  const isDepthMaskPass = renderPass === "depthMask";
  const shouldDrawMass = shouldDrawInRenderPass(renderPass, true);
  const shouldDrawColorDetails = shouldDrawInRenderPass(renderPass, false);
  const rowBucket = particleRowBucket(f, projection);
  const particleScale = particleSizePerspectiveScale(f, projection) * particleDepthSizeScale(rowBucket);
  const motionScale = particleMotionPerspectiveScale(f, projection);

  const { x: x0, y: y0, w: W, h: H } = footprintToPx(f, projection);
  const localTileW = W / Math.max(1, f.w);
  const localTileH = H / Math.max(1, f.h);
  const localTile = Math.max(1, Math.min(localTileW, localTileH));
  const detailUnit = localTile;

  // appear (bottom-center)
  const anchorX = x0 + W / 2;
  const anchorY = y0 + H;
  const env = applyShapeMods({
    p, x: anchorX, y: anchorY, r: Math.min(W, H),
    opts: { alpha: a, timeMs: tMs, rootAppearK: lifecycle.rootAppearK, selectK: lifecycle.selectK },
  });
  const alpha = (typeof env.alpha === 'number') ? env.alpha : a;
  const appearAlphaK = a > 0 ? clamp01(alpha / a) : 1;
  const maskAlpha = isDepthMaskPass
    ? Math.round(requestedMaskAlpha * appearAlphaK)
    : alpha;
  const massAlpha = isDepthMaskPass ? maskAlpha : alpha;

  // ---- color helpers ----
  const kBlendGeneral = resolveRangeValue(CF.blendK, u);

  // General tint (applies global gradient to non-grass shapes)
  const tintGeneral = (base: RGB): RGB => {
    const mixed = style.gradientRGB ? blendRGB(base, style.gradientRGB, kBlendGeneral) : base;
    return applySrgbExposureContrast(mixed, ex, ct);
  };

  // Grass tint: same logic as villa (use gradientRGB + clamp saturation)
  let grass = pal.grass;
  if (style.gradientRGB) {
    grass = blendRGB(grass, style.gradientRGB, resolveRangeValue(CF.grass.colorBlend, u));
  }
  grass = clampSaturation(grass, CF.grass.satRange[0], CF.grass.satRange[1], 1);
  if (darkMode) grass = clampBrightness(grass, 0.36, 0.54);
  grass = applySrgbExposureContrast(grass, ex, ct);

  // Non-grass colors still use general gradient
  const wall       = tintGeneral(pal.building);
  const frameRGB   = tintGeneral(pal.frame);
  const glassBase  = tintGeneral(pal.window);
  const chimneyRGB = tintGeneral(pal.chimney);
  const roofRGB    = tintGeneral(pal.roof);

  // subtle blue tint for glass
  const blue = { r: 120, g: 170, b: 220 };
  const glass = clampBrightness(blendRGB(glassBase, blue, 0.42), 0.80, 1.10);

  const backdrop = applySrgbExposureContrast(
    {
      r: Math.round(pal.building.r * 0.88),
      g: Math.round(pal.building.g * 0.88),
      b: Math.round(pal.building.b * 0.88),
    }, ex, ct
  );

  // geometry
  const grassH = Math.max(4, Math.round(cell * CF.grassHk));
  const grassY = y0 + H - grassH;
  const rGrassTop = Math.round(cell * CF.grassTopRadiusK);

  const usableH = H - grassH;
  const floorY  = y0 + usableH;

  const slabH = Math.min(usableH, Math.round(cell * CF.slabHeightK));
  const slabY = floorY - slabH;

  const gap = Math.max(1, Math.round(Math.min(CF.gapPx, detailUnit * 0.18)));
  const factoryW = Math.max(8, Math.round(W * CF.factoryWFrac));
  const chimW    = Math.max(Math.round(detailUnit * 0.28), Math.round(W * CF.chimWFrac));
  const totalW   = factoryW + gap + chimW;

  const leftStart = x0 + (W - totalW) / 2;
  const sideLeft  = ((f.c0 + f.r0) % 2) === 0; // true -> factory left, chimney right
  const bodyX     = sideLeft ? leftStart : (leftStart + chimW + gap);

  const chimX = sideLeft
    ? (bodyX + factoryW + gap)
    : leftStart;

  // frame/window pads (larger window)
  const framePadPx  = Math.round(Math.max(2, Math.min(12, detailUnit * CF.framePadK)));
  const windowPadPx = Math.round(Math.max(1, Math.min(10, detailUnit * CF.windowPadK)));

  // frame/window rects centered within factory body
  const frameX = bodyX + framePadPx;
  const frameY = slabY + framePadPx;
  const frameW = Math.max(4, factoryW - framePadPx * 2);
  const frameH = Math.max(4, slabH     - framePadPx * 2);

  const winX = frameX + windowPadPx;
  const winY = frameY + windowPadPx;
  const winW = Math.max(4, frameW - windowPadPx * 2);
  const winH = Math.max(4, frameH - windowPadPx * 2);

  // thinner stroke
  const winStroke = Math.max(
    CF.windowStrokePx[0],
    Math.min(CF.windowStrokePx[1], detailUnit * 0.025)
  );

  // liveAvg-lerped clamps - robust for decreasing ranges
  const bodyScaleX = clampLerped(CF.bodyScaleXRange, uToward1);
  const chimScaleY = clampLerped(CF.chimScaleYRange, uToward1);

  // body anchor flips by side - left-anchored if component is on the left
  const bodyAnchorX = sideLeft ? bodyX : (bodyX + factoryW);

  // Precompute roof rect in WORLD space (so we can draw panels outside body scale group)
  const roofH = Math.max(2, Math.round(detailUnit * CF.roofHk));
  const roofOver = Math.round(factoryW * CF.roofOverhangK);
  const roofRx = bodyX - roofOver;               // left X
  const roofRw = factoryW + 2 * roofOver;        // width
  const roofRy = slabY - roofH;                  // top Y

  // Precompute chimney top for smoke, then draw smoke before chimney.
  const baseW = chimW; // no X-scale clamp on chimney
  const topW  = Math.round(baseW * CF.chimTopNarrowK);
  const chimRise = slabH * CF.chimHeightFrac;
  const topY0 = slabY - chimRise;
  const bottomCenterX = chimX + baseW / 2;
  const bottomY = grassY;
  const topRightX = chimX + (baseW + topW) / 2;
  const topLeftX  = chimX + (baseW - topW) / 2;
  // World-space top Y after Y-scale about bottom.
  const chimneyTopY = topY0 * chimScaleY + bottomY * (1 - chimScaleY);

  // Draw factory parts in local painter order.
  p.push();
  p.translate(env.x, env.y);
  p.scale(env.scaleX, env.scaleY);
  p.translate(-anchorX, -anchorY);

  // NOTE: DO NOT clip to (x0,y0,W,H) here - it cuts off smoke in the bleed.
  // If you *really* want a clip, prefer the full canvas bounds (when available):
  // if (isSprite && p.width && p.height) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, p.width, p.height); ctx.clip(); }

  // The depth mask pass keeps only stable factory mass: grass, chimney, wall, roof, and panels.
  if (shouldDrawMass) {
    const grassFill = shapeColorForRenderPass(renderPass, grass, maskColor);
    p.noStroke();
    p.fill(grassFill.r, grassFill.g, grassFill.b, massAlpha);
    p.rect(x0, grassY, W, grassH, rGrassTop, rGrassTop, 0, 0);
  }

  // 1) SMOKE first (so chimney renders on top of it)
  if (shouldDrawColorDetails) {
    // base col dims
    let colW = Math.max(3, Math.round(detailUnit * CF.smoke.colWk));
    let colH = Math.max(Math.round(detailUnit * 1.1), Math.round(detailUnit * 2 * CF.smoke.colHk));

    // Sprite path: thicker/taller column so smoke reads after downsampling
    if (isSprite) {
      colW = Math.round(colW * 1.35);
      colH = Math.round(colH * 1.25);
    }

    const smokeX = (topLeftX + topRightX) / 2 - colW / 2;
    // spawn a bit above the mouth so top edge-fade doesn't kill it
    const smokeY = chimneyTopY - Math.round(detailUnit * (isSprite ? 1.35 : 1.45));

    // base knobs
    const count  = Math.max(4, Math.floor(resolveRangeValue(CF.smoke.count, u)));
    let sizeMin  = resolveRangeValue(CF.smoke.sizeMin, u) * particleScale;
    let sizeMax  = Math.max(sizeMin, resolveRangeValue(CF.smoke.sizeMax, u) * particleScale);
    let lifeMin  = Math.max(0.05, resolveRangeValue(CF.smoke.lifeMin, u) * motionScale);
    let lifeMax  = Math.max(lifeMin, resolveRangeValue(CF.smoke.lifeMax, u) * motionScale);
    let sAlpha   = Math.max(90, Math.min(255, Math.round(resolveRangeValue(CF.smoke.alpha, u))));
    let speedMin = resolveRangeValue(CF.smoke.speedMin, u) * motionScale;
    let speedMax = Math.max(speedMin, resolveRangeValue(CF.smoke.speedMax, u) * motionScale);
    let gravity  = resolveRangeValue(CF.smoke.gravity, u) * motionScale;
    const drag   = resolveRangeValue(CF.smoke.drag, u);
    let jPos     = resolveRangeValue(CF.smoke.jitterPos, u) * particleScale;
    const jAng   = resolveRangeValue(CF.smoke.jitterAngle, u);
    const spread = resolveRangeValue(CF.smoke.spreadAngle, u);
    const blendK = resolveRangeValue(CF.smoke.blendK, u);

    // Sprite path boosts (bigger/faster/longer-lived so it rises visibly)
    if (isSprite) {
      const sizeBoost = 1.35;
      const speedBoost = 1.15;
      const lifeBoost = 1.25;
      sizeMin *= sizeBoost;
      sizeMax *= sizeBoost;
      speedMin *= speedBoost;
      speedMax *= speedBoost;
      lifeMin *= lifeBoost;
      lifeMax *= lifeBoost;
      gravity *= 1.10;
      jPos *= 0.85;
      sAlpha = Math.min(255, Math.round(sAlpha * 1.05));
    }

    const baseSmoke = style.gradientRGB
      ? blendRGB(CF.smoke.base, style.gradientRGB, blendK)
      : CF.smoke.base;

    const smoked = applySrgbExposureContrast(
      clampBrightness(baseSmoke, CF.smoke.brightnessRange[0], CF.smoke.brightnessRange[1]),
      ex, ct
    );

    const dt =
      (typeof lifecycle.dtSec === 'number' && lifecycle.dtSec > 0)
        ? lifecycle.dtSec
        : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

    stepAndDrawPuffs(p, {
      store: particles.particleStore,
      key: `factory-smoke:${String(seedKey)}${isSprite ? ':spr' : ''}`,
      rect: { x: smokeX, y: smokeY, w: colW, h: colH },
      dir: 'up',
      spreadAngle: spread,
      speed: { min: speedMin, max: speedMax },
      gravity,
      drag,
      accel: { x: 0, y: 0 },

      // Spawn a bit inside so top-edge fade doesn't zero alpha
      spawn: { x0: 0.20, x1: 0.80, y0: 0.10, y1: 0.25 },
      jitter: { pos: jPos, velAngle: jAng },

      count,
      size: { min: sizeMin, max: sizeMax },
      sizeHz: CF.smoke.sizeHz,

      lifetime: { min: lifeMin, max: lifeMax },
      fadeInFrac: CF.smoke.fadeInFrac,
      fadeOutFrac: CF.smoke.fadeOutFrac,
      // In sprite mode kill the top fade so spawn is fully visible
      edgeFadePx: isSprite ? { left: 4, right: 4, top: 0, bottom: 10 } : { ...CF.smoke.edgeFadePx, top: 0 },

      color: { r: smoked.r, g: smoked.g, b: smoked.b, a: sAlpha },
      depthAlpha: particleDepthAlpha(rowBucket),
      respawn: true,
    }, dt);
  }

  // (Previously we re-clipped here and later restored; those are gone.)

  // 2) CHIMNEY (single shape, no seam) + CAP
  if (shouldDrawMass) {
    p.noStroke();
    const chimneyFill = shapeColorForRenderPass(renderPass, chimneyRGB, maskColor);
    p.fill(chimneyFill.r, chimneyFill.g, chimneyFill.b, isDepthMaskPass ? maskAlpha : 255);

    // Y-only scaling, anchored at bottom-center
    p.push();
    p.translate(bottomCenterX, bottomY);
    p.scale(1, chimScaleY);
    p.translate(-bottomCenterX, -bottomY);

    // chimney polygon
    p.beginShape();
    p.vertex(chimX,             grassY);
    p.vertex(chimX + chimW,     grassY);
    p.vertex(topRightX,         topY0);
    p.vertex(topLeftX,          topY0);
    p.endShape(p.CLOSE);

    // CAP on the tapered top
    const capOver  = Math.max(1, Math.round(Math.min(CF.chimCap.overhangPx, detailUnit * 0.16)));
    const capTh    = Math.max(1, Math.round(Math.min(CF.chimCap.thicknessPx, detailUnit * 0.34)));
    const capRad   = Math.max(0, Math.round(Math.min(CF.chimCap.radiusPx, detailUnit * 0.12)));

    const capX     = topLeftX - capOver;
    const capW     = (topRightX - topLeftX) + capOver * 2;
    const capY     = topY0 - capTh;

    const capRGB = {
      r: Math.round(chimneyRGB.r * CF.chimCap.shadeK),
      g: Math.round(chimneyRGB.g * CF.chimCap.shadeK),
      b: Math.round(chimneyRGB.b * CF.chimCap.shadeK),
    };

    const capFill = shapeColorForRenderPass(renderPass, capRGB, maskColor);
    p.fill(capFill.r, capFill.g, capFill.b, isDepthMaskPass ? maskAlpha : 255);
    p.rect(capX, capY, capW, capTh, capRad, capRad, capRad, capRad);

    if (CF.chimCap.lipPx > 0 && shouldDrawColorDetails) {
      const lipH = Math.max(1, Math.round(Math.min(CF.chimCap.lipPx, detailUnit * 0.08)));
      const lipRGB = {
        r: Math.min(255, capRGB.r + 18),
        g: Math.min(255, capRGB.g + 18),
        b: Math.min(255, capRGB.b + 18),
      };
      p.fill(lipRGB.r, lipRGB.g, lipRGB.b, CF.chimCap.lipAlpha | 0);
      p.rect(capX, capY - lipH, capW, lipH, capRad, capRad, capRad, capRad);
    }

    p.pop();
  }

  // 3-8) FACTORY BODY & CONTENT - X-only scale, anchored by side
  p.push();
  if (shouldDrawMass) {
    p.translate(bodyAnchorX, 0);
    p.scale(bodyScaleX, 1);
    p.translate(-bodyAnchorX, 0);

    const wallFill = shapeColorForRenderPass(renderPass, wall, maskColor);
    p.noStroke();
    p.fill(wallFill.r, wallFill.g, wallFill.b, massAlpha);
    p.rect(bodyX, slabY, factoryW, slabH, Math.round(detailUnit * 0.08));

    const roofFill = shapeColorForRenderPass(renderPass, roofRGB, maskColor);
    p.noStroke();
    p.fill(roofFill.r, roofFill.g, roofFill.b, massAlpha);
    p.rect(roofRx, roofRy, roofRw, roofH, CF.roofRadiusPx, CF.roofRadiusPx, 0, 0);

    // 5) backdrop (behind car) within the frame area
    if (shouldDrawColorDetails) {
      p.noStroke();
      p.fill(backdrop.r, backdrop.g, backdrop.b, alpha);
      p.rect(frameX, frameY, frameW, frameH, CF.frameRadiusPx);
    }

    // 6) CAR in window - ignore body scale via inverse transform
    if (shouldDrawColorDetails) {
      const cx = winX + winW / 2;
      const bottomPad = Math.max(2, Math.round(winH * 0.10));
      const wheelBaselineY = winY + winH - bottomPad;

      const sidePad = Math.max(2, Math.round(winW * CF.carSidePadK));
      const rBase = winW / 3.2;
      const designW = rBase * 3.2;
      const fitS = CF.carScaleBoost * fitScaleToRectWidth(designW, winW, sidePad, { allowUpscale: true });

      const cancelSX = 1 / bodyScaleX;

      // Variant cycle + crossfade using shapeMods.scale (anchor bottom-center)
      const configuredList = opts.carVariantList;
      const list: readonly CarVariant[] = configuredList && configuredList.length > 0
        ? configuredList
        : CF.carVariantList;

      const cycleMs = Math.max(1, opts.carVariantCycleMs ?? CF.carVariantCycleMs);
      const fadeMs  = Math.max(1, opts.carVariantFadeMs  ?? CF.carVariantFadeMs);
      const cycleOffsetMs = Math.floor(seeded01(seedKey, "car-cycle-offset") * cycleMs * list.length);
      const carSeedBase = `${String(seedKey)}|factory-car`;
      const t       = tMs + cycleOffsetMs;
      const tick    = Math.floor(t / cycleMs);
      const phaseMs = t % cycleMs;

      const curIdx  = ((tick % list.length) + list.length) % list.length;
      const nxtIdx  = (curIdx + 1) % list.length;
      const curVar  = list[curIdx];
      const nxtVar  = list[nxtIdx];

      const drawVariant = (variant: CarVariant, scaleK: number, alphaK: number, variantSeedKey: ShapeSeed): void => {
        const env2 = applyShapeMods({
          p,
          x: cx,
          y: wheelBaselineY,
          r: rBase,
          opts: { alpha: Math.round(alpha * alphaK), timeMs: tMs },
          mods: { scale: { value: scaleK, anchor: 'bottom-center' } },
        });

        p.push();
        p.translate(cx, wheelBaselineY);
        p.scale(cancelSX, 1);
        p.translate(env2.x - cx, env2.y - wheelBaselineY);
        p.scale(env2.scaleX, env2.scaleY);
        p.translate(-cx, -wheelBaselineY);

        beginFitScale(p, { cx, anchorY: wheelBaselineY, scale: fitS });
        drawCarAsset(p, cx, wheelBaselineY, rBase, {
          style: {
            alpha: env2.alpha,
            exposure: ex,
            contrast: ct,
            darkMode,
            gradientRGB: style.gradientRGB,
            liveAvg: u,
          },
          identity: {
            seedKey: variantSeedKey,
          },
          useAppear: false,
          variant,
        });
        endFitScale(p);
        p.pop();
      };

      if (phaseMs < cycleMs - fadeMs) {
        drawVariant(curVar, 1.0, 1.0, `${carSeedBase}|var:${curVar}:t${String(tick)}`);
      } else {
        const kLin = (phaseMs - (cycleMs - fadeMs)) / fadeMs; // 0..1
        const k = smoothstep01(kLin);
        const outScale = 1 - k;
        const inScale  = k;
        const outAlpha = 1 - k;
        const inAlpha  = k;

        drawVariant(curVar, Math.max(0, outScale), Math.max(0, outAlpha), `${carSeedBase}|out:${curVar}:t${String(tick)}`);
        drawVariant(nxtVar, Math.max(0, inScale),  Math.max(0, inAlpha),  `${carSeedBase}|in:${nxtVar}:t${String(tick)}`);
      }
    }

    // 7) FRAME RING WITH HOLE (even-odd)
    if (shouldDrawColorDetails) {
      const ctx2 = p.drawingContext;
      ctx2.save();
      ctx2.beginPath();
      roundedRectPath(ctx2, frameX, frameY, frameW, frameH, CF.frameRadiusPx);
      roundedRectPath(ctx2, winX,   winY,   winW,   winH,   CF.windowRadiusPx);
      ctx2.fillStyle = rgbaCss(frameRGB, alpha / 255);
      ctx2.fill('evenodd');
      ctx2.restore();
    }

    // 8) GLASS pane - smaller stroke, even less opaque
    if (shouldDrawColorDetails) {
      const strokeRGB = {
        r: Math.round(wall.r * 0.82),
        g: Math.round(wall.g * 0.86),
        b: Math.round(wall.b * 0.95),
      };
      p.stroke(strokeRGB.r, strokeRGB.g, strokeRGB.b, alpha);
      p.strokeWeight(winStroke);
      p.fill(glass.r, glass.g, glass.b, Math.round(alpha * 0.36));
      p.rect(winX, winY, winW, winH, CF.windowRadiusPx);
    }
  }
  p.pop();

  // 9) SOLAR PANELS - scale anchored to the roof (bottom-center), tilt flips with side
  {
    const sPanels = clamp01(uToward1); // 0 -> hidden, 1 -> full
    if (sPanels > 0.001) {
      const panelTint0 = applySrgbExposureContrast(pal.solarPanel, ex, ct);
      const count = CF.panels.count;

      const minPanelW = Math.max(1, Math.round(Math.min(8, localTile * 0.25)));
      const minPanelH = Math.max(1, Math.round(Math.min(6, localTile * 0.18)));
      const minPanelBaseW = Math.max(minPanelW, Math.round(Math.min(10, localTile * 0.31)));
      const minMarginSide = Math.max(1, Math.round(Math.min(4, localTile * 0.13)));
      const marginSide = Math.max(minMarginSide, Math.round(roofRw * CF.panels.sideMarginFrac));
      const usableW = Math.max(minPanelW, roofRw - 2 * marginSide);
      const basePW = Math.max(minPanelBaseW, Math.round(roofRw * CF.panels.widthFracBase));
      const pH = Math.min(
        Math.max(minPanelH, Math.round(roofH * CF.panels.heightFracOfRoof)),
        Math.max(minPanelH, Math.round(localTile * 0.16))
      );

      const gapFrac = CF.panels.gapFracOfPW;
      const pWFit = usableW / (count + (count - 1) * gapFrac);
      const pW = Math.max(1, Math.round(Math.min(basePW, pWFit)));
      const gap = Math.round(pW * gapFrac);

      // Contact line is the roof top (anchor line for scaling)
      const yOnRoof = roofRy;

      const totalRowW = count * pW + (count - 1) * gap;
      const startX = roofRx + (roofRw - totalRowW) / 2;

      const corner = Math.round(Math.min(pW, pH) * CF.panels.cornerFrac);
      const tiltSign = sideLeft ? -1 : 1;
      const tilt = tiltSign * (CF.panels.tiltDeg * Math.PI / 180);

      p.push();
      p.noStroke();
      p.rectMode(p.CORNER);

      for (let i = 0; i < count; i++) {
        const px = startX + i * (pW + gap) + pW / 2; // bottom-center X
        const py = yOnRoof;                           // roof contact Y

        p.push();
        p.translate(px, py);
        p.scale(sPanels, sPanels);
        p.rotate(tilt);

        const panelFill = shapeColorForRenderPass(renderPass, panelTint0, maskColor);
        p.fill(panelFill.r, panelFill.g, panelFill.b, massAlpha);
        p.rect(-pW / 2, -pH, pW, pH, corner);

        if (shouldDrawColorDetails) {
          const hi = {
            r: Math.min(255, panelTint0.r + 22),
            g: Math.min(255, panelTint0.g + 22),
            b: Math.min(255, panelTint0.b + 22),
          };
          p.fill(hi.r, hi.g, hi.b, Math.round(alpha * 0.35));
          p.rect(-pW * 0.53, -pH * 0.88, pW * 0.70, pH * 0.10, corner);
        }

        p.pop();
      }

      p.pop();
    }
  }

  // If you added a canvas-wide clip above, remember to ctx.restore() here.
  // (We didn't enable one by default.)

  p.pop();
}

