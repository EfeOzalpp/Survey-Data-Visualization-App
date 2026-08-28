import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../../app-core/state/ui-store";
import { useTransientFlag } from "../../lib/hooks/useTransientFlag";
import { Button } from "../../app-core/ui-generics/Button";

export default function QuestionnaireNav() {
  const { questionnaireNav, requestQuestionnaireAdvance } = useUiStore(
    useShallow((s) => ({
      questionnaireNav: s.questionnaireNav,
      requestQuestionnaireAdvance: s.requestQuestionnaireAdvance,
    }))
  );
  const { visible: showQuestionnaireDisabledHint, show: flashQuestionnaireDisabledHint } = useTransientFlag(2200);
  const questionnaireDisabledHintVisible =
    showQuestionnaireDisabledHint && questionnaireNav.nextDisabled;

  return (
    <div className="questionnaire-nav-stack">
      <p
        className="q-step-indicator questionnaire-nav-progress"
        aria-live="polite"
        aria-atomic="true"
      >
        {questionnaireNav.step} / {questionnaireNav.total}
      </p>
      <div className="questionnaire-nav-action">
        <div
          className={`questionnaire-nav-hint${questionnaireDisabledHintVisible ? " is-visible" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span>Select at least one answer.</span>
        </div>
        <Button
          baseClassName="questionnaire-nav-button"
          ariaDisabled={questionnaireNav.nextDisabled}
          onClick={() => {
            if (questionnaireNav.nextDisabled) {
              flashQuestionnaireDisabledHint();
              return;
            }
            requestQuestionnaireAdvance();
          }}
          aria-label={
            questionnaireNav.nextLabel === "Finish"
              ? "Finish survey and open results"
              : "Next question"
          }
        >
          {questionnaireNav.nextLabel}
        </Button>
      </div>
    </div>
  );
}
