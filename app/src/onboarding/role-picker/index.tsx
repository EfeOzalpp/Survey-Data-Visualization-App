import { useMemo, useRef } from "react";
import styles from "./role-picker.module.css";
import CheckIcon from "../../assets/svg/check/CheckIcon";

export type RoleValue = "visitor" | "student" | "staff";

const MASSART_ROLE_OPTIONS: { val: Exclude<RoleValue, "visitor">; label: string }[] = [
  { val: "student", label: "MassArt Student" },
  { val: "staff", label: "Staff & Faculty" },
];

function SelectionIndicator({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <CheckIcon className={`${styles.roleCheckIcon} svg-sm`} />
    );
  }
  return <span className={`${styles.roleIndicatorSpacer} svg-sm`} />;
}

export default function RolePicker({
  value,
  onChange,
  errorId,
}: {
  value: RoleValue | "";
  onChange: (value: RoleValue) => void;
  errorId?: string;
}) {
  const roleIds = useMemo(
    () => ["visitor", ...MASSART_ROLE_OPTIONS.map((opt) => opt.val)] as RoleValue[],
    []
  );
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleKeyDown = (currentValue: RoleValue) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(currentValue);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentIndex = roleIds.indexOf(currentValue);
      if (currentIndex === -1) return;
      const nextValue = roleIds[(currentIndex + 1) % roleIds.length];
      onChange(nextValue);
      optionRefs.current[nextValue]?.focus();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const currentIndex = roleIds.indexOf(currentValue);
      if (currentIndex === -1) return;
      const nextValue = roleIds[(currentIndex - 1 + roleIds.length) % roleIds.length];
      onChange(nextValue);
      optionRefs.current[nextValue]?.focus();
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      const first = roleIds[0];
      onChange(first);
      optionRefs.current[first]?.focus();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const last = roleIds[roleIds.length - 1];
      onChange(last);
      optionRefs.current[last]?.focus();
    }
  };

  return (
    <div className={styles.radioGroup}>
      <div
        role="radiogroup"
        className={styles.radioOptions}
        aria-labelledby="role-picker-label"
        aria-describedby={errorId}
      >

        {/* Visitor */}
        <div className={`${styles.roleTag} ${styles.roleTagCenter}`}><span className={styles.roleLabel} id="role-picker-label">Choose Your Role</span></div>
        <div
          ref={(node) => { optionRefs.current.visitor = node; }}
          role="radio"
          aria-checked={value === "visitor"}
          tabIndex={value === "visitor" ? 0 : -1}
          className={`${styles.inputPartInside} ${styles.radioOption}${value === "visitor" ? ` ${styles.selected}` : ""}`}
          onClick={() => { onChange("visitor"); }}
          onKeyDown={handleKeyDown("visitor")}
        >
          <SelectionIndicator selected={value === "visitor"} />
          <p className={styles.roleOptionLabel}>Explorer...</p>
          <span className={`${styles.roleIndicatorSpacer} svg-sm`} />
        </div>

        {/* MassArt roles share one visual island. */}
        <div className={styles.roleGroupOptions}>
          {MASSART_ROLE_OPTIONS.map((opt) => {
            const checked = value === opt.val;
            return (
              <div
                key={opt.val}
                ref={(node) => { optionRefs.current[opt.val] = node; }}
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`${styles.inputPartInside} ${styles.radioOption} ${styles.radioOptionInset}${checked ? ` ${styles.selected}` : ""}`}
                onClick={() => { onChange(opt.val); }}
                onKeyDown={handleKeyDown(opt.val)}
              >
                <SelectionIndicator selected={checked} />
                <p className={styles.roleOptionLabel}>{opt.label}</p>
                <span className={`${styles.roleIndicatorSpacer} svg-sm`} />
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
