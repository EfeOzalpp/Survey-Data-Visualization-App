// load-testing: debug endpoint, only mounted when LOAD_TEST_MODE is set (see server/index.ts).
import type { Request, Response } from "express";
import { requestClusterStats } from "../cluster/clusterStats";

export async function loadTestStatsRoute(_req: Request, res: Response) {
  res.status(200).json(await requestClusterStats());
}

export async function resetLoadTestStatsRoute(_req: Request, res: Response) {
  res.status(200).json(await requestClusterStats(true));
}
