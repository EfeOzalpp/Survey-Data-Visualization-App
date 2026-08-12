// src/scene-canvas/scene-rules/placement-rules/index.ts

import type { SceneLookupKey } from "../lookup";
import type { ScenePlacementRules } from "./types";

export type {
  ScenePlacementRules,
  PlacementZone,
  ProceduralZoneBand,
  PointPlacement,
  DeviceCount,
} from "./types";
export {
  ONE_PER_DEVICE,
  centerShape,
  forShapes,
  interpolatePct,
  pointPlacement,
  stableItemId,
} from "./helpers";

import { START_PLACEMENTS } from "./start";
import { CITY_PLACEMENTS } from "./city";
import { QUESTIONNAIRE_PLACEMENTS } from "./questionnaire";
import { SPOTLIGHT_PLACEMENTS } from "./spotlight";

export const SHAPE_PLACEMENTS: Record<SceneLookupKey, ScenePlacementRules> = {
  start: START_PLACEMENTS,
  city: CITY_PLACEMENTS,
  questionnaire: QUESTIONNAIRE_PLACEMENTS,
  spotlight: SPOTLIGHT_PLACEMENTS,
};
