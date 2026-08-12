// src/graph-runtime/dotgraph/camera/useOrbitController.ts
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '../../r3f';
import type { Group } from '../../three';
import type { Vec3 } from '../types';

import useActivity from './controls/useActivity';
import useZoom from './controls/useZoom';
import useRotation from './controls/useRotation';
import usePixelOffsets from './controls/usePixelOffsets';

import { createGestureState } from './shared/sharedGesture';

import { computeInitialZoomTarget } from './compute/zoomTarget';

interface OrbitLayout {
  useDesktopLayout?: boolean;
  isSmallScreen?: boolean;
  isTabletLike?: boolean;

  xOffset?: number;
  yOffset?: number;

  xOffsetPx?: number;
  yOffsetPx?: number;
}

interface OrbitBounds {
  minRadius?: number;
  maxRadius?: number;
}

interface OrbitIdle {
  startOnLoad?: boolean;
  delayMs?: number;
  speed?: number;
  horizontalOnly?: boolean;
}

interface OrbitThresholds {
  mobile: number;
  tablet: number;
  desktop: number;
}

interface OrbitParams {
  layout?: OrbitLayout;
  bounds?: OrbitBounds;

  /** either pass dataCount explicitly or pass data for fallback counting */
  dataCount?: number;
  data?: unknown[];

  idle?: OrbitIdle;
  thresholds?: OrbitThresholds;

  /** legacy support: allow old callsites to pass these at top level */
  useDesktopLayout?: boolean;
  isSmallScreen?: boolean;
  isTabletLike?: boolean;

  xOffset?: number;
  yOffset?: number;
  xOffsetPx?: number;
  yOffsetPx?: number;

  minRadius?: number;
  maxRadius?: number;
  initialZoomFraction?: number;

  dotPositions?: readonly Vec3[];
  zoomResetKey?: string | number;
}

interface OrbitReturn {
  groupRef: React.MutableRefObject<Group | null>;
  radius: number;
  isPinchingRef: React.RefObject<boolean>;
  isTouchRotatingRef: React.RefObject<boolean>;
  minRadius: number;
  maxRadius: number;
  setZoomTarget: (val: number) => void;
  zoomTargetRef: React.RefObject<number | null>;
}

const DESKTOP_INITIAL_ZOOM_SCALE = 1.15;

