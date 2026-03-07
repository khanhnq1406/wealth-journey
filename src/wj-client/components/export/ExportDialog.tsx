"use client";

import React, { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { BaseModal } from "@/components/modals/BaseModal";

export type ExportFormat = "csv" | "pdf" | "excel";
export type DateRange =
  | "last7days"
  | "last30days"
  | "last90days"
  | "ytd"
  | "custom"
  | "all";

export interface ExportOptions {
  format: ExportFormat;
  dateRange: DateRange;
  customStartDate?: Date;
  customEndDate?: Date;
  includeCharts: boolean;
  includeCategories: string[]; // Category IDs to include (empty = all)
  customBranding: boolean;
  fileName?: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void | Promise<void>;
  categories?: Array<{ id: string; name: string }>;
  title?: string;
  defaultFormat?: ExportFormat;
  defaultDateRange?: DateRange;
  isExporting?: boolean;
}

/**
 * Export Dialog Component
 *
 * Features:
 * - Format options: CSV, PDF (with charts), Excel
 * - Date range selection
 * - Include/exclude categories
 * - Include charts toggle
 * - Custom branding option
 * - Preview before export
 * - Mobile-friendly responsive design
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <ExportDialog
 *   isOpen={isExportOpen}
 *   onClose={() => setIsExportOpen(false)}
 *   onExport={async (options) => {
 *     // Handle export logic
 *     console.log('Exporting with options:', options);
 *   }}
 *   categories={categories}
 * />
 * ```
 */
export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  categories = [],
  title = "Export Data",
  defaultFormat = "csv",
  defaultDateRange = "last30days",
  isExporting: isExportingProp = false,
}: ExportDialogProps) {
  const t = useTranslations("export.dialog");

  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDateRange);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [customBranding, setCustomBranding] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setFormat(defaultFormat);
      setDateRange(defaultDateRange);
      setIncludeCharts(true);
      setCustomBranding(false);
      setSelectedCategories([]);
      setFileName("");
      setShowPreview(false);
    }
  }, [isOpen, defaultFormat, defaultDateRange]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);

    try {
      const options: ExportOptions = {
        format,
        dateRange,
        customStartDate:
          dateRange === "custom" && customStartDate
            ? new Date(customStartDate)
            : undefined,
        customEndDate:
          dateRange === "custom" && customEndDate
            ? new Date(customEndDate)
            : undefined,
        includeCharts,
        includeCategories: selectedCategories,
        customBranding,
        fileName: fileName || undefined,
      };

      await onExport(options);
      onClose();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, [
    format,
    dateRange,
    customStartDate,
    customEndDate,
    includeCharts,
    selectedCategories,
    customBranding,
    fileName,
    onExport,
    onClose,
  ]);

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(categories.map((c) => c.id));
  }, [categories]);

  const clearAllCategories = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  const getFormatInfo = (fmt: ExportFormat) => {
    const info = {
      csv: {
        name: "CSV",
        description: t("csvDescription"),
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
      },
      pdf: {
        name: "PDF",
        description: t("pdfDescription"),
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        ),
      },
      excel: {
        name: "Excel",
        description: t("excelDescription"),
        icon: (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
      },
    };
    return info[fmt];
  };

  // Map DateRange values to translation keys
  // "all" → "allTime", "custom" → "customRange", others match directly
  const getDateRangeLabel = (value: DateRange): string => {
    if (value === "all") return t("allTime");
    if (value === "custom") return t("customRange");
    return t(value as "last7days" | "last30days" | "last90days" | "ytd");
  };

  const dateRanges: Array<{ value: DateRange; label: string }> = [
    { value: "last7days", label: t("last7days") },
    { value: "last30days", label: t("last30days") },
    { value: "last90days", label: t("last90days") },
    { value: "ytd", label: t("ytd") },
    { value: "all", label: t("allTime") },
    { value: "custom", label: t("customRange") },
  ];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-2xl"
      fullScreenOnMobile={false}
    >
      <div className="space-y-6">
        {/* Export Format */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-3">
            {t("exportFormat")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["csv", "pdf", "excel"] as ExportFormat[]).map((fmt) => {
              const info = getFormatInfo(fmt);
              const isSelected = format === fmt;

              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={cn(
                    "relative flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left",
                    "hover:border-neutral-300 dark:hover:border-dark-border-light",
                    isSelected
                      ? "border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-950"
                      : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      isSelected
                        ? "text-primary-700 dark:text-primary-400"
                        : "text-neutral-600 dark:text-dark-text-secondary",
                    )}
                  >
                    {info.icon}
                    <span className="font-semibold">{info.name}</span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                    {info.description}
                  </p>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 dark:bg-primary-600 flex items-center justify-center">
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
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-3">
            {t("dateRange")}
          </label>
          <div className="flex flex-wrap gap-2">
            {dateRanges.map((range) => {
              const isSelected = dateRange === range.value;

              return (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => setDateRange(range.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    "hover:border-neutral-300 dark:hover:border-dark-border-light",
                    isSelected
                      ? "border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400"
                      : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface text-neutral-700 dark:text-dark-text-secondary",
                  )}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-dark-text-tertiary mb-1">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={cn(
                    "w-full px-3 sm:px-4 rounded-lg border text-sm sm:text-base",
                    "min-h-[44px] sm:min-h-[48px]",
                    "bg-white dark:bg-dark-surface-hover",
                    "border-neutral-300 dark:border-dark-border",
                    "text-neutral-900 dark:text-dark-text",
                    "transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                    "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary",
                  )}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-dark-text-tertiary mb-1">
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={cn(
                    "w-full px-3 sm:px-4 rounded-lg border text-sm sm:text-base",
                    "min-h-[44px] sm:min-h-[48px]",
                    "bg-white dark:bg-dark-surface-hover",
                    "border-neutral-300 dark:border-dark-border",
                    "text-neutral-900 dark:text-dark-text",
                    "transition-all duration-200",
                    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                    "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary",
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Categories Filter */}
        {categories.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text">
                {selectedCategories.length > 0
                  ? t("categoriesSelectedLabel", {
                      selected: `(${selectedCategories.length} selected)`,
                    })
                  : t("categoriesLabel").replace(":", "")}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllCategories}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t("selectAll")}
                </button>
                <button
                  type="button"
                  onClick={clearAllCategories}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {t("clearAll")}
                </button>
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto border border-neutral-200 dark:border-dark-border rounded-lg p-2 space-y-1">
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category.id);

                return (
                  <label
                    key={category.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary-50 dark:bg-primary-950"
                        : "hover:bg-neutral-50 dark:hover:bg-dark-surface-hover",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleCategory(category.id)}
                      className="w-4 h-4 rounded border-neutral-300 dark:border-dark-border text-primary-600 dark:text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-600"
                    />
                    <span className="text-sm text-neutral-700 dark:text-dark-text-secondary">
                      {category.name}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-dark-text-tertiary">
              {selectedCategories.length === 0
                ? t("allCategoriesIncluded")
                : t("categoriesSelected", {
                    count: selectedCategories.length,
                  })}
            </p>
          </div>
        )}

        {/* Additional Options */}
        <div className="space-y-3">
          {/* Include Charts (only for PDF) */}
          {/* {format === "pdf" && (
            <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-surface-hover cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 dark:border-dark-border text-primary-600 dark:text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-600"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-neutral-900 dark:text-dark-text">
                  Include charts
                </span>
                <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                  Add visual charts to the exported PDF
                </p>
              </div>
            </label>
          )} */}

          {/* Custom Branding */}
          {/* <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-surface-hover cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={customBranding}
              onChange={(e) => setCustomBranding(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-300 dark:border-dark-border text-primary-600 dark:text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-600"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-neutral-900 dark:text-dark-text">
                Custom branding
              </span>
              <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
                Include company logo and colors
              </p>
            </div>
          </label> */}

          {/* Custom File Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
              {t("fileNameOptional")}
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder={t("fileNamePlaceholder")}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                "bg-white dark:bg-dark-surface-hover",
                "border-neutral-300 dark:border-dark-border",
                "text-neutral-900 dark:text-dark-text",
                "focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary",
              )}
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-dark-text-tertiary">
              {t("fileNameHint")}
            </p>
          </div>
        </div>

        {/* Preview Toggle */}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="w-full flex items-center justify-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          <svg
            className={cn(
              "w-4 h-4 transition-transform",
              showPreview && "rotate-180",
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
          {showPreview ? t("hidePreview") : t("showPreview")}
        </button>

        {/* Preview */}
        {showPreview && (
          <div className="p-4 bg-neutral-100 dark:bg-dark-surface-hover rounded-lg border border-neutral-200 dark:border-dark-border">
            <h4 className="text-xs font-semibold text-neutral-500 dark:text-dark-text-tertiary uppercase tracking-wider mb-3">
              {t("exportSummary")}
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-dark-text-tertiary">
                  {t("formatLabel")}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-dark-text">
                  {getFormatInfo(format).name}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-dark-text-tertiary">
                  {t("dateRangeLabel")}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-dark-text">
                  {dateRanges.find((r) => r.value === dateRange)?.label ||
                    getDateRangeLabel(dateRange)}
                </dd>
              </div>
              {format === "pdf" && (
                <div className="flex justify-between">
                  <dt className="text-neutral-600 dark:text-dark-text-tertiary">
                    {t("chartsLabel")}
                  </dt>
                  <dd className="font-medium text-neutral-900 dark:text-dark-text">
                    {includeCharts ? t("included") : t("excluded")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-dark-text-tertiary">
                  {t("categoriesLabel")}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-dark-text">
                  {selectedCategories.length === 0
                    ? t("allSelected")
                    : `${selectedCategories.length} selected`}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600 dark:text-dark-text-tertiary">
                  {t("brandingLabel")}
                </dt>
                <dd className="font-medium text-neutral-900 dark:text-dark-text">
                  {customBranding ? t("customBranding") : t("standardBranding")}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-6 pt-4 border-t border-neutral-200 dark:border-dark-border">
        <Button
          type={ButtonType.SECONDARY}
          onClick={onClose}
          disabled={isExporting}
        >
          {t("cancel")}
        </Button>
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleExport}
          loading={isExporting}
        >
          {isExporting ? t("exporting") : t("export")}
        </Button>
      </div>
    </BaseModal>
  );
}

/**
 * Quick export button component
 */
export function ExportButton({
  onExport,
  categories,
  isExporting = false,
  className,
}: {
  onExport: (options: ExportOptions) => void | Promise<void>;
  categories?: Array<{ id: string; name: string }>;
  isExporting?: boolean;
  className?: string;
}) {
  const t = useTranslations("export.dialog");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type={ButtonType.SECONDARY}
        onClick={() => setIsOpen(true)}
        disabled={isExporting}
        className={className}
      >
        {isExporting ? (
          <>
            <svg
              className="w-4 h-4 mr-2 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {t("exporting")}
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {t("export")}
          </>
        )}
      </Button>

      <ExportDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onExport={onExport}
        categories={categories}
        isExporting={isExporting}
      />
    </>
  );
}
