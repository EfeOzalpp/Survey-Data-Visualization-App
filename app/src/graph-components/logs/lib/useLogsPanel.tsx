import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useSurveyDataStore } from "../../../app/state/survey-data-store";
import styles from "../logs.module.css";
import { PAGE_SIZE, type SortKey } from "./constants";
import { fmt, fmtQs, formatSectionLabel } from "./format";
import { computeRankById, sortRows } from "./sort";
import { escapeRegExp } from "./search";

// All state/logic behind the logs table - sorting, filtering, pagination,
// row selection, search-field focus management. Shared by both assemblies
// that render LogsHeader/LogsBody: the desktop one (LogsPanel, under
// Popover) and CompactToolsPanel's own (under Modal) - neither duplicates
// this, they just render the pieces and panel chrome differently. .tsx
// (not .ts) because renderHighlighted returns <mark> JSX directly.
export function useLogsPanel(onClose: () => void) {
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
        <mark key={`${part}-${String(index)}`} className={styles.logsHighlight}>
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

  function handleSelectSort(key: SortKey) {
    setSortBy(key);
    setSortMenuOpen(false);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(0);
  }

  function handleFilterKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
  }

  function handleSelectRow(id: string) {
    setActiveRowId(id);
  }

  function handlePreviousPage() {
    setPage((p) => p - 1);
  }

  function handleNextPage() {
    setPage((p) => p + 1);
  }

  function handleJumpToPage(pageNumber: number) {
    setPage(pageNumber - 1);
  }

  return {
    // header
    sortMenuOpen,
    setSortMenuOpen,
    sortBy,
    handleSelectSort,
    searchOpen,
    query,
    filterFocused,
    filterInputRef,
    openSearch,
    setFilterFocused,
    closeSearchIfEmpty,
    handleFilterKeyDown,
    handleQueryChange,
    peopleCount: sorted.length,
    // body
    tableWrapRef,
    pageRows,
    visibleActiveRowId,
    rankById,
    renderHighlighted,
    handleSelectRow,
    // footer
    closeLogs,
    totalPages,
    safePage,
    handlePreviousPage,
    handleNextPage,
    handleJumpToPage,
  };
}
