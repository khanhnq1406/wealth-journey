import React from "react";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { FetchCodeList } from "../FetchCodeList";

// i18n messages required by FetchCodeList
const messages = {
  admin: {
    assetDisplayConfig: {
      fetchCodes: {
        title: "Fetch Codes",
        addButton: "+ Add Fetch Code",
        emptyMessage: "No fetch codes configured",
        emptyDescription: "Add fetch codes to resolve prices for this asset type",
        columns: {
          typeCode: "Type Code",
          priority: "Priority",
          actions: "Actions",
        },
        form: {
          typeCode: "Type Code",
          typeCodePlaceholder: "Select or type a code...",
          typeCodeRequired: "Type code is required",
          priority: "Priority",
          priorityHelp: "Lower number = higher priority",
          add: "Add",
          adding: "Adding...",
          availableCodes: "Available codes",
          availableCodesLoading: "Loading codes...",
        },
        delete: {
          title: "Remove Fetch Code",
          message: "Are you sure you want to remove fetch code {code}?",
          confirm: "Remove",
        },
        toast: {
          created: "Fetch code added",
          createFailed: "Failed to add fetch code",
          deleted: "Fetch code removed",
          deleteFailed: "Failed to remove fetch code",
          updated: "Priority updated",
          updateFailed: "Failed to update priority",
        },
      },
    },
  },
  uiFeedback: {
    emptyState: {
      noDataFound: "No data found",
      noDataAvailable: "No data available",
      noDataDescription: "No data description",
    },
  },
  common: {
    confirm: "Confirm",
    cancel: "Cancel",
  },
};

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
      <NextIntlClientProvider locale="en" messages={messages}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

// Mock api-client
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

// Mock notification context
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@/contexts/NotificationContext", () => ({
  useNotification: () => ({ toast: mockToast }),
}));

