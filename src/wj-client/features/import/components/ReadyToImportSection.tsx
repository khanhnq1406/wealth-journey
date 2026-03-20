"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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

  const t = useTranslations("import.readyToImport");

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
 <div className="border border-success-300 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
 className="w-full flex items-center justify-between p-4 bg-success-50 hover:bg-success-100 transition-colors"
      >
        <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-success-600 flex items-center justify-center">
            <CheckIcon size="sm" className="text-white" decorative />
          </div>
          <div className="text-left">
 <h3 className="font-semibold text-base text-success-700">
              {t("heading", { count: selectedCount })}
            </h3>
 <p className="text-sm text-success-600">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
 "transition-transform text-success-600",
            expanded && "rotate-180",
          )}
          decorative
        />
      </button>

      {/* Content */}
      {expanded && (
 <div className="p-4 space-y-3 bg-v2-maroon-800">
          {/* Select All */}
 <div className="flex items-center justify-between pb-2 border-b border-success-200">
            <div
              className="flex items-center gap-2 cursor-pointer min-h-[44px]"
              onClick={handleSelectAll}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                  allSelected
 ? "bg-primary-600 border-primary-600"
                    : someSelected
 ? "bg-primary-600 border-primary-600"
 : "border-neutral-400 hover:border-primary-500",
                )}
                role="checkbox"
                aria-checked={allSelected ? "true" : someSelected ? "mixed" : "false"}
                aria-label={t("toggleAllRows")}
              >
                {allSelected ? (
                  <CheckIcon size="sm" className="text-white" decorative />
                ) : someSelected ? (
                  <MinusIcon size="sm" className="text-white" decorative />
                ) : null}
              </div>
 <span className="text-sm font-medium text-neutral-900">
                {t("selectAll", { selected: selectedCount, total: transactions.length })}
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
 ? "bg-v2-maroon-800 border border-v2-maroon-600"
 : "bg-neutral-100 opacity-60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onToggleExclude(tx.rowNumber)}
                    className={cn(
                      "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer",
                      isChecked
 ? "bg-primary-600 border-primary-600"
 : "border-neutral-400",
                    )}
                    aria-label={t("toggleRow", { n: tx.rowNumber })}
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
 className="w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit(tx.rowNumber);
                                }}
                                className="flex-1 px-2 py-1 text-xs bg-v2-green-positive text-white rounded hover:bg-v2-green-positive"
                              >
                                {t("save")}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
 className="flex-1 px-2 py-1 text-xs bg-neutral-300 text-neutral-900 rounded hover:bg-neutral-400"
                              >
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
 <p className="text-sm font-medium text-neutral-900 truncate">
                                {tx.description}
                              </p>
                              {onDescriptionChange && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(tx.rowNumber, tx.description);
                                  }}
 className="flex-shrink-0 text-primary-600 hover:text-primary-700 text-xs"
                                  title={t("editDescription")}
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
 className="text-xs text-neutral-500 hover:text-primary-600"
                                  >
                                    {expandedOriginal.has(tx.rowNumber) ? "▼" : "▶"} {t("original")}
                                  </button>
                                  {expandedOriginal.has(tx.rowNumber) && (
 <div className="text-xs text-neutral-600 italic bg-neutral-50 p-2 rounded mt-1">
                                      {tx.originalDescription}
                                    </div>
                                  )}
                                </>
                              )}
                          </div>
                        )}
                      </div>
 <p className="text-sm font-semibold text-neutral-900 ml-2 flex-shrink-0">
                        {formatCurrencyImport(
                          tx.amount?.amount || 0,
                          tx.amount?.currency || currency,
                        )}
                      </p>
                    </div>
 <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                      <span>{formatDate(tx.date)}</span>
                      {tx.suggestedCategoryId && (
                        <>
                          <span>•</span>
 <span className="text-success-600">
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
                          placeholder={t("selectCategoryPlaceholder")}
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
