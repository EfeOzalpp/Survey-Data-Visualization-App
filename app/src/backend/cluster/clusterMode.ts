import { optionalEnv } from "../env";

// Opt-in: unset means today's single-process behavior, unchanged.
export const CLUSTER_MODE = process.env.CLUSTER_MODE === "true";

// Never fork past the instance's real core count — the whole point is using
// cores that exist, not oversubscribing one.
export const MAX_WORKERS = 2;

// Concurrent-SSE-connection count on worker A that triggers forking worker B.
// Placeholder until calibrated against real k6 results (see project notes) —
// intentionally a plain concurrent-connection count, not CPU%, since CPU
// usage here is bursty (idle SSE holding is cheap; cost spikes only during
// broadcast/write events) and periodic CPU sampling risks missing that.
export const WORKER_SCALE_UP_THRESHOLD = Number(optionalEnv("WORKER_SCALE_UP_THRESHOLD", "400"));
