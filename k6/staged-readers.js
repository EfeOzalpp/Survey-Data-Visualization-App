// Accumulating SSE concurrency ceiling test.
//
// A new wave of WAVE_VUS readers starts every WAVE_INTERVAL seconds. Earlier
// waves remain connected, so concurrency rises by WAVE_VUS at every step.
// Every wave ends at the same absolute time, after the final wave has held the
// requested peak for PEAK_HOLD seconds.
//
// Defaults:
//   t=0s      100 concurrent readers
//   t=10s     200
//   ...
//   t=490s    5,000
//   t=490-550s hold 5,000, then close all connections
//
// Run with the custom xk6-sse binary, from the k6/ folder:
//   .\k6.exe run staged-readers.js
//
// Smaller smoke run:
//   .\k6.exe run -e WAVE_VUS=10 -e WAVE_COUNT=3 -e WAVE_INTERVAL=2 -e PEAK_HOLD=5 staged-readers.js
import http from 'k6/http';
import sse from 'k6/x/sse';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, SSE_LIMIT } from './config.js';

function readPositiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer; received ${String(__ENV[name])}`);
  }
  return value;
}

const WAVE_VUS = readPositiveInteger('WAVE_VUS', 100);
const WAVE_COUNT = readPositiveInteger('WAVE_COUNT', 50);
const WAVE_INTERVAL_SECONDS = readPositiveInteger('WAVE_INTERVAL', 10);
const PEAK_HOLD_SECONDS = readPositiveInteger('PEAK_HOLD', 60);
const RETRY_DELAY_SECONDS = 1;
const SCHEDULE_END_TOLERANCE_MS = 250;

const EXPECTED_PEAK = WAVE_VUS * WAVE_COUNT;
const LAST_WAVE_START_SECONDS = (WAVE_COUNT - 1) * WAVE_INTERVAL_SECONDS;
const COMMON_END_SECONDS = LAST_WAVE_START_SECONDS + PEAK_HOLD_SECONDS;

const connectionsOpened = new Counter('sse_connections_opened');
const firstSnapshots = new Counter('sse_first_snapshots');
const completeSnapshots = new Counter('sse_complete_snapshots');
const connectionErrors = new Counter('sse_connection_errors');
const earlyDisconnects = new Counter('sse_early_disconnects');
const timeToFirstSnapshot = new Trend('sse_time_to_first_snapshot', true);
const timeToCompleteSnapshot = new Trend('sse_time_to_complete_snapshot', true);

const scenarios = {};
for (let i = 0; i < WAVE_COUNT; i += 1) {
  const startSeconds = i * WAVE_INTERVAL_SECONDS;

  scenarios[`wave${i}`] = {
    executor: 'constant-vus',
    vus: WAVE_VUS,
    startTime: `${startSeconds}s`,
    duration: `${COMMON_END_SECONDS - startSeconds}s`,
    // SSE iterations intentionally never finish. Without this, k6's default
    // 30-second grace period would extend the requested peak hold.
    gracefulStop: '0s',
    tags: { wave: String(i) },
  };
}

export const options = {
  scenarios,
  thresholds: {
    // Exact counts ensure an early disconnect followed by a successful
    // constant-vus replacement cannot look like a healthy run.
    sse_connections_opened: [`count==${String(EXPECTED_PEAK)}`],
    sse_first_snapshots: [`count==${String(EXPECTED_PEAK)}`],
    sse_complete_snapshots: [`count==${String(EXPECTED_PEAK)}`],
    sse_connection_errors: ['count==0'],
    sse_early_disconnects: ['count==0'],
  },
};

export function setup() {
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  const healthy = check(healthResponse, {
    'server health check passed': (response) => response.status === 200 && response.json('ok') === true,
  });
  if (!healthy) {
    throw new Error(`Server health check failed at ${BASE_URL}`);
  }

  const resetResponse = http.post(`${BASE_URL}/api/debug/load-test-stats/reset`, null);
  const reset = check(resetResponse, {
    'load-test statistics reset': (response) => response.status === 200,
  });
  if (!reset) {
    throw new Error(
      'Could not reset load-test statistics. Confirm the container is running with LOAD_TEST_MODE=true.'
    );
  }

  const baselineConnections = Number(resetResponse.json('sse.current')) || 0;
  const expectedServerPeak = baselineConnections + EXPECTED_PEAK;

  console.log(
    `Accumulating ${String(WAVE_VUS)} readers every ${String(WAVE_INTERVAL_SECONDS)}s: ` +
      `${String(EXPECTED_PEAK)} expected peak, ${String(PEAK_HOLD_SECONDS)}s peak hold, ` +
      `${String(COMMON_END_SECONDS)}s scheduled runtime, ` +
      `${String(baselineConnections)} pre-existing server connections, ` +
      `snapshot limit=${String(SSE_LIMIT)}.`
  );

  return {
    expectedK6Peak: EXPECTED_PEAK,
    expectedServerPeak,
    baselineConnections,
  };
}

export default function () {
  const url = `${BASE_URL}/api/survey-responses/stream?limit=${encodeURIComponent(SSE_LIMIT)}`;
  const startedAt = Date.now();
  const waveIndex = Number(exec.scenario.name.slice('wave'.length));
  const scenarioDurationSeconds =
    COMMON_END_SECONDS - waveIndex * WAVE_INTERVAL_SECONDS;
  const scenarioEndAt =
    exec.scenario.startTime + scenarioDurationSeconds * 1000;
  let connectionOpened = false;
  let gotSnapshot = false;
  let completedSnapshot = false;

  // Emit zero-valued samples so zero-error thresholds are evaluated even when
  // the healthy path never increments these counters.
  connectionErrors.add(0);
  earlyDisconnects.add(0);

  try {
    sse.open(url, {}, function (client) {
      client.on('open', function () {
        if (connectionOpened) return;
        connectionOpened = true;
        connectionsOpened.add(1);
      });

      client.on('event', function (event) {
        if (event.name !== 'snapshot') return;

        if (!gotSnapshot) {
          gotSnapshot = true;
          firstSnapshots.add(1);
          timeToFirstSnapshot.add(Date.now() - startedAt);
        }

        if (completedSnapshot) return;
        try {
          const snapshot = JSON.parse(event.data);
          if (snapshot.complete === true) {
            completedSnapshot = true;
            completeSnapshots.add(1);
            timeToCompleteSnapshot.add(Date.now() - startedAt);
          }
        } catch {
          connectionErrors.add(1);
        }
      });

      client.on('error', function () {
        connectionErrors.add(1);
      });

      // Deliberately do not call client.close(). k6 interrupts every wave at
      // the shared end time, keeping all successful readers accumulated.
    });
  } catch {
    connectionErrors.add(1);
  }

  // xk6-sse returns control to JavaScript when k6 cancels a connection at the
  // scenario deadline. Count only returns that happen materially before that
  // deadline; scheduled shutdown is not an early disconnect.
  if (
    connectionOpened &&
    Date.now() < scenarioEndAt - SCHEDULE_END_TOLERANCE_MS
  ) {
    earlyDisconnects.add(1);
  }

  // Pause before constant-vus either retries a genuine early disconnect or
  // finishes cancelling a connection at the scheduled scenario deadline.
  sleep(RETRY_DELAY_SECONDS);
}

export function teardown(data) {
  // Allow Node's close handlers to settle before reading final counters.
  sleep(1);

  const statsResponse = http.get(`${BASE_URL}/api/debug/load-test-stats`);
  const statsAvailable = check(statsResponse, {
    'final load-test statistics available': (response) => response.status === 200,
  });
  if (!statsAvailable) return;

  const peakConcurrent = Number(statsResponse.json('sse.peakConcurrent'));
  check(peakConcurrent, {
    'server reached expected SSE concurrency peak': (peak) => peak >= data.expectedServerPeak,
  });

  console.log(
    `Server SSE stats: expectedK6Peak=${String(data.expectedK6Peak)}, ` +
      `baselineConnections=${String(data.baselineConnections)}, ` +
      `expectedServerPeak=${String(data.expectedServerPeak)}, ` +
      `peakConcurrent=${String(peakConcurrent)}, ` +
      `totalOpened=${String(statsResponse.json('sse.totalOpened'))}, ` +
      `current=${String(statsResponse.json('sse.current'))}`
  );
}
