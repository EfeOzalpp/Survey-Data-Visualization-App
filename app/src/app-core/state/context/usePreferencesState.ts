// src/app-core/state/context/usePreferencesState.ts
// Theme preference is app state; sprite invalidation is hidden behind the sprite API.

import { startTransition, useEffect, useRef, useState } from 'react';

import {
  applyThemeToDocument,
  readStoredDarkMode,
  setSessionItem,
} from '../../session';
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

    void import('../../../graph-runtime/sprites/theme').then(({ invalidateSpriteTexturesForThemeChange }) => {
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
