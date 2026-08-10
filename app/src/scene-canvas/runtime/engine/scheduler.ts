// src/scene-canvas/runtime/engine/scheduler.ts

import { reportSchedulerTickError } from "../debug";

export type EngineTick = (now: number) => void;

interface FrameEntry {
  id: string;
  tick: EngineTick;
  priority: number;
  fpsCap?: number;
  lastTickMs: number;
  active: boolean;
  frameRequested: boolean;
}

export interface RegisterFrameOpts {
  priority?: number; // higher draws earlier (you can invert if you want)
  fpsCap?: number;   // optional, e.g. 30
  active?: boolean;
}

export interface EngineFrameRegistration {
  setActive: (active: boolean) => void;
  requestFrame: () => void;
  unregister: () => void;
}

const entries = new Map<string, FrameEntry>();

let rafId: number | null = null;
let sortedCache: FrameEntry[] | null = null;

function sortEntries() {
  sortedCache ??= Array.from(entries.values()).sort(
    (a, b) => (b.priority - a.priority) || a.id.localeCompare(b.id)
  );
  return sortedCache;
}

function ensureRunning() {
  if (rafId != null) return;
  if (typeof document !== "undefined" && document.hidden) return;
  rafId = requestAnimationFrame(frame);
}

function hasRunnableEntries() {
  for (const entry of entries.values()) {
    if (entry.active || entry.frameRequested) return true;
  }
  return false;
}

function stopIfIdle() {
  if (hasRunnableEntries()) return;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// Pause all ticks when the tab is hidden - resume automatically on visibility.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && rafId == null && hasRunnableEntries()) {
      ensureRunning();
    }
  });
}

function frame(now: number) {
  rafId = null;

  // The visibility listener restarts runnable entries when the tab returns.
  if (typeof document !== "undefined" && document.hidden) {
    return;
  }

  const list = sortEntries();

  for (const e of list) {
    const requestedFrame = e.frameRequested;
    if (!e.active && !requestedFrame) continue;
    e.frameRequested = false;

    if (!requestedFrame && e.fpsCap && e.fpsCap > 0) {
      const minDt = 1000 / e.fpsCap;
      if (now - e.lastTickMs < minDt) continue;
    }

    e.lastTickMs = now;
    try {
      e.tick(now);
    } catch (err) {
      // Don't kill the scheduler because one engine threw.
      reportSchedulerTickError(e.id, err);
    }
  }

  if (hasRunnableEntries()) ensureRunning();
}

export function registerEngineFrame(
  id: string,
  tick: EngineTick,
  opts: RegisterFrameOpts = {}
): EngineFrameRegistration {
  const priority = typeof opts.priority === "number" && Number.isFinite(opts.priority) ? opts.priority : 0;
  const fpsCap = typeof opts.fpsCap === "number" && Number.isFinite(opts.fpsCap) ? opts.fpsCap : undefined;

  const entry: FrameEntry = {
    id,
    tick,
    priority,
    fpsCap,
    lastTickMs: 0,
    active: opts.active ?? true,
    frameRequested: false,
  };

  entries.set(id, entry);

  sortedCache = null;
  if (entry.active) ensureRunning();

  return {
    setActive(active) {
      if (entries.get(id) !== entry || entry.active === active) return;
      entry.active = active;
      entry.lastTickMs = 0;
      if (active) ensureRunning();
      else stopIfIdle();
    },
    requestFrame() {
      if (entries.get(id) !== entry) return;
      entry.frameRequested = true;
      ensureRunning();
    },
    unregister() {
      if (entries.get(id) !== entry) return;
      entries.delete(id);
      sortedCache = null;
      stopIfIdle();
    },
  };
}

export function unregisterEngineFrame(id: string) {
  entries.delete(id);
  sortedCache = null;
  stopIfIdle();
}
