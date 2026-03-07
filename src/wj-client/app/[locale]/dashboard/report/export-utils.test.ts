import { prepareReportExportData } from "./export-utils";
import {
  ReportExportData,
  SummaryData,
  TrendData,
  ExpenseCategoryData,
  CategoryComparisonData,
} from "@/features/report/utils/export/report-pdf-export";

describe("prepareReportExportData", () => {
  it("should transform report page data into ReportExportData format", () => {
    // Mock input data matching the report page state
    const mockSummaryData: SummaryData = {
      totalIncome: 100000,
      totalExpenses: 75000,
      netSavings: 25000,
      savingsRate: 25,
      topExpenseCategory: { name: "Food", amount: 30000 },
      currency: "VND",
    };

    const mockTrendData: TrendData[] = [
      {
        month: "Jan",
        income: 50000,
        expenses: 40000,
        net: 10000,
        savingsRate: 20,
      },
      {
        month: "Feb",
        income: 50000,
        expenses: 35000,
        net: 15000,
        savingsRate: 30,
      },
    ];

    const mockExpenseCategories: ExpenseCategoryData[] = [
      { name: "Food", value: 30000, color: "#008148", percentage: 40 },
      { name: "Transport", value: 20000, color: "#22C55E", percentage: 26.7 },
      { name: "Entertainment", value: 15000, color: "#14B8A6", percentage: 20 },
    ];

    const mockCategoryComparison: CategoryComparisonData[] = [
      {
        category: "Food",
        thisMonth: 30000,
        lastMonth: 25000,
        change: 5000,
        changePercentage: 20,
      },
    ];

    const period = "this-month";
    const dateRange = { start: new Date("2026-02-01"), end: new Date("2026-02-28") };

    const result = prepareReportExportData(
      mockSummaryData,
      mockTrendData,
      mockExpenseCategories,
      mockCategoryComparison,
      period,
      dateRange,
    );

    // Verify the result matches ReportExportData interface
    expect(result).toEqual({
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      categoryComparisonData: mockCategoryComparison,
      period,
      dateRange,
      currency: "VND",
    } as ReportExportData);
  });

  it("should handle optional categoryComparisonData", () => {
    const mockSummaryData: SummaryData = {
      totalIncome: 100000,
      totalExpenses: 75000,
      netSavings: 25000,
      savingsRate: 25,
      topExpenseCategory: null,
      currency: "VND",
    };

    const result = prepareReportExportData(
      mockSummaryData,
      [],
      [],
      undefined, // No comparison data
      "this-month",
      { start: new Date(), end: new Date() },
    );

    expect(result.categoryComparisonData).toBeUndefined();
  });
});
