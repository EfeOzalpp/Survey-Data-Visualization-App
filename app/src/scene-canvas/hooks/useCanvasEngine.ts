// src/scene-canvas/hooks/useCanvasEngine.ts

import { useEffect, useRef, useState } from "react";
import type { CanvasBounds } from "../multi-canvas-setup/hostDefs";
import type { EngineLayoutMode } from "../runtime/platform/mount";
import type { DprMode } from "../runtime/platform/viewport";
import {
  startCanvasEngine,
  stopCanvasEngine,
  type CanvasEngineControls,
} from "../runtime/index";
import { readStoredDarkMode } from "../../app/session";

interface EngineOpts {
  enabled?: boolean;
  visible?: boolean;
  dprMode?: DprMode;
  mount?: string;
  zIndex?: number;
  bounds?: CanvasBounds;
  fpsCap?: number;
  animationActive?: boolean;
  layout?: EngineLayoutMode;
}

function safeCall(fn: (() => void) | null | undefined, label?: string) {
  try {
    fn?.();
  } catch (err) {
    console.warn(`[useCanvasEngine] safeCall failed${label ? ` (${label})` : ''}:`, err);
  }
}

function shutdownControls(controls: CanvasEngineControls | null, mount: string) {
  if (!controls) {
    // Still ensure the mount is torn down, in case a partial init happened.
    safeCall(() => {
      stopCanvasEngine(mount);
    });
    return;
  }

  // First hide, then stop. Hiding first reduces visible flash during teardown.
  safeCall(() => {
    controls.setVisible(false);
  });
  safeCall(() => {
    controls.stop();
  });

  // Ensure the mount node and any engine-owned listeners are detached.
  safeCall(() => {
    stopCanvasEngine(mount);
  });
}

export function useCanvasEngine(opts: EngineOpts = {}) {
  const {
    enabled = true,
    visible = true,
    dprMode = "cap3",
    mount = "#canvas-root",
    zIndex = 2,
    bounds,
    fpsCap,
    animationActive = true,
    layout = "fixed",
  } = opts;

  const controlsRef = useRef<CanvasEngineControls | null>(null);
  const readyRef = useRef(false);
  const [readyTick, setReadyTick] = useState(0);

  useEffect(() => {
    // If disabled, ensure we are stopped and exit without starting.
    if (!enabled) {
      readyRef.current = false;

      const controls = controlsRef.current;
      controlsRef.current = null;

      shutdownControls(controls, mount);
      return;
    }

    readyRef.current = false;

    controlsRef.current = startCanvasEngine({
      mount,
      dprMode,
      zIndex,
      bounds,
      fpsCap,
      layout,
      initialDarkMode: readStoredDarkMode(false),
      onReady: () => {
        readyRef.current = true;
        setReadyTick((t) => t + 1);
      },
    });

    return () => {
      readyRef.current = false;

      const controls = controlsRef.current;
      controlsRef.current = null;

      shutdownControls(controls, mount);
    };
  }, [enabled, dprMode, mount, zIndex, bounds, fpsCap, layout]);

  useEffect(() => {
    safeCall(() => {
      controlsRef.current?.setVisible(visible);
    });
  }, [visible]);

  useEffect(() => {
    safeCall(() => {
      controlsRef.current?.setAnimationActive(animationActive);
    });
  }, [animationActive]);

  return {
    ready: readyRef,
    controls: controlsRef,
    readyTick,
  };
}
