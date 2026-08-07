# Render Test

Benchmarks re-render behavior with Playwright + React Profiler, comparing the current
branch against `with-profiler` (a pre-release before the Zustand + `React.memo` work).

## Results

| | Metric | Change |
|---|---|---|
| Zustand alone | subtree commits | **−21%** |
| `React.memo` alone | own-renders (function actually executes) | **−17%** |

- **Subtree commits** count any render inside a component's tree, including descendants. Zustand reduces number of components that are re-rendered. Memoization on the other hand isn't tracked by subtree commits, since a memoized child's sibling re-rendering still trips the same counter.
- **Own-renders** count only when a component's own function body executes. This is what `React.memo` moves. Zustand's effect on this number is smaller and secondary.
- **Combined** is the one metric that legitimately adds both effects into a single number, measured in one consistent unit (ms, summed across every `<Profiler>` subtree across all 6 benchmark sections) instead of mixing two different kinds of counts.

### Re-renders

Only the components explicitly wrapped in `<Profiler>`.** were measured. This is because these components shared state. 

`AppInner`, `Navigation`, `NavBottom`, `NavRight`, `Logo`, `ModeToggle`, `Survey`,
`CanvasInfo`, `CanvasEntry`, `QuestionnaireEntry`, `CityOverlay`, `ButtonQuestionnaireFlow`,
`BarGraph:nav-bottom`, `BarGraph:compact-tools`, `DotGraph`, `DotGraphCanvasHost`.

Anything rendering outside one of these boundaries (individual icons, deeper children inside
`BarGraph`/`DotGraph` that aren't separately wrapped, etc.) isn't counted at all, in either
version. The figures below are the sum of render time *inside these 16 boundaries only*, across the scripted walkthrough.

Measured using `refs/tags/with-profiler` checked out read-only in an isolated `git worktree`, running the actual `rerenderBenchmark.ts` script against both, `VITE_USE_MOCK_DATA=true`, headless, same scripted
6-section walkthrough both times.

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

`VITE_USE_MOCK_DATA=true` is required. The benchmark's scripted walkthrough submits a real survey response, and mock mode keeps that from touching any real database.
