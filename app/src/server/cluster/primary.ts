import cluster from "node:cluster";
import type { Worker } from "node:cluster";
import { consumeRateLimits } from "../security/rateLimiter";
import { MAX_WORKERS, WORKER_SCALE_UP_THRESHOLD } from "./clusterMode";
import type { PrimaryToWorkerMessage, SanityStats, SseStats, WorkerToPrimaryMessage } from "./messages";

const STATS_AGGREGATION_TIMEOUT_MS = 1000;
const EMPTY_SANITY_STATS: SanityStats = {
  snapshotFetch: 0,
  listenSubscriptionOpened: 0,
  writeCreate: 0,
  writePatch: 0,
};
const EMPTY_SSE_STATS: SseStats = { totalOpened: 0, current: 0, peakConcurrent: 0 };

interface PendingStatsAggregation {
  requesterWorkerId: number;
  expected: number;
  sanity: SanityStats[];
  sse: SseStats[];
  timer: NodeJS.Timeout;
}

function sumSanityStats(entries: SanityStats[]): SanityStats {
  return entries.reduce(
    (acc, s) => ({
      snapshotFetch: acc.snapshotFetch + s.snapshotFetch,
      listenSubscriptionOpened: acc.listenSubscriptionOpened + s.listenSubscriptionOpened,
      writeCreate: acc.writeCreate + s.writeCreate,
      writePatch: acc.writePatch + s.writePatch,
    }),
    EMPTY_SANITY_STATS
  );
}

// peakConcurrent is summed per-worker as a conservative upper-bound estimate
// of cluster-wide peak, not a verified simultaneous max across workers.
function sumSseStats(entries: SseStats[]): SseStats {
  return entries.reduce(
    (acc, s) => ({
      totalOpened: acc.totalOpened + s.totalOpened,
      current: acc.current + s.current,
      peakConcurrent: acc.peakConcurrent + s.peakConcurrent,
    }),
    EMPTY_SSE_STATS
  );
}

export function runPrimary() {
  const workers = new Map<number, Worker>();
  const pendingStats = new Map<string, PendingStatsAggregation>();
  let scaledUp = false;

  function finishStatsAggregation(requestId: string) {
    const entry = pendingStats.get(requestId);
    if (!entry) return;
    pendingStats.delete(requestId);
    clearTimeout(entry.timer);

    const requesterWorker = workers.get(entry.requesterWorkerId);
    if (!requesterWorker) return;

    const reply: PrimaryToWorkerMessage = {
      type: "stats-result",
      requestId,
      sanity: sumSanityStats(entry.sanity),
      sse: sumSseStats(entry.sse),
    };
    requesterWorker.send(reply);
  }

  function handleMessage(worker: Worker, msg: WorkerToPrimaryMessage) {
    if (msg.type === "load-report") {
      if (!scaledUp && workers.size < MAX_WORKERS && msg.current >= WORKER_SCALE_UP_THRESHOLD) {
        scaledUp = true;
        console.log(
          `[cluster] worker ${String(worker.id)} reached ${String(msg.current)} concurrent connections — forking worker B`
        );
        forkWorker();
      }
      return;
    }

    if (msg.type === "rate-limit-check") {
      const result = consumeRateLimits(msg.rules);
      const reply: PrimaryToWorkerMessage = { type: "rate-limit-result", requestId: msg.requestId, result };
      worker.send(reply);
      return;
    }

    if (msg.type === "stats-request") {
      const liveWorkers = [...workers.values()];
      pendingStats.set(msg.requestId, {
        requesterWorkerId: worker.id,
        expected: liveWorkers.length,
        sanity: [],
        sse: [],
        timer: setTimeout(() => {
          finishStatsAggregation(msg.requestId);
        }, STATS_AGGREGATION_TIMEOUT_MS),
      });

      const query: PrimaryToWorkerMessage = { type: "stats-query", requestId: msg.requestId, reset: msg.reset };
      for (const liveWorker of liveWorkers) liveWorker.send(query);
      return;
    }

    // Only "stats-query-result" can reach here — the three branches above
    // return early for every other member of the WorkerToPrimaryMessage union.
    const entry = pendingStats.get(msg.requestId);
    if (!entry) return;
    entry.sanity.push(msg.sanity);
    entry.sse.push(msg.sse);
    if (entry.sanity.length >= entry.expected) finishStatsAggregation(msg.requestId);
  }

  function forkWorker() {
    const worker = cluster.fork();
    workers.set(worker.id, worker);
    worker.on("message", (msg: WorkerToPrimaryMessage) => {
      handleMessage(worker, msg);
    });
    worker.on("exit", () => {
      workers.delete(worker.id);
    });
  }

  forkWorker();
}
