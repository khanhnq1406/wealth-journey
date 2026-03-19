// src/wj-client/hooks/useExportTransactions.ts
import { useState, useCallback } from "react";
import { ExportOptions } from "@/components/export/ExportDialog";
import { Transaction } from "@/gen/protobuf/v1/transaction";
import {
  getDateRangeTimestamps,
  generateTransactionCSV,
  generateExportFilename as generateCSVFilename,
  downloadCSV,
  type TransactionExportData,
} from "@/features/report/utils/export/transaction-export";
import {
  generateTransactionPDF,
  generateExportFilename as generatePDFFilename,
  downloadPDF,
  type PDFExportOptions,
} from "@/features/report/utils/export/pdf-export";
import {
  generateTransactionExcel,
  generateExportFilename as generateExcelFilename,
  downloadExcel,
} from "@/features/report/utils/export/excel-export";

// API configuration
const API_BASE_URL =
  `${process.env.NEXT_PUBLIC_API_URL}/api` || "http://localhost:5000/api";
const LOCAL_STORAGE_TOKEN_NAME = "token";

// Helper to get auth token
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
}

/**
 * Capture chart element as base64 image using html2canvas
 * @returns Base64 image data or undefined if chart not found or capture fails
 */
async function captureChartAsImage(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  try {
    // Dynamically import html2canvas to avoid SSR issues
    const html2canvas = (await import("html2canvas")).default;

    // Find chart container element
    const chartElement = document.querySelector("[data-chart-container]");
    if (!chartElement) {
      console.warn("Chart element not found for PDF export");
      return undefined;
    }

    // Capture chart as canvas
    const canvas = await html2canvas(chartElement as HTMLElement, {
      backgroundColor: "#ffffff",
    } as any);

    // Convert to base64
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Failed to capture chart for PDF export:", error);
    return undefined;
  }
}

