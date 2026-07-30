import { Profiler, Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { profilerOnRender, recordOwnRender } from "../../render-test/renderProfilerStats";
import "../../styles/widgets.css";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app/state/ui-store";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { GraphDataProvider } from "../../graph-runtime/GraphDataContext";
import { useEscapeToClose } from "../../lib/hooks/useEscapeToClose";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { useTransientFlag } from "../../lib/hooks/useTransientFlag";
import { useWindowAspectRatio } from "../../lib/hooks/useWindowAspectRatio";
import { useWindowWidth } from "../../lib/hooks/useWindowWidth";
import { isDesktopWidth, isMobileWidth } from "../../lib/responsive/breakpoints";
import { graphToolsOffsetPx } from "../../lib/responsive/graph-tools-offset";
import ModeToggle from "./mode-toggle";
import LogsButton from "./logs-button";
import SectionScores from "./widgets/section-scores";
import CompactGraphTools from "./widgets/compact-graph-tools";

const BarGraph = lazy(() => import("./widgets/bargraph/index"));
type WidgetView = "bar" | "questions";

function NavBottom({ introActive = false }: { introActive?: boolean }) {
  recordOwnRender("NavBottom");
  const {
    cityPanelOpen,
    setCityPanelOpen,
    questionnaireOpen,
    vizVisible,
    logsOpen,
    setLogsOpen,
    widgetsOpen,
    setWidgetsOpen,
    questionnaireNav,
    requestQuestionnaireAdvance,
  } = useUiStore(
    useShallow((s) => ({
      cityPanelOpen: s.cityPanelOpen,
      setCityPanelOpen: s.setCityPanelOpen,
      questionnaireOpen: s.questionnaireOpen,
      vizVisible: s.vizVisible,
      logsOpen: s.logsOpen,
      setLogsOpen: s.setLogsOpen,
      widgetsOpen: s.widgetsOpen,
      setWidgetsOpen: s.setWidgetsOpen,
      questionnaireNav: s.questionnaireNav,
      requestQuestionnaireAdvance: s.requestQuestionnaireAdvance,
    }))
  );
  const allFilteredRows = useSurveyDataStore((s) => s.allFilteredRows);
  const windowWidth = useWindowWidth();
  const aspectRatio = useWindowAspectRatio();
  const useCompactGraphNav = isMobileWidth(windowWidth);
  const showSeparatedGraphTools = vizVisible && !useCompactGraphNav;
  const visibleLogsOpen = showSeparatedGraphTools && logsOpen;
  const visibleWidgetsOpen = showSeparatedGraphTools && widgetsOpen;
  const pickerOffset = isDesktopWidth(windowWidth) ? graphToolsOffsetPx(visibleLogsOpen, visibleWidgetsOpen) * aspectRatio : 0;
  const [activeWidgetView, setActiveWidgetView] = useState<WidgetView>("bar");
  const [widgetAutoplayPaused, setWidgetAutoplayPaused] = useState(true);
  const widgetsRef = useRef<HTMLDivElement | null>(null);
  const widgetsDialogRef = useRef<HTMLDivElement | null>(null);
  const widgetsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const logsWrapRef = useRef<HTMLDivElement | null>(null);
  const modeToggleRef = useRef<HTMLDivElement | null>(null);
  const [logsSlide, setLogsSlide] = useState(0);
  const [modeToggleShiftPx, setModeToggleShiftPx] = useState(0);
  const { visible: showQuestionnaireDisabledHint, show: flashQuestionnaireDisabledHint } = useTransientFlag(2200);
  const questionnaireDisabledHintVisible =
    showQuestionnaireDisabledHint && questionnaireNav.nextDisabled;
  const closeWidgets = useCallback(() => {
    setActiveWidgetView("bar");
    setWidgetsOpen(false);
  }, [setWidgetsOpen]);
  const toggleWidgetsOpen = useCallback(() => {
    if (visibleWidgetsOpen) {
      closeWidgets();
      return;
    }
    setActiveWidgetView("bar");
    setWidgetsOpen(true);
  }, [closeWidgets, setWidgetsOpen, visibleWidgetsOpen]);

  useEscapeToClose(visibleWidgetsOpen, closeWidgets);
  useFocusTrap({ enabled: visibleWidgetsOpen, containerRef: widgetsDialogRef, returnFocusRef: widgetsTriggerRef });

  useLayoutEffect(() => {
    const logsWrap = logsWrapRef.current;
    if (!visibleLogsOpen || !logsWrap) {
      setLogsSlide(0);
      return;
    }

    const logsShell = logsWrap.querySelector<HTMLElement>(".logs-popover-shell");
    const panelWidth = logsShell?.getBoundingClientRect().width ?? logsWrap.getBoundingClientRect().width;
    const btnWidth = logsWrap.getBoundingClientRect().width;
    setLogsSlide(Math.max(0, panelWidth - btnWidth));
  }, [visibleLogsOpen, windowWidth]);

  useEffect(() => {
    if (showSeparatedGraphTools) return;
    setLogsOpen(false);
    setWidgetsOpen(false);
  }, [showSeparatedGraphTools, setLogsOpen, setWidgetsOpen]);

  useLayoutEffect(() => {
    if (!vizVisible || !modeToggleRef.current || useCompactGraphNav) {
      setModeToggleShiftPx(0);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const modeToggleWidth = modeToggleRef.current?.offsetWidth ?? 0;
      const rootFontSize =
        typeof window !== "undefined"
          ? parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16
          : 16;
      const overlapGapPx = rootFontSize * 0.4;
      const panelGapPx = rootFontSize * 0.3;

      const logsWrapRect = logsWrapRef.current?.getBoundingClientRect();
      const logsShell = logsWrapRef.current?.querySelector<HTMLElement>(".logs-popover-shell.is-open");
      const logsButton = logsWrapRef.current?.querySelector<HTMLElement>(".logs-button");
      const widgetsShell = widgetsRef.current?.querySelector<HTMLElement>(".widgets-popover-shell.is-open");
      const widgetsButton = widgetsRef.current?.querySelector<HTMLElement>(".widgets-button");

      const toolsLeft = logsWrapRect?.left ?? 0;
      const logsButtonWidth = logsButton?.getBoundingClientRect().width ?? logsWrapRect?.width ?? 0;
      const logsPanelWidth = logsShell?.getBoundingClientRect().width ?? logsButtonWidth;
      const widgetsButtonWidth = widgetsButton?.getBoundingClientRect().width ?? 0;
      const widgetsPanelWidth = widgetsShell?.getBoundingClientRect().width ?? widgetsButtonWidth;
      const logsRight = visibleLogsOpen ? toolsLeft + logsPanelWidth : 0;
      const widgetsControlWidth = visibleWidgetsOpen ? widgetsPanelWidth : widgetsButtonWidth;
      const widgetsRight = toolsLeft + (visibleLogsOpen ? logsPanelWidth : logsButtonWidth) + panelGapPx + widgetsControlWidth;
      const occupiedRight = Math.max(logsRight, widgetsRight);

      let shiftPx = 0;

      shiftPx = pickerOffset;
      const projectedLeft = window.innerWidth / 2 - modeToggleWidth / 2 + shiftPx;
      const overlapPx = occupiedRight + overlapGapPx - projectedLeft;

      if (overlapPx > 0) shiftPx += overlapPx;

      setModeToggleShiftPx((prev) => (Math.abs(prev - shiftPx) < 0.5 ? prev : shiftPx));
    });

    return () => { window.cancelAnimationFrame(frame); };
  }, [
    vizVisible,
    useCompactGraphNav,
    visibleLogsOpen,
    visibleWidgetsOpen,
    logsSlide,
    pickerOffset,
    windowWidth,
  ]);

  if (!cityPanelOpen && !questionnaireOpen && !vizVisible) return null;

  return (
    <>
      <div className={`bottom bottom-left${introActive ? " nav-first-enter" : ""}`}>
        {(cityPanelOpen || questionnaireOpen) && (
          <button
            type="button"
            className="city-button city-close-btn"
            data-label={cityPanelOpen ? "Back" : "My city"}
            onClick={() => { setCityPanelOpen(!cityPanelOpen); }}
            aria-label={cityPanelOpen ? "Back to questionnaire" : "Open city view"}
          >
            <span className="city-button__inner">
              <span>{cityPanelOpen ? "Back" : "My city"}</span>
            </span>
          </button>
        )}
        {showSeparatedGraphTools && (
          <div ref={logsWrapRef}>
            <LogsButton open={visibleLogsOpen} onOpenChange={setLogsOpen} />
          </div>
        )}
        {showSeparatedGraphTools && (
          <div className="widgets-wrap" ref={widgetsRef} style={{ marginLeft: logsSlide > 0 ? `calc(${String(logsSlide)}px + 0.3rem)` : visibleWidgetsOpen ? '0.3rem' : undefined }}>
            <div
              className={`widgets-popover-shell${visibleWidgetsOpen ? " is-open" : ""}`}
              aria-hidden={!visibleWidgetsOpen}
            >
              <div className="widgets-popover-clip">
                <div ref={widgetsDialogRef} className="widgets-popover" role="dialog" aria-label="Widgets" aria-modal="true">
                  {activeWidgetView === "bar" && (
                    <GraphDataProvider data={allFilteredRows}>
                      <Suspense fallback={null}>
                        <Profiler id="BarGraph:nav-bottom" onRender={profilerOnRender}>
                          <BarGraph
                            navOutsidePanel
                            panelClassName="widgets-view widgets-panel bar-graph"
                            paused={widgetAutoplayPaused}
                            onPausedChange={setWidgetAutoplayPaused}
                          />
                        </Profiler>
                      </Suspense>
                    </GraphDataProvider>
                  )}
                  {activeWidgetView === "questions" && (
                    <SectionScores
                      navOutsidePanel
                      panelClassName="widgets-view widgets-panel q-scores"
                      paused={widgetAutoplayPaused}
                      onPausedChange={setWidgetAutoplayPaused}
                    />
                  )}
                  <div className="widgets-tabs" role="tablist" aria-label="Widgets">
                    <button
                      type="button"
                      className={`ui-toggle-option widgets-tab${activeWidgetView === "bar" ? " is-active" : ""}`}
                      role="tab"
                      aria-selected={activeWidgetView === "bar"}
                      onClick={() => { setActiveWidgetView("bar"); }}
                    >
                      Bar graph
                    </button>
                    <button
                      type="button"
                      className={`ui-toggle-option widgets-tab${activeWidgetView === "questions" ? " is-active" : ""}`}
                      role="tab"
                      aria-selected={activeWidgetView === "questions"}
                      onClick={() => { setActiveWidgetView("questions"); }}
                    >
                      By question
                    </button>
                  </div>
                  <div className="widgets-footer">
                    <button
                      type="button"
                      className="widgets-close-strip"
                      aria-label="Close widgets"
                      onClick={closeWidgets}
                    >
                      <CloseIcon className="ui-close" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              ref={widgetsTriggerRef}
              type="button"
              className="widgets-button"
              data-label="Widgets"
              aria-expanded={visibleWidgetsOpen}
              aria-haspopup="dialog"
              aria-label="Widgets"
              onClick={toggleWidgetsOpen}
            >
              <span className="widgets-button__inner">Widgets</span>
            </button>
          </div>
        )}
      </div>
      {questionnaireOpen && !vizVisible && questionnaireNav.total > 0 && (
        <div className={`bottom bottom-right${cityPanelOpen ? " is-behind-city-canvas" : ""}${introActive ? " nav-first-enter" : ""}`}>
          <div className="questionnaire-nav-stack">
            <p
              className="q-step-indicator questionnaire-nav-progress"
              aria-live="polite"
              aria-atomic="true"
            >
              {questionnaireNav.step} / {questionnaireNav.total}
            </p>
            <div className="questionnaire-nav-action">
              <div
                className={`questionnaire-nav-hint${questionnaireDisabledHintVisible ? " is-visible" : ""}`}
                role="status"
                aria-live="polite"
              >
                <span>Select at least one answer.</span>
              </div>
              <button
                type="button"
                className={`questionnaire${questionnaireNav.nextDisabled ? " is-disabled" : ""}`}
                data-label={questionnaireNav.nextLabel}
                aria-disabled={questionnaireNav.nextDisabled}
                onClick={() => {
                  if (questionnaireNav.nextDisabled) {
                    flashQuestionnaireDisabledHint();
                    return;
                  }
                  requestQuestionnaireAdvance();
                }}
                aria-label={
                  questionnaireNav.nextLabel === "Finish"
                    ? "Finish survey and open results"
                    : "Next question"
                }
              >
                <span className="questionnaire__ghost" aria-hidden="true">
                  <span>{questionnaireNav.nextLabel}</span>
                </span>
                <span className="questionnaire__inner">
                  <span>{questionnaireNav.nextLabel}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
      {vizVisible && (
        <div
          ref={modeToggleRef}
          className={`bottom ${useCompactGraphNav ? "bottom-mobile-right" : "bottom-center"}`}
          style={
            useCompactGraphNav
              ? undefined
              : { transform: `translateX(calc(-50% + ${String(modeToggleShiftPx)}px))`, transition: "transform 0.2s ease" }
          }
        >
          <Profiler id="ModeToggle" onRender={profilerOnRender}>
            <ModeToggle />
          </Profiler>
          {useCompactGraphNav && <CompactGraphTools />}
        </div>
      )}
    </>
  );
}

export default memo(NavBottom);
