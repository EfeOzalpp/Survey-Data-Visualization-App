// src/scene-canvas/validation/validateSceneProfile.ts

import type { SceneProfile } from "../scene-rules/profile";
import type { SceneLookupKey } from "../scene-rules/lookup";
import { invariant } from "./invariant";

const warnedRuntimePresets = new Set<string>();

function warnOnce(key: string, message: string) {
  if (warnedRuntimePresets.has(key)) return;
  warnedRuntimePresets.add(key);
  console.warn(`Canvas Engine Validation Warning:\n${message}`);
}

export function validateSceneProfile(id: string, mode: SceneLookupKey, profile: SceneProfile) {
  invariant(!!profile, `[${id}] SceneProfile is missing`);
  invariant(!!profile.padding, `[${id}] missing "padding" on SceneProfile`);
  invariant(!!profile.placements, `[${id}] missing "placements" on SceneProfile`);
  invariant(!!profile.background, `[${id}] missing "background" on SceneProfile`);
  invariant(!!profile.renderCache, `[${id}] missing "renderCache" on SceneProfile`);
  invariant(typeof mode === "string", `[${id}] invalid mode`);

  if (profile.background.runtimePreset?.selector === "spotlightIndex" && id !== "spotlight") {
    warnOnce(
      `${id}:${mode}:background-runtime-preset`,
      `[${id}] background runtimePreset is driven by the Spotlight signal. Move this background sequence to the spotlight ruleset or wire an explicit signal contract before using it here.`
    );
  }

  if (profile.placements.runtimePreset?.selector === "spotlightIndex" && id !== "spotlight") {
    warnOnce(
      `${id}:${mode}:placement-runtime-preset`,
      `[${id}] placement runtimePreset is driven by the Spotlight signal. Move this placement sequence to the spotlight ruleset or wire an explicit signal contract before using it here.`
    );
  }

  if (profile.padding.runtimePreset?.selector === "spotlightIndex" && id !== "spotlight") {
    warnOnce(
      `${id}:${mode}:padding-runtime-preset`,
      `[${id}] padding runtimePreset is driven by the Spotlight signal. Move this padding sequence to the spotlight ruleset or wire an explicit signal contract before using it here.`
    );
  }
}
