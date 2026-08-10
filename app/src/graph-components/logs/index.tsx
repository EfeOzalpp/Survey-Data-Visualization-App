import type { Ref } from "react";
import styles from "./logs.module.css";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import { recordOwnRender } from "../../render-test/renderProfilerStats";
import { useLogsPanel } from "./lib/useLogsPanel";
import { LogsHeader } from "./logs-header";
import { LogsBody } from "./logs-body";

export interface LogsPanelProps {
  className?: string;
  panelRef?: Ref<HTMLDivElement>;
  onClose: () => void;
}

// Desktop assembly - lives inside Popover (see navigation/bottom/logs-button.tsx),
// which already owns the appear/disappear animation, so this is just plain
// composition of the logs pieces. The close button rides on the same row as
// pagination (LogsBody's footerAction) instead of its own separate footer -
// see logs-body.tsx. CompactToolsPanel does its own separate assembly of
// LogsHeader/LogsBody under Modal instead of importing this, and never
// passes footerAction because its close button lives in the compact header.
export function LogsPanel({
  className = "logs-popover",
  panelRef,
  onClose,
}: LogsPanelProps) {
  recordOwnRender("LogsPanel");
  const logs = useLogsPanel(onClose);

  return (
    <div ref={panelRef} className={className}>
      <LogsHeader
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
        footerAction={
          <button
            type="button"
            className={`ui-icon-nav-button ${styles.logsCloseBtn}`}
            aria-label="Close logs"
            onClick={logs.closeLogs}
          >
            <CloseIcon className="ui-close svg-sm" />
          </button>
        }
      />
    </div>
  );
}

export default LogsPanel;
