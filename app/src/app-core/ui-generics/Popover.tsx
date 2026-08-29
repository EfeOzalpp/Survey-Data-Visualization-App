// src/app-core/ui-generics/Popover.tsx
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useEscapeToClose } from "../../lib/hooks/useEscapeToClose";
import "../../styles/ui-generics/popover.css";

export type PopoverPlacement =
  | "top" | "top-start" | "top-end"
  | "bottom" | "bottom-start" | "bottom-end"
  | "left" | "right";

// Which side the panel slides in from on open / back toward on close. Independent
// of `placement` (anchor position) so a consumer can diverge from the default if
// it ever needs to - but most won't: the default below already derives a sensible
// direction from `placement` itself (top* placements rise from the trigger,
// bottom* placements drop from above, etc.), see popover.css.
export type PopoverSlideFrom = "top" | "bottom" | "left" | "right";

// Controlled: open/onOpenChange live in the caller's own state, so this
// component never fights whatever state a consumer (Logs, Widgets, a card's
// "..." menu, etc.) already manages for itself. This only handles anchored
// positioning, the shell's styling, and dismissal (click outside, Escape).
export function Popover({
  open,
  onOpenChange,
  placement = "bottom-start",
  slideFrom,
  trigger,
  children,
  className,
  shellClassName,
  role,
  dismissExclude,
  dismissOnOutsideClick = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: PopoverPlacement;
  // Explicit override for the default (placement-derived) slide direction.
  slideFrom?: PopoverSlideFrom;
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
  // Set false for popovers that should only close via their own trigger,
  // Escape, or an explicit close button - not any click elsewhere on the
  // page (e.g. Logs/Widgets' main panels, which are substantial enough that
  // an accidental outside click shouldn't lose their state).
  dismissOnOutsideClick?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !dismissOnOutsideClick) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dismissExclude?.some((ref) => ref.current?.contains(target))) return;
      onOpenChange(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => { document.removeEventListener("pointerdown", onDocPointerDown, true); };
  }, [open, onOpenChange, dismissExclude, dismissOnOutsideClick]);

  useEscapeToClose(open, () => { onOpenChange(false); });

  return (
    <div ref={wrapperRef} className="ui-popover-anchor">
      {trigger}
      {/* aria-hidden alone doesn't stop Tab from reaching focusable content
          in here while closed; inert does. Spread because this project's
          pinned @types/react doesn't have `inert` in its types yet. This
          project runs React 18 (see package.json), and React only added
          native boolean handling for `inert` in React 19 - on 18, passing a
          raw boolean hits React's generic "unknown attribute" path and logs
          a dev warning asking for a string. But `inert` is a real HTML
          boolean attribute where *presence* (any value, even "false") means
          inert - so writing `String(!open)` would leave `inert="false"`
          in the DOM when open, which HTML still treats as inert. The
          attribute has to be omitted entirely for the "not inert" case,
          not stringified to "false". */}
      <div
        className={`ui-popover-shell ui-popover-shell--${placement}${slideFrom ? ` ui-popover-shell--slide-${slideFrom}` : ""}${shellClassName ? ` ${shellClassName}` : ""}${open ? " is-open" : ""}`}
        aria-hidden={!open}
        {...{ inert: !open ? "" : undefined }}
      >
        <div
          className={`ui-popover${className ? ` ${className}` : ""}`}
          role={role}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
