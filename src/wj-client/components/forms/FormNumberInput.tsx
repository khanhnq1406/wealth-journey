"use client";

import { useState, useEffect } from "react";
import { useController, UseControllerProps } from "react-hook-form";
import { Label } from "./Label";
import { ErrorMessage } from "./ErrorMessage";
import { cn } from "@/lib/utils/cn";
import {
  formatNumberWithCommas,
  parseNumberWithCommas,
} from "@/lib/utils/number-format";
import {
  generateRecommendations,
  DEFAULT_MULTIPLIERS,
} from "@/lib/utils/number-recommendations";
import { NumberSuggestions } from "./NumberSuggestions";

interface FormNumberInputProps extends Omit<UseControllerProps, "control"> {
  control: any; // Control type causes generic issues with RHF, using any as workaround
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: string;
  prefix?: string;
  suffix?: string;
  helperText?: string;
  useThousandSeparator?: boolean;

  /**
   * Enable recommended number suggestions (always visible when input has value)
   * @default true
   */
  showRecommendations?: boolean;

  /**
   * Custom multipliers for recommendations (defaults to [1e3, 1e4, 1e5, 1e6, 1e7, 1e8])
   */
  recommendationMultipliers?: number[];

  /**
   * Maximum recommendations to show
   * @default 6
   */
  maxRecommendations?: number;

  /**
   * Callback when recommendation selected
   */
  onRecommendationSelect?: (value: number) => void;
}

