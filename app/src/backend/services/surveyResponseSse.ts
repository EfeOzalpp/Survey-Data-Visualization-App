import type { Response } from "express";

import { SURVEY_RESPONSE_CHUNK_SIZE } from "../upstreams/postgres/surveyResponseTypes";
import {
  ResponseStore,
  type SurveyResponseLimit,
} from "./responseStore";
import { SnapshotCache } from "./snapshotCache";
import { SseConnectionHub } from "./sseConnectionHub";
import { SurveyResponseSync } from "./surveyResponseSync";

export type { SurveyResponseLimit } from "./responseStore";

const responseStore = new ResponseStore();
const snapshotCache = new SnapshotCache(responseStore, SURVEY_RESPONSE_CHUNK_SIZE);

const connectionHub = new SseConnectionHub(() => {
  surveyResponseSync.stopIfIdle();
});

const surveyResponseSync = new SurveyResponseSync({
  hasClients: () => connectionHub.size > 0,
  canPublishPatches: () => responseStore.hasCompleteSnapshot,
  onSnapshotReset: () => {
    responseStore.resetSnapshot();
    snapshotCache.clear();
  },
  onSnapshotPage: (rows, options) => {
    responseStore.mergeSnapshotPage(rows);
    snapshotCache.clear();
    connectionHub.broadcastSnapshotPage(rows, options);
  },
  onSnapshotComplete: () => {
    responseStore.markSnapshotComplete();
  },
  onUpsert: (row) => {
    responseStore.upsert(row);
    snapshotCache.clear();
  },
  onDelete: (id) => {
    responseStore.delete(id);
    snapshotCache.clear();
  },
  onPatch: (patch) => {
    connectionHub.broadcastPatch(patch);
  },
  onError: (error) => {
    connectionHub.broadcastError(error);
  },
});

export function openSurveyResponseSse({
  section,
  limit,
  res,
}: {
  section: string;
  limit: SurveyResponseLimit;
  res: Response;
}) {
  const isFirstClient = connectionHub.size === 0;
  const client = connectionHub.open({ section, limit, res });

  if (
    !isFirstClient &&
    (responseStore.hasCompleteSnapshot || responseStore.hasRows)
  ) {
    connectionHub.sendSnapshot(
      client,
      snapshotCache.get(
        section,
        limit,
        !surveyResponseSync.isRefreshingSnapshot
      )
    );
  }

  void surveyResponseSync.startListener().then(() => {
    if (!responseStore.hasCompleteSnapshot || isFirstClient) {
      void surveyResponseSync.ensureSnapshot().catch((error: unknown) => {
        console.error("[surveyResponseSse] initial snapshot failed:", error);
        connectionHub.sendError(client, error);
      });
    }
  });

  return () => {
    connectionHub.remove(client.id);
  };
}
