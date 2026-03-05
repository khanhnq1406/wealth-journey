"use client";

import React, { memo, useMemo } from "react";
import { useTranslations } from "next-intl";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { TanStackTable } from "@/components/lazy/OptimizedComponents";
import { MobileTable } from "@/components/table/MobileTable";
import { InvestmentCard, type InvestmentCardData } from "./InvestmentCard";
import {
  formatPercent,
  formatQuantity,
  getInvestmentTypeLabel,
  formatPrice,
  formatTimeAgo,
} from "../helpers";
import { formatCurrency } from "@/utils/currency-formatter";
import type { ColumnDef } from "@tanstack/react-table";

/**
 * Investment data type for table display
 */
export interface InvestmentData {
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
 * InvestmentList component props
 */
export interface InvestmentListProps {
  /** Array of investments to display */
  investments: InvestmentData[];
  /** User's preferred currency */
  userCurrency: string;
  /** Callback when investment row/card is clicked */
  onInvestmentClick?: (investmentId: number) => void;
  /** Callback when hovering over a row (for preloading) */
  onRowHover?: () => void;
  /** Whether to show wallet column (for "All Wallets" view) */
  showWalletColumn?: boolean;
  /** Empty message to display when no investments */
  emptyMessage?: string;
}

/**
 * Column definitions for TanStackTable (memoized)
 */
function useInvestmentColumns(
  onRowClick: (investmentId: number) => void,
  currency: string,
  showWalletColumn: boolean,
): ColumnDef<InvestmentData>[] {
  return useMemo(
    () => [
      {
        accessorKey: "symbol",
        header: "Symbol",
        cell: (info) => (
          <span className="font-medium">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
      },
      ...(showWalletColumn
        ? [
            {
              accessorKey: "walletName" as const,
              header: "Wallet",
              cell: (info: any) => (
                <span className="text-gray-600">{info.getValue()}</span>
              ),
            },
          ]
        : []),
      {
        accessorKey: "type",
        header: "Type",
        cell: (info) => getInvestmentTypeLabel(info.getValue<number>() as any),
      },
      {
        accessorKey: "quantity",
        header: "Quantity",
        cell: (info) => {
          const row = info.row.original;
          return formatQuantity(
            row.quantity,
            row.type as any,
            row.purchaseUnit,
          );
        },
      },
      {
        accessorKey: "averageCost",
        header: "Avg Cost",
        cell: (info) => {
          const row = info.row.original;
          const nativeCurrency = row.currency || "USD";
          const price = (info.getValue() as number | undefined) || 0;
          return (
            <div>
              <span className="font-medium">
                {formatPrice(
                  price,
                  row.type as any,
                  nativeCurrency,
                  row.purchaseUnit,
                  row.symbol,
                )}
              </span>
              {row.displayAverageCost && row.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatPrice(
                    row.displayAverageCost.amount || 0,
                    row.type as any,
                    row.displayCurrency,
                    row.purchaseUnit,
                    row.symbol,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "currentPrice",
        header: "Current Price",
        cell: (info) => {
          const row = info.row.original;
          const nativeCurrency = row.currency || "USD";
          const price = (info.getValue() as number | undefined) || 0;
          return (
            <div>
              <span className="font-medium">
                {formatPrice(
                  price,
                  row.type as any,
                  nativeCurrency,
                  row.purchaseUnit,
                  row.symbol,
                )}
              </span>
              {row.displayCurrentPrice && row.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatPrice(
                    row.displayCurrentPrice.amount || 0,
                    row.type as any,
                    row.displayCurrency,
                    row.purchaseUnit,
                    row.symbol,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "currentValue",
        header: "Current Value",
        cell: (info) => {
          const row = info.row.original;
          const nativeCurrency = row.currency || "USD";
          const value = (info.getValue() as number | undefined) || 0;
          return (
            <div>
              <span className="font-medium">
                {formatCurrency(value, nativeCurrency)}
              </span>
              {row.displayCurrentValue && row.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatCurrency(
                    row.displayCurrentValue.amount || 0,
                    row.displayCurrency,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "unrealizedPnl",
        header: "PNL",
        cell: (info) => {
          const row = info.row.original;
          const nativeCurrency = row.currency || "USD";
          const value = (info.getValue() as number | undefined) || 0;
          return (
            <div>
              <span
                className={`font-medium ${
                  value >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(value, nativeCurrency)}
              </span>
              {row.displayUnrealizedPnl && row.displayCurrency && (
                <span className="text-xs text-gray-500 block">
                  ≈{" "}
                  {formatCurrency(
                    row.displayUnrealizedPnl.amount || 0,
                    row.displayCurrency,
                  )}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "unrealizedPnlPercent",
        header: "PNL %",
        cell: (info) => (
          <span
            className={`font-medium ${
              ((info.getValue() as number | undefined) || 0) >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {formatPercent((info.getValue() as number | undefined) || 0)}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Last Updated",
        cell: (info) => {
          const timestamp = info.getValue<number>();
          const { text, colorClass } = formatTimeAgo(timestamp || 0);
          return <span className={`text-xs ${colorClass}`}>{text}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: (info) => {
          const investmentId = info.row.original.id;
          return (
            <button
              onClick={() => onRowClick(investmentId)}
              className="text-sm text-primary-600 hover:text-primary-800 hover:underline font-medium"
              aria-label="View investment details"
            >
              View Details
            </button>
          );
        },
      },
    ],
    [onRowClick, currency, showWalletColumn],
  );
}

/**
 * Mobile columns for MobileTable
 */
function useMobileInvestmentColumns(
  onRowClick: (investmentId: number) => void,
  currency: string,
  showWalletColumn: boolean,
) {
  return useMemo(
    () => [
      {
        id: "symbol",
        header: "Symbol",
        accessorFn: (row: InvestmentData) => row.symbol,
      },
      {
        id: "name",
        header: "Name",
        accessorFn: (row: InvestmentData) => row.name,
      },
      ...(showWalletColumn
        ? [
            {
              id: "walletName",
              header: "Wallet",
              accessorFn: (row: InvestmentData) => row.walletName || "",
            },
          ]
        : []),
      {
        id: "type",
        header: "Type",
        accessorFn: (row: InvestmentData) =>
          getInvestmentTypeLabel(row.type as any),
      },
      {
        id: "quantity",
        header: "Quantity",
        accessorFn: (row: InvestmentData) =>
          formatQuantity(row.quantity, row.type as any),
      },
      {
        id: "averageCost",
        header: "Avg Cost",
        accessorFn: (row: InvestmentData) =>
          formatPrice(
            row.averageCost || 0,
            row.type as any,
            row.currency || "USD",
            row.purchaseUnit,
            row.symbol,
          ),
      },
      {
        id: "currentPrice",
        header: "Current Price",
        accessorFn: (row: InvestmentData) =>
          formatPrice(
            row.currentPrice || 0,
            row.type as any,
            row.currency || "USD",
            row.purchaseUnit,
            row.symbol,
          ),
      },
      {
        id: "currentValue",
        header: "Current Value",
        accessorFn: (row: InvestmentData) => {
          const nativeCurrency = row.currency || "USD";
          const native = formatCurrency(row.currentValue || 0, nativeCurrency);
          if (row.displayCurrentValue && row.displayCurrency) {
            const converted = formatCurrency(
              row.displayCurrentValue.amount || 0,
              row.displayCurrency,
            );
            return `${native} (≈ ${converted})`;
          }
          return native;
        },
      },
      {
        id: "unrealizedPnl",
        header: "PNL",
        accessorFn: (row: InvestmentData) => {
          const nativeCurrency = row.currency || "USD";
          const native = formatCurrency(row.unrealizedPnl || 0, nativeCurrency);
          if (row.displayUnrealizedPnl && row.displayCurrency) {
            const converted = formatCurrency(
              row.displayUnrealizedPnl.amount || 0,
              row.displayCurrency,
            );
            return `${native} (≈ ${converted})`;
          }
          return native;
        },
      },
      {
        id: "unrealizedPnlPercent",
        header: "PNL %",
        accessorFn: (row: InvestmentData) =>
          formatPercent(row.unrealizedPnlPercent || 0),
      },
      {
        id: "updatedAt",
        header: "Last Updated",
        accessorFn: (row: InvestmentData) => {
          const { text, colorClass } = formatTimeAgo(row.updatedAt || 0);
          return <span className={`text-xs ${colorClass}`}>{text}</span>;
        },
      },
    ],
    [currency, showWalletColumn],
  );
}

/**
 * InvestmentList component displays investments in both desktop table and mobile card views
 * - Desktop: Uses TanStackTable for efficient data display
 * - Mobile: Uses card-based layout for better mobile UX
 */
export const InvestmentList = memo(function InvestmentList({
  investments,
  userCurrency,
  onInvestmentClick,
  onRowHover,
  showWalletColumn = false,
  emptyMessage,
}: InvestmentListProps) {
  const t = useTranslations("investment");
  const resolvedEmptyMessage = emptyMessage || t("emptyInvestments.message");
  const columns = useInvestmentColumns(
    (id) => onInvestmentClick?.(id),
    userCurrency,
    showWalletColumn,
  );
  const mobileColumns = useMobileInvestmentColumns(
    (id) => onInvestmentClick?.(id),
    userCurrency,
    showWalletColumn,
  );

  if (investments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div
        className="hidden sm:block overflow-x-auto"
        onMouseEnter={onRowHover}
      >
        <TanStackTable
          data={investments}
          columns={columns as any}
          emptyMessage={resolvedEmptyMessage}
        />
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden grid grid-cols-1 gap-3">
        {investments.map((investment) => (
          <InvestmentCard
            key={investment.id}
            investment={investment as InvestmentCardData}
            userCurrency={userCurrency}
            onClick={onInvestmentClick}
            showWallet={showWalletColumn}
          />
        ))}
      </div>
    </>
  );
});
