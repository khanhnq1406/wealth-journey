"use client";

import React, {
  useRef,
  useMemo,
  useEffect,
  memo,
} from "react";
import { List, useDynamicRowHeight } from "react-window";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { resources } from "@/app/constants";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";

/**
 * VirtualizedTransactionList Component
 *
 * A high-performance virtualized list component for displaying large transaction datasets.
 * Uses react-window's List component to render only visible rows, providing excellent
 * performance with 100+ items.
 *
 * Features:
 * - Variable row heights support via useDynamicRowHeight
 * - Scroll position restoration during updates
 * - Smooth scrolling with large datasets
 * - Loading and empty states
 * - Compatible with existing Transaction data structure
 */

export interface TransactionActions {
  onEdit: (transactionId: number) => void;
  onDelete: (transactionId: number) => void;
}

export interface TransactionDisplayData {
  id: number;
  category: string;
  wallet: string;
  amount: string;
  amountColor?: string;
  date: string;
  note?: string;
}

interface VirtualizedTransactionListProps {
  transactions: TransactionDisplayData[];
  actions: TransactionActions;
  isLoading?: boolean;
  className?: string;
  /**
   * Height of the list container (required for virtualization)
   * @example 400, "400px", "50vh"
   */
  height: number | string;
  /**
   * Estimated default row height in pixels (used for initial render)
   * @default 60
   */
  estimatedRowHeight?: number;
  /**
   * Enable scroll position restoration
   * @default true
   */
  restoreScroll?: boolean;
}

// Memoized action buttons component
const TransactionActionsButtons = memo(function TransactionActionsButtons({
  transactionId,
  onEdit,
  onDelete,
}: {
  transactionId: number;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const t = useTranslations("transactionCard");

  const handleEdit = () => {
    onEdit(transactionId);
  };

  const handleDelete = () => {
    onDelete(transactionId);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={handleEdit}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:opacity-70 transition-opacity rounded hover:bg-neutral-100"
        aria-label={t("editAriaLabel")}
      >
        <Image
          src={`${resources}/editing.svg`}
          width={24}
          height={24}
          alt={t("editAriaLabel")}
          className="w-6 h-6 object-contain"
        />
      </button>
      <button
        onClick={handleDelete}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:opacity-70 transition-opacity rounded hover:bg-danger-50"
        aria-label={t("deleteAriaLabel")}
      >
        <Image
          src={`${resources}/remove.svg`}
          width={24}
          height={24}
          alt={t("deleteAriaLabel")}
          className="w-6 h-6 object-contain"
        />
      </button>
    </div>
  );
});

// Row component following react-window v3 API
// RowProps defines the custom props passed via rowProps (excludes built-in ariaAttributes, index, style)
interface RowProps {
  transactions: TransactionDisplayData[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

// The component receives built-in props (ariaAttributes, index, style) merged with RowProps
function Row(props: {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: React.CSSProperties;
} & RowProps) {
  const { ariaAttributes, index, style, transactions, onEdit, onDelete } = props;
  const transaction = transactions[index];

  return (
    <div
      {...ariaAttributes}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 border-b border-v2-gold-primary/20 hover:bg-neutral-50 transition-colors",
        "sm:grid sm:grid-cols-12 sm:gap-3"
      )}
    >
      {/* Date column - hidden on mobile, visible on desktop */}
      <div className="hidden sm:block sm:col-span-2 text-sm text-neutral-600">
        {transaction.date}
      </div>

      {/* Category - always visible */}
      <div className="flex-1 sm:col-span-3">
        <div className="text-sm font-medium text-neutral-900">{transaction.category}</div>
        <div className="sm:hidden text-xs text-neutral-500">{transaction.date}</div>
      </div>

      {/* Wallet - hidden on mobile */}
      <div className="hidden sm:block sm:col-span-3 text-sm text-neutral-600">
        {transaction.wallet}
      </div>

      {/* Note - visible on desktop if present */}
      {transaction.note && (
        <div className="hidden sm:block sm:col-span-2 text-sm text-neutral-500 truncate">
          {transaction.note}
        </div>
      )}

      {/* Amount - always visible */}
      <div
        className={cn(
          "text-sm font-semibold",
          transaction.amountColor || "text-neutral-900"
        )}
      >
        {transaction.amount}
      </div>

      {/* Actions - always visible */}
      <TransactionActionsButtons
        transactionId={transaction.id}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

/**
 * Hook to transform transaction data for display
 */
export function useTransactionDisplayData(
  transactions: any[],
  getCategoryName: (id: number) => string,
  getWalletName: (id: number) => string,
  currency: string
): TransactionDisplayData[] {
  return useMemo(() => {
    return transactions.map((t) => ({
      id: t.transactionId,
      category: getCategoryName(t.categoryId),
      wallet: getWalletName(t.walletId),
      amount: formatCurrency(t.money?.amount || 0, currency || "VND"),
      amountColor: t.type === 1 ? "text-success-700" : "text-danger-700",
      date: new Date(t.transactionDate * 1000).toLocaleDateString("vi-VN"),
      note: t.note || undefined,
    }));
  }, [transactions, getCategoryName, getWalletName, currency]);
}

/**
 * Main VirtualizedTransactionList component
 */
export function VirtualizedTransactionList({
  transactions,
  actions,
  isLoading = false,
  className,
  height,
  estimatedRowHeight = 60,
  restoreScroll = true,
}: VirtualizedTransactionListProps) {
  const listRef = useRef<any>(null);
  const scrollOffsetRef = useRef<number>(0);

  // Setup dynamic row height for handling variable height rows
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: estimatedRowHeight,
    key: "transactions",
  });

  // Restore scroll position after data updates
  useEffect(() => {
    if (!restoreScroll || !listRef.current) return;

    requestAnimationFrame(() => {
      if (scrollOffsetRef.current > 0 && listRef.current) {
        listRef.current.scrollToRow?.({
          index: 0,
          align: "start",
        });
      }
    });
  }, [transactions.length, restoreScroll]);

  // Save scroll position before data updates
  useEffect(() => {
    if (!restoreScroll || !listRef.current) return;

    const handleScroll = () => {
      if (listRef.current?.element) {
        scrollOffsetRef.current = listRef.current.element.scrollTop;
      }
    };

    const element = listRef.current?.element;
    element?.addEventListener("scroll", handleScroll);

    return () => {
      element?.removeEventListener("scroll", handleScroll);
    };
  }, [restoreScroll]);

  // Memoize the props passed to rows
  const rowProps = useMemo(
    () => ({
      transactions,
      onEdit: actions.onEdit,
      onDelete: actions.onDelete,
    }),
    [transactions, actions.onEdit, actions.onDelete]
  );

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
      >
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-neutral-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (transactions.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center", className)}
        style={{ height }}
      >
        <div className="text-center py-8">
          <p className="text-neutral-500 text-sm">No transactions found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <List
        listRef={listRef}
        rowComponent={Row}
        rowProps={rowProps}
        rowCount={transactions.length}
        rowHeight={dynamicRowHeight}
        defaultHeight={typeof height === "number" ? height : 400}
        style={{ height }}
        className="outline-none"
        overscanCount={5}
      />
    </div>
  );
}

export default VirtualizedTransactionList;
