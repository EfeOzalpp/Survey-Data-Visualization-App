// src/app/state/ui-store.ts
import { create } from 'zustand';
import { startTransition, useEffect } from 'react';
import { readStoredMode, setSessionItem } from '../session';

export type Mode = 'relative' | 'absolute';

export interface QuestionnaireNavState {
  step: number;
  total: number;
  nextLabel: string;
  nextDisabled: boolean;
}

export interface SpotlightRequest {
  durationMs: number;
  fakeMouseXRatio: number;
  fakeMouseYRatio: number;
}

const DEFAULT_QUESTIONNAIRE_NAV: QuestionnaireNavState = {
  step: 0,
  total: 0,
  nextLabel: 'Next',
  nextDisabled: true,
};

function sameQuestionnaireNav(a: QuestionnaireNavState, b: QuestionnaireNavState) {
  return a.step === b.step && a.total === b.total && a.nextLabel === b.nextLabel && a.nextDisabled === b.nextDisabled;
}

export interface UiState {
  vizVisible: boolean;
  setVizVisible: (v: boolean) => void;
  openGraph: () => void;
  closeGraph: () => void;

  isSurveyActive: boolean;
  setSurveyActive: (v: boolean) => void;
  hasCompletedSurvey: boolean;
  setHasCompletedSurvey: (v: boolean) => void;
  questionnaireOpen: boolean;
  setQuestionnaireOpen: (v: boolean) => void;
  sectionOpen: boolean;
  setSectionOpen: (v: boolean) => void;
  cityPanelOpen: boolean;
  setCityPanelOpen: (v: boolean) => void;

  observerMode: boolean;
  setObserverMode: (v: boolean) => void;
  animationVisible: boolean;
  setAnimationVisible: (v: boolean) => void;
  openPersonalized: boolean;
  setOpenPersonalized: (v: boolean) => void;
  personalPanelOpen: boolean;
  setPersonalPanelOpen: (v: boolean) => void;
  resetToStart: () => void;
  surveyResetKey: number;
  incrementSurveyResetKey: () => void;

  logsOpen: boolean;
  setLogsOpen: (v: boolean) => void;
  widgetsOpen: boolean;
  setWidgetsOpen: (v: boolean) => void;
  infoOpen: boolean;
  setInfoOpen: (v: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;

  spotlightRequest: SpotlightRequest | null;
  setSpotlightRequest: (req: SpotlightRequest | null) => void;

  questionnaireNav: QuestionnaireNavState;
  setQuestionnaireNav: (next: Partial<QuestionnaireNavState>) => void;
  questionnaireAdvanceTick: number;
  requestQuestionnaireAdvance: () => void;
  resetQuestionnaireNav: () => void;
}

// Internal transition-guard memory between openGraph -> closeGraph. Was a
// useRef purely because it's never exposed in UiState at all; a module-level
// variable is the direct equivalent outside a component.
let graphReturn = false;

export const useUiStore = create<UiState>((set, get) => ({
  vizVisible: false,
  isSurveyActive: false,
  hasCompletedSurvey: false,
  questionnaireOpen: false,
  sectionOpen: false,
  cityPanelOpen: false,
  observerMode: false,
  animationVisible: false,
  openPersonalized: false,
  personalPanelOpen: true,
  resetToStart: () => { /* replaced by AppProvider via useSyncResetToStart once mounted */ },
  surveyResetKey: 0,
  logsOpen: false,
  widgetsOpen: false,
  infoOpen: false,
  mode: 'absolute',
  spotlightRequest: null,
  questionnaireNav: DEFAULT_QUESTIONNAIRE_NAV,
  questionnaireAdvanceTick: 0,

  setSurveyActive: (v) => { set({ isSurveyActive: v }); },
  setHasCompletedSurvey: (v) => { set({ hasCompletedSurvey: v }); },
  setSectionOpen: (v) => { set({ sectionOpen: v }); },
  setCityPanelOpen: (v) => { set({ cityPanelOpen: v }); },
  setObserverMode: (v) => { set({ observerMode: v }); },
  setAnimationVisible: (v) => { set({ animationVisible: v }); },
  setOpenPersonalized: (v) => { set({ openPersonalized: v }); },
  setPersonalPanelOpen: (v) => { set({ personalPanelOpen: v }); },
  incrementSurveyResetKey: () => { set((s) => ({ surveyResetKey: s.surveyResetKey + 1 })); },
  setLogsOpen: (v) => { set({ logsOpen: v }); },
  setWidgetsOpen: (v) => { set({ widgetsOpen: v }); },
  setInfoOpen: (v) => { set({ infoOpen: v }); },
  setSpotlightRequest: (req) => { set({ spotlightRequest: req }); },
  setVizVisible: (v) => {
    if (!v) graphReturn = false;
    set({ vizVisible: v });
  },

  setMode: (m) => {
    set({ mode: m });
    setSessionItem('be.mode', m);
  },

  setQuestionnaireNav: (next) => {
    const merged = { ...get().questionnaireNav, ...next };
    if (sameQuestionnaireNav(get().questionnaireNav, merged)) return;
    set({ questionnaireNav: merged });
  },
  requestQuestionnaireAdvance: () => { set((s) => ({ questionnaireAdvanceTick: s.questionnaireAdvanceTick + 1 })); },
  resetQuestionnaireNav: () => { set({ questionnaireNav: DEFAULT_QUESTIONNAIRE_NAV, questionnaireAdvanceTick: 0 }); },

  setQuestionnaireOpen: (v) => {
    set({ questionnaireOpen: v });
    if (!v) {
      set({ cityPanelOpen: false });
      get().resetQuestionnaireNav();
    }
  },

  openGraph: () => {
    if (!get().vizVisible) {
      const wasInQuestionnaire = get().questionnaireOpen;
      graphReturn = wasInQuestionnaire;
      if (wasInQuestionnaire) {
        // Raw internal set -- deliberately bypasses setQuestionnaireOpen's public
        // side effects (does NOT reset questionnaireNav here).
        set({ questionnaireOpen: false });
        set({ cityPanelOpen: false });
      }
    }
    get().setVizVisible(true);
  },
  closeGraph: () => {
    if (graphReturn) {
      set({ questionnaireOpen: true });
    }
    get().setVizVisible(false);
    set({ logsOpen: false, widgetsOpen: false });
  },
}));

export function useBootstrapModeFromSession() {
  useEffect(() => {
    startTransition(() => {
      useUiStore.setState({ mode: readStoredMode('absolute') });
    });
  }, []);
}

export function useSyncResetToStart(resetToStart: () => void) {
  useEffect(() => {
    useUiStore.setState({ resetToStart });
  }, [resetToStart]);
}
