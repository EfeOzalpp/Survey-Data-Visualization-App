import type { CSSProperties } from "react";
import { memo, useState } from "react";

import ColorToggle from "./theme-toggle";
import BackIcon from "../../assets/svg/back/BackIcon";
import GraphPicker from "../../graph-components/graph-picker/graph-picker";
import { getSessionItem } from "../../app/session";
import { useIdentity } from "../../app/state/identity-context";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app/state/ui-store";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { useCanvasRuntimeStore } from "../../app/state/canvas-runtime-store";
import { useWindowAspectRatio } from "../../lib/hooks/useWindowAspectRatio";
import { useWindowWidth } from "../../lib/hooks/useWindowWidth";
import { isDesktopWidth, isTabletWidth } from "../../lib/responsive/breakpoints";
import { desktopGraphToolsOffsetPx } from "../../lib/responsive/graph-tools-offset";
import { recordOwnRender } from "../../render-test/renderProfilerStats";

const DEFAULT_SECTION = "fine-arts";
const cx = (...parts: (string | boolean | undefined)[]) => parts.filter(Boolean).join(" ");
type PickerOffsetStyle = CSSProperties & { "--picker-offset": string };

function NavRight({ isDark, introActive = false }: { isDark: boolean; introActive?: boolean }) {
  recordOwnRender("NavRight");
  const {
    isSurveyActive,
    setSurveyActive,
    hasCompletedSurvey,
    setHasCompletedSurvey,
    observerMode,
    setObserverMode,
    openGraph,
    closeGraph,
    resetToStart,
    logsOpen,
    widgetsOpen,
    questionnaireOpen,
    vizVisible,
    cityPanelOpen,
    setCityPanelOpen,
  } = useUiStore(
    useShallow((s) => ({
      isSurveyActive: s.isSurveyActive,
      setSurveyActive: s.setSurveyActive,
      hasCompletedSurvey: s.hasCompletedSurvey,
      setHasCompletedSurvey: s.setHasCompletedSurvey,
      observerMode: s.observerMode,
      setObserverMode: s.setObserverMode,
      openGraph: s.openGraph,
      closeGraph: s.closeGraph,
      resetToStart: s.resetToStart,
      logsOpen: s.logsOpen,
      widgetsOpen: s.widgetsOpen,
      questionnaireOpen: s.questionnaireOpen,
      vizVisible: s.vizVisible,
      cityPanelOpen: s.cityPanelOpen,
      setCityPanelOpen: s.setCityPanelOpen,
    }))
  );
  const { section, setSection } = useSurveyDataStore(
    useShallow((s) => ({ section: s.section, setSection: s.setSection }))
  );
  const { myEntryId, mySection, setMyEntryId, setMySection, setMyRole } = useIdentity();
  const setLiveAvg = useCanvasRuntimeStore((s) => s.setLiveAvg);
  const windowWidth = useWindowWidth();
  const aspectRatio = useWindowAspectRatio();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerOffset = isDesktopWidth(windowWidth)
    ? desktopGraphToolsOffsetPx(windowWidth, logsOpen, widgetsOpen, aspectRatio)
    : isTabletWidth(windowWidth)
      ? 0
      : (pickerOpen ? 0 : -30);

  const showPicker = (observerMode || hasCompletedSurvey) && !isSurveyActive;
  const showObserverButton = !isSurveyActive || observerMode || hasCompletedSurvey;
  const observerLabel = observerMode || hasCompletedSurvey ? "Back" : "Explore Results";
  const savedEntryId = myEntryId;
  const savedSection = mySection;
  const hasSavedSubmission = Boolean(savedEntryId && savedSection);
  const showSavedCityButton =
    hasSavedSubmission &&
    !isSurveyActive &&
    !observerMode &&
    !hasCompletedSurvey &&
    !vizVisible;
  const pickerStyle: PickerOffsetStyle = {
    "--picker-offset": `${String(pickerOffset)}px`,
    transition: "transform 0.2s ease",
  };

  const openSavedCity = () => {
    if (!savedEntryId || !savedSection) return;
    setMyEntryId(savedEntryId);
    setMySection(savedSection);
    setMyRole(getSessionItem("be.myRole"));
    setSection(savedSection);
    const storedAvg = getSessionItem("be.myAvg");
    if (storedAvg !== null) {
      const parsed = parseFloat(storedAvg);
      if (Number.isFinite(parsed)) setLiveAvg(parsed);
    }
    setCityPanelOpen(!cityPanelOpen);
  };

  const toggleObserverMode = () => {
    if (hasCompletedSurvey && !observerMode) {
      resetToStart();
      return;
    }

    if (!observerMode && !hasCompletedSurvey && savedEntryId && savedSection && !questionnaireOpen) {
      setMyEntryId(savedEntryId);
      setMySection(savedSection);
      setMyRole(getSessionItem("be.myRole"));
      setHasCompletedSurvey(true);
      setObserverMode(false);
      setSurveyActive(false);
      setSection(savedSection);
      openGraph();
      return;
    }

    const next = !observerMode;
    setObserverMode(next);

    if (next) {
      if (!section) setSection(DEFAULT_SECTION);
      setSurveyActive(false);
      openGraph();
      return;
    }

    if (!hasCompletedSurvey) closeGraph();
  };

  return (
    <>
      <div className={cx("right", isDark && "is-dark", introActive && "nav-first-enter")}>
        <ColorToggle />

        {showObserverButton && (
          observerLabel === "Back" ? (
            <button
              type="button"
              className="svg-lg back-nav-button"
              onClick={toggleObserverMode}
              aria-label="Back"
            >
              <BackIcon />
            </button>
          ) : (
            <button
              className={cx("observe-results", observerMode && "active")}
              onClick={toggleObserverMode}
              aria-pressed={observerMode || hasCompletedSurvey}
              aria-label="Explore Results"
              data-label={observerLabel}
            >
              <span className="observe-results__ghost" aria-hidden="true">{observerLabel}</span>
              <span className="observe-results__inner">{observerLabel}</span>
            </button>
          )
        )}

        {showSavedCityButton && (
          <button
            type="button"
            className="city-button city-top-button"
            data-label={cityPanelOpen ? "Back" : "My city"}
            onClick={openSavedCity}
            aria-label={cityPanelOpen ? "Back to home" : "Open my city"}
          >
            <span className="city-button__inner">
              <span>{cityPanelOpen ? "Back" : "My city"}</span>
            </span>
          </button>
        )}
      </div>
      {showPicker && (
        <div
          className="graph-picker"
          style={pickerStyle}
        >
          <GraphPicker value={section} onChange={setSection} onOpenChange={setPickerOpen} />
        </div>
      )}
    </>
  );
}

export default memo(NavRight);
