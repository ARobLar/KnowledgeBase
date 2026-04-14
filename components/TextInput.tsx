"use client";

import { useState, useRef } from "react";

interface TextInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TextInput({
  onSubmit,
  disabled,
  placeholder = "Describe what you want to save... e.g. 'Save a recipe for chocolate chip cookies'",
}: TextInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={5}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm resize-none focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted disabled:opacity-50"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          Press {typeof window !== "undefined" && navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to submit
        </span>
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Process →
        </button>
      </div>
    </div>
  );
}
