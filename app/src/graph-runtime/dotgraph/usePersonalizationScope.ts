// src/graph-runtime/dotgraph/usePersonalizationScope.ts
import { useContext } from 'react';

import { PersonalizationScopeContext, type PersonalizationScopeValue } from './personalizationScopeContextObject';

export function usePersonalizationScope(): PersonalizationScopeValue {
  const ctx = useContext(PersonalizationScopeContext);
  if (!ctx) throw new Error('usePersonalizationScope must be used within PersonalizationScopeProvider');
  return ctx;
}
