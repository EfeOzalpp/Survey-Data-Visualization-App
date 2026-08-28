// src/graph-runtime/dotgraph/scene/usePersonalizationGate.ts

import { useMemo, useState } from 'react';

import { getSessionItem } from '../../../app-core/session';
import useViewerScope from '../scope/useViewerScope';
import { resolvePersonalEntryId } from '../personal-entry';
import type { DotGraphEntry } from '../types';

interface UsePersonalizationGateParams {
  myEntryId: string | null;
  mySection: string | null;
  section: string;
  safeData: DotGraphEntry[];
  observerMode: boolean;
  isSmallScreen: boolean;
}

function hasStoredPersonalSnapshot(entryId: string | null): boolean {
  if (!entryId) return false;

  try {
    const raw = getSessionItem('be.myDoc');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { _id?: unknown };
    return parsed._id === entryId;
  } catch {
    return false;
  }
}

export default function usePersonalizationGate({
  myEntryId,
  mySection,
  section,
  safeData,
  observerMode,
  isSmallScreen,
}: UsePersonalizationGateParams) {
  const personalizedEntryId: string | null = resolvePersonalEntryId(myEntryId);

  const [personalOpen, setPersonalOpen] = useState(true);

  const hasPersonalizedInDataset = useMemo(
    () => !!personalizedEntryId && safeData.some((entry) => entry._id === personalizedEntryId),
    [personalizedEntryId, safeData]
  );
  const hasPersonalizedSnapshot = useMemo(
    () => hasStoredPersonalSnapshot(personalizedEntryId),
    [personalizedEntryId]
  );

  const { shouldShowPersonalized } = useViewerScope({
    mySection,
    section,
  });

  const wantsSkew =
    isSmallScreen &&
    !observerMode &&
    (hasPersonalizedInDataset || hasPersonalizedSnapshot) &&
    personalOpen &&
    shouldShowPersonalized;

  return {
    personalizedEntryId,
    personalOpen,
    setPersonalOpen,
    hasPersonalizedInDataset,
    shouldShowPersonalized,
    wantsSkew,
  };
}
