import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState } from "../../state/editor-state-context";
import styles from "../side-tools.module.css";

export default function Fullscreen() {
  const { state, dispatch } = useEditorState();
  const label = state.isFullscreen ? "Exit fullscreen" : "Enter fullscreen";

  return (
    <HoverHintTarget copy={label}>
      <button
        type="button"
        className={`ui-icon-nav-button ${styles.button}${state.isFullscreen ? ` ${styles.buttonActive}` : ""}`}
        aria-label={label}
        aria-pressed={state.isFullscreen}
        onClick={() => {
          dispatch({ type: "set-fullscreen", fullscreen: !state.isFullscreen });
        }}
      >
        <GuiIcon
          name={state.isFullscreen ? "closeFullscreen" : "fullscreen"}
          className="ui-icon svg-md"
        />
      </button>
    </HoverHintTarget>
  );
}
