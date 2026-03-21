"use client";

import { useTranslations } from "next-intl";
import { TransactionFilters } from "./TransactionFilterModal";

interface ActiveFilterChipsProps {
  filters: TransactionFilters;
  walletOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  onRemoveFilter: (filterType: keyof TransactionFilters) => void;
  onClearAll: () => void;
}

/**
 * Horizontal scrollable filter chips showing active filters.
 * Displays as removable chips for each active filter.
 */
export function ActiveFilterChips({
  filters,
  walletOptions,
  categoryOptions,
  onRemoveFilter,
  onClearAll,
}: ActiveFilterChipsProps) {
  const t = useTranslations("common");
  const tf = useTranslations("transaction.filter");
  const activeFilters = getActiveFilters(
    filters,
    walletOptions,
    categoryOptions,
    t,
    tf,
  );

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 md:px-6 py-2 border-b border-v2-border-light">
      {/* Horizontal scrollable chips */}
      <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-v2-border-light scrollbar-track-transparent">
        <div className="flex gap-2 flex-nowrap">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => onRemoveFilter(filter.key as keyof TransactionFilters)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-v2-bg-dark text-v2-text-secondary rounded-full text-sm font-medium whitespace-nowrap hover:bg-v2-bg-surface-tint active:bg-v2-bg-surface-tint transition-colors min-h-[36px] focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2"
              aria-label={tf("removeFilter", { label: filter.label })}
            >
              <span>{filter.label}:</span>
              <span className="font-semibold">{filter.value}</span>
              <svg
                className="w-4 h-4 ml-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Clear All button */}
      <button
        onClick={onClearAll}
        className="flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-700 active:text-red-800 transition-colors min-h-[36px] px-2 focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 rounded"
        aria-label={t("clearAll")}
      >
        {t("clearAll")}
      </button>
    </div>
  );
}

interface FilterChip {
  key: keyof TransactionFilters;
  label: string;
  value: string;
}

function getActiveFilters(
  filters: TransactionFilters,
  walletOptions: { value: string; label: string }[],
  categoryOptions: { value: string; label: string }[],
  t: (key: string) => string,
  tf: (key: string) => string,
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.walletId) {
    const wallet = walletOptions.find((w) => w.value === filters.walletId);
    if (wallet) {
      chips.push({ key: "walletId", label: t("wallet"), value: wallet.label });
    }
  }

  if (filters.categoryFilter) {
    const category = categoryOptions.find(
      (c) => c.value === filters.categoryFilter,
    );
    if (category) {
      chips.push({
        key: "categoryFilter",
        label: t("category"),
        value: category.label,
      });
    }
  }

  if (filters.searchQuery) {
    chips.push({
      key: "searchQuery",
      label: t("search"),
      value: filters.searchQuery.length > 15
        ? `${filters.searchQuery.substring(0, 15)}...`
        : filters.searchQuery,
    });
  }

  // Handle amount range filter
  if (filters.amountRange?.min || filters.amountRange?.max) {
    const min = filters.amountRange.min;
    const max = filters.amountRange.max;
    let value = "";
    if (min && max) {
      value = `${min.toLocaleString()} - ${max.toLocaleString()}`;
    } else if (min) {
      value = `≥ ${min.toLocaleString()}`;
    } else if (max) {
      value = `≤ ${max.toLocaleString()}`;
    }
    chips.push({
      key: "amountRange",
      label: t("amount"),
      value,
    });
  }

  // Handle date range filter
  if (filters.dateRange?.start || filters.dateRange?.end) {
    const start = filters.dateRange.start;
    const end = filters.dateRange.end;
    let value = "";
    if (start && end) {
      value = `${start} - ${end}`;
    } else if (start) {
      value = `${t("from")} ${start}`;
    } else if (end) {
      value = `${tf("until")} ${end}`;
    }
    chips.push({
      key: "dateRange",
      label: t("date"),
      value,
    });
  }

  return chips;
}
