"use client";

import { useState, useEffect } from "react";
import { ReviewStep } from "./ReviewStep";
import { ColumnMapping } from "./ColumnMappingStep";
import { ParsedTransaction, DuplicateHandlingStrategy, ImportSummary, DuplicateMatch, CurrencyConversion, CurrencyInfo, DuplicateAction } from "@/gen/protobuf/v1/import";
import { Button } from "@/components/Button";
import { useMutationExecuteImport, useMutationParseStatement, useMutationDetectDuplicates, useMutationConvertCurrency, useQueryListCategories } from "@/utils/generated/hooks";
import { DuplicateReviewModal } from "./DuplicateReviewModal";

export interface ReviewStepWrapperProps {
  file: File;
  fileId: string;
  walletId: number;
  columnMapping: ColumnMapping | null; // Made optional for Excel/PDF
  bankTemplateId?: string | null;
  onImportSuccess: (summary: ImportSummary, importBatchId: string) => void;
  onBack: () => void;
  onError: (error: any) => void;
}

/**
 * Wrapper component that handles file parsing before showing the review step
 * Uses backend API for parsing (supports CSV, Excel, PDF)
 */
export function ReviewStepWrapper({
  file,
  fileId,
  walletId,
  columnMapping,
  bankTemplateId,
  onImportSuccess,
  onBack,
  onError,
}: ReviewStepWrapperProps) {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("VND");
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateHandlingStrategy>(
    DuplicateHandlingStrategy.DUPLICATE_STRATEGY_SKIP_ALL
  );
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [duplicateActions, setDuplicateActions] = useState<DuplicateAction[]>([]);
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [conversions, setConversions] = useState<CurrencyConversion[]>([]);
  const [descriptionEdits, setDescriptionEdits] = useState<Map<number, string>>(new Map());

  // Fetch user's categories
  const categoriesQuery = useQueryListCategories(
    { pagination: { page: 1, pageSize: 1000, orderBy: "", order: "" } },
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Parse statement mutation (backend API)
  const parseStatementMutation = useMutationParseStatement({
    onSuccess: (response) => {
      if (response.success && response.transactions) {
        setTransactions(response.transactions);
        // Extract currency from first transaction if available
        if (response.transactions.length > 0 && response.transactions[0].amount?.currency) {
          setCurrency(response.transactions[0].amount.currency);
        }
        // Store currency info for conversion check
        if (response.currencyInfo) {
          setCurrencyInfo(response.currencyInfo);
          // If conversion is needed, trigger conversion API
          if (response.currencyInfo.needsConversion) {
            convertCurrencyMutation.mutate({
              walletId,
              transactions: response.transactions,
              manualRates: {},
            });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } else {
        setError(response.message || "Failed to parse file");
        setLoading(false);
      }
    },
    onError: (err: any) => {
      setError(err.message || "Failed to parse file");
      setLoading(false);
    },
  });

  // Currency conversion mutation
  const convertCurrencyMutation = useMutationConvertCurrency({
    onSuccess: (response) => {
      if (response.success && response.convertedTransactions) {
        // Update transactions with converted amounts
        setTransactions(response.convertedTransactions);
        // Store conversion information
        if (response.conversions) {
          setConversions(response.conversions);
        }
        setLoading(false);
      } else {
        setError(response.message || "Failed to convert currencies");
        setLoading(false);
      }
    },
    onError: (err: any) => {
      console.error("Failed to convert currencies:", err);
      // Continue without conversion (use original transactions)
      setLoading(false);
    },
  });

  // Duplicate detection mutation
  const detectDuplicatesMutation = useMutationDetectDuplicates({
    onSuccess: (response) => {
      if (response.success && response.matches) {
        setDuplicateMatches(response.matches);
      }
    },
    onError: (err: any) => {
      console.error("Failed to detect duplicates:", err);
      // Continue without duplicate detection
      setDuplicateMatches([]);
    },
  });

  // Import execution mutation
  const executeImportMutation = useMutationExecuteImport({
    onSuccess: (response) => {
      if (response.success && response.summary) {
        onImportSuccess(response.summary, response.importBatchId);
      } else {
        onError(new Error(response.message || "Import failed"));
      }
    },
    onError: (err: any) => {
      onError(err);
    },
  });

  // Parse the file when component mounts using backend API
  useEffect(() => {
    parseFileViaBackend();
  }, [fileId, columnMapping, bankTemplateId]);

  // Detect duplicates when transactions are loaded
  useEffect(() => {
    if (transactions.length > 0 && walletId) {
      detectDuplicatesMutation.mutate({
        transactions,
        walletId,
      });
    }
  }, [transactions, walletId]);

  const parseFileViaBackend = () => {
    // Build custom mapping if provided (for CSV files)
    let customMapping = undefined;
    if (columnMapping) {
      customMapping = {
        dateColumn: columnMapping.dateColumn.toString(),
        amountColumn: columnMapping.amountColumn.toString(),
        descriptionColumn: columnMapping.descriptionColumn.toString(),
        typeColumn: columnMapping.typeColumn !== undefined ? columnMapping.typeColumn.toString() : "",
        categoryColumn: columnMapping.categoryColumn !== undefined ? columnMapping.categoryColumn.toString() : "",
        referenceColumn: columnMapping.referenceColumn !== undefined ? columnMapping.referenceColumn.toString() : "",
        dateFormat: columnMapping.dateFormat || "",
        currency: columnMapping.currency || "VND",
      };
      setCurrency(columnMapping.currency || "VND");
    }

    // Call backend parse API
    parseStatementMutation.mutate({
      fileId,
      bankTemplateId: bankTemplateId || "",
      customMapping,
      sheetName: "",
      useOcr: false,
    });
  };

  const handleImport = (
    selectedRowNumbers: number[],
    inlineDuplicateActions?: DuplicateAction[],
    strategy?: DuplicateHandlingStrategy
  ) => {
    const strategyToUse = strategy !== undefined ? strategy : duplicateStrategy;

    // If inline duplicate actions are provided, use them
    // Otherwise, check if we need to show duplicate review modal
    if (strategyToUse === DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH &&
        duplicateMatches.length > 0 &&
        !inlineDuplicateActions &&
        duplicateActions.length === 0) {
      // Show modal for user to review duplicates (legacy flow)
      setShowDuplicateReview(true);
      return;
    }

    // Filter transactions to only include selected rows
    const selectedTransactions = transactions.filter((t) =>
      selectedRowNumbers.includes(t.rowNumber)
    );

    // Determine excluded row numbers (all rows minus selected)
    const allRowNumbers = transactions.map((t) => t.rowNumber);
    const excludedRowNumbers = allRowNumbers.filter(
      (num) => !selectedRowNumbers.includes(num)
    );

    // Use inline actions if provided, otherwise use modal actions
    const actionsToUse = inlineDuplicateActions || duplicateActions;

    // Execute import with duplicate actions if REVIEW_EACH strategy
    executeImportMutation.mutate({
      fileId,
      walletId,
      transactions: selectedTransactions,
      strategy: strategyToUse,
      excludedRowNumbers,
      dateFilterStart: 0,
      dateFilterEnd: 0,
      duplicateActions: strategyToUse === DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH
        ? actionsToUse
        : [],
    });
  };

  const handleDuplicateReviewComplete = (actions: DuplicateAction[]) => {
    // Validate: number of actions should match number of duplicates
    if (actions.length !== duplicateMatches.length) {
      console.error(`Review incomplete: ${actions.length} actions for ${duplicateMatches.length} duplicates`);
      // Use alert since toast system may not be available
      alert(`Review incomplete. Please review all ${duplicateMatches.length} duplicates.`);
      return;
    }

    setDuplicateActions(actions);
    setShowDuplicateReview(false);
    // Trigger import with the collected actions
    const allRowNumbers = transactions.map((t) => t.rowNumber);
    handleImport(allRowNumbers, actions, DuplicateHandlingStrategy.DUPLICATE_STRATEGY_REVIEW_EACH);
  };

  const handleDuplicateReviewCancel = () => {
    setShowDuplicateReview(false);
  };

  const handleChangeRate = (fromCurrency: string, toCurrency: string, newRate: number) => {
    // Re-convert with manual rate
    const manualRates = {
      [fromCurrency]: {
        fromCurrency,
        toCurrency,
        exchangeRate: newRate,
        rateDate: Math.floor(Date.now() / 1000),
      },
    };

    setLoading(true);
    convertCurrencyMutation.mutate({
      walletId,
      transactions,
      manualRates,
    });
  };

  const handleDescriptionChange = (rowNumber: number, newDescription: string) => {
    const newEdits = new Map(descriptionEdits);
    newEdits.set(rowNumber, newDescription);
    setDescriptionEdits(newEdits);

    // Update the transaction in the transactions array
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.rowNumber === rowNumber ? { ...tx, description: newDescription } : tx
      )
    );
  };

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-neutral-600 dark:text-dark-text-secondary">
            Parsing file...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  // Transform categories for ReviewStep
  const categories = categoriesQuery.data?.categories?.map((cat) => ({
    id: cat.id,
    name: cat.name,
  })) || [];

  return (
    <>
      <ReviewStep
        transactions={transactions}
        onImport={(selectedRows, duplicateActions) => handleImport(selectedRows, duplicateActions)}
        onBack={onBack}
        currency={currency}
        isLoading={executeImportMutation.isPending}
        useGroupedUI={true}
        categories={categories}
        duplicateMatches={duplicateMatches}
        duplicateStrategy={duplicateStrategy}
        onDuplicateStrategyChange={setDuplicateStrategy}
        conversions={conversions}
        onChangeRate={handleChangeRate}
        onDescriptionChange={handleDescriptionChange}
      />

      {/* Duplicate Review Modal */}
      {showDuplicateReview && (
        <DuplicateReviewModal
          matches={duplicateMatches}
          onComplete={handleDuplicateReviewComplete}
          onCancel={handleDuplicateReviewCancel}
          currency={currency}
        />
      )}
    </>
  );
}
