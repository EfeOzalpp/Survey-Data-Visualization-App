import {
  deriveSectionCounts,
  removeSurveyRow,
  upsertSurveyRow,
} from "../survey-data-utils";
import type { SurveyRow } from "../types";

const makeRow = (section: string): SurveyRow => ({
  _id: `${section}-id`,
  section,
  q1: 0.5, q2: 0.5, q3: 0.5, q4: 0.5, q5: 0.5,
  avgWeight: 0.5,
  submittedAt: "2025-01-01",
});

const rows: SurveyRow[] = [
  makeRow("design"),
  makeRow("design"),
  makeRow("fine-arts"),
  makeRow("visitor"),
];

describe("deriveSectionCounts", () => {
  test("'all' count equals total rows", () => {
    const counts = deriveSectionCounts(rows);
    expect(counts.all).toBe(4);
  });

  test("counts per section are correct", () => {
    const counts = deriveSectionCounts(rows);
    expect(counts.design).toBe(2);
    expect(counts["fine-arts"]).toBe(1);
    expect(counts.visitor).toBe(1);
  });

  test("empty array produces zero counts", () => {
    const counts = deriveSectionCounts([]);
    expect(counts.all).toBe(0);
    expect(counts.visitor).toBe(0);
  });
});

describe("survey row mutations", () => {
  test("upsert replaces an optimistic row with the persisted row", () => {
    const optimistic = { ...makeRow("design"), _id: "pending-1" };
    const persisted = { ...makeRow("design"), _id: "persisted-1" };

    expect(upsertSurveyRow([optimistic], persisted, optimistic._id)).toEqual([
      persisted,
    ]);
  });

  test("remove deletes a failed optimistic row", () => {
    const optimistic = { ...makeRow("design"), _id: "pending-1" };
    const persisted = { ...makeRow("visitor"), _id: "persisted-1" };

    expect(removeSurveyRow([optimistic, persisted], optimistic._id)).toEqual([
      persisted,
    ]);
  });
});
