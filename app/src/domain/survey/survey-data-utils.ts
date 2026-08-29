// src/domain/survey/survey-data-utils.ts
// Pure survey row transforms - section counting and row upsert/remove,
// used by app-core/state/stores/survey-data-store.ts to keep that file about flow.
// Section filtering itself lives in sections.ts, shared with the backend.

import type { SurveyRow } from './types';
import { NON_VISITOR_MASSART, STAFF_IDS, STUDENT_IDS } from './sections';

export function deriveSectionCounts(allRows: SurveyRow[]): Record<string, number> {
  const bySection: Record<string, number> = {};
  for (const row of allRows) {
    const key = row.section || '';
    bySection[key] = (bySection[key] || 0) + 1;
  }

  const sum = (ids: string[]) => ids.reduce((acc, id) => acc + (bySection[id] || 0), 0);

  return {
    all: allRows.length,
    'all-massart': sum(NON_VISITOR_MASSART),
    'all-students': sum(STUDENT_IDS),
    'all-staff': sum(STAFF_IDS),
    visitor: bySection.visitor || 0,
    ...bySection,
  };
}

function newestTimestampOf(row: SurveyRow) {
  const ts = Date.parse(row.submittedAt);
  return Number.isFinite(ts) ? ts : 0;
}

export function upsertSurveyRow(
  allRows: SurveyRow[],
  nextRow: SurveyRow,
  replaceId?: string
) {
  const filtered = allRows.filter((row) =>
    row._id !== nextRow._id && (!replaceId || row._id !== replaceId)
  );
  return [nextRow, ...filtered].sort((a, b) => newestTimestampOf(b) - newestTimestampOf(a));
}

export function removeSurveyRow(allRows: SurveyRow[], id: string) {
  return allRows.filter((row) => row._id !== id);
}
