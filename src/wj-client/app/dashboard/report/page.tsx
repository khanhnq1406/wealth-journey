"use client";

/**
 * Enhanced Report Page with Comprehensive Data Visualization
 *
 * Phase 5 Refactoring: Mobile-optimized financial reports with charts
 *
 * Features:
 * - Period selector with presets and custom range
 * - Summary cards with animated numbers and sparklines
 * - Expense breakdown chart (donut)
 * - Income vs Expense trend (line chart)
 * - Category breakdown (bar chart)
 * - Export options
 */

import { useState, useMemo, useCallback } from "react";
import { BaseCard } from "@/components/BaseCard";
import {
  formatCurrency,
  formatCurrencyCompact,
  parseAmount,
} from "@/utils/currency-formatter";
import {
  useQueryGetFinancialReport,
  useQueryGetCategoryBreakdown,
  useQueryListCategories,
} from "@/utils/generated/hooks";
import { exportFinancialReportToCSV } from "@/utils/csv-export";
import {
  exportReportToPDF,
  exportReportToExcel,
  type ReportExportData,
} from "@/features/report/utils/export";
import { prepareReportExportData } from "./export-utils";
import { PeriodSelector, PeriodType, DateRange } from "./PeriodSelector";
import { SummaryCards, FinancialSummaryData } from "./SummaryCards";
import { LineChart, BarChart, DonutChart } from "@/components/charts";
import { DonutChartSVG } from "@/components/charts/DonutChartSVG";
import { motion } from "framer-motion";
import { ExportOptions, ExportButton } from "@/components/export/ExportDialog";
import { FullPageLoading } from "@/components/loading/FullPageLoading";
import {
  getDateRangeForPeriod,
  calculateSummaryData,
  calculateTrendData,
  toUnixTimestamp,
  getReportCurrency,
  getCategoryColor,
  getPreviousPeriodRange,
} from "./data-utils";
import {
  CategoryBreakdownItem,
  CategoryType,
} from "@/gen/protobuf/v1/transaction";

