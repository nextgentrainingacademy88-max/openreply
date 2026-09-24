/**
 * Button / ButtonLink
 *
 * Shared control styling for every clickable action in the dashboard.
 * `Button` renders a native <button>; `ButtonLink` renders a next/link
 * `<a>` styled identically, for actions that are really navigation
 * (e.g. "Connect Instagram" going to an OAuth route).
 *
 * variant: "primary" (accent fill, the default call-to-action) |
 *          "secondary" (surface + border, the default secondary action) |
 *          "ghost" (no fill/border, for low-emphasis actions in toolbars) |
 *          "danger" (destructive actions: disconnect, delete, revoke)
 * size: "sm" | "md" (default) | "lg"
 *
 * Both forward refs and all native props (onClick, disabled, aria-*, form
 * attributes, next/link's href/prefetch/etc.) — style only, no new behavior.
 */

import { forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold " +
  "transition-[background-color,border-color,box-shadow,color] duration-150 " +
  "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-[0_1px_2px_rgba(28,25,23,0.08)] " +
    "hover:bg-accent-hover hover:shadow-[0_10px_24px_-8px_rgba(255,106,19,0.55)]",
  secondary:
    "bg-surface border border-border text-foreground hover:bg-surface-hover hover:border-border-hover",
  ghost: "text-foreground hover:bg-surface-hover",
  danger:
    "bg-error text-white shadow-[0_1px_2px_rgba(28,25,23,0.08)] hover:brightness-95",
};

/**
 * Builds Button's visual classes for a plain element that can't be a
 * `<button>` or next/link `<a>` — e.g. a real `<a href>` that must force a
 * full browser navigation (OAuth kickoff, file download) rather than
 * next/link's client-side routing. Prefer Button/ButtonLink; reach for this
 * only when neither fits.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(BASE_CLASSES, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BASE_CLASSES, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
});

export interface ButtonLinkProps
  extends LinkProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <Link
      ref={ref}
      className={cn(BASE_CLASSES, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
});
