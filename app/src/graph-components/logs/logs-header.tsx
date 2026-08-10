import type { Dispatch, KeyboardEvent, Ref, SetStateAction } from "react";
import styles from "./logs.module.css";
import SearchIcon from "../../assets/svg/search/SearchIcon";
import FilterIcon from "../../assets/svg/filter/FilterIcon";
import { Popover } from "../../app/ui/Popover";
import { SORT_OPTIONS, type SortKey } from "./lib/constants";

export interface LogsHeaderProps {
  sortMenuOpen: boolean;
  onSortMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  sortBy: SortKey;
  onSelectSort: (key: SortKey) => void;
  searchOpen: boolean;
  query: string;
  filterFocused: boolean;
  filterInputRef: Ref<HTMLInputElement>;
  onOpenSearch: () => void;
  onFilterFocus: () => void;
  onFilterBlur: () => void;
  onFilterKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onQueryChange: (value: string) => void;
  peopleCount: number;
}

export function LogsHeader({
  sortMenuOpen,
  onSortMenuOpenChange,
  sortBy,
  onSelectSort,
  searchOpen,
  query,
  filterFocused,
  filterInputRef,
  onOpenSearch,
  onFilterFocus,
  onFilterBlur,
  onFilterKeyDown,
  onQueryChange,
  peopleCount,
}: LogsHeaderProps) {
  return (
    <div className={styles.logsHeader}>
      <h4 className={styles.logsTitle}>Logs</h4>
      <div className={styles.logsHeaderTools}>
        <Popover
          open={sortMenuOpen}
          onOpenChange={onSortMenuOpenChange}
          placement="bottom"
          trigger={
            <button
              type="button"
              className={`ui-icon-nav-button ${styles.logsFilterTrigger}${sortMenuOpen ? " is-active" : ""}`}
              aria-label="Open log filters"
              aria-expanded={sortMenuOpen}
              onClick={() => { onSortMenuOpenChange((v) => !v); }}
            >
              <FilterIcon className="ui-icon svg-sm" />
            </button>
          }
        >
          <div className={styles.logsSortMenu}>
            <span className={styles.logsSortMenuLabel}>Sort by:</span>
            <ul className={styles.logsSortMenuList}>
              {SORT_OPTIONS.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    className={`${styles.logsSortMenuOption}${sortBy === option.key ? " is-active" : ""}`}
                    aria-pressed={sortBy === option.key}
                    onClick={() => { onSelectSort(option.key); }}
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
            className={`${styles.logsFilterField}${filterFocused ? " is-focused" : ""}`}
            htmlFor="logs-filter-input"
            data-focused={filterFocused ? "true" : "false"}
          >
            <SearchIcon className="ui-icon svg-sm" />
            <input
              ref={filterInputRef}
              id="logs-filter-input"
              type="text"
              className={styles.logsFilterInput}
              value={query}
              placeholder="search"
              aria-label={filterFocused ? "Filtering submission logs" : "Filter submission logs"}
              aria-expanded={searchOpen}
              onFocus={onFilterFocus}
              onBlur={onFilterBlur}
              onKeyDown={onFilterKeyDown}
              onChange={(e) => { onQueryChange(e.target.value); }}
            />
          </label>
        ) : (
          <button
            type="button"
            className={`ui-icon-nav-button ${styles.logsFilterTrigger}`}
            aria-label="Open log search"
            onClick={onOpenSearch}
          >
            <SearchIcon className="ui-icon svg-sm" />
          </button>
        )}

        {!searchOpen && <span className={`ui-label ${styles.logsEntryCount}`}>{peopleCount} people</span>}
      </div>
    </div>
  );
}

export default LogsHeader;
