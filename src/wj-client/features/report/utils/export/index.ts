// src/wj-client/utils/export/index.ts

// =============================================================================
// CSV Export
// =============================================================================
export {
  getDateRangeTimestamps,
  generateTransactionCSV,
  downloadCSV,
  type TransactionExportData,
} from "./transaction-export";

// Filename generator - explicitly aliased for clarity
export { generateExportFilename as generateCSVFilename } from "./transaction-export";

// =============================================================================
// PDF Export
// =============================================================================
export {
  generateTransactionPDF,
  generateExportFilename as generatePDFFilename,
  downloadPDF,
  type PDFExportOptions,
} from "./pdf-export";

// =============================================================================
// Excel Export
// =============================================================================
export {
  generateTransactionExcel,
  generateExportFilename as generateExcelFilename,
  downloadExcel,
} from "./excel-export";

// =============================================================================
// Report PDF Export
// =============================================================================
export {
  generateReportPDF,
  generateReportPDFFilename,
  downloadPDF as downloadReportPDF,
  exportReportToPDF,
  formatCurrency as formatReportCurrency,
  type ReportExportData,
  type ReportPDFExportOptions,
  type SummaryData as ReportSummaryData,
  type TrendData as ReportTrendData,
  type ExpenseCategoryData as ReportExpenseCategoryData,
  type CategoryComparisonData as ReportCategoryComparisonData,
} from "./report-pdf-export";

// =============================================================================
// Report Excel Export
// =============================================================================
export {
  generateReportExcel,
  generateReportExcelFilename,
  downloadExcel as downloadReportExcel,
  exportReportToExcel,
  formatCurrency as formatReportExcelCurrency,
  type ReportExcelExportOptions,
} from "./report-excel-export";

// =============================================================================
// Legacy Exports
// =============================================================================
// Re-export existing financial report export
export { exportFinancialReportToCSV } from "@/utils/csv-export";
