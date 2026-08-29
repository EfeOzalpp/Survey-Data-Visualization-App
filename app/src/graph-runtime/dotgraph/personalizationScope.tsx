// src/graph-runtime/dotgraph/personalizationScope.tsx
import { useMemo, type ReactNode } from 'react';

import { PersonalizationScopeContext, type PersonalizationScopeValue } from './personalizationScopeContextObject';

export function PersonalizationScopeProvider({
  personalizedEntryId,
  shouldShowPersonalized,
  children,
}: PersonalizationScopeValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ personalizedEntryId, shouldShowPersonalized }),
    [personalizedEntryId, shouldShowPersonalized]
  );

  return (
    <PersonalizationScopeContext.Provider value={value}>
      {children}
    </PersonalizationScopeContext.Provider>
  );
}
