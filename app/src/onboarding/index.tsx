// src/onboarding/index.tsx
import React, { Profiler, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { profilerOnRender, recordOwnRender } from '../dev/renderProfilerStats';

import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../app/state/ui-store";
import { useSurveyDataStore } from "../app/state/survey-data-store";
import "../styles/onboarding-info.css";
import "../styles/section-questionnaire.css";

import { ROLE_SECTIONS } from "./section-picker/sections";
import type { RoleSection, SectionItem, SectionOption } from "./section-picker/sections";
import { ButtonQuestionnaireFlow } from "./questionnaire";
import { showDuplicateSurveyNotice } from "../app/notices";
import { surveyReducer, initialSurveyState, type Audience } from "./survey-reducer";
import { useSurveySubmission } from "./useSurveySubmission";
import { track } from "../lib/posthog";
import { getSessionItem } from "../app/session";

const RoleStep = React.lazy(() => import("./role-picker/role-step"));
const CanvasInfo = React.lazy(() => import("./information/canvas-info"));
const SectionPickerIntro = React.lazy(
  () => import("./section-picker")
);

function Survey({
  onAnswersUpdate,
}: {
  onAnswersUpdate?: (answers: Record<string, number | null>) => void;
}) {
  recordOwnRender("Survey");
  const [state, dispatch] = useReducer(surveyReducer, initialSurveyState);
  const { stage, audience, surveySection, error, submitting, fadeState, finished } = state;
  const [introActive, setIntroActive] = useState(true);
  const shouldScrollToSectionRef = useRef(false);

  // latches
  const prevCompletedRef = useRef(false);

  const {
    setAnimationVisible,
    setSurveyActive,
    observerMode,
    openGraph,
    hasCompletedSurvey,
    setQuestionnaireOpen,
    setSectionOpen,
    surveyResetKey,
    resetToStart,
  } = useUiStore(
    useShallow((s) => ({
      setAnimationVisible: s.setAnimationVisible,
      setSurveyActive: s.setSurveyActive,
      observerMode: s.observerMode,
      openGraph: s.openGraph,
      hasCompletedSurvey: s.hasCompletedSurvey,
      setQuestionnaireOpen: s.setQuestionnaireOpen,
      setSectionOpen: s.setSectionOpen,
      surveyResetKey: s.surveyResetKey,
      resetToStart: s.resetToStart,
    }))
  );
  const { section, setSection } = useSurveyDataStore(
    useShallow((s) => ({ section: s.section, setSection: s.setSection }))
  );

  // Keep questionnaireOpen in sync with our stage (and finished latch).
  // No cleanup: the effect body always computes the correct value on re-run,
  // and Survey never unmounts. A cleanup here fires when observerMode changes
  // back to false (return from graph), momentarily setting questionnaireOpen=false
  // and flashing the landing canvas before the body can restore it.
  useEffect(() => {
    setQuestionnaireOpen(stage === 'questions' && !observerMode && !finished);
  }, [stage, observerMode, finished, setQuestionnaireOpen]);

  // Ensure sectionOpen resets whenever we leave the section stage
  useEffect(() => {
    if (stage !== 'section') setSectionOpen(false);
    return () => { setSectionOpen(false); };
  }, [stage, setSectionOpen]);

  useEffect(() => {
    if (stage !== 'section' || !shouldScrollToSectionRef.current) return;
    shouldScrollToSectionRef.current = false;

    const scrollToSection = () => {
      const target = document.querySelector('.survey-step.section-select');
      if (!(target instanceof HTMLElement)) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const rafId = window.requestAnimationFrame(() => {
      window.setTimeout(scrollToSection, 40);
    });

    return () => { window.cancelAnimationFrame(rafId); };
  }, [stage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setIntroActive(false); }, 520);
    return () => { window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (observerMode) {
      setSurveyActive(false);
      if (!section) setSection('fine-arts');
      openGraph();
    }
  }, [observerMode, section, setSection, openGraph, setSurveyActive]);

  useEffect(() => {
    if (prevCompletedRef.current && !hasCompletedSurvey) {
      dispatch({ type: 'RESET' });
      setQuestionnaireOpen(false);
      setSectionOpen(false);
      setAnimationVisible(false);
    }

    prevCompletedRef.current = hasCompletedSurvey;
  }, [
    hasCompletedSurvey,
    setAnimationVisible,
    setQuestionnaireOpen,
    setSectionOpen,
  ]);

  const prevResetKeyRef = useRef(surveyResetKey);
  useEffect(() => {
    if (surveyResetKey === prevResetKeyRef.current) return;
    prevResetKeyRef.current = surveyResetKey;
    dispatch({ type: 'RESET' });
    setQuestionnaireOpen(false);
    setSectionOpen(false);
    setAnimationVisible(false);
  }, [surveyResetKey, setAnimationVisible, setQuestionnaireOpen, setSectionOpen]);

  const transitionTo = useCallback((next: typeof stage, side?: () => void) => {
    dispatch({ type: 'FADE_OUT' });
    setTimeout(() => {
      side?.();
      dispatch({ type: 'ENTER_STAGE', stage: next });
    }, 70);
  }, []);

  // Normalize role sections into the picker contract and add headers for staff mode.
  const availableSections = useMemo<SectionItem[]>(() => {
    if (!audience || audience === 'visitor') return [];

    const toOption = (sectionOption: RoleSection): SectionOption => ({
      type: 'option',
      value: sectionOption.value,
      label: sectionOption.label,
      aliases: sectionOption.aliases,
    });

    if (audience === 'student') {
      return ROLE_SECTIONS.student.map(toOption);
    }

    const studentOptions = ROLE_SECTIONS.student.map(toOption);
    const staffOptions = ROLE_SECTIONS.staff.map(toOption);
    return [
      { type: 'header', id: 'staff', label: 'Institutional departments' },
      ...staffOptions,
      { type: 'header', id: 'student', label: 'Student departments' },
      ...studentOptions,
    ];
  }, [audience]);

  const handleRoleNext = () => {
    const savedEntryId = getSessionItem('be.myEntryId');
    const savedSection = getSessionItem('be.mySection');
    if (savedEntryId && savedSection) {
      showDuplicateSurveyNotice();
      resetToStart();
      return;
    }

    if (!audience) {
      dispatch({ type: 'SET_ERROR', error: 'Choose whether you are Student, Staff, or Visitor.' });
      return;
    }
    dispatch({ type: 'SET_ERROR', error: '' });
    track({ name: 'Role Selected', props: { role: audience } });
    if (audience === 'visitor') {
      track({ name: 'Survey Started', props: { role: audience } });
      transitionTo('questions', () => {
        dispatch({ type: 'SELECT_SECTION', surveySection: 'visitor' });
        setAnimationVisible(false);
      });
      return;
    }
    shouldScrollToSectionRef.current = true;
    transitionTo('section', () => {
      dispatch({ type: 'SELECT_SECTION', surveySection: '' });
    });
  };

  const handleBeginFromSection = () => {
    if (!surveySection) {
      dispatch({ type: 'SET_ERROR', error: 'Select your section.' });
      return;
    }
    dispatch({ type: 'SET_ERROR', error: '' });
    track({ name: 'Section Selected', props: { section: surveySection, role: audience } });
    track({ name: 'Survey Started', props: { role: audience } });
    transitionTo('questions', () => { setAnimationVisible(false); });
  };

  const handleSubmitFromQuestions = useSurveySubmission({ dispatch, surveySection, audience, submitting });

  const handleSubmit = useCallback(
    (answers: Record<string, number | null>) => { void handleSubmitFromQuestions(answers); },
    [handleSubmitFromQuestions]
  );

  const handleAudienceChange = (role: Audience) => {
    // Only index ROLE_SECTIONS when role is student/staff
    const allowed = role === 'staff'
      ? [...ROLE_SECTIONS.student, ...ROLE_SECTIONS.staff].map((sectionOption) => sectionOption.value)
      : role === 'student'
        ? ROLE_SECTIONS.student.map((sectionOption) => sectionOption.value)
        : [];

    const nextSurveySection = allowed.includes(surveySection) ? surveySection : role === 'visitor' ? 'visitor' : '';
    dispatch({ type: 'SELECT_AUDIENCE', audience: role, surveySection: nextSurveySection });
  };

  const handleSectionChange = (val: string) => {
    dispatch({ type: 'SELECT_SECTION', surveySection: val });
  };

  if (hasCompletedSurvey && !observerMode) {
    return null;
  }

  return (
    <div className={`survey-section ${fadeState} ${introActive ? 'survey-first-enter' : ''}`}>
      {!observerMode && (
        <Suspense fallback={null}>
          {stage === 'role' && (
            <>
              <RoleStep value={audience} onChange={handleAudienceChange} onNext={handleRoleNext} error={error} />
              <Profiler id="CanvasInfo" onRender={profilerOnRender}>
                <CanvasInfo />
              </Profiler>
            </>
          )}

          {stage === 'section' && (
            <SectionPickerIntro
              value={surveySection}
              onChange={handleSectionChange}
              onBegin={handleBeginFromSection}
              error={error}
              sections={availableSections}
              placeholderOverride={audience === 'student' ? 'Your Major...' : undefined}
              titleOverride={audience === 'student' ? 'Select Your Major' : undefined}
              onOpenChange={setSectionOpen}
            />
          )}

          {stage === 'questions' && !finished && (
            <Profiler id="ButtonQuestionnaireFlow" onRender={profilerOnRender}>
              <ButtonQuestionnaireFlow
                onAnswersUpdate={onAnswersUpdate}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            </Profiler>
          )}
        </Suspense>
      )}
    </div>
  );
}

export default React.memo(Survey);
