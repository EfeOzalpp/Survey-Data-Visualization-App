// src/scene-canvas/scene-rules/placement-rules/city.ts
import type { DeviceCount, QuotaAnchor, ScenePlacementRules } from "./types";

const FLAT_QUOTA: QuotaAnchor[] = [
  { t: 0, pct: 50 },
  { t: 1, pct: 50 },
];

const C = {
  clouds: [
    { t: 0, pct: 50 },
    { t: 1, pct: 60 },
  ],
  snow: [
    { t: 0, pct: 20 },
    { t: 1, pct: 80 },
  ],
  villa: [
    { t: 0, pct: 55 },
    { t: 1, pct: 65 },
  ],
  house: [
    { t: 0, pct: 65 },
    { t: 1, pct: 75 },
  ],
  power: [
    { t: 0, pct: 60 },
    { t: 1, pct: 30 },
  ],
  carFactory: [
    { t: 0, pct: 80 },
    { t: 1, pct: 20 },
  ],
  trees: [
    { t: 0, pct: 50 },
    { t: 1, pct: 70 },
  ],
  bus: [
    { t: 0, pct: 30 },
    { t: 1, pct: 60 },
  ],
  car: [
    { t: 0, pct: 90 },
    { t: 1, pct: 20 },
  ],
  sea: [
    { t: 0, pct: 40 },
    { t: 1, pct: 60 },
  ],
} satisfies Record<string, QuotaAnchor[]>;

function count(counts: DeviceCount): DeviceCount;
function count(mobile: number, tablet: number, laptop: number): DeviceCount;
function count(mobileOrCounts: number | DeviceCount, tablet = 0, laptop = 0): DeviceCount {
  if (typeof mobileOrCounts === "number") {
    return { mobile: mobileOrCounts, tablet, laptop };
  }

  return {
    mobile: mobileOrCounts.mobile ?? 0,
    tablet: mobileOrCounts.tablet ?? 0,
    laptop: mobileOrCounts.laptop ?? 0,
  };
}

