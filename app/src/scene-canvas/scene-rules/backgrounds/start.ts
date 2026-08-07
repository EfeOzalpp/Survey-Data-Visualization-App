import type { BackgroundSpec } from "./types";

// light scene
const START_BACKGROUND: BackgroundSpec = {
  base: "rgb(158, 222, 248)",
  overlay: {
    kind: "linear",
    from: { xK: 0.5, yK: 0.0 },
    to: { xK: 0.5, yK: 1.0 },
    stops: [
      // sky
      { rgba: "rgba(158, 222, 248)" },
      { rgba: "rgb(175, 228, 255)" },
      { rgba: "rgb(214, 242, 255)" },
      { rgba: "rgb(214, 242, 255)" },
      { rgba: "rgb(248, 243, 239)" },
      { k: "visualHorizon", rgba: "rgb(255, 226, 202)" },
      // ground
      { k: "visualHorizon", rgba: "rgba(108, 214, 184, 0.95)", liveBlend: [0.04, 0.12] },
      { rgba: "rgba(82, 184, 103, 0.97)", liveBlend: [0.02, 0.08] },
      { rgba: "rgba(112, 189, 116, 0.97)" },
      { k: 0.96, rgba: "rgba(120, 156, 102, 1)" },
      { rgba: "rgba(120, 156, 102, 1)" }
    ] as const,
  },
} as const;

export const BACKGROUNDS_LIGHT: Record<"start", BackgroundSpec> = {
  start: START_BACKGROUND,
} as const;

// dark scene
const START_BACKGROUND_DARK: BackgroundSpec = {
  base: "rgb(18, 26, 62)",
  overlay: {
    kind: "linear",
    from: { xK: 0.5, yK: 0.0 },
    to: { xK: 0.5, yK: 1.0 },
    stops: [
      { rgba: "rgb(20, 35, 68)",   rightRgba: "rgb(44, 49, 60)" },
      { rgba: "rgb(49, 84, 126)",  rightRgba: "rgb(67, 71, 93)" },
      { rgba: "rgb(68, 116, 179)", rightRgba: "rgb(98, 99, 129)" },
      { rgba: "rgb(79, 135, 198)", rightRgba: "rgb(124, 123, 172)", liveBlend: [0.16, 0.20] },
      { k: "visualHorizon", rgba: "rgb(102, 158, 255)", rightRgba: "rgb(89, 91, 143)", liveBlend: [0.04, 0.12], blendFromPrevious: false, blendToNext: false },
      // ground
      { k: "visualHorizon", rgba: "rgb(157, 255, 239)", rightRgba: "rgb(237, 222, 137)", liveBlend: [0.06, 0.12], blendFromPrevious: false },
      { rgba: "rgb(147, 236, 210)", rightRgba: "rgb(220, 210, 155)", liveBlend: [0.08, 0.10] },
      { rgba: "rgb(138, 215, 176)", rightRgba: "rgb(210, 196, 160)", liveBlend: [0.08, 0.12] },
      { rgba: "rgb(125, 201, 148)", rightRgba: "rgb(205, 185, 158)", liveBlend: [0.08, 0.10] }
    ] as const,
  },
  stars: {
    count: [60, 90],
    topBandK: 0.5,
    minR: 0.9,
    maxR: 1.6,
    alpha: [[0.5, 1.5], [0.6, 1.6]],
    flickerHz: [[0.42, 0.98], [0.14, 0.34]],
  },
} as const;

export const BACKGROUNDS_START_DARK: Record<"start", BackgroundSpec> = {
  start: START_BACKGROUND_DARK,
} as const;
