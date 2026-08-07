// src/graph-runtime/dotgraph/camera/controls/useRotation.ts
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '../../../r3f';
import type { RefObject } from 'react';
import { Quaternion, Vector3, Frustum, Matrix4, type Group } from '../../../three';
import type { Vec3 } from '../../types';
import type { GestureState } from '../shared/sharedGesture';

// Scratch objects reused every frame to avoid GC pressure.
const _rotQ = new Quaternion();
const _axisX = new Vector3(1, 0, 0);
const _axisY = new Vector3(0, 1, 0);
const _dotWorld = new Vector3();
const _frustum = new Frustum();
const _projScreen = new Matrix4();

const ROT_RELEASE_TAU = 0.38;
const ROT_IDLE_RELEASE_TAU = 0.18;
const ROT_STOP_EPSILON = 0.001;
// t^k (k<1) is concave-down: it recovers to near-full speed almost immediately
// on zooming out and only drops near max zoom-in, i.e. the slowdown kicks in
// late. 1-(1-t)^k is the mirror (concave-up) shape: it drops fast as soon as
// you start zooming in and flattens out near max zoom-in, where it's already
// at the floor - so the slowdown is felt earlier for the same floor value.
const TOUCH_ZOOM_SLOWDOWN_EARLY_ONSET = 0.5;

const mapResponsiveDelta = (delta: number, deadzone: number) => {
  const magnitude = Math.abs(delta);
  if (magnitude === 0) return 0;

  const sign = Math.sign(delta);
  if (magnitude <= deadzone) {
    return sign * ((magnitude * magnitude) / (2 * deadzone));
  }

  return sign * (magnitude - deadzone / 2);
};

