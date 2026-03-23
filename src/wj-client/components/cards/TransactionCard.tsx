"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type TransactionType = "income" | "expense" | "transfer";

export interface TransactionCardProps {
  /**
   * Transaction title/description
   */
  title: string;

  /**
   * Transaction category
   */
  category?: string;

  /**
   * Transaction amount
   */
  amount: number;

  /**
   * Currency symbol
   * @default ""
   */
  currency?: string;

  /**
   * Transaction type
   */
  type?: TransactionType;

  /**
   * Transaction date
   */
  date?: string | Date;

  /**
   * Transaction time
   */
  time?: string;

  /**
   * Category icon or color
   */
  icon?: React.ReactNode;

  /**
   * Category color (hex or Tailwind class)
   */
  color?: string;

  /**
   * Wallet name
   */
  wallet?: string;

  /**
   * Whether to show amount on the right
   * @default true
   */
  amountOnRight?: boolean;

  /**
   * Compact variant (smaller padding)
   * @default false
   */
  compact?: boolean;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Delete action handler
   */
  onDelete?: () => void;

  /**
   * Edit action handler
   */
  onEdit?: () => void;

  /**
   * Show actions on hover (desktop)
   * @default true
   */
  showActionsOnHover?: boolean;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Status badge (pending, completed, etc.)
   */
  status?: "pending" | "completed" | "failed" | "cancelled";
}

