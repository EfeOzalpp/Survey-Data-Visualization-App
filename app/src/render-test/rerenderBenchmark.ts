// src/render-test/rerenderBenchmark.ts
// Benchmarking script for the Context re-render comparison.
// Requires the dev server already running (npm run dev) at BENCH_URL below.
// Run with: npx tsx src/render-test/rerenderBenchmark.ts
// Or via npm run bench:zustand (subtree-commit table only) / npm run bench:memo (own-render table only)

import { chromium, type Page } from "playwright";

const APP_URL = process.env.BENCH_URL ?? "http://localhost:5173";

// --metric=subtree prints only the <Profiler> subtree-commit table (what moves
// with Context vs Zustand). --metric=own prints only the own-render table
// (what moves with memo). Default prints both, as before.
type Metric = "subtree" | "own" | "both";
const METRIC: Metric = (() => {
  const raw = process.argv.find((a) => a.startsWith("--metric="))?.split("=")[1];
  return raw === "subtree" || raw === "own" ? raw : "both";
})();

// One entry per question in BUTTON_QUESTIONS (button-questions.ts), each value
// is how many distinct answer options to select for that question.
const ANSWERS_PER_QUESTION = [1, 2, 1, 3, 2];

async function setRangeValue(page: Page, selector: string, value: string) {
  await page.locator(selector).evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function dragRangeSlider(
  page: Page,
  selector: string,
  from: number,
  to: number,
  steps: number,
  durationMs: number
) {
  const stepDelay = durationMs / steps;
  for (let i = 1; i <= steps; i += 1) {
    const value = from + ((to - from) * i) / steps;
    await setRangeValue(page, selector, value.toFixed(2));
    await page.waitForTimeout(stepDelay);
  }
}

async function cycleWidgetSectionNav(page: Page) {
  const nextButton = page.getByRole("button", { name: "Next section", exact: true });
  for (let i = 0; i < 3; i += 1) {
    await nextButton.click();
    await page.waitForTimeout(1000);
  }

  const pauseButton = page.getByRole("button", { name: /section autoplay/ });
  await pauseButton.click();
  await page.waitForTimeout(1000);
  await pauseButton.click();
}

interface RenderRow { id: string; renders: number; totalMs: number }
interface OwnRenderRow { id: string; renders: number }

async function logSection(page: Page, label: string) {
  const { total, rows } = await page.evaluate(
    () =>
      (window as unknown as { __renderStats: { log: () => { total: number; rows: RenderRow[] } } })
        .__renderStats.log()
  );
  const { rows: ownRows } = await page.evaluate(
    () =>
      (window as unknown as { __ownRenderStats: { log: () => { rows: OwnRenderRow[] } } })
        .__ownRenderStats.log()
  );
  const ownTotal = ownRows.reduce((sum, row) => sum + row.renders, 0);
  // Only the <Profiler> subtree table carries React's actualDuration; own-render
  // tracking is a plain counter with no timing, so main-thread ms can only be
  // summed from the subtree rows.
  const subtreeMs = rows.reduce((sum, row) => sum + row.totalMs, 0);

  if (METRIC !== "own") {
    console.log(`\n=== ${label} ===`);
    console.table([...rows].sort((a, b) => b.renders - a.renders));
    console.log(`${label} total:`, total);
    console.log(`${label} total ms:`, Number(subtreeMs.toFixed(2)));
  }
  if (METRIC !== "subtree") {
    console.log(`${METRIC === "own" ? "\n===" : "---"} ${label}: own-render counts (component's own body only) ${METRIC === "own" ? "===" : "---"}`);
    console.table(ownRows);
    if (METRIC === "own") console.log(`${label} own-render total:`, ownTotal);
  }

  await page.evaluate(() => {
    (window as unknown as { __renderStats: { reset: () => void } }).__renderStats.reset();
    (window as unknown as { __ownRenderStats: { reset: () => void } }).__ownRenderStats.reset();
  });
  return { subtreeTotal: total, subtreeMs, ownTotal };
}

async function run() {
  const browser = await chromium.launch({ headless: process.env.HEADLESS === "true" });
  const page = await browser.newPage(); // fresh, disposable context every run

  await page.goto(APP_URL);

  await page.waitForFunction(
    () => Boolean((window as unknown as { __renderStats?: unknown }).__renderStats)
  );
  await page.evaluate(() => {
    (window as unknown as { __renderStats: { reset: () => void } }).__renderStats.reset();
    (window as unknown as { __ownRenderStats: { reset: () => void } }).__ownRenderStats.reset();
  });
  await page.waitForTimeout(1000);

  const sectionTotals: Record<string, { subtreeTotal: number; subtreeMs: number; ownTotal: number }> = {};

  // --- Theme toggle: light, then back to dark after 1s, before anything else ---
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await page.waitForTimeout(1000);
  sectionTotals["Theme toggle"] = await logSection(page, "Theme toggle");

  // --- Observer/graph view: open, then close after 3s ---
  // Reachable here because isSurveyActive is still false pre-survey.
  await page.getByRole("button", { name: "Check Results", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForTimeout(1000);
  sectionTotals["Pre-survey graph view toggle"] = await logSection(page, "Pre-survey graph view toggle");

  // --- Scroll down to the CanvasInfo spotlight controls ---
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(1000);

  await page.locator(".canvas-info__slider-button--pause").waitFor();
  await page.locator(".canvas-info__slider-button--pause").click();
  await page.waitForTimeout(1000);

  const nextPreviewButton = page
    .locator(".ui-icon-nav-button.canvas-info__slider-button:not(.canvas-info__slider-button--pause)")
    .first();
  for (let i = 0; i < 3; i += 1) {
    await nextPreviewButton.click();
    await page.waitForTimeout(2000);
  }

  await dragRangeSlider(page, ".canvas-info__liveavg-slider", 0.5, 1, 10, 1000);
  await page.waitForTimeout(1000);
  sectionTotals["CanvasInfo spotlight controls"] = await logSection(page, "CanvasInfo spotlight controls");

  // --- Scroll back up to the role picker ---
  await page.locator(".role-select").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // --- Role + section: MassArt Student, then top department, then Continue ---
  await page.getByRole("radio", { name: /massart student/i }).click();
  await page.waitForTimeout(1000);
  await page.locator(".begin-button").click();
  await page.waitForTimeout(1000);

  await page.locator("#section-combobox-input").click();
  await page.waitForTimeout(1000);
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(1000);
  await page.locator(".section-continue-button").click();
  sectionTotals["Role + section pick"] = await logSection(page, "Role + section pick");

  // --- Questionnaire: answer per ANSWERS_PER_QUESTION, city toggle between q2/q3 ---
  await page.locator(".button-questionnaire__button").first().waitFor();

  for (let questionIndex = 0; questionIndex < ANSWERS_PER_QUESTION.length; questionIndex += 1) {
    const answerCount = ANSWERS_PER_QUESTION[questionIndex];
    const options = page.locator(".button-questionnaire__button");

    for (let optionIndex = 0; optionIndex < answerCount; optionIndex += 1) {
      await options.nth(optionIndex).click();
      await page.waitForTimeout(1000);
    }

    const isLastQuestion = questionIndex === ANSWERS_PER_QUESTION.length - 1;

    if (questionIndex === 1) {
      // Between question 2 and 3: toggle city view, wait 4s, then close it.
      await page.getByRole("button", { name: "Open city view", exact: true }).click();
      await page.waitForTimeout(4000);
      await page.getByRole("button", { name: "Back to questionnaire", exact: true }).click();
    }

    if (isLastQuestion) {
      await page.getByRole("button", { name: "Finish survey and open results", exact: true }).click();
      break;
    }

    await page.getByRole("button", { name: "Next question", exact: true }).click();
    await page.locator(".button-questionnaire__button").first().waitFor();
  }
  sectionTotals.Questionnaire = await logSection(page, "Questionnaire");

  // --- Graph runtime area (post-submit) ---
  await page.waitForTimeout(1000);

  await page.getByRole("radio", { name: "team", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("radio", { name: "solo", exact: true }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Close personalized panel", exact: true }).click();
  await page.waitForTimeout(1000);

  await page.locator(".graph-picker .trigger").click();
  await page.locator("#opt-visitor").click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Close logs", exact: true }).click();

  await page.getByRole("button", { name: "Widgets", exact: true }).click();
  await cycleWidgetSectionNav(page);

  await page.getByRole("tab", { name: "By question", exact: true }).click();
  await cycleWidgetSectionNav(page);

  await page.getByRole("button", { name: "Close widgets", exact: true }).click();
  sectionTotals["Graph runtime (post-submit)"] = await logSection(page, "Graph runtime (post-submit)");

  const totals = Object.values(sectionTotals);
  const grandSubtreeTotal = totals.reduce((sum, t) => sum + t.subtreeTotal, 0);
  const grandSubtreeMs = totals.reduce((sum, t) => sum + t.subtreeMs, 0);
  const grandOwnTotal = totals.reduce((sum, t) => sum + t.ownTotal, 0);

  console.log("\n=== Section totals ===");
  if (METRIC !== "own") {
    console.table(
      Object.fromEntries(Object.entries(sectionTotals).map(([k, v]) => [k, v.subtreeTotal]))
    );
    console.log("Grand total across all sections (subtree commits):", grandSubtreeTotal);
    console.log("Grand total across all sections (subtree ms):", Number(grandSubtreeMs.toFixed(2)));
  }
  if (METRIC !== "subtree") {
    console.table(
      Object.fromEntries(Object.entries(sectionTotals).map(([k, v]) => [k, v.ownTotal]))
    );
    console.log("Grand total across all sections (own-renders):", grandOwnTotal);
  }

  await browser.close();
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
