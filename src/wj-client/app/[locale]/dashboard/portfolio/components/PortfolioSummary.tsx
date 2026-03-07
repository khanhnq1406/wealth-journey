"use client";

import React, { memo } from "react";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";

/**
 * PortfolioSummary component props
 */
export interface PortfolioSummaryProps {
  /** Portfolio summary data from API */
  portfolioSummary: {
    displayTotalValue?: { amount: number; currency: string };
    totalValue?: number;
    displayTotalCost?: { amount: number; currency: string };
    totalCost?: number;
    displayTotalPnl?: { amount: number; currency: string };
    totalPnl?: number;
    displayCurrency?: string;
    currency?: string;
    totalInvestments?: number;
  };
  /** User's preferred currency */
  userCurrency: string;
}

/**
 * PortfolioSummary component displays overview stats cards
 * Shows Total Value, Total Cost, Total PNL, and Holdings count
 */
export const PortfolioSummary = memo(function PortfolioSummary({
  portfolioSummary,
  userCurrency,
}: PortfolioSummaryProps) {
  const t = useTranslations("investment");
  // Use display fields if available, otherwise fall back to base values
  const displayValue =
    portfolioSummary.displayTotalValue?.amount ??
    portfolioSummary.totalValue ??
    0;
  const displayCost =
    portfolioSummary.displayTotalCost?.amount ??
    portfolioSummary.totalCost ??
    0;
  const displayPnl =
    portfolioSummary.displayTotalPnl?.amount ??
    portfolioSummary.totalPnl ??
    0;
  const displayCurrency =
    portfolioSummary.displayCurrency ||
    portfolioSummary.currency ||
    userCurrency;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <BaseCard className="p-3 sm:p-4">
        <div className="text-sm text-neutral-600">{t("summary.totalValue")}</div>
        <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-neutral-900 mt-1">
          {formatCurrency(displayValue, displayCurrency)}
        </div>
      </BaseCard>

      <BaseCard className="p-3 sm:p-4">
        <div className="text-sm text-neutral-600">{t("summary.totalCost")}</div>
        <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-neutral-900 mt-1">
          {formatCurrency(displayCost, displayCurrency)}
        </div>
      </BaseCard>

      <BaseCard className="p-3 sm:p-4">
        <div className="text-sm text-neutral-600">{t("summary.totalPnl")}</div>
        <div
          className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-1 ${
            displayPnl >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {formatCurrency(displayPnl, displayCurrency)}
        </div>
      </BaseCard>

      <BaseCard className="p-3 sm:p-4">
        <div className="text-sm text-neutral-600">{t("summary.holdings")}</div>
        <div className="text-lg sm:text-xl lg:text-2xl font-semibold text-neutral-900 mt-1">
          {portfolioSummary.totalInvestments || 0}
        </div>
      </BaseCard>
    </div>
  );
});
