"use client";

import React, { memo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import Image from "next/image";
import { ButtonType, resources } from "@/app/constants";

/**
 * Period type for report filtering
 */
export type PeriodType =
  | "this-month"
  | "last-month"
  | "this-quarter"
  | "last-quarter"
  | "this-year"
  | "last-year"
  | "custom";

/**
 * Date range structure
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Period selector component props
 */
export interface PeriodSelectorProps {
  /** Currently selected period */
  selectedPeriod: PeriodType;
  /** Custom date range (when period is "custom") */
  customRange?: DateRange;
  /** Callback when period changes */
  onPeriodChange: (period: PeriodType, range?: DateRange) => void;
  /** Whether to show compare toggle */
  showCompare?: boolean;
  /** Whether comparison is enabled */
  compareWithPrevious?: boolean;
  /** Callback when compare toggle changes */
  onCompareChange?: (enabled: boolean) => void;
  /** Minimum date for custom range (optional) */
  minDate?: Date;
  /** Maximum date for custom range (optional) */
  maxDate?: Date;
}

/**
 * Period option configuration
 */
interface PeriodOption {
  value: PeriodType;
  label: string;
  getRange: () => DateRange;
}

/**
 * Get date range for a period type
 */
export function getDateRangeForPeriod(period: PeriodType): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case "this-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      };

    case "last-month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      };

    case "this-quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      return {
        start: new Date(now.getFullYear(), quarter * 3, 1),
        end: new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59),
      };

    case "last-quarter":
      const lastQuarter = Math.floor((now.getMonth() - 3) / 3);
      return {
        start: new Date(now.getFullYear(), lastQuarter * 3, 1),
        end: new Date(now.getFullYear(), lastQuarter * 3 + 3, 0, 23, 59, 59),
      };

    case "this-year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
      };

    case "last-year":
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59),
      };

    case "custom":
      return {
        start: today,
        end: today,
      };

    default:
      return {
        start: today,
        end: today,
      };
  }
}

/**
 * Period option values (labels resolved via translations inside component)
 */
const PERIOD_VALUES: { value: PeriodType; labelKey: string }[] = [
  { value: "this-month", labelKey: "thisMonth" },
  { value: "last-month", labelKey: "lastMonth" },
  { value: "this-quarter", labelKey: "thisQuarter" },
  { value: "last-quarter", labelKey: "lastQuarter" },
  { value: "this-year", labelKey: "thisYear" },
  { value: "last-year", labelKey: "lastYear" },
  { value: "custom", labelKey: "custom" },
];

/**
 * Format date for display using the given locale
 */
function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * PeriodSelector - Report period selector with presets and custom date range picker
 *
 * Features:
 * - Preset periods (This Month, Last Month, This Quarter, Custom)
 * - Date range picker for custom periods
 * - Compare with previous period toggle
 * - Quick navigation arrows
 * - Responsive mobile layout
 */
