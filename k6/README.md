# Load Tests

These k6 tests target the Dockerized application at
`http://127.0.0.1:3000`. The reader tests use a custom k6 binary containing
the `k6/x/sse` extension.

## Verified SSE benchmark

| Metric | Result |
| --- | --- |
| Environment | k6 on Windows -> Docker Desktop -> Node cluster |
| Container limit | 2 vCPUs, 1 GiB memory |
| Dataset | 488 rows, `limit=all` |
| Arrival pattern | 254-reader burst every second for 40 waves |
| Peak concurrency | 10,160 SSE readers |
| Connection result | 10,160 opened; zero errors or early disconnects |
| Snapshot result | 10,160 complete snapshots |
| Complete-snapshot latency | 353.69ms average; 779ms p95; 1.2s maximum |
| Network received | 922 MB |

Each VU represents one SSE connection, not a rendered browser session. After
receiving its snapshot, it stays open waiting for live patch events.

This local benchmark includes the Windows generator and Docker Desktop; it is
not an EC2 or production-capacity result.

## Run the benchmark

From the `k6` directory:

```powershell
.\run-staged-readers.ps1
```

The defaults add 254 readers every second, reach 10,160 after 39 seconds,
hold the peak for 60 seconds, and end after 99 seconds. Reader iterations
reported as interrupted at shutdown are expected because their SSE
connections are deliberately held open.

## Scripts

| Script | Purpose |
| --- | --- |
| `staged-readers.js` | Accumulates SSE waves to verify concurrent connections and complete snapshots |
| `readers.js` | Runs one simultaneous SSE reader burst |
| `writers.js` | Runs finite REST create-and-patch workflows |
| `sse-extension-check.js` | Confirms that the custom k6 binary includes `k6/x/sse` |

## SSE payload

With the dataset held at 488 rows, reducing the streamed row projection cut a
250-reader burst from approximately 45 MB to 23 MB, a 49% reduction. Stored
Sanity documents were unchanged; only duplicated and internal fields were
removed from the SSE payload.

## Writer test

Each `writers.js` iteration creates one survey response and then patches its
solo message. These are real Sanity mutations, so writer results include
Sanity's limits and latency rather than measuring Express alone. Load-test
mode defaults to the disposable `load-test` dataset.
