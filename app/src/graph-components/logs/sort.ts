import type { SurveyRow } from "../domain/survey/types";
import type { SortKey } from "./constants";

export function rowSubmittedTime(row: Pick<SurveyRow, "submittedAt">): number {
  const timestamp = Date.parse(row.submittedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortRows(data: SurveyRow[], sortBy: SortKey): SurveyRow[] {
  const byTime = (a: SurveyRow, b: SurveyRow) => {
    const da = rowSubmittedTime(a);
    const db = rowSubmittedTime(b);
    if (da !== db) return db - da;
    return b._id.localeCompare(a._id);
  };

  switch (sortBy) {
    case "average":
    case "rank":
      return [...data].sort((a, b) => (b.avgWeight ?? 0) - (a.avgWeight ?? 0));
    case "q1":
      return [...data].sort((a, b) => (b.q1 ?? 0) - (a.q1 ?? 0));
    case "q2":
      return [...data].sort((a, b) => (b.q2 ?? 0) - (a.q2 ?? 0));
    case "q3":
      return [...data].sort((a, b) => (b.q3 ?? 0) - (a.q3 ?? 0));
    case "q4":
      return [...data].sort((a, b) => (b.q4 ?? 0) - (a.q4 ?? 0));
    case "q5":
      return [...data].sort((a, b) => (b.q5 ?? 0) - (a.q5 ?? 0));
    default:
      return [...data].sort(byTime);
  }
}

export function computeRankById(sorted: SurveyRow[]): Map<string, number> {
  const byAvg = [...sorted].sort((a, b) => (b.avgWeight ?? 0) - (a.avgWeight ?? 0));
  const map = new Map<string, number>();
  byAvg.forEach((row, i) => map.set(row._id, i + 1));
  return map;
}
