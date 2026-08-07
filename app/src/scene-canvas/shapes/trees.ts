// src/scene-canvas/shapes/trees.ts
import {
  applySrgbExposureContrast,
  clamp01,
  resolveRangeValue,
  blendRGB,
  clampBrightness,
  clampSaturation,
  oscillateSaturation,
  applyShapeMods,
  footprintToPx,
  particleRowBucket,
  sampleDirectionalLightRect,
  lightClosenessBand,
  pickLightBandValue,
  mixRgb,
  paintPixelLightBands,
  paintDirectionalTriangleBands,
  fillRgb,
  finiteNumber,
  pick,
  seeded01,
  shapeColorForRenderPass,
  shouldDrawInRenderPass,
} from "../modifiers/index";
import type { LightClosenessBand, LightClosenessBandMap, NumberRange, RGB } from "../modifiers/index";
import type { ShapeCanvas, ShapeDrawOptions, ShapePalette, ShapeSeed } from "./types";
import {
  shapeIdentity,
  shapeLifecycle,
  shapePass,
  shapeProjection,
  shapeStyle,
} from "./options";

type TreesPaletteTheme = "warm" | "cool";

interface TreesPalette extends ShapePalette {
  grass: RGB[];
  grassByLight?: LightClosenessBandMap<RGB[]>;
  asphalt: RGB;
  trunk: RGB;
  foliage: RGB[];
  foliageByLight?: LightClosenessBandMap<RGB[]>;
}

interface TreesOptions extends ShapeDrawOptions<TreesPalette> {
  paletteTheme?: TreesPaletteTheme;
}

interface TreesTuning {
  grass: { colorBlend: NumberRange; satRange: NumberRange };
  asphalt: { min: NumberRange; max: NumberRange; xScaleRange: NumberRange };
  wind: { rotAmp: NumberRange; xShearAmp: NumberRange; speedHz: NumberRange; phaseSpread: number };
  layout: { sidePadK: number; maxOverflowTopK: number; countRange: NumberRange; overlapK: number };
  poplar: {
    baseWk: NumberRange;
    baseHk: NumberRange;
    trunkWk: NumberRange;
    trunkHk: NumberRange;
    radiusK: number;
  };
  conifer: {
    levelsRange: NumberRange;
    baseHalfWk: NumberRange;
    levelHk: NumberRange;
    trunkWk: NumberRange;
    trunkHk: NumberRange;
    levelShrink: number;
    triHeightFracs2: NumberRange;
    triWidthFracs2: NumberRange;
    triHeightFracs3: [number, number, number];
    triWidthFracs3: [number, number, number];
    intraOverlapK: number;
    levelOverlapK: number;
    widthTaper: number;
    overlapWidthBoost: number;
  };
  foliage: {
    colorBlend: NumberRange;
    brightnessRange: NumberRange;
    satOscAmp: NumberRange;
    satOscSpeed: NumberRange;
    canopyHeightRange: NumberRange;
    canopyWidthRange: NumberRange;
    canopyGrowthGamma: number;
  };
  clusterScaleClamp: NumberRange;
}

