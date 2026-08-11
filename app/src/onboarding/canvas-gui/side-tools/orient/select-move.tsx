import GuiIcon from "../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState } from "../../state/editor-state-context";
import styles from "../side-tools.module.css";

const MODES = [
  { key: "move", label: "Move" },
  { key: "select", label: "Select" },
] as const;

export default function SelectMove() {
  const { state, dispatch } = useEditorState();

  return (
    <div className={styles.stack} role="group" aria-label="Canvas orientation mode">
      {MODES.map((mode) => {
        const active = state.activeTool === mode.key;

        return (
          <HoverHintTarget key={mode.key} copy={mode.label}>
            <button
              type="button"
              className={`ui-icon-nav-button ${styles.button}${active ? ` ${styles.buttonActive}` : ""}`}
              aria-label={mode.label}
              aria-pressed={active}
              onClick={() => { dispatch({ type: "set-tool", tool: mode.key }); }}
            >
              <GuiIcon name={mode.key} className="ui-icon svg-md" />
            </button>
          </HoverHintTarget>
        );
      })}
    </div>
  );
}
