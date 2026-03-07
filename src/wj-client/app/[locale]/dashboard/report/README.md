# Report Page Export Features

## Overview

The report page supports exporting financial data in three formats:
- **CSV**: Universal spreadsheet format
- **PDF**: Professional document format with tables and styling
- **Excel**: Native Excel format with multiple sheets and formatting

## Export Data

The export includes the following data from the current report view:

### Summary Section
- Total Income
- Total Expenses
- Net Savings
- Savings Rate
- Top Expense Category

### Monthly Breakdown
- Monthly income, expenses, and net savings
- Savings rate per month

### Expense Categories
- Category breakdown with amounts and percentages
- Color-coded by category

### Category Comparison (if enabled)
- Current period vs previous period comparison
- Change amount and percentage

## Usage

### Basic Export

1. Click the "Export" button in the top-right of the report page
2. Select export format (CSV, PDF, or Excel)
3. Select date range (optional, defaults to current period)
4. Click "Export" to download the file

### Filtered Export

To export only specific categories:

1. Click the "Export" button
2. In the Categories section, select specific categories
3. Choose export format
4. Click "Export"

### Custom File Name

1. Click the "Export" button
2. Enter a custom file name in the "File Name" field
3. Click "Export"

## Technical Details

### Export Utilities

- **PDF Export**: `src/wj-client/utils/export/report-pdf-export.ts`
  - Uses jsPDF and jsPDF-autotable
  - Generates professional PDF with brand colors

- **Excel Export**: `src/wj-client/utils/export/report-excel-export.ts`
  - Uses ExcelJS
  - Creates multiple sheets for different data views

- **Data Preparation**: `src/wj-client/app/dashboard/report/export-utils.ts`
  - Transforms page state into export format

### Data Flow

```
Report Page State
    ↓
prepareReportExportData()
    ↓
exportReportToPDF() / exportReportToExcel()
    ↓
Browser Download
```

## File Naming

Default file names follow the pattern:
- PDF: `financial-report_{period}_{start-date}_to_{end-date}_{export-date}.pdf`
- Excel: `financial-report_{period}_{start-date}_to_{end-date}_{export-date}.xlsx`

Example: `financial-report_this-month_2026-02-01_to_2026-02-28_2026-02-09.pdf`

## Dependencies

- jsPDF ^4.1.0
- jspdf-autotable ^5.0.7
- ExcelJS ^4.4.0
