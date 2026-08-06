import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import "../styles/logs.css";
import { useSurveyDataStore } from "../app/state/survey-data-store";
import CloseIcon from "../assets/svg/close/CloseIcon";
import SearchIcon from "../assets/svg/search/SearchIcon";
import FilterIcon from "../assets/svg/filter/FilterIcon";
import { Popover } from "../app/ui/Popover";
import { recordOwnRender } from "../render-test/renderProfilerStats";
import { PAGE_SIZE, SORT_OPTIONS, type SortKey } from "./constants";
import { fmt, fmtQs, formatSectionLabel } from "./format";
import { computeRankById, sortRows } from "./sort";
import { escapeRegExp } from "./search";

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
  const path = isPrevious ? "M15 18L9 12L15 6" : "M9 18L15 12L9 6";

  if (hidden) {
    return <span className="ui-icon-nav-button logs-page-arrow logs-page-arrow--placeholder" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      className="ui-icon-nav-button logs-page-arrow"
      onClick={onClick}
      aria-label={label}
    >
      <svg className="ui-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export interface LogsPanelProps {
  className?: string;
  panelRef?: Ref<HTMLDivElement>;
  showCloseButton?: boolean;
  onClose: () => void;
}

export function LogsPanel({
  className = "logs-popover",
  panelRef,
  showCloseButton = true,
  onClose,
}: LogsPanelProps) {
  recordOwnRender("LogsPanel");
  const data = useSurveyDataStore((s) => s.allFilteredRows);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterFocused, setFilterFocused] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("time");
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!searchOpen) return;
    filterInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    let lastTouchY = 0;

    const onTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches.item(0)?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches.item(0);
      if (!touch) return;

      const currentY = touch.clientY;
      const dy = currentY - lastTouchY;
      lastTouchY = currentY;

      const maxScrollTop = el.scrollHeight - el.clientHeight;
      if (maxScrollTop <= 0) {
        if (event.cancelable) event.preventDefault();
        return;
      }

      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop >= maxScrollTop - 1;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) {
        if (event.cancelable) event.preventDefault();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const sorted = useMemo(() => sortRows(data, sortBy), [data, sortBy]);

  const rankById = useMemo(() => computeRankById(sorted), [sorted]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sorted;

    return sorted.filter((row) => {
      const rank = rankById.get(row._id) ?? 0;
      const haystack = [
        formatSectionLabel(row.section),
        fmt(row.avgWeight),
        String(rank),
        fmtQs(row),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [query, rankById, sorted]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const highlightPattern = query.trim();
  // A row stops rendering as "active" once it scrolls off the current page,
  // without needing an effect to null out activeRowId itself.
  const visibleActiveRowId = pageRows.some((row) => row._id === activeRowId) ? activeRowId : null;

  function renderHighlighted(text: string) {
    if (!highlightPattern) return text;

    const regex = new RegExp(`(${escapeRegExp(highlightPattern)})`, "ig");
    const parts = text.split(regex);

    if (parts.length === 1) return text;

    return parts.map((part, index) =>
      part.toLowerCase() === highlightPattern.toLowerCase() ? (
        <mark key={`${part}-${String(index)}`} className="logs-highlight">
          {part}
        </mark>
      ) : part
    );
  }

  function closeLogs() {
    setFilterFocused(false);
    if (!query.trim()) setSearchOpen(false);
    onClose();
  }

  function openSearch() {
    setSearchOpen(true);
  }

  function closeSearchIfEmpty() {
    setFilterFocused(false);
    if (!query.trim()) setSearchOpen(false);
  }

  return (
    <div ref={panelRef} className={className}>
      <div className="logs-header">
        <h4 className="logs-title">Logs</h4>
        <div className="logs-header-tools">
          <Popover
            open={sortMenuOpen}
            onOpenChange={setSortMenuOpen}
            placement="bottom"
            trigger={
              <button
                type="button"
                className="logs-filter-trigger"
                aria-label="Open log filters"
                aria-expanded={sortMenuOpen}
                onClick={() => { setSortMenuOpen((v) => !v); }}
              >
                <FilterIcon className="ui-icon" />
              </button>
            }
          >
            <div className="logs-sort-menu">
              <span className="logs-sort-menu__label">Sort by:</span>
              <ul className="logs-sort-menu__list">
                {SORT_OPTIONS.map((option) => (
                  <li key={option.key}>
                    <button
                      type="button"
                      className={`logs-sort-menu__option${sortBy === option.key ? " is-active" : ""}`}
                      aria-pressed={sortBy === option.key}
                      onClick={() => {
                        setSortBy(option.key);
                        setSortMenuOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Popover>

          {searchOpen ? (
            <label
              className={`logs-filter-field${filterFocused ? " is-focused" : ""}`}
              htmlFor="logs-filter-input"
              data-focused={filterFocused ? "true" : "false"}
            >
              <SearchIcon className="ui-icon" />
              <input
                ref={filterInputRef}
                id="logs-filter-input"
                type="text"
                className="logs-filter-input"
                value={query}
                placeholder="search"
                aria-label={filterFocused ? "Filtering submission logs" : "Filter submission logs"}
                aria-expanded={searchOpen}
                onFocus={() => { setFilterFocused(true); }}
                onBlur={closeSearchIfEmpty}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (query.trim()) {
                    setQuery("");
                    setPage(0);
                    return;
                  }
                  setSearchOpen(false);
                  setFilterFocused(false);
                }}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
          ) : (
            <button
              type="button"
              className="logs-filter-trigger"
              aria-label="Open log search"
              onClick={openSearch}
            >
              <SearchIcon className="ui-icon" />
            </button>
          )}

          {!searchOpen && <span className="ui-label logs-entry-count">{sorted.length} people</span>}
        </div>
      </div>

      <div ref={tableWrapRef} className="logs-table-wrap" onWheel={(e) => { e.stopPropagation(); }}>
        <table className="logs-table">
          <thead>
            <tr>
              <th className="logs-th logs-th--section">Section</th>
              <th className="logs-th logs-th--avg">Average</th>
              <th className="logs-th logs-th--rank">Rank</th>
              <th className="logs-th logs-th--qs">Question 1-5</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr className="logs-row logs-row--empty">
                <td className="logs-empty" colSpan={4}>couldn't find that one.</td>
              </tr>
            ) : pageRows.map((row) => (
              <tr
                key={row._id}
                className={`logs-row${visibleActiveRowId === row._id ? " is-active" : ""}`}
                tabIndex={0}
                aria-selected={visibleActiveRowId === row._id}
                onPointerDown={() => { setActiveRowId(row._id); }}
                onClick={() => { setActiveRowId(row._id); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setActiveRowId(row._id);
                }}
              >
                <td className="logs-td logs-td--section">{renderHighlighted(formatSectionLabel(row.section))}</td>
                <td className="logs-td logs-td--avg">{renderHighlighted(fmt(row.avgWeight))}</td>
                <td className="logs-td logs-td--rank">{renderHighlighted(String(rankById.get(row._id) ?? 0))}</td>
                <td className="logs-td logs-td--qs">{renderHighlighted(fmtQs(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCloseButton || totalPages > 1) && (
        <div className="logs-footer">
          {showCloseButton && (
            <button
              type="button"
              className="logs-close-btn"
              aria-label="Close logs"
              onClick={closeLogs}
            >
              <CloseIcon className="ui-close" />
            </button>
          )}

          {totalPages > 1 && (
          <div className="logs-pagination">
            <LogsPageArrow
              direction="previous"
              hidden={safePage === 0}
              onClick={() => { setPage((p) => p - 1); }}
            />
            <span className="logs-page-label">
              {safePage + 1}<span className="logs-page-sep">/</span>{totalPages}
            </span>
            <LogsPageArrow
              direction="next"
              hidden={safePage >= totalPages - 1}
              onClick={() => { setPage((p) => p + 1); }}
            />
            <input
              id="logs-page-input"
              type="number"
              className="logs-page-input"
              min={1}
              max={totalPages}
              placeholder="page"
              aria-label="Go to page"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= totalPages) {
                  setPage(val - 1);
                }
              }}
            />
          </div>
          )}
        </div>
      )}
    </div>
  );
}
