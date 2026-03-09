"use client";

import React, { memo, useState } from "react";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";
import { useAnimatedPercentage } from "@/components/charts/useAnimatedNumber";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { resources } from "@/app/constants";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart } from "@/components/charts";
import { useTranslations } from "next-intl";

/**
 * Budget category data structure
 */
export interface BudgetCategoryData {
  /** Category ID */
  id: number;
  /** Category name */
  name: string;
  /** Budget amount for this category */
  budget: number;
  /** Amount spent in this category */
  spent: number;
  /** Currency code */
  currency: string;
  /** Number of transactions (optional) */
  transactionCount?: number;
  /** Category icon/emoji (optional) */
  icon?: string;
  /** Color for visualization (optional) */
  color?: string;
}

/**
 * CategoryBreakdown component props
 */
export interface CategoryBreakdownProps {
  /** Array of budget categories */
  categories: BudgetCategoryData[];
  /** Callback for add expense action */
  onAddExpense?: (categoryId: number) => void;
  /** Callback for edit budget action */
  onEditBudget?: (categoryId: number) => void;
  /** Display mode */
  viewMode?: "list" | "chart";
}

/**
 * Individual category item component
 */
interface CategoryItemProps {
  category: BudgetCategoryData;
  onAddExpense?: (categoryId: number) => void;
  onEditBudget?: (categoryId: number) => void;
}

const CategoryItem = memo(function CategoryItem({
  category,
  onAddExpense,
  onEditBudget,
}: CategoryItemProps) {
  const t = useTranslations("budget");
  const { id, name, budget, spent, currency, transactionCount, icon, color } = category;
  const remaining = budget - spent;
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const animatedPercentage = useAnimatedPercentage(percentage, 800);

  const isOverBudget = remaining < 0;
  const isNearLimit = percentage > 80 && percentage <= 100;

  const barColor = isOverBudget ? "bg-red-500" : isNearLimit ? "bg-amber-500" : color || "bg-v2-green-positive";
  const statusColor = isOverBudget ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-v2-green-positive";

  return (
    <BaseCard className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-lg">
                {icon}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-neutral-900">{name}</h4>
              {transactionCount !== undefined && (
                <p className="text-xs text-neutral-500">
                  {t("card.transactions", { count: transactionCount })}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddExpense?.(id);
              }}
              className="p-1.5 rounded-md hover:bg-v2-green-light text-v2-green-positive transition-colors"
              title={t("card.addExpense")}
            >
              <Image src={`${resources}/plus.svg`} alt="Add" width={16} height={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditBudget?.(id);
              }}
              className="p-1.5 rounded-md hover:bg-primary-100 text-primary-600 transition-colors"
              title={t("card.editBudget")}
            >
              <Image src={`${resources}/editing.svg`} alt="Edit" width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-neutral-600">{t("card.budgetUsage")}</span>
            <span className={`text-xs font-bold ${statusColor}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full overflow-hidden h-2">
            <motion.div
              className={`h-full ${barColor} transition-all duration-800 ease-out`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(animatedPercentage, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Amounts */}
        <div className="flex justify-between items-center py-2 border-t border-neutral-100">
          <div className="text-center">
            <div className="text-xs text-neutral-500">{t("title")}</div>
            <div className="text-sm font-semibold text-neutral-900">
              {formatCurrency(budget, currency)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-neutral-500">{t("card.spent")}</div>
            <div className="text-sm font-semibold text-neutral-900">
              {formatCurrency(spent, currency)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-neutral-500">{t("card.remaining")}</div>
            <div className={`text-sm font-bold ${statusColor}`}>
              {isOverBudget ? "-" : ""}
              {formatCurrency(Math.abs(remaining), currency)}
            </div>
          </div>
        </div>

        {/* Warning for over/near budget */}
        {(isOverBudget || isNearLimit) && (
          <div className={`text-xs font-medium px-2 py-1 rounded ${isOverBudget ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {isOverBudget ? `⚠️ ${t("card.overBudgetBy", { amount: formatCurrency(Math.abs(remaining), currency) })}` : `⚠️ ${t("card.approachingLimit")}`}
          </div>
        )}
      </div>
    </BaseCard>
  );
});

/**
 * CategoryBreakdown - Budget category breakdown with progress bars and chart view
 *
 * Features:
 * - List of category budgets
 * - Progress bars per category
 * - Spent vs remaining display
 * - Add expense per category
 * - Edit budget amount
 * - Toggle between list and chart view
 */
export const CategoryBreakdown = memo(function CategoryBreakdown({
  categories,
  onAddExpense,
  onEditBudget,
  viewMode = "list",
}: CategoryBreakdownProps) {
  const t = useTranslations("report");
  const [currentView, setCurrentView] = useState<"list" | "chart">(viewMode);

  // Prepare data for bar chart
  const chartData = categories.map((cat) => ({
    name: cat.name,
    budget: cat.budget,
    spent: cat.spent,
    remaining: cat.budget - cat.spent,
  }));

  // Calculate totals
  const totals = categories.reduce(
    (acc, cat) => ({
      budget: acc.budget + cat.budget,
      spent: acc.spent + cat.spent,
    }),
    { budget: 0, spent: 0 },
  );

  // Sort categories by percentage spent (highest first)
  const sortedCategories = [...categories].sort((a, b) => {
    const aPercent = a.budget > 0 ? (a.spent / a.budget) * 100 : 0;
    const bPercent = b.budget > 0 ? (b.spent / b.budget) * 100 : 0;
    return bPercent - aPercent;
  });

  return (
    <div className="space-y-4">
      {/* View Toggle and Summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentView === "list"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setCurrentView("chart")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentView === "chart"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
          >
            Chart View
          </button>
        </div>

        {/* Summary Badge */}
        <div className="text-sm text-neutral-600">
          Total: {formatCurrency(totals.spent, categories[0]?.currency || "USD")} / {formatCurrency(totals.budget, categories[0]?.currency || "USD")}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {currentView === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {sortedCategories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                onAddExpense={onAddExpense}
                onEditBudget={onEditBudget}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="chart"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <BaseCard className="p-4">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">{t("categoryComparison")}</h3>
              <div className="h-80">
                <BarChart
                  data={chartData}
                  xAxisKey="name"
                  series={[
                    { dataKey: "spent", name: t("chartLabels.spent"), color: "#15803D" },
                    { dataKey: "remaining", name: t("chartLabels.remaining"), color: "#e5e7eb" },
                  ]}
                  height={320}
                  layout="vertical"
                  showLegend={true}
                  showTooltip={true}
                  yAxisFormatter={(value) => formatCurrency(value, categories[0]?.currency || "USD")}
                  xAxisFormatter={(label) => label.length > 10 ? label.substring(0, 10) + "..." : label}
                />
              </div>
            </BaseCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
