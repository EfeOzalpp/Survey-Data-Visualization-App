// src/render-test/renderProfilerStats.ts
// Benchmarking helper for the Context -> Zustand re-render comparison.

let counts: Record<string, number> = {};
let durations: Record<string, number> = {};

export function recordRender(id: string, actualDuration: number) {
  counts[id] = (counts[id] ?? 0) + 1;
  durations[id] = (durations[id] ?? 0) + actualDuration;
}

// Shared onRender callback: pass directly to <Profiler onRender={profilerOnRender}>.
// Counts every commit (mount and update alike).
export function profilerOnRender(id: string, _phase: string, actualDuration: number) {
  recordRender(id, actualDuration);
}

export function logRenderStats() {
  const rows = Object.keys(counts).map((id) => ({
    id,
    renders: counts[id],
    totalMs: Number(durations[id].toFixed(2)),
  }));
  console.table(rows);
  const total = rows.reduce((sum, row) => sum + row.renders, 0);
  console.log("Total renders across profiled components:", total);
  return { total, rows };
}

export function resetRenderStats() {
  counts = {};
  durations = {};
}

// Counts a component's own function body executing, independent of the
// wrapping <Profiler> (which fires for any commit in its subtree, including
// descendants that re-render on their own). Call directly in the component
// body — not via onRender — so this only ticks when THIS function re-runs.
let ownCounts: Record<string, number> = {};

export function recordOwnRender(id: string) {
  ownCounts[id] = (ownCounts[id] ?? 0) + 1;
}

export function logOwnRenderStats() {
  const rows = Object.keys(ownCounts)
    .map((id) => ({ id, renders: ownCounts[id] }))
    .sort((a, b) => b.renders - a.renders);
  console.table(rows);
  return { rows };
}

export function resetOwnRenderStats() {
  ownCounts = {};
}

if (import.meta.env.DEV) {
  (window as unknown as { __renderStats: unknown }).__renderStats = {
    log: logRenderStats,
    reset: resetRenderStats,
  };
  (window as unknown as { __ownRenderStats: unknown }).__ownRenderStats = {
    log: logOwnRenderStats,
    reset: resetOwnRenderStats,
  };
}
