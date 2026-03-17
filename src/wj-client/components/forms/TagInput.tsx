"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { useController } from "react-hook-form";
import { Label } from "./Label";
import { ErrorMessage } from "./ErrorMessage";
import { cn } from "@/lib/utils/cn";

interface TagInputProps {
  name: string;
  control: any;
  label: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

export function TagInput({
  name,
  control,
  label,
  placeholder = "",
  required = false,
  helperText,
}: TagInputProps) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, defaultValue: [] });

  const [inputValue, setInputValue] = useState("");
  const tags: string[] = Array.isArray(field.value) ? field.value : [];
  const hasError = !!error;
  const errorId = `${name}-error`;
  const helperId = `${name}-helper`;

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (tag && !tags.includes(tag)) {
        field.onChange([...tags, tag]);
      }
    },
    [tags, field]
  );

  const removeTag = useCallback(
    (index: number) => {
      field.onChange(tags.filter((_, i) => i !== index));
    },
    [tags, field]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
      setInputValue("");
    }
    field.onBlur();
  };

  return (
    <div className="mb-3 sm:mb-4">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <div
        className={cn(
          "mt-1 sm:mt-1.5 flex flex-wrap items-center gap-1.5",
          "min-h-[44px] sm:min-h-[48px] px-3 sm:px-4 py-2",
          "rounded-lg border transition-all duration-200",
          "bg-white dark:bg-dark-surface",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent",
          hasError && "border-danger-500 focus-within:ring-danger-500 focus-within:border-transparent",
          !hasError && "border-neutral-300 dark:border-dark-border hover:border-neutral-400 dark:hover:border-dark-border-hover"
        )}
      >
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800/50 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={name}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? placeholder : ""}
          className={cn(
            "flex-1 min-w-[80px] text-base sm:text-base py-0.5",
            "bg-transparent border-none outline-none",
            "text-neutral-900 dark:text-dark-text",
            "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary"
          )}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={cn(
            hasError && errorId,
            helperText && !hasError && helperId
          )}
        />
      </div>
      {helperText && !hasError && (
        <p
          id={helperId}
          className="mt-1.5 text-xs sm:text-sm text-neutral-500 dark:text-dark-text-tertiary"
        >
          {helperText}
        </p>
      )}
      {error && <ErrorMessage id={errorId}>{error.message}</ErrorMessage>}
    </div>
  );
}
