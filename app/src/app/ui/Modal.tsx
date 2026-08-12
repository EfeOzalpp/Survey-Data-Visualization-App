// src/app/ui/Modal.tsx
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "../../lib/hooks/useEscapeToClose";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import "../../styles/ui/modal.css";

// Shared shell for full dialogs (bottom-sheet on mobile, centered card at
// 768px+) - handles the portal, overlay, open/close transition, escape-to-close
// and focus trap. Sizing (min/max-height, shell width) is deliberately left to
// each consumer via shellClassName/cardClassName so dialogs can size themselves
// independently while sharing the same positioning/transition mechanics.
export function Modal({
  open,
  onOpenChange,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  shellClassName,
  cardClassName,
  overlayLabel = "Close dialog",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // For dialogs with no visible heading element to point ariaLabelledBy at.
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  shellClassName?: string;
  cardClassName?: string;
  overlayLabel?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEscapeToClose(open, () => { onOpenChange(false); });
  useFocusTrap({ enabled: open, containerRef: dialogRef, focusContainerOnTouch: true });

  // Spread: `inert` isn't in this project's pinned @types/react yet, but a
  // real boolean is correct here - see Popover.tsx for details.
  const modal = (
    <div className={`ui-modal-root${open ? " is-open" : ""}`} aria-hidden={!open} {...{ inert: !open }}>
      <button
        type="button"
        className="ui-modal-overlay"
        aria-label={overlayLabel}
        tabIndex={-1}
        onClick={() => { onOpenChange(false); }}
      />

      <div className={`ui-modal-shell${shellClassName ? ` ${shellClassName}` : ""}`}>
        <div
          ref={dialogRef}
          className={`ui-modal-card${cardClassName ? ` ${cardClassName}` : ""}`}
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}
