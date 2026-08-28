import { lazy, Profiler, Suspense, useState } from "react";
import { profilerOnRender, recordOwnRender } from "../../render-test/renderProfilerStats";
import { useSurveyDataStore } from "../../app-core/state/survey-data-store";
import { GraphDataProvider } from "../../graph-runtime/GraphDataContext";
import { useLogsPanel } from "../logs/lib/useLogsPanel";
import { LogsBody } from "../logs/logs-body";
import { MultiButtonFooter } from "../widgets/footer/multi-button-footer";
import { useBarGraph } from "../widgets/bargraph/lib/useBarGraph";
import ByQuestionBody from "../widgets/byquestion/body";
import { useByQuestion } from "../widgets/byquestion/lib/useByQuestion";
import { CompactLogsHeader } from "./headers/logs-header";
import { CompactWidgetHeader } from "./headers/widget-header";
import styles from "./compact-tools.module.css";

const BarGraphBody = lazy(() => import("../widgets/bargraph/body"));

type CompactTool = "logs" | "bar" | "questions";

const COMPACT_TOOLS = [
  { key: "logs", label: "Logs" },
  { key: "bar", label: "Bar graph" },
  { key: "questions", label: "By question" },
] as const satisfies { key: CompactTool; label: string }[];

export interface CompactToolsPanelProps {
  open: boolean;
  onClose: () => void;
}

function CompactLogs({ onClose }: { onClose: () => void }) {
  const logs = useLogsPanel(onClose);

  return (
    <div className="logs-popover compact-tools-logs">
      <CompactLogsHeader
        onClose={onClose}
        sortMenuOpen={logs.sortMenuOpen}
        onSortMenuOpenChange={logs.setSortMenuOpen}
        sortBy={logs.sortBy}
        onSelectSort={logs.handleSelectSort}
        searchOpen={logs.searchOpen}
        query={logs.query}
        filterFocused={logs.filterFocused}
        filterInputRef={logs.filterInputRef}
        onOpenSearch={logs.openSearch}
        onFilterFocus={() => { logs.setFilterFocused(true); }}
        onFilterBlur={logs.closeSearchIfEmpty}
        onFilterKeyDown={logs.handleFilterKeyDown}
        onQueryChange={logs.handleQueryChange}
        peopleCount={logs.peopleCount}
      />
      <LogsBody
        tableWrapRef={logs.tableWrapRef}
        pageRows={logs.pageRows}
        visibleActiveRowId={logs.visibleActiveRowId}
        rankById={logs.rankById}
        onSelectRow={logs.handleSelectRow}
        renderHighlighted={logs.renderHighlighted}
        totalPages={logs.totalPages}
        safePage={logs.safePage}
        onPreviousPage={logs.handlePreviousPage}
        onNextPage={logs.handleNextPage}
        onJumpToPage={logs.handleJumpToPage}
      />
    </div>
  );
}

interface CompactWidgetProps {
  paused: boolean;
  onPausedChange: (paused: boolean) => void;
  onClose: () => void;
}

function CompactBarGraph({ paused, onPausedChange, onClose }: CompactWidgetProps) {
  const allFilteredRows = useSurveyDataStore((state) => state.allFilteredRows);
  const bar = useBarGraph({ paused, onPausedChange });

  return (
    <GraphDataProvider data={allFilteredRows}>
      <CompactWidgetHeader {...bar.header} onClose={onClose} />
      <Suspense fallback={null}>
        <Profiler id="BarGraph:compact-tools" onRender={profilerOnRender}>
          <BarGraphBody
            {...bar}
            navOutsidePanel
            panelClassName={styles.compactWidgetBody}
          />
        </Profiler>
      </Suspense>
    </GraphDataProvider>
  );
}

function CompactByQuestion({ paused, onPausedChange, onClose }: CompactWidgetProps) {
  const byQuestion = useByQuestion({ paused, onPausedChange });

  return (
    <>
      <CompactWidgetHeader {...byQuestion.header} onClose={onClose} />
      <ByQuestionBody
        navOutsidePanel
        panelClassName={styles.compactWidgetBody}
        avgs={byQuestion.avgs}
        tooltipIndex={byQuestion.tooltipIndex}
        setTooltipIndex={byQuestion.setTooltipIndex}
        listRef={byQuestion.listRef}
      />
    </>
  );
}

// Content only - navigation/bottom/compact-tools-button.tsx owns the
// trigger button and Modal wrapper. This component owns the compact-only
// header/body assemblies and footer tab selection.
// `open` is only used to reset back to the "logs" tab each time it opens
// (the state itself - activeTool - still lives here, not in the button file).
export function CompactToolsPanel({ open, onClose }: CompactToolsPanelProps) {
  recordOwnRender("CompactToolsPanel");
  const [activeTool, setActiveTool] = useState<CompactTool>("logs");
  const [widgetAutoplayPaused, setWidgetAutoplayPaused] = useState(true);
  // Reset to the "logs" tab each time this opens - adjusted during render
  // (React's recommended pattern for this) rather than in an effect, which
  // would cause an extra cascading render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setActiveTool("logs");
  }

  return (
    <>
      <div data-compact-tool={activeTool}>
        {activeTool === "logs" && <CompactLogs onClose={onClose} />}

        {activeTool === "bar" && (
          <CompactBarGraph
            paused={widgetAutoplayPaused}
            onPausedChange={setWidgetAutoplayPaused}
            onClose={onClose}
          />
        )}

        {activeTool === "questions" && (
          <CompactByQuestion
            paused={widgetAutoplayPaused}
            onPausedChange={setWidgetAutoplayPaused}
            onClose={onClose}
          />
        )}
      </div>

      <MultiButtonFooter
        tools={COMPACT_TOOLS}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        ariaLabel="Graph tools"
      />
    </>
  );
}

export default CompactToolsPanel;
