import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState } from "../../state/editor-state-context";
import styles from "../side-tools.module.css";

export default function HideTooling() {
  const { state, dispatch } = useEditorState();
  const label = state.toolingCollapsed ? "Show editor tooling" : "Hide editor tooling";

  return (
    <HoverHintTarget copy={label}>
      <button
        type="button"
        className={`ui-icon-nav-button ${styles.button}`}
        aria-label={label}
        aria-expanded={!state.toolingCollapsed}
        onClick={() => { dispatch({ type: "toggle-tooling" }); }}
      >
        <GuiIcon
          name={state.toolingCollapsed ? "expandTooling" : "collapseTooling"}
          className="ui-icon svg-sm"
        />
      </button>
    </HoverHintTarget>
  );
}
