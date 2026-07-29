import { filterRowsForSection, deriveSectionCounts } from "../survey-data-utils";
import type { SurveyRow } from "../../../domain/survey/types";

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

describe("filterRowsForSection", () => {
  test("'all' returns all rows", () => {
    expect(filterRowsForSection(rows, "all")).toHaveLength(4);
  });

  test("empty string returns all rows", () => {
    expect(filterRowsForSection(rows, "")).toHaveLength(4);
  });

  test("specific section filters correctly", () => {
    const result = filterRowsForSection(rows, "design");
    expect(result).toHaveLength(2);
    result.forEach((r) => {
      expect(r.section).toBe("design");
    });
  });

  test("unknown section returns empty array", () => {
    expect(filterRowsForSection(rows, "nonexistent")).toHaveLength(0);
  });
});

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
