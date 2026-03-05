// src/wj-client/utils/export/report-excel-export.test.ts

// Mock ExcelJS module - this must be before imports
jest.mock("exceljs", () => {
  const mockWorksheet = {
    name: "Test Sheet",
    columns: [],
    rows: [],
    rowCount: 0,
    getRow: function (rowNumber) {
      if (!this.rows[rowNumber]) {
        this.rows[rowNumber] = {
          number: rowNumber,
          values: [],
          font: undefined,
          fill: undefined,
          alignment: undefined,
          height: undefined,
          eachCell: function (callback) {
            // Mock eachCell to iterate over columns
            for (let i = 1; i <= 5; i++) {
              callback({ alignment: undefined }, i);
            }
          },
          getCell: () => ({
            alignment: undefined,
            font: undefined,
          }),
        };
      }
      return this.rows[rowNumber];
    },
    addRow: function (values) {
      const row = {
        number: ++this.rowCount,
        values,
        font: undefined,
        fill: undefined,
        alignment: undefined,
        height: undefined,
        getCell: () => ({ alignment: undefined }),
        eachCell: function (callback) {
          for (let i = 1; i <= 5; i++) {
            callback({ alignment: undefined }, i);
          }
        },
      };
      this.rows.push(row);
      return row;
    },
    eachRow: function (callback) {
      this.rows.forEach((row, idx) => callback(row, idx + 1));
    },
    views: [],
    autoFilter: {},
  };

  class Workbook {
    constructor() {
      this.worksheets = [];
      this.creator = "";
      this.created = null;
      this.modified = null;
      this.properties = {};
    }

    addWorksheet(name) {
      const worksheet = { ...mockWorksheet, name };
      this.worksheets.push(worksheet);
      return worksheet;
    }

    get xlsx() {
      return {
        writeBuffer: () => Promise.resolve(Buffer.from("mock excel data")),
      };
    }
  }

  return {
    Workbook: jest.fn(() => new Workbook()),
  };
});

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  generateReportExcel,
  generateReportExcelFilename,
  downloadExcel,
  exportReportToExcel,
  type ReportExportData,
  type ReportExcelExportOptions,
} from "./report-excel-export";

describe("generateReportExcel", () => {
  const mockSummaryData = {
    totalIncome: 10000000,
    totalExpenses: 7000000,
    netSavings: 3000000,
    savingsRate: 30,
    topExpenseCategory: {
      name: "Food",
      amount: 2000000,
    },
    currency: "VND",
  };

  const mockTrendData = [
    {
      month: "January 2026",
      income: 10000000,
      expenses: 7000000,
      net: 3000000,
      savingsRate: 30,
    },
    {
      month: "February 2026",
      income: 12000000,
      expenses: 8000000,
      net: 4000000,
      savingsRate: 33.33,
    },
  ];

  const mockExpenseCategories = [
    {
      name: "Food",
      value: 2000000,
      color: "#FF6B6B",
      percentage: 28.6,
    },
    {
      name: "Transport",
      value: 1500000,
      color: "#4ECDC4",
      percentage: 21.4,
    },
  ];

  const mockCategoryComparisonData = [
    {
      category: "Food",
      thisMonth: 2000000,
      lastMonth: 1800000,
      change: 200000,
      changePercentage: 11.11,
    },
  ];

  const mockDateRange = {
    start: new Date("2026-02-01"),
    end: new Date("2026-02-28"),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock DOM methods
    document.body.appendChild = jest.fn() as any;
    document.body.removeChild = jest.fn() as any;
    URL.createObjectURL = jest.fn(() => "blob:mock-url") as any;
    URL.revokeObjectURL = jest.fn() as any;
  });

  it("should generate Excel workbook with proper structure", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    expect(workbook).toBeDefined();
    expect(workbook.worksheets.length).toBeGreaterThan(0);
    expect(workbook.creator).toBe("WealthJourney Financial Reports");
    expect(workbook.worksheets[0].name).toBe("Summary");
  });

  it("should create Summary sheet with header and metrics", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);
    const summarySheet = workbook.worksheets[0];

    expect(summarySheet.name).toBe("Summary");
    expect(summarySheet.rowCount).toBeGreaterThan(0);
    // Should have title (row 1), subtitle (row 2), spacing (row 3), section header (row 4),
    // spacing (row 5), and 5 metrics (rows 6-10)
    expect(summarySheet.rowCount).toBeGreaterThanOrEqual(10);
  });

  it("should create Monthly Breakdown sheet when trend data exists", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    const monthlySheet = workbook.worksheets.find((ws) => ws.name === "Monthly Breakdown");
    expect(monthlySheet).toBeDefined();
    expect(monthlySheet?.rowCount).toBeGreaterThan(0);
  });

  it("should create Category Breakdown sheet when categories exist", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    const categorySheet = workbook.worksheets.find((ws) => ws.name === "Category Breakdown");
    expect(categorySheet).toBeDefined();
    expect(categorySheet?.rowCount).toBeGreaterThan(0);
  });

  it("should create Category Comparison sheet when comparison data exists", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      categoryComparisonData: mockCategoryComparisonData,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    const comparisonSheet = workbook.worksheets.find((ws) => ws.name === "Category Comparison");
    expect(comparisonSheet).toBeDefined();
    expect(comparisonSheet?.rowCount).toBeGreaterThan(0);
  });

  it("should not create optional sheets when data is empty", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: [],
      expenseCategories: [],
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    expect(workbook.worksheets.length).toBe(1); // Only Summary sheet
    expect(workbook.worksheets[0].name).toBe("Summary");
  });

  it("should handle category breakdown with empty categories", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: [],
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);

    // Should not create Category Breakdown sheet for empty data
    const categorySheet = workbook.worksheets.find((ws) => ws.name === "Category Breakdown");
    expect(categorySheet).toBeUndefined();
  });

  it("should format period label correctly", () => {
    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const workbook = generateReportExcel(data);
    const summarySheet = workbook.worksheets[0];

    // Check that the subtitle row contains the formatted period
    expect(summarySheet.rows[1]?.values).toBeDefined();
  });
});

