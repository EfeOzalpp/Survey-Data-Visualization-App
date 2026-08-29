// src/scene-canvas/scene-rules/placement-rules/start.ts

import type { DeviceCount, QuotaAnchor, ScenePlacementRules } from "./types";

const FLAT_QUOTA: QuotaAnchor[] = [
  { t: 0, pct: 50 },
  { t: 1, pct: 50 },
];

const S = {
  clouds: [
    { t: 0, pct: 40 },
    { t: 1, pct: 60 },
  ],
  snow: [
    { t: 0, pct: 40 },
    { t: 1, pct: 80 },
  ],
  villa: [
    { t: 0, pct: 48 },
    { t: 1, pct: 32 },
  ],
  house: [
    { t: 0, pct: 33 },
    { t: 1, pct: 38 },
  ],
  power: [
    { t: 0, pct: 90 },
    { t: 1, pct: 60 },
  ],
  carFactory: [
    { t: 0, pct: 20 },
    { t: 1, pct: 5 },
  ],
  trees: [
    { t: 0, pct: 25 },
    { t: 1, pct: 40 },
  ],
  bus: [
    { t: 0, pct: 20 },
    { t: 1, pct: 40 },
  ],
  car: [
    { t: 0, pct: 100 },
    { t: 1, pct: 20 },
  ],
} satisfies Record<string, QuotaAnchor[]>;

function count(mobile: number, tablet: number, laptop: number): DeviceCount {
  return { mobile, tablet, laptop };
}

