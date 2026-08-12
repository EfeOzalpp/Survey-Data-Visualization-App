// src/graph-components/graph-picker/graph-picker.tsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import styles from "./graph-picker.module.css";
import { ListboxShell } from "../../app/ui/ListboxShell";

import {
  useGraphPickerData,
  CHOOSE_STUDENT, CHOOSE_STAFF, GO_BACK,
  titleFromId,
} from "./gp-data";
import ExpandIcon from "../../assets/svg/expand/ExpandIcon";
import ChevronIcon from "../../assets/svg/chevron/ChevronIcon";

export default function GraphPicker({
  value = "all",
  onChange,
  onOpenChange,
}: {
  value?: string;
  onChange?: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { yourIdsSet, ALL_LABELS, STUDENT_OPTS, STAFF_OPTS, MAIN_OPTS, studentIdSet, staffIdSet, counts } =
    useGraphPickerData(value);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | "student" | "staff">(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState("down");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The picker owns submenu state; parents only get the selected section id.
  const VISIBLE_OPTS = useMemo(() => {
    if (mode === "student") return [{ id: GO_BACK, label: "Back" }, ...STUDENT_OPTS];
    if (mode === "staff") return [{ id: GO_BACK, label: "Back" }, ...STAFF_OPTS];
    return MAIN_OPTS;
  }, [mode, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS]);

  const triggerCoreLabel = useMemo(() => {
    if (open && mode === "student") return "Student Departments";
    if (open && mode === "staff") return "Institutional Departments";
    const base = ALL_LABELS.get(value) ?? "Everyone";
    return base;
  }, [open, mode, value, ALL_LABELS]);

  const maxActiveIndex = Math.max(0, VISIBLE_OPTS.length - 1);
  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), maxActiveIndex);

  const updateOpen = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [onOpenChange]);

  const closePicker = useCallback(() => {
    updateOpen(false);
    setMode(null);
  }, [updateOpen]);

  // NavRight uses this one lifted signal to offset the top controls while open.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) closePicker();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => { document.removeEventListener("pointerdown", onDocPointerDown, true); };
  }, [closePicker, open]);

  useEffect(() => {
    const computePlacement = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedListHeight = Math.min(300, VISIBLE_OPTS.length * 44 + 12);
      setPlacement(spaceBelow >= estimatedListHeight ? "down" : "up");
    };

    if (open) computePlacement();

    const onWin = () => {
      if (open) computePlacement();
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, VISIBLE_OPTS.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const stopProp = (e: Event) => { e.stopPropagation(); };
    el.addEventListener("wheel", stopProp, { passive: true });
    el.addEventListener("touchstart", stopProp, { passive: true });
    el.addEventListener("touchmove", stopProp, { passive: true });
    return () => {
      el.removeEventListener("wheel", stopProp);
      el.removeEventListener("touchstart", stopProp);
      el.removeEventListener("touchmove", stopProp);
    };
  }, [open]);

  const moveActive = useCallback(
    (delta: number) => { setActiveIndex((idx) => (idx + delta + VISIBLE_OPTS.length) % VISIBLE_OPTS.length); },
    [VISIBLE_OPTS.length]
  );

  const chooseIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= VISIBLE_OPTS.length) return;
      const opt = VISIBLE_OPTS[idx];
      if (opt.id === CHOOSE_STUDENT) { setMode("student"); return; }
      if (opt.id === CHOOSE_STAFF) { setMode("staff"); return; }
      if (opt.id === GO_BACK) { setMode(null); return; }
      setMode(null);
      updateOpen(false);
      onChange?.(opt.id);
      buttonRef.current?.focus();
    },
    [VISIBLE_OPTS, onChange, updateOpen]
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) updateOpen(true); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (!open) updateOpen(true); moveActive(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!open) updateOpen(true); else chooseIndex(safeActiveIndex); }
    else if (e.key === "Escape") { closePicker(); }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(VISIBLE_OPTS.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseIndex(safeActiveIndex); }
    else if (e.key === "Escape") { e.preventDefault(); closePicker(); buttonRef.current?.focus(); }
  };

  const listboxId = "listbox";

  return (
    <ListboxShell
      open={open}
      wrapperRef={wrapperRef}
      wrapperClassName={styles.picker}
      triggerRef={buttonRef}
      triggerContent={
        <span className={styles.triggerLabel}>
          <h4>{triggerCoreLabel}</h4>
        </span>
      }
      chevronIcon={<ExpandIcon expanded={open} className="trigger-chevron-icon ui-icon svg-sm" />}
      triggerProps={{
        role: "combobox",
        "aria-haspopup": "listbox",
        "aria-owns": listboxId,
        "aria-expanded": open,
        "aria-controls": listboxId,
        "aria-activedescendant": VISIBLE_OPTS[safeActiveIndex] ? `opt-${VISIBLE_OPTS[safeActiveIndex].id}` : undefined,
        onClick: () => { if (open) closePicker(); else updateOpen(true); },
        onKeyDown: onTriggerKeyDown,
        tabIndex: 0,
      }}
      listboxRef={listRef}
      listboxId={listboxId}
      placement={placement === "down" ? "down" : "up"}
      onListboxKeyDown={onListKeyDown}
    >
      {VISIBLE_OPTS.map((opt, idx) => {
        const active = idx === safeActiveIndex;
        const isBack = opt.id === GO_BACK;
        const isChooser = opt.id === CHOOSE_STUDENT || opt.id === CHOOSE_STAFF;
        const isStudentChooser = opt.id === CHOOSE_STUDENT;
        const isStaffChooser = opt.id === CHOOSE_STAFF;
        const showCount = !(isBack || isChooser);
        const n = counts[opt.id] ?? 0;
        const isPersonal = yourIdsSet.has(opt.id);
        const countLabel = `${String(n)} ${n === 1 ? "person" : "people"}`;

        return (
          <div
            id={`opt-${opt.id}`}
            key={opt.id}
            role="option"
            aria-selected={value === opt.id}
            className={`option${active ? " is-active" : ""}${value === opt.id ? " is-selected" : ""}${isStudentChooser ? ` ${styles.optionStudentChooser}` : ""}${isStaffChooser ? ` ${styles.optionStaffChooser}` : ""}${isBack ? ` ${styles.optionBack}` : ""}`}
            onMouseEnter={() => { setActiveIndex(idx); }}
            onMouseDown={(e) => { e.preventDefault(); }}
            onClick={() => { chooseIndex(idx); }}
          >
            {isBack ? (
              <>
                <span className={styles.backIcon} aria-hidden>
                  <ChevronIcon direction="previous" />
                </span>
                <span className="label">Back</span>
              </>
            ) : isChooser ? (
              <>
                <span className={styles.labelWrap}>
                  <span className="label">{opt.label}</span>
                  {(() => {
                    const sectionSet = opt.id === CHOOSE_STUDENT ? studentIdSet : staffIdSet;
                    if (!sectionSet.has(value)) return null;
                    return (
                      <span className={styles.selectedChild}>
                        {ALL_LABELS.get(value) ?? titleFromId(value)}
                      </span>
                    );
                  })()}
                </span>
                <span className={styles.chooserIcon} aria-hidden>
                  <ChevronIcon direction="next" />
                </span>
              </>
            ) : (
              <>
                <span className="label option-label">
                  {ALL_LABELS.get(opt.id) ?? titleFromId(opt.id)}
                </span>
                <span className={styles.pickerLabels}>
                  {isPersonal && <span className={`ui-label ${styles.pickerYou}`}>you</span>}
                  {showCount && (
                    <span className={`ui-label ${styles.pickerCount}`} aria-label={countLabel} title={countLabel}>
                      {n}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
        );
      })}
    </ListboxShell>
  );
}
