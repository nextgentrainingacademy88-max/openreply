/**
 * Textarea — styled native <textarea>. Forwards ref and all textarea props.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
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
