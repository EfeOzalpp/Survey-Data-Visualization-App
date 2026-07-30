import type { SurveyRow } from "../../../domain/survey/types";
import { ResponseStore } from "../responseStore";
import { SnapshotCache } from "../snapshotCache";

interface SnapshotPayload {
  rows: SurveyRow[];
  reset: boolean;
  complete: boolean;
}

function row(_id: string, submittedAt: string, section = "visitor"): SurveyRow {
  return {
    _id,
    section,
    submittedAt,
  };
}

function parseSnapshot(value: string) {
  return JSON.parse(value) as SnapshotPayload;
}

describe("SnapshotCache", () => {
  test("chunks and reuses serialized snapshots for an equivalent selection", () => {
    const store = new ResponseStore();
    store.mergeSnapshotPage([
      row("three", "2026-01-03T00:00:00.000Z"),
      row("two", "2026-01-02T00:00:00.000Z"),
      row("one", "2026-01-01T00:00:00.000Z"),
    ]);
    const cache = new SnapshotCache(store, 2);

    const firstRead = cache.get("all", "all", true);
    const secondRead = cache.get("all", "all", true);

    expect(secondRead).toBe(firstRead);
    expect(firstRead.map(parseSnapshot)).toEqual([
      {
        rows: [
          row("three", "2026-01-03T00:00:00.000Z"),
          row("two", "2026-01-02T00:00:00.000Z"),
        ],
        reset: true,
        complete: false,
      },
      {
        rows: [row("one", "2026-01-01T00:00:00.000Z")],
        reset: false,
        complete: true,
      },
    ]);
  });

  test("separates cache keys and rebuilds them after invalidation", () => {
    const store = new ResponseStore();
    store.mergeSnapshotPage([
      row("visitor", "2026-01-02T00:00:00.000Z"),
      row("student", "2026-01-01T00:00:00.000Z", "animation"),
    ]);
    const cache = new SnapshotCache(store, 250);

    const visitors = cache.get("visitor", "all", true);
    const incomplete = cache.get("visitor", "all", false);
    expect(visitors).not.toBe(incomplete);
    expect(parseSnapshot(incomplete[0]).complete).toBe(false);

    store.upsert(row("new-visitor", "2026-01-03T00:00:00.000Z"));
    cache.clear();

    const refreshed = cache.get("visitor", "all", true);
    expect(refreshed).not.toBe(visitors);
    expect(parseSnapshot(refreshed[0]).rows).toHaveLength(2);
  });
});
