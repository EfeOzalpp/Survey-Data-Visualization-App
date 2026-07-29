# Load Tests

These tests target the Dockerized application through
`http://127.0.0.1:3000`. Results measure the complete local path from k6 on
Windows, through Docker Desktop port forwarding, to the Node processes inside
the container.

## Recorded SSE results

| Test | Arrival shape | Snapshot | Rows | Network received | Hold | Result |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Full-history accumulating ceiling | 250 VUs every 10s, up to 5,000 | Warm, `limit=all` | 488 | 454 MB over the complete test | 60s at peak | Passed: exactly 5,000 connections opened, 5,000 complete snapshots received, zero connection errors, zero early disconnects, and server peak concurrency of 5,000 |
| Accumulating connection ceiling | 100 VUs every 10s, up to 5,000 | Warm, `limit=5` | 5 | Not retained | 60s at peak | Passed: 5,000 test connections held concurrently; server peak was 5,001 including one pre-existing browser connection |
| Single burst | 200 VUs at once | Warm, `limit=5` | 5 | 426 kB total, approximately 2.1 kB/connection | 50s effective | Passed: 200/200 opened and received a snapshot; first-snapshot p95 125ms |
| Full-history burst | 50 VUs at once | Warm, `limit=all` | 488 | 8.7 MB total, approximately 174 kB/connection | 50s effective | Passed: 50/50 opened and received snapshot data; first-snapshot p95 108.55ms |
| Full-history validation | 1 VU | Warm, `limit=all` | 488 | 175 kB total | 2s | Passed: complete multi-chunk snapshot received in 15ms |

The final full-history ceiling run completed with:

- 5,000 exact connection opens and 5,000 exact complete snapshots.
- Zero SSE connection errors and zero genuine early disconnects.
- Complete-snapshot latency of 266.24ms average, 707ms p95, and 918ms maximum.
- First-snapshot latency of 238.26ms average and 576ms p95.
- 454 MB received across all 20 waves and their differently sized hold
  windows.

The test stopped at 5,000, so this result establishes a verified concurrency
floor rather than the server's failure point. It applies to the local
Dockerized deployment and is not presented as an Internet-scale production
capacity figure.

## SSE payload optimization

With the dataset held at 488 rows, a 250-VU full-history burst transferred
approximately 45 MB before the SSE projection was reduced and approximately
23 MB afterward: an observed reduction of about 49%.

The stored Sanity documents were not reduced. The server-side projection
stopped transmitting duplicated or internal fields while retaining the
canonical values in the database.

Payload values use k6's `data_received`, which includes the snapshot, HTTP/SSE
framing, connection comments, and heartbeats. Row counts and payload sizes
describe the dataset at test time and will grow as responses are added.

## Reader commands

Single full-history burst:

```powershell
.\k6.exe run `
  -e BASE_URL=http://127.0.0.1:3000 `
  -e SSE_LIMIT=all `
  -e READERS_VUS=250 `
  -e READERS_DURATION=20s `
  readers.js
```

Inspect the resolved ceiling-test schedule without running it:

```powershell
.\k6.exe inspect `
  -e BASE_URL=http://127.0.0.1:3000 `
  -e SSE_LIMIT=all `
  -e WAVE_VUS=250 `
  -e WAVE_COUNT=20 `
  -e WAVE_INTERVAL=10 `
  -e PEAK_HOLD=60 `
  staged-readers.js
```

Run the accumulating full-history ceiling test:

```powershell
.\run-staged-readers.ps1
```

The resolved schedule adds 250 readers every 10 seconds, reaches 5,000 after
3m10s, holds the peak for 60 seconds, and ends after 4m10s. The interrupted
SSE iterations at scheduled shutdown are expected because the connections
are deliberately held open.

Run only one k6 process at a time. The single-burst reader currently inherits
k6's 30-second `gracefulStop`, so a configured 20-second duration holds its
SSE iterations for 50 seconds in total.

## Writer test semantics

`writers.js` is a finite REST integration test, not a sustained-connection
test. Each successful iteration performs two sequential Sanity mutations:

1. `POST /api/save-user-response` creates one response document and returns a
   signed edit token.
2. After a 500ms pause, `POST /api/save-solo-message` uses that token to patch
   the same document.

For example, this command schedules 300 writer workflows:

```powershell
.\k6.exe run `
  -e BASE_URL=http://127.0.0.1:3000 `
  -e WRITERS_VUS=300 `
  -e WRITERS_ITERATIONS=300 `
  writers.js
```

That means 300 document creates plus 300 patches: 600 real Sanity mutations
and 300 retained test documents. It measures the combined Windows -> Docker
-> Express -> Sanity round trip rather than an isolated Express write ceiling.

When `LOAD_TEST_MODE=true`, application rate limits are bypassed and the
server defaults to the disposable `load-test` Sanity dataset unless
`SANITY_DATASET` is explicitly overridden. Production rate limits remain
enabled outside load-test mode.

A 5,000-workflow run would issue 10,000 mutations and create 5,000 documents.
It should not be treated as the natural counterpart of 5,000 open SSE
connections. This is within the project's observed monthly request and
document allowances, but monthly quota is separate from instantaneous
capacity. Sanity documents a limit of 25 mutation requests per second per
source IP and 100 concurrent mutations per dataset. Excess requests receive
HTTP 429 responses:
[API CDN rate limiting and concurrency](https://www.sanity.io/docs/content-lake/api-cdn)
and
[technical limits](https://www.sanity.io/docs/content-lake/technical-limits).

Because both mutations originate from the same Dockerized backend, 10,000
individual mutations would require at least 400 seconds at 25 mutations per
second if they were deliberately paced. Sending all 5,000 workflows at once
would therefore be a useful test of throttling and failure behavior, but not
evidence that Express itself has reached a write ceiling.

The defensible writer result is the largest burst actually executed with its
request count, failure rate, response latency, and Sanity mutation counts
recorded. Do not infer a 5,000-write result from the verified 5,000-reader
test.
