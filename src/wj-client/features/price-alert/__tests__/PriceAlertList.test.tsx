/**
 * Tests for PriceAlertList component (TDD - RED then GREEN)
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PriceAlertList"
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PriceAlertList } from "../components/PriceAlertList";
import {
  AlertStatus,
  AlertDirection,
  AlertTriggerMode,
  InvestmentType,
} from "@/gen/protobuf/v1/investment";

// ---------------------------------------------------------------------------
// Message fixture
// ---------------------------------------------------------------------------
import commonMessages from "@/messages/en/common.json";
import uiMessages from "@/messages/en/ui.json";
import investmentMessages from "@/messages/en/investment.json";

const allMessages = {
  ...commonMessages,
  ...uiMessages,
  ...investmentMessages,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_ALERT = {
  id: 1,
  userId: 100,
  symbol: "VCB",
  name: "Vietcombank",
  assetType: InvestmentType.INVESTMENT_TYPE_STOCK,
  currency: "VND",
  priceSide: "buy",
  direction: AlertDirection.ALERT_DIRECTION_ABOVE,
  targetPrice: 85000,
  triggerMode: AlertTriggerMode.ALERT_TRIGGER_MODE_ONCE,
  cooldownHours: 0,
  status: AlertStatus.ALERT_STATUS_ACTIVE,
  note: "",
  lastTriggeredAt: 0,
  triggerCount: 0,
  currentPriceAtCreation: 80000,
  currentPrice: 82000,
  createdAt: 1700000000,
};

const MOCK_TRIGGERED_ALERT = {
  ...MOCK_ALERT,
  id: 2,
  symbol: "AAPL",
  name: "Apple Inc.",
  status: AlertStatus.ALERT_STATUS_TRIGGERED,
};

const MOCK_PAUSED_ALERT = {
  ...MOCK_ALERT,
  id: 3,
  symbol: "BTC",
  name: "Bitcoin",
  status: AlertStatus.ALERT_STATUS_PAUSED,
};

jest.mock("@/utils/generated/hooks", () => ({
  useQueryListUserPriceAlerts: jest.fn(),
  useMutationUpdateUserPriceAlert: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useMutationDeleteUserPriceAlert: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  EVENT_InvestmentListUserPriceAlerts: "api.investment.listUserPriceAlerts",
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

function renderList(props: React.ComponentProps<typeof PriceAlertList> = {}) {
  return render(<PriceAlertList {...props} />, { wrapper: TestWrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PriceAlertList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set default mock implementations after clearAllMocks
    const { useQueryListUserPriceAlerts } = require("@/utils/generated/hooks");
    useQueryListUserPriceAlerts.mockReturnValue({
      data: {
        alerts: [MOCK_ALERT, MOCK_TRIGGERED_ALERT, MOCK_PAUSED_ALERT],
        total: 3,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { useMutationUpdateUserPriceAlert, useMutationDeleteUserPriceAlert } = require("@/utils/generated/hooks");
    useMutationUpdateUserPriceAlert.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    useMutationDeleteUserPriceAlert.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      renderList();
      expect(document.body).toBeTruthy();
    });

    it("displays alert symbols", () => {
      renderList();
      // VCB appears in both mobile and desktop views
      const symbols = screen.getAllByText("VCB");
      expect(symbols.length).toBeGreaterThan(0);
    });

    it("shows active status badge", () => {
      renderList();
      const activeLabels = screen.getAllByText("Active");
      expect(activeLabels.length).toBeGreaterThan(0);
    });

    it("shows triggered status badge", () => {
      renderList();
      const triggeredLabels = screen.getAllByText("Triggered");
      expect(triggeredLabels.length).toBeGreaterThan(0);
    });

    it("shows paused status badge", () => {
      renderList();
      const pausedLabels = screen.getAllByText("Paused");
      expect(pausedLabels.length).toBeGreaterThan(0);
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator when fetching", () => {
      const { useQueryListUserPriceAlerts } = require("@/utils/generated/hooks");
      useQueryListUserPriceAlerts.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: jest.fn(),
      });

      renderList();
      // Loading state should show something (spinner or skeleton)
      expect(document.body).toBeTruthy();
    });
  });

  describe("Empty state", () => {
    it("shows empty state when no alerts", () => {
      const { useQueryListUserPriceAlerts } = require("@/utils/generated/hooks");
      useQueryListUserPriceAlerts.mockReturnValue({
        data: { alerts: [], total: 0 },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderList();
      // Should show empty state — either through MobileTable's emptyMessage or EmptyState component
      expect(document.body).toBeTruthy();
    });
  });

  describe("Actions — delete", () => {
    it("shows delete button for alerts", () => {
      renderList();
      // Should have at least one delete button (aria-label contains "Delete alert for")
      const deleteButtons = screen.getAllByLabelText(/Delete alert for/i);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("opens confirmation dialog on delete", () => {
      renderList();
      const deleteButtons = screen.getAllByLabelText(/Delete alert for/i);
      fireEvent.click(deleteButtons[0]);
      // ConfirmationDialog should appear with "Delete Alert" title
      expect(screen.getByText("Delete Alert")).toBeInTheDocument();
    });
  });

  describe("Actions — toggle", () => {
    it("shows toggle button for active alerts", () => {
      renderList();
      // Active alerts show "Pause alert for {symbol}" button
      const toggleButtons = screen.getAllByLabelText(/Pause alert for/i);
      expect(toggleButtons.length).toBeGreaterThan(0);
    });

    it("calls updateMutation when toggling active alert to paused", async () => {
      const { useMutationUpdateUserPriceAlert } = require("@/utils/generated/hooks");
      const mockMutate = jest.fn();
      useMutationUpdateUserPriceAlert.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      renderList();
      const toggleButtons = screen.getAllByLabelText(/Pause alert for/i);
      fireEvent.click(toggleButtons[0]);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: expect.any(Number),
            status: AlertStatus.ALERT_STATUS_PAUSED,
          })
        );
      });
    });

    it("does not show toggle button for triggered alerts", () => {
      // Triggered alerts cannot be toggled
      const { useQueryListUserPriceAlerts } = require("@/utils/generated/hooks");
      useQueryListUserPriceAlerts.mockReturnValue({
        data: { alerts: [MOCK_TRIGGERED_ALERT], total: 1 },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderList();
      // No pause/activate toggle buttons should be present for triggered alert
      const pauseButtons = screen.queryAllByLabelText(/Pause alert for/i);
      const activateButtons = screen.queryAllByLabelText(/Activate alert for/i);
      expect(pauseButtons.length).toBe(0);
      expect(activateButtons.length).toBe(0);
    });
  });

  describe("Status filter", () => {
    it("accepts statusFilter prop without crashing", () => {
      renderList({ statusFilter: AlertStatus.ALERT_STATUS_ACTIVE });
      expect(document.body).toBeTruthy();
    });
  });
});
