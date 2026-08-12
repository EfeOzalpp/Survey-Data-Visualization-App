import type { SceneLookupKey } from "../lookup";
import type { FoliageSceneSpec } from "./types";
import { SPOTLIGHT_SLIDES, type SpotlightSlide } from "../spotlight/slides";

export type {
  FoliageLayerSpec,
  FoliageSceneSpec,
} from "./types";

type FoliageByMode = Record<SceneLookupKey, FoliageSceneSpec | null>;

const spotlightSlides: readonly SpotlightSlide[] = SPOTLIGHT_SLIDES;

const SPOTLIGHT_FOLIAGE = {
  layers: [],
  runtimePreset: {
    selector: "spotlightIndex",
    entries: spotlightSlides.map((slide) => slide.foliage ?? null),
  },
} as const;

const SPOTLIGHT_DARK_FOLIAGE = {
  layers: [],
  runtimePreset: {
    selector: "spotlightIndex",
    entries: spotlightSlides.map((slide) => slide.darkFoliage ?? slide.foliage ?? null),
  },
} as const;

const _FOLIAGE = {
  layers: [
    // farthest - tiny, very subtle, near horizon
    {
      count: [50, 90] as const,
      yK: [0.5, 0.62] as const,
      heightPx: [3, 7] as const,
      widthPx: [2, 6] as const,
      color: [
        { color: "#96bf64", alpha: 0.25 },
        { color: "#cebf83", alpha: 0.22 },
        { color: "#71b571", alpha: 0.28 },
        { color: "#a8c472", alpha: 0.24 },
      ],
      seed: 41,
    },
    // upper-mid - small
    {
      count: [36, 60] as const,
      yK: [0.60, 0.72] as const,
      heightPx: [5, 10] as const,
      widthPx: [3, 8] as const,
      color: [
        { color: "#88ba58", alpha: 0.30 },
        { color: "#c4b878", alpha: 0.28 },
        { color: "#6aaf6a", alpha: 0.33 },
        { color: "#9ec468", alpha: 0.30 },
      ],
      seed: 55,
    },
    // mid
    {
      count: [24, 42] as const,
      yK: [0.70, 0.82] as const,
      heightPx: [7, 14] as const,
      widthPx: [4, 10] as const,
      color: [
        { color: "#82b552", alpha: 0.35 },
        { color: "#bdb274", alpha: 0.32 },
        { color: "#64aa64", alpha: 0.38 },
        { color: "#94be60", alpha: 0.34 },
      ],
      seed: 67,
    },
    // close - larger, still soft
    {
      count: [16, 28] as const,
      yK: [0.80, 0.95] as const,
      heightPx: [9, 18] as const,
      widthPx: [4, 12] as const,
      color: [
        { color: "#7ab04e", alpha: 0.38 },
        { color: "#b6ab6e", alpha: 0.35 },
        { color: "#5ea55e", alpha: 0.40 },
      ],
      seed: 79,
    },
  ],
} as const;

const DARK_FOLIAGE = {
  layers: [
    // farthest
    {
      count: [50, 90] as const,
      yK: [0.5, 0.62] as const,
      heightPx: [3, 7] as const,
      widthPx: [2, 6] as const,
      color: [
        { color: "#4a6840", alpha: 0.12 },
        { color: "#2e454a", alpha: 0.10 },
        { color: "#3d5e3a", alpha: 0.15 },
        { color: "#8f613c", alpha: 0.10 },
      ],
      seed: 41,
    },
    // upper-mid
    {
      count: [36, 60] as const,
      yK: [0.60, 0.72] as const,
      heightPx: [5, 10] as const,
      widthPx: [3, 8] as const,
      color: [
        { color: "#507248", alpha: 0.17 },
        { color: "#344e52", alpha: 0.15 },
        { color: "#436442", alpha: 0.20 },
        { color: "#7a5236", alpha: 0.14 },
      ],
      seed: 55,
    },
    // mid
    {
      count: [24, 42] as const,
      yK: [0.70, 0.82] as const,
      heightPx: [7, 14] as const,
      widthPx: [4, 10] as const,
      color: [
        { color: "#567c50", alpha: 0.22 },
        { color: "#3a555a", alpha: 0.20 },
        { color: "#496e48", alpha: 0.25 },
      ],
      seed: 67,
    },
    // close
    {
      count: [16, 28] as const,
      yK: [0.80, 0.95] as const,
      heightPx: [9, 18] as const,
      widthPx: [4, 12] as const,
      color: [
        { color: "#5c865a", alpha: 0.26 },
        { color: "#3e5c60", alpha: 0.13 },
        { color: "#4f7850", alpha: 0.18 },
        { color: "#7d5538", alpha: 0.18 },
      ],
      seed: 79,
    },
  ],
} as const;

export const FOLIAGE: FoliageByMode = {
  start: _FOLIAGE,
  questionnaire: _FOLIAGE,
  city: _FOLIAGE,
  spotlight: SPOTLIGHT_FOLIAGE,
} as const;

export const FOLIAGE_DARK: FoliageByMode = {
  start: DARK_FOLIAGE,
  questionnaire: DARK_FOLIAGE,
  city: DARK_FOLIAGE,
  spotlight: SPOTLIGHT_DARK_FOLIAGE,
} as const;
