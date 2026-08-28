import type { SurveyRow } from "../../domain/survey/types";
import { listenToPostgresSurveyResponses } from "../upstreams/postgres/surveyResponseListener";
import { fetchSurveyResponsePage } from "../upstreams/postgres/surveyResponseRepository";
import {
  SURVEY_RESPONSE_CHUNK_SIZE,
  type SurveyResponseChange,
  type SurveyResponseCursor,
  type SurveyResponseSubscription,
} from "../upstreams/postgres/surveyResponseTypes";

const PATCH_COALESCE_MS = 750;
const RECONNECT_DELAY_MS = 15_000;

interface SurveyResponseSyncCallbacks {
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

export class SurveyResponseSync {
  private snapshotPromise: Promise<void> | null = null;
  private listenerSubscription: SurveyResponseSubscription | null = null;
  private listenerStartPromise: Promise<void> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private patchTimer: NodeJS.Timeout | null = null;
  private readonly pendingUpserts = new Map<string, SurveyRow>();
  private readonly pendingDeletes = new Set<string>();

  constructor(private readonly callbacks: SurveyResponseSyncCallbacks) {}

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
    if (this.listenerSubscription || !this.callbacks.hasClients()) {
      return Promise.resolve();
    }
    if (this.listenerStartPromise) return this.listenerStartPromise;
    this.clearReconnectTimer();

    const startPromise = listenToPostgresSurveyResponses({
      onChange: (change) => {
        this.handleSourceChange(change);
      },
      onError: (error) => {
        this.handleListenerError(error);
      },
    })
      .then((subscription) => {
        if (!this.callbacks.hasClients()) {
          subscription.unsubscribe();
          return;
        }
        this.listenerSubscription = subscription;
      })
      .catch((error: unknown) => {
        this.handleListenerError(error);
      })
      .finally(() => {
        if (this.listenerStartPromise === startPromise) {
          this.listenerStartPromise = null;
        }
      });
    this.listenerStartPromise = startPromise;
    return startPromise;
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

    let cursor: SurveyResponseCursor | null = null;
    let sentAnyPage = false;

    while (this.callbacks.hasClients()) {
      const rows = await fetchSurveyResponsePage(cursor);
      const complete = rows.length < SURVEY_RESPONSE_CHUNK_SIZE;

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
      void this.startListener().then(() => {
        void this.ensureSnapshot().catch((error: unknown) => {
          console.error(
            "[surveyResponseSync] snapshot refresh failed after reconnect:",
            error
          );
          this.callbacks.onError(error);
        });
      });
    }, RECONNECT_DELAY_MS);
  }

  private handleListenerError(error: unknown) {
    console.error("[surveyResponseSync] PostgreSQL listener failed:", error);
    this.listenerSubscription?.unsubscribe();
    this.listenerSubscription = null;
    this.callbacks.onError(error);
    this.scheduleListenerRestart();
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

  private handleSourceChange(change: SurveyResponseChange) {
    if (change.type === "delete") {
      this.callbacks.onDelete(change.id);
      this.queuePatch({ deletes: [change.id] });
      return;
    }

    this.callbacks.onUpsert(change.row);
    this.queuePatch({ upserts: [change.row] });
  }
}
