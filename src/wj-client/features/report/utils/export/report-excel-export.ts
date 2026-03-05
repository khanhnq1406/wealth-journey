/**
 * Report Excel Export Utility
 *
 * Generates Excel documents for financial reports including:
 * - Summary data (income, expenses, net savings, savings rate)
 * - Monthly breakdown tables
 * - Expense categories breakdown
 * - Category comparison data
 *
 * Uses ExcelJS for professional Excel generation with brand colors and styling.
 */

import * as ExcelJS from "exceljs";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency-formatter";

// Re-export types from data-utils for convenience
export type { PeriodType, DateRange } from "@/app/dashboard/report/PeriodSelector";

/**
 * Summary data for Excel export
 */
export interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  topExpenseCategory: {
    name: string;
    amount: number;
  } | null;
  currency: string;
}

/**
 * Trend data point for Excel export
 */
export interface TrendData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate?: number;
}

/**
 * Expense category data for Excel export
 */
export interface ExpenseCategoryData {
  name: string;
  value: number;
  color: string;
  percentage?: number;
}

/**
 * Category comparison data for Excel export
 */
export interface CategoryComparisonData {
  category: string;
  thisMonth: number;
  lastMonth: number;
  change?: number;
  changePercentage?: number;
}

/**
 * Report export data interface
 */
export interface ReportExportData {
  summaryData: SummaryData;
  trendData: TrendData[];
  expenseCategories: ExpenseCategoryData[];
  categoryComparisonData?: CategoryComparisonData[];
  period: string;
  dateRange: { start: Date; end: Date };
  currency: string;
}

/**
 * Excel export options interface
 */
export interface ReportExcelExportOptions {
  customFileName?: string;
}

/**
 * Brand colors for Excel styling
 */
const BRAND_COLORS = {
  green: { argb: "FF008148" }, // #008148
  white: { argb: "FFFFFFFF" }, // #FFFFFF
  lightGray: { argb: "FFF5F5F5" }, // #F5F5F5
  border: { argb: "FFC8C8C8" }, // #C8C8C8
  text: { argb: "FF333333" }, // #333333
} as const;

/**
 * Format currency value for display
 *
 * @param amount - Amount in smallest currency unit
 * @param currency - Currency code (ISO 4217)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string): string {
  return formatCurrencyUtil(amount, currency);
}

/**
 * Format date for display in Excel
 *
 * @param date - Date to format
 * @returns Formatted date string (e.g., "Jan 15, 2026")
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date range for display in Excel
 *
 * @param start - Start date
 * @param end - End date
 * @returns Formatted date range string (e.g., "Jan 1, 2026 - Jan 31, 2026")
 */
function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Add title and metadata to a worksheet
 *
 * @param worksheet - ExcelJS worksheet instance
 * @param title - Title text
 * @param subtitle - Subtitle text
 */
function addWorksheetHeader(worksheet: ExcelJS.Worksheet, title: string, subtitle: string): void {
  // Title row
  const titleRow = worksheet.addRow([title]);
  titleRow.font = { bold: true, size: 16, color: { argb: BRAND_COLORS.green.argb } };
  titleRow.height = 25;

  // Subtitle row
  const subtitleRow = worksheet.addRow([subtitle]);
  subtitleRow.font = { size: 11, color: { argb: BRAND_COLORS.text.argb } };
  subtitleRow.height = 20;

  // Empty row for spacing
  worksheet.addRow([]);
}

/**
 * Add summary metrics to worksheet
 *
 * @param worksheet - ExcelJS worksheet instance
 * @param summaryData - Summary statistics
 */
