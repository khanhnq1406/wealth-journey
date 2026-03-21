"use client";

import React from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

/**
 * Global banner that shows currency conversion progress
 * Appears at the top of the screen when conversion is in progress
 */
export function CurrencyConversionProgress() {
  const { isConverting, currency } = useCurrency();

  if (!isConverting) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-v2-maroon-900 text-v2-gold-accent px-4 py-3 shadow-lg border-b border-v2-gold-primary/30">
      <div className="flex items-center justify-center gap-3">
        {/* Loading spinner */}
        <svg
          className="animate-spin h-5 w-5 text-v2-gold-primary"
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>

        {/* Message */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold text-v2-gold-accent">Converting currency to {currency}...</span>
          <span className="text-sm text-v2-text-secondary">
            This may take a few minutes. You can continue using the app.
          </span>
        </div>
      </div>
    </div>
  );
}
