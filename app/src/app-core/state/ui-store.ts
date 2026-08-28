// src/app-core/state/ui-store.ts
//
// STATE AUDIT (2026-08-21):
// - CALL SITES: 22 source files across 5 top-level folders — app-core/
//   (main.tsx, app-provider.tsx), onboarding/ (root, questionnaire x2,
//   onboarding-info), navigation/ (root, right, bottom x5, left/logo),
//   graph-runtime/ (gamification, dotgraph root, dotgraph/scene x2,
//   dotgraph/interaction), graph-components/ (widgets/bargraph, city-stats).
//   This is the most widely-read store in the app by folder spread.

// - WRAPPING: none. Zustand module singleton — no <Provider> or {children}
//   tree. Any component can `import { useUiStore }` regardless of where it's
//   mounted; nothing needs to sit inside a particular subtree to read it.

// - RE-RENDER SCOPE: per-field selector (`useUiStore(s => s.field)`) at every
//   call site checked — e.g. mode-toggle.tsx only re-renders on `mode`
//   changing, not on unrelated fields like `logsOpen` toggling. No component
//   subscribes to the whole store.

// - FOLDER-LOCAL STATE ALONGSIDE: yes, and deliberately so. e.g.
//   useQuestionnaireGridLayout.ts keeps `canvasBox` as local useState (a
//   ResizeObserver measurement only that one hook needs);
//   useDotGraphSceneState.ts keeps `tileSize` local for the same reason.
//   Split rationale: this store holds cross-cutting UI toggles that multiple
//   unrelated folders read/write (survey open/closed, viz visible, mode);
//   local useState holds derived-from-DOM/single-consumer values nothing
//   else needs — pushing those into this store would add churn with no
//   sharing benefit.

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
  cityStatsOpen: boolean;
  setCityStatsOpen: (v: boolean) => void;
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
  cityStatsOpen: false,
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
  setCityStatsOpen: (v) => { set({ cityStatsOpen: v }); },
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
