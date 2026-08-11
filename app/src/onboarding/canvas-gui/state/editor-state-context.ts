import { createContext, useContext, type Dispatch } from "react";

export type EditorTool = "select" | "move" | "brush" | "eraser";
export type DrawingTool = Extract<EditorTool, "brush" | "eraser">;
export type EditorView = "canvas" | "notation";
export type DeviceKey = "mobile" | "tablet" | "desktop";
export type PresetValue = "desert" | "temperate";
export type AssetKey =
  | "house"
  | "carFactory"
  | "car"
  | "bus"
  | "clouds"
  | "power"
  | "sea"
  | "snow"
  | "sun"
  | "trees"
  | "villa";

export interface DeviceLayout {
  rowCount: number;
  rowPerspective: number;
}

export interface EditorState {
  activeTool: EditorTool;
  activeView: EditorView;
  activeDevice: DeviceKey;
  selectedPreset: PresetValue;
  activeAsset: AssetKey;
  gridVisible: boolean;
  isFullscreen: boolean;
  drawingSizes: Record<DrawingTool, number>;
  deviceLayouts: Record<DeviceKey, DeviceLayout>;
}

export type EditorAction =
  | { type: "set-tool"; tool: EditorTool }
  | { type: "set-view"; view: EditorView }
  | { type: "set-device"; device: DeviceKey }
  | { type: "set-preset"; preset: PresetValue }
  | { type: "set-asset"; asset: AssetKey }
  | { type: "toggle-grid" }
  | { type: "set-fullscreen"; fullscreen: boolean }
  | { type: "set-drawing-size"; tool: DrawingTool; size: number }
  | { type: "set-row-count"; device: DeviceKey; rowCount: number }
  | { type: "set-row-perspective"; device: DeviceKey; rowPerspective: number };

interface EditorStateContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

export const EditorStateContext = createContext<EditorStateContextValue | null>(null);

export function useEditorState() {
  const context = useContext(EditorStateContext);
  if (!context) throw new Error("useEditorState must be used within EditorStateProvider");
  return context;
}
