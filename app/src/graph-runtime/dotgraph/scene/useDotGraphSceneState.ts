// src/graph-runtime/dotgraph/scene/useDotGraphSceneState.ts

import { useEffect, useMemo, useState } from 'react';

import { sampleStops, rgbString } from '../../../lib/utils/color-and-interpolation';
import { useRealMobileViewport } from '../../../lib/hooks/useRealMobileViewport';
import { useWindowWidth } from '../../../lib/hooks/useWindowWidth';
import { isMobileWidth, isTabletWidth } from '../../../lib/responsive/breakpoints';
import { desktopGraphToolsOffsetPx, tabletGraphToolsYOffsetPx } from '../../../lib/responsive/graph-tools-offset';
import { useUiStore } from '../../../app-core/state/stores/ui-store';
import { chooseCameraSpriteTileSize, prewarmSpriteTextures, resolveSpriteVisual } from '../../sprites/entry';
import { bumpZoomMetric } from '../../debug/zoomMetrics';
import { useOrbitController } from '../camera';
import useDotPoints from './useDotPoints';
import { nonlinearLerp } from '../utils/math';
import type { DotPointsOptions, SurveyResponseLike, Vec3 } from '../types';

interface UseDotGraphSceneStateParams {
  safeData: SurveyResponseLike[];
  personalizedEntryId: string | null;
  sectionKey: string;
  showPersonalized: boolean;
  darkMode: boolean;
  wantsSkew: boolean;
  wantsSoloSkew: boolean;
  zoomResetKey?: string | number;
}

const MOBILE_PANEL_X_OFFSET_PX = -200;
const SOLO_MOBILE_PANEL_EXTRA_X_OFFSET_PX = -60;

const GRAPH_MIN_RADIUS_MOBILE = 2;
const GRAPH_MIN_RADIUS_DESKTOP = 20;
const GRAPH_MAX_RADIUS_TOUCH = 800;
const GRAPH_MAX_RADIUS_DESKTOP = 600;

const PERSONALIZED_MAX_ZOOM_FRACTION_DESKTOP = 0.925;
const PERSONALIZED_INITIAL_ZOOM_FRACTION_DESKTOP = 0.84;

const PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_1_TILE = 0.85;
const PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_2_TILE = 0.80;
const PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_3_TILE = 0.77;

const PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_1_TILE = 0.74;
const PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_2_TILE = 0.68;
const PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_3_TILE = 0.64;

const PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_1_TILE = 0.92;
const PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_2_TILE = 0.83;
const PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_3_TILE = 0.74;

const DOTGRAPH_BAG_SEED = 'dotgraph-bag-v1';
const TILE_SIZE_ZOOM_SETTLE_MS = 220;

function resolvePersonalizedMaxZoomFraction({
  isRealMobile,
  isSmallScreen,
  isTabletLike,
  tileWidth,
}: {
  isRealMobile: boolean;
  isSmallScreen: boolean;
  isTabletLike: boolean;
  tileWidth: number;
}) {
  const width = Math.max(1, Math.round(tileWidth));
  if (isRealMobile || isSmallScreen) {
    if (width >= 3) return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_3_TILE;
    if (width >= 2) return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_2_TILE;
    return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_1_TILE;
  }
  if (isTabletLike) {
    if (width >= 3) return PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_3_TILE;
    if (width >= 2) return PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_2_TILE;
    return PERSONALIZED_MAX_ZOOM_FRACTION_TABLET_1_TILE;
  }
  return PERSONALIZED_MAX_ZOOM_FRACTION_DESKTOP;
}

function resolvePersonalizedInitialZoomFraction({
  isRealMobile,
  isSmallScreen,
  isTabletLike,
  tileWidth,
}: {
  isRealMobile: boolean;
  isSmallScreen: boolean;
  isTabletLike: boolean;
  tileWidth: number;
}) {
  const width = Math.max(1, Math.round(tileWidth));
  if (isRealMobile || isSmallScreen) {
    if (width >= 3) return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_3_TILE;
    if (width >= 2) return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_2_TILE;
    return PERSONALIZED_MAX_ZOOM_FRACTION_PHONE_1_TILE;
  }
  if (isTabletLike) {
    if (width >= 3) return PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_3_TILE;
    if (width >= 2) return PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_2_TILE;
    return PERSONALIZED_INITIAL_ZOOM_FRACTION_TABLET_1_TILE;
  }
  return PERSONALIZED_INITIAL_ZOOM_FRACTION_DESKTOP;
}

