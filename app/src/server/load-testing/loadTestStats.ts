// load-testing: debug endpoint, only mounted when LOAD_TEST_MODE is set (see server/index.ts).
import type { Request, Response } from "express";
import { readSanityRequestStats, resetSanityRequestStats } from "./requestStats";
import { readSseConnectionStats, resetSseConnectionStats } from "./sseConnectionStats";

function readAllStats() {
  return {
    sanity: readSanityRequestStats(),
    sse: readSseConnectionStats(),
  };
}

export function loadTestStatsRoute(_req: Request, res: Response) {
  res.status(200).json(readAllStats());
}

export function resetLoadTestStatsRoute(_req: Request, res: Response) {
  resetSanityRequestStats();
  resetSseConnectionStats();
  res.status(200).json(readAllStats());
}
