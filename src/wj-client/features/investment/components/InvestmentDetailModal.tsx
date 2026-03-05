"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { BaseModal } from "@/components/modals/BaseModal";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { TanStackTable } from "@/components/table/TanStackTable";
import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import {
  useQueryGetInvestment,
  useQueryListInvestmentTransactions,
  useMutationUpdatePrices,
  useMutationDeleteInvestmentTransaction,
  useMutationDeleteInvestment,
  useQueryGetWallet,
  EVENT_InvestmentGetInvestment,
  EVENT_InvestmentListInvestments,
  EVENT_InvestmentGetPortfolioSummary,
  EVENT_WalletListWallets,
  EVENT_WalletGetWallet,
} from "@/utils/generated/hooks";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { InvestmentTransactionType } from "@/gen/protobuf/v1/investment";
import { AddInvestmentTransactionForm } from "@/features/investment/forms/AddInvestmentTransactionForm";
import { UpdateInvestmentPriceForm } from "@/features/investment/forms/UpdateInvestmentPriceForm";
import { formatCurrency } from "@/lib/utils/units";
import {
  formatQuantity,
  formatPrice,
  isCustomInvestment,
  formatInvestmentPrice,
  formatUnrealizedPNL,
} from "@/app/dashboard/portfolio/helpers";
import { isGoldType } from "@/features/investment/utils/gold-calculator";
import { isSilverType } from "@/features/investment/utils/silver-calculator";

export type TabType =
  | "overview"
  | "transactions"
  | "add-transaction"
  | "set-price";
export interface InvestmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  investmentId: number;
  onSuccess?: () => void;
  activeTabProp?: TabType;
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTransactionTypeLabel = (type: InvestmentTransactionType): string => {
  switch (type) {
    case InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY:
      return "Buy";
    case InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SELL:
      return "Sell";
    case InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_DIVIDEND:
      return "Dividend";
    case InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SPLIT:
      return "Split";
    default:
      return "Unknown";
  }
};

type Transaction = {
  id: number;
  type: InvestmentTransactionType;
  quantity: number;
  price: number;
  fees: number;
  cost: number;
  transactionDate: number;
  // Display fields (converted to user's preferred currency)
  displayPrice?: { amount: number; currency: string };
  displayFees?: { amount: number; currency: string };
  displayCost?: { amount: number; currency: string };
  displayCurrency?: string;
};

