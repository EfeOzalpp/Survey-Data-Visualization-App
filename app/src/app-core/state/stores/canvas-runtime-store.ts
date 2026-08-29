// src/app-core/state/stores/canvas-runtime-store.ts

import { create } from 'zustand';
import { startTransition, useEffect } from 'react';

import { getSessionItem } from '../../session';

import type { Place } from '../../../scene-canvas/grid-layout/occupancy';
import type { SpotlightSignal } from '../../../scene-canvas/hooks/signals';
import type { EngineFieldItem } from '../../../scene-canvas/runtime/engine/field';

const DEFAULT_AVG = 0.5;
export const DEFAULT_SPOTLIGHT_SIGNAL: SpotlightSignal = { index: 0, paused: false };

function normalizeAvg(avg: unknown) {
  return typeof avg === 'number' && Number.isFinite(avg) ? avg : DEFAULT_AVG;
}

function sameFootprint(a: Place, b: Place) {
  return a.r0 === b.r0 && a.c0 === b.c0 && a.w === b.w && a.h === b.h;
}

function sameFootprints(a: Place[], b: Place[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!sameFootprint(a[i], b[i])) return false;
  }
  return true;
}

export interface CanvasRuntimeState {
  hoveredShape: EngineFieldItem | null;
  setHoveredShape: (item: EngineFieldItem | null) => void;
  clickedShape: EngineFieldItem | null;
  setClickedShape: (item: EngineFieldItem | null) => void;
  liveAvg: number;
  setLiveAvg: (avg?: number) => void;
  reservedFootprints: Place[];
  setReservedFootprints: (next: Place[]) => void;
  spotlight: SpotlightSignal;
  spotlightLiveAvg: number;
  setSpotlightLiveAvg: (avg?: number) => void;
  previousSpotlight: () => void;
  nextSpotlight: () => void;
  setSpotlightPaused: (paused: boolean) => void;
  toggleSpotlightPaused: () => void;
}

export const useCanvasRuntimeStore = create<CanvasRuntimeState>((set, get) => ({
  hoveredShape: null,
  clickedShape: null,
  liveAvg: DEFAULT_AVG,
  reservedFootprints: [],
  spotlight: DEFAULT_SPOTLIGHT_SIGNAL,
  spotlightLiveAvg: DEFAULT_AVG,

  setHoveredShape: (item) => { set({ hoveredShape: item }); },
  setClickedShape: (item) => { set({ clickedShape: item }); },
  setLiveAvg: (avg) => { set({ liveAvg: normalizeAvg(avg) }); },
  setSpotlightLiveAvg: (avg) => { set({ spotlightLiveAvg: normalizeAvg(avg) }); },

  setReservedFootprints: (next) => {
    if (sameFootprints(get().reservedFootprints, next)) return;
    set({ reservedFootprints: next });
  },

  previousSpotlight: () => {
    set((s) => ({ spotlight: { ...s.spotlight, index: s.spotlight.index - 1 } }));
  },
  nextSpotlight: () => {
    set((s) => ({ spotlight: { ...s.spotlight, index: s.spotlight.index + 1 } }));
  },
  setSpotlightPaused: (paused) => {
    set((s) => ({ spotlight: { ...s.spotlight, paused } }));
  },
  toggleSpotlightPaused: () => {
    set((s) => ({ spotlight: { ...s.spotlight, paused: !s.spotlight.paused } }));
  },
}));

export function resetCanvasRuntimeState() {
  useCanvasRuntimeStore.setState({
    hoveredShape: null,
    clickedShape: null,
    liveAvg: DEFAULT_AVG,
    reservedFootprints: [],
    spotlight: DEFAULT_SPOTLIGHT_SIGNAL,
    spotlightLiveAvg: DEFAULT_AVG,
  });
}

export function useBootstrapLiveAvgFromSession() {
  useEffect(() => {
    const stored = getSessionItem('be.myAvg');
    if (stored === null) return;
    const parsed = parseFloat(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      startTransition(() => {
        useCanvasRuntimeStore.setState({ liveAvg: parsed });
      });
    }
  }, []);
}
