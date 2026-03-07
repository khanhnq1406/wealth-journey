"use client";

import React, { memo } from "react";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";

/**
 * Wallet data type
 */
export interface WalletData {
  id: number;
  walletName: string;
  balance?: { amount: number; currency: string };
  displayBalance?: { amount: number; currency: string };
  totalValue?: { amount: number; currency: string };
  displayTotalValue?: { amount: number; currency: string };
  displayCurrency?: string;
}

/**
 * WalletCashBalanceCard component props
 */
export interface WalletCashBalanceCardProps {
  /** Wallet data to display */
  wallet: WalletData | undefined;
  /** User's preferred currency for display */
  userCurrency: string;
}

/**
 * WalletCashBalanceCard component displays wallet cash balance and total value
 */
export const WalletCashBalanceCard = memo(function WalletCashBalanceCard({
  wallet,
  userCurrency,
}: WalletCashBalanceCardProps) {
  const t = useTranslations("investment");
  if (!wallet) return null;

  const availableCash =
    wallet.displayBalance?.amount ??
    wallet.balance?.amount ??
    0;
  const availableCashCurrency =
    wallet.displayCurrency ||
    wallet.balance?.currency ||
    userCurrency;

  const totalValue =
    wallet.displayTotalValue?.amount ??
    wallet.totalValue?.amount ??
    0;
  const totalValueCurrency =
    wallet.displayCurrency ||
    wallet.totalValue?.currency ||
    userCurrency;

  return (
    <BaseCard className="p-4 mb-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm text-neutral-600">
            {t("cashBalance.availableCash")}
          </div>
          <div className="text-lg sm:text-xl font-semibold text-primary-600">
            {formatCurrency(availableCash, availableCashCurrency)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {t("cashBalance.readyToInvest")}
          </div>
        </div>
        <div>
          <div className="text-sm text-neutral-600">
            {t("cashBalance.totalWalletValue")}
          </div>
          <div className="text-lg sm:text-xl font-semibold">
            {formatCurrency(totalValue, totalValueCurrency)}
          </div>
          <div className="text-xs text-neutral-500 mt-1">
            {t("cashBalance.cashAndInvestments")}
          </div>
        </div>
      </div>
    </BaseCard>
  );
});
