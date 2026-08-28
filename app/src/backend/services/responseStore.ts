import { filterRowsForSection } from "../../domain/survey/sections";
import type { SurveyRow } from "../../domain/survey/types";

export type SurveyResponseLimit = number | "all";

function newestTimestampOf(row: SurveyRow) {
  const timestamp = Date.parse(row.submittedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareNewestFirst(a: SurveyRow, b: SurveyRow) {
  const timeDelta = newestTimestampOf(b) - newestTimestampOf(a);
  return timeDelta !== 0 ? timeDelta : b._id.localeCompare(a._id);
}

function sortNewestFirst(rows: SurveyRow[]) {
  return [...rows].sort(compareNewestFirst);
}

function insertNewestFirst(rows: SurveyRow[], row: SurveyRow) {
  const withoutExisting = rows.filter((item) => item._id !== row._id);

  let low = 0;
  let high = withoutExisting.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compareNewestFirst(withoutExisting[mid], row) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  withoutExisting.splice(low, 0, row);
  return withoutExisting;
}

export class ResponseStore {
  private rows: SurveyRow[] = [];
  private snapshotComplete = false;

  get hasRows() {
    return this.rows.length > 0;
  }

  get hasCompleteSnapshot() {
    return this.snapshotComplete;
  }

  resetSnapshot() {
    this.rows = [];
    this.snapshotComplete = false;
  }

  mergeSnapshotPage(nextRows: SurveyRow[]) {
    const rowsById = new Map(this.rows.map((row) => [row._id, row]));
    for (const row of nextRows) rowsById.set(row._id, row);
    this.rows = sortNewestFirst([...rowsById.values()]);
  }

  markSnapshotComplete() {
    this.snapshotComplete = true;
  }

  upsert(row: SurveyRow) {
    this.rows = insertNewestFirst(this.rows, row);
  }

  delete(id: string) {
    this.rows = this.rows.filter((row) => row._id !== id);
  }

  select(section: string, limit: SurveyResponseLimit) {
    const matchingRows = filterRowsForSection(this.rows, section);
    return limit === "all" ? matchingRows : matchingRows.slice(0, limit);
  }
}
