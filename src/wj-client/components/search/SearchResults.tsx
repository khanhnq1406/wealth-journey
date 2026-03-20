"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import type { SearchResultItem, SearchResultType } from "./GlobalSearch";

interface SearchResultsProps {
  results: SearchResultItem[];
  searchQuery: string;
  selectedIndex: number;
  onResultClick: (result: SearchResultItem) => void;
  onSelectedIndexChange: (index: number) => void;
}

/**
 * Search Results Display Component
 *
 * Features:
 * - Grouped results by type
 * - Highlighted search terms
 * - Quick actions from results
 * - Empty state for no results
 * - Keyboard navigation support
 *
 * @example
 * ```tsx
 * <SearchResults
 *   results={searchResults}
 *   searchQuery="savings"
 *   selectedIndex={selectedIndex}
 *   onResultClick={handleResultClick}
 *   onSelectedIndexChange={setSelectedIndex}
 * />
 * ```
 */
export function SearchResults({
  results,
  searchQuery,
  selectedIndex,
  onResultClick,
  onSelectedIndexChange,
}: SearchResultsProps) {
  const router = useRouter();

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResultItem[]> = {
      wallet: [],
      transaction: [],
      investment: [],
      category: [],
    };

    results.forEach((result) => {
      if (groups[result.type]) {
        groups[result.type].push(result);
      }
    });

    return groups;
  }, [results]);

  // Get type configuration
  const getTypeConfig = (type: SearchResultType) => {
    const configs = {
      wallet: {
        label: "Wallets",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
 bgColor: "bg-primary-50",
 textColor: "text-primary-600",
 borderColor: "border-primary-200",
      },
      transaction: {
        label: "Transactions",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        ),
 bgColor: "bg-neutral-100",
 textColor: "text-neutral-600",
 borderColor: "border-neutral-200",
      },
      investment: {
        label: "Investments",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
 bgColor: "bg-accent-50",
 textColor: "text-accent-600",
 borderColor: "border-accent-200",
      },
      category: {
        label: "Categories",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        ),
 bgColor: "bg-secondary-50",
 textColor: "text-secondary-600",
 borderColor: "border-secondary-200",
      },
    };

    return configs[type];
  };

  if (results.length === 0) {
    return <EmptyState searchQuery={searchQuery} />;
  }

  let globalIndex = 0;

  return (
    <div className="py-2">
      {(Object.keys(groupedResults) as SearchResultType[]).map((type) => {
        const typeResults = groupedResults[type];
        if (typeResults.length === 0) return null;

        const config = getTypeConfig(type);

        return (
          <div key={type} className="mb-4 last:mb-0">
            {/* Type Header */}
            <div className={cn(
              "px-4 py-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
              config.textColor
            )}>
              {config.icon}
              <span>{config.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full",
                config.bgColor,
                config.textColor
              )}>
                {typeResults.length}
              </span>
            </div>

            {/* Results List */}
            <div className="space-y-1 px-2">
              {typeResults.map((result, index) => {
                const currentIndex = globalIndex++;
                const isSelected = selectedIndex === currentIndex;

                return (
                  <ResultItem
                    key={result.id}
                    result={result}
                    searchQuery={searchQuery}
                    isSelected={isSelected}
                    onClick={() => onResultClick(result)}
                    onHover={() => onSelectedIndexChange(currentIndex)}
                    typeConfig={config}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ResultItemProps {
  result: SearchResultItem;
  searchQuery: string;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
  typeConfig: {
    bgColor: string;
    textColor: string;
    borderColor: string;
  };
}

function ResultItem({ result, searchQuery, isSelected, onClick, onHover, typeConfig }: ResultItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "transition-all duration-150",
 "hover:bg-neutral-100",
        "group text-left",
 isSelected && "bg-neutral-100 ring-1 ring-neutral-300"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 p-2 rounded-lg",
        typeConfig.bgColor,
        typeConfig.textColor
      )}>
        {result.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-medium text-neutral-900 truncate">
            <HighlightedText text={result.title} query={searchQuery} />
          </p>
          {result.amount && (
 <span className="text-sm font-semibold text-neutral-700 flex-shrink-0">
              {result.amount}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
 <p className="text-xs text-neutral-500 truncate">
            {result.subtitle && <HighlightedText text={result.subtitle} query={searchQuery} />}
          </p>
          {result.date && (
 <span className="text-xs text-neutral-400 flex-shrink-0">
              {result.date}
            </span>
          )}
        </div>
      </div>

      {/* Arrow Icon (shown on hover) */}
      <svg
 className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -translate-x-1 group-hover:translate-x-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

interface HighlightedTextProps {
  text: string;
  query: string;
}

/**
 * Highlight matching text in search results
 */
function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
 <mark key={index} className="bg-primary-100 text-primary-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface EmptyStateProps {
  searchQuery: string;
}

/**
 * Empty state for no search results
 */
function EmptyState({ searchQuery }: EmptyStateProps) {
  const suggestions = useMemo(() => {
    if (!searchQuery) return [];

    const commonSuggestions = [
      "Wallet",
      "Transaction",
      "Investment",
      "Savings",
      "Expense",
      "Income",
      "Transfer",
      "Budget",
    ];

    return commonSuggestions.filter((s) =>
      s.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3);
  }, [searchQuery]);

  return (
    <div className="py-12 px-4 text-center">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
        <svg
 className="w-8 h-8 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

 <h3 className="text-base font-semibold text-neutral-900 mb-1">
        {searchQuery ? "No results found" : "Start searching"}
      </h3>

 <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
        {searchQuery
          ? `We couldn't find anything matching "${searchQuery}". Try different keywords or check for typos.`
          : "Search for wallets, transactions, and investments across your account."}
      </p>

      {/* Quick Action Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
 <span className="text-xs text-neutral-400">Try:</span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-full",
 "bg-neutral-100",
 "text-neutral-700",
 "hover:bg-neutral-200",
                "transition-colors"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Search Tips */}
 <div className="mt-8 pt-6 border-t border-neutral-200">
 <p className="text-xs text-neutral-400 mb-3">Search tips:</p>
 <ul className="text-xs text-neutral-500 space-y-1.5 max-w-xs mx-auto text-left">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Search by wallet name, transaction notes, or investment symbol</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Use partial keywords like &quot;save&quot; for &quot;Savings Account&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Search is not case-sensitive</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Quick action button for search results
 */
export function SearchQuickAction({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const variantStyles = {
 default: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
 primary: "bg-primary-50 text-primary-700 hover:bg-primary-100",
 danger: "bg-danger-50 text-danger-700 hover:bg-danger-100",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        variantStyles[variant]
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