// Tunables.
const TREES: TreesTuning = {
  grass: { colorBlend: [0.22, 0.30], satRange: [0.06, 0.18] },

  asphalt: {
    min: [0.25, 0.32],
    max: [0.52, 0.65],
    xScaleRange: [1, 0],
  },

  wind: {
    rotAmp: [0.01, 0.02],
    xShearAmp: [0.02, 0.03],
    speedHz: [0.25, 0.9],
    phaseSpread: Math.PI * 4,
  },

  layout: {
    sidePadK: 0.08,
    maxOverflowTopK: 0.28,
    countRange: [2, 3],
    overlapK: 0.78,
  },

  poplar: {
    baseWk: [0.20, 0.28],
    baseHk: [0.62, 0.92],
    trunkWk: [0.07, 0.09],
    trunkHk: [0.18, 0.26],
    radiusK: 0.22,
  },

  conifer: {
    levelsRange: [1, 1],
    baseHalfWk: [0.22, 0.36],
    levelHk: [0.5, 0.7],
    trunkWk: [0.07, 0.09],
    trunkHk: [0.18, 0.26],
    levelShrink: 0.89,
    triHeightFracs2: [1.00, 0.62],
    triWidthFracs2: [1.00, 0.72],
    triHeightFracs3: [1.00, 0.62, 0.42],
    triWidthFracs3: [1.00, 0.72, 0.52],
    intraOverlapK: 0.35,
    levelOverlapK: 0.22,
    widthTaper: 0.95,
    overlapWidthBoost: 1.10,
  },

  foliage: {
    // Blend strength toward gradientRGB (red at u=0, green at u=1). Raised the
    // low end so bad scores read as visibly more red, not just less green.
    colorBlend: [0.44, 0.40],
    brightnessRange: [0.54, 0.66],
    satOscAmp: [0.08, 0.16],
    satOscSpeed: [0.18, 0.35],
    // Canopy height/width multiplier driven by u: shrinks toward 0 (bad
    // scores read as scrawnier), modest growth toward 1. Gamma < 1 front-loads
    // the curve so both ends are pronounced without needing large end values.
    canopyHeightRange: [0.85, 1.0],
    canopyWidthRange: [0.85, 1.0],
    canopyGrowthGamma: 0.5,
  },

  clusterScaleClamp: [0.92, 1.08],
};

// Palettes.
const TREES_BASE_PALETTE: TreesPalette = {
  grass: [
    { r: 122, g: 172, b: 102 },
    { r: 142, g: 192, b: 122 },
    { r: 112, g: 162, b: 97 },
  ],
  asphalt: { r: 125, g: 125, b: 125 },
  trunk:   { r: 110, g: 85,  b: 60 },
  foliage: [
    { r: 80,  g: 150, b: 90  },  // medium green
    { r: 60,  g: 135, b: 80  },  // darker
    { r: 95,  g: 165, b: 105 },  // balanced
    { r: 70,  g: 120, b: 80  },  // shadowy
    { r: 110, g: 175, b: 100 },  // fresh
    { r: 125, g: 190, b: 115 },  // sunlit
    { r: 140, g: 205, b: 125 },  // vibrant
    { r: 160, g: 220, b: 130 },  // lime highlight
  ],
};

const TREES_DARK_PALETTE: TreesPalette = {
  grass: [
    { r: 52, g: 96,  b: 104 },
    { r: 58, g: 108, b: 114 },
    { r: 48, g: 90,  b: 102 },
  ],
  grassByLight: {
    far: [
      { r: 76, g: 90,  b: 92 },
      { r: 80, g: 96,  b: 94 },
      { r: 70, g: 86,  b: 92 },
    ],
    mid: [
      { r: 68, g: 96,  b: 94 },
      { r: 72, g: 102, b: 96 },
      { r: 64, g: 90,  b: 92 },
    ],
    near: [
      { r: 52, g: 96,  b: 104 },
      { r: 58, g: 108, b: 114 },
      { r: 48, g: 90,  b: 102 },
    ],
  },
  asphalt: { r: 68, g: 79,  b: 96  },
  trunk:   { r: 60, g: 54,  b: 46  },
  foliage: [
    // Fallback if the light-band palettes are not used.
    { r: 48, g: 86,  b: 82 },
    { r: 42, g: 78,  b: 74 },
    { r: 56, g: 94,  b: 84 },
    { r: 45, g: 72,  b: 68 },
    { r: 60, g: 100, b: 88 },
    { r: 66, g: 108, b: 94 },
    { r: 72, g: 116, b: 100 },
    { r: 78, g: 124, b: 106 },
    { r: 50, g: 92,  b: 112 }, // blue spruce
    { r: 58, g: 82,  b: 112 }, // moonlit pine
    { r: 72, g: 96,  b: 78  }, // cool olive
    { r: 86, g: 104, b: 82  }, // muted moss
    { r: 62, g: 74,  b: 102 }, // smoky indigo
    { r: 44, g: 96,  b: 96  }, // deep cyan fir
    { r: 70, g: 84,  b: 74  }, // ash cedar
    { r: 82, g: 112, b: 92  }, // night sage
  ],
  foliageByLight: {
    far: [
      { r: 110, g: 108,  b: 84 },
      { r: 115, g: 102,  b: 88 },
      { r: 102, g: 104,  b: 92 }, // smoky indigo
      { r: 100, g: 104,  b: 94  }, // ash cedar
    ],
    mid: [
      { r: 48, g: 126,  b: 82 },
      { r: 56, g: 124,  b: 84 },
      { r: 60, g: 120, b: 88 },
      { r: 72, g: 126,  b: 78  }, // cool olive
      { r: 86, g: 124, b: 82  }, // muted moss
      { r: 82, g: 122, b: 92  }, // night sage
    ],
    near: [
      { r: 40, g: 102,  b: 122 }, // blue spruce
      { r: 48, g: 102,  b: 122 }, // moonlit pine
      { r: 34, g: 106,  b: 106  }, // deep cyan fir
      { r: 66, g: 108, b: 104 },
      { r: 62, g: 106, b: 100 },
      { r: 68, g: 104, b: 106 },
    ],
  },
};

