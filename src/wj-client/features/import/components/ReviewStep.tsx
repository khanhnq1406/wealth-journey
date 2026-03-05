"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/Button";
import { ErrorSummary } from "./ErrorSummary";
import { TransactionReviewTable } from "./TransactionReviewTable";
import {
  ParsedTransaction,
  DuplicateMatch,
  DuplicateHandlingStrategy,
  CurrencyConversion,
  DuplicateAction,
  DuplicateActionType,
} from "@/gen/protobuf/v1/import";
import { ColumnMapping } from "./ColumnMappingStep";
import { useMutationParseStatement } from "@/utils/generated/hooks";
import { ErrorSection } from "./ErrorSection";
import { DuplicateSection } from "./DuplicateSection";
import { CategoryReviewSection } from "./CategoryReviewSection";
import { ReadyToImportSection } from "./ReadyToImportSection";
import { DateRangeFilter } from "./DateRangeFilter";
import { DuplicateStrategySelector } from "./DuplicateStrategySelector";
import { CurrencyConversionSection } from "./CurrencyConversionSection";
import { ChangeRateModal } from "./ChangeRateModal";

// Props for parsing mode (Task 10)
export interface ReviewStepParseProps {
  file: File;
  columnMapping: ColumnMapping;
  onNext: () => void;
  onBack: () => void;
  onError: (error: any) => void;
}

// Props for review mode (existing)
export interface ReviewStepReviewProps {
  transactions: ParsedTransaction[];
  duplicateMatches?: DuplicateMatch[];
  onImport: (
    selectedRowNumbers: number[],
    duplicateActions?: DuplicateAction[],
  ) => void;
  onBack: () => void;
  isLoading?: boolean;
  currency?: string;
  categories?: Array<{ id: number; name: string }>;
  // New grouped UI props
  useGroupedUI?: boolean;
  // Duplicate strategy props
  duplicateStrategy?: DuplicateHandlingStrategy;
  onDuplicateStrategyChange?: (strategy: DuplicateHandlingStrategy) => void;
  // Currency conversion props
  conversions?: CurrencyConversion[];
  onChangeRate?: (
    fromCurrency: string,
    toCurrency: string,
    newRate: number,
  ) => void;
  // Description editing
  onDescriptionChange?: (rowNumber: number, newDescription: string) => void;
}

export type ReviewStepProps = ReviewStepParseProps | ReviewStepReviewProps;

// Type guard to check if props are for parsing mode
function isParseProps(props: ReviewStepProps): props is ReviewStepParseProps {
  return "file" in props && "columnMapping" in props;
}

