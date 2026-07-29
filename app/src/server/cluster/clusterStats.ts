import cluster from "node:cluster";
import { randomUUID } from "node:crypto";
import { readSanityRequestStats, resetSanityRequestStats } from "../load-testing/requestStats";
import { readSseConnectionStats, resetSseConnectionStats } from "../load-testing/sseConnectionStats";
import { CLUSTER_MODE } from "./clusterMode";
import type { PrimaryToWorkerMessage, SanityStats, SseStats, WorkerToPrimaryMessage } from "./messages";

const IPC_TIMEOUT_MS = 2000;
const pending = new Map<string, (stats: { sanity: SanityStats; sse: SseStats }) => void>();

if (CLUSTER_MODE && cluster.isWorker) {
  process.on("message", (msg: PrimaryToWorkerMessage) => {
    // Primary asking this worker to contribute its own local stats to an
    // aggregation another worker (or this one) requested.
    if (msg.type === "stats-query") {
      if (msg.reset) {
        resetSanityRequestStats();
        resetSseConnectionStats();
      }
      const reply: WorkerToPrimaryMessage = {
        type: "stats-query-result",
        requestId: msg.requestId,
        sanity: readSanityRequestStats(),
        sse: readSseConnectionStats(),
      };
      process.send?.(reply);
      return;
    }

    if (msg.type === "stats-result") {
      const resolve = pending.get(msg.requestId);
      if (!resolve) return;
      pending.delete(msg.requestId);
      resolve({ sanity: msg.sanity, sse: msg.sse });
    }
  });
}

// Under cluster mode, a single worker's local counters only tell part of the
// story — this asks the primary to aggregate every live worker's numbers,
// optionally resetting each worker's counters first (for a clean k6 window).
// Outside cluster mode, this is just this process's own local stats.
export async function requestClusterStats(
  reset = false
): Promise<{ sanity: SanityStats; sse: SseStats }> {
  if (!CLUSTER_MODE || !cluster.isWorker || typeof process.send !== "function") {
    if (reset) {
      resetSanityRequestStats();
      resetSseConnectionStats();
    }
    return { sanity: readSanityRequestStats(), sse: readSseConnectionStats() };
  }

  const requestId = randomUUID();
  return new Promise((resolve) => {
    pending.set(requestId, resolve);

    const message: WorkerToPrimaryMessage = { type: "stats-request", requestId, reset };
    process.send?.(message);

    setTimeout(() => {
      if (!pending.delete(requestId)) return;
      // Fail closed to this worker's own numbers rather than hanging the request.
      if (reset) {
        resetSanityRequestStats();
        resetSseConnectionStats();
      }
      resolve({ sanity: readSanityRequestStats(), sse: readSseConnectionStats() });
    }, IPC_TIMEOUT_MS);
  });
}
