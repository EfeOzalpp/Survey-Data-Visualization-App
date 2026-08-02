import { useMemo, useRef } from "react";
import CheckIcon from "../../assets/svg/check/CheckIcon";

export type RoleValue = "visitor" | "student" | "staff";

const MASSART_ROLE_OPTIONS: { val: Exclude<RoleValue, "visitor">; label: string }[] = [
  { val: "student", label: "MassArt Student" },
  { val: "staff", label: "Staff & Faculty" },
];

function SelectionIndicator({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <CheckIcon className="role-check-icon" />
    );
  }
  return <span className="role-indicator-spacer" />;
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
    <div className="radio-group">
      <div
        role="radiogroup"
        className="radio-options"
        aria-labelledby="role-picker-label"
        aria-describedby={errorId}
      >

        {/* Visitor */}
        <div className="role-tag role-tag--center"><span className="role-label" id="role-picker-label">Choose Your Role</span></div>
        <div
          ref={(node) => { optionRefs.current.visitor = node; }}
          role="radio"
          aria-checked={value === "visitor"}
          tabIndex={value === "visitor" ? 0 : -1}
          className={`input-part-inside radio-option${value === "visitor" ? " selected" : ""}`}
          onClick={() => { onChange("visitor"); }}
          onKeyDown={handleKeyDown("visitor")}
        >
          <SelectionIndicator selected={value === "visitor"} />
          <h4>Explorer...</h4>
          <span className="role-indicator-spacer" />
        </div>

        {/* MassArt roles share one visual island with a center divider. */}
        <div className="role-separator"></div>
        <div className="role-group-options">
          {MASSART_ROLE_OPTIONS.map((opt) => {
            const checked = value === opt.val;
            return (
              <div
                key={opt.val}
                ref={(node) => { optionRefs.current[opt.val] = node; }}
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`input-part-inside radio-option radio-option--inset${checked ? " selected" : ""}`}
                onClick={() => { onChange(opt.val); }}
                onKeyDown={handleKeyDown(opt.val)}
              >
                <SelectionIndicator selected={checked} />
                <h4>{opt.label}</h4>
                <span className="role-indicator-spacer" />
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
