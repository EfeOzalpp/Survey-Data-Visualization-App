// src/app-core/app-provider.tsx
// Creates the app-wide state providers and handles cross-slice reset/bootstrap.

import React, { useCallback, useEffect, useMemo } from "react";

import { getSessionItem, removeSessionItems } from "./session";

import useIdentityState from "./state/context/useIdentityState";
import usePreferencesState from "./state/context/usePreferencesState";

import { resetCanvasRuntimeState, useBootstrapLiveAvgFromSession } from "./state/stores/canvas-runtime-store";
import { useUiStore, useBootstrapModeFromSession, useSyncResetToStart } from "./state/stores/ui-store";
import { useSurveyDataStore, useSyncMySectionForSurveyData } from "./state/stores/survey-data-store";
import { IdentityCtx } from "./state/context/identity-context";
import type { IdentityState } from "./state/context/identity-context";
import { PreferencesCtx } from "./state/context/preferences-context";
import type { PreferencesState } from "./state/context/preferences-context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const { mySection, setMySection, myEntryId, setMyEntryId, myRole, setMyRole } = useIdentityState();
  const { darkMode, setDarkMode } = usePreferencesState();
  useBootstrapLiveAvgFromSession();
  useBootstrapModeFromSession();
  useSyncMySectionForSurveyData(mySection);

  // The realtime survey-response subscription (SSE) starts once at the app boundary and writes into the survey-data store.
  // Mobile browsers can silently kill/freeze the underlying EventSource while the tab is
  // backgrounded (phone locked) without it cleanly self-reconnecting on resume, so force a
  // fresh subscription when the page returns to the foreground after a real backgrounding.
  useEffect(() => {
    let unsub = useSurveyDataStore.getState().subscribeToSurveyData();
    let hiddenAt: number | null = null;
    const RECONNECT_AFTER_HIDDEN_MS = 10000;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const wasHiddenLongEnough = hiddenAt !== null && Date.now() - hiddenAt > RECONNECT_AFTER_HIDDEN_MS;
      hiddenAt = null;
      if (!wasHiddenLongEnough) return;
      unsub();
      unsub = useSurveyDataStore.getState().subscribeToSurveyData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsub();
    };
  }, []);

  const resetToStart = useCallback(() => {
    const savedEntryId = getSessionItem("be.myEntryId");
    const savedSection = getSessionItem("be.mySection");
    const savedRole = getSessionItem("be.myRole");

    const ui = useUiStore.getState();
    ui.setVizVisible(false);
    ui.setSurveyActive(false);
    ui.setHasCompletedSurvey(false);
    ui.setObserverMode(false);
    setMyEntryId(savedEntryId);
    setMySection(savedSection);
    setMyRole(savedRole);
    useSurveyDataStore.getState().setSection(savedSection ?? "all");
    ui.setQuestionnaireOpen(false);
    ui.setSectionOpen(false);
    ui.setCityPanelOpen(false);
    ui.setLogsOpen(false);
    ui.setWidgetsOpen(false);
    ui.setAnimationVisible(false);
    ui.setOpenPersonalized(false);
    ui.setSpotlightRequest(null);
    resetCanvasRuntimeState();
    ui.incrementSurveyResetKey();

    removeSessionItems([
      "be.justSubmitted",
      "be.openPersonalOnNext",
    ]);
  }, [
    setMyEntryId,
    setMyRole,
    setMySection,
  ]);

  useSyncResetToStart(resetToStart);

  const preferencesValue = useMemo<PreferencesState>(
    () => ({ darkMode, setDarkMode }),
    [darkMode, setDarkMode]
  );

  const identityValue = useMemo<IdentityState>(
    () => ({ mySection, setMySection, myEntryId, setMyEntryId, myRole, setMyRole }),
    [mySection, setMySection, myEntryId, setMyEntryId, myRole, setMyRole]
  );

  return (
    <PreferencesCtx.Provider value={preferencesValue}>
      <IdentityCtx.Provider value={identityValue}>
        {children}
      </IdentityCtx.Provider>
    </PreferencesCtx.Provider>
  );
};
