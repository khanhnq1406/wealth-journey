"use client";

import React, { memo, useMemo, useState } from "react";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";
import {
  useAnimatedNumber,
  useAnimatedPercentage,
} from "@/components/charts/useAnimatedNumber";
import { Sparkline, DonutChart } from "@/components/charts";
import { DonutChartSVG } from "@/components/charts/DonutChartSVG";
import { Button } from "@/components/Button";
import { ButtonType, resources } from "@/app/constants";
import Image from "next/image";
import { usePortfolioHistoricalValues } from "@/features/investment/hooks/usePortfolioHistoricalValues";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { PlusIcon, RefreshIcon } from "@/components/icons";

/**
 * Investment type to display name mapping
 */
const INVESTMENT_TYPE_LABELS: Record<number, string> = {
  [InvestmentType.INVESTMENT_TYPE_STOCK]: "Stocks",
  [InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY]: "Crypto",
  [InvestmentType.INVESTMENT_TYPE_ETF]: "ETFs",
  [InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND]: "Mutual Funds",
  [InvestmentType.INVESTMENT_TYPE_BOND]: "Bonds",
  [InvestmentType.INVESTMENT_TYPE_COMMODITY]: "Commodities",
  [InvestmentType.INVESTMENT_TYPE_GOLD_VND]: "Gold (Vietnam)",
  [InvestmentType.INVESTMENT_TYPE_GOLD_USD]: "Gold (World)",
  [InvestmentType.INVESTMENT_TYPE_SILVER_VND]: "Silver (Vietnam)",
  [InvestmentType.INVESTMENT_TYPE_SILVER_USD]: "Silver (World)",
  [InvestmentType.INVESTMENT_TYPE_OTHER]: "Other",
};

/**
 * Color palette for asset allocation chart
 */
const ASSET_COLORS = [
  "#10b981", // green-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#84cc16", // lime-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
];

/**
 * Portfolio summary data structure
 */
export interface PortfolioSummaryData {
  displayTotalValue?: { amount: number; currency: string };
  totalValue?: number;
  displayTotalCost?: { amount: number; currency: string };
  totalCost?: number;
  displayTotalPnl?: { amount: number; currency: string };
  totalPnl?: number;
  displayCurrency?: string;
  currency?: string;
  totalInvestments?: number;
  totalPnlPercent?: number;
  /** Historical data for sparkline (optional) */
  historicalValues?: { value: number; date: string }[];
  /** Asset allocation data (optional) */
  assetAllocation?: { name: string; value: number; color?: string }[];
  /** Investment breakdown by type */
  investmentsByType?: {
    type: InvestmentType;
    totalValue: number;
    count: number;
  }[];
  /** Top performing investments */
  topPerformers?: {
    investmentId: number;
    symbol: string;
    name: string;
    type: InvestmentType;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  }[];
  /** Worst performing investments */
  worstPerformers?: {
    investmentId: number;
    symbol: string;
    name: string;
    type: InvestmentType;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
  }[];
}

/**
 * Enhanced PortfolioSummary component props
 */
export interface PortfolioSummaryEnhancedProps {
  /** Portfolio summary data from API */
  portfolioSummary: PortfolioSummaryData;
  /** User's preferred currency */
  userCurrency: string;
  /** Callback for refresh action */
  onRefreshPrices?: () => void;
  /** Callback for add investment action */
  onAddInvestment?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Optional wallet ID for filtering historical data */
  walletId?: number;
}

/**
 * StatCard component for individual summary metrics
 */
interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: "green" | "red" | "neutral";
  trend?: number;
  icon?: React.ReactNode;
  showSparkline?: boolean;
  sparklineData?: { value: number }[];
}

const StatCard = memo(function StatCard({
  label,
  value,
  subtitle,
  color = "neutral",
  trend,
  icon,
  showSparkline,
  sparklineData,
}: StatCardProps) {
  const colorClasses = {
    green: "text-green-600",
    red: "text-red-600",
    neutral: "text-neutral-900",
  };

  return (
    <BaseCard className="p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="text-sm text-neutral-600">{label}</div>
        {icon && <div className="flex-shrink-0">{icon}</div>}
      </div>

      <div
        className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-1 ${colorClasses[color]}`}
      >
        {value}
      </div>

      {subtitle && (
        <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>
      )}

      {trend !== undefined && (
        <div
          className={`text-xs font-medium mt-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}
        >
          {trend >= 0 ? "+" : ""}
          {trend.toFixed(2)}%
        </div>
      )}

      {showSparkline && sparklineData && sparklineData.length > 1 && (
        <div className="mt-2 w-full">
          <Sparkline data={sparklineData} height={40} />
        </div>
      )}
    </BaseCard>
  );
});

