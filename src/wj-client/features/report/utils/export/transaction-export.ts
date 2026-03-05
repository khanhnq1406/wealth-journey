// src/wj-client/utils/export/transaction-export.ts
import { Transaction } from "@/gen/protobuf/v1/transaction";
import { ExportOptions, DateRange } from "@/components/export/ExportDialog";
import { formatCurrency } from "@/utils/currency-formatter";

export interface TransactionExportData {
  transactions: Transaction[];
  categoryNames: Map<number, string>;
  walletNames: Map<number, string>;
  currency: string;
}

/**
 * Get date range timestamps based on preset
 */
export function getDateRangeTimestamps(range: DateRange): {
  startDate?: number;
  endDate?: number;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  switch (range) {
    case "last7days":
      return {
        startDate: Math.floor(
          new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).getTime() / 1000,
        ),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "last30days":
      return {
        startDate: Math.floor(
          new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).getTime() / 1000,
        ),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "last90days":
      return {
        startDate: Math.floor(
          new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).getTime() / 1000,
        ),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "ytd":
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: Math.floor(startOfYear.getTime() / 1000),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "all":
      return {};
    case "custom":
      // Handled separately via customStartDate/customEndDate
      return {};
    default:
      return {};
  }
}

/**
 * Escape CSV value by wrapping in quotes if needed
 */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate CSV content from transactions
 */
export function generateTransactionCSV(data: TransactionExportData): string {
  const { transactions, categoryNames, walletNames, currency } = data;

  // Define CSV headers
  const headers = ["Date", "Category", "Wallet", "Note", "Amount", "Type"];

  // Generate rows
  const rows = transactions.map((t) => {
    // Safely extract amount value
    const amountValue = t.displayAmount?.amount ?? t.amount?.amount ?? 0;
    const numericAmount =
      typeof amountValue === "number" ? amountValue : Number(amountValue) || 0;

    return [
      new Date(t.date * 1000).toLocaleDateString(),
      escapeCSV(categoryNames.get(t.categoryId) || "Uncategorized"),
      escapeCSV(walletNames.get(t.walletId) || "Unknown Wallet"),
      escapeCSV(t.note || ""),
      formatCurrency(numericAmount, currency),
      t.type === 1 ? "Expense" : "Income",
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Generate default filename based on date range
 */
export function generateExportFilename(
  baseName: string = "transactions",
  dateRange: DateRange,
  customStartDate?: Date,
  customEndDate?: Date,
  customFileName?: string,
): string {
  if (customFileName) {
    return `${customFileName}.csv`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let rangeStr = "";
  if (dateRange === "custom" && customStartDate && customEndDate) {
    rangeStr = `_${customStartDate.toISOString().split("T")[0]}_to_${customEndDate.toISOString().split("T")[0]}`;
  } else if (dateRange !== "all") {
    rangeStr = `_${dateRange}`;
  }

  return `${baseName}${rangeStr}_${dateStr}.csv`;
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(
  csvContent: string,
  fileName: string,
): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
