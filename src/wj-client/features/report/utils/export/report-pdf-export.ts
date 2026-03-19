/**
 * Report PDF Export Utility
 *
 * Generates PDF documents for financial reports including:
 * - Summary data (income, expenses, net savings, savings rate)
 * - Monthly breakdown tables
 * - Trend data visualization
 * - Expense categories breakdown
 *
 * Uses jsPDF and jsPDF-autotable for professional PDF generation
 * with brand colors and styling.
 */

import { formatCurrency as formatCurrencyUtil } from "@/utils/currency-formatter";

// Use a lightweight type alias for jsPDF instances in internal helpers.
// The actual jsPDF class is loaded dynamically to avoid SSR bundling issues
// (fflate, a jspdf dependency, uses Node.js Worker which Turbopack cannot resolve during SSR).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDFInstance = any;

let cachedModules: { jsPDF: JsPDFInstance; autoTable: JsPDFInstance } | null = null;

async function loadJsPDF(): Promise<{ jsPDF: JsPDFInstance; autoTable: JsPDFInstance }> {
  if (cachedModules) return cachedModules;
  if (typeof window === "undefined") {
    throw new Error("jsPDF can only be loaded in the browser");
  }
  const [jspdfModule, autoTableModule] = await Promise.all([
    import(/* webpackChunkName: "jspdf" */ "jspdf"),
    import(/* webpackChunkName: "jspdf-autotable" */ "jspdf-autotable"),
  ]);
  cachedModules = { jsPDF: jspdfModule.default, autoTable: autoTableModule.default };
  return cachedModules;
}

// Re-export types from data-utils for convenience
export type {
  PeriodType,
  DateRange,
} from "@/app/[locale]/dashboard/report/PeriodSelector";

/**
 * Summary data for PDF export
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
 * Trend data point for PDF export
 */
export interface TrendData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate?: number;
}

/**
 * Expense category data for PDF export
 */
export interface ExpenseCategoryData {
  name: string;
  value: number;
  color: string;
  percentage?: number;
}

/**
 * Category comparison data for PDF export
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
  translations?: ReportExportTranslations;
}

/**
 * Translation strings for report exports (PDF and Excel).
 *
 * All values are pre-resolved strings — interpolation (e.g. "Period: Jan 2026")
 * is performed by the calling component before passing to the export function.
 * Every property is optional; English defaults are used when omitted.
 */
export interface ReportExportTranslations {
  title?: string; // "Financial Report"
  period?: string; // Pre-resolved, e.g. "Period: This Month"
  summary?: string; // "Summary"
  totalIncome?: string; // "Total Income"
  totalExpenses?: string; // "Total Expenses"
  netSavings?: string; // "Net Savings"
  savingsRate?: string; // "Savings Rate"
  topExpenseCategory?: string; // "Top Expense Category"
  monthlyBreakdown?: string; // "Monthly Breakdown"
  month?: string; // "Month"
  income?: string; // "Income"
  expenses?: string; // "Expenses"
  savingsRateHeader?: string; // "Savings Rate"
  notAvailable?: string; // "N/A"
  expenseCategoriesBreakdown?: string; // "Expense Categories Breakdown"
  noExpenseData?: string; // "No expense data available for this period."
  category?: string; // "Category"
  amount?: string; // "Amount"
  percentage?: string; // "Percentage"
  total?: string; // "Total"
  categoryComparison?: string; // "Category Comparison (Current vs Previous)"
  currentPeriod?: string; // "Current Period"
  previousPeriod?: string; // "Previous Period"
  change?: string; // "Change"
  changePercent?: string; // "Change %"
  pageNumber?: string; // Pre-resolved, e.g. "Page 1 of 3" — set per-page at render time
  generatedOn?: string; // Pre-resolved, e.g. "Generated on 3/6/2026"
  brandFooter?: string; // "congdongvang.com Financial Report"
  workbookCreator?: string; // "congdongvang.com Financial Reports"
}

/**
 * PDF export options interface
 */
export interface ReportPDFExportOptions {
  includeCharts?: boolean;
  customFileName?: string;
}

/**
 * Brand colors for PDF styling
 */
const BRAND_COLORS = {
  green: { r: 185, g: 28, b: 28 }, // #B91C1C (V2 red-primary)
  greenRgb: [185, 28, 28] as [number, number, number],
  text: { r: 51, g: 51, b: 51 }, // #333333
  lightGray: { r: 245, g: 245, b: 245 }, // #F5F5F5
  border: { r: 200, g: 200, b: 200 }, // #C8C8C8
} as const;

