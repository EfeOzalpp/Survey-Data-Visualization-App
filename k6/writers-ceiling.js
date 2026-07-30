// Survey-create burst ceiling test.
//
// All VUs are released together through a shared-iterations executor. Each
// iteration performs one real POST /api/save-user-response request, which
// creates one document in the configured Sanity dataset.
//
// Run from the k6 folder:
//   .\run-writers-ceiling.ps1 -Vus 25
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, VALID_SECTION, VALID_WEIGHTS } from './config.js';

function readPositiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; received ${String(__ENV[name])}`);
  }
  return value;
}

const VUS = readPositiveInteger('WRITERS_VUS', 25);
const ITERATIONS = readPositiveInteger('WRITERS_ITERATIONS', VUS);
const MAX_DURATION_SECONDS = readPositiveInteger('WRITERS_MAX_DURATION_SECONDS', 90);

const createAttempts = new Counter('writer_create_attempts');
const createsCompleted = new Counter('writer_creates_completed');
const createFailures = new Counter('writer_create_failures');
const rateLimitedResponses = new Counter('writer_create_http_429');
const serverErrorResponses = new Counter('writer_create_http_5xx');
const createSuccess = new Rate('writer_create_success');
const createDuration = new Trend('writer_create_duration', true);

export const options = {
  scenarios: {
    writerCeiling: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: `${String(MAX_DURATION_SECONDS)}s`,
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    writer_create_attempts: [`count==${String(ITERATIONS)}`],
    writer_creates_completed: [`count==${String(ITERATIONS)}`],
    writer_create_success: ['rate==1'],
    writer_create_failures: ['count==0'],
    writer_create_http_429: ['count==0'],
    writer_create_http_5xx: ['count==0'],
  },
};

export function setup() {
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  const healthy = check(healthResponse, {
    'server health check passed': (response) =>
      response.status === 200 && response.json('ok') === true,
  });
  if (!healthy) {
    throw new Error(`Server health check failed at ${BASE_URL}`);
  }

  console.log(
    `Releasing ${String(ITERATIONS)} survey creates across ${String(VUS)} VUs. ` +
      'This test creates real documents; use LOAD_TEST_MODE=true and the disposable load-test dataset.'
  );
}

export default function () {
  createAttempts.add(1);
  createFailures.add(0);
  rateLimitedResponses.add(0);
  serverErrorResponses.add(0);

  const payload = JSON.stringify({
    section: VALID_SECTION,
    weights: VALID_WEIGHTS,
    website: '',
  });

  const startedAt = Date.now();
  const response = http.post(`${BASE_URL}/api/save-user-response`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/save-user-response' },
  });
  createDuration.add(Date.now() - startedAt);

  let validBody = false;
  if (response.status === 200) {
    try {
      const body = response.json();
      validBody =
        typeof body._id === 'string' &&
        typeof body.editToken === 'string';
    } catch {
      validBody = false;
    }
  }

  const succeeded = response.status === 200 && validBody;
  createSuccess.add(succeeded);

  if (succeeded) {
    createsCompleted.add(1);
    return;
  }

  createFailures.add(1);
  if (response.status === 429) rateLimitedResponses.add(1);
  if (response.status >= 500) serverErrorResponses.add(1);
}