function addSummarySection(worksheet: ExcelJS.Worksheet, summaryData: SummaryData): void {
  // Section header
  const headerRow = worksheet.addRow(["Summary"]);
  headerRow.font = { bold: true, size: 14, color: { argb: BRAND_COLORS.green.argb } };
  headerRow.height = 22;
  worksheet.addRow([]);

  // Define metrics
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Total Income", value: formatCurrency(summaryData.totalIncome, summaryData.currency) },
    { label: "Total Expenses", value: formatCurrency(summaryData.totalExpenses, summaryData.currency) },
    { label: "Net Savings", value: formatCurrency(summaryData.netSavings, summaryData.currency) },
    { label: "Savings Rate", value: `${summaryData.savingsRate}%` },
  ];

  // Add top expense category if available
  if (summaryData.topExpenseCategory) {
    metrics.push({
      label: "Top Expense Category",
      value: `${summaryData.topExpenseCategory.name} (${formatCurrency(summaryData.topExpenseCategory.amount, summaryData.currency)})`,
    });
  }

  // Add metrics as label-value pairs
  metrics.forEach((metric) => {
    const row = worksheet.addRow([metric.label, metric.value]);
    row.font = { size: 11, color: { argb: BRAND_COLORS.text.argb } };
    row.height = 18;

    // Style label cell
    row.getCell(1).font = { bold: true, size: 11, color: { argb: BRAND_COLORS.text.argb } };
    // Style value cell - right aligned
    row.getCell(2).alignment = { horizontal: "right" };
  });

  // Empty row for spacing
  worksheet.addRow([]);
}

/**
 * Create monthly breakdown sheet
 *
 * @param workbook - ExcelJS workbook instance
 * @param trendData - Array of monthly trend data
 * @param currency - Currency code
 * @param periodLabel - Period label for header
 */
