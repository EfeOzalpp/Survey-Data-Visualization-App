// -------------------------------------------------------------
// -------------------------------------------------------------

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreferences } from "../../../app/state/preferences-context";
import { recordOwnRender } from "../../../render-test/renderProfilerStats";
import { useUiStore } from "../../../app/state/ui-store";
import { useIdentity } from "../../../app/state/identity-context";
import { useShallow } from "zustand/react/shallow";
import { useSurveyDataStore } from "../../../app/state/survey-data-store";
import { useRelativeScores } from "../../../lib/hooks/useRelativeScore";
import { avgWeightOf } from "../../../lib/utils/score";
import { CHOOSE_STAFF, CHOOSE_STUDENT, GO_BACK, useGraphPickerData, titleFromId } from "../../graph-picker/gp-data";
import WidgetSectionNav from "../widget-section-nav";
import HintBanner from "../../../app/ui/HintBanner";

import EmptyStateArt from "./EmptyArt";

function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${String(n)}th`;
  switch (Math.abs(n) % 10) {
    case 1: return `${String(n)}st`;
    case 2: return `${String(n)}nd`;
    case 3: return `${String(n)}rd`;
    default: return `${String(n)}th`;
  }
}

type BarColor = 'red' | 'yellow' | 'green';

type Categories = Record<BarColor, number>;

interface BarGraphProps {
  navOutsidePanel?: boolean;
  panelClassName?: string;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
}

const orderedColors: BarColor[] = ['green', 'yellow', 'red'];

const percentValue = (value: number) => `${value.toFixed(4)}%`;
const AUTOPLAY_MS = 5000;

function colorForScore(score: number): BarColor {
  if (score <= 50) return 'red';
  if (score <= 66) return 'yellow';
  return 'green';
}

function markerFractionInBucket(rank: number, categories: Categories) {
  const greenEnd = categories.green;
  const yellowEnd = greenEnd + categories.yellow;

  if (rank <= greenEnd) {
    const count = Math.max(1, categories.green);
    return {
      color: 'green' as const,
      fraction: Math.max(0, Math.min(1, (greenEnd - rank + 0.5) / count)),
    };
  }

  if (rank <= yellowEnd) {
    const count = Math.max(1, categories.yellow);
    return {
      color: 'yellow' as const,
      fraction: Math.max(0, Math.min(1, (yellowEnd - rank + 0.5) / count)),
    };
  }

  const count = Math.max(1, categories.red);
  const totalEnd = yellowEnd + categories.red;
  return {
    color: 'red' as const,
    fraction: Math.max(0, Math.min(1, (totalEnd - rank + 0.5) / count)),
  };
}

// Red is the bottom of the score range, green the top, so cumulative counts
// translate directly into each bucket's percentile band.
function percentileBoundsForColor(color: BarColor, categories: Categories, total: number): [number, number] {
  if (total <= 0) return [0, 0];
  const redEnd = (categories.red / total) * 100;
  const yellowEnd = redEnd + (categories.yellow / total) * 100;
  switch (color) {
    case 'red': return [0, redEnd];
    case 'yellow': return [redEnd, yellowEnd];
    case 'green': return [yellowEnd, 100];
  }
}

function BarGraph({
  navOutsidePanel = false,
  panelClassName,
  paused,
  onPausedChange,
}: BarGraphProps = {}) {
  recordOwnRender("BarGraph");
  const { darkMode } = usePreferences();
  const hasCompletedSurvey = useUiStore((s) => s.hasCompletedSurvey);
  const { myEntryId } = useIdentity();
  const { allRows, loading, section, sectionSelectionVersion } = useSurveyDataStore(
    useShallow((s) => ({
      allRows: s.allRows,
      loading: s.loading,
      section: s.section,
      sectionSelectionVersion: s.sectionSelectionVersion,
    }))
  );

  const { ALL_LABELS, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS, counts } = useGraphPickerData(section);

  const [animationState, setAnimationState] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);
  const [internalPaused, setInternalPaused] = useState(true);
  const [hoveredBarColor, setHoveredBarColor] = useState<BarColor | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (barsRef.current && !barsRef.current.contains(e.target as Node)) {
        setHoveredBarColor(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => { document.removeEventListener("pointerdown", handler); };
  }, []);
  const [localSectionState, setLocalSectionState] = useState({
    sourceSection: section,
    sourceSelectionVersion: sectionSelectionVersion,
    value: section,
  });

  const localSection =
    localSectionState.sourceSection === section &&
    localSectionState.sourceSelectionVersion === sectionSelectionVersion
      ? localSectionState.value
      : section;

  const effectivePaused = paused ?? internalPaused;

  const setEffectivePaused = useCallback((nextPaused: boolean) => {
    if (paused === undefined) setInternalPaused(nextPaused);
    onPausedChange?.(nextPaused);
  }, [onPausedChange, paused]);

  const setLocalSection = useCallback((value: string) => {
    setLocalSectionState({ sourceSection: section, sourceSelectionVersion: sectionSelectionVersion, value });
  }, [section, sectionSelectionVersion]);

  const cycleSections = useMemo(() => {
    const ordered = [...MAIN_OPTS, ...STUDENT_OPTS, ...STAFF_OPTS]
      .filter((opt) => opt.id !== GO_BACK && opt.id !== CHOOSE_STUDENT && opt.id !== CHOOSE_STAFF)
      .filter((opt, index, arr) => arr.findIndex((item) => item.id === opt.id) === index)
      .filter((opt) => (counts[opt.id] ?? 0) > 0 || opt.id === localSection);

    if (!ordered.length && localSection) {
      return [{ id: localSection, label: ALL_LABELS.get(localSection) ?? titleFromId(localSection) }];
    }

    return ordered;
  }, [ALL_LABELS, MAIN_OPTS, STAFF_OPTS, STUDENT_OPTS, counts, localSection]);

  const safeData = useMemo(() => {
    if (!localSection || localSection === "all") return allRows;
    if (localSection === "all-massart") {
      const allowed = new Set([...STUDENT_OPTS.map((opt) => opt.id), ...STAFF_OPTS.map((opt) => opt.id)]);
      return allRows.filter((row) => allowed.has(row.section));
    }
    if (localSection === "all-students") {
      const allowed = new Set(STUDENT_OPTS.map((opt) => opt.id));
      return allRows.filter((row) => allowed.has(row.section));
    }
    if (localSection === "all-staff") {
      const allowed = new Set(STAFF_OPTS.map((opt) => opt.id));
      return allRows.filter((row) => allowed.has(row.section));
    }
    return allRows.filter((row) => row.section === localSection);
  }, [STUDENT_OPTS, STAFF_OPTS, allRows, localSection]);

  const dataById = useMemo(() => {
    const map = new Map<string, (typeof safeData)[number]>();
    for (const item of safeData) {
      if (item._id) map.set(item._id, item);
    }
    return map;
  }, [safeData]);

  const { getForId: getRelForId, getCountForId: getBelowCountForId } = useRelativeScores(safeData);

  const includesMe = useMemo(
    () => Boolean(myEntryId && dataById.has(myEntryId)),
    [dataById, myEntryId]
  );

  const canShowYou = Boolean(hasCompletedSurvey && myEntryId && includesMe);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        setAnimateBars(!loading);
      },
      loading ? 0 : 10
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loading, safeData]);

  const categories: Categories = useMemo(() => {
    const out: Categories = { red: 0, yellow: 0, green: 0 };
    for (const item of safeData) {
      const score = Math.floor(avgWeightOf(item) * 100);
      if (score <= 50) out.red += 1;
      else if (score <= 66) out.yellow += 1;
      else out.green += 1;
    }
    return out;
  }, [safeData]);

  const totalCount = safeData.length;

  const currentIndex = cycleSections.findIndex((item) => item.id === localSection);
  const matchedSection = cycleSections.find((item) => item.id === localSection);
  const sectionLabel =
    matchedSection?.label ??
    ALL_LABELS.get(localSection) ??
    (localSection ? titleFromId(localSection) : "Everyone");

  const stepSection = (delta: number) => {
    if (!cycleSections.length) return;
    const nextIndex = currentIndex >= 0
      ? (currentIndex + delta + cycleSections.length) % cycleSections.length
      : 0;
    setLocalSection(cycleSections[nextIndex].id);
  };

  useEffect(() => {
    if (effectivePaused || cycleSections.length <= 1) return;
    const timer = window.setInterval(() => {
      const activeIndex = cycleSections.findIndex((item) => item.id === localSection);
      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % cycleSections.length : 0;
      setLocalSection(cycleSections[nextIndex].id);
    }, AUTOPLAY_MS);
    return () => { window.clearInterval(timer); };
  }, [cycleSections, effectivePaused, localSection, setLocalSection]);

  const rawYouPercentile = useMemo(() => (canShowYou && myEntryId ? getRelForId(myEntryId) : 0), [
    canShowYou,
    getRelForId,
    myEntryId,
  ]);

  // If you're the only respondent, show 100% instead of 0%
  const youPercentile = useMemo(
    () => (canShowYou && totalCount === 1 ? 100 : rawYouPercentile),
    [canShowYou, totalCount, rawYouPercentile]
  );

  const youRank = useMemo(() => {
    if (!canShowYou || totalCount === 0) return null;
    if (totalCount === 1) return 1;
    const below = myEntryId ? getBelowCountForId(myEntryId) : 0;
    return Math.max(1, Math.min(totalCount, totalCount - below));
  }, [canShowYou, getBelowCountForId, myEntryId, totalCount]);

  const youAbsoluteBar: BarColor | null = useMemo(() => {
    if (!canShowYou) return null;
    const me = myEntryId ? dataById.get(myEntryId) : null;
    const score = me ? Math.floor(avgWeightOf(me) * 100) : 0;
    return colorForScore(score);
  }, [canShowYou, dataById, myEntryId]);

  const rankMarker = useMemo(
    () => (youRank === null ? null : markerFractionInBucket(youRank, categories)),
    [categories, youRank]
  );

  useEffect(() => {
    if (animationState) return;
    const timeout = window.setTimeout(() => {
      setAnimationState(true);
    }, 200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [animationState]);

  if (!section) return <p className="graph-loading">Pick a section to begin.</p>;

  const sectionNav = (
    <WidgetSectionNav
      title={sectionLabel}
      paused={effectivePaused}
      className="bar-graph-nav"
      onPrevious={() => { stepSection(-1); }}
      onNext={() => { stepSection(1); }}
      onTogglePaused={() => { setEffectivePaused(!effectivePaused); }}
    />
  );

  if (loading) {
    const loadingBody = (
      <div className="bar-graph-container bar-graph-placeholder" aria-hidden="true">
        {orderedColors.map((color, index) => (
          <div className="bar-graph-bar" key={color}>
            <span className="bar-graph-label">
              <p>-</p>
            </span>
            <div className="bar-graph-divider">
              <div
                className="bar-graph-fill bar-graph-fill-placeholder"
                style={{ height: `${String([62, 42, 24][index])}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );

    if (navOutsidePanel) {
      return (
        <>
          {sectionNav}
          <div className={panelClassName}>
            {loadingBody}
          </div>
        </>
      );
    }

    return (
      <>
        {sectionNav}
        {loadingBody}
      </>
    );
  }

  const noData = safeData.length === 0;
  if (noData) {
    const emptyBody = (
      <div className="empty-center bar-graph-empty">
        <div className={`empty-card ${darkMode ? 'is-dark' : 'is-light'}`}>
          <EmptyStateArt className="empty-icon floaty" />
          <h4>Nothing yet...</h4>
        </div>
      </div>
    );

    if (navOutsidePanel) {
      return (
        <>
          {sectionNav}
          <div className={panelClassName}>
            {emptyBody}
          </div>
        </>
      );
    }

    return (
      <>
        {sectionNav}
        {emptyBody}
      </>
    );
  }

  const graphBody = (
    <>
      <div className="bar-graph-container" ref={barsRef}>
        {orderedColors.map((color) => {
          const count = categories[color];
          const heightPercentage = count > 0 ? (count / totalCount) * 100 : 0;
          const countLabel = count === 0 ? '-' : count === 1 ? '1 Person' : `${String(count)} People`;
          const [pctFrom, pctTo] = percentileBoundsForColor(color, categories, totalCount);
          const percentileLabel = `${ordinalSuffix(Math.round(pctFrom))}–${ordinalSuffix(Math.round(pctTo))} percentile`;

          const markerHeightPercentage =
            rankMarker?.color === color
              ? heightPercentage * rankMarker.fraction
              : 0;
          const showMarkerInThisBar =
            canShowYou &&
            (rankMarker?.color ?? youAbsoluteBar) === color &&
            markerHeightPercentage > 0;

          return (
            <div
              className="bar-graph-bar"
              key={color}
              role="button"
              tabIndex={0}
              aria-label={countLabel}
              aria-pressed={hoveredBarColor === color}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") setHoveredBarColor(color);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "touch") setHoveredBarColor(null);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (e.pointerType === "touch") setHoveredBarColor(color);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredBarColor(color);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                setHoveredBarColor(color);
              }}
            >
              <div className="bar-graph-label-wrap">
                <span className="bar-graph-label">
                  <p>{countLabel}</p>
                </span>
                <div className="bar-graph-tip">
                  <HintBanner
                    visible={hoveredBarColor === color}
                    className="bar-graph-hint"
                    copyClassName="bar-graph-hint-copy"
                  >
                    {percentileLabel}
                  </HintBanner>
                </div>
              </div>

              <div className="bar-graph-divider">

                {showMarkerInThisBar && animationState && animateBars && (
                  <div
                    className="percentage-section"
                    style={{ height: percentValue(Math.min(markerHeightPercentage, heightPercentage)) }}
                  >
                    <div className="percentage-line" aria-hidden="true" />
                    <div className="percentage-indicator">
                      <p className="percentage-indicator-title">You're</p>
                      <p className="percentage-indicator-score">
                        {youRank === totalCount ? 'Last' : ordinalSuffix(youRank ?? 1)}
                      </p>
                    </div>
                  </div>
                )}

                {count > 0 && (
                  <div
                    className={`bar-graph-fill ${color}-animation`}
                    style={{ height: animateBars ? percentValue(heightPercentage) : '0%' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canShowYou && (
        <h4 className={`bar-graph-percentile-caption${animationState && animateBars ? '' : ' caption-invisible'}`}>
          Among <strong>{sectionLabel}</strong>, you are the {ordinalSuffix(youPercentile)} percentile.
        </h4>
      )}
    </>
  );

  if (navOutsidePanel) {
    return (
      <>
        {sectionNav}
        <div className={panelClassName}>
          {graphBody}
        </div>
      </>
    );
  }

  return (
    <>
      {sectionNav}
      {graphBody}
    </>
  );
}

export default memo(BarGraph);