export function TransactionCard({
  title,
  category,
  amount,
  currency = "",
  type = "expense",
  date,
  time,
  icon,
  color,
  wallet,
  amountOnRight = true,
  compact = false,
  onClick,
  onDelete,
  onEdit,
  showActionsOnHover = true,
  loading = false,
  className,
  status,
}: TransactionCardProps) {
  const t = useTranslations("transactionCard");
  const isIncome = type === "income";
  const isExpense = type === "expense";
  const isTransfer = type === "transfer";

  // Format date
  const formatDate = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return t("today");
    if (date.toDateString() === yesterday.toDateString()) return t("yesterday");

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Format amount
  const formatAmount = (value: number): string => {
    return Math.abs(value).toLocaleString();
  };

  // Get amount color
  const getAmountColor = () => {
 if (isIncome) return "text-v2-green-positive";
 if (isExpense) return "text-v2-gold-accent";
 return "text-v2-cream-100";
  };

  // Get status badge styles
  const getStatusBadge = () => {
    if (!status) return null;

    const statusConfig = {
      pending: {
 bg: "bg-yellow-100",
 text: "text-yellow-700",
        label: t("status.pending"),
      },
      completed: {
 bg: "bg-v2-green-light",
 text: "text-v2-green-positive",
        label: t("status.completed"),
      },
      failed: {
 bg: "bg-red-100",
 text: "text-red-700",
        label: t("status.failed"),
      },
      cancelled: {
 bg: "bg-v2-maroon-700",
 text: "text-v2-cream-100",
        label: t("status.cancelled"),
      },
    };

    const config = statusConfig[status];
    return (
      <span className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        config.bg,
        config.text
      )}>
        {config.label}
      </span>
    );
  };

  // Get icon background color
  const getIconBgColor = () => {
    if (color) return color;
 if (isIncome) return "bg-v2-green-light text-v2-green-positive";
 if (isExpense) return "bg-red-100 text-red-600";
 return "bg-v2-red-light text-v2-red-primary";
  };

  const cardClasses = cn(
 "group relative bg-v2-maroon-800 rounded-xl border transition-all duration-200",
 "border-v2-maroon-600",
 "hover:border-v2-gold-primary/20",
    "hover:shadow-md",
    onClick && "cursor-pointer",
    compact ? "p-3 sm:p-4" : "p-4 sm:p-5",
    loading && "opacity-70 pointer-events-none",
    className
  );

  const content = (
    <div className={cn("flex items-center gap-3 sm:gap-4", amountOnRight && "justify-between")}>
      {/* Left side - Icon and details */}
      <div className={cn("flex items-center gap-3 sm:gap-4 min-w-0", amountOnRight && "flex-1")}>
        {/* Icon */}
        {loading ? (
 <div className="animate-pulse flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-v2-maroon-600 rounded-xl" />
        ) : icon ? (
          <div className={cn(
            "flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center",
            getIconBgColor()
          )}>
            {icon}
          </div>
        ) : (
          <div className={cn(
            "flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center font-bold text-lg",
            getIconBgColor()
          )}>
            {title.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {loading ? (
 <div className="animate-pulse h-5 bg-v2-maroon-600 rounded w-32" />
            ) : (
 <h4 className="font-semibold text-v2-gold-accent truncate">
                {title}
              </h4>
            )}
            {getStatusBadge()}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-1">
 <div className="h-3 bg-v2-maroon-600 rounded w-24" />
 <div className="h-3 bg-v2-maroon-600 rounded w-16" />
            </div>
          ) : (
 <div className="flex flex-wrap items-center gap-2 text-sm text-v2-cream-100">
              {category && (
                <span className="truncate">{category}</span>
              )}
              {category && (date || wallet) && (
 <span className="text-v2-maroon-600">•</span>
              )}
              {date && (
                <span>{formatDate(date)}</span>
              )}
              {date && time && (
 <span className="text-v2-maroon-600">•</span>
              )}
              {time && (
                <span>{time}</span>
              )}
              {wallet && (date || time) && (
 <span className="text-v2-maroon-600">•</span>
              )}
              {wallet && (
                <span className="truncate">{wallet}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Amount */}
      {amountOnRight && (
        <div className={cn("flex-shrink-0 text-right", !compact && "flex flex-col items-end justify-center")}>
          {loading ? (
 <div className="animate-pulse h-6 bg-v2-maroon-600 rounded w-20" />
          ) : (
            <>
              <p className={cn(
                "text-lg sm:text-xl font-bold",
                getAmountColor()
              )}>
                {isIncome && "+"}
                {isExpense && !isTransfer && "-"}
                {currency}{formatAmount(amount)}
              </p>
              {isTransfer && (
 <p className="text-xs text-v2-cream-100">
                  {t("transfer")}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Actions - Show on hover for desktop, always for mobile */}
      {(onEdit || onDelete) && (
        <div className={cn(
          "flex items-center gap-1",
          showActionsOnHover && "opacity-0 group-hover:opacity-100 sm:opacity-0 transition-opacity duration-200",
          "sm:group-hover:opacity-100"
        )}>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
 className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-v2-maroon-700 text-v2-cream-100 transition-colors"
              aria-label={t("editAriaLabel")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
 className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors"
              aria-label={t("deleteAriaLabel")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return onClick ? (
    <button
      type="button"
      className={cardClasses}
      onClick={onClick}
      aria-label={t("viewDetailsAriaLabel", { title })}
    >
      {content}
    </button>
  ) : (
    <div className={cardClasses}>
      {content}
    </div>
  );
}

/**
 * TransactionCardList - List of transaction cards with proper spacing
 */
export interface TransactionCardListProps {
  transactions: Omit<TransactionCardProps, "compact" | "amountOnRight">[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onTransactionClick?: (index: number) => void;
  className?: string;
}

export function TransactionCardList({
  transactions,
  loading = false,
  emptyMessage = "No transactions yet",
  emptyIcon,
  onTransactionClick,
  className,
}: TransactionCardListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2 sm:space-y-3", className)}>
        {[1, 2, 3].map((i) => (
 <div key={i} className="bg-v2-maroon-700 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-v2-maroon-600 rounded-xl" />
              <div className="flex-1 space-y-2">
 <div className="h-5 bg-v2-maroon-600 rounded w-32" />
 <div className="h-3 bg-v2-maroon-600 rounded w-24" />
              </div>
 <div className="h-6 bg-v2-maroon-600 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        {emptyIcon && (
 <div className="mx-auto w-16 h-16 mb-4 text-v2-cream-100">
            {emptyIcon}
          </div>
        )}
 <p className="text-v2-cream-100">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 sm:space-y-3", className)}>
      {transactions.map((transaction, index) => (
        <TransactionCard
          key={index}
          {...transaction}
          onClick={onTransactionClick ? () => onTransactionClick(index) : transaction.onClick}
        />
      ))}
    </div>
  );
}
