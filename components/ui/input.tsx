/**
 * Input — styled native <input>. Forwards ref and all input props.
 * 16px-on-phones handling lives globally in app/globals.css so it applies
 * here without any extra work.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground",
        "placeholder:text-muted outline-none transition-colors duration-150",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
