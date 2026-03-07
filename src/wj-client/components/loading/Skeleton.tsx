"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Base skeleton component with shimmer animation.
 * This provides a more polished loading experience than simple pulse animation.
 *
 * @example
 * <Skeleton className="h-4 w-32" />
 */
export const Skeleton = React.memo(({ className = "", style }: SkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded",
        "bg-neutral-200",
        "relative overflow-hidden",
        className
      )}
      style={style}
      aria-hidden="true"
      role="status"
      aria-label={t("loading")}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  );
});
Skeleton.displayName = "Skeleton";

// Card skeleton for card loading states
type CardSkeletonProps = {
  className?: string;
  lines?: number;
  showHeader?: boolean;
  showAction?: boolean;
  /**
   * Matches BaseCard padding variants
   */
  padding?: "none" | "sm" | "md" | "lg";
  /**
   * Matches BaseCard shadow variants
   */
  shadow?: "sm" | "md" | "lg" | "none";
};

/**
 * Card skeleton matching BaseCard styling.
 * Use this for loading states of card components.
 *
 * @example
 * <CardSkeleton lines={3} showHeader showAction padding="md" shadow="md" />
 */
export const CardSkeleton = React.memo(({
  className = "",
  lines = 3,
  showHeader = true,
  showAction = true,
  padding = "md",
  shadow = "md"
}: CardSkeletonProps) => {
  const t = useTranslations("skeleton");
  const paddingClasses = {
    none: "",
    sm: "p-2 sm:p-3 lg:p-4",
    md: "p-4 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  const shadowClasses = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-card",
    lg: "shadow-lg",
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg",
        paddingClasses[padding],
        shadowClasses[shadow],
        "space-y-4",
        className
      )}
      role="status"
      aria-label={t("loading")}
    >
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          {showAction && <Skeleton className="h-8 w-24" />}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "h-4",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  );
});
CardSkeleton.displayName = "CardSkeleton";

// Table skeleton for table loading states
type TableSkeletonProps = {
  rows?: number;
  className?: string;
  showAvatar?: boolean;
  /**
   * Mobile-optimized card view instead of rows
   */
  mobile?: boolean;
  /**
   * Number of columns per row (default: 3)
   */
  columns?: number;
  /**
   * Show header row
   */
  showHeader?: boolean;
};

/**
 * Table skeleton for table/list loading states.
 * Supports both desktop row view and mobile card view.
 *
 * @example
 * // Desktop table
 * <TableSkeleton rows={5} columns={4} showHeader />
 *
 * // Mobile card view
 * <TableSkeleton rows={5} mobile />
 */
