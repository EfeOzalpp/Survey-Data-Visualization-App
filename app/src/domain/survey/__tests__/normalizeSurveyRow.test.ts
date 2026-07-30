import { normalizeSurveyRow } from "../normalizeSurveyRow";
import type { RawSurveyRow } from "../types";

const baseRow: RawSurveyRow = {
  _id: "abc123",
  section: "fine-arts",
  q1: 0.6667,
  q2: 0.3333,
  q3: undefined,
  q4: 1.0,
  q5: 0.0,
  avgWeight: 0.5555,
  submittedAt: "2025-01-01T00:00:00Z",
  _createdAt: "2025-01-01T00:00:00Z",
};

describe("normalizeSurveyRow", () => {
  test("rounds values to 3 decimal places", () => {
    const result = normalizeSurveyRow(baseRow);
    expect(result.q1).toBe(0.667);
    expect(result.q2).toBe(0.333);
    expect(result.avgWeight).toBe(0.556);
  });

  test("undefined q values stay undefined in output", () => {
    const result = normalizeSurveyRow(baseRow);
    expect(result.q3).toBeUndefined();
  });

  test("missing section defaults to empty string", () => {
    const result = normalizeSurveyRow({ ...baseRow, section: undefined });
    expect(result.section).toBe("");
  });

  test("submittedAt falls back to _createdAt when missing", () => {
    const result = normalizeSurveyRow({ ...baseRow, submittedAt: undefined });
    expect(result.submittedAt).toBe(baseRow._createdAt);
  });

  test("preserves _id", () => {
    const result = normalizeSurveyRow(baseRow);
    expect(result._id).toBe("abc123");
  });
});
