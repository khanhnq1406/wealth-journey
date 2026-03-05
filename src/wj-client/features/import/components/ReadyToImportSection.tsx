"use client";

import React, { useState, useMemo } from "react";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon, CheckIcon, MinusIcon } from "@/components/icons";
import { formatCurrencyImport } from "@/utils/currency-formatter";
import { Select, SelectOption } from "@/components/select/Select";
import { FormSelect } from "@/components/forms/FormSelect";

export interface ReadyToImportSectionProps {
  transactions: ParsedTransaction[];
  excludedRows: Set<number>;
  onToggleExclude: (rowNumber: number) => void;
  categories?: Array<{ id: number; name: string }>;
  currency?: string;
  onCategoryChange?: (rowNumber: number, categoryId: number) => void;
  onDescriptionChange?: (rowNumber: number, newDescription: string) => void;
}

export const ReadyToImportSection = React.memo(function ReadyToImportSection({
  transactions,
  excludedRows,
  onToggleExclude,
  categories = [],
  currency = "VND",
  onCategoryChange,
  onDescriptionChange,
}: ReadyToImportSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [expandedOriginal, setExpandedOriginal] = useState<Set<number>>(new Set());

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

  const toggleOriginal = (rowNumber: number) => {
    const newExpanded = new Set(expandedOriginal);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedOriginal(newExpanded);
  };

  // Memoize category options
  const categoryOptions = useMemo<SelectOption<string>[]>(() => {
    return categories.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
    }));
  }, [categories]);

  if (transactions.length === 0) {
    return null;
  }

  const selectedCount = transactions.filter(
    (tx) => !excludedRows.has(tx.rowNumber),
  ).length;

  const allSelected = selectedCount === transactions.length;
  const someSelected = selectedCount > 0 && selectedCount < transactions.length;

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all
      transactions.forEach((tx) => {
        if (!excludedRows.has(tx.rowNumber)) {
          onToggleExclude(tx.rowNumber);
        }
      });
    } else {
      // Select all
      transactions.forEach((tx) => {
        if (excludedRows.has(tx.rowNumber)) {
          onToggleExclude(tx.rowNumber);
        }
      });
    }
  };

  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || `Category ${categoryId}`;
  };

  return (
    <div className="border border-success-300 dark:border-success-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-success-50 dark:bg-success-950 hover:bg-success-100 dark:hover:bg-success-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-success-600 dark:bg-success-700 flex items-center justify-center">
            <CheckIcon size="sm" className="text-white" decorative />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-base text-success-700 dark:text-success-300">
              {selectedCount} Ready to Import
            </h3>
            <p className="text-sm text-success-600 dark:text-success-400">
              High confidence, auto-categorized
            </p>
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
            "transition-transform text-success-600 dark:text-success-400",
            expanded && "rotate-180",
          )}
          decorative
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-3 bg-white dark:bg-dark-surface">
          {/* Select All */}
          <div className="flex items-center justify-between pb-2 border-b border-success-200 dark:border-success-800">
            <div
              className="flex items-center gap-2 cursor-pointer min-h-[44px]"
              onClick={handleSelectAll}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                  allSelected
                    ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                    : someSelected
                      ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                      : "border-neutral-400 dark:border-neutral-500 hover:border-primary-500",
                )}
                role="checkbox"
                aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
                aria-label="Toggle all rows"
              >
                {allSelected ? (
                  <CheckIcon size="sm" className="text-white" decorative />
                ) : someSelected ? (
                  <MinusIcon size="sm" className="text-white" decorative />
                ) : null}
              </div>
              <span className="text-sm font-medium text-neutral-900 dark:text-dark-text">
                Select All ({selectedCount} of {transactions.length})
              </span>
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.map((tx) => {
              const isChecked = !excludedRows.has(tx.rowNumber);

              return (
                <div
                  key={tx.rowNumber}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    isChecked
                      ? "bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border"
                      : "bg-neutral-100 dark:bg-dark-surface-hover opacity-60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleExclude(tx.rowNumber)}
                    className={cn(
                      "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer",
                      isChecked
                        ? "bg-primary-600 border-primary-600 dark:bg-primary-700 dark:border-primary-700"
                        : "border-neutral-400 dark:border-neutral-500",
                    )}
                    aria-label={`Toggle row ${tx.rowNumber}`}
                  >
                    {isChecked && (
                      <CheckIcon size="sm" className="text-white" decorative />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-2">
                        {editingRow === tx.rowNumber ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(tx.rowNumber);
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-surface dark:border-dark-border dark:text-dark-text"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit(tx.rowNumber);
                                }}
                                className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="flex-1 px-2 py-1 text-xs bg-neutral-300 dark:bg-neutral-700 text-neutral-900 dark:text-dark-text rounded hover:bg-neutral-400 dark:hover:bg-neutral-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-medium text-neutral-900 dark:text-dark-text truncate">
                                {tx.description}
                              </p>
                              {onDescriptionChange && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(tx.rowNumber, tx.description);
                                  }}
                                  className="flex-shrink-0 text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs"
                                  title="Edit description"
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                            {tx.originalDescription &&
                              tx.originalDescription !== tx.description && (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleOriginal(tx.rowNumber);
                                    }}
                                    className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
                                  >
                                    {expandedOriginal.has(tx.rowNumber) ? "▼" : "▶"} Original
                                  </button>
                                  {expandedOriginal.has(tx.rowNumber) && (
                                    <div className="text-xs text-neutral-600 dark:text-neutral-400 italic bg-neutral-50 dark:bg-dark-surface-hover p-2 rounded mt-1">
                                      {tx.originalDescription}
                                    </div>
                                  )}
                                </>
                              )}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-dark-text ml-2 flex-shrink-0">
                        {formatCurrencyImport(
                          tx.amount?.amount || 0,
                          tx.amount?.currency || currency,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-dark-text-tertiary flex-wrap">
                      <span>{formatDate(tx.date)}</span>
                      {tx.suggestedCategoryId && (
                        <>
                          <span>•</span>
                          <span className="text-success-600 dark:text-success-400">
                            {getCategoryName(tx.suggestedCategoryId)} (
                            {tx.categoryConfidence}%)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Editable category selector */}
                    {onCategoryChange && categoryOptions.length > 0 && (
                      <div
                        className="pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FormSelect
                          options={categoryOptions}
                          value={String(tx.suggestedCategoryId || "")}
                          onChange={(value) => {
                            const categoryId = parseInt(value);
                            if (!isNaN(categoryId)) {
                              onCategoryChange(tx.rowNumber, categoryId);
                            }
                          }}
                          placeholder="Select category"
                          className="w-full text-sm"
                          portal
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
