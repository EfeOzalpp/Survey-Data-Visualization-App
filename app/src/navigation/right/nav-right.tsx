import type { CSSProperties } from "react";
import { memo, useState } from "react";

import ColorToggle from "./theme-toggle";
import BackIcon from "../../assets/svg/back/BackIcon";
import ForwardIcon from "../../assets/svg/forward/ForwardIcon";
import { Button } from "../../app/ui/Button";
import GraphPicker from "../../graph-components/graph-picker/graph-picker";
import { getSessionItem } from "../../app/session";
import { useIdentity } from "../../app/state/identity-context";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app/state/ui-store";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
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
    }))
  );
  const { section, setSection } = useSurveyDataStore(
    useShallow((s) => ({ section: s.section, setSection: s.setSection }))
  );
  const { myEntryId, mySection, setMyEntryId, setMySection, setMyRole } = useIdentity();
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
  const observerLabel = observerMode || hasCompletedSurvey ? "Back" : "Check Results";
  const savedEntryId = myEntryId;
  const savedSection = mySection;
  const showVisualEditorButton = !questionnaireOpen && showObserverButton && observerLabel === "Check Results";
  const pickerStyle: PickerOffsetStyle = {
    "--picker-offset": `${String(pickerOffset)}px`,
  };

  const scrollToVisualEditor = () => {
    document.getElementById("visual-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

        {showVisualEditorButton && (
          <Button
            variant="secondary"
            baseClassName="visual-editor-button"
            onClick={scrollToVisualEditor}
            aria-label="Visual Editor"
          >
            Visual Editor
          </Button>
        )}

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
              type="button"
              className="ui-icon-text-button observe-results"
              onClick={toggleObserverMode}
              aria-label="Check Results"
            >
              <span>{observerLabel}</span>
              <ForwardIcon className="ui-icon svg-md" />
            </button>
          )
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
