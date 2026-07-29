// src/domain/survey/normalizeSurveyRow.ts

import type { RawSurveyRow, SurveyRow } from "./types";

const round3 = (v?: number) =>
  typeof v === 'number' ? Math.round(v * 1000) / 1000 : undefined;

export function normalizeSurveyRow(row: RawSurveyRow): SurveyRow {
  const q1 = round3(row.q1);
  const q2 = round3(row.q2);
  const q3 = round3(row.q3);
  const q4 = round3(row.q4);
  const q5 = round3(row.q5);
  const avgWeight = round3(row.avgWeight);
  const fallbackDate = row.submittedAt ?? row._createdAt ?? '';

  return {
    _id: row._id,
    section: row.section ?? '',
    q1,
    q2,
    q3,
    q4,
    q5,
    avgWeight,
    soloMessage: row.soloMessage,
    submittedAt: fallbackDate,
  };
}
