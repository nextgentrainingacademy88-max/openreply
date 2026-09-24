"use client";

/**
 * ThemeToggle — light / dark / system segmented control.
 *
 * Writes the choice to localStorage("theme") and mirrors it onto
 * `document.documentElement`'s `data-theme` attribute so app/globals.css
 * tokens update immediately. "system" is stored by removing the key
 * entirely, which is what the pre-paint script in app/layout.tsx (and the
 * `prefers-color-scheme` fallback in globals.css) treat as "no explicit
 * choice".
 *
 * Reads the current choice via useSyncExternalStore instead of copying it
 * into local state in an effect — localStorage is an external store, and
 * this is the API React gives you to read one safely: the server snapshot
 * is always "system" (no localStorage there), so hydration can't mismatch,
 * and it re-renders on both cross-tab "storage" events and the same-tab
 * "openreply:theme" event `select()` dispatches after writing.
 */

import { useCallback, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const LOCAL_EVENT = "openreply:theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private mode, blocked storage, etc.) — fall
    // through to "system".
  }
  return "system";
}

function getServerSnapshot(): ThemeChoice {
  return "system";
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Persisting failed — still apply it to the current tab below.
  }

  if (choice === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", choice);
  }

  // "storage" only fires in *other* tabs, never the one that made the
  // change, so the radiogroup here needs its own same-tab signal.
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

export function ThemeToggle({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, readChoice, getServerSnapshot);

  const select = useCallback((next: ThemeChoice) => applyTheme(next), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface-2 p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "bg-surface text-accent shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
