import { Profiler, Suspense, lazy, useCallback, useRef, useState } from "react";
import "../../styles/widgets.css";
import { profilerOnRender, recordOwnRender } from "../../render-test/renderProfilerStats";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { GraphDataProvider } from "../../graph-runtime/GraphDataContext";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { Popover } from "../../app/ui/Popover";
import SectionScores from "../../graph-components/widgets/section-scores";

const BarGraph = lazy(() => import("../../graph-components/widgets/bargraph/index"));
type WidgetView = "bar" | "questions";

export default function WidgetsButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  recordOwnRender("WidgetsButton");
  const allFilteredRows = useSurveyDataStore((s) => s.allFilteredRows);
  const [activeWidgetView, setActiveWidgetView] = useState<WidgetView>("bar");
  const [widgetAutoplayPaused, setWidgetAutoplayPaused] = useState(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    setActiveWidgetView("bar");
    onOpenChange(next);
  }, [onOpenChange]);

  useFocusTrap({ enabled: open, containerRef: dialogRef, returnFocusRef: triggerRef });

  return (
    <div className="widgets-wrap">
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        placement="top-start"
        shellClassName="widgets-popover-shell"
        dismissOnOutsideClick={false}
        trigger={
          <button
            ref={triggerRef}
            type="button"
            className="widgets-button"
            data-label="Widgets"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Widgets"
            onClick={() => { handleOpenChange(!open); }}
          >
            <span className="widgets-button__inner">Widgets</span>
          </button>
        }
      >
        <div ref={dialogRef} className="widgets-popover">
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
              onClick={() => { handleOpenChange(false); }}
            >
              <CloseIcon className="ui-close" />
            </button>
          </div>
        </div>
      </Popover>
    </div>
  );
}
