import type { Ref, ReactNode } from "react";
import styles from "./logs.module.css";
import { fmt, fmtQs, formatSectionLabel } from "./lib/format";
import ChevronIcon from "../../assets/svg/chevron/ChevronIcon";
import type { SurveyRow } from "../../domain/survey/types";

function LogsPageArrow({
  direction,
  hidden,
  onClick,
}: {
  direction: "previous" | "next";
  hidden: boolean;
  onClick: () => void;
}) {
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Previous page" : "Next page";

  if (hidden) {
    return <span className={`ui-icon-nav-button ${styles.logsPageArrow} ${styles.logsPageArrowPlaceholder}`} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      className={`ui-icon-nav-button ${styles.logsPageArrow}`}
      onClick={onClick}
      aria-label={label}
    >
      <ChevronIcon direction={direction} />
    </button>
  );
}

interface LogsBodyProps {
  tableWrapRef: Ref<HTMLDivElement>;
  pageRows: SurveyRow[];
  visibleActiveRowId: string | null;
  rankById: Map<string, number>;
  onSelectRow: (id: string) => void;
  renderHighlighted: (text: string) => ReactNode;
  // Pagination lives here, not in a separate footer piece - it's genuinely
  // part of the table content (which rows you're looking at), not
  // panel-chrome. footerAction sits on the same row, opposite side - the
  // desktop assembly (LogsPanel) passes its close button here so the two
  // share one line; compact-tools omits it because close lives in its
  // header, so the row simply has nothing on that side there.
  totalPages: number;
  safePage: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onJumpToPage: (pageNumber: number) => void;
  footerAction?: ReactNode;
}

export function LogsBody({
  tableWrapRef,
  pageRows,
  visibleActiveRowId,
  rankById,
  onSelectRow,
  renderHighlighted,
  totalPages,
  safePage,
  onPreviousPage,
  onNextPage,
  onJumpToPage,
  footerAction,
}: LogsBodyProps) {
  return (
    <>
      <div ref={tableWrapRef} className="logs-table-wrap" onWheel={(e) => { e.stopPropagation(); }}>
        <table className={styles.logsTable}>
          <thead>
            <tr>
              <th className={`${styles.logsTh} ${styles.logsThSection}`}>Section</th>
              <th className={`${styles.logsTh} ${styles.logsThAvg}`}>Average</th>
              <th className={`${styles.logsTh} ${styles.logsThRank}`}>Rank</th>
              <th className={`${styles.logsTh} ${styles.logsThQs}`}>Question 1-5</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr className={`${styles.logsRow} ${styles.logsRowEmpty}`}>
                <td className={styles.logsEmpty} colSpan={4}>couldn't find that one.</td>
              </tr>
            ) : pageRows.map((row) => (
              <tr
                key={row._id}
                className={`${styles.logsRow}${visibleActiveRowId === row._id ? " is-active" : ""}`}
                tabIndex={0}
                aria-selected={visibleActiveRowId === row._id}
                onPointerDown={() => { onSelectRow(row._id); }}
                onClick={() => { onSelectRow(row._id); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onSelectRow(row._id);
                }}
              >
                <td className={`${styles.logsTd} ${styles.logsTdSection}`}>{renderHighlighted(formatSectionLabel(row.section))}</td>
                <td className={`${styles.logsTd} ${styles.logsTdAvg}`}>{renderHighlighted(fmt(row.avgWeight))}</td>
                <td className={`${styles.logsTd} ${styles.logsTdRank}`}>{renderHighlighted(String(rankById.get(row._id) ?? 0))}</td>
                <td className={`${styles.logsTd} ${styles.logsTdQs}`}>{renderHighlighted(fmtQs(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(totalPages > 1 || footerAction) && (
        <div className={styles.logsPagination}>
          {footerAction}
          {totalPages > 1 && (
            <div className={styles.logsPaginationControls}>
              <LogsPageArrow direction="previous" hidden={safePage === 0} onClick={onPreviousPage} />
              <span className={styles.logsPageLabel}>
                {safePage + 1}<span className={styles.logsPageSep}>/</span>{totalPages}
              </span>
              <LogsPageArrow direction="next" hidden={safePage >= totalPages - 1} onClick={onNextPage} />
              <input
                id="logs-page-input"
                type="number"
                className={styles.logsPageInput}
                min={1}
                max={totalPages}
                placeholder="page"
                aria-label="Go to page"
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalPages) {
                    onJumpToPage(val);
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default LogsBody;