/**
 * PDF document layout constants
 */
const LAYOUT = {
  margin: 14, // ~10mm margin
  pageWidth: 210, // A4 width in mm
  lineHeight: 7,
  sectionSpacing: 10,
} as const;

/**
 * Format currency value for display
 *
 * @param amount - Amount in smallest currency unit
 * @param currency - Currency code (ISO 4217)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string): string {
  return formatCurrencyUtil(amount, currency, "code");
}

/**
 * Format date for display in PDF
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
 * Format date range for display in PDF
 *
 * @param start - Start date
 * @param end - End date
 * @returns Formatted date range string (e.g., "Jan 1, 2026 - Jan 31, 2026")
 */
function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Add page header with title and date range
 *
 * @param pdf - jsPDF instance
 * @param period - Period type label
 * @param dateRange - Date range object
 * @param translations - Optional translation strings
 * @returns Y position after header
 */
function addHeader(
  pdf: JsPDFInstance,
  period: string,
  dateRange: { start: Date; end: Date },
  translations?: ReportExportTranslations,
): number {
  let yPosition = LAYOUT.margin;

  // Add title with brand green color
  pdf.setFontSize(18);
  pdf.setTextColor(...BRAND_COLORS.greenRgb);
  pdf.text(translations?.title ?? "Financial Report", LAYOUT.margin, yPosition);
  yPosition += LAYOUT.lineHeight + 3;

  // Add period label
  pdf.setFontSize(12);
  pdf.setTextColor(
    BRAND_COLORS.text.r,
    BRAND_COLORS.text.g,
    BRAND_COLORS.text.b,
  );
  const periodLabel = period
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  pdf.text(
    translations?.period ?? `Period: ${periodLabel}`,
    LAYOUT.margin,
    yPosition,
  );
  yPosition += LAYOUT.lineHeight;

  // Add date range
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  const dateRangeStr = formatDateRange(dateRange.start, dateRange.end);
  pdf.text(dateRangeStr, LAYOUT.margin, yPosition);
  yPosition += LAYOUT.lineHeight + 3;

  return yPosition;
}

/**
 * Add summary section with key metrics
 *
 * @param pdf - jsPDF instance
 * @param summaryData - Summary statistics
 * @param yPosition - Starting Y position
 * @param translations - Optional translation strings
 * @returns Y position after summary section
 */
function addSummarySection(
  pdf: JsPDFInstance,
  summaryData: SummaryData,
  yPosition: number,
  translations?: ReportExportTranslations,
): number {
  // Section title
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND_COLORS.greenRgb);
  pdf.text(translations?.summary ?? "Summary", LAYOUT.margin, yPosition);
  yPosition += LAYOUT.lineHeight + 2;

  // Define summary metrics
  const metrics = [
    {
      label: translations?.totalIncome ?? "Total Income",
      value: formatCurrency(summaryData.totalIncome, summaryData.currency),
    },
    {
      label: translations?.totalExpenses ?? "Total Expenses",
      value: formatCurrency(summaryData.totalExpenses, summaryData.currency),
    },
    {
      label: translations?.netSavings ?? "Net Savings",
      value: formatCurrency(summaryData.netSavings, summaryData.currency),
    },
    { label: translations?.savingsRate ?? "Savings Rate", value: `${summaryData.savingsRate}%` },
  ];

  // Add top expense category if available
  if (summaryData.topExpenseCategory) {
    metrics.push({
      label: translations?.topExpenseCategory ?? "Top Expense Category",
      value: `${summaryData.topExpenseCategory.name} (${formatCurrency(summaryData.topExpenseCategory.amount, summaryData.currency)})`,
    });
  }

  // Render metrics in two columns
  pdf.setFontSize(10);
  pdf.setTextColor(
    BRAND_COLORS.text.r,
    BRAND_COLORS.text.g,
    BRAND_COLORS.text.b,
  );

  const columnWidth = (LAYOUT.pageWidth - 2 * LAYOUT.margin) / 2;
  metrics.forEach((metric, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = LAYOUT.margin + col * columnWidth;
    const y = yPosition + row * LAYOUT.lineHeight;

    pdf.setFont(undefined, "bold");
    pdf.text(`${metric.label}:`, x, y);

    const labelWidth = pdf.getTextWidth(`${metric.label}: `);
    pdf.setFont(undefined, "normal");
    pdf.text(metric.value, x + labelWidth, y);
  });

  yPosition += (Math.ceil(metrics.length / 2) + 1) * LAYOUT.lineHeight + 3;

  return yPosition;
}

