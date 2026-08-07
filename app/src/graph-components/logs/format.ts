import type { SurveyRow } from "../../domain/survey/types";
import { SECTION_DISPLAY } from "./constants";

export function fmt(v?: number): string {
  return v != null ? `${String(Math.round(v * 100))}%` : "--";
}

export function fmtQuestionScore(v?: number): string {
  return v != null ? String(Math.round(v * 100)) : "--";
}

export function fmtQs(row: Pick<SurveyRow, "q1" | "q2" | "q3" | "q4" | "q5">): string {
  return [row.q1, row.q2, row.q3, row.q4, row.q5].map(fmtQuestionScore).join(", ");
}

export function capitalizeFirstWord(value: string): string {
  return value.replace(/^(\s*)(\p{L})/u, (_match, leading: string, firstLetter: string) =>
    `${leading}${firstLetter.toLocaleUpperCase()}`
  );
}

export function formatSectionLabel(section?: string): string {
  const s = section ?? "";
  return SECTION_DISPLAY[s] ?? capitalizeFirstWord(s.replace(/-/g, " "));
}
