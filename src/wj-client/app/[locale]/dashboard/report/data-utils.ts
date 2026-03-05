/**
 * Report Data Utilities
 *
 * Utilities for transforming and calculating financial report data.
 * Provides functions for date range calculations, data aggregation,
 * and formatting for the report page components.
 */

import {
  GetFinancialReportResponse,
  MonthlyFinancialData,
} from "@/gen/protobuf/v1/transaction";
import { Money } from "@/gen/protobuf/v1/common";
import { formatCurrency, parseAmount } from "@/utils/currency-formatter";

// Re-export PeriodType and DateRange for convenience
export type { PeriodType, DateRange } from "./PeriodSelector";

// Import getDateRangeForPeriod from PeriodSelector
import { getDateRangeForPeriod as getPeriodRange } from "./PeriodSelector";
import type { PeriodType } from "./PeriodSelector";

/**
 * Get date range for a given period type
 * Wraps the PeriodSelector function to handle custom ranges
 *
 * @param period - The period type (this-month, last-month, etc.)
 * @param customRange - Optional custom date range for "custom" period
 * @returns Start and end dates for the period
 */
export function getDateRangeForPeriod(
  period: PeriodType,
  customRange?: { start: Date; end: Date }
): { start: Date; end: Date } {
  if (period === "custom" && customRange) {
    return customRange;
  }
  return getPeriodRange(period);
}

/**
 * Get previous period date range for comparison
 * Calculates the date range of the same duration immediately before the current period
 *
 * @param period - The period type (this-month, last-month, etc.)
 * @param customRange - Optional custom date range for "custom" period
 * @returns Start and end dates for the previous period
 */
export function getPreviousPeriodRange(
  period: PeriodType,
  customRange?: { start: Date; end: Date }
): { startDate: Date; endDate: Date } {
  const currentRange = getDateRangeForPeriod(period, customRange);
  const duration = currentRange.end.getTime() - currentRange.start.getTime();

  return {
    startDate: new Date(currentRange.start.getTime() - duration),
    endDate: new Date(currentRange.end.getTime() - duration),
  };
}

/**
 * Month names for display (3-letter abbreviations)
 */
export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Green color palette for charts (matching brand colors)
 */
export const GREEN_COLORS = [
  "#008148", // Brand primary
  "#22C55E", // Green 500
  "#14B8A6", // Teal 500
  "#06B6D4", // Cyan 500
  "#84CC16", // Lime 500
  "#10B981", // Emerald 500
  "#34D399", // Emerald 400
  "#6EE7B7", // Emerald 300
  "#94A3B8", // Slate 400 (for "others")
] as const;

/**
 * Summary data interface for report overview
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
 * Expense category data for donut chart
 */
export interface ExpenseCategoryData {
  name: string;
  value: number;
  color: string;
  percentage?: number;
}

/**
 * Category comparison data for bar chart
 */
export interface CategoryComparisonData {
  category: string;
  thisMonth: number;
  lastMonth: number;
  change?: number;
  changePercentage?: number;
}

/**
 * Trend data point for line/bar charts
 */
export interface TrendData {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate?: number;
}

/**
 * Extended trend data with full date information
 */
export interface TrendDataPoint extends TrendData {
  date: Date;
  monthIndex: number;
}

/**
 * Convert a Date object to Unix timestamp (seconds)
 *
 * @param date - Date to convert
 * @returns Unix timestamp in seconds
 */
export function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get money amount from Money object (handles undefined)
 *
 * @param money - Money object or undefined
 * @returns Amount in major currency units
 */
function getMoneyAmount(money: Money | undefined): number {
  if (!money) return 0;
  return parseAmount(money.amount);
}

/**
 * Calculate summary data from financial report
 *
 * @param reportData - Raw report data from API
 * @param period - Period type for filtering
 * @param customRange - Optional custom date range
 * @returns Calculated summary data
 */
