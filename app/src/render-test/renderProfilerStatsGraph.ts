// src/render-test/renderProfilerStatsGraph.ts
// Scoped to the Three.js/react-three-fiber components only, so Playwright
// (window.__renderStats) and manual graph testing (window.__renderStatsGraph)
// stay separate.

let counts: Record<string, number> = {};
let durations: Record<string, number> = {};

export function recordGraphRender(id: string, actualDuration: number) {
  counts[id] = (counts[id] ?? 0) + 1;
  durations[id] = (durations[id] ?? 0) + actualDuration;
}

export function profilerOnRenderGraph(id: string, _phase: string, actualDuration: number) {
  recordGraphRender(id, actualDuration);
}

export function logGraphRenderStats() {
  const rows = Object.keys(counts).map((id) => ({
    id,
    renders: counts[id],
    totalMs: Number(durations[id].toFixed(2)),
  }));
  console.table(rows);
  const total = rows.reduce((sum, row) => sum + row.renders, 0);
  console.log("Total renders across Three.js/graph components:", total);
  return total;
}

export function resetGraphRenderStats() {
  counts = {};
  durations = {};
}

if (import.meta.env.DEV) {
  (window as unknown as { __renderStatsGraph: unknown }).__renderStatsGraph = {
    log: logGraphRenderStats,
    reset: resetGraphRenderStats,
  };
}
