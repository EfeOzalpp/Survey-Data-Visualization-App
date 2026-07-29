// Isolated SSE-reader test using a real SSE client (k6/x/sse, via a custom
// xk6-built binary — stock k6 has no SSE support at all, and needs
// `xk6 build v1.6.1 --with github.com/phymbert/xk6-sse@latest` first; see
// k6/sse-extension-check.js for how that was verified).
//
// Run with the custom binary, from the k6/ folder:
//   .\k6.exe run -e READERS_VUS=150 -e READERS_DURATION=60s readers.js
import sse from 'k6/x/sse';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, SSE_LIMIT } from './config.js';

const VUS = Number(__ENV.READERS_VUS || 10);
const DURATION = __ENV.READERS_DURATION || '30s';
// If a connection never opens or errors out, pause before constant-vus
// immediately starts a new attempt — same self-amplifying-retry-storm
// protection discussed while debugging the earlier k6/http version.
const RETRY_DELAY_SECONDS = 1;

const timeToFirstSnapshot = new Trend('sse_time_to_first_snapshot', true);
const timeToCompleteSnapshot = new Trend('sse_time_to_complete_snapshot', true);

export const options = {
  scenarios: {
    readers: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    checks: ['rate>0.90'],
  },
};

export default function () {
  const url = `${BASE_URL}/api/survey-responses/stream?limit=${encodeURIComponent(SSE_LIMIT)}`;
  const startedAt = Date.now();
  let connectionOpened = false;
  let gotSnapshot = false;
  let completedSnapshot = false;
  let hadError = false;

  sse.open(url, {}, function (client) {
    // Checks are recorded here, inline, rather than after sse.open()
    // returns — that line is only ever reached on an early error/close,
    // never on the (successful) case where the connection stays open until
    // k6 forcibly interrupts it at the end of the scenario.
    client.on('open', function () {
      connectionOpened = true;
      check(null, { 'connection opened': () => true });
    });

    client.on('event', function (event) {
      // The server also sends a plain `: connected` comment on connect,
      // which this client surfaces as an event with an empty name — only
      // the real `event: snapshot` message counts here.
      if (event.name === 'snapshot' && !gotSnapshot) {
        gotSnapshot = true;
        timeToFirstSnapshot.add(Date.now() - startedAt);
        check(null, { 'received a snapshot event': () => true });
      }
      if (event.name === 'snapshot' && !completedSnapshot) {
        try {
          const snapshot = JSON.parse(event.data);
          if (snapshot.complete === true) {
            completedSnapshot = true;
            timeToCompleteSnapshot.add(Date.now() - startedAt);
            check(null, { 'received the complete snapshot': () => true });
          }
        } catch {
          check(null, { 'snapshot event contained valid JSON': () => false });
        }
      }
      // Deliberately never close manually — hold the connection open for
      // the whole scenario duration, same as a real visitor watching the
      // live graph. k6 forcibly ends it when the scenario's
      // duration/gracefulStop elapses.
    });

    client.on('error', function (e) {
      hadError = true;
      console.error('SSE error:', e.error());
    });
  });

  // sse.open() only returns via an explicit client.close() (never called
  // here) or the connection dying — a genuine success never reaches this
  // line at all, it stays blocked until k6 forcibly interrupts it at the
  // end of the scenario. So reaching here is itself proof this iteration
  // failed, regardless of what hadError/connectionOpened say — this is what
  // actually triggers the retry-delay now, instead of the old check (which
  // silently missed the "opened fine, then died with no error event" case).
  check(null, { 'held connection open until scenario ended': () => false });
  sleep(RETRY_DELAY_SECONDS);
}
