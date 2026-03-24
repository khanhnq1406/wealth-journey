/**
 * Tests for PricesPage — Bell icon "Set Alert" buttons (Task 10)
 *
 * TDD: RED → GREEN → REFACTOR
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PricesPage"
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetMarketPrices: jest.fn(() => ({
    data: {
      gold: [
        {
          typeCode: "SJL1L10",
          name: "SJC 1L-10L",
          buy: 8500000,
          sell: 8550000,
          changeBuy: 100000,
          changeSell: 100000,
          currency: "VND",
        },
      ],
      silver: [
        {
          typeCode: "SLV1",
          name: "Silver 1 kg",
          buy: 1000000,
          sell: 1050000,
          changeBuy: 10000,
          changeSell: 10000,
          currency: "VND",
        },
      ],
      currency: [],
      timestamp: "",
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isFetching: false,
  })),
  useQueryGetMarketPrice: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
  })),
  useQueryListWatchlist: jest.fn(() => ({
    data: { items: [] },
    isLoading: false,
  })),
  useMutationCreateWatchlistItem: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useMutationDeleteWatchlistItem: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  EVENT_WatchlistListWatchlist: "api.watchlist.listWatchlist",
}));

jest.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: jest.fn(() => ({ user: null })),
}));

jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: jest.fn(() => ({
    toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn() },
  })),
}));

jest.mock(
  "@/features/market-prices/components/InlinePriceEdit",
  () => ({
    InlinePriceEdit: () => null,
    OverrideIndicator: () => null,
  }),
);

jest.mock("@/components/GoldSentimentCard", () => ({
  SentimentCard: () => null,
}));

jest.mock("@/components/decorative/OrnateHeading", () => ({
  OrnateHeading: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));

jest.mock("@/features/watchlist/components/WatchlistTab", () => ({
  WatchlistTab: ({ onAddClick }: { onAddClick: () => void }) => (
    <div data-testid="watchlist-tab">
      <button onClick={onAddClick}>Add Symbol</button>
    </div>
  ),
}));

jest.mock("@/features/watchlist/forms/AddToWatchlistForm", () => ({
  AddToWatchlistForm: () => <div data-testid="add-to-watchlist-form" />,
}));

jest.mock(
  "@/features/investment/components/SymbolAutocomplete",
  () => ({
    SymbolAutocomplete: ({
      onChange,
      placeholder,
    }: {
      onChange: (s: string, r?: unknown) => void;
      placeholder?: string;
    }) => (
      <input
        data-testid="symbol-autocomplete"
        placeholder={placeholder ?? "Search symbols"}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  }),
);

jest.mock(
  "@/features/price-alert/forms/CreatePriceAlertForm",
  () => ({
    CreatePriceAlertForm: ({
      defaultCategory,
      defaultSymbol,
      defaultAssetType,
      defaultCurrency,
    }: {
      defaultCategory?: string;
      defaultSymbol?: string;
      defaultAssetType?: number;
      defaultCurrency?: string;
    }) => (
      <div
        data-testid="create-price-alert-form"
        data-category={defaultCategory}
        data-symbol={defaultSymbol}
        data-asset-type={defaultAssetType}
        data-currency={defaultCurrency}
      />
    ),
  }),
);

// ---------------------------------------------------------------------------
// Minimal i18n messages for the prices page
// ---------------------------------------------------------------------------

const messages = {
  prices: {
    title: "Market Prices",
    lastUpdated: "Last updated: {time}",
    tabs: {
      watchlist: "Watchlist",
      gold: "Gold",
      silver: "Silver",
      currency: "Currency",
      symbolLookup: "Symbol Lookup",
    },
    addToWatchlist: "Add to Watchlist",
    watchlistAddedSuccess: "Added to watchlist!",
    watchlistAlreadyAdded: "Already in your watchlist",
    watchlistLimitReached: "Maximum of 50 items reached",
    watchlistFailedToAdd: "Failed to add to watchlist",
    watchlist: {
      symbolsTracked: "{count} symbols tracked",
      addSymbol: "Add Symbol",
      emptyTitle: "Your watchlist is empty",
      emptyDescription: "Add symbols to track market prices in one place.",
      errorTitle: "Failed to load watchlist",
      errorDescription: "Could not fetch your watchlist. Please try again.",
      retry: "Retry",
      details: "Details",
      less: "Less",
      starAdd: "Add to watchlist",
      starRemove: "Remove from watchlist",
      addedToWatchlist: "Added to watchlist",
      removedFromWatchlist: "Removed from watchlist",
      column: {
        symbol: "Symbol",
        price: "Price",
        change: "Change",
        type: "Type",
        note: "Note",
      },
      form: {
        chooseCategoryLabel: "Choose an asset category to watch:",
        gold: "Gold",
        silver: "Silver",
        otherAssets: "Other Assets",
        back: "Back",
        backToCategoryLabel: "Go back to category selection",
        backToSymbolLabel: "Go back to symbol selection",
        goldType: "Gold Type",
        silverType: "Silver Type",
        currency: "Currency",
        currencyType: "Currency",
        searchSymbol: "Search Symbol",
        searchSymbolPlaceholder: "Search for stocks, ETFs, crypto...",
        continue: "Continue",
        selectedAsset: "Selected Asset",
        noteLabel: "Note (optional)",
        notePlaceholder: "e.g. Watch for breakout above resistance",
        addedSuccess: "Added to watchlist!",
        errors: {
          alreadyInWatchlist: "Already in your watchlist",
          limitReached: "Maximum of 50 items reached",
          failedToAdd: "Failed to add to watchlist",
          failedToRemove: "Failed to remove from watchlist",
        },
      },
    },
    table: {
      type: "Type",
      buy: "Buy",
      buyUnit: "(x1.000₫)",
      sell: "Sell",
      sellUnit: "(x1.000₫)",
      change: "Change",
    },
    symbolLookup: {
      symbolLabel: "Symbol",
      searchPlaceholder: "Search symbol, e.g. AAPL, BTC...",
      search: "Search",
      failedToFetch: "Failed to fetch price.",
      emptyState: "Search for a stock, crypto, or ETF symbol.",
    },
    gold: {
      emptyMessage: "No gold prices available",
      emptyDescription: "Could not fetch gold prices.",
      failedToLoad: "Failed to load gold prices. Try refreshing.",
    },
    silver: {
      emptyMessage: "No silver prices available",
      emptyDescription: "Could not fetch silver prices.",
      failedToLoad: "Failed to load silver prices. Try refreshing.",
    },
    currency: {
      emptyMessage: "No currency prices available",
      emptyDescription: "Could not fetch currency prices.",
      failedToLoad: "Failed to load currency prices. Try refreshing.",
    },
    setAlert: "Set Alert",
    createPriceAlert: "Create Price Alert",
  },
  common: {
    refresh: "Refresh",
    showDetails: "Show Details",
    hideDetails: "Hide Details",
    loading: "Loading",
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

// Dynamic import to allow jest mocking to take effect
let PricesPage: React.ComponentType;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  PricesPage = require("../page").default;
});

function renderPage() {
  return render(<PricesPage />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PricesPage — Set Alert bell buttons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Gold tab", () => {
    it("renders bell icon buttons with aria-label 'Set Alert' for gold rows", () => {
      renderPage();
      // Switch to gold tab
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellButtons = screen.getAllByRole("button", {
        name: /set alert/i,
      });
      expect(bellButtons.length).toBeGreaterThan(0);
    });

    it("opens CreatePriceAlertForm modal when bell is clicked on gold row", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      expect(screen.getByTestId("create-price-alert-form")).toBeInTheDocument();
    });

    it("pre-fills gold form with correct category and symbol", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      const form = screen.getByTestId("create-price-alert-form");
      expect(form).toHaveAttribute("data-category", "gold");
      expect(form).toHaveAttribute("data-symbol", "SJL1L10");
    });

    it("pre-fills gold form with assetType 8 (GOLD_VND)", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      const form = screen.getByTestId("create-price-alert-form");
      expect(form).toHaveAttribute("data-asset-type", "8");
    });

    it("pre-fills gold form with currency VND", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      const form = screen.getByTestId("create-price-alert-form");
      expect(form).toHaveAttribute("data-currency", "VND");
    });
  });

  describe("Silver tab", () => {
    it("renders bell icon buttons with aria-label 'Set Alert' for silver rows", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      const bellButtons = screen.getAllByRole("button", { name: /set alert/i });
      expect(bellButtons.length).toBeGreaterThan(0);
    });

    it("opens CreatePriceAlertForm modal when bell is clicked on silver row", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      expect(screen.getByTestId("create-price-alert-form")).toBeInTheDocument();
    });

    it("pre-fills silver form with correct category and symbol", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      const form = screen.getByTestId("create-price-alert-form");
      expect(form).toHaveAttribute("data-category", "silver");
      expect(form).toHaveAttribute("data-symbol", "SLV1");
    });

    it("pre-fills silver form with assetType 10 (SILVER_VND)", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      const form = screen.getByTestId("create-price-alert-form");
      expect(form).toHaveAttribute("data-asset-type", "10");
    });
  });

  describe("Modal lifecycle", () => {
    it("modal is closed initially", () => {
      renderPage();
      expect(
        screen.queryByTestId("create-price-alert-form"),
      ).not.toBeInTheDocument();
    });

    it("modal closes when BaseModal onClose is called (Escape key)", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Gold" }));
      const bellBtn = screen.getAllByRole("button", { name: /set alert/i })[0];
      fireEvent.click(bellBtn);
      expect(screen.getByTestId("create-price-alert-form")).toBeInTheDocument();
      // Press Escape to close
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
      expect(
        screen.queryByTestId("create-price-alert-form"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Symbol Lookup tab — Set Alert button", () => {
    it("shows Set Alert button in Symbol Lookup tab when price data is available", () => {
      const { useQueryGetMarketPrice } = require("@/utils/generated/hooks");
      useQueryGetMarketPrice.mockReturnValue({
        data: {
          data: {
            price: 15000,
            priceDecimal: 150.0,
            currency: "USD",
            timestamp: 1700000000,
          },
          success: true,
        },
        isLoading: false,
        isError: false,
      });

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: "Symbol Lookup" }));

      // Type a symbol and search
      const autocomplete = screen.getByTestId("symbol-autocomplete");
      fireEvent.change(autocomplete, { target: { value: "AAPL" } });
      const searchBtn = screen.getByRole("button", { name: /search/i });
      fireEvent.click(searchBtn);

      // The "Set Alert" button should appear near the price result
      expect(
        screen.getByRole("button", { name: /set alert/i }),
      ).toBeInTheDocument();
    });
  });
});