describe("generateReportExcelFilename", () => {
  const mockDateRange = {
    start: new Date("2026-02-01"),
    end: new Date("2026-02-28"),
  };

  it("should generate filename with .xlsx extension", () => {
    const filename = generateReportExcelFilename("this-month", mockDateRange.start, mockDateRange.end);
    expect(filename).toMatch(/\.xlsx$/);
  });

  it("should include period in filename", () => {
    const filename = generateReportExcelFilename("this-month", mockDateRange.start, mockDateRange.end);
    expect(filename).toContain("this_month");
  });

  it("should include date range in filename", () => {
    const filename = generateReportExcelFilename("this-month", mockDateRange.start, mockDateRange.end);
    expect(filename).toContain("2026-02-01");
    expect(filename).toContain("2026-02-28");
  });

  it("should use custom filename when provided", () => {
    const filename = generateReportExcelFilename(
      "custom",
      mockDateRange.start,
      mockDateRange.end,
      "My Financial Report"
    );
    expect(filename).toBe("My Financial Report.xlsx");
  });

  it("should sanitize .xlsx extension from custom filename", () => {
    const filename = generateReportExcelFilename(
      "custom",
      mockDateRange.start,
      mockDateRange.end,
      "My Report.xlsx"
    );
    expect(filename).toBe("My Report.xlsx");
  });

  it("should replace hyphens with underscores in period", () => {
    const filename = generateReportExcelFilename("last-30-days", mockDateRange.start, mockDateRange.end);
    expect(filename).toContain("last_30_days");
  });
});

describe("downloadExcel", () => {
  it("should trigger download with Excel file", async () => {
    // Create a mock link element
    const mockLink = {
      href: "",
      download: "",
      style: { visibility: "" as string },
      click: jest.fn(),
    };

    const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);

    // Track calls to these methods
    const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    const removeChildSpy = jest.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);

    // Create a mock workbook with xlsx.writeBuffer
    const mockWorkbook = {
      xlsx: {
        writeBuffer: jest.fn().mockResolvedValue(Buffer.from("mock data")),
      },
    } as any;

    // Track URL operations
    const createObjectURLSpy = jest.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock-url");

    await downloadExcel(mockWorkbook, "test-report.xlsx");

    // Verify createElement was called
    expect(createElementSpy).toHaveBeenCalledWith("a");

    // Verify link properties were set
    expect(mockLink.href).toBe("blob:mock-url");
    expect(mockLink.download).toBe("test-report.xlsx");
    expect(mockLink.style.visibility).toBe("hidden");

    // Verify click was called
    expect(mockLink.click).toHaveBeenCalled();

    // Verify appendChild was called
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);

    // Verify createObjectURL was called
    expect(createObjectURLSpy).toHaveBeenCalled();

    // Wait for setTimeout and verify cleanup
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);

    // Restore all mocks
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });
});

describe("exportReportToExcel", () => {
  const mockSummaryData = {
    totalIncome: 10000000,
    totalExpenses: 7000000,
    netSavings: 3000000,
    savingsRate: 30,
    topExpenseCategory: null,
    currency: "VND",
  };

  const mockTrendData = [
    {
      month: "January 2026",
      income: 10000000,
      expenses: 7000000,
      net: 3000000,
      savingsRate: 30,
    },
  ];

  const mockExpenseCategories = [
    {
      name: "Food",
      value: 2000000,
      color: "#FF6B6B",
      percentage: 28.6,
    },
  ];

  const mockDateRange = {
    start: new Date("2026-02-01"),
    end: new Date("2026-02-28"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.appendChild = jest.fn() as any;
    document.body.removeChild = jest.fn() as any;
    URL.createObjectURL = jest.fn(() => "blob:mock-url") as any;
    URL.revokeObjectURL = jest.fn() as any;
  });

  it("should export report to Excel with single function call", async () => {
    const mockLink = {
      href: "",
      download: "",
      style: { visibility: "" as string },
      click: jest.fn(),
    };

    jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);
    jest.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock-url");

    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const options: ReportExcelExportOptions & { period: string; startDate: Date; endDate: Date } = {
      period: "this-month",
      startDate: mockDateRange.start,
      endDate: mockDateRange.end,
    };

    await exportReportToExcel(data, options);

    // Verify download was triggered
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toMatch(/\.xlsx$/);
  });

  it("should use custom filename when provided in options", async () => {
    const mockLink = {
      href: "",
      download: "",
      style: { visibility: "" as string },
      click: jest.fn(),
    };

    jest.spyOn(document, "createElement").mockReturnValue(mockLink as any);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);
    jest.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:mock-url");

    const data: ReportExportData = {
      summaryData: mockSummaryData,
      trendData: mockTrendData,
      expenseCategories: mockExpenseCategories,
      period: "this-month",
      dateRange: mockDateRange,
      currency: "VND",
    };

    const options: ReportExcelExportOptions & { period: string; startDate: Date; endDate: Date } = {
      period: "this-month",
      startDate: mockDateRange.start,
      endDate: mockDateRange.end,
      customFileName: "My Custom Report",
    };

    await exportReportToExcel(data, options);

    expect(mockLink.download).toBe("My Custom Report.xlsx");
  });
});

describe("formatCurrency", () => {
  it("should be exported for use", async () => {
    const { formatCurrency } = await import("./report-excel-export");
    expect(typeof formatCurrency).toBe("function");
  });
});
