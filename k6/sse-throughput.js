// SSE read-throughput test.
//
// One iteration opens an SSE connection, receives the complete initial load,
// closes the connection, and exits. A constant-arrival-rate executor starts a
// fixed number of these transactions every second, so successful iterations
// represent complete SSE reads delivered per second.
//
// Run with the custom xk6-sse binary, from the k6/ folder:
//   .\k6.exe run -e READS_PER_SECOND=100 -e DURATION_SECONDS=30 sse-throughput.js
import http from 'k6/http';
import sse from 'k6/x/sse';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, SSE_LIMIT } from './config.js';

function readPositiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; received ${String(__ENV[name])}`);
  }
  return value;
}

const READS_PER_SECOND = readPositiveInteger('READS_PER_SECOND', 100);
const DURATION_SECONDS = readPositiveInteger('DURATION_SECONDS', 30);
const PRE_ALLOCATED_VUS = readPositiveInteger(
  'PRE_ALLOCATED_VUS',
  READS_PER_SECOND * 2
);
const MAX_VUS = readPositiveInteger('MAX_VUS', PRE_ALLOCATED_VUS * 2);
const GRACEFUL_STOP_SECONDS = readPositiveInteger('GRACEFUL_STOP_SECONDS', 30);

if (MAX_VUS < PRE_ALLOCATED_VUS) {
  throw new Error(
    `MAX_VUS (${String(MAX_VUS)}) must be greater than or equal to ` +
      `PRE_ALLOCATED_VUS (${String(PRE_ALLOCATED_VUS)})`
  );
}

const EXPECTED_READS = READS_PER_SECOND * DURATION_SECONDS;

const readAttempts = new Counter('sse_read_attempts');
const connectionsOpened = new Counter('sse_throughput_connections_opened');
const completedReads = new Counter('sse_reads_completed');
const snapshotChunks = new Counter('sse_snapshot_chunks');
const rowsDelivered = new Counter('sse_rows_delivered');
const connectionErrors = new Counter('sse_throughput_connection_errors');
const invalidPayloads = new Counter('sse_invalid_snapshot_payloads');
const incompleteReads = new Counter('sse_incomplete_reads');
const readSuccess = new Rate('sse_read_success');
const timeToFirstSnapshot = new Trend('sse_throughput_time_to_first_snapshot', true);
const timeToCompleteSnapshot = new Trend('sse_throughput_time_to_complete_snapshot', true);

export const options = {
  scenarios: {
    sseThroughput: {
      executor: 'constant-arrival-rate',
      rate: READS_PER_SECOND,
      timeUnit: '1s',
      duration: `${String(DURATION_SECONDS)}s`,
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      gracefulStop: `${String(GRACEFUL_STOP_SECONDS)}s`,
    },
  },
  thresholds: {
    dropped_iterations: ['count==0'],
    sse_read_attempts: [`count>=${String(EXPECTED_READS)}`],
    sse_throughput_connections_opened: [`count>=${String(EXPECTED_READS)}`],
    sse_reads_completed: [`count>=${String(EXPECTED_READS)}`],
    sse_read_success: ['rate==1'],
    sse_throughput_connection_errors: ['count==0'],
    sse_invalid_snapshot_payloads: ['count==0'],
    sse_incomplete_reads: ['count==0'],
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
    `Requesting ${String(READS_PER_SECOND)} complete SSE reads/s for ` +
      `${String(DURATION_SECONDS)}s (${String(EXPECTED_READS)} minimum), ` +
      `snapshot limit=${String(SSE_LIMIT)}, preAllocatedVUs=${String(PRE_ALLOCATED_VUS)}, ` +
      `maxVUs=${String(MAX_VUS)}.`
  );
}

export default function () {
  const url = `${BASE_URL}/api/survey-responses/stream?limit=${encodeURIComponent(SSE_LIMIT)}`;
  const startedAt = Date.now();
  let opened = false;
  let receivedFirstSnapshot = false;
  let completed = false;
  let failed = false;
  let deliveredRows = 0;

  readAttempts.add(1);
  connectionErrors.add(0);
  invalidPayloads.add(0);
  incompleteReads.add(0);

  function recordConnectionError() {
    if (failed || completed) return;
    failed = true;
    connectionErrors.add(1);
  }

  try {
    sse.open(url, {}, function (client) {
      client.on('open', function () {
        if (opened) return;
        opened = true;
        connectionsOpened.add(1);
      });

      client.on('event', function (event) {
        if (event.name !== 'snapshot' || completed || failed) return;

        snapshotChunks.add(1);
        if (!receivedFirstSnapshot) {
          receivedFirstSnapshot = true;
          timeToFirstSnapshot.add(Date.now() - startedAt);
        }

        let snapshot;
        try {
          snapshot = JSON.parse(event.data);
        } catch {
          failed = true;
          invalidPayloads.add(1);
          client.close();
          return;
        }

        if (!Array.isArray(snapshot.rows)) {
          failed = true;
          invalidPayloads.add(1);
          client.close();
          return;
        }

        deliveredRows += snapshot.rows.length;
        if (snapshot.complete !== true) return;

        completed = true;
        completedReads.add(1);
        rowsDelivered.add(deliveredRows);
        timeToCompleteSnapshot.add(Date.now() - startedAt);
        client.close();
      });

      client.on('error', function () {
        recordConnectionError();
      });
    });
  } catch {
    recordConnectionError();
  }

  if (!completed) {
    incompleteReads.add(1);
  }
  readSuccess.add(completed);
}
