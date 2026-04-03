/**
 * Tests for InvestmentDetailModal — Edit Button and State (TDD)
 *
 * Covers:
 *  1. Edit button renders on each transaction row (desktop table)
 *  2. Clicking edit button switches to "add-transaction" tab AND passes the
 *     correct transaction as editTransaction to the form
 *  3. After successful edit: returns to "transactions" tab AND clears editingTransaction
 *  4. Switching tabs manually: clears editingTransaction
 *  5. Tab label shows "Edit Transaction" when editingTransaction is set
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern="InvestmentDetailModal.edit"
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { InvestmentDetailModal } from "../InvestmentDetailModal";
import {
  InvestmentTransactionType,
  InvestmentType,
} from "@/gen/protobuf/v1/investment";
import type { InvestmentTransaction } from "@/gen/protobuf/v1/investment";

// ---------------------------------------------------------------------------
// i18n messages
// ---------------------------------------------------------------------------
import commonMessages from "@/messages/en/common.json";
import investmentMessages from "@/messages/en/investment.json";
import validationMessages from "@/messages/en/validation.json";

const allMessages = {
  ...commonMessages,
  ...investmentMessages,
  ...validationMessages,
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockTransaction: InvestmentTransaction = {
  id: 42,
  investmentId: 10,
  walletId: 1,
  type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
  quantity: 500000, // 50 shares × 10000
  price: 15025, // $150.25 in cents
  cost: 7512500,
  fees: 500, // $5.00 in cents
  transactionDate: 1710460800,
  notes: "",
  createdAt: 1710460800,
  updatedAt: 1710460800,
  lotId: 0,
  remainingQuantity: 500000,
  displayPrice: undefined,
  displayCost: undefined,
  displayFees: undefined,
  displayCurrency: "USD",
};

const mockInvestment = {
  id: 10,
  walletId: 1,
  symbol: "AAPL",
  name: "Apple Inc.",
  type: InvestmentType.INVESTMENT_TYPE_STOCK,
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
  displayTotalCost: undefined,
  displayCurrentValue: undefined,
  displayUnrealizedPnl: undefined,
  displayRealizedPnl: undefined,
  displayCurrency: "USD",
  totalDividends: 0,
  walletName: "Investment Wallet",
  displayCurrentPrice: undefined,
  displayAverageCost: undefined,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOnSuccess = jest.fn();
const mockOnClose = jest.fn();
const mockRefetch = jest.fn();
const mockQueryInvalidate = jest.fn();

jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetInvestment: jest.fn(() => ({
    data: { data: mockInvestment },
    isLoading: false,
    isPending: false,
    error: null,
    refetch: mockRefetch,
  })),
  useQueryListInvestmentTransactions: jest.fn(() => ({
    data: { data: [mockTransaction], pagination: { page: 1, pageSize: 100, total: 1 } },
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

// Mock AddInvestmentTransactionForm to a testable stub
let capturedEditTransactionProp: InvestmentTransaction | undefined = undefined;
let capturedOnSuccess: (() => void) | undefined = undefined;

jest.mock(
  "@/features/investment/forms/AddInvestmentTransactionForm",
  () => ({
    AddInvestmentTransactionForm: jest.fn(
      ({
        editTransaction,
        onSuccess,
      }: {
        editTransaction?: InvestmentTransaction;
        onSuccess?: () => void;
      }) => {
        capturedEditTransactionProp = editTransaction;
        capturedOnSuccess = onSuccess;
        return (
          <div data-testid="add-transaction-form">
            <div data-testid="edit-transaction-prop">
              {editTransaction ? String(editTransaction.id) : "none"}
            </div>
            <button
              data-testid="form-success-trigger"
              onClick={() => onSuccess?.()}
            >
              {editTransaction ? "Save Changes" : "Add Transaction"}
            </button>
          </div>
        );
      },
    ),
  }),
);

jest.mock("@/features/investment/forms/UpdateInvestmentPriceForm", () => ({
  UpdateInvestmentPriceForm: jest.fn(() => (
    <div data-testid="update-price-form" />
  )),
}));

jest.mock("@/lib/utils/error-translator", () => ({
  getTranslatedError: (_err: any) => _err?.message ?? "Unknown error",
}));

jest.mock("@/lib/utils/units", () => ({
  formatCurrency: (amount: number, currency: string) =>
    `${currency} ${amount}`,
  smallestUnitToAmount: (v: number) => v / 100,
}));

jest.mock("@/app/[locale]/dashboard/portfolio/helpers", () => ({
  formatQuantity: (qty: number) => String(qty / 10000),
  formatPrice: (price: number) => String(price / 100),
  isCustomInvestment: () => false,
  formatInvestmentPrice: (price: number) => String(price),
  formatUnrealizedPNL: () => ({ text: "+$9,875.00", colorClass: "text-v2-green-positive" }),
  getInvestmentUnitLabelFull: () => "shares",
}));

jest.mock("@/features/investment/utils/gold-calculator", () => ({
  isGoldType: () => false,
}));

jest.mock("@/features/investment/utils/silver-calculator", () => ({
  isSilverType: () => false,
}));

// ---------------------------------------------------------------------------
// Helpers
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
  // Override invalidateQueries to track calls
  queryClient.invalidateQueries = mockQueryInvalidate;
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={allMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderModal(props: {
  isOpen?: boolean;
  investmentId?: number;
  onSuccess?: () => void;
  onClose?: () => void;
} = {}) {
  const defaults = {
    isOpen: true,
    investmentId: 10,
    onSuccess: mockOnSuccess,
    onClose: mockOnClose,
    ...props,
  };
  return render(<InvestmentDetailModal {...defaults} />, {
    wrapper: TestWrapper,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InvestmentDetailModal — Edit Button and State", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedEditTransactionProp = undefined;
    capturedOnSuccess = undefined;
  });

  describe("Edit button renders in transaction rows", () => {
    it("shows edit buttons on the transactions tab (desktop)", async () => {
      renderModal();

      // Switch to transactions tab
      const transactionsTab = screen.getByRole("tab", {
        name: /transactions/i,
      });
      fireEvent.click(transactionsTab);

      // Wait for the table to be rendered — it's inside the "hidden sm:block" div.
      // The edit button has aria-label matching editTransaction i18n key.
      await waitFor(() => {
        const editButtons = screen.getAllByRole("button", {
          name: /edit transaction/i,
        });
        expect(editButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Edit button click behavior", () => {
    it("switches to add-transaction tab when edit button is clicked", async () => {
      renderModal();

      // Switch to transactions tab first
      fireEvent.click(screen.getByRole("tab", { name: /transactions/i }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /edit transaction/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      // Click edit button
      const editButtons = screen.getAllByRole("button", {
        name: /edit transaction/i,
      });
      fireEvent.click(editButtons[0]);

      // Should now show the add-transaction form
      await waitFor(() => {
        expect(screen.getByTestId("add-transaction-form")).toBeInTheDocument();
      });
    });

    it("passes the correct transaction as editTransaction to the form", async () => {
      renderModal();

      // Switch to transactions tab
      fireEvent.click(screen.getByRole("tab", { name: /transactions/i }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /edit transaction/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      // Click edit button
      const editButtons = screen.getAllByRole("button", {
        name: /edit transaction/i,
      });
      fireEvent.click(editButtons[0]);

      // The form should display the transaction id of the mocked transaction
      await waitFor(() => {
        expect(screen.getByTestId("edit-transaction-prop")).toHaveTextContent(
          String(mockTransaction.id),
        );
      });
    });
  });

  describe("Tab label in edit mode", () => {
    it("shows 'Edit Transaction' tab label when editingTransaction is set", async () => {
      renderModal();

      // Go to transactions tab and click edit
      fireEvent.click(screen.getByRole("tab", { name: /transactions/i }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /edit transaction/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      // Click first edit button (in the action buttons row)
      // Use the first one in action buttons (not the tab label itself yet)
      const allEditBtns = screen.getAllByRole("button", {
        name: /edit transaction/i,
      });
      fireEvent.click(allEditBtns[0]);

      await waitFor(() => {
        // The tab label should now read "Edit Transaction"
        // It appears as a tab navigation element (role="tab" via TabBar)
        const tabButtons = screen
          .getAllByRole("tab")
          .filter((b) => b.textContent?.trim() === "Edit Transaction");
        expect(tabButtons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("After successful edit", () => {
    it("returns to transactions tab and clears editingTransaction after success", async () => {
      renderModal();

      // Navigate to transactions and click edit
      fireEvent.click(screen.getByRole("tab", { name: /transactions/i }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /edit transaction/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      const editButtons = screen.getAllByRole("button", {
        name: /edit transaction/i,
      });
      fireEvent.click(editButtons[0]);

      // Form should be shown with editTransaction id
      await waitFor(() => {
        expect(screen.getByTestId("add-transaction-form")).toBeInTheDocument();
        expect(screen.getByTestId("edit-transaction-prop")).toHaveTextContent(
          String(mockTransaction.id),
        );
      });

      // Trigger success
      const successTrigger = screen.getByTestId("form-success-trigger");
      fireEvent.click(successTrigger);

      // Should return to transactions tab (form no longer visible)
      await waitFor(() => {
        expect(
          screen.queryByTestId("add-transaction-form"),
        ).not.toBeInTheDocument();
      });

      // Clicking the add-transaction tab now should show form without editTransaction
      // (edit state was cleared on success)
      fireEvent.click(
        screen.getAllByRole("tab").find(
          (b) => b.textContent?.trim() === "Add Transaction",
        )!,
      );

      await waitFor(() => {
        expect(screen.getByTestId("edit-transaction-prop")).toHaveTextContent(
          "none",
        );
      });
    });
  });

  describe("Manual tab switch clears edit state", () => {
    it("clears editingTransaction when switching to overview tab manually", async () => {
      renderModal();

      // Go to transactions and click edit
      fireEvent.click(screen.getByRole("tab", { name: /transactions/i }));

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: /edit transaction/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      const editButtons = screen.getAllByRole("button", {
        name: /edit transaction/i,
      });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId("add-transaction-form")).toBeInTheDocument();
      });

      // Switch to overview tab manually
      fireEvent.click(screen.getByRole("tab", { name: /overview/i }));

      // Form should disappear
      await waitFor(() => {
        expect(
          screen.queryByTestId("add-transaction-form"),
        ).not.toBeInTheDocument();
      });

      // If we switch back to add-transaction, editTransaction should be cleared (undefined)
      fireEvent.click(
        screen.getAllByRole("tab").find(
          (b) => b.textContent?.trim() === "Add Transaction",
        )!,
      );

      await waitFor(() => {
        expect(screen.getByTestId("edit-transaction-prop")).toHaveTextContent(
          "none",
        );
      });
    });
  });
});
