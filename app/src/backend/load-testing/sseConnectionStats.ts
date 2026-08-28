// load-testing: tracks SSE connection concurrency for the survey-response
// stream, so a k6 readers scenario can confirm how many connections the
// server actually held open, not just how many k6 attempted.
let totalOpened = 0;
let current = 0;
let peakConcurrent = 0;

export function recordSseConnectionOpened() {
  totalOpened += 1;
  current += 1;
  peakConcurrent = Math.max(peakConcurrent, current);
}

export function recordSseConnectionClosed() {
  current = Math.max(0, current - 1);
}

export function readSseConnectionStats() {
  return { totalOpened, current, peakConcurrent };
}

export function resetSseConnectionStats() {
  totalOpened = 0;
  // Baseline peak to whatever's already live, not 0 — connections open
  // before the reset shouldn't make the next window's peak read as 0.
  peakConcurrent = current;
}
