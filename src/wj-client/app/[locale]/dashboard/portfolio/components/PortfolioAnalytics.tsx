"use client";

import React, { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";

/**
 * Portfolio analytics data types
 */
export interface PortfolioAnalyticsData {
  totalValue?: number;
  totalCost?: number;
  totalPnl?: number;
  totalPnlPercent?: number;
  displayTotalValue?: { amount: number; currency: string };
  displayTotalCost?: { amount: number; currency: string };
  displayTotalPnl?: { amount: number; currency: string };
  displayCurrency?: string;
  currency?: string;
  totalInvestments?: number;
  topPerformers?: {
    symbol: string;
    pnl: number;
    pnlPercent: number;
  }[];
  worstPerformers?: {
    symbol: string;
    pnl: number;
    pnlPercent: number;
  }[];
}

/**
 * PortfolioAnalytics component props
 */
export interface PortfolioAnalyticsProps {
  /** Portfolio analytics data */
  analytics: PortfolioAnalyticsData;
  /** User's preferred currency */
  userCurrency: string;
}

/**
 * Simple bar chart component for visualizing PNL
 */
const SimplePnlChart = memo(function SimplePnlChart({
  pnl,
  pnlPercent,
  totalPnlLabel,
  currency,
}: {
  pnl: number;
  pnlPercent: number;
  totalPnlLabel: string;
  currency: string;
}) {
  const isPositive = pnl >= 0;
  const maxValue = Math.abs(pnl) || 1;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-neutral-600">{totalPnlLabel}</span>
        <span
          className={`font-semibold ${
            isPositive ? "text-v2-green-positive" : "text-red-600"
          }`}
        >
          {pnlPercent >= 0 ? "+" : ""}
          {pnlPercent.toFixed(2)}%
        </span>
      </div>
      <div className="w-full bg-neutral-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isPositive ? "bg-v2-green-positive" : "bg-red-500"
          }`}
          style={{
            width: `${Math.min(Math.abs(pnlPercent), 100)}%`,
          }}
        />
      </div>
      <div
        className={`text-right text-sm font-medium ${
          isPositive ? "text-v2-green-positive" : "text-red-600"
        }`}
      >
        {formatCurrency(Math.abs(pnl), currency)}
      </div>
    </div>
  );
});

/**
 * Performance list component
 */
const PerformanceList = memo(function PerformanceList({
  title,
  performers,
  userCurrency,
  isPositive,
}: {
  title: string;
  performers: Array<{ symbol: string; pnl: number; pnlPercent: number }>;
  userCurrency: string;
  isPositive: boolean;
}) {
  if (!performers || performers.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-neutral-700 mb-2">{title}</h4>
      <div className="space-y-2">
        {performers.map((p) => (
          <div
            key={p.symbol}
            className="flex justify-between items-center py-2 px-3 bg-neutral-50 rounded"
          >
            <span className="font-medium text-neutral-900">{p.symbol}</span>
            <div className="text-right">
              <div
                className={`text-sm font-semibold ${
                  p.pnl >= 0 ? "text-v2-green-positive" : "text-red-600"
                }`}
              >
                {p.pnlPercent >= 0 ? "+" : ""}
                {p.pnlPercent.toFixed(2)}%
              </div>
              <div className="text-xs text-neutral-600">
                {formatCurrency(Math.abs(p.pnl), userCurrency)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * PortfolioAnalytics component displays charts and metrics
 * Can be collapsed on mobile to save screen space
 */
export const PortfolioAnalytics = memo(function PortfolioAnalytics({
  analytics,
  userCurrency,
}: PortfolioAnalyticsProps) {
  const tAnalytics = useTranslations("investment.analytics");
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract display values
  const displayValue =
    analytics.displayTotalValue?.amount ?? analytics.totalValue ?? 0;
  const displayCost =
    analytics.displayTotalCost?.amount ?? analytics.totalCost ?? 0;
  const displayPnl =
    analytics.displayTotalPnl?.amount ?? analytics.totalPnl ?? 0;
  const displayCurrency =
    analytics.displayCurrency || analytics.currency || userCurrency;

  // Calculate PNL percentage if not provided
  const pnlPercent =
    analytics.totalPnlPercent ??
    (displayCost > 0 ? (displayPnl / displayCost) * 100 : 0);

  return (
    <BaseCard className="p-4">
      {/* Header with collapse toggle */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-neutral-800">
          {tAnalytics("portfolioAnalytics")}
        </h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="sm:hidden text-sm text-primary-600 hover:text-primary-800 font-medium"
          aria-label={isExpanded ? tAnalytics("showLess") : tAnalytics("showMore")}
        >
          {isExpanded ? tAnalytics("showLess") : tAnalytics("showMore")}
        </button>
      </div>

      {/* Key Metrics - Always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* PNL Chart */}
        <div className="sm:col-span-3">
          <SimplePnlChart pnl={displayPnl} pnlPercent={pnlPercent} totalPnlLabel={tAnalytics("totalPnl")} currency={displayCurrency} />
        </div>

        {/* Additional metrics can be added here */}
      </div>

      {/* Collapsible section for more detailed analytics */}
      <div
        className={`${
          isExpanded ? "block" : "hidden"
        } sm:block space-y-4`}
      >
        {/* Top Performers */}
        {analytics.topPerformers && analytics.topPerformers.length > 0 && (
          <PerformanceList
            title={tAnalytics("topPerformers")}
            performers={analytics.topPerformers}
            userCurrency={displayCurrency}
            isPositive={true}
          />
        )}

        {/* Worst Performers */}
        {analytics.worstPerformers && analytics.worstPerformers.length > 0 && (
          <PerformanceList
            title={tAnalytics("worstPerformers")}
            performers={analytics.worstPerformers}
            userCurrency={displayCurrency}
            isPositive={false}
          />
        )}

        {/* Portfolio Health Indicator */}
        <div className="pt-4 border-t border-neutral-200">
          <h4 className="text-sm font-semibold text-neutral-700 mb-2">
            {tAnalytics("portfolioHealth")}
          </h4>
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                pnlPercent >= 0 ? "bg-v2-green-positive" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-neutral-600">
              {pnlPercent >= 0
                ? tAnalytics("inProfit")
                : tAnalytics("atLoss")}
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            {tAnalytics("totalInvested", { amount: formatCurrency(displayCost, displayCurrency) })}
          </div>
        </div>
      </div>

      {/* Mobile expand/collapse hint */}
      <div className="sm:hidden mt-3 text-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          {isExpanded ? "▲" : "▼"} {isExpanded ? tAnalytics("lessDetails") : tAnalytics("moreDetails")}
        </button>
      </div>
    </BaseCard>
  );
});
