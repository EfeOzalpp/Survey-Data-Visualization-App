import type { Response } from "express";

import { SNAPSHOT_CHUNK_SIZE } from "../upstreams/sanity/surveyResponseQueries";
import {
  ResponseStore,
  type SurveyResponseLimit,
} from "./responseStore";
import { SnapshotCache } from "./snapshotCache";
import { SseClientHub } from "./sseClientHub";
import { SurveyResponseFeed } from "./surveyResponseFeed";

export type { SurveyResponseLimit } from "./responseStore";

const responseStore = new ResponseStore();
const snapshotCache = new SnapshotCache(responseStore, SNAPSHOT_CHUNK_SIZE);

const clientHub = new SseClientHub(() => {
  surveyResponseFeed.stopIfIdle();
});

const surveyResponseFeed = new SurveyResponseFeed({
  hasClients: () => clientHub.size > 0,
  canPublishPatches: () => responseStore.hasCompleteSnapshot,
  onSnapshotReset: () => {
    responseStore.resetSnapshot();
    snapshotCache.clear();
  },
  onSnapshotPage: (rows, options) => {
    responseStore.mergeSnapshotPage(rows);
    snapshotCache.clear();
    clientHub.broadcastSnapshotPage(rows, options);
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
    clientHub.broadcastPatch(patch);
  },
  onError: (error) => {
    clientHub.broadcastError(error);
  },
});

export function openSurveyResponseStream({
  section,
  limit,
  res,
}: {
  section: string;
  limit: SurveyResponseLimit;
  res: Response;
}) {
  const isFirstClient = clientHub.size === 0;
  const client = clientHub.open({ section, limit, res });

  if (
    !isFirstClient &&
    (responseStore.hasCompleteSnapshot || responseStore.hasRows)
  ) {
    clientHub.sendSnapshot(
      client,
      snapshotCache.get(
        section,
        limit,
        !surveyResponseFeed.isRefreshingSnapshot
      )
    );
  }

  surveyResponseFeed.startListener();
  if (!responseStore.hasCompleteSnapshot || isFirstClient) {
    void surveyResponseFeed.ensureSnapshot().catch((error: unknown) => {
      console.error("[surveyResponseStream] initial snapshot failed:", error);
      clientHub.sendError(client, error);
    });
  }

  return () => {
    clientHub.remove(client.id);
  };
}
