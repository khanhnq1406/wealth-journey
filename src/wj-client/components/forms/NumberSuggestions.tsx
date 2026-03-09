"use client";

import { useRef, useEffect, useState } from "react";
import { formatRecommendation } from "@/lib/utils/number-recommendations";

export interface NumberSuggestionsProps {
  /**
   * Array of recommended numeric values
   */
  recommendations: number[];

  /**
   * Callback when a recommendation is selected
   */
  onSelect: (value: number) => void;

  /**
   * Optional currency suffix to display in label
   */
  currency?: string;

  /**
   * Optional CSS class name
   */
  className?: string;
}

/**
 * NumberSuggestions Component
 *
 * Displays clickable chip buttons with recommended monetary values.
 * Supports keyboard navigation (Tab, Arrow keys, Enter, Space, Escape).
 *
 * @example
 * <NumberSuggestions
 *   recommendations={[12000, 120000, 1200000]}
 *   onSelect={(value) => console.log(value)}
 *   currency="VND"
 * />
 */
export function NumberSuggestions({
  recommendations,
  onSelect,
  currency,
  className = "",
}: NumberSuggestionsProps) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Reset focus when recommendations change
  useEffect(() => {
    setFocusedIndex(-1);
    chipRefs.current = chipRefs.current.slice(0, recommendations.length);
  }, [recommendations]);

  // Focus the chip at the given index
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < chipRefs.current.length) {
      chipRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleChipClick = (value: number) => {
    onSelect(value);
  };

  const handleChipKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    value: number
  ) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < recommendations.length - 1 ? prev + 1 : prev
        );
        break;

      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(value);
        break;

      case "Escape":
        e.preventDefault();
        // Blur current chip and propagate escape to parent
        e.currentTarget.blur();
        setFocusedIndex(-1);
        break;

      default:
        break;
    }
  };

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div
      className={`mt-2 ${className}`}
      role="group"
      aria-label={`Suggested amounts${currency ? ` in ${currency}` : ""}`}
    >
      {/* Label */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
        Suggestions:
      </div>

      {/* Chips container */}
      <div className="flex flex-wrap gap-2">
        {recommendations.map((value, index) => {
          const formatted = formatRecommendation(value);

          return (
            <button
              key={`${value}-${index}`}
              ref={(el) => {
                chipRefs.current[index] = el;
              }}
              type="button"
              onClick={() => handleChipClick(value)}
              onKeyDown={(e) => handleChipKeyDown(e, index, value)}
              tabIndex={index === 0 ? 0 : -1}
              className="
                px-3 py-2 min-h-[44px]
                bg-v2-green-light border border-v2-border
                text-v2-green-positive font-medium text-sm
                rounded-md
                hover:bg-v2-green-light
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-v2-red-primary focus:ring-offset-1
                transition-all duration-150
                dark:bg-green-900/20 dark:border-green-700
                dark:text-green-300 dark:hover:bg-green-900/30
              "
              aria-label={`Select ${formatted}${currency ? ` ${currency}` : ""}`}
            >
              {formatted}
            </button>
          );
        })}
      </div>
    </div>
  );
}
