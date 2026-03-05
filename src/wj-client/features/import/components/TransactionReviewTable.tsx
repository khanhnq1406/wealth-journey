"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrencyImport } from "@/utils/currency-formatter";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";
import { TransactionType } from "@/gen/protobuf/v1/transaction";

export interface TransactionReviewTableProps {
  transactions: ParsedTransaction[];
  selectedRows: Set<number>;
  onToggleRow: (rowNumber: number) => void;
  onToggleAll: () => void;
  duplicateMatches?: Map<number, { confidence: number; matchReason: string }>;
  currency?: string;
  onDescriptionChange?: (rowNumber: number, newDescription: string) => void;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-5 h-5", className)} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-5 h-5", className)} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function TransactionReviewTable({
  transactions,
  selectedRows,
  onToggleRow,
  onToggleAll,
  duplicateMatches,
  currency = "VND",
  onDescriptionChange,
}: TransactionReviewTableProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const validTransactions = transactions.filter((t) => t.isValid);
  const allSelected = validTransactions.every((t) => selectedRows.has(t.rowNumber));
  const someSelected = validTransactions.some((t) => selectedRows.has(t.rowNumber));
  const selectedCount = selectedRows.size;

  const handleStartEdit = (rowNumber: number, currentDescription: string) => {
    setEditingRow(rowNumber);
    setEditValue(currentDescription);
  };

  const handleSaveEdit = (rowNumber: number) => {
    if (onDescriptionChange && editValue.trim()) {
      onDescriptionChange(rowNumber, editValue.trim());
    }
    setEditingRow(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditValue("");
  };

  const toggleExpanded = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp * 1000));
  };

  const getStatusBadge = (transaction: ParsedTransaction) => {
    if (!transaction.isValid) {
      return (
        <span className="inline-block px-2 py-1 rounded text-xs font-semibold uppercase bg-red-600 text-white dark:bg-red-700">
          Error
        </span>
      );
    }

    const duplicate = duplicateMatches?.get(transaction.rowNumber);
    if (duplicate) {
      return (
        <span className="inline-block px-2 py-1 rounded text-xs font-semibold uppercase bg-yellow-600 text-white dark:bg-yellow-700">
          Duplicate {duplicate.confidence}%
        </span>
      );
    }

    return (
      <span className="inline-block px-2 py-1 rounded text-xs font-semibold uppercase bg-green-600 text-white dark:bg-green-700">
        Valid
      </span>
    );
  };

  const getAmountColor = (type: TransactionType) => {
    return type === TransactionType.TRANSACTION_TYPE_INCOME
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden sm:block border border-neutral-200 dark:border-dark-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-100 dark:bg-dark-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={onToggleAll}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      allSelected
                        ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                        : someSelected
                          ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                          : "border-neutral-400 dark:border-neutral-500 hover:border-primary-500",
                    )}
                    aria-label="Toggle all rows"
                  >
                    {allSelected ? (
                      <CheckIcon className="text-white" />
                    ) : someSelected ? (
                      <MinusIcon className="text-white" />
                    ) : null}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-dark-surface divide-y divide-neutral-200 dark:divide-dark-border">
              {transactions.map((transaction) => {
                const isSelected = selectedRows.has(transaction.rowNumber);
                const isDisabled = !transaction.isValid;

                return (
                  <tr
                    key={transaction.rowNumber}
                    className={cn(
                      "hover:bg-neutral-50 dark:hover:bg-dark-surface-hover transition-colors",
                      isDisabled && "opacity-50",
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggleRow(transaction.rowNumber)}
                        disabled={isDisabled}
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                            : "border-neutral-400 dark:border-neutral-500 hover:border-primary-500",
                          isDisabled && "cursor-not-allowed opacity-50",
                        )}
                        aria-label={`Toggle row ${transaction.rowNumber}`}
                      >
                        {isSelected && <CheckIcon className="text-white" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 dark:text-dark-text">
                      {transaction.rowNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 dark:text-dark-text">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 dark:text-dark-text max-w-[300px]">
                      {editingRow === transaction.rowNumber ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(transaction.rowNumber);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-surface dark:border-dark-border dark:text-dark-text"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(transaction.rowNumber)}
                            className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                            title="Save"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{transaction.description}</span>
                            {onDescriptionChange && (
                              <button
                                onClick={() => handleStartEdit(transaction.rowNumber, transaction.description)}
                                className="flex-shrink-0 text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs"
                                title="Edit description"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                          {transaction.originalDescription &&
                            transaction.originalDescription !== transaction.description && (
                              <button
                                onClick={() => toggleExpanded(transaction.rowNumber)}
                                className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 text-left"
                              >
                                {expandedRows.has(transaction.rowNumber) ? "▼" : "▶"} Original
                              </button>
                            )}
                          {expandedRows.has(transaction.rowNumber) &&
                            transaction.originalDescription && (
                              <div className="text-xs text-neutral-600 dark:text-neutral-400 italic bg-neutral-50 dark:bg-dark-surface-hover p-2 rounded">
                                {transaction.originalDescription}
                              </div>
                            )}
                        </div>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-sm text-right font-semibold",
                        getAmountColor(transaction.type),
                      )}
                    >
                      {transaction.type === TransactionType.TRANSACTION_TYPE_INCOME
                        ? "+"
                        : "-"}
                      {formatCurrencyImport(
                        transaction.amount?.amount || 0,
                        transaction.amount?.currency || currency,
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(transaction)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-dark-surface-hover rounded-lg">
          <button
            onClick={onToggleAll}
            className="flex items-center gap-2 min-h-[44px]"
          >
            <div
              className={cn(
                "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                allSelected
                  ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                  : someSelected
                    ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                    : "border-neutral-400 dark:border-neutral-500",
              )}
            >
              {allSelected ? (
                <CheckIcon className="text-white" />
              ) : someSelected ? (
                <MinusIcon className="text-white" />
              ) : null}
            </div>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Select All
            </span>
          </button>
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {selectedCount} selected
          </span>
        </div>

        {transactions.map((transaction) => {
          const isSelected = selectedRows.has(transaction.rowNumber);
          const isDisabled = !transaction.isValid;

          return (
            <div
              key={transaction.rowNumber}
              className={cn(
                "border border-neutral-200 dark:border-dark-border rounded-lg overflow-hidden",
                isDisabled && "opacity-50",
              )}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => onToggleRow(transaction.rowNumber)}
                    disabled={isDisabled}
                    className="flex items-start gap-2 min-h-[44px] flex-1"
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                        isSelected
                          ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                          : "border-neutral-400 dark:border-neutral-500",
                        isDisabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {isSelected && <CheckIcon className="text-white" />}
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm text-neutral-600 dark:text-neutral-400">
                        Row {transaction.rowNumber}
                      </div>
                      {editingRow === transaction.rowNumber ? (
                        <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(transaction.rowNumber);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-surface dark:border-dark-border dark:text-dark-text"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(transaction.rowNumber);
                              }}
                              className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              className="flex-1 px-3 py-1 bg-neutral-300 dark:bg-neutral-700 text-neutral-900 dark:text-dark-text rounded hover:bg-neutral-400 dark:hover:bg-neutral-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="text-sm text-neutral-900 dark:text-dark-text flex-1">
                              {transaction.description}
                            </div>
                            {onDescriptionChange && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(transaction.rowNumber, transaction.description);
                                }}
                                className="flex-shrink-0 p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                                title="Edit description"
                              >
                                ✎
                              </button>
                            )}
                          </div>
                          {transaction.originalDescription &&
                            transaction.originalDescription !== transaction.description && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(transaction.rowNumber);
                                  }}
                                  className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
                                >
                                  {expandedRows.has(transaction.rowNumber) ? "▼" : "▶"} Show original description
                                </button>
                                {expandedRows.has(transaction.rowNumber) && (
                                  <div className="text-xs text-neutral-600 dark:text-neutral-400 italic bg-neutral-50 dark:bg-dark-surface-hover p-2 rounded">
                                    {transaction.originalDescription}
                                  </div>
                                )}
                              </>
                            )}
                        </div>
                      )}
                    </div>
                  </button>
                  {getStatusBadge(transaction)}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-dark-border">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {formatDate(transaction.date)}
                  </span>
                  <span
                    className={cn(
                      "text-base font-semibold",
                      getAmountColor(transaction.type),
                    )}
                  >
                    {transaction.type === TransactionType.TRANSACTION_TYPE_INCOME
                      ? "+"
                      : "-"}
                    {formatCurrencyImport(
                      transaction.amount?.amount || 0,
                      transaction.amount?.currency || currency,
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Footer */}
      <div className="bg-neutral-100 dark:bg-dark-surface-hover rounded-lg p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-dark-text">
              {transactions.length}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 uppercase">
              Total Rows
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {transactions.filter((t) => t.isValid).length}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 uppercase">
              Valid
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {transactions.filter((t) => !t.isValid).length}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 uppercase">
              Errors
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {selectedCount}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400 uppercase">
              Selected
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
