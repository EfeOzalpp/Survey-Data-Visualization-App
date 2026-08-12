// src/scene-canvas/scene-rules/resolver.ts

import type { SceneLookupKey, SceneState } from "./lookup";
import type { SceneProfile, SceneProfileContext } from "./profile";

import { CANVAS_PADDING } from "./canvas-padding/index";
import { SHAPE_PLACEMENTS } from "./placement-rules/index";
import {
  BACKGROUNDS_CITY,
  BACKGROUNDS_CITY_DARK,
  BACKGROUNDS_LIGHT,
  BACKGROUNDS_QUESTIONNAIRE,
  BACKGROUNDS_QUESTIONNAIRE_DARK,
  BACKGROUNDS_SPOTLIGHT,
  BACKGROUNDS_SPOTLIGHT_DARK,
  BACKGROUNDS_START_DARK,
  type BackgroundSpec,
} from "./backgrounds";
import {
  AMBIENT_PARTICLES,
  AMBIENT_PARTICLES_DARK,
  type AmbientParticlesSceneSpec,
} from "./ambient-particles";
import { FOG, FOG_DARK, type FogSceneSpec } from "./fog";
import { FOLIAGE, FOLIAGE_DARK, type FoliageSceneSpec } from "./foliage";
import { DEFAULT_RENDER_CACHE_POLICY } from "../runtime/render/cache-policy";
import type { DeviceCountScale } from "../shared/responsiveness";

type SceneRules = Pick<SceneProfile, "padding" | "placements">;

// quota multiplier for smaller device landscape modes for continued visual fidelity at small desktops and horizontal mobile.
const LANDSCAPE_COUNT_SCALE: Record<SceneLookupKey, DeviceCountScale> = {
  start: { mobile: 1.6, tablet: 1.4 },
  questionnaire: { mobile: 2, tablet: 0.8 },
  city: { mobile: 1.2, tablet: 1.2 },
  spotlight: {},
};

function rulesForLookupKey(lookupKey: SceneLookupKey): SceneRules {
  if (lookupKey === "start") {
    return {
      padding: CANVAS_PADDING.start,
      placements: SHAPE_PLACEMENTS.start,
    };
  }

  if (lookupKey === "questionnaire") {
    return {
      padding: CANVAS_PADDING.questionnaire,
      placements: SHAPE_PLACEMENTS.questionnaire,
    };
  }

  if (lookupKey === "spotlight") {
    return {
      padding: CANVAS_PADDING.spotlight,
      placements: SHAPE_PLACEMENTS.spotlight,
    };
  }

  return {
    padding: CANVAS_PADDING.city,
    placements: SHAPE_PLACEMENTS.city,
  };
}

// Background is resolved here so the scene profile owns the full visual contract.
function backgroundForState(
  state: SceneState,
  context: SceneProfileContext
): BackgroundSpec {
  if (state.lookupKey === "city") {
    return context.darkMode ? BACKGROUNDS_CITY_DARK.city : BACKGROUNDS_CITY.city;
  }

  if (state.lookupKey === "questionnaire") {
    return context.darkMode
      ? BACKGROUNDS_QUESTIONNAIRE_DARK.questionnaire
      : BACKGROUNDS_QUESTIONNAIRE.questionnaire;
  }

  if (state.lookupKey === "spotlight") {
    return context.darkMode
      ? BACKGROUNDS_SPOTLIGHT_DARK.spotlight
      : BACKGROUNDS_SPOTLIGHT.spotlight;
  }

  return context.darkMode ? BACKGROUNDS_START_DARK.start : BACKGROUNDS_LIGHT.start;
}

function fogForState(
  state: SceneState,
  context: SceneProfileContext
): FogSceneSpec | null {
  return context.darkMode ? FOG_DARK[state.lookupKey] : FOG[state.lookupKey];
}

function ambientParticlesForState(
  state: SceneState,
  context: SceneProfileContext
): AmbientParticlesSceneSpec | null {
  return context.darkMode
    ? AMBIENT_PARTICLES_DARK[state.lookupKey]
    : AMBIENT_PARTICLES[state.lookupKey];
}

function foliageForState(
  state: SceneState,
  context: SceneProfileContext
): FoliageSceneSpec | null {
  return context.darkMode ? FOLIAGE_DARK[state.lookupKey] : FOLIAGE[state.lookupKey];
}

export function resolveProfile(
  state: SceneState,
  context: SceneProfileContext
): SceneProfile {
  return {
    ...rulesForLookupKey(state.lookupKey),
    background: backgroundForState(state, context),
    ambientParticles: ambientParticlesForState(state, context),
    fog: fogForState(state, context),
    foliage: foliageForState(state, context),
    renderCache: DEFAULT_RENDER_CACHE_POLICY,
    landscapeCountScale: LANDSCAPE_COUNT_SCALE[state.lookupKey],
  };
}
