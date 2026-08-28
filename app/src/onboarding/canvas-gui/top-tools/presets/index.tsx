import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { ListboxShell } from "../../../../app-core/ui-generics/ListboxShell";
import { useEditorState, type PresetValue } from "../../state/editor-state-context";
import styles from "./presets.module.css";
import shared from "../top-tools.module.css";

const PRESETS = [
  { value: "desert", label: "Desert" },
  { value: "temperate", label: "Temperate" },
] as const satisfies readonly { value: PresetValue; label: string }[];

export default function Presets() {
  const listboxId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditorState();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(1);

  const selectedIndex = PRESETS.findIndex((preset) => preset.value === state.selectedPreset);
  const selectedLabel = PRESETS[selectedIndex]?.label ?? "Select biome";

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  const openPicker = () => {
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const moveActive = (offset: number) => {
    setActiveIndex((current) => (current + offset + PRESETS.length) % PRESETS.length);
  };

  const choosePreset = (index: number) => {
    const preset = PRESETS[index];
    dispatch({ type: "set-preset", preset: preset.value });
    setActiveIndex(index);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openPicker();
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choosePreset(activeIndex);
      else openPicker();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`${shared.group} ${styles.group}`}>
      <span className={shared.label}>Presets</span>
      <ListboxShell
        open={open}
        wrapperRef={pickerRef}
        wrapperClassName={styles.picker}
        triggerContent={<span className={styles.triggerLabel}>{selectedLabel}</span>}
        chevronIcon={
          <svg className="trigger-chevron-icon ui-icon svg-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="6 9 12 15 18 9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        triggerProps={{
          role: "combobox",
          tabIndex: 0,
          "aria-label": "Biome preset",
          "aria-haspopup": "listbox",
          "aria-expanded": open,
          "aria-controls": listboxId,
          onClick: () => { if (open) setOpen(false); else openPicker(); },
          onKeyDown: handleKeyDown,
        }}
        listboxRef={listboxRef}
        listboxId={listboxId}
        onListboxKeyDown={handleKeyDown}
      >
        {PRESETS.map((preset, index) => {
          const selected = preset.value === state.selectedPreset;
          const active = index === activeIndex;
          return (
            <div
              key={preset.value}
              role="option"
              aria-selected={selected}
              className={`option${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
              onMouseEnter={() => { setActiveIndex(index); }}
              onMouseDown={(event) => { event.preventDefault(); }}
              onClick={() => { choosePreset(index); }}
            >
              <span className="label option-label">{preset.label}</span>
            </div>
          );
        })}
      </ListboxShell>
    </div>
  );
}
