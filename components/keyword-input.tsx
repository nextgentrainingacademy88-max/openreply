"use client";

/**
 * Keyword Input
 *
 * Tag-style input for adding/removing keywords.
 */

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
}

export default function KeywordInput({ keywords, onChange, max = 10 }: KeywordInputProps) {
  const [input, setInput] = useState("");

  function addKeyword(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    if (keywords.length >= max) return;
    onChange([...keywords, trimmed]);
    setInput("");
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((k) => k !== keyword));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3 transition-colors focus-within:border-accent">
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pr-1.5 pl-2.5 text-xs font-semibold text-foreground"
          >
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              aria-label={`Remove ${keyword}`}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-error"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={keywords.length === 0 ? "Type keyword and press Enter…" : ""}
          aria-label="Add keyword"
          className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
        />
      </div>
      <p className="text-xs text-muted">
        {keywords.length}/{max} keywords · Press Enter or comma to add
      </p>
    </div>
  );
}
