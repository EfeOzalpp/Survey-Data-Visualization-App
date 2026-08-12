import type { SceneLookupKey } from "../lookup";
import type { FogLightGradientSpec, FogSceneSpec } from "./types";

export type {
  FogColor,
  FogGradientStop,
  FogLightGradientSpec,
  FogModeSpec,
  FogSceneSpec,
} from "./types";

function darkLightGradient(args: {
  leftEdgeColor: FogLightGradientSpec["leftEdgeColor"];
  rightEdgeColor: FogLightGradientSpec["rightEdgeColor"];
}): FogLightGradientSpec {
  return {
    leftEdgeColor: args.leftEdgeColor,
    rightEdgeColor: args.rightEdgeColor,
    innerRadiusK: 0.13,
  };
}

export const DEFAULT_FOG: FogSceneSpec = {
} as const;

export const DEFAULT_DARK_FOG: FogSceneSpec = {
  lightRadiusK: 0.13,
  sky: {
    color: { r: 33, g: 32, b: 40 },
    skyGradient: darkLightGradient({
      leftEdgeColor: { r: 55, g: 58, b: 72 },
      rightEdgeColor: { r: 14, g: 10, b: 32 },
    }),
  },
  ground: {
    color: { r: 33, g: 32, b: 40 },
    groundGradient: darkLightGradient({
      leftEdgeColor: { r: 52, g: 54, b: 54 },
      rightEdgeColor: { r: 15, g: 9, b: 30 },
    }),
  },
} as const;

export const FOG: Record<SceneLookupKey, FogSceneSpec | null> = {
  start: DEFAULT_FOG,
  questionnaire: DEFAULT_FOG,
  city: DEFAULT_FOG,
  spotlight: null,
} as const;

export const FOG_DARK: Record<SceneLookupKey, FogSceneSpec | null> = {
  start: DEFAULT_DARK_FOG,
  questionnaire: DEFAULT_DARK_FOG,
  city: DEFAULT_DARK_FOG,
  spotlight: null,
} as const;
