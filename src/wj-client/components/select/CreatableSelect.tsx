"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

export interface Option {
  value: string;
  label: string;
}

interface CreatableSelectProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  onCreate?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  isLoading?: boolean;
  displayValue?: string; // For displaying the selected value's label when not in options
}

export const CreatableSelect: React.FC<CreatableSelectProps> = ({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select or type to create...",
  className = "",
  disabled = false,
  allowCreate = true,
  isLoading = false,
  displayValue,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Update input value when selection changes externally
  useEffect(() => {
    if (selectedOption) {
      queueMicrotask(() => setInputValue(selectedOption.label));
    } else if (value === "") {
      queueMicrotask(() => setInputValue(""));
    } else if (displayValue) {
      // Use displayValue if the selected option is not in the options list
      // (e.g., when a new item was just created)
      queueMicrotask(() => setInputValue(displayValue));
    }
  }, [value, selectedOption, displayValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const canCreateNew =
    allowCreate &&
    inputValue.trim() !== "" &&
    !filteredOptions.some(
      (opt) => opt.label.toLowerCase() === inputValue.toLowerCase(),
    );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreateNew = async () => {
    if (canCreateNew && onCreate && !isLoading) {
      await onCreate(inputValue.trim());
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = filteredOptions.length + (canCreateNew ? 1 : 0);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < totalItems - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else if (canCreateNew) {
            handleCreateNew();
          }
        } else if (filteredOptions.length === 1 && !canCreateNew) {
          handleSelect(filteredOptions[0].value);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case "Tab":
        if (isOpen) {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
        break;
    }
  };

  const handleFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        name="creatable-select"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        placeholder={
          placeholder && placeholder.length > 0 ? `${placeholder}…` : ""
        }
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "min-h-[44px] sm:min-h-[48px] px-3 py-2 w-full pr-10 rounded-lg",
 "bg-white",
 "text-neutral-900",
 "border border-neutral-300",
 "placeholder:text-neutral-400",
 "shadow-sm",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // Focus styles - single ring (clean, modern) - unified with other inputs
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          "transition-all duration-200",
        )}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
      />

      {/* Dropdown arrow icon / Loading spinner */}
      {!disabled && !isLoading && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 cursor-pointer"
        >
          <svg
            className={cn(
              "w-4 h-4 transition-transform",
              isOpen && "rotate-180",
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="animate-spin h-4 w-4 text-primary-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}

      {/* Dropdown menu */}
      {isOpen && !disabled && (
 <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-auto animate-fade-in-scale">
          {filteredOptions.length === 0 && !canCreateNew ? (
 <div className="px-3 py-3 text-neutral-500 text-sm">
              No options found
            </div>
          ) : (
            <>
              {filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "w-full px-3 py-2.5 min-h-[44px] text-left cursor-pointer text-sm transition-colors duration-200",
                    "flex items-center justify-between",
                    highlightedIndex === index
                      ? "bg-primary-500 text-white"
                      : value === option.value
 ? "bg-primary-50 text-primary-700 font-semibold"
 : "hover:bg-neutral-50 text-neutral-900",
                  )}
                >
                  <span>{option.label}</span>
                  {value === option.value && (
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}

              {canCreateNew && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  disabled={isLoading}
                  className={cn(
                    "w-full px-3 py-2.5 min-h-[44px] text-left cursor-pointer text-sm",
 "border-t border-neutral-200",
                    "flex items-center gap-2 transition-colors duration-200",
                    highlightedIndex === filteredOptions.length
                      ? "bg-primary-500 text-white"
 : "hover:bg-neutral-50 text-primary-600 font-semibold",
                    isLoading && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 flex-shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>+ Create &quot;{inputValue.trim()}&quot;</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
