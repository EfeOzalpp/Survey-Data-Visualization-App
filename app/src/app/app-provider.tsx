// src/app/app-provider.tsx
// Creates the app-wide state providers and handles cross-slice reset/bootstrap.

import React, { useCallback, useEffect, useMemo } from "react";

import { getSessionItem, removeSessionItems } from "./session";

import useIdentityState from "./state/useIdentityState";
import usePreferencesState from "./state/usePreferencesState";

import { resetCanvasRuntimeState, useBootstrapLiveAvgFromSession } from "./state/canvas-runtime-store";
import { useUiStore, useBootstrapModeFromSession, useSyncResetToStart } from "./state/ui-store";
import { useSurveyDataStore, useSyncMySectionForSurveyData } from "./state/survey-data-store";
import { IdentityCtx } from "./state/identity-context";
import type { IdentityState } from "./state/identity-context";
import { PreferencesCtx } from "./state/preferences-context";
import type { PreferencesState } from "./state/preferences-context";

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const { mySection, setMySection, myEntryId, setMyEntryId, myRole, setMyRole } = useIdentityState();
  const { darkMode, setDarkMode } = usePreferencesState();
  useBootstrapLiveAvgFromSession();
  useBootstrapModeFromSession();
  useSyncMySectionForSurveyData(mySection);

  // Sanity subscription starts once at the app boundary and writes into the survey-data store.
  useEffect(() => {
    const unsub = useSurveyDataStore.getState().subscribeToSurveyData();
    return () => { unsub(); };
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
