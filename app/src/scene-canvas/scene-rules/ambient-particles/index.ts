import { SPOTLIGHT_SLIDES, type SpotlightSlide } from "../spotlight/slides";
import type { SceneLookupKey } from "../lookup";
import type { AmbientParticlesSceneSpec } from "./types";

export type {
  AmbientParticleLayerSpec,
  AmbientParticlesSceneSpec,
} from "./types";

type AmbientParticlesByMode = Record<SceneLookupKey, AmbientParticlesSceneSpec | null>;

const spotlightSlides: readonly SpotlightSlide[] = SPOTLIGHT_SLIDES;

const START_AMBIENT_PARTICLES: AmbientParticlesSceneSpec = {
  layers: [
    {
      count: [48, 96],
      xRange: [0.04, 0.96],
      yRange: [0.16, 0.82],
      sizePx: [1, 2],
      speedX: [6, 12],
      speedY: [-1, 4],
      color: [
        { color: "rgb(215, 234, 255)", alpha: 0.4 },
        { color: "rgb(229, 250, 255)", alpha: 0.5 },
        { color: "rgb(213, 235, 255)", alpha: 0.6 },
      ],
      seed: 31,
    },
  ],
};

const START_DARK_AMBIENT_PARTICLES: AmbientParticlesSceneSpec = {
  layers: [
    {
      count: [24, 36],
      xRange: [0.04, 0.96],
      yRange: [0.14, 0.84],
      sizePx: [1, 2],
      speedX: [3, 4],
      speedY: [-1, 4],
      color: [
        { color: "rgb(219, 235, 164)", alpha: 0.2 },
        { color: "rgb(185, 220, 169)", alpha: 0.3 },
        { color: "rgb(170, 229, 185)", alpha: 0.4 },
      ],
      seed: 37,
    },
  ],
};

const SPOTLIGHT_AMBIENT_PARTICLES = {
  layers: [],
  runtimePreset: {
    selector: "spotlightIndex",
    entries: spotlightSlides.map((slide) => slide.ambientParticles ?? null),
  },
} as const;

const SPOTLIGHT_DARK_AMBIENT_PARTICLES = {
  layers: [],
  runtimePreset: {
    selector: "spotlightIndex",
    entries: spotlightSlides.map(
      (slide) => slide.darkAmbientParticles ?? slide.ambientParticles ?? null
    ),
  },
} as const;

const CITY_AMBIENT_PARTICLES: AmbientParticlesSceneSpec = {
  layers: [
    {
      count: [32, 56],
      xRange: [0.0, 1.0],
      yRange: [0.1, 0.85],
      sizePx: [1, 2],
      speedX: [2, 5],
      speedY: [-0.5, 1.5],
      color: [
        { color: "rgb(200, 230, 255)", alpha: 0.35 },
        { color: "rgb(220, 240, 255)", alpha: 0.45 },
        { color: "rgb(245, 250, 255)", alpha: 0.3 },
      ],
      seed: 71,
    },
    {
      count: [16, 28],
      xRange: [0.0, 1.0],
      yRange: [0.2, 0.75],
      sizePx: [2, 3.5],
      speedX: [1, 4],
      speedY: [-0.5, 1.0],
      color: [
        { color: "rgb(180, 215, 245)", alpha: 0.2 },
        { color: "rgb(210, 235, 255)", alpha: 0.3 },
      ],
      seed: 83,
    },
  ],
};

const CITY_DARK_AMBIENT_PARTICLES: AmbientParticlesSceneSpec = {
  layers: [
    {
      count: [28, 48],
      xRange: [0.0, 1.0],
      yRange: [0.1, 0.85],
      sizePx: [1, 2],
      speedX: [2, 5],
      speedY: [-0.5, 1.5],
      color: [
        { color: "rgb(180, 210, 160)", alpha: 0.2 },
        { color: "rgb(160, 200, 180)", alpha: 0.25 },
        { color: "rgb(200, 225, 170)", alpha: 0.3 },
      ],
      seed: 73,
    },
    {
      count: [14, 24],
      xRange: [0.0, 1.0],
      yRange: [0.2, 0.75],
      sizePx: [1.5, 3],
      speedX: [1, 4],
      speedY: [-0.5, 1.0],
      color: [
        { color: "rgb(160, 195, 145)", alpha: 0.15 },
        { color: "rgb(180, 215, 165)", alpha: 0.2 },
      ],
      seed: 89,
    },
  ],
};

export const AMBIENT_PARTICLES: AmbientParticlesByMode = {
  start: START_AMBIENT_PARTICLES,
  questionnaire: START_AMBIENT_PARTICLES,
  city: CITY_AMBIENT_PARTICLES,
  spotlight: SPOTLIGHT_AMBIENT_PARTICLES,
} as const;

export const AMBIENT_PARTICLES_DARK: AmbientParticlesByMode = {
  start: START_DARK_AMBIENT_PARTICLES,
  questionnaire: START_DARK_AMBIENT_PARTICLES,
  city: CITY_DARK_AMBIENT_PARTICLES,
  spotlight: SPOTLIGHT_DARK_AMBIENT_PARTICLES,
} as const;
