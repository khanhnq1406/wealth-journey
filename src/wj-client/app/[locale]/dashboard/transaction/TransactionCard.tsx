"use client";

import { memo, useState, useRef, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";
import { Transaction } from "@/gen/protobuf/v1/transaction";
import { useTranslations, useLocale } from "next-intl";

export interface TransactionCardProps {
  transaction: Transaction | null;
  categoryName: string;
  walletName: string;
  currency: string;
  onEdit: (transactionId: number) => void;
  onDelete: (transactionId: number) => void;
  isGroupHeader?: boolean;
  groupLabel?: string;
  className?: string;
}

const SWIPE_THRESHOLD = 80; // px to trigger swipe action
const SWIPE_MAX_OFFSET = 120; // max px to translate

/**
 * Mobile-first transaction card with swipe actions.
 * - Swipe left: Delete action
 * - Swipe right: Edit action
 * - Touch-friendly 44px minimum targets
 * - Group headers for date grouping
 */
// Group header component - separate to avoid conditional hooks
function GroupHeader({ groupLabel, className }: { groupLabel: string; className?: string }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-1 bg-gray-50 dark:bg-dark-background px-3 py-2 sm:px-4",
        className,
      )}
    >
      <span className="text-xs font-semibold text-gray-600 dark:text-dark-text-secondary uppercase tracking-wide">
        {groupLabel}
      </span>
    </div>
  );
}

// Transaction icon component - extracted to avoid creating during render
function TransactionIcon({ isExpense }: { isExpense: boolean }) {
  const Icon = isExpense ? (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12H4"
      />
    </svg>
  ) : (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );

  return (
    <div
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full",
        isExpense
          ? "bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400"
          : "bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400",
      )}
    >
      {Icon}
    </div>
  );
}

