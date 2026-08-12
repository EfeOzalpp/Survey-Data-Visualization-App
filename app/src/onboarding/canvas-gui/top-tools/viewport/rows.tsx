import { Popover } from "../../../../app/ui/Popover";
import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import rangeStyles from "../../shared/range-control.module.css";
import { useEditorState, type DeviceKey } from "../../state/editor-state-context";
import shared from "../top-tools.module.css";
import styles from "./rows.module.css";

interface RowsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: DeviceKey;
}

function formatDeviceLabel(device: DeviceKey) {
  return device.charAt(0).toUpperCase() + device.slice(1);
}

export default function Rows({ open, onOpenChange, device }: RowsProps) {
  const { state, dispatch } = useEditorState();
  const { rowCount, rowPerspective } = state.deviceLayouts[device];

  return (
    <HoverHintTarget copy="Row controls" disabled={open}>
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="bottom"
        className={styles.popover}
        role="dialog"
        trigger={
          <button
            type="button"
            className={`ui-icon-nav-button ${shared.iconButton}${open ? " is-active" : ""}`}
            aria-label="Open row controls"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => { onOpenChange(!open); }}
          >
            <GuiIcon name="row" className="ui-icon svg-md" />
          </button>
        }
      >
        <div className={styles.panel}>
          <div className={styles.content}>
            For device: <span>{formatDeviceLabel(device)}</span>
          </div>
          <div className={styles.rowControl}>
            <div className={rangeStyles.control}>
              <input
                className={rangeStyles.slider}
                type="range"
                min="1"
                max="20"
                step="1"
                value={rowCount}
                aria-label={`${formatDeviceLabel(device)} row count: ${String(rowCount)}`}
                onChange={(event) => {
                  dispatch({
                    type: "set-row-count",
                    device,
                    rowCount: Number(event.currentTarget.value),
                  });
                }}
              />
            </div>
            <span className={styles.rowCount}>Row count: {rowCount}</span>
          </div>
          <div className={styles.perspectiveControl}>
            <div className={rangeStyles.control}>
              <input
                className={rangeStyles.slider}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={rowPerspective}
                aria-label={`${formatDeviceLabel(device)} row perspective: ${rowPerspective.toFixed(2)}`}
                onChange={(event) => {
                  dispatch({
                    type: "set-row-perspective",
                    device,
                    rowPerspective: Number(event.currentTarget.value),
                  });
                }}
              />
            </div>
            <span className={styles.rowCount}>
              Row perspective: {rowPerspective.toFixed(2)}
            </span>
          </div>
        </div>
      </Popover>
    </HoverHintTarget>
  );
}
