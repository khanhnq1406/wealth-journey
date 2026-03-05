"use client";

import React, { memo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

/**
 * InvestmentActions component props
 */
export interface InvestmentActionsProps {
  /** Callback for adding new investment */
  onAddInvestment?: () => void;
  /** Callback for refreshing prices */
  onRefreshPrices?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Whether to disable refresh action */
  disableRefresh?: boolean;
  /** Whether to disable add action */
  disableAdd?: boolean;
  /** Button labels (customizable) */
  labels?: {
    addInvestment?: string;
    refreshPrices?: string;
    refreshing?: string;
  };
}

/**
 * InvestmentActions component displays quick action buttons for portfolio management
 * Handles Add Investment and Refresh Prices actions
 */
export const InvestmentActions = memo(function InvestmentActions({
  onAddInvestment,
  onRefreshPrices,
  isRefreshing = false,
  disableRefresh = false,
  disableAdd = false,
  labels,
}: InvestmentActionsProps) {
  const t = useTranslations("investment");
  const addLabel = labels?.addInvestment || t("modal.addInvestment");
  const refreshLabel = isRefreshing
    ? labels?.refreshing || t("detail.refreshPrice")
    : labels?.refreshPrices || t("detail.refreshPrice");

  return (
    <div className="flex gap-2">
      {/* Refresh Prices Button */}
      {onRefreshPrices && (
        <Button
          type={ButtonType.SECONDARY}
          onClick={onRefreshPrices}
          disabled={isRefreshing || disableRefresh}
          className="w-auto px-4"
          aria-label={refreshLabel}
        >
          <svg
            className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshLabel}
        </Button>
      )}

      {/* Add Investment Button */}
      {onAddInvestment && (
        <Button
          type={ButtonType.PRIMARY}
          onClick={onAddInvestment}
          disabled={disableAdd}
          className="w-auto px-4"
          aria-label={addLabel}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {addLabel}
        </Button>
      )}
    </div>
  );
});
