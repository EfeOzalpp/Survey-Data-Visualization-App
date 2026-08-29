// src/graph-runtime/dotgraph/canvas-host.tsx
// App-facing host for mounting the DotGraph scene and cleaning up WebGL resources.

import React, { Profiler, useEffect, useMemo, useRef, useState } from 'react';
import { profilerOnRenderGraph } from '../../render-test/renderProfilerStatsGraph';
import { Canvas } from '../r3f';
import { AdaptiveDpr } from '@react-three/drei/core/AdaptiveDpr';
import { AdaptiveEvents } from '@react-three/drei/core/AdaptiveEvents';
import { Preload } from '@react-three/drei/core/Preload';
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  type WebGLRenderer,
} from '../three';

import DotGraph from "./scene";

import { useUiStore } from "../../app-core/state/stores/ui-store";
import { useShallow } from "zustand/react/shallow";
import { useSurveyDataStore } from "../../app-core/state/stores/survey-data-store";
import { useRealMobileViewport } from "../../lib/hooks/useRealMobileViewport";
import { DEFAULT_VIEWPORT_WIDTH, isMobileWidth } from "../../lib/responsive/breakpoints";
import { desktopGraphToolsOffsetPx } from "../../lib/responsive/graph-tools-offset";

import {
  bumpGeneration,
  resetQueue,
  disposeAllSpriteTextures,
  pauseSpriteEpochScheduler,
  pauseSpriteTextureQueue,
  resumeSpriteEpochScheduler,
  resumeSpriteTextureQueue,
} from "../sprites/entry";
import { setGraphContextLost } from "../debug/context";
import styles from "./dotgraph.module.css";

interface GraphCanvasElement extends HTMLCanvasElement {
  __gp_onLost?: EventListener | null;
  __gp_onRestored?: EventListener | null;
}

// iPadOS can report as a Macintosh, so keep this detector local to the WebGL wrapper.
const isIOS = (() => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ipadOS13Plus = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || ipadOS13Plus;
})();

// Minimum delay between closing and reopening the WebGL canvas.
const REOPEN_FUSE_MS = isIOS ? 420 : 240;
const VISIBILITY_RESUME_DELAY_MS = 280;

interface WebGLCanvasProps {
  lowFidelity: boolean;
  dpr: number | [number, number];
}

// Owns the actual R3F canvas and the browser WebGL context lifecycle.
function WebGLCanvas({ lowFidelity, dpr }: WebGLCanvasProps) {
  const rendererRef = useRef<WebGLRenderer | null>(null);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearResumeTimer = () => {
      if (!resumeTimer) return;
      clearTimeout(resumeTimer);
      resumeTimer = null;
    };

    const pauseGraphWork = () => {
      clearResumeTimer();
      pauseSpriteTextureQueue();
      pauseSpriteEpochScheduler();
    };

    const resumeGraphWork = () => {
      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        if (typeof document !== 'undefined' && document.hidden) return;
        resumeSpriteTextureQueue();
        resumeSpriteEpochScheduler();
      }, VISIBILITY_RESUME_DELAY_MS);
    };

    const syncVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        pauseGraphWork();
      } else {
        resumeGraphWork();
      }
    };

    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pagehide', pauseGraphWork);
    window.addEventListener('pageshow', resumeGraphWork);
    syncVisibility();

    return () => {
      clearResumeTimer();
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pagehide', pauseGraphWork);
      window.removeEventListener('pageshow', resumeGraphWork);
      resumeSpriteTextureQueue();
      resumeSpriteEpochScheduler();
    };
  }, []);

  // New generation cancels any stale queued texture jobs
  useEffect(() => {
    bumpGeneration();
    return () => {
      try {
        bumpGeneration();
      } catch {}
    };
  }, []);

  // Unmount cleanup: stop jobs, dispose textures, lose the context
  useEffect(() => {
    return () => {
      try {
        resetQueue();
      } catch {}
      try {
        disposeAllSpriteTextures();
      } catch {}

      const renderer = rendererRef.current;
      if (!renderer) return;

      try {
        const el = renderer.domElement as GraphCanvasElement;
        if (el.__gp_onLost) {
          el.removeEventListener('webglcontextlost', el.__gp_onLost, false);
          el.__gp_onLost = null;
        }
        if (el.__gp_onRestored) {
          el.removeEventListener('webglcontextrestored', el.__gp_onRestored, false);
          el.__gp_onRestored = null;
        }

        renderer.dispose();

        // Force-losing the context helps iOS release GPU memory when the graph unmounts.
        const realCtx = renderer.getContext();
        const loseExt = realCtx.getExtension('WEBGL_lose_context');
        loseExt?.loseContext();

        try {
          setGraphContextLost(true);
        } catch {}
      } catch {}
    };
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 25], fov: 40, near: 0.5, far: 2000 }}
      raycaster={{ near: 0.5 }}
      dpr={dpr}
      shadows={!lowFidelity && !isIOS}
      gl={{
        antialias: !lowFidelity && !isIOS,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        alpha: true,
        preserveDrawingBuffer: false,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
        // If iPad still flakes, try forcing WebGL1 on iOS only:
        // context: (canvas) => canvas.getContext('webgl', { alpha: true, antialias: !lowFidelity }),
      }}
      frameloop="always"
      onCreated={({ gl }) => {
        rendererRef.current = gl;

        // Context loss visibility (hooks into your Debug HUD if present)
        const el = gl.domElement as GraphCanvasElement;

        const onLost = (event: Event) => {
          try {
            event.preventDefault();
          } catch {}
          setGraphContextLost(true);
          console.warn('WebGL context lost');
        };

        const onRestored = () => {
          try {
            setGraphContextLost(false);
          } catch {}
          console.warn('WebGL context restored');
        };

        el.__gp_onLost = onLost;
        el.__gp_onRestored = onRestored;
        el.addEventListener('webglcontextlost', onLost, false);
        el.addEventListener('webglcontextrestored', onRestored, false);
      }}
    >
      {/* Lights */}
      <ambientLight intensity={lowFidelity || isIOS ? 1.4 : 1.6} />
      <directionalLight
        position={[13, 13, 13]}
        intensity={lowFidelity || isIOS ? 0.9 : 1.1}
        castShadow={!lowFidelity && !isIOS}
        shadow-mapSize-width={lowFidelity || isIOS ? 1024 : 2048}
        shadow-mapSize-height={lowFidelity || isIOS ? 1024 : 2048}
        shadow-bias={-0.0005}
      />
      <spotLight
        position={[6, 4, 8]}
        intensity={lowFidelity || isIOS ? 3.5 : 4}
        angle={Math.PI / 1}
        distance={100}
        decay={0.4}
        castShadow={!isIOS}
      />

      {/* Graph */}
      <Profiler id="DotGraph" onRender={profilerOnRenderGraph}>
        <DotGraph />
      </Profiler>

      {/* Perf helpers */}
      <AdaptiveDpr />
      <AdaptiveEvents />
      <Preload all />
    </Canvas>
  );
}

