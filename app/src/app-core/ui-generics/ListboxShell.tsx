// src/app-core/ui-generics/ListboxShell.tsx
import type { HTMLAttributes, ReactNode, RefObject, KeyboardEvent } from "react";
import "../../styles/ui-generics/listbox-picker.css";

// Shared chrome for a trigger + collapsible listbox combobox pattern - used
// by both GraphPicker (a floating nav dropdown with a click-toggle trigger
// and drill-down submenus) and the onboarding SectionPicker (a static,
// inline type-to-filter combobox). Those two have genuinely different
// interaction models, so this only owns the shared structure/markup - open
// state, ARIA wiring values, and option rendering all stay with each
// consumer. Positioning (floating+flip vs. static) is handled by each
// consumer's own CSS scoped under its own wrapperClassName, not by this
// component - see graph-components/graph-picker/graph-picker.module.css and
// onboarding/section-picker/section-picker.module.css.
export interface ListboxShellProps {
  open: boolean;
  // Consumers create these via useRef<HTMLDivElement>(null), which types as
  // RefObject<HTMLDivElement> (not RefObject<HTMLDivElement | null>) - match
  // that exactly rather than widening, or JSX's ref attribute rejects it.
  wrapperRef?: RefObject<HTMLDivElement>;
  wrapperClassName?: string;

  triggerRef?: RefObject<HTMLDivElement>;
  triggerContent: ReactNode;
  chevronIcon: ReactNode;
  // Spread directly onto the trigger div - role, aria-*, tabIndex, and
  // event handlers all vary in value (and sometimes in whether they're
  // present at all - GraphPicker's trigger IS the combobox, SectionPicker's
  // combobox role lives on its inner <input> instead) between consumers.
  triggerProps?: HTMLAttributes<HTMLDivElement>;

  listboxRef?: RefObject<HTMLDivElement>;
  listboxId: string;
  placement?: "down" | "up";
  onListboxKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

export function ListboxShell({
  open,
  wrapperRef,
  wrapperClassName,
  triggerRef,
  triggerContent,
  chevronIcon,
  triggerProps,
  listboxRef,
  listboxId,
  placement = "down",
  onListboxKeyDown,
  children,
}: ListboxShellProps) {
  return (
    // picker-shell is always added, alongside whatever wrapperClassName the
    // consumer passes - it's how listbox-picker.css's shared responsive
    // sizing mechanism (rest/hover/open widths, driven by each consumer's
    // own --picker-*-w custom properties) can target both wrappers without
    // this file needing to know either consumer's own class name.
    <div ref={wrapperRef} className={`picker-shell${wrapperClassName ? ` ${wrapperClassName}` : ""}`}>
      <div
        ref={triggerRef}
        className={`trigger${open ? " is-open" : ""}`}
        {...triggerProps}
      >
        {triggerContent}
        <span className="trigger-chevron" aria-hidden>
          {chevronIcon}
        </span>
      </div>

      <div
        className={`listbox-shell ${placement === "up" ? "drop-up" : "drop-down"}${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="listbox-clip">
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            className="listbox"
            tabIndex={-1}
            onKeyDown={onListboxKeyDown}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListboxShell;
