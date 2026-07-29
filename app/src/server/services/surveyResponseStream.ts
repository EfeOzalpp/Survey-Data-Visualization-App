import type { Response } from "express";
import type { ListenEvent } from "@sanity/client";

import { recordSseConnectionClosed, recordSseConnectionOpened } from "../load-testing/sseConnectionStats"; // load-testing
import { filterRowsForSection } from "../../domain/survey/sections";
import { normalizeSurveyRow } from "../../domain/survey/normalizeSurveyRow";
import type { RawSurveyRow, SurveyRow } from "../../domain/survey/types";
import {
  fetchSnapshotPage,
  listenToSurveyResponses,
  SNAPSHOT_CHUNK_SIZE,
  type SnapshotCursor,
} from "../upstreams/sanity/surveyResponseQueries";

const PATCH_COALESCE_MS = 750;
const HEARTBEAT_MS = 25_000;
const RECONNECT_DELAY_MS = 15_000;

interface StreamClient {
  id: number;
  section: string;
  limit: SurveyResponseLimit;
  res: Response;
  heartbeat: NodeJS.Timeout;
}

export type SurveyResponseLimit = number | "all";

let nextClientId = 1;
let rowsCache: SurveyRow[] = [];
let hasSnapshot = false;
let snapshotPromise: Promise<void> | null = null;
let listenerSubscription: { unsubscribe: () => void } | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let patchTimer: NodeJS.Timeout | null = null;
const pendingUpserts = new Map<string, SurveyRow>();
const pendingDeletes = new Set<string>();

const clients = new Map<number, StreamClient>();

