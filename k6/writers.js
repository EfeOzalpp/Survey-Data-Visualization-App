// Isolated writer smoke test — chained submit -> editToken -> solo-message,
// since saveSoloMessage requires a real JWT minted by saveUserResponse.
// Deliberately small (5 VUs, 5 iterations total) to prove correctness first.
// Run: k6 run -e WRITERS_VUS=50 -e WRITERS_ITERATIONS=50 k6/writers.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, VALID_SECTION, VALID_WEIGHTS } from './config.js';

const VUS = Number(__ENV.WRITERS_VUS || 5);
const ITERATIONS = Number(__ENV.WRITERS_ITERATIONS || VUS);
const MAX_DURATION = __ENV.WRITERS_MAX_DURATION || '90s';

export const options = {
  scenarios: {
    writers: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: MAX_DURATION,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.90'],
  },
};

export default function () {
  const submitPayload = JSON.stringify({
    section: VALID_SECTION,
    weights: VALID_WEIGHTS,
    website: '', // honeypot field — must stay empty
  });

  const submitRes = http.post(`${BASE_URL}/api/save-user-response`, submitPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const submitOk = check(submitRes, {
    'submit: status 200': (r) => r.status === 200,
    'submit: got editToken': (r) => {
      const body = r.json();
      return typeof body.editToken === 'string';
    },
  });

  if (!submitOk) return;

  const editToken = submitRes.json().editToken;
  sleep(0.5); // brief pause, roughly like a real visitor typing a message

  const messagePayload = JSON.stringify({
    editToken,
    message: 'k6 load test message',
  });

  const messageRes = http.post(`${BASE_URL}/api/save-solo-message`, messagePayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(messageRes, {
    'solo-message: status 200': (r) => r.status === 200,
  });
}
