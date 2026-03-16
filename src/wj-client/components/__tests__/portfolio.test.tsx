import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { IntlWrapper } from "@/test-utils";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import PortfolioPage from "../../app/[locale]/dashboard/portfolio/page";
import {
  useQueryListUserInvestments,
  useQueryGetAggregatedPortfolioSummary,
} from "@/utils/generated/hooks";

// Mock the generated hooks
jest.mock("@/utils/generated/hooks", () => {
  const noopQuery = () => ({ isLoading: false, isPending: false, error: null, data: undefined, refetch: jest.fn() });
  const noopMutation = () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, reset: jest.fn() });
  return {
    // Query hooks (overridden per-test via mockReturnValue)
    useQueryListUserInvestments: jest.fn(noopQuery),
    useQueryGetAggregatedPortfolioSummary: jest.fn(noopQuery),
    useQueryListWallets: jest.fn(() => ({
      isLoading: false, isPending: false, error: null, refetch: jest.fn(),
      data: { wallets: [{ id: 1, walletName: "Investment Wallet", type: 1, currency: "VND", balance: 0 }] },
    })),
    useQueryGetInvestment: jest.fn(noopQuery),
    useQueryListInvestmentTransactions: jest.fn(() => ({ isLoading: false, isPending: false, error: null, data: { transactions: [] }, refetch: jest.fn() })),
    useQueryGetWallet: jest.fn(noopQuery),
    useQueryGetMarketPrice: jest.fn(noopQuery),
    useQuerySearchSymbols: jest.fn(noopQuery),
    useQueryGetHistoricalPortfolioValues: jest.fn(noopQuery),
    useQueryGetAuth: jest.fn(noopQuery),
    // Mutation hooks
    useMutationUpdatePrices: jest.fn(noopMutation),
    useMutationCreateInvestment: jest.fn(noopMutation),
    useMutationAddInvestmentTransaction: jest.fn(noopMutation),
    useMutationUpdateInvestment: jest.fn(noopMutation),
    useMutationDeleteInvestmentTransaction: jest.fn(noopMutation),
    useMutationDeleteInvestment: jest.fn(noopMutation),
    useMutationUpdatePreferences: jest.fn(noopMutation),
    // Event constants
    EVENT_InvestmentListUserInvestments: "EVENT_InvestmentListUserInvestments",
    EVENT_InvestmentGetAggregatedPortfolioSummary: "EVENT_InvestmentGetAggregatedPortfolioSummary",
    EVENT_InvestmentGetInvestment: "EVENT_InvestmentGetInvestment",
    EVENT_InvestmentListInvestments: "EVENT_InvestmentListInvestments",
    EVENT_InvestmentGetPortfolioSummary: "EVENT_InvestmentGetPortfolioSummary",
    EVENT_WalletListWallets: "EVENT_WalletListWallets",
    EVENT_WalletGetWallet: "EVENT_WalletGetWallet",
    EVENT_InvestmentCreateInvestment: "EVENT_InvestmentCreateInvestment",
  };
});

const mockedListInvestments = useQueryListUserInvestments as jest.MockedFunction<
  typeof useQueryListUserInvestments
>;
const mockedGetPortfolioSummary =
  useQueryGetAggregatedPortfolioSummary as jest.MockedFunction<
    typeof useQueryGetAggregatedPortfolioSummary
  >;

// Mock Redux store with setAuthReducer key (used by CurrencyContext)
const createMockStore = () =>
  configureStore({
    reducer: {
      setAuthReducer: (state = { id: 1, email: "test@example.com" }) => state,
    },
  });

// Helper wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const store = createMockStore();

  return (
    <IntlWrapper>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </QueryClientProvider>
      </Provider>
    </IntlWrapper>
  );
};

const defaultWalletsMock = {
  isLoading: false, isPending: false, error: null, refetch: jest.fn(),
  data: { wallets: [{ id: 1, walletName: "Investment Wallet", type: 1, currency: "VND", balance: 0 }] },
};
const defaultQueryMock = { isLoading: false, isPending: false, error: null, data: undefined, refetch: jest.fn() };
const defaultMutationMock = { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, reset: jest.fn() };

