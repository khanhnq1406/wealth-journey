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
 <div className="bg-v2-bg-dark rounded-lg p-4 text-center">
 <div className="text-sm text-v2-text-tertiary mb-1">
          Amount
        </div>
 <div className="text-3xl font-bold text-v2-gold-accent flex items-center justify-center gap-1">
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
              "focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
              // Number keys
              key !== "⌫"
 ? "bg-v2-bg-dark text-v2-gold-accent shadow-sm hover:shadow-md border border-v2-border-light"
                : // Delete key
 "bg-v2-red-negative/10 text-v2-red-negative hover:bg-v2-red-negative/20 border border-v2-red-negative/30"
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
            "focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
            value && parseFloat(value) > 0
              ? "bg-v2-gold-primary text-white hover:bg-v2-gold-primary/80 shadow-md hover:shadow-lg"
 : "bg-v2-bg-surface-tint text-v2-text-tertiary cursor-not-allowed"
          )}
          aria-label={t("continue")}
        >
          {t("continue")}
        </button>
      )}
    </div>
  );
});
