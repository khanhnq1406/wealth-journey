"use client";

import React, { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { BaseCard } from "@/components/BaseCard";
import { formatCurrency } from "@/utils/currency-formatter";
import { useAnimatedPercentage } from "@/components/charts/useAnimatedNumber";
import { ButtonType } from "@/app/constants";
import { resources } from "@/app/constants";
import Image from "next/image";
import { Button } from "@/components/Button";
import { useTranslations } from "next-intl";

/**
 * Budget progress data structure
 */
export interface BudgetProgressData {
  /** Total budget amount */
  totalBudget: number;
  /** Amount spent so far */
  totalSpent: number;
  /** Currency code */
  currency: string;
  /** Budget period name (e.g., "January 2026") */
  periodName: string;
  /** Days remaining in period (optional) */
  daysRemaining?: number;
  /** Number of budget items/categories (optional) */
  itemCount?: number;
}

/**
 * BudgetProgressCard component props
 */
export interface BudgetProgressCardProps {
  /** Budget progress data */
  data: BudgetProgressData;
  /** Callback for add expense action */
  onAddExpense?: () => void;
  /** Callback for view breakdown action */
  onViewBreakdown?: () => void;
  /** Whether to show compact view */
  compact?: boolean;
}

/**
 * Circular progress indicator component
 */
interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

const CircularProgress = memo(function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 8,
  children,
}: CircularProgressProps) {
  const normalizedRadius = (size - strokeWidth) / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const isOverBudget = progress > 100;
  const strokeColor = isOverBudget
    ? "#ef4444"
    : progress > 80
      ? "#f59e0b"
      : "#15803D";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          stroke="rgba(255,255,255,0.15)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={size / 2}
          cy={size / 2}
        />

        {/* Progress circle */}
        <circle
          stroke={strokeColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
});

/**
 * Animated progress bar component
 */
interface AnimatedProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showWarning?: boolean;
  label?: string;
}

