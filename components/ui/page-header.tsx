/**
 * PageHeader — title + optional description, with optional trailing actions
 * (buttons, filters). Sits at the top of a dashboard page, above its cards.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, description, actions, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
});