export const FormNumberInput = ({
  label,
  placeholder = "0",
  required = false,
  disabled = false,
  className = "",
  min,
  max,
  step = "1",
  prefix,
  suffix,
  helperText,
  useThousandSeparator = true,
  showRecommendations = true,
  recommendationMultipliers = DEFAULT_MULTIPLIERS,
  maxRecommendations = 6,
  onRecommendationSelect,
  ...props
}: FormNumberInputProps) => {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController(props);

  // Local state for display value (with commas)
  const [displayValue, setDisplayValue] = useState<string>("");

  // State for recommendations
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recommendations, setRecommendations] = useState<number[]>([]);

  // Initialize display value from form value
  useEffect(() => {
    if (value === null || value === undefined || value === "") {
      queueMicrotask(() => setDisplayValue(""));
    } else {
      queueMicrotask(() =>
        setDisplayValue(
          useThousandSeparator ? formatNumberWithCommas(value) : String(value)
        )
      );
    }
  }, [value, useThousandSeparator]);

  // Generate recommendations when display value changes
  useEffect(() => {
    if (showRecommendations && displayValue && !disabled) {
      const recs = generateRecommendations(
        displayValue,
        recommendationMultipliers
      );
      queueMicrotask(() => {
        setRecommendations(recs);
        // Always show if recommendations exist (no focus dependency)
        setShowSuggestions(recs.length > 0);
      });
    } else {
      queueMicrotask(() => {
        setShowSuggestions(false);
        setRecommendations([]);
      });
    }
  }, [
    displayValue,
    showRecommendations,
    recommendationMultipliers,
    disabled,
  ]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;

    // Allow empty value
    if (inputValue === "") {
      setDisplayValue("");
      onChange("");
      return;
    }

    // Detect if the user just typed a comma (vi-VN keyboard decimal separator).
    // Compare with previous displayValue to find what was inserted.
    // If the new character is a comma and the input doesn't already have a dot,
    // treat it as a decimal separator and convert to dot.
    if (!inputValue.includes(".") && inputValue.includes(",")) {
      // Count commas in new input vs old display value to detect user-typed comma
      const oldCommaCount = (displayValue.match(/,/g) || []).length;
      const newCommaCount = (inputValue.match(/,/g) || []).length;

      if (newCommaCount > oldCommaCount) {
        // User typed a new comma — treat as decimal separator.
        // Convert the last comma (the newly typed one) to a dot,
        // and strip all other commas (thousand separators from formatting).
        const cursorCommaIdx = inputValue.lastIndexOf(",");
        const before = inputValue.substring(0, cursorCommaIdx).replace(/,/g, "");
        const after = inputValue.substring(cursorCommaIdx + 1).replace(/,/g, "");
        inputValue = before + "." + after;
      }
    }

    // Basic validation: only allow digits, decimal point, comma, and minus
    // This prevents letters and special characters while allowing flexible typing
    if (!/^-?[\d,]*\.?\d*$/.test(inputValue)) {
      // Reject invalid characters
      return;
    }

    // Parse and update form value (numeric)
    const cleanValue = parseNumberWithCommas(inputValue);
    const numValue = parseFloat(cleanValue);

    // Allow valid numbers or trailing decimal point (for typing "100.")
    if (!isNaN(numValue) || inputValue.endsWith(".")) {
      // Keep raw input during typing to prevent cursor jumping
      // Formatting happens on blur only
      setDisplayValue(inputValue);
      onChange(numValue);
    }
  };

  // Handle blur to reformat display value
  const handleBlur = () => {
    // Reformat display value on blur
    if (displayValue !== "" && useThousandSeparator) {
      const cleanValue = parseNumberWithCommas(displayValue);
      const numValue = parseFloat(cleanValue);

      if (!isNaN(numValue)) {
        setDisplayValue(formatNumberWithCommas(numValue));
      }
    }

    // Call original onBlur
    onBlur();
  };

  // Handle recommendation selection
  const handleSelectRecommendation = (value: number) => {
    const formatted = formatNumberWithCommas(value);
    setDisplayValue(formatted);
    onChange(value); // Update form value
    setShowSuggestions(false); // Hide after selection
    onRecommendationSelect?.(value);
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const hasError = !!error;
  const errorId = `${props.name}-error`;
  const helperId = `${props.name}-helper`;

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      {label && (
        <Label htmlFor={props.name} required={required}>
          {label}
        </Label>
      )}
      <div className={cn("relative", label && "mt-1 sm:mt-1.5")}>
        {prefix && (
 <span className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-v2-text-tertiary text-sm sm:text-base pointer-events-none z-10">
            {prefix}
          </span>
        )}
        <input
          id={props.name}
          type="text"
          inputMode="decimal"
          placeholder={placeholder}
          disabled={disabled}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          ref={ref}
          className={cn(
            "w-full text-sm sm:text-base min-h-[44px] sm:min-h-[48px]",
            "px-3 sm:px-4 py-2.5 sm:py-3",
            "rounded-lg",
            "border transition-all duration-200",
 "bg-v2-bg-dark",
 "text-v2-gold-accent",
 "placeholder:text-v2-text-tertiary",
            // Focus states - single ring (clean, modern)
            "focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent",
            // Error states
            hasError &&
              "border-v2-red-negative focus:ring-v2-red-negative focus:border-transparent",
            !hasError &&
 "border-v2-border-light hover:border-v2-border-light",
            // Disabled states
 "disabled:opacity-40 disabled:cursor-not-allowed",
            // Spacing for prefix/suffix
            prefix && "pl-8 sm:pl-10",
            suffix && "pr-8 sm:pr-12",
          )}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={cn(
            hasError && errorId,
            helperText && !hasError && helperId,
          )}
        />
        {suffix && (
 <span className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-v2-text-tertiary text-sm sm:text-base pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {/* Number suggestions */}
      {showRecommendations && showSuggestions && recommendations.length > 0 && (
        <NumberSuggestions
          recommendations={recommendations.slice(0, maxRecommendations)}
          onSelect={handleSelectRecommendation}
          currency={suffix}
        />
      )}
      {/* Helper text */}
      {helperText && !hasError && (
        <p
          id={helperId}
 className="mt-1.5 text-xs sm:text-sm text-v2-text-tertiary"
        >
          {helperText}
        </p>
      )}
      {error && <ErrorMessage id={errorId}>{error.message}</ErrorMessage>}
    </div>
  );
};
