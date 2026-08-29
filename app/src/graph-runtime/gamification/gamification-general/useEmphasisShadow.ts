// src/graph-runtime/gamification/gamification-general/useEmphasisShadow.ts
 
import { useMemo } from 'react';

import { useOptionalPreferences } from "../../../app-core/state/context/preferences-context";

export function useEmphasisShadow(color: string) {
  const darkMode = useOptionalPreferences()?.darkMode ?? false;

  return useMemo(
    () =>
      darkMode
        ? `0 0 10px color-mix(in srgb, ${color} 52%, var(--gam-glow-dark-base)), 0 0 18px color-mix(in srgb, ${color} 32%, var(--gam-glow-dark-base))`
        : `0 0 8px color-mix(in srgb, ${color} 30%, var(--gam-glow-light-base)), 0 0 14px color-mix(in srgb, ${color} 16%, var(--gam-glow-light-base))`,
    [color, darkMode]
  );
}
