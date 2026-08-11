import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import styles from "../side-tools.module.css";

const ZOOM_ACTIONS = [
  { key: "zoomIn", label: "Zoom in" },
  { key: "zoomOut", label: "Zoom out" },
] as const;

export default function Zoom() {
  return (
    <div className={styles.stack} role="group" aria-label="Canvas zoom">
      {ZOOM_ACTIONS.map((action) => (
        <HoverHintTarget key={action.key} copy={action.label}>
          <button
            type="button"
            className={`ui-icon-nav-button ${styles.button}`}
            aria-label={action.label}
          >
            <GuiIcon name={action.key} className="ui-icon svg-md" />
          </button>
        </HoverHintTarget>
      ))}
    </div>
  );
}
