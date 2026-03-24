"use client";

import React, {
  useState,
  useId,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  FocusEvent,
} from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface FormSelectProps {
  /**
   * Unique identifier
   */
  id?: string;

  /**
   * Label for the select
   */
  label?: string;

  /**
   * Options to display
   */
  options: SelectOption[];

  /**
   * Current value
   */
  value?: string;

  /**
   * Default value
   */
  defaultValue?: string;

  /**
   * Placeholder text
   * @default "Select an option"
   */
  placeholder?: string;

  /**
   * Helper text
   */
  helperText?: string;

  /**
   * Error message
   */
  error?: string;

  /**
   * Success message
   */
  success?: string;

  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Whether the select is disabled
   */
  disabled?: boolean;

  /**
   * Whether the select is required
   */
  required?: boolean;

  /**
   * Enable search/filter
   */
  searchable?: boolean;

  /**
   * Search placeholder
   */
  searchPlaceholder?: string;

  /**
   * Enable multi-select
   */
  multiple?: boolean;

  /**
   * Selected values for multi-select
   */
  values?: string[];

  /**
   * Maximum number of items to show without scroll
   */
  maxVisibleItems?: number;

  /**
   * No results message
   */
  noResultsMessage?: string;

  /**
   * Group options by category
   */
  groupBy?: (option: SelectOption) => string;

  /**
   * Custom render function for options
   */
  renderOption?: (option: SelectOption) => React.ReactNode;

  /**
   * Custom render function for selected value
   */
  renderValue?: (option: SelectOption | SelectOption[]) => React.ReactNode;

  /**
   * Change callback
   */
  onChange?: (value: string) => void;

  /**
   * Multi-select change callback
   */
  onValuesChange?: (values: string[]) => void;

  /**
   * Blur callback
   */
  onBlur?: () => void;

  /**
   * Focus callback
   */
  onFocus?: () => void;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Container class name
   */
  containerClassName?: string;

  /**
   * Portal dropdown to body
   */
  portal?: boolean;
}

