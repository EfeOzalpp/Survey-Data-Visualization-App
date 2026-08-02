# Render Test

Benchmarks re-render behavior with Playwright + React Profiler, comparing the current
branch against `with-profiler` (a pre-release before the Zustand + `React.memo` work).

## Results

| | Metric | Change |
|---|---|---|
| Zustand alone | subtree commits | **−21%** |
| `React.memo` alone | own-renders (function actually executes) | **−17%** |
| Combined | main-thread render time | **−12%** |

- **Subtree commits** count any render inside a component's tree, including descendants — this is what Zustand moves (fewer components get told to re-render at all). Nearly blind to memoization, since a memoized child's sibling re-rendering still trips the same counter.
- **Own-renders** count only when a component's own function body executes — this is what `React.memo` moves. Zustand's effect on this number is smaller and secondary.
- **Combined (−12%)** is the one metric that legitimately adds both effects into a single number, measured in one consistent unit (ms, via the outermost `AppInner` Profiler boundary) instead of mixing two different kinds of counts.

`with-profiler` vs current branch, subtree commits, 3-run average:

| Section | with-profiler | current | Change |
|---|---|---|---|
| Theme toggle | 35.7 | 32 | −10% |
| Pre-survey graph view toggle | 43 | 45 | +5% |
| CanvasInfo spotlight controls | 66 | 39 | −41% |
| Role + section pick | 32 | 20 | −38% |
| Questionnaire | 290.3 | 237 | −18% |
| Graph runtime (post-submit) | 203 | 159 | −22% |
| **Grand total** | **670** | **532** | **−21%** |

Own-render grand total on the current branch: **223** (no `with-profiler` baseline exists for this metric — that instrumentation didn't exist yet on that snapshot).

## To run

```bash
VITE_USE_MOCK_DATA=true npm run dev

npx tsx src/render-test/rerenderBenchmark.ts # both metrics
npx tsx src/render-test/rerenderBenchmark.ts --metric=subtree
npx tsx src/render-test/rerenderBenchmark.ts --metric=own
```

`VITE_USE_MOCK_DATA=true` is required — the benchmark's scripted walkthrough submits a
real survey response, and mock mode keeps that from touching any real database.

## Still needs tending

- "Pre-survey graph view toggle" is +5% instead of improving. Traced to an asymmetry
  where closing the graph view causes one extra `Survey` render that opening doesn't.
  A redundant effect was found and removed in `onboarding/index.tsx` (confirmed dead
  code via testing, not the actual cause), but the real source of the asymmetry is
  still unidentified.
