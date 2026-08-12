// src/scene-canvas/hooks/useSceneField.ts

import { useLayoutEffect, useRef } from "react";

import {
  resolveAuthoredLightSource,
  resolveRuntimePlacements,
} from "../scene-logic";

import { composeFieldAsync } from "../../workers/scene/compose-worker-host";

import type { HostId } from "../multi-canvas-setup/hostDefs";
import { HOST_DEFS } from "../multi-canvas-setup/hostDefs";

import type { CanvasEngineControls } from "../runtime";
import type { EngineShapeLightSource } from "../runtime/engine/state";

import { fieldAppearSignature } from "./sceneFieldSignature";
import type { useCanvasEngine } from "./useCanvasEngine";
import { getCanvasLogicalSize, useCanvasLogicalSizeTick } from "./useCanvasLogicalSize";

import type { SceneLookupKey, SceneState } from "../scene-rules/lookup";

import { resolvePaddingPolicyVariants, resolvePaddingSpec } from "../scene-rules/canvas-padding";
import type { ScenePlacementRules } from "../scene-rules/placement-rules";

import { getViewportSize, type DeviceCountScale, type DeviceType } from "../shared/responsiveness";
import { usePreferences } from "../../app/state/preferences-context";
import type { Place } from "../grid-layout/occupancy";

type Engine = ReturnType<typeof useCanvasEngine>;

export interface SceneFieldViewportOverride {
  ruleDevice: DeviceType;
  ruleWidthPx: number;
}


