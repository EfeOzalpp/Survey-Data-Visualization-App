## BE: Real-Time Rendering & Visualization

`Butterfly Effect` is an interactive survey and visualization application that transforms responses into personalized scenes and a collective 3D visualization.

Its custom 2.5D-capable Canvas2D renderer uses shared draw functions to generate both the city canvases and reusable offscreen sprites consumed by the Three.js/WebGL layer on the visualization page.

[![Live App](https://img.shields.io/badge/Live%20App-%23845f87?style=for-the-badge)](https://butterflyeff3ct.online/)

<p align="left">
  <img src="gifs+images/desktop-onboarding.gif" alt="Onboarding: Desktop view of the landing page and call to actions." width="58%" />
  <img src="gifs+images/tablet-questionnaire.gif" alt="Questionnaire: Tablet view of step with multi-select inputs changing city." width="30%" />
</p>

<br>

## Flow

Users simulate changes in the scene through multi-select inputs before submitting their results. Once completed, individual results, among everyone else, appear in the new section with `solo/team` switch. Users can write a personalized message that would live with their shape or explore the cohort-filtering, logs table, bar graph and per question comparisons.

<br>

<p align="left">
  <img src="gifs+images/mobile-city.png" alt="Graph: Desktop view of the visualization, dropdown feature, logs and lightmode switch." width="23%" />
  <img src="gifs+images/mobile-graph.gif" alt="Graph: Mobile view of the personalized gamification note, other users sprites, and logs panel." width="20.6%" />
  <img src="gifs+images/desktop-graph.gif" alt="Graph: Desktop view of the visualization, dropdown feature, logs and lightmode switch." width="49.2%" />
</p>

<br>

## Testing

Jest suites cover state and data utilities, layout rules, ranking logic, caching, and rendering-related utilities across the application.

### Load Testing

Under a 2-vCPU/1-GiB Docker limit, k6 verified 10,160 concurrent SSE connections and 225 complete 488-row initial loads per second. [Methodology and recorded results](k6/README.md)

### Sprite Performance

Retained JavaScript objects and observed GPU memory were compared with quantization and material caching enabled and disabled. [Recorded results](sprite-performance/sprite-performance-gain.md)

### Re-render Testing

A scripted Playwright and React Profiler benchmark measured 21% fewer subtree renders after the Zustand migration (`709 → 560`) and 16.7% fewer component executions after memoization (`234 → 195`). [Benchmark source](app/src/render-test/)

<br>

## Backend

#### Node.js

**Clustering:** Uses `node:cluster` to run the server in separate worker processes that the operating system can schedule across available CPU cores.

**Authorization efficiency:** Signs a JWT with `jsonwebtoken` when a survey response is created, allowing server-side verification and avoiding a database round trip.

**Production asset resolution:** Loads the compiled SSR entry and reads Vite's generated `.vite/manifest.json`, which is cached in production to resolve hashed JavaScript and imported CSS assets.

#### Express

**Delivery:** Serves compiled assets and streams the React SSR document with `renderToPipeableStream` from `react-dom/server` for non-API application routes.

**API routes:** Separates read, write, and SSE route and server health functions.

**Request boundary:** Uses `express.json` for size-limited request parsing, then applies origin checks and payload validation before upstream reads or writes.

#### Rate Limiting

- A custom in-memory limiter uses `node:crypto` to create salted SHA-256 keys for client addresses and, where relevant, client, request, or response identifiers.

- Because the server supports multi-process clustering, workers send fixed-window rate-limit checks to the primary process. This keeps counters consistent across workers and prevents clients from evading limits by reaching a different worker.

#### SSE Delivery

- Sends all survey-results with 250 rows chunks, newest to oldest, then keeps each connection open for live patch events if any and heartbeats (to keep connection open).

- Deduplicates concurrent chunk (snapshot) fetches through a single in-flight request and maintains a shared normalized row cache.

- Serialization cache: Caches ready-to-send snapshot chunks by section and row limit, avoiding repeated filtering and JSON serialization until the data changes.

<br>

## Rendering System

**Scene Canvas:** this folder contains the source code for
2.5D renderer which is the upstream graphics system.

**Graph Runtime:** this folder contains the Sprite pipeline and 3D visualization that sits between Scene Canvas and Three.js/WebGL system.

[Scene Canvas architecture](app/src/scene-canvas/README.md) · [Graph Runtime architecture](app/src/graph-runtime/README.md)

<br>

## State Management

Zustand stores manage canvas runtime, survey data, and UI state through per-field selectors.

Identity and user preferences remain in React Context. Twelve components beneath rendering-heavy parents use `React.memo` to prevent unrelated state changes from propagating through the component tree.

Zustand and `React.memo` were benchmarked separately to see what each one actually moved. [Results](app/src/render-test/README.md)

<br>

## Data Flow

#### PostgreSQL

**Connections:** A `pg.Pool` reuses database connections for REST reads and writes instead of opening a new connection for every request. A separate `pg.Client` stays open for the PostgreSQL `LISTEN` subscription without occupying a connection from the query pool.

**Schema and queries:** SQL migration files define the `survey_responses` table, weight and message constraints, a unique idempotency hash, and indexes for newest-first history reads. A repository module keeps parameterized `INSERT`, `UPDATE`, and paginated `SELECT` queries behind the existing REST and SSE interfaces, then maps database records into the application's survey-response format.

**Live changes:** An `AFTER INSERT OR UPDATE OR DELETE` trigger publishes committed row changes through `pg_notify`. The dedicated listener converts those notifications into upsert or delete events consumed by the SSE feed, keeping connected clients synchronized without polling PostgreSQL.

#### Sanity

**CMS reads:** A server-only `@sanity/client` queries the `gamificationGeneralCopy` and `gamificationPersonalizedCopy` schemas through one GROQ request. Drafts and disabled entries are excluded, results are grouped by copy type, and the Express endpoint caches them for 60 seconds before returning them to the client.

<br>

## What would I improve further?
Although this version of the scene engine performed well on desktop and iOS devices, testing on lower-end Android hardware showed that some visual effects and redraw patterns were too expensive across the full device range.

Recent profiling also led to replacing live Canvas2D brightness filters with a cheaper depth-mask overlay path and tuning distance-based bitmap caching.

From that hands-on experience, I started building `Canvas Engine`: an unopinionated rendering engine. It separates draw instructions from the renderer through a rich `.txt`-based declarative notation, keeps renderer lifecycle and cache invalidation tightly controlled, and prevents the main loop from overreaching into application logic. It targets WebGPU first, with WebGL fallback support for older devices.

<br>

### Repository for the new system
[![Canvas Engine](https://img.shields.io/badge/Canvas%20Engine-%236d976c?style=for-the-badge)](https://github.com/EfeOzalpp/canvas-engine)

<br>

### 📬 Contact & Questions

If you have any questions, feel free to reach out to me at: **eozalp.efe@gmail.com**
