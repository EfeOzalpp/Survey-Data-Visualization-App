## Butterfly Effect: Gamified City Simulation

An application that uses a custom 2.5D Canvas2D implementation to render an interactive city scene. The same scene functions compute draw arguments and generate offscreen sprites for a Three.js/WebGL collective visualization in 3D space.

[![Live App](https://img.shields.io/badge/Live%20App-%23845f87?style=for-the-badge)](https://butterflyeff3ct.online/)

<p align="left">
  <img src="gifs+images/desktop-onboarding.gif" alt="Onboarding: Desktop view of the landing page and call to actions." width="58%" />
  <img src="gifs+images/tablet-questionnaire.gif" alt="Questionnaire: Tablet view of step with multi-select inputs changing city." width="30%" />
</p>

<br>

- Users simulate changes in the scene by clicking or tapping multi-select input signals.
- Once completed, individual results are added to the UI layer with `solo/team` toggle, tooltips and section filters.
- Every previous user is part of the collective visualization with their (optional) messages.
- Features a logs table, bar graphs with a personal anchor, and per question comparisons.

<br>

<p align="left">
  <img src="gifs+images/mobile-city.png" alt="Graph: Desktop view of the visualization, dropdown feature, logs and lightmode switch." width="23%" />
  <img src="gifs+images/mobile-graph.gif" alt="Graph: Mobile view of the personalized gamification note, other users sprites, and logs panel." width="20.6%" />
  <img src="gifs+images/desktop-graph.gif" alt="Graph: Desktop view of the visualization, dropdown feature, logs and lightmode switch." width="49.2%" />
</p>

<br>

## Architecture

- Survey results are delivered through a server-managed SSE stream: newest-first snapshot chunks load history, then patch events carry live changes.
- A single-flight cache deduplicates snapshot fetch and serialization work before fanning each dataset version out to concurrent SSE readers.
- Graph views stay client-capped for rendering, while logs and section counts use the streamed history loaded so far.
- Gamification copy is fetched through a cached Express endpoint that batches related Sanity CMS reads into one request.
- Survey submissions stay on separate Express POST endpoints, keeping writes explicit while live updates flow back through SSE.
- Edit authorization uses server-signed JWTs instead of a stored token hash, so verifying a solo-message edit is a single signature check instead of a Sanity lookup-then-compare.
- Under a 2-vCPU/1-GiB Docker limit, k6 verified 10,160 concurrent SSE connections receiving complete 488-row snapshots in 254-connection waves every second, with zero connection errors or early disconnects. See the [test methodology and recorded results](k6/README.md).

| | |
| :--- | :--- |
| **Scene Canvas** | Grid layout, scene rules, shape modifiers parameterize `Canvas2D` draw arguments (transforms, colors, particles) from live input signals, and multi-canvas orchestration through a single requestAnimationFrame instance | 
| **Sprite Pipeline** | Epoch texture update scheduler, quality upgrade scheduler, quantizes value that drives shape uniqueness for higher cache performance *(consumes scene canvas and Three.js)* |
| **Three.js / WebGL** | Culling, 3D math, distance-based rotation speed and hitbox scaling with debounce during zoom, tooltip anchoring, and camera orchestration for the community graph *(consumes sprites)* |
| **React + SSR API** | `renderToPipeableStream` for server-side rendering and client hydration |
| **State Management** | Five app-wide slices; `CanvasRuntimeCtx`, `UiCtx`, and survey data run on Zustand stores with per-field selectors so components re-render only on the fields they actually read, while `IdentityCtx` and `PreferencesCtx` remain on React Context. Twelve components beneath the render-heavy parents are wrapped in `React.memo` to stop unrelated parent re-renders from cascading into children whose own props are unchanged. Re-render behavior is verified with a scripted Playwright benchmark across the full survey and graph flow |
| **Node.js** | Parses Vite build manifest, dynamically imports compiled SSR bundle |
| **Express** | Validates write requests before Sanity mutations, batches cached CMS reads, rate-limits API routes, serves the SSR document, and streams chunked survey snapshots plus live SSE patches |
| **Web Worker** | offloads scene placement computation, removing latency during user-input recomputation |
| **Sanity CMS** | Anonymous document writes for survey responses; paged dataset reads and change events for community graph, logs, and gamification copy |
| **AWS EC2** | Production deployment with automated deploys |

<br>

### Navigation

- [Scene Canvas](app/src/scene-canvas)
- [Graph Runtime](app/src/graph-runtime)
- [Load Tests and Recorded Results](k6/README.md)

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
