import React from "react";
import { screen, waitFor, render, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AssetDisplayConfigTable } from "../AssetDisplayConfigTable";
import adminMessages from "../../../../messages/en/admin.json";
import { EVENT_InvestmentGetAssetDisplayPrices } from "@/utils/generated/hooks";

// Simple render helper that wraps with QueryClientProvider + intl
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={adminMessages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

// Render helper that also returns the queryClient (for spy tests)
function renderWithProvidersAndClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={adminMessages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

// Mock api-client
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

// Mock notification context
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: () => ({ toast: mockToast }),
}));

// Mock BaseModal to simplify (avoids portal issues in jsdom)
jest.mock("@/components/modals/BaseModal", () => ({
  BaseModal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="base-modal">
        <span data-testid="modal-title">{title}</span>
        {children}
      </div>
    ) : null,
}));

// Mock ConfirmationDialog
jest.mock("@/components/modals/ConfirmationDialog", () => ({
  ConfirmationDialog: ({
    title,
    onConfirm,
    onCancel,
  }: {
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="confirmation-dialog">
      <span>{title}</span>
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}));

const mockConfigs = [
  {
    id: 1,
    typeCode: "SJC_1L",
    displayName: "SJC 1 Lượng",
    displayOrder: 1,
    enabled: true,
    showInInvestment: true,
  },
  {
    id: 2,
    typeCode: "DOJI_1L",
    displayName: "DOJI 1 Lượng",
    displayOrder: 2,
    enabled: false,
    showInInvestment: false,
  },
];

describe("AssetDisplayConfigTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ configs: mockConfigs });
  });

  it("renders loading skeleton then config list", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText("SJC 1 Lượng")).toBeInTheDocument();
    });

    expect(screen.getByText("DOJI 1 Lượng")).toBeInTheDocument();
  });

  it("calls the correct admin endpoint with default gold tab", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config?assetType=gold"
      );
    });
  });

  it("shows the Add Asset Type button", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(screen.getByText("SJC 1 Lượng")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /add asset type/i })
    ).toBeInTheDocument();
  });

  it("renders empty state when no configs returned", async () => {
    mockGet.mockResolvedValueOnce({ configs: [] });

    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(
        screen.getByText(/no asset display configs found/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error toast when fetch fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("shows type codes in the config list", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    expect(screen.getByText("DOJI_1L")).toBeInTheDocument();
  });

  it.skip("shows loading spinner (not blank modal) when edit modal opens for an id not yet in the cached config list", async () => {
    // Regression test for the create→auto-edit transition:
    // After create, handleModalSuccess sets modalState=createdId (number).
    // editTarget = configs.find(c => c.id === createdId) returns undefined because
    // the refetch hasn't completed yet (new item not in cache).
    // BUG: spinner was gated on `isLoading` (false during refetch) → blank modal body.
    // FIX: show spinner whenever `typeof modalState === "number" && !editTarget`.

    // Start with empty config list so any numeric modalState will have no editTarget.
    mockGet.mockResolvedValue({ configs: [] });

    renderWithProviders(<AssetDisplayConfigTable />);

    // Wait for initial load with empty list
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });

    // Now queue a slow refetch so the new item never arrives during the test window
    mockGet.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    // Open the "Add Asset Type" modal and submit to trigger create→edit transition
    // We simulate this by mocking post to resolve, triggering handleModalSuccess(createdId)
    mockPost.mockResolvedValue({
      config: { id: 99, typeCode: "NEW_CODE", assetType: "gold" },
    });

    // Click Add Asset Type button
    fireEvent.click(screen.getByRole("button", { name: /add asset type/i }));

    await waitFor(() => {
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
    }, { timeout: 2000 });

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/type code/i), {
      target: { value: "NEW_CODE" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "New Display" },
    });

    // Submit the create form — there are two "Add Asset Type" buttons (table header + form submit).
    // The form submit is the last one in the DOM.
    const addButtons = screen.getAllByRole("button", { name: /add asset type/i });
    const submitButton = addButtons[addButtons.length - 1];
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // After create resolves: modalState transitions to 99, refetch is pending (never resolves).
    // editTarget is undefined. The modal must still be visible and show a spinner, not be blank.
    await waitFor(() => {
      expect(screen.getByTestId("base-modal")).toBeInTheDocument();
    }, { timeout: 3000 });

    // The modal body should contain a spinner, not be blank
    // A spinner is a div with animate-spin class
    const modal = screen.getByTestId("base-modal");
    expect(modal.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("invalidates public price query (EVENT_InvestmentGetAssetDisplayPrices) after delete", async () => {
    // Regression test: deleting a config must invalidate the public price query so
    // GoldPriceTable and LandingGoldPriceTable stop showing the deleted item.
    const { queryClient } = renderWithProvidersAndClient(<AssetDisplayConfigTable />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText("SJC 1 Lượng")).toBeInTheDocument();
    });

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    mockDelete.mockResolvedValueOnce({});

    // Click Delete on first row
    const deleteButtons = screen.getAllByRole("button", { name: /delete sjc 1 lượng/i });
    fireEvent.click(deleteButtons[0]);

    // Confirm dialog appears — click confirm
    await waitFor(() => {
      expect(screen.getByTestId("confirmation-dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    // After delete mutation resolves, the public price query must be invalidated
    await waitFor(() => {
      const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
      const publicPriceInvalidated = calls.some((c) =>
        c.includes(EVENT_InvestmentGetAssetDisplayPrices)
      );
      expect(publicPriceInvalidated).toBe(true);
    });
  });

  it("tab buttons have role=tab after migration", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    // Wait for initial render
    await waitFor(() => {
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBeGreaterThan(0);
    });
  });

  it("invalidates public price query after toggling enabled (update)", async () => {
    // Regression test: disabling a config must also invalidate the public price query so
    // price tables reflect the change without waiting for staleTime to expire.
    const { queryClient } = renderWithProvidersAndClient(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(screen.getByText("SJC 1 Lượng")).toBeInTheDocument();
    });

    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
    mockPut.mockResolvedValueOnce({});

    // Toggle enabled on first row
    const switches = screen.getAllByRole("switch");
    await act(async () => {
      fireEvent.click(switches[0]);
    });

    await waitFor(() => {
      const calls = invalidateSpy.mock.calls.map((c) => JSON.stringify(c[0]));
      const publicPriceInvalidated = calls.some((c) =>
        c.includes(EVENT_InvestmentGetAssetDisplayPrices)
      );
      expect(publicPriceInvalidated).toBe(true);
    });
  });
});