export function InvestmentDetailModal({
  isOpen,
  onClose,
  investmentId,
  onSuccess,
  activeTabProp,
}: InvestmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(
    activeTabProp || "overview",
  );
  const [deletingTransactionId, setDeletingTransactionId] = useState<
    number | null
  >(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteInvestment, setShowDeleteInvestment] = useState(false);
  const [deleteInvestmentError, setDeleteInvestmentError] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();

  // Fetch investment details
  const getInvestment = useQueryGetInvestment(
    { id: investmentId },
    {
      enabled: isOpen && !!investmentId,
      refetchOnMount: "always",
    },
  );

  const investment = getInvestment.data?.data;

  // Check if this is a custom investment
  const isCustom = investment
    ? isCustomInvestment({
        currentPrice: investment.currentPrice || 0,
        symbol: investment.symbol,
        type: investment.type,
      })
    : false;

  // Format unrealized PNL for custom investments
  const pnlDisplay = investment
    ? formatUnrealizedPNL(
        investment.unrealizedPnl || 0,
        investment.unrealizedPnlPercent || 0,
        investment.currency || "USD",
        isCustom,
      )
    : { text: "N/A", colorClass: "text-gray-500" };

  // Fetch wallet balance and currency for balance validation in AddInvestmentTransactionForm
  const getWallet = useQueryGetWallet(
    { walletId: investment?.walletId || 0 },
    { enabled: !!investment?.walletId },
  );
  const walletBalance = getWallet.data?.data?.balance?.amount || 0;
  const walletCurrency = getWallet.data?.data?.balance?.currency || "USD";

  // Mutation for updating investment prices
  const updatePricesMutation = useMutationUpdatePrices({
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentGetInvestment],
      });

      // Call the onSuccess callback to refresh modal data
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      console.error(`Failed to update price: ${error.message}`);
    },
  });

  // Mutation for deleting investment transactions
  const deleteTransactionMutation = useMutationDeleteInvestmentTransaction({
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentGetInvestment],
      });
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListInvestments],
      });
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentGetPortfolioSummary],
      });
      // Invalidate wallet queries to refresh balance after transaction deletion
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetWallet] });

      // Refetch data
      getInvestment.refetch();
      getListInvestmentTransactions.refetch();

      // Clear state
      setDeletingTransactionId(null);
      setDeleteError(null);
    },
    onError: (error: any) => {
      setDeleteError(error.message || "Failed to delete transaction");
    },
  });

  // Handle delete transaction
  const handleDeleteTransaction = (transactionId: number) => {
    setDeleteError(null);
    deleteTransactionMutation.mutate({ id: transactionId });
  };

  // Mutation for deleting investment
  const deleteInvestmentMutation = useMutationDeleteInvestment({
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListInvestments],
      });
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentGetPortfolioSummary],
      });
      // Invalidate wallet queries to refresh balance after investment deletion
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
      queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetWallet] });

      // Call success callback and close modal
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      setDeleteInvestmentError(error.message || "Failed to delete investment");
    },
  });

  // Handle delete investment
  const handleDeleteInvestment = () => {
    setDeleteInvestmentError(null);
    deleteInvestmentMutation.mutate({ id: investmentId });
  };

  // Fetch investment transactions
  const getListInvestmentTransactions = useQueryListInvestmentTransactions(
    {
      investmentId: investmentId,
      pagination: { page: 1, pageSize: 100, orderBy: "", order: "" },
      typeFilter: 0,
    },
    {
      enabled: isOpen && !!investmentId && activeTab === "transactions",
      refetchOnMount: "always",
    },
  );

  const transactions = getListInvestmentTransactions.data?.data || [];

  // Define table columns using ColumnDef
  const columns: ColumnDef<Transaction>[] = useMemo(
    () => [
      {
        id: "type",
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.type;
          return (
            <span
              className={`font-medium ${
                type ===
                InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY
                  ? "text-primary-600"
                  : type ===
                      InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SELL
                    ? "text-red-600"
                    : "text-secondary-600"
              }`}
            >
              {getTransactionTypeLabel(type)}
            </span>
          );
        },
      },
      {
        id: "quantity",
        accessorKey: "quantity",
        header: "Quantity",
        cell: ({ row }) =>
          formatQuantity(
            row.original.quantity,
            investment?.type || 0,
            investment?.purchaseUnit,
          ),
      },
      {
        id: "price",
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => {
          const nativeCurrency = investment?.currency || "USD";
          const price = row.original.price || 0;
          return (
            <div>
              <span className="font-medium">
                {formatPrice(
                  price,
                  investment?.type || 0,
                  nativeCurrency,
                  investment?.purchaseUnit,
                  investment?.symbol,
                )}
              </span>
              {row.original.displayPrice && row.original.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatPrice(
                    row.original.displayPrice.amount || 0,
                    investment?.type || 0,
                    row.original.displayCurrency,
                    investment?.purchaseUnit,
                    investment?.symbol,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "fees",
        accessorKey: "fees",
        header: "Fees",
        cell: ({ row }) => {
          const nativeCurrency = investment?.currency || "USD";
          const fees = row.original.fees || 0;
          return (
            <div>
              <span className="font-medium">
                {formatCurrency(fees, nativeCurrency)}
              </span>
              {row.original.displayFees && row.original.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatCurrency(
                    row.original.displayFees.amount || 0,
                    row.original.displayCurrency,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "cost",
        accessorKey: "cost",
        header: "Total",
        cell: ({ row }) => {
          const nativeCurrency = investment?.currency || "USD";
          const cost = row.original.cost || 0;
          return (
            <div>
              <span className="font-medium">
                {formatCurrency(cost, nativeCurrency)}
              </span>
              {row.original.displayCost && row.original.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatCurrency(
                    row.original.displayCost.amount || 0,
                    row.original.displayCurrency,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "transactionDate",
        accessorKey: "transactionDate",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.transactionDate || 0),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingTransactionId(row.original.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete transaction"
            aria-label="Delete transaction"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        ),
      },
    ],
    [investment?.type, investment?.currency, investment?.purchaseUnit],
  );

  // Define mobile table columns
  const mobileColumns: MobileColumnDef<Transaction>[] = useMemo(
    () => [
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => {
          const type = row.type;
          return (
            <span
              className={`font-medium ${
                type ===
                InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY
                  ? "text-primary-600"
                  : type ===
                      InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_SELL
                    ? "text-red-600"
                    : "text-secondary-600"
              }`}
            >
              {getTransactionTypeLabel(type)}
            </span>
          );
        },
      },
      {
        id: "quantity",
        header: "Quantity",
        accessorFn: (row) =>
          formatQuantity(
            row.quantity,
            investment?.type || 0,
            investment?.purchaseUnit,
          ),
      },
      {
        id: "price",
        header: "Price",
        accessorFn: (row) =>
          formatPrice(
            row.price || 0,
            investment?.type || 0,
            investment?.currency || "USD",
            investment?.purchaseUnit,
            investment?.symbol,
          ),
      },
      {
        id: "fees",
        header: "Fees",
        accessorFn: (row) =>
          formatCurrency(row.fees || 0, investment?.currency || "USD"),
      },
      {
        id: "cost",
        header: "Total",
        accessorFn: (row) =>
          formatCurrency(row.cost || 0, investment?.currency || "USD"),
      },
      {
        id: "transactionDate",
        header: "Date",
        accessorFn: (row) => formatDate(row.transactionDate || 0),
      },
      {
        id: "actions",
        header: "",
        accessorFn: (row) => (
          <button
            onClick={() => setDeletingTransactionId(row.id)}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete transaction"
            aria-label="Delete transaction"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        ),
      },
    ],
    [investment?.type, investment?.currency, investment?.purchaseUnit],
  );

  // Handle successful transaction addition
  const handleTransactionSuccess = () => {
    onSuccess?.();
    getInvestment.refetch();
    getListInvestmentTransactions.refetch();
    setActiveTab("overview");
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={investment?.name || "Investment Details"}
      maxWidth="max-w-[80vw]"
    >
      {getInvestment.isLoading || getInvestment.isPending ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner text="Loading investment details..." />
        </div>
      ) : investment ? (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab("overview")}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === "overview"
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === "transactions"
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab("add-transaction")}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === "add-transaction"
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Add Transaction
            </button>
            <button
              onClick={() => setActiveTab("set-price")}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === "set-price"
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Set Price
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-3">
              {/* Investment header with custom badge */}
              {isCustom && (
                <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200 flex items-center gap-2">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-medium">
                    Custom Investment
                  </span>
                  <span className="text-sm text-blue-700">
                    No market data available
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Symbol</span>
                <span className="font-semibold">{investment.symbol}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Name</span>
                <span>{investment.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Currency</span>
                <span className="font-medium">
                  {investment.currency || "USD"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Quantity</span>
                <span className="font-medium">
                  {formatQuantity(
                    investment.quantity,
                    investment.type,
                    investment.purchaseUnit,
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Avg Cost</span>
                <span>
                  {formatPrice(
                    investment.averageCost || 0,
                    investment.type,
                    investment.currency || "USD",
                    investment.purchaseUnit,
                    investment.symbol,
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">Current Price</span>
                  {!isCustomInvestment(investment) && (
                    <button
                      onClick={() =>
                        updatePricesMutation.mutate({
                          investmentIds: [investment.id],
                          forceRefresh: true,
                        })
                      }
                      disabled={updatePricesMutation.isPending}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
                      title="Refresh price"
                    >
                      <svg
                        className={`w-4 h-4 text-gray-500 ${updatePricesMutation.isPending ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab("set-price")}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Set price manually"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
                <div className="text-right">
                  <span>
                    {isCustomInvestment(investment)
                      ? formatInvestmentPrice(
                          investment.currentPrice || 0,
                          investment.currency || "USD",
                          true,
                        )
                      : formatPrice(
                          investment.currentPrice || 0,
                          investment.type,
                          investment.currency || "USD",
                          investment.purchaseUnit,
                          investment.symbol,
                        )}
                  </span>
                  <div className="mt-1">
                    {(() => {
                      const date = new Date(investment.updatedAt * 1000);
                      const now = new Date();
                      const diffMs = now.getTime() - date.getTime();
                      const diffMins = Math.floor(diffMs / 60000);

                      let text: string;
                      let colorClass: string;

                      if (diffMins < 1) {
                        text = "Just now";
                        colorClass = "text-primary-600";
                      } else if (diffMins < 5) {
                        text = `${diffMins}m ago`;
                        colorClass = "text-primary-600";
                      } else if (diffMins < 15) {
                        text = `${diffMins}m ago`;
                        colorClass = "text-primary-600";
                      } else if (diffMins < 60) {
                        text = `${diffMins}m ago`;
                        colorClass = "text-yellow-600";
                      } else if (diffMins < 1440) {
                        text = `${Math.floor(diffMins / 60)}h ago`;
                        colorClass = "text-orange-600";
                      } else {
                        text = date.toLocaleDateString();
                        colorClass = "text-red-600";
                      }

                      return (
                        <span className={`text-xs ${colorClass}`}>
                          Updated {text}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Show warning message for custom investments without price */}
              {isCustomInvestment(investment) &&
                investment.currentPrice === 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-md border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      ⚠️ This is a custom investment without a set price. Click
                      &quot;Set Price&quot; tab to update the current value.
                    </p>
                  </div>
                )}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Cost</span>
                <div className="text-right">
                  <span>
                    {formatCurrency(
                      investment.totalCost || 0,
                      investment.currency || "USD",
                    )}
                  </span>
                  {investment.displayTotalCost &&
                    investment.displayCurrency && (
                      <span className="text-xs text-gray-500 block">
                        ≈{" "}
                        {formatCurrency(
                          investment.displayTotalCost.amount || 0,
                          investment.displayCurrency,
                        )}
                      </span>
                    )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Value</span>
                <div className="text-right">
                  <span className="font-semibold">
                    {formatCurrency(
                      investment.currentValue || 0,
                      investment.currency || "USD",
                    )}
                  </span>
                  {investment.displayCurrentValue &&
                    investment.displayCurrency && (
                      <span className="text-xs text-gray-500 block">
                        ≈{" "}
                        {formatCurrency(
                          investment.displayCurrentValue.amount || 0,
                          investment.displayCurrency,
                        )}
                      </span>
                    )}
                </div>
              </div>
              <div className="border-t pt-3">
                {/* Only show PNL if not custom or price is set */}
                {(!isCustomInvestment(investment) ||
                  investment.currentPrice > 0) && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Unrealized PNL</span>
                      <div className="text-right">
                        <span
                          className={`font-semibold ${
                            (investment.unrealizedPnl || 0) >= 0
                              ? "text-primary-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(
                            investment.unrealizedPnl || 0,
                            investment.currency || "USD",
                          )}
                        </span>
                        {investment.displayUnrealizedPnl &&
                          investment.displayCurrency && (
                            <span className="text-xs text-gray-500 block">
                              ≈{" "}
                              {formatCurrency(
                                investment.displayUnrealizedPnl.amount || 0,
                                investment.displayCurrency,
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Unrealized PNL %</span>
                      <span
                        className={`font-semibold ${
                          (investment.unrealizedPnlPercent || 0) >= 0
                            ? "text-primary-600"
                            : "text-red-600"
                        }`}
                      >
                        {(investment.unrealizedPnlPercent || 0) >= 0 ? "+" : ""}
                        {(investment.unrealizedPnlPercent || 0).toFixed(2)}%
                      </span>
                    </div>
                  </>
                )}

                {/* Show N/A message for custom investments without price */}
                {isCustomInvestment(investment) &&
                  investment.currentPrice === 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Unrealized PNL</span>
                      <span className="text-gray-500">N/A (Price not set)</span>
                    </div>
                  )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Realized PNL</span>
                  <div className="text-right">
                    <span
                      className={`font-semibold ${
                        (investment.realizedPnl || 0) >= 0
                          ? "text-primary-600"
                          : "text-red-600"
                      }`}
                    >
                      {formatCurrency(
                        investment.realizedPnl || 0,
                        investment.currency || "USD",
                      )}
                    </span>
                    {investment.displayRealizedPnl &&
                      investment.displayCurrency && (
                        <span className="text-xs text-gray-500 block">
                          ≈{" "}
                          {formatCurrency(
                            investment.displayRealizedPnl.amount || 0,
                            investment.displayCurrency,
                          )}
                        </span>
                      )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Dividends</span>
                  <span className="font-semibold text-primary-600">
                    {formatCurrency(
                      investment.totalDividends || 0,
                      investment.currency || "USD",
                    )}
                  </span>
                </div>
              </div>

              {/* Delete Investment Section */}
              <div className="border-t pt-4 mt-4">
                <button
                  onClick={() => setShowDeleteInvestment(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Investment
                </button>
              </div>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="overflow-y-auto max-h-[50vh]">
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <TanStackTable
                  data={transactions}
                  columns={columns}
                  isLoading={
                    getListInvestmentTransactions.isLoading ||
                    getListInvestmentTransactions.isPending
                  }
                  emptyMessage="No transactions yet."
                  emptyDescription=""
                  className="text-sm"
                />
              </div>

              {/* Mobile Table */}
              <div className="sm:hidden">
                <MobileTable
                  data={transactions}
                  columns={mobileColumns}
                  getKey={(transaction) => transaction.id}
                  isLoading={
                    getListInvestmentTransactions.isLoading ||
                    getListInvestmentTransactions.isPending
                  }
                  emptyMessage="No transactions yet."
                  emptyDescription=""
                  maxHeight="45vh"
                  showScrollIndicator={transactions.length > 1}
                  className="m-1"
                />
              </div>
            </div>
          )}

          {/* Add Transaction Tab */}
          {activeTab === "add-transaction" && investment && (
            <AddInvestmentTransactionForm
              investmentId={investmentId}
              investmentType={investment.type}
              investmentCurrency={investment.currency || "USD"}
              purchaseUnit={investment.purchaseUnit}
              walletBalance={walletBalance}
              walletCurrency={walletCurrency}
              onSuccess={handleTransactionSuccess}
              symbol={investment.symbol}
            />
          )}

          {/* Set Price Tab */}
          {activeTab === "set-price" && investment && (
            <UpdateInvestmentPriceForm
              investmentId={investment.id}
              currentSymbol={investment.symbol}
              currentName={investment.name}
              currentPrice={investment.currentPrice}
              currency={investment.currency || "USD"}
              investmentType={investment.type}
              onSuccess={() => {
                // Refresh investment data and switch back to overview tab
                getInvestment.refetch();
                setActiveTab("overview");
                // Invalidate queries to refetch fresh data
                queryClient.invalidateQueries({
                  queryKey: [EVENT_InvestmentGetInvestment],
                });
                queryClient.invalidateQueries({
                  queryKey: [EVENT_InvestmentListInvestments],
                });
                queryClient.invalidateQueries({
                  queryKey: [EVENT_InvestmentGetPortfolioSummary],
                });
                // Invalidate wallet queries to refresh balance after transaction deletion
                queryClient.invalidateQueries({
                  queryKey: [EVENT_WalletListWallets],
                });
                queryClient.invalidateQueries({
                  queryKey: [EVENT_WalletGetWallet],
                });
              }}
            />
          )}

          {/* Close button for overview and transactions tabs */}
          {activeTab !== "add-transaction" && activeTab !== "set-price" && (
            <div className="pt-4">
              <Button type={ButtonType.PRIMARY} onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-danger-600">Investment not found</div>
      )}

      {/* Delete Transaction Confirmation Dialog */}
      {deletingTransactionId !== null && (
        <ConfirmationDialog
          title="Delete Transaction"
          message={
            <div>
              <p>Are you sure you want to delete this transaction?</p>
              <p className="text-sm text-gray-500 mt-2">
                This will recalculate your investment&apos;s quantity and cost
                basis.
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 mt-2">{deleteError}</p>
              )}
            </div>
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => handleDeleteTransaction(deletingTransactionId)}
          onCancel={() => {
            setDeletingTransactionId(null);
            setDeleteError(null);
          }}
          isLoading={deleteTransactionMutation.isPending}
          variant="danger"
        />
      )}

      {/* Delete Investment Confirmation Dialog */}
      {showDeleteInvestment && (
        <ConfirmationDialog
          title="Delete Investment"
          message={
            <div>
              <p>
                Are you sure you want to delete{" "}
                <strong>{investment?.symbol}</strong>?
              </p>
              {(investment?.quantity || 0) > 0 ? (
                <p className="text-sm text-red-600 mt-2">
                  Warning: You still have{" "}
                  {formatQuantity(
                    investment?.quantity || 0,
                    investment?.type || 0,
                    investment?.purchaseUnit,
                  )}{" "}
                  units. All holdings and transaction history will be
                  permanently deleted.
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  All transaction history for this investment will be deleted.
                </p>
              )}
              {deleteInvestmentError && (
                <p className="text-sm text-red-600 mt-2">
                  {deleteInvestmentError}
                </p>
              )}
            </div>
          }
          confirmText="Delete Investment"
          cancelText="Cancel"
          onConfirm={handleDeleteInvestment}
          onCancel={() => {
            setShowDeleteInvestment(false);
            setDeleteInvestmentError(null);
          }}
          isLoading={deleteInvestmentMutation.isPending}
          variant="danger"
        />
      )}
    </BaseModal>
  );
}
