"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { formatCurrency } from "@/utils/currency-formatter";
import { ImportSummary } from "@/gen/protobuf/v1/import";
import { useMutationUndoImport } from "@/utils/generated/hooks";
import { useState } from "react";

export interface ImportSuccessProps {
  summary: ImportSummary;
  importBatchId: string;
  onDone: () => void;
  onUndoSuccess?: () => void;
}

export function ImportSuccess({
  summary,
  importBatchId,
  onDone,
  onUndoSuccess,
}: ImportSuccessProps) {
  const t = useTranslations("import.success");
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const undoMutation = useMutationUndoImport({
    onSuccess: () => {
      onUndoSuccess?.();
    },
    onError: (error: any) => {
      alert(`Failed to undo import: ${error.message || "Unknown error"}`);
    },
  });

  const handleUndoClick = () => {
    setShowUndoConfirm(true);
  };

  const handleUndoConfirm = () => {
    undoMutation.mutate({ importId: importBatchId });
  };

  const handleUndoCancel = () => {
    setShowUndoConfirm(false);
  };

  // Extract currency from summary money objects
  const currency =
    summary.totalIncome?.currency || summary.totalExpenses?.currency || "VND";

  // formatCurrency already handles conversion from smallest unit to display unit
  const totalIncome = summary.totalIncome?.amount || 0;
  const totalExpenses = summary.totalExpenses?.amount || 0;
  const netChange = summary.netChange?.amount || 0;
  const newBalance = summary.newWalletBalance?.amount || 0;

  if (showUndoConfirm) {
    return (
      <div className="space-y-6">
        {/* Warning Icon */}
        <div className="flex flex-col items-center text-center">
 <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <svg
 className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
 <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2">
            {t("undoTitle")}
          </h2>
 <p className="text-sm sm:text-base text-neutral-600">
            {t("undoDesc", { count: summary.totalImported })}
          </p>
        </div>

        {/* Confirmation Message */}
 <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
 <p className="text-sm text-red-700 font-medium">
            {t("undoCannotReverse")}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={handleUndoCancel}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2"
            disabled={undoMutation.isPending}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleUndoConfirm}
            className="flex-1 min-h-[48px] flex items-center justify-center gap-2 !bg-red-600 hover:!bg-red-700"
            loading={undoMutation.isPending}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
            {t("confirmUndo")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Celebration Header */}
      <div className="flex flex-col items-center text-center">
 <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-success-100 to-success-200 flex items-center justify-center mb-4 animate-in zoom-in duration-500 shadow-lg">
          <svg
 className="w-12 h-12 sm:w-14 sm:h-14 text-success-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
 <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {t("title")}
        </h2>
 <p className="text-sm sm:text-base text-neutral-600">
          {summary.totalImported !== 1 ? t("transactionsImportedPlural", { count: summary.totalImported || 0 }) : t("transactionsImported", { count: summary.totalImported || 0 })}{summary.totalSkipped > 0 && ` ${t("skipped", { count: summary.totalSkipped })}`}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
 <div className="p-4 sm:p-5 bg-success-50 rounded-xl border border-success-200 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg
 className="w-4 h-4 text-success-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
 <p className="text-xs font-medium text-success-600">
              {t("income")}
            </p>
          </div>
 <p className="text-xl sm:text-2xl font-bold text-success-700">
            {formatCurrency(totalIncome, currency)}
          </p>
        </div>
 <div className="p-4 sm:p-5 bg-danger-50 rounded-xl border border-danger-200 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg
 className="w-4 h-4 text-danger-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
 <p className="text-xs font-medium text-danger-600">
              {t("expenses")}
            </p>
          </div>
 <p className="text-xl sm:text-2xl font-bold text-danger-700">
            {formatCurrency(Math.abs(totalExpenses), currency)}
          </p>
        </div>
 <div className="p-4 sm:p-5 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg
 className="w-4 h-4 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
 <p className="text-xs font-medium text-neutral-600">
              {t("netChange")}
            </p>
          </div>
          <p
            className={`text-xl sm:text-2xl font-bold ${
              netChange >= 0
 ? "text-success-700"
 : "text-danger-700"
            }`}
          >
            {netChange >= 0 ? "+" : ""}
            {formatCurrency(netChange, currency)}
          </p>
        </div>
 <div className="p-4 sm:p-5 bg-neutral-50 rounded-xl border border-neutral-200 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <svg
 className="w-4 h-4 text-neutral-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
              />
            </svg>
 <p className="text-xs font-medium text-neutral-600">
              {t("newBalance")}
            </p>
          </div>
 <p className="text-xl sm:text-2xl font-bold text-neutral-900">
            {formatCurrency(newBalance, currency)}
          </p>
        </div>
      </div>

      {/* Duplicate Info */}
      {(summary.duplicatesMerged > 0 || summary.duplicatesSkipped > 0) && (
 <div className="p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg
 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
 <p className="text-sm font-medium text-blue-800">
                {summary.duplicatesSkipped > 0 && (summary.duplicatesSkipped !== 1 ? t("duplicatesSkippedPlural", { count: summary.duplicatesSkipped }) : t("duplicatesSkipped", { count: summary.duplicatesSkipped }))}
                {summary.duplicatesMerged > 0 && summary.duplicatesSkipped > 0 && ", "}
                {summary.duplicatesMerged > 0 && (summary.duplicatesMerged !== 1 ? t("duplicatesMergedPlural", { count: summary.duplicatesMerged }) : t("duplicatesMerged", { count: summary.duplicatesMerged }))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Undo Notice */}
 <div className="p-4 sm:p-5 bg-warning-50 border border-warning-200 rounded-xl">
        <div className="flex items-start gap-3">
          <svg
 className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
 <p className="text-sm font-medium text-warning-800">
              {t("undoNotice")}
            </p>
 <p className="text-xs text-warning-700 mt-1">
              {t("undoNoticeDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={handleUndoClick}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
          {t("undoImport")}
        </Button>
        <Button
          variant="primary"
          onClick={onDone}
          className="flex-1 min-h-[48px] flex items-center justify-center gap-2"
        >
          {t("done")}
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </Button>
      </div>
    </div>
  );
}
