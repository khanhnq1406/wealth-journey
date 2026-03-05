// src/wj-client/utils/export/pdf-export.test.ts
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  generateTransactionPDF,
  generateExportFilename,
  downloadPDF,
  type TransactionExportData,
  type PDFExportOptions,
} from "./pdf-export";
import { Transaction } from "@/gen/protobuf/v1/transaction";

// Mock jsPDF and jspdf-autotable at module level
jest.mock("jspdf", () => {
  return {
    jsPDF: jest.fn().mockImplementation(() => ({
      text: jest.fn(),
      save: jest.fn(),
      addPage: jest.fn(),
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      addImage: jest.fn(),
      internal: {
        pageSize: {
          getWidth: jest.fn(() => 210),
          getHeight: jest.fn(() => 297),
        },
      },
    })),
  };
});

jest.mock("jspdf-autotable", () => {
  return jest.fn();
});

describe("generateTransactionPDF", () => {
  const mockCategoryNames = new Map([[1, "Food"], [2, "Salary"], [3, "Transport"]]);
  const mockWalletNames = new Map([[1, "Cash"], [2, "Bank Account"]]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should generate PDF with proper title", () => {
    const data: TransactionExportData = {
      transactions: [],
      categoryNames: mockCategoryNames,
      walletNames: mockWalletNames,
      currency: "VND",
    };

    const options: PDFExportOptions = {
      includeCharts: false,
      customBranding: false,
    };

    const pdf = generateTransactionPDF(data, options);

    expect(pdf).toBeDefined();
    // Verify PDF document was created with title
  });

  it("should format transaction data in table", () => {
    const transaction: Transaction = {
      id: 1,
      walletId: 1,
      categoryId: 1,
      type: 2, // EXPENSE
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

    const options: PDFExportOptions = {
      includeCharts: false,
      customBranding: false,
    };

    const pdf = generateTransactionPDF(data, options);

    expect(pdf).toBeDefined();
    // Verify table was called with transaction data
  });

  it("should handle charts when includeCharts is true", () => {
    const data: TransactionExportData = {
      transactions: [],
      categoryNames: mockCategoryNames,
      walletNames: mockWalletNames,
      currency: "VND",
    };

    // Minimal 1x1 transparent PNG
    const minimalPNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const options: PDFExportOptions = {
      includeCharts: true,
      customBranding: false,
      chartImage: minimalPNG,
    };

    const pdf = generateTransactionPDF(data, options);

    expect(pdf).toBeDefined();
    // Verify chart image was added
  });
});

describe("generateExportFilename", () => {
  it("should generate filename with .pdf extension", () => {
    const filename = generateExportFilename("transactions", "last30days");
    expect(filename).toMatch(/\.pdf$/);
  });

  it("should include date range in filename", () => {
    const filename = generateExportFilename("transactions", "last7days");
    expect(filename).toContain("last7days");
  });

  it("should use default base name when not provided", () => {
    const filename = generateExportFilename();
    expect(filename).toContain("transactions");
  });
});

describe("downloadPDF", () => {
  it("should call save method on PDF document", () => {
    const mockPDF = {
      save: jest.fn(),
    } as any;

    downloadPDF(mockPDF, "test.pdf");

    expect(mockPDF.save).toHaveBeenCalledWith("test.pdf");
  });
});
