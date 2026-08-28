// src/graph-runtime/dotgraph/interaction/useObserverSpotlight.ts
// Consumes a UI spotlight request and turns it into a synthetic hover event.

import { useEffect, useRef } from "react";
import { useThree } from "../../r3f";
import { Frustum, Matrix4, Vector3, type Group } from "../../three";
import type { RefObject } from "react";
import { useUiStore } from "../../../app-core/state/ui-store";
import { resolveSpriteVisual } from "../../sprites/entry";
import { hasDotId } from "../types";
import { makeCenteredTooltipEvent } from "../tooltip/hoverEvent";
import { resolveTooltipHitboxState } from "./hitboxDistancePolicy";
import type {
  DotGraphHoverStart,
  DotPoint,
  IdentifiedDotPoint,
} from "../types";

const noop = () => undefined;

const _frustum = new Frustum();
const _projScreen = new Matrix4();
const _dotWorld = new Vector3();

interface UseObserverSpotlightArgs {
  points: DotPoint[];
  onHoverStart: DotGraphHoverStart;
  onHoverEnd: () => void;
  groupRef: RefObject<Group | null>;
  excludeId?: string | null;
  sectionKey: string;
  bagSeed: string;
  spriteScale: number;
  hitboxScale: number;
  useDesktopLayout: boolean;
}

export default function useObserverSpotlight({
  points,
  onHoverStart,
  onHoverEnd,
  groupRef,
  excludeId,
  sectionKey,
  bagSeed,
  spriteScale,
  hitboxScale,
  useDesktopLayout,
}: UseObserverSpotlightArgs) {
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  const glRef = useRef(gl);
  useEffect(() => { glRef.current = gl; }, [gl]);
  const spotlightRequest = useUiStore((s) => s.spotlightRequest);
  const setSpotlightRequest = useUiStore((s) => s.setSpotlightRequest);

  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotlightActiveRef = useRef(false);

  const onHoverStartRef = useRef(onHoverStart);
  const onHoverEndRef = useRef(onHoverEnd);
  const pointsRef = useRef(points);

  useEffect(() => {
    onHoverStartRef.current = onHoverStart;
  }, [onHoverStart]);

  useEffect(() => {
    onHoverEndRef.current = onHoverEnd;
  }, [onHoverEnd]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (!spotlightRequest) return;

    const durationMs = Math.max(500, spotlightRequest.durationMs);
    const xRatio = Math.max(0, Math.min(1, spotlightRequest.fakeMouseXRatio));
    const yRatio = Math.max(0, Math.min(1, spotlightRequest.fakeMouseYRatio));

    const pts = pointsRef.current;
    if (!pts.length) return;

    // Build frustum from current camera state to restrict candidates to visible shapes.
    const cam = cameraRef.current;
    const group = groupRef.current;
    const visiblePts: IdentifiedDotPoint[] = [];
    if (group) {
      group.updateWorldMatrix(true, false);
      _projScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreen);
      for (const point of pts) {
        if (!hasDotId(point)) continue;
        if (excludeId && point._id === excludeId) continue;
        _dotWorld.set(point.position[0], point.position[1], point.position[2]);
        _dotWorld.applyMatrix4(group.matrixWorld);
        if (_frustum.containsPoint(_dotWorld)) visiblePts.push(point);
      }
    }
    const candidates = visiblePts.length > 0
      ? visiblePts
      : pts.filter((p): p is IdentifiedDotPoint => hasDotId(p) && p._id !== excludeId);

    let best: IdentifiedDotPoint | null = null;
    let bestD = Infinity;
    for (const point of candidates) {
      const [x, y, z] = point.position;
      const d = x * x + y * y + z * z;
      if (d < bestD) {
        bestD = d;
        best = point;
      }
    }
    if (!best) return;

    if (spotlightTimerRef.current) {
      clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }

    spotlightActiveRef.current = true;
    const bestIndex = pts.findIndex((point) => point._id === best._id);
    const sprite = resolveSpriteVisual({
      entryId: best._id,
      sectionKey,
      avg: Number.isFinite(best.averageWeight) ? best.averageWeight : 0.5,
      seed: bagSeed,
      orderIndex: Math.max(0, bestIndex),
      baseScale: spriteScale,
    });
    const centerWorld = new Vector3(best.position[0], best.position[1], best.position[2]);
    if (group) centerWorld.applyMatrix4(group.matrixWorld);
    const distanceState = resolveTooltipHitboxState({
      layout: sprite.layout,
      distanceToCamera: cam.position.distanceTo(centerWorld),
      sceneHitboxScale: hitboxScale,
    });
    const tooltipLayout = {
      ...sprite.layout,
      scale: distanceState.scale,
      center: distanceState.center,
    };
    const synthEvt = makeCenteredTooltipEvent({
      camera: cam,
      domElement: glRef.current.domElement,
      centerWorld,
      layout: tooltipLayout,
      target: null,
      useDesktopLayout,
    }) ?? {
      stopPropagation: noop,
      preventDefault: noop,
      clientX: (typeof window !== "undefined" ? window.innerWidth : 1000) * xRatio,
      clientY: (typeof window !== "undefined" ? window.innerHeight : 800) * yRatio,
    };

    try {
      onHoverStartRef.current(best, synthEvt);
    } catch (err) {
      console.warn("[useObserverSpotlight] onHoverStart failed:", err);
    }

    // Consume it immediately so the same UI action can request a fresh spotlight later.
    setSpotlightRequest(null);

    spotlightTimerRef.current = setTimeout(() => {
      try {
        onHoverEndRef.current();
      } catch (err) {
        console.warn("[useObserverSpotlight] onHoverEnd failed:", err);
      }
      spotlightActiveRef.current = false;
      spotlightTimerRef.current = null;
    }, durationMs);

    return () => {
      if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
      spotlightActiveRef.current = false;
    };
  }, [
    bagSeed,
    excludeId,
    groupRef,
    hitboxScale,
    sectionKey,
    setSpotlightRequest,
    spotlightRequest,
    spriteScale,
    useDesktopLayout,
  ]);

  return { spotlightActiveRef };
}
