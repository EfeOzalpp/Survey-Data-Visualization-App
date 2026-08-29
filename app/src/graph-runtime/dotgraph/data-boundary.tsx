import { Profiler, useEffect, useMemo, useState } from "react";

import { profilerOnRenderGraph } from "../../render-test/renderProfilerStatsGraph";
import { useIdentity } from "../../app-core/state/context/identity-context";
import { getSessionItem } from "../../app-core/session";
import { useShallow } from "zustand/react/shallow";
import { useSurveyDataStore } from "../../app-core/state/stores/survey-data-store";
import { useRealMobileViewport } from "../../lib/hooks/useRealMobileViewport";
import type { SurveyRow } from "../../domain/survey/types";
import { GraphDataProvider } from "../GraphDataContext";
import { PersonalizationScopeProvider } from "./personalizationScope";
import DotGraphCanvasHost from "./canvas-host";
import { resolvePersonalEntryId } from "./personal-entry";
import {
  allowPersonalInSection,
  deriveRoleFromSectionId,
} from "./scoping";
import {
  buildVisibleRowsSnapshot,
  graphDataLimit,
  includePersonalRow,
  type SlottedSurveyRow,
  type VisibleRowsSnapshot,
} from "./visible-rows";

function readPersonalSnapshot(entryId: string | null): SurveyRow | null {
  if (!entryId) return null;

  try {
    const raw = getSessionItem("be.myDoc");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as SurveyRow;
    return row._id === entryId ? row : null;
  } catch {
    return null;
  }
}

function useStableVisibleRows(
  rows: SurveyRow[],
  limit: number,
  scopeKey: string
): SlottedSurveyRow[] {
  const [snapshot, setSnapshot] = useState<VisibleRowsSnapshot>(() =>
    buildVisibleRowsSnapshot(rows, limit, scopeKey, null)
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshot((previous) => buildVisibleRowsSnapshot(rows, limit, scopeKey, previous));
  }, [limit, rows, scopeKey]);

  return snapshot.scopeKey === scopeKey && snapshot.capacity === limit
    ? snapshot.rows
    : buildVisibleRowsSnapshot(rows, limit, scopeKey, null).rows;
}

export default function DotGraphDataBoundary() {
  const { allFilteredRows, section } = useSurveyDataStore(
    useShallow((s) => ({ allFilteredRows: s.allFilteredRows, section: s.section }))
  );
  const { myEntryId, mySection } = useIdentity();
  const isRealMobile = useRealMobileViewport();
  const dataLimit = graphDataLimit(isRealMobile);
  const personalizedEntryId = resolvePersonalEntryId(myEntryId);
  const effectiveMySection = mySection ?? getSessionItem("be.mySection") ?? "";

  const personalRow = useMemo(() => {
    if (!personalizedEntryId) return null;
    return allFilteredRows.find((row) => row._id === personalizedEntryId)
      ?? readPersonalSnapshot(personalizedEntryId);
  }, [allFilteredRows, personalizedEntryId]);

  const shouldShowPersonalized = useMemo(() => {
    const role = deriveRoleFromSectionId(effectiveMySection);
    return allowPersonalInSection(role, effectiveMySection, section);
  }, [effectiveMySection, section]);

  const scopedPersonalRow = shouldShowPersonalized ? personalRow : null;

  const stableVisibleRows = useStableVisibleRows(allFilteredRows, dataLimit, section);
  const cappedData = useMemo(
    () => includePersonalRow(stableVisibleRows, dataLimit, scopedPersonalRow),
    [stableVisibleRows, dataLimit, scopedPersonalRow]
  );

  return (
    <PersonalizationScopeProvider
      personalizedEntryId={personalizedEntryId}
      shouldShowPersonalized={shouldShowPersonalized}
    >
      <GraphDataProvider data={cappedData}>
        <Profiler id="DotGraphCanvasHost" onRender={profilerOnRenderGraph}>
          <DotGraphCanvasHost />
        </Profiler>
      </GraphDataProvider>
    </PersonalizationScopeProvider>
  );
}
