"use client";

import React, { useState } from "react";
import { ParsedTransaction, ValidationError } from "@/gen/protobuf/v1/import";
import { FormInput } from "@/components/forms/FormInput";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon } from "@/components/icons";
import { formatCurrencyImport } from "@/utils/currency-formatter";

export interface ErrorSectionProps {
  transactions: ParsedTransaction[];
  onTransactionUpdate: (rowNumber: number, updates: Partial<ParsedTransaction>) => void;
  onSkip: (rowNumber: number) => void;
  currency?: string;
}

export const ErrorSection = React.memo(function ErrorSection({
  transactions,
  onTransactionUpdate,
  onSkip,
  currency = "VND",
}: ErrorSectionProps) {
  const [expanded, setExpanded] = useState(true); // Auto-expand errors
  const [editingRow, setEditingRow] = useState<number | null>(null);

  if (transactions.length === 0) {
    return null;
  }

  const handleSkipAll = () => {
    transactions.forEach((tx) => onSkip(tx.rowNumber));
  };

  return (
    <div className="border border-danger-300 dark:border-danger-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-danger-50 dark:bg-danger-950 hover:bg-danger-100 dark:hover:bg-danger-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="text-left">
            <h3 className="font-semibold text-base text-danger-700 dark:text-danger-300">
              {transactions.length} Need Fixes
            </h3>
            <p className="text-sm text-danger-600 dark:text-danger-400">
              Must fix before import
            </p>
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
            "transition-transform text-danger-600 dark:text-danger-400",
            expanded && "rotate-180"
          )}
          decorative
        />
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4 bg-white dark:bg-dark-surface">
          {transactions.map((tx) => (
            <div
              key={tx.rowNumber}
              className="p-4 bg-danger-50/50 dark:bg-danger-950/30 border border-danger-200 dark:border-danger-800 rounded-lg"
            >
              {/* Row Header */}
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-sm text-neutral-900 dark:text-dark-text">
                  Row {tx.rowNumber}
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditingRow(editingRow === tx.rowNumber ? null : tx.rowNumber)
                    }
                    className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                  >
                    {editingRow === tx.rowNumber ? "Cancel" : "Fix"}
                  </button>
                  <button
                    onClick={() => onSkip(tx.rowNumber)}
                    className="text-xs text-neutral-600 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 font-medium"
                  >
                    Skip
                  </button>
                </div>
              </div>

              {/* Validation Errors */}
              <div className="mb-3 space-y-1">
                {tx.validationErrors?.map((error, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm text-danger-700 dark:text-danger-300"
                  >
                    <span className="text-danger-600 dark:text-danger-400">•</span>
                    <span>
                      <strong>{error.field}:</strong> {error.message}
                    </span>
                  </div>
                ))}
              </div>

              {/* Edit Form */}
              {editingRow === tx.rowNumber ? (
                <div className="space-y-3 pt-3 border-t border-danger-200 dark:border-danger-800">
                  <FormInput
                    label="Date"
                    type="text"
                    value={formatDate(tx.date)}
                    onChange={(e) =>
                      onTransactionUpdate(tx.rowNumber, {
                        date: parseDate(e.target.value),
                      })
                    }
                    error={getFieldError(tx.validationErrors, "date")}
                    placeholder="DD/MM/YYYY"
                    size="sm"
                  />
                  <FormInput
                    label="Amount"
                    type="text"
                    inputMode="decimal"
                    value={formatAmount(tx.amount?.amount || 0, tx.amount?.currency || currency)}
                    onChange={(e) =>
                      onTransactionUpdate(tx.rowNumber, {
                        amount: { amount: parseAmount(e.target.value), currency },
                      })
                    }
                    error={getFieldError(tx.validationErrors, "amount")}
                    placeholder="1,000,000"
                    size="sm"
                  />
                  <FormInput
                    label="Description"
                    type="text"
                    value={tx.description || ""}
                    onChange={(e) =>
                      onTransactionUpdate(tx.rowNumber, {
                        description: e.target.value,
                      })
                    }
                    error={getFieldError(tx.validationErrors, "description")}
                    size="sm"
                  />
                  <Button
                    variant="primary"
                    onClick={() => setEditingRow(null)}
                    fullWidth
                    size="sm"
                  >
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="text-sm space-y-1 text-neutral-600 dark:text-dark-text-secondary">
                  <p>
                    <strong>Date:</strong> {formatDate(tx.date)}
                  </p>
                  <p>
                    <strong>Amount:</strong> {formatAmount(tx.amount?.amount || 0, tx.amount?.currency || currency)}
                  </p>
                  <p>
                    <strong>Description:</strong> {tx.description}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Bulk Actions */}
          <div className="flex gap-2 pt-2 border-t border-danger-200 dark:border-danger-800">
            <Button
              variant="secondary"
              onClick={handleSkipAll}
              fullWidth
              size="sm"
            >
              Skip All {transactions.length}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

// Helper functions
function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatAmount(amount: number, currency: string = "VND"): string {
  // Import data uses ×10000 format, use formatCurrencyImport
  return formatCurrencyImport(amount, currency);
}

function parseDate(dateStr: string): number {
  // Parse DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const date = new Date(
      parseInt(parts[2]),
      parseInt(parts[1]) - 1,
      parseInt(parts[0])
    );
    return Math.floor(date.getTime() / 1000);
  }
  return 0;
}

function parseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/[^\d.-]/g, "");
  const amount = parseFloat(cleaned);
  return Math.round(amount * 10000);
}

function getFieldError(
  errors: ValidationError[] | undefined,
  field: string
): string | undefined {
  return errors?.find((e) => e.field === field)?.message;
}