export default function useOrbitController(params: OrbitParams = {}): OrbitReturn {
  const ROTATE_EVT = 'gp:orbit-rot';
  const DESKTOP_IDLE_MOUSE_DELAY_MS = 4000;

  const {
    useDesktopLayout = params.layout?.useDesktopLayout ?? params.useDesktopLayout ?? true,
    isSmallScreen = params.layout?.isSmallScreen ?? params.isSmallScreen ?? false,
    isTabletLike = params.layout?.isTabletLike ?? params.isTabletLike ?? false,

    xOffset = params.layout?.xOffset ?? params.xOffset ?? 0,
    yOffset = params.layout?.yOffset ?? params.yOffset ?? 0,

    xOffsetPx = params.layout?.xOffsetPx ?? params.xOffsetPx ?? 0,
    yOffsetPx = params.layout?.yOffsetPx ?? params.yOffsetPx ?? 0,

    minRadius = params.bounds?.minRadius ?? params.minRadius ?? (isSmallScreen ? 2 : 20),
    maxRadius = params.bounds?.maxRadius ?? params.maxRadius ?? 800,
    initialZoomFraction = params.initialZoomFraction,

    dataCount = params.dataCount ?? (Array.isArray(params.data) ? params.data.length : 0),
    zoomResetKey = params.zoomResetKey,

    idle = {},
    thresholds = { mobile: 50, tablet: 65, desktop: 90 },

    dotPositions,
  } = params;

  const {
    startOnLoad = idle.startOnLoad ?? true,
    delayMs = idle.delayMs ?? 2000,
  } = idle;

  const { camera, gl } = useThree();
  const groupRef = useRef<Group | null>(null);

  const gestureRef = useRef(createGestureState());

  // Initial zoom target from data count
  const count = useMemo(() => (typeof dataCount === 'number' ? dataCount : 0), [dataCount]);

  const initialTargetComputed = useMemo(
    () => {
      let target: number;

      if (typeof initialZoomFraction === 'number' && Number.isFinite(initialZoomFraction)) {
        const t = Math.max(0, Math.min(1, initialZoomFraction));
        target = maxRadius - t * (maxRadius - minRadius);
      } else {
        target = computeInitialZoomTarget({
          count,
          isSmallScreen,
          isTabletLike,
          thresholds,
          minRadius,
          maxRadius,
        });
      }

      const framedTarget = useDesktopLayout
        ? target / DESKTOP_INITIAL_ZOOM_SCALE
        : target;
      return Math.max(minRadius, Math.min(maxRadius, framedTarget));
    },
    [count, initialZoomFraction, isSmallScreen, isTabletLike, thresholds, minRadius, maxRadius, useDesktopLayout]
  );

  // Activity and idle helpers
  const { hasInteractedRef, lastActivityRef, markActivity, isIdle } = useActivity({
    startOnLoad,
    delayMs,
  });

  // idle wrapper
  const isIdleWrapped = ({
    userInteracting,
    hasInteractedRef: hiRef = hasInteractedRef,
    lastActivityRef: laRef = lastActivityRef,
  }: {
    userInteracting: boolean;
    hasInteractedRef?: React.RefObject<boolean>;
    lastActivityRef?: React.RefObject<number>;
  }) => {
    if (useDesktopLayout) {
      const lastMouseMoveValue = lastMouseMoveTsRef.current ?? 0;
      const lastMouseMoveAt =
        lastMouseMoveValue > 0 ? lastMouseMoveValue : performance.now();
      return !userInteracting && performance.now() - lastMouseMoveAt >= DESKTOP_IDLE_MOUSE_DELAY_MS;
    }
    return isIdle({ userInteracting, hasInteractedRef: hiRef, lastActivityRef: laRef });
  };

  // Zoom
  const { radius, zoomTargetRef, zoomVelRef, setZoomTarget, resetZoomTarget } = useZoom({
    minRadius,
    maxRadius,
    initialTarget: initialTargetComputed,
    markActivity,
    gestureRef,
  });

  void zoomVelRef; // keep side-effect-free if lint complains about unused

  const latestInitialTargetRef = useRef(initialTargetComputed);
  const latestResetZoomTargetRef = useRef(resetZoomTarget);

  useLayoutEffect(() => {
    latestInitialTargetRef.current = initialTargetComputed;
    latestResetZoomTargetRef.current = resetZoomTarget;
  }, [initialTargetComputed, resetZoomTarget]);

  useLayoutEffect(() => {
    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera, radius]);

  // Graph view switches should snap to the current initial framing. Sanity data
  // updates can change count/target, but should not overwrite a user's camera.
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const nextRadius = latestResetZoomTargetRef.current(latestInitialTargetRef.current);
    camera.position.set(0, 0, nextRadius);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }, [camera, zoomResetKey]);

  // Rotation
  const rot = useRotation({
    groupRef,
    useDesktopLayout,
    isTabletLike,
    minRadius,
    maxRadius,
    radius,
    markActivity,
    gestureRef,
    dotPositions,
  });

  const {
    isPinchingRef,
    isTouchRotatingRef,
    effectiveDraggingRef,
    lastMouseMoveTsRef,
    applyRotationFrame,
  } = rot;

  // Pixel offsets move the rendered group without changing the dot data.
  usePixelOffsets({
    groupRef,
    camera,
    domElement: gl.domElement,
    radius,
    xOffset,
    yOffset,
    xOffsetPx,
    yOffsetPx,
  });

  useFrame(() => {
    camera.position.set(0, 0, radius);
    camera.lookAt(0, 0, 0);
  }, -100);

  useFrame((_, delta) => {
    const userInteracting =
      !!effectiveDraggingRef.current || !!isTouchRotatingRef.current || !!isPinchingRef.current;

    const idleActive = isIdleWrapped({ userInteracting, hasInteractedRef, lastActivityRef });
    applyRotationFrame({ idleActive, delta });
  });

  const lastRotEvtRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  useFrame(() => {
    if (!groupRef.current) return;
    const now2 = performance.now();
    const rx = groupRef.current.rotation.x;
    const ry = groupRef.current.rotation.y;
    const d = Math.abs(rx - lastRotEvtRef.current.x) + Math.abs(ry - lastRotEvtRef.current.y);
    if (d > 0.002 && now2 - lastRotEvtRef.current.t > 120) {
      lastRotEvtRef.current = { x: rx, y: ry, t: now2 };
      window.dispatchEvent(
        new CustomEvent(ROTATE_EVT, {
          detail: { rx, ry, source: useDesktopLayout ? 'desktop' : 'touch' },
        })
      );
    }
  });

  return {
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    setZoomTarget,
    zoomTargetRef,
  };
}