// App-level gate around Canvas mount/unmount so reopening the graph does not reuse stale GPU work.
const DotGraphCanvasHost = () => {
  const vizVisible = useUiStore((s) => s.vizVisible);
  const logsOpen = useUiStore((s) => s.logsOpen);
  const widgetsOpen = useUiStore((s) => s.widgetsOpen);
  const { allFilteredRows: surveyData, loading, section } = useSurveyDataStore(
    useShallow((s) => ({ allFilteredRows: s.allFilteredRows, loading: s.loading, section: s.section }))
  );
  const isRealMobile = useRealMobileViewport();
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_VIEWPORT_WIDTH;
  const aspectRatio = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.78;
  const emptyStateOffset = desktopGraphToolsOffsetPx(windowWidth, logsOpen, widgetsOpen, aspectRatio);
  const emptyStateTransform = `translateX(${String(emptyStateOffset)}px)`;

  const safeData = surveyData;

  const isNarrow = isMobileWidth(windowWidth);
  const lowFidelity = isRealMobile || isNarrow;

  // DPR clamp allows higher density on phones while keeping desktop GPU load bounded.
  const dpr = useMemo(() => {
    const max = typeof window !== 'undefined' ? window.devicePixelRatio || 1.5 : 1.5;
    const hi = isRealMobile ? Math.min(3, max) : Math.min(2, max);
    const lo = isRealMobile ? Math.min(1.5, hi) : 1;
    return [lo, hi] as [number, number];
  }, [isRealMobile]);

  // Fresh Canvas per open (new WebGL context every time)
  const [mountVersion, setMountVersion] = useState(0);

  // Debounced open gate
  const [canMount, setCanMount] = useState(false);
  const lastCloseAtRef = useRef(0);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // clear any pending gate timers
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (!vizVisible) {
      // closing: note the time and hide immediately
      lastCloseAtRef.current = performance.now();
      // This mount gate intentionally mirrors the external graph visibility flag.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanMount(false);
      return;
    }

    // opening: honor reopen fuse since last close
    const elapsed = performance.now() - lastCloseAtRef.current;
    const wait = Math.max(0, REOPEN_FUSE_MS - Math.max(0, elapsed));

    openTimerRef.current = setTimeout(() => {
      setMountVersion((v) => v + 1);
      setCanMount(true);
    }, wait);

    return () => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [vizVisible]);

  return (
    <div className={styles.container} data-graph-container style={{ height: '100svh', width: '100%' }}>
      {!section ? (
        <p className={styles.loading}>Pick a section to begin.</p>
      ) : loading ? (
        <div
          className={styles.loading}
          aria-busy="true"
          aria-live="polite"
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h3 className={styles.loadingWord} style={{ transform: emptyStateTransform, transition: 'transform 0.2s ease' }}>
            Loading...
          </h3>
        </div>
      ) : safeData.length === 0 ? (
        <div
          className={styles.loading}
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <h3 style={{ transform: emptyStateTransform, transition: 'transform 0.2s ease' }}>Nothing yet...</h3>
        </div>
      ) : vizVisible && canMount ? (
        <WebGLCanvas
          key={mountVersion}
          lowFidelity={lowFidelity}
          dpr={dpr}
        />
      ) : null}
    </div>
  );
};

export default DotGraphCanvasHost;
