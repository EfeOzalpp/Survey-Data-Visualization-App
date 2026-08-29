import type { ReactNode } from "react";

import CloseIcon from "../../assets/svg/close/CloseIcon";
import "../../styles/ui-generics/hint-banner.css";

interface HintBannerProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
  copyClassName?: string;
  closeClassName?: string;
  closeLabel?: string;
  onDismiss?: () => void;
}

function classes(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export default function HintBanner({
  visible,
  children,
  className,
  copyClassName,
  closeClassName,
  closeLabel = "Dismiss notice",
  onDismiss,
}: HintBannerProps) {
  // Spread: `inert` isn't in this project's pinned @types/react yet, and on
  // this project's React 18 it must be a string (or omitted) - see
  // Popover.tsx for the full explanation.
  return (
    <div
      className={classes("hint-banner", visible && "is-visible", onDismiss && "is-dismissible", className)}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      {...{ inert: !visible ? "" : undefined }}
    >
      <span className={classes("hint-banner-copy", copyClassName)}>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          className={classes("hint-banner-close", closeClassName)}
          aria-label={closeLabel}
          onClick={() => { onDismiss(); }}
        >
          <CloseIcon className="ui-close svg-sm" />
        </button>
      ) : null}
    </div>
  );
}
