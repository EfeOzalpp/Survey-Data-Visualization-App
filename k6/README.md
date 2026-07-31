# Load Testing

Load testing of the Butterfly Effect SSE and survey-write endpoints with k6
against the Dockerized application at `http://127.0.0.1:3000`.

The reader tests use a custom k6 binary containing the `k6/x/sse` extension.
Each VU represents an SSE connection, not a rendered browser session.

## Throughput: direct process vs. cluster mode

Five single-process runs and five cluster-mode runs were completed under the
same fixed arrival rate.

### Configuration

| Parameter | Value |
| --- | --- |
| Tool | k6 with `k6/x/sse` |
| Container limit | 2 vCPUs, 1 GiB memory |
| Dataset | 488 rows, `limit=all` |
| Target rate | 225 complete SSE reads/second |
| Duration | 30 seconds per run |
| Runs | 5 single-process + 5 cluster-mode |
| Target | `http://127.0.0.1:3000` |
| Data received | Approximately 612 MB per run, or 20 MB/s |
| Rows delivered | Approximately 109,000 rows/s |
| Latency metric | `http_req_duration` for complete initial SSE reads |

All ten runs sustained the full target rate. Success is the share of scheduled
SSE reads that delivered a complete initial dataset.

### Method

Latency on this endpoint is state-sensitive, so a single run is noisy. Each
configuration was run five times and compared as a distribution. Median
represents the typical read, while p90, p95, and completion rate capture tail
latency and reliability.

### Single process

| Run | Average | Median | p90 | p95 | Success |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 136 ms | 46 ms | 379 ms | 472 ms | 100% |
| 2 | 81 ms | 12 ms | 309 ms | 375 ms | 100% |
| 3 | 145 ms | 88 ms | 361 ms | 427 ms | 99.98% |
| 4 | 80 ms | 21 ms | 273 ms | 342 ms | 99.94% |
| 5 | 133 ms | 77 ms | 348 ms | 387 ms | 100% |

### Cluster mode

| Run | Average | Median | p90 | p95 | Success |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 85 ms | 15 ms | 309 ms | 364 ms | 100% |
| 2 | 72 ms | 15 ms | 263 ms | 346 ms | 100% |
| 3 | 85 ms | 22 ms | 290 ms | 355 ms | 100% |
| 4 | 56 ms | 11 ms | 212 ms | 326 ms | 100% |
| 5 | 56 ms | 22 ms | 172 ms | 273 ms | 100% |

### Summary

| Metric | Single-process mean | Cluster-mode mean | Change |
| --- | ---: | ---: | ---: |
| Average latency | 115 ms | 71 ms | 39% lower |
| Median latency | 49 ms | 17 ms | 65% lower, approximately 3x |
| p90 latency | 334 ms | 249 ms | 25% lower |
| p95 latency | 401 ms | 333 ms | 17% lower |
| Median spread, population SD | 30 ms | 4 ms | More consistent |
| Fully clean runs | 3/5 | 5/5 | No incomplete reads |

Cluster mode recorded lower typical and tail latency, substantially less
run-to-run variation, and complete reads in all five runs. The median ranges
overlap at their lowest values, so the result is better described as
consistently lower latency rather than a fixed multiplier on every read.

The adaptive second worker didn't activate during these throughput runs.
The observed comparison is therefore between a direct Node process and Node
cluster mode with one request-handling worker, not a measurement of two
workers processing requests across both cores. A separate activated-worker
benchmark is required before attributing the improvement to multi-core
parallelism.

## Concurrency

The accumulating-reader test verified 10,160 simultaneous SSE connections in
a 2-vCPU, 1-GiB container:

| Metric | Result |
| --- | --- |
| Dataset | 488 rows, `limit=all` |
| Arrival pattern | 254 readers every second for 40 waves |
| Peak concurrency | 10,160 SSE connections |
| Connections | 10,160 opened; zero errors or early disconnects |
| Initial datasets | 10,160 completed |
| Completion latency | 353.69 ms average; 779 ms p95; 1.2 s maximum |
| Network received | 922 MB |

