"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";
import { formatDistanceToNow } from "date-fns";
import { memo, useState } from "react";
import { Button } from "../Button";

interface BalanceCardProps {
  balance: number;
  currency?: string;
  change?: {
    amount: number;
    percentage: number;
    period: string;
  };
  lastUpdated?: Date;
  showVerified?: boolean;
  className?: string;
}

const VerifiedBadge = memo(function VerifiedBadge() {
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 border border-v2-gold-primary/20 rounded text-xs font-medium text-white">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      Verified
    </div>
  );
});

const DataFreshnessIndicator = memo(function DataFreshnessIndicator({
  lastUpdated,
}: {
  lastUpdated: Date;
}) {
  const timeAgo = formatDistanceToNow(lastUpdated, { addSuffix: true });

  return (
    <div className="flex items-center gap-1.5 text-xs text-white/70">
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Updated {timeAgo}</span>
    </div>
  );
});

export const BalanceCard = memo(function BalanceCard({
  balance,
  currency = "VND",
  change,
  lastUpdated,
  showVerified = true,
  className,
}: BalanceCardProps) {
  const [isHidden, setIsHidden] = useState(false);
  const isPositive = change ? change.amount >= 0 : null;

  return (
    <div
      className={cn(
        "bg-gradient-to-br from-primary-600 to-primary-800 text-white rounded-lg p-4 sm:p-6 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-primary-100">
              Total Balance
            </span>
            {showVerified && lastUpdated && <VerifiedBadge />}
          </div>

          {/* Balance */}
          <div
            className={cn(
              "text-3xl sm:text-4xl font-bold mb-4 transition-all duration-200",
              isHidden && "blur-md select-none",
            )}
          >
            {formatCurrency(balance, currency)}
          </div>

          {/* Change Indicator */}
          {change && (
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold",
                  isPositive
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "bg-red-500/20 text-red-100",
                )}
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {isPositive ? (
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                {isPositive ? "+" : ""}
                {change.percentage.toFixed(2)}%
              </div>
              <span className="text-sm text-primary-100">{change.period}</span>
            </div>
          )}
        </div>

        {/* Eye Toggle Button */}
        <Button
          variant="ghost"
          onClick={() => setIsHidden(!isHidden)}
          className="flex-shrink-0 p-2 hover:bg-white/10 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={isHidden ? "Show balance" : "Hide balance"}
          type="button"
        >
          {isHidden ? (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          )}
        </Button>
      </div>

      {/* Last Updated Timestamp */}
      {lastUpdated && (
        <div className="mt-4 pt-4 border-t border-v2-gold-primary/10">
          <DataFreshnessIndicator lastUpdated={lastUpdated} />
        </div>
      )}
    </div>
  );
});
