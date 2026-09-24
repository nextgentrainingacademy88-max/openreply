/**
 * cn — tiny className merge helper.
 *
 * No dependency on clsx/tailwind-merge (per Wave 1 constraints): it just joins
 * truthy class fragments with a space. It does not dedupe conflicting Tailwind
 * utilities (e.g. "px-2" vs "px-4") — callers are expected to order their own
 * className prop last when they want it to win, matching how Tailwind resolves
 * the last-declared class in the same layer.
 */

export type ClassValue = string | number | null | undefined | false;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
