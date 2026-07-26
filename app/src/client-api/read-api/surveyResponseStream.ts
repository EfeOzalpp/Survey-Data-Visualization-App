// src/client-api/read-api/api.ts
// Survey reads through the same-origin backend SSE stream, with mock-data fallback when reads are unavailable.

import {
  enableMockReadFallback,
  shouldUseMockReads,
} from './config';
import { subscribeMockSurveyData } from '../mock-survey-data/mockData';
import type { SurveyRow, Unsubscribe } from '../../domain/survey/types';

interface SubscribeSurveyDataArgs {
  section: string;
  limit?: number | 'all';
  onData: (rows: SurveyRow[]) => void;
}

interface SurveyResponsesSnapshotEvent {
  rows?: unknown;
  reset?: unknown;
  complete?: unknown;
}

interface SurveyResponsesPatchEvent {
  upserts?: unknown;
  deletes?: unknown;
}

function isSurveyRows(value: unknown): value is SurveyRow[] {
  return Array.isArray(value) && value.every((row) => {
    if (!row || typeof row !== 'object') return false;
    const record = row as Record<string, unknown>;
    return typeof record._id === 'string' && typeof record.section === 'string';
  });
}

function readRowsFromEvent(event: MessageEvent) {
  const body = JSON.parse(event.data as string) as SurveyResponsesSnapshotEvent;
  if (!isSurveyRows(body.rows)) {
    throw new Error('Survey stream returned invalid rows');
  }
  return {
    rows: body.rows,
    reset: body.reset === true,
    complete: body.complete === true,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readPatchFromEvent(event: MessageEvent) {
  const body = JSON.parse(event.data as string) as SurveyResponsesPatchEvent;
  const upserts = body.upserts === undefined ? [] : body.upserts;
  const deletes = body.deletes === undefined ? [] : body.deletes;

  if (!isSurveyRows(upserts) || !isStringArray(deletes)) {
    throw new Error('Survey stream returned an invalid patch');
  }

  return { upserts, deletes };
}

function rowTimestamp(row: SurveyRow) {
  const raw = row.submittedAt ?? row._createdAt;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortNewestFirst(rows: SurveyRow[]) {
  return [...rows].sort((a, b) => {
    const timeDelta = rowTimestamp(b) - rowTimestamp(a);
    return timeDelta !== 0 ? timeDelta : b._id.localeCompare(a._id);
  });
}

function mergeRows(rows: SurveyRow[], nextRows: SurveyRow[]) {
  const byId = new Map(rows.map((row) => [row._id, row]));
  for (const row of nextRows) byId.set(row._id, row);
  return sortNewestFirst([...byId.values()]);
}

function applyPatch(
  rows: SurveyRow[],
  {
    upserts,
    deletes,
  }: {
    upserts: SurveyRow[];
    deletes: string[];
  }
) {
  const deleteIds = new Set(deletes);
  return mergeRows(
    rows.filter((row) => !deleteIds.has(row._id)),
    upserts
  );
}

function rowsWithinLimit(rows: SurveyRow[], limit: number | 'all') {
  return limit === 'all' ? rows : rows.slice(0, limit);
}

function streamUrl(section: string, limit: number | 'all') {
  const url = new URL('/api/survey-responses/stream', window.location.origin);
  url.searchParams.set('section', section);
  url.searchParams.set('limit', String(limit));
  return url;
}

export function subscribeSurveyData({
  section,
  limit = 300,
  onData,
}: SubscribeSurveyDataArgs): Unsubscribe {
  if (shouldUseMockReads()) {
    return subscribeMockSurveyData({ section, limit, onData });
  }

  let closed = false;
  let mockUnsub: Unsubscribe | null = null;
  let source: EventSource | null = new EventSource(streamUrl(section, limit));
  let rows: SurveyRow[] = [];

  const emitRows = () => {
    onData(rowsWithinLimit(rows, limit));
  };

  const switchToMock = (error: unknown) => {
    if (closed || mockUnsub) return;
    source?.close();
    source = null;
    enableMockReadFallback(error);
    mockUnsub = subscribeMockSurveyData({ section, limit, onData });
  };

  source.addEventListener('snapshot', (event) => {
    if (closed || mockUnsub) return;
    try {
      const snapshot = readRowsFromEvent(event);
      rows = mergeRows(snapshot.reset ? [] : rows, snapshot.rows);
      emitRows();
    } catch (error) {
      switchToMock(error);
    }
  });

  source.addEventListener('patch', (event) => {
    if (closed || mockUnsub) return;
    try {
      rows = applyPatch(rows, readPatchFromEvent(event));
      emitRows();
    } catch (error) {
      switchToMock(error);
    }
  });

  source.addEventListener('stream-error', (event) => {
    if (closed || mockUnsub) return;
    switchToMock(new Error(event.data as string));
  });

  source.onerror = (error) => {
    if (closed || mockUnsub) return;
    console.error('[read-api] survey response stream', error);
  };

  return () => {
    closed = true;
    source?.close();
    mockUnsub?.();
  };
}
