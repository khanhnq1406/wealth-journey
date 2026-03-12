"use client";

import React, { memo, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import {
  formatCurrency,
} from "@/utils/currency-formatter";
import {
  formatPercent,
  formatQuantity,
  getInvestmentTypeLabel,
  formatPrice,
  formatTimeAgo,
} from "../helpers";

/**
 * Investment data type for card display
 */
export interface InvestmentCardData {
  id: number;
  symbol: string;
  name: string;
  type: InvestmentType;
  quantity: number;
  averageCost?: number;
  currentPrice?: number;
  currentValue?: number;
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
  updatedAt?: number;
  currency?: string;
  purchaseUnit?: string;
  displayCurrentValue?: { amount: number; currency: string };
  displayUnrealizedPnl?: { amount: number; currency: string };
  displayCurrentPrice?: { amount: number; currency: string };
  displayAverageCost?: { amount: number; currency: string };
  displayCurrency?: string;
  walletName?: string;
}

/**
 * InvestmentCard component props
 */
export interface InvestmentCardProps {
  /** Investment data to display */
  investment: InvestmentCardData;
  /** User's preferred currency for display */
  userCurrency: string;
  /** Callback when card is clicked */
  onClick?: (investmentId: number) => void;
  /** Whether to show wallet name (for "All Wallets" view) */
  showWallet?: boolean;
}

/**
 * InvestmentCard component displays a single investment in card format
 * Optimized for mobile viewing with stacked information layout
 */
export const InvestmentCard = memo(function InvestmentCard({
  investment,
  userCurrency,
  onClick,
  showWallet = false,
}: InvestmentCardProps) {
  const t = useTranslations("investment");
  const locale = useLocale();
  const {
    id,
    symbol,
    name,
    type,
    quantity,
    averageCost,
    currentPrice,
    currentValue,
    unrealizedPnl,
    unrealizedPnlPercent,
    updatedAt,
    currency,
    purchaseUnit,
    displayCurrentValue,
    displayUnrealizedPnl,
    displayCurrentPrice,
    displayAverageCost,
    displayCurrency,
    walletName,
  } = investment;

  const nativeCurrency = currency || "USD";
  const displayCcy = displayCurrency || userCurrency;
  const pnl = unrealizedPnl || 0;
  const pnlPercent = unrealizedPnlPercent || 0;

  // Compute if data is recent (within 5 minutes) - memoized to avoid impure Date.now() during render
  const isRecent = useMemo(() => {
    if (!updatedAt) return false;
    return Date.now() / 1000 - updatedAt < 300;
  }, [updatedAt]);

  const handleClick = () => {
    onClick?.(id);
  };

  return (
    <BaseCard
      className={`p-4 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={handleClick}
    >
      {/* Header row with symbol and type */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-neutral-900 truncate">
            {symbol}
          </h3>
          <p className="text-sm text-neutral-600 truncate">{name}</p>
        </div>
        <div className="ml-2 flex-shrink-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
            {getInvestmentTypeLabel(type, t as (key: string) => string)}
          </span>
        </div>
      </div>

      {/* Wallet name (conditional) */}
      {showWallet && walletName && (
        <div className="mb-2">
          <span className="text-xs text-neutral-500">
            {t("form.walletLabel")}: {walletName}
          </span>
        </div>
      )}

      {/* Quantity row */}
      <div className="flex justify-between items-center py-2 border-b border-neutral-200">
        <span className="text-sm text-neutral-600">{t("detail.quantityLabel")}</span>
        <span className="text-sm font-medium text-neutral-900">
          {formatQuantity(quantity, type, purchaseUnit)}
        </span>
      </div>

      {/* Prices section */}
      <div className="py-2 space-y-2 border-b border-neutral-200">
        {/* Average Cost */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-600">{t("detail.avgCost")}</span>
          <div className="text-right">
            <div className="text-sm font-medium text-neutral-900">
              {formatPrice(averageCost || 0, type, nativeCurrency, purchaseUnit, symbol)}
            </div>
            {displayAverageCost && displayCurrency && (
              <div className="text-xs text-neutral-500">
                ≈ {formatPrice(displayAverageCost.amount || 0, type, displayCcy, purchaseUnit, symbol)}
              </div>
            )}
          </div>
        </div>

        {/* Current Price */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-600">{t("detail.currentPrice")}</span>
          <div className="text-right">
            <div className="text-sm font-medium text-neutral-900">
              {formatPrice(currentPrice || 0, type, nativeCurrency, purchaseUnit, symbol)}
            </div>
            {displayCurrentPrice && displayCurrency && (
              <div className="text-xs text-neutral-500">
                ≈ {formatPrice(displayCurrentPrice.amount || 0, type, displayCcy, purchaseUnit, symbol)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Value and PNL row */}
      <div className="pt-2 space-y-2">
        {/* Current Value */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-600">{t("detail.currentValue")}</span>
          <div className="text-right">
            <div className="text-base font-semibold text-neutral-900">
              {formatCurrency(currentValue || 0, nativeCurrency)}
            </div>
            {displayCurrentValue && displayCurrency && (
              <div className="text-xs text-neutral-500">
                ≈ {formatCurrency(displayCurrentValue.amount || 0, displayCcy)}
              </div>
            )}
          </div>
        </div>

        {/* PNL */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-neutral-600">{t("table.pnl")}</span>
          <div className="text-right">
            <div
              className={`text-base font-semibold ${
                pnl >= 0 ? "text-v2-green-positive" : "text-red-600"
              }`}
            >
              {formatCurrency(pnl, nativeCurrency)}
              {displayUnrealizedPnl && displayCurrency && (
                <span className="text-xs text-neutral-500 ml-1">
                  (≈ {formatCurrency(displayUnrealizedPnl.amount || 0, displayCcy)})
                </span>
              )}
            </div>
            <div
              className={`text-xs font-medium ${
                pnlPercent >= 0 ? "text-v2-green-positive" : "text-red-600"
              }`}
            >
              {formatPercent(pnlPercent)}
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      {updatedAt && (
        <div className="mt-3 pt-2 border-t border-neutral-200">
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-500">{t("table.lastUpdated")}</span>
            <div className="flex items-center gap-1">
              {updatedAt && (
                <>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isRecent
                        ? "bg-v2-green-positive"
                        : "bg-gray-400"
                    }`}
                  />
                  {(() => { const ta = formatTimeAgo(updatedAt, t as any, locale); return <span className={`text-xs ${ta.colorClass}`}>{ta.text}</span>; })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseCard>
  );
});
