// src/scene-canvas/shapes/sea.ts

import {
  clamp01,
  resolveRangeValue,
  lerpNumber,
  blendRGB,
  blendRGBGamma,
  clampSaturation,
  clampBrightness,
  oscillateSaturation,
  stepAndDrawPuffs,
  applyShapeMods,
  footprintToPx,
  particleDepthAlpha,
  particleDepthSizeScale,
  particleRowBucket,
  rgbaCss,
  roundedRectPath,
  shapeColorForRenderPass,
  smoothstep01,
} from "../modifiers/index";
import type { NumberRange, RGB } from "../modifiers/index";
import type { ShapeCanvas, ShapeDrawOptions, ShapePalette } from "./types";
import {
  shapeLifecycle,
  shapeParticles,
  shapePass,
  shapeProjection,
  shapeSprite,
  shapeStyle,
} from "./options";

interface SeaPalette extends ShapePalette {
  top: RGB;
  bottom: RGB;
}

type SeaPaletteTheme = "warm" | "cool";

interface SeaOptions extends ShapeDrawOptions<SeaPalette> {
  paletteTheme?: SeaPaletteTheme;
  oscHz?: number;
  oscAmp?: number;
}

// Tunables.
const SEA_TUNING = {
  gradient: {
    gamma: true,
    blendTop:    [0.10, 0.05] as NumberRange,
    blendBottom: [0.10, 0.05] as NumberRange,
  },

  colorClamp: {
    sat:    { min: 0.10, max: 0.85 },
    bright: { min: 0.40, max: 0.80 },
    strength: 1.0,
  },

  scale: {
    baseYRange:  [0.88, 0.45] as NumberRange,
    oscHzRange:  [0.45, 0.85] as NumberRange,
    oscAmpRange: [0.04, 0.008] as NumberRange,
  },

  appear: { easing: 'cubic' as 'cubic' | 'linear' },

  overflow: { allow: false, extraTopPx: 0, extraBottomPx: 0 },

  opacity:   { mul: 0.88 },
  antialias: { expandPx: 2 },

  topBorder: {
    enable: false,
    topLinePx:    1,
    topLineAlpha: 0.28,
    topLineMix:   0.25,
  },

  foam: {
    enable: true,
    band:   { heightPx: 10, offsetTopPx: 4, oscAmpPx: 3, oscHzRange: [0.12, 0.25] as NumberRange },
    motion: { dir: 'up' as const, spreadAngle: 0.35, speedPxSec: [5, 11] as NumberRange, gravity: -5, drag: 0.8, jitterPos: 0.5, jitterAngle: 0.15 },
    pool:   { count: 18, sizePx: [0.8, 1.8] as NumberRange, sizeHz: 6, lifetimeSec: [0.8, 1.6] as NumberRange, fadeInFrac: 0.2, fadeOutFrac: 0.35 },
    edgeFadePx: { left: 6, right: 6, top: 0, bottom: 10 },
    color:  { base: { r: 250, g: 252, b: 255, a: 200 }, varyBySize: true },
  },

  bowl: {
    enable: true,
    thicknessK:  0.2,
    baseFrac:    0.18,
    postTopFrac: 0.24,
    colWidthK:   1.00,
    cornerK:     0.10,
    mobile: {
      cellMax:    28,
      thicknessK: 0.1,
      baseFrac:   0.12,
      postTopFrac:0.08,
      colWidthK:  0.85,
      cornerK:    0.12,
    },
    grassBlend: {
      // Blend strength toward gradientRGB (red at u=0, green at u=1). Raised
      // the high end so the cup/bowl mixes in visibly more green at u=1.
      colorBlend: [0.20, 0.52] as NumberRange,
      satRange: [0.00, 0.16] as NumberRange,
      brightRange: [0.35, 0.90] as NumberRange,
      // Exponent applied to u for colorBlend: u^gamma with gamma < 1
      // front-loads the green mix so it's pronounced well before u hits 1.
      towardOneGamma: 0.5,
    },
    alphaMul:   1.0,
    pieceRadiusPx:    undefined as number | undefined,
    baseOverlapPx:    undefined as number | undefined,
    postBottomLiftPx: undefined as number | undefined,
  },

  // Horizon cap rectangle (drawn without tile clip)
  capRect: {
    enable:         true,
    widthTiles:     0.90,
    heightTiles:    0.45,
    cornerPx:       6,
    followOffsetPx: 0,
    color: {
      top:    { r: 245, g: 248, b: 252, a: 255 },
      bottom: { r: 210, g: 230, b: 252, a: 255 },
    },
    scaleMap: { uMin: 0.2, uMax: 0.85, xMin: 0.4, xMax: 1, yMin: 0.3, yMax: 1.22 },
    alphaMul: 1.0,
    satOsc:   { amp: 0.08, speed: 0.16, phase: 0 },
  },

  // Spill with particle-2 (narrow spawn band near surface + tall corridor)
  spill: {
    enable: true,

    // global horizontal offset for the WHOLE spill block (in tiles)
    offsetTilesX: 0.25,

    // micro per-side nudges (px)
    leftNudgePx:  0,
    rightNudgePx: 0,

    count:  34,
    sizePx: [2.5, 5.0] as NumberRange,

    leftSpeedPxSec:  [60, 120] as NumberRange,
    rightSpeedPxSec: [60, 120] as NumberRange,

    gravity: 360,
    drag:    6,
    lifetimeSec: [1.2, 2.0] as NumberRange,

    spillPx: 40,

    fadeInFrac:  0.15,
    fadeOutFrac: 0.35,
    edgeFadePx:  { left: 2, right: 8, top: 4, bottom: 8 },

    coneAccelX:  120,
    spreadAngle: 0.45,

    leftSpawnFracX:  [0.70, 0.96] as NumberRange,
    rightSpawnFracX: [0.00, 0.20] as NumberRange,

    liveGate: { min: 0.25, max: 0, soft: 0.12 },

    leftEdgeFadeLeftPx: 2,
    leftLifetimeSec:    [1.2, 2.0] as NumberRange,
    leftExtraRoomPx:    24,

    mobile: { cellMax: 28, leftNudgePx: 8, rightNudgePx: -4 },
  },
};