export function calculateSummaryData(
  reportData: GetFinancialReportResponse | undefined,
  period: PeriodType,
  customRange?: { start: Date; end: Date }
): SummaryData {
  // Default values for empty data
  const defaultSummary: SummaryData = {
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    savingsRate: 0,
    topExpenseCategory: null,
    currency: "VND",
  };

  if (!reportData || !reportData.totals || reportData.totals.length === 0) {
    return defaultSummary;
  }

  // Get date range for filtering
  const { start, end } = getDateRangeForPeriod(period, customRange);
  const year = period.includes("last-year")
    ? start.getFullYear()
    : reportData.year;

  // Filter totals by date range
  // Note: First entry in totals array may be the aggregate (no month field), so filter it out
  const filteredTotals = reportData.totals.filter((monthly) => {
    // Skip entries without a month field (aggregate totals)
    if (monthly.month === undefined || monthly.month === null) {
      return false;
    }
    const monthlyDate = new Date(year, monthly.month, 1);
    return monthlyDate >= start && monthlyDate <= end;
  });

  if (filteredTotals.length === 0) {
    return defaultSummary;
  }

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;

  filteredTotals.forEach((monthly) => {
    totalIncome += getMoneyAmount(monthly.displayIncome || monthly.income);
    totalExpenses += getMoneyAmount(monthly.displayExpense || monthly.expense);
  });

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = calculateSavingsRate(totalIncome, totalExpenses);

  // Get currency from first non-zero income/expense
  let currency = "VND";
  const firstWithIncome = filteredTotals.find(
    (m) => m.displayIncome?.currency || m.income?.currency
  );
  if (firstWithIncome) {
    currency =
      firstWithIncome.displayIncome?.currency ||
      firstWithIncome.income?.currency ||
      "VND";
  }

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    topExpenseCategory: null, // Will be populated by category breakdown
    currency,
  };
}

/**
 * Calculate trend data from financial report
 *
 * @param reportData - Raw report data from API
 * @param period - Period type for filtering
 * @param customRange - Optional custom date range
 * @returns Array of trend data points
 */
export function calculateTrendData(
  reportData: GetFinancialReportResponse | undefined,
  period: PeriodType,
  customRange?: { start: Date; end: Date }
): TrendData[] {
  if (!reportData || !reportData.totals || reportData.totals.length === 0) {
    return [];
  }

  // Get date range for filtering
  // For single month periods (this-month, last-month), show year-to-date for better trend visualization
  let { start, end } = getDateRangeForPeriod(period, customRange);

  // Expand range for single month periods to show more context
  if (period === "this-month" || period === "last-month") {
    const year = start.getFullYear();
    // Show from start of year to end of selected period
    start = new Date(year, 0, 1);
  }

  const year = period.includes("last-year")
    ? start.getFullYear()
    : reportData.year;

  // Filter and map totals to trend data
  // Note: First entry in totals array may be the aggregate (no month field), so filter it out
  const trendData: TrendData[] = reportData.totals
    .filter((monthly) => {
      // Skip entries without a month field (aggregate totals)
      if (monthly.month === undefined || monthly.month === null) {
        return false;
      }
      const monthlyDate = new Date(year, monthly.month, 1);
      return monthlyDate >= start && monthlyDate <= end;
    })
    .map((monthly) => {
      const income = getMoneyAmount(monthly.displayIncome || monthly.income);
      const expenses = getMoneyAmount(
        monthly.displayExpense || monthly.expense
      );
      const net = income - expenses;

      return {
        month: MONTH_NAMES[monthly.month!] || `Month ${monthly.month! + 1}`,
        income,
        expenses,
        net,
        savingsRate: calculateSavingsRate(income, expenses),
      };
    });

  return trendData;
}

/**
 * Calculate savings rate as a percentage
 *
 * @param income - Total income
 * @param expenses - Total expenses
 * @returns Savings rate percentage (0-100)
 */
export function calculateSavingsRate(
  income: number,
  expenses: number
): number {
  if (income <= 0) return 0;
  const savings = income - expenses;
  return Math.round((savings / income) * 100);
}

/**
 * Get color from palette by index
 *
 * @param index - Index for color selection
 * @returns Hex color code
 */
export function getCategoryColor(index: number): string {
  return GREEN_COLORS[index % GREEN_COLORS.length];
}

/**
 * Format currency for display in reports
 *
 * @param amount - Amount in smallest currency unit
 * @param currency - Currency code
 * @returns Formatted currency string
 */
export function formatReportCurrency(
  amount: number,
  currency: string = "VND"
): string {
  return formatCurrency(amount, currency);
}

/**
 * Calculate percentage of total
 *
 * @param value - Value to calculate percentage for
 * @param total - Total value
 * @returns Percentage (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Sort categories by amount (descending)
 *
 * @param categories - Categories to sort
 * @returns Sorted categories
 */
export function sortCategoriesByAmount<T extends { amount: number }>(
  categories: T[]
): T[] {
  return [...categories].sort((a, b) => b.amount - a.amount);
}

