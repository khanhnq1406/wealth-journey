"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  useQueryListWallets,
  useQueryListTransactions,
  useQueryListInvestments,
} from "@/utils/generated/hooks";
import {
  EVENT_WalletListWallets,
  EVENT_TransactionListTransactions,
  EVENT_InvestmentListInvestments,
} from "@/utils/generated/hooks";
import { ZIndex } from "@/lib/utils/z-index";

// Storage key for recent searches
const RECENT_SEARCHES_KEY = "wealthjourney-recent-searches";
const MAX_RECENT_SEARCHES = 5;

// Search result item types
export type SearchResultType =
  | "wallet"
  | "transaction"
  | "investment"
  | "category";

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  amount?: string;
  date?: string;
  url: string;
  icon: React.ReactNode;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Global Search Component
 *
 * Features:
 * - Keyboard shortcut (Cmd/Ctrl + K)
 * - Search across transactions, wallets, investments
 * - Recent searches with localStorage persistence
 * - Search suggestions
 * - Quick navigation to results
 * - Modal-style dropdown interface
 *
 * Usage:
 * ```tsx
 * const [isSearchOpen, setIsSearchOpen] = useState(false);
 * useEffect(() => {
 *   const handleKeyDown = (e: KeyboardEvent) => {
 *     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 *       e.preventDefault();
 *       setIsSearchOpen(true);
 *     }
 *   };
 *   document.addEventListener('keydown', handleKeyDown);
 *   return () => document.removeEventListener('keydown', handleKeyDown);
 * }, []);
 *
 * <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
 * ```
 */
