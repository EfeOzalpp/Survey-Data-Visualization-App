import { useCallback, useRef, type RefObject } from "react";
import "../../styles/logs.css";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { Popover } from "../../app/ui/Popover";
import { LogsPanel } from "../../logs";

export default function LogsButton({
  open,
  onOpenChange,
  dismissExclude,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Forwarded to Popover - see its dismissExclude doc.
  dismissExclude?: RefObject<HTMLElement | null>[];
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeLogs = useCallback(() => { onOpenChange(false); }, [onOpenChange]);

  // Popover already handles escape-to-close and click-outside; focus trap is
  // the one thing it doesn't own, so that stays here against the real panel.
  useFocusTrap({ enabled: open, containerRef: dialogRef, returnFocusRef: triggerRef });

  return (
    <div className="logs-wrap">
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="top-start"
        shellClassName="logs-popover-shell"
        dismissExclude={dismissExclude}
        trigger={
          <button
            ref={triggerRef}
            type="button"
            className="logs-button"
            data-label="Logs"
            aria-label="Logs"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => { onOpenChange(!open); }}
          >
            <span className="logs-button__inner">Logs</span>
          </button>
        }
      >
        <LogsPanel panelRef={dialogRef} onClose={closeLogs} />
      </Popover>
    </div>
  );
}
