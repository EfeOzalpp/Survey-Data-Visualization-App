// src/graph-runtime/dotgraph/camera/controls/useZoom.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '../../../r3f';
import type { MutableRefObject } from 'react';
import { bumpZoomMetric } from '../../../debug/zoomMetrics';
import type { GestureState } from '../shared/sharedGesture';

interface UseZoomParams {
  minRadius: number;
  maxRadius: number;
  initialTarget?: number;
  markActivity?: () => void;
  gestureRef?: MutableRefObject<GestureState>;
}

interface UseZoomReturn {
  radius: number;
  zoomTargetRef: MutableRefObject<number | null>;
  zoomVelRef: MutableRefObject<number>;
  setZoomTarget: (val: number) => void;
  resetZoomTarget: (val: number) => number;
}

export default function useZoom({
  minRadius,
  maxRadius,
  initialTarget,
  markActivity,
  gestureRef,
}: UseZoomParams): UseZoomReturn {
  const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));
  const resolvedInitialTarget =
    typeof initialTarget === "number" && Number.isFinite(initialTarget)
      ? clamp(initialTarget, minRadius, maxRadius)
      : null;

  const [radius, setRadius] = useState(() => {
    return resolvedInitialTarget ?? (minRadius + maxRadius) / 2;
  });

  const zoomTargetRef = useRef<number | null>(resolvedInitialTarget);
  const zoomVelRef = useRef(0);
  const radiusRef = useRef(radius);

  // local pinch state
  const pinchCooldownRef = useRef(false);
  const pinchTimeoutRef = useRef<number | null>(null);
  const pinchCooldownTimerRef = useRef<number | null>(null);
  const touchStartDistance = useRef<number | null>(null);

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  const setZoomTarget = useCallback((val: number) => {
    zoomTargetRef.current = clamp(val, minRadius, maxRadius);
  }, [minRadius, maxRadius]);

  const resetZoomTarget = useCallback((val: number) => {
    const next = clamp(val, minRadius, maxRadius);
    zoomVelRef.current = 0;
    zoomTargetRef.current = null;
    radiusRef.current = next;
    setRadius(next);
    return next;
  }, [minRadius, maxRadius]);

  useEffect(() => {
    // Proportional zoom: each wheel notch scales radius by a fixed % regardless of zoom level.
    // WHEEL_SCALE_PER_PX: radius multiplier per normalised pixel of scroll.
    // At 120px/notch (typical mouse) -> ~14% zoom per notch; trackpad sends 2-5px per event -> smooth.
    const WHEEL_SCALE_PER_PX = 0.0012;
    const CTRL_ZOOM_GAIN = 3.0;
    const PINCH_GAIN = 1.4;
    const PINCH_COOLDOWN_MS = 200;

    const ping = () => {
      if (typeof markActivity === 'function') markActivity();
    };

    const isGraphEvent = (event: Event) => {
      const target = event.target;
      return target instanceof Element && Boolean(target.closest('[data-graph-container]'));
    };

    const preventGraphDefault = (event: Event) => {
      if (!isGraphEvent(event)) return false;
      if (event.cancelable) event.preventDefault();
      return true;
    };

    const handleScroll = (event: WheelEvent) => {
      if (!preventGraphDefault(event)) return;

      bumpZoomMetric('wheelEvents');
      ping();
      const current = zoomTargetRef.current ?? radiusRef.current;

      // Normalise to approximate pixel units (some browsers report in lines or pages)
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 20;       // DOM_DELTA_LINE
      else if (event.deltaMode === 2) dy *= 300; // DOM_DELTA_PAGE

      const gain = event.ctrlKey ? CTRL_ZOOM_GAIN : 1.0;
      // Clamp per-event factor so one large event can't jump more than 35%
      const factor = 1 + clamp(dy * WHEEL_SCALE_PER_PX * gain, -0.35, 0.35);
      // positive deltaY (wheel down) => zoom OUT (radius up)
      const next = clamp(current * factor, minRadius, maxRadius);
      zoomTargetRef.current = next;
    };

    const handleTouchMove = (event: TouchEvent) => {
      // pinch zoom only (rotation is handled elsewhere)
      if (event.touches.length !== 2) return;
      if (!preventGraphDefault(event)) return;
      if (pinchCooldownRef.current) return;
      bumpZoomMetric('touchMoveEvents');

      ping();

      const [t1, t2] = [event.touches[0], event.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const current = zoomTargetRef.current ?? radiusRef.current;

      if (touchStartDistance.current != null) {
        const pinchDelta = dist - touchStartDistance.current; // >0 when fingers move apart
        const zoomOutT = clamp((current - minRadius) / Math.max(1e-6, maxRadius - minRadius), 0, 1);
        const pinchGain = PINCH_GAIN * (0.55 + 0.75 * Math.pow(zoomOutT, 0.7));
        // Fingers apart => zoom IN => radius should DECREASE
        const next = clamp(current - pinchDelta * pinchGain, minRadius, maxRadius);
        zoomTargetRef.current = next;
      }
      touchStartDistance.current = dist;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (!isGraphEvent(event)) return;
      if (event.touches.length === 2) {
        ping();
        const [t1, t2] = [event.touches[0], event.touches[1]];
        touchStartDistance.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (gestureRef?.current) {
          gestureRef.current.pinching = true;
          gestureRef.current.touchCount = 2;
        }
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      ping();

      const touches = event.touches.length;
      if (gestureRef?.current) gestureRef.current.touchCount = touches;

      // Leaving 2-finger state? end pinch and arm cooldown
      if (gestureRef?.current) {
        if (gestureRef.current.pinching && touches < 2) {
          gestureRef.current.pinching = false;
          gestureRef.current.pinchCooldownUntil = performance.now() + PINCH_COOLDOWN_MS;
        }
      }

      if (touches < 2) {
        if (pinchTimeoutRef.current) window.clearTimeout(pinchTimeoutRef.current);
        pinchTimeoutRef.current = window.setTimeout(() => {
          touchStartDistance.current = null;
        }, 120);

        pinchCooldownRef.current = true;
        if (pinchCooldownTimerRef.current) window.clearTimeout(pinchCooldownTimerRef.current);
        pinchCooldownTimerRef.current = window.setTimeout(() => {
          pinchCooldownRef.current = false;
          pinchCooldownTimerRef.current = null;
        }, 160);
      }
    };

    const handleBrowserGesture = (event: Event) => {
      preventGraphDefault(event);
    };

    window.addEventListener('wheel', handleScroll, { passive: false });
    window.addEventListener('gesturestart', handleBrowserGesture, { passive: false });
    window.addEventListener('gesturechange', handleBrowserGesture, { passive: false });
    window.addEventListener('gestureend', handleBrowserGesture, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

      return () => {
        if (pinchTimeoutRef.current) window.clearTimeout(pinchTimeoutRef.current);
        if (pinchCooldownTimerRef.current) window.clearTimeout(pinchCooldownTimerRef.current);
        window.removeEventListener('wheel', handleScroll);
        window.removeEventListener('gesturestart', handleBrowserGesture);
        window.removeEventListener('gesturechange', handleBrowserGesture);
        window.removeEventListener('gestureend', handleBrowserGesture);
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
  }, [minRadius, maxRadius, markActivity, gestureRef]);

  // critically damped spring to target
  const ZOOM_OMEGA = 18.0;
  const ZOOM_SNAP_EPS = 0.0015;
  const ZOOM_MAX_FRAME_DT = 1 / 30;

  useFrame((_, rawDelta) => {
    if (zoomTargetRef.current == null) return;
    bumpZoomMetric('zoomFrames');

    const delta = Math.min(rawDelta, ZOOM_MAX_FRAME_DT);
    const r = radius;
    const target = clamp(zoomTargetRef.current, minRadius, maxRadius);

    let v = zoomVelRef.current;
    const x = r - target;
    const a = -2 * ZOOM_OMEGA * v - ZOOM_OMEGA * ZOOM_OMEGA * x;

    v += a * delta;
    let next = r + v * delta;
    next = clamp(next, minRadius, maxRadius);

    // anti-rebound at bounds
    if (next === maxRadius && v > 0) v = 0;
    if (next === minRadius && v < 0) v = 0;

    if (Math.abs(next - r) > ZOOM_SNAP_EPS) {
      bumpZoomMetric('radiusStateUpdates');
      setRadius(next);
    } else {
      bumpZoomMetric('radiusStateUpdates');
      setRadius(target);
      v = 0;
      zoomTargetRef.current = null; // stop tiny oscillations
    }
    zoomVelRef.current = v;
  });

  return {
    radius,
    zoomTargetRef,
    zoomVelRef,
    setZoomTarget,
    resetZoomTarget,
  };
}