function createMonthlyBreakdownSheet(workbook: ExcelJS.Workbook, trendData: TrendData[], currency: string, periodLabel: string): void {
  const worksheet = workbook.addWorksheet("Monthly Breakdown");

  // Add header
  addWorksheetHeader(worksheet, "Monthly Breakdown", periodLabel);

  // Define columns
  worksheet.columns = [
    { header: "Month", key: "month", width: 18 },
    { header: "Income", key: "income", width: 20 },
    { header: "Expenses", key: "expenses", width: 20 },
    { header: "Net Savings", key: "net", width: 20 },
    { header: "Savings Rate", key: "savingsRate", width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(4); // Row 4 because we added 3 rows for title/subtitle/spacing
  headerRow.font = { bold: true, color: { argb: BRAND_COLORS.white.argb } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_COLORS.green.argb },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 25;

  // Add data rows
  trendData.forEach((monthData) => {
    const row = worksheet.addRow({
      month: monthData.month,
      income: formatCurrency(monthData.income, currency),
      expenses: formatCurrency(monthData.expenses, currency),
      net: formatCurrency(monthData.net, currency),
      savingsRate: monthData.savingsRate !== undefined ? `${monthData.savingsRate}%` : "N/A",
    });
    row.alignment = { vertical: "middle", horizontal: "left" };
    row.height = 20;

    // Right-align numeric columns
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // Apply alternate row colors
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 4 && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_COLORS.lightGray.argb },
      };
    }
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
}

/**
 * Create category breakdown sheet
 *
 * @param workbook - ExcelJS workbook instance
 * @param expenseCategories - Array of expense category data
 * @param currency - Currency code
 * @param periodLabel - Period label for header
 */
function createCategoryBreakdownSheet(
  workbook: ExcelJS.Workbook,
  expenseCategories: ExpenseCategoryData[],
  currency: string,
  periodLabel: string
): void {
  const worksheet = workbook.addWorksheet("Category Breakdown");

  // Add header
  addWorksheetHeader(worksheet, "Expense Categories Breakdown", periodLabel);

  if (expenseCategories.length === 0) {
    worksheet.addRow(["No expense data available for this period."]);
    return;
  }

  // Calculate total for percentages
  const total = expenseCategories.reduce((sum, cat) => sum + cat.value, 0);

  // Define columns
  worksheet.columns = [
    { header: "Category", key: "category", width: 30 },
    { header: "Amount", key: "amount", width: 20 },
    { header: "Percentage", key: "percentage", width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: BRAND_COLORS.white.argb } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_COLORS.green.argb },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 25;

  // Add data rows
  expenseCategories.forEach((category) => {
    const percentage = category.percentage !== undefined
      ? `${category.percentage}%`
      : total > 0
      ? `${((category.value / total) * 100).toFixed(1)}%`
      : "0.0%";

    const row = worksheet.addRow({
      category: category.name,
      amount: formatCurrency(category.value, currency),
      percentage,
    });
    row.alignment = { vertical: "middle", horizontal: "left" };
    row.height = 20;

    // Right-align numeric columns
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // Add total row
  const totalRow = worksheet.addRow([
    "Total",
    formatCurrency(total, currency),
    "100.0%",
  ]);
  totalRow.font = { bold: true, color: { argb: BRAND_COLORS.green.argb } };
  totalRow.alignment = { vertical: "middle", horizontal: "left" };
  totalRow.eachCell((cell, colNumber) => {
    if (colNumber > 1) {
      cell.alignment = { horizontal: "right" };
    }
  });

  // Apply alternate row colors (skip the total row)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 4 && rowNumber < worksheet.rowCount && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_COLORS.lightGray.argb },
      };
    }
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
}

/**
 * Create category comparison sheet (optional)
 *
 * @param workbook - ExcelJS workbook instance
 * @param comparisonData - Array of category comparison data
 * @param currency - Currency code
 * @param periodLabel - Period label for header
 */
function createCategoryComparisonSheet(
  workbook: ExcelJS.Workbook,
  comparisonData: CategoryComparisonData[],
  currency: string,
  periodLabel: string
): void {
  const worksheet = workbook.addWorksheet("Category Comparison");

  // Add header
  addWorksheetHeader(worksheet, "Category Comparison (Current vs Previous)", periodLabel);

  // Define columns
  worksheet.columns = [
    { header: "Category", key: "category", width: 25 },
    { header: "Current Period", key: "thisMonth", width: 20 },
    { header: "Previous Period", key: "lastMonth", width: 20 },
    { header: "Change", key: "change", width: 18 },
    { header: "Change %", key: "changePercentage", width: 15 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: BRAND_COLORS.white.argb } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_COLORS.green.argb },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 25;

  // Add data rows
  comparisonData.forEach((category) => {
    const change = category.change !== undefined ? category.change : 0;
    const changePercent = category.changePercentage !== undefined ? category.changePercentage : 0;

    const row = worksheet.addRow({
      category: category.category,
      thisMonth: formatCurrency(category.thisMonth, currency),
      lastMonth: formatCurrency(category.lastMonth, currency),
      change: formatCurrency(change, currency),
      changePercentage: `${changePercent}%`,
    });
    row.alignment = { vertical: "middle", horizontal: "left" };
    row.height = 20;

    // Right-align numeric columns
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.alignment = { horizontal: "right" };
      }
    });

    // Add color coding for change column
    const changeCell = row.getCell("change");
    const changePercentCell = row.getCell("changePercentage");
    if (change < 0) {
      // Negative change - red for expenses (good when decreased)
      changeCell.font = { color: { argb: "FFC3151C" } }; // Brand red
      changePercentCell.font = { color: { argb: "FFC3151C" } };
    } else if (change > 0) {
      // Positive change - green for income, neutral for expenses
      changeCell.font = { color: { argb: BRAND_COLORS.green.argb } };
      changePercentCell.font = { color: { argb: BRAND_COLORS.green.argb } };
    }
  });

  // Apply alternate row colors
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 4 && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: BRAND_COLORS.lightGray.argb },
      };
    }
  });

  // Freeze header row
  worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
}

