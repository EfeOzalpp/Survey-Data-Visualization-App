// src/app-core/state/context/preferences-context.ts

import { createContext, useContext } from "react";

export interface PreferencesState {
  // Dark or light theme - persisted to sessionStorage, applied to document root via data-theme
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
};

export const PreferencesCtx = createContext<PreferencesState | null>(null);

export function usePreferences(): PreferencesState {
  const ctx = useContext(PreferencesCtx);
  if (!ctx) throw new Error("usePreferences must be used within AppProvider");
  return ctx;
}

export function useOptionalPreferences(): PreferencesState | null {
  return useContext(PreferencesCtx);
}
