"use client";

import { memo } from "react";
import Image from "next/image";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType, resources } from "@/app/constants";
import { formatCurrency } from "@/utils/currency-formatter";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ProgressBar } from "@/components/ProgressBar";
import { useTranslations } from "next-intl";

interface WalletCardProps {
  wallet: Wallet;
  onEdit: (wallet: Wallet) => void;
  onDelete: (wallet: Wallet) => void;
}

export const WalletCard = memo(function WalletCard({
  wallet,
  onEdit,
  onDelete,
}: WalletCardProps) {
  const t = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const { currency } = useCurrency();
  const isInvestmentWallet = wallet.type === 1; // WALLET_TYPE_INVESTMENT

  // Use displayBalance/displayTotalValue if available (converted), otherwise use original
  const balance = wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0;
  const displayCurrency = wallet.displayCurrency || currency;

  // For investment wallets, calculate total value and breakdown
  let totalValue = balance;
  let investmentValue = 0;
  let cashPercentage = 100;

  if (isInvestmentWallet) {
    totalValue = wallet.displayTotalValue?.amount ?? wallet.totalValue?.amount ?? balance;
    investmentValue = wallet.displayInvestmentValue?.amount ?? wallet.investmentValue?.amount ?? 0;

    // Calculate percentage of cash vs investments
    if (totalValue > 0) {
      cashPercentage = Math.round((balance / totalValue) * 100);
    }
  }

  return (
    <BaseCard className="p-4">
      <div className="flex flex-col gap-3">
        {/* Header with wallet icon, name and actions */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Image
              src={`${resources}wallet.svg`}
              alt="Wallet"
              width={32}
              height={32}
            />
            <h3 className="text-lg font-semibold">{wallet.walletName}</h3>
          </div>
          <div className="flex gap-2">
            <Button
              type={ButtonType.IMG}
              src={`${resources}/editing.svg`}
              onClick={() => onEdit(wallet)}
            />
            <Button
              type={ButtonType.IMG}
              src={`${resources}/remove.svg`}
              onClick={() => onDelete(wallet)}
            />
          </div>
        </div>

        {/* Balance display */}
        <div className="text-right">
          <div className="text-sm text-gray-500">
            {isInvestmentWallet ? "Total Value" : tCommon("balance")}
          </div>
          <div className="text-2xl font-bold text-primary-600">
            {formatCurrency(totalValue, displayCurrency)}
          </div>
        </div>

        {/* Investment wallet breakdown with progress bar */}
        {isInvestmentWallet && totalValue > 0 && (
          <div className="mt-2">
            <ProgressBar
              percentage={cashPercentage}
              label={`${cashPercentage}% cash`}
            />
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>{tCommon("cash")}: {formatCurrency(balance, displayCurrency)}</span>
              <span>{tCommon("investment")}: {formatCurrency(investmentValue, displayCurrency)}</span>
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
});
