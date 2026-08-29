// src/graph-runtime/dotgraph/scene.tsx

// Composition root for DotGraph data, hover state, personalization, and rendered layers.

import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';

import { usePreferences } from '../../app-core/state/context/preferences-context';
import { useUiStore } from '../../app-core/state/stores/ui-store';
import { useShallow } from 'zustand/react/shallow';
import { useSurveyDataStore } from '../../app-core/state/stores/survey-data-store';
import { useSharedGraphData } from '../useSharedGraphData';
import { bumpGeneration, resetQueue } from '../sprites/entry';
import { DEFAULT_VIEWPORT_WIDTH, isMobileWidth } from '../../lib/responsive/breakpoints';

import useHoverBubble from './interaction/useHoverBubble';
import useHoverDismissal from './interaction/useHoverDismissal';
import useObserverDelay from './interaction/useObserverDelay';
import useObserverSpotlight from './interaction/useObserverSpotlight';
import ShapesLayer from './components/ShapesLayer';
import PersonalizedLayer from './components/PersonalizedLayer';
import HoveredLayer from './components/GeneralizedLayer';
import usePersonalizationGate from './scene/usePersonalizationGate';
import useDotGraphSceneState from './scene/useDotGraphSceneState';
import usePersonalizationState from './scene/usePersonalizationState';

