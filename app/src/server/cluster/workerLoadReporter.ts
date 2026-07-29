import cluster from "node:cluster";
import { readSseConnectionStats } from "../load-testing/sseConnectionStats";
import { CLUSTER_MODE } from "./clusterMode";
import type { WorkerToPrimaryMessage } from "./messages";

const REPORT_INTERVAL_MS = 5000;

export function startWorkerLoadReporting() {
  if (!CLUSTER_MODE || !cluster.isWorker || typeof process.send !== "function") return;

  setInterval(() => {
    const message: WorkerToPrimaryMessage = {
      type: "load-report",
      current: readSseConnectionStats().current,
    };
    process.send?.(message);
  }, REPORT_INTERVAL_MS).unref();
}
