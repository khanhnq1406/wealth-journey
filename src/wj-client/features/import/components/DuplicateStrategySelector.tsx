"use client";

import React from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("modals.importWizard.duplicateStrategy");

  if (duplicateCount === 0) {
    return null;
  }

  const strategies = [
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL,
      label: t("skipAll"),
      description: t("skipAllDesc"),
      icon: "🚫",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_AUTO_MERGE,
      label: t("autoMerge"),
      description: t("autoMergeDesc"),
      icon: "🔄",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH,
      label: t("reviewEach"),
      description: t("reviewEachDesc"),
      icon: "👁️",
    },
    {
      value: DuplicateHandlingStrategy.DUPLICATE_STRATEGY_KEEP_ALL,
      label: t("keepAll"),
      description: t("keepAllDesc"),
      icon: "✅",
    },
  ];

  return (
 <div className={cn("p-4 bg-warning-50 border border-v2-gold-accent/40 rounded-lg", className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚡</span>
        <div>
 <h3 className="text-sm font-semibold text-warning-700">
            {t(duplicateCount !== 1 ? "headingPlural" : "heading", { count: duplicateCount })}
          </h3>
 <p className="text-xs text-warning-600">
            {t("subtitle")}
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
 ? "border-v2-gold-primary bg-primary-50"
 : "border-v2-gold-primary/20 bg-v2-maroon-800 hover:border-v2-gold-primary/30"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{strategy.icon}</span>
 <span className="text-sm font-semibold text-neutral-900">
                {strategy.label}
              </span>
            </div>
 <p className="text-xs text-neutral-600">
              {strategy.description}
            </p>
          </button>
        ))}
      </div>

      {selectedStrategy === DuplicateHandlingStrategy.DUPLICATE_STRATEGY_KEEP_ALL && (
 <div className="mt-3 p-2 bg-warning-100 rounded text-xs text-warning-800">
          ⚠️ {t(duplicateCount !== 1 ? "keepAllWarningPlural" : "keepAllWarning", { count: duplicateCount })}
        </div>
      )}
    </div>
  );
}
