"use client";

import { useTranslations } from "next-intl";

type TransactionFilterProps = {
  filterType: "all" | "income" | "expense";
  onFilterChange: (type: "all" | "income" | "expense") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export const TransactionFilter = ({
  filterType,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: TransactionFilterProps) => {
  const t = useTranslations("transaction");
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      {/* Filter Tabs */}
      <div className="flex gap-2" role="tablist" aria-label={t("filter.filterBy", { label: t("title").toLowerCase() })}>
        <button
          onClick={() => onFilterChange("all")}
          role="tab"
          aria-selected={filterType === "all"}
          className={`px-4 py-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 ${
            filterType === "all"
              ? "bg-v2-red-primary text-white"
              : "bg-v2-maroon-900 text-v2-gold-accent hover:bg-v2-maroon-800"
          }`}
        >
          {t("quickFilters.all")}
        </button>
        <button
          onClick={() => onFilterChange("income")}
          role="tab"
          aria-selected={filterType === "income"}
          className={`px-4 py-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 ${
            filterType === "income"
              ? "bg-v2-green-positive text-white"
              : "bg-v2-maroon-900 text-v2-gold-accent hover:bg-v2-maroon-800"
          }`}
        >
          {t("quickFilters.income")}
        </button>
        <button
          onClick={() => onFilterChange("expense")}
          role="tab"
          aria-selected={filterType === "expense"}
          className={`px-4 py-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 ${
            filterType === "expense"
              ? "bg-v2-red-negative text-white"
              : "bg-v2-maroon-900 text-v2-gold-accent hover:bg-v2-maroon-800"
          }`}
        >
          {t("quickFilters.expense")}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative w-full sm:w-64">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2 pl-10 bg-v2-maroon-900 text-v2-gold-accent border-2 border-v2-gold-primary/20 rounded-lg focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2 focus:border-v2-red-primary placeholder:text-v2-text-placeholder"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-v2-text-tertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
  );
};