export const CITY_PLACEMENTS: ScenePlacementRules = {
  preset: {
    kind: "zone-communities",
    zones: [
      //  sun
      {
        id: "city-sun",
        band: "sky",
        center: { x: 0.5, y: 0.1 },
        radius: { tiles: 2, xDistort: 1.5, yDistort: 0.8 },
        shapes: {
          sun: { count: count(0, 0, 1), quota: FLAT_QUOTA },
        },
      },
      {
        id: "city-sun-2",
        band: "sky",
        center: { x: 0.5, y: 0 },
        radius: { tiles: 2, xDistort: 1.5, yDistort: 0.8 },
        shapes: {
          sun: { count: count(0, 1, 0), quota: FLAT_QUOTA },
        },
      },
      {
        id: "city-sun-2",
        band: "sky",
        center: { x: 0.52, y: 0 },
        radius: { tiles: 2, xDistort: 1.5, yDistort: 0.8 },
        shapes: {
          sun: { count: count(1, 0, 0), quota: FLAT_QUOTA },
        },
      },
      // sky
      {
        id: "weather-1",
        band: "sky",
        center: { x: 0.9, y: 0.4 },
        radius: { tiles: 5, xDistort: 2.6, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(2, 0, 2), quota: C.clouds },
          snow: { count: count(1, 0, 1), quota: C.snow },
        },
      },
      {
        id: "weather-2",
        band: "sky",
        center: { x: 0, y: 0.2 },
        radius: { tiles: 5, xDistort: 2.6, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: C.clouds },
          snow: { count: count(0, 0, 1), quota: C.snow },
        },
      },
      {
        id: "weather-3",
        band: "sky",
        center: { x: 0.7, y: 0.2 },
        radius: { tiles: 3, xDistort: 2, yTiles: 0.6 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: C.clouds },
        },
      },  
      {
        id: "weather-4",
        band: "sky",
        center: { x: 0.15, y: 0.6 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 2, 3), quota: C.clouds },
          snow: { count: count(0, 1, 1), quota: C.snow },
        },
      },
      {
        id: "weather-5",
        band: "sky",
        center: { x: 0.6, y: 0.5 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: C.clouds },
          snow: { count: count(0, 0, 1), quota: C.snow },
        },
      },
      {
        id: "weather-5-mobile",
        band: "sky",
        center: { x: 0.45, y: 0.47 },
        radius: { tiles: 2, xDistort: 1, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: C.clouds },
          snow: { count: count(1, 0, 0), quota: C.snow },
        },
      },
      {
        id: "weather-6",
        band: "sky",
        center: { x: 0.2, y: 0.8 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 2, 3), quota: C.clouds },
          snow: { count: count(1, 1, 1), quota: C.snow },
        },
      },
      {
        id: "weather-7",
        band: "sky",
        center: { x: 0.8, y: 0.8 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 2, 3), quota: C.clouds },
          snow: { count: count(1, 1, 2), quota: C.snow },
        },
      },
      {
        id: "weather-8",
        band: "sky",
        center: { x: 0.3, y: 0.9 },
        radius: { tiles: 2, xDistort: 3, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 4), quota: C.clouds },
          snow: { count: count(2, 0, 2), quota: C.snow },
        },
      },
      {
        id: "weather-9",
        band: "sky",
        center: { x: 0.7, y: 0.9 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 2, 2), quota: C.clouds },
          snow: { count: count(1, 1, 1), quota: C.snow },
        },
      },
      {
        id: "weather-10",
        band: "sky",
        center: { x: 0.3, y: 0 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: C.clouds },
        },
      },
      {
        id: "weather-10-tablet",
        band: "sky",
        center: { x: 0.1, y: 0.15 },
        radius: { tiles: 1, xDistort: 2, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: C.clouds },
          snow: { count: count(0, 1, 0), quota: C.snow },
        },
      },
      {
        id: "weather-11-tablet",
        band: "sky",
        center: { x: 0.7, y: 0.3 },
        radius: { tiles: 1, xDistort: 2, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: C.clouds },
        },
      },
      {
        id: "weather-12-tablet",
        band: "sky",
        center: { x: 1, y: 0.05 },
        radius: { tiles: 1, xDistort: 2, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 1, 0), quota: C.clouds },
          snow: { count: count(0, 0, 0), quota: C.snow },
        },
      },
      {
        id: "weather-13-tablet",
        band: "sky",
        center: { x: 0.47, y: 0.5 },
        radius: { tiles: 2, xDistort: 1, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: C.clouds },
          snow: { count: count(0, 1, 0), quota: C.snow },
        },
      },
      {
        id: "weather-14-tablet",
        band: "sky",
        center: { x: 0.45, y: 0.8 },
        radius: { tiles: 2, xDistort: 1, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: C.clouds },
          snow: { count: count(0, 1, 0), quota: C.snow },
        },
      },
      {
        id: "weather-11",
        band: "sky",
        center: { x: 0.5, y: 1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 2), quota: C.clouds },
          snow: { count: count(0, 0, 1), quota: C.snow },
        },
      },
      {
        id: "weather-12",
        band: "sky",
        center: { x: 0.4, y: 1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 2), quota: C.clouds },
          snow: { count: count(0, 1, 1), quota: C.snow },
        },
      },
      {
        id: "weather-13",
        band: "sky",
        center: { x: 0.1, y: 1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.8 },
        shapes: {
          clouds: { count: count(0, 2, 3), quota: C.clouds },
          snow: { count: count(0, 2, 2), quota: C.snow },
        },
      },
      {
        id: "weather-14",
        band: "sky",
        center: { x: 0.8, y: 1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 3), quota: C.clouds },
          snow: { count: count(0, 2, 2), quota: C.snow },
        },
      },
      {
        id: "weather-14.5-mobile",
        band: "sky",
        center: { x: 0.1, y: 0.2 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(2, 0, 0), quota: C.clouds },
          snow: { count: count(1, 0, 0), quota: C.snow },
        },
      },
      {
        id: "weather-15",
        band: "sky",
        center: { x: 0.35, y: 0.7 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 0, 3), quota: C.clouds },
          snow: { count: count(0, 0, 2), quota: C.snow },
        },
      }, 
      {
        id: "weather-15-tablet",
        band: "sky",
        center: { x: 0.32, y: 0.7 },
        radius: { tiles: 1, xDistort: 2, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 0), quota: C.clouds },
          snow: { count: count(0, 1, 0), quota: C.snow },
        },
      },  
      {
        id: "weather-16",
        band: "sky",
        center: { x: 1, y: 0.6 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.4 },
        shapes: {
          clouds: { count: count(0, 2, 3), quota: C.clouds },
          snow: { count: count(0, 2, 2), quota: C.snow },
        },
      },
      // Ground
      // far
      {
        id: "ground-1",
        band: "ground",
        center: { x: 1, y: 0.2 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 6, 6), quota: C.trees },
        },
      },
      {
        id: "ground-2",
        band: "ground",
        center: { x: 0.8, y: 0.1 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 8, 6), quota: C.trees },

        },
      },
      {
        id: "ground-3",
        band: "ground",
        center: { x: 0.55, y: 0.3 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(5, 8, 6), quota: C.trees },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0.3, y: 0.1 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 7, 6), quota: C.trees },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0.1, y: 0.2 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 6, 6), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
        },
      },
      // trees
      {
        id: "ground-1",
        band: "ground",
        center: { x: 0.8, y: 0.4 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 2, 6), quota: C.trees },
          power: { count: count(0, 1, 1), quota: C.power },
        },
      },
      {
        id: "ground-1.5",
        band: "ground",
        center: { x: 0.2, y: 0.4 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(3, 3, 6), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
        },
      },
      {
        id: "ground-2",
        band: "ground",
        center: { x: 0.4, y: 0.5 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 3, 9), quota: C.trees },
          sea: { count: count(0, 1, 1), quota: C.sea },
        },
      },
      {
        id: "ground-3",
        band: "ground",
        center: { x: 0.3, y: 0.6 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(3, 4, 7), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
          sea: { count: count(0, 1, 1), quota: C.sea },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0, y: 0.4 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(1, 2, 6), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0.2, y: 0.5 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(4, 3, 4), quota: C.trees },
        },
      },
      {
        id: "ground-5",
        band: "ground",
        center: { x: 0.7, y: 0.6 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(2, 4, 8), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
          sea: { count: count(1, 1, 1), quota: C.sea },

        },
      },
      {
        id: "ground-6",
        band: "ground",
        center: { x: 0.9, y: 0.7 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(3, 5, 9), quota: C.trees },
          power: { count: count(0, 1, 1), quota: C.power },
        },
      },
      {
        id: "ground-7",
        band: "ground",
        center: { x: 0.66, y: 0.3 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(3, 6, 4), quota: C.trees },
        },
      },
      {
        id: "ground-8",
        band: "ground",
        center: { x: 0.1, y: 0.7 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(3, 6, 6), quota: C.trees },
          power: { count: count(1, 1, 1), quota: C.power },
          sea: { count: count(1, 0, 1), quota: C.sea },
        },
      },
      {
        id: "ground-9",
        band: "ground",
        center: { x: 1, y: 0.9 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(2, 3, 6), quota: C.trees },
        },
      },
      {
        id: "ground-10",
        band: "ground",
        center: { x: 0.66, y: 0.3 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(0, 4, 7), quota: C.trees },
          power: { count: count(1, 0, 1), quota: C.power },
        },
      },
      {
        id: "ground-11",
        band: "ground",
        center: { x: 0, y: 0.9 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(1, 2, 8), quota: C.trees },
          sea: { count: count(1, 1, 1), quota: C.sea },
        },
      },
      {
        id: "ground-12",
        band: "ground",
        center: { x: 0.4, y: 1 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(1, 2, 4), quota: C.trees },
          power: { count: count(0, 0, 1), quota: C.power },
        },
      },
      {
        id: "ground-12.5",
        band: "ground",
        center: { x: 0.25, y: 0.85 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(0, 0, 5), quota: C.trees },
        },
      },
      {
        id: "ground-13",
        band: "ground",
        center: { x: 0.7, y: 1 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(2, 2, 6), quota: C.trees },
          carFactory: { count: count(1, 1, 1), quota: C.carFactory },
        },
      },
      {
        id: "ground-14",
        band: "ground",
        center: { x: 0.95, y: 0.4 },
        radius: { tiles: 8, xDistort: 4, yTiles: 2 },
        shapes: {
          trees: { count: count(1, 3, 7), quota: C.trees },
          sea: { count: count(1, 1, 1), quota: C.sea },
        },
      },
      // city proper
      {
        id: "ground-1",
        band: "ground",
        center: { x: 0.4, y: 0.6 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(1, 1, 2), quota: C.house },
          villa: { count: count(1, 1, 3), quota: C.villa },
        },
      },
      {
        id: "ground-2",
        band: "ground",
        center: { x: 0.5, y: 0.5 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(1, 0, 2), quota: C.house },
          villa: { count: count(1, 1, 4), quota: C.villa },
          car: { count: count(1, 1, 2), quota: C.car },
          carFactory: { count: count(1, 1, 1), quota: C.carFactory },
        },
      },
      {
        id: "ground-3",
        band: "ground",
        center: { x: 0.6, y: 0.65 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(0, 0, 1), quota: C.house },
          villa: { count: count(1, 0, 3), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0.35, y: 0.7 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(0, 0, 2), quota: C.house },
          villa: { count: count(1, 3, 3), quota: C.villa },
          bus: { count: count(1, 0, 2), quota: C.bus },
          sea: { count: count(1, 1, 1), quota: C.sea },
        },
      },
      {
        id: "ground-5",
        band: "ground",
        center: { x: 0.65, y: 0.75 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(1, 1, 1), quota: C.house },
          villa: { count: count(1, 2, 2), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
          bus: { count: count(1, 1, 1), quota: C.bus },
          carFactory: { count: count(1, 1, 1), quota: C.carFactory },
        },
      },
      {
        id: "ground-6",
        band: "ground",
        center: { x: 0.5, y: 0.9 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(1, 0, 1), quota: C.house },
          villa: { count: count(1, 1, 4), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
          bus: { count: count(1, 1, 1), quota: C.bus },
          sea: { count: count(1, 1, 1), quota: C.sea },
        },
      },
      {
        id: "ground-7",
        band: "ground",
        center: { x: 0.55, y: 1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(0, 1, 1), quota: C.house },
          villa: { count: count(1, 3, 3), quota: C.villa },
          car: { count: count(1, 1, 2), quota: C.car },
        },
      },
      // city proper far
      {
        id: "ground-3",
        band: "ground",
        center: { x: 0.4, y: 0.3 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(0, 1, 1), quota: C.house },
          villa: { count: count(2, 3, 3), quota: C.villa },
          bus: { count: count(1, 1, 1), quota: C.bus },
        },
      },
      {
        id: "ground-4",
        band: "ground",
        center: { x: 0.6, y: 0.4 },
        radius: { tiles: 6, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(1, 0, 2), quota: C.house },
          villa: { count: count(2, 3, 2), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
          carFactory: { count: count(0, 1, 1), quota: C.carFactory },
        },
      },
      {
        id: "ground-5",
        band: "ground",
        center: { x: 0.65, y: 0.3 },
        radius: { tiles: 4, xDistort: 4, yTiles: 0.6 },
        shapes: {
          house: { count: count(2, 1, 2), quota: C.house },
          villa: { count: count(1, 2, 3), quota: C.villa },
        },
      },
      {
        id: "ground-6",
        band: "ground",
        center: { x: 0.55, y: 0.2 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(1, 0, 1), quota: C.house },
          villa: { count: count(2, 4, 4), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
        },
      },
      {
        id: "ground-7",
        band: "ground",
        center: { x: 0.6, y: 0.1 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(0, 1, 1), quota: C.house },
          villa: { count: count(1, 3, 3), quota: C.villa },
          bus: { count: count(1, 2, 1), quota: C.bus },
        },
      },
      {
        id: "ground-8",
        band: "ground",
        center: { x: 0.5, y: 0.3 },
        radius: { tiles: 4, xDistort: 4, yTiles: 1 },
        shapes: {
          house: { count: count(0, 2, 2), quota: C.house },
          villa: { count: count(2, 3, 2), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
        },
      },
      {
        id: "ground-9",
        band: "ground",
        center: { x: 0.3, y: 0.25 },
        radius: { tiles: 3, xDistort: 2, yTiles: 1 },
        shapes: {
          house: { count: count(0, 2, 1), quota: C.house },
          villa: { count: count(1, 2, 2), quota: C.villa },
          carFactory: { count: count(1, 1, 1), quota: C.carFactory },
        },
      },
      {
        id: "ground-10",
        band: "ground",
        center: { x: 0.4, y: 0.1 },
        radius: { tiles: 3, xDistort: 2, yTiles: 1 },
        shapes: {
          house: { count: count(0, 2, 1), quota: C.house },
          villa: { count: count(1, 3, 2), quota: C.villa },
          car: { count: count(1, 1, 1), quota: C.car },
        },
      },
    ],
  },
};
