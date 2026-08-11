import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState } from "../../state/editor-state-context";
import shared from "../top-tools.module.css";
import styles from "./view.module.css";

export default function View() {
  const { state, dispatch } = useEditorState();

  return (
    <div className={`${shared.group} ${styles.group}`}>
      <div className={styles.toggleStack}>
        <HoverHintTarget copy="Canvas view">
          <button
            type="button"
            className={`ui-icon-text-button ${styles.toggle}${state.activeView === "canvas" ? ` ${styles.toggleActive}` : ""}`}
            aria-pressed={state.activeView === "canvas"}
            onClick={() => { dispatch({ type: "set-view", view: "canvas" }); }}
          >
            <GuiIcon name="canvas" className="ui-icon svg-md" />
            <span className={styles.toggleLabel}>Canvas</span>
          </button>
        </HoverHintTarget>
        <HoverHintTarget copy="Notation view">
          <button
            type="button"
            className={`ui-icon-text-button ${styles.toggle}${state.activeView === "notation" ? ` ${styles.toggleActive}` : ""}`}
            aria-pressed={state.activeView === "notation"}
            onClick={() => { dispatch({ type: "set-view", view: "notation" }); }}
          >
            <GuiIcon name="terminal" className="ui-icon svg-md" />
            <span className={styles.toggleLabel}>Notation</span>
          </button>
        </HoverHintTarget>
      </div>
    </div>
  );
}