const TREES_WARM_PALETTE: TreesPalette = {
  grass: [
    { r: 148, g: 186, b: 98  },
    { r: 162, g: 198, b: 108 },
    { r: 138, g: 178, b: 92  },
  ],
  asphalt: { r: 142, g: 130, b: 112 },
  trunk:   { r: 132, g: 96,  b: 58  },
  foliage: [
    { r: 112, g: 164, b: 82  },
    { r: 148, g: 188, b: 88  },
    { r: 136, g: 180, b: 86  },
    { r: 168, g: 198, b: 96  },
    { r: 124, g: 172, b: 84  },
    { r: 152, g: 194, b: 102 },
    { r: 172, g: 210, b: 108 },
    { r: 188, g: 218, b: 118 },
  ],
};

const TREES_COOL_PALETTE: TreesPalette = {
  grass: [
    { r: 112, g: 168, b: 136 },
    { r: 122, g: 178, b: 144 },
    { r: 104, g: 158, b: 128 },
  ],
  asphalt: { r: 118, g: 128, b: 138 },
  trunk:   { r: 92,  g: 84,  b: 76  },
  foliage: [
    { r: 72,  g: 138, b: 108 },
    { r: 58,  g: 122, b: 98  },
    { r: 84,  g: 148, b: 116 },
    { r: 66,  g: 116, b: 104 },
    { r: 96,  g: 158, b: 122 },
    { r: 108, g: 168, b: 132 },
    { r: 122, g: 178, b: 142 },
    { r: 138, g: 192, b: 152 },
  ],
};

// Helpers.
const rFromKey = seeded01;

// Foliage tint: base/grass mix, optional gradient, clamp, then exposure/contrast.
function foliageTint(grassTint: RGB, u: number, gradientRGB: RGB | null | undefined, ex: number, ct: number, rSeed: number, pal: TreesPalette, liveBlend = 1, darkMode = false, lightBand: LightClosenessBand = 'mid', farSideK = 0): RGB {
  const foliageSet = darkMode && pal.foliageByLight?.[lightBand]
    ? pal.foliageByLight[lightBand]
    : pal.foliage;
  const base = pick(foliageSet, rSeed);
  const grassBlend = darkMode ? 0.08 + 0.08 * u : 0.14 + 0.10 * u;
  let mixed = blendRGB(base, grassTint, grassBlend);
  const gradientBlend = clamp01(resolveRangeValue(TREES.foliage.colorBlend, u) * liveBlend);
  if (gradientRGB && gradientBlend > 0) mixed = blendRGB(mixed, gradientRGB, gradientBlend);
  const satLiftK = clamp01(farSideK);
  mixed = clampSaturation(
    mixed,
    darkMode ? 0.05 + 0.12 * satLiftK : 0.08 + 0.16 * satLiftK,
    darkMode ? 0.34 + 0.06 * satLiftK : 0.56 + 0.08 * satLiftK,
    1
  );
  mixed = clampBrightness(
    mixed,
    darkMode ? 0.44 : TREES.foliage.brightnessRange[0],
    darkMode ? 0.56 : TREES.foliage.brightnessRange[1]
  );
  return applySrgbExposureContrast(mixed, ex, ct);
}

