"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon } from "@/components/icons";
import { Select, SelectOption } from "@/components/select/Select";
import { formatCurrencyImport } from "@/utils/currency-formatter";
import { FormSelect } from "@/components/forms/FormSelect";

export interface CategoryReviewSectionProps {
  transactions: ParsedTransaction[];
  onCategoryChange: (rowNumber: number, categoryId: number) => void;
  categories?: Array<{ id: number; name: string }>;
  currency?: string;
}

export const CategoryReviewSection = React.memo(function CategoryReviewSection({
  transactions,
  onCategoryChange,
  categories = [],
  currency = "VND",
}: CategoryReviewSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("import.categoryReview");

  // Memoize category options to avoid recreating on every render
  const categoryOptions = useMemo<SelectOption<string>[]>(() => {
    return categories.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
    }));
  }, [categories]);

  if (transactions.length === 0) {
    return null;
  }

  const handleAcceptAll = () => {
    transactions.forEach((tx) => {
      if (tx.suggestedCategoryId) {
        onCategoryChange(tx.rowNumber, tx.suggestedCategoryId);
      }
    });
  };

  const handleMarkAllUncategorized = () => {
    // Find the "Uncategorized" category ID from the categories list
    const uncategorizedCategory = categories.find(
      (cat) => cat.name === "Uncategorized",
    );
    const uncategorizedId = uncategorizedCategory?.id || 0;

    transactions.forEach((tx) => {
      onCategoryChange(tx.rowNumber, uncategorizedId);
    });
  };

  const getCategoryName = (categoryId?: number) => {
    if (categoryId === undefined || categoryId === null) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || `Category ${categoryId}`;
  };

  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 80) {
      return "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300";
    } else if (confidence >= 60) {
      return "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300";
    } else {
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    }
  };

  return (
    <div className="border border-neutral-200 dark:border-dark-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-neutral-50 dark:bg-dark-surface-hover hover:bg-neutral-100 dark:hover:bg-dark-surface-active transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏷️</span>
          <div className="text-left">
            <h3 className="font-semibold text-base text-neutral-900 dark:text-dark-text">
              {t("heading", { count: transactions.length })}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
            "transition-transform text-neutral-600 dark:text-neutral-400",
            expanded && "rotate-180",
          )}
          decorative
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="bg-white dark:bg-dark-surface">
          {/* Bulk Actions - Sticky on mobile */}
          <div className="sticky top-0 z-10 backdrop-blur-sm bg-white/95 dark:bg-dark-surface/95 p-4 pb-3 border-b border-neutral-200 dark:border-dark-border">
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleAcceptAll}
                size="sm"
                fullWidth
                className="min-h-[44px]"
              >
                <span className="mr-1">✓</span>
                {t("acceptAll")}
              </Button>
              <Button
                variant="secondary"
                onClick={handleMarkAllUncategorized}
                size="sm"
                fullWidth
                className="min-h-[44px]"
              >
                {t("markAllUncategorized")}
              </Button>
            </div>
          </div>

          {/* Transaction List */}
          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {transactions.map((tx) => {
              return (
                <div
                  key={tx.rowNumber}
                  className="p-4 bg-neutral-50 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border rounded-xl space-y-2"
                >
                  {/* Transaction Info */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <p className="text-sm font-medium text-neutral-900 dark:text-dark-text flex-1">
                        {tx.description}
                      </p>
                      <p className="text-base font-bold text-neutral-900 dark:text-dark-text">
                        {formatCurrencyImport(
                          tx.amount?.amount || 0,
                          tx.amount?.currency || currency,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-dark-text-tertiary">
                      <span className="inline-flex px-2 py-1 rounded-full bg-neutral-200 dark:bg-neutral-700">
                        {t("row", { n: tx.rowNumber })}
                      </span>
                      <span>•</span>
                      <span>{formatDate(tx.date)}</span>
                    </div>
                  </div>

                  {/* Suggested Category (if any) */}
                  {tx.suggestedCategoryId && (
                    <div className="p-3 bg-white dark:bg-dark-surface rounded-lg border border-neutral-200 dark:border-dark-border">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">
                          {t("suggested")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-neutral-900 dark:text-dark-text">
                            {getCategoryName(tx.suggestedCategoryId)}
                          </span>
                          <span
                            className={cn(
                              "px-2.5 py-1 text-xs font-semibold rounded-full",
                              getConfidenceBadgeClass(tx.categoryConfidence),
                            )}
                          >
                            {tx.categoryConfidence}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category Selector */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-dark-text-secondary mb-1">
                      {t("selectCategory")}
                    </label>
                    <FormSelect
                      options={categoryOptions}
                      value={String(tx.suggestedCategoryId || "")}
                      onChange={(value) => {
                        const categoryId = parseInt(value);
                        // Only update if we have a valid number (not NaN)
                        if (!isNaN(categoryId)) {
                          onCategoryChange(tx.rowNumber, categoryId);
                        }
                      }}
                      placeholder={t("selectCategoryPlaceholder")}
                      className="w-full min-h-[44px] text-base"
                      portal
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
