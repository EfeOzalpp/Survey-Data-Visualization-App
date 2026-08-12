import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState } from "../../state/editor-state-context";
import styles from "../side-tools.module.css";

export default function Grid() {
  const { state, dispatch } = useEditorState();
  const hint = state.gridVisible ? "Hide grid" : "Show grid";

  return (
    <HoverHintTarget copy={hint}>
      <button
        type="button"
        className={`ui-icon-nav-button ${styles.button}${state.gridVisible ? ` ${styles.buttonActive}` : ""}`}
        aria-label={hint}
        aria-pressed={state.gridVisible}
        onClick={() => { dispatch({ type: "toggle-grid" }); }}
      >
        <GuiIcon
          name={state.gridVisible ? "gridOn" : "gridOff"}
          className="ui-icon svg-sm"
        />
      </button>
    </HoverHintTarget>
  );
}
