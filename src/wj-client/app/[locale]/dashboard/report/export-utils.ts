/**
 * Report Export Utilities
 *
 * Functions to prepare report page data for PDF and Excel export.
 * Transforms the page state into the format expected by the export utilities.
 */

import type {
  ReportExportData,
  SummaryData,
  TrendData,
  ExpenseCategoryData,
  CategoryComparisonData,
} from "@/features/report/utils/export/report-pdf-export";

/**
 * Prepare report data for export
 *
 * Transforms the report page state into the ReportExportData format
 * expected by the PDF and Excel export utilities.
 *
 * @param summaryData - Summary statistics from the report
 * @param trendData - Monthly trend data
 * @param expenseCategories - Expense category breakdown
 * @param categoryComparisonData - Optional category comparison data
 * @param period - Period type label
 * @param dateRange - Date range for the report
 * @returns Formatted data ready for export
 *
 * @example
 * ```typescript
 * const exportData = prepareReportExportData(
 *   summaryData,
 *   trendData,
 *   expenseCategories,
 *   categoryComparisonData,
 *   "this-month",
 *   { start: new Date("2026-02-01"), end: new Date("2026-02-28") }
 * );
 *
 * // Use with PDF export
 * exportReportToPDF(exportData, {
 *   period: "this-month",
 *   startDate: exportData.dateRange.start,
 *   endDate: exportData.dateRange.end,
 * });
 *
 * // Use with Excel export
 * await exportReportToExcel(exportData, {
 *   period: "this-month",
 *   startDate: exportData.dateRange.start,
 *   endDate: exportData.dateRange.end,
 * });
 * ```
 */
export function prepareReportExportData(
  summaryData: SummaryData,
  trendData: TrendData[],
  expenseCategories: ExpenseCategoryData[],
  categoryComparisonData: CategoryComparisonData[] | undefined,
  period: string,
  dateRange: { start: Date; end: Date },
): ReportExportData {
  return {
    summaryData,
    trendData,
    expenseCategories,
    categoryComparisonData,
    period,
    dateRange,
    currency: summaryData.currency,
  };
}
