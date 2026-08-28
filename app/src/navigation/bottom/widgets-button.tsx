import { useCallback, useRef, useState } from "react";
import styles from "./widgets.module.css";
import { recordOwnRender } from "../../render-test/renderProfilerStats";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import { Popover } from "../../app-core/ui-generics/Popover";
import { Button } from "../../app-core/ui-generics/Button";
import { WidgetsFooter } from "../../graph-components/widgets/footer";
import BarGraph from "../../graph-components/widgets/bargraph";
import ByQuestion from "../../graph-components/widgets/byquestion";

type WidgetView = "bar" | "questions";

const WIDGET_TOOLS = [
  { key: "bar", label: "Bar graph" },
  { key: "questions", label: "By question" },
] as const satisfies { key: WidgetView; label: string }[];

export default function WidgetsButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  recordOwnRender("WidgetsButton");
  const [activeWidgetView, setActiveWidgetView] = useState<WidgetView>("bar");
  const [widgetAutoplayPaused, setWidgetAutoplayPaused] = useState(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenChange = useCallback((next: boolean) => {
    setActiveWidgetView("bar");
    onOpenChange(next);
  }, [onOpenChange]);

  useFocusTrap({ enabled: open, containerRef: dialogRef, returnFocusRef: triggerRef });

  return (
    <div className={styles.widgetsWrap}>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        placement="top-start"
        shellClassName={styles.widgetsPopoverShell}
        dismissOnOutsideClick={false}
        trigger={
          <Button
            ref={triggerRef}
            variant="secondary"
            baseClassName="widgets-button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Widgets"
            onClick={() => { handleOpenChange(!open); }}
          >
            Widgets
          </Button>
        }
      >
        <div ref={dialogRef} className={styles.widgetsPopover}>
          {activeWidgetView === "bar" && (
            <BarGraph
              panelClassName={styles.widgetsView}
              paused={widgetAutoplayPaused}
              onPausedChange={setWidgetAutoplayPaused}
              profilerId="BarGraph:nav-bottom"
            />
          )}
          {activeWidgetView === "questions" && (
            <ByQuestion
              panelClassName={styles.widgetsView}
              paused={widgetAutoplayPaused}
              onPausedChange={setWidgetAutoplayPaused}
            />
          )}
          <WidgetsFooter
            tools={WIDGET_TOOLS}
            activeTool={activeWidgetView}
            onSelectTool={setActiveWidgetView}
            onClose={() => { handleOpenChange(false); }}
            ariaLabel="Widgets"
          />
        </div>
      </Popover>
    </div>
  );
}
