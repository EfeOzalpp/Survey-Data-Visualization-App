// src/graph-runtime/dotgraph/scene/usePersonalizationState.ts

import { useEffect, useMemo } from 'react';

import { sampleStops, rgbString } from '../../../lib/utils/color-and-interpolation';
import { avgWeightOf } from '../../../lib/utils/score';
import { getTieStats } from '../../gamification/rankLogic';
import {
  resolveSpriteIdentity,
  resolveSpriteVisual,
  type SpriteAssignment,
  type SpriteIdentity,
} from '../../sprites/entry';
import { useUiStore } from '../../../app-core/state/ui-store';
import { getSessionItem, removeSessionItems } from '../../../app-core/session';
import type {
  DotGraphEntry,
  DotGraphTieStats,
  DotPoint,
  PersonalizedDotShape,
} from '../types';

interface UsePersonalizationStateParams {
  personalizedEntryId: string | null;
  sectionKey: string;
  bagSeed: string;
  shapes: DotPoint[];
  dataById: Map<string, DotGraphEntry>;
  showCompleteUI: boolean;
  mode: 'absolute' | 'relative';
  getRelForId: (id: string) => number;
  getRelForValue: (value: number) => number;
  getAbsForId: (id: string) => number;
  getAbsForValue: (value: number) => number;
  fullData: DotGraphEntry[];
  shouldShowPersonalized: boolean;
  statsLoading: boolean;
  darkMode: boolean;
}

export default function usePersonalizationState({
  personalizedEntryId,
  sectionKey: _sectionKey,
  bagSeed,
  shapes,
  dataById,
  showCompleteUI,
  mode,
  getRelForId,
  getRelForValue,
  getAbsForId,
  getAbsForValue,
  fullData,
  shouldShowPersonalized,
  statsLoading,
  darkMode,
}: UsePersonalizationStateParams) {
  const myShape = useMemo(
    () => shapes.find((shape) => shape._id === personalizedEntryId),
    [shapes, personalizedEntryId]
  );

  const myShapeIndex = useMemo(
    () => shapes.findIndex((shape) => shape._id === personalizedEntryId),
    [shapes, personalizedEntryId]
  );

  const myEntry = useMemo(
    () => (personalizedEntryId ? dataById.get(personalizedEntryId) ?? null : null),
    [dataById, personalizedEntryId]
  );

  const setOpenPersonalized = useUiStore((s) => s.setOpenPersonalized);

  const mySnapshot = useMemo(() => {
    if (myEntry) return null;
    try {
      const raw = getSessionItem('be.myDoc');
      return raw ? (JSON.parse(raw) as DotGraphEntry) : null;
    } catch {
      return null;
    }
  }, [myEntry]);

  const effectiveMyEntry: DotGraphEntry | null = myEntry ?? mySnapshot;

  const fallbackColor = useMemo(() => {
    const avg = Number(effectiveMyEntry?.avgWeight);
    if (!Number.isFinite(avg)) return '#ffffff';
    return rgbString(sampleStops(avg));
  }, [effectiveMyEntry]);

  const effectiveMyShape: PersonalizedDotShape | null =
    myShape ??
    (effectiveMyEntry ? { position: [0, 0, 0], color: fallbackColor } : null);

  const personalSprite = useMemo<{
    assignment: SpriteAssignment;
    identity: SpriteIdentity;
  } | null>(() => {
    if (!effectiveMyEntry) return null;

    const entryId = effectiveMyEntry._id ?? personalizedEntryId;
    if (!entryId) return null;

    const entryAvg = Number(effectiveMyEntry.avgWeight);
    const shapeAvg = Number(myShape?.averageWeight);
    const avg = Number.isFinite(entryAvg)
      ? entryAvg
      : Number.isFinite(shapeAvg)
        ? shapeAvg
        : 0.5;

    const visual = resolveSpriteVisual({
      entryId,
      // Use entryId as the stable section key so the personal shape is cached
      // once per person and doesn't change when the graph picker section changes.
      sectionKey: entryId,
      avg,
      seed: bagSeed,
      orderIndex: myShapeIndex >= 0 ? myShapeIndex : 0,
      baseScale: 1,
    });

    if (!visual.assignment) return null;

    return {
      assignment: visual.assignment,
      identity: resolveSpriteIdentity(visual.assignment, { darkMode }),
    };
  }, [bagSeed, darkMode, effectiveMyEntry, myShape?.averageWeight, myShapeIndex, personalizedEntryId]);

  const myDisplayValue = useMemo(() => {
    if (!(showCompleteUI && effectiveMyEntry)) return 0;

    if (myEntry?._id) {
      return mode === 'relative' ? getRelForId(myEntry._id) : getAbsForId(myEntry._id);
    }

    const avg = Number(effectiveMyEntry.avgWeight);
    if (!Number.isFinite(avg)) return 0;

    try {
      return mode === 'relative' ? Math.round(getRelForValue(avg)) : Math.round(getAbsForValue(avg));
    } catch {
      return 0;
    }
  }, [
    showCompleteUI,
    effectiveMyEntry,
    myEntry,
    mode,
    getRelForId,
    getAbsForId,
    getRelForValue,
    getAbsForValue,
  ]);

  const myScoreValue = useMemo(() => {
    if (!effectiveMyEntry) return 0;
    return Math.round(avgWeightOf(effectiveMyEntry) * 100);
  }, [effectiveMyEntry]);

  const groupAverageValue = useMemo(() => {
    if (!fullData.length) return 0;
    const total = fullData.reduce((sum, entry) => sum + avgWeightOf(entry), 0);
    return Math.round((total / fullData.length) * 100);
  }, [fullData]);

  const myStats: DotGraphTieStats =
    effectiveMyEntry && myEntry?._id
      ? getTieStats({ data: fullData, targetId: myEntry._id })
      : { below: 0, equal: 0, above: 0, totalOthers: 0 };

  const shouldRenderPersonalUI =
    showCompleteUI && shouldShowPersonalized && !!effectiveMyShape && !!effectiveMyEntry;

  const shouldShowStatsLoading =
    shouldRenderPersonalUI && (statsLoading || !myEntry?._id);

  const shouldRenderExtraPersonalSprite = shouldRenderPersonalUI;

  useEffect(() => {
    const wantOpen = getSessionItem('be.openPersonalOnNext') === '1';
    if (!wantOpen) return;
    if (!shouldRenderPersonalUI) return;
    removeSessionItems(['be.openPersonalOnNext']);
    setOpenPersonalized(true);
  }, [shouldRenderPersonalUI, setOpenPersonalized]);

  return {
    myEntry,
    effectiveMyEntry,
    effectiveMyShape,
    personalSpriteAssignment: personalSprite?.assignment,
    personalSpriteIdentity: personalSprite?.identity,
    myDisplayValue,
    myScoreValue,
    groupAverageValue,
    myStats,
    shouldShowStatsLoading,
    shouldRenderPersonalUI,
    shouldRenderExtraPersonalSprite,
  };
}
