// Physics-only worker for particle-1 and particle-2 emitters.
// Owns emitter state; receives step commands per frame; posts back serialized particle buffers.
// Draw logic stays on the main thread — only pure math runs here.

import { clamp01, hzLerp, makePRNG, mix, randRange } from "../../scene-canvas/modifiers/particles/utils";

// Float layout per particle in output buffer: x y vx vy size len tLife
// len is always 0 for particle-2 (dot-only).
const FPP = 7;

interface RangeOption { min?: number; max?: number; }
interface RectLike { x: number; y: number; w: number; h: number; }

interface StepP1Options {
  count?: number;
  rect: RectLike;
  spawn?: { x0?: number; x1?: number; y0?: number; y1?: number };
  speed?: RangeOption;
  angle?: RangeOption;
  jitter?: { pos?: number; velAngle?: number };
  size?: RangeOption;
  length?: RangeOption;
  lifetime?: RangeOption;
  spawnMode?: string;
  respawnStratified?: boolean;
  accel?: { x?: number; y?: number };
  gravity?: number;
  respawn?: boolean;
  sizeHz?: number;
  lenHz?: number;
  warmStartSec?: number;
}

interface StepP2Options {
  count?: number;
  rect: RectLike;
  spawn?: { x0?: number; x1?: number; y0?: number; y1?: number };
  speed?: RangeOption;
  size?: RangeOption;
  lifetime?: RangeOption;
  accel?: { x?: number; y?: number };
  gravity?: number;
  drag?: number;
  jitter?: { pos?: number; velAngle?: number };
  spawnMode?: string;
  respawnStratified?: boolean;
  respawn?: boolean;
  sizeHz?: number;
  angle?: RangeOption;
  dir?: string;
  spreadAngle?: number;
  warmStartSec?: number;
}

// ─────────────────────────── Particle-1 ───────────────────────────

interface P1Particle {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number; len: number; uSlot: number;
}

interface P1State {
  particles: P1Particle[];
  rnd: () => number;
  warmStarted?: boolean;
}

const p1States = new Map<string, P1State>();

function hashP1Key(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function spawnOneP1(
  rnd: () => number,
  rect: { x: number; y: number; w: number; h: number },
  jPos: number, sx0: number, sx1: number, sy0: number, sy1: number,
  spMin: number, spMax: number, angMin: number, angMax: number, jAng: number,
  rMin: number, rMax: number, lMin: number, lMax: number,
  lifeMin: number, lifeMax: number, uSlot: number,
): P1Particle {
  const ux = mix(sx0, sx1, uSlot);
  const uy = randRange(rnd, sy0, sy1);
  const x = rect.x + ux * rect.w + (rnd() * 2 - 1) * jPos;
  const y = rect.y + uy * rect.h + (rnd() * 2 - 1) * jPos;
  const sp = randRange(rnd, spMin, spMax);
  const ang = randRange(rnd, angMin - jAng, angMax + jAng);
  return {
    x, y,
    vx: Math.cos(ang) * sp,
    vy: Math.sin(ang) * sp,
    age: 0,
    life: randRange(rnd, lifeMin, lifeMax),
    size: randRange(rnd, rMin, rMax),
    len: randRange(rnd, lMin, lMax),
    uSlot,
  };
}

function advanceP1(pr: P1Particle, dt: number, ax: number, ay: number) {
  pr.x += pr.vx * dt + 0.5 * ax * dt * dt;
  pr.y += pr.vy * dt + 0.5 * ay * dt * dt;
  pr.vx += ax * dt;
  pr.vy += ay * dt;
  pr.age += dt;
}

function prewarmP1(
  pr: P1Particle,
  rect: { w: number; h: number },
  rnd: () => number,
  ax: number, ay: number,
) {
  const tx = Math.abs(pr.vx) > 1 ? rect.w / Math.abs(pr.vx) : Infinity;
  const ty = Math.abs(pr.vy) > 1 ? rect.h / Math.abs(pr.vy) : Infinity;
  const maxAge = Number.isFinite(Math.min(tx, ty))
    ? Math.min(pr.life * 0.85, Math.min(tx, ty) * 0.95)
    : pr.life * 0.5;
  advanceP1(pr, rnd() * Math.max(0, maxAge), ax, ay);
}

function stepP1(key: string, opts: StepP1Options, dtSec: number): Float32Array {
  const wantCount = Math.max(1, Math.floor(opts.count ?? 32));
  const rect = opts.rect;
  const spawn = opts.spawn ?? {};
  const sx0 = spawn.x0 ?? 0, sx1 = spawn.x1 ?? 1;
  const sy0 = spawn.y0 ?? 0, sy1 = spawn.y1 ?? 0;
  const speed = opts.speed ?? {};
  const spMin = speed.min ?? 120, spMax = speed.max ?? 220;
  const angle = opts.angle ?? {};
  const angMin = angle.min ?? Math.PI / 2, angMax = angle.max ?? Math.PI / 2;
  const jPos = opts.jitter?.pos ?? 0, jAng = opts.jitter?.velAngle ?? 0;
  const rMin = opts.size?.min ?? 1, rMax = opts.size?.max ?? 2.5;
  const lMin = opts.length?.min ?? 6, lMax = opts.length?.max ?? 12;
  const lifeMin = Math.max(0.05, opts.lifetime?.min ?? 0.6);
  const lifeMax = Math.max(lifeMin, opts.lifetime?.max ?? 1.8);
  const spawnMode: string = opts.spawnMode ?? "stratified";
  const keepLane: boolean = opts.respawnStratified ?? true;
  const accX: number = opts.accel?.x ?? 0;
  const accY: number = (opts.accel?.y ?? 0) + (opts.gravity ?? 0);
  const respawn: boolean = opts.respawn !== false;
  const sizeHz: number = typeof opts.sizeHz === "number" && Number.isFinite(opts.sizeHz) ? opts.sizeHz : 0;
  const lenHz: number = typeof opts.lenHz === "number" && Number.isFinite(opts.lenHz) ? opts.lenHz : 0;
  const wantSizeFollow = sizeHz > 0 && rMax !== rMin;
  const wantLenFollow = lenHz > 0 && lMax !== lMin;

  function decorrelatedSlot(uSlot: number) {
    const x = Math.sin((uSlot + 0.173) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  const laneTargetSize = (uSlot: number) => rMin + (rMax - rMin) * decorrelatedSlot(uSlot);
  const laneTargetLen = (uSlot: number) => lMin + (lMax - lMin) * decorrelatedSlot(uSlot);

  let st = p1States.get(key);
  if (!st) {
    const rnd = makePRNG(hashP1Key(key));
    const particles = Array.from({ length: wantCount }, (_, i) => {
      const lane = spawnMode === "stratified" ? (i + rnd()) / wantCount : rnd();
      const pr = spawnOneP1(rnd, rect, jPos, sx0, sx1, sy0, sy1, spMin, spMax, angMin, angMax, jAng, rMin, rMax, lMin, lMax, lifeMin, lifeMax, lane);
      prewarmP1(pr, rect, rnd, accX, accY);
      return pr;
    });
    st = { particles, rnd };
    p1States.set(key, st);
  } else {
    const cur = st.particles.length;
    if (cur < wantCount) {
      const rnd = st.rnd;
      for (let i = cur; i < wantCount; i++) {
        const lane = spawnMode === "stratified" ? (i + rnd()) / wantCount : rnd();
        const pr = spawnOneP1(rnd, rect, jPos, sx0, sx1, sy0, sy1, spMin, spMax, angMin, angMax, jAng, rMin, rMax, lMin, lMax, lifeMin, lifeMax, lane);
        prewarmP1(pr, rect, rnd, accX, accY);
        st.particles.push(pr);
      }
    } else if (cur > wantCount) {
      st.particles.length = wantCount;
    }
  }

  const rnd = st.rnd;

  function respawnP1(pr: P1Particle, idx: number, total: number) {
    if (!(spawnMode === "stratified" && keepLane)) {
      pr.uSlot = spawnMode === "stratified" ? (idx + rnd()) / Math.max(1, total) : rnd();
    }
    const ux = mix(sx0, sx1, pr.uSlot);
    pr.x = rect.x + ux * rect.w + (rnd() * 2 - 1) * jPos;
    pr.y = rect.y + randRange(rnd, sy0, sy1) * rect.h + (rnd() * 2 - 1) * jPos;
    const sp = randRange(rnd, spMin, spMax);
    const ang = randRange(rnd, angMin - jAng, angMax + jAng);
    pr.vx = Math.cos(ang) * sp;
    pr.vy = Math.sin(ang) * sp;
    pr.life = randRange(rnd, lifeMin, lifeMax);
    pr.age = 0;
    pr.size = randRange(rnd, rMin, rMax);
    pr.len = randRange(rnd, lMin, lMax);
  }

  if (!st.warmStarted) {
    st.warmStarted = true;
    const warmStartSec = typeof opts.warmStartSec === "number" && Number.isFinite(opts.warmStartSec)
      ? Math.max(0, opts.warmStartSec) : 0;
    const warmStepSec = 1 / 30;
    const warmSteps = Math.min(180, Math.ceil(warmStartSec / warmStepSec));
    for (let step = 0; step < warmSteps; step++) {
      const stepSec = Math.min(warmStepSec, warmStartSec - step * warmStepSec);
      if (stepSec <= 0) break;
      for (const [i, pr] of st.particles.entries()) {
        advanceP1(pr, stepSec, accX, accY);
        const alive = pr.age <= pr.life;
        const inside = pr.x >= rect.x && pr.x <= rect.x + rect.w && pr.y >= rect.y && pr.y <= rect.y + rect.h;
        if ((!alive || !inside) && respawn) respawnP1(pr, i, st.particles.length);
      }
    }
  }

  for (const [i, pr] of st.particles.entries()) {
    advanceP1(pr, dtSec, accX, accY);
    if (wantSizeFollow) pr.size = hzLerp(pr.size, laneTargetSize(pr.uSlot), sizeHz, dtSec);
    if (wantLenFollow) pr.len = hzLerp(pr.len, laneTargetLen(pr.uSlot), lenHz, dtSec);
    const alive = pr.age <= pr.life;
    const inside = pr.x >= rect.x && pr.x <= rect.x + rect.w && pr.y >= rect.y && pr.y <= rect.y + rect.h;
    if ((!alive || !inside) && respawn) respawnP1(pr, i, st.particles.length);
  }

  const out = new Float32Array(st.particles.length * FPP);
  for (let i = 0; i < st.particles.length; i++) {
    const pr = st.particles[i];
    const b = i * FPP;
    out[b] = pr.x; out[b + 1] = pr.y; out[b + 2] = pr.vx; out[b + 3] = pr.vy;
    out[b + 4] = pr.size; out[b + 5] = pr.len;
    out[b + 6] = pr.life > 0 ? clamp01(pr.age / pr.life) : 1;
  }
  return out;
}

// ─────────────────────────── Particle-2 ───────────────────────────

interface P2Particle {
  x: number; y: number; vx: number; vy: number;
  age: number; life: number; size: number; uSlot: number;
}

interface P2State {
  particles: P2Particle[];
  rnd: () => number;
  warmStarted?: boolean;
}

const p2States = new Map<string, P2State>();

function hashP2Key(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function stratifiedSlot(index: number, total: number, rnd: () => number): number {
  return (index + 0.18 + rnd() * 0.64) / Math.max(1, total);
}

function decorrelatedSlotP2(uSlot: number): number {
  const x = Math.sin((uSlot + 0.173) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function dirToAngleSpan(dir: string, spread: number): { min: number; max: number } {
  const BASES: Record<string, number> = {
    none: Number.NaN, down: Math.PI / 2, up: -Math.PI / 2, right: 0, left: Math.PI,
  };
  const base = BASES[dir] ?? Number.NaN;
  if (Number.isNaN(base)) return { min: -Math.PI, max: Math.PI };
  return { min: base - spread, max: base + spread };
}

function stepP2(key: string, opts: StepP2Options, dtSec: number): Float32Array {
  const wantCount = Math.max(1, Math.floor(opts.count ?? 32));
  const rect = opts.rect;
  const spawn = opts.spawn ?? {};
  const sx0 = spawn.x0 ?? 0, sx1 = spawn.x1 ?? 1;
  const sy0 = spawn.y0 ?? 0, sy1 = spawn.y1 ?? 0;
  const speed = opts.speed ?? {};
  const spMin = speed.min ?? 12, spMax = speed.max ?? 48;
  const rMin = opts.size?.min ?? 1.2;
  const rMax = Math.max(rMin, opts.size?.max ?? 3.2);
  const lifeMin = Math.max(0.1, opts.lifetime?.min ?? 0.8);
  const lifeMax = Math.max(lifeMin, opts.lifetime?.max ?? 2.2);
  const accX: number = opts.accel?.x ?? 0;
  const accY: number = (opts.accel?.y ?? 0) + (opts.gravity ?? 0);
  const drag: number = Math.max(0, opts.drag ?? 0);
  const jPos = opts.jitter?.pos ?? 0, jAng = opts.jitter?.velAngle ?? 0;
  const spawnMode: string = opts.spawnMode ?? "stratified";
  const keepLane: boolean = opts.respawnStratified ?? true;
  const respawn: boolean = opts.respawn !== false;
  const sizeHz: number = typeof opts.sizeHz === "number" && Number.isFinite(opts.sizeHz) ? opts.sizeHz : 0;
  const wantSizeFollow = sizeHz > 0 && rMax !== rMin;
  const laneTargetSize = (uSlot: number) => rMin + (rMax - rMin) * decorrelatedSlotP2(uSlot);

  let angMin: number, angMax: number;
  const angleMin = opts.angle?.min, angleMax = opts.angle?.max;
  if ((typeof angleMin === "number" && Number.isFinite(angleMin)) || (typeof angleMax === "number" && Number.isFinite(angleMax))) {
    angMin = typeof angleMin === "number" && Number.isFinite(angleMin) ? angleMin : 0;
    angMax = typeof angleMax === "number" && Number.isFinite(angleMax) ? angleMax : 0;
  } else {
    const dir: string = opts.dir ?? "none";
    const spread: number = typeof opts.spreadAngle === "number" && Number.isFinite(opts.spreadAngle) ? opts.spreadAngle : 0.35;
    const span = dirToAngleSpan(dir, spread);
    angMin = span.min; angMax = span.max;
  }

  let st = p2States.get(key);
  if (!st) {
    const rnd = makePRNG(hashP2Key(key));
    const particles = Array.from({ length: wantCount }, (_, i) => ({
      x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 1,
      uSlot: stratifiedSlot(i, wantCount, rnd),
    }));
    st = { particles, rnd };
    p2States.set(key, st);
  } else if (st.particles.length !== wantCount) {
    if (st.particles.length < wantCount) {
      for (let i = st.particles.length; i < wantCount; i++) {
        st.particles.push({ x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, size: 1, uSlot: stratifiedSlot(i, wantCount, st.rnd) });
      }
    } else {
      st.particles.length = wantCount;
    }
    for (let i = 0; i < st.particles.length; i++) {
      st.particles[i].uSlot = stratifiedSlot(i, st.particles.length, st.rnd);
    }
  }

  const rnd = st.rnd;

  function advanceP2(pr: P2Particle, dt: number) {
    if (drag > 0 && dt > 0) { const k = Math.exp(-drag * dt); pr.vx *= k; pr.vy *= k; }
    pr.vx += accX * dt; pr.vy += accY * dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.age += dt;
  }

  function respawnP2(pr: P2Particle, idx: number, total: number, prewarm = false) {
    if (!(spawnMode === "stratified" && keepLane)) {
      pr.uSlot = spawnMode === "stratified" ? (idx + rnd()) / Math.max(1, total) : rnd();
    }
    pr.x = rect.x + mix(sx0, sx1, pr.uSlot) * rect.w + (rnd() * 2 - 1) * jPos;
    pr.y = rect.y + randRange(rnd, sy0, sy1) * rect.h + (rnd() * 2 - 1) * jPos;
    const sp = randRange(rnd, spMin, spMax);
    const ang = randRange(rnd, angMin - jAng, angMax + jAng);
    pr.vx = Math.cos(ang) * sp;
    pr.vy = Math.sin(ang) * sp;
    pr.life = randRange(rnd, lifeMin, lifeMax);
    pr.age = 0;
    pr.size = randRange(rnd, rMin, rMax);
    if (prewarm) {
      const tx = Math.abs(pr.vx) > 1 ? rect.w / Math.abs(pr.vx) : Infinity;
      const ty = Math.abs(pr.vy) > 1 ? rect.h / Math.abs(pr.vy) : Infinity;
      const tSec = Math.min(tx, ty);
      const maxAge = Number.isFinite(tSec) ? Math.min(pr.life * 0.85, tSec * 0.95) : pr.life * 0.5;
      advanceP2(pr, rnd() * Math.max(0, maxAge));
    }
  }

  for (const [i, pr] of st.particles.entries()) {
    if (pr.life <= 0) respawnP2(pr, i, st.particles.length, true);
  }

  if (!st.warmStarted) {
    st.warmStarted = true;
    const warmStartSec = typeof opts.warmStartSec === "number" && Number.isFinite(opts.warmStartSec)
      ? Math.max(0, opts.warmStartSec) : 0;
    const warmStepSec = 1 / 30;
    const warmSteps = Math.min(180, Math.ceil(warmStartSec / warmStepSec));
    for (let step = 0; step < warmSteps; step++) {
      const stepSec = Math.min(warmStepSec, warmStartSec - step * warmStepSec);
      if (stepSec <= 0) break;
      for (const [i, pr] of st.particles.entries()) {
        advanceP2(pr, stepSec);
        const alive = pr.age <= pr.life;
        const inside = pr.x >= rect.x && pr.x <= rect.x + rect.w && pr.y >= rect.y && pr.y <= rect.y + rect.h;
        if ((!alive || !inside) && respawn) respawnP2(pr, i, st.particles.length);
      }
    }
  }

  for (const [i, pr] of st.particles.entries()) {
    advanceP2(pr, dtSec);
    if (wantSizeFollow) pr.size = hzLerp(pr.size, laneTargetSize(pr.uSlot), sizeHz, dtSec);
    const alive = pr.age <= pr.life;
    const inside = pr.x >= rect.x && pr.x <= rect.x + rect.w && pr.y >= rect.y && pr.y <= rect.y + rect.h;
    if ((!alive || !inside) && respawn) respawnP2(pr, i, st.particles.length);
  }

  const out = new Float32Array(st.particles.length * FPP);
  for (let i = 0; i < st.particles.length; i++) {
    const pr = st.particles[i];
    const b = i * FPP;
    out[b] = pr.x; out[b + 1] = pr.y; out[b + 2] = pr.vx; out[b + 3] = pr.vy;
    out[b + 4] = pr.size; out[b + 5] = 0;
    out[b + 6] = pr.life > 0 ? clamp01(pr.age / pr.life) : 1;
  }
  return out;
}

// ─────────────────────────── Message handler ───────────────────────────

onmessage = (e: MessageEvent<{ cmd: string; key: string; dtSec: number; opts: Record<string, unknown> }>) => {
  const { cmd, key, dtSec, opts } = e.data;
  let out: Float32Array;
  if (cmd === "step-p1") {
    out = stepP1(key, opts as unknown as StepP1Options, dtSec);
  } else if (cmd === "step-p2") {
    out = stepP2(key, opts as unknown as StepP2Options, dtSec);
  } else {
    return;
  }
  postMessage({ cmd, key, particles: out }, { transfer: [out.buffer] });
};
