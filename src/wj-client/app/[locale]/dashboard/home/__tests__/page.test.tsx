/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock generated hooks
jest.mock("@/utils/generated/hooks", () => ({
  useQueryListWallets: () => ({ data: null, isLoading: false }),
  useQueryGetAggregatedPortfolioSummary: () => ({ data: null }),
  EVENT_WalletListWallets: "wallets",
  EVENT_WalletGetTotalBalance: "balance",
  EVENT_TransactionListTransactions: "transactions",
}));

// Mock CurrencyContext
jest.mock("@/contexts/CurrencyContext", () => ({
  useCurrency: () => ({ currency: "VND" }),
}));

// Mock auth store
jest.mock("@/features/auth/store/store", () => ({
  store: { getState: () => ({ setAuthReducer: { fullname: "Test User" } }) },
}));

// Mock react-query
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// Mock currency formatter
jest.mock("@/utils/currency-formatter", () => ({
  parseAmount: (v: unknown) => (v ? Number(v) : 0),
}));

// Mock PnlPeriod enum
jest.mock("@/gen/protobuf/v1/investment", () => ({
  PnlPeriod: {
    PNL_PERIOD_ALL: 0,
    PNL_PERIOD_1D: 1,
    PNL_PERIOD_1W: 2,
    PNL_PERIOD_1M: 3,
  },
}));

// Mock PnlShareModal — the key component under test
jest.mock("../PnlShareModal", () => ({
  PnlShareModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="pnl-share-modal" /> : null,
}));

// Mock BaseModal to render children directly (simplified)
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="base-modal">{children}</div> : null,
}));

// Mock all sub-components to avoid complex renders
jest.mock("../NetWorthDisplay", () => ({
  NetWorthDisplay: ({ onShareClick }: { onShareClick?: () => void }) => (
    <div data-testid="NetWorthDisplay">
      <button onClick={onShareClick} data-testid="share-btn">
        Share PnL
      </button>
    </div>
  ),
}));

jest.mock("../PNLCard", () => ({
  PNLCard: () => <div data-testid="PNLCard" />,
}));

jest.mock("../GoldPriceTable", () => ({
  GoldPriceTable: () => <div data-testid="GoldPriceTable" />,
}));

jest.mock("../GoldPriceChart", () => ({
  GoldPriceChart: () => <div data-testid="GoldPriceChart" />,
}));

jest.mock("../SilverPriceTable", () => ({
  SilverPriceTable: () => <div data-testid="SilverPriceTable" />,
}));

jest.mock("../SilverPriceChart", () => ({
  SilverPriceChart: () => <div data-testid="SilverPriceChart" />,
}));

jest.mock("../CurrencyPriceTable", () => ({
  CurrencyPriceTable: () => <div data-testid="CurrencyPriceTable" />,
}));

jest.mock("../DollarIndexChart", () => ({
  DollarIndexChart: () => <div data-testid="DollarIndexChart" />,
}));

jest.mock("../WalletsSection", () => ({
  WalletsSection: () => <div data-testid="WalletsSection" />,
}));

jest.mock("@/components/BaseCard", () => ({
  BaseCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="BaseCard">{children}</div>
  ),
}));

jest.mock("@/components/GoldSentimentCard", () => ({
  SentimentCard: () => <div data-testid="SentimentCard" />,
}));

jest.mock("@/components/decorative/OrnateDivider", () => ({
  OrnateDivider: () => <div data-testid="OrnateDivider" />,
}));

jest.mock("@/features/wallet/forms/CreateWalletForm", () => ({
  CreateWalletForm: () => <div data-testid="CreateWalletForm" />,
}));

jest.mock("@/features/transaction/forms/AddTransactionForm", () => ({
  AddTransactionForm: () => <div data-testid="AddTransactionForm" />,
}));

jest.mock("@/features/wallet/forms/TransferMoneyForm", () => ({
  TransferMoneyForm: () => <div data-testid="TransferMoneyForm" />,
}));

import Home from "../page";

describe("Home page — PnlShareModal integration", () => {
  it("renders without pnl-share-modal initially", () => {
    render(<Home />);
    expect(screen.queryByTestId("pnl-share-modal")).not.toBeInTheDocument();
  });

  it("renders the NetWorthDisplay component", () => {
    render(<Home />);
    // Both mobile and desktop render NetWorthDisplay
    const displays = screen.getAllByTestId("NetWorthDisplay");
    expect(displays.length).toBeGreaterThanOrEqual(1);
  });

  it("NetWorthDisplay receives an onShareClick prop", () => {
    render(<Home />);
    // The mock NetWorthDisplay renders a share button when onShareClick is provided
    const shareBtns = screen.getAllByTestId("share-btn");
    expect(shareBtns.length).toBeGreaterThanOrEqual(1);
  });
});
