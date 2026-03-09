"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Wallet as WalletIcon, ChartNoAxesCombined } from "lucide-react";
import Link from "next/link";
import { routes } from "@/app/constants";
import { BaseCard } from "@/components/BaseCard";
import type { WalletType } from "@/gen/protobuf/v1/wallet";

interface WalletItem {
  id: number;
  walletName: string;
  balance: number;
  currency: string;
  type: WalletType;
}

interface WalletsSectionProps {
  wallets: WalletItem[];
}

export function WalletsSection({ wallets }: WalletsSectionProps) {
  const t = useTranslations("dashboard.home");

  const formatBalance = (balance: number, currency: string) => {
    if (currency === "VND") {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(balance);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(balance / 100);
  };

  // Investment type is 1 based on proto enum
  const isInvestment = (type: WalletType) => type === 1;

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
          {t("wallets")}
        </h3>
        <Link
          href={routes.wallets}
          className="flex items-center gap-1 font-vietnam font-medium text-[13px] text-v2-red-primary hover:text-v2-red-dark transition-colors"
        >
          {t("seeAll")}
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* Wallet cards */}
      <div className="space-y-3 overflow-y-auto flex-1 min-h-0">
        {wallets.map((wallet) => (
          <BaseCard
            key={wallet.id}
            padding="none"
            className="flex items-center gap-3 p-4 rounded-2xl border border-v2-border-light shadow-v2-card"
          >
            <div className="w-10 h-10 rounded-xl bg-v2-bg-primary flex items-center justify-center shrink-0">
              {isInvestment(wallet.type) ? (
                <ChartNoAxesCombined size={20} className="text-v2-gold-primary" />
              ) : (
                <WalletIcon size={20} className="text-v2-red-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-vietnam font-medium text-[14px] text-v2-text-primary truncate">
                {wallet.walletName}
              </p>
            </div>
            <p className="font-jetbrains font-semibold text-[14px] text-v2-text-primary shrink-0">
              {formatBalance(wallet.balance, wallet.currency)}
            </p>
          </BaseCard>
        ))}

        {wallets.length === 0 && (
          <div className="text-center py-8">
            <p className="font-vietnam text-[13px] text-v2-text-tertiary">
              {t("comingSoon")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
