import GuiIcon from "../../../../../assets/svg/gui/GuiIcon";
import { HoverHintTarget } from "../../../shared/hover-hint";
import { useEditorState } from "../../../state/editor-state-context";
import shared from "../../top-tools.module.css";
import ToolSliderPopover from "../shared/tool-slider-popover";

export default function Eraser() {
  const { state, dispatch } = useEditorState();

  return (
    <div className={`${shared.group} ${shared.drawingToolGroup}`}>
      <div className={shared.toolIdentity}>
        <span className={shared.label}>Eraser</span>
        <div className={shared.toolActions}>
          <HoverHintTarget copy="Select eraser">
            <button
              type="button"
              className={`ui-icon-nav-button ${shared.toolButton}`}
              aria-label="Select eraser"
              aria-pressed={state.activeTool === "eraser"}
              onClick={() => { dispatch({ type: "set-tool", tool: "eraser" }); }}
            >
              <GuiIcon name="erase" className="ui-icon svg-md" />
            </button>
          </HoverHintTarget>
          <div className={shared.sizeControl}>
            <ToolSliderPopover tool="eraser" />
          </div>
        </div>
      </div>
    </div>
  );
}