export function ReviewStep(props: ReviewStepProps) {
  // Extract props based on type
  const transactions = "transactions" in props ? props.transactions : [];
  const duplicateMatches =
    "duplicateMatches" in props ? props.duplicateMatches : undefined;
  const onImport = "onImport" in props ? props.onImport : () => {};
  const onBack = props.onBack;
  const isLoading = "isLoading" in props ? props.isLoading : false;
  const currency = "currency" in props ? props.currency : "VND";
  const categories = "categories" in props ? props.categories : [];
  const useGroupedUI = "useGroupedUI" in props ? props.useGroupedUI : true; // Default to new UI
  const duplicateStrategy =
    "duplicateStrategy" in props
      ? props.duplicateStrategy
      : DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL;
  const onDuplicateStrategyChange =
    "onDuplicateStrategyChange" in props
      ? props.onDuplicateStrategyChange
      : undefined;
  const conversions = "conversions" in props ? props.conversions : undefined;
  const onChangeRate = "onChangeRate" in props ? props.onChangeRate : undefined;
  const onDescriptionChange =
    "onDescriptionChange" in props ? props.onDescriptionChange : undefined;

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [handledDuplicates, setHandledDuplicates] = useState<Set<number>>(
    new Set(),
  );
  const [duplicateActionsMap, setDuplicateActionsMap] = useState<
    Map<number, "merge" | "keep" | "skip">
  >(new Map());
  const [transactionsState, setTransactionsState] = useState<
    ParsedTransaction[]
  >([]);
  const [showChangeRateModal, setShowChangeRateModal] = useState(false);
  const [selectedConversion, setSelectedConversion] =
    useState<CurrencyConversion | null>(null);

  // Initialize transactions state and sync with parent updates
  // Merge changes instead of replacing to preserve local category edits
  useEffect(() => {
    if (transactionsState.length === 0) {
      // Initial load - just set the transactions
      setTransactionsState(transactions);
    } else {
      // Merge updates from parent with local state
      setTransactionsState((prev) => {
        // Create a map of current local state by row number
        const localStateMap = new Map(prev.map((tx) => [tx.rowNumber, tx]));

        // Merge parent updates with local changes
        const merged = transactions.map((parentTx) => {
          const localTx = localStateMap.get(parentTx.rowNumber);
          if (localTx) {
            // Take parent updates but preserve local category changes
            // Only override category if it was changed locally (different from parent)
            const hasLocalCategoryChange =
              localTx.suggestedCategoryId !== parentTx.suggestedCategoryId ||
              localTx.categoryConfidence !== parentTx.categoryConfidence;

            if (hasLocalCategoryChange) {
              // User made local category changes - preserve them
              return {
                ...parentTx,
                suggestedCategoryId: localTx.suggestedCategoryId,
                categoryConfidence: localTx.categoryConfidence,
              };
            } else {
              // No local changes - just use parent data
              return parentTx;
            }
          }
          return parentTx;
        });

        return merged;
      });
    }
  }, [transactions]);

  // Auto-select valid non-duplicate transactions by default
  useEffect(() => {
    const duplicateRowNumbers = new Set(
      duplicateMatches?.map((m) => m.importedTransaction?.rowNumber || 0) || [],
    );

    const validNonDuplicateRows = transactionsState
      .filter((t) => t.isValid && !duplicateRowNumbers.has(t.rowNumber))
      .map((t) => t.rowNumber);

    setSelectedRows(new Set(validNonDuplicateRows));
  }, [transactionsState, duplicateMatches]);

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!dateRangeStart && !dateRangeEnd) {
      return transactionsState;
    }

    const startTime = dateRangeStart
      ? Math.floor(dateRangeStart.getTime() / 1000)
      : 0;
    const endTime = dateRangeEnd
      ? Math.floor(dateRangeEnd.getTime() / 1000)
      : Number.MAX_SAFE_INTEGER;

    return transactionsState.filter((tx) => {
      return tx.date >= startTime && tx.date <= endTime;
    });
  }, [transactionsState, dateRangeStart, dateRangeEnd]);

  // Group transactions by status (for new UI)
  const groups = useMemo(() => {
    const duplicateRowNumbers = new Set(
      duplicateMatches
        ?.filter(
          (m) => !handledDuplicates.has(m.importedTransaction?.rowNumber || 0),
        )
        .map((m) => m.importedTransaction?.rowNumber || 0) || [],
    );

    // Only exclude duplicates from other sections if strategy is REVIEW_EACH or SKIP_ALL
    const shouldExcludeDuplicates =
      duplicateStrategy ===
        DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH ||
      duplicateStrategy ===
        DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL;

    // Note: Do NOT filter by excludedRows here - let each section handle excluded state
    // Otherwise, unchecking items causes them to disappear from their section
    const hasErrors = filteredTransactions.filter((tx) => !tx.isValid);

    const hasDuplicates = filteredTransactions.filter((tx) =>
      duplicateRowNumbers.has(tx.rowNumber),
    );

    const needsCategoryReview = filteredTransactions.filter(
      (tx) =>
        tx.isValid &&
        !excludedRows.has(tx.rowNumber) && // Exclude handled duplicates (skip)
        (!shouldExcludeDuplicates || !duplicateRowNumbers.has(tx.rowNumber)) &&
        (tx.suggestedCategoryId === undefined ||
          isNaN(tx.suggestedCategoryId) ||
          tx.categoryConfidence < 80 ||
          tx.suggestedCategoryId === 0), // Also treat 0 as needing review
    );

    const readyToImport = filteredTransactions.filter(
      (tx) =>
        tx.isValid &&
        !excludedRows.has(tx.rowNumber) && // Exclude handled duplicates (skip)
        (!shouldExcludeDuplicates || !duplicateRowNumbers.has(tx.rowNumber)) &&
        tx.suggestedCategoryId !== undefined &&
        !isNaN(tx.suggestedCategoryId) &&
        tx.suggestedCategoryId !== 0 &&
        tx.categoryConfidence >= 80,
    );

    return {
      hasErrors,
      hasDuplicates,
      needsCategoryReview,
      readyToImport,
    };
  }, [
    filteredTransactions,
    duplicateMatches,
    handledDuplicates,
    duplicateStrategy,
    excludedRows,
  ]);

  // Build duplicate confidence map for table display (old UI)
  const duplicateMap = new Map(
    duplicateMatches?.map((m) => [
      m.importedTransaction?.rowNumber || 0,
      {
        confidence: m.confidence,
        matchReason: m.matchReason,
      },
    ]) || [],
  );

  // Extract validation errors for ErrorSummary (old UI)
  const errorsForSummary = transactionsState
    .filter((t) => t.validationErrors && t.validationErrors.length > 0)
    .map((t) => ({
      rowNumber: t.rowNumber,
      errors: t.validationErrors,
    }));

  const handleToggleRow = (rowNumber: number) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rowNumber)) {
        newSet.delete(rowNumber);
      } else {
        newSet.add(rowNumber);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    const validTransactions = filteredTransactions.filter((t) => t.isValid);
    const allSelected = validTransactions.every((t) =>
      selectedRows.has(t.rowNumber),
    );

    if (allSelected) {
      // Deselect all
      setSelectedRows(new Set());
    } else {
      // Select all valid transactions
      setSelectedRows(new Set(validTransactions.map((t) => t.rowNumber)));
    }
  };

  const handleTransactionUpdate = (
    rowNumber: number,
    updates: Partial<ParsedTransaction>,
  ) => {
    setTransactionsState((prev) =>
      prev.map((tx) =>
        tx.rowNumber === rowNumber ? { ...tx, ...updates } : tx,
      ),
    );
  };

  const handleDuplicateAction = (
    rowNumber: number,
    action: "merge" | "keep" | "skip",
  ) => {
    // Mark this duplicate as handled
    setHandledDuplicates((prev) => new Set(prev).add(rowNumber));

    // Store the action for this duplicate
    setDuplicateActionsMap((prev) => new Map(prev).set(rowNumber, action));

    // If action is "skip", also add to excluded rows
    if (action === "skip") {
      setExcludedRows((prev) => new Set(prev).add(rowNumber));
    }
  };

  const handleToggleExclude = (rowNumber: number) => {
    setExcludedRows((prev) => {
      const newExcluded = new Set(prev);
      if (newExcluded.has(rowNumber)) {
        newExcluded.delete(rowNumber);
      } else {
        newExcluded.add(rowNumber);
      }
      return newExcluded;
    });
  };

  const handleCategoryChange = (rowNumber: number, categoryId: number) => {
    setTransactionsState((prev) =>
      prev.map((tx) => {
        if (tx.rowNumber === rowNumber) {
          // Update category and set confidence to 100
          return {
            ...tx,
            suggestedCategoryId: categoryId,
            categoryConfidence: 100, // Manual selection = 100% confidence
          };
        }
        return tx;
      }),
    );
  };

  const handleSkipError = (rowNumber: number) => {
    setExcludedRows((prev) => new Set(prev).add(rowNumber));
  };

  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    setDateRangeStart(start);
    setDateRangeEnd(end);
  };

  const handleOpenChangeRateModal = (
    fromCurrency: string,
    toCurrency: string,
  ) => {
    const conversion = conversions?.find(
      (c) => c.fromCurrency === fromCurrency && c.toCurrency === toCurrency,
    );
    if (conversion) {
      setSelectedConversion(conversion);
      setShowChangeRateModal(true);
    }
  };

  const handleConfirmRateChange = (newRate: number) => {
    if (selectedConversion && onChangeRate) {
      onChangeRate(
        selectedConversion.fromCurrency,
        selectedConversion.toCurrency,
        newRate,
      );
    }
    setShowChangeRateModal(false);
    setSelectedConversion(null);
  };

  const handleCancelRateChange = () => {
    setShowChangeRateModal(false);
    setSelectedConversion(null);
  };

  const handleImport = () => {
    // Build duplicate actions array if any duplicates were handled manually
    const duplicateActions =
      duplicateStrategy ===
        DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH &&
      duplicateActionsMap.size > 0
        ? Array.from(duplicateActionsMap.entries()).map(
            ([rowNumber, action]): DuplicateAction => {
              // Find the matched transaction ID for this duplicate
              const match = duplicateMatches?.find(
                (m) => m.importedTransaction?.rowNumber === rowNumber,
              );

              // Map action string to DuplicateActionType enum
              let actionType: DuplicateActionType;
              switch (action) {
                case "merge":
                  actionType = DuplicateActionType.DUPLICATE_ACTION_MERGE;
                  break;
                case "keep":
                  actionType = DuplicateActionType.DUPLICATE_ACTION_KEEP_BOTH;
                  break;
                case "skip":
                  actionType = DuplicateActionType.DUPLICATE_ACTION_SKIP;
                  break;
                default:
                  actionType = DuplicateActionType.DUPLICATE_ACTION_UNSPECIFIED;
              }

              return {
                importedRowNumber: rowNumber,
                existingTransactionId: match?.existingTransaction?.id || 0,
                action: actionType,
              };
            },
          )
        : undefined;

    if (useGroupedUI) {
      // New UI: exclude rows that are in excludedRows set
      const importableRows = filteredTransactions
        .filter((t) => t.isValid && !excludedRows.has(t.rowNumber))
        .map((t) => t.rowNumber);
      onImport(importableRows, duplicateActions);
    } else {
      // Old UI: use selectedRows
      onImport(Array.from(selectedRows), duplicateActions);
    }
  };

  // Calculate importable count
  const importableCount = useGroupedUI
    ? groups.readyToImport.filter((tx) => !excludedRows.has(tx.rowNumber))
        .length
    : selectedRows.size;

  // Blocked count includes errors and unhandled duplicates
  const blockedCount = groups.hasErrors.length + groups.hasDuplicates.length;

  // Render new grouped UI
  if (useGroupedUI) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header Summary */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-dark-text mb-2">
            Review Import
          </h2>
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
            {transactionsState.length} transaction
            {transactionsState.length !== 1 ? "s" : ""} from statement
          </p>
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter
          startDate={dateRangeStart}
          endDate={dateRangeEnd}
          onChange={handleDateRangeChange}
          transactionCount={transactionsState.length}
        />

        {/* Duplicate Strategy Selector */}
        {duplicateMatches &&
          duplicateMatches.length > 0 &&
          onDuplicateStrategyChange && (
            <DuplicateStrategySelector
              duplicateCount={duplicateMatches.length}
              selectedStrategy={
                duplicateStrategy ||
                DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL
              }
              onStrategyChange={onDuplicateStrategyChange}
            />
          )}

        {/* Currency Conversion Section */}
        {conversions && conversions.length > 0 && (
          <CurrencyConversionSection
            conversions={conversions}
            onChangeRate={handleOpenChangeRateModal}
          />
        )}

        {/* Grouped Sections */}
        <div className="space-y-3">
          {/* Error Section */}
          {groups.hasErrors.length > 0 && (
            <ErrorSection
              transactions={groups.hasErrors}
              onTransactionUpdate={handleTransactionUpdate}
              onSkip={handleSkipError}
              currency={currency}
            />
          )}

          {/* Duplicate Section - Only show when strategy is REVIEW_EACH */}
          {groups.hasDuplicates.length > 0 &&
            duplicateMatches &&
            duplicateStrategy ===
              DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH && (
              <DuplicateSection
                matches={duplicateMatches.filter(
                  (m) =>
                    !handledDuplicates.has(
                      m.importedTransaction?.rowNumber || 0,
                    ),
                )}
                onDuplicateHandled={handleDuplicateAction}
                currency={currency}
              />
            )}

          {/* Category Review Section */}
          {groups.needsCategoryReview.length > 0 && (
            <CategoryReviewSection
              transactions={groups.needsCategoryReview}
              onCategoryChange={handleCategoryChange}
              categories={categories}
              currency={currency}
            />
          )}

          {/* Ready to Import Section */}
          {groups.readyToImport.length > 0 && (
            <ReadyToImportSection
              transactions={groups.readyToImport}
              excludedRows={excludedRows}
              onToggleExclude={handleToggleExclude}
              categories={categories}
              currency={currency}
              onCategoryChange={handleCategoryChange}
              onDescriptionChange={onDescriptionChange}
            />
          )}
        </div>

        {/* Summary Stats */}
        <div className="p-4 bg-neutral-100 dark:bg-dark-surface-hover rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-neutral-600 dark:text-dark-text-secondary text-sm mb-1">
                Ready to import
              </p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                {importableCount}
              </p>
            </div>
            <div>
              <p className="text-neutral-600 dark:text-dark-text-secondary text-sm mb-1">
                Need attention
              </p>
              <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                {blockedCount}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onBack} disabled={isLoading}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={handleImport}
            disabled={importableCount === 0 || isLoading}
            loading={isLoading}
          >
            {isLoading
              ? "Importing..."
              : `Import ${importableCount} Transaction${importableCount !== 1 ? "s" : ""}`}
          </Button>
        </div>

        {/* Change Rate Modal */}
        {showChangeRateModal && selectedConversion && (
          <ChangeRateModal
            isOpen={showChangeRateModal}
            onClose={handleCancelRateChange}
            conversion={selectedConversion}
            onConfirm={handleConfirmRateChange}
          />
        )}
      </div>
    );
  }

  // Render old UI (fallback)
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Instructions */}
      <div className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary">
        <p className="mb-2">
          Review the parsed transactions below. Select the rows you want to
          import.
        </p>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-dark-text-tertiary">
          Rows with errors cannot be imported. Duplicate transactions are
          detected automatically.
        </p>
      </div>

      {/* Error Summary */}
      {errorsForSummary.length > 0 && (
        <ErrorSummary errors={errorsForSummary} />
      )}

      {/* Transaction Review Table */}
      <TransactionReviewTable
        transactions={filteredTransactions}
        selectedRows={selectedRows}
        onToggleRow={handleToggleRow}
        onToggleAll={handleToggleAll}
        duplicateMatches={duplicateMap}
        currency={currency}
        onDescriptionChange={onDescriptionChange}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={selectedRows.size === 0 || isLoading}
          loading={isLoading}
        >
          Import{" "}
          {selectedRows.size > 0
            ? `${selectedRows.size} Transaction${selectedRows.size !== 1 ? "s" : ""}`
            : "Transactions"}
        </Button>
      </div>
    </div>
  );
}
