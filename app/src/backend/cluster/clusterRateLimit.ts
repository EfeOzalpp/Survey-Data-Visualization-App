import cluster from "node:cluster";
import { randomUUID } from "node:crypto";
import { consumeRateLimits, type RateResult, type RateRule } from "../security/rateLimiter";
import { CLUSTER_MODE } from "./clusterMode";
import type { PrimaryToWorkerMessage, WorkerToPrimaryMessage } from "./messages";

const IPC_TIMEOUT_MS = 2000;
const pending = new Map<string, (result: RateResult) => void>();

if (CLUSTER_MODE && cluster.isWorker) {
  process.on("message", (msg: PrimaryToWorkerMessage) => {
    if (msg.type !== "rate-limit-result") return;
    const resolve = pending.get(msg.requestId);
    if (!resolve) return;
    pending.delete(msg.requestId);
    resolve(msg.result);
  });
}

// Under cluster mode, rate-limit state must live in one place (the primary)
// so a client can't evade limits just by landing on a different worker.
// Outside cluster mode, this is just the existing local, synchronous check.
export async function checkRateLimits(rules: readonly RateRule[]): Promise<RateResult> {
  if (!CLUSTER_MODE || !cluster.isWorker || typeof process.send !== "function") {
    return consumeRateLimits(rules);
  }

  const requestId = randomUUID();
  return new Promise<RateResult>((resolve) => {
    pending.set(requestId, resolve);

    const message: WorkerToPrimaryMessage = { type: "rate-limit-check", requestId, rules };
    process.send?.(message);

    setTimeout(() => {
      if (!pending.delete(requestId)) return;
      // Fail open: an IPC hiccup shouldn't hang or break a legitimate request.
      resolve({ allowed: true });
    }, IPC_TIMEOUT_MS);
  });
}