function newestTimestampOf(row: SurveyRow) {
  const raw = row.submittedAt ?? row._createdAt;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

function compareNewestFirst(a: SurveyRow, b: SurveyRow) {
  const timeDelta = newestTimestampOf(b) - newestTimestampOf(a);
  return timeDelta !== 0 ? timeDelta : b._id.localeCompare(a._id);
}

function sortNewestFirst(rows: SurveyRow[]) {
  return [...rows].sort(compareNewestFirst);
}

// `rows` is always already sorted newest-first, so a single changed row only
// needs its correct position found (binary search) and spliced in, not a
// full O(N log N) re-sort of the whole cache on every write.
function upsertRow(rows: SurveyRow[], row: SurveyRow) {
  const withoutExisting = rows.filter((item) => item._id !== row._id);

  let low = 0;
  let high = withoutExisting.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareNewestFirst(withoutExisting[mid], row) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  withoutExisting.splice(low, 0, row);
  return withoutExisting;
}

function mergeRows(rows: SurveyRow[], nextRows: SurveyRow[]) {
  const byId = new Map(rows.map((row) => [row._id, row]));
  for (const row of nextRows) byId.set(row._id, row);
  return sortNewestFirst([...byId.values()]);
}

function rowsForClient(client: StreamClient) {
  const rows = filterRowsForSection(rowsCache, client.section);
  return client.limit === "all" ? rows : rows.slice(0, client.limit);
}

function writeEvent(client: StreamClient, event: string, data: unknown) {
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch (error) {
    console.warn("[surveyResponseStream] failed to write SSE event:", error);
    return false;
  }
}

function writeComment(client: StreamClient, comment: string) {
  try {
    client.res.write(`: ${comment}\n\n`);
    return true;
  } catch (error) {
    console.warn("[surveyResponseStream] failed to write SSE heartbeat:", error);
    return false;
  }
}

function sendStreamError(client: StreamClient, error: unknown) {
  return writeEvent(client, "stream-error", {
    message: error instanceof Error ? error.message : "Survey response stream failed",
  });
}

function sendSnapshotChunk(
  client: StreamClient,
  rows: SurveyRow[],
  {
    reset = false,
    complete = false,
  }: {
    reset?: boolean;
    complete?: boolean;
  } = {}
) {
  return writeEvent(client, "snapshot", { rows, reset, complete });
}

function sendCachedSnapshot(client: StreamClient, completeWhenDone: boolean) {
  const rows = rowsForClient(client);
  if (!rows.length) {
    return sendSnapshotChunk(client, [], { reset: true, complete: completeWhenDone });
  }

  for (let index = 0; index < rows.length; index += SNAPSHOT_CHUNK_SIZE) {
    const chunk = rows.slice(index, index + SNAPSHOT_CHUNK_SIZE);
    const complete = completeWhenDone && index + SNAPSHOT_CHUNK_SIZE >= rows.length;
    if (!sendSnapshotChunk(client, chunk, { reset: index === 0, complete })) return false;
  }

  return true;
}

function broadcastSnapshotChunk(
  rows: SurveyRow[],
  {
    reset = false,
    complete = false,
  }: {
    reset?: boolean;
    complete?: boolean;
  } = {}
) {
  for (const client of clients.values()) {
    const clientRows = filterRowsForSection(rows, client.section);
    if (!sendSnapshotChunk(client, clientRows, { reset, complete })) removeClient(client.id);
  }
}

function broadcastStreamError(error: unknown) {
  for (const client of clients.values()) {
    if (!sendStreamError(client, error)) removeClient(client.id);
  }
}

async function refreshSnapshot() {
  rowsCache = [];
  hasSnapshot = false;

  let cursor: SnapshotCursor | null = null;
  let sentAnyChunk = false;

  while (clients.size > 0) {
    const rows: SurveyRow[] = await fetchSnapshotPage(cursor);
    const complete = rows.length < SNAPSHOT_CHUNK_SIZE;

    rowsCache = mergeRows(rowsCache, rows);
    broadcastSnapshotChunk(rows, { reset: !sentAnyChunk, complete });
    sentAnyChunk = true;

    if (complete || rows.length === 0) break;

    const last: SurveyRow = rows[rows.length - 1];
    cursor = {
      time: last.submittedAt ?? last._createdAt,
      id: last._id,
    };
  }

  if (!sentAnyChunk) {
    broadcastSnapshotChunk([], { reset: true, complete: true });
  }

  hasSnapshot = true;
  flushPendingPatch();
}

function ensureSnapshot() {
  if (snapshotPromise) return snapshotPromise;
  snapshotPromise = refreshSnapshot().finally(() => {
    snapshotPromise = null;
  });
  return snapshotPromise;
}

function clearReconnectTimer() {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function scheduleListenerRestart() {
  if (reconnectTimer || clients.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startSanityListener();
    void ensureSnapshot().catch((error: unknown) => {
      console.error("[surveyResponseStream] snapshot refresh failed after reconnect:", error);
      broadcastStreamError(error);
    });
  }, RECONNECT_DELAY_MS);
}

function flushPendingPatch() {
  if (patchTimer) {
    clearTimeout(patchTimer);
    patchTimer = null;
  }

  const upserts = [...pendingUpserts.values()];
  const deletes = [...pendingDeletes];
  pendingUpserts.clear();
  pendingDeletes.clear();

  if (!upserts.length && !deletes.length) return;

  for (const client of clients.values()) {
    const clientUpserts = filterRowsForSection(upserts, client.section);
    const payload = {
      ...(clientUpserts.length ? { upserts: clientUpserts } : {}),
      ...(deletes.length ? { deletes } : {}),
    };
    if (!clientUpserts.length && !deletes.length) continue;
    if (!writeEvent(client, "patch", payload)) removeClient(client.id);
  }
}

function queuePatch({
  upserts = [],
  deletes = [],
}: {
  upserts?: SurveyRow[];
  deletes?: string[];
}) {
  for (const id of deletes) {
    pendingUpserts.delete(id);
    pendingDeletes.add(id);
  }

  for (const row of upserts) {
    pendingDeletes.delete(row._id);
    pendingUpserts.set(row._id, row);
  }

  if (patchTimer || clients.size === 0 || snapshotPromise || !hasSnapshot) return;
  patchTimer = setTimeout(flushPendingPatch, PATCH_COALESCE_MS);
}

function handleSanityEvent(event: ListenEvent<RawSurveyRow>) {
  if (event.type !== "mutation") return;

  if (event.transition === "disappear") {
    rowsCache = rowsCache.filter((row) => row._id !== event.documentId);
    queuePatch({ deletes: [event.documentId] });
    return;
  }

  if (!event.result) {
    void ensureSnapshot().catch((error: unknown) => {
      console.error("[surveyResponseStream] snapshot refresh failed after mutation:", error);
      broadcastStreamError(error);
    });
    return;
  }

  const row = normalizeSurveyRow(event.result);
  rowsCache = upsertRow(rowsCache, row);
  queuePatch({ upserts: [row] });
}

function startSanityListener() {
  if (listenerSubscription || clients.size === 0) return;
  clearReconnectTimer();

  listenerSubscription = listenToSurveyResponses({
    onEvent: handleSanityEvent,
    onError: (error: unknown) => {
      console.error("[surveyResponseStream] Sanity listener failed:", error);
      listenerSubscription = null;
      broadcastStreamError(error);
      scheduleListenerRestart();
    },
  });
}

function stopSanityListenerIfIdle() {
  if (clients.size > 0) return;
  clearReconnectTimer();
  flushPendingPatch();
  listenerSubscription?.unsubscribe();
  listenerSubscription = null;
}

function removeClient(id: number) {
  const client = clients.get(id);
  if (!client) return;
  clearInterval(client.heartbeat);
  clients.delete(id);
  recordSseConnectionClosed(); // load-testing
  stopSanityListenerIfIdle();
}

export function openSurveyResponseStream({
  section,
  limit,
  res,
}: {
  section: string;
  limit: SurveyResponseLimit;
  res: Response;
}) {
  const id = nextClientId;
  nextClientId += 1;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client: StreamClient = {
    id,
    section,
    limit,
    res,
    heartbeat: setInterval(() => {
      if (!writeComment(client, "heartbeat")) removeClient(id);
    }, HEARTBEAT_MS),
  };

  clients.set(id, client);
  recordSseConnectionOpened(); // load-testing
  writeComment(client, "connected");

  const isFirstClient = clients.size === 1;
  if (!isFirstClient && (hasSnapshot || rowsCache.length > 0)) {
    sendCachedSnapshot(client, !snapshotPromise);
  }

  startSanityListener();
  if (!hasSnapshot || isFirstClient) {
    void ensureSnapshot().catch((error: unknown) => {
      console.error("[surveyResponseStream] initial snapshot failed:", error);
      sendStreamError(client, error);
    });
  }

  return () => {
    removeClient(id);
  };
}