/**
 * Get month name from month index (0-11)
 *
 * @param monthIndex - Month index (0 = January)
 * @returns Month name abbreviation
 */
export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] || `Month ${monthIndex + 1}`;
}

/**
 * Calculate month-over-month change
 *
 * @param current - Current month value
 * @param previous - Previous month value
 * @returns Change amount and percentage
 */
export function calculateMonthOverMonthChange(current: number, previous: number): {
  change: number;
  changePercentage: number;
} {
  const change = current - previous;
  const changePercentage =
    previous !== 0 ? Math.round((change / previous) * 100) : 0;
  return { change, changePercentage };
}

/**
 * Aggregate monthly data for a specific month across all data
 *
 * @param reportData - Report data
 * @param monthIndex - Month index (0-11)
 * @returns Aggregated data for the month
 */
export function aggregateMonthData(
  reportData: GetFinancialReportResponse | undefined,
  monthIndex: number
): { income: number; expenses: number; net: number } | null {
  if (!reportData || !reportData.totals) {
    return null;
  }

  const monthlyData = reportData.totals.find((m) => m.month === monthIndex);
  if (!monthlyData) {
    return null;
  }

  const income = getMoneyAmount(monthlyData.displayIncome || monthlyData.income);
  const expenses = getMoneyAmount(
    monthlyData.displayExpense || monthlyData.expense
  );

  return {
    income,
    expenses,
    net: income - expenses,
  };
}

/**
 * Filter monthly totals by date range
 *
 * @param totals - Array of monthly financial data
 * @param startDate - Start date
 * @param endDate - End date
 * @param year - Year for the data
 * @returns Filtered monthly data
 */
export function filterMonthlyTotalsByDateRange(
  totals: MonthlyFinancialData[],
  startDate: Date,
  endDate: Date,
  year: number
): MonthlyFinancialData[] {
  return totals.filter((monthly) => {
    // Skip entries without a month field (aggregate totals)
    if (monthly.month === undefined || monthly.month === null) {
      return false;
    }
    const monthlyDate = new Date(year, monthly.month, 1);
    return monthlyDate >= startDate && monthlyDate <= endDate;
  });
}

/**
 * Get top N expense categories
 *
 * @param categories - All expense categories
 * @param limit - Maximum number to return
 * @returns Top N categories
 */
export function getTopCategories<T extends { amount: number }>(
  categories: T[],
  limit: number = 5
): T[] {
  return sortCategoriesByAmount(categories).slice(0, limit);
}

/**
 * Create category comparison data for bar chart
 *
 * @param currentPeriodCategories - Categories from current period
 * @param previousPeriodCategories - Categories from previous period
 * @returns Comparison data array
 */
export function createCategoryComparisonData(
  currentPeriodCategories: Array<{ name: string; amount: number }>,
  previousPeriodCategories: Array<{ name: string; amount: number }>
): CategoryComparisonData[] {
  const previousMap = new Map(
    previousPeriodCategories.map((c) => [c.name, c.amount])
  );

  return currentPeriodCategories.map((category) => {
    const lastMonth = previousMap.get(category.name) || 0;
    const change = category.amount - lastMonth;
    const changePercentage =
      lastMonth !== 0 ? Math.round((change / lastMonth) * 100) : 0;

    return {
      category: category.name,
      thisMonth: category.amount,
      lastMonth,
      change,
      changePercentage,
    };
  });
}

/**
 * Validate report data response
 *
 * @param reportData - Report data to validate
 * @returns True if data is valid
 */
export function isValidReportData(
  reportData: GetFinancialReportResponse | undefined
): boolean {
  return !!(
    reportData &&
    reportData.success &&
    reportData.totals &&
    reportData.totals.length > 0
  );
}

/**
 * Get default currency from report data
 *
 * @param reportData - Report data
 * @returns Currency code (defaults to VND)
 */
export function getReportCurrency(
  reportData: GetFinancialReportResponse | undefined
): string {
  if (!reportData || !reportData.totals || reportData.totals.length === 0) {
    return "VND";
  }

  const firstWithDisplay = reportData.totals.find(
    (m) => m.displayIncome?.currency || m.displayExpense?.currency
  );

  return (
    firstWithDisplay?.displayIncome?.currency ||
    firstWithDisplay?.displayExpense?.currency ||
    firstWithDisplay?.income?.currency ||
    firstWithDisplay?.expense?.currency ||
    "VND"
  );
}
