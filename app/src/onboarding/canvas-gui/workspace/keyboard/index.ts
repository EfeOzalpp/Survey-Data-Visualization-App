import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useEditorState, type EditorTool } from "../../state/editor-state-context";

export function useWorkspaceKeyboard() {
  const { state, dispatch } = useEditorState();
  const activeToolRef = useRef<EditorTool>(state.activeTool);
  const previousToolRef = useRef<EditorTool | null>(null);
  const pointerInsideRef = useRef(false);
  const spacePressedRef = useRef(false);

  useLayoutEffect(() => {
    activeToolRef.current = state.activeTool;
  }, [state.activeTool]);

  const activateMove = useCallback(() => {
    if (previousToolRef.current !== null) return;

    previousToolRef.current = activeToolRef.current;
    if (activeToolRef.current !== "move") {
      dispatch({ type: "set-tool", tool: "move" });
    }
  }, [dispatch]);

  const restorePreviousTool = useCallback(() => {
    const previousTool = previousToolRef.current;
    if (previousTool === null) return;

    previousToolRef.current = null;
    dispatch({ type: "set-tool", tool: previousTool });
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;

      spacePressedRef.current = true;
      if (!pointerInsideRef.current) return;

      event.preventDefault();
      activateMove();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;

      spacePressedRef.current = false;
      if (previousToolRef.current !== null) event.preventDefault();
      restorePreviousTool();
    };

    const handleWindowBlur = () => {
      spacePressedRef.current = false;
      restorePreviousTool();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      restorePreviousTool();
    };
  }, [activateMove, restorePreviousTool]);

  const handlePointerEnter = useCallback(() => {
    pointerInsideRef.current = true;
    if (spacePressedRef.current) activateMove();
  }, [activateMove]);

  const handlePointerLeave = useCallback(() => {
    pointerInsideRef.current = false;
    restorePreviousTool();
  }, [restorePreviousTool]);

  return { handlePointerEnter, handlePointerLeave };
}
