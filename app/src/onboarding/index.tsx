// src/onboarding/index.tsx
import React, { Profiler, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { profilerOnRender, recordOwnRender } from '../render-test/renderProfilerStats';

import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../app-core/state/stores/ui-store";
import "../styles/onboarding.css";
import "../styles/questionnaire.css";

import { ROLE_SECTIONS } from "../domain/survey/sections";
import type { RoleSection } from "../domain/survey/sections";
import type { SectionItem, SectionOption } from "./section-picker/sections";
import ButtonQuestionnaireFlow from "./questionnaire";
import { showDuplicateSurveyNotice } from "../app-core/notices";
import { surveyReducer, initialSurveyState, type Audience } from "./survey-reducer";
import { useSurveySubmission } from "./useSurveySubmission";
import { track } from "../lib/posthog";
import { getSessionItem } from "../app-core/session";

// RoleStep/CanvasInfo/CanvasGui render on the very first paint for every visitor
// (stage === 'role' is the initial state), so lazy-loading them gained no
// real code-splitting benefit while making them the content of a Suspense
// boundary that's present from the first byte of SSR output — any update
// reaching that boundary before it finished hydrating bailed it to client
// rendering (React error #421). Eager here; SectionPickerIntro keeps its own
// separate boundary below since it only mounts after a user interaction,
// safely past the hydration window.
import RoleStep from "./role-picker/role-step";
import CanvasInfo from "./canvas-info";
import CanvasGui from "./canvas-gui";
const SectionPickerIntro = React.lazy(() => import("./section-picker"));

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

  const {
    setAnimationVisible,
    observerMode,
    hasCompletedSurvey,
    setQuestionnaireOpen,
    setSectionOpen,
    surveyResetKey,
    resetToStart,
  } = useUiStore(
    useShallow((s) => ({
      setAnimationVisible: s.setAnimationVisible,
      observerMode: s.observerMode,
      hasCompletedSurvey: s.hasCompletedSurvey,
      setQuestionnaireOpen: s.setQuestionnaireOpen,
      setSectionOpen: s.setSectionOpen,
      surveyResetKey: s.surveyResetKey,
      resetToStart: s.resetToStart,
    }))
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

  // NOTE: opening/closing the graph in response to observerMode used to be
  // duplicated here via an effect *and* directly in NavRight's click handler.
  // Removed the duplicate — NavRight is the only place observerMode ever
  // transitions to true, and it already does this work in the same batch as
  // the click itself (an effect-based copy here just added an extra, later,
  // unbatched commit on top of it).

  // Full reset is keyed solely on surveyResetKey (incremented only by
  // resetToStart()) rather than also on hasCompletedSurvey transitioning to
  // false — that also happens on a failed-submission retry (see
  // useSurveySubmission.ts), which must NOT wipe the in-progress answers a
  // second effect watching hasCompletedSurvey would have reset.
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
        <>
          {stage === 'role' && (
            <>
              <RoleStep value={audience} onChange={handleAudienceChange} onNext={handleRoleNext} error={error} />
              <CanvasGui />
              <Profiler id="CanvasInfo" onRender={profilerOnRender}>
                <CanvasInfo />
              </Profiler>
            </>
          )}

          {stage === 'section' && (
            <Suspense fallback={null}>
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
            </Suspense>
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
        </>
      )}
    </div>
  );
}

export default React.memo(Survey);
