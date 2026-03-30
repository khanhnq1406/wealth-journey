/**
 * Tests for CreatePriceAlertForm component (TDD - RED then GREEN)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="CreatePriceAlertForm"
 *
 * NOTE on Playwright E2E: The full E2E spec is deferred until Task 9 (Settings Alerts Page)
 * creates the route. This file contains Jest component tests covering the form in isolation.
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CreatePriceAlertForm } from "../forms/CreatePriceAlertForm";

// ---------------------------------------------------------------------------
// Message fixture (minimal — only keys used by this form)
// ---------------------------------------------------------------------------
import commonMessages from "@/messages/en/common.json";
import uiMessages from "@/messages/en/ui.json";
import investmentMessages from "@/messages/en/investment.json";
import validationMessages from "@/messages/en/validation.json";

const allMessages = {
  ...commonMessages,
  ...uiMessages,
  ...investmentMessages,
  ...validationMessages,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/utils/generated/hooks", () => ({
  useMutationCreateUserPriceAlert: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  })),
  useQueryGetMarketPrices: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useQueryGetAssetDisplayPrices: jest.fn((req: { assetType: string }) => {
    if (req.assetType === "gold") {
      return {
        data: {
          prices: [
            { typeCode: "SJC", displayName: "SJC", showInInvestment: true },
            { typeCode: "BTMC", displayName: "SJC BTMC", showInInvestment: true },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    if (req.assetType === "silver") {
      return {
        data: {
          prices: [
            { typeCode: "PH_QU_THI_1L", displayName: "Phú Quý thỏi 1L", showInInvestment: true },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    return { data: null, isLoading: false, error: null };
  }),
  EVENT_InvestmentListUserPriceAlerts: "api.investment.listUserPriceAlerts",
}));

// SymbolAutocomplete lives in investment feature — mock to break cross-feature dep in tests
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
// Test wrapper with QueryClient + next-intl
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

function renderForm(props: React.ComponentProps<typeof CreatePriceAlertForm> = {}) {
  return render(<CreatePriceAlertForm {...props} />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CreatePriceAlertForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Step 1 — Asset category selection", () => {
    it("renders without crashing", () => {
      renderForm();
      expect(screen.getByText("Gold")).toBeInTheDocument();
      expect(screen.getByText("Silver")).toBeInTheDocument();
      expect(screen.getByText("Other")).toBeInTheDocument();
    });

    it("Gold category is selected by default", () => {
      renderForm();
      const goldBtn = screen.getByRole("button", { name: "Gold" });
      expect(goldBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("clicking Silver switches to Silver category", () => {
      renderForm();
      const silverBtn = screen.getByRole("button", { name: "Silver" });
      fireEvent.click(silverBtn);
      expect(silverBtn).toHaveAttribute("aria-pressed", "true");
      const goldBtn = screen.getByRole("button", { name: "Gold" });
      expect(goldBtn).toHaveAttribute("aria-pressed", "false");
    });

    it("clicking Other switches to Other category", () => {
      renderForm();
      const otherBtn = screen.getByRole("button", { name: "Other" });
      fireEvent.click(otherBtn);
      expect(otherBtn).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("Step 2 — Symbol selection", () => {
    it("shows gold type dropdown when Gold is selected", () => {
      renderForm();
      expect(screen.getByText(/Gold Type/i)).toBeInTheDocument();
    });

    it("shows silver type dropdown when Silver is selected", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      expect(screen.getByText(/Silver Type/i)).toBeInTheDocument();
    });

    it("shows SymbolAutocomplete when Other is selected", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Other" }));
      expect(screen.getByTestId("symbol-autocomplete")).toBeInTheDocument();
    });

    it("hides gold dropdown when switching to Other", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Other" }));
      expect(screen.queryByText(/Gold Type/i)).not.toBeInTheDocument();
    });
  });

  describe("Step 3 — Alert configuration", () => {
    it("shows price side selector for Gold category", () => {
      renderForm();
      expect(screen.getByText(/Price Side/i)).toBeInTheDocument();
    });

    it("shows price side selector for Silver category", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Silver" }));
      expect(screen.getByText(/Price Side/i)).toBeInTheDocument();
    });

    it("does not show price side for Other category", () => {
      renderForm();
      fireEvent.click(screen.getByRole("button", { name: "Other" }));
      expect(screen.queryByText(/Price Side/i)).not.toBeInTheDocument();
    });

    it("shows Direction selector", () => {
      renderForm();
      expect(screen.getByText(/Direction/i)).toBeInTheDocument();
    });

    it("shows Target Price input", () => {
      renderForm();
      expect(screen.getByText(/Target Price/i)).toBeInTheDocument();
    });

    it("shows Trigger Mode selector", () => {
      renderForm();
      expect(screen.getByText(/Trigger Mode/i)).toBeInTheDocument();
    });

    it("does not show cooldown by default (once mode)", () => {
      renderForm();
      expect(screen.queryByText(/Cooldown/i)).not.toBeInTheDocument();
    });

    it("shows Note field", () => {
      renderForm();
      expect(screen.getByText(/Note/i)).toBeInTheDocument();
    });
  });

  describe("Form submission", () => {
    it("renders Create Alert submit button", () => {
      renderForm();
      expect(
        screen.getByRole("button", { name: /create alert/i })
      ).toBeInTheDocument();
    });

    it("does not call mutation when target price is empty (validation fails)", async () => {
      const { useMutationCreateUserPriceAlert } = require("@/utils/generated/hooks");
      const mockMutate = jest.fn();
      useMutationCreateUserPriceAlert.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      });

      renderForm();
      const submitBtn = screen.getByRole("button", { name: /create alert/i });
      fireEvent.click(submitBtn);
      // Zod validation should prevent mutation call with no price
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it("shows loading state when mutation is pending", () => {
      const { useMutationCreateUserPriceAlert } = require("@/utils/generated/hooks");
      useMutationCreateUserPriceAlert.mockReturnValue({
        mutate: jest.fn(),
        isPending: true,
        isError: false,
        error: null,
      });

      renderForm();
      const submitBtn = screen.getByRole("button", { name: /create alert/i });
      expect(submitBtn).toBeDisabled();
    });

    it("shows success state and calls onSuccess after mutation succeeds", async () => {
      const { useMutationCreateUserPriceAlert } = require("@/utils/generated/hooks");
      let capturedOnSuccess: (() => void) | undefined;

      useMutationCreateUserPriceAlert.mockImplementation(
        (opts?: { onSuccess?: () => void }) => {
          capturedOnSuccess = opts?.onSuccess;
          return {
            mutate: jest.fn(),
            isPending: false,
            isError: false,
            error: null,
          };
        }
      );

      const onSuccess = jest.fn();
      renderForm({ onSuccess });

      // Simulate mutation success callback
      act(() => {
        capturedOnSuccess?.();
      });

      // Success message should appear
      await waitFor(() => {
        expect(
          screen.getByText(/price alert has been created/i)
        ).toBeInTheDocument();
      });

      // Click "Done" — calls onSuccess
      const doneBtn = screen.getByRole("button", { name: /done/i });
      fireEvent.click(doneBtn);
      expect(onSuccess).toHaveBeenCalled();
    });

    it("shows error message when mutation fails", () => {
      const { useMutationCreateUserPriceAlert } = require("@/utils/generated/hooks");
      let capturedOnError: ((err: any) => void) | undefined;

      useMutationCreateUserPriceAlert.mockImplementation(
        (opts?: { onError?: (err: any) => void }) => {
          capturedOnError = opts?.onError;
          return {
            mutate: jest.fn(),
            isPending: false,
            isError: false,
            error: null,
          };
        }
      );

      renderForm();

      act(() => {
        capturedOnError?.({ message: "Server error occurred" });
      });

      expect(screen.getByText(/Server error occurred/i)).toBeInTheDocument();
    });
  });

  describe("Pre-fill props", () => {
    it("pre-selects gold category when defaultCategory is gold", () => {
      renderForm({ defaultCategory: "gold" });
      const goldBtn = screen.getByRole("button", { name: "Gold" });
      expect(goldBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("pre-selects silver category when defaultCategory is silver", () => {
      renderForm({ defaultCategory: "silver" });
      const silverBtn = screen.getByRole("button", { name: "Silver" });
      expect(silverBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("pre-selects other category when defaultCategory is other", () => {
      renderForm({ defaultCategory: "other" });
      const otherBtn = screen.getByRole("button", { name: "Other" });
      expect(otherBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("shows SymbolAutocomplete pre-filled when defaultCategory=other and defaultSymbol provided", () => {
      renderForm({
        defaultCategory: "other",
        defaultSymbol: "AAPL",
        defaultName: "Apple Inc.",
        defaultCurrency: "USD",
      });
      expect(screen.getByTestId("symbol-autocomplete")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("all category buttons have accessible names via text content", () => {
      renderForm();
      expect(screen.getByRole("button", { name: "Gold" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Silver" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Other" })).toBeInTheDocument();
    });

    it("category button group has accessible group role", () => {
      renderForm();
      expect(screen.getByRole("group")).toBeInTheDocument();
    });

    it("submit button is accessible", () => {
      renderForm();
      expect(
        screen.getByRole("button", { name: /create alert/i })
      ).toBeInTheDocument();
    });
  });
});
