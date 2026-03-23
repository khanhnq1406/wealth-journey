"use client";

import React, { memo, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { formatCurrency } from "@/utils/currency-formatter";
import {
  formatPercent,
  formatQuantity,
  getInvestmentTypeLabel,
  formatPrice,
  formatTimeAgo,
  isCustomInvestment,
  formatInvestmentPrice,
  formatUnrealizedPNL,
} from "../helpers";
import { resources } from "@/app/constants";
import Image from "next/image";
import { Sparkline } from "@/components/charts";
import { motion, AnimatePresence } from "framer-motion";
import { IconProps, PlusIcon, InfoIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Enhanced investment data type for card display
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
  priceHistory?: { value: number; date: string }[];
  isCustom: boolean;
}

/**
 * Enhanced InvestmentCard component props
 */
export interface InvestmentCardEnhancedProps {
  investment: InvestmentCardData;
  userCurrency: string;
  onClick?: (investmentId: number) => void;
  showWallet?: boolean;
  onBuyMore?: (investmentId: number) => void;
  onSell?: (investmentId: number) => void;
  onEdit?: (investmentId: number) => void;
}

/**
 * Quick action button component
 */
interface QuickActionButtonProps {
  icon: string | React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  bgColor: string;
  textColor: string;
  className?: string;
}

const QuickActionButton = memo(function QuickActionButton({
  icon,
  label,
  onClick,
  bgColor,
  textColor,
  className,
}: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        `flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg ${bgColor} ${textColor} hover:opacity-90 transition-opacity`,
        className,
      )}
    >
      {typeof icon === "string" ? (
        <Image src={icon} alt={label} width={20} height={20} />
      ) : (
        <>{icon}</>
      )}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
});

/**
 * Enhanced InvestmentCard component with compact mobile layout
 */
