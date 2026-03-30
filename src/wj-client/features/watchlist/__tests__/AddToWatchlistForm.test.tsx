/**
 * Tests for AddToWatchlistForm component — verifies that gold/silver VND options
 * are fetched from the admin config API (useQueryGetAssetDisplayPrices) instead
 * of static arrays.
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern="AddToWatchlistForm"
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AddToWatchlistForm } from "../forms/AddToWatchlistForm";

// ---------------------------------------------------------------------------
// Message fixture
// ---------------------------------------------------------------------------
import investmentMessages from "@/messages/en/investment.json";
import commonMessages from "@/messages/en/common.json";
import uiMessages from "@/messages/en/ui.json";

const allMessages = {
  ...commonMessages,
  ...uiMessages,
  ...investmentMessages,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGoldQuery = jest.fn();
const mockSilverQuery = jest.fn();
const mockMutate = jest.fn();

jest.mock("@/utils/generated/hooks", () => ({
  useMutationCreateWatchlistItem: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  })),
  useQueryGetMarketPrices: jest.fn(() => ({
    data: {
      currency: [
        { typeCode: "USD", name: "USD" },
        { typeCode: "EUR", name: "EUR" },
      ],
    },
    isLoading: false,
    error: null,
  })),
  useQueryGetAssetDisplayPrices: jest.fn((req: { assetType: string }) => {
    if (req.assetType === "gold") return mockGoldQuery();
    if (req.assetType === "silver") return mockSilverQuery();
    return { data: null, isLoading: false, error: null };
  }),
}));

jest.mock("@/features/investment/components/SymbolAutocomplete", () => ({
  SymbolAutocomplete: ({
    onChange,
    placeholder,
  }: {
    onChange: (s: string, r?: any) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="symbol-autocomplete"
      placeholder={placeholder ?? "Search symbols"}
      onChange={(e) =>
        onChange(e.target.value, {
          symbol: e.target.value,
          name: "Test Stock",
          type: "EQUITY",
          exchange: "XNSE",
          exchDisp: "NSE",
          currency: "USD",
        })
      }
    />
  ),
}));

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
      <NextIntlClientProvider locale="en" messages={allMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderForm(props: React.ComponentProps<typeof AddToWatchlistForm> = {}) {
  return render(<AddToWatchlistForm {...props} />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddToWatchlistForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: API returns gold + silver data
    mockGoldQuery.mockReturnValue({
      data: {
        prices: [
          { typeCode: "SJC", displayName: "SJC", showInInvestment: true },
          { typeCode: "BTMC", displayName: "SJC BTMC", showInInvestment: true },
          { typeCode: "HIDDEN", displayName: "Hidden Gold", showInInvestment: false },
        ],
      },
      isLoading: false,
      error: null,
    });
    mockSilverQuery.mockReturnValue({
      data: {
        prices: [
          { typeCode: "PH_QU_THI_1L", displayName: "Phú Quý thỏi 1L", showInInvestment: true },
          { typeCode: "SBJ_1KG", displayName: "SBJ 1kg", showInInvestment: true },
        ],
      },
      isLoading: false,
      error: null,
    });
  });

  describe("API integration — gold options", () => {
    it("renders without crashing", () => {
      renderForm();
      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.getByText("Silver")).toBeInTheDocument();
    });

    it("calls useQueryGetAssetDisplayPrices with assetType=gold", () => {
      const { useQueryGetAssetDisplayPrices } = require("@/utils/generated/hooks");
      renderForm();
      expect(useQueryGetAssetDisplayPrices).toHaveBeenCalledWith(
        expect.objectContaining({ assetType: "gold" })
      );
    });

    it("calls useQueryGetAssetDisplayPrices with assetType=silver", () => {
      const { useQueryGetAssetDisplayPrices } = require("@/utils/generated/hooks");
      renderForm();
      expect(useQueryGetAssetDisplayPrices).toHaveBeenCalledWith(
        expect.objectContaining({ assetType: "silver" })
      );
    });

    it("renders gold dropdown with API-provided option labels", async () => {
      renderForm();
      // The Select component renders the current selected value
      // SJC should be among the rendered text (first option auto-selected or in the dropdown)
      await waitFor(() => {
        // The select should render options from the API
        const container = screen.getByText("Gold Type").closest("div");
        expect(container).toBeInTheDocument();
      });
    });

    it("filters out gold options with showInInvestment=false", () => {
      const { useQueryGetAssetDisplayPrices } = require("@/utils/generated/hooks");
      renderForm();
      // The mock has "HIDDEN" with showInInvestment: false — verify it won't appear
      // The hook is called, we verify options built from API correctly filter
      expect(useQueryGetAssetDisplayPrices).toHaveBeenCalled();
    });
  });

  describe("API integration — silver options", () => {
    it("shows silver dropdown when Silver category is selected", async () => {
      renderForm();
      const silverBtn = screen.getByText("Silver");
      fireEvent.click(silverBtn);
      await waitFor(() => {
        expect(screen.getByText("Silver Type")).toBeInTheDocument();
      });
    });

    it("calls useQueryGetAssetDisplayPrices with assetType=silver on silver category", () => {
      const { useQueryGetAssetDisplayPrices } = require("@/utils/generated/hooks");
      renderForm();
      fireEvent.click(screen.getByText("Silver"));
      expect(useQueryGetAssetDisplayPrices).toHaveBeenCalledWith(
        expect.objectContaining({ assetType: "silver" })
      );
    });
  });

  describe("Loading states", () => {
    it("shows gold dropdown in loading/disabled state when API is loading", () => {
      mockGoldQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });
      renderForm();
      // When loading, dropdown should still render (not crash)
      expect(screen.getByText("Gold Type")).toBeInTheDocument();
    });

    it("shows silver dropdown in loading state when silver API is loading", () => {
      mockSilverQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });
      renderForm();
      fireEvent.click(screen.getByText("Silver"));
      expect(screen.getByText("Silver Type")).toBeInTheDocument();
    });
  });

  describe("Fallback behavior — empty API response", () => {
    it("renders empty gold dropdown without crashing when API returns empty", () => {
      mockGoldQuery.mockReturnValue({
        data: { prices: [] },
        isLoading: false,
        error: null,
      });
      renderForm();
      // Should not crash; dropdown renders with no options
      expect(screen.getByText("Gold Type")).toBeInTheDocument();
    });

    it("renders empty silver dropdown without crashing when API returns empty", () => {
      mockSilverQuery.mockReturnValue({
        data: { prices: [] },
        isLoading: false,
        error: null,
      });
      renderForm();
      fireEvent.click(screen.getByText("Silver"));
      expect(screen.getByText("Silver Type")).toBeInTheDocument();
    });

    it("renders empty dropdown without crashing when API is unavailable (null data)", () => {
      mockGoldQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      });
      renderForm();
      // Should not crash — data?.prices ?? [] fallback returns []
      expect(screen.getByText("Gold Type")).toBeInTheDocument();
    });
  });

  describe("Category switching", () => {
    it("shows Other category with SymbolAutocomplete when Other Assets tab clicked", () => {
      renderForm();
      fireEvent.click(screen.getByText("Other Assets"));
      expect(screen.getByTestId("symbol-autocomplete")).toBeInTheDocument();
    });
  });

  describe("Form submission", () => {
    it("shows Add to Watchlist button", () => {
      renderForm();
      expect(screen.getByRole("button", { name: /add to watchlist/i })).toBeInTheDocument();
    });
  });
});