export const PeriodSelector = memo(function PeriodSelector({
  selectedPeriod,
  customRange,
  onPeriodChange,
  showCompare = true,
  compareWithPrevious = false,
  onCompareChange,
  minDate,
  maxDate,
}: PeriodSelectorProps) {
  const t = useTranslations("report.periods");
  const tr = useTranslations("report");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");

  const PERIOD_OPTIONS: PeriodOption[] = PERIOD_VALUES.map((pv) => ({
    value: pv.value,
    label: t(pv.labelKey),
    getRange: () => getDateRangeForPeriod(pv.value),
  }));

  const currentRange =
    selectedPeriod === "custom" && customRange
      ? customRange
      : PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)?.getRange();

  const handlePeriodSelect = (period: PeriodType) => {
    if (period === "custom") {
      setShowCustomPicker(true);
      if (customRange) {
        setTempStartDate(customRange.start.toISOString().split("T")[0]);
        setTempEndDate(customRange.end.toISOString().split("T")[0]);
      }
    } else {
      setShowCustomPicker(false);
      const range = getDateRangeForPeriod(period);
      onPeriodChange(period, range);
    }
  };

  const handleCustomDateApply = () => {
    if (tempStartDate && tempEndDate) {
      const range: DateRange = {
        start: new Date(tempStartDate),
        end: new Date(tempEndDate),
      };
      onPeriodChange("custom", range);
      setShowCustomPicker(false);
    }
  };

  const navigatePeriod = (direction: "prev" | "next") => {
    const currentIndex = PERIOD_OPTIONS.findIndex(
      (opt) => opt.value === selectedPeriod,
    );
    if (currentIndex === -1) return;

    let newIndex = currentIndex + (direction === "next" ? 1 : -1);
    if (newIndex < 0) newIndex = PERIOD_OPTIONS.length - 1;
    if (newIndex >= PERIOD_OPTIONS.length) newIndex = 0;

    const nextPeriod = PERIOD_OPTIONS[newIndex];
    handlePeriodSelect(nextPeriod.value);
  };

  return (
    <BaseCard className="p-4">
      <div className="space-y-4">
        {/* Period Presets */}
        <div>
          <label className="text-sm font-medium text-neutral-700 mb-2 block">
            {tc("period")}
          </label>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.filter((opt) => opt.value !== "custom").map(
              (option) => (
                <button
                  key={option.value}
                  onClick={() => handlePeriodSelect(option.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === option.value
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {option.label}
                </button>
              ),
            )}
            <button
              onClick={() => handlePeriodSelect("custom")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === "custom"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {t("custom")}
            </button>
          </div>
        </div>

        {/* Current Range Display with Navigation */}
        {currentRange && (
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
            <button
              onClick={() => navigatePeriod("prev")}
              className="p-1 rounded hover:bg-neutral-200 transition-colors"
              aria-label={tc("previousPeriod")}
            >
              <Image
                src={`${resources}/chevron-left.svg`}
                alt="Previous"
                width={16}
                height={16}
              />
            </button>

            <div className="text-center">
              <div className="text-sm text-neutral-600">
                {selectedPeriod === "custom"
                  ? t("custom")
                  : PERIOD_OPTIONS.find((opt) => opt.value === selectedPeriod)
                      ?.label}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {formatDate(currentRange.start, locale)} -{" "}
                {formatDate(currentRange.end, locale)}
              </div>
            </div>

            <button
              onClick={() => navigatePeriod("next")}
              className="p-1 rounded hover:bg-neutral-200 transition-colors"
              aria-label={tc("nextPeriod")}
            >
              <Image
                src={`${resources}/chevron-right.svg`}
                alt="Next"
                width={16}
                height={16}
              />
            </button>
          </div>
        )}

        {/* Custom Date Range Picker */}
        {showCustomPicker && (
          <div className="p-4 bg-neutral-50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  min={minDate?.toISOString().split("T")[0]}
                  max={maxDate?.toISOString().split("T")[0]}
 className="w-full px-3 sm:px-4 rounded-lg border min-h-[44px] sm:min-h-[48px] text-sm sm:text-base border-neutral-300 bg-white text-neutral-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={minDate?.toISOString().split("T")[0]}
                  max={maxDate?.toISOString().split("T")[0]}
 className="w-full px-3 sm:px-4 rounded-lg border min-h-[44px] sm:min-h-[48px] text-sm sm:text-base border-neutral-300 bg-white text-neutral-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type={ButtonType.PRIMARY}
                onClick={handleCustomDateApply}
                className="flex-1"
                disabled={!tempStartDate || !tempEndDate}
              >
                {t("applyRange")}
              </Button>
              <Button
                type={ButtonType.SECONDARY}
                onClick={() => setShowCustomPicker(false)}
                className="flex-1"
              >
                {tc("cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Compare Toggle */}
        {showCompare && onCompareChange && (
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
            <span className="text-sm text-neutral-700">
              {tr("compareWithPrevious")}
            </span>
            <button
              onClick={() => onCompareChange(!compareWithPrevious)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                compareWithPrevious ? "bg-neutral-900" : "bg-neutral-300"
              }`}
              role="switch"
              aria-checked={compareWithPrevious}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  compareWithPrevious ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </BaseCard>
  );
});
