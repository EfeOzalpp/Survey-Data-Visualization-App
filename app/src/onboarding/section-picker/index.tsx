// src/onboarding/section-picker/index.tsx
import { useMemo, useRef, useState, useEffect, useCallback, useId } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './section-picker.module.css';
import { ListboxShell } from '../../app-core/ui-generics/ListboxShell';
import { Button } from '../../app-core/ui-generics/Button';
import type { SectionHeader, SectionItem, SectionOption } from './sections';

interface NormalizedSectionOption extends SectionOption {
  type: 'option';
}

type NormalizedSectionItem = SectionHeader | NormalizedSectionOption;

interface IndexedSectionOption extends NormalizedSectionOption {
  __listIndex: number;
}

interface RenderedSectionOption extends NormalizedSectionOption {
  __renderIndex: number;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onBegin: () => void;
  error: string;
  sections?: SectionItem[];
  placeholderOverride?: string;
  titleOverride?: string;
  onOpenChange?: (open: boolean) => void;
}

function isSectionHeader(item: SectionItem | NormalizedSectionItem | undefined): item is SectionHeader {
  return item?.type === 'header';
}

function normalizeSectionItem(item: SectionItem): NormalizedSectionItem {
  return isSectionHeader(item) ? item : { ...item, type: 'option' };
}

