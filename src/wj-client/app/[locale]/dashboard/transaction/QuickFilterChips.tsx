"use client";

import { memo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type QuickFilterType =
  | "all"
  | "income"
  | "expense"
  | "today"
  | "week"
  | "month";

export interface QuickFilterChip {
  type: QuickFilterType;
  label: string;
  icon?: React.ReactNode;
}

export interface QuickFilterChipsProps {
  activeFilter: QuickFilterType;
  onFilterChange: (filter: QuickFilterType) => void;
  className?: string;
}

const QUICK_FILTER_KEYS: { type: QuickFilterType; labelKey: string }[] = [
  { type: "all", labelKey: "all" },
  { type: "income", labelKey: "income" },
  { type: "expense", labelKey: "expense" },
  { type: "today", labelKey: "today" },
  { type: "week", labelKey: "thisWeek" },
  { type: "month", labelKey: "thisMonth" },
];

const FilterIcon = memo(function FilterIcon({
  type,
}: {
  type: QuickFilterType;
}) {
  switch (type) {
    case "income":
      return (
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      );
    case "expense":
      return (
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
            d="M20 12H4"
          />
        </svg>
      );
    case "today":
      return (
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "week":
      return (
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case "month":
      return (
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    default:
      return null;
  }
});

/**
 * Quick filter chips for common transaction filters.
 * Horizontal scrollable on mobile with touch-friendly selection.
 */
export const QuickFilterChips = memo(function QuickFilterChips({
  activeFilter,
  onFilterChange,
  className,
}: QuickFilterChipsProps) {
  const t = useTranslations("transaction.quickFilters");
  const tf = useTranslations("transaction.filter");
  const QUICK_FILTERS: QuickFilterChip[] = QUICK_FILTER_KEYS.map((qf) => ({
    type: qf.type,
    label: t(qf.labelKey),
  }));
  const handleFilterClick = useCallback(
    (filterType: QuickFilterType) => {
      onFilterChange(filterType);
    },
    [onFilterChange],
  );

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-v2-border-light scrollbar-track-transparent sm:pb-0",
        "snap-x snap-mandatory",
        className,
      )}
    >
      {QUICK_FILTERS.map((filter) => {
        const isActive = activeFilter === filter.type;

        return (
          <button
            key={filter.type}
            onClick={() => handleFilterClick(filter.type)}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200",
              "snap-start",
              "min-h-[44px] focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2",
              // Active state
              isActive
                ? "bg-v2-gold-primary text-v2-bg-dark shadow-md"
 : "bg-v2-bg-dark text-white border border-v2-border-light hover:bg-v2-bg-surface-tint active:bg-v2-bg-surface-tint",
            )}
            aria-pressed={isActive}
            aria-label={tf("filterBy", { label: filter.label.toLowerCase() })}
          >
            {filter.icon || <FilterIcon type={filter.type} />}
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
});
