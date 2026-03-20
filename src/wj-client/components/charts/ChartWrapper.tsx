"use client";

import React from "react";
import { ChartSkeleton } from "@/components/loading/Skeleton";

/**
 * Selector configuration for year dropdown
 */
export interface YearSelectorConfig {
  /** Currently selected year */
  value: number;
  /** Available years to choose from */
  options: number[];
  /** Callback when year changes */
  onChange: (year: number) => void;
}

/**
 * Selector configuration for wallet dropdown
 */
export interface WalletSelectorConfig {
  /** Currently selected wallet ID (undefined = all wallets) */
  value: number | undefined;
  /** Available wallets to choose from */
  options: { id: number; name: string }[];
  /** Callback when wallet changes */
  onChange: (walletId: number | undefined) => void;
}

/**
 * ChartWrapper component props
 */
export interface ChartWrapperProps {
  /** Chart content to render */
  children: React.ReactNode;
  /** Whether the chart is loading */
  isLoading?: boolean;
  /** Year selector configuration (optional) */
  yearSelector?: YearSelectorConfig;
  /** Wallet selector configuration (optional) */
  walletSelector?: WalletSelectorConfig;
  /** CSS class name */
  className?: string;
}

/**
 * ChartWrapper - Common wrapper for chart components
 *
 * Provides:
 * - Loading states with ChartSkeleton
 * - Year selector dropdown
 * - Wallet selector dropdown
 * - Consistent styling
 *
 * @example
 * ```tsx
 * <ChartWrapper
 *   isLoading={isLoading}
 *   yearSelector={{
 *     value: selectedYear,
 *     options: [2024, 2025, 2026],
 *     onChange: setSelectedYear
 *   }}
 * >
 *   <LineChart data={chartData} ... />
 * </ChartWrapper>
 * ```
 */
export function ChartWrapper({
  children,
  isLoading = false,
  yearSelector,
  walletSelector,
  className = "w-full p-1",
}: ChartWrapperProps) {
  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={className}>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Selectors */}
      {(yearSelector || walletSelector) && (
        <div className="text-sm mb-2">
          {yearSelector && (
            <select
              className="border-solid border border-v2-gold-primary/30 rounded-md p-1 m-2 bg-v2-maroon-900 text-v2-cream-100"
              value={yearSelector.value}
              onChange={(e) => yearSelector.onChange(parseInt(e.target.value))}
            >
              {yearSelector.options.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
          {walletSelector && (
            <select
              className="border-solid border border-v2-gold-primary/30 rounded-md p-1 bg-v2-maroon-900 text-v2-cream-100"
              value={walletSelector.value ?? ""}
              onChange={(e) =>
                walletSelector.onChange(
                  e.target.value ? parseInt(e.target.value) : undefined,
                )
              }
            >
              <option value="">All Wallets</option>
              {walletSelector.options.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Chart content */}
      {children}
    </div>
  );
}
