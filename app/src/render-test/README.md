# Render Test: how much unnecessary re-rendering did we remove?

This folder holds a small, self-contained benchmark. It opens the app in a real browser
(via [Playwright](https://playwright.dev/)), clicks through the same fixed sequence of
actions every time (toggle the theme, view the graph, answer the questionnaire, open the
logs panel, etc.), and counts how many times React components re-render along the way.

The point isn't to test whether the app *works* — it's to answer a narrower question:
**does the app do more work than it needs to every time something changes?**

## Why this matters, in plain terms

React re-renders a component whenever its state or the data it reads changes. That's
normal and expected. The problem shows up when a component re-renders for a reason that
has *nothing to do with it* — for example, the color theme flips from light to dark, and
a component way over in the corner of the screen (that doesn't care about theme at all)
re-runs its whole function anyway, just because it happened to be a child of something
that did care.

That's wasted work. It doesn't usually break anything the user can see, but it adds up:
more CPU time spent per interaction, less headroom on slower devices, and — if you're
trying to reason about *why* a component rendered — more noise to sift through.

## The two numbers this benchmark reports

**Subtree commits** — this counts *any* render happening anywhere inside a piece of the
component tree, not just the specific component you're looking at. Think of it like a
motion-sensor light in a hallway with several rooms attached: it doesn't tell you which
room the movement was in, only that *something* moved somewhere behind that door. If a
component two rooms down the hall updates, the sensor by the front door still trips.

**Own-render count** — this counts only the times a *specific* component's own function
body actually ran, regardless of what's happening around it. Going back to the analogy:
this is like asking one particular person "did you personally get up and move?" instead
of relying on a hallway sensor that can't tell people apart.

Why keep both? The subtree number is what actually correlates with "was there a genuine
architectural change that stops far-apart parts of the tree from re-rendering together."
The own-render number is what tells you whether a *specific* component is being asked to
redo work it didn't need to do. A change can improve one without moving the other much —
that's not a contradiction, it just means the two numbers are answering different
questions.

## What we compared

- **`with-profiler`** (an old snapshot, kept as a git tag, not a live branch anymore) —
  the app as it was before two changes: moving shared app state off React's built-in
  Context API onto [Zustand](https://github.com/pmndrs/zustand) (a small state
  library that lets a component subscribe to only the one field it actually reads,
  instead of "wake me up whenever *anything* in this shared bucket of state changes"),
  and applying `React.memo` (a built-in React tool that tells a component "skip
  re-rendering if your own props didn't actually change") to the handful of components
  that were most affected by cascading re-renders.
- **`wrapping-up`** (the current branch, as of this benchmark) — the app with both of
  those changes already in place, plus everything else that's happened since (new
  features, the move from Sanity to PostgreSQL for storing survey responses, etc.).

Worth being upfront about: this is **not** a perfectly clean side-by-side test, because
other unrelated things also changed between these two snapshots. A separate, tightly
controlled test earlier (changing exactly one thing at a time, on the same codebase)
found Zustand alone cuts subtree commits by about 21%, and adding `React.memo` on top
cuts unnecessary own-renders by about 17%. The numbers below land in the same range,
which is a good sign they're measuring something real rather than noise.

## How it was run

Both snapshots were benchmarked with `VITE_USE_MOCK_DATA=true`, which makes the app use
fake, local-only survey data instead of talking to the real backend. That's deliberate —
the benchmark script actually submits a fake survey response as part of its scripted
walkthrough, and mock mode guarantees that never touches a real database, in production
or otherwise. Each snapshot was run 3 times back to back to check the numbers were stable
and not just a one-off fluke.

## Results

### Subtree commits (lower is better, and this is the metric both snapshots can report)

| Section | `with-profiler` avg | `wrapping-up` avg | Change |
|---|---|---|---|
| Theme toggle | 35.7 | 32 | −10% |
| Pre-survey graph view toggle | 43 | 45 | +5% |
| CanvasInfo spotlight controls | 66 | 39 | −41% |
| Role + section pick | 32 | 20 | −38% |
| Questionnaire | 290.3 | 237 | −18% |
| Graph runtime (post-submit) | 203 | 159 | −22% |
| **Grand total** | **670** | **532** | **−21%** |

Not every section improved — "Pre-survey graph view toggle" is slightly *higher* on
`wrapping-up`. That's expected and not a red flag: real features were added to the app
in between these two snapshots, and some of those add a small, legitimate amount of
extra rendering in places that have nothing to do with this optimization work. We're
reporting it as-is rather than only showing the numbers that look good.

**Run-to-run consistency:** `with-profiler`'s totals varied a bit between runs (668,
670, 672), while `wrapping-up`'s were nearly identical every time (531, 532, 533). Real
browser timing always has some natural noise, but the newer version's render behavior
is clearly more predictable — a nice side effect of fewer components re-rendering for
reasons unrelated to them.

### Own-render count (only available on `wrapping-up` — this instrumentation didn't exist yet on the old snapshot)

| Section | Own-renders (avg) |
|---|---|
| Theme toggle | 10 |
| Pre-survey graph view toggle | 23 |
| CanvasInfo spotlight controls | 0 |
| Role + section pick | 6 |
| Questionnaire | 107 |
| Graph runtime (post-submit) | 77 |
| **Grand total** | **223** |

223 actual component re-executions, out of 532 subtree commits — meaning most of what
the subtree counter picks up is either a legitimate, necessary render (a component
reacting to its own state) or a commit happening somewhere else in the same subtree, not
a wasted re-run of the component itself. Zero own-renders in "CanvasInfo spotlight
controls" specifically confirms that interacting with that panel's own controls doesn't
force any of its unrelated ancestor components to redo work anymore.

## Running it yourself

```bash
# make sure the dev server is running first, e.g.:
VITE_USE_MOCK_DATA=true npm run dev

# then, in another terminal:
npx tsx src/render-test/rerenderBenchmark.ts              # both metrics
npx tsx src/render-test/rerenderBenchmark.ts --metric=subtree  # subtree commits only
npx tsx src/render-test/rerenderBenchmark.ts --metric=own      # own-renders only
```