function resolvePersonalizedSpriteTileWidth({
  safeData,
  personalizedEntryId,
  sectionKey,
}: {
  safeData: SurveyResponseLike[];
  personalizedEntryId: string | null;
  sectionKey: string;
}) {
  if (!personalizedEntryId) return 1;

  const index = safeData.findIndex((entry) => entry._id === personalizedEntryId);
  const entry = index >= 0 ? safeData[index] : null;
  if (!entry) return 1;

  const avg = Number.isFinite(entry.avgWeight) ? Number(entry.avgWeight) : 0.5;
  return resolveSpriteVisual({
    entryId: personalizedEntryId,
    sectionKey,
    avg,
    seed: DOTGRAPH_BAG_SEED,
    orderIndex: Math.max(0, index),
    baseScale: 1,
  }).layout.footprint.w;
}

function minRadiusForZoomFraction({
  baseMinRadius,
  maxRadius,
  maxZoomFraction,
}: {
  baseMinRadius: number;
  maxRadius: number;
  maxZoomFraction: number;
}) {
  const fraction = Math.max(0, Math.min(1, maxZoomFraction));
  return maxRadius - fraction * (maxRadius - baseMinRadius);
}

export default function useDotGraphSceneState({
  safeData,
  personalizedEntryId,
  sectionKey,
  showPersonalized,
  darkMode,
  wantsSkew,
  wantsSoloSkew,
  zoomResetKey,
}: UseDotGraphSceneStateParams) {
  const isRealMobile = useRealMobileViewport();
  const windowWidth = useWindowWidth();
  const isSmallScreen = isMobileWidth(windowWidth);
  const isTabletLike = isTabletWidth(windowWidth);
  const useDesktopLayout = !(isSmallScreen || isRealMobile || isTabletLike);

  const logsOpen = useUiStore((s) => s.logsOpen);
  const widgetsOpen = useUiStore((s) => s.widgetsOpen);
  const graphNavOffsetPx = desktopGraphToolsOffsetPx(windowWidth, logsOpen, widgetsOpen);
  const tabletNavYOffsetPx = tabletGraphToolsYOffsetPx(windowWidth, logsOpen, widgetsOpen);
  const mobilePanelOffsetPx = wantsSkew ? MOBILE_PANEL_X_OFFSET_PX : 0;
  const soloPanelOffsetPx = wantsSoloSkew ? SOLO_MOBILE_PANEL_EXTRA_X_OFFSET_PX : 0;
  const baseMinRadius = isSmallScreen ? GRAPH_MIN_RADIUS_MOBILE : GRAPH_MIN_RADIUS_DESKTOP;
  const maxRadiusLimit = useDesktopLayout ? GRAPH_MAX_RADIUS_DESKTOP : GRAPH_MAX_RADIUS_TOUCH;
  const personalizedSpriteTileWidth = useMemo(
    () =>
      resolvePersonalizedSpriteTileWidth({
        safeData,
        personalizedEntryId,
        sectionKey,
      }),
    [personalizedEntryId, safeData, sectionKey]
  );
  const personalizedZoomCap = resolvePersonalizedMaxZoomFraction({
    isRealMobile,
    isSmallScreen,
    isTabletLike,
    tileWidth: personalizedSpriteTileWidth,
  });
  const personalizedInitialZoomFraction = resolvePersonalizedInitialZoomFraction({
    isRealMobile,
    isSmallScreen,
    isTabletLike,
    tileWidth: personalizedSpriteTileWidth,
  });
  const orbitMinRadius =
    showPersonalized && personalizedEntryId
      ? minRadiusForZoomFraction({
          baseMinRadius,
          maxRadius: maxRadiusLimit,
          maxZoomFraction: personalizedZoomCap,
        })
      : baseMinRadius;

  // Compute dot positions before orbit controller so they can drive rotation sensitivity.
  const colorForAverage = useMemo(
    () => (avg: number) => rgbString(sampleStops(avg)),
    []
  );

  const dotPointOptions = useMemo<DotPointsOptions>(() => {
    return {
      spreadOverride: 220,
      minDistance: 2.1,
      seed: 1337,
      relaxPasses: 1,
      relaxStrength: 0.25,
      colorForAverage,
      personalizedEntryId,
      showPersonalized,
    };
  }, [colorForAverage, personalizedEntryId, showPersonalized]);

  const shapes = useDotPoints(safeData, dotPointOptions);
  const dotPositions = useMemo(() => shapes.map(s => s.position), [shapes]);

  const {
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    zoomTargetRef,
  } = useOrbitController({
    layout: {
      useDesktopLayout,
      isSmallScreen,
      isTabletLike,
      xOffset: 0,
      yOffset: 0,
      xOffsetPx: mobilePanelOffsetPx + soloPanelOffsetPx + graphNavOffsetPx,
      yOffsetPx: (wantsSkew ? 12 : 0) + tabletNavYOffsetPx,
    },
    bounds: { minRadius: orbitMinRadius, maxRadius: maxRadiusLimit },
    dataCount: safeData.length,
    dotPositions,
    initialZoomFraction:
      showPersonalized && personalizedEntryId
        ? personalizedInitialZoomFraction
        : undefined,
    zoomResetKey,
  });

  const bagSeed = DOTGRAPH_BAG_SEED;

  const particleFrames = isRealMobile ? 60 : 219;
  const desiredTileSize = chooseCameraSpriteTileSize({
    radius,
    minRadius,
    maxRadius,
    isRealMobile,
    isTabletLike,
  });
  const [tileSize, setTileSize] = useState(desiredTileSize);

  useEffect(() => {
    if (tileSize === desiredTileSize) return;
    if (zoomTargetRef.current != null) return;

    const timer = setTimeout(() => {
      bumpZoomMetric('tileSizeUpdates');
      setTileSize(desiredTileSize);
    }, TILE_SIZE_ZOOM_SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [desiredTileSize, tileSize, zoomTargetRef]);

  const prewarmLimit = isRealMobile ? 30 : shapes.length;

  const prewarmItems = useMemo(
    () =>
      shapes.slice(0, prewarmLimit).map((shape, i) => ({
        avg: Number.isFinite(shape.averageWeight) ? shape.averageWeight : 0.5,
        orderIndex: i,
        seed: bagSeed,
      })),
    [shapes, prewarmLimit, bagSeed]
  );

  useEffect(() => {
    if (!prewarmItems.length) return;
    prewarmSpriteTextures(prewarmItems, {
      tileSize,
      darkMode,
      particleFrames,
      particleStepMs: 33,
    });
  }, [prewarmItems, tileSize, darkMode, particleFrames]);

  const posById = useMemo(() => {
    const map = new Map<string, Vec3>();
    for (const shape of shapes) {
      if (shape._id) map.set(shape._id, shape.position);
    }
    return map;
  }, [shapes]);

  const spriteScale = useMemo(() => {
    const denom = Math.max(1e-6, maxRadius - minRadius);
    // Quantize to 32 steps so zoom re-renders happen at discrete thresholds
    // rather than every frame, preventing per-frame remount of ShapesLayer sprites
    const tRaw = Math.max(0, Math.min(1, (radius - minRadius) / denom));
    const t = Math.round(tRaw * 32) / 32;
    const SCALE_MIN = 8;
    const SCALE_MAX = 13.5;
    return nonlinearLerp(SCALE_MAX, SCALE_MIN, t);
  }, [radius, minRadius, maxRadius]);

  return {
    isSmallScreen,
    isRealMobile,
    isTabletLike,
    useDesktopLayout,
    groupRef,
    radius,
    isPinchingRef,
    isTouchRotatingRef,
    minRadius,
    maxRadius,
    zoomTargetRef,
    shapes,
    posById,
    spriteScale,
    bagSeed,
    particleFrames,
    tileSize,
  };
}
