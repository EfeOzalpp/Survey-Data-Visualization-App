// src/client-api/mock-gamification-copy/fallbackCopy.ts
// Stand-in copy for the "general" gamification pool, shown whenever the live
// CMS data isn't available - not just VITE_USE_MOCK_DATA dev mode, but also
// the production fallback path in gamificationCopyPools.ts's
// shouldFallbackToMock (real fetch failures: 403/429/5xx).

import type { FallbackBucket } from '../read-api/gamificationCopyPools';

export const GENERAL_FALLBACK_COPY: Record<string, FallbackBucket> = {
  '0-20': {
    titles: ['The warmest years in history? Almost all in the past decade.'],
    secondary: ['Hope grows when we do.'],
  },
  '21-40': {
    titles: ['Below Average', 'Getting Started'],
    secondary: ['Most carbon still comes from how we move and what we power.'],
  },
  '41-60': {
    titles: ['Reuse is just creativity in disguise.'],
    secondary: ['Little acts, lasting impact.'],
  },
  '61-80': {
    titles: ['Above Average', 'Solid Standing'],
    secondary: ['Cool the planet, warm the heart.'],
  },
  '81-100': {
    titles: ['No one\'s too small to make an impact.'],
    secondary: ['Among the strongest here.'],
  },
};
