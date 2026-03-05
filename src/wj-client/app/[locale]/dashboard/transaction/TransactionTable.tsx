"use client";

import Image from "next/image";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo, useCallback, memo } from "react";
import { TanStackTable } from "@/components/table/TanStackTable";
import {
  VirtualizedTransactionList,
  useTransactionDisplayData,
} from "@/components/table/VirtualizedTransactionList";
import { resources } from "@/app/constants";
import { Transaction } from "@/gen/protobuf/v1/transaction";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslations } from "next-intl";

interface TransactionTableProps {
  transactions: Transaction[];
  getCategoryName: (id: number) => string;
  getWalletName: (id: number) => string;
  onEdit: (transactionId: number) => void;
  onDelete: (transactionId: number) => void;
  isLoading?: boolean;
  className?: string;
  /**
   * Enable virtualization for large datasets (recommended for 50+ items)
   * @default true
   */
  enableVirtualization?: boolean;
  /**
   * Height of the virtualized list container (only used when virtualization is enabled)
   * @default "calc(100vh - 350px)"
   */
  virtualizedHeight?: number | string;
}

// Memoized action button component to prevent re-renders
const TransactionActions = memo(function TransactionActions({
  transactionId,
  onEdit,
  onDelete,
}: {
  transactionId: number;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const handleEdit = useCallback(() => {
    onEdit(transactionId);
  }, [transactionId, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(transactionId);
  }, [transactionId, onDelete]);

  return (
    <div className="flex gap-2">
      <button
        onClick={handleEdit}
        className="w-6 h-6 hover:opacity-70 transition-opacity"
        aria-label="Edit transaction"
      >
        <Image
          src={`${resources}/editing.svg`}
          width={24}
          height={24}
          alt="Edit transaction"
          className="w-full h-full object-contain"
        />
      </button>
      <button
        onClick={handleDelete}
        className="w-6 h-6 hover:opacity-70 transition-opacity"
        aria-label="Delete transaction"
      >
        <Image
          src={`${resources}/remove.svg`}
          width={24}
          height={24}
          alt="Delete transaction"
          className="w-full h-full object-contain"
        />
      </button>
    </div>
  );
});

export const TransactionTable = memo(function TransactionTable({
  transactions,
  getCategoryName,
  getWalletName,
  onEdit,
  onDelete,
  isLoading = false,
  className,
  enableVirtualization = true,
  virtualizedHeight = "calc(100vh - 350px)",
}: TransactionTableProps) {
  const columnHelper = createColumnHelper<Transaction>();
  const { currency } = useCurrency();

  // Memoize date formatter to avoid recreating on every render
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  // Memoize columns to avoid recreating on every render
  const columns = useMemo(
    () => [
      columnHelper.accessor("categoryId", {
        id: "category",
        header: "Category",
        cell: (info) => getCategoryName(info.getValue()),
      }),
      columnHelper.accessor("walletId", {
        id: "wallet",
        header: "Wallet",
        cell: (info) => getWalletName(info.getValue()),
      }),
      columnHelper.display({
        id: "amount",
        header: "Amount",
        cell: (info) => {
          const row = info.row.original;
          const amountValue = row.displayAmount?.amount ?? row.amount?.amount ?? 0;
          // Ensure we have a valid number
          const numericAmount = typeof amountValue === 'number' ? amountValue : Number(amountValue) || 0;
          return formatCurrency(
            numericAmount,
            row.displayAmount ? currency : row.currency
          );
        },
      }),
      columnHelper.accessor("date", {
        id: "date",
        header: "Date & Time",
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor("note", {
        id: "note",
        header: "Note",
        cell: (info) => info.getValue() || "-",
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => (
          <TransactionActions
            transactionId={info.row.original.id}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ),
      }),
    ],
    [columnHelper, getCategoryName, getWalletName, formatDate, onEdit, onDelete, currency],
  );

  // Prepare display data for virtualized list
  const displayData = useTransactionDisplayData(
    transactions,
    getCategoryName,
    getWalletName,
    currency
  );

  const actions = useMemo(
    () => ({
      onEdit,
      onDelete,
    }),
    [onEdit, onDelete]
  );

  // Use virtualized list for large datasets when enabled
  const shouldUseVirtualization = enableVirtualization && transactions.length >= 20;

  if (shouldUseVirtualization) {
    return (
      <VirtualizedTransactionList
        transactions={displayData}
        actions={actions}
        isLoading={isLoading}
        className={className}
        height={virtualizedHeight}
        restoreScroll
      />
    );
  }

  // Fall back to regular table for smaller datasets or when virtualization is disabled
  return (
    <TanStackTable
      data={transactions}
      columns={columns}
      emptyMessage="No transactions found"
      emptyDescription="Add your first transaction to get started"
      isLoading={isLoading}
      className={className}
    />
  );
});
