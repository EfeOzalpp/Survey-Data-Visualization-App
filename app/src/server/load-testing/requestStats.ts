// load-testing: in-memory counters for real Sanity calls, read via the
// debug route below to confirm concurrency assumptions (e.g. the SSE
// singleton .listen() subscription) during a k6 run.
const counts = {
  snapshotFetch: 0,
  listenSubscriptionOpened: 0,
  writeCreate: 0,
  writePatch: 0,
};

export type SanityRequestKind = keyof typeof counts;

export function recordSanityRequest(kind: SanityRequestKind) {
  counts[kind] += 1;
}

export function readSanityRequestStats() {
  return { ...counts };
}

export function resetSanityRequestStats() {
  for (const key of Object.keys(counts) as SanityRequestKind[]) counts[key] = 0;
}
