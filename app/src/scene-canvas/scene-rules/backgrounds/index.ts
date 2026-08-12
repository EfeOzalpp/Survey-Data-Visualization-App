// src/scene-canvas/scene-rules/backgrounds/index.ts

// unlike backgrounds/types.ts this is what outside files import from.
export type {
  RgbaStop,
  BackgroundStopK,
  BackgroundAnchorContext,
  RadialGradientSpec,
  LinearGradientSpec,
  BackgroundSpec,
} from "./types";

export { BACKGROUNDS_LIGHT, BACKGROUNDS_START_DARK } from "./start";
export { BACKGROUNDS_QUESTIONNAIRE, BACKGROUNDS_QUESTIONNAIRE_DARK } from "./questionnaire";
export { BACKGROUNDS_CITY, BACKGROUNDS_CITY_DARK } from "./city";
export { BACKGROUNDS_SPOTLIGHT, BACKGROUNDS_SPOTLIGHT_DARK } from "./spotlight";

import type { SceneLookupKey } from "../lookup";
import type { BackgroundSpec } from "./types";
import { BACKGROUNDS_LIGHT, BACKGROUNDS_START_DARK } from "./start";
import { BACKGROUNDS_QUESTIONNAIRE, BACKGROUNDS_QUESTIONNAIRE_DARK } from "./questionnaire";
import { BACKGROUNDS_CITY, BACKGROUNDS_CITY_DARK } from "./city";
import { BACKGROUNDS_SPOTLIGHT, BACKGROUNDS_SPOTLIGHT_DARK } from "./spotlight";

// Full-scene lookup used by runtime when no host-specific background is passed.
export const BACKGROUNDS: Record<SceneLookupKey, BackgroundSpec> = {
  ...BACKGROUNDS_LIGHT,
  ...BACKGROUNDS_QUESTIONNAIRE,
  city: BACKGROUNDS_CITY.city,
  spotlight: BACKGROUNDS_SPOTLIGHT.spotlight,
};

// Dark variant of the full-scene lookup.
export const BACKGROUNDS_DARK: Record<SceneLookupKey, BackgroundSpec> = {
  ...BACKGROUNDS_START_DARK,
  ...BACKGROUNDS_QUESTIONNAIRE_DARK,
  city: BACKGROUNDS_CITY_DARK.city,
  spotlight: BACKGROUNDS_SPOTLIGHT_DARK.spotlight,
};