export function FormSelect({
  id,
  label,
  options,
  value,
  defaultValue,
  placeholder = "Select an option",
  helperText,
  error,
  success,
  size = "md",
  disabled,
  required,
  searchable = false,
  searchPlaceholder = "Search...",
  multiple = false,
  values,
  maxVisibleItems = 6,
  noResultsMessage = "No results found",
  groupBy,
  renderOption,
  renderValue,
  onChange,
  onValuesChange,
  onBlur,
  onFocus,
  className,
  containerClassName,
  portal = false,
}: FormSelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const successId = `${selectId}-success`;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get current selection(s)
  const selectedOption = options.find((opt) => opt.value === (value || defaultValue));
  const selectedOptions = options.filter((opt) => values?.includes(opt.value));

  // Filter options based on search
  const filteredOptions = options.filter((opt) => {
    if (!searchQuery) return true;
    return opt.label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Group options if groupBy is provided
  const groupedOptions = groupBy
    ? filteredOptions.reduce((acc, opt) => {
        const group = groupBy(opt);
        if (!acc[group]) acc[group] = [];
        acc[group].push(opt);
        return acc;
      }, {} as Record<string, SelectOption[]>)
    : null;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle option selection - defined before handleKeyDown to avoid access-before-declaration
  const handleSelect = useCallback((option: SelectOption) => {
    if (option.disabled) return;

    if (multiple) {
      const newValues = values?.includes(option.value)
        ? values.filter((v) => v !== option.value)
        : [...(values || []), option.value];
      onValuesChange?.(newValues);
    } else {
      onChange?.(option.value);
      setIsOpen(false);
    }

    setSearchQuery("");
    setHighlightedIndex(-1);
  }, [multiple, values, onValuesChange, onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const maxIndex = filteredOptions.length - 1;
            return prev < maxIndex ? prev + 1 : prev;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case "Tab":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, highlightedIndex, filteredOptions, handleSelect]
  );

  // Handle blur
  const handleBlur = (e: FocusEvent) => {
    // Delay to allow click events to process
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsFocused(false);
        setIsOpen(false);
        onBlur?.();
      }
    }, 150);
  };

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  // Size classes
  const sizeClasses = {
    sm: "h-10 px-3 text-sm",
    md: "h-12 px-4 text-base",
    lg: "h-14 px-5 text-lg",
  };

  // State colors
  const getStateClasses = () => {
    if (error) {
 return "border-v2-red-negative hover:border-v2-red-negative";
    }
    if (success) {
 return "border-v2-border-light hover:border-v2-border-light";
    }
 return "border-v2-border-light hover:border-v2-border-light";
  };

  const triggerClasses = cn(
    "w-full flex items-center justify-between gap-3",
 "rounded-lg border bg-v2-bg-dark",
 "text-v2-gold-accent",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent",
 "disabled:opacity-40 disabled:cursor-not-allowed",
    sizeClasses[size],
    getStateClasses(),
    {
      "ring-2 ring-v2-gold-primary border-transparent": isFocused && !error,
      "ring-2 ring-v2-red-negative border-transparent": isFocused && error,
      "opacity-50 cursor-not-allowed": disabled,
    }
  );

  const getSelectedLabel = () => {
    if (renderValue) {
      if (multiple) {
        return renderValue(selectedOptions);
      }
      if (selectedOption) {
        return renderValue(selectedOption);
      }
      return placeholder;
    }

    if (multiple) {
      if (selectedOptions.length === 0) return placeholder;
      if (selectedOptions.length === 1) return selectedOptions[0].label;
      return `${selectedOptions.length} items selected`;
    }

    return selectedOption?.label || placeholder;
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", containerClassName)}
    >
      {label && (
        <label
          htmlFor={selectId}
          className={cn(
            "block text-sm font-medium mb-1.5",
            error
 ? "text-v2-red-negative"
              : success
 ? "text-v2-green-positive"
 : "text-v2-text-secondary"
          )}
        >
          {label}
          {required && <span className="text-v2-red-negative ml-1">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        className={triggerClasses}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        aria-required={required}
        aria-describedby={cn(
          helperText && helperId,
          error && errorId,
          success && successId
        ).trim() || undefined}
        aria-invalid={error ? "true" : "false"}
      >
        <span className="truncate flex-1 text-left">
          {getSelectedLabel()}
        </span>
        <svg
          className={cn(
            "w-5 h-5 flex-shrink-0 text-v2-text-tertiary transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full mt-1",
 "bg-v2-bg-dark",
 "border border-v2-border-light",
            "rounded-lg shadow-lg",
            "overflow-hidden"
          )}
          style={{
            maxHeight: `${maxVisibleItems * 44 + (searchable ? 48 : 0)}px`,
          }}
        >
          {/* Search input */}
          {searchable && (
 <div className="p-2 border-b border-v2-border-light">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full px-3 py-2 text-sm rounded-md border border-v2-border-light bg-v2-bg-dark text-v2-gold-accent placeholder:text-v2-text-placeholder focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent"
                autoFocus
              />
            </div>
          )}

          {/* Options list */}
          <div
            className="overflow-y-auto"
            role="listbox"
            aria-multiselectable={multiple}
            style={{ maxHeight: `${maxVisibleItems * 44}px` }}
          >
            {filteredOptions.length === 0 ? (
 <div className="px-4 py-8 text-center text-sm text-v2-text-tertiary">
                {noResultsMessage}
              </div>
            ) : groupedOptions ? (
              Object.entries(groupedOptions).map(([group, opts]) => (
                <div key={group}>
 <div className="px-4 py-2 text-xs font-semibold text-v2-text-tertiary bg-v2-bg-surface-tint uppercase tracking-wider">
                    {group}
                  </div>
                  {opts.map((option, idx) => {
                    const isSelected = multiple
                      ? values?.includes(option.value)
                      : value === option.value || defaultValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "w-full px-4 py-3 text-left flex items-center gap-3",
                          "transition-colors duration-150",
 "hover:bg-v2-bg-surface-tint",
 "focus:outline-none focus:bg-v2-bg-surface-tint",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          {
 "bg-v2-gold-primary/20 text-v2-gold-primary":
                              isSelected && !option.disabled,
                            "text-v2-text-tertiary cursor-not-allowed":
                              option.disabled,
                          }
                        )}
                        onClick={() => handleSelect(option)}
                        disabled={option.disabled}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={highlightedIndex === idx ? 0 : -1}
                      >
                        {multiple && (
                          <div className="flex-shrink-0">
                            <div
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center",
                                isSelected
                                  ? "bg-v2-gold-primary border-v2-gold-primary"
 : "border-v2-border-light"
                              )}
                            >
                              {isSelected && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        )}
                        {option.icon && (
                          <span className="flex-shrink-0">{option.icon}</span>
                        )}
                        <span
                          className={cn(
                            "flex-1 truncate",
                            option.disabled && "text-v2-text-tertiary"
                          )}
                        >
                          {renderOption ? renderOption(option) : option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = multiple
                  ? values?.includes(option.value)
                  : value === option.value || defaultValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "w-full px-4 py-3 text-left flex items-center gap-3",
                      "transition-colors duration-150",
 "hover:bg-v2-bg-surface-tint",
 "focus:outline-none focus:bg-v2-bg-surface-tint",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      {
 "bg-v2-gold-primary/20 text-v2-gold-primary":
                          isSelected && !option.disabled,
                        "text-v2-text-tertiary cursor-not-allowed": option.disabled,
                      }
                    )}
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={highlightedIndex === idx ? 0 : -1}
                  >
                    {multiple && (
                      <div className="flex-shrink-0">
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            isSelected
                              ? "bg-v2-gold-primary border-v2-gold-primary"
 : "border-v2-border-light"
                          )}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    )}
                    {option.icon && (
                      <span className="flex-shrink-0">{option.icon}</span>
                    )}
                    <span
                      className={cn(
                        "flex-1 truncate",
                        option.disabled && "text-v2-text-tertiary"
                      )}
                    >
                      {renderOption ? renderOption(option) : option.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Helper text, error, or success message */}
      {(helperText || error || success) && (
        <div className="mt-1.5 min-h-[20px]">
          {error && (
            <p
              id={errorId}
 className="text-sm text-v2-red-negative flex items-center gap-1"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </p>
          )}
          {success && !error && (
            <p
              id={successId}
 className="text-sm text-v2-green-positive flex items-center gap-1"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{success}</span>
            </p>
          )}
          {helperText && !error && !success && (
            <p
              id={helperId}
 className="text-sm text-v2-text-tertiary"
            >
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
