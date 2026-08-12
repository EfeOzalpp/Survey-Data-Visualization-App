// src/scene-canvas/scene-rules/registry.ts

import { defineRuleSet } from "../validation/index";
import type { SceneState } from "./lookup";
import type { SceneProfileContext } from "./profile";
import { resolveProfile } from "./resolver";

// host definitions pick one of these rule sets for their canvas.
export const SCENE_RULESETS = {
  intro: defineRuleSet("intro", (state: SceneState, context: SceneProfileContext) =>
    resolveProfile(state, context)
  ),

  city: defineRuleSet("city", (state: SceneState, context: SceneProfileContext) =>
    resolveProfile(state, context)
  ),

  spotlight: defineRuleSet("spotlight", (state: SceneState, context: SceneProfileContext) =>
    resolveProfile(state, context)
  ),
} as const;
