// src/onboarding/role-picker/role-step.tsx
import styles from "./role-picker.module.css";
import { Button } from "../../app/ui/Button";
import RolePicker from ".";
import type { RoleValue } from ".";

const DISPLAY: Record<RoleValue, string> = {
  student: "Step In",
  staff: "Step In",
  visitor: "Begin Survey",
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
        <div className={styles.onboarding}>
          <div className={styles.roleStepHeading}>
            <h2 className="welcome-text">
              Generating Stylized Cities from Collective Choices
            </h2>
          </div>

          <RolePicker value={value} onChange={onChange} errorId={errorId} />

          {!isSelected && error && (
            <div className="error-container" id={errorId} role="alert" aria-live="polite">
              <p>What option fits best?</p>
            </div>
          )}
          <div className="button-wrap">
            <Button
              baseClassName="begin-button"
              modifierClassName={value === "staff" ? "is-staff" : undefined}
              disabled={!isSelected}
              aria-describedby={errorId}
              onClick={onNext}
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
    </section>
  );
}
