"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BaseCard } from "@/components/BaseCard";
import { Budget, BudgetItem } from "@/gen/protobuf/v1/budget";
import { formatCurrency, parseAmount } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQueryGetBudgetItems } from "@/utils/generated/hooks";
import { BudgetItemCard } from "./BudgetItemCard";
import { ButtonType, resources } from "@/app/constants";
import { Button } from "@/components/Button";
import { useMutationDeleteBudget } from "@/utils/generated/hooks";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { useTranslations } from "next-intl";

interface CircularProgressProps {
  percentage: number;
  statusColor: string;
  progressColor: string;
}

// Color mapping for progress circle (actual hex/rgb values for SVG)
const getProgressStrokeColor = (progressColor: string): string => {
  if (progressColor.includes("red")) return "#DC2626"; // red-600
  if (progressColor.includes("amber")) return "#D97706"; // amber-600
  if (progressColor.includes("green")) return "#15803D"; // v2-green-positive
  return "#15803D"; // default v2-green-positive
};

// Circular progress component - defined outside to prevent re-renders
function CircularProgress({
  percentage,
  statusColor,
  progressColor,
}: CircularProgressProps) {
  const size = 150;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeColor = getProgressStrokeColor(progressColor);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          stroke="rgba(255,255,255,0.15)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          stroke={strokeColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={
            circumference * (1 - Math.min(percentage, 100) / 100)
          }
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset:
              circumference * (1 - Math.min(percentage, 100) / 100),
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-3xl font-bold ${statusColor} leading-none`}>
          {Math.round(Math.min(percentage, 100))}
        </div>
        <div className="text-xs text-v2-text-tertiary mt-0.5">%</div>
      </div>
    </div>
  );
}

// Stat card component - defined outside to prevent re-renders
interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  statusBorder?: string;
  statusColor?: string;
}

function StatCard({
  label,
  value,
  highlight = false,
  statusBorder = "",
  statusColor = "",
}: StatCardProps) {
  return (
    <div
      className={`flex-1 px-3 py-2.5 rounded-xl border ring-1 ${
        highlight ? statusBorder : "border-v2-border-light bg-v2-bg-dark ring-transparent"
      } transition-all duration-200`}
    >
      <div className="text-xs text-v2-text-tertiary mb-1">{label}</div>
      <div
        className={`text-sm font-semibold truncate ${highlight ? statusColor : "text-white"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

interface BudgetCardProps {
  budget: Budget;
  onRefresh: () => void;
  onEditBudget: (budget: Budget) => void;
  onAddBudgetItem: (budgetId: number) => void;
  onEditBudgetItem: (budgetId: number, item: BudgetItem) => void;
  onDeleteBudget: (budgetId: number) => void;
}

/**
 * Enhanced BudgetCard with card-style stats display.
 * Features horizontal layout with stat cards for clear visual hierarchy.
 */
export function BudgetCard({
  budget,
  onRefresh,
  onEditBudget,
  onAddBudgetItem,
  onEditBudgetItem,
}: BudgetCardProps) {
  const t = useTranslations("budget");
  const tCommon = useTranslations("common");
  const tModals = useTranslations("modals");
  const { currency } = useCurrency();
  const [isExpanded, setIsExpanded] = useState(false);
  const getBudgetItems = useQueryGetBudgetItems(
    { budgetId: budget.id },
    { enabled: !!budget.id },
  );

  const deleteBudgetMutation = useMutationDeleteBudget({
    onSuccess: () => {
      onRefresh();
    },
  });

  const budgetItems = getBudgetItems.data?.items ?? [];

  // Calculate total budget and spent amounts
  const totalBudget = budget.displayTotal?.amount
    ? parseAmount(budget.displayTotal?.amount)
    : (parseAmount(budget.total?.amount) ?? 0);

  const totalSpent = useMemo(() => {
    return budgetItems.reduce(
      (sum, item) =>
        sum +
        (item.displayTotal?.amount
          ? parseAmount(item.displayTotal?.amount)
          : (parseAmount(item.total?.amount) ?? 0)),
      0,
    );
  }, [budgetItems]);
  const remaining = totalBudget - totalSpent;
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Status calculations
  const isOverBudget = remaining < 0;
  const isNearLimit = percentage > 80 && percentage <= 100;

  const statusColor = isOverBudget
    ? "text-red-600"
    : isNearLimit
      ? "text-amber-600"
      : "text-v2-green-positive";

  const statusBg = isOverBudget
    ? "bg-red-50"
    : isNearLimit
      ? "bg-amber-50"
      : "bg-v2-green-light";

  const statusBorder = isOverBudget
    ? "border-red-200 ring-red-100"
    : isNearLimit
      ? "border-amber-200 ring-amber-100"
      : "border-v2-border ring-green-100";

  const progressColor = isOverBudget
    ? "bg-red-500"
    : isNearLimit
      ? "bg-amber-500"
      : "bg-v2-green-positive";

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteBudget = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteBudget = () => {
    deleteBudgetMutation.mutate({ budgetId: budget.id });
    setShowDeleteDialog(false);
  };

  const cancelDeleteBudget = () => {
    setShowDeleteDialog(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-h-[800px]"
      >
        <BaseCard className="overflow-hidden h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-v2-border-light">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                {budget.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusBg} ${statusColor}`}
                >
                  {budgetItems.length}{" "}
                  {budgetItems.length === 1 ? "item" : "items"}
                </span>
                {(isOverBudget || isNearLimit) && (
                  <span className={`text-xs font-medium ${statusColor}`}>
                    {isOverBudget ? t("card.overBudget") : "Near limit"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-3 sm:ml-4">
              <Button
                type={ButtonType.IMG}
                src={`${resources}/editing.svg`}
                onClick={() => onEditBudget(budget)}
                className="p-2 hover:bg-v2-bg-surface-tint rounded-lg transition-colors"
              />
              <Button
                type={ButtonType.IMG}
                src={`${resources}/remove.svg`}
                onClick={handleDeleteBudget}
                disabled={deleteBudgetMutation.isPending}
                className="p-2 hover:bg-v2-bg-surface-tint rounded-lg transition-colors"
              />
            </div>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col overflow-hidden">
            {/* Main Content: Progress + Stats */}
            <div className="flex items-center gap-5">
              {/* Circular Progress */}
              <CircularProgress
                percentage={percentage}
                statusColor={statusColor}
                progressColor={progressColor}
              />

              {/* Stats Cards */}
              <div className="flex flex-col gap-2 w-full">
                <StatCard
                  label={tCommon("balance")}
                  value={formatCurrency(totalBudget, currency)}
                  statusBorder={statusBorder}
                  statusColor={statusColor}
                />
                <StatCard
                  label={t("card.spent")}
                  value={formatCurrency(totalSpent, currency)}
                  statusBorder={statusBorder}
                  statusColor={statusColor}
                />
                <StatCard
                  label={t("card.remaining")}
                  value={`${isOverBudget ? "-" : ""}${formatCurrency(Math.abs(remaining), currency)}`}
                  highlight
                  statusBorder={statusBorder}
                  statusColor={statusColor}
                />
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 sm:mt-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-v2-text-secondary">
                  {t("card.budgetUsage")}
                </span>
                <span className={`text-xs font-bold ${statusColor}`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-v2-bg-dark rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${progressColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Budget Items Section */}
            <div className="mt-4 sm:mt-5 pt-4 border-t border-v2-border-light flex-1 flex flex-col min-h-0">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between py-2.5 px-3  rounded-lg hover:bg-v2-bg-surface-tint transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-v2-text-secondary">
                    Budget Items
                  </h4>
                  <span className="text-xs text-v2-text-tertiary">
                    {budgetItems.length > 0 && (
                      <>
                        {budgetItems.filter((i) => i.checked).length}/
                        {budgetItems.length} completed
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type={ButtonType.IMG}
                    src={`${resources}/plus.svg`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddBudgetItem(budget.id);
                    }}
                    className="p-1.5 hover:bg-v2-green-light rounded-md transition-colors"
                  />
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg
                      className="w-4 h-4 text-v2-text-tertiary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </motion.div>
                </div>
              </button>

              {/* Scrollable items area */}
              {isExpanded && (
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 transition-opacity duration-200 opacity-100">
                  {getBudgetItems.isLoading ? (
                    <div className="text-center py-8 text-sm text-v2-text-tertiary">
                      Loading items...
                    </div>
                  ) : budgetItems.length === 0 ? (
                    <div className="text-center py-8 text-sm text-v2-text-tertiary">
                      {t("noBudgetsYet")}
                    </div>
                  ) : (
                    <div className="space-y-2 py-3">
                      {budgetItems.map((item) => (
                        <BudgetItemCard
                          key={item.id}
                          item={item}
                          budgetId={budget.id}
                          onRefresh={() => {
                            getBudgetItems.refetch();
                            onRefresh();
                          }}
                          onEditItem={onEditBudgetItem}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </BaseCard>
      </motion.div>

      {showDeleteDialog && (
        <ConfirmationDialog
          title={tCommon("delete")}
          message={
            <div className="flex flex-col gap-1.5">
              <p>{`${tModals("confirmation.areYouSure")} "${budget.name}"?`}</p>
              <p className="text-sm text-v2-text-tertiary">
                {tModals("confirmation.thisActionCannotBeUndone")}
              </p>
            </div>
          }
          confirmText={tCommon("delete")}
          cancelText={tCommon("cancel")}
          onConfirm={confirmDeleteBudget}
          onCancel={cancelDeleteBudget}
          isLoading={deleteBudgetMutation.isPending}
          variant="danger"
        />
      )}
    </>
  );
}
