"use client";

import { memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { formatNumberWithCommas } from "@/lib/utils/number-format";

export interface AmountKeypadProps {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  onSubmit?: () => void;
  maxLength?: number;
  className?: string;
}

const KEY_LAYOUT = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

/**
 * Mobile-friendly amount keypad for transaction entry.
 * Touch-friendly 44px+ buttons with haptic feedback.
 */
export const AmountKeypad = memo(function AmountKeypad({
  value,
  onChange,
  currency = "VND",
  onSubmit,
  maxLength = 12,
  className,
}: AmountKeypadProps) {
  const t = useTranslations("common");
  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === "⌫") {
        // Delete last character
        onChange(value.slice(0, -1));
      } else if (key === ".") {
        // Only allow one decimal point
        if (!value.includes(".")) {
          onChange(value + ".");
        }
      } else {
        // Digit input
        if (value.length < maxLength) {
          onChange(value + key);
        }
      }
    },
    [value, onChange, maxLength]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Display */}
      <div className="bg-gray-100 dark:bg-dark-surface-hover rounded-lg p-4 text-center">
        <div className="text-sm text-gray-500 dark:text-dark-text-tertiary mb-1">
          Amount
        </div>
        <div className="text-3xl font-bold text-gray-900 dark:text-dark-text flex items-center justify-center gap-1">
          <span className="text-lg">{currency}</span>
          <span>{formatNumberWithCommas(value) || "0"}</span>
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEY_LAYOUT.flat().map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            className={cn(
              "min-h-[56px] rounded-lg font-semibold text-xl transition-all duration-150",
              "active:scale-95 active:shadow-inner",
              "focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2",
              // Number keys
              key !== "⌫"
                ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text shadow-sm hover:shadow-md border border-gray-200 dark:border-dark-border"
                : // Delete key
                  "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/30 border border-danger-200 dark:border-danger-800"
            )}
            aria-label={key === "⌫" ? "Delete" : `Digit ${key}`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Submit button */}
      {onSubmit && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value || parseFloat(value) === 0}
          className={cn(
            "w-full min-h-[52px] rounded-lg font-semibold text-lg transition-all duration-150",
            "active:scale-95 active:shadow-inner",
            "focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2",
            value && parseFloat(value) > 0
              ? "bg-v2-red-primary text-white hover:bg-v2-red-dark shadow-md hover:shadow-lg"
              : "bg-gray-200 dark:bg-dark-surface-hover text-gray-400 dark:text-dark-text-tertiary cursor-not-allowed"
          )}
          aria-label={t("continue")}
        >
          {t("continue")}
        </button>
      )}
    </div>
  );
});
