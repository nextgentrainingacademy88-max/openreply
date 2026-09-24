/**
 * Select — styled native <select> with a custom chevron. Forwards ref
 * (to the <select> element itself) and all select props, including
 * `children` (<option>s), so existing call sites that build their own
 * options keep working unchanged.
 */

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "block w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pl-3.5 pr-9 text-sm text-foreground",
          "outline-none transition-colors duration-150",
          "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
});
