// src/onboarding/survey-reducer.ts
import type { RoleValue } from "./role-picker";

export type Audience = RoleValue | '';
export type SurveyStage = 'role' | 'section' | 'questions';
export type FadeState = 'fade-in' | 'fade-out';

export interface SurveyState {
  stage: SurveyStage;
  audience: Audience;
  surveySection: string;
  error: string;
  submitting: boolean;
  fadeState: FadeState;
  finished: boolean;
}

export const initialSurveyState: SurveyState = {
  stage: 'role',
  audience: 'visitor',
  surveySection: '',
  error: '',
  submitting: false,
  fadeState: 'fade-in',
  finished: false,
};

export type SurveyAction =
  | { type: 'RESET' }
  | { type: 'FADE_OUT' }
  | { type: 'ENTER_STAGE'; stage: SurveyStage }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SELECT_AUDIENCE'; audience: Audience; surveySection: string }
  | { type: 'SELECT_SECTION'; surveySection: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_FAILED'; error: string }
  | { type: 'SUBMIT_SETTLED' };

export function surveyReducer(state: SurveyState, action: SurveyAction): SurveyState {
  switch (action.type) {
    case 'RESET':
      return initialSurveyState;
    case 'FADE_OUT':
      return { ...state, fadeState: 'fade-out' };
    case 'ENTER_STAGE':
      return { ...state, stage: action.stage, fadeState: 'fade-in' };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SELECT_AUDIENCE':
      return { ...state, audience: action.audience, surveySection: action.surveySection, error: '' };
    case 'SELECT_SECTION':
      return { ...state, surveySection: action.surveySection, error: '' };
    case 'SUBMIT_START':
      return { ...state, submitting: true, error: '', finished: true };
    case 'SUBMIT_FAILED':
      return { ...state, finished: false, error: action.error };
    case 'SUBMIT_SETTLED':
      return { ...state, submitting: false };
    default:
      return state;
  }
}
