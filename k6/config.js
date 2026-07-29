// Shared constants for all k6 scripts. Override BASE_URL with:
//   k6 run -e BASE_URL=http://localhost:3000 k6/readers.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Real single-option weights from button-questions.ts (first option of each
// question) — the server only accepts values that are a valid subset-average
// of the real options, so these can't be arbitrary numbers.
export const VALID_WEIGHTS = {
  q1: 1.0,
  q2: 1.0,
  q3: 0.9,
  q4: 1.0,
  q5: 1.0,
};

export const VALID_SECTION = 'visitor';
