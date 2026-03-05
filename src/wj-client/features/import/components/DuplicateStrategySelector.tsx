"use client";

import React from "react";
import { DuplicateHandlingStrategy } from "@/gen/protobuf/v1/import";
import { cn } from "@/lib/utils/cn";

export interface DuplicateStrategySelectorProps {
  duplicateCount: number;
  selectedStrategy: DuplicateHandlingStrategy;
  onStrategyChange: (strategy: DuplicateHandlingStrategy) => void;
  className?: string;
}

/**
 * DuplicateStrategySelector - UI for selecting duplicate handling strategy
 *
 * Shows options only when duplicates are detected
 */
export function DuplicateStrategySelector({
  duplicateCount,
  selectedStrategy,
  onStrategyChange,
  className,
}: DuplicateStrategySelectorProps) {
  if (duplicateCount === 0) {
    return null;
  }

  const strategies = [
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL,
      label: "Skip All",
      description: "Don't import any duplicates",
      icon: "🚫",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_AUTO_MERGE,
      label: "Auto Merge",
      description: "Update existing transactions",
      icon: "🔄",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH,
      label: "Review Each",
      description: "Manually review duplicates",
      icon: "👁️",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_KEEP_ALL,
      label: "Keep All",
      description: "Import all as new transactions",
      icon: "✅",
    },
  ];

  return (
    <div className={cn("p-4 bg-warning-50 dark:bg-warning-950 border border-warning-300 dark:border-warning-700 rounded-lg", className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚡</span>
        <div>
          <h3 className="text-sm font-semibold text-warning-700 dark:text-warning-300">
            {duplicateCount} Potential Duplicate{duplicateCount !== 1 ? "s" : ""} Detected
          </h3>
          <p className="text-xs text-warning-600 dark:text-warning-400">
            Choose how to handle duplicate transactions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {strategies.map((strategy) => (
          <button
            key={strategy.value}
            onClick={() => onStrategyChange(strategy.value)}
            className={cn(
              "p-3 rounded-lg border-2 transition-all text-left",
              selectedStrategy === strategy.value
                ? "border-primary-600 bg-primary-50 dark:bg-primary-950"
                : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:border-neutral-300 dark:hover:border-neutral-600"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{strategy.icon}</span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
                {strategy.label}
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-dark-text-secondary">
              {strategy.description}
            </p>
          </button>
        ))}
      </div>

      {selectedStrategy === DuplicateHandlingStrategy.DUPLICATE_STRATEGY_KEEP_ALL && (
        <div className="mt-3 p-2 bg-warning-100 dark:bg-warning-900/30 rounded text-xs text-warning-800 dark:text-warning-300">
          ⚠️ Warning: This will import all {duplicateCount} potential duplicate{duplicateCount !== 1 ? "s" : ""} as new transactions
        </div>
      )}
    </div>
  );
}
