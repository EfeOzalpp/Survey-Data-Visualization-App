import { useEffect, useRef, useState } from "react";

import { useCanvasEngine } from "../hooks/useCanvasEngine";
import { useSceneField } from "../hooks/useSceneField";
import { useViewportKey } from "../hooks/useViewportKey";
import type { DeviceType } from "../shared/responsiveness";

const EDITOR_PREVIEW_MOUNT_ID = "canvas-editor-preview-root";
const EDITOR_PREVIEW_MOUNT = `#${EDITOR_PREVIEW_MOUNT_ID}`;
// Workspace zoom is a CSS transform on an ancestor. Layout-box dimensions
// keep that visual scale out of the engine's logical resize calculation.
const EDITOR_PREVIEW_BOUNDS = { kind: "parent-layout" } as const;
const EDITOR_PREVIEW_ROOT_MARGIN = "100px";

interface EditorRuntimePreviewProps {
  ariaLabel: string;
  className?: string;
  width: number;
  height: number;
  ruleDevice: DeviceType;
  ruleWidthPx: number;
}

export function EditorRuntimePreview({
  ariaLabel,
  className,
  width,
  height,
  ruleDevice,
  ruleWidthPx,
}: EditorRuntimePreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [animationActive, setAnimationActive] = useState(true);
  const viewportKey = useViewportKey(120);
  const engine = useCanvasEngine({
    mount: EDITOR_PREVIEW_MOUNT,
    bounds: EDITOR_PREVIEW_BOUNDS,
    dprMode: "cap2",
    fpsCap: 60,
    layout: "inherit",
    animationActive,
  });

  useSceneField(
    engine,
    "start",
    0.5,
    undefined,
    viewportKey,
    undefined,
    undefined,
    undefined,
    0,
    0,
    { ruleDevice, ruleWidthPx }
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => { setAnimationActive(entry.isIntersecting); },
      { rootMargin: EDITOR_PREVIEW_ROOT_MARGIN, threshold: 0 }
    );
    observer.observe(mount);

    return () => { observer.disconnect(); };
  }, []);

  return (
    <div
      ref={mountRef}
      id={EDITOR_PREVIEW_MOUNT_ID}
      className={className}
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