const AnimatedProgressBar = memo(function AnimatedProgressBar({
  progress,
  height = 12,
  showWarning = false,
  label,
}: AnimatedProgressBarProps) {
  const animatedProgress = useAnimatedPercentage(Math.min(progress, 100), 1000);

  const barColor =
    progress > 100
      ? "bg-red-500"
      : progress > 80
        ? "bg-amber-500"
        : "bg-v2-green-positive";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-v2-text-secondary">{label}</span>
          <span
            className={`text-sm font-bold ${progress > 100 ? "text-red-600" : progress > 80 ? "text-amber-600" : "text-v2-green-positive"}`}
          >
            {progress.toFixed(1)}%
          </span>
        </div>
      )}
      <div
        className="w-full bg-v2-bg-dark rounded-full overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <motion.div
          className={`h-full ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${Math.min(animatedProgress, 100)}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(animatedProgress, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      {showWarning && progress > 80 && (
        <div
          className={`text-xs font-medium mt-1 ${progress > 100 ? "text-red-600" : "text-amber-600"}`}
        >
          {progress > 100 ? "⚠️ Over budget!" : "⚠️ Approaching limit"}
        </div>
      )}
    </div>
  );
});

/**
 * BudgetProgressCard - Enhanced budget tracking with circular progress, warnings, and quick actions
 *
 * Features:
 * - Circular progress indicator
 * - Animated progress bar
 * - Over-budget warning
 * - Days remaining badge
 * - Quick add expense button
 * - Tap to view category breakdown
 */
export const BudgetProgressCard = memo(function BudgetProgressCard({
  data,
  onAddExpense,
  onViewBreakdown,
  compact = false,
}: BudgetProgressCardProps) {
  const t = useTranslations("budget");
  const {
    totalBudget,
    totalSpent,
    currency,
    periodName,
    daysRemaining,
    itemCount,
  } = data;

  const remaining = totalBudget - totalSpent;
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const animatedPercentage = useAnimatedPercentage(percentage, 1000);

  const isOverBudget = remaining < 0;
  const isNearLimit = percentage > 80 && percentage <= 100;

  const statusColor = isOverBudget
    ? "text-red-600"
    : isNearLimit
      ? "text-amber-600"
      : "text-v2-green-positive";
  const statusBg = isOverBudget
    ? "bg-red-100"
    : isNearLimit
      ? "bg-amber-100"
      : "bg-v2-green-light";

  if (compact) {
    return (
      <BaseCard
        className="p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={onViewBreakdown}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-sm font-medium text-v2-text-secondary mb-1">
              {periodName}
            </div>
            <AnimatedProgressBar progress={percentage} height={8} />
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-v2-text-tertiary">
                {t("card.spent")}: {formatCurrency(totalSpent, currency)}
              </span>
              <span className={statusColor}>
                {isOverBudget
                  ? t("card.overBudget")
                  : `${formatCurrency(Math.abs(remaining), currency)} ${t("card.remaining").toLowerCase()}`}
              </span>
            </div>
          </div>

          <CircularProgress
            progress={Math.min(percentage, 100)}
            size={80}
            strokeWidth={6}
          >
            <div className="text-center">
              <div className={`text-lg font-bold ${statusColor}`}>
                {animatedPercentage.toFixed(0)}%
              </div>
            </div>
          </CircularProgress>
        </div>

        {daysRemaining !== undefined && (
          <div className="mt-3 pt-2 border-t border-v2-border-light">
            <div className="flex items-center justify-between">
              <span className="text-xs text-v2-text-tertiary">{t("card.timeRemaining")}</span>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBg} ${statusColor}`}
              >
                {t("card.days", { count: daysRemaining })}
              </span>
            </div>
          </div>
        )}
      </BaseCard>
    );
  }

  return (
    <BaseCard
      className="p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onViewBreakdown}
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Circular Progress */}
        <div className="flex-shrink-0 flex justify-center">
          <CircularProgress
            progress={Math.min(percentage, 100)}
            size={compact ? 100 : 140}
            strokeWidth={compact ? 10 : 12}
          >
            <div className="text-center">
              <div className={`text-2xl sm:text-3xl font-bold ${statusColor}`}>
                {animatedPercentage.toFixed(0)}%
              </div>
              <div className="text-xs text-v2-text-tertiary mt-1">
                {isOverBudget ? t("card.overBudget") : t("card.spent")}
              </div>
            </div>
          </CircularProgress>
        </div>

        {/* Budget Details */}
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div>
            <h3 className="text-lg font-bold text-v2-gold-accent">{periodName}</h3>
            {itemCount !== undefined && itemCount > 0 && (
              <p className="text-sm text-v2-text-tertiary mt-1">
                {t("card.categories", { count: itemCount })}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <AnimatedProgressBar
            progress={percentage}
            label={t("card.budgetUsage")}
            showWarning={isOverBudget || isNearLimit}
          />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-2">
            <div>
              <div className="text-xs text-v2-text-tertiary mb-1">{t("title")}</div>
              <div className="text-sm font-semibold text-v2-gold-accent">
                {formatCurrency(totalBudget, currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-v2-text-tertiary mb-1">{t("card.spent")}</div>
              <div className="text-sm font-semibold text-v2-gold-accent">
                {formatCurrency(totalSpent, currency)}
              </div>
            </div>
            <div>
              <div className="text-xs text-v2-text-tertiary mb-1">{t("card.remaining")}</div>
              <div className={`text-sm font-bold ${statusColor}`}>
                {isOverBudget ? "-" : ""}
                {formatCurrency(Math.abs(remaining), currency)}
              </div>
            </div>
          </div>

          {/* Days Remaining Badge */}
          {daysRemaining !== undefined && (
            <div className="flex items-center justify-between pt-2 border-t border-v2-border-light">
              <span className="text-sm text-v2-text-tertiary">{t("card.daysRemaining")}</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBg} ${statusColor}`}
              >
                {t("card.days", { count: daysRemaining })}
              </span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type={ButtonType.PRIMARY}
              onClick={(e) => {
                e.stopPropagation();
                onAddExpense?.();
              }}
              className="flex-1"
            >
              <div className="flex items-center justify-center gap-2">
                <Image
                  src={`${resources}/plus.svg`}
                  alt="Add"
                  width={16}
                  height={16}
                />
                <span>{t("card.addItem")}</span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </BaseCard>
  );
});
