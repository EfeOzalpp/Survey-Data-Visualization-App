// src/scene-canvas/EngineHost.tsx
// View CanvasEntry to see how a canvas is imported via EngineHost API

import React from "react";
import { useCanvasEngine } from "./hooks/useCanvasEngine";
import { useViewportKey } from "./hooks/useViewportKey";
import { useSceneField } from "./hooks/useSceneField";
import { stopCanvasEngine } from "./runtime/index";
import type { Place } from "./grid-layout/occupancy";
import type { SpotlightSignal } from "./hooks/signals";
import type { EngineShapeLightSource } from "./runtime/engine/state";

import { getHostDef, HOST_DEFS, type CanvasBounds, type HostId } from "./multi-canvas-setup/hostDefs";
import { useCanvasPointerHit } from "./hooks/useCanvasPointerHit";
import type { EngineFieldItem } from "./runtime/engine/field";

const VIEWPORT_ANIMATION_ROOT_MARGIN = "100px";

function useHostInViewport(mount: string, pauseWhenOffscreen: boolean) {
  // Begin active so every host can paint its initial frame. IntersectionObserver
  // then moves offscreen hosts into mounted-static mode after the first commit.
  const [inViewport, setInViewport] = React.useState(true);

  React.useEffect(() => {
    if (!pauseWhenOffscreen) return;
    if (typeof IntersectionObserver === "undefined") return;

    const mountElement = document.querySelector(mount);
    if (!(mountElement instanceof HTMLElement)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInViewport(entry.isIntersecting);
      },
      { rootMargin: VIEWPORT_ANIMATION_ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(mountElement);
    return () => { observer.disconnect(); };
  }, [mount, pauseWhenOffscreen]);

  return !pauseWhenOffscreen || inViewport;
}

export function EngineHost({
  id,
  open = true,
  visible = true,
  liveAvg = 0.5,
  reservedFootprints,
  spotlight,
  fog,
  shapeLightSource,
  onShapeHover,
  onShapeClick,
}: {
  id: HostId;
  open?: boolean;
  visible?: boolean;
  liveAvg?: number;
  reservedFootprints?: Place[];
  spotlight?: SpotlightSignal;
  fog?: boolean;
  shapeLightSource?: EngineShapeLightSource | null;
  onShapeHover?: (item: EngineFieldItem | null) => void;
  onShapeClick?: (item: EngineFieldItem | null) => void;
}) {
  const hostDef = React.useMemo(() => getHostDef(id), [id]);

  const stopOnOpenMounts = React.useMemo(() => {
    const ids = hostDef.stopOnOpen ?? [];
    return ids.map((otherId) => HOST_DEFS[otherId].mount);
  }, [hostDef]);

  const resolvedBounds = React.useMemo<CanvasBounds | undefined>(() => {
    return hostDef.canvasDimensions;
  }, [hostDef]);

  const animationActive = useHostInViewport(
    hostDef.mount,
    hostDef.pauseWhenOffscreen ?? false
  );

  React.useEffect(() => {
    if (!open) return;
    for (const mount of stopOnOpenMounts) {
      try {
        stopCanvasEngine(mount);
      } catch (err) {
        console.warn('[EngineHost] Failed to stop canvas engine on mount:', mount, err);
      }
    }
  }, [open, stopOnOpenMounts]);

  const engine = useCanvasEngine({
    enabled: open,
    visible,
    dprMode: hostDef.dprMode,
    mount: hostDef.mount,
    zIndex: hostDef.zIndex,
    bounds: resolvedBounds,
    fpsCap: hostDef.fpsCap,
    animationActive,
  });

  const viewportKey = useViewportKey(120);

  useSceneField(
    engine,
    id,
    liveAvg,
    reservedFootprints,
    viewportKey,
    spotlight?.index,
    fog,
    shapeLightSource,
    hostDef.initialFieldDelayMs,
    hostDef.initialComposeDelayMs
  );

  React.useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!engine.ready.current) return;

    const controls = engine.controls.current;
    if (!controls) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void import("./runtime/debug/placementAuthoring")
      .then(({ installPlacementAuthoring }) => {
        if (cancelled) return;
        cleanup = installPlacementAuthoring({ hostId: id, controls });
      })
      .catch((err: unknown) => {
        console.warn("[EngineHost] Failed to install placement authoring:", err);
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [engine.controls, engine.ready, engine.readyTick, id]);

  React.useLayoutEffect(() => {
    if (!engine.ready.current) return;
    engine.controls.current?.setInputs({ liveAvg, spotlight });
  }, [engine, liveAvg, spotlight]);

  useCanvasPointerHit(
    engine,
    onShapeHover,
    onShapeClick,
    { enabled: hostDef.pointerHit ?? false, hoverSignalEnabled: false, hoverCursor: "pointer" }
  );

  return null;
}