export default function ReportPageEnhanced() {
  const [selectedPeriod, setSelectedPeriod] =
    useState<PeriodType>("this-month");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);
  const [selectedWalletIds] = useState<number[]>([]);

  // Calculate date range for the selected period
  const dateRange = useMemo(
    () => getDateRangeForPeriod(selectedPeriod, customRange),
    [selectedPeriod, customRange],
  );

  // Calculate previous period date range for comparison
  const previousPeriodRange = useMemo(
    () => getPreviousPeriodRange(selectedPeriod, customRange),
    [selectedPeriod, customRange],
  );

  // Determine year for API call
  const reportYear = useMemo(() => dateRange.start.getFullYear(), [dateRange]);

  // Determine year for previous period API call
  const previousReportYear = useMemo(
    () => previousPeriodRange.startDate.getFullYear(),
    [previousPeriodRange],
  );

  // Fetch financial report data
  const {
    data: reportData,
    isLoading: isReportLoading,
    error: reportError,
  } = useQueryGetFinancialReport(
    {
      year: reportYear,
      walletIds: selectedWalletIds.length > 0 ? selectedWalletIds : [],
    },
    {
      refetchOnMount: "always",
      enabled: !!selectedPeriod,
    },
  );

  // Fetch category breakdown data
  const {
    data: categoryBreakdown,
    isLoading: isCategoryLoading,
    error: categoryError,
  } = useQueryGetCategoryBreakdown(
    {
      startDate: toUnixTimestamp(dateRange.start),
      endDate: toUnixTimestamp(dateRange.end),
      walletIds: selectedWalletIds.length > 0 ? selectedWalletIds : [],
    },
    {
      refetchOnMount: "always",
      enabled: !!selectedPeriod,
    },
  );

  // Fetch previous period category breakdown data for comparison
  const {
    data: previousCategoryBreakdown,
    isLoading: isPreviousCategoryLoading,
  } = useQueryGetCategoryBreakdown(
    {
      startDate: toUnixTimestamp(previousPeriodRange.startDate),
      endDate: toUnixTimestamp(previousPeriodRange.endDate),
      walletIds: selectedWalletIds.length > 0 ? selectedWalletIds : [],
    },
    {
      refetchOnMount: "always",
      enabled: compareWithPrevious && !!selectedPeriod,
    },
  );

  // Fetch categories for export dialog
  const { data: categoriesData } = useQueryListCategories(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  // Combined loading and error states
  const isLoading = isReportLoading || isCategoryLoading;
  const error = reportError || categoryError;

  // Get currency from report data
  const currency = useMemo(() => getReportCurrency(reportData), [reportData]);

  // Transform categories data for export dialog
  const categoriesForExport = useMemo(() => {
    return (
      categoriesData?.categories?.map((cat) => ({
        id: cat.id?.toString() || "",
        name: cat.name || "Uncategorized",
      })) || []
    );
  }, [categoriesData]);

  // Handle period change
  const handlePeriodChange = useCallback(
    (period: PeriodType, range?: DateRange) => {
      setSelectedPeriod(period);
      setCustomRange(range);
      // Refetch will be triggered automatically by dateRange dependency
    },
    [],
  );

  // Calculate summary data from API response
  const summaryData: FinancialSummaryData = useMemo(() => {
    const baseSummary = calculateSummaryData(
      reportData,
      selectedPeriod,
      customRange,
    );

    // Add history data for sparklines
    const trendDataPoints = calculateTrendData(
      reportData,
      selectedPeriod,
      customRange,
    );
    const incomeHistory = trendDataPoints.map((d) => ({
      value: d.income,
      date: d.month,
    }));
    const expenseHistory = trendDataPoints.map((d) => ({
      value: d.expenses,
      date: d.month,
    }));

    // Get top expense category from category breakdown
    let topExpenseCategory: { name: string; amount: number } | undefined;
    if (
      categoryBreakdown?.categories &&
      categoryBreakdown.categories.length > 0
    ) {
      const expenses = categoryBreakdown.categories
        .filter(
          (cat: CategoryBreakdownItem) =>
            cat.type === CategoryType.CATEGORY_TYPE_EXPENSE,
        )
        .sort(
          (a: CategoryBreakdownItem, b: CategoryBreakdownItem) =>
            (b.displayAmount?.amount || b.totalAmount?.amount || 0) -
            (a.displayAmount?.amount || a.totalAmount?.amount || 0),
        );

      if (expenses.length > 0) {
        topExpenseCategory = {
          name: expenses[0].categoryName || "Unknown",
          amount:
            expenses[0].displayAmount?.amount ||
            expenses[0].totalAmount?.amount ||
            0,
        };
      }
    }

    return {
      ...baseSummary,
      topExpenseCategory,
      currency,
      incomeHistory,
      expenseHistory,
    };
  }, [reportData, selectedPeriod, customRange, categoryBreakdown, currency]);

  // Process expense category breakdown from API
  const expenseCategories = useMemo(() => {
    if (!categoryBreakdown?.categories) {
      return [];
    }

    return categoryBreakdown.categories
      .filter(
        (cat: CategoryBreakdownItem) =>
          cat.type === CategoryType.CATEGORY_TYPE_EXPENSE,
      )
      .sort(
        (a: CategoryBreakdownItem, b: CategoryBreakdownItem) =>
          (b.displayAmount?.amount || b.totalAmount?.amount || 0) -
          (a.displayAmount?.amount || a.totalAmount?.amount || 0),
      )
      .map((cat: CategoryBreakdownItem, index: number) => ({
        id: cat.categoryId?.toString() || "",
        name: cat.categoryName || "Unknown",
        value: parseAmount(cat.displayAmount?.amount || cat.totalAmount?.amount),
        color: getCategoryColor(index),
      }));
  }, [categoryBreakdown]);

  // Calculate trend data from API response (convert to format expected by LineChart)
  const trendData = useMemo(() => {
    const rawTrendData = calculateTrendData(
      reportData,
      selectedPeriod,
      customRange,
    );
    // Convert to format with index signature for LineChart
    return rawTrendData.map((d) => ({
      ...d,
    })) as Array<
      (typeof rawTrendData)[0] & { [key: string]: string | number | undefined }
    >;
  }, [reportData, selectedPeriod, customRange]);

  // Calculate category comparison data (current vs previous period)
  const categoryComparisonData = useMemo(() => {
    if (!categoryBreakdown?.categories) {
      return [];
    }

    // Current period categories
    const currentCategories = categoryBreakdown.categories
      .filter(
        (cat: CategoryBreakdownItem) =>
          cat.type === CategoryType.CATEGORY_TYPE_EXPENSE,
      )
      .map((cat: CategoryBreakdownItem) => ({
        id: cat.categoryId?.toString() || "",
        name: cat.categoryName || "Unknown",
        amount: parseAmount(cat.displayAmount?.amount || cat.totalAmount?.amount),
      }));

    // Previous period categories (if comparison is enabled and data is available)
    const previousCategoriesMap = new Map<string, number>();
    if (compareWithPrevious && previousCategoryBreakdown?.categories) {
      previousCategoryBreakdown.categories
        .filter(
          (cat: CategoryBreakdownItem) =>
            cat.type === CategoryType.CATEGORY_TYPE_EXPENSE,
        )
        .forEach((cat: CategoryBreakdownItem) => {
          previousCategoriesMap.set(
            cat.categoryName || "Unknown",
            parseAmount(cat.displayAmount?.amount || cat.totalAmount?.amount),
          );
        });
    }

    // Create comparison data
    return currentCategories.map((cat) => {
      const lastMonth = compareWithPrevious
        ? previousCategoriesMap.get(cat.name) || 0
        : 0;
      const change = cat.amount - lastMonth;
      const changePercentage =
        lastMonth !== 0 ? Math.round((change / lastMonth) * 100) : 0;

      return {
        categoryId: cat.id,
        category: cat.name,
        thisMonth: cat.amount,
        lastMonth,
        change,
        changePercentage,
      };
    });
  }, [categoryBreakdown, previousCategoryBreakdown, compareWithPrevious]);

  // Handle export with dialog options
  const handleExport = useCallback(
    async (options: ExportOptions) => {
      try {
        // Validate data exists
        if (!reportData || reportData.totals?.length === 0) {
          alert(
            "No data available to export. Please select a different time range.",
          );
          return;
        }

        // Filter categories if specific ones were selected
        let filteredExpenseCategories = expenseCategories;
        let filteredCategoryComparison = categoryComparisonData;

        if (options.includeCategories && options.includeCategories.length > 0) {
          const selectedIds = new Set(options.includeCategories);
          filteredExpenseCategories = expenseCategories.filter((cat) =>
            selectedIds.has(cat.id),
          );
          filteredCategoryComparison = categoryComparisonData.filter((cat) =>
            selectedIds.has(cat.categoryId),
          );
        }

        // Prepare export data from current page state
        const exportData: ReportExportData = prepareReportExportData(
          {
            totalIncome: summaryData.totalIncome,
            totalExpenses: summaryData.totalExpenses,
            netSavings: summaryData.netSavings,
            savingsRate: summaryData.savingsRate,
            topExpenseCategory: summaryData.topExpenseCategory || null,
            currency: summaryData.currency,
          },
          trendData,
          filteredExpenseCategories,
          compareWithPrevious ? filteredCategoryComparison : undefined,
          selectedPeriod,
          dateRange,
        );

        switch (options.format) {
          case "csv":
            // Keep existing CSV export
            if (reportData) {
              exportFinancialReportToCSV(reportData, reportYear, currency);
            }
            break;
          case "pdf":
            // Export to PDF using prepared data
            exportReportToPDF(exportData, {
              period: selectedPeriod,
              startDate: dateRange.start,
              endDate: dateRange.end,
              includeCharts: options.includeCharts,
              customFileName: options.fileName,
            });
            break;
          case "excel":
            // Export to Excel using prepared data
            await exportReportToExcel(exportData, {
              period: selectedPeriod,
              startDate: dateRange.start,
              endDate: dateRange.end,
              customFileName: options.fileName,
            });
            break;
        }
      } catch (error) {
        console.error("Export error:", error);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to export. Please try again.",
        );
      }
    },
    [
      summaryData,
      trendData,
      expenseCategories,
      categoryComparisonData,
      compareWithPrevious,
      selectedPeriod,
      dateRange,
      reportData,
      reportYear,
      currency,
    ],
  );

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">
            Failed to Load Report
          </h2>
          <p className="text-neutral-600 mb-4">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return <FullPageLoading text="Loading financial report..." />;
  }

  return (
    <div className="flex flex-col gap-4 px-3 sm:px-6 py-3 sm:py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900">
          Financial Report
        </h1>
        <ExportButton
          onExport={handleExport}
          categories={categoriesForExport}
          className="w-fit"
        />
      </div>

      {/* Period Selector */}
      <div className="w-full">
        <PeriodSelector
          selectedPeriod={selectedPeriod}
          customRange={customRange}
          onPeriodChange={handlePeriodChange}
          showCompare={true}
          compareWithPrevious={compareWithPrevious}
          onCompareChange={setCompareWithPrevious}
        />
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <SummaryCards data={summaryData} />
      </motion.div>

      {/* No Data State */}
      {(!reportData?.walletData || reportData.walletData.length === 0) &&
        !isLoading && (
          <BaseCard className="p-8">
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 mx-auto text-neutral-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                No Data Available
              </h3>
              <p className="text-neutral-600">
                No transactions found for the selected period. Try selecting a
                different time range.
              </p>
            </div>
          </BaseCard>
        )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expense Breakdown - Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <BaseCard className="p-3 sm:p-4">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-3 sm:mb-4">
              Expense Breakdown
            </h3>
            <DonutChartSVG
              data={expenseCategories}
              innerRadiusPercent={0}
              height={260}
              showLegend={true}
              legendPosition="right"
            />
          </BaseCard>
        </motion.div>

        {/* Category Comparison - Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <BaseCard className="p-3 sm:p-4">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-3 sm:mb-4">
              Category Comparison
              {compareWithPrevious && (
                <span className="text-xs sm:text-sm font-normal text-neutral-600 ml-2">
                  vs Previous Period
                </span>
              )}
            </h3>
            <BarChart
              data={categoryComparisonData}
              xAxisKey="category"
              series={[
                {
                  dataKey: "thisMonth",
                  name: "This Month",
                  color: "#008148",
                },
                ...(compareWithPrevious
                  ? [
                      {
                        dataKey: "lastMonth",
                        name: "Last Month",
                        color: "#94A3B8",
                      } as const,
                    ]
                  : []),
              ]}
              height={260}
              showLegend={true}
              yAxisFormatter={(value) => formatCurrencyCompact(value, currency)}
              tooltipFormatter={(value) => [
                formatCurrency(value, currency),
                "",
              ]}
              xAxisFormatter={(label) => label}
            />
          </BaseCard>
        </motion.div>
      </div>

      {/* Income vs Expense Trend - Line Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <BaseCard className="p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-3 sm:mb-4">
            Income vs Expenses Trend
          </h3>
          <LineChart
            data={trendData}
            xAxisKey="month"
            series={[
              {
                dataKey: "income",
                name: "Income",
                color: "#22C55E",
                showArea: true,
                curveType: "monotone",
              },
              {
                dataKey: "expenses",
                name: "Expenses",
                color: "#DC2626",
                showArea: true,
                curveType: "monotone",
              },
              {
                dataKey: "net",
                name: "Net Savings",
                color: "#008148",
                showArea: false,
                curveType: "monotone",
                strokeWidth: 3,
              },
            ]}
            height={280}
            showGrid={true}
            showTooltip={true}
            showLegend={true}
            yAxisFormatter={(value) => formatCurrencyCompact(value, currency)}
            tooltipFormatter={(value) => [formatCurrency(value, currency), ""]}
          />
        </BaseCard>
      </motion.div>

      {/* Detailed Financial Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <BaseCard className="p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-3 sm:mb-4">
            Monthly Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-neutral-700">
                    Month
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-neutral-700">
                    Income
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-neutral-700">
                    Expenses
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-neutral-700">
                    Net Savings
                  </th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-neutral-700">
                    Savings Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium text-neutral-900">
                      {row.month}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-success-600 font-medium">
                      {formatCurrency(row.income, currency)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-danger-600 font-medium">
                      {formatCurrency(row.expenses, currency)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-primary-900 font-medium">
                      {formatCurrency(row.net, currency)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-neutral-600">
                      {row.income > 0
                        ? `${((row.net / row.income) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BaseCard>
      </motion.div>
    </div>
  );
}