export const TransactionCard = memo(function TransactionCard({
  transaction,
  categoryName,
  walletName,
  currency,
  onEdit,
  onDelete,
  isGroupHeader = false,
  groupLabel,
  className,
}: TransactionCardProps) {
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate amount display - memoized to avoid recalculation
  const { amountValue, numericAmount, isExpense, displayAmount } = useMemo(() => {
    const amt = transaction?.displayAmount?.amount ?? transaction?.amount?.amount ?? 0;
    const numeric = typeof amt === "number" ? amt : Number(amt) || 0;
    return {
      amountValue: amt,
      numericAmount: numeric,
      isExpense: numeric < 0,
      displayAmount: Math.abs(numeric),
    };
  }, [transaction?.displayAmount?.amount, transaction?.amount?.amount]);

  // Format transaction time
  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [locale]);

  // Touch handlers for swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - touchStartX.current;
      const deltaY = Math.abs(touchY - touchStartY.current);

      // Only allow horizontal swipes (prevent vertical scroll interference)
      if (deltaY > 50) return;

      // Limit swipe offset
      const clampedOffset = Math.max(
        -SWIPE_MAX_OFFSET,
        Math.min(SWIPE_MAX_OFFSET, deltaX),
      );
      setSwipeOffset(clampedOffset);
    },
    [isDragging],
  );

  const handleEdit = useCallback(() => {
    if (transaction?.id) {
      onEdit(transaction.id);
    }
  }, [transaction?.id, onEdit]);

  const handleDelete = useCallback(() => {
    if (transaction?.id) {
      onDelete(transaction.id);
    }
  }, [transaction?.id, onDelete]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Check if swipe threshold is met
    if (swipeOffset > SWIPE_THRESHOLD) {
      // Swiped right - Edit
      handleEdit();
    } else if (swipeOffset < -SWIPE_THRESHOLD) {
      // Swiped left - Delete
      handleDelete();
    }

    // Reset offset
    setSwipeOffset(0);
  }, [isDragging, swipeOffset, handleEdit, handleDelete]);

  // Reset swipe when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: TouchEvent | MouseEvent) => {
      if (
        cardRef.current &&
        !cardRef.current.contains(e.target as Node) &&
        swipeOffset !== 0
      ) {
        setSwipeOffset(0);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [swipeOffset]);

  // Early return for group header
  if (isGroupHeader && groupLabel) {
    return <GroupHeader groupLabel={groupLabel} className={className} />;
  }

  // Guard against null transaction
  if (!transaction) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      className={cn("relative overflow-hidden", className)}
      style={{ touchAction: "pan-y" }}
    >
      {/* Swipe Background Actions */}
      <div
        className={cn(
          "absolute inset-0 rounded-lg flex items-center justify-between px-4 transition-transform duration-200",
          "bg-gradient-to-r from-v2-red-light to-v2-red-light dark:from-v2-red-primary/20 dark:to-v2-red-primary/10",
        )}
        aria-hidden="true"
      >
        {/* Edit Action (Right swipe) */}
        <div className="flex items-center gap-2 rounded-lg">
          <div className="w-10 h-10 flex items-center justify-center bg-v2-red-primary text-white rounded-full min-h-[44px] min-w-[44px]">
            <svg
              className="w-5 h-5"
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
          </div>
          <span className="text-sm font-medium text-v2-red-primary dark:text-v2-red-primary/80">
            {tCommon("edit")}
          </span>
        </div>

        {/* Delete Action (Left swipe) */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-danger-700 dark:text-danger-300">
            {tCommon("delete")}
          </span>
          <div className="w-10 h-10 flex items-center justify-center bg-danger-600 text-white rounded-full min-h-[44px] min-w-[44px]">
            <svg
              className="w-5 h-5"
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
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div
        className={cn(
          "relative bg-white dark:bg-dark-surface rounded-lg shadow-sm",
          "transition-transform duration-200",
          "active:shadow-card-active dark:active:shadow-dark-card-active",
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3 p-3 sm:p-4">
          {/* Transaction Icon */}
          <TransactionIcon isExpense={isExpense} />

          {/* Transaction Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-gray-900 dark:text-dark-text truncate">
                {categoryName}
              </h3>
              <span
                className={cn(
                  "text-base font-semibold flex-shrink-0",
                  isExpense
                    ? "text-danger-600 dark:text-danger-400"
                    : "text-success-600 dark:text-success-400",
                )}
              >
                {isExpense ? "-" : "+"}
                {formatCurrency(
                  displayAmount,
                  transaction.displayAmount ? currency : transaction.currency,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary truncate">
                {transaction.note || walletName}
              </p>
              <span className="text-xs text-gray-400 dark:text-dark-text-tertiary flex-shrink-0">
                {formatTime(transaction.date)}
              </span>
            </div>

            {/* Wallet indicator if note exists */}
            {transaction.note && (
              <div className="flex items-center gap-1 mt-1">
                <svg
                  className="w-3 h-3 text-gray-400 dark:text-dark-text-tertiary"
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
                <span className="text-xs text-gray-400 dark:text-dark-text-tertiary">
                  {walletName}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons (Desktop) */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={handleEdit}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-dark-surface-hover transition-colors"
              aria-label={tCommon("edit")}
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
            </button>
            <button
              onClick={handleDelete}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
              aria-label={tCommon("delete")}
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
            </button>
          </div>
        </div>

        {/* Swipe hint indicator (mobile) */}
        <div className="sm:hidden absolute bottom-1 right-2 opacity-0 group-hover:opacity-50 transition-opacity">
          <svg
            className="w-4 h-4 text-gray-300 dark:text-dark-text-tertiary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16l-4-4m0 0l4-4m-4 4h18"
            />
          </svg>
        </div>
      </div>
    </div>
  );
});

/**
 * Get date group label for transactions
 * @param timestamp - Unix timestamp in seconds
 * @param tDates - Optional translation function for date labels (from useTranslations("dates"))
 */
export function getDateGroupLabel(
  timestamp: number,
  tDates?: (key: string) => string,
  locale?: string,
): string {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return tDates ? tDates("today") : "Today";
  if (isYesterday) return tDates ? tDates("yesterday") : "Yesterday";

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (date >= weekAgo) return tDates ? tDates("thisWeek") : "This Week";

  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  if (date >= monthAgo) return tDates ? tDates("thisMonth") : "This Month";

  return date.toLocaleDateString(locale, {
    month: "short",
    year: "numeric",
  });
}
