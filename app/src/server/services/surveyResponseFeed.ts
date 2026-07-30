import type { ListenEvent } from "@sanity/client";

import { normalizeSurveyRow } from "../../domain/survey/normalizeSurveyRow";
import type { RawSurveyRow, SurveyRow } from "../../domain/survey/types";
import {
  fetchSnapshotPage,
  listenToSurveyResponses,
  SNAPSHOT_CHUNK_SIZE,
  type SnapshotCursor,
} from "../upstreams/sanity/surveyResponseQueries";

const PATCH_COALESCE_MS = 750;
const RECONNECT_DELAY_MS = 15_000;

interface SurveyResponseFeedCallbacks {
  hasClients: () => boolean;
  canPublishPatches: () => boolean;
  onSnapshotReset: () => void;
  onSnapshotPage: (
    rows: SurveyRow[],
    options: { reset: boolean; complete: boolean }
  ) => void;
  onSnapshotComplete: () => void;
  onUpsert: (row: SurveyRow) => void;
  onDelete: (id: string) => void;
  onPatch: (patch: { upserts: SurveyRow[]; deletes: string[] }) => void;
  onError: (error: unknown) => void;
}

export class SurveyResponseFeed {
  private snapshotPromise: Promise<void> | null = null;
  private listenerSubscription: { unsubscribe: () => void } | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private patchTimer: NodeJS.Timeout | null = null;
  private readonly pendingUpserts = new Map<string, SurveyRow>();
  private readonly pendingDeletes = new Set<string>();

  constructor(private readonly callbacks: SurveyResponseFeedCallbacks) {}

  get isRefreshingSnapshot() {
    return this.snapshotPromise !== null;
  }

  ensureSnapshot() {
    if (this.snapshotPromise) return this.snapshotPromise;

    this.snapshotPromise = this.refreshSnapshot().finally(() => {
      this.snapshotPromise = null;
    });
    return this.snapshotPromise;
  }

  startListener() {
    if (this.listenerSubscription || !this.callbacks.hasClients()) return;
    this.clearReconnectTimer();

    this.listenerSubscription = listenToSurveyResponses({
      onEvent: (event) => {
        this.handleSanityEvent(event);
      },
      onError: (error: unknown) => {
        console.error("[surveyResponseStream] Sanity listener failed:", error);
        this.listenerSubscription = null;
        this.callbacks.onError(error);
        this.scheduleListenerRestart();
      },
    });
  }

  stopIfIdle() {
    if (this.callbacks.hasClients()) return;

    this.clearReconnectTimer();
    this.flushPendingPatch();
    this.listenerSubscription?.unsubscribe();
    this.listenerSubscription = null;
  }

  private async refreshSnapshot() {
    this.callbacks.onSnapshotReset();

    let cursor: SnapshotCursor | null = null;
    let sentAnyPage = false;

    while (this.callbacks.hasClients()) {
      const rows = await fetchSnapshotPage(cursor);
      const complete = rows.length < SNAPSHOT_CHUNK_SIZE;

      this.callbacks.onSnapshotPage(rows, {
        reset: !sentAnyPage,
        complete,
      });
      sentAnyPage = true;

      if (complete || rows.length === 0) break;

      const last = rows[rows.length - 1];
      cursor = {
        time: last.submittedAt,
        id: last._id,
      };
    }

    if (!sentAnyPage) {
      this.callbacks.onSnapshotPage([], { reset: true, complete: true });
    }

    this.callbacks.onSnapshotComplete();
    this.flushPendingPatch();
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleListenerRestart() {
    if (this.reconnectTimer || !this.callbacks.hasClients()) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.startListener();
      void this.ensureSnapshot().catch((error: unknown) => {
        console.error(
          "[surveyResponseStream] snapshot refresh failed after reconnect:",
          error
        );
        this.callbacks.onError(error);
      });
    }, RECONNECT_DELAY_MS);
  }

  private flushPendingPatch() {
    if (this.patchTimer) {
      clearTimeout(this.patchTimer);
      this.patchTimer = null;
    }

    const upserts = [...this.pendingUpserts.values()];
    const deletes = [...this.pendingDeletes];
    this.pendingUpserts.clear();
    this.pendingDeletes.clear();

    if (!upserts.length && !deletes.length) return;
    this.callbacks.onPatch({ upserts, deletes });
  }

  private queuePatch({
    upserts = [],
    deletes = [],
  }: {
    upserts?: SurveyRow[];
    deletes?: string[];
  }) {
    for (const id of deletes) {
      this.pendingUpserts.delete(id);
      this.pendingDeletes.add(id);
    }

    for (const row of upserts) {
      this.pendingDeletes.delete(row._id);
      this.pendingUpserts.set(row._id, row);
    }

    if (
      this.patchTimer ||
      !this.callbacks.hasClients() ||
      this.snapshotPromise ||
      !this.callbacks.canPublishPatches()
    ) {
      return;
    }

    this.patchTimer = setTimeout(() => {
      this.flushPendingPatch();
    }, PATCH_COALESCE_MS);
  }

  private handleSanityEvent(event: ListenEvent<RawSurveyRow>) {
    if (event.type !== "mutation") return;

    if (event.transition === "disappear") {
      this.callbacks.onDelete(event.documentId);
      this.queuePatch({ deletes: [event.documentId] });
      return;
    }

    if (!event.result) {
      void this.ensureSnapshot().catch((error: unknown) => {
        console.error(
          "[surveyResponseStream] snapshot refresh failed after mutation:",
          error
        );
        this.callbacks.onError(error);
      });
      return;
    }

    const row = normalizeSurveyRow(event.result);
    this.callbacks.onUpsert(row);
    this.queuePatch({ upserts: [row] });
  }
}