// Draws a 1x1 tree cluster with deterministic sprite variation.
export function drawTrees(
  p: ShapeCanvas,
  _cx: number,
  _cy: number,
  _r: number,
  opts: TreesOptions = {}
): void {
  const projection = shapeProjection(opts);
  const style = shapeStyle(opts);
  const lifecycle = shapeLifecycle(opts);
  const identity = shapeIdentity(opts);
  const pass = shapePass(opts);

  const darkMode = style.darkMode === true;
  const pal = style.palette ?? (darkMode ? TREES_DARK_PALETTE
    : opts.paletteTheme === 'warm' ? TREES_WARM_PALETTE
    : opts.paletteTheme === 'cool' ? TREES_COOL_PALETTE
    : TREES_BASE_PALETTE);
  const cell = projection.cell;
  const f = projection.footprint;
  if (!cell || !f) return;

  const ex = finiteNumber(style.exposure, 1);
  const ct = finiteNumber(style.contrast, 1);
  const u  = clamp01(style.liveAvg ?? 0.5);
  const liveBlend = clamp01(typeof style.blend === 'number' ? style.blend : 1);
  const uCanopyGrowth = Math.pow(u, TREES.foliage.canopyGrowthGamma);
  const canopyHeightScale = resolveRangeValue(TREES.foliage.canopyHeightRange, uCanopyGrowth);
  const canopyWidthScale = resolveRangeValue(TREES.foliage.canopyWidthRange, uCanopyGrowth);
  const renderPass = pass.renderPass ?? "color";
  const maskColor = pass.maskColor;
  const requestedMaskAlpha =
    typeof pass.maskAlpha === "number" && Number.isFinite(pass.maskAlpha)
      ? pass.maskAlpha
      : 255;
  const isDepthMaskPass = renderPass === "depthMask";
  const shouldDrawMass = shouldDrawInRenderPass(renderPass, true);
  const shouldDrawColorDetails = shouldDrawInRenderPass(renderPass, false);
  const rowBucket = particleRowBucket(f, projection);
  const farSideSatK = clamp01(1 - rowBucket.t);
  // Keep trees fully opaque at rest; appear modifier still handles fade-in.
  const alpha = 255;

  // Sprite hint only; variety is keyed from seedKey.
  // Deterministic, variant-aware seedKey (used by sprites). Fallback keeps old behavior.
  const seedKey: ShapeSeed = (identity.seedKey ?? identity.seed) ?? `trees|${String(f.r0)}|${String(f.c0)}|${String(f.w)}x${String(f.h)}`;

  // Tile rect
  const { x: x0, y: y0, w, h } = footprintToPx(f, projection);

  // Root appear is the standard bottom-center envelope.
  const anchorX = x0 + w / 2;
  const anchorY = y0 + h;
  const appear = applyShapeMods({
    p,
    x: anchorX,
    y: anchorY,
    r: Math.min(w, h),
    opts: { alpha, timeMs: lifecycle.timeMs, rootAppearK: lifecycle.rootAppearK, selectK: lifecycle.selectK },
  });
  // Ground gets selectK scale but not rootAppearK — it shouldn't shrink during
  // the appear animation, but should move with the cluster when selected.
  const groundAppear = applyShapeMods({
    p,
    x: anchorX,
    y: anchorY,
    r: Math.min(w, h),
    opts: { alpha, timeMs: lifecycle.timeMs, selectK: lifecycle.selectK },
  });
  const drawAlpha = (typeof appear.alpha === 'number') ? appear.alpha : alpha;
  const maskAlpha = isDepthMaskPass
    ? Math.round(requestedMaskAlpha * clamp01(drawAlpha / alpha))
    : drawAlpha;
  const massAlpha = isDepthMaskPass ? maskAlpha : drawAlpha;

  // gentle cluster scale clamp (uniform, anchored bottom-center)
  const clampK0 = TREES.clusterScaleClamp[0];
  const clampK1 = TREES.clusterScaleClamp[1];
  const clampRand = 0.96 + (rFromKey(seedKey, 'clusterClamp') * 0.035); // ~0.96..0.995
  const sClamp = Math.max(clampK0, Math.min(clampK1, clampRand * (0.96 + u * 0.08)));

  const grassH = h * 0.55;
  const grassY = y0 + h - grassH;
  const grassLight = sampleDirectionalLightRect(
    { x: x0, y: grassY, w, h: grassH },
    style.lightCtx ?? null
  );

  // Pick grass tones via seedKey (sprite-variant friendly). Fallback mixing kept.
  const grassPalette = darkMode
    ? pickLightBandValue(pal.grass, pal.grassByLight, grassLight.closenessK)
    : pal.grass;
  const g1 = pick(grassPalette, rFromKey(seedKey, 'grass1'));
  const g2 = pick(grassPalette, rFromKey(seedKey, 'grass2'));
  let grassTint = blendRGB(g1, g2, 0.4 + 0.3 * u);
  const grassGradientBlend = clamp01(resolveRangeValue(TREES.grass.colorBlend, u) * liveBlend);
  if (style.gradientRGB && grassGradientBlend > 0) {
    grassTint = blendRGB(grassTint, style.gradientRGB, grassGradientBlend);
  }
  if (darkMode) {
    grassTint = clampSaturation(grassTint, TREES.grass.satRange[0], TREES.grass.satRange[1], 1);
    grassTint = clampBrightness(grassTint, 0.38, 0.58);
  }
  grassTint = applySrgbExposureContrast(grassTint, ex, ct);
  if (darkMode) {
    const grassLightK = grassLight.overallK * (0.04 + 0.10 * grassLight.closenessK);
    grassTint = mixRgb(grassTint, grassLight.lightColor, grassLightK);
  }

  // The depth mask pass includes the grass pad and tree cluster. The asphalt strip is road.
  let asp = applySrgbExposureContrast(pal.asphalt, ex, ct);
  asp = clampBrightness(asp, resolveRangeValue(TREES.asphalt.min, u), resolveRangeValue(TREES.asphalt.max, u));
  const aspH = grassH * 0.28;
  const baseAspY = grassY + (grassH - aspH) / 2;
  const roadYOffset = Math.max(1, grassH * 0.14);
  const aspY = Math.min(grassY + grassH - aspH, baseAspY + roadYOffset);

  p.push();
  p.translate(groundAppear.x, groundAppear.y);
  p.scale(groundAppear.scaleX, groundAppear.scaleY);
  p.translate(-anchorX, -anchorY);
  if (shouldDrawMass) {
    p.noStroke();
    fillRgb(p, shapeColorForRenderPass(renderPass, grassTint, maskColor), massAlpha);
    p.rect(x0, grassY, w, grassH, Math.round(cell * 0.04));
  }
  if (shouldDrawColorDetails) {
    // left-anchored X-scale on asphalt
    const sx = resolveRangeValue(TREES.asphalt.xScaleRange, u);
    p.push();
    p.translate(x0, aspY + aspH / 2);
    p.scale(sx, 1);
    p.translate(-x0, -(aspY + aspH / 2));
    fillRgb(p, asp, drawAlpha);
    p.rect(x0, aspY, w, aspH, Math.round(cell * 0.16));
    p.pop();
  }
  p.pop();

  const groundY = baseAspY + aspH * 0.6;

  // Trees: appear and scale clamp apply only to the cluster.
  p.push();
  // appear transform
  p.translate(appear.x, appear.y);
  p.scale(appear.scaleX, appear.scaleY);
  p.translate(-anchorX, -anchorY);

  // Tree cluster.
  const countR = rFromKey(seedKey, 'count');
  const minC = TREES.layout.countRange[0];
  const maxC = TREES.layout.countRange[1];
  const count = Math.round(minC + (maxC - minC) * countR);

  const sidePad = w * TREES.layout.sidePadK;
  const usableW = Math.max(8, w - sidePad * 2);
  // reduce step to push trees closer together (inter-tree overlap)
  const step = (usableW / Math.max(1, count)) * TREES.layout.overlapK * (count === 3 ? 1.25 : 1);

  const trunkTint = applySrgbExposureContrast(pal.trunk, ex, ct);

  // time (for osc)
  const timeSec = (typeof lifecycle.timeMs === 'number' ? lifecycle.timeMs : p.millis()) / 1000;

  const canopyTintForLight = (treeKey: ShapeSeed, rSeed: number, treeLight: ReturnType<typeof sampleDirectionalLightRect>): RGB => {
    const band = lightClosenessBand(treeLight.closenessK);
    const tint = foliageTint(grassTint, u, style.gradientRGB, ex, ct, rSeed, pal, liveBlend, darkMode, band, farSideSatK);
    const satAmp   = resolveRangeValue(TREES.foliage.satOscAmp,   u);
    const satSpeed = resolveRangeValue(TREES.foliage.satOscSpeed, u);
    const satPhase = rFromKey(treeKey, 'satPhase') * Math.PI * 2;
    return oscillateSaturation(tint, timeSec, { amp: satAmp, speed: satSpeed, phase: satPhase });
  };

  for (let i = 0; i < count; i++) {
    // sub-key per tree; stable within the sprite key
    const k = `${String(seedKey)}|tree:${String(i)}`;
    const rx = rFromKey(k, 'rx');
    const typePick = rFromKey(k, 'type');
    const posJitter = (rFromKey(k, 'jitter') - 0.5) * step * 0.22;
    const trunkWidthScale = count % 2 === 1 && i === Math.floor(count / 2) ? 0.84 : 1;

    const baseX = x0 + sidePad + step * (i + 0.5) + posJitter;
    const baseY = groundY;

    const windSpeed = resolveRangeValue(TREES.wind.speedHz, rFromKey(k, 'windSpd'));
    const rotAmp    = resolveRangeValue(TREES.wind.rotAmp, u);
    const shearAmp  = resolveRangeValue(TREES.wind.xShearAmp, u);
    const phase     = rFromKey(k, 'windPhase') * TREES.wind.phaseSpread;

    // allow tasteful top overhang
    const maxOverflow = h * TREES.layout.maxOverflowTopK;
    const heightBoost = - (rFromKey(k, 'heightOver') * maxOverflow);
    const scaleBias   = 0.95 + rFromKey(k, 'scaleBias') * 0.25;

    if (typePick < 0.5) {
      /* POPLAR */
      const fw = (TREES.poplar.baseWk[0] + (TREES.poplar.baseWk[1] - TREES.poplar.baseWk[0]) * rx) * w * 0.95 * sClamp * canopyWidthScale;
      const fh = (TREES.poplar.baseHk[0] + (TREES.poplar.baseHk[1] - TREES.poplar.baseHk[0]) * rx) * h * scaleBias * sClamp * canopyHeightScale;
      const tw = Math.max(1, Math.round(w * (TREES.poplar.trunkWk[0] + (TREES.poplar.trunkWk[1] - TREES.poplar.trunkWk[0]) * rx) * sClamp * trunkWidthScale));
      const th = Math.max(2, Math.round(h * (TREES.poplar.trunkHk[0] + (TREES.poplar.trunkHk[1] - TREES.poplar.trunkHk[0]) * rx) * sClamp));
      const treeLight = sampleDirectionalLightRect(
        { x: baseX - fw / 2, y: baseY + heightBoost - th - fh, w: fw, h: fh + th },
        style.lightCtx ?? null
      );
      let leavesTint = canopyTintForLight(k, rx, treeLight);
      leavesTint = mixRgb(leavesTint, treeLight.lightColor, 0.18 * treeLight.overallK);
      const poplarHighlight = mixRgb(leavesTint, treeLight.lightColor, 0.34);
      const poplarShadow = mixRgb(leavesTint, treeLight.shadowColor, 0.24);
      const trunkLit = mixRgb(trunkTint, treeLight.lightColor, 0.14 * treeLight.overallK);

      const m = applyShapeMods({
        p, x: baseX, y: baseY + heightBoost, r: fh, opts: { timeMs: lifecycle.timeMs },
        mods: {
          scale2D:    { x: 1, y: 1, anchor: 'bottom-center' },
          scale2DOsc: { mode:'relative', biasX:1, ampX:shearAmp, biasY:1, ampY:0, speed: windSpeed, phaseX: phase, anchor:'bottom-center' },
          rotationOsc:{ amp: rotAmp, speed: windSpeed, phase }
        }
      });

      p.push();
      p.translate(m.x, m.y);
      p.rotate(m.rotation);

      // trunk
      p.noStroke();
      fillRgb(p, shapeColorForRenderPass(renderPass, trunkLit, maskColor), isDepthMaskPass ? maskAlpha : 255);
      p.rect(-tw/2, -th, tw, th, 2);

      // foliage capsule
      const rad = Math.round(Math.min(fw, fh) * TREES.poplar.radiusK);
      fillRgb(p, shapeColorForRenderPass(renderPass, leavesTint, maskColor), isDepthMaskPass ? maskAlpha : 255);
      p.rect(-fw/2, -th - fh, fw, fh, rad);
      if (shouldDrawColorDetails) {
        paintPixelLightBands(
          p,
          { x: -fw/2, y: -th - fh, w: fw, h: fh },
          treeLight,
          {
            alpha: 255,
            highlightColor: poplarHighlight,
            shadowColor: poplarShadow,
            corner: rad,
            sideK: 0.40,
            topK: 0.24,
            shadowK: 0.18,
          }
        );
      }

      p.pop();
    } else {
      // Conifer: only 2 or 3 small overlapping triangles per tier.
      const levels = Math.round(TREES.conifer.levelsRange[0] +
        (TREES.conifer.levelsRange[1] - TREES.conifer.levelsRange[0]) * rx);

      const baseHalfW = (TREES.conifer.baseHalfWk[0] +
        (TREES.conifer.baseHalfWk[1] - TREES.conifer.baseHalfWk[0]) * rx) *
        (w * 0.5) * TREES.conifer.overlapWidthBoost * sClamp * canopyWidthScale;

      const levelH = (TREES.conifer.levelHk[0] +
        (TREES.conifer.levelHk[1] - TREES.conifer.levelHk[0]) * rFromKey(k, 'levelH')) * cell * 1.0 * scaleBias * sClamp * canopyHeightScale;

      const mRoot = applyShapeMods({
        p, x: baseX, y: baseY + heightBoost, r: levelH * levels, opts: { timeMs: lifecycle.timeMs },
        mods: {
          scale2D:    { x: 1, y: 1, anchor: 'bottom-center' },
          scale2DOsc: { mode:'relative', biasX:1, ampX:shearAmp, biasY:1, ampY:0, speed: windSpeed, phaseX: phase, anchor:'bottom-center' },
          rotationOsc:{ amp: rotAmp, speed: windSpeed, phase }
        }
      });
      const th = Math.max(2, Math.round(h * (TREES.conifer.trunkHk[0] + (TREES.conifer.trunkHk[1] - TREES.conifer.trunkHk[0]) * rx) * sClamp));
      const treeLight = sampleDirectionalLightRect(
        { x: baseX - baseHalfW, y: baseY + heightBoost - levelH * levels - th, w: baseHalfW * 2, h: levelH * levels + th },
        style.lightCtx ?? null
      );
      let leavesTint = canopyTintForLight(k, rx, treeLight);
      leavesTint = mixRgb(leavesTint, treeLight.lightColor, 0.16 * treeLight.overallK);
      const coniferHighlight = mixRgb(leavesTint, treeLight.lightColor, 0.32);
      const coniferShadow = mixRgb(leavesTint, treeLight.shadowColor, 0.22);
      const trunkLit = mixRgb(trunkTint, treeLight.lightColor, 0.12 * treeLight.overallK);

      p.push();
      p.translate(mRoot.x, mRoot.y);
      p.rotate(mRoot.rotation);

      // trunk
      const tw = Math.max(1, Math.round(w * (TREES.conifer.trunkWk[0] + (TREES.conifer.trunkWk[1] - TREES.conifer.trunkWk[0]) * rx) * sClamp * trunkWidthScale));
      p.noStroke();
      fillRgb(p, shapeColorForRenderPass(renderPass, trunkLit, maskColor), isDepthMaskPass ? maskAlpha : 255);
      p.rect(-tw/2, -th, tw, th, 2);

      // per-level parameters
      const shrink = TREES.conifer.levelShrink;
      const taper  = TREES.conifer.widthTaper;
      const ovK    = TREES.conifer.levelOverlapK;    // overlap between levels
      const intraK = TREES.conifer.intraOverlapK; // overlap within a tier

      // Choose 2 or 3 triangles for THIS TREE
      const nT = (rFromKey(k, 'triCount') < 0.5) ? 2 : 3;
      const hFracs = nT === 2 ? TREES.conifer.triHeightFracs2 : TREES.conifer.triHeightFracs3;
      const wFracs = nT === 2 ? TREES.conifer.triWidthFracs2 : TREES.conifer.triWidthFracs3;

      // draw bottom -> top so upper triangles overlap those below
      for (let l = 0; l < levels; l++) {
        // tier half-width with level taper & shrink
        const tierHW = baseHalfW * Math.pow(shrink * taper, l);

        // vertical placement of this tier with level-overlap
        const yBottom = -th - levelH * l + (l > 0 ? ovK * levelH : 0);

        // first triangle of the tier:
        let baseY = yBottom;
        let tipY  = baseY - (levelH * hFracs[0]);

        // lower triangle
        fillRgb(p, shapeColorForRenderPass(renderPass, leavesTint, maskColor), isDepthMaskPass ? maskAlpha : 255);
        p.beginShape();
        p.vertex(-tierHW * wFracs[0], baseY);
        p.vertex( tierHW * wFracs[0], baseY);
        p.vertex( 0,                   tipY);
        p.endShape(p.CLOSE);
        if (shouldDrawColorDetails) {
          paintDirectionalTriangleBands(
            p,
            {
              leftX: -tierHW * wFracs[0],
              rightX: tierHW * wFracs[0],
              baseY,
              apexX: 0,
              apexY: tipY,
            },
            treeLight,
            {
              alpha: 255,
              highlightColor: coniferHighlight,
              shadowColor: coniferShadow,
            }
          );
        }

        // remaining small triangles stacked upward with intra-tier overlap
        for (let t = 1; t < nT; t++) {
          baseY = tipY + intraK * levelH; // overlap downward into previous
          const triH = levelH * hFracs[t];
          tipY  = baseY - triH;

          const hwT = tierHW * wFracs[t];
          p.beginShape();
          p.vertex(-hwT, baseY);
          p.vertex( hwT, baseY);
          p.vertex( 0,   tipY);
          p.endShape(p.CLOSE);
          if (shouldDrawColorDetails) {
            paintDirectionalTriangleBands(
              p,
              {
                leftX: -hwT,
                rightX: hwT,
                baseY,
                apexX: 0,
                apexY: tipY,
              },
              treeLight,
              {
                alpha: 255,
                highlightColor: coniferHighlight,
                shadowColor: coniferShadow,
              }
            );
          }
        }
      }

      p.pop();
    }
  }

  p.pop(); // end cluster transform
}

