// src/wj-client/utils/export/pdf-export.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction } from "@/gen/protobuf/v1/transaction";
import { formatCurrency } from "@/utils/currency-formatter";

export interface TransactionExportData {
  transactions: Transaction[];
  categoryNames: Map<number, string>;
  walletNames: Map<number, string>;
  currency: string;
}

export interface PDFExportOptions {
  includeCharts: boolean;
  customBranding: boolean;
  chartImage?: string;
}

/**
 * Generate a PDF document for transaction export
 * @param data - Transaction data with category and wallet mappings
 * @param options - PDF export options
 * @returns jsPDF document instance
 */
export function generateTransactionPDF(
  data: TransactionExportData,
  options: PDFExportOptions = { includeCharts: false, customBranding: false },
): jsPDF {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14; // ~10mm margin

  let yPosition = margin;

  // Add title
  pdf.setFontSize(18);
  pdf.setTextColor(0, 129, 72); // Brand green color
  pdf.text("Transaction Report", margin, yPosition);
  yPosition += 10;

  // Add subtitle with date
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  const currentDate = new Date().toLocaleDateString();
  pdf.text(`Generated on ${currentDate}`, margin, yPosition);
  yPosition += 10;

  // Add chart if included
  if (options.includeCharts && options.chartImage) {
    const maxWidth = pageWidth - 2 * margin;
    const maxHeight = 80;
    pdf.addImage(
      options.chartImage,
      "PNG",
      margin,
      yPosition,
      maxWidth,
      maxHeight,
    );
    yPosition += maxHeight + 10;
  }

  // Prepare table data
  const tableData = data.transactions.map((transaction) => {
    const categoryName =
      data.categoryNames.get(transaction.categoryId) || "Uncategorized";
    const walletName =
      data.walletNames.get(transaction.walletId) || "Unknown Wallet";
    const date = new Date(transaction.date * 1000).toLocaleDateString();

    // Safely extract amount value
    const amountValue =
      transaction.displayAmount?.amount ?? transaction.amount?.amount ?? 0;
    const numericAmount =
      typeof amountValue === "number" ? amountValue : Number(amountValue) || 0;
    const amount = formatCurrency(numericAmount, data.currency, "code");

    const type = transaction.type === 1 ? "Income" : "Expense";

    return [
      date,
      categoryName,
      walletName,
      transaction.note || "",
      amount,
      type,
    ];
  });

  // Add table using autoTable
  autoTable(pdf, {
    startY: yPosition,
    head: [["Date", "Category", "Wallet", "Note", "Amount", "Type"]],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [0, 129, 72], // Brand green
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: margin, left: margin, right: margin, bottom: margin },
  });

  return pdf;
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
    return `${customFileName}.pdf`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let rangeStr = "";
  if (dateRange === "custom" && startDate && endDate) {
    rangeStr = `_${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}`;
  } else if (dateRange !== "all") {
    rangeStr = `_${dateRange}`;
  }

  return `${baseName}${rangeStr}_${dateStr}.pdf`;
}

/**
 * Trigger PDF download in browser
 * @param pdf - jsPDF document instance
 * @param filename - Name for downloaded file
 */
export function downloadPDF(pdf: jsPDF, filename: string): void {
  pdf.save(filename);
}
