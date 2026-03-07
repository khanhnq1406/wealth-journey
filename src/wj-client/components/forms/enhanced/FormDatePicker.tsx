"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface DatePreset {
  label: string;
  value: Date;
}

export interface FormDatePickerProps {
  /**
   * Unique identifier
   */
  id?: string;

  /**
   * Label for the date picker
   */
  label?: string;

  /**
   * Current date value
   */
  value?: Date;

  /**
   * Default date value
   */
  defaultValue?: Date;

  /**
   * Placeholder text
   * @default "Select a date"
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
   * Whether the picker is disabled
   */
  disabled?: boolean;

  /**
   * Whether the field is required
   */
  required?: boolean;

  /**
   * Minimum date allowed
   */
  minDate?: Date;

  /**
   * Maximum date allowed
   */
  maxDate?: Date;

  /**
   * Date format for display
   * @default "MMM dd, yyyy"
   */
  displayFormat?: string;

  /**
   * Show presets (Today, Yesterday, etc.)
   */
  showPresets?: boolean;

  /**
   * Custom presets
   */
  presets?: DatePreset[];

  /**
   * Show week numbers
   */
  showWeekNumbers?: boolean;

  /**
   * First day of week (0 = Sunday, 1 = Monday, etc.)
   * @default 0
   */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * Change callback
   */
  onChange?: (date: Date | null) => void;

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
}

const DEFAULT_PRESETS: DatePreset[] = [
  { label: "Today", value: new Date() },
  { label: "Yesterday", value: new Date(Date.now() - 86400000) },
  { label: "This Week", value: new Date(Date.now() - 7 * 86400000) },
  { label: "This Month", value: new Date(Date.now() - 30 * 86400000) },
];

export function FormDatePicker({
  id,
  label,
  value,
  defaultValue,
  placeholder = "Select a date",
  helperText,
  error,
  success,
  size = "md",
  disabled,
  required,
  minDate,
  maxDate,
  displayFormat = "MMM dd, yyyy",
  showPresets = false,
  presets = DEFAULT_PRESETS,
  showWeekNumbers = false,
  firstDayOfWeek = 0,
  onChange,
  onBlur,
  onFocus,
  className,
  containerClassName,
}: FormDatePickerProps) {
  const t = useTranslations("datePicker");
  const generatedId = useId();
  const pickerId = id || generatedId;
  const helperId = `${pickerId}-helper`;
  const errorId = `${pickerId}-error`;
  const successId = `${pickerId}-success`;

  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    (value || defaultValue || new Date()).getMonth()
  );
  const [currentYear, setCurrentYear] = useState(
    (value || defaultValue || new Date()).getFullYear()
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value || defaultValue || null
  );
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update selected date when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedDate(value);
    }
  }, [value]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return placeholder;

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return displayFormat
      .replace("MMM", month)
      .replace("MM", String(date.getMonth() + 1).padStart(2, "0"))
      .replace("dd", String(day).padStart(2, "0"))
      .replace("yyyy", String(year))
      .replace("yy", String(year).slice(-2));
  };

  // Get days in month
  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get first day of month
  const getFirstDayOfMonth = (month: number, year: number): number => {
    let day = new Date(year, month, 1).getDay();
    // Adjust for firstDayOfWeek
    return (day - firstDayOfWeek + 7) % 7;
  };

  // Check if date is disabled
  const isDateDisabled = (date: Date): boolean => {
    if (disabled) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // Check if date is selected
  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Check if date is today
  const isDateToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Navigate month
  const navigateMonth = (direction: number) => {
    setCurrentMonth((prev) => {
      if (direction === -1 && prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      if (direction === 1 && prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + direction;
    });
  };

  // Navigate year
  const navigateYear = (direction: number) => {
    setCurrentYear((prev) => prev + direction);
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    if (isDateDisabled(date)) return;

    setSelectedDate(date);
    onChange?.(date);
    setIsOpen(false);
  };

  // Handle preset selection
  const handlePresetSelect = (preset: DatePreset) => {
    if (disabled) return;

    setSelectedDate(preset.value);
    onChange?.(preset.value);
    setIsOpen(false);
  };

  // Handle clear
  const handleClear = () => {
    setSelectedDate(null);
    onChange?.(null);
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
      return "border-red-300 hover:border-red-400 dark:border-red-700 dark:hover:border-red-600";
    }
    if (success) {
      return "border-green-300 hover:border-green-400 dark:border-green-700 dark:hover:border-green-600";
    }
    return "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500";
  };

  const triggerClasses = cn(
    "w-full flex items-center justify-between gap-3",
    "rounded-lg border bg-white dark:bg-gray-800",
    "text-gray-900 dark:text-gray-100",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent",
    "disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-900",
    sizeClasses[size],
    getStateClasses()
  );

  // Generate calendar days
  const generateCalendarDays = () => {
    const days: Date[] = [];
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDayOffset = getFirstDayOfMonth(currentMonth, currentYear);

    // Add empty cells for offset
    for (let i = 0; i < firstDayOffset; i++) {
      days.push(null as unknown as Date);
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }

    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const adjustedWeekDays = [
    ...weekDays.slice(firstDayOfWeek),
    ...weekDays.slice(0, firstDayOfWeek),
  ];

  return (
    <div ref={containerRef} className={cn("relative w-full", containerClassName)}>
      {label && (
        <label
          htmlFor={pickerId}
          className={cn(
            "block text-sm font-medium mb-1.5",
            error
              ? "text-red-600 dark:text-red-400"
              : success
              ? "text-green-600 dark:text-green-400"
              : "text-gray-700 dark:text-gray-300"
          )}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={pickerId}
        type="button"
        disabled={disabled}
        className={triggerClasses}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-haspopup="dialog"
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
          {selectedDate ? formatDate(selectedDate) : placeholder}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedDate && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={t("clearDate")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={cn(
              "w-5 h-5 text-gray-400",
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
        </div>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full mt-1 p-4",
            "bg-white dark:bg-gray-800",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-lg"
          )}
        >
          {/* Presets */}
          {showPresets && presets.length > 0 && (
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t("previousMonth")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => navigateYear(-1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t("previousYear")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateYear(1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t("nextYear")}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t("nextMonth")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {/* Week day headers */}
            {adjustedWeekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
              >
                {day.slice(0, 1)}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((date, idx) => {
              const isEmpty = !date;
              const isSelected = date && isDateSelected(date);
              const isToday = date && isDateToday(date);
              const isDisabled = date && isDateDisabled(date);
              const isHovered = date && hoveredDate && isDateSelected(hoveredDate);

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isEmpty || isDisabled}
                  onClick={() => date && handleDateSelect(date)}
                  onMouseEnter={() => date && setHoveredDate(date)}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={cn(
                    "aspect-square flex items-center justify-center text-sm rounded-lg transition-all duration-150",
                    "hover:bg-gray-100 dark:hover:bg-gray-700",
                    "focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-inset",
                    {
                      "invisible": isEmpty,
                      "bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-700":
                        isSelected,
                      "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400":
                        isToday && !isSelected,
                      "font-semibold": isToday,
                      "text-gray-400 cursor-not-allowed": isDisabled,
                    }
                  )}
                  aria-label={date ? date.toDateString() : ""}
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                >
                  {date?.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Helper text, error, or success message */}
      {(helperText || error || success) && (
        <div className="mt-1.5 min-h-[20px]">
          {error && (
            <p
              id={errorId}
              className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
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
              className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
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
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
