// src/wj-client/utils/export/excel-export.ts
import * as ExcelJS from "exceljs";
import { Transaction } from "@/gen/protobuf/v1/transaction";
import { formatCurrency } from "@/utils/currency-formatter";

export interface TransactionExportData {
  transactions: Transaction[];
  categoryNames: Map<number, string>;
  walletNames: Map<number, string>;
  currency: string;
}

/**
 * Generate an Excel workbook for transaction export
 * @param data - Transaction data with category and wallet mappings
 * @returns ExcelJS workbook instance
 */
export async function generateTransactionExcel(
  data: TransactionExportData,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Transactions");

  // Define columns
  worksheet.columns = [
    { header: "Date", key: "date", width: 15 },
    { header: "Category", key: "category", width: 20 },
    { header: "Wallet", key: "wallet", width: 20 },
    { header: "Note", key: "note", width: 30 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Type", key: "type", width: 12 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF008148" }, // Brand green
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 25;

  // Add transaction data
  data.transactions.forEach((transaction) => {
    const categoryName = data.categoryNames.get(transaction.categoryId) || "Uncategorized";
    const walletName = data.walletNames.get(transaction.walletId) || "Unknown Wallet";
    const date = new Date(transaction.date * 1000).toLocaleDateString();
    const money = transaction.displayAmount || transaction.amount;
    const amount = money ? formatCurrency(money.amount, money.currency) : formatCurrency(0, data.currency);
    const type = transaction.type === 1 ? "Income" : "Expense";

    worksheet.addRow({
      date,
      category: categoryName,
      wallet: walletName,
      note: transaction.note || "",
      amount,
      type,
    });
  });

  // Apply formatting to data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      // Add alternate row color
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      }

      // Align cells
      row.alignment = { vertical: "middle", horizontal: "left" };

      // Right-align amount column
      const amountCell = row.getCell("amount");
      amountCell.alignment = { horizontal: "right" };
    }
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  // Auto-filter
  worksheet.autoFilter = {
    from: "A1",
    to: `F1`,
  };

  return workbook;
}

/**
 * Generate export filename with date range and format
 */
export function generateExportFilename(
  baseName: string = "transactions",
  dateRange: string = "all",
  startDate?: Date,
  endDate?: Date,
  customFileName?: string,
): string {
  if (customFileName) {
    return `${customFileName}.xlsx`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let rangeStr = "";
  if (dateRange === "custom" && startDate && endDate) {
    rangeStr = `_${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}`;
  } else if (dateRange !== "all") {
    rangeStr = `_${dateRange}`;
  }

  return `${baseName}${rangeStr}_${dateStr}.xlsx`;
}

/**
 * Trigger Excel download in browser
 * @param workbook - ExcelJS workbook instance
 * @param filename - Name for downloaded file
 */
export async function downloadExcel(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  // Generate Excel buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Create blob
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
