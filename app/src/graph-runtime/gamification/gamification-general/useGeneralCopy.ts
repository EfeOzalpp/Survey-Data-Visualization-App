// src/graph-runtime/gamification/gamification-general/useGeneralCopy.ts

import { useMemo } from 'react';

import { useGeneralPools } from "../../../client-api/read-api/gamificationCopyPools";
import { GENERAL_FALLBACK_COPY } from "../../../client-api/mock-gamification-copy/fallbackCopy";

export function useGeneralCopy(dotId: string, safePct: number) {
  const { pick, loaded } = useGeneralPools();

  return useMemo(() => {
    if (!loaded || !dotId) return '';
    const chosen = pick(safePct, 'gd', dotId, GENERAL_FALLBACK_COPY);
    return chosen?.secondary ?? '';
  }, [dotId, safePct, pick, loaded]);
}
