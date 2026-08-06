// src/scene-canvas/scene-rules/canvas-padding/start.ts

import type { CanvasPaddingSpec } from './types';
import { makeRowForbidden, LR_0 } from './helpers';
import type { DeviceType } from '../../shared/responsiveness';

export const START_PADDING: Record<DeviceType, CanvasPaddingSpec | null> = {
  mobile: {
    rows: 26,
    useTopRatio: 1,
    horizonPos: 0.6,
    forbidden: makeRowForbidden(
      Array.from( { length: 26 } , () => ({ ...LR_0}))
    ),
  },

  tablet: {
    rows: 24,
    useTopRatio: 1,
    horizonPos: 0.46,
    forbidden: makeRowForbidden(
      Array.from( { length: 22 }, () => ({ ...LR_0}))
    ),
  },

  laptop: {
    rows: 20,
    useTopRatio: 1,
    horizonPos: 0.54,
    forbidden: makeRowForbidden(
      Array.from( { length: 18 } , () => ({ ...LR_0}))
    ),
  },
};