export const InvestmentCardEnhanced = memo(function InvestmentCardEnhanced({
  investment,
  userCurrency,
  onClick,
  showWallet = false,
  onBuyMore,
  onSell,
  onEdit,
}: InvestmentCardEnhancedProps) {
  const t = useTranslations("investment");
  const locale = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);

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
    priceHistory,
    isCustom,
  } = investment;

  const nativeCurrency = currency || "USD";
  const displayCcy = displayCurrency || userCurrency;

  // Use state to capture Date.now() once on mount to avoid impure function during render
  const [now] = useState(() => Date.now());

  // Compute if data is recent (within 5 minutes)
  const isRecent = useMemo(() => {
    if (!updatedAt) return false;
    return now / 1000 - updatedAt < 300;
  }, [now, updatedAt]);
  const pnl = unrealizedPnl || 0;
  const pnlPercent = unrealizedPnlPercent || 0;

  const pnlDisplay = formatUnrealizedPNL(
    pnl,
    pnlPercent,
    nativeCurrency,
    isCustom,
  );

  const isProfit = pnl >= 0;
  const pnlColor = isCustom
    ? "text-v2-text-secondary"
    : isProfit
      ? "text-v2-green-positive"
      : "text-v2-red-negative";
  const pnlBgColor = isCustom
    ? "bg-v2-maroon-900"
    : isProfit
      ? "bg-v2-green-positive/10"
      : "bg-v2-red-negative/10";
  const pnlBadgeColor = isCustom
    ? "bg-v2-maroon-900 text-v2-text-secondary"
    : isProfit
      ? "bg-v2-green-positive/10 text-v2-green-positive"
      : "bg-v2-red-negative/10 text-v2-red-negative";

  const sparklineData = priceHistory
    ? priceHistory.map((p) => ({ value: p.value }))
    : [];

  const handleCardClick = () => {
    // if (!isExpanded) {
    //   setIsExpanded(true);
    // } else {
    //   onClick?.(id);
    // }
    setIsExpanded(!isExpanded);
  };

  const handleBuyMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBuyMore?.(id);
  };

  const handleSell = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSell?.(id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(id);
  };

  return (
    <BaseCard
      className={`overflow-hidden ${onClick && !isExpanded ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={handleCardClick}
    >
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-v2-gold-accent truncate">
                {symbol}
              </h3>
              {isCustom && (
                <span className="inline-block px-2 py-0.5 text-xs bg-v2-gold-primary/20 text-v2-gold-primary rounded">
                  {t("detail.customInvestment")}
                </span>
              )}
              {!isCustom && sparklineData.length > 0 && (
                <div className="w-16 h-8">
                  <Sparkline
                    data={sparklineData}
                    height={32}
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </div>
            <p className="text-sm text-v2-text-tertiary truncate">{name}</p>
            {isCustom && (
              <div className="text-xs text-v2-text-tertiary mt-1 flex items-center gap-1">
                <InfoIcon size="xs" className="text-v2-text-tertiary" decorative />
                <span>{t("detail.noMarketData")}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-v2-maroon-900 text-v2-gold-accent">
              {getInvestmentTypeLabel(type, t as (key: string) => string)}
            </span>
            {!isCustom && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${pnlBadgeColor}`}
              >
                {isProfit ? "+" : ""}
                {formatPercent(pnlPercent)}
              </span>
            )}
          </div>
        </div>

        {showWallet && walletName && (
          <div className="mb-2">
            <span className="text-xs text-v2-text-tertiary">
              {t("form.walletLabel")}: {walletName}
            </span>
          </div>
        )}

        <div className="flex justify-between items-end">
          <div>
            <div className="text-xs text-v2-text-tertiary mb-1">
              {t("detail.currentValue")}
            </div>
            <div className="text-xl font-bold text-v2-gold-accent">
              {formatCurrency(currentValue || 0, nativeCurrency)}
            </div>
            {displayCurrentValue && displayCurrency && (
              <div className="text-xs text-v2-text-tertiary">
                ≈ {formatCurrency(displayCurrentValue.amount || 0, displayCcy)}
              </div>
            )}
          </div>

          <div className={`px-3 py-2 rounded-lg ${pnlBgColor}`}>
            <div className="text-xs text-v2-text-secondary mb-1">
              {t("analytics.totalPnl")}
            </div>
            <div className={`text-sm font-bold ${pnlDisplay.colorClass}`}>
              {isCustom ? (
                "N/A"
              ) : (
                <>
                  {isProfit ? "+" : ""}
                  {formatCurrency(Math.abs(pnl), nativeCurrency)}
                </>
              )}
            </div>
          </div>
        </div>

        {updatedAt && (
          <div className="flex items-center justify-between pt-2 border-t border-v2-border-light">
            <div className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${isRecent ? "bg-v2-green-positive animate-pulse" : "bg-v2-text-tertiary"}`}
              />
              <span className="text-xs text-v2-text-tertiary">
                {formatTimeAgo(updatedAt, t as any, locale).text}
              </span>
            </div>

            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg
                className="w-5 h-5 text-v2-text-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </motion.div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-v2-border-light">
              <div className="grid grid-cols-2 gap-4 py-3">
                <div>
                  <div className="text-xs text-v2-text-tertiary mb-1">
                    {t("detail.avgCost")}
                  </div>
                  <div className="text-sm font-semibold text-v2-gold-accent">
                    {formatPrice(
                      averageCost || 0,
                      type,
                      nativeCurrency,
                      purchaseUnit,
                      symbol,
                    )}
                  </div>
                  {displayAverageCost && displayCurrency && (
                    <div className="text-xs text-v2-text-tertiary">
                      ≈{" "}
                      {formatPrice(
                        displayAverageCost.amount || 0,
                        type,
                        displayCcy,
                        purchaseUnit,
                        symbol,
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-v2-text-tertiary mb-1">
                    {t("detail.currentPrice")}
                  </div>
                  <div className="text-sm font-semibold text-v2-gold-accent">
                    {isCustom
                      ? formatInvestmentPrice(
                          currentPrice || 0,
                          nativeCurrency,
                          isCustom,
                          t,
                        )
                      : formatPrice(
                          currentPrice || 0,
                          type,
                          nativeCurrency,
                          purchaseUnit,
                          symbol,
                        )}
                  </div>
                  {!isCustom && displayCurrentPrice && displayCurrency && (
                    <div className="text-xs text-v2-text-tertiary">
                      ≈{" "}
                      {formatPrice(
                        displayCurrentPrice.amount || 0,
                        type,
                        displayCcy,
                        purchaseUnit,
                        symbol,
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="py-2 border-t border-v2-border-light">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-v2-text-secondary">
                    {t("detail.quantityLabel")}
                  </span>
                  <span className="text-sm font-semibold text-v2-gold-accent">
                    {formatQuantity(quantity, type, purchaseUnit)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-v2-border-light ">
                <QuickActionButton
                  icon={<PlusIcon />}
                  label={t("modal.addInvestment")}
                  onClick={handleBuyMore}
                  bgColor="bg-v2-green-light"
                  textColor="text-v2-green-positive"
                  className="w-full"
                />
                {/* <QuickActionButton
                  icon={`${resources}/remove.svg`}
                  label="Sell"
                  onClick={handleSell}
                  bgColor="bg-red-100"
                  textColor="text-red-700"
                />
                <QuickActionButton
                  icon={`${resources}/editing.svg`}
                  label="Edit"
                  onClick={handleEdit}
                  bgColor="bg-primary-100"
                  textColor="text-primary-700"
                /> */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BaseCard>
  );
});