export const TableSkeleton = React.memo(({
  rows = 5,
  className = "",
  showAvatar = false,
  mobile = false,
  columns = 3,
  showHeader = true
}: TableSkeletonProps) => {
  const t = useTranslations("skeleton");
  // Mobile version: card-based layout
  if (mobile) {
    return (
      <div
        className={cn("space-y-3", className)}
        role="status"
        aria-label={t("loading")}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-card p-4 space-y-3"
          >
            {showAvatar && (
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop version: row-based layout
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label={t("loading")}
    >
      {showHeader && (
        <div className="flex items-center gap-4 py-2 border-b border-neutral-200">
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full" />}
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className={cn(
                "h-4",
                i === 0 ? "flex-1" : "w-20"
              )}
            />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2 border-b border-neutral-100 last:border-0">
          {showAvatar && <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />}
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={`cell-${i}-${j}`}
              className={cn(
                "h-4",
                j === 0 ? "flex-1" : "w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
});
TableSkeleton.displayName = "TableSkeleton";

// List skeleton for list loading states
type ListSkeletonProps = {
  items?: number;
  className?: string;
  /**
   * Show avatar/circle before each item
   */
  showAvatar?: boolean;
  /**
   * Number of text lines per item
   */
  lines?: number;
};

/**
 * List skeleton for simple list loading states.
 * Perfect for dropdowns, select lists, and simple item lists.
 *
 * @example
 * <ListSkeleton items={5} showAvatar lines={2} />
 */
export const ListSkeleton = React.memo(({
  items = 5,
  className = "",
  showAvatar = true,
  lines = 2
}: ListSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label={t("loading")}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          {showAvatar && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
          <div className="flex-1 space-y-2">
            {Array.from({ length: lines }).map((_, j) => (
              <Skeleton
                key={j}
                className={cn(
                  "h-4",
                  j === 0 ? "w-2/3" : "w-1/3"
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
ListSkeleton.displayName = "ListSkeleton";

// Text skeleton for text content loading
type TextSkeletonProps = {
  lines?: number;
  className?: string;
  /**
   * Width of text lines (full, 3/4, 1/2, etc.)
   */
  width?: "full" | "3/4" | "2/3" | "1/2" | "1/3";
  /**
   * Height of text lines (h-4, h-5, h-6, etc.)
   */
  height?: "h-3" | "h-4" | "h-5" | "h-6";
};

/**
 * Text skeleton for paragraph and heading loading states.
 *
 * @example
 * // Standard paragraph
 * <TextSkeleton lines={3} />
 *
 * // Heading
 * <TextSkeleton lines={1} width="1/2" height="h-6" />
 */
export const TextSkeleton = React.memo(({
  lines = 3,
  className = "",
  width = "full",
  height = "h-4"
}: TextSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label={t("loading")}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            height,
            i === lines - 1 ? `w-${width}` : "w-full"
          )}
        />
      ))}
    </div>
  );
});
TextSkeleton.displayName = "TextSkeleton";

// Stats card skeleton for portfolio summary or dashboard statistics
type StatsCardSkeletonProps = {
  cards?: number;
  className?: string;
  /**
   * Grid layout columns
   */
  cols?: 1 | 2 | 3 | 4;
  /**
   * Show change indicator (e.g., +5.2%)
   */
  showChange?: boolean;
};

/**
 * Stats card skeleton for dashboard statistics cards.
 * Matches the layout of portfolio summary cards.
 *
 * @example
 * <StatsCardSkeleton cards={4} cols={4} showChange />
 */
export const StatsCardSkeleton = React.memo(({
  cards = 4,
  className = "",
  cols = 4,
  showChange = true
}: StatsCardSkeletonProps) => {
  const t = useTranslations("skeleton");
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        gridCols[cols],
        className
      )}
      role="status"
      aria-label={t("loading")}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-card p-4 space-y-3"
        >
          {/* Label */}
          <Skeleton className="h-4 w-24" />
          {/* Value */}
          <Skeleton className="h-8 w-32" />
          {/* Change indicator */}
          {showChange && <Skeleton className="h-4 w-16" />}
        </div>
      ))}
    </div>
  );
});
StatsCardSkeleton.displayName = "StatsCardSkeleton";

// Chart skeleton for loading placeholder charts
type ChartSkeletonProps = {
  className?: string;
  /**
   * Number of bars/points in the chart
   */
  bars?: number;
  /**
   * Height of the chart area
   */
  height?: string;
  /**
   * Chart type: bar, line, or pie
   */
  variant?: "bar" | "line" | "pie";
  /**
   * Show legend
   */
  showLegend?: boolean;
};

/**
 * Chart skeleton for chart component loading states.
 * Supports bar, line, and pie chart variants.
 *
 * @example
 * <ChartSkeleton bars={7} height="h-64" variant="bar" showLegend />
 */
export const ChartSkeleton = React.memo(({
  className = "",
  bars = 7,
  height = "h-64",
  variant = "bar",
  showLegend = true
}: ChartSkeletonProps) => {
  const t = useTranslations("skeleton");
  if (variant === "pie") {
    return (
      <div
        className={cn("bg-white rounded-lg shadow-card p-4 sm:p-6", className)}
        role="status"
        aria-label={t("loading")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center justify-center py-8">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
          {showLegend && (
            <div className="flex flex-wrap gap-3 justify-center pt-4 border-t border-neutral-200">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-sm" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("bg-white rounded-lg shadow-card p-4 sm:p-6", className)}
      role="status"
      aria-label={t("loading")}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>

        {variant === "line" ? (
          // Line chart: wave pattern
          <div className={cn("relative", height)}>
            <svg
              className="w-full h-full"
              viewBox="0 0 400 100"
              preserveAspectRatio="none"
            >
              <path
                d="M0,80 Q50,60 100,70 T200,50 T300,60 T400,40"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-neutral-200 opacity-50"
              />
            </svg>
            <div className="absolute inset-0 flex items-end">
              {Array.from({ length: bars }).map((_, i) => (
                <Skeleton key={i} className="flex-1 h-2 mx-1" />
              ))}
            </div>
          </div>
        ) : (
          // Bar chart
          <div className={cn("flex items-end justify-between gap-2", height)}>
            {Array.from({ length: bars }).map((_, i) => {
              const randomHeight = Math.floor(Math.random() * 60) + 30;
              return (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${randomHeight}%` }}
                />
              );
            })}
          </div>
        )}

        {showLegend && (
          <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
            {Array.from({ length: bars }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-6" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
ChartSkeleton.displayName = "ChartSkeleton";

// Form skeleton for loading placeholder forms
type FormSkeletonProps = {
  fields?: number;
  className?: string;
  /**
   * Show submit button
   */
  showSubmitButton?: boolean;
  /**
   * Show field labels
   */
  showLabels?: boolean;
  /**
   * Number of select/radio fields (vs text inputs)
   */
  selectFields?: number;
};

/**
 * Form skeleton for form component loading states.
 *
 * @example
 * <FormSkeleton fields={4} showSubmitButton showLabels selectFields={1} />
 */
export const FormSkeleton = React.memo(({
  fields = 4,
  className = "",
  showSubmitButton = true,
  showLabels = true,
  selectFields = 0
}: FormSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-label={t("loading")}
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {showLabels && <Skeleton className="h-4 w-32" />}
          {i < selectFields ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Skeleton className="h-11 w-full" />
          )}
        </div>
      ))}

      {showSubmitButton && (
        <div className="pt-2 flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 w-24 rounded-lg" />
        </div>
      )}
    </div>
  );
});
FormSkeleton.displayName = "FormSkeleton";

// Page skeleton for full-page loading states
type PageSkeletonProps = {
  className?: string;
  showHeader?: boolean;
  showSidebar?: boolean;
  /**
   * Number of content cards
   */
  contentCards?: number;
};

/**
 * Page skeleton for full-page loading states.
 * Matches the dashboard layout with header, main content, and optional sidebar.
 *
 * @example
 * <PageSkeleton showHeader showSidebar contentCards={3} />
 */
export const PageSkeleton = React.memo(({
  className = "",
  showHeader = true,
  showSidebar = false,
  contentCards = 2
}: PageSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-label={t("loading")}
    >
      {showHeader && (
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      )}

      <div className={cn("flex gap-6", showSidebar ? "flex-col lg:flex-row" : "")}>
        <div className="flex-1 space-y-6">
          <StatsCardSkeleton cards={4} />
          {Array.from({ length: contentCards }).map((_, i) => (
            <CardSkeleton key={i} lines={5} />
          ))}
        </div>

        {showSidebar && (
          <aside className="w-full lg:w-80 space-y-4">
            <CardSkeleton lines={3} showAction={false} />
            <CardSkeleton lines={3} showAction={false} />
          </aside>
        )}
      </div>
    </div>
  );
});
PageSkeleton.displayName = "PageSkeleton";

// Button skeleton for button loading states
type ButtonSkeletonProps = {
  className?: string;
  /**
   * Button size matching Button component
   */
  size?: "sm" | "md" | "lg";
  /**
   * Button width
   */
  width?: "auto" | "full";
  /**
   * Show icon placeholder
   */
  showIcon?: boolean;
};

/**
 * Button skeleton matching Button component dimensions.
 *
 * @example
 * <ButtonSkeleton size="md" width="full" showIcon />
 */
export const ButtonSkeleton = React.memo(({
  className = "",
  size = "md",
  width = "full",
  showIcon = false
}: ButtonSkeletonProps) => {
  const t = useTranslations("skeleton");
  const sizeClasses = {
    sm: "h-11 px-4 text-sm min-h-[44px]",
    md: "h-12 px-6 text-base min-h-[48px]",
    lg: "h-14 px-8 text-lg min-h-[56px]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-3",
        "font-semibold rounded-lg",
        sizeClasses[size],
        width === "full" ? "w-full" : "w-auto",
        className
      )}
      role="status"
      aria-label={t("loading")}
    >
      {showIcon && <Skeleton className="h-5 w-5 rounded-full" />}
      <Skeleton className="h-5 w-20" />
    </div>
  );
});
ButtonSkeleton.displayName = "ButtonSkeleton";

// Portfolio-specific skeleton
type PortfolioSkeletonProps = {
  className?: string;
  /**
   * Show wallet filter skeleton
   */
  showFilters?: boolean;
  /**
   * Number of investment rows
   */
  investmentRows?: number;
};

/**
 * Portfolio page skeleton matching the portfolio page layout.
 * Includes filters, summary cards, and investment table.
 *
 * @example
 * <PortfolioSkeleton showFilters investmentRows={5} />
 */
export const PortfolioSkeleton = React.memo(({
  className = "",
  showFilters = true,
  investmentRows = 5
}: PortfolioSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("flex flex-col gap-6 px-3 sm:px-4 md:px-6 py-3 sm:py-4", className)}
      role="status"
      aria-label={t("loading")}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <Skeleton className="h-8 w-48" />
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Skeleton className="h-10 w-full sm:w-56 md:w-40 rounded" />
            <Skeleton className="h-10 w-full sm:w-48 md:w-40 rounded" />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <StatsCardSkeleton cards={4} />

      {/* Holdings section */}
      <div className="bg-white rounded-lg shadow-card p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
        <TableSkeleton rows={investmentRows} columns={5} showHeader showAvatar={false} />
      </div>
    </div>
  );
});
PortfolioSkeleton.displayName = "PortfolioSkeleton";

// Transaction skeleton for transaction list
type TransactionSkeletonProps = {
  transactions?: number;
  className?: string;
  /**
   * Show category badges
   */
  showCategory?: boolean;
  /**
   * Show wallet indicator
   */
  showWallet?: boolean;
};

/**
 * Transaction list skeleton for transaction page loading.
 *
 * @example
 * <TransactionSkeleton transactions={10} showCategory showWallet />
 */
export const TransactionSkeleton = React.memo(({
  transactions = 10,
  className = "",
  showCategory = true,
  showWallet = false
}: TransactionSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("bg-white rounded-lg shadow-card p-4 sm:p-6", className)}
      role="status"
      aria-label={t("loading")}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>

        {/* Transaction list */}
        <div className="space-y-3">
          {Array.from({ length: transactions }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-neutral-100 last:border-0">
              {/* Category icon */}
              {showCategory && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
              {/* Wallet indicator */}
              {showWallet && <Skeleton className="h-6 w-16 rounded flex-shrink-0" />}
              {/* Details */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              {/* Amount */}
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
TransactionSkeleton.displayName = "TransactionSkeleton";

// Wallet card skeleton for wallet cards
type WalletCardSkeletonProps = {
  cards?: number;
  className?: string;
  /**
   * Show balance amount
   */
  showBalance?: boolean;
  /**
   * Show transaction count
   */
  showTransactionCount?: boolean;
};

/**
 * Wallet card skeleton for wallet list loading.
 *
 * @example
 * <WalletCardSkeleton cards={3} showBalance showTransactionCount />
 */
export const WalletCardSkeleton = React.memo(({
  cards = 3,
  className = "",
  showBalance = true,
  showTransactionCount = false
}: WalletCardSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
        className
      )}
      role="status"
      aria-label={t("loading")}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg shadow-card p-4 space-y-4"
        >
          {/* Wallet type indicator */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Wallet name */}
          <Skeleton className="h-6 w-3/4" />

          {/* Balance */}
          {showBalance && <Skeleton className="h-8 w-40" />}

          {/* Transaction count */}
          {showTransactionCount && <Skeleton className="h-4 w-24" />}
        </div>
      ))}
    </div>
  );
});
WalletCardSkeleton.displayName = "WalletCardSkeleton";

// Modal skeleton for modal content loading
type ModalSkeletonProps = {
  className?: string;
  /**
   * Modal content type
   */
  variant?: "form" | "details" | "confirmation";
};

/**
 * Modal skeleton for modal content loading states.
 *
 * @example
 * <ModalSkeleton variant="form" />
 */
export const ModalSkeleton = React.memo(({
  className = "",
  variant = "form"
}: ModalSkeletonProps) => {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn("bg-white rounded-lg shadow-modal p-6 space-y-4", className)}
      role="status"
      aria-label={t("loading")}
    >
      {/* Title */}
      <Skeleton className="h-7 w-48" />

      {variant === "form" && (
        <>
          {/* Form fields */}
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 w-24 rounded-lg" />
          </div>
        </>
      )}

      {variant === "details" && (
        <>
          {/* Details content */}
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 w-24 rounded-lg" />
          </div>
        </>
      )}

      {variant === "confirmation" && (
        <>
          {/* Message */}
          <div className="space-y-3 pt-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>

          {/* Warning box */}
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 w-32 rounded-lg" />
          </div>
        </>
      )}
    </div>
  );
});
ModalSkeleton.displayName = "ModalSkeleton";

// Avatar skeleton for user profile images
type AvatarSkeletonProps = {
  className?: string;
  /**
   * Avatar size
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Show name alongside avatar
   */
  showName?: boolean;
};

/**
 * Avatar skeleton for user profile loading.
 *
 * @example
 * <AvatarSkeleton size="lg" showName />
 */
export const AvatarSkeleton = React.memo(({
  className = "",
  size = "md",
  showName = false
}: AvatarSkeletonProps) => {
  const t = useTranslations("skeleton");
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-20 w-20",
  };

  return (
    <div
      className={cn("flex items-center gap-3", className)}
      role="status"
      aria-label={t("loading")}
    >
      <Skeleton className={cn("rounded-full", sizeClasses[size])} />
      {showName && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
    </div>
  );
});
AvatarSkeleton.displayName = "AvatarSkeleton";

// Legacy skeletons - kept for backward compatibility
export const WalletListSkeleton = React.memo(({ count = 3 }: { count?: number }) => {
  const t = useTranslations("skeleton");
  return (
    <div className="px-2 py-1">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex justify-between items-center m-3">
          <div className="flex gap-3 items-center">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
});
WalletListSkeleton.displayName = "WalletListSkeleton";

export const TotalBalanceSkeleton = React.memo(() => {
  const t = useTranslations("skeleton");
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-6 w-32" />
    </div>
  );
});
TotalBalanceSkeleton.displayName = "TotalBalanceSkeleton";

export const UserSkeleton = React.memo(() => {
  const t = useTranslations("skeleton");
  return <AvatarSkeleton size="lg" showName />;
});
UserSkeleton.displayName = "UserSkeleton";
