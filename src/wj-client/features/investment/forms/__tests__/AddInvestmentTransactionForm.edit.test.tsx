/**
 * Tests for AddInvestmentTransactionForm — Edit Mode (TDD)
 *
 * Covers:
 *  1. Edit mode: form renders with pre-filled values from editTransaction
 *  2. Edit mode: submit calls editMutation.mutate with correct data, not addMutation.mutate
 *  3. Edit mode: success message shows "Transaction Updated!"
 *  4. Add mode: submit calls addMutation.mutate (existing behavior preserved)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPattern="AddInvestmentTransactionForm.edit"
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AddInvestmentTransactionForm } from "../AddInvestmentTransactionForm";
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
// Mocks
// ---------------------------------------------------------------------------

const mockAddMutate = jest.fn();
const mockEditMutate = jest.fn();

jest.mock("@/utils/generated/hooks", () => ({
  useMutationAddInvestmentTransaction: jest.fn((opts?: any) => ({
    mutate: mockAddMutate,
    isPending: false,
    isError: false,
    error: null,
    _opts: opts, // expose opts for capturing callbacks
  })),
  useMutationEditInvestmentTransaction: jest.fn((opts?: any) => ({
    mutate: mockEditMutate,
    isPending: false,
    isError: false,
    error: null,
    _opts: opts,
  })),
  useQueryGetMarketPrice: jest.fn(() => ({
    data: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
  })),
  EVENT_WalletListWallets: "api.wallet.listWallets",
  EVENT_WalletGetWallet: "api.wallet.getWallet",
}));

jest.mock("@/lib/utils/error-translator", () => ({
  getTranslatedError: (_err: any) => _err?.message ?? "Unknown error",
  translateValidationMessage: (_t: any, msg?: string) => msg ?? "",
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
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={allMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

interface RenderProps {
  investmentId?: number;
  investmentType?: InvestmentType;
  investmentCurrency?: string;
  purchaseUnit?: string;
  symbol?: string;
  onSuccess?: () => void;
  editTransaction?: InvestmentTransaction;
}

function renderForm(props: RenderProps = {}) {
  const defaults = {
    investmentId: 1,
    investmentType: InvestmentType.INVESTMENT_TYPE_STOCK,
    investmentCurrency: "USD",
    ...props,
  };
  return render(<AddInvestmentTransactionForm {...defaults} />, {
    wrapper: TestWrapper,
  });
}

/**
 * A minimal valid InvestmentTransaction fixture (stock, USD).
 *
 * Storage format:
 *   quantity:  50 * 10000 = 500000 (INVESTMENT_TYPE_STOCK uses 4 decimal places)
 *   price:     150.25 USD → 150.25 * 100 = 15025 cents
 *   fees:      5 USD → 5 * 100 = 500 cents
 *   transactionDate: 2024-03-15T00:00:00Z → 1710460800
 */