/**
 * Add monthly breakdown table
 *
 * @param pdf - jsPDF instance
 * @param trendData - Array of monthly trend data
 * @param currency - Currency code
 * @param yPosition - Starting Y position
 * @param translations - Optional translation strings
 * @returns Y position after table
 */
function addMonthlyBreakdownTable(
  pdf: JsPDFInstance,
  autoTable: JsPDFInstance,
  trendData: TrendData[],
  currency: string,
  yPosition: number,
  translations?: ReportExportTranslations,
): number {
  // Section title
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND_COLORS.greenRgb);
  pdf.text(translations?.monthlyBreakdown ?? "Monthly Breakdown", LAYOUT.margin, yPosition);
  yPosition += LAYOUT.lineHeight + 2;

  // Prepare table data
  const tableHead = [
    [
      translations?.month ?? "Month",
      translations?.income ?? "Income",
      translations?.expenses ?? "Expenses",
      translations?.netSavings ?? "Net Savings",
      translations?.savingsRateHeader ?? "Savings Rate",
    ],
  ];

  const naText = translations?.notAvailable ?? "N/A";
  const tableBody = trendData.map((month) => [
    month.month,
    formatCurrency(month.income, currency),
    formatCurrency(month.expenses, currency),
    formatCurrency(month.net, currency),
    month.savingsRate !== undefined ? `${month.savingsRate}%` : naText,
  ]);

  // Add table using autoTable
  autoTable(pdf, {
    startY: yPosition,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: "helvetica",
    },
    headStyles: {
      fillColor: BRAND_COLORS.greenRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 30 }, // Month
      1: { cellWidth: 45, halign: "right" }, // Income
      2: { cellWidth: 45, halign: "right" }, // Expenses
      3: { cellWidth: 45, halign: "right" }, // Net Savings
      4: { cellWidth: 30, halign: "right" }, // Savings Rate
    },
    alternateRowStyles: {
      fillColor: [
        BRAND_COLORS.lightGray.r,
        BRAND_COLORS.lightGray.g,
        BRAND_COLORS.lightGray.b,
      ],
    },
    margin: {
      top: LAYOUT.margin,
      left: LAYOUT.margin,
      right: LAYOUT.margin,
      bottom: LAYOUT.margin,
    },
  });

  // Return Y position after table
  return (pdf as any).lastAutoTable.finalY + LAYOUT.sectionSpacing;
}

/**
 * Add expense categories breakdown section
 *
 * @param pdf - jsPDF instance
 * @param expenseCategories - Array of expense category data
 * @param currency - Currency code
 * @param yPosition - Starting Y position
 * @param translations - Optional translation strings
 * @returns Y position after section
 */
function addExpenseCategoriesSection(
  pdf: JsPDFInstance,
  autoTable: JsPDFInstance,
  expenseCategories: ExpenseCategoryData[],
  currency: string,
  yPosition: number,
  translations?: ReportExportTranslations,
): number {
  // Check if we need a new page
  if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
    pdf.addPage();
    yPosition = LAYOUT.margin;
  }

  // Section title
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND_COLORS.greenRgb);
  pdf.text(
    translations?.expenseCategoriesBreakdown ?? "Expense Categories Breakdown",
    LAYOUT.margin,
    yPosition,
  );
  yPosition += LAYOUT.lineHeight + 2;

  if (expenseCategories.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      translations?.noExpenseData ?? "No expense data available for this period.",
      LAYOUT.margin,
      yPosition,
    );
    return yPosition + LAYOUT.lineHeight + LAYOUT.sectionSpacing;
  }

  // Calculate total for percentages
  const total = expenseCategories.reduce((sum, cat) => sum + cat.value, 0);

  // Prepare table data
  const tableHead = [
    [
      translations?.category ?? "Category",
      translations?.amount ?? "Amount",
      translations?.percentage ?? "Percentage",
    ],
  ];

  const tableBody = expenseCategories.map((cat) => [
    cat.name,
    formatCurrency(cat.value, currency),
    cat.percentage !== undefined
      ? `${cat.percentage}%`
      : total > 0
        ? `${((cat.value / total) * 100).toFixed(1)}%`
        : "0.0%",
  ]);

  // Add table using autoTable
  autoTable(pdf, {
    startY: yPosition,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: "helvetica",
    },
    headStyles: {
      fillColor: BRAND_COLORS.greenRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 80 }, // Category
      1: { cellWidth: 55, halign: "right" }, // Amount
      2: { cellWidth: 40, halign: "right" }, // Percentage
    },
    alternateRowStyles: {
      fillColor: [
        BRAND_COLORS.lightGray.r,
        BRAND_COLORS.lightGray.g,
        BRAND_COLORS.lightGray.b,
      ],
    },
    margin: {
      top: LAYOUT.margin,
      left: LAYOUT.margin,
      right: LAYOUT.margin,
      bottom: LAYOUT.margin,
    },
  });

  // Return Y position after table
  return (pdf as any).lastAutoTable.finalY + LAYOUT.sectionSpacing;
}

