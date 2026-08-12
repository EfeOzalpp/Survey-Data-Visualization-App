import { useState } from "react";

import { Popover } from "../../../../../app/ui/Popover";
import ChevronIcon from "../../../../../assets/svg/chevron/ChevronIcon";
import { HoverHintTarget } from "../../../shared/hover-hint";
import rangeStyles from "../../../shared/range-control.module.css";
import { useEditorState, type DrawingTool } from "../../../state/editor-state-context";
import shared from "../../top-tools.module.css";
import styles from "./tool-slider.module.css";

const TOOL_CONFIG = {
  brush: { label: "Brush" },
  eraser: { label: "Eraser" },
} as const;

export default function ToolSliderPopover({ tool }: { tool: DrawingTool }) {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useEditorState();
  const size = state.drawingSizes[tool];
  const config = TOOL_CONFIG[tool];
  const unitLabel = size === 1 ? "tile" : "tiles";
  const previewDiameter = size * 4;

  return (
    <HoverHintTarget copy={`${config.label} size`} disabled={open}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom"
        className={styles.popover}
        role="dialog"
        trigger={
          <button
            type="button"
            className={`ui-icon-nav-button ${shared.sizeButton}${open ? " is-active" : ""}`}
            aria-label={`Open ${config.label.toLowerCase()} size controls`}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => { setOpen((current) => !current); }}
          >
            <ChevronIcon direction="next" className={`ui-icon svg-sm ${shared.sizeChevron}`} />
          </button>
        }
      >
        <div className={styles.content}>
          <div className={styles.preview} aria-hidden="true">
            <span className={styles.previewStage}>
              <span
                className={styles.previewCircle}
                style={{
                  width: `${String(previewDiameter)}px`,
                  height: `${String(previewDiameter)}px`,
                }}
              />
            </span>
            <span className={styles.previewValue}>{size} {unitLabel}</span>
          </div>
          <div className={rangeStyles.control}>
            <input
              className={rangeStyles.slider}
              type="range"
              min="1"
              max="10"
              step="1"
              value={size}
              aria-label={`${config.label} size: ${String(size)} ${unitLabel}`}
              onChange={(event) => {
                dispatch({
                  type: "set-drawing-size",
                  tool,
                  size: Number(event.currentTarget.value),
                });
              }}
            />
          </div>
        </div>
      </Popover>
    </HoverHintTarget>
  );
}
