/**
 * StatCard (ui primitive) — metric tile: label, value, optional icon and hint.
 *
 * This is the new primitive Wave 2 pages should reach for directly. The
 * existing components/stat-card.tsx (label/value/trend/trendUp props) is a
 * separate, older component kept working as-is for its current callers —
 * see that file's comment for how the two relate.
 */

import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: React.ReactNode;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
  { label, value, icon: Icon, hint, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border bg-surface p-5",
        "shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-12px_rgba(255,106,19,0.12)]",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
});