// Mock ConfirmationDialog — avoids portal issues in jsdom
jest.mock("@/components/modals/ConfirmationDialog", () => ({
  ConfirmationDialog: ({
    title,
    onConfirm,
    onCancel,
    isLoading,
  }: {
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
  }) => (
    <div data-testid="confirmation-dialog">
      <span data-testid="dialog-title">{title}</span>
      <button data-testid="dialog-confirm" onClick={onConfirm} disabled={isLoading}>
        confirm
      </button>
      <button data-testid="dialog-cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));

const mockFetchCodes = [
  { id: 1, configId: 10, typeCode: "SJC_1L", priority: 1 },
  { id: 2, configId: 10, typeCode: "DOJI_1L", priority: 2 },
];

describe("FetchCodeList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ fetchCodes: mockFetchCodes });
    mockPost.mockResolvedValue({ fetchCode: { id: 3, configId: 10, typeCode: "SJC_R2", priority: 3 } });
    mockDelete.mockResolvedValue({ success: true });
  });

  it("renders fetch codes ordered by priority", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    expect(screen.getByText("DOJI_1L")).toBeInTheDocument();

    // Both priority numbers visible
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty state when no fetch codes", async () => {
    mockGet.mockResolvedValueOnce({ fetchCodes: [] });

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(
        screen.getByText(/no fetch codes configured/i)
      ).toBeInTheDocument();
    });
  });

  it("calls the correct admin endpoint to list fetch codes", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config/10/fetch-codes"
      );
    });
  });

  it("renders add form with typeCode and priority inputs", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    // The add form inputs should be visible
    expect(screen.getByPlaceholderText(/select or type a code/i)).toBeInTheDocument();
    // Priority input is a number input
    const priorityInput = screen.getByRole("spinbutton");
    expect(priorityInput).toBeInTheDocument();
  });

  it("shows delete button per fetch code", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    // There should be delete buttons for each row
    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows confirmation dialog when delete button is clicked", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    // Click the first delete button
    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    fireEvent.click(deleteButtons[0]);

    // Confirmation dialog should appear
    expect(screen.getByTestId("confirmation-dialog")).toBeInTheDocument();
  });

  it("calls DELETE API when delete is confirmed", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    fireEvent.click(deleteButtons[0]);

    const confirmButton = screen.getByTestId("dialog-confirm");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config/10/fetch-codes/1"
      );
    });
  });

  it("cancels delete dialog without calling API", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    fireEvent.click(deleteButtons[0]);

    const cancelButton = screen.getByTestId("dialog-cancel");
    fireEvent.click(cancelButton);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirmation-dialog")).not.toBeInTheDocument();
  });

  it("calls POST API when add form is submitted", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    // Fill in typeCode
    const typeCodeInput = screen.getByPlaceholderText(/select or type a code/i);
    fireEvent.change(typeCodeInput, { target: { value: "SJC_R2" } });

    // Fill in priority
    const priorityInput = screen.getByRole("spinbutton");
    fireEvent.change(priorityInput, { target: { value: "3" } });

    // Submit the add form
    const addButton = screen.getByRole("button", { name: /add/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config/10/fetch-codes",
        { typeCode: "SJC_R2", priority: 3 }
      );
    });
  });

  it("shows error toast when fetch fails", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("shows success toast after delete confirmation", async () => {
    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(screen.getByText("SJC_1L")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByTestId("dialog-confirm"));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  // --- Available type codes from DB ---

  it("fetches available type codes using assetType param", async () => {
    mockGet
      .mockResolvedValueOnce({ fetchCodes: mockFetchCodes }) // fetch-codes list
      .mockResolvedValueOnce({ typeCodes: ["SJC_1L", "SJC_R2", "DOJI_1L"] }); // available codes

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/api/v1/admin/asset-price-type-codes?assetType=gold"
      );
    });
  });

  it("renders available type codes as suggestions in the autocomplete", async () => {
    mockGet
      .mockResolvedValueOnce({ fetchCodes: [] })
      .mockResolvedValueOnce({ typeCodes: ["SJC_1L", "SJC_R2", "DOJI_1L"] });

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    // The combobox should be present immediately
    const combobox = screen.getByRole("combobox");
    expect(combobox).toBeInTheDocument();

    // Open the dropdown by focusing the input
    fireEvent.focus(combobox);

    // Suggestions should appear in the dropdown
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "SJC_1L" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "SJC_R2" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "DOJI_1L" })).toBeInTheDocument();
    });
  });

  it("selecting a suggestion from autocomplete fills the typeCode input", async () => {
    mockGet
      .mockResolvedValueOnce({ fetchCodes: [] })
      .mockResolvedValueOnce({ typeCodes: ["SJC_1L", "SJC_R2"] });

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    const combobox = screen.getByRole("combobox");

    // Wait for available codes to load before opening the dropdown
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    // Open dropdown by focusing
    fireEvent.focus(combobox);

    // Wait for listbox to appear with options
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "SJC_R2" })).toBeInTheDocument();
    });

    // Click the SJC_R2 option
    fireEvent.mouseDown(screen.getByRole("option", { name: "SJC_R2" }));

    expect((combobox as HTMLInputElement).value).toBe("SJC_R2");
  });

  it("shows loading spinner in autocomplete while available codes are loading", async () => {
    // Delay the available codes response
    mockGet
      .mockResolvedValueOnce({ fetchCodes: [] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ typeCodes: ["SJC_1L"] }), 500)
          )
      );

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    // The combobox is still rendered while loading
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    // The old "loading codes..." text label should NOT appear
    expect(screen.queryByText(/loading codes/i)).not.toBeInTheDocument();
  });

  it("hides available codes section when no codes returned", async () => {
    mockGet
      .mockResolvedValueOnce({ fetchCodes: [] })
      .mockResolvedValueOnce({ typeCodes: [] });

    renderWithProviders(<FetchCodeList configId={10} assetType="gold" />);

    await waitFor(() => {
      // Wait for queries to settle
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByText("Available codes")).not.toBeInTheDocument();
  });

  // --- FilterableAutocomplete integration ---

  it("renders FilterableAutocomplete instead of button grid for typeCode input", () => {
    renderWithProviders(<FetchCodeList configId={1} assetType="gold" />);
    // Should find combobox (FilterableAutocomplete)
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    // Should NOT find the old "Available Codes:" label
    expect(screen.queryByText("Available Codes:")).not.toBeInTheDocument();
  });
});
