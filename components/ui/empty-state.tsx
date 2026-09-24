/**
 * EmptyState — icon + title + description + optional action, centered.
 * Use inside a Card (or .panel) for "no data yet" / zero-result states.
 */

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { icon: Icon, title, description, action, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}
      {...props}
    >
      {Icon && (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
});
