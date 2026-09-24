"use client";

/**
 * Toggle — accessible on/off switch (role="switch").
 *
 * Controlled component: pass `checked` + `onChange`. `label` is optional —
 * when given it renders visible text tied to the control via aria-labelledby
 * (not a wrapping <label>, so the hit target stays exactly the switch);
 * when omitted, callers MUST pass their own `aria-label` since a bare
 * switch with no accessible name fails a11y.
 */

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onChange, label, disabled, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const labelId = label ? `${id ?? generatedId}-label` : undefined;

  const control = (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "bg-surface-2 border-border",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-block h-[1.125rem] w-[1.125rem] transform rounded-full bg-white shadow-sm transition-transform duration-150",
          checked ? "translate-x-[22px]" : "translate-x-1",
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <span className="inline-flex items-center gap-2.5">
      <span id={labelId} className="text-sm text-foreground select-none">
        {label}
      </span>
      {control}
    </span>
  );
});
