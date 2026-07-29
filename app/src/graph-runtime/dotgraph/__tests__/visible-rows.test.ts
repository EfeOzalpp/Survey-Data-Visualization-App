import type { SurveyRow } from "../../../domain/survey/types";
import {
  buildVisibleRowsSnapshot,
  graphDataLimit,
  MAX_GRAPH_SPRITES,
  MOBILE_DATA_LIMIT,
} from "../visible-rows";

const makeRow = (id: string, submittedAt: string): SurveyRow => ({
  _id: id,
  section: "design",
  q1: 0.5,
  q2: 0.5,
  q3: 0.5,
  q4: 0.5,
  q5: 0.5,
  avgWeight: 0.5,
  submittedAt,
});

describe("graphDataLimit", () => {
  test("uses the shared desktop and mobile graph caps", () => {
    expect(graphDataLimit(false)).toBe(MAX_GRAPH_SPRITES);
    expect(graphDataLimit(true)).toBe(MOBILE_DATA_LIMIT);
  });
});

describe("buildVisibleRowsSnapshot", () => {
  test("keeps newest rows at capacity and drops the oldest visible row", () => {
    const oldest = makeRow("oldest", "2026-01-01T00:00:00.000Z");
    const middle = makeRow("middle", "2026-01-02T00:00:00.000Z");
    const newest = makeRow("newest", "2026-01-03T00:00:00.000Z");
    const nextNewest = makeRow("next-newest", "2026-01-04T00:00:00.000Z");
    const initialRows = [newest, middle, oldest];
    const nextRows = [nextNewest, newest, middle, oldest];

    const initial = buildVisibleRowsSnapshot(initialRows, 3, "all", null);
    const next = buildVisibleRowsSnapshot(nextRows, 3, "all", initial);

    expect(next.rows.map((row) => row._id)).toEqual([
      "next-newest",
      "newest",
      "middle",
    ]);
    expect(next.rows.some((row) => row._id === "oldest")).toBe(false);
    expect(new Set(next.rows.map((row) => row.__dotSlotIndex)).size).toBe(3);
  });
});
