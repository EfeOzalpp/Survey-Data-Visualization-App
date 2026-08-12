// src/scene-canvas/scene-rules/lookup.ts

// Scene keys index authored rule tables like padding, placements, and backgrounds.
export const SCENE_LOOKUP_KEYS = ["start", "questionnaire", "city", "spotlight"] as const;
export type SceneLookupKey = (typeof SCENE_LOOKUP_KEYS)[number];

export interface SceneState {
  lookupKey: SceneLookupKey;
}
