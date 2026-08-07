import { Profiler, Suspense, lazy, useState } from "react";
import "../../styles/widgets.css";
import styles from "./compact-tools.module.css";
import { profilerOnRender, recordOwnRender } from "../../render-test/renderProfilerStats";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { GraphDataProvider } from "../../graph-runtime/GraphDataContext";
import { useDisclosure } from "../../lib/hooks/useDisclosure";
import { Modal } from "../../app/ui/Modal";
import { LogsPanel } from "../logs";
import SectionScores from "./byquestion";

const BarGraph = lazy(() => import("./bargraph/index"));

type CompactTool = "logs" | "bar" | "questions";

const TOOL_LABELS: Record<CompactTool, string> = {
  logs: "Logs",
  bar: "Bar graph",
  questions: "By question",
};

function ToolsGridIcon() {
  return (
    <svg className={styles.compactToolsIcon} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="6" cy="6" r="1.7" />
        <circle cx="12" cy="6" r="1.7" />
        <circle cx="18" cy="6" r="1.7" />
        <circle cx="6" cy="12" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="18" cy="12" r="1.7" />
        <circle cx="6" cy="18" r="1.7" />
        <circle cx="12" cy="18" r="1.7" />
        <circle cx="18" cy="18" r="1.7" />
      </g>
    </svg>
  );
}

export default function CompactGraphTools() {
  recordOwnRender("CompactGraphTools");
  const allFilteredRows = useSurveyDataStore((s) => s.allFilteredRows);
  const { open, setOpen, openDisclosure, closeDisclosure } = useDisclosure(false);
  const [activeTool, setActiveTool] = useState<CompactTool>("logs");
  const [widgetAutoplayPaused, setWidgetAutoplayPaused] = useState(true);

  const openTools = () => {
    setActiveTool("logs");
    openDisclosure();
  };

  return (
    <>
      <button
        type="button"
        className={styles.compactToolsButton}
        aria-label="Open graph tools"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={openTools}
      >
        <ToolsGridIcon />
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        ariaLabel="Graph tools"
        // Plain "compact-tools-modal" string kept alongside the module
        // class deliberately - styles/widgets.css's Modal :has() overrides
        // (and this file's own :global() descendant selectors) target that
        // stable name, not the hashed one, so they survive rebuilds.
        cardClassName={`compact-tools-modal ${styles.compactToolsModal}`}
        overlayLabel="Close graph tools"
      >
        <button
          type="button"
          className={`ui-icon-nav-button ${styles.compactToolsClose}`}
          aria-label="Close graph tools"
          onClick={closeDisclosure}
        >
          <CloseIcon className="ui-close" />
        </button>

        <div className={styles.compactToolsContent}>
          {activeTool === "logs" && (
            <LogsPanel
              className="logs-popover compact-tools-logs"
              showCloseButton={false}
              onClose={closeDisclosure}
            />
          )}

          {activeTool === "bar" && (
            <GraphDataProvider data={allFilteredRows}>
              <Suspense fallback={null}>
                <Profiler id="BarGraph:compact-tools" onRender={profilerOnRender}>
                  <BarGraph
                    navOutsidePanel
                    panelClassName={`widgets-panel bar-graph ${styles.compactToolsWidgetPanel}`}
                    paused={widgetAutoplayPaused}
                    onPausedChange={setWidgetAutoplayPaused}
                  />
                </Profiler>
              </Suspense>
            </GraphDataProvider>
          )}

          {activeTool === "questions" && (
            <SectionScores
              navOutsidePanel
              panelClassName={`widgets-panel q-scores ${styles.compactToolsWidgetPanel}`}
              paused={widgetAutoplayPaused}
              onPausedChange={setWidgetAutoplayPaused}
            />
          )}
        </div>

        <div className={styles.compactToolsTabs} role="tablist" aria-label="Graph tools">
          {(Object.keys(TOOL_LABELS) as CompactTool[]).map((tool) => (
            <button
              key={tool}
              type="button"
              className={`ui-toggle-option ${styles.compactToolsTab}${activeTool === tool ? " is-active" : ""}`}
              role="tab"
              aria-selected={activeTool === tool}
              onClick={() => { setActiveTool(tool); }}
            >
              {TOOL_LABELS[tool]}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
