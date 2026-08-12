import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { usePreferences } from "../../../app/state/preferences-context";
import { EditorRuntimePreview } from "../../../scene-canvas/editor-runtime";
import { useEditorState, type WorkspaceCamera } from "../state/editor-state-context";
import { useWorkspaceKeyboard } from "./keyboard";
import { resolveDeviceCanvasSize } from "./lib/device-canvas-size";
import { resolveSimulatedViewport } from "./lib/simulated-viewport";
import { readWorkspaceCursorColor, resolveWorkspaceCursor } from "./lib/tool-cursor";
import { useWorkspaceCamera } from "./use-workspace-camera";
import styles from "./workspace.module.css";

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: WorkspaceCamera;
  nextCamera: WorkspaceCamera;
}

function cameraTransform(camera: WorkspaceCamera) {
  return `translate3d(calc(-50% + ${String(camera.x)}px), calc(-50% + ${String(camera.y)}px), 0) scale(${String(camera.zoom)})`;
}

export default function CanvasWorkspace({ fullscreen = false }: { fullscreen?: boolean }) {
  const { darkMode } = usePreferences();
  const { state } = useEditorState();
  const { camera, setCamera } = useWorkspaceCamera();
  const { handlePointerEnter, handlePointerLeave } = useWorkspaceKeyboard();
  const viewportRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [cursorColor, setCursorColor] = useState("");
  const size = resolveDeviceCanvasSize(state.activeDevice, viewportWidth, fullscreen);
  const simulatedViewport = resolveSimulatedViewport(state.activeDevice);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCursorColor(readWorkspaceCursorColor());
    });

    return () => { window.cancelAnimationFrame(frame); };
  }, [darkMode]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = (width: number) => {
      const nextWidth = Math.round(width);
      setViewportWidth((currentWidth) => (
        currentWidth === nextWidth ? currentWidth : nextWidth
      ));
    };

    updateWidth(viewport.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width);
    });
    observer.observe(viewport);

    return () => { observer.disconnect(); };
  }, []);

  const applyCamera = (nextCamera: WorkspaceCamera) => {
    if (planeRef.current) {
      planeRef.current.style.transform = cameraTransform(nextCamera);
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.activeTool !== "move" || event.button !== 0) return;

    const nextDrag: DragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCamera: camera,
      nextCamera: camera,
    };

    dragRef.current = nextDrag;
    event.currentTarget.dataset.panning = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;

    drag.nextCamera = {
      ...drag.startCamera,
      x: drag.startCamera.x + event.clientX - drag.startClientX,
      y: drag.startCamera.y + event.clientY - drag.startClientY,
    };
    applyCamera(drag.nextCamera);
  };

  const finishDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;

    dragRef.current = null;
    delete event.currentTarget.dataset.panning;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCamera(drag.nextCamera);
  };

  return (
    <div
      ref={viewportRef}
      className={`${styles.viewport}${fullscreen ? ` ${styles.fullscreen}` : ""}`}
      data-tool={state.activeTool}
      style={{ cursor: resolveWorkspaceCursor(state.activeTool, cursorColor) }}
      aria-label="Visual editor workspace"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
    >
      <div
        ref={planeRef}
        className={styles.plane}
        style={{ transform: cameraTransform(camera) }}
      >
        <EditorRuntimePreview
          ariaLabel={`${state.activeDevice} scene preview, ${String(size.width)} by ${String(size.height)} pixels`}
          className={styles.canvasMount}
          width={size.width}
          height={size.height}
          ruleDevice={simulatedViewport.ruleDevice}
          ruleWidthPx={simulatedViewport.ruleWidthPx}
        />
      </div>
    </div>
  );
}
