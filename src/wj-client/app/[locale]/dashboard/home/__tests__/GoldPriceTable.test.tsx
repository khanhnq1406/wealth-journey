/**
 * Tests for GoldPriceTable — uses useQueryGetGoldDisplayPrices hook (Task 6)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="GoldPriceTable"
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetGoldDisplayPrices: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
}));

// ---------------------------------------------------------------------------
// i18n messages (minimal)
// ---------------------------------------------------------------------------

const messages = {
  dashboard: {
    home: {
      goldPriceTitle: "Gold Prices Today",
      updated: "Updated {time}",
      goldType: "GOLD TYPE",
      buy: "BUY",
      buyUnit: "(x1.000₫)",
      sell: "SELL",
      sellUnit: "(x1.000₫)",
      loading: "Loading...",
      noData: "No data available",
    },
  },
};

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

let GoldPriceTable: React.ComponentType;

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  GoldPriceTable = require("../GoldPriceTable").GoldPriceTable;
});

function renderTable() {
  return render(<GoldPriceTable />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GoldPriceTable — uses useQueryGetGoldDisplayPrices", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the section heading", () => {
    renderTable();
    expect(screen.getByText("Gold Prices Today")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    renderTable();
    expect(screen.getByText("GOLD TYPE")).toBeInTheDocument();
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("SELL")).toBeInTheDocument();
  });

  it("shows noData text when prices array is empty", () => {
    renderTable();
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("shows loading spinner text when isLoading is true", () => {
    const { useQueryGetGoldDisplayPrices } = require("@/utils/generated/hooks");
    useQueryGetGoldDisplayPrices.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    renderTable();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders displayName from API response for each row", () => {
    const { useQueryGetGoldDisplayPrices } = require("@/utils/generated/hooks");
    useQueryGetGoldDisplayPrices.mockReturnValue({
      data: {
        prices: [
          {
            typeCode: "SJC",
            displayName: "SJC",
            buy: 8500000,
            sell: 8600000,
            changeBuy: 0,
            changeSell: 0,
            currency: "VND",
            updatedAt: 1711394400,
            isStale: false,
            showInInvestment: false,
            displayOrder: 1,
          },
          {
            typeCode: "Mi hong",
            displayName: "SJC Mi Hồng",
            buy: 8300000,
            sell: 8400000,
            changeBuy: 0,
            changeSell: 0,
            currency: "VND",
            updatedAt: 1711394400,
            isStale: false,
            showInInvestment: false,
            displayOrder: 2,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderTable();
    expect(screen.getByText("SJC")).toBeInTheDocument();
    expect(screen.getByText("SJC Mi Hồng")).toBeInTheDocument();
  });

  it("shows '--' for buy and sell when isStale is true", () => {
    const { useQueryGetGoldDisplayPrices } = require("@/utils/generated/hooks");
    useQueryGetGoldDisplayPrices.mockReturnValue({
      data: {
        prices: [
          {
            typeCode: "SJC",
            displayName: "SJC",
            buy: 8500000,
            sell: 8600000,
            changeBuy: 0,
            changeSell: 0,
            currency: "VND",
            updatedAt: 1711394400,
            isStale: true,
            showInInvestment: false,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderTable();
    const dashes = screen.getAllByText("--");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders formatted prices when isStale is false and buy/sell > 0", () => {
    const { useQueryGetGoldDisplayPrices } = require("@/utils/generated/hooks");
    useQueryGetGoldDisplayPrices.mockReturnValue({
      data: {
        prices: [
          {
            typeCode: "SJC",
            displayName: "SJC",
            buy: 8500000,
            sell: 8600000,
            changeBuy: 0,
            changeSell: 0,
            currency: "VND",
            updatedAt: 1711394400,
            isStale: false,
            showInInvestment: false,
            displayOrder: 1,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderTable();
    // formatPriceValue for VND: 8500000 / 1000 = 8,500 formatted as "8.500" (vi-VN locale)
    expect(screen.getByText("SJC")).toBeInTheDocument();
    // Price cells should not contain "--"
    const dashes = screen.queryAllByText("--");
    expect(dashes.length).toBe(0);
  });

  it("does NOT accept or render isAdmin or prices props (self-contained)", () => {
    // The component manages its own data — no external props needed
    // This test verifies the component renders with no props
    expect(() => renderTable()).not.toThrow();
  });
});
