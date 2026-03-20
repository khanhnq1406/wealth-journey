"use client";

import React, {
  useState,
  useRef,
  useEffect,
  KeyboardEvent,
  useCallback,
} from "react";
import { cn } from "@/lib/utils/cn";
import { XIcon, ChevronDownIcon, LoadingSpinnerIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

/**
 * Option type for the Select component.
 * @template T - The type of the value (defaults to string)
 */
export interface SelectOption<T extends string = string> {
  /** Unique value for the option */
  value: T;
  /** Display label for the option */
  label: string;
  /** Optional custom render function for rich display in dropdown */
  render?: (option: SelectOption<T>) => React.ReactNode;
  /** Optional custom render function for selected value display */
  renderSelected?: (option: SelectOption<T>) => React.ReactNode;
}

/**
 * Props for the Select component
 * @template T - The type of the value (defaults to string)
 */
export interface SelectProps<T extends string = string> {
  /** Available options to select from */
  options: SelectOption<T>[];
  /** Currently selected value */
  value?: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Callback when input value changes (for search/filter scenarios) */
  onInputChange?: (value: string) => void;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether the select is in a loading state */
  isLoading?: boolean;
  /** Display value when the selected value is not in options (e.g., remote data) */
  displayValue?: string;
  /** Whether to show a clear button to reset the selection */
  clearable?: boolean;
  /** Whether to disable filtering options by input (useful for autocomplete with server-side filtering) */
  disableFilter?: boolean;
  /** Whether to disable typing in the input (makes it a pure dropdown without search/filter) */
  disableInput?: boolean;
  /** Custom render function for the dropdown container */
  renderDropdown?: (props: {
    children: React.ReactNode;
    className: string;
  }) => React.ReactNode;
  /** Custom render function for individual option items */
  renderOption?: (
    option: SelectOption<T>,
    props: {
      isSelected: boolean;
      isHighlighted: boolean;
      onSelect: () => void;
    },
  ) => React.ReactNode;
  /** Optional callback when dropdown opens */
  onOpen?: () => void;
  /** Optional callback when dropdown closes */
  onClose?: () => void;
}

/**
 * A reusable Select component with custom render support.
 *
 * Features:
 * - Generic type support for type-safe values
 * - Custom rendering for rich display options
 * - Keyboard navigation (arrow keys, enter, escape, tab)
 * - Loading state support
 * - Clear button support
 * - Click-outside-to-close
 * - Filter options based on input
 * - Highlight states
 * - ARIA attributes for accessibility
 * - Smart blur handling: option selection works correctly after typing to filter
 *
 * The component uses `relatedTarget` on blur events to detect when the user is
 * clicking an option versus clicking outside the component. This ensures that
 * option selection works correctly even after typing to filter the dropdown.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Select
 *   options={[{ value: "apple", label: "Apple" }]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 *
 * // With custom rendering
 * <Select
 *   options={[{
 *     value: "apple",
 *     label: "Apple",
 *     render: (opt) => <div><Icon /> {opt.label}</div>
 *   }]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 * ```
 */
export function Select<T extends string = string>({
  options,
  value,
  onChange,
  onInputChange,
  placeholder = "Select...",
  className = "",
  disabled = false,
  isLoading = false,
  displayValue,
  clearable = true,
  disableFilter = false,
  disableInput = false,
  renderDropdown,
  renderOption,
  onOpen,
  onClose,
}: SelectProps<T>) {
  const t = useTranslations("select");
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const [isFocused, setIsFocused] = useState(false);

  // Update input value when selection changes externally (but not when focused/typing)
  useEffect(() => {
    // Don't override input value while user is typing
    if (isFocused) {
      return;
    }

    if (selectedOption) {
      queueMicrotask(() => setInputValue(selectedOption.label));
    } else if (value === "" || value === undefined) {
      queueMicrotask(() => setInputValue(""));
    } else if (displayValue) {
      queueMicrotask(() => setInputValue(displayValue));
    }
  }, [value, selectedOption, displayValue, isFocused]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          setIsOpen(false);
          setHighlightedIndex(-1);
          onClose?.();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const filteredOptions = disableFilter
    ? options
    : options.filter((option) =>
        option.label.toLowerCase().includes(inputValue.toLowerCase()),
      );

  const handleSelect = useCallback(
    (selectedValue: T) => {
      onChange(selectedValue);
      setIsOpen(false);
      setHighlightedIndex(-1);
      setIsFocused(false); // Clear focused state when option is selected
      setInputValue(
        options.find((opt) => opt.value === selectedValue)?.label || "",
      );
      onClose?.();
    },
    [onChange, options, onClose],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("" as T);
      setInputValue("");
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disableInput) return;
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
    onInputChange?.(newValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      onOpen?.();
      return;
    }

    if (!isOpen) return;

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
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        onClose?.();
        break;
      case "Tab":
        if (isOpen) {
          setIsOpen(false);
          setHighlightedIndex(-1);
          onClose?.();
        }
        break;
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (!disabled && !isOpen) {
      setIsOpen(true);
      onOpen?.();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if the new focus target is within our container
    // This prevents blur from interfering with option clicks
    const relatedTarget = e.relatedTarget as Node;
    const isClickingInside = containerRef.current?.contains(relatedTarget);

    // Also handle the case where relatedTarget is null (e.g., clicking non-focusable elements)
    // In this case, check if the current document active element is within our container
    const activeElementInContainer = containerRef.current?.contains(
      document.activeElement,
    );

    if (!isClickingInside && !activeElementInContainer) {
      setIsFocused(false);
    }
  };

  const dropdownClassName =
 "absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden animate-fade-in-scale";

  const defaultRenderOption = (
    option: SelectOption<T>,
    {
      isSelected,
      isHighlighted,
      onSelect,
    }: {
      isSelected: boolean;
      isHighlighted: boolean;
      onSelect: () => void;
    },
  ) => {
    return (
      <div
        key={option.value}
        onClick={onSelect}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        className={cn(
          "w-full px-4 py-3 text-left flex items-center gap-3 cursor-pointer",
          "transition-colors duration-200",
 "hover:bg-neutral-50",
 "focus:outline-none focus:bg-neutral-100",
          {
 "bg-primary-50 text-primary-700":
              isSelected,
 "bg-neutral-100": isHighlighted,
          },
        )}
      >
        {option.render ? option.render(option) : option.label}
      </div>
    );
  };

  const dropdownContent =
    filteredOptions.length === 0 ? (
 <div className="px-4 py-8 text-center text-sm text-neutral-500">No options found</div>
    ) : (
      filteredOptions.map((option, index) => {
        const isSelected = value === option.value;
        const isHighlighted = highlightedIndex === index;

        if (renderOption) {
          return renderOption(option, {
            isSelected,
            isHighlighted,
            onSelect: () => handleSelect(option.value),
          });
        }

        return defaultRenderOption(option, {
          isSelected,
          isHighlighted,
          onSelect: () => handleSelect(option.value),
        });
      })
    );

  const defaultDropdown = (
    <div className={dropdownClassName}>{dropdownContent}</div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          name="select"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          readOnly={disableInput}
          placeholder={
            placeholder && placeholder.length > 0 ? `${placeholder}…` : ""
          }
          autoComplete="off"
          spellCheck={false}
          className={cn(
 "w-full pr-16 rounded-lg border bg-white",
 "text-neutral-900",
            "min-h-[44px] sm:min-h-[48px] px-3 sm:px-4 text-base sm:text-base",
            "transition-all duration-200",
            // Focus styles - aligned with FormSelect
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            // Border styles
 "border-neutral-300",
            // Disabled styles
 "disabled:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50",
            // Dark mode focus
 "",
            disableInput && "cursor-pointer",
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-label={placeholder}
        />

        {/* Right side buttons container */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Clear button */}
          {clearable && value && value !== "" && !disabled && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
 className="text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-full p-0.5 transition-colors duration-200"
              aria-label={t("clearAriaLabel")}
            >
              <XIcon size="sm" decorative />
            </button>
          )}

          {/* Dropdown arrow icon / Loading spinner */}
          {!disabled && !isLoading && (
            <button
              type="button"
              onClick={() => {
                const newState = !isOpen;
                setIsOpen(newState);
                if (newState) {
                  onOpen?.();
                } else {
                  onClose?.();
                }
                inputRef.current?.focus();
              }}
 className="text-neutral-400 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-full p-0.5 transition-colors duration-200"
              aria-label={isOpen ? "Close dropdown" : "Open dropdown"}
              aria-expanded={isOpen}
            >
              <ChevronDownIcon
                size="sm"
                className={cn("transition-transform", isOpen && "rotate-180")}
                decorative
              />
            </button>
          )}

          {/* Loading spinner */}
          {isLoading && (
            <div className="pointer-events-none">
              <LoadingSpinnerIcon size="sm" className="text-primary-500" />
            </div>
          )}
        </div>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <>
          {renderDropdown
            ? renderDropdown({
                children: dropdownContent,
                className: dropdownClassName,
              })
            : defaultDropdown}
        </>
      )}
    </div>
  );
}
