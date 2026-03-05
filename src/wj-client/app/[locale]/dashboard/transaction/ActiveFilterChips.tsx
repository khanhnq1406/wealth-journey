"use client";

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
  const activeFilters = getActiveFilters(
    filters,
    walletOptions,
    categoryOptions,
  );

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 md:px-6 py-2 border-b border-gray-200">
      {/* Horizontal scrollable chips */}
      <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        <div className="flex gap-2 flex-nowrap">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => onRemoveFilter(filter.key as keyof TransactionFilters)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium whitespace-nowrap hover:bg-primary-100 active:bg-primary-200 transition-colors min-h-[36px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              aria-label={`Remove ${filter.label} filter`}
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
        className="flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-700 active:text-red-800 transition-colors min-h-[36px] px-2 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
        aria-label="Clear all filters"
      >
        Clear All
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
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.walletId) {
    const wallet = walletOptions.find((w) => w.value === filters.walletId);
    if (wallet) {
      chips.push({ key: "walletId", label: "Wallet", value: wallet.label });
    }
  }

  if (filters.categoryFilter) {
    const category = categoryOptions.find(
      (c) => c.value === filters.categoryFilter,
    );
    if (category) {
      chips.push({
        key: "categoryFilter",
        label: "Category",
        value: category.label,
      });
    }
  }

  if (filters.searchQuery) {
    chips.push({
      key: "searchQuery",
      label: "Search",
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
      label: "Amount",
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
      value = `From ${start}`;
    } else if (end) {
      value = `Until ${end}`;
    }
    chips.push({
      key: "dateRange",
      label: "Date",
      value,
    });
  }

  return chips;
}
