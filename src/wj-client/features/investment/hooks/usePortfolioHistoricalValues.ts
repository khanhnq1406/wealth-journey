"use client";

import { useQueryGetHistoricalPortfolioValues } from "@/utils/generated/hooks";

interface HistoricalPortfolioValue {
  timestamp: number;
  totalValue: number;
  displayTotalValue?: {
    amount: number;
    currency: string;
  };
}

interface PortfolioHistoricalValuesResponse {
  success: boolean;
  message: string;
  data: HistoricalPortfolioValue[];
  timestamp: string;
}

interface UsePortfolioHistoricalValuesOptions {
  walletId?: number;
  days?: number;
  points?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

// Cache settings for portfolio historical data
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes - historical data doesn't change that fast
const STALE_TIME = 2 * 60 * 1000; // 2 minutes - consider data stale after this

/**
 * Hook to fetch historical portfolio values for charts
 *
 * @param options - Configuration options
 * @param options.walletId - Optional wallet ID to filter (0 or undefined = all wallets)
 * @param options.days - Number of days to look back (default: 30, max: 365)
 * @param options.points - Number of data points to return (default: 10, max: 100)
 * @param options.enabled - Whether to enable the query (default: true)
 * @param options.refetchInterval - Interval in ms to refetch data (default: undefined - no auto refetch)
 *
 * @returns Query result with historical portfolio values
 *
 * @example
 * ```tsx
 * // Get last 30 days with 10 data points (all wallets)
 * const { data, isLoading, error } = usePortfolioHistoricalValues();
 *
 * // Get last 90 days with 20 data points for specific wallet
 * const { data, isLoading, error } = usePortfolioHistoricalValues({
 *   walletId: 123,
 *   days: 90,
 *   points: 20,
 * });
 *
 * // Enable auto-refetch every minute
 * const { data, isLoading, error } = usePortfolioHistoricalValues({
 *   refetchInterval: 60000,
 * });
 * ```
 */
export function usePortfolioHistoricalValues(options: UsePortfolioHistoricalValuesOptions = {}) {
  const {
    walletId = 0,
    days = 30,
    points = 10,
    enabled = true,
    refetchInterval,
  } = options;

  const result = useQueryGetHistoricalPortfolioValues(
    {
      walletId,
      typeFilter: 0, // 0 = all types
      days,
      points,
    },
    {
      enabled,
      refetchInterval,
      staleTime: STALE_TIME,
      gcTime: CACHE_TIME,
      retry: 1,
      // Transform the data to a more convenient format
      select: (response): PortfolioHistoricalValuesResponse => {
        return {
          success: response.success ?? false,
          message: response.message ?? "",
          data: (response.data ?? []).map((point) => ({
            timestamp: point.timestamp,
            totalValue: point.totalValue,
            displayTotalValue: point.displayTotalValue,
          })),
          timestamp: response.timestamp ?? "",
        };
      },
    }
  );

  return {
    ...result,
    // Convenience accessors
    historicalData: result.data?.data ?? [],
    isSuccess: result.data?.success ?? false,
  };
}

/**
 * Hook to fetch historical portfolio values with automatic refetching
 * Useful for live dashboard displays
 *
 * @param options - Configuration options (same as usePortfolioHistoricalValues)
 * @param refreshInterval - Refresh interval in milliseconds (default: 60000 = 1 minute)
 */
export function useLivePortfolioHistoricalValues(
  options: UsePortfolioHistoricalValuesOptions = {},
  refreshInterval: number = 60000
) {
  return usePortfolioHistoricalValues({
    ...options,
    refetchInterval: refreshInterval,
  });
}

export type { HistoricalPortfolioValue, PortfolioHistoricalValuesResponse, UsePortfolioHistoricalValuesOptions };