export default function SectionPickerIntro({
  value,
  onChange,
  onBegin,
  error,
  sections = [],
  placeholderOverride, // e.g., "Your Major..."
  titleOverride, // e.g., "Select Your Major"
  onOpenChange,
}: Props) {
  const titleId = useId();
  const helpId = useId();
  const errorId = useId();
  const hasHeaders = useMemo(() => sections.some(isSectionHeader), [sections]);

  const optionsWithHeaders = useMemo(() => {
    return sections.map(normalizeSectionItem);
  }, [sections]);

  const baseFocusable = useMemo(() => {
    const out: IndexedSectionOption[] = [];
    optionsWithHeaders.forEach((item, idx) => {
      if (!isSectionHeader(item)) out.push({ ...item, __listIndex: idx });
    });
    return out;
  }, [optionsWithHeaders]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // ListboxShell's listboxRef prop expects RefObject<HTMLDivElement>
  // (matching what useRef<HTMLDivElement>(null) infers) - not the wider
  // RefObject<HTMLDivElement | null> an explicit `| null` type arg produces.
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = 'section-listbox';
  const openedByPointer = useRef(false);
  const outsideTouchRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
  });

  const closePicker = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  }, []);

  const current = useMemo(() => baseFocusable.find((option) => option.value === value) ?? null, [baseFocusable, value]);

  const filteredFocusable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseFocusable;
    return baseFocusable.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(q);
      const valueMatch = option.value.toLowerCase().includes(q);
      const aliasMatch = (option.aliases ?? []).some((alias) => alias.toLowerCase().includes(q));
      return labelMatch || valueMatch || aliasMatch;
    });
  }, [baseFocusable, search]);

  const displayedList = useMemo(() => {
    if (!hasHeaders) return filteredFocusable;

    const filteredSet = new Set(filteredFocusable.map((option) => option.__listIndex));
    const out: NormalizedSectionItem[] = [];
    let i = 0;
    while (i < optionsWithHeaders.length) {
      const item = optionsWithHeaders[i];
      if (isSectionHeader(item)) {
        let j = i + 1,
          any = false;
        while (j < optionsWithHeaders.length && !isSectionHeader(optionsWithHeaders[j])) {
          if (filteredSet.has(j)) {
            any = true;
            break;
          }
          j++;
        }
        if (any) {
          out.push(item);
          let k = i + 1;
          while (k < optionsWithHeaders.length && !isSectionHeader(optionsWithHeaders[k])) {
            const option = optionsWithHeaders[k];
            if (filteredSet.has(k)) out.push(option);
            k++;
          }
          i = k;
          continue;
        } else {
          let k = i + 1;
          while (k < optionsWithHeaders.length && !isSectionHeader(optionsWithHeaders[k])) k++;
          i = k;
          continue;
        }
      } else {
        if (filteredSet.has(i)) out.push(item);
        i++;
      }
    }
    return out;
  }, [hasHeaders, filteredFocusable, optionsWithHeaders]);

  const renderedFocusable = useMemo(() => {
    const out: RenderedSectionOption[] = [];
    displayedList.forEach((item, idx) => {
      if (!isSectionHeader(item)) out.push({ ...item, __renderIndex: idx });
    });
    return out;
  }, [displayedList]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) closePicker();
    };

    const onDocTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches.item(0);
      if (!touch) return;
      const isInside = !!pickerRef.current?.contains(e.target as Node);
      outsideTouchRef.current = {
        active: !isInside,
        moved: false,
        startX: touch.clientX,
        startY: touch.clientY,
      };
    };

    const onDocTouchMove = (e: TouchEvent) => {
      if (!outsideTouchRef.current.active) return;
      const touch = e.changedTouches.item(0);
      if (!touch) return;
      const dx = Math.abs(touch.clientX - outsideTouchRef.current.startX);
      const dy = Math.abs(touch.clientY - outsideTouchRef.current.startY);
      if (dx > 10 || dy > 10) outsideTouchRef.current.moved = true;
    };

    const onDocTouchEnd = () => {
      if (outsideTouchRef.current.active && !outsideTouchRef.current.moved) closePicker();
      outsideTouchRef.current.active = false;
      outsideTouchRef.current.moved = false;
    };

    const onDocTouchCancel = () => {
      outsideTouchRef.current.active = false;
      outsideTouchRef.current.moved = false;
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('touchstart', onDocTouchStart, { passive: true });
    document.addEventListener('touchmove', onDocTouchMove, { passive: true });
    document.addEventListener('touchend', onDocTouchEnd);
    document.addEventListener('touchcancel', onDocTouchCancel);

    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('touchstart', onDocTouchStart);
      document.removeEventListener('touchmove', onDocTouchMove);
      document.removeEventListener('touchend', onDocTouchEnd);
      document.removeEventListener('touchcancel', onDocTouchCancel);
    };
  }, [open, closePicker]);

  const maxActiveIndex = Math.max(0, renderedFocusable.length - 1);
  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), maxActiveIndex);

  const openPicker = useCallback(() => {
    if (openedByPointer.current) setSearch('');
    const selectedIndex = renderedFocusable.findIndex((option) => option.value === value);
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
    setOpen(true);
    openedByPointer.current = false;
  }, [renderedFocusable, value]);

  const moveActive = useCallback(
    (delta: number) => {
      if (!renderedFocusable.length) return;
      setActiveIndex((idx) => (idx + delta + renderedFocusable.length) % renderedFocusable.length);
    },
    [renderedFocusable.length]
  );

  const chooseIndex = useCallback(
    (focusIdx: number) => {
      if (focusIdx < 0 || focusIdx >= renderedFocusable.length) return;
      const opt = renderedFocusable[focusIdx];
      onChange(opt.value);
      setSearch('');
      closePicker();
    },
    [renderedFocusable, onChange, closePicker]
  );

  const activeRenderedId =
    open && renderedFocusable[safeActiveIndex] ? `opt-${renderedFocusable[safeActiveIndex].value}` : undefined;

  const placeholderText = placeholderOverride ?? (current ? current.label : 'MassArt Dept...');
  const describedBy = [helpId, error ? errorId : undefined].filter((id): id is string => Boolean(id)).join(' ');

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, renderedFocusable.length - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      chooseIndex(safeActiveIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePicker();
    }
  };

  return (
    <section className="survey survey-step section-select">
      <div className={styles.continue}>
        <h3 className={styles.sectionTitle} id={titleId}>{titleOverride ?? 'Select Your Department'}</h3>
        <p id={helpId} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          Type to filter departments, then use arrow keys to move through the list and Enter to select.
        </p>

      <ListboxShell
        open={open}
        wrapperRef={pickerRef}
        wrapperClassName={styles.sectionPicker}
        triggerContent={
          <input
            ref={inputRef}
            id="section-combobox-input"
            type="text"
            className={styles.sectionInput}
            role="combobox"
            aria-labelledby={titleId}
            aria-haspopup="listbox"
            aria-owns={listboxId}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeRenderedId}
            aria-describedby={describedBy || undefined}
            aria-invalid={!!error}
            placeholder={placeholderText}
            value={open ? search : (current?.label ?? '')}
            inputMode="search"
            autoCapitalize="none"
            onFocus={() => {
              openPicker();
            }}
            onChange={(e) => {
              openedByPointer.current = false;
                if (!open) openPicker();
                setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              openedByPointer.current = false;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!open) openPicker();
                moveActive(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!open) openPicker();
                moveActive(-1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                setActiveIndex(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                setActiveIndex(Math.max(0, renderedFocusable.length - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (open) chooseIndex(safeActiveIndex);
                else openPicker();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                closePicker();
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
        }
        chevronIcon={
          <svg className="trigger-chevron-icon ui-icon svg-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="6 9 12 15 18 9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        triggerProps={{
          onMouseDown: () => {
            openedByPointer.current = true;
          },
          onTouchStart: () => {
            openedByPointer.current = true;
          },
          onClick: () => {
            if (open) closePicker();
            else openPicker();
          },
        }}
        listboxRef={listRef}
        listboxId={listboxId}
        onListboxKeyDown={onListKeyDown}
      >
        {displayedList.length === 0 && (
          <div className={styles.sectionEmpty} role="option" aria-disabled="true" aria-selected="false">
            No matches
          </div>
        )}

        {displayedList.map((item, idx) => {
          if (isSectionHeader(item)) {
            return (
              <span
                key={`hdr-${item.id}`}
                className={styles.sectionGroupHeader}
                role="presentation"
                aria-hidden="true"
              >
                {item.label}
              </span>
            );
          }
          const selected = value === item.value;
          const isActive = renderedFocusable[safeActiveIndex]?.__renderIndex === idx;
          return (
            <div
              id={`opt-${item.value}`}
              key={item.value}
              role="option"
              aria-selected={selected}
              className={'option' + (isActive ? ' is-active' : '') + (selected ? ' is-selected' : '')}
              onMouseEnter={() => {
                const focusIdx = renderedFocusable.findIndex((option) => option.__renderIndex === idx);
                if (focusIdx !== -1 && focusIdx !== safeActiveIndex) {
                  setActiveIndex(focusIdx);
                }
              }}
              onMouseDown={(e) => { e.preventDefault(); }}
              onClick={() => {
                const focusIdx = renderedFocusable.findIndex((option) => option.__renderIndex === idx);
                if (focusIdx >= 0) chooseIndex(focusIdx);
              }}
            >
              <span className="label option-label">{item.label}</span>
            </div>
          );
        })}
      </ListboxShell>

      {error && (
        <div className="error-container" id={errorId} role="alert" aria-live="polite">
          <p>{error}</p>
          {!/section/i.test(error) && <p className={styles.emailTag}>Mail: eozalp@massart.edu</p>}
        </div>
      )}

      <div className="button-wrap">
        <Button baseClassName="section-continue-button" onClick={onBegin} aria-describedby={describedBy || undefined}>
          Continue
        </Button>
      </div>
      </div>
    </section>
  );
}
