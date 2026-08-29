// src/graph-runtime/dotgraph/personalizationScopeContextObject.ts
import { createContext } from 'react';

export interface PersonalizationScopeValue {
  personalizedEntryId: string | null;
  shouldShowPersonalized: boolean;
}

export const PersonalizationScopeContext = createContext<PersonalizationScopeValue | null>(null);
