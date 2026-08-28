import type { SurveyRow } from "../../../domain/survey/types";
import { ResponseStore } from "../responseStore";

function row(
  _id: string,
  submittedAt: string,
  section = "visitor"
): SurveyRow {
  return {
    _id,
    section,
    submittedAt,
  };
}

describe("ResponseStore", () => {
  test("merges snapshot pages and returns rows newest-first", () => {
    const store = new ResponseStore();

    store.mergeSnapshotPage([
      row("older", "2026-01-01T00:00:00.000Z"),
      row("newer", "2026-01-03T00:00:00.000Z"),
    ]);
    store.mergeSnapshotPage([
      row("middle", "2026-01-02T00:00:00.000Z"),
      row("older", "2026-01-01T00:00:00.000Z"),
    ]);

    expect(store.select("all", "all").map((item) => item._id)).toEqual([
      "newer",
      "middle",
      "older",
    ]);
  });

  test("upserts, deletes, filters, and limits rows", () => {
    const store = new ResponseStore();
    store.mergeSnapshotPage([
      row("visitor", "2026-01-01T00:00:00.000Z"),
      row("student", "2026-01-02T00:00:00.000Z", "animation"),
    ]);

    store.upsert(row("visitor", "2026-01-03T00:00:00.000Z"));

    expect(store.select("all", 1).map((item) => item._id)).toEqual(["visitor"]);
    expect(store.select("all-students", "all").map((item) => item._id)).toEqual([
      "student",
    ]);

    store.delete("student");
    expect(store.select("all", "all").map((item) => item._id)).toEqual([
      "visitor",
    ]);
  });

  test("tracks complete snapshot state separately from cached rows", () => {
    const store = new ResponseStore();
    store.mergeSnapshotPage([row("row", "2026-01-01T00:00:00.000Z")]);

    expect(store.hasRows).toBe(true);
    expect(store.hasCompleteSnapshot).toBe(false);

    store.markSnapshotComplete();
    expect(store.hasCompleteSnapshot).toBe(true);

    store.resetSnapshot();
    expect(store.hasRows).toBe(false);
    expect(store.hasCompleteSnapshot).toBe(false);
  });
});
