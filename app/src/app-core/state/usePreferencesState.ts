// src/app-core/state/usePreferencesState.ts
// Theme preference is app state; sprite invalidation is hidden behind the sprite API.
//
// STATE AUDIT (2026-08-21):
// Not independently called elsewhere — private to app-provider.tsx, same
// relationship as useIdentityState.ts has to identity-context.ts. Owns the
// raw useState + sessionStorage + document-theme-application + sprite-
// invalidation side effect that preferences-context.ts's `preferencesValue`
// is built from. See the audit note in preferences-context.ts for call
// sites / wrapping / re-render scope of the public surface.

import { startTransition, useEffect, useRef, useState } from 'react';

import {
  applyThemeToDocument,
  readStoredDarkMode,
  setSessionItem,
} from '../session';
export default function usePreferencesState() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  useEffect(() => {
    startTransition(() => {
      setDarkMode(readStoredDarkMode(false));
    });
  }, []);
  const didInitThemeRef = useRef(false);
  useEffect(() => {
    setSessionItem('be.darkMode', String(darkMode));
    applyThemeToDocument(darkMode);

    if (!didInitThemeRef.current) {
      didInitThemeRef.current = true;
      return;
    }

    void import('../../graph-runtime/sprites/theme').then(({ invalidateSpriteTexturesForThemeChange }) => {
      try {
        invalidateSpriteTexturesForThemeChange();
      } catch (err) {
        console.warn('[usePreferencesState] sprite texture invalidation failed:', err);
      }
    });
  }, [darkMode]);

  return {
    darkMode,
    setDarkMode,
  };
}