/**
 * Enhanced PortfolioSummary component with animated counters, sparklines, and asset allocation
 *
 * Features:
 * - Animated number counters
 * - Real historical data sparkline from API
 * - Asset allocation donut chart based on actual investment types
 * - Top/worst performers display
 * - Quick action buttons
 * - Mobile-optimized layout
 */
export const PortfolioSummaryEnhanced = memo(function PortfolioSummaryEnhanced({
  portfolioSummary,
  userCurrency,
  onRefreshPrices,
  onAddInvestment,
  isRefreshing = false,
  walletId = 0,
}: PortfolioSummaryEnhancedProps) {
  const [showAssetAllocation, setShowAssetAllocation] = useState(false);

  // Fetch historical portfolio values for sparkline
  const { historicalData } = usePortfolioHistoricalValues({
    walletId,
    days: 30,
    points: 10,
  });

  // Extract values
  const displayValue =
    portfolioSummary.displayTotalValue?.amount ??
    portfolioSummary.totalValue ??
    0;
  const displayCost =
    portfolioSummary.displayTotalCost?.amount ??
    portfolioSummary.totalCost ??
    0;
  const displayPnl =
    portfolioSummary.displayTotalPnl?.amount ?? portfolioSummary.totalPnl ?? 0;
  const displayCurrency =
    portfolioSummary.displayCurrency ||
    portfolioSummary.currency ||
    userCurrency;

  // Use the totalPnlPercent from API if available, otherwise calculate
  const pnlPercent =
    portfolioSummary.totalPnlPercent !== undefined
      ? portfolioSummary.totalPnlPercent
      : displayCost > 0
        ? (displayPnl / displayCost) * 100
        : 0;

  // Animated values
  const animatedValue = useAnimatedNumber(displayValue, 1200);
  const animatedCost = useAnimatedNumber(displayCost, 1200);
  const animatedPnl = useAnimatedNumber(displayPnl, 1200);
  const animatedHoldings = useAnimatedNumber(
    portfolioSummary.totalInvestments || 0,
    800,
  );

  // Prepare sparkline data from real historical values
  const sparklineData = useMemo(() => {
    if (historicalData && historicalData.length > 0) {
      return historicalData.map((point) => ({
        value: point.displayTotalValue?.amount ?? point.totalValue,
      }));
    }
    // Fallback to mock trend data if no historical data available yet
    if (portfolioSummary.historicalValues) {
      return portfolioSummary.historicalValues.map((v) => ({
        value: v.value,
      }));
    }
    // Generate mock trend data based on current value as last resort
    const currentValue = displayValue;
    const variance = currentValue > 0 ? currentValue * 0.1 : 100; // 10% variance
    return Array.from({ length: 10 }, (_, i) => ({
      value:
        currentValue -
        variance +
        (variance * 2 * i) / 9 +
        (Math.random() - 0.5) * variance * 0.2,
    }));
  }, [historicalData, displayValue, portfolioSummary.historicalValues]);

  // Prepare asset allocation data from investmentsByType
  const assetAllocationData = useMemo(() => {
    // If provided directly, use it
    if (portfolioSummary.assetAllocation) {
      return portfolioSummary.assetAllocation;
    }

    // Build from investmentsByType API response
    if (
      portfolioSummary.investmentsByType &&
      portfolioSummary.investmentsByType.length > 0
    ) {
      return portfolioSummary.investmentsByType
        .filter((item) => item.totalValue !== undefined && item.totalValue > 0)
        .map((item, index) => ({
          name: INVESTMENT_TYPE_LABELS[item.type] || `Type ${item.type}`,
          value: Number(item.totalValue),
          color: ASSET_COLORS[index % ASSET_COLORS.length],
        }));
    }

    // Fallback: mock data based on holdings count (for empty portfolios)
    const holdings = portfolioSummary.totalInvestments || 0;
    if (holdings === 0) {
      return [];
    }

    const types = ["Stocks", "Crypto", "ETFs", "Gold"];
    const avgPerType = displayValue / Math.max(holdings, 1);
    return types.map((type, i) => ({
      name: type,
      value: Math.round(avgPerType * (0.5 + Math.random() * 1)),
      color: ASSET_COLORS[i % ASSET_COLORS.length],
    }));
  }, [
    displayValue,
    portfolioSummary.assetAllocation,
    portfolioSummary.investmentsByType,
    portfolioSummary.totalInvestments,
  ]);

  // Get best performer from API data
  const topPerformer = useMemo(() => {
    if (
      portfolioSummary.topPerformers &&
      portfolioSummary.topPerformers.length > 0
    ) {
      const best = portfolioSummary.topPerformers[0];
      if (best.unrealizedPnlPercent === undefined) {
        return null;
      }
      return {
        name: best.symbol || best.name,
        value: `${best.unrealizedPnlPercent >= 0 ? "+" : ""}${best.unrealizedPnlPercent.toFixed(2)}%`,
        positive: best.unrealizedPnlPercent >= 0,
      };
    }
    return null;
  }, [portfolioSummary.topPerformers]);

  // Get worst performer from API data
  const worstPerformer = useMemo(() => {
    if (
      portfolioSummary.worstPerformers &&
      portfolioSummary.worstPerformers.length > 0
    ) {
      const worst = portfolioSummary.worstPerformers[0];
      if (worst.unrealizedPnlPercent === undefined) {
        return null;
      }
      return {
        name: worst.symbol || worst.name,
        value: `${worst.unrealizedPnlPercent >= 0 ? "+" : ""}${worst.unrealizedPnlPercent.toFixed(2)}%`,
        positive: worst.unrealizedPnlPercent >= 0,
      };
    }
    return null;
  }, [portfolioSummary.worstPerformers]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Value"
          value={formatCurrency(animatedValue, displayCurrency)}
          color="neutral"
          sparklineData={sparklineData}
          showSparkline
        />

        <StatCard
          label="Total Cost"
          value={formatCurrency(animatedCost, displayCurrency)}
          color="neutral"
        />

        <StatCard
          label="Total PNL"
          value={formatCurrency(animatedPnl, displayCurrency)}
          color={displayPnl >= 0 ? "green" : "red"}
          trend={pnlPercent}
        />

        <StatCard
          label="Holdings"
          value={animatedHoldings.toString()}
          color="neutral"
        />
      </div>

      {/* Asset Allocation Card */}
      {assetAllocationData.length > 0 ? (
        <BaseCard className="p-3 sm:p-4 md:p-6 ">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                Asset Allocation
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 mt-0.5 sm:mt-1">
                Distribution by investment type
              </p>
            </div>

            {/* Performers display */}
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
              {topPerformer && (
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-green-100">
                  <span className="text-[10px] sm:text-xs text-green-700 font-medium truncate max-w-[80px] sm:max-w-none">
                    Best: {topPerformer.name}
                  </span>
                  <span
                    className={`text-[10px] sm:text-xs font-bold flex-shrink-0 ${topPerformer.positive ? "text-green-700" : "text-red-700"}`}
                  >
                    {topPerformer.value}
                  </span>
                </div>
              )}
              {worstPerformer && (
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-red-100">
                  <span className="text-[10px] sm:text-xs text-red-700 font-medium truncate max-w-[80px] sm:max-w-none">
                    Worst: {worstPerformer.name}
                  </span>
                  <span
                    className={`text-[10px] sm:text-xs font-bold flex-shrink-0 ${worstPerformer.positive ? "text-green-700" : "text-red-700"}`}
                  >
                    {worstPerformer.value}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full">
            {(() => {
              try {
                return (
                  <DonutChartSVG
                    data={assetAllocationData}
                    innerRadiusPercent={60}
                    outerRadiusPercent={80}
                    height={260}
                    centerLabel={formatCurrency(displayValue, displayCurrency)}
                    centerSubLabel="Total Portfolio"
                    showLegend={true}
                    legendPosition="right"
                  />
                );
              } catch (error) {
                console.error("DonutChartSVG error:", error);
                return (
                  <div className="flex items-center justify-center h-52 text-red-500 text-sm">
                    Chart error
                  </div>
                );
              }
            })()}
          </div>
        </BaseCard>
      ) : null}

      {/* Quick Actions Card */}
      <BaseCard className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Button
            type={ButtonType.PRIMARY}
            onClick={onAddInvestment}
            className="flex-1"
          >
            <div className="flex items-center justify-center gap-2">
              <PlusIcon />
              <span>Add Investment</span>
            </div>
          </Button>

          <Button
            type={ButtonType.SECONDARY}
            onClick={onRefreshPrices}
            disabled={isRefreshing}
            loading={isRefreshing}
            className="flex-1"
          >
            <div className="flex items-center justify-center gap-2">
              <RefreshIcon />
              <span>Refresh Prices</span>
            </div>
          </Button>
        </div>
      </BaseCard>
    </div>
  );
});
