"use client";

import React, { memo } from "react";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";
import { useAnimatedNumber, useAnimatedPercentage } from "@/components/charts/useAnimatedNumber";
import { Sparkline } from "@/components/charts";

/**
 * Financial summary data structure
 */
export interface FinancialSummaryData {
  /** Total income for the period */
  totalIncome: number;
  /** Total expenses for the period */
  totalExpenses: number;
  /** Net savings (income - expenses) */
  netSavings: number;
  /** Savings rate as percentage */
  savingsRate: number;
  /** Top expense category */
  topExpenseCategory?: {
    name: string;
    amount: number;
  };
  /** Previous period data for comparison (optional) */
  previousPeriod?: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
  };
  /** Currency code */
  currency: string;
  /** Historical data for trend charts (optional) */
  incomeHistory?: { value: number; date: string }[];
  expenseHistory?: { value: number; date: string }[];
}

/**
 * SummaryCards component props
 */
export interface SummaryCardsProps {
  /** Financial summary data */
  data: FinancialSummaryData;
}

/**
 * Individual summary card component
 */
interface SummaryCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color: "green" | "red" | "blue" | "neutral";
  icon?: React.ReactNode;
  change?: number;
  changeLabel?: string;
  showSparkline?: boolean;
  sparklineData?: { value: number }[];
}

const SummaryCard = memo(function SummaryCard({
  label,
  value,
  subtitle,
  color,
  icon,
  change,
  changeLabel,
  showSparkline,
  sparklineData,
}: SummaryCardProps) {
  const colorClasses = {
    green: {
      bg: "bg-green-50",
      text: "text-green-700",
      icon: "bg-green-100",
    },
    red: {
      bg: "bg-red-50",
      text: "text-red-700",
      icon: "bg-red-100",
    },
    blue: {
      bg: "bg-primary-50",
      text: "text-primary-700",
      icon: "bg-primary-100",
    },
    neutral: {
      bg: "bg-neutral-50",
      text: "text-neutral-700",
      icon: "bg-neutral-100",
    },
  };

  const colors = colorClasses[color];

  return (
    <BaseCard className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-600">{label}</span>
          {icon && (
            <div className={`w-8 h-8 rounded-full ${colors.icon} flex items-center justify-center`}>
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="text-2xl font-bold text-neutral-900">{value}</div>

        {/* Subtitle/Change */}
        {subtitle && (
          <div className="text-xs text-neutral-500">{subtitle}</div>
        )}

        {change !== undefined && (
          <div className={`text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
            {changeLabel && ` ${changeLabel}`}
          </div>
        )}

        {/* Sparkline */}
        {showSparkline && sparklineData && sparklineData.length > 1 && (
          <div className="pt-2">
            <Sparkline data={sparklineData} height={40} />
          </div>
        )}
      </div>
    </BaseCard>
  );
});

/**
 * Icon components for summary cards
 */
const Icons = {
  Income: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-green-600"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Expense: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-600"
    >
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </svg>
  ),
  Savings: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-blue-600"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Percent: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-600"
    >
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  Category: () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-600"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
};

/**
 * SummaryCards - Financial report summary cards with comparisons and trends
 *
 * Features:
 * - Total Income card
 * - Total Expenses card
 * - Net Savings card
 * - Savings Rate card
 * - Top Expense Category
 * - Comparison with previous period
 * - Trend sparklines
 */
export const SummaryCards = memo(function SummaryCards({ data }: SummaryCardsProps) {
  const {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    topExpenseCategory,
    previousPeriod,
    currency,
    incomeHistory,
    expenseHistory,
  } = data;

  // Animated values
  const animatedIncome = useAnimatedNumber(totalIncome, 1000);
  const animatedExpenses = useAnimatedNumber(totalExpenses, 1000);
  const animatedSavings = useAnimatedNumber(netSavings, 1000);
  const animatedRate = useAnimatedPercentage(savingsRate, 1000);

  // Calculate changes from previous period
  const incomeChange = previousPeriod
    ? ((totalIncome - previousPeriod.totalIncome) / previousPeriod.totalIncome) * 100
    : undefined;

  const expensesChange = previousPeriod
    ? ((totalExpenses - previousPeriod.totalExpenses) / previousPeriod.totalExpenses) * 100
    : undefined;

  const savingsChange = previousPeriod
    ? ((netSavings - previousPeriod.netSavings) / Math.abs(previousPeriod.netSavings || 1)) * 100
    : undefined;

  const rateChange = previousPeriod
    ? savingsRate - previousPeriod.savingsRate
    : undefined;

  // Prepare sparkline data
  const incomeSparkline = incomeHistory?.map((h) => ({ value: h.value })) || [];
  const expenseSparkline = expenseHistory?.map((h) => ({ value: h.value })) || [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      {/* Total Income */}
      <SummaryCard
        label="Total Income"
        value={formatCurrency(animatedIncome, currency)}
        color="green"
        icon={<Icons.Income />}
        change={incomeChange}
        changeLabel="vs last period"
        showSparkline={incomeSparkline.length > 1}
        sparklineData={incomeSparkline}
      />

      {/* Total Expenses */}
      <SummaryCard
        label="Total Expenses"
        value={formatCurrency(animatedExpenses, currency)}
        color="red"
        icon={<Icons.Expense />}
        change={expensesChange}
        changeLabel="vs last period"
        showSparkline={expenseSparkline.length > 1}
        sparklineData={expenseSparkline}
      />

      {/* Net Savings */}
      <SummaryCard
        label="Net Savings"
        value={formatCurrency(animatedSavings, currency)}
        subtitle={netSavings >= 0 ? "Positive cash flow" : "Negative cash flow"}
        color={netSavings >= 0 ? "blue" : "red"}
        icon={<Icons.Savings />}
        change={savingsChange}
        changeLabel="vs last period"
      />

      {/* Savings Rate */}
      <SummaryCard
        label="Savings Rate"
        value={`${animatedRate.toFixed(1)}%`}
        subtitle={savingsRate >= 20 ? "Excellent!" : savingsRate >= 10 ? "Good" : "Needs improvement"}
        color="neutral"
        icon={<Icons.Percent />}
        change={rateChange}
        changeLabel="pp change"
      />

      {/* Top Expense Category */}
      {topExpenseCategory && (
        <SummaryCard
          label="Top Expense"
          value={formatCurrency(topExpenseCategory.amount, currency)}
          subtitle={topExpenseCategory.name}
          color="neutral"
          icon={<Icons.Category />}
        />
      )}
    </div>
  );
});
