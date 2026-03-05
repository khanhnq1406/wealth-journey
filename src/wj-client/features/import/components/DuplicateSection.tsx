"use client";

import React, { useState } from "react";
import { DuplicateMatch } from "@/gen/protobuf/v1/import";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon } from "@/components/icons";
import { formatCurrency } from "@/utils/currency-formatter";

export interface DuplicateSectionProps {
  matches: DuplicateMatch[];
  onDuplicateHandled: (rowNumber: number, action: "merge" | "keep" | "skip") => void;
  currency?: string;
}

export const DuplicateSection = React.memo(function DuplicateSection({
  matches,
  onDuplicateHandled,
  currency = "VND",
}: DuplicateSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset currentIndex if it's out of bounds
  React.useEffect(() => {
    if (currentIndex >= matches.length && matches.length > 0) {
      setCurrentIndex(0);
    }
  }, [matches.length, currentIndex]);

  if (matches.length === 0) {
    return null;
  }

  // Safety check: ensure currentIndex is valid
  const safeIndex = Math.min(currentIndex, matches.length - 1);
  const currentMatch = matches[safeIndex];

  // Safety check: ensure currentMatch exists
  if (!currentMatch) {
    return null;
  }

  const imported = currentMatch.importedTransaction;
  const existing = currentMatch.existingTransaction;

  const handleAction = (action: "merge" | "keep" | "skip") => {
    onDuplicateHandled(imported?.rowNumber || 0, action);

    // Move to next duplicate
    if (safeIndex < matches.length - 1) {
      setCurrentIndex(safeIndex + 1);
    } else {
      setExpanded(false); // All handled
    }
  };

  const handleAutoMergeAll = () => {
    matches.forEach((match) => {
      if (match.confidence >= 90) {
        onDuplicateHandled(match.importedTransaction?.rowNumber || 0, "merge");
      }
    });
    setExpanded(false);
  };

  const highConfidenceCount = matches.filter((m) => m.confidence >= 90).length;

  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 90) {
      return "bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300";
    } else if (confidence >= 70) {
      return "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300";
    } else {
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    }
  };

  return (
    <div className="border border-warning-300 dark:border-warning-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-warning-50 dark:bg-warning-950 hover:bg-warning-100 dark:hover:bg-warning-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div className="text-left">
            <h3 className="font-semibold text-base text-warning-700 dark:text-warning-300">
              {matches.length} Potential Duplicate{matches.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-warning-600 dark:text-warning-400">
              Review to avoid duplicate entries
            </p>
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
            "transition-transform text-warning-600 dark:text-warning-400",
            expanded && "rotate-180"
          )}
          decorative
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 bg-white dark:bg-dark-surface">
          {/* Progress */}
          <div className="flex items-center justify-between text-sm">
            <p className="text-neutral-600 dark:text-dark-text-secondary">
              Match {safeIndex + 1} of {matches.length}
            </p>
            <div className="flex gap-1">
              {matches.map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    idx === safeIndex
                      ? "bg-primary-600"
                      : idx < safeIndex
                        ? "bg-success-600"
                        : "bg-neutral-300 dark:bg-neutral-600"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "px-2 py-1 text-xs font-semibold rounded",
                getConfidenceBadgeClass(currentMatch.confidence)
              )}
            >
              {currentMatch.confidence}% Match
            </span>
            <span className="text-xs text-neutral-500 dark:text-dark-text-tertiary">
              {currentMatch.matchReason}
            </span>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
            {/* Imported Transaction */}
            <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950 dark:to-primary-900 border border-primary-200 dark:border-primary-800 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📥</span>
                  <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                    Imported Transaction
                  </h4>
                </div>
                <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-primary-600 text-white">
                  NEW
                </span>
              </div>
              <div className="space-y-0 text-sm text-neutral-900 dark:text-dark-text divide-y divide-primary-200 dark:divide-primary-800">
                <div className="flex justify-between py-2">
                  <span className="font-medium">Amount:</span>
                  <span className="font-bold">
                    {formatCurrency(imported?.amount?.amount || 0, imported?.amount?.currency || currency)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(imported?.date)}</span>
                </div>
                <div className="flex justify-between py-2 gap-3">
                  <span className="font-medium">Description:</span>
                  <span className="text-right">{imported?.description}</span>
                </div>
                {imported?.referenceNumber && (
                  <div className="flex justify-between py-2">
                    <span className="font-medium">Ref:</span>
                    <span>{imported.referenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="font-medium">Category:</span>
                  {imported?.suggestedCategoryId ? (
                    <span>Category {imported.suggestedCategoryId}</span>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400 italic">No category</span>
                  )}
                </div>
              </div>
            </div>

            {/* Existing Transaction */}
            <div className="p-4 bg-neutral-50 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💾</span>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
                    Existing Transaction
                  </h4>
                </div>
                <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-neutral-600 text-white">
                  EXISTING
                </span>
              </div>
              <div className="space-y-0 text-sm text-neutral-900 dark:text-dark-text divide-y divide-neutral-200 dark:divide-dark-border">
                <div className="flex justify-between py-2">
                  <span className="font-medium">Amount:</span>
                  <span className="font-bold">
                    {formatCurrency(existing?.amount?.amount || 0, existing?.amount?.currency || currency)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium">Date:</span>
                  <span>{formatDate(existing?.date)}</span>
                </div>
                <div className="flex justify-between py-2 gap-3">
                  <span className="font-medium">Description:</span>
                  <span className="text-right">{existing?.note}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="font-medium">Category:</span>
                  {existing?.categoryId ? (
                    <span>Category {existing.categoryId}</span>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400 italic">No category</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
            <Button
              variant="primary"
              onClick={() => handleAction("merge")}
              size="sm"
              fullWidth
              className="min-h-[48px] text-base font-semibold"
            >
              <span className="mr-1">🔗</span>
              Merge
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction("keep")}
              size="sm"
              fullWidth
              className="min-h-[48px] text-base font-semibold"
            >
              <span className="mr-1">📋</span>
              Keep Both
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction("skip")}
              size="sm"
              fullWidth
              className="min-h-[48px] text-base font-semibold"
            >
              <span className="mr-1">⏭️</span>
              Skip Import
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
              disabled={safeIndex === 0}
              className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-dark-surface-hover text-neutral-700 dark:text-dark-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 dark:hover:bg-dark-surface-active transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={() =>
                setCurrentIndex(Math.min(matches.length - 1, safeIndex + 1))
              }
              disabled={safeIndex === matches.length - 1}
              className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-dark-surface-hover text-neutral-700 dark:text-dark-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 dark:hover:bg-dark-surface-active transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Auto-Merge High Confidence */}
          {highConfidenceCount > 0 && (
            <div className="pt-3 border-t border-warning-200 dark:border-warning-800">
              <Button
                variant="primary"
                onClick={handleAutoMergeAll}
                fullWidth
                size="sm"
              >
                Auto-Merge All High Confidence ({highConfidenceCount})
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
