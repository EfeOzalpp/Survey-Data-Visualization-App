import GuiIcon from "../../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../../shared/hover-hint";
import { useEditorState } from "../../../state/editor-state-context";
import shared from "../../top-tools.module.css";
import ToolSliderPopover from "../shared/tool-slider-popover";

export default function Brush() {
  const { state, dispatch } = useEditorState();

  return (
    <div className={`${shared.group} ${shared.drawingToolGroup}`}>
      <div className={shared.toolIdentity}>
        <span className={shared.label}>Brush</span>
        <div className={shared.toolActions}>
          <HoverHintTarget copy="Select brush">
            <button
              type="button"
              className={`ui-icon-nav-button ${shared.toolButton}`}
              aria-label="Select brush"
              aria-pressed={state.activeTool === "brush"}
              onClick={() => { dispatch({ type: "set-tool", tool: "brush" }); }}
            >
              <GuiIcon name="brush" className="ui-icon svg-md" />
            </button>
          </HoverHintTarget>
          <div className={shared.sizeControl}>
            <ToolSliderPopover tool="brush" />
          </div>
        </div>
      </div>
    </div>
  );
}