These concurrency results were obtained with one request-handling Node
process. Open connections remain alive for live patch events and heartbeats
until k6 ends their scenarios.

## Sanity-backed write throughput

This result is the pre-PostgreSQL write baseline.

The fixed-arrival writer test exercised the complete Express validation,
Sanity mutation, synchronous visibility, and JWT response path.

| Metric | Result |
| --- | --- |
| Target rate | 25 survey creates/second |
| Duration | 30 seconds |
| Writes | 750 scheduled; 750 completed |
| Failures and dropped iterations | 0 |
| Completion latency | 1.03 s average; 1.22 s p95; 1.5 s maximum |
| Active VUs | 31 maximum; 50 preallocated |

k6 scheduled all 750 writes during the configured 30-second arrival window.
Its summary reports approximately 24.18 completions/second because the total
31-second runtime includes the final drain period. This clean run matches
Sanity's documented
[25 mutation requests/second per source-IP limit](https://www.sanity.io/docs/content-lake/technical-limits).

## Write burst probes

`writers-ceiling.js` measures whether one configured simultaneous burst is
absorbed; it doesn't discover the ceiling automatically.

| VUs | Completed | Failures | Result |
| ---: | ---: | ---: | --- |
| 25 | 25 | 0 | Clean |
| 30 | 30 | 0 | Clean |
| 750 | 232 | 518 | Failed |

The 750-VU overload produced connection refusals before 518 requests reached
Express. The container remained running, wasn't OOM-killed, and didn't
restart. The 232 admitted writes completed at approximately 25.01/second;
successful HTTP responses averaged 5.18 seconds and reached 9.21 seconds.
This run exposed a connection-admission boundary, not a measured Sanity burst
ceiling. The largest repeatable zero-failure burst has not yet been located.

## SSE behavior during writes

Initial SSE datasets are paged and serialized in chunks of up to 250 rows.
Live patches are not divided into 250-row chunks: mutation events are
deduplicated by response ID and coalesced for 750 ms before one patch is
broadcast. Visible patch batches therefore reflect both Sanity's query-visible
mutation timing and the backend's coalescing window.

The recorded 225-read/s throughput and 10,160-connection results above remain
isolated read tests; they should not be presented as mixed-workload results.

As a PostgreSQL migration regression, a smaller simultaneous run scheduled 25
complete SSE reads/s and 10 survey creates/s for 10 seconds. It completed
251/251 SSE reads and 100/100 writes with no dropped iterations, connection
errors, incomplete reads, or write failures. This validates the combined
read/write path, but it is a smoke test rather than a mixed-load ceiling.

## Run

From the `k6` directory:

```powershell
.\run-sse-throughput.ps1 -ReadsPerSecond 225
```

```powershell
.\run-sse-ceiling.ps1 `
  -WaveVus 254 `
  -WaveCount 40 `
  -WaveInterval 1 `
  -PeakHold 60
```

The current write tests create real PostgreSQL rows. Run the container with
`LOAD_TEST_MODE=true` and target a disposable database. The Sanity figures
above are a historical pre-migration baseline, not a mode of the current
scripts.

```powershell
.\run-writers-ceiling.ps1 -Vus 25
```

```powershell
.\run-writers-throughput.ps1 `
  -WritesPerSecond 25 `
  -DurationSeconds 30
```

| Script | Purpose |
| --- | --- |
| `sse-throughput.js` | Opens, completes, and closes full-history SSE reads at a fixed rate |
| `sse-ceiling.js` | Accumulates sustained SSE connections in waves |
| `writers-ceiling.js` | Releases a simultaneous burst of survey-create requests |
| `writers-throughput.js` | Persists survey creates at a fixed arrival rate |

## Payload and writes

With the dataset held at 488 rows, reducing the streamed row projection cut a
250-reader burst from approximately 45 MB to 23 MB, a 49% reduction. Stored
Sanity documents were unchanged.

Writer tests create real datastore rows. The recorded Sanity-backed runs
include Sanity's limits and latency; current runs measure the
Express-to-PostgreSQL path. Both writer tests isolate survey creates and should
target disposable data.
