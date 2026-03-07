"use client";

import React, { memo, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  t: (key: string) => string,
  locale: string,
): ColumnDef<InvestmentData>[] {
  return useMemo(
    () => [
      {
        accessorKey: "symbol",
        header: t("table.symbol"),
        cell: (info) => (
          <span className="font-medium">{info.getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "name",
        header: t("table.name"),
      },
      ...(showWalletColumn
        ? [
            {
              accessorKey: "walletName" as const,
              header: t("table.wallet"),
              cell: (info: any) => (
                <span className="text-gray-600">{info.getValue()}</span>
              ),
            },
          ]
        : []),
      {
        accessorKey: "type",
        header: t("table.type"),
        cell: (info) => getInvestmentTypeLabel(info.getValue<number>() as any, t),
      },
      {
        accessorKey: "quantity",
        header: t("table.quantity"),
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
        header: t("table.avgCost"),
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
        header: t("table.currentPrice"),
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
        header: t("table.currentValue"),
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
        header: t("table.pnl"),
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
        header: t("table.pnlPercent"),
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
        header: t("table.lastUpdated"),
        cell: (info) => {
          const timestamp = info.getValue<number>();
          const { text, colorClass } = formatTimeAgo(timestamp || 0, t as any, locale);
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
              aria-label={t("table.viewDetails")}
            >
              {t("table.viewDetails")}
            </button>
          );
        },
      },
    ],
    [onRowClick, currency, showWalletColumn, t],
  );
}

/**
 * Mobile columns for MobileTable
 */
function useMobileInvestmentColumns(
  onRowClick: (investmentId: number) => void,
  currency: string,
  showWalletColumn: boolean,
  t: (key: string) => string,
  locale: string,
) {
  return useMemo(
    () => [
      {
        id: "symbol",
        header: t("table.symbol"),
        accessorFn: (row: InvestmentData) => row.symbol,
      },
      {
        id: "name",
        header: t("table.name"),
        accessorFn: (row: InvestmentData) => row.name,
      },
      ...(showWalletColumn
        ? [
            {
              id: "walletName",
              header: t("table.wallet"),
              accessorFn: (row: InvestmentData) => row.walletName || "",
            },
          ]
        : []),
      {
        id: "type",
        header: t("table.type"),
        accessorFn: (row: InvestmentData) =>
          getInvestmentTypeLabel(row.type as any, t),
      },
      {
        id: "quantity",
        header: t("table.quantity"),
        accessorFn: (row: InvestmentData) =>
          formatQuantity(row.quantity, row.type as any),
      },
      {
        id: "averageCost",
        header: t("table.avgCost"),
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
        header: t("table.currentPrice"),
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
        header: t("table.currentValue"),
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
        header: t("table.pnl"),
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
        header: t("table.pnlPercent"),
        accessorFn: (row: InvestmentData) =>
          formatPercent(row.unrealizedPnlPercent || 0),
      },
      {
        id: "updatedAt",
        header: t("table.lastUpdated"),
        accessorFn: (row: InvestmentData) => {
          const { text, colorClass } = formatTimeAgo(row.updatedAt || 0, t as any, locale);
          return <span className={`text-xs ${colorClass}`}>{text}</span>;
        },
      },
    ],
    [currency, showWalletColumn, t, locale],
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
  const locale = useLocale();
  const resolvedEmptyMessage = emptyMessage || t("emptyInvestments.message");
  const columns = useInvestmentColumns(
    (id) => onInvestmentClick?.(id),
    userCurrency,
    showWalletColumn,
    t as (key: string) => string,
    locale,
  );
  const mobileColumns = useMobileInvestmentColumns(
    (id) => onInvestmentClick?.(id),
    userCurrency,
    showWalletColumn,
    t as (key: string) => string,
    locale,
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
