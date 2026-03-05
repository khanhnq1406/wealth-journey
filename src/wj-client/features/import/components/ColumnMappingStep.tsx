"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/Button";
import { FormSelect } from "@/components/forms/FormSelect";
import { FormInput } from "@/components/forms/FormInput";
import { cn } from "@/lib/utils/cn";
import { useMutationCreateUserTemplate } from "@/utils/generated/hooks";

export interface ColumnMappingStepProps {
  file: File;
  templateId: string | null;
  onMappingComplete: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

export interface ColumnMapping {
  dateColumn: number;
  amountColumn: number;
  descriptionColumn: number;
  typeColumn?: number;
  categoryColumn?: number;
  referenceColumn?: number;
  dateFormat: string;
  currency: string;
  saveAsTemplate?: boolean;
  templateName?: string;
}

interface CSVPreview {
  headers: string[];
  sampleRows: string[][];
}

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2025)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2025)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2025-12-31)" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY (31-12-2025)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (31 Dec 2025)" },
];

const CURRENCIES = [
  { value: "VND", label: "VND (₫)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

export function ColumnMappingStep({
  file,
  templateId,
  onMappingComplete,
  onBack,
}: ColumnMappingStepProps) {
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column mapping state
  const [dateColumn, setDateColumn] = useState<number>(-1);
  const [amountColumn, setAmountColumn] = useState<number>(-1);
  const [descriptionColumn, setDescriptionColumn] = useState<number>(-1);
  const [typeColumn, setTypeColumn] = useState<number>(-1);
  const [categoryColumn, setCategoryColumn] = useState<number>(-1);
  const [referenceColumn, setReferenceColumn] = useState<number>(-1);
  const [dateFormat, setDateFormat] = useState<string>("DD/MM/YYYY");
  const [currency, setCurrency] = useState<string>("VND");

  // Save as template state
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>("");

  // Create template mutation
  const createTemplateMutation = useMutationCreateUserTemplate();

  // Parse CSV and extract preview
  useEffect(() => {
    const parseCSVPreview = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check file type - only parse CSV files on frontend
        const fileExt = file.name.split(".").pop()?.toLowerCase();

        if (fileExt === "xlsx" || fileExt === "xls" || fileExt === "pdf") {
          // For Excel and PDF files, skip frontend preview
          // Backend will handle parsing with auto-detection
          setError(
            `${fileExt.toUpperCase()} files are parsed automatically by the backend. Column mapping is not needed.`,
          );
          setLoading(false);
          return;
        }

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length === 0) {
          throw new Error("File is empty");
        }

        // Parse header row
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/"/g, ""));

        // Parse first 3 data rows for preview
        const sampleRows = lines
          .slice(1, 4)
          .map((line) =>
            line.split(",").map((cell) => cell.trim().replace(/"/g, "")),
          );

        setPreview({ headers, sampleRows });

        // Auto-detect columns based on header names
        autoDetectColumns(headers);

        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to parse CSV file");
        setLoading(false);
      }
    };

    parseCSVPreview();
  }, [file]);

  // Auto-detect columns based on common header names
  const autoDetectColumns = (headers: string[]) => {
    headers.forEach((header, index) => {
      const lowerHeader = header.toLowerCase();

      // Date column detection
      if (lowerHeader.includes("date") || lowerHeader.includes("ngày")) {
        setDateColumn(index);
      }

      // Amount column detection
      if (
        lowerHeader.includes("amount") ||
        lowerHeader.includes("số tiền") ||
        lowerHeader.includes("value")
      ) {
        setAmountColumn(index);
      }

      // Description column detection
      if (
        lowerHeader.includes("description") ||
        lowerHeader.includes("mô tả") ||
        lowerHeader.includes("detail") ||
        lowerHeader.includes("chi tiết")
      ) {
        setDescriptionColumn(index);
      }

      // Type column detection
      if (
        lowerHeader.includes("type") ||
        lowerHeader.includes("loại") ||
        lowerHeader.includes("transaction type")
      ) {
        setTypeColumn(index);
      }

      // Category column detection
      if (
        lowerHeader.includes("category") ||
        lowerHeader.includes("danh mục")
      ) {
        setCategoryColumn(index);
      }

      // Reference column detection
      if (
        lowerHeader.includes("reference") ||
        lowerHeader.includes("ref") ||
        lowerHeader.includes("transaction id") ||
        lowerHeader.includes("mã giao dịch")
      ) {
        setReferenceColumn(index);
      }
    });
  };

  const handleNext = async () => {
    // Validate required fields
    if (dateColumn === -1 || amountColumn === -1 || descriptionColumn === -1) {
      setError("Please map at least Date, Amount, and Description columns");
      return;
    }

    // Validate template name if saving
    if (saveAsTemplate && !templateName.trim()) {
      setError("Please enter a template name");
      return;
    }

    // Save template if requested
    if (saveAsTemplate && templateName.trim()) {
      try {
        const fileExt = file.name.split(".").pop()?.toLowerCase() || "csv";
        await createTemplateMutation.mutateAsync({
          templateName: templateName.trim(),
          columnMapping: {
            dateColumn: (dateColumn + 1).toString(),
            amountColumn: (amountColumn + 1).toString(),
            descriptionColumn: (descriptionColumn + 1).toString(),
            typeColumn: typeColumn >= 0 ? (typeColumn + 1).toString() : "",
            categoryColumn:
              categoryColumn >= 0 ? (categoryColumn + 1).toString() : "",
            referenceColumn:
              referenceColumn >= 0 ? (referenceColumn + 1).toString() : "",
            dateFormat,
            currency,
          },
          dateFormat,
          currency,
          fileFormats: [fileExt],
        });
      } catch (err: any) {
        setError(
          err.message || "Failed to save template. Continuing with import...",
        );
        // Continue with import even if template save fails
      }
    }

    const mapping: ColumnMapping = {
      dateColumn,
      amountColumn,
      descriptionColumn,
      typeColumn: typeColumn >= 0 ? typeColumn : undefined,
      categoryColumn: categoryColumn >= 0 ? categoryColumn : undefined,
      referenceColumn: referenceColumn >= 0 ? referenceColumn : undefined,
      dateFormat,
      currency,
      saveAsTemplate,
      templateName: saveAsTemplate ? templateName.trim() : undefined,
    };

    onMappingComplete(mapping);
  };

  const columnOptions =
    preview?.headers.map((header, index) => ({
      value: index.toString(),
      label: `Column ${index + 1}: ${header}`,
    })) || [];

  const noneOption = { value: "-1", label: "None (Skip)" };
  const allColumnOptions = [noneOption, ...columnOptions];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
          <div className="h-32 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !preview) {
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Instructions */}
      <div className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary">
        <p className="mb-2">
          Map CSV columns to transaction fields. Required fields are marked with
          *.
        </p>
        <p className="text-xs sm:text-sm text-neutral-500 dark:text-dark-text-tertiary">
          We've auto-detected columns based on header names. Please verify the
          mapping.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* CSV Preview */}
      {preview && (
        <div className="border border-neutral-200 dark:border-dark-border rounded-lg overflow-hidden">
          <div className="bg-neutral-50 dark:bg-dark-surface-hover px-4 py-2 border-b border-neutral-200 dark:border-dark-border">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
              File Preview (First 3 rows)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-dark-border">
              <thead className="bg-neutral-100 dark:bg-dark-surface">
                <tr>
                  {preview.headers.map((header, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-2 text-left text-xs font-medium text-neutral-700 dark:text-dark-text-secondary uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-dark-surface divide-y divide-neutral-200 dark:divide-dark-border">
                {preview.sampleRows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="px-4 py-2 text-sm text-neutral-900 dark:text-dark-text whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column Mapping Form */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-dark-text">
          Column Mapping
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Required Fields */}
          <FormSelect
            label="Date Column"
            value={dateColumn.toString()}
            onChange={(value) => setDateColumn(parseInt(value))}
            options={columnOptions}
            required
          />

          <FormSelect
            label="Amount Column"
            value={amountColumn.toString()}
            onChange={(value) => setAmountColumn(parseInt(value))}
            options={columnOptions}
            required
          />

          <FormSelect
            label="Description Column"
            value={descriptionColumn.toString()}
            onChange={(value) => setDescriptionColumn(parseInt(value))}
            options={columnOptions}
            required
          />

          {/* Optional Fields */}
          <FormSelect
            label="Type Column (Optional)"
            value={typeColumn.toString()}
            onChange={(value) => setTypeColumn(parseInt(value))}
            options={allColumnOptions}
          />

          <FormSelect
            label="Category Column (Optional)"
            value={categoryColumn.toString()}
            onChange={(value) => setCategoryColumn(parseInt(value))}
            options={allColumnOptions}
          />

          <FormSelect
            label="Reference Column (Optional)"
            value={referenceColumn.toString()}
            onChange={(value) => setReferenceColumn(parseInt(value))}
            options={allColumnOptions}
          />

          {/* Date Format & Currency */}
          <FormSelect
            label="Date Format"
            value={dateFormat}
            onChange={(value) => setDateFormat(value)}
            options={DATE_FORMATS}
            required
          />

          <FormSelect
            label="Currency"
            value={currency}
            onChange={(value) => setCurrency(value)}
            options={CURRENCIES}
            required
          />
        </div>
      </div>

      {/* Save as Template Option */}
      <div className="border border-neutral-200 dark:border-dark-border rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="saveAsTemplate"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-neutral-300 dark:border-dark-border text-primary focus:ring-primary"
          />
          <div className="flex-1">
            <label
              htmlFor="saveAsTemplate"
              className="text-sm font-medium text-neutral-900 dark:text-dark-text cursor-pointer"
            >
              Save as template for reuse
            </label>
            <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary mt-1">
              Save this column mapping as a template to quickly import similar
              files in the future.
            </p>
          </div>
        </div>

        {saveAsTemplate && (
          <div className="pl-7">
            <FormInput
              label="Template Name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., My Bank Credit Card Statement"
              required
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={
            dateColumn === -1 ||
            amountColumn === -1 ||
            descriptionColumn === -1 ||
            (saveAsTemplate && !templateName.trim()) ||
            createTemplateMutation.isPending
          }
        >
          {createTemplateMutation.isPending
            ? "Saving Template..."
            : "Next: Review Transactions"}
        </Button>
      </div>
    </div>
  );
}