/**
 * Generate an Excel workbook for financial report
 *
 * @param data - Report data containing summary, trends, and categories
 * @param options - Excel export options
 * @returns ExcelJS workbook instance
 *
 * @example
 * ```typescript
 * const workbook = generateReportExcel(reportData, { customFileName: "My Report" });
 * downloadExcel(workbook, generateReportExcelFilename("this-month", startDate, endDate));
 * ```
 */
export function generateReportExcel(
  data: ReportExportData,
  options: ReportExcelExportOptions = {}
): ExcelJS.Workbook {
  const { summaryData, trendData, expenseCategories, categoryComparisonData, period, dateRange } = data;

  // Create new workbook
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = "WealthJourney Financial Reports";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Set period label for use in sheet headers
  const periodLabel = period.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  const dateRangeStr = formatDateRange(dateRange.start, dateRange.end);
  const periodSubtitle = `${periodLabel} (${dateRangeStr})`;

  // Create Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  addWorksheetHeader(summarySheet, "Financial Report", periodSubtitle);
  addSummarySection(summarySheet, summaryData);

  // Freeze header rows in summary sheet
  summarySheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

  // Create Monthly Breakdown sheet
  if (trendData && trendData.length > 0) {
    createMonthlyBreakdownSheet(workbook, trendData, data.currency, periodSubtitle);
  }

  // Create Category Breakdown sheet
  if (expenseCategories && expenseCategories.length > 0) {
    createCategoryBreakdownSheet(workbook, expenseCategories, data.currency, periodSubtitle);
  }

  // Create Category Comparison sheet if data available
  if (categoryComparisonData && categoryComparisonData.length > 0) {
    createCategoryComparisonSheet(workbook, categoryComparisonData, data.currency, periodSubtitle);
  }

  return workbook;
}

/**
 * Generate filename for report Excel export
 *
 * @param period - Period type (e.g., "this-month", "last-month")
 * @param startDate - Start date of the report period
 * @param endDate - End date of the report period
 * @param customFileName - Optional custom filename (without extension)
 * @returns Generated filename with .xlsx extension
 *
 * @example
 * ```typescript
 * const filename = generateReportExcelFilename("this-month", startDate, endDate);
 * // Returns: "financial-report_this-month_2026-02-01_to_2026-02-28_2026-02-08.xlsx"
 *
 * const customFilename = generateReportExcelFilename("custom", startDate, endDate, "My Report");
 * // Returns: "My Report.xlsx"
 * ```
 */
export function generateReportExcelFilename(
  period: string,
  startDate: Date,
  endDate: Date,
  customFileName?: string
): string {
  if (customFileName) {
    // Remove .xlsx extension if already present
    const sanitized = customFileName.replace(/\.xlsx$/i, "");
    return `${sanitized}.xlsx`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const periodLabel = period.replace(/-/g, "_");

  // Format date range for filename
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  return `financial-report_${periodLabel}_${startDateStr}_to_${endDateStr}_${dateStr}.xlsx`;
}

/**
 * Trigger Excel download in browser
 *
 * @param workbook - ExcelJS workbook instance
 * @param filename - Name for downloaded file
 *
 * @example
 * ```typescript
 * const workbook = generateReportExcel(data);
 * downloadExcel(workbook, "my-report.xlsx");
 * ```
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

/**
 * Export report to Excel with a single function call
 * Combines generation, filename creation, and download
 *
 * @param data - Report data to export
 * @param options - Export options including period, date range, and optional custom filename
 *
 * @example
 * ```typescript
 * exportReportToExcel(reportData, {
 *   period: "this-month",
 *   startDate: new Date("2026-02-01"),
 *   endDate: new Date("2026-02-28"),
 * });
 * ```
 */
export async function exportReportToExcel(
  data: ReportExportData,
  options: ReportExcelExportOptions & { period: string; startDate: Date; endDate: Date }
): Promise<void> {
  const workbook = generateReportExcel(data, options);
  const filename = generateReportExcelFilename(
    options.period,
    options.startDate,
    options.endDate,
    options.customFileName
  );
  await downloadExcel(workbook, filename);
}
