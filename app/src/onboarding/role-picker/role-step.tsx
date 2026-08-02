// src/onboarding/role-picker/role-step.tsx
import RolePicker from ".";
import type { RoleValue } from ".";

const DISPLAY: Record<RoleValue, string> = {
  student: "Step In",
  staff: "Step In",
  visitor: "Let's Begin",
};

interface RoleStepProps {
  value: RoleValue | "";
  onChange: (value: RoleValue) => void;
  onNext: () => void;
  error: string;
}

export default function RoleStep({ value, onChange, onNext, error }: RoleStepProps) {
  const isSelected = Boolean(value);
  const buttonLabel = value === "" ? "Start Exploring" : DISPLAY[value];
  const errorId = !isSelected && error ? "role-picker-error" : undefined;

  return (
    <section className="survey survey-step role-select">
        <div className="onboarding">
          <div className="role-step__heading">
            <h2 className="welcome-text">
              A Sustainability Survey Where Selections Affect the Scene.
            </h2>
          </div>

          <RolePicker value={value} onChange={onChange} errorId={errorId} />

          {!isSelected && error && (
            <div className="error-container" id={errorId} role="alert" aria-live="polite">
              <p>What option fits best?</p>
            </div>
          )}
          <div className="button-wrap"><button
            type="button"
            className={`begin-button ${!isSelected ? "is-disabled" : ""} ${
              value === "staff" ? "is-staff" : ""
            }`}
            disabled={!isSelected}
            aria-describedby={errorId}
            onClick={onNext}
          >
            <span className="begin-button__ghost" aria-hidden="true">{buttonLabel}</span>
            <span className="begin-button__inner">{buttonLabel}</span>
          </button></div>
        </div>
    </section>
  );
}
