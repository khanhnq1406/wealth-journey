"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  scrollOnOverflow?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  values,
  onChange,
  placeholder = "Select items...",
  className = "",
  disabled = false,
  isLoading = false,
  scrollOnOverflow = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !values.includes(option.value),
  );

  const handleSelect = (selectedValue: string) => {
    if (!values.includes(selectedValue)) {
      onChange([...values, selectedValue]);
    }
    setInputValue("");
    setHighlightedIndex(-1);
  };

  const handleRemove = (valueToRemove: string) => {
    onChange(values.filter((v) => v !== valueToRemove));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0].value);
        }
        break;
      case "Backspace":
        if (inputValue === "" && values.length > 0) {
          handleRemove(values[values.length - 1]);
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

  const selectedOptions = options.filter((opt) => values.includes(opt.value));

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "p-2 rounded-lg w-full min-h-[42px] flex flex-wrap gap-2 border border-v2-border focus-within:border-v2-red-primary focus-within:ring-2 focus-within:ring-v2-red-primary focus-within:ring-offset-2 bg-v2-maroon-900",
          disabled && "opacity-50 cursor-not-allowed",
          scrollOnOverflow && "overflow-y-auto"
        )}
        style={scrollOnOverflow ? { maxHeight: `42px` } : undefined}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedOptions.map((option) => (
          <span
            key={option.value}
            className="inline-flex items-center gap-1 px-2 py-1 bg-v2-red-primary text-white text-sm rounded-md"
          >
            {option.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(option.value);
              }}
              className="hover:bg-v2-red-dark rounded-full p-0.5"
              disabled={disabled}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder={selectedOptions.length === 0 ? `${placeholder}…` : ""}
          autoComplete="off"
          spellCheck={false}
          // IMPORTANT: Font size must be at least 16px (text-base) to prevent iOS auto-zoom
          className="flex-1 min-w-[120px] outline-none bg-transparent text-base placeholder:text-v2-text-placeholder"
        />
      </div>

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="animate-spin h-4 w-4 text-v2-red-primary"
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
        <div className="absolute z-50 w-full mt-1 bg-v2-maroon-900 border border-v2-border-light rounded-lg shadow-v2-card max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-2 text-v2-text-tertiary text-base sm:text-sm">No options found</div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "px-3 py-2 cursor-pointer text-base sm:text-sm",
                  highlightedIndex === index
                    ? "bg-v2-red-primary text-white"
                    : "hover:bg-v2-bg-primary"
                )}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
