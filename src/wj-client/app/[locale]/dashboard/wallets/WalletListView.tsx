"use client";

import { memo, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, parseAmount } from "@/utils/currency-formatter";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/Button";
import { useTranslations } from "next-intl";

export interface WalletListViewProps {
  wallets: Wallet[];
  onEdit: (wallet: Wallet) => void;
  onDelete: (wallet: Wallet) => void;
  onTransfer?: (fromWallet: Wallet, toWallet: Wallet) => void;
  selectedWallets?: Set<number>;
  onToggleSelect?: (walletId: number) => void;
  sortBy?: "name" | "balance" | "type";
  sortOrder?: "asc" | "desc";
  filterType?: "all" | "basic" | "investment";
  className?: string;
}

/**
 * List view for wallets with compact display.
 * - Quick balance transfer between wallets
 * - Total balance summary
 * - Filter by wallet type
 * - Sort by balance/name
 * - Multi-select for batch operations
 */
export const WalletListView = memo(function WalletListView({
  wallets,
  onEdit,
  onDelete,
  onTransfer,
  selectedWallets,
  onToggleSelect,
  sortBy = "name",
  sortOrder = "asc",
  filterType = "all",
  className,
}: WalletListViewProps) {
  const t = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const tFeedback = useTranslations("feedback.emptyState");
  const tDashboard = useTranslations("dashboard.home");
  const { currency } = useCurrency();

  // Filter and sort wallets
  const processedWallets = useMemo(() => {
    let filtered = [...wallets];

    // Filter by type
    if (filterType === "basic") {
      filtered = filtered.filter((w) => w.type === 0 || !w.type);
    } else if (filterType === "investment") {
      filtered = filtered.filter((w) => w.type === 1);
    }

    // Sort wallets
    filtered.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "name") {
        comparison = a.walletName.localeCompare(b.walletName);
      } else if (sortBy === "balance") {
        const balanceA = parseAmount(a.displayBalance?.amount ?? a.balance?.amount);
        const balanceB = parseAmount(b.displayBalance?.amount ?? b.balance?.amount);
        comparison = balanceA - balanceB;
      } else if (sortBy === "type") {
        comparison = a.type - b.type;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [wallets, sortBy, sortOrder, filterType]);

  // Calculate total balance
  const totalBalance = useMemo(() => {
    return processedWallets.reduce((sum, wallet) => {
      const isInvestment = wallet.type === 1;
      const baseBalance = parseAmount(
        wallet.displayBalance?.amount ?? wallet.balance?.amount
      );
      // For investment wallets, use totalValue (balance + investment value)
      const balance = isInvestment
        ? parseAmount(wallet.displayTotalValue?.amount ?? wallet.totalValue?.amount) || baseBalance
        : baseBalance;
      return sum + balance;
    }, 0);
  }, [processedWallets]);

  const handleTransfer = useCallback(
    (fromWallet: Wallet) => {
      if (onTransfer) {
        // Show wallet selection modal or navigate to transfer
        // For now, trigger callback - parent component handles transfer UI
        onTransfer(fromWallet, null as any);
      }
    },
    [onTransfer],
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Total Balance Summary */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl p-4 sm:p-6 mb-4 shadow-lg">
        <p className="text-sm text-primary-100 mb-1">{tDashboard("totalNetWorth")}</p>
        <p className="text-3xl sm:text-4xl font-bold">
          {formatCurrency(totalBalance, currency)}
        </p>
        <p className="text-xs text-primary-200 mt-2">
          {processedWallets.length} wallet
          {processedWallets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Wallet List */}
      <div className="space-y-2">
        {processedWallets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-dark-text-tertiary">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <p className="text-lg font-medium">{tFeedback("noWalletsFound")}</p>
            <p className="text-sm">
              {tFeedback("noWalletsDescription")}
            </p>
          </div>
        ) : (
          processedWallets.map((wallet) => {
            const isInvestment = wallet.type === 1;
            const baseBalance = parseAmount(
              wallet.displayBalance?.amount ?? wallet.balance?.amount
            );
            // For investment wallets, use totalValue (balance + investment value)
            const balance = isInvestment
              ? parseAmount(wallet.displayTotalValue?.amount ?? wallet.totalValue?.amount) || baseBalance
              : baseBalance;
            const isSelected = selectedWallets?.has(wallet.id);

            return (
              <div
                key={wallet.id}
                className={cn(
                  "bg-white dark:bg-dark-surface rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200",
                  "border-2",
                  isSelected
                    ? "border-primary-500"
                    : "border-transparent hover:border-gray-200 dark:hover:border-dark-border",
                )}
              >
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  {/* Select Checkbox */}
                  {onToggleSelect && (
                    <button
                      type="button"
                      onClick={() => onToggleSelect(wallet.id)}
                      className={cn(
                        "flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-primary-600 border-primary-600"
                          : "border-gray-300 dark:border-dark-border hover:border-primary-400",
                      )}
                      aria-label={
                        isSelected ? "Deselect wallet" : "Select wallet"
                      }
                      aria-pressed={isSelected}
                    >
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* Wallet Icon */}
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
                    {isInvestment ? (
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 dark:text-primary-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Wallet Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-dark-text truncate">
                        {wallet.walletName}
                      </h3>
                      {isInvestment && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {tCommon("investment")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-dark-text-tertiary">
                      {wallet.currency}
                    </p>
                  </div>

                  {/* Balance */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-dark-text">
                      {formatCurrency(balance, currency)}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {onTransfer && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleTransfer(wallet)}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        aria-label={`Transfer from ${wallet.walletName}`}
                      >
                        <svg
                          className="w-5 h-5 text-primary-600 dark:text-primary-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => onEdit(wallet)}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-surface-hover transition-colors"
                      aria-label={`Edit ${wallet.walletName}`}
                    >
                      <svg
                        className="w-5 h-5 text-gray-600 dark:text-dark-text-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </Button>

                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => onDelete(wallet)}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                      aria-label={`Delete ${wallet.walletName}`}
                    >
                      <svg
                        className="w-5 h-5 text-danger-600 dark:text-danger-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