/**
 * Add category comparison section (optional)
 *
 * @param pdf - jsPDF instance
 * @param comparisonData - Array of category comparison data
 * @param currency - Currency code
 * @param yPosition - Starting Y position
 * @param translations - Optional translation strings
 * @returns Y position after section
 */
function addCategoryComparisonSection(
  pdf: JsPDFInstance,
  autoTable: JsPDFInstance,
  comparisonData: CategoryComparisonData[],
  currency: string,
  yPosition: number,
  translations?: ReportExportTranslations,
): number {
  if (!comparisonData || comparisonData.length === 0) {
    return yPosition;
  }

  // Check if we need a new page
  if (yPosition > pdf.internal.pageSize.getHeight() - 60) {
    pdf.addPage();
    yPosition = LAYOUT.margin;
  }

  // Section title
  pdf.setFontSize(14);
  pdf.setTextColor(...BRAND_COLORS.greenRgb);
  pdf.text(
    translations?.categoryComparison ?? "Category Comparison (Current vs Previous)",
    LAYOUT.margin,
    yPosition,
  );
  yPosition += LAYOUT.lineHeight + 2;

  // Prepare table data
  const tableHead = [
    [
      translations?.category ?? "Category",
      translations?.currentPeriod ?? "Current Period",
      translations?.previousPeriod ?? "Previous Period",
      translations?.change ?? "Change",
      translations?.changePercent ?? "Change %",
    ],
  ];

  const tableBody = comparisonData.map((cat) => [
    cat.category,
    formatCurrency(cat.thisMonth, currency),
    formatCurrency(cat.lastMonth, currency),
    formatCurrency(cat.change || 0, currency),
    `${cat.changePercentage || 0}%`,
  ]);

  // Add table using autoTable
  autoTable(pdf, {
    startY: yPosition,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      font: "helvetica",
    },
    headStyles: {
      fillColor: BRAND_COLORS.greenRgb,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 50 }, // Category
      1: { cellWidth: 40, halign: "right" }, // Current Period
      2: { cellWidth: 40, halign: "right" }, // Previous Period
      3: { cellWidth: 35, halign: "right" }, // Change
      4: { cellWidth: 30, halign: "right" }, // Change %
    },
    alternateRowStyles: {
      fillColor: [
        BRAND_COLORS.lightGray.r,
        BRAND_COLORS.lightGray.g,
        BRAND_COLORS.lightGray.b,
      ],
    },
    margin: {
      top: LAYOUT.margin,
      left: LAYOUT.margin,
      right: LAYOUT.margin,
      bottom: LAYOUT.margin,
    },
  });

  // Return Y position after table
  return (pdf as any).lastAutoTable.finalY + LAYOUT.sectionSpacing;
}

/**
 * Add footer to each page
 *
 * @param pdf - jsPDF instance
 * @param translations - Optional translation strings
 */