describe("Portfolio Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    const hooks = require("@/utils/generated/hooks");
    hooks.useQueryListWallets.mockReturnValue(defaultWalletsMock);
    hooks.useQueryListUserInvestments.mockReturnValue(defaultQueryMock);
    hooks.useQueryGetAggregatedPortfolioSummary.mockReturnValue(defaultQueryMock);
    hooks.useQueryGetHistoricalPortfolioValues.mockReturnValue(defaultQueryMock);
    hooks.useQueryGetAuth.mockReturnValue(defaultQueryMock);
    hooks.useQueryGetInvestment.mockReturnValue(defaultQueryMock);
    hooks.useQueryListInvestmentTransactions.mockReturnValue({ ...defaultQueryMock, data: { transactions: [] } });
    hooks.useQueryGetWallet.mockReturnValue(defaultQueryMock);
    hooks.useQueryGetMarketPrice.mockReturnValue(defaultQueryMock);
    hooks.useQuerySearchSymbols.mockReturnValue(defaultQueryMock);
    hooks.useMutationUpdatePrices.mockReturnValue(defaultMutationMock);
    hooks.useMutationCreateInvestment.mockReturnValue(defaultMutationMock);
    hooks.useMutationAddInvestmentTransaction.mockReturnValue(defaultMutationMock);
    hooks.useMutationUpdateInvestment.mockReturnValue(defaultMutationMock);
    hooks.useMutationDeleteInvestmentTransaction.mockReturnValue(defaultMutationMock);
    hooks.useMutationDeleteInvestment.mockReturnValue(defaultMutationMock);
    hooks.useMutationUpdatePreferences.mockReturnValue(defaultMutationMock);
  });

  test("renders loading state for investments", () => {
    // Mock wallet loading state to trigger page-level skeleton
    const { useQueryListWallets } = require("@/utils/generated/hooks");
    (useQueryListWallets as jest.Mock).mockReturnValue({
      isLoading: true,
      isPending: false,
      error: null,
      data: undefined,
      refetch: jest.fn(),
    });

    mockedListInvestments.mockReturnValue({
      isLoading: true,
      isPending: false,
      error: null,
      data: undefined,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: true,
      isPending: false,
      error: null,
      data: undefined,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    // Page renders skeleton/loading UI when wallets are loading
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  test("renders holdings section when investments are loaded", async () => {
    const mockInvestments = {
      investments: [
        {
          id: 1,
          symbol: "VCB",
          name: "Vietcombank",
          type: 1, // STOCK
          exchange: "HOSE",
          currency: "VND",
          quantity: 100,
          unrealizedPnl: 500000000,
          unrealizedPnlPercent: 5.88,
          displayUnrealizedPnl: { amount: 500000000, currency: "VND" },
          averagePrice: { amount: 85000000, currency: "VND" },
          currentPrice: { amount: 90000000, currency: "VND" },
          totalValue: { amount: 9000000000, currency: "VND" },
          costBasis: { amount: 8500000000, currency: "VND" },
          realizedPnl: { amount: 0, currency: "VND" },
          createdAt: Date.now() / 1000,
          updatedAt: Date.now() / 1000,
        },
      ],
    };

    const mockSummary = {
      data: {
        totalInvestments: 1,
        totalValue: { amount: 9000000000, currency: "VND" },
        totalCostBasis: { amount: 8500000000, currency: "VND" },
        totalRealizedPnl: { amount: 0, currency: "VND" },
        totalUnrealizedPnl: { amount: 500000000, currency: "VND" },
        totalDividends: { amount: 0, currency: "VND" },
        todayChange: { amount: 100000000, currency: "VND" },
        todayChangePercent: 1.12,
      },
    };

    mockedListInvestments.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: mockInvestments,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: mockSummary,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Holdings").length).toBeGreaterThan(0);
    });

    // Verify investment symbol is shown
    expect(screen.getByText("VCB")).toBeInTheDocument();
    expect(screen.getByText("Vietcombank")).toBeInTheDocument();
  });

  test("renders error state when loading fails", async () => {
    // The page checks getListInvestments.error for the main error state
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: new Error("Network error"),
      data: undefined,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Error loading portfolio/i),
      ).toBeInTheDocument();
    });
  });

  test("renders Add Investment button when page loads", async () => {
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: { investments: [] },
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: {
        data: {
          totalInvestments: 0,
          totalValue: { amount: 0, currency: "VND" },
          totalCostBasis: { amount: 0, currency: "VND" },
          totalRealizedPnl: { amount: 0, currency: "VND" },
          totalUnrealizedPnl: { amount: 0, currency: "VND" },
          totalDividends: { amount: 0, currency: "VND" },
          todayChange: { amount: 0, currency: "VND" },
          todayChangePercent: 0,
        },
      },
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Add Investment/i)).toBeInTheDocument();
    });
  });

  test("displays empty state when no investments", async () => {
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: { investments: [] },
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      isPending: false,
      error: null,
      data: {
        data: {
          totalInvestments: 0,
          totalValue: { amount: 0, currency: "VND" },
          totalCostBasis: { amount: 0, currency: "VND" },
          totalRealizedPnl: { amount: 0, currency: "VND" },
          totalUnrealizedPnl: { amount: 0, currency: "VND" },
          totalDividends: { amount: 0, currency: "VND" },
          todayChange: { amount: 0, currency: "VND" },
          todayChangePercent: 0,
        },
      },
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/No investments yet/i)).toBeInTheDocument();
    });
  });
});