export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const t = useTranslations("search.globalSearch");
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Fetch data for search
  const { data: walletsData } = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { enabled: isOpen, refetchOnMount: "always" },
  );

  const { data: transactionsData } = useQueryListTransactions(
    {
      pagination: { page: 1, pageSize: 100, orderBy: "", order: "" },
      filter: undefined,
      sortField: "date" as any,
      sortOrder: "" as any,
    },
    { enabled: isOpen, refetchOnMount: "always" },
  );

  const { data: investmentsData } = useQueryListInvestments(
    {
      pagination: { page: 1, pageSize: 100, orderBy: "", order: "" },
      walletId: 0,
      typeFilter: undefined as any,
    },
    { enabled: isOpen, refetchOnMount: "always" },
  );

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
        if (stored) {
          queueMicrotask(() => setRecentSearches(JSON.parse(stored)));
        }
      } catch (e) {
        console.error("Failed to load recent searches:", e);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== query.toLowerCase(),
      );
      const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to save recent searches:", e);
        }
      }

      return updated;
    });
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      queueMicrotask(() => setSelectedIndex(-1));
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Perform search
  const searchResults = useMemo((): SearchResultItem[] => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResultItem[] = [];

    // Search wallets
    walletsData?.wallets?.forEach((wallet) => {
      if (wallet.walletName?.toLowerCase().includes(query)) {
        results.push({
          id: `wallet-${wallet.id}`,
          type: "wallet",
          title: wallet.walletName,
          // eslint-disable-next-line react-hooks/exhaustive-deps
          subtitle: wallet.type === 0 ? t("basicWallet") : t("investmentWallet"),
          amount: formatCurrency(wallet.balance, wallet.currency),
          url: `/dashboard/wallets`,
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          ),
        });
      }
    });

    // Search transactions
    transactionsData?.transactions?.forEach((transaction) => {
      if (transaction.note?.toLowerCase().includes(query)) {
        results.push({
          id: `transaction-${transaction.id}`,
          type: "transaction",
          title: transaction.note || "Transaction",
          subtitle: `Category #${transaction.categoryId}`,
          amount: formatCurrency(
            transaction.displayAmount || transaction.amount,
            transaction.displayCurrency || transaction.currency || "VND",
          ),
          date: transaction.date
            ? new Date(transaction.date * 1000).toLocaleDateString()
            : undefined,
          url: `/dashboard/transaction`,
          icon:
            transaction.type === 0 ? (
              <svg
                className="w-5 h-5 text-danger-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-success-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
            ),
        });
      }
    });

    // Search investments
    investmentsData?.data?.forEach((investment) => {
      if (
        investment.symbol?.toLowerCase().includes(query) ||
        investment.name?.toLowerCase().includes(query)
      ) {
        results.push({
          id: `investment-${investment.id}`,
          type: "investment",
          title: investment.symbol || "Investment",
          subtitle: investment.name || "",
          amount: t("shares", {
            count: investment.quantity?.toLocaleString() ?? 0,
          }),
          url: `/dashboard/portfolio`,
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
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          ),
        });
      }
    });

    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, walletsData, transactionsData, investmentsData, t]);

  // Get search suggestions based on recent searches
  const suggestionResults = useMemo((): string[] => {
    if (!searchQuery.trim()) return recentSearches;

    const query = searchQuery.toLowerCase();
    const suggestions = recentSearches.filter((s) =>
      s.toLowerCase().includes(query),
    );
    return suggestions.slice(0, 3);
  }, [searchQuery, recentSearches]);

  // Handle result click
  const handleResultClick = useCallback(
    (result: SearchResultItem) => {
      saveRecentSearch(searchQuery);
      router.push(result.url);
      onClose();
      setSearchQuery("");
    },
    [router, onClose, saveRecentSearch, searchQuery],
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setSearchQuery(suggestion);
      saveRecentSearch(suggestion);
    },
    [saveRecentSearch],
  );

  // Handle search submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchQuery.trim()) {
        saveRecentSearch(searchQuery);
      }
    },
    [saveRecentSearch, searchQuery],
  );

  // Clear search
  const handleClear = useCallback(() => {
    setSearchQuery("");
    inputRef.current?.focus();
  }, []);

  // Navigate results with keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev + 1) % Math.max(1, searchResults.length),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(-1, prev - 1));
      } else if (
        e.key === "Enter" &&
        selectedIndex >= 0 &&
        selectedIndex < searchResults.length
      ) {
        e.preventDefault();
        handleResultClick(searchResults[selectedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, searchResults, handleResultClick]);

  if (!isOpen) return null;

  const results = searchResults;
  const suggestions = suggestionResults;
  const hasResults = results.length > 0 || suggestions.length > 0;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-20 sm:pt-24 px-4"
      style={{ zIndex: ZIndex.globalSearch }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        style={{ zIndex: ZIndex.globalSearch }}
      />

      {/* Search Modal */}
      <div
        ref={searchRef}
        className={cn(
 "relative w-full max-w-2xl bg-white rounded-xl shadow-modal",
 "border border-neutral-200",
          "overflow-hidden",
          "animate-scale-in",
        )}
        style={{ zIndex: ZIndex.globalSearch + 1 }}
      >
        {/* Search Input */}
 <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
          <svg
 className="w-5 h-5 text-neutral-400 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <form onSubmit={handleSubmit} className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("placeholder")}
              className={cn(
                "w-full bg-transparent outline-none focus-visible:outline-none",
 "text-neutral-900",
 "placeholder:text-neutral-400",
                "text-base",
              )}
              autoComplete="off"
            />
          </form>

          {searchQuery && (
            <button
              onClick={handleClear}
 className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
              aria-label={t("clearSearch")}
              type="button"
            >
              <svg
                className="w-4 h-4 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

 <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-400">
 <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
              ESC
            </kbd>
            <span>{t("toClose")}</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!hasResults && searchQuery.trim() && (
            <div className="py-12 px-4 text-center">
              <svg
 className="w-12 h-12 mx-auto text-neutral-300 mb-4"
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
 <p className="text-neutral-600 font-medium">
                {t("noResults")}
              </p>
 <p className="text-sm text-neutral-400 mt-1">
                {t("noResultsHint")}
              </p>
            </div>
          )}

          {!hasResults &&
            !searchQuery.trim() &&
            recentSearches.length === 0 && (
              <div className="py-12 px-4 text-center">
                <svg
 className="w-12 h-12 mx-auto text-neutral-300 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
 <p className="text-neutral-600 font-medium">
                  {t("startSearching")}
                </p>
 <p className="text-sm text-neutral-400 mt-1">
                  {t("startSearchingHint")}
                </p>
 <div className="flex items-center justify-center gap-2 mt-4 text-xs text-neutral-400">
 <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
                    ↑↓
                  </kbd>
                  <span>{t("navigate")}</span>
 <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
                    Enter
                  </kbd>
                  <span>{t("select")}</span>
                </div>
              </div>
            )}

          {/* Recent Searches */}
          {!searchQuery.trim() && recentSearches.length > 0 && (
            <div className="p-2">
 <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t("recentSearches")}
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(search)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
 "hover:bg-neutral-100",
                      "transition-colors text-left",
                      selectedIndex === index &&
 "bg-neutral-100",
                    )}
                  >
                    <svg
                      className="w-4 h-4 text-neutral-400"
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
 <span className="text-sm text-neutral-700">
                      {search}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setRecentSearches([]);
                    if (typeof window !== "undefined") {
                      localStorage.removeItem(RECENT_SEARCHES_KEY);
                    }
                  }}
 className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-danger-600 hover:bg-danger-50 transition-colors text-left"
                >
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {t("clearRecentSearches")}
                </button>
              </div>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="p-2">
 <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t("results", { count: results.length })}
              </div>
              <div className="space-y-1">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg",
 "hover:bg-neutral-100",
                      "transition-colors text-left group",
                      selectedIndex === index &&
 "bg-neutral-100",
                    )}
                  >
                    <div
                      className={cn(
                        "flex-shrink-0 p-2 rounded-lg",
                        result.type === "wallet" &&
 "bg-primary-50 text-primary-600",
                        result.type === "transaction" &&
 "bg-neutral-100 text-neutral-600",
                        result.type === "investment" &&
 "bg-accent-50 text-accent-600",
                      )}
                    >
                      {result.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-medium text-neutral-900 truncate">
                          {highlightMatch(result.title, searchQuery)}
                        </p>
                        {result.amount && (
 <span className="text-sm font-semibold text-neutral-700">
                            {result.amount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
 <p className="text-xs text-neutral-500 truncate">
                          {result.subtitle &&
                            highlightMatch(result.subtitle, searchQuery)}
                        </p>
                        {result.date && (
 <span className="text-xs text-neutral-400 flex-shrink-0">
                            {result.date}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
 className="w-4 h-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && results.length === 0 && (
            <div className="p-2">
 <div className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t("suggestions")}
              </div>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
 "hover:bg-neutral-100",
                      "transition-colors text-left",
                    )}
                  >
                    <svg
                      className="w-4 h-4 text-neutral-400"
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
 <span className="text-sm text-neutral-700">
                      {suggestion}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
 <div className="px-4 py-2 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">{t("searchBy")}</span>
            <div className="flex items-center gap-1">
              <span className="hidden sm:inline">{t("searchByHint")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
 <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
              ↑↓
            </kbd>
            <span>{t("navigate")}</span>
 <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200">
              Enter
            </kbd>
            <span>{t("select")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Highlight matching text in search results
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
 className="bg-primary-100 text-primary-900 rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * Format currency amount
 */
function formatCurrency(
  money: { amount: number; currency: string } | undefined,
  defaultCurrency: string,
): string {
  if (!money) return "";
  const { amount, currency } = money;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || defaultCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount / 100); // Convert from cents to dollars
}

/**
 * Hook to manage global search state
 */
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
