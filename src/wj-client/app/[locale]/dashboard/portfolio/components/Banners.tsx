"use client";

import React, { memo } from "react";
import { useTranslations } from "next-intl";

/**
 * UpdateProgressBanner component - shows during price update
 */
export const UpdateProgressBanner = memo(function UpdateProgressBanner() {
  const t = useTranslations("investment");
  return (
    <div className="bg-v2-maroon-900/80 border border-v2-gold-primary/30 rounded-lg p-4 flex items-center gap-3 animate-fade-in">
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
      <div className="flex-1">
        <p className="text-sm font-medium text-v2-gold-accent">
          {t("updateBanner.progressTitle")}
        </p>
        <p className="text-xs text-v2-text-secondary">
          {t("updateBanner.progressDescription")}
        </p>
      </div>
    </div>
  );
});

/**
 * UpdateSuccessBanner component - shows after successful price update
 */
export const UpdateSuccessBanner = memo(function UpdateSuccessBanner() {
  const t = useTranslations("investment");
  return (
    <div className="bg-v2-green-light border border-v2-border rounded-lg p-4 flex items-center gap-3 animate-fade-in">
      <svg
        className="h-5 w-5 text-v2-green-positive"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-medium text-v2-green-positive">
          {t("updateBanner.successTitle")}
        </p>
        <p className="text-xs text-v2-green-positive">
          {t("updateBanner.successDescription")}
        </p>
      </div>
    </div>
  );
});
