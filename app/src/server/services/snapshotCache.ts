import type { SurveyRow } from "../../domain/survey/types";
import type { ResponseStore, SurveyResponseLimit } from "./responseStore";

export function serializeSnapshotChunk(
  rows: SurveyRow[],
  {
    reset = false,
    complete = false,
  }: {
    reset?: boolean;
    complete?: boolean;
  } = {}
) {
  return JSON.stringify({ rows, reset, complete });
}

export class SnapshotCache {
  private readonly cachedBySelection = new Map<string, string[]>();

  constructor(
    private readonly store: ResponseStore,
    private readonly chunkSize: number
  ) {}

  clear() {
    this.cachedBySelection.clear();
  }

  get(
    section: string,
    limit: SurveyResponseLimit,
    completeWhenDone: boolean
  ) {
    const key = `${section}::${String(limit)}::${String(completeWhenDone)}`;
    const cached = this.cachedBySelection.get(key);
    if (cached) return cached;

    const chunks = this.buildChunks(
      this.store.select(section, limit),
      completeWhenDone
    );
    this.cachedBySelection.set(key, chunks);
    return chunks;
  }

  private buildChunks(rows: SurveyRow[], completeWhenDone: boolean) {
    if (!rows.length) {
      return [serializeSnapshotChunk([], { reset: true, complete: completeWhenDone })];
    }

    const chunks: string[] = [];
    for (let index = 0; index < rows.length; index += this.chunkSize) {
      const chunk = rows.slice(index, index + this.chunkSize);
      const complete = completeWhenDone && index + this.chunkSize >= rows.length;
      chunks.push(
        serializeSnapshotChunk(chunk, {
          reset: index === 0,
          complete,
        })
      );
    }
    return chunks;
  }
}
