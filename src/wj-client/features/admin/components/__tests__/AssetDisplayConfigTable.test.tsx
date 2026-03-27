import React from "react";
import { screen, waitFor, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AssetDisplayConfigTable } from "../AssetDisplayConfigTable";

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
      <NextIntlClientProvider locale="en" messages={{}}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
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

  it("calls the correct admin endpoint", async () => {
    renderWithProviders(<AssetDisplayConfigTable />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/api/v1/admin/asset-display-config");
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
});