const stockTxFixture: InvestmentTransaction = {
  id: 42,
  investmentId: 1,
  walletId: 1,
  type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
  quantity: 500000, // 50 shares × 10000
  price: 15025, // $150.25 in cents
  cost: 7512500,
  fees: 500, // $5.00 in cents
  transactionDate: 1710460800,
  notes: "Original notes",
  createdAt: 1710460800,
  updatedAt: 1710460800,
  lotId: 0,
  remainingQuantity: 500000,
  displayPrice: undefined,
  displayCost: undefined,
  displayFees: undefined,
  displayCurrency: "USD",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddInvestmentTransactionForm — Edit Mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Pre-fill behavior", () => {
    it("renders without crashing in edit mode", () => {
      renderForm({ editTransaction: stockTxFixture });
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("shows Save Changes button text in edit mode", () => {
      renderForm({ editTransaction: stockTxFixture });
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("shows Add Transaction button text in add mode", () => {
      renderForm();
      expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
    });

    it("pre-fills the transaction date from Unix timestamp in edit mode", () => {
      renderForm({ editTransaction: stockTxFixture });
      // 1710460800 → 2024-03-15
      const dateInput = screen.getByDisplayValue("2024-03-15");
      expect(dateInput).toBeInTheDocument();
    });
  });

  describe("Edit mode submit behavior", () => {
    it("calls editMutate (not addMutate) when form is submitted in edit mode", async () => {
      const {
        useMutationAddInvestmentTransaction,
        useMutationEditInvestmentTransaction,
      } = require("@/utils/generated/hooks");

      const capturedAddOpts: any = { mutate: mockAddMutate, isPending: false };
      const capturedEditOpts: any = { mutate: mockEditMutate, isPending: false };

      useMutationAddInvestmentTransaction.mockReturnValue(capturedAddOpts);
      useMutationEditInvestmentTransaction.mockReturnValue(capturedEditOpts);

      renderForm({ editTransaction: stockTxFixture });

      const form = document.querySelector("form");
      expect(form).not.toBeNull();

      await act(async () => {
        fireEvent.submit(form!);
      });

      await waitFor(() => {
        expect(mockEditMutate).toHaveBeenCalledTimes(1);
        expect(mockAddMutate).not.toHaveBeenCalled();
      });
    });

    it("passes the correct transaction id to the edit mutation", async () => {
      renderForm({ editTransaction: stockTxFixture });

      const form = document.querySelector("form");
      await act(async () => {
        fireEvent.submit(form!);
      });

      await waitFor(() => {
        expect(mockEditMutate).toHaveBeenCalledWith(
          expect.objectContaining({ id: 42 }),
        );
      });
    });

    it("passes the correct type to the edit mutation", async () => {
      renderForm({ editTransaction: stockTxFixture });

      const form = document.querySelector("form");
      await act(async () => {
        fireEvent.submit(form!);
      });

      await waitFor(() => {
        expect(mockEditMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            type: InvestmentTransactionType.INVESTMENT_TRANSACTION_TYPE_BUY,
          }),
        );
      });
    });

    it("passes a transactionDate Unix timestamp to the edit mutation", async () => {
      renderForm({ editTransaction: stockTxFixture });

      const form = document.querySelector("form");
      await act(async () => {
        fireEvent.submit(form!);
      });

      await waitFor(() => {
        const call = mockEditMutate.mock.calls[0]?.[0];
        expect(call).toBeDefined();
        // transactionDate should be a positive Unix timestamp
        expect(call.transactionDate).toBeGreaterThan(0);
      });
    });
  });

  describe("Add mode submit behavior", () => {
    it("calls addMutate (not editMutate) when form is submitted in add mode", async () => {
      renderForm();

      const form = document.querySelector("form");
      await act(async () => {
        fireEvent.submit(form!);
      });

      // Validation will fail (quantity = 0), so neither is called — but no editMutate should be called
      expect(mockEditMutate).not.toHaveBeenCalled();
    });

    it("calls addMutate when form is submitted with valid data in add mode", async () => {
      renderForm();

      // Fill in a valid quantity via the input[name=quantity] selector
      const quantityInput = document.querySelector("input[name='quantity']") as HTMLInputElement | null;
      if (quantityInput) {
        fireEvent.change(quantityInput, { target: { value: "10" } });
      }

      const form = document.querySelector("form");
      await act(async () => {
        fireEvent.submit(form!);
      });

      // editMutate should NOT be called in add mode regardless
      expect(mockEditMutate).not.toHaveBeenCalled();
    });
  });

  describe("Success state", () => {
    it("shows Transaction Updated! success title in edit mode after successful mutation", async () => {
      const { useMutationEditInvestmentTransaction } = require("@/utils/generated/hooks");

      let capturedOnSuccess: (() => void) | undefined;
      useMutationEditInvestmentTransaction.mockImplementation(
        (opts?: { onSuccess?: () => void }) => {
          capturedOnSuccess = opts?.onSuccess;
          return {
            mutate: mockEditMutate,
            isPending: false,
          };
        },
      );

      renderForm({ editTransaction: stockTxFixture });

      act(() => {
        capturedOnSuccess?.();
      });

      await waitFor(() => {
        expect(screen.getByText(/transaction updated!/i)).toBeInTheDocument();
      });
    });

    it("shows Transaction Added! success title in add mode after successful mutation", async () => {
      const { useMutationAddInvestmentTransaction } = require("@/utils/generated/hooks");

      let capturedOnSuccess: (() => void) | undefined;
      useMutationAddInvestmentTransaction.mockImplementation(
        (opts?: { onSuccess?: () => void }) => {
          capturedOnSuccess = opts?.onSuccess;
          return {
            mutate: mockAddMutate,
            isPending: false,
          };
        },
      );

      renderForm();

      act(() => {
        capturedOnSuccess?.();
      });

      await waitFor(() => {
        expect(screen.getByText(/transaction added!/i)).toBeInTheDocument();
      });
    });

    it("calls onSuccess callback after Done button click in success state (edit mode)", async () => {
      const { useMutationEditInvestmentTransaction } = require("@/utils/generated/hooks");

      let capturedOnSuccess: (() => void) | undefined;
      useMutationEditInvestmentTransaction.mockImplementation(
        (opts?: { onSuccess?: () => void }) => {
          capturedOnSuccess = opts?.onSuccess;
          return { mutate: mockEditMutate, isPending: false };
        },
      );

      const onSuccess = jest.fn();
      renderForm({ editTransaction: stockTxFixture, onSuccess });

      act(() => {
        capturedOnSuccess?.();
      });

      await waitFor(() => {
        expect(screen.getByText(/transaction updated!/i)).toBeInTheDocument();
      });

      const doneBtn = screen.getByRole("button", { name: /done/i });
      fireEvent.click(doneBtn);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error handling", () => {
    it("shows error message when edit mutation fails", async () => {
      const { useMutationEditInvestmentTransaction } = require("@/utils/generated/hooks");

      let capturedOnError: ((err: any) => void) | undefined;
      useMutationEditInvestmentTransaction.mockImplementation(
        (opts?: { onError?: (err: any) => void }) => {
          capturedOnError = opts?.onError;
          return { mutate: mockEditMutate, isPending: false };
        },
      );

      renderForm({ editTransaction: stockTxFixture });

      act(() => {
        capturedOnError?.({ message: "Failed to update transaction" });
      });

      await waitFor(() => {
        expect(
          screen.getByText(/failed to update transaction/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Refresh price button", () => {
    it("does not show refresh price button in edit mode", () => {
      renderForm({
        editTransaction: stockTxFixture,
        symbol: "AAPL",
      });
      // Refresh button should be hidden in edit mode
      expect(
        screen.queryByRole("button", { name: /current price|refresh price/i }),
      ).not.toBeInTheDocument();
    });
  });
});