interface UseExportTransactionsOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useExportTransactions(options?: UseExportTransactionsOptions) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({
    current: 0,
    total: 3,
  });

  const exportTransactions = useCallback(
    async (exportOptions: ExportOptions) => {
      setIsExporting(true);
      setExportProgress({ current: 0, total: 3 }); // 3 steps: fetch, filter, generate

      try {
        // Step 1: Fetch transactions
        setExportProgress({ current: 1, total: 3 });
        const { startDate, endDate } = getDateRangeTimestamps(
          exportOptions.dateRange,
        );

        // Use custom dates if provided
        const apiStartDate =
          exportOptions.customStartDate !== undefined
            ? Math.floor(exportOptions.customStartDate.getTime() / 1000)
            : startDate;
        const apiEndDate =
          exportOptions.customEndDate !== undefined
            ? Math.floor(exportOptions.customEndDate.getTime() / 1000)
            : endDate;

        // Build query parameters using the correct format expected by the backend
        // The backend uses underscore_case parameters like start_date, end_date, page_size, etc.
        const params = new URLSearchParams();
        params.append("page", "1");
        params.append("page_size", "10000"); // Large page size for export
        params.append("order_by", "date");
        params.append("order", "desc");

        // Add date range filters if provided
        if (apiStartDate !== undefined) {
          params.append("start_date", apiStartDate.toString());
        }
        if (apiEndDate !== undefined) {
          params.append("end_date", apiEndDate.toString());
        }

        // Get auth token
        const token = getAuthToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Fetch all transactions matching date range
        const response = await fetch(
          `${API_BASE_URL}/v1/transactions?${params}`,
          {
            headers,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch transactions: ${response.statusText}`,
          );
        }

        const transactionsData = await response.json();
        const transactions: Transaction[] =
          transactionsData?.transactions || [];

        if (transactions.length === 0) {
          throw new Error(
            "No transactions to export with the selected filters",
          );
        }

        // Step 2: Apply filters and fetch lookup data
        setExportProgress({ current: 2, total: 3 });

        // Apply category filter client-side if specified
        let filteredTransactions = transactions;
        if (exportOptions.includeCategories.length > 0) {
          const categoryIds = new Set(
            exportOptions.includeCategories
              .map((id) => parseInt(id, 10))
              .filter((id) => !isNaN(id)),
          );
          filteredTransactions = transactions.filter((t) =>
            categoryIds.has(t.categoryId),
          );
        }

        if (filteredTransactions.length === 0) {
          throw new Error("No transactions match the selected filters");
        }

        // Get categories and wallets for name mapping
        const [categoriesResponse, walletsResponse] = await Promise.all([
          fetch(
            `${API_BASE_URL}/v1/categories?page=1&page_size=100&order_by=id&order=asc`,
            {
              headers,
            },
          ),
          fetch(
            `${API_BASE_URL}/v1/wallets?page=1&page_size=100&order_by=id&order=asc`,
            {
              headers,
            },
          ),
        ]);

        if (!categoriesResponse.ok) {
          throw new Error(
            `Failed to fetch categories: ${categoriesResponse.statusText}`,
          );
        }
        if (!walletsResponse.ok) {
          throw new Error(
            `Failed to fetch wallets: ${walletsResponse.statusText}`,
          );
        }

        const [categoriesData, walletsData] = await Promise.all([
          categoriesResponse.json(),
          walletsResponse.json(),
        ]);

        // Create lookup maps
        const categoryNames = new Map<number, string>();
        categoriesData?.categories?.forEach((cat: any) => {
          categoryNames.set(cat.id, cat.name);
        });

        const walletNames = new Map<number, string>();
        walletsData?.wallets?.forEach((wallet: any) => {
          walletNames.set(wallet.id, wallet.walletName);
        });

        // Get currency from first transaction or default
        const currency = filteredTransactions[0]?.displayCurrency || "VND";

        // Prepare export data
        const exportData: TransactionExportData = {
          transactions: filteredTransactions,
          categoryNames,
          walletNames,
          currency,
        };

        // Step 3: Generate and download based on format
        setExportProgress({ current: 3, total: 3 });

        // Handle export based on format
        switch (exportOptions.format) {
          case "csv": {
            const csvContent = generateTransactionCSV(exportData);
            const fileName = generateCSVFilename(
              "transactions",
              exportOptions.dateRange,
              exportOptions.customStartDate,
              exportOptions.customEndDate,
              exportOptions.fileName,
            );
            downloadCSV(csvContent, fileName);
            break;
          }

          case "pdf": {
            // Capture chart if requested
            let chartImage: string | undefined;
            if (exportOptions.includeCharts) {
              chartImage = await captureChartAsImage();
            }

            const pdfOptions: PDFExportOptions = {
              includeCharts: exportOptions.includeCharts,
              customBranding: exportOptions.customBranding,
              chartImage,
            };

            const pdf = await generateTransactionPDF(exportData, pdfOptions);
            const fileName = generatePDFFilename(
              "transactions",
              exportOptions.dateRange,
              exportOptions.customStartDate,
              exportOptions.customEndDate,
              exportOptions.fileName,
            );
            downloadPDF(pdf, fileName);
            break;
          }

          case "excel": {
            const workbook = await generateTransactionExcel(exportData);
            const fileName = generateExcelFilename(
              "transactions",
              exportOptions.dateRange,
              exportOptions.customStartDate,
              exportOptions.customEndDate,
              exportOptions.fileName,
            );
            await downloadExcel(workbook, fileName);
            break;
          }

          default:
            throw new Error(`Unsupported export format: ${exportOptions.format}`);
        }

        options?.onSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Export failed");
        options?.onError?.(err);
        throw error;
      } finally {
        setIsExporting(false);
        setExportProgress({ current: 0, total: 0 });
      }
    },
    [options],
  );

  return { exportTransactions, isExporting, exportProgress };
}
