// src/scene-canvas/scene-rules/canvas-padding/index.ts

import type { SceneLookupKey } from '../lookup';
import type { CanvasPaddingPolicy } from './types';

export type { CanvasPaddingPolicy, CanvasPaddingSpec } from './types';
export { uniformRows } from "./helpers";
export { resolvePaddingPolicyVariants, resolvePaddingSpec } from "./resolve";

import { START_PADDING }         from './start';
import { QUESTIONNAIRE_PADDING }          from './questionnaire';
import { CITY_PADDING }          from './city';
import { SPOTLIGHT_PADDING } from './spotlight';

export const CANVAS_PADDING: Record<SceneLookupKey, CanvasPaddingPolicy> = {
  start:         START_PADDING,
  city:          CITY_PADDING,
  questionnaire: QUESTIONNAIRE_PADDING,
  spotlight:     SPOTLIGHT_PADDING,
};
