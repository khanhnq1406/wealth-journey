/**
 * Tests for FinancePage — Action buttons and modal management (Task 1)
 *
 * TDD: RED → GREEN → REFACTOR
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern=FinancePage
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
    toString: jest.fn(() => ""),
  })),
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
  })),
}));

jest.mock("@/lib/navigation", () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
  })),
}));

jest.mock("next/dynamic", () => (fn: () => Promise<{ default: React.ComponentType }>, _opts?: unknown) => {
  // Execute the import function to get the module
  let LoadedComponent: React.ComponentType | null = null;
  fn().then((mod) => {
    LoadedComponent = mod.default;
  });
  // Return a component that renders the loaded component or null
  return function DynamicComponent(props: Record<string, unknown>) {
    if (LoadedComponent) return React.createElement(LoadedComponent, props);
    return null;
  };
});

jest.mock("@/utils/generated/hooks", () => ({
  useQueryClient: jest.fn(),
  EVENT_WalletListWallets: "api.wallet.listWallets",
  EVENT_WalletGetTotalBalance: "api.wallet.getTotalBalance",
  EVENT_TransactionListTransactions: "api.transaction.listTransactions",
}));

jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: jest.fn(() => ({
      invalidateQueries: jest.fn(),
    })),
  };
});

// Mock the tab content components as simple stubs
jest.mock("../../transaction/page", () => ({
  TransactionContent: () => (
    <div data-testid="transaction-content">Transactions</div>
  ),
}));

jest.mock("../../report/page", () => ({
  ReportContent: () => <div data-testid="report-content">Reports</div>,
}));

jest.mock("../../budget/page", () => ({
  BudgetContent: () => <div data-testid="budget-content">Budget</div>,
}));

// Mock BaseModal to be a simple pass-through for testing
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({
    isOpen,
    onClose,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="base-modal">
        <div data-testid="modal-title">{title}</div>
        <button onClick={onClose} data-testid="modal-close-btn">
          Close
        </button>
        {children}
      </div>
    ) : null,
}));

// Mock form components
jest.mock("@/features/transaction/forms/AddTransactionForm", () => ({
  AddTransactionForm: ({
    onSuccess,
  }: {
    onSuccess?: () => void;
  }) => (
    <div data-testid="add-transaction-form">
      <button onClick={onSuccess} data-testid="form-success-btn">
        Submit
      </button>
    </div>
  ),
}));

jest.mock("@/features/wallet/forms/TransferMoneyForm", () => ({
  TransferMoneyForm: ({
    onSuccess,
  }: {
    onSuccess?: () => void;
  }) => (
    <div data-testid="transfer-money-form">
      <button onClick={onSuccess} data-testid="form-success-btn">
        Submit
      </button>
    </div>
  ),
}));

jest.mock("@/features/wallet/forms/CreateWalletForm", () => ({
  CreateWalletForm: ({
    onSuccess,
  }: {
    onSuccess?: () => void;
  }) => (
    <div data-testid="create-wallet-form">
      <button onClick={onSuccess} data-testid="form-success-btn">
        Submit
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Minimal i18n messages
// ---------------------------------------------------------------------------

const messages = {
  nav: {
    financePageTitle: "Personal Finance",
    finance: "Finance",
  },
  finance: {
    tabs: {
      transaction: "Transactions",
      report: "Reports",
      budget: "Budget",
    },
    actions: {
      addTransaction: "Add Transaction",
      transferMoney: "Transfer Money",
      createWallet: "Create Wallet",
    },
  },
  modals: {
    titles: {
      addTransaction: "Add Transaction",
      transferMoney: "Transfer Money",
      createWallet: "Create Wallet",
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

// Dynamic import to allow jest mocking to take effect
let FinancePage: React.ComponentType;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../page");
  FinancePage = mod.default;
});

function renderPage() {
  return render(<FinancePage />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FinancePage — Action buttons and modal management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Action buttons render", () => {
    it("renders the Add Transaction button", () => {
      renderPage();
      expect(
        screen.getByRole("button", { name: /add transaction/i })
      ).toBeInTheDocument();
    });

    it("renders the Transfer Money button", () => {
      renderPage();
      expect(
        screen.getByRole("button", { name: /transfer money/i })
      ).toBeInTheDocument();
    });

    it("renders the Create Wallet button", () => {
      renderPage();
      expect(
        screen.getByRole("button", { name: /create wallet/i })
      ).toBeInTheDocument();
    });

    it("all three action buttons are visible", () => {
      renderPage();
      const buttons = screen.getAllByRole("button");
      const actionButtons = buttons.filter((btn) =>
        /add transaction|transfer money|create wallet/i.test(
          btn.textContent ?? ""
        )
      );
      expect(actionButtons).toHaveLength(3);
    });
  });

  describe("Modal state — initially closed", () => {
    it("no modal is open initially", () => {
      renderPage();
      expect(screen.queryByTestId("base-modal")).not.toBeInTheDocument();
    });

    it("no form is rendered initially", () => {
      renderPage();
      expect(
        screen.queryByTestId("add-transaction-form")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("transfer-money-form")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("create-wallet-form")
      ).not.toBeInTheDocument();
    });
  });

  describe("Add Transaction button → modal", () => {
    it("opens modal when Add Transaction button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
    });

    it("shows correct modal title for Add Transaction", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("modal-title")).toHaveTextContent(
        "Add Transaction"
      );
    });

    it("renders AddTransactionForm when modal is open", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("add-transaction-form")).toBeInTheDocument();
    });

    it("does not render other forms when Add Transaction modal is open", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(
        screen.queryByTestId("transfer-money-form")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("create-wallet-form")
      ).not.toBeInTheDocument();
    });
  });

  describe("Transfer Money button → modal", () => {
    it("opens modal when Transfer Money button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /transfer money/i }));
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
    });

    it("shows correct modal title for Transfer Money", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /transfer money/i }));
      expect(screen.getByTestId("modal-title")).toHaveTextContent(
        "Transfer Money"
      );
    });

    it("renders TransferMoneyForm when modal is open", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /transfer money/i }));
      expect(screen.getByTestId("transfer-money-form")).toBeInTheDocument();
    });
  });

  describe("Create Wallet button → modal", () => {
    it("opens modal when Create Wallet button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
    });

    it("shows correct modal title for Create Wallet", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));
      expect(screen.getByTestId("modal-title")).toHaveTextContent(
        "Create Wallet"
      );
    });

    it("renders CreateWalletForm when modal is open", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));
      expect(screen.getByTestId("create-wallet-form")).toBeInTheDocument();
    });
  });

  describe("Modal close", () => {
    it("closes modal when close button is clicked", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("modal-close-btn"));
      expect(screen.queryByTestId("base-modal")).not.toBeInTheDocument();
    });

    it("modal closes on form success callback", () => {
      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
      // Simulate form success
      fireEvent.click(screen.getByTestId("form-success-btn"));
      expect(screen.queryByTestId("base-modal")).not.toBeInTheDocument();
    });

    it("only one modal open at a time — switching closes previous", () => {
      renderPage();
      // Open add transaction modal
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      expect(screen.getByTestId("add-transaction-form")).toBeInTheDocument();
      // Close it
      fireEvent.click(screen.getByTestId("modal-close-btn"));
      // Open transfer money modal
      fireEvent.click(screen.getByRole("button", { name: /transfer money/i }));
      expect(screen.getByTestId("transfer-money-form")).toBeInTheDocument();
      expect(
        screen.queryByTestId("add-transaction-form")
      ).not.toBeInTheDocument();
    });
  });

  describe("Query invalidation on success", () => {
    it("calls queryClient.invalidateQueries on form success", () => {
      const { useQueryClient } = require("@tanstack/react-query");
      const mockInvalidateQueries = jest.fn();
      useQueryClient.mockReturnValue({ invalidateQueries: mockInvalidateQueries });

      renderPage();
      fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
      fireEvent.click(screen.getByTestId("form-success-btn"));

      expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    });
  });
});
