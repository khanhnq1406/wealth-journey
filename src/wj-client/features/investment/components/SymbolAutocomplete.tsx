"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Select, SelectOption } from "@/components/select/Select";
import { useQuerySearchSymbols } from "@/utils/generated/hooks";
import { SearchResult } from "@/gen/protobuf/v1/investment";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

/**
 * Props for the SymbolAutocomplete component
 */
export interface SymbolAutocompleteProps {
  /** Currently selected symbol value */
  value: string;
  /** Callback when selection changes - includes full result for currency/name auto-fill */
  onChange: (symbol: string, result?: SearchResult) => void;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether the autocomplete is disabled */
  disabled?: boolean;
  /** Placeholder text when no value is selected */
  placeholder?: string;
}

/**
 * Minimum query length before triggering search
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Debounce delay in milliseconds
 */
const DEBOUNCE_MS = 500;

/**
 * Maximum number of search results to request
 */
const MAX_RESULTS = 20;

/**
 * SymbolAutocomplete component for searching and selecting investment symbols.
 *
 * Features:
 * - Debounced search (300ms) to reduce API calls
 * - Real-time symbol search using Yahoo Finance API
 * - Custom result rendering with symbol, type, exchange, and company name
 * - Loading state handling
 * - Error handling with user-friendly messages
 * - Keyboard navigation support
 *
 * @example
 * ```tsx
 * <SymbolAutocomplete
 *   value={symbol}
 *   onChange={setSymbol}
 *   placeholder="Search for stocks, ETFs, crypto..."
 * />
 * ```
 */
export function SymbolAutocomplete({
  value,
  onChange,
  className = "",
  disabled = false,
  placeholder = "Search for stocks, ETFs, crypto...",
}: SymbolAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);

  // Use the existing useDebounce hook
  const debouncedQuery = useDebounce(
    inputValue.length >= MIN_QUERY_LENGTH ? inputValue : "",
    DEBOUNCE_MS,
  );

  // Search symbols using debounced query
  const searchQuery = useQuerySearchSymbols(
    {
      query: debouncedQuery,
      limit: MAX_RESULTS,
    },
    {
      enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
      refetchOnMount: "always",
    },
  );

  // Handle search query errors
  useEffect(() => {
    if (searchQuery.error) {
      setSearchError(
        (searchQuery.error as any)?.message ||
          "Failed to search symbols. Please try again.",
      );
    }
  }, [searchQuery.error]);

  // Convert search results to Select options (memoized for performance)
  const options: SelectOption[] = useMemo(() => {
    if (!searchQuery.data?.data) {
      return [];
    }

    return searchQuery.data.data.map((result: SearchResult) => ({
      value: result.symbol,
      label: result.symbol,
      render: () => (
        <div className="flex flex-col gap-0.5">
          {/* First row: Symbol (green/bold) | Type | Exchange (right) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-primary-600 font-bold">{result.symbol}</span>
              <span className="text-gray-500 text-xs">•</span>
              <span className="text-gray-600 text-sm">{result.type}</span>
            </div>
            <span className="text-gray-500 text-xs">
              {result.exchDisp || result.exchange}
            </span>
          </div>
          {/* Second row: Full company name */}
          <div className="text-gray-600 text-xs truncate">{result.name}</div>
        </div>
      ),
    }));
  }, [searchQuery.data?.data]);

  // Update display value when value changes externally (but not during typing)
  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Handle selection change - find full result to pass currency/name info
  const handleChange = useCallback(
    (selectedValue: string) => {
      const selectedResult = searchQuery.data?.data?.find(
        (r: SearchResult) => r.symbol === selectedValue,
      );
      onChange(selectedValue, selectedResult);
    },
    [onChange, searchQuery.data?.data],
  );

  // Handle input value changes (for search)
  const handleInputChange = useCallback((newValue: string) => {
    setInputValue(newValue);
  }, []);

  // Custom dropdown rendering to handle the "too short" case
  const renderDropdown = useCallback(
    (props: { children: React.ReactNode; className: string }) => {
      // Show search hint in dropdown when input is too short
      if (inputValue.length > 0 && inputValue.length < MIN_QUERY_LENGTH) {
        return (
          <div className={props.className}>
            <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Enter at least {MIN_QUERY_LENGTH} characters to search
            </div>
          </div>
        );
      }

      // Show loading spinner in dropdown when searching
      if (searchQuery.isLoading && debouncedQuery.length >= MIN_QUERY_LENGTH) {
        return (
          <div className={props.className}>
            <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400 flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-primary-500"
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
              Searching...
            </div>
          </div>
        );
      }

      // Show no results message in dropdown when search completes with no results
      if (
        !searchQuery.isLoading &&
        debouncedQuery.length >= MIN_QUERY_LENGTH &&
        options.length === 0 &&
        !searchError
      ) {
        return (
          <div className={props.className}>
            <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No results found for "{debouncedQuery}". Try a different search
              term.
            </div>
          </div>
        );
      }

      // Default dropdown with options
      return <div className={props.className}>{props.children}</div>;
    },
    [
      inputValue.length,
      debouncedQuery.length,
      searchQuery.isLoading,
      options.length,
      searchError,
    ],
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Select<string>
        options={options}
        value={value}
        onChange={handleChange}
        onInputChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        isLoading={
          searchQuery.isLoading && debouncedQuery.length >= MIN_QUERY_LENGTH
        }
        displayValue={inputValue}
        clearable={true}
        disableFilter={true}
        renderDropdown={renderDropdown}
      />

      {/* Error message */}
      {searchError && (
        <p className="text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1 mt-1.5">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{searchError}</span>
        </p>
      )}
    </div>
  );
}