// Palettes.
const SEA_BASE_PALETTE: SeaPalette = {
  top: { r: 138, g: 196, b: 234 },
  bottom: { r: 25, g: 124, b: 179 },
};

const SEA_DARK_PALETTE: SeaPalette = {
  top: { r: 76, g: 124, b: 179 },
  bottom: { r: 14, g: 78, b: 137 },
};

const SEA_WARM_PALETTE: SeaPalette = {
  top: { r: 148, g: 210, b: 218 },
  bottom: { r: 48, g: 140, b: 168 },
};

const SEA_COOL_PALETTE: SeaPalette = {
  top: { r: 118, g: 182, b: 228 },
  bottom: { r: 12, g: 98, b: 168 },
};

const GRASS_BASE: RGB = { r: 150, g: 190, b: 150 };
const GRASS_DARK: RGB = { r: 72, g: 102, b: 130 };

// Helpers.
// Map a world-space Y to the current water gradient color.
function seaRGBAtY(y: number, topY: number, bottomY: number, topRGB: RGB, bottomRGB: RGB): RGB {
  const t = Math.max(0, Math.min(1, (y - topY) / Math.max(1e-6, (bottomY - topY))));
  return {
    r: Math.round(topRGB.r + (bottomRGB.r - topRGB.r) * t),
    g: Math.round(topRGB.g + (bottomRGB.g - topRGB.g) * t),
    b: Math.round(topRGB.b + (bottomRGB.b - topRGB.b) * t),
  };
}

function liveWindowK(u: number, a: number, b: number, s = 0): number {
  let lo = a, hi = b;
  if (lo > hi) { [lo, hi] = [hi, lo]; }
  if (s <= 0) return (u >= lo && u <= hi) ? 1 : 0;
  const inL = smoothstep01((u - (lo - s)) / s);
  const inR = smoothstep01(((hi + s) - u) / s);
  return Math.max(0, Math.min(1, Math.min(inL, inR)));
}

