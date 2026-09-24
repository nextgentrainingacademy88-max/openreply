/**
 * Card / CardHeader / CardTitle
 *
 * The base grouped-content surface. `Card` is the rounded-2xl bordered
 * panel; `CardHeader` lays out a title (+ optional trailing actions);
 * `CardTitle` is the heading itself. Each forwards ref + all native props,
 * so a caller can add onClick, data-*, id, etc. directly.
 *
 * `.panel` in globals.css covers the same surface for markup that predates
 * this component; new code should prefer Card.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 sm:p-6",
        "shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-12px_rgba(255,106,19,0.12)]",
        className,
      )}
      {...props}
    />
  );
});

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("mb-4 flex items-start justify-between gap-4", className)}
      {...props}
    />
  );
});

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, ...props },
  ref,
) {
  return (
    <h3
      ref={ref}
      className={cn("text-base font-bold tracking-tight text-foreground", className)}
      {...props}
    />
  );
});
