import { memo, type Ref } from "react";
import HintBanner from "../../../app-core/ui-generics/HintBanner";
import EmptyStateArt from "./emptyArt";
import { ORDERED_COLORS, ordinalSuffix, percentileBoundsForColor, type BarColor, type Categories } from "./lib/useBarGraph";
import styles from "./bg.module.css";

const percentValue = (value: number) => `${value.toFixed(4)}%`;

interface BarGraphBodyProps {
  navOutsidePanel?: boolean;
  panelClassName?: string;
  ready: boolean;
  loading: boolean;
  noData: boolean;
  categories: Categories;
  totalCount: number;
  hoveredBarColor: BarColor | null;
  setHoveredBarColor: (color: BarColor | null) => void;
  barsRef: Ref<HTMLDivElement>;
  animationState: boolean;
  animateBars: boolean;
  canShowYou: boolean;
  rankMarker: { color: BarColor; fraction: number } | null;
  youAbsoluteBar: BarColor | null;
  youRank: number | null;
  youPercentile: number;
  sectionLabel: string;
}

// The lazy-loaded piece (see bargraph/lib/useBarGraph.tsx for why the hook
// itself stays eager) - just rendering, no state of its own. `ready` mirrors
// the original "no section selected yet" guard; when false this renders on
// its own with no panel wrapper, matching the original component's early
// return exactly (consumers should also skip WidgetsHeader in that case).
function BarGraphBody({
  navOutsidePanel = false,
  panelClassName,
  ready,
  loading,
  noData,
  categories,
  totalCount,
  hoveredBarColor,
  setHoveredBarColor,
  barsRef,
  animationState,
  animateBars,
  canShowYou,
  rankMarker,
  youAbsoluteBar,
  youRank,
  youPercentile,
  sectionLabel,
}: BarGraphBodyProps) {
  if (!ready) return <p className={styles.loading}>Pick a section to begin.</p>;

  const panelClasses = [styles.panel, panelClassName].filter(Boolean).join(" ");

  if (loading) {
    const loadingBody = (
      <div className={styles.container} aria-hidden="true">
        {ORDERED_COLORS.map((color, index) => (
          <div className={styles.bar} key={color}>
            <span className={styles.label}>
              <p>-</p>
            </span>
            <div className={styles.divider}>
              <div
                className={`${styles.fill} ${styles.fillPlaceholder}`}
                style={{ height: `${String([62, 42, 24][index])}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );

    if (navOutsidePanel) return <div className={panelClasses}>{loadingBody}</div>;
    return loadingBody;
  }

  if (noData) {
    const emptyBody = (
      <div className={`${styles.container} ${styles.empty}`}>
        <div className={styles.emptyCard}>
          <EmptyStateArt className={styles.floaty} />
          <h4>Nothing yet...</h4>
        </div>
      </div>
    );

    if (navOutsidePanel) return <div className={panelClasses}>{emptyBody}</div>;
    return emptyBody;
  }

  const graphBody = (
    <>
      <div className={styles.container} ref={barsRef}>
        {ORDERED_COLORS.map((color) => {
          const count = categories[color];
          const heightPercentage = count > 0 ? (count / totalCount) * 100 : 0;
          const countLabel = count === 0 ? "-" : count === 1 ? "1 Person" : `${String(count)} People`;
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
              className={styles.bar}
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
              <div className={styles.labelWrap}>
                <span className={styles.label}>
                  <p>{countLabel}</p>
                </span>
                <div className={styles.tip}>
                  <HintBanner
                    visible={hoveredBarColor === color}
                    className={styles.hint}
                    copyClassName={styles.hintCopy}
                  >
                    {percentileLabel}
                  </HintBanner>
                </div>
              </div>

              <div className={styles.divider}>

                {showMarkerInThisBar && animationState && animateBars && (
                  <div
                    className={styles.percentageSection}
                    style={{ height: percentValue(Math.min(markerHeightPercentage, heightPercentage)) }}
                  >
                    <div className={styles.percentageLine} aria-hidden="true" />
                    <div className={styles.percentageIndicator}>
                      <p className={styles.percentageTitle}>You're</p>
                      <p className={styles.percentageScore}>
                        {youRank === totalCount ? "Last" : ordinalSuffix(youRank ?? 1)}
                      </p>
                    </div>
                  </div>
                )}

                {count > 0 && (
                  <div
                    className={`${styles.fill} ${styles[`${color}Animation`]}`}
                    style={{ height: animateBars ? percentValue(heightPercentage) : "0%" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canShowYou && (
        <h4 className={`${styles.caption}${animationState && animateBars ? "" : ` ${styles.hidden}`}`}>
          Among <strong>{sectionLabel}</strong>, you are the {ordinalSuffix(youPercentile)} percentile.
        </h4>
      )}
    </>
  );

  if (navOutsidePanel) return <div className={panelClasses}>{graphBody}</div>;
  return graphBody;
}

export default memo(BarGraphBody);
