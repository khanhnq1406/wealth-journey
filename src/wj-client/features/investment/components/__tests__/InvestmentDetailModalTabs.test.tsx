/**
 * Tests for InvestmentDetailModal tab migration
 * Verifies that the tab navigation block uses the TabBar component (role=tablist/role=tab)
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=InvestmentDetailModalTabs
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockRefetch = jest.fn();

const mockInvestment = {
  id: 10,
  walletId: 1,
  symbol: "AAPL",
  name: "Apple Inc.",
  type: 1,
  quantity: 500000,
  averageCost: 15025,
  currentPrice: 17000,
  totalCost: 7512500,
  currentValue: 8500000,
  unrealizedPnl: 987500,
  unrealizedPnlPercent: 13.14,
  realizedPnl: 0,
  currency: "USD",
  isCustom: false,
  userId: 1,
  createdAt: 1710460800,
  updatedAt: Math.floor(Date.now() / 1000),
  exchange: "NASDAQ",
  purchaseUnit: "",
  displayCurrency: "USD",
  totalDividends: 0,
  walletName: "Investment Wallet",
};

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetInvestment: jest.fn(() => ({
    data: { data: mockInvestment },
    isLoading: false,
    isPending: false,
    error: null,
    refetch: mockRefetch,
  })),
  useQueryListInvestmentTransactions: jest.fn(() => ({
    data: null,
    isLoading: false,
    isPending: false,
    error: null,
    refetch: mockRefetch,
  })),
  useMutationUpdatePrices: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useMutationDeleteInvestmentTransaction: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useMutationDeleteInvestment: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  EVENT_InvestmentGetInvestment: "api.investment.getInvestment",
  EVENT_InvestmentListInvestments: "api.investment.listInvestments",
  EVENT_InvestmentGetPortfolioSummary: "api.investment.getPortfolioSummary",
  EVENT_WalletListWallets: "api.wallet.listWallets",
  EVENT_WalletGetWallet: "api.wallet.getWallet",
  EVENT_InvestmentListInvestmentTransactions: "api.investment.listInvestmentTransactions",
}));

jest.mock("@/features/investment/forms/AddInvestmentTransactionForm", () => ({
  AddInvestmentTransactionForm: jest.fn(() => (
    <div data-testid="add-transaction-form" />
  )),
}));

jest.mock("@/features/investment/forms/UpdateInvestmentPriceForm", () => ({
  UpdateInvestmentPriceForm: jest.fn(() => (
    <div data-testid="update-price-form" />
  )),
}));

jest.mock("@/lib/utils/error-translator", () => ({
  getTranslatedError: (_err: any) => _err?.message ?? "Unknown error",
}));

jest.mock("@/lib/utils/units", () => ({
  formatCurrency: (amount: number, currency: string) => `${currency} ${amount}`,
  smallestUnitToAmount: (v: number) => v / 100,
}));

jest.mock("@/app/[locale]/dashboard/portfolio/helpers", () => ({
  formatQuantity: (qty: number) => String(qty / 10000),
  formatPrice: (price: number) => String(price / 100),
  isCustomInvestment: () => false,
  formatInvestmentPrice: (price: number) => String(price),
  formatUnrealizedPNL: () => ({
    text: "+$9,875.00",
    colorClass: "text-v2-green-positive",
  }),
  getInvestmentUnitLabelFull: () => "shares",
}));

jest.mock("@/features/investment/utils/gold-calculator", () => ({
  isGoldType: () => false,
}));

jest.mock("@/features/investment/utils/silver-calculator", () => ({
  isSilverType: () => false,
}));

import commonMessages from "@/messages/en/common.json";
import investmentMessages from "@/messages/en/investment.json";
import validationMessages from "@/messages/en/validation.json";

const allMessages = {
  ...commonMessages,
  ...investmentMessages,
  ...validationMessages,
};

import { InvestmentDetailModal } from "../InvestmentDetailModal";

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

describe("InvestmentDetailModal — TabBar migration", () => {
  it("renders tab navigation with role=tablist (TabBar component)", () => {
    render(
      <InvestmentDetailModal
        isOpen={true}
        onClose={jest.fn()}
        investmentId={10}
      />,
      { wrapper: TestWrapper },
    );

    // TabBar renders a div with role="tablist"
    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();
  });

  it("renders all four tabs with role=tab", () => {
    render(
      <InvestmentDetailModal
        isOpen={true}
        onClose={jest.fn()}
        investmentId={10}
      />,
      { wrapper: TestWrapper },
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
  });

  it("overview tab is selected by default (aria-selected=true)", () => {
    render(
      <InvestmentDetailModal
        isOpen={true}
        onClose={jest.fn()}
        investmentId={10}
      />,
      { wrapper: TestWrapper },
    );

    const overviewTab = screen.getByRole("tab", { name: /overview/i });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
  });

  it("non-active tabs have aria-selected=false", () => {
    render(
      <InvestmentDetailModal
        isOpen={true}
        onClose={jest.fn()}
        investmentId={10}
      />,
      { wrapper: TestWrapper },
    );

    const transactionsTab = screen.getByRole("tab", { name: /transactions/i });
    expect(transactionsTab).toHaveAttribute("aria-selected", "false");
  });

  it("activeTabProp=transactions selects the transactions tab", () => {
    render(
      <InvestmentDetailModal
        isOpen={true}
        onClose={jest.fn()}
        investmentId={10}
        activeTabProp="transactions"
      />,
      { wrapper: TestWrapper },
    );

    const transactionsTab = screen.getByRole("tab", { name: /transactions/i });
    expect(transactionsTab).toHaveAttribute("aria-selected", "true");
  });
});
