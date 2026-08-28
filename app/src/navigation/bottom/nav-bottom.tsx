import { Profiler, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { profilerOnRender, recordOwnRender } from "../../render-test/renderProfilerStats";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app-core/state/ui-store";
import { useWindowAspectRatio } from "../../lib/hooks/useWindowAspectRatio";
import { useWindowWidth } from "../../lib/hooks/useWindowWidth";
import { isDesktopWidth, isMobileWidth, isTabletWidth } from "../../lib/responsive/breakpoints";
import { graphToolsOffsetPx } from "../../lib/responsive/graph-tools-offset";
import ModeToggle from "./mode-toggle";
import LogsButton from "./logs-button";
import WidgetsButton from "./widgets-button";
import MyCityButton from "./my-city-button";
import CityStatsButton from "./city-stats-button";
import QuestionnaireNav from "./questionnaire-nav";
import CompactToolsButton from "./compact-tools-button";

function NavBottom({ introActive = false }: { introActive?: boolean }) {
  recordOwnRender("NavBottom");
  const {
    cityPanelOpen,
    questionnaireOpen,
    vizVisible,
    logsOpen,
    setLogsOpen,
    widgetsOpen,
    setWidgetsOpen,
    questionnaireTotal,
  } = useUiStore(
    useShallow((s) => ({
      cityPanelOpen: s.cityPanelOpen,
      questionnaireOpen: s.questionnaireOpen,
      vizVisible: s.vizVisible,
      logsOpen: s.logsOpen,
      setLogsOpen: s.setLogsOpen,
      widgetsOpen: s.widgetsOpen,
      setWidgetsOpen: s.setWidgetsOpen,
      questionnaireTotal: s.questionnaireNav.total,
    }))
  );
  const windowWidth = useWindowWidth();
  const aspectRatio = useWindowAspectRatio();
  // Compact nav now covers tablet too (iPad-vertical migration) - only
  // desktop width still gets the separated Logs/Widgets/ModeToggle layout.
  const useCompactGraphNav = isMobileWidth(windowWidth) || isTabletWidth(windowWidth);
  const showSeparatedGraphTools = vizVisible && !useCompactGraphNav;
  const visibleLogsOpen = showSeparatedGraphTools && logsOpen;
  const visibleWidgetsOpen = showSeparatedGraphTools && widgetsOpen;
  const pickerOffset = isDesktopWidth(windowWidth) ? graphToolsOffsetPx(visibleLogsOpen, visibleWidgetsOpen) * aspectRatio : 0;
  const widgetsRef = useRef<HTMLDivElement | null>(null);
  const logsWrapRef = useRef<HTMLDivElement | null>(null);
  const modeToggleRef = useRef<HTMLDivElement | null>(null);
  const [logsSlide, setLogsSlide] = useState(0);
  const [modeToggleShiftPx, setModeToggleShiftPx] = useState(0);

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
      <div className={`nav-bottom bottom-left${introActive ? " nav-first-enter" : ""}`}>
        <MyCityButton />
        {showSeparatedGraphTools && (
          <div ref={logsWrapRef}>
            <LogsButton open={visibleLogsOpen} onOpenChange={setLogsOpen} />
          </div>
        )}
        {showSeparatedGraphTools && (
          <div ref={widgetsRef} style={{ marginLeft: logsSlide > 0 ? `calc(${String(logsSlide)}px + 0.3rem)` : visibleWidgetsOpen ? '0.3rem' : undefined }}>
            <WidgetsButton open={visibleWidgetsOpen} onOpenChange={setWidgetsOpen} />
          </div>
        )}
      </div>
      {vizVisible && (
        <div
          ref={modeToggleRef}
          className={`nav-bottom ${useCompactGraphNav ? "bottom-mobile-right" : "bottom-center"}`}
          style={
            useCompactGraphNav
              ? undefined
              : { transform: `translateX(calc(-50% + ${String(modeToggleShiftPx)}px))`, transition: "transform 0.2s ease" }
          }
        >
          <Profiler id="ModeToggle" onRender={profilerOnRender}>
            <ModeToggle />
          </Profiler>
          {useCompactGraphNav && (
            <>
              <CompactToolsButton />
              <CityStatsButton />
            </>
          )}
        </div>
      )}
      {questionnaireOpen && !vizVisible && questionnaireTotal > 0 && (
        <div
          className={`nav-bottom bottom-right${cityPanelOpen ? " is-behind-city-canvas" : ""}${introActive ? " nav-first-enter" : ""}`}
          style={{ transform: `translateX(${String(pickerOffset)}px)`, transition: "transform 0.2s ease" }}
        >
          <QuestionnaireNav />
        </div>
      )}
      {showSeparatedGraphTools && (
        <div className={`nav-bottom bottom-right${introActive ? " nav-first-enter" : ""}`}>
          <CityStatsButton />
        </div>
      )}
    </>
  );
}

export default memo(NavBottom);
