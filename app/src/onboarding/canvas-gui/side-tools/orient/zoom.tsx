import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useWorkspaceCamera } from "../../workspace/use-workspace-camera";
import styles from "../side-tools.module.css";

const ZOOM_ACTIONS = [
  { key: "zoomIn", label: "Zoom in" },
  { key: "zoomOut", label: "Zoom out" },
] as const;

export default function Zoom() {
  const { canZoomIn, canZoomOut, zoomIn, zoomOut } = useWorkspaceCamera();

  return (
    <div className={styles.stack} role="group" aria-label="Canvas zoom">
      {ZOOM_ACTIONS.map((action) => (
        <HoverHintTarget key={action.key} copy={action.label}>
          <button
            type="button"
            className={`ui-icon-nav-button ${styles.button}`}
            aria-label={action.label}
            disabled={action.key === "zoomIn" ? !canZoomIn : !canZoomOut}
            onClick={action.key === "zoomIn" ? zoomIn : zoomOut}
          >
            <GuiIcon name={action.key} className="ui-icon svg-md" />
          </button>
        </HoverHintTarget>
      ))}
    </div>
  );
}
