import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_AVG, useCanvasRuntimeStore } from "../../../app/state/canvas-runtime-store";
import { useUiStore } from "../../../app/state/ui-store";
import CheckIcon from "../../../assets/svg/check/CheckIcon";
import { BUTTON_QUESTIONS } from "./button-questions";
import { getQuestionButtonPlacement } from "./button-layouts";
import { useQuestionnaireGridLayout } from "./useQuestionnaireGridLayout";
import type { Place } from "../../../scene-canvas/grid-layout/occupancy";
import { recordOwnRender } from "../../../render-test/renderProfilerStats";

function reserveSingleTile(footprint: Place): Place {
  const bottomRow = footprint.r0 + footprint.h - 1;
  const centerCol = footprint.c0 + Math.floor(Math.max(0, footprint.w - 1) / 2);

  return {
    r0: bottomRow,
    c0: centerCol,
    w: 1,
    h: 1,
  };
}

function ButtonQuestionnaireIcon({ active }: { active: boolean }) {
  return (
    <span className="ui-icon button-questionnaire__button-icon" aria-hidden="true">
      {active ? (
        <CheckIcon className="button-questionnaire__button-check-icon" />
      ) : (
        <svg
          className="icon-plus button-questionnaire__button-plus-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
          <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2.5" />
        </svg>
      )}
    </span>
  );
}

function ButtonQuestionnaireOption({
  active,
  label,
  onClick,
  className,
  style,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="button-questionnaire__button-content">
        <ButtonQuestionnaireIcon active={active} />
        <span className="button-questionnaire__button-label">{label}</span>
      </span>
    </button>
  );
}

function ButtonQuestionnaireFlow({
  onAnswersUpdate,
  onSubmit,
  submitting,
}: {
  onAnswersUpdate?: (answers: Record<string, number | null>) => void;
  onSubmit?: (answers: Record<string, number | null>) => void;
  submitting?: boolean;
}) {
  recordOwnRender("ButtonQuestionnaireFlow");
  const setLiveAvg = useCanvasRuntimeStore((s) => s.setLiveAvg);
  const setReservedFootprints = useCanvasRuntimeStore((s) => s.setReservedFootprints);
  const questionnaireAdvanceTick = useUiStore((s) => s.questionnaireAdvanceTick);
  const setQuestionnaireNav = useUiStore((s) => s.setQuestionnaireNav);
  const resetQuestionnaireNav = useUiStore((s) => s.resetQuestionnaireNav);
  const [step, setStep] = useState(0);
  const [initialUiReady, setInitialUiReady] = useState(false);
  const [activeOptionsByQuestion, setActiveOptionsByQuestion] = useState<Record<string, string[]>>({});
  const lastConsumedAdvanceTickRef = useRef(0);
  const {
    device,
    layout,
    getPlacementStyle,
    resolvePlacement,
  } = useQuestionnaireGridLayout();

  const question = BUTTON_QUESTIONS[step];
  const selectedKeys = activeOptionsByQuestion[question.id] ?? [];
  const answers = useMemo(
    () =>
      BUTTON_QUESTIONS.reduce<Record<string, number | null>>((acc, buttonQuestion) => {
        const activeKeys = activeOptionsByQuestion[buttonQuestion.id] ?? [];
        const activeOptions = buttonQuestion.options.filter((option) =>
          activeKeys.includes(option.key)
        );

        acc[buttonQuestion.id] = activeOptions.length
          ? activeOptions.reduce((sum, option) => sum + option.weight, 0) / activeOptions.length
          : null;
        return acc;
      }, {}),
    [activeOptionsByQuestion]
  );
  const selected = answers[question.id] ?? null;
  const isLast = step === BUTTON_QUESTIONS.length - 1;
  const liveAvg = useMemo(() => {
    const values = BUTTON_QUESTIONS
      .slice(0, step + 1)
      .map((buttonQuestion) => answers[buttonQuestion.id])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!values.length) return DEFAULT_AVG;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [answers, step]);

  useEffect(() => {
    onAnswersUpdate?.(answers);
  }, [answers, onAnswersUpdate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInitialUiReady(true);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    setLiveAvg(liveAvg);
  }, [liveAvg, setLiveAvg]);

  useEffect(() => {
    setQuestionnaireNav({
      step: step + 1,
      total: BUTTON_QUESTIONS.length,
      nextLabel: isLast ? "Finish" : "Next",
      nextDisabled: selectedKeys.length === 0 || selected === null || !!submitting,
    });
  }, [
    isLast,
    selected,
    selectedKeys.length,
    setQuestionnaireNav,
    step,
    submitting,
  ]);

  useEffect(() => {
    if (!layout) {
      setReservedFootprints([]);
      return;
    }

    const reserved = question.options
      .map((_, optionIndex) =>
        resolvePlacement(getQuestionButtonPlacement(question.id, optionIndex, device))
      )
      .filter((placement): placement is Place => !!placement)
      .map((placement) => reserveSingleTile(placement));

    setReservedFootprints(reserved);
  }, [device, layout, question.id, question.options, resolvePlacement, setReservedFootprints]);

  useEffect(() => {
    setReservedFootprints([]);
    return () => {
      setReservedFootprints([]);
    };
  }, [setReservedFootprints]);

  useEffect(() => {
    return () => {
      resetQuestionnaireNav();
    };
  }, [resetQuestionnaireNav]);

  const toggleOption = useCallback(
    (optionKey: string) => {
      setActiveOptionsByQuestion((prev) => {
        const current = prev[question.id] ?? [];
        const nextKeys = current.includes(optionKey)
          ? current.filter((key) => key !== optionKey)
          : [...current, optionKey];
        return { ...prev, [question.id]: nextKeys };
      });
    },
    [question.id]
  );

  const handleNext = useCallback(() => {
    if (selectedKeys.length === 0 || selected === null) return;
    if (isLast) {
      const final = { ...answers, [question.id]: selected };
      onSubmit?.(final);
    } else {
      setStep((s) => s + 1);
    }
  }, [answers, isLast, onSubmit, question.id, selected, selectedKeys.length]);

  useEffect(() => {
    if (questionnaireAdvanceTick <= lastConsumedAdvanceTickRef.current) return;
    lastConsumedAdvanceTickRef.current = questionnaireAdvanceTick;
    handleNext();
  }, [handleNext, questionnaireAdvanceTick]);

  return (
    <section className={`survey survey-step questionnaire${initialUiReady ? " is-ui-ready" : " is-ui-delayed"}`}>
      <div className="questions questionnaire-title questionnaire-grid-header">
        <h2 key={question.id} className="q-title questionnaire-question-title">
          {question.prompt}
        </h2>
      </div>

      {layout && (
        <div className="button-questionnaire__canvas-layer" aria-label={`${question.prompt} options`}>
          {question.options.map((option, optionIndex) => {
            const active = selectedKeys.includes(option.key);
            const style = getPlacementStyle(
              getQuestionButtonPlacement(question.id, optionIndex, device)
            );

            return (
              <div
                key={`${question.id}:${option.key}`}
                className="button-questionnaire__slot"
                style={{ ...style, '--slot-index': optionIndex } as CSSProperties}
              >
                <ButtonQuestionnaireOption
                  active={active}
                  label={option.label}
                  className={`ui-toggle-option button-questionnaire__button button-questionnaire__button--placed${active ? " is-active" : ""}`}
                  onClick={() => { toggleOption(option.key); }}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(ButtonQuestionnaireFlow);
