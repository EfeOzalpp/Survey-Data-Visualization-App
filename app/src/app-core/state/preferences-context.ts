import { createContext, useContext } from "react";

// STATE AUDIT (2026-08-21):
// - CALL SITES: 10 source files across 4 top-level folders — graph-runtime/
//   (gamification-personal, gamification-general, dotgraph root),
//   scene-canvas/ (hooks/useSceneField — reaches into the canvas engine
//   internals directly, for sprite/theme invalidation), onboarding/
//   (onboarding-info, canvas-gui/workspace, canvas-gui/top-tools/assets),
//   navigation/ (root, right/theme-toggle, right/system-color).

// - WRAPPING: YES, same as identity-context — app-provider.tsx wraps the
//   entire AppInner tree (main.tsx) in <PreferencesCtx.Provider>, one level
//   OUTSIDE <IdentityCtx.Provider>. Whole-app scope.

// - RE-RENDER SCOPE: technically bundled (`preferencesValue` is one memoized
//   `{darkMode, setDarkMode}` object), but moot in practice — it's a single
//   field, so "bundled vs per-field" makes no observable difference here.
//   Structurally identical shape to identity-context, but no urgency to
//   migrate this one specifically for that reason: there's only one value
//   to desync from, so bundling never costs anything downstream.

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