const decaySpinAxis = (value: number, tau: number, delta: number) => {
  const magnitude = Math.abs(value);
  if (magnitude <= ROT_STOP_EPSILON) return 0;

  const decay = Math.exp(-delta / tau);
  const next = value * decay;
  return Math.abs(next) <= ROT_STOP_EPSILON ? 0 : next;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const getZoomRatio = (radius: number, minRadius: number, maxRadius: number) => {
  const span = Math.max(1e-6, maxRadius - minRadius);
  return clamp01((radius - minRadius) / span);
};

const getDragTuning = ({
  radius,
  minRadius,
  maxRadius,
  isTouch,
  isTabletLike,
  closestDist,
}: {
  radius: number;
  minRadius: number;
  maxRadius: number;
  isTouch: boolean;
  isTabletLike: boolean;
  closestDist: number;
}) => {
  // Desktop sensitivity scales with how close the nearest dot is to the camera.
  // Near dot -> low sensitivity (precision); far dots -> full speed.
  const distRatio = clamp01(closestDist / maxRadius);
  const zoomOutRatio = getZoomRatio(radius, minRadius, maxRadius);
  const zoomReleaseRatio = 1 - Math.pow(1 - zoomOutRatio, TOUCH_ZOOM_SLOWDOWN_EARLY_ONSET);
  const sensitivityRatio = isTouch ? Math.max(distRatio, zoomReleaseRatio) : distRatio;

  return {
    // Close zooms need less angular travel, but also less deadzone so the motion
    // still starts promptly instead of feeling sticky before it suddenly jumps.
    deadzoneMul: isTouch ? lerp(0.72, 1, distRatio) : lerp(0.55, 1.1, distRatio),
    sensitivityMul: isTouch
      ? lerp(isTabletLike ? 0.42 : 0.35, 1.0, sensitivityRatio)
      : lerp(0.17, 1.2, distRatio),
  };
};

declare global {
  interface Window {
    __gpEdgeLatched?: boolean;
  }
}

interface UseRotationParams {
  groupRef: RefObject<Group | null>;
  useDesktopLayout: boolean;
  isTabletLike: boolean;
  minRadius: number;
  maxRadius: number;
  radius: number;
  markActivity?: () => void;
  gestureRef?: RefObject<GestureState>;
  dotPositions?: readonly Vec3[];
}

interface UseRotationReturn {
  isPinchingRef: RefObject<boolean>;
  isTouchRotatingRef: RefObject<boolean>;
  effectiveDraggingRef: RefObject<boolean>;
  applyRotationFrame: (args: { idleActive: boolean; delta: number }) => void;
  lastMouseMoveTsRef: RefObject<number>;
}

export default function useRotation({
  groupRef,
  useDesktopLayout,
  isTabletLike,
  minRadius,
  maxRadius,
  radius,
  markActivity,
  gestureRef,
  dotPositions,
}: UseRotationParams): UseRotationReturn {
  const { gl, camera } = useThree();

  const isPinchingRef = useRef(false);
  const isTouchRotatingRef = useRef(false);
  const isDesktopRotatingRef = useRef(false);
  const lastTouchRef = useRef({ x: 0, y: 0, t: 0 });
  const lastDesktopPointerRef = useRef({ x: 0, y: 0, t: 0 });
  const spinVelRef = useRef({ x: 0, y: 0 });

  // After pinch, ignore first 1-finger frame (until we reseed)
  const ignoreFirstSingleAfterPinchRef = useRef(false);

  // Exposed to the orchestrator so idle rotation knows when the user is moving the scene.
  const effectiveDraggingRef = useRef(false);

  // Canonical latched state helpers, global across the graph view.
  const getLatched = () => {
    if (typeof window === 'undefined') return true;
    window.__gpEdgeLatched ??= true;
    return window.__gpEdgeLatched;
  };

  const setLatched = (next: boolean) => {
    if (typeof window === 'undefined') return;
    window.__gpEdgeLatched = next;
    window.dispatchEvent(
      new CustomEvent('gp:edge-cue-state', {
        detail: { latched: next },
      })
    );
  };

  // App activity gate: true only when the app/tab is focused and pointer is inside the OS window.
  const appActiveRef = useRef(true);

  useEffect(() => {
    const recompute = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus();
      appActiveRef.current = visible && focused;
    };

    // If pointer leaves **the OS window**, stop edge-drive immediately
    const onPointerOut = (e: PointerEvent) => {
      // relatedTarget === null means it left the browser window
      if (e.relatedTarget === null) appActiveRef.current = false;
    };

    const onPointerOver = () => {
      const visible = document.visibilityState === 'visible';
      const focused = document.hasFocus();
      appActiveRef.current = visible && focused;
    };

    const onBlur = () => {
      appActiveRef.current = false;
    };
    const onFocus = () => {
      recompute();
    };
    const onVis = () => {
      recompute();
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerout', onPointerOut);
    window.addEventListener('pointerover', onPointerOver);

    recompute();

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerout', onPointerOut);
      window.removeEventListener('pointerover', onPointerOver);
    };
  }, []);

  // Touch-only: long-press flips the canonical latched state for the mobile HUD.
  const holdTimerRef = useRef<number | null>(null);
  const holdArmedRef = useRef(false); // prevent repeat fires per gesture
  const holdSceneRef = useRef(false); // true only if touch started on canvas
  const touchOwnsSceneRef = useRef(false); // true only while the active touch gesture belongs to the canvas
  const HOLD_MS = 650;

  // recent mouse movement (idle gating)
  const lastMouseMoveTsRef = useRef(0);

  const isMovingRef = useRef(false);

  const isDraggingRef = useRef(false);
  const zoomMetricsRef = useRef({ radius, minRadius, maxRadius });
  const closestDistRef = useRef<number>(Infinity);
  const dotPositionsRef = useRef<readonly Vec3[]>(dotPositions ?? []);

  useEffect(() => {
    zoomMetricsRef.current = { radius, minRadius, maxRadius };
  }, [radius, minRadius, maxRadius]);

  useEffect(() => {
    dotPositionsRef.current = dotPositions ?? [];
  }, [dotPositions]);

  useEffect(() => {
    const dpr = window.devicePixelRatio;
    const DESKTOP_DEADZONE_PX = Math.max(0.2, 0.35 * dpr);
    const TOUCH_DEADZONE_PX = Math.max(0.6, 0.8 * dpr);
    const TOUCH_PX_TO_RAD = (isTabletLike ? 0.004 : 0.006) / dpr;
    const DESKTOP_PX_TO_RAD = 0.0032 / dpr;
    const canvas = gl.domElement;

    // Helper: did this touch start over the WebGL canvas?
    const isSceneTouchTarget = (target: EventTarget | null) => {
      const canvas = gl.domElement;
      if (!(target instanceof Node)) return false;
      return target === canvas || canvas.contains(target);
    };

    const isDesktopScenePointer = (event: PointerEvent) =>
      useDesktopLayout &&
      (event.pointerType === 'mouse' || event.pointerType === 'pen') &&
      isSceneTouchTarget(event.target);

    const hasSceneTouchTarget = (touches: TouchList) => {
      for (const touch of Array.from(touches)) {
        if (isSceneTouchTarget(touch.target)) return true;
      }
      return false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!isDesktopScenePointer(event)) return;
      if (isDraggingRef.current) return;

      isDesktopRotatingRef.current = true;
      canvas.classList.add('is-rotating');
      isMovingRef.current = false;
      spinVelRef.current = { x: 0, y: 0 };
      lastDesktopPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        t: performance.now(),
      };
      lastMouseMoveTsRef.current = lastDesktopPointerRef.current.t;
      markActivity?.();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

      lastMouseMoveTsRef.current = performance.now();
      if (!isDesktopRotatingRef.current) return;
      if (isDraggingRef.current) {
        isDesktopRotatingRef.current = false;
        canvas.classList.remove('is-rotating');
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };
        return;
      }

      markActivity?.();

      const now = performance.now();
      const last = lastDesktopPointerRef.current;
      const dt = Math.max(1, now - last.t);
      const rawDx = event.clientX - last.x;
      const rawDy = event.clientY - last.y;
      const { radius, minRadius, maxRadius } = zoomMetricsRef.current;
      const { deadzoneMul, sensitivityMul } = getDragTuning({
        radius,
        minRadius,
        maxRadius,
        isTouch: false,
        isTabletLike,
        closestDist: closestDistRef.current,
      });
      const dx = mapResponsiveDelta(rawDx, DESKTOP_DEADZONE_PX * deadzoneMul);
      const dy = mapResponsiveDelta(rawDy, DESKTOP_DEADZONE_PX * deadzoneMul);
      const desktopPxToRad = DESKTOP_PX_TO_RAD * sensitivityMul;
      const moving = Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005;
      isMovingRef.current = moving;

      if (!moving) {
        lastDesktopPointerRef.current = { x: event.clientX, y: event.clientY, t: now };
        return;
      }

      const g = groupRef.current;
      if (g) {
        _rotQ.setFromAxisAngle(_axisX, -dy * desktopPxToRad);
        g.quaternion.premultiply(_rotQ);
        _rotQ.setFromAxisAngle(_axisY, -dx * desktopPxToRad);
        g.quaternion.premultiply(_rotQ);
      }

      const vx = (-dy / dt) * 1000 * desktopPxToRad;
      const vy = (-dx / dt) * 1000 * desktopPxToRad;
      spinVelRef.current = {
        x: (spinVelRef.current.x + vx) * 0.5,
        y: (spinVelRef.current.y + vy) * 0.5,
      };

      lastDesktopPointerRef.current = { x: event.clientX, y: event.clientY, t: now };
    };

    const endDesktopRotation = () => {
      isDesktopRotatingRef.current = false;
      canvas.classList.remove('is-rotating');
      isMovingRef.current = false;
    };

    // Touch handlers
    const handleTouchStart = (event: TouchEvent) => {
      markActivity?.();
      if (gestureRef?.current) gestureRef.current.touchCount = event.touches.length;

      if (event.touches.length === 1) {
        const t = event.touches[0];
        holdSceneRef.current = isSceneTouchTarget(t.target);
        touchOwnsSceneRef.current = holdSceneRef.current;

        if (!touchOwnsSceneRef.current) {
          isTouchRotatingRef.current = false;
          isMovingRef.current = false;
          spinVelRef.current = { x: 0, y: 0 };
          if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          holdArmedRef.current = false;
          return;
        }

        isTouchRotatingRef.current = true;
        isMovingRef.current = false;
        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
        spinVelRef.current = { x: 0, y: 0 };

        holdArmedRef.current = holdSceneRef.current;
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);

        if (holdArmedRef.current) {
          holdTimerRef.current = window.setTimeout(() => {
            if (
              touchOwnsSceneRef.current &&
              holdArmedRef.current &&
              holdSceneRef.current &&
              !isPinchingRef.current &&
              !gestureRef?.current?.pinching
            ) {
              setLatched(!getLatched());
              holdArmedRef.current = false;
            }
          }, HOLD_MS);
        }
      } else if (event.touches.length >= 2) {
        touchOwnsSceneRef.current = hasSceneTouchTarget(event.touches);
        if (!touchOwnsSceneRef.current) {
          isTouchRotatingRef.current = false;
          isMovingRef.current = false;
          spinVelRef.current = { x: 0, y: 0 };
          if (gestureRef?.current) gestureRef.current.pinching = false;
          if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          holdArmedRef.current = false;
          holdSceneRef.current = false;
          return;
        }

        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        spinVelRef.current = { x: 0, y: 0 };
        if (gestureRef?.current) gestureRef.current.pinching = true;

        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        holdArmedRef.current = false;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchOwnsSceneRef.current) return;
      event.preventDefault();
      if (isDraggingRef.current) return;
      markActivity?.();

      const now = performance.now();
      const gs = gestureRef?.current;
      const inCooldown = gs ? now < gs.pinchCooldownUntil : false;
      const multiTouch = (gs?.touchCount ?? event.touches.length) >= 2;
      const pinching = (gs?.pinching ?? false) || isPinchingRef.current;

      if (multiTouch || pinching) return;

      if (inCooldown) {
        if (event.touches.length === 1) {
          const t = event.touches[0];
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
          ignoreFirstSingleAfterPinchRef.current = true;
        }
        return;
      }

      if (event.touches.length === 1) {
        const t = event.touches[0];
        const now2 = performance.now();

        if (ignoreFirstSingleAfterPinchRef.current) {
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
          ignoreFirstSingleAfterPinchRef.current = false;
          return;
        }

        const last = lastTouchRef.current;
        const dt = Math.max(1, now2 - last.t);
        const rawDx = t.clientX - last.x;
        const rawDy = t.clientY - last.y;
        const { radius, minRadius, maxRadius } = zoomMetricsRef.current;
        const { deadzoneMul, sensitivityMul } = getDragTuning({
          radius,
          minRadius,
          maxRadius,
          isTouch: true,
          isTabletLike,
          closestDist: closestDistRef.current,
        });
        const dx = mapResponsiveDelta(rawDx, TOUCH_DEADZONE_PX * deadzoneMul);
        const dy = mapResponsiveDelta(rawDy, TOUCH_DEADZONE_PX * deadzoneMul);
        const touchPxToRad = TOUCH_PX_TO_RAD * sensitivityMul;

        const moving = Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005;
        isMovingRef.current = moving;

        if (!moving) {
          lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
          return;
        }

        const g = groupRef.current;
        if (g) {
          _rotQ.setFromAxisAngle(_axisX, -dy * touchPxToRad);
          g.quaternion.premultiply(_rotQ);
          _rotQ.setFromAxisAngle(_axisY, -dx * touchPxToRad);
          g.quaternion.premultiply(_rotQ);
        }

        const vx = (-dy / dt) * 1000 * touchPxToRad;
        const vy = (-dx / dt) * 1000 * touchPxToRad;
        spinVelRef.current = {
          x: (spinVelRef.current.x + vx) * 0.5,
          y: (spinVelRef.current.y + vy) * 0.5,
        };

        lastTouchRef.current = { x: t.clientX, y: t.clientY, t: now2 };
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      markActivity?.();

      if (gestureRef?.current) {
        gestureRef.current.touchCount = event.touches.length;
        if (gestureRef.current.pinching && event.touches.length < 2) {
          gestureRef.current.pinching = false;
          if (gestureRef.current.pinchCooldownUntil < performance.now() + 200) {
            gestureRef.current.pinchCooldownUntil = performance.now() + 200;
          }
        }
      }

      if (event.touches.length === 0) {
        isTouchRotatingRef.current = false;
        isMovingRef.current = false;
        touchOwnsSceneRef.current = false;
      }
      if (event.touches.length < 2) isPinchingRef.current = false;

      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      holdArmedRef.current = false;
      holdSceneRef.current = false;
      if (event.touches.length === 0) touchOwnsSceneRef.current = false;
    };

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', endDesktopRotation);
    window.addEventListener('pointercancel', endDesktopRotation);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDesktopRotation);
      window.removeEventListener('pointercancel', endDesktopRotation);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      canvas.classList.remove('is-rotating');
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
      touchOwnsSceneRef.current = false;
    };
  }, [groupRef, isTabletLike, markActivity, gl, gestureRef, useDesktopLayout]);

  // frame application
  function applyRotationFrame({ idleActive, delta }: { idleActive: boolean; delta: number }) {
    const g = groupRef.current;
    if (!g) return;

    // This is what the system should consider "user interacting."
    effectiveDraggingRef.current =
      isDraggingRef.current ||
      isDesktopRotatingRef.current ||
      isTouchRotatingRef.current ||
      isPinchingRef.current;

    // Freeze rotation while dragging external UI
    if (isDraggingRef.current) return;

    const zf = Math.max(0, Math.min(1, (radius - minRadius) / (maxRadius - minRadius) || 0));
    const zoomMul = lerp(0.55, 1.8, zf);
    const tabletMul = isTabletLike ? 1.6 : 1.0;
    const motionMul =
      !useDesktopLayout && isMovingRef.current ? 0.10 + (0.30 - 0.10) * zf : 1.0;
    const idleMul = idleActive ? 0.42 : 1.0;

    const holdingTouch = isTouchRotatingRef.current && !isPinchingRef.current;
    const holdingDesktop = useDesktopLayout && isDesktopRotatingRef.current;
    if (!holdingTouch && !holdingDesktop) {
      const releaseTau = idleActive ? ROT_IDLE_RELEASE_TAU : ROT_RELEASE_TAU;
      spinVelRef.current.x = decaySpinAxis(spinVelRef.current.x, releaseTau, delta);
      spinVelRef.current.y = decaySpinAxis(spinVelRef.current.y, releaseTau, delta);
    }

    const mul = zoomMul * tabletMul * motionMul * idleMul;
    _rotQ.setFromAxisAngle(_axisX, spinVelRef.current.x * delta * mul);
    g.quaternion.premultiply(_rotQ);
    _rotQ.setFromAxisAngle(_axisY, spinVelRef.current.y * delta * mul);
    g.quaternion.premultiply(_rotQ);
  }

  // Compute closest dot-to-camera distance each frame for sensitivity scaling.
  useFrame(() => {
    void appActiveRef.current;
    const g = groupRef.current;
    const pts = dotPositionsRef.current;
    if (!g || !pts.length) {
      closestDistRef.current = Infinity;
      return;
    }
    g.updateWorldMatrix(true, false);
    _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
    let minDist = Infinity;
    for (const pos of pts) {
      _dotWorld.set(pos[0], pos[1], pos[2]);
      _dotWorld.applyMatrix4(g.matrixWorld);
      if (!_frustum.containsPoint(_dotWorld)) continue;
      const d = camera.position.distanceTo(_dotWorld);
      if (d < minDist) minDist = d;
    }
    closestDistRef.current = minDist;
  });

  return {
    isPinchingRef,
    isTouchRotatingRef,
    effectiveDraggingRef,
    applyRotationFrame,
    lastMouseMoveTsRef,
  };
}
