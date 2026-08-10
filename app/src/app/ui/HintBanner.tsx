import type { ReactNode } from "react";

import CloseIcon from "../../assets/svg/close/CloseIcon";
import "../../styles/ui/hint-banner.css";

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
  // Spread: `inert` isn't in this project's pinned @types/react yet, but a
  // real boolean is correct here - see Popover.tsx for details.
  return (
    <div
      className={classes("hint-banner", visible && "is-visible", onDismiss && "is-dismissible", className)}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      {...{ inert: !visible }}
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
