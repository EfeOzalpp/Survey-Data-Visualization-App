// src/app/ui/Popover.tsx
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useEscapeToClose } from "../../lib/hooks/useEscapeToClose";
import "../../styles/ui/popover.css";

export type PopoverPlacement =
  | "top" | "top-start" | "top-end"
  | "bottom" | "bottom-start" | "bottom-end"
  | "left" | "right";

// Controlled: open/onOpenChange live in the caller's own state, so this
// component never fights whatever state a consumer (Logs, Widgets, a card's
// "..." menu, etc.) already manages for itself. This only handles anchored
// positioning, the shell's styling, and dismissal (click outside, Escape).
export function Popover({
  open,
  onOpenChange,
  placement = "bottom-start",
  trigger,
  children,
  className,
  shellClassName,
  role,
  dismissExclude,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: PopoverPlacement;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  // Extra class on the shell (the positioned element) - lets a consumer
  // preserve a legacy class name (e.g. "logs-popover-shell") that other code
  // still queries for, and/or override the default placement's exact numbers.
  shellClassName?: string;
  role?: string;
  // Elements whose clicks should NOT count as "outside" for this popover's
  // click-to-dismiss - e.g. a sibling toolbar so opening one tool doesn't
  // dismiss another that's already open next to it.
  dismissExclude?: RefObject<HTMLElement | null>[];
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dismissExclude?.some((ref) => ref.current?.contains(target))) return;
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => { document.removeEventListener("pointerdown", onDocPointerDown, true); };
  }, [open, onOpenChange, dismissExclude]);

  useEscapeToClose(open, () => { onOpenChange(false); });

  return (
    <div ref={wrapperRef} className="ui-popover-anchor">
      {trigger}
      <div
        className={`ui-popover-shell ui-popover-shell--${placement}${shellClassName ? ` ${shellClassName}` : ""}${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="ui-popover-clip">
          <div
            className={`ui-popover${className ? ` ${className}` : ""}`}
            role={role}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