function addFooter(pdf: JsPDFInstance, translations?: ReportExportTranslations): void {
  const pageCount = pdf.internal.pages.length - 1;
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);

    // Page number
    const pageText = translations?.pageNumber
      ? translations.pageNumber
          .replace("{current}", String(i))
          .replace("{total}", String(pageCount))
      : `Page ${i} of ${pageCount}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(
      pageText,
      LAYOUT.pageWidth / 2 - pageTextWidth / 2,
      pageHeight - 7,
    );

    // Generated date
    const generatedText =
      translations?.generatedOn ?? `Generated on ${new Date().toLocaleDateString()}`;
    pdf.text(generatedText, LAYOUT.margin, pageHeight - 7);

    // Brand text
    const brandText = translations?.brandFooter ?? "congdongvang.com Financial Report";
    const brandTextWidth = pdf.getTextWidth(brandText);
    pdf.text(
      brandText,
      LAYOUT.pageWidth - LAYOUT.margin - brandTextWidth,
      pageHeight - 7,
    );
  }
}

/**
 * Generate a PDF document for financial report
 *
 * @param data - Report data containing summary, trends, and categories
 * @param options - PDF export options
 * @returns jsPDF document instance
 *
 * @example
 * ```typescript
 * const pdf = generateReportPDF(reportData, { includeCharts: false });
 * downloadPDF(pdf, generateReportPDFFilename("this-month", startDate, endDate));
 * ```
 */
export async function generateReportPDF(
  data: ReportExportData,
  options: ReportPDFExportOptions = {},
): Promise<JsPDFInstance> {
  const {
    summaryData,
    trendData,
    expenseCategories,
    categoryComparisonData,
    period,
    dateRange,
    currency,
    translations,
  } = data;

  const { jsPDF: JsPDF, autoTable } = await loadJsPDF();

  // Create new PDF document (A4 size, portrait)
  const pdf = new JsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Build PDF sections
  let yPosition = addHeader(pdf, period, dateRange, translations);
  yPosition = addSummarySection(pdf, summaryData, yPosition, translations);
  yPosition = addMonthlyBreakdownTable(pdf, autoTable, trendData, currency, yPosition, translations);
  yPosition = addExpenseCategoriesSection(
    pdf,
    autoTable,
    expenseCategories,
    currency,
    yPosition,
    translations,
  );

  // Add category comparison if available
  if (categoryComparisonData && categoryComparisonData.length > 0) {
    yPosition = addCategoryComparisonSection(
      pdf,
      autoTable,
      categoryComparisonData,
      currency,
      yPosition,
      translations,
    );
  }

  // Add footer to all pages
  addFooter(pdf, translations);

  return pdf;
}

/**
 * Generate filename for report PDF export
 *
 * @param period - Period type (e.g., "this-month", "last-month")
 * @param startDate - Start date of the report period
 * @param endDate - End date of the report period
 * @param customFileName - Optional custom filename (without extension)
 * @returns Generated filename with .pdf extension
 *
 * @example
 * ```typescript
 * const filename = generateReportPDFFilename("this-month", startDate, endDate);
 * // Returns: "financial-report_this-month_2026-02-01.pdf"
 *
 * const customFilename = generateReportPDFFilename("custom", startDate, endDate, "My Report");
 * // Returns: "My Report.pdf"
 * ```
 */
export function generateReportPDFFilename(
  period: string,
  startDate: Date,
  endDate: Date,
  customFileName?: string,
): string {
  if (customFileName) {
    // Remove .pdf extension if already present
    const sanitized = customFileName.replace(/\.pdf$/i, "");
    return `${sanitized}.pdf`;
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const periodLabel = period.replace(/-/g, "_");

  // Format date range for filename
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  return `financial-report_${periodLabel}_${startDateStr}_to_${endDateStr}_${dateStr}.pdf`;
}

/**
 * Trigger PDF download in browser
 *
 * @param pdf - jsPDF document instance
 * @param filename - Name for downloaded file
 *
 * @example
 * ```typescript
 * const pdf = generateReportPDF(data);
 * downloadPDF(pdf, "my-report.pdf");
 * ```
 */
export function downloadPDF(pdf: JsPDFInstance, filename: string): void {
  pdf.save(filename);
}

/**
 * Export report to PDF with a single function call
 * Combines generation, filename creation, and download
 *
 * @param data - Report data to export
 * @param options - Export options including period, date range, and optional custom filename
 *
 * @example
 * ```typescript
 * exportReportToPDF(reportData, {
 *   period: "this-month",
 *   startDate: new Date("2026-02-01"),
 *   endDate: new Date("2026-02-28"),
 *   includeCharts: false,
 * });
 * ```
 */
export async function exportReportToPDF(
  data: ReportExportData,
  options: ReportPDFExportOptions & {
    period: string;
    startDate: Date;
    endDate: Date;
  },
): Promise<void> {
  const pdf = await generateReportPDF(data, options);
  const filename = generateReportPDFFilename(
    options.period,
    options.startDate,
    options.endDate,
    options.customFileName,
  );
  downloadPDF(pdf, filename);
}
