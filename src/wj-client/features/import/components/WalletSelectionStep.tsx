"use client";

import { useState } from "react";
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
        <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-neutral-50 dark:bg-dark-surface-secondary p-8 sm:p-12">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-800"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-600 dark:border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-lg font-medium text-neutral-900 dark:text-dark-text">
            Loading your wallets...
          </p>
          <p className="mt-2 text-sm text-neutral-600 dark:text-dark-text-secondary">
            This will just take a moment
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-danger-50 dark:bg-danger-950 border-2 border-danger-200 dark:border-danger-800 p-8 sm:p-12">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mb-4">
            <ExclamationCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
            Failed to Load Wallets
          </h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error?.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onBack}
            className="min-h-[44px] px-6"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col items-center justify-center text-center rounded-2xl bg-warning-50 dark:bg-warning-950 border-2 border-warning-200 dark:border-warning-800 p-8 sm:p-12">
          <div className="w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mb-4">
            <WalletIcon className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100">
            No Wallets Found
          </h3>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 max-w-md">
            You need to create at least one wallet before importing transactions.
            Please go to the Wallets page to create your first wallet.
          </p>
        </div>
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={onBack}
            className="min-h-[44px] px-6"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 mb-2">
          <WalletIcon className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-dark-text">
          Select Destination Wallet
        </h2>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary max-w-lg mx-auto">
          Choose the wallet where your imported transactions will be added. The
          wallet balance will be updated automatically.
        </p>
      </div>

      {/* Wallet Count Badge */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 dark:bg-dark-surface-secondary">
          <WalletIcon className="w-4 h-4 text-neutral-600 dark:text-dark-text-secondary" />
          <span className="text-sm font-medium text-neutral-700 dark:text-dark-text-secondary">
            {wallets.length} wallet{wallets.length !== 1 ? "s" : ""} available
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
              aria-label={`${wallet.walletName}, balance ${formatCurrency(wallet.balance?.amount || 0, wallet.balance?.currency || "VND")}. ${isSelected ? "Selected" : "Not selected"}`}
              aria-pressed={isSelected}
              className={cn(
                "relative min-h-[120px] p-5 rounded-2xl border-2 transition-all duration-200",
                "flex flex-col justify-between text-left",
                "hover:shadow-lg active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                isSelected
                  ? "border-primary-500 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 shadow-lg"
                  : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-primary-300 dark:hover:border-primary-700",
              )}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="w-6 h-6 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center shadow-md">
                    <CheckCircleIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              {/* Wallet Icon Badge */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-3",
                  isSelected
                    ? "bg-primary-200 dark:bg-primary-800"
                    : "bg-neutral-100 dark:bg-dark-surface-secondary",
                )}
              >
                <WalletIcon
                  className={cn(
                    "w-6 h-6",
                    isSelected
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-dark-text-secondary",
                  )}
                />
              </div>

              {/* Wallet Info */}
              <div className="space-y-1.5">
                <h3
                  className={cn(
                    "font-semibold text-base line-clamp-1",
                    isSelected
                      ? "text-primary-900 dark:text-primary-100"
                      : "text-neutral-900 dark:text-dark-text",
                  )}
                >
                  {wallet.walletName}
                </h3>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isSelected
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-neutral-600 dark:text-dark-text-secondary",
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
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!selectedWalletId}
          className="min-h-[44px] flex-1 sm:flex-initial"
        >
          Continue
          <ArrowRightIcon className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
