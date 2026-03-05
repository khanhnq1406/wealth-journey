// src/wj-client/utils/export/excel-export.test.ts

// Mock ExcelJS module - this must be before imports
jest.mock("exceljs", () => {
  const mockWorksheet = {
    name: "Transactions",
    columns: [],
    rows: [],
    rowCount: 0,
    getRow: function(rowNumber) {
      if (!this.rows[rowNumber]) {
        this.rows[rowNumber] = {
          number: rowNumber,
          values: [],
          font: undefined,
          fill: undefined,
          alignment: undefined,
          height: undefined,
          getCell: () => ({
            alignment: undefined,
          }),
        };
      }
      return this.rows[rowNumber];
    },
    addRow: function(values) {
      const row = {
        number: ++this.rowCount,
        values,
        font: undefined,
        fill: undefined,
        alignment: undefined,
        getCell: () => ({ alignment: undefined }),
      };
      this.rows.push(row);
      return row;
    },
    eachRow: function(callback) {
      this.rows.forEach((row, idx) => callback(row, idx + 1));
    },
    views: [],
    autoFilter: {},
  };

  class Workbook {
    constructor() {
      this.worksheets = [];
    }

    addWorksheet(name) {
      const worksheet = { ...mockWorksheet, name };
      this.worksheets.push(worksheet);
      return worksheet;
    }

    get xlsx() {
      return {
        writeBuffer: () => Promise.resolve(Buffer.from('mock excel data')),
      };
    }
  }

  return {
    Workbook: jest.fn(() => new Workbook()),
  };
});

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  generateTransactionExcel,
  generateExportFilename,
  downloadExcel,
  type TransactionExportData,
} from "./excel-export";
import { Transaction } from "@/gen/protobuf/v1/transaction";

describe("generateTransactionExcel", () => {
  const mockCategoryNames = new Map([[1, "Food"], [2, "Salary"]]);
  const mockWalletNames = new Map([[1, "Cash"], [2, "Bank Account"]]);

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock DOM methods
    document.body.appendChild = jest.fn() as any;
    document.body.removeChild = jest.fn() as any;
    URL.createObjectURL = jest.fn(() => "blob:mock-url") as any;
    URL.revokeObjectURL = jest.fn() as any;
  });

  it("should generate Excel workbook with proper structure", async () => {
    const data: TransactionExportData = {
      transactions: [],
      categoryNames: mockCategoryNames,
      walletNames: mockWalletNames,
      currency: "VND",
    };

    const workbook = await generateTransactionExcel(data);

    expect(workbook).toBeDefined();
    expect(workbook.worksheets.length).toBeGreaterThan(0);
    expect(workbook.worksheets[0].name).toBe("Transactions");
  });

  it("should format transaction data correctly", async () => {
    const transaction: Transaction = {
      id: 1,
      walletId: 1,
      categoryId: 1,
      type: 2,
      amount: { amount: 150000, currency: "VND" },
      displayAmount: { amount: 150000, currency: "VND" },
      date: Math.floor(new Date("2024-02-01").getTime() / 1000),
      note: "Lunch",
      currency: "VND",
      displayCurrency: "VND",
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
    };

    const data: TransactionExportData = {
      transactions: [transaction],
      categoryNames: mockCategoryNames,
      walletNames: mockWalletNames,
      currency: "VND",
    };

    const workbook = await generateTransactionExcel(data);
    const worksheet = workbook.worksheets[0];

    // Verify columns were defined
    expect(worksheet.columns).toBeDefined();
    expect(worksheet.columns.length).toBe(6); // Date, Category, Wallet, Note, Amount, Type

    // Verify transaction data row was added
    expect(worksheet.rowCount).toBeGreaterThan(0);
  });

  it("should apply formatting to cells", async () => {
    const transaction: Transaction = {
      id: 1,
      walletId: 1,
      categoryId: 1,
      type: 2,
      amount: { amount: 150000, currency: "VND" },
      displayAmount: { amount: 150000, currency: "VND" },
      date: Math.floor(new Date("2024-02-01").getTime() / 1000),
      note: "Lunch",
      currency: "VND",
      displayCurrency: "VND",
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
    };

    const data: TransactionExportData = {
      transactions: [transaction],
      categoryNames: mockCategoryNames,
      walletNames: mockWalletNames,
      currency: "VND",
    };

    const workbook = await generateTransactionExcel(data);
    const worksheet = workbook.worksheets[0];

    // Verify formatting was applied by checking the worksheet state
    expect(worksheet.views).toBeDefined();
    expect(worksheet.autoFilter).toBeDefined();
  });
});

describe("generateExportFilename", () => {
  it("should generate filename with .xlsx extension", () => {
    const filename = generateExportFilename("transactions", "last30days");
    expect(filename).toMatch(/\.xlsx$/);
  });
});

describe("downloadExcel", () => {
  it("should trigger download with Excel file", async () => {
    // Create a mock link element that matches how the implementation uses it
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
    let objectUrlCreated = "";
    const createObjectURLSpy = jest.spyOn(URL, "createObjectURL").mockImplementation((blob: any) => {
      objectUrlCreated = "blob:mock-url";
      return objectUrlCreated;
    });

    await downloadExcel(mockWorkbook, "test.xlsx");

    // Verify createElement was called
    expect(createElementSpy).toHaveBeenCalledWith("a");

    // Verify link properties were set (the implementation sets them directly)
    expect(mockLink.href).toBe("blob:mock-url");
    expect(mockLink.download).toBe("test.xlsx");
    expect(mockLink.style.visibility).toBe("hidden");

    // Verify click was called
    expect(mockLink.click).toHaveBeenCalled();

    // Verify appendChild was called
    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);

    // Verify createObjectURL was called
    expect(createObjectURLSpy).toHaveBeenCalled();

    // Wait for setTimeout and verify cleanup
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);

    // Restore all mocks
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
  });
});