export function drawSea(p: ShapeCanvas, _x: number, _y: number, _r: number, opts: SeaOptions = {}): void {
  const projection = shapeProjection(opts);
  const style = shapeStyle(opts);
  const lifecycle = shapeLifecycle(opts);
  const sprite = shapeSprite(opts);
  const particles = shapeParticles(opts);
  const pass = shapePass(opts);

  const darkMode = style.darkMode === true;
  const pal = style.palette ?? (darkMode ? SEA_DARK_PALETTE
    : opts.paletteTheme === 'warm' ? SEA_WARM_PALETTE
    : opts.paletteTheme === 'cool' ? SEA_COOL_PALETTE
    : SEA_BASE_PALETTE);
  const grassPal = darkMode ? GRASS_DARK : GRASS_BASE;
  const cell = projection.cell;
  const cellW = projection.cellW ?? cell;
  const cellH = projection.cellH ?? cell;
  const f = projection.footprint;
  if (!cell || !f) return;
  const renderPass = pass.renderPass ?? "color";
  const isDepthMaskPass = renderPass === "depthMask";
  const shouldDrawColorDetails = !isDepthMaskPass;
  const maskColor = pass.maskColor;

  // Detect "sprite mode"
  // - auto when CanvasAnimatedTexture / Frozen path sets fitToFootprint: true
  // - or explicitly via sprite.spriteMode
  const isSprite = (sprite.fitToFootprint ?? false) || (sprite.spriteMode ?? false);
  const pxK = isSprite ? Math.max(1, sprite.coreScaleMult ?? sprite.pixelScale ?? 1) : 1;

  const T = SEA_TUNING;

  const tSec = (typeof lifecycle.timeMs === 'number' ? lifecycle.timeMs : p.millis()) / 1000;
  const u = clamp01(style.liveAvg ?? 0.5);

  const baseAlpha = typeof style.alpha === 'number' ? style.alpha : 235;
  const alphaMulGlobal = clamp01(T.opacity.mul);
  const requestedMaskAlpha =
    typeof pass.maskAlpha === "number" && Number.isFinite(pass.maskAlpha)
      ? pass.maskAlpha
      : baseAlpha;

  const spanTilesX = f.w;
  const rowBucket = particleRowBucket(f, projection);
  const particleDepthA = particleDepthAlpha(rowBucket);
  const particleSizeK = particleDepthSizeScale(rowBucket);

  // tile rect
  const { x: x0, y: y0, w, h } = footprintToPx(f, projection);

  const cx = x0 + w / 2;
  const bottomY = y0 + h;

  // WATER Y-scale
  const baseScaleY = resolveRangeValue(T.scale.baseYRange, u);
  const oscHz  = Math.max(0, opts.oscHz  ?? resolveRangeValue(T.scale.oscHzRange,  u));
  const oscAmp = Math.max(0, opts.oscAmp ?? resolveRangeValue(T.scale.oscAmpRange, u));
  const oscT   = 0.5 + 0.5 * Math.sin(tSec * (oscHz * 2 * Math.PI));
  const oscScaleY = lerpNumber(1 - oscAmp, 1 + oscAmp, oscT);
  const waterScaleY = Math.max(0, Math.min(1.25, baseScaleY * oscScaleY));

  // WATER colors (gamma + clamp)
  const useGamma = T.gradient.gamma;
  const blendTopK    = clamp01(resolveRangeValue(T.gradient.blendTop,    u));
  const blendBottomK = clamp01(resolveRangeValue(T.gradient.blendBottom, u));
  const blender = useGamma ? blendRGBGamma : blendRGB;
  let topRGB    = style.gradientRGB ? blender(pal.top,    style.gradientRGB, blendTopK)    : pal.top;
  let bottomRGB = style.gradientRGB ? blender(pal.bottom, style.gradientRGB, blendBottomK) : pal.bottom;

  const clampStrength = clamp01(T.colorClamp.strength);
  if (clampStrength > 0) {
    const { min: sMin, max: sMax } = T.colorClamp.sat;
    const { min: lMin, max: lMax } = T.colorClamp.bright;
    const clampOnce = (c: RGB): RGB => clampBrightness(
      clampSaturation(c, sMin, sMax, clampStrength),
      lMin, lMax, clampStrength
    );
    topRGB    = clampOnce(topRGB);
    bottomRGB = clampOnce(bottomRGB);
  }

  const ctx = p.drawingContext;

  // geometry in group space
  const extraTop    = Math.max(0, T.overflow.extraTopPx    || 0);
  const extraBottom = Math.max(0, T.overflow.extraBottomPx || 0);
  const expand = Math.max(0, T.antialias.expandPx || 0);
  const L0 = -w / 2 - expand / 2;
  const W0 = w + expand;
  const Ttop0 = -h - extraTop;
  const H0 = h + extraTop + extraBottom;

  // GROUP APPEAR transform
  const env = applyShapeMods({
    p,
    x: cx,
    y: bottomY,
    r: Math.min(w, h),
    opts: { alpha: baseAlpha * alphaMulGlobal, timeMs: lifecycle.timeMs, rootAppearK: lifecycle.rootAppearK, selectK: lifecycle.selectK },
    mods: { appear: { ease: (T.appear.easing === 'linear') ? 'linear' : 'cubic' } }
  });

  const drawAlpha = (typeof env.alpha === 'number') ? env.alpha : (baseAlpha * alphaMulGlobal);
  const aFactor = Math.max(0, Math.min(255, Math.round(drawAlpha))) / 255;
  const appearAlphaK = (baseAlpha * alphaMulGlobal) > 0
    ? clamp01(drawAlpha / (baseAlpha * alphaMulGlobal))
    : 1;
  const depthMaskFactor = clamp01((requestedMaskAlpha * appearAlphaK) / 255);
  const depthMaskRGB = shapeColorForRenderPass(renderPass, topRGB, maskColor);
  const isMobileBowl = cell <= T.bowl.mobile.cellMax;
  const bowlThicknessK = isMobileBowl ? T.bowl.mobile.thicknessK : T.bowl.thicknessK;
  const bowlBaseFrac = isMobileBowl ? T.bowl.mobile.baseFrac : T.bowl.baseFrac;
  const bowlPostTopFrac = isMobileBowl ? T.bowl.mobile.postTopFrac : T.bowl.postTopFrac;
  const bowlColWidthK = isMobileBowl ? T.bowl.mobile.colWidthK : T.bowl.colWidthK;
  const bowlCornerK = isMobileBowl ? T.bowl.mobile.cornerK : T.bowl.cornerK;
  const bowlThicknessPx = Math.max(1, Math.round(cell * bowlThicknessK));
  const bowlColW = Math.max(1, Math.round(bowlThicknessPx * bowlColWidthK));
  const bowlBaseH = Math.max(bowlThicknessPx, Math.round(H0 * bowlBaseFrac));
  const bowlBaseY = (bottomY + Ttop0) + H0 - bowlBaseH;
  const bowlBaseX = cx + L0;
  const bowlBaseW = W0;
  const bowlPostsTopY = (bottomY + Ttop0) + Math.round(H0 * bowlPostTopFrac);

  // Begin group transform; clip the tile
  p.push();
  p.translate(env.x, env.y);
  p.scale(env.scaleX, env.scaleY);
  p.translate(-cx, -bottomY);

  // In sprite mode we force clip so nothing spills outside the texture
  const wantClip = isSprite ? true : !T.overflow.allow;
  if (wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }

  // 1) WATER body (Y-scaled)
  p.push();
  p.translate(cx, bottomY);
  p.scale(1, waterScaleY);

  const waterSideInset = T.bowl.enable ? Math.max(1, bowlColW) : 0;
  const waterX = L0 + waterSideInset;
  const waterW = Math.max(1, W0 - waterSideInset * 2);
  const rTop = Math.min(3, Math.max(0.5, Math.round(cell * 0.03)));
  {
    const x = waterX;
    const y = Ttop0;
    const ww = waterW;
    const hh = H0;
    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, x, y, ww, hh, rTop);
    ctx.clip();
    const OVER = 4;
    const gy0 = y - OVER;
    const gy1 = y + hh + OVER;
    if (isDepthMaskPass) {
      ctx.fillStyle = rgbaCss(depthMaskRGB, depthMaskFactor);
    } else {
      const g = ctx.createLinearGradient(0, gy0, 0, gy1);
      g.addColorStop(0, rgbaCss(topRGB, aFactor));
      g.addColorStop(1, rgbaCss(bottomRGB, aFactor));
      ctx.fillStyle = g;
    }
    ctx.fillRect(x - 2, gy0, ww + 4, (gy1 - gy0));
    ctx.restore();
  }

  // Foam (sticks to water)
  if (T.foam.enable && shouldDrawColorDetails) {
    const bandH   = Math.max(1, T.foam.band.heightPx);
    const bandOff = Math.max(0, T.foam.band.offsetTopPx);
    const foamHz  = resolveRangeValue(T.foam.band.oscHzRange, u);
    const yOsc    = Math.sin(tSec * foamHz * 2 * Math.PI) * (T.foam.band.oscAmpPx || 0);

    const rect = { x: waterX, y: Ttop0 - bandOff + yOsc, w: waterW, h: bandH };

    const speedLo = Array.isArray(T.foam.motion.speedPxSec) ? T.foam.motion.speedPxSec[0] : 10;
    const speedHi = Array.isArray(T.foam.motion.speedPxSec) ? T.foam.motion.speedPxSec[1] : speedLo;

    const sizeLo  = (Array.isArray(T.foam.pool.sizePx) ? T.foam.pool.sizePx[0] : 1) * pxK * particleSizeK;
    const sizeHi  = Math.max(sizeLo, (Array.isArray(T.foam.pool.sizePx) ? T.foam.pool.sizePx[1] : sizeLo) * pxK * particleSizeK);

    const lifeLo  = Array.isArray(T.foam.pool.lifetimeSec) ? T.foam.pool.lifetimeSec[0] : 1;
    const lifeHi  = Array.isArray(T.foam.pool.lifetimeSec) ? T.foam.pool.lifetimeSec[1] : 1.6;

    const base = T.foam.color.base;
    const colorFn = (pr: { size: number }): { r: number; g: number; b: number; a: number } => {
      const aFoam = Math.round(base.a * aFactor);
      if (!T.foam.color.varyBySize || sizeHi === sizeLo) return { ...base, a: aFoam };
      const k = clamp01((pr.size - sizeLo) / Math.max(1e-6, sizeHi - sizeLo));
      const d = 5;
      return { r: base.r - d * (1 - k), g: base.g - d * (1 - k), b: base.b - d * (1 - k), a: aFoam };
    };

    const dtSec =
      (typeof lifecycle.dtSec === 'number' && lifecycle.dtSec > 0)
        ? lifecycle.dtSec
        : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

    stepAndDrawPuffs(p, {
      store: particles.particleStore,
      key: `seafoam:${String(f.r0)}:${String(f.c0)}:${String(spanTilesX)}x${String(f.h)}${isSprite ? ':spr' : ''}`,
      rect,
      dir: T.foam.motion.dir,
      spreadAngle: T.foam.motion.spreadAngle,
      spawnMode: 'stratified',
      respawnStratified: true,
      spawn: { x0: 0, x1: 1, y0: 0, y1: 1 },
      speed:  { min: speedLo, max: speedHi },
      accel:  { x: 0, y: 0 },
      gravity: T.foam.motion.gravity,
      jitter: { pos: T.foam.motion.jitterPos, velAngle: T.foam.motion.jitterAngle },
      drag:   Math.max(0, T.foam.motion.drag || 0),
      count:  T.foam.pool.count,
      size:   { min: sizeLo, max: sizeHi },
      sizeHz: T.foam.pool.sizeHz,
      lifetime:   { min: lifeLo, max: lifeHi },
      fadeInFrac: T.foam.pool.fadeInFrac,
      fadeOutFrac:T.foam.pool.fadeOutFrac,
      edgeFadePx: T.foam.edgeFadePx,
      color: colorFn,
      depthAlpha: particleDepthA,
      respawn: true,
    }, dtSec);
  }

  p.pop(); // end WATER scope

  // ---- Cap rectangle (no size oscillation; scale <- clamped liveAvg) ----
  if (T.capRect.enable) {
    if (wantClip) ctx.restore();
    const surfaceY = bottomY + Ttop0 * waterScaleY;

    const rectW  = T.capRect.widthTiles  * (cellW ?? 0);
    const rectH  = T.capRect.heightTiles * (cellH ?? 0);
    const radius = Math.min(T.capRect.cornerPx, rectH / 2);
    const followOffset = T.capRect.followOffsetPx;

    const sm = T.capRect.scaleMap;
    const uClamped = Math.max(0, Math.min(1, (u - sm.uMin) / Math.max(1e-6, (sm.uMax - sm.uMin))));
    const sx = lerpNumber(sm.xMin, sm.xMax, uClamped);
    const sy = lerpNumber(sm.yMin, sm.yMax, uClamped);

    ctx.save();
    ctx.translate(cx, surfaceY + followOffset);
    ctx.scale(sx, sy);

    const left = -rectW / 2;
    const top  = -rectH;

    const rectAlpha = isDepthMaskPass
      ? depthMaskFactor
      : aFactor * T.capRect.alphaMul;

    if (isDepthMaskPass) {
      ctx.fillStyle = rgbaCss(depthMaskRGB, rectAlpha);
    } else {
      const baseTop = T.capRect.color.top;
      const baseBot = T.capRect.color.bottom;
      const satOsc = T.capRect.satOsc;
      const topCol = oscillateSaturation(baseTop, tSec, { amp: satOsc.amp, speed: satOsc.speed, phase: satOsc.phase });
      const botCol = oscillateSaturation(baseBot, tSec, { amp: satOsc.amp, speed: satOsc.speed, phase: satOsc.phase + Math.PI / 4 });

      const grad = ctx.createLinearGradient(0, top, 0, 0);
      grad.addColorStop(0, rgbaCss(topCol, rectAlpha));
      grad.addColorStop(1, rgbaCss(botCol, rectAlpha));
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    roundedRectPath(ctx, left, top, rectW, rectH, radius);
    ctx.fill();
    ctx.restore();

    // re-clip after cap
    if (wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }
  }

  // 2) BOWL composite (proportional; mobile-safe)
  if (T.bowl.enable) {
    const _tEff = bowlThicknessPx;
    const baseH = bowlBaseH;
    const baseY = bowlBaseY;
    const baseX = bowlBaseX;
    const baseW = bowlBaseW;

    const postsTopY = bowlPostsTopY;
    const colW = bowlColW;
    const postR       = Math.max(0, (T.bowl.pieceRadiusPx ?? 0) | 0);
    const baseOverlap = Math.max(0, T.bowl.baseOverlapPx ?? 0);
    const postBottomY = baseY + baseOverlap;
    const postDrawH   = Math.max(1, postBottomY - postsTopY - Math.max(0, T.bowl.postBottomLiftPx ?? Math.ceil(postR)));

    const leftX  = cx + L0;
    const rightX = cx + L0 + W0 - colW;

    const gb = T.bowl.grassBlend;
    const uCupGreen = Math.pow(u, gb.towardOneGamma);
    const blendK = clamp01(resolveRangeValue(gb.colorBlend, uCupGreen));
    const [satLo, satHi] = gb.satRange;
    const [briLo, briHi] = gb.brightRange;

    let bowlRGB = grassPal;
    if (style.gradientRGB) bowlRGB = blendRGB(bowlRGB, style.gradientRGB, blendK);
    bowlRGB = clampSaturation(bowlRGB, satLo, satHi, 1);
    bowlRGB = clampBrightness(bowlRGB, briLo, briHi, 1);

    const bowlFill = shapeColorForRenderPass(renderPass, bowlRGB, maskColor);
    const aBowl = isDepthMaskPass
      ? Math.round(255 * depthMaskFactor)
      : Math.round(255 * clamp01(T.bowl.alphaMul) * appearAlphaK);
    ctx.fillStyle = rgbaCss(bowlFill, aBowl / 255);

    const rCorner = Math.round(cell * bowlCornerK);
    {
      const r = Math.min(rCorner, baseH / 2, baseW / 2);
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + baseW, baseY);
      ctx.lineTo(baseX + baseW, baseY + baseH - r);
      ctx.quadraticCurveTo(baseX + baseW, baseY + baseH, baseX + baseW - r, baseY + baseH);
      ctx.lineTo(baseX + r, baseY + baseH);
      ctx.quadraticCurveTo(baseX, baseY + baseH, baseX, baseY + baseH - r);
      ctx.lineTo(baseX, baseY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    roundedRectPath(ctx, leftX,  postsTopY, colW, postDrawH, postR);
    roundedRectPath(ctx, rightX, postsTopY, colW, postDrawH, postR);
    ctx.fill();
  }

  // top border (optional)
  if (shouldDrawColorDetails && T.topBorder.enable && (T.topBorder.topLinePx > 0)) {
    const aLine = Math.round(drawAlpha * clamp01(T.topBorder.topLineAlpha));
    const kMix = clamp01(T.topBorder.topLineMix);
    const lineRGB = {
      r: Math.round(topRGB.r + (bottomRGB.r - topRGB.r) * kMix),
      g: Math.round(topRGB.g + (bottomRGB.g - topRGB.g) * kMix),
      b: Math.round(topRGB.b + (bottomRGB.b - topRGB.b) * kMix),
    };
    p.push();
    p.noFill();
    p.stroke(lineRGB.r, lineRGB.g, lineRGB.b, aLine);
    p.strokeWeight(T.topBorder.topLinePx);
    p.line(cx + L0, bottomY + Ttop0, cx + L0 + W0, bottomY + Ttop0);
    p.pop();
  }

  // SPILL (particle-2) - drawn last so droplets render above the bowl
  if (T.spill.enable && shouldDrawColorDetails) {
    // Remove clip before spill so particles can render into the bleed area (sea has 0.45-tile
    // horizontal bleed on each side - enough for the falling corridors to sit outside the pool).
    if (wantClip) ctx.restore();

    const gGate = T.spill.liveGate;
    const spillK = liveWindowK(u, gGate.min, gGate.max, gGate.soft);

    if (spillK > 0.01) {
      const dtSec =
        (typeof lifecycle.dtSec === 'number' && lifecycle.dtSec > 0)
          ? lifecycle.dtSec
          : (p.deltaTime ? Math.max(1/120, p.deltaTime / 1000) : 1/60);

      // sprite-mode adjustments: keep inside tile + remove global shift/nudges
      const spillRaw = Math.max(0, T.spill.spillPx);
      const spill = isSprite ? Math.min(spillRaw, Math.round(cell * 0.10)) : spillRaw;

      const isMobile = cell <= T.spill.mobile.cellMax;

      const waterTopY    = bottomY + Ttop0 * waterScaleY;
      const waterBottomY = bottomY + (Ttop0 + H0) * waterScaleY;
      const bottomBound  = y0 + h;
      const visibleBottomBound = isSprite
        ? bottomBound
        : bottomBound + Math.max(spill, cell * 0.45);

      const surfaceY = waterTopY;
      const spawnHeightPx = isSprite ? Math.max(5, cell * 0.16) : Math.max(8, cell * 0.35);
      const bandTopY = isSprite ? surfaceY - spawnHeightPx : surfaceY - cell * 0.18;
      const bandH    = Math.max(1, bottomBound - bandTopY + cell * 0.25);

      const spawnFracY = Math.min(1, spawnHeightPx / Math.max(1, bandH));

      const leftSpawnFracX  = T.spill.leftSpawnFracX;
      const rightSpawnFracX = T.spill.rightSpawnFracX;

      const colWBase = Math.max(8, cell * 0.35);

      // Base X for each corridor.
      // In sprite mode: overlap the bowl wall so spill particles visually bond
      // with the edge instead of starting from the outer bleed boundary.
      const leftNudge  = isSprite ? 0 : (T.spill.leftNudgePx  + (isMobile ? T.spill.mobile.leftNudgePx  : 0));
      const rightNudge = isSprite ? 0 : (T.spill.rightNudgePx + (isMobile ? T.spill.mobile.rightNudgePx : 0));

      const extraRoom = isMobile ? Math.round(cell * 0.25) : T.spill.leftExtraRoomPx;
      const leftCorridorW  = colWBase + extraRoom;
      const rightCorridorW = colWBase + (isSprite ? extraRoom : spill);
      const spriteEdgeOverlap = isSprite ? Math.max(4, Math.round(colWBase * 0.40)) : 0;
      const waterLeftEdgeX = cx + waterX;
      const waterRightEdgeX = cx + waterX + waterW;

      const leftBaseX  = isSprite
        ? (x0 - leftCorridorW + spriteEdgeOverlap)
        : (waterLeftEdgeX - leftCorridorW * leftSpawnFracX[1] + leftNudge);
      const rightBaseX = isSprite
        ? (x0 + w - spriteEdgeOverlap)
        : (waterRightEdgeX - rightCorridorW * rightSpawnFracX[0] + rightNudge);

      const leftCorridor  = { x: leftBaseX,  y: bandTopY, w: leftCorridorW,  h: bandH };
      const rightCorridor = { x: rightBaseX, y: bandTopY, w: rightCorridorW, h: bandH };

      // Spawn fracs: in sprite mode bias toward the bowl edge so droplets
      // originate from the water boundary rather than floating outside it.
      const leftSpawnFrac = isSprite
        ? { x0: 0.52, x1: 0.94, y0: 0.00, y1: spawnFracY }
        : { x0: leftSpawnFracX[0],  x1: leftSpawnFracX[1],  y0: 0.00, y1: spawnFracY };
      const rightSpawnFrac = isSprite
        ? { x0: 0.06, x1: 0.48, y0: 0.00, y1: spawnFracY }
        : { x0: rightSpawnFracX[0], x1: rightSpawnFracX[1], y0: 0.00, y1: spawnFracY };

      const rMin  = (Array.isArray(T.spill.sizePx) ? T.spill.sizePx[0] : T.spill.sizePx) * pxK * particleSizeK;
      const rMax  = Math.max(rMin, (Array.isArray(T.spill.sizePx) ? T.spill.sizePx[1] : rMin) * pxK * particleSizeK);
      const gatedCount = Math.max(0, Math.floor(T.spill.count * spillK));
      const alphaMul = spillK;

      const lifeMin = T.spill.lifetimeSec[0];
      const lifeMax = T.spill.lifetimeSec[1];
      const leftLifeMin = T.spill.leftLifetimeSec[0];
      const leftLifeMax = T.spill.leftLifetimeSec[1];

      const keySuffix = isSprite ? ':spr' : '';

      const runSide = (side: 'L' | 'R'): void => {
        const isLeft  = side === 'L';
        const rectSim = isLeft ? leftCorridor  : rightCorridor;
        const spawnFr = isLeft ? leftSpawnFrac : rightSpawnFrac;
        const dir     = isLeft ? 'left' : 'right';
        const spRange = isLeft ? T.spill.leftSpeedPxSec : T.spill.rightSpeedPxSec;
        const accelX  = T.spill.coneAccelX * (isLeft ? -1 : 1);

        if (gatedCount < 1) return;

        stepAndDrawPuffs(p, {
          store: particles.particleStore,
          key: `spill:${String(f.r0)}:${String(f.c0)}:${String(spanTilesX)}x${String(f.h)}:${side}${keySuffix}`,
          rect: rectSim,
          dir,
          spreadAngle: T.spill.spreadAngle,

          spawnMode: 'stratified',
          respawnStratified: true,
          spawn: spawnFr,

          speed:  { min: spRange[0], max: spRange[1] },
          accel:  { x: accelX, y: 0 },
          gravity: T.spill.gravity,
          jitter: { pos: 2, velAngle: 0.25 },
          drag:   T.spill.drag,

          count:  gatedCount,
          size:   { min: rMin, max: rMax },
          sizeHz: 5,
          lifetime: isLeft
            ? { min: leftLifeMin, max: leftLifeMax }
            : { min: lifeMin,     max: lifeMax     },

          fadeInFrac: T.spill.fadeInFrac,
          fadeOutFrac:T.spill.fadeOutFrac,

          edgeFadePx: isLeft
            ? { left: T.spill.leftEdgeFadeLeftPx, right: 8, top: 4, bottom: 8 }
            : T.spill.edgeFadePx,

          color: (pr) => {
            if (pr.y > visibleBottomBound) return { r: 0, g: 0, b: 0, a: 0 };
            const c = seaRGBAtY(pr.y, waterTopY, waterBottomY, topRGB, bottomRGB);
            return { r: c.r, g: c.g, b: c.b, a: Math.round(175 * aFactor * alphaMul) };
          },
          depthAlpha: particleDepthA,

          respawn: true,
        }, dtSec);
      };

      runSide('L');
      runSide('R');
    }

    // re-clip after spill
    if (wantClip) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); }
  }

  if (wantClip) ctx.restore();
  p.pop(); // end GROUP transform
}
