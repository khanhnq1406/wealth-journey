"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { useQueryListWallets } from "@/utils/generated/hooks";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  WalletIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

export interface WalletSelectionStepProps {
  onWalletSelected: (walletId: number) => void;
  onBack: () => void;
  onNext: () => void;
}

export function WalletSelectionStep({
  onWalletSelected,
  onBack,
  onNext,
}: WalletSelectionStepProps) {
  const t = useTranslations("import.walletSelection");
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);

  const {
    data: walletsData,
    isLoading,
    isError,
    error,
  } = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  const handleSelectWallet = (walletId: number) => {
    setSelectedWalletId(walletId);
    onWalletSelected(walletId);
  };

  const wallets = walletsData?.wallets || [];

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 py-8">
 <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-v2-bg-dark p-8 sm:p-12">
          <div className="relative w-16 h-16 mb-4">
 <div className="absolute inset-0 rounded-full border-4 border-v2-gold-primary/30"></div>
 <div className="absolute inset-0 rounded-full border-4 border-v2-gold-primary border-t-transparent animate-spin"></div>
          </div>
 <p className="text-lg font-medium text-white">
            {t("loadingWallets")}
          </p>
 <p className="mt-2 text-sm text-v2-text-secondary">
            {t("loadingMoment")}
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
 <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-danger-50 border-2 border-danger-200 p-8 sm:p-12">
 <div className="w-16 h-16 rounded-full bg-v2-bg-dark flex items-center justify-center mb-4">
 <ExclamationCircleIcon className="w-8 h-8 text-v2-red-negative" />
          </div>
 <h3 className="text-lg font-semibold text-v2-red-negative">
            {t("failedToLoad")}
          </h3>
 <p className="mt-2 text-sm text-v2-red-negative">
            {error?.message || t("unexpectedError")}
          </p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onBack}
            className="min-h-[44px] px-6"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            {t("back")}
          </Button>
        </div>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
 <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-warning-50 border-2 border-warning-200 p-8 sm:p-12">
 <div className="w-16 h-16 rounded-full bg-v2-bg-dark flex items-center justify-center mb-4">
 <WalletIcon className="w-8 h-8 text-yellow-400" />
          </div>
 <h3 className="text-lg font-semibold text-yellow-400">
            {t("noWalletsFound")}
          </h3>
 <p className="mt-2 text-sm text-yellow-400 max-w-md">
            {t("noWalletsDesc")}
          </p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onBack}
            className="min-h-[44px] px-6"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            {t("back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-3">
 <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-v2-bg-dark mb-2">
 <WalletIcon className="w-8 h-8 text-v2-gold-primary" />
        </div>
 <h2 className="text-xl sm:text-2xl font-bold text-white">
          {t("title")}
        </h2>
 <p className="text-sm sm:text-base text-v2-text-secondary max-w-lg mx-auto">
          {t("subtitle")}
        </p>
      </div>

      {/* Wallet Count Badge */}
      <div className="flex items-center justify-center">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-v2-bg-dark">
 <WalletIcon className="w-4 h-4 text-v2-text-secondary" />
 <span className="text-sm font-medium text-v2-text-secondary">
            {wallets.length !== 1 ? t("walletsAvailablePlural", { count: wallets.length }) : t("walletsAvailable", { count: wallets.length })}
          </span>
        </div>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[50vh] overflow-y-auto -mx-1 px-1">
        {wallets.map((wallet) => {
          const isSelected = selectedWalletId === wallet.id;
          return (
            <button
              key={wallet.id}
              onClick={() => handleSelectWallet(wallet.id)}
              aria-label={`${wallet.walletName}, balance ${formatCurrency(wallet.balance?.amount || 0, wallet.balance?.currency || "VND")}. ${isSelected ? t("selected") : t("notSelected")}`}
              aria-pressed={isSelected}
              className={cn(
                "relative min-h-[120px] p-5 rounded-2xl border-2 transition-all duration-200",
                "flex flex-col justify-between text-left",
                "hover:shadow-lg active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
                isSelected
 ? "border-v2-gold-primary bg-v2-bg-dark shadow-lg"
 : "border-v2-border-light bg-v2-bg-surface hover:border-v2-gold-primary/60",
              )}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
 <div className="w-6 h-6 rounded-full bg-v2-gold-primary flex items-center justify-center shadow-md">
                    <CheckCircleIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              {/* Wallet Icon Badge */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                  isSelected
 ? "bg-v2-bg-surface-tint"
 : "bg-v2-bg-dark",
                )}
              >
                <WalletIcon
                  className={cn(
                    "w-6 h-6",
                    isSelected
 ? "text-v2-gold-primary"
 : "text-v2-text-secondary",
                  )}
                />
              </div>

              {/* Wallet Info */}
              <div className="space-y-1.5">
                <h3
                  className={cn(
                    "font-semibold text-base line-clamp-1",
                    isSelected
 ? "text-white"
 : "text-white",
                  )}
                >
                  {wallet.walletName}
                </h3>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected
 ? "text-v2-gold-primary"
 : "text-v2-text-secondary",
                  )}
                >
                  {formatCurrency(
                    wallet.balance?.amount || 0,
                    wallet.balance?.currency || "VND",
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          variant="secondary"
          onClick={onBack}
          className="min-h-[44px] sm:w-auto"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          {t("back")}
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!selectedWalletId}
          className="min-h-[44px] flex-1 sm:flex-initial"
        >
          {t("continue")}
          <ArrowRightIcon className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