export function useSceneField(
  engine: Engine,
  hostId: HostId,
  liveAvg: number | undefined,
  reservedFootprints: Place[] | undefined,
  viewportKey?: number | string,
  spotlightIndex?: number,
  fog?: boolean,
  shapeLightSource?: EngineShapeLightSource | null,
  initialFieldDelayMs = 0,
  initialComposeDelayMs = 0,
  viewportOverride?: SceneFieldViewportOverride
) {
  const fieldDelayStateRef = useRef<{ generation: number; untilMs: number } | null>(null);
  const fieldApplyStateRef = useRef<{
    appearSignature: string;
    itemCount: number;
  } | null>(null);
  const { ready, controls, readyTick } = engine;

  const hostDef = HOST_DEFS[hostId];
  const { darkMode } = usePreferences();
  const canvasResizeTick = useCanvasLogicalSizeTick(engine);
  const ruleDeviceOverride = viewportOverride?.ruleDevice;
  const ruleWidthOverride = viewportOverride?.ruleWidthPx;

  const ruleset = hostDef.scene.ruleset;
  const sceneLookupKey: SceneLookupKey = hostDef.scene.lookupKey;

  useLayoutEffect(() => {
    if (!ready.current) return;

    let cancelled = false;
    let fieldRafId: number | null = null;
    let fieldTimerId: number | null = null;
    let composeTimerId: number | null = null;

    const cleanupScheduledField = () => {
      cancelled = true;
      if (fieldRafId !== null) cancelAnimationFrame(fieldRafId);
      if (fieldTimerId !== null) window.clearTimeout(fieldTimerId);
      if (composeTimerId !== null) window.clearTimeout(composeTimerId);
    };

    const readyGeneration = readyTick;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    let fieldDelayMs = 0;
    if (initialFieldDelayMs > 0) {
      let delayState = fieldDelayStateRef.current;
      if (delayState?.generation !== readyGeneration) {
        delayState = {
          generation: readyGeneration,
          untilMs: nowMs + initialFieldDelayMs,
        };
        fieldDelayStateRef.current = delayState;
      }

      fieldDelayMs = Math.max(0, delayState.untilMs - nowMs);
    }

    const composeAndApplyField = async (
      engineControls: CanvasEngineControls,
      args: {
        padding: ReturnType<typeof resolvePaddingPolicyVariants>;
        placements: ScenePlacementRules;
        landscapeCountScale: DeviceCountScale | undefined;
        ruleWidthPx: number;
        canvas: { w: number; h: number };
        appearSignature: string;
      }
    ) => {
      if (!ready.current) return;

      const placed = await composeFieldAsync({
        padding: args.padding,
        placements: args.placements,
        liveAvg,
        reservedFootprints,
        landscapeCountScale: args.landscapeCountScale,
        ruleWidthPx: args.ruleWidthPx,
        ruleDevice: ruleDeviceOverride,
        canvas: args.canvas,
      });

      if (cancelled) return;

      const previousApply = fieldApplyStateRef.current;
      const shouldReplayAppear =
        previousApply === null ||
        previousApply.itemCount === 0 ||
        previousApply.appearSignature !== args.appearSignature;

      engineControls.setFieldItems(placed, { replayAppear: shouldReplayAppear });
      engineControls.setFieldVisible(placed.length > 0);
      fieldApplyStateRef.current = {
        appearSignature: args.appearSignature,
        itemCount: placed.length,
      };
    };

    const engineControls = controls.current;
    if (!engineControls) return;

    const sceneState: SceneState = { lookupKey: sceneLookupKey };
    const profile = ruleset.getProfile(sceneState, { darkMode });
    const placements = resolveRuntimePlacements(profile.placements, spotlightIndex);
    const padding = resolvePaddingPolicyVariants(profile.padding, spotlightIndex);

    const canvas = engineControls.canvas;
    const { w, h } = getCanvasLogicalSize(canvas);
    const viewportW = ruleWidthOverride ?? getViewportSize().w;
    // Device-band rules should follow the actual viewport/device, not the
    // bounded size of a canvas instance such as Spotlight.
    const ruleWidthPx = viewportW;
    const resolvedShapeLightSource =
      shapeLightSource === undefined
        ? resolveAuthoredLightSource(placements, liveAvg, ruleWidthPx, ruleDeviceOverride)
        : shapeLightSource;

    // Let runtime compute forbidden/rows from the current profile padding
    // and receive the other resolved scene policies as one handoff.
    const spec = resolvePaddingSpec(ruleWidthPx, padding);
    engineControls.setSceneProfile({
      lookupKey: sceneLookupKey,
      paddingSpec: spec,
      background: profile.background,
      ambientParticles: profile.ambientParticles,
      fog: profile.fog,
      foliage: profile.foliage,
      renderCache: profile.renderCache,
    });
    engineControls.setFieldStyle({ darkMode, fog, shapeLightSource: resolvedShapeLightSource });

    const fieldArgs = {
      padding,
      placements,
      landscapeCountScale: profile.landscapeCountScale,
      ruleWidthPx,
      canvas: { w, h },
      appearSignature: fieldAppearSignature({
        hostId,
        sceneLookupKey,
        spotlightIndex,
        reservedFootprints,
      }),
    };

    if (fieldDelayMs > 0) {
      engineControls.setFieldVisible(false);
      const delayState = fieldDelayStateRef.current;
      const composeAndScheduleApply = () => {
        void composeFieldAsync({
          padding: fieldArgs.padding,
          placements: fieldArgs.placements,
          liveAvg,
          reservedFootprints,
          landscapeCountScale: fieldArgs.landscapeCountScale,
          ruleWidthPx: fieldArgs.ruleWidthPx,
          ruleDevice: ruleDeviceOverride,
          canvas: fieldArgs.canvas,
        }).then((placed) => {
          if (cancelled) return;
          const remainingMs = Math.max(
            0,
            (delayState?.untilMs ?? 0) - performance.now(),
          );
          const applyInRaf = () => {
            fieldRafId = requestAnimationFrame(() => {
              fieldRafId = null;
              if (cancelled) return;
              engineControls.setFieldItems(placed, { replayAppear: true });
              engineControls.setFieldVisible(placed.length > 0);
              fieldApplyStateRef.current = {
                appearSignature: fieldArgs.appearSignature,
                itemCount: placed.length,
              };
            });
          };
          if (remainingMs > 0) {
            fieldTimerId = window.setTimeout(() => {
              fieldTimerId = null;
              applyInRaf();
            }, remainingMs);
          } else {
            applyInRaf();
          }
        });
      };

      const composeDelayMs = Math.max(0, Math.min(initialComposeDelayMs, fieldDelayMs));
      if (composeDelayMs > 0) {
        composeTimerId = window.setTimeout(() => {
          composeTimerId = null;
          composeAndScheduleApply();
        }, composeDelayMs);
      } else {
        composeAndScheduleApply();
      }
      return cleanupScheduledField;
    }

    void composeAndApplyField(engineControls, fieldArgs);

    return cleanupScheduledField;
  }, [
    ready,
    controls,
    readyTick,
    liveAvg,
    viewportKey,
    spotlightIndex,
    fog,
    shapeLightSource,
    canvasResizeTick,
    hostId,
    sceneLookupKey,
    ruleset,
    reservedFootprints,
    darkMode,
    initialFieldDelayMs,
    initialComposeDelayMs,
    ruleDeviceOverride,
    ruleWidthOverride,
  ]);
}
