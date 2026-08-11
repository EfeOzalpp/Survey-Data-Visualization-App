import { useMemo, useReducer, type ReactNode } from "react";

import {
  EditorStateContext,
  type EditorAction,
  type EditorState,
} from "./editor-state-context";

const INITIAL_EDITOR_STATE: EditorState = {
  activeTool: "select",
  activeView: "canvas",
  activeDevice: "desktop",
  selectedPreset: "temperate",
  activeAsset: "house",
  gridVisible: true,
  isFullscreen: false,
  drawingSizes: {
    brush: 5,
    eraser: 5,
  },
  deviceLayouts: {
    mobile: { rowCount: 10, rowPerspective: 0.5 },
    tablet: { rowCount: 10, rowPerspective: 0.5 },
    desktop: { rowCount: 10, rowPerspective: 0.5 },
  },
};

function editorStateReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "set-tool":
      return { ...state, activeTool: action.tool };
    case "set-view":
      return { ...state, activeView: action.view };
    case "set-device":
      return { ...state, activeDevice: action.device };
    case "set-preset":
      return { ...state, selectedPreset: action.preset };
    case "set-asset":
      return { ...state, activeAsset: action.asset };
    case "toggle-grid":
      return { ...state, gridVisible: !state.gridVisible };
    case "set-fullscreen":
      return { ...state, isFullscreen: action.fullscreen };
    case "set-drawing-size":
      return {
        ...state,
        drawingSizes: {
          ...state.drawingSizes,
          [action.tool]: action.size,
        },
      };
    case "set-row-count":
      return {
        ...state,
        deviceLayouts: {
          ...state.deviceLayouts,
          [action.device]: {
            ...state.deviceLayouts[action.device],
            rowCount: action.rowCount,
          },
        },
      };
    case "set-row-perspective":
      return {
        ...state,
        deviceLayouts: {
          ...state.deviceLayouts,
          [action.device]: {
            ...state.deviceLayouts[action.device],
            rowPerspective: action.rowPerspective,
          },
        },
      };
  }
}

export default function EditorStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorStateReducer, INITIAL_EDITOR_STATE);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <EditorStateContext.Provider value={value}>
      {children}
    </EditorStateContext.Provider>
  );
}
