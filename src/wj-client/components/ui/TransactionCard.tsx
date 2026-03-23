"use client";

import React from "react";
import { BaseCard } from "../BaseCard";

/**
 * TransactionCard Component
 *
 * A card component for displaying individual transaction items.
 * Part of Phase 4 modular components.
 *
 * Features:
 * - Transaction details display
 * - Category badge
 * - Date and amount display
 * - Income/expense differentiation
 * - Responsive design
 * - Dark mode support
 */

export interface TransactionCardProps {
  /** Transaction name/description */
  name: string;

  /** Transaction amount */
  amount: number;

  /** Currency symbol */
  currency?: string;

  /** Category name */
  category?: string;

  /** Transaction date */
  date?: string | Date;

  /** Wallet name */
  wallet?: string;

  /** Transaction type */
  type?: "income" | "expense";

  /** Icon */
  icon?: React.ReactNode;

  /** CSS class name */
  className?: string;

  /** Click handler */
  onClick?: () => void;
}

export function TransactionCard({
  name,
  amount,
  currency = "",
  category,
  date,
  wallet,
  type = "expense",
  icon,
  className = "",
  onClick,
}: TransactionCardProps) {
  const isIncome = type === "income";
 const amountColor = isIncome ? "text-v2-green-positive" : "text-red-600";
  const amountPrefix = isIncome ? "+" : "-";

  const formatDate = (dateInput: string | Date | undefined) => {
    if (!dateInput) return "";
    const dateObj = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <BaseCard
      className={`p-4 transition-all hover:shadow-md ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          {icon && (
            <div className="flex-shrink-0 mr-3">
 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                {icon}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-gray-900 truncate">{name}</p>

            <div className="flex items-center gap-2 mt-1">
              {category && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {category}
                </span>
              )}

              {date && (
 <span className="text-xs text-gray-500">{formatDate(date)}</span>
              )}

              {wallet && (
 <span className="text-xs text-gray-400">• {wallet}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 ml-4 text-right">
          <p className={`text-sm font-semibold ${amountColor}`}>
            {amountPrefix}
            {currency}
            {Math.abs(amount).toLocaleString()}
          </p>
        </div>
      </div>
    </BaseCard>
  );
}

export default TransactionCard;
