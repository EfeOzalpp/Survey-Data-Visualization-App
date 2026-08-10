// src/scene-canvas/multi-canvas-setup/hostDefs.ts

import { SCENE_RULESETS } from "../scene-rules/registry";
import type { SceneRuleSet } from "../scene-rules/profile";
import type { SceneLookupKey } from "../scene-state";
import type { DprMode } from "../runtime/platform/viewport";

export type CanvasBounds =
  | { kind: "viewport" }
  | { kind: "parent" }
  | { kind: "fixed"; w: number; h: number };

interface HostDefBase {
  mount: string;
  zIndex: number;
  dprMode: DprMode;
  fpsCap?: number;
  initialFieldDelayMs?: number;
  initialComposeDelayMs?: number;
  canvasDimensions?: CanvasBounds;
  pauseWhenOffscreen?: boolean;
  stopOnOpen?: readonly string[];
  pointerHit?: boolean;
  scene?: {
    lookupKey: SceneLookupKey;
    ruleset: SceneRuleSet;
  };
}

type HostDefs<T extends Record<string, HostDefBase>> = {
  [K in keyof T]: Omit<T[K], "stopOnOpen"> & {
    stopOnOpen?: readonly (keyof T & string)[];
  };
};

const defineHosts = <T extends Record<string, HostDefBase>>(t: T & HostDefs<T>) => t;

export const HOST_DEFS = defineHosts({
  start: {
    mount: "#canvas-root",
    zIndex: 2,
    dprMode: "cap2",
    fpsCap: 60,
    initialFieldDelayMs: 140,
    initialComposeDelayMs: 60,
    canvasDimensions: { kind: "parent" },
    pauseWhenOffscreen: true,
    pointerHit: true,
    scene: { lookupKey: "start", ruleset: SCENE_RULESETS.intro },
  },

  questionnaire: {
    mount: "#questionnaire-canvas-root",
    zIndex: 2,
    dprMode: "cap2",
    fpsCap: 60,
    stopOnOpen: ["start"],
    initialFieldDelayMs: 100,
    canvasDimensions: { kind: "parent" },
    pauseWhenOffscreen: true,
    pointerHit: false,
    scene: { lookupKey: "questionnaire", ruleset: SCENE_RULESETS.intro },
  },

  city: {
    mount: "#city-canvas-root",
    zIndex: 60,
    dprMode: "cap2",
    fpsCap: 60,
    initialFieldDelayMs: 50,
    canvasDimensions: { kind: "viewport" },
    pauseWhenOffscreen: true,
    pointerHit: true,
    scene: { lookupKey: "city", ruleset: SCENE_RULESETS.city },
  },

  spotlight: {
    mount: "#spotlight-canvas-root",
    zIndex: 60,
    dprMode: "cap2",
    fpsCap: 60,
    canvasDimensions: { kind: "parent" },
    pauseWhenOffscreen: true,
    scene: { lookupKey: "spotlight", ruleset: SCENE_RULESETS.spotlight },
  },
} as const);

export type HostId = keyof typeof HOST_DEFS;

type HostDef = Omit<HostDefBase, "stopOnOpen"> & {
  stopOnOpen?: readonly HostId[];
};

export function getHostDef(id: HostId): HostDef {
  return HOST_DEFS[id];
}
