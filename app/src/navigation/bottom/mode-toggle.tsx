// src/navigation/bottom/mode-toggle.tsx

import React, { useMemo } from "react";

import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app-core/state/stores/ui-store";
import type { Mode } from "../../app-core/state/stores/ui-store";
import { useSurveyDataStore } from "../../app-core/state/stores/survey-data-store";
import { useIdentity } from "../../app-core/state/context/identity-context";
import { avgWeightOf } from "../../lib/utils/score";
import { useAbsoluteScore } from "../../lib/hooks/useAbsoluteScore";
import CheckIcon from "../../assets/svg/check/CheckIcon";
import { recordOwnRender } from "../../render-test/renderProfilerStats";

function ToggleCheckIcon() {
  return (
    <span className="mode-toggle-check">
      <CheckIcon className="switch-check-icon svg-sm" />
    </span>
  );
}

function ModeToggle() {
  recordOwnRender("ModeToggle");
  const { mode, setMode, observerMode, setOpenPersonalized, setSpotlightRequest, personalPanelOpen } = useUiStore(
    useShallow((s) => ({
      mode: s.mode,
      setMode: s.setMode,
      observerMode: s.observerMode,
      setOpenPersonalized: s.setOpenPersonalized,
      setSpotlightRequest: s.setSpotlightRequest,
      personalPanelOpen: s.personalPanelOpen,
    }))
  );
  const data = useSurveyDataStore((s) => s.allFilteredRows);
  const { myEntryId } = useIdentity();

  const poolValues = useMemo(
    () => (Array.isArray(data) ? data.map(avgWeightOf) : []),
    [data]
  );
  const myIndex = useMemo(
    () => (myEntryId ? data.findIndex(d => d._id === myEntryId) : -1),
    [data, myEntryId]
  );
  const myRow = myIndex >= 0 ? data[myIndex] : undefined;
  const myValue = myRow ? avgWeightOf(myRow) : undefined;

  const relFeedback = useMemo(() => {
    if (!poolValues.length || typeof myValue !== "number" || !Number.isFinite(myValue)) return "Rankings";
    const currentValue = myValue;
    const pool = poolValues.length - 1;
    const countBelow = poolValues.reduce(
      (acc, v, i) => (i === myIndex ? acc : acc + (v < currentValue ? 1 : 0)),
      0
    );
    return `Ahead of ${String(countBelow)} of ${String(Math.max(0, pool))}`;
  }, [poolValues, myIndex, myValue]);

  const { getForId: getAbsForId } = useAbsoluteScore(data, { decimals: 0 });
  const absFeedback = useMemo(() => {
    if (myIndex < 0) return "Scores";
    const score = getAbsForId(myEntryId ?? undefined);
    return `Score: ${String(score)}/100`;
  }, [getAbsForId, myEntryId, myIndex]);

  const isAbsolute = mode === "absolute";
  const nextMode: Mode = isAbsolute ? "relative" : "absolute";
  const canPersonalize = !observerMode && myIndex >= 0;

  const flipModeAndMaybeSpotlight = (next: Mode) => {
    setMode(next);

    if (!observerMode) {
      if (canPersonalize) {
        if (personalPanelOpen) {
          setOpenPersonalized(true);
        } else {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setSpotlightRequest({
                durationMs: 3000,
                fakeMouseXRatio: 0.25,
                fakeMouseYRatio: 0.5,
              });
            });
          });
        }
      }
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpotlightRequest({
          durationMs: 3000,
          fakeMouseXRatio: 0.25,
          fakeMouseYRatio: 0.5,
        });
      });
    });
  };

  return (
    <div className="mode-toggle-wrap">
      <div
        role="radiogroup"
        aria-label="Visualization mode"
        className={`mode-toggle-switch${observerMode ? " is-observing" : ""}`}
      >
        <button
          role="radio"
          aria-checked={!isAbsolute}
          className={`mode-toggle-label${!isAbsolute ? " active" : ""}`}
          onClick={() => { flipModeAndMaybeSpotlight(nextMode); }}
          title={!isAbsolute ? relFeedback : "Switch to Rankings"}
          tabIndex={0}
        >
          {!isAbsolute && <ToggleCheckIcon />}
          team
        </button>
        <button
          role="radio"
          aria-checked={isAbsolute}
          className={`mode-toggle-label${isAbsolute ? " active" : ""}`}
          onClick={() => { flipModeAndMaybeSpotlight(nextMode); }}
          title={isAbsolute ? absFeedback : "Switch to Scores"}
          tabIndex={0}
        >
          {isAbsolute && <ToggleCheckIcon />}
          solo
        </button>
      </div>
    </div>
  );
}

export default React.memo(ModeToggle);
