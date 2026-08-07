// src/app/main.tsx

import React, { Profiler, Suspense } from "react";

import { AppProvider } from "./app-provider";
import ClientOnly from "./client-only"; // wrapper to exclude certain files from server-side rendering.
import { useUiStore } from "./state/ui-store";
import { profilerOnRender, recordOwnRender } from "../render-test/renderProfilerStats";
import PlayIcon from "../assets/svg/info/PlayIcon";

import Survey from "../onboarding"; // survey is included in server-side.
import Navigation from "../navigation"; // navigation is included in server-side.

// gated via ClientOnly
import DataVisualization from "../graph-runtime";
import CanvasEntry from "../canvas-instances/OnboardingEntry";
import CityOverlay from "../canvas-instances/CityEntry";

import {
  AppBrowserPolicies,
  DeferredGraphPreloader,
  DeferredGamificationPreloader,
  DuplicateSurveyBanner,
  RateLimitBanner,
  SurveyDataStatusBanner,
} from "./app-effects";
import ErrorBoundary from "./error-boundary";

import "../styles/fonts.css";
import "../styles/global-styles.css";
import "../styles/ui-system.css";

const QuestionnaireEntry = React.lazy(() => import("../canvas-instances/QuestionnaireEntry"));
const GraphBGDark = React.lazy(() => import("../navigation/right/system-color"));
const AppInner: React.FC = () => {
  recordOwnRender("AppInner");
  const vizVisible = useUiStore((s) => s.vizVisible);
  const questionnaireOpen = useUiStore((s) => s.questionnaireOpen);
  const cityPanelOpen = useUiStore((s) => s.cityPanelOpen);
  const animationVisible = useUiStore((s) => s.animationVisible);
  const setInfoOpen = useUiStore((s) => s.setInfoOpen);

  return (
    <main id="main-content" className="app-content">
      <ClientOnly>
        <AppBrowserPolicies questionnaireOpen={questionnaireOpen} vizVisible={vizVisible} />
        <SurveyDataStatusBanner />
        <RateLimitBanner />
        <DuplicateSurveyBanner />
        <DeferredGraphPreloader />
        <DeferredGamificationPreloader />
      </ClientOnly>

      {vizVisible && (
        <ClientOnly>
          <Suspense fallback={null}>
            <GraphBGDark />
          </Suspense>
        </ClientOnly>
      )}

      <Profiler id="Navigation" onRender={profilerOnRender}>
        <Navigation />
      </Profiler>

      {!vizVisible && !animationVisible && !cityPanelOpen && !questionnaireOpen && (
        <div className="welcome-title-layer">
          <div className="welcome-title-inner">
            <h1 className="welcome-title">Butterfly Effect</h1>
            <button
              type="button"
              className="more-info-trigger"
              aria-haspopup="dialog"
              onClick={() => {
                // Synchronous, inside this real click: iOS Safari exempts
                // muted video from gesture rules only for the declarative
                // `autoplay` attribute, not for script-triggered play(), and
                // only within a trusted event's own callstack — not a
                // useEffect that runs after commit. InfoDialog is always
                // mounted (hidden via CSS), so its video element already
                // exists; priming it here, right here, is what makes later
                // auto-advanced slides (no gesture behind them) keep playing.
                const primer = document.querySelector('video[data-info-video-primer]');
                if (primer instanceof HTMLVideoElement) {
                  primer.muted = true;
                  primer.defaultMuted = true;
                  void primer.play().catch(() => {});
                }
                setInfoOpen(true);
              }}
            >
              {/* span, not p - <button> only accepts phrasing content, a <p>
                  here would be invalid nesting (same reason the icon used to
                  be its own nested button before this was one clickable
                  element - see git history on this block). */}
              <span className="more-info-trigger__label">Watch how it works</span>
              <span className="more-info-trigger__duration">(60 sec)</span>
              <span className="more-info-trigger__icon-box" aria-hidden="true">
                <PlayIcon className="ui-icon more-info-trigger__icon" />
              </span>
            </button>
          </div>
        </div>
      )}

      {!vizVisible && !animationVisible && !cityPanelOpen && !questionnaireOpen && (
        <ClientOnly>
          <ErrorBoundary name="CanvasEntry">
            <Profiler id="CanvasEntry" onRender={profilerOnRender}>
              <CanvasEntry visible={true} />
            </Profiler>
          </ErrorBoundary>
        </ClientOnly>
      )}

      {!vizVisible && !animationVisible && !cityPanelOpen && questionnaireOpen && (
        <ClientOnly>
          <ErrorBoundary name="QuestionnaireEntry">
            <Suspense fallback={null}>
              <Profiler id="QuestionnaireEntry" onRender={profilerOnRender}>
                <QuestionnaireEntry visible={true} />
              </Profiler>
            </Suspense>
          </ErrorBoundary>
        </ClientOnly>
      )}

      {cityPanelOpen && (
        <ClientOnly>
          <ErrorBoundary name="CityOverlay">
            <Profiler id="CityOverlay" onRender={profilerOnRender}>
              <CityOverlay open={true} />
            </Profiler>
          </ErrorBoundary>
        </ClientOnly>
      )}

      {vizVisible && (
        <ClientOnly>
          <div className="graph-wrapper visible">
            <ErrorBoundary name="DataVisualization">
              <DataVisualization />
            </ErrorBoundary>
          </div>
        </ClientOnly>
      )}

      <div className={`user-flow${questionnaireOpen ? " questionnaire-active" : ""}${vizVisible ? " graph-active" : ""}`}>
        <ErrorBoundary name="Survey">
          <Profiler id="Survey" onRender={profilerOnRender}>
            <Survey />
          </Profiler>
        </ErrorBoundary>
      </div>
    </main>
  );
};

const AppShell: React.FC = () => (
  <AppProvider>
    <Profiler id="AppInner" onRender={profilerOnRender}>
      <AppInner />
    </Profiler>
  </AppProvider>
);

export default AppShell;