export const START_PLACEMENTS: ScenePlacementRules = {
  preset: {
    kind: "zone-communities",
    zones: [
      // Sky
      {
        id: "sky-light",
        band: "sky",
        center: { x: 0.2, y: 0.1 },
        radius: { tiles: 2, xDistort: 1.8, yDistort: 0.8 },
        shapes: {
          sun: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "sky-light-tablet",
        band: "sky",
        center: { x: 0.1, y: 0.4 },
        radius: { tiles: 2, xDistort: 1.8, yDistort: 0.8 },
        shapes: {
          sun: { count: count(0, 1, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "sky-light-mobile",
        band: "sky",
        center: { x: 0.05, y: 0.15 },
        radius: { tiles: 2, xDistort: 1.8, yDistort: 0.8 },
        shapes: {
          sun: { count: count(1, 0, 0), quota: FLAT_QUOTA },
        },
      },

      {
        id: "weather-right-close-2",
        band: "sky",
        center: { x: 0.7, y: 0 },
        radius: { tiles: 4, xDistort: 6, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: S.clouds },
          snow: { count: count(0, 1, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-mid",
        band: "sky",
        center: { x: 1, y: 0.15},
        radius: { tiles: 6, xDistort: 5, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
        },
      },
      {
        id: "weather-right-mid-mobile",
        band: "sky",
        center: { x: 0.7, y: 0.6},
        radius: { tiles: 1, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: S.clouds },
          snow: { count: count(1, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-mid-mobile",
        band: "sky",
        center: { x: 0, y: 0.5},
        radius: { tiles: 1, xDistort:4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(3, 0, 0), quota: S.clouds },
          snow: { count: count(2, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-far-mobile",
        band: "sky",
        center: { x: 0.2, y: 1},
        radius: { tiles: 1, xDistort: 5, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(3, 0, 0), quota: S.clouds },
          snow: { count: count(2, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-far-mobile-2",
        band: "sky",
        center: { x: 0.5, y: 1},
        radius: { tiles: 6, xDistort: 5, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(3, 0, 0), quota: S.clouds },
          snow: { count: count(2, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-mid-2",
        band: "sky",
        center: { x: 0.85, y: 0.45 },
        radius: { tiles: 6, xDistort: 1, yTiles: 0.2 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: S.clouds },
          snow: { count: count(0, 0, 1), quota: S.snow },
        },
      },
      {
        id: "weather-right-mid-tablet",
        band: "sky",
        center: { x: 0.7, y: 0.7 },
        radius: { tiles: 6, xDistort: 4, yTiles: 0.2 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: S.clouds },
          snow: { count: count(0, 1, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-far",
        band: "sky",
        center: { x: 0.7, y: 0.9},
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 3), quota: S.clouds },
          snow: { count: count(1, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-right-far-tablet",
        band: "sky",
        center: { x: 0.3, y: 1},
        radius: { tiles: 6, xDistort: 6, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 3, 0), quota: S.clouds },
          snow: { count: count(0, 2, 0), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far-tablet",
        band: "sky",
        center: { x: 0.1, y: 1},
        radius: { tiles: 6, xDistort: 6, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 4, 0), quota: S.clouds },
          snow: { count: count(0, 3, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-far-2",
        band: "sky",
        center: { x: 0.95, y: 0.55},
        radius: { tiles: 6, xDistort: 6, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 3, 0), quota: S.clouds },
          snow: { count: count(0, 2, 0), quota: S.snow },
        },
      },
      {
        id: "weather-far-2-mobile",
        band: "sky",
        center: { x: 0.45, y: 0.7 },
        radius: { tiles: 1, xDistort: 4, yTiles: 0.5 },
        shapes: {
          clouds: { count: count(3, 0, 0), quota: S.clouds },
          snow: { count: count(1, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-far-3-mobile",
        band: "sky",
        center: { x: 0.88, y: 0.8 },
        radius: { tiles: 1, xDistort: 3, yTiles: 0.5 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: S.clouds },
          snow: { count: count(2, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-far-4-mobile",
        band: "sky",
        center: { x: 0.1, y: 0.8 },
        radius: { tiles: 1, xDistort: 6, yTiles: 0.5 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: S.clouds },
          snow: { count: count(1, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-far",
        band: "sky",
        center: { x: 0.42, y: 0.9 },
        radius: { tiles: 6, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
          snow: { count: count(0, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-left-far-mobile",
        band: "sky",
        center: { x: 0.3, y: 0.9 },
        radius: { tiles: 1, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(3, 0, 0), quota: S.clouds },
          snow: { count: count(2, 0, 0), quota: S.snow },
        },
      },
      {
        id: "weather-right-mobile",
        band: "sky",
        center: { x: 1.1, y: 0.4 },
        radius: { tiles: 1, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: S.clouds },
        },
      },
      {
        id: "weather-left-far",
        band: "sky",
        center: { x: 0.2, y: 0.9 },
        radius: { tiles: 6, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: S.clouds },
          snow: { count: count(0, 0, 1), quota: S.snow },
        },
      },
      {
        id: "weather-left-far-tablet",
        band: "sky",
        center: { x: 0.22, y: 0.8 },
        radius: { tiles: 6, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 4, 0), quota: S.clouds },
          snow: { count: count(0, 2, 0), quota: S.snow },
        },
      },
      {
        id: "weather-left-far",
        band: "sky",
        center: { x: 0.15, y: 0.8 },
        radius: { tiles: 3, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
        },
      },
      {
        id: "weather-left-far",
        band: "sky",
        center: { x: 0.1, y: 1 },
        radius: { tiles: 3, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
          snow: { count: count(0, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-left-close",
        band: "sky",
        center: { x: 0.1, y: 0.3 },
        radius: { tiles: 3, xDistort: 4, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
          snow: { count: count(0, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-left-mid-2",
        band: "sky",
        center: { x: 0.25, y: 0.7 },
        radius: { tiles: 1, xDistort: 2, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: S.clouds },
          snow: { count: count(0, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far",
        band: "sky",
        center: { x: 0.52, y: 0.8 },
        radius: { tiles: 3, xDistort: 4, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(0, 3, 3), quota: S.clouds },
          snow: { count: count(0, 2, 2), quota: S.snow },
        },
      },
      {
        id: "weather-left-top-tablet",
        band: "sky",
        center: { x: 0.1, y: 0.22 },
        radius: { tiles: 4, xDistort: 3, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: S.clouds },
          snow: { count: count(0, 1, 0), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far-tablet-2",
        band: "sky",
        center: { x: 0.35, y: 0.6 },
        radius: { tiles: 1, xDistort: 3, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 3, 0), quota: S.clouds },
          snow: { count: count(0, 1, 0), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far-2",
        band: "sky",
        center: { x: 0.95, y: 0.6 },
        radius: { tiles: 1, xDistort: 3, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: S.clouds },
          snow: { count: count(0, 0, 1), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far-3",
        band: "sky",
        center: { x: 0.22, y: 1 },
        radius: { tiles: 3, xDistort: 2, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: S.clouds },
          snow: { count: count(0, 0, 2), quota: S.snow },
        },
      },
      {
        id: "weather-mid-far-4",
        band: "sky",
        center: { x: 0.55, y: 1 },
        radius: { tiles: 3, xDistort: 2, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 2, 2), quota: S.clouds },
          snow: { count: count(0, 3, 3), quota: S.snow },
        },
      },
      {
        id: "weather-right-far-4",
        band: "sky",
        center: { x: 0.84, y: 1 },
        radius: { tiles: 3, xDistort: 3, yTiles: 0.3 },
        shapes: {
          clouds: { count: count(0, 3, 3), quota: S.clouds },
          snow: { count: count(0, 2, 2), quota: S.snow },
        },
      },

      // Ground
      {
        id: "left-far-community",
        band: "ground",
        center: { x: 0.2, y: 0.0 },
        radius: { tiles: 8, xDistort: 6, yDistort: 0.3 },
        shapes: {
          house: { count: count(2, 2, 3), quota: S.house },
          villa: { count: count(2, 3, 5), quota: S.villa },
          trees: { count: count(4, 6, 8), quota: S.trees },
          car: { count: count(1, 2, 4), quota: S.car },
        },
      },
      {
        id: "left-far-trees",
        band: "ground",
        center: { x: 0.4, y: 0 },
        radius: { tiles: 8, xDistort: 6, yDistort: 4 },
        shapes: {
          trees: { count: count(6, 6, 8), quota: S.trees },
        },
      },
      {
        id: "mid-far-trees",
        band: "ground",
        center: { x: 0.45, y: 0.1 },
        radius: { tiles: 8, xDistort: 6, yDistort: 3 },
        shapes: {
          trees: { count: count(6, 6, 8), quota: S.trees },
          villa: { count: count(2, 3, 3), quota: S.villa },
        },
      },
      {
        id: "mid-far-trees",
        band: "ground",
        center: { x: 0.46, y: 0 },
        radius: { tiles: 8, xDistort: 6, yDistort: 3 },
        shapes: {
          trees: { count: count(6, 6, 8), quota: S.trees },
          villa: { count: count(2, 3, 3), quota: S.villa },
          house: { count: count(1, 2, 1), quota: S.house },
        },
      },
      {
        id: "right-close-trees",
        band: "ground",
        center: { x: 1, y: 0.85 },
        radius: { tiles: 4, xDistort: 4, yDistort: 3 },
        shapes: {
          trees: { count: count(4, 4, 6), quota: S.trees },
        },
      },
      {
        id: "mid-far-trees",
        band: "ground",
        center: { x: 0.54, y: 0.3 },
        radius: { tiles: 6, xDistort: 4, yDistort: 2 },
        shapes: {
          trees: { count: count(4, 3, 8), quota: S.trees },
          villa: { count: count(3, 1, 1), quota: S.villa },
          bus: { count: count(0, 0, 1), quota: S.bus },
        },
      },
      {
        id: "left-far-trees",
        band: "ground",
        center: { x: 0.06, y: 0 },
        radius: { tiles: 12, xDistort: 8, yDistort: 3 },
        shapes: {
          trees: { count: count(4, 4, 16), quota: S.trees },
        },
      },
      {
        id: "left-far-trees-2",
        band: "ground",
        center: { x: 0.3, y: 0 },
        radius: { tiles: 12, xDistort: 8, yDistort: 2 },
        shapes: {
          villa: { count: count(2, 3, 6), quota: S.villa },
          trees: { count: count(4, 4, 12), quota: S.trees },
        },
      },
      {
        id: "left-far-trees-3",
        band: "ground",
        center: { x: 0.7, y: 0 },
        radius: { tiles: 12, xDistort: 8, yDistort: 2 },
        shapes: {
          villa: { count: count(2, 1, 4), quota: S.villa },
          trees: { count: count(4, 4, 6), quota: S.trees },
        },
      },
      {
        id: "right-mid-trees",
        band: "ground",
        center: { x: 0.8, y: 0.2 },
        radius: { tiles: 4, xDistort: 4, yDistort: 1 },
        shapes: {
          trees: { count: count(3, 2, 4), quota: S.trees },
        },
      },
      {
        id: "left-mid",
        band: "ground",
        center: { x: 0.05, y: 0.2 },
        radius: { tiles: 4, xDistort: 6, yDistort: 1 },
        shapes: {
          villa: { count: count(2, 1, 4), quota: S.villa },
          trees: { count: count(2, 4, 6), quota: S.trees },
          car: { count: count(1, 2, 0), quota: S.car },
          power: { count: count(0, 1, 1), quota: FLAT_QUOTA },
          clouds: { count: count(0, 0, 1), quota: FLAT_QUOTA },
          snow: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-far-trees-tablet-2",
        band: "ground",
        center: { x: 0.9, y: 0.1 },
        radius: { tiles: 4, xDistort: 4, yDistort: 1 },
        shapes: {
          trees: { count: count(0, 6, 0), quota: S.trees },
        },
      },
      {
        id: "right-far-trees",
        band: "ground",
        center: { x: 0.75, y: 0 },
        radius: { tiles: 4, xDistort: 4, yDistort: 1 },
        shapes: {
          trees: { count: count(4, 8, 6), quota: S.trees },
        },
      },
      {
        id: "right-far-trees-2",
        band: "ground",
        center: { x: 0.75, y: 0.05 },
        radius: { tiles: 4, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(2, 1, 4), quota: S.villa },
          trees: { count: count(1, 3, 6), quota: S.trees },
          clouds: { count: count(0, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-far-community",
        band: "ground",
        center: { x: 0.65, y: 0 },
        radius: { tiles: 6, xDistort: 4, yDistort: 2 },
        shapes: {
          villa: { count: count(2, 3, 4), quota: S.villa },
          trees: { count: count(3, 3, 3), quota: S.trees },
          car: { count: count(1, 2, 1), quota: S.car },
          bus: { count: count(1, 1, 0), quota: S.bus },
          power: { count: count(1, 1, 1), quota: FLAT_QUOTA },
          clouds: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-far-community-2",
        band: "ground",
        center: { x: 0.95, y: 0 },
        radius: { tiles: 6, xDistort: 5, yDistort: 1.5 },
        shapes: {
          villa: { count: count(2, 2, 1), quota: S.villa },
          house: { count: count(3, 1, 0), quota: S.house },
          trees: { count: count(6, 8, 4), quota: S.trees },
          car: { count: count(1, 2, 1), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
        },
      },
      {
        id: "right-far-community-2",
        band: "ground",
        center: { x: 1, y: 0.4 },
        radius: { tiles: 6, xDistort: 4, yDistort: 2 },
        shapes: {
          villa: { count: count(0, 1, 4), quota: S.villa },
          house: { count: count(0, 0, 4), quota: S.house },
          trees: { count: count(2, 4, 2), quota: S.trees },
          car: { count: count(1, 1, 1), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
          power: { count: count(1, 1, 2), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-close-community",
        band: "ground",
        center: { x: 0.85, y: 0.4 },
        radius: { tiles: 6, xDistort: 4, yDistort: 2 },
        shapes: {
          villa: { count: count(2, 1, 2), quota: S.villa },
          trees: { count: count(1, 2, 4), quota: S.trees },
          car: { count: count(0, 1, 1), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
          snow: { count: count(1, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-community",
        band: "ground",
        center: { x: 0.85, y: 0.8 },
        radius: { tiles: 3, xDistort: 2, yDistort: 1 },
        shapes: {
          house: { count: count(0, 0, 1), quota: S.house },
          villa: { count: count(0, 2, 1), quota: S.villa },
          trees: { count: count(1, 3, 8), quota: S.trees },
          car: { count: count(1, 1, 1), quota: S.car },
          power: { count: count(1, 0, 0), quota: FLAT_QUOTA },
          carFactory: { count: count(2, 1, 1), quota: S.carFactory },
        },
      },
      {
        id: "left-community-mobile",
        band: "ground",
        center: { x: 0, y: 0.9 },
        radius: { tiles: 3, xDistort: 1, yDistort: 3 },
        shapes: {
          villa: { count: count(1, 0, 0), quota: S.villa }, 
          house: { count: count(1, 0, 0), quota: S.house },
          car: { count: count(1, 0, 1), quota: S.car },
          trees: { count: count(1, 0, 0), quota: S.trees },
        },
      },
      {
        id: "right-community",
        band: "ground",
        center: { x: 0.8, y: 0.55 },
        radius: { tiles: 8, xDistort: 5, yDistort: 0.4 },
        shapes: {
          trees: { count: count(2, 0, 4), quota: S.trees },
          car: { count: count(1, 0, 1), quota: S.car },
          power: { count: count(1, 0, 0), quota: FLAT_QUOTA },
          carFactory: { count: count(1, 0, 1), quota: S.carFactory },
        },
      },
      {
        id: "mid-community-2",
        band: "ground",
        center: { x: 0.65, y: 0.5 },
        radius: { tiles: 4, xDistort: 2, yDistort: 1 },
        shapes: {
          house: { count: count(1, 1, 0), quota: S.house },
          villa: { count: count(0, 1, 1), quota: S.villa },
          trees: { count: count(3, 3, 5), quota: S.trees },
          car: { count: count(1, 1, 2), quota: S.car },
          power: { count: count(0, 1, 0), quota: FLAT_QUOTA },
          carFactory: { count: count(1, 1, 1), quota: S.carFactory },
        },
      },
      {
        id: "mid-close-community",
        band: "ground",
        center: { x: 0.5, y: 0.7 },
        radius: { tiles: 4, xDistort: 6, yDistort: 2 },
        shapes: {
          villa: { count: count(0, 1, 3), quota: S.villa },
          trees: { count: count(1, 2, 6), quota: S.trees },
          car: { count: count(1, 1, 1), quota: S.car },
          house: { count: count(0, 1, 0), quota: S.house },
          carFactory: { count: count(1, 1, 1), quota: S.carFactory },
          sea: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "mid-close-community-2",
        band: "ground",
        center: { x: 0.55, y: 0.8 },
        radius: { tiles: 4, xDistort: 6, yDistort: 1 },
        shapes: {
          trees: { count: count(1, 3, 3), quota: S.trees },
          car: { count: count(1, 1, 0), quota: S.car },
          power: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "mid-edge",
        band: "ground",
        center: { x: 0.65, y: 0.8 },
        radius: { tiles: 8, xDistort: 6, yDistort: 1 },
        shapes: {
          villa: { count: count(2, 1, 2), quota: S.villa },
          trees: { count: count(1, 2, 3), quota: S.trees },
          car: { count: count(0, 1, 1), quota: S.car },
          bus: { count: count(0, 1, 1), quota: S.bus },
          house: { count: count(0, 0, 1), quota: S.house },
        },
      },
      {
        id: "mid-edge-2",
        band: "ground",
        center: { x: 0.72, y: 0.55 },
        radius: { tiles: 4, xDistort: 3, yDistort: 0.3 },
        shapes: {
          trees: { count: count(0, 2, 5), quota: S.trees },
          sea: { count: count(1, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "left-edge",
        band: "ground",
        center: { x: 0.2, y: 0.5 },
        radius: { tiles: 8, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(4, 3, 5), quota: S.trees },
        },
      },
      {
        id: "right-edge-2",
        band: "ground",
        center: { x: 0.57, y: 0.4 },
        radius: { tiles: 8, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(2, 4, 8), quota: S.trees },
        },
      },
      {
        id: "right-edge-3",
        band: "ground",
        center: { x: 0.8, y: 0.45 },
        radius: { tiles: 8, xDistort: 3, yDistort: 0.4 },
        shapes: {
          trees: { count: count(0, 0, 4), quota: S.trees },
          house: { count: count(0, 1, 0), quota: S.house },
          villa: { count: count(0, 2, 4), quota: S.villa },
        },
      },
      {
        id: "left-edge-4",
        band: "ground",
        center: { x: 0.9, y: 0.8 },
        radius: { tiles: 4, xDistort: 2, yDistort: 2 },
        shapes: {
          trees: { count: count(0, 0, 1), quota: S.trees },
          house: { count: count(1, 0, 0), quota: S.house },
          sea: { count: count(0, 0, 1), quota: FLAT_QUOTA },
          car: { count: count(1, 1, 2), quota: S.car },
        },
      },
      {
        id: "right-edge-tablet",
        band: "ground",
        center: { x: 0.9, y: 1 },
        radius: { tiles: 8, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(0, 4, 0), quota: S.trees },
        },
      },
      {
        id: "right-edge-tablet",
        band: "ground",
        center: { x: 1, y: 0.5 },
        radius: { tiles: 8, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(0, 6, 2), quota: S.trees },
        },
      },
      {
        id: "mid-trees",
        band: "ground",
        center: { x: 0.35, y: 0.9 },
        radius: { tiles: 5, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(1, 2, 1), quota: S.trees },
        },
      },
      {
        id: "mid-close-patch",
        band: "ground",
        center: { x: 0.5, y: 0.9 },
        radius: { tiles: 3, xDistort: 6, yDistort: 0.6 },
        shapes: {
          trees: { count: count(0, 0, 1), quota: S.trees },
        },
      },
      {
        id: "right-close-patch-mobile",
        band: "ground",
        center: { x: 0.9, y: 1 },
        radius: { tiles: 4, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(3, 0, 0), quota: S.trees },
          car: { count: count(0, 0, 0), quota: S.car },
          sea: { count: count(1, 0, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "left-close-patch-mobile",
        band: "ground",
        center: { x: 0, y: 0.9 },
        radius: { tiles: 3, xDistort: 6, yDistort: 0.3 },
        shapes: {
          trees: { count: count(3, 0, 0), quota: S.trees },
        },
      },
      {
        id: "right-mid-patch-mobile",
        band: "ground",
        center: { x: 0.65, y: 0.3 },
        radius: { tiles: 6, xDistort: 4, yDistort: 0.6 },
        shapes: {
          trees: { count: count(2, 1, 0), quota: S.trees },
        },
      },
      {
        id: "left-close",
        band: "ground",
        center: { x: 0, y: 0.9 },
        radius: { tiles: 5, xDistort: 6, yDistort: 0.3 },
        shapes: {
          villa: { count: count(0, 0, 1), quota: S.villa },
          trees: { count: count(1, 3, 2), quota: S.trees },
          clouds: { count: count(0, 1, 1), quota: S.clouds },
        },
      },
      {
        id: "left-mid-community",
        band: "ground",
        center: { x: 0.1, y: 0.7 },
        radius: { tiles: 6, xDistort: 3, yDistort: 1 },
        shapes: {
          sea: { count: count(0, 0, 1), quota: FLAT_QUOTA },
          house: { count: count(0, 1, 1), quota: S.house },
          villa: { count: count(0, 2, 3), quota: S.villa },
          trees: { count: count(1, 6, 4), quota: S.trees },
          car: { count: count(0, 1, 1), quota: S.car },
          bus: { count: count(0, 1, 0), quota: S.bus },
          power: { count: count(0, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "left-patch-community-desktop",
        band: "ground",
        center: { x: 0.15, y: 1 },
        radius: { tiles: 4, xDistort: 4, yDistort: 0.6 },
        shapes: {
          carFactory: { count: count(0, 1, 1), quota: FLAT_QUOTA },
          villa: { count: count(0, 0, 1), quota: S.villa },
        },
      },
      {
        id: "left-community-mobile+tablet",
        band: "ground",
        center: { x: 0, y: 0.4 },
        radius: { tiles: 6, xDistort: 3, yDistort: 1 },
        shapes: {
          sea: { count: count(1, 1, 0), quota: FLAT_QUOTA },
          villa: { count: count(1, 0, 0), quota: S.villa },
          trees: { count: count(1, 4, 0), quota: S.trees },
          car: { count: count(1, 0, 0), quota: S.car },
          bus: { count: count(1, 0, 0), quota: S.bus },
          power: { count: count(1, 1, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "left-mid-community-2",
        band: "ground",
        center: { x: 0.25, y: 0.65 },
        radius: { tiles: 6, xDistort: 3, yDistort: 0.6 },
        shapes: {
          sea: { count: count(0, 1, 1), quota: FLAT_QUOTA },
          villa: { count: count(0, 1, 2), quota: S.villa },
          trees: { count: count(1, 3, 2), quota: S.trees },
          car: { count: count(0, 1, 1), quota: S.car },
          power: { count: count(1, 0, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "mid-community",
        band: "ground",
        center: { x: 0.45, y: 0.5 },
        radius: { tiles: 5, xDistort: 2, yDistort: 1 },
        shapes: {
          sea: { count: count(0, 1, 1), quota: FLAT_QUOTA },
          carFactory: { count: count(1, 1, 1), quota: FLAT_QUOTA },
          house: { count: count(0, 0, 0), quota: S.house },
          villa: { count: count(2, 1, 2), quota: S.villa },
          trees: { count: count(1, 2, 6), quota: S.trees },
          car: { count: count(1, 0, 0), quota: S.car },
          bus: { count: count(0, 0, 1), quota: S.bus },
        },
      },
      {
        id: "left-far-community-2",
        band: "ground",
        center: { x: 0.2, y: 0.3 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(3, 2, 4), quota: S.villa },
          house: { count: count(0, 1, 2), quota: S.house },
          trees: { count: count(4, 5, 6), quota: S.trees },
          car: { count: count(1, 1, 3), quota: S.car },
          bus: { count: count(0, 1, 1), quota: S.bus },
          power: { count: count(1, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "left-far-community-3",
        band: "ground",
        center: { x: 0.35, y: 0 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 2, 4), quota: S.villa },
          trees: { count: count(0, 2, 6), quota: S.trees },
          car: { count: count(0, 2, 3), quota: S.car },
        },
      },
            {
        id: "left-far-community-3",
        band: "ground",
        center: { x: 0.35, y: 0.2 },
        radius: { tiles: 3, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 2, 4), quota: S.villa },
          house: { count: count(0, 0, 1), quota: S.house },
          trees: { count: count(0, 2, 4), quota: S.trees },
          car: { count: count(0, 2, 2), quota: S.car },
        },
      },
      {
        id: "left-far-community-3",
        band: "ground",
        center: { x: 0.14, y: 0 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 3, 4), quota: S.villa },
          trees: { count: count(0, 2, 6), quota: S.trees },
        },
      },
      {
        id: "mid-community-4",
        band: "ground",
        center: { x: 0.33, y: 0.7 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(1, 0, 2), quota: S.villa },
          trees: { count: count(2, 0, 4), quota: S.trees },
        },
      },
      {
        id: "mid-far-community-5",
        band: "ground",
        center: { x: 0.54, y: 0.4 },
        radius: { tiles: 5, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(2, 0, 2), quota: S.villa },
          house: { count: count(0, 0, 0), quota: S.house },
          trees: { count: count(0, 3, 1), quota: S.trees },
          car: { count: count(1, 0, 1), quota: S.car },
        },
      },
      {
        id: "mid-community-6",
        band: "ground",
        center: { x: 0.6, y: 0.55 },
        radius: { tiles: 2, xDistort: 3, yDistort: 1 },
        shapes: {
          trees: { count: count(0, 0, 2), quota: S.trees },
          car: { count: count(0, 0, 1), quota: S.car },
        },
      },
      {
        id: "mid-close-community-7",
        band: "ground",
        center: { x: 0.58, y: 0.9 },
        radius: { tiles: 2, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 0, 1), quota: S.villa },
          trees: { count: count(1, 0, 1), quota: S.trees },
          car: { count: count(0, 0, 1), quota: S.car },
          power: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "mid-close-community-71",
        band: "ground",
        center: { x: 0.3, y: 0.75 },
        radius: { tiles: 3, xDistort: 4, yDistort: 1 },
        shapes: {
          trees: { count: count(0, 0, 12), quota: S.trees },
          car: { count: count(0, 0, 2), quota: S.car },
        },
      },
      {
        id: "mid-close-community-72",
        band: "ground",
        center: { x: 0.48, y: 0.3 },
        radius: { tiles: 2, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 0, 1), quota: S.villa },
          trees: { count: count(0, 0, 4), quota: S.trees },
          car: { count: count(0, 0, 2), quota: S.car },
        },
      },
      {
        id: "left-far-community-8",
        band: "ground",
        center: { x: 0.02, y: 0.4 },
        radius: { tiles: 4, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 0, 2), quota: S.villa },
          trees: { count: count(0, 0, 4), quota: S.trees },
          car: { count: count(0, 0, 1), quota: S.car },
          house: { count: count(0, 0, 1), quota: S.house },
        },
      },
      {
        id: "left-mid-community-9",
        band: "ground",
        center: { x: 0.1, y: 0.4 },
        radius: { tiles: 4, xDistort: 3, yDistort: 1 },
        shapes: {
          house: { count: count(0, 1, 1), quota: S.house },
          trees: { count: count(0, 3, 4), quota: S.trees },
          villa: { count: count(0, 1, 2), quota: S.villa },
        },
      },
      {
        id: "close-mid-community-9",
        band: "ground",
        center: { x: 0.2, y: 0.8 },
        radius: { tiles: 4, xDistort: 3, yDistort: 1 },
        shapes: {
            bus: { count: count(0, 0, 1), quota: S.bus },
        },
      },
      {
        id: "right-far-community",
        band: "ground",
        center: { x: 0.55, y: 0.2 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(1, 1, 3), quota: S.villa },
          house: { count: count(1, 0, 1), quota: S.house },
          trees: { count: count(1, 2, 6), quota: S.trees },
          car: { count: count(1, 1, 3), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
          power: { count: count(1, 1, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-far-community-1.5",
        band: "ground",
        center: { x: 0.72, y: 0.5 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 0, 2), quota: S.villa },
          trees: { count: count(0, 0, 2), quota: S.trees },
        },
      },
      {
        id: "right-far-community-2",
        band: "ground",
        center: { x: 0.75, y: 0.4 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(1, 2, 1), quota: S.villa },
          trees: { count: count(2, 1, 3), quota: S.trees },
          car: { count: count(1, 1, 3), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
          power: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "right-far-community-3",
        band: "ground",
        center: { x: 0.92, y: 0.3 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(1, 1, 2), quota: S.villa },
          trees: { count: count(2, 2, 8), quota: S.trees },
          car: { count: count(1, 1, 3), quota: S.car },
          bus: { count: count(1, 1, 1), quota: S.bus },
        },
      },
      {
        id: "right-close-community",
        band: "ground",
        center: { x: 1, y: 1 },
        radius: { tiles: 6, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(1, 0, 2), quota: S.villa },
          bus: { count: count(1, 0, 0), quota: S.bus },
          car: { count: count(0, 0, 1), quota: S.car },
        },
      },
      {
        id: "mid-close-community-2",
        band: "ground",
        center: { x: 0.52, y: 1 },
        radius: { tiles: 4, xDistort: 3, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 0, 1), quota: S.villa },
          bus: { count: count(0, 0, 1), quota: S.bus },
          car: { count: count(0, 0, 1), quota: S.car },
        },
      },
      {
        id: "close-community-tablet",
        band: "ground",
        center: { x: 0.3, y: 1 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 1, 0), quota: S.villa },
          house: { count: count(0, 1, 0), quota: S.house },
          trees: { count: count(0, 2, 0), quota: S.trees },
          car: { count: count(0, 1, 0), quota: S.car },
          bus: { count: count(0, 1, 0), quota: S.bus },
          power: { count: count(0, 1, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "close-community-tablet-2",
        band: "ground",
        center: { x: 1, y: 1 },
        radius: { tiles: 3, xDistort: 4, yDistort: 1 },
        shapes: {
          house: { count: count(0, 1, 0), quota: S.house },
          villa: { count: count(0, 1, 0), quota: S.villa },
          trees: { count: count(0, 1, 0), quota: S.trees },
        },
      },
      {
        id: "mid-community-tablet",
        band: "ground",
        center: { x: 0.35, y: 0.4 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          villa: { count: count(0, 1, 0), quota: S.villa },
          trees: { count: count(0, 4, 0), quota: S.trees },
          car: { count: count(0, 1, 0), quota: S.car },
        },
      },
      {
        id: "left-community-close",
        band: "ground",
        center: { x: 0, y: 1 },
        radius: { tiles: 6, xDistort: 4, yDistort: 1 },
        shapes: {
          trees: { count: count(0, 0, 4), quota: S.trees },
        },
      },
      {
        id: "right-community-close",
        band: "ground",
        center: { x: 0.7, y: 1 },
        radius: { tiles: 6, xDistort: 3, yDistort: 2 },
        shapes: {
          trees: { count: count(0, 0, 4), quota: S.trees },
        },
      },
    ],
  },
};