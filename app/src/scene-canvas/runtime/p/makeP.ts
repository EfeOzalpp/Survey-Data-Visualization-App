// src/scene-canvas/runtime/p/makeP.ts

import type { CanvasColor, CanvasDrawSurface } from "../../shared/canvas";
import { getCanvasMeta, setCanvasMeta } from "./canvasMeta";

export type PLike = CanvasDrawSurface;

export interface RuntimeSurface {
  p: PLike;
}

const DEFAULT_FRAME_DELTA_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 100;

function rgbaCss(r: number, g: number, b: number, a: number): string {
  return `rgba(${String(r)},${String(g)},${String(b)},${String(a)})`;
}

function frameDeltaMs(now: number, last: number): number {
  const raw = now - last;
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_FRAME_DELTA_MS;
  if (raw === 0) return 0;
  return Math.min(raw, MAX_FRAME_DELTA_MS);
}

export function makeP(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): PLike {
  let _delta = DEFAULT_FRAME_DELTA_MS,
    _now = performance.now(),
    _last = _now;
  const state = { doFill: true, doStroke: false, lineWidth: 1 };

  // Engine-side state that must survive save/restore
  let _rectMode: "corner" | "center" = "corner";
  const _pStateStack: {
    _rectMode: "corner" | "center";
    doFill: boolean;
    doStroke: boolean;
    lineWidth: number;
  }[] = [];

  // simple css->rgb parser using canvas
  const scratchContext = document.createElement("canvas").getContext("2d");
  if (!scratchContext) throw new Error("2D canvas context not available");
  const _scratch = scratchContext;

  function parseCss(css: string): CanvasColor {
    _scratch.fillStyle = "#000";
    _scratch.fillStyle = css;
    const s = _scratch.fillStyle; // canonicalized css
    _scratch.fillStyle = s;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(_scratch.fillStyle);
    if (!m) return { r: 0, g: 0, b: 0 };
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }

  // simple immediate-mode beginShape/vertex path
  let _shapeOpen = false;
  let _firstVertex = true;

  const c = canvas;

  const p: PLike = {
    canvas: c,
    get width() {
      return getCanvasMeta(c).cssW ?? c.width;
    },
    get height() {
      return getCanvasMeta(c).cssH ?? c.height;
    },
    get deltaTime() {
      return _delta;
    },
    millis() {
      return _now;
    },
    drawingContext: ctx,
    P2D: "2d",

    createCanvas(w, h) {
      c.width = w;
      c.height = h;
      return c;
    },

    resizeCanvas(w, h) {
      const ratio = getCanvasMeta(c).dpr ?? 1;
      setCanvasMeta(c, { cssW: w, cssH: h });
      c.width = Math.max(1, Math.floor(w * ratio));
      c.height = Math.max(1, Math.floor(h * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    },

    pixelDensity(dpr) {
      const meta = getCanvasMeta(c);
      const w = meta.cssW ?? (c.clientWidth > 0 ? c.clientWidth : window.innerWidth);
      const h = meta.cssH ?? (c.clientHeight > 0 ? c.clientHeight : window.innerHeight);
      setCanvasMeta(c, { dpr: Math.max(1, dpr) });
      p.resizeCanvas(w, h);
    },

    background(css) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.restore();
    },

    push() {
      _pStateStack.push({
        _rectMode,
        doFill: state.doFill,
        doStroke: state.doStroke,
        lineWidth: state.lineWidth,
      });
      ctx.save();
    },
    pop() {
      ctx.restore();
      const s = _pStateStack.pop();
      _rectMode = s?._rectMode ?? "corner";
      state.doFill = s?.doFill ?? true;
      state.doStroke = s?.doStroke ?? false;
      state.lineWidth = s?.lineWidth ?? 1;
      ctx.lineWidth = state.lineWidth;
    },

    translate(x, y) {
      ctx.translate(x, y);
    },
    scale(x, y) {
      ctx.scale(x, y ?? x);
    },
    rotate(r) {
      ctx.rotate(r);
    },

    noFill() {
      state.doFill = false;
    },
    fill(r, g, b, a = 255) {
      state.doFill = true;
      if (typeof r === "string") {
        const c2 = parseCss(r);
        ctx.fillStyle = rgbaCss(c2.r, c2.g, c2.b, a / 255);
      } else {
        ctx.fillStyle = rgbaCss(r | 0, (g ?? 0) | 0, (b ?? 0) | 0, (a | 0) / 255);
      }
    },
    noStroke() {
      state.doStroke = false;
    },
    stroke(r, g, b, a = 255) {
      state.doStroke = true;
      ctx.strokeStyle = rgbaCss(r | 0, g | 0, b | 0, (a | 0) / 255);
    },
    strokeWeight(w) {
      state.lineWidth = w;
      ctx.lineWidth = w;
    },

    CORNER: "corner",
    CENTER: "center",
    rectMode(mode) {
      _rectMode = mode === p.CENTER ? "center" : "corner";
    },

    rect(x, y, w, h, tl = 0, tr = tl, br = tl, bl = tl) {
      if (_rectMode === "center") {
        x = x - w / 2;
        y = y - h / 2;
      }
      const rr = (rad: number) => Math.max(0, Math.min(rad, Math.min(w, h) / 2));
      const rtl = rr(tl),
        rtr = rr(tr),
        rbr = rr(br),
        rbl = rr(bl);

      ctx.beginPath();
      ctx.moveTo(x + rtl, y);
      ctx.lineTo(x + w - rtr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rtr);
      ctx.lineTo(x + w, y + h - rbr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h);
      ctx.lineTo(x + rbl, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rbl);
      ctx.lineTo(x, y + rtl);
      ctx.quadraticCurveTo(x, y, x + rtl, y);

      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    circle(x, y, d) {
      ctx.beginPath();
      ctx.arc(x, y, d / 2, 0, Math.PI * 2);
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },

    triangle(x1, y1, x2, y2, x3, y3) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
    },

    beginShape() {
      ctx.beginPath();
      _shapeOpen = true;
      _firstVertex = true;
    },
    vertex(x, y) {
      if (!_shapeOpen) return;
      if (_firstVertex) {
        ctx.moveTo(x, y);
        _firstVertex = false;
      } else {
        ctx.lineTo(x, y);
      }
    },
    endShape(mode) {
      if (!_shapeOpen) return;
      if (mode && (mode === "close" || mode === p.CLOSE)) ctx.closePath();
      if (state.doFill) ctx.fill();
      if (state.doStroke) ctx.stroke();
      _shapeOpen = false;
    },
    CLOSE: "close",

    color(css) {
      return parseCss(css);
    },
    red(c2) {
      return c2.r;
    },
    green(c2) {
      return c2.g;
    },
    blue(c2) {
      return c2.b;
    },

    __tick(now) {
      _delta = frameDeltaMs(now, _last);
      _last = now;
      _now = now;
    },
  };

  return p;
}
