// src/app/ui/Button.tsx
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// Shared ghost+inner markup shell for primary/secondary buttons. Doesn't own
// the CSS class - button.css's mechanics key off btn-${variant}.
export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "disabled"> {
  variant?: "primary" | "secondary";
  baseClassName: string;
  modifierClassName?: string;
  children: ReactNode;
  // Ghost defaults to mirroring children; pass this when the button's
  // widest state isn't its current one (e.g. reserve "Saving" while
  // showing "Save").
  reserveContent?: ReactNode;
  disabled?: boolean;
  ariaDisabled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    baseClassName,
    modifierClassName,
    children,
    reserveContent,
    disabled,
    ariaDisabled,
    type = "button",
    ...rest
  },
  ref
) {
  const variantClassName = `btn-${variant}`;
  const className = [variantClassName, baseClassName, modifierClassName].filter(Boolean).join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={className}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      {...rest}
    >
      <span className={`${variantClassName}__ghost`} aria-hidden="true">
        {reserveContent ?? children}
      </span>
      <span className={`${variantClassName}__inner`}>{children}</span>
    </button>
  );
});

export default Button;
