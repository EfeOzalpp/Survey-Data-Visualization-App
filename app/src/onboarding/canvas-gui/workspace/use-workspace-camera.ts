import { useCallback } from "react";

import { useEditorState, type WorkspaceCamera } from "../state/editor-state-context";

export const MIN_WORKSPACE_ZOOM = 0.25;
export const MAX_WORKSPACE_ZOOM = 4;
const WORKSPACE_ZOOM_STEP = 0.1;

function clampZoom(zoom: number) {
  return Math.min(MAX_WORKSPACE_ZOOM, Math.max(MIN_WORKSPACE_ZOOM, zoom));
}

export function useWorkspaceCamera() {
  const { state, dispatch } = useEditorState();
  const camera = state.workspaceCamera;

  const setCamera = useCallback((nextCamera: WorkspaceCamera) => {
    dispatch({
      type: "set-workspace-camera",
      camera: {
        ...nextCamera,
        zoom: clampZoom(nextCamera.zoom),
      },
    });
  }, [dispatch]);

  const zoomBy = useCallback((amount: number) => {
    setCamera({
      ...camera,
      zoom: camera.zoom + amount,
    });
  }, [camera, setCamera]);

  return {
    camera,
    setCamera,
    zoomIn: () => { zoomBy(WORKSPACE_ZOOM_STEP); },
    zoomOut: () => { zoomBy(-WORKSPACE_ZOOM_STEP); },
    canZoomIn: camera.zoom < MAX_WORKSPACE_ZOOM,
    canZoomOut: camera.zoom > MIN_WORKSPACE_ZOOM,
  };
}
