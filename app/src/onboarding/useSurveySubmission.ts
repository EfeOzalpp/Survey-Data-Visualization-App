// src/onboarding/useSurveySubmission.ts
import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useUiStore } from '../app/state/ui-store';
import { useSurveyDataStore } from '../app/state/survey-data-store';
import { useIdentity } from '../app/state/identity-context';
import { useCanvasRuntimeStore } from '../app/state/canvas-runtime-store';
import { showDuplicateSurveyNotice, showRateLimitNotice } from '../app/notices';
import { BUTTON_QUESTIONS } from './questionnaire';
import type { Audience, SurveyAction } from './survey-reducer';

import {
  createOptimisticUserResponse,
  persistUserResponseSession,
  saveUserResponse,
  savedUserResponseToSurveyRow,
} from '../client-api/response-api/saveUserResponse';
import { WriteApiError } from '../client-api/response-api/writeApi';
import { parentAggregateForSection } from '../domain/survey/sections';
import { track } from '../lib/posthog';
import { getSessionItem, removeSessionItems, setSessionItem } from '../app/session';

function answersToWeights(answers: Record<string, number | null>) {
  const getVal = (i: number) => {
    const id = BUTTON_QUESTIONS[i]?.id;
    const v = id ? answers[id] : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };
  return {
    q1: getVal(0),
    q2: getVal(1),
    q3: getVal(2),
    q4: getVal(3),
    q5: getVal(4),
  };
}

export function useSurveySubmission({
  dispatch,
  surveySection,
  audience,
  submitting,
}: {
  dispatch: React.Dispatch<SurveyAction>;
  surveySection: string;
  audience: Audience;
  submitting: boolean;
}) {
  const {
    setAnimationVisible,
    setSurveyActive,
    setHasCompletedSurvey,
    openGraph,
    closeGraph,
    setQuestionnaireOpen,
    resetToStart,
  } = useUiStore(
    useShallow((s) => ({
      setAnimationVisible: s.setAnimationVisible,
      setSurveyActive: s.setSurveyActive,
      setHasCompletedSurvey: s.setHasCompletedSurvey,
      openGraph: s.openGraph,
      closeGraph: s.closeGraph,
      setQuestionnaireOpen: s.setQuestionnaireOpen,
      resetToStart: s.resetToStart,
    }))
  );
  const { counts, removeLocalSurveyRow, upsertLocalSurveyRow, setSection } = useSurveyDataStore(
    useShallow((s) => ({
      counts: s.counts,
      removeLocalSurveyRow: s.removeLocalSurveyRow,
      upsertLocalSurveyRow: s.upsertLocalSurveyRow,
      setSection: s.setSection,
    }))
  );
  const { setMySection, setMyEntryId, setMyRole } = useIdentity();
  const setLiveAvg = useCanvasRuntimeStore((s) => s.setLiveAvg);

  return useCallback(async (answers: Record<string, number | null>) => {
    if (submitting) return;

    const savedEntryId = getSessionItem('be.myEntryId');
    const savedSection = getSessionItem('be.mySection');
    if (savedEntryId && savedSection) {
      showDuplicateSurveyNotice();
      resetToStart();
      return;
    }

    dispatch({ type: 'SUBMIT_START' });
    setQuestionnaireOpen(false);

    const weights = answersToWeights(answers);
    const avgValues = Object.values(answers).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (avgValues.length > 0) {
      const finalAvg = avgValues.reduce((s, v) => s + v, 0) / avgValues.length;
      setLiveAvg(finalAvg);
      setSessionItem('be.myAvg', String(finalAvg));
    }
    const optimistic = createOptimisticUserResponse(surveySection, weights);
    const optimisticRow = savedUserResponseToSurveyRow(optimistic, surveySection);
    const sectionCountBeforeSubmit = counts[surveySection] ?? 0;
    const parentAggregate = parentAggregateForSection(surveySection);
    const postSubmitSection = parentAggregate && sectionCountBeforeSubmit === 0
      ? parentAggregate
      : surveySection;

    persistUserResponseSession(optimistic, surveySection);
    upsertLocalSurveyRow(optimisticRow);
    setSection(postSubmitSection);
    setMySection(surveySection);
    setMyEntryId(optimistic._id);
    setMyRole(audience || null);
    setHasCompletedSurvey(true);
    openGraph();
    setSurveyActive(false);
    setAnimationVisible(true);
    if (audience) setSessionItem('be.myRole', audience);

    try {
      const created = await saveUserResponse(surveySection, weights);
      upsertLocalSurveyRow(
        savedUserResponseToSurveyRow(created, surveySection),
        optimistic._id
      );

      setSection(postSubmitSection);
      setMySection(surveySection);
      setMyEntryId(created._id);
      setMyRole(audience || null);

      track({ name: 'Survey Completed', props: { section: surveySection, role: audience } });

    } catch (err) {
      console.error('[Survey] submit error:', err);
      removeLocalSurveyRow(optimistic._id);
      const submitErrorMessage = err instanceof WriteApiError
        ? err.code === 'RATE_LIMITED'
          ? 'Too many submissions from this network. Please wait a moment and try again.'
          : err.code === 'INVALID_SURVEY_RESPONSE'
            ? 'One of the selected answers could not be saved. Please adjust your answer and try again.'
            : `We could not save your response. (${String(err.code ?? err.status)})`
        : 'We could not save your response. Please try again.';
      if (err instanceof WriteApiError && err.code === 'RATE_LIMITED') {
        showRateLimitNotice({
          message: submitErrorMessage,
          resetAt: err.resetAt,
        });
      }
      // If saving failed, allow returning to questions
      removeSessionItems([
        'be.myEntryId',
        'be.mySection',
        'be.myRole',
        'be.myEditToken',
        'be.justSubmitted',
        'be.myDoc',
        'be.openPersonalOnNext',
      ]);
      closeGraph();
      setMyEntryId(null);
      setMySection(null);
      setMyRole(null);
      setHasCompletedSurvey(false);
      setSurveyActive(true);
      setQuestionnaireOpen(true);
      setAnimationVisible(false);
      dispatch({ type: 'SUBMIT_FAILED', error: submitErrorMessage });
    } finally {
      dispatch({ type: 'SUBMIT_SETTLED' });
    }
  }, [
    submitting,
    resetToStart,
    dispatch,
    setQuestionnaireOpen,
    surveySection,
    setLiveAvg,
    counts,
    setSection,
    removeLocalSurveyRow,
    upsertLocalSurveyRow,
    setMySection,
    setMyEntryId,
    setMyRole,
    setHasCompletedSurvey,
    openGraph,
    setSurveyActive,
    setAnimationVisible,
    audience,
    closeGraph,
  ]);
}
