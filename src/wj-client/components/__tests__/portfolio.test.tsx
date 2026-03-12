import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import PortfolioPage from "../../app/[locale]/dashboard/portfolio/page";
import {
  useQueryListInvestments,
  useQueryGetPortfolioSummary,
} from "@/utils/generated/hooks";

// Mock the generated hooks
jest.mock("@/utils/generated/hooks", () => ({
  useQueryListInvestments: jest.fn(),
  useQueryGetPortfolioSummary: jest.fn(),
  useMutationCreateInvestment: jest.fn(),
  useMutationAddInvestmentTransaction: jest.fn(),
}));

const mockedListInvestments = useQueryListInvestments as jest.MockedFunction<
  typeof useQueryListInvestments
>;
const mockedGetPortfolioSummary =
  useQueryGetPortfolioSummary as jest.MockedFunction<
    typeof useQueryGetPortfolioSummary
  >;

// Mock Redux store
const createMockStore = () =>
  configureStore({
    reducer: {
      auth: (state = { user: { id: 1, email: "test@example.com" } }) => state,
      modal: (state = { isOpen: false, type: null }) => state,
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
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
};

describe("Portfolio Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders loading state", () => {
    mockedListInvestments.mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: true,
      error: null,
      data: undefined,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    // Should show loading spinner
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  test("renders portfolio summary and holdings table", async () => {
    const mockInvestments = {
      success: true,
      message: "Investments retrieved successfully",
      investments: [
        {
          id: 1,
          symbol: "VCB",
          name: "Vietcombank",
          type: 1, // STOCK
          exchange: "HOSE",
          currency: "VND",
          quantity: 100,
          averagePrice: { amount: 85000000, currency: "VND" },
          currentPrice: { amount: 90000000, currency: "VND" },
          totalValue: { amount: 9000000000, currency: "VND" },
          costBasis: { amount: 8500000000, currency: "VND" },
          unrealizedPnl: { amount: 500000000, currency: "VND" },
          realizedPnl: { amount: 0, currency: "VND" },
          createdAt: Date.now() / 1000,
          updatedAt: Date.now() / 1000,
        },
      ],
      pagination: {
        currentPage: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    };

    const mockSummary = {
      success: true,
      message: "Portfolio summary retrieved successfully",
      summary: {
        totalInvestments: 1,
        totalValue: { amount: 9000000000, currency: "VND" },
        totalCostBasis: { amount: 8500000000, currency: "VND" },
        totalRealizedPnl: { amount: 0, currency: "VND" },
        totalUnrealizedPnl: { amount: 500000000, currency: "VND" },
        totalDividends: { amount: 0, currency: "VND" },
        todayChange: { amount: 100000000, currency: "VND" },
        todayChangePercent: 1.12,
      },
      timestamp: new Date().toISOString(),
    };

    mockedListInvestments.mockReturnValue({
      isLoading: false,
      error: null,
      data: mockInvestments,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      error: null,
      data: mockSummary,
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("Portfolio Summary")).toBeInTheDocument();
      expect(screen.getByText("Holdings")).toBeInTheDocument();
    });

    // Verify portfolio summary displays
    expect(screen.getByText(/9,000,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/500,000,000/)).toBeInTheDocument();

    // Verify holdings table
    expect(screen.getByText("VCB")).toBeInTheDocument();
    expect(screen.getByText("Vietcombank")).toBeInTheDocument();
  });

  test("renders error state", async () => {
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      error: new Error("Failed to fetch investments"),
      data: undefined,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      error: new Error("Failed to fetch summary"),
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
        screen.getByText(/Failed to fetch investments/i),
      ).toBeInTheDocument();
    });
  });

  test("opens create investment modal when button is clicked", async () => {
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        success: true,
        message: "Investments retrieved successfully",
        investments: [],
        pagination: {
          currentPage: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
        timestamp: new Date().toISOString(),
      },
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        success: true,
        message: "Portfolio summary retrieved successfully",
        summary: {
          totalInvestments: 0,
          totalValue: { amount: 0, currency: "VND" },
          totalCostBasis: { amount: 0, currency: "VND" },
          totalRealizedPnl: { amount: 0, currency: "VND" },
          totalUnrealizedPnl: { amount: 0, currency: "VND" },
          totalDividends: { amount: 0, currency: "VND" },
          todayChange: { amount: 0, currency: "VND" },
          todayChangePercent: 0,
        },
        timestamp: new Date().toISOString(),
      },
      refetch: jest.fn(),
    } as any);

    const mockDispatch = jest.fn();
    jest
      .spyOn(require("@/redux/store"), "useAppDispatch")
      .mockReturnValue(mockDispatch);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      const addButton = screen.getByText(/Add Investment/i);
      expect(addButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Add Investment/i));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "modal/openModal",
          payload: expect.objectContaining({
            isOpen: true,
            type: "CREATE_INVESTMENT",
          }),
        }),
      );
    });
  });

  test("displays empty state when no investments", async () => {
    mockedListInvestments.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        success: true,
        message: "Investments retrieved successfully",
        investments: [],
        pagination: {
          currentPage: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
        timestamp: new Date().toISOString(),
      },
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        success: true,
        message: "Portfolio summary retrieved successfully",
        summary: {
          totalInvestments: 0,
          totalValue: { amount: 0, currency: "VND" },
          totalCostBasis: { amount: 0, currency: "VND" },
          totalRealizedPnl: { amount: 0, currency: "VND" },
          totalUnrealizedPnl: { amount: 0, currency: "VND" },
          totalDividends: { amount: 0, currency: "VND" },
          todayChange: { amount: 0, currency: "VND" },
          todayChangePercent: 0,
        },
        timestamp: new Date().toISOString(),
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
      expect(
        screen.getByText(/Get started by adding your first investment/i),
      ).toBeInTheDocument();
    });
  });

  test("formats currency values correctly", async () => {
    const mockInvestments = {
      success: true,
      message: "Investments retrieved successfully",
      investments: [
        {
          id: 1,
          symbol: "VCB",
          name: "Vietcombank",
          type: 1,
          exchange: "HOSE",
          currency: "VND",
          quantity: 100,
          averagePrice: { amount: 85000000, currency: "VND" },
          currentPrice: { amount: 90000000, currency: "VND" },
          totalValue: { amount: 9000000000, currency: "VND" },
          costBasis: { amount: 8500000000, currency: "VND" },
          unrealizedPnl: { amount: 500000000, currency: "VND" },
          realizedPnl: { amount: 1500000, currency: "VND" },
          createdAt: Date.now() / 1000,
          updatedAt: Date.now() / 1000,
        },
      ],
      pagination: {
        currentPage: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
      timestamp: new Date().toISOString(),
    };

    mockedListInvestments.mockReturnValue({
      isLoading: false,
      error: null,
      data: mockInvestments,
      refetch: jest.fn(),
    } as any);

    mockedGetPortfolioSummary.mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        success: true,
        message: "Portfolio summary retrieved successfully",
        summary: {
          totalInvestments: 1,
          totalValue: { amount: 9000000000, currency: "VND" },
          totalCostBasis: { amount: 8500000000, currency: "VND" },
          totalRealizedPnl: { amount: 1500000, currency: "VND" },
          totalUnrealizedPnl: { amount: 500000000, currency: "VND" },
          totalDividends: { amount: 2000000, currency: "VND" },
          todayChange: { amount: 100000000, currency: "VND" },
          todayChangePercent: 1.12,
        },
        timestamp: new Date().toISOString(),
      },
      refetch: jest.fn(),
    } as any);

    render(
      <TestWrapper>
        <PortfolioPage />
      </TestWrapper>,
    );

    await waitFor(() => {
      // Check for formatted currency values (Vietnamese format)
      expect(screen.getByText(/9\.000\.000\.000/)).toBeInTheDocument();
      expect(screen.getByText(/500\.000\.000/)).toBeInTheDocument();
      expect(screen.getByText(/1\.500\.000/)).toBeInTheDocument();
    });
  });
});
