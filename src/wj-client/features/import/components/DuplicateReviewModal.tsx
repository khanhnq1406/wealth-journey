"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { DuplicateMatch, DuplicateActionType, DuplicateAction } from "@/gen/protobuf/v1/import";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";
import { XIcon } from "@/components/icons";

// Re-export types for external use
export type { DuplicateAction };
export { DuplicateActionType };

export interface DuplicateReviewModalProps {
  matches: DuplicateMatch[];
  onComplete: (actions: DuplicateAction[]) => void;
  onCancel: () => void;
  currency?: string;
}

/**
 * DuplicateReviewModal - Side-by-side comparison modal for reviewing duplicate transactions
 *
 * Features:
 * - Shows one duplicate at a time with side-by-side comparison
 * - Keyboard shortcuts: M=Merge, K=Keep Both, S=Skip, N=Not Duplicate, Esc=Cancel
 * - Navigation: Previous/Next buttons or arrow keys
 * - Confidence level display with color coding
 * - Highlights field differences
 */
export function DuplicateReviewModal({
  matches,
  onComplete,
  onCancel,
  currency = "VND",
}: DuplicateReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actions, setActions] = useState<Map<number, DuplicateAction>>(new Map());

  // Current match being reviewed
  const currentMatch = matches[currentIndex];
  const imported = currentMatch?.importedTransaction;
  const existing = currentMatch?.existingTransaction;

  // Handle user action
  const handleAction = useCallback(
    (actionType: DuplicateActionType) => {
      if (!imported || !existing) return;

      const action: DuplicateAction = {
        importedRowNumber: imported.rowNumber,
        existingTransactionId: existing.id,
        action: actionType,
      };

      // Store action
      setActions((prev) => {
        const newActions = new Map(prev);
        newActions.set(imported.rowNumber, action);
        return newActions;
      });

      // Move to next duplicate or complete
      if (currentIndex < matches.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // All duplicates reviewed, collect actions and complete
        const allActions = Array.from(actions.values());
        allActions.push(action); // Include current action
        onComplete(allActions);
      }
    },
    [currentIndex, matches.length, imported, existing, actions, onComplete]
  );

  // Navigation
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(matches.length - 1, prev + 1));
  }, [matches.length]);

  // Use refs to store current state for keyboard shortcuts
  const actionsRef = useRef(actions);
  const currentIndexRef = useRef(currentIndex);

  // Keep refs in sync
  useEffect(() => {
    actionsRef.current = actions;
    currentIndexRef.current = currentIndex;
  }, [actions, currentIndex]);

  // Keyboard shortcuts with stable dependencies
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      if ((e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      const currentIdx = currentIndexRef.current;
      const currentActions = actionsRef.current;
      const currentMatch = matches[currentIdx];

      if (!currentMatch?.importedTransaction || !currentMatch?.existingTransaction) {
        return;
      }

      let actionType: DuplicateActionType | null = null;

      switch (e.key.toLowerCase()) {
        case "m":
          actionType = DuplicateActionType.DUPLICATE_ACTION_MERGE;
          break;
        case "k":
          actionType = DuplicateActionType.DUPLICATE_ACTION_KEEP_BOTH;
          break;
        case "s":
          actionType = DuplicateActionType.DUPLICATE_ACTION_SKIP;
          break;
        case "n":
          actionType = DuplicateActionType.DUPLICATE_ACTION_NOT_DUPLICATE;
          break;
        case "arrowleft":
          if (currentIdx > 0) {
            e.preventDefault();
            setCurrentIndex(currentIdx - 1);
          }
          return;
        case "arrowright":
          if (currentIdx < matches.length - 1) {
            e.preventDefault();
            setCurrentIndex(currentIdx + 1);
          }
          return;
        case "escape":
          e.preventDefault();
          onCancel();
          return;
        default:
          return;
      }

      if (actionType !== null) {
        e.preventDefault();
        // Create action using current match data
        const imported = currentMatch.importedTransaction;
        const existing = currentMatch.existingTransaction;

        const action: DuplicateAction = {
          importedRowNumber: imported.rowNumber,
          existingTransactionId: existing.id,
          action: actionType,
        };

        // Store action
        setActions((prev) => {
          const newActions = new Map(prev);
          newActions.set(imported.rowNumber, action);
          return newActions;
        });

        // Move to next duplicate or complete
        if (currentIdx < matches.length - 1) {
          setCurrentIndex(currentIdx + 1);
        } else {
          // All duplicates reviewed, collect actions and complete
          const allActions = Array.from(currentActions.values());
          allActions.push(action); // Include current action
          onComplete(allActions);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [matches, onComplete, onCancel]); // Stable dependencies only

  // Confidence badge styling
  const getConfidenceBadgeClass = (confidence: number) => {
    if (confidence >= 95) {
      return "bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300";
    } else if (confidence >= 70) {
      return "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300";
    } else {
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 95) return "Strong Match";
    if (confidence >= 70) return "Likely Match";
    return "Possible Match";
  };

  // Check if fields differ
  const amountsDiffer = imported?.amount?.amount !== existing?.amount?.amount;
  const datesDiffer = imported?.date !== existing?.date;
  const descriptionsDiffer = imported?.description !== existing?.note;

  if (matches.length === 0 || !currentMatch) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-dark-border">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-dark-text">
              Duplicate Review ({currentIndex + 1} of {matches.length})
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "px-2 py-0.5 text-xs font-semibold rounded",
                  getConfidenceBadgeClass(currentMatch.confidence)
                )}
              >
                {currentMatch.confidence}% Match
              </span>
              <span className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                {getConfidenceLabel(currentMatch.confidence)}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-dark-surface-hover rounded-lg transition-colors"
            aria-label="Close"
          >
            <XIcon size="sm" decorative />
          </button>
        </div>

        {/* Progress Dots */}
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-dark-border">
          <div className="flex gap-1 justify-center">
            {matches.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-2 rounded-full transition-all",
                  idx === currentIndex
                    ? "w-8 bg-primary-600"
                    : actions.has(matches[idx].importedTransaction?.rowNumber || 0)
                      ? "w-2 bg-success-600"
                      : "w-2 bg-neutral-300 dark:bg-neutral-600"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Match Reason */}
          <div className="p-3 bg-neutral-50 dark:bg-dark-surface-hover rounded-lg">
            <p className="text-sm text-neutral-700 dark:text-dark-text-secondary">
              <strong>Why matched:</strong> {currentMatch.matchReason}
            </p>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Imported Transaction */}
            <div className="p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg">
              <h3 className="text-sm font-semibold mb-3 text-primary-700 dark:text-primary-300">
                Imported Transaction
              </h3>
              <div className="space-y-2 text-sm">
                <div className={cn(amountsDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Amount:</strong>
                  <p className="text-neutral-900 dark:text-dark-text font-medium">
                    {formatCurrency(imported?.amount?.amount || 0, imported?.amount?.currency || currency)}
                  </p>
                </div>
                <div className={cn(datesDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Date:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">{formatDate(imported?.date)}</p>
                </div>
                <div className={cn(descriptionsDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Description:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">{imported?.description || "(none)"}</p>
                </div>
                {imported?.referenceNumber && (
                  <div>
                    <strong className="text-neutral-700 dark:text-dark-text-secondary">Reference:</strong>
                    <p className="text-neutral-900 dark:text-dark-text">{imported.referenceNumber}</p>
                  </div>
                )}
                <div>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Category:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">
                    {imported?.suggestedCategoryId ? `Category ${imported.suggestedCategoryId}` : "(not set)"}
                  </p>
                </div>
              </div>
            </div>

            {/* Existing Transaction */}
            <div className="p-4 bg-neutral-50 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border rounded-lg">
              <h3 className="text-sm font-semibold mb-3 text-neutral-900 dark:text-dark-text">
                Existing Transaction
              </h3>
              <div className="space-y-2 text-sm">
                <div className={cn(amountsDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Amount:</strong>
                  <p className="text-neutral-900 dark:text-dark-text font-medium">
                    {formatCurrency(existing?.amount?.amount || 0, existing?.amount?.currency || currency)}
                  </p>
                </div>
                <div className={cn(datesDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Date:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">{formatDate(existing?.date)}</p>
                </div>
                <div className={cn(descriptionsDiffer && "bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded")}>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Description:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">{existing?.note || "(none)"}</p>
                </div>
                <div>
                  <strong className="text-neutral-700 dark:text-dark-text-secondary">Category:</strong>
                  <p className="text-neutral-900 dark:text-dark-text">
                    {existing?.categoryId ? `Category ${existing.categoryId}` : "(not set)"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Help */}
          <div className="p-3 bg-neutral-100 dark:bg-dark-surface-hover rounded-lg">
            <p className="text-xs text-neutral-600 dark:text-dark-text-tertiary">
              <strong>Keyboard shortcuts:</strong> M = Merge, K = Keep Both, S = Skip, N = Not a Duplicate, ← → = Navigate, Esc = Cancel
            </p>
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="p-6 border-t border-neutral-200 dark:border-dark-border space-y-3">
          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="primary"
              onClick={() => handleAction(DuplicateActionType.DUPLICATE_ACTION_MERGE)}
              size="sm"
              fullWidth
            >
              <span className="hidden md:inline">Merge</span>
              <span className="md:hidden">Merge</span>
              <span className="ml-1 opacity-70">(M)</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction(DuplicateActionType.DUPLICATE_ACTION_KEEP_BOTH)}
              size="sm"
              fullWidth
            >
              <span className="hidden md:inline">Keep Both</span>
              <span className="md:hidden">Keep</span>
              <span className="ml-1 opacity-70">(K)</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction(DuplicateActionType.DUPLICATE_ACTION_SKIP)}
              size="sm"
              fullWidth
            >
              <span className="hidden md:inline">Skip Import</span>
              <span className="md:hidden">Skip</span>
              <span className="ml-1 opacity-70">(S)</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleAction(DuplicateActionType.DUPLICATE_ACTION_NOT_DUPLICATE)}
              size="sm"
              fullWidth
            >
              <span className="hidden md:inline">Not a Duplicate</span>
              <span className="md:hidden">Not Dup</span>
              <span className="ml-1 opacity-70">(N)</span>
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-dark-surface-hover text-neutral-700 dark:text-dark-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 dark:hover:bg-dark-surface-active transition-colors"
            >
              ← Previous
            </button>
            <button
              onClick={goToNext}
              disabled={currentIndex === matches.length - 1}
              className="flex-1 px-4 py-2 text-sm bg-neutral-200 dark:bg-dark-surface-hover text-neutral-700 dark:text-dark-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-300 dark:hover:bg-dark-surface-active transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