export default function DotGraph() {
  const { darkMode } = usePreferences();
  const observerMode = useUiStore((s) => s.observerMode);
  const mode = useUiStore((s) => s.mode);
  const setPersonalPanelOpen = useUiStore((s) => s.setPersonalPanelOpen);
  const { section, allFilteredRows: fullSurveyData, loading } = useSurveyDataStore(
    useShallow((s) => ({ section: s.section, allFilteredRows: s.allFilteredRows, loading: s.loading }))
  );

  const {
    safeData,
    dataById,
    getRelForId,
    getRelForValue,
    getAbsForId,
    getAbsForValue,
    absScoreById: absScoreByIdMap,
  } = useSharedGraphData();

  const showCompleteUI = useObserverDelay(observerMode, 2000);

  const personalizationGate = usePersonalizationGate({
    safeData,
    observerMode,
    isSmallScreen: isMobileWidth(typeof window === 'undefined' ? DEFAULT_VIEWPORT_WIDTH : window.innerWidth),
  });

  useEffect(() => {
    setPersonalPanelOpen(personalizationGate.personalOpen);
  }, [personalizationGate.personalOpen, setPersonalPanelOpen]);

  const isPersonalizedGraphView =
    personalizationGate.hasPersonalizedInDataset &&
    personalizationGate.shouldShowPersonalized;

  // For non-observer: apply personalized framing as soon as personalizedEntryId
  // is available from session storage, without waiting for Postgres to confirm.
  // This ensures the initial zoom is set on first mount rather than on data arrival.
  const showPersonalizedForZoom = observerMode
    ? isPersonalizedGraphView
    : (!!personalizationGate.personalizedEntryId && personalizationGate.shouldShowPersonalized);

  const graphViewKey = useMemo(
    () => [
      section,
      // Non-observer: keep personalized framing stable across the pending id ->
      // saved Postgres id handoff. Section/view changes still reset the camera.
      // Observer: keep the confirmed-dataset gate so view switches are still detected.
      !observerMode && personalizationGate.personalizedEntryId && personalizationGate.shouldShowPersonalized
        ? 'personalized'
        : isPersonalizedGraphView
          ? personalizationGate.personalizedEntryId ?? 'personalized'
          : 'general',
    ].join('|'),
    [
      isPersonalizedGraphView,
      observerMode,
      personalizationGate.personalizedEntryId,
      personalizationGate.shouldShowPersonalized,
      section,
    ]
  );

  const scene = useDotGraphSceneState({
    safeData,
    personalizedEntryId: personalizationGate.personalizedEntryId,
    sectionKey: section,
    showPersonalized: showPersonalizedForZoom,
    darkMode,
    wantsSkew: personalizationGate.wantsSkew,
    wantsSoloSkew: mode === 'absolute' && personalizationGate.wantsSkew,
    zoomResetKey: graphViewKey,
  });
  // Pull the scene contract out of the hook result so layer props stay explicit.
  const {
    groupRef,
    shapes,
    useDesktopLayout,
    isPinchingRef,
    isTouchRotatingRef,
    spriteScale,
    bagSeed,
    isRealMobile,
    isTabletLike,
    particleFrames,
    tileSize,
    radius,
    minRadius,
    maxRadius,
    zoomTargetRef,
  } = scene;

  const zoomFraction = (maxRadius - radius) / Math.max(1, maxRadius - minRadius);
  const shapeHitboxScale = 1;

  const personalization = usePersonalizationState({
    personalizedEntryId: personalizationGate.personalizedEntryId,
    sectionKey: section,
    bagSeed,
    shapes,
    dataById,
    showCompleteUI,
    mode,
    getRelForId,
    getRelForValue,
    getAbsForId,
    getAbsForValue,
    fullData: fullSurveyData,
    shouldShowPersonalized: personalizationGate.shouldShowPersonalized,
    statsLoading: loading,
    darkMode,
  });

  const calcValueForAvg = useCallback(
    (averageWeight: number) => {
      try {
        return mode === 'relative' ? getRelForValue(averageWeight) : getAbsForValue(averageWeight);
      } catch {
        return 0;
      }
    },
    [mode, getRelForValue, getAbsForValue]
  );

  const { hoveredDot, viewportClass, onHoverStart, onHoverEnd } = useHoverBubble({
    useDesktopLayout,
    isPinchingRef,
    isTouchRotatingRef,
    calcPercentForAvg: calcValueForAvg,
  });

  useLayoutEffect(() => {
    bumpGeneration();
    resetQueue();
    onHoverEnd();
  }, [graphViewKey, onHoverEnd]);

  // Observer mode can briefly synthesize a hover so the graph explains itself without real pointer input.
  const { spotlightActiveRef } = useObserverSpotlight({
    points: shapes,
    onHoverStart,
    onHoverEnd,
    groupRef,
    excludeId: personalizationGate.personalizedEntryId,
    sectionKey: section,
    bagSeed,
    spriteScale,
    hitboxScale: shapeHitboxScale,
    useDesktopLayout,
  });

  useHoverDismissal({
    mode,
    section,
    dataCount: safeData.length,
    useDesktopLayout,
    spotlightActiveRef,
    onHoverEnd,
  });

  return (
    <>
      <group ref={groupRef}>
        <ShapesLayer
          shapes={shapes}
          myEntry={personalization.myEntry}
          personalizedEntryId={personalizationGate.personalizedEntryId}
          showCompleteUI={showCompleteUI}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          spriteScale={spriteScale}
          bagSeed={bagSeed}
          darkMode={darkMode}
          occasionalRefreshMs={isRealMobile ? 3600 : isTabletLike ? 2200 : 2000}
          hitboxScale={shapeHitboxScale}
          particleFrames={particleFrames}
          tileSize={tileSize}
          section={section}
          useDesktopLayout={useDesktopLayout}
          zoomTargetRef={zoomTargetRef}
          hidePersonalizedSprite={personalization.shouldRenderPersonalUI}
        />

        <PersonalizedLayer
          shouldRenderPersonalUI={personalization.shouldRenderPersonalUI}
          shouldRenderExtraPersonalSprite={personalization.shouldRenderExtraPersonalSprite}
          effectiveMyShape={personalization.effectiveMyShape}
          effectiveMyEntry={personalization.effectiveMyEntry}
          personalSpriteAssignment={personalization.personalSpriteAssignment}
          personalSpriteIdentity={personalization.personalSpriteIdentity}
          spriteScale={spriteScale}
          bagSeed={bagSeed}
          myDisplayValue={personalization.myDisplayValue}
          myScoreValue={personalization.myScoreValue}
          groupAverageValue={personalization.groupAverageValue}
          mode={mode}
          myStats={personalization.myStats}
          statsLoading={personalization.shouldShowStatsLoading}
          setPersonalOpen={personalizationGate.setPersonalOpen}
          onPersonalizedPanelEnter={onHoverEnd}
          darkMode={darkMode}
          zoomFraction={zoomFraction}
          particleFrames={particleFrames}
          sectionKey={section}
          hitboxScale={shapeHitboxScale}
        />

        <HoveredLayer
          hoveredDot={hoveredDot}
          shapes={shapes}
          safeData={safeData}
          mode={mode}
          zoomFraction={zoomFraction}
          viewportClass={viewportClass}
          calcValueForAvg={calcValueForAvg}
          getRelForId={getRelForId}
          absScoreById={absScoreByIdMap}
        />
      </group>
    </>
  );
}
