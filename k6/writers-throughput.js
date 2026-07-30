// Survey-create throughput test.
//
// A constant-arrival-rate executor schedules a fixed number of real
// POST /api/save-user-response requests each second. A successful iteration
// represents one persisted survey document and one returned edit token.
//
// Run from the k6 folder:
//   .\run-writers-throughput.ps1 -WritesPerSecond 20
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

const WRITES_PER_SECOND = readPositiveInteger('WRITES_PER_SECOND', 20);
const DURATION_SECONDS = readPositiveInteger('DURATION_SECONDS', 30);
const PRE_ALLOCATED_VUS = readPositiveInteger(
  'PRE_ALLOCATED_VUS',
  WRITES_PER_SECOND * 2
);
const MAX_VUS = readPositiveInteger('MAX_VUS', PRE_ALLOCATED_VUS * 2);
const GRACEFUL_STOP_SECONDS = readPositiveInteger('GRACEFUL_STOP_SECONDS', 30);

if (MAX_VUS < PRE_ALLOCATED_VUS) {
  throw new Error(
    `MAX_VUS (${String(MAX_VUS)}) must be greater than or equal to ` +
      `PRE_ALLOCATED_VUS (${String(PRE_ALLOCATED_VUS)})`
  );
}

const EXPECTED_WRITES = WRITES_PER_SECOND * DURATION_SECONDS;

const createAttempts = new Counter('writer_create_attempts');
const createsCompleted = new Counter('writer_creates_completed');
const createFailures = new Counter('writer_create_failures');
const rateLimitedResponses = new Counter('writer_create_http_429');
const serverErrorResponses = new Counter('writer_create_http_5xx');
const createSuccess = new Rate('writer_create_success');
const createDuration = new Trend('writer_create_duration', true);

export const options = {
  scenarios: {
    writerThroughput: {
      executor: 'constant-arrival-rate',
      rate: WRITES_PER_SECOND,
      timeUnit: '1s',
      duration: `${String(DURATION_SECONDS)}s`,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: `${String(GRACEFUL_STOP_SECONDS)}s`,
    },
  },
  thresholds: {
    dropped_iterations: ['count==0'],
    http_req_failed: ['rate==0'],
    writer_create_attempts: [`count>=${String(EXPECTED_WRITES)}`],
    writer_creates_completed: [`count>=${String(EXPECTED_WRITES)}`],
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
    `Requesting ${String(WRITES_PER_SECOND)} survey creates/s for ` +
      `${String(DURATION_SECONDS)}s (${String(EXPECTED_WRITES)} minimum), ` +
      `preAllocatedVUs=${String(PRE_ALLOCATED_VUS)}, maxVUs=${String(MAX_VUS)}. ` +
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
