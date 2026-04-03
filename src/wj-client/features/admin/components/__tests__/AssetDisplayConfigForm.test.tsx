import React from "react";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AssetDisplayConfigForm } from "../AssetDisplayConfigForm";
import adminMessages from "../../../../messages/en/admin.json";

// Mock api-client
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockGet = jest.fn();

jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: jest.fn(),
  },
}));

// Mock FetchCodeList to avoid nested complexity
jest.mock("../FetchCodeList", () => ({
  FetchCodeList: ({ configId, assetType }: { configId: number; assetType: string }) => (
    <div data-testid="fetch-code-list" data-config-id={configId} data-asset-type={assetType}>
      FetchCodeList
    </div>
  ),
}));

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

describe("AssetDisplayConfigForm — create mode asset type selector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows Gold, Silver, and Currency selector pills in create mode", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    expect(screen.getByRole("button", { name: /gold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /silver/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /currency/i })).toBeInTheDocument();
  });

  it("defaults to the assetType prop passed in (gold)", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    // Gold pill should appear active (selected)
    const goldPill = screen.getByRole("button", { name: /gold/i });
    expect(goldPill).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to the assetType prop passed in (silver)", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="silver" />
    );

    const silverPill = screen.getByRole("button", { name: /silver/i });
    expect(silverPill).toHaveAttribute("aria-pressed", "true");
  });

  it("defaults to the assetType prop passed in (currency)", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="currency" />
    );

    const currencyPill = screen.getByRole("button", { name: /currency/i });
    expect(currencyPill).toHaveAttribute("aria-pressed", "true");
  });

  it("allows switching to silver by clicking the silver pill", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    const silverPill = screen.getByRole("button", { name: /silver/i });
    fireEvent.click(silverPill);

    expect(silverPill).toHaveAttribute("aria-pressed", "true");
    const goldPill = screen.getByRole("button", { name: /gold/i });
    expect(goldPill).toHaveAttribute("aria-pressed", "false");
  });

  it("allows switching to currency by clicking the currency pill", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    const currencyPill = screen.getByRole("button", { name: /currency/i });
    fireEvent.click(currencyPill);

    expect(currencyPill).toHaveAttribute("aria-pressed", "true");
    const goldPill = screen.getByRole("button", { name: /gold/i });
    expect(goldPill).toHaveAttribute("aria-pressed", "false");
  });

  it("sends selected assetType in the create request when switched to silver", async () => {
    mockPost.mockResolvedValue({ config: { id: 42, typeCode: "XAG", assetType: "silver" } });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    // Switch to silver
    fireEvent.click(screen.getByRole("button", { name: /silver/i }));

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/type code/i), { target: { value: "XAG" } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "Silver Spot" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /add asset type/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config",
        expect.objectContaining({ assetType: "silver" })
      );
    });
  });

  it("sends selected assetType in the create request when switched to currency", async () => {
    mockPost.mockResolvedValue({ config: { id: 55, typeCode: "USD", assetType: "currency" } });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    // Switch to currency
    fireEvent.click(screen.getByRole("button", { name: /currency/i }));

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/type code/i), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "US Dollar" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /add asset type/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        "/api/v1/admin/asset-display-config",
        expect.objectContaining({ assetType: "currency" })
      );
    });
  });

  it("does NOT show asset type selector in edit mode", () => {
    renderWithProviders(
      <AssetDisplayConfigForm
        mode="edit"
        assetType="gold"
        initialValues={{
          id: 1,
          typeCode: "SJC_1L",
          displayName: "SJC 1 Lượng",
          displayOrder: 1,
          enabled: true,
          showInInvestment: true,
        }}
      />
    );

    // In edit mode, no asset type selector pills
    expect(screen.queryByRole("button", { name: /^gold$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^silver$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^currency$/i })).not.toBeInTheDocument();
  });
});

describe("AssetDisplayConfigForm — FetchCodeList receives correct assetType in edit mode", () => {
  it("passes assetType prop (not typeCode) to FetchCodeList", () => {
    renderWithProviders(
      <AssetDisplayConfigForm
        mode="edit"
        assetType="gold"
        initialValues={{
          id: 1,
          typeCode: "SJL1L10",
          displayName: "SJC 1 lượng 10",
          displayOrder: 1,
          enabled: true,
          showInInvestment: true,
        }}
      />
    );

    const fetchCodeList = screen.getByTestId("fetch-code-list");
    // Must be "gold", NOT "SJL1L10" (the typeCode)
    expect(fetchCodeList).toHaveAttribute("data-asset-type", "gold");
  });

  it("passes silver assetType when config is a silver entry", () => {
    renderWithProviders(
      <AssetDisplayConfigForm
        mode="edit"
        assetType="silver"
        initialValues={{
          id: 5,
          typeCode: "XAG_VN",
          displayName: "Bạc Việt Nam",
          displayOrder: 1,
          enabled: true,
          showInInvestment: false,
        }}
      />
    );

    const fetchCodeList = screen.getByTestId("fetch-code-list");
    expect(fetchCodeList).toHaveAttribute("data-asset-type", "silver");
  });
});

describe("AssetDisplayConfigForm — displayOrder auto-fill from fetched configs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no configs → displayOrder = 1
    mockGet.mockResolvedValue({ configs: [] });
  });

  it("pre-fills displayOrder with max(existing displayOrders)+1 in create mode", async () => {
    // Gold configs with max displayOrder = 4 → expect 5
    mockGet.mockResolvedValue({ configs: [{ id: 1, displayOrder: 4 }, { id: 2, displayOrder: 2 }] });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("5");
    });
  });

  it("defaults displayOrder to 1 when no existing configs", async () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("1");
    });
  });

  it("ignores fetched configs in edit mode — keeps initialValues.displayOrder", async () => {
    // Even if the query would return configs (it doesn't run in edit mode),
    // the edit mode value is driven by initialValues.
    renderWithProviders(
      <AssetDisplayConfigForm
        mode="edit"
        assetType="gold"
        initialValues={{
          id: 1,
          typeCode: "SJC_1L",
          displayName: "SJC 1 Lượng",
          displayOrder: 3,
          enabled: true,
          showInInvestment: true,
        }}
      />
    );

    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("3");
    });
    // Query should not have been called in edit mode
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("updates displayOrder when fetched configs change after type switch", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("assetType=gold")) {
        return Promise.resolve({ configs: [{ id: 1, displayOrder: 2 }] });
      }
      if (url.includes("assetType=silver")) {
        return Promise.resolve({ configs: [{ id: 2, displayOrder: 6 }] });
      }
      return Promise.resolve({ configs: [] });
    });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    // Gold: max=2, expect 3
    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("3");
    });

    // Switch to silver
    fireEvent.click(screen.getByRole("button", { name: /silver/i }));

    // Silver: max=6, expect 7
    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("7");
    });
  });
});

describe("AssetDisplayConfigForm — onSuccess callback passes created id", () => {
  it("calls onSuccess with the created config id after successful create", async () => {
    const mockOnSuccess = jest.fn();
    mockPost.mockResolvedValue({ success: true, data: { config: { id: 99, typeCode: "DOJI", assetType: "gold" } } });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" onSuccess={mockOnSuccess} />
    );

    fireEvent.change(screen.getByLabelText(/type code/i), { target: { value: "DOJI" } });
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: "DOJI Gold" } });

    fireEvent.click(screen.getByRole("button", { name: /add asset type/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(99, "gold");
    });
  });

  it("calls onSuccess with undefined after successful edit (no id needed)", async () => {
    const mockOnSuccess = jest.fn();
    mockPut.mockResolvedValue({ config: { id: 1 } });

    renderWithProviders(
      <AssetDisplayConfigForm
        mode="edit"
        onSuccess={mockOnSuccess}
        initialValues={{
          id: 1,
          typeCode: "SJC_1L",
          displayName: "SJC 1 Lượng",
          displayOrder: 1,
          enabled: true,
          showInInvestment: true,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "SJC 1 Lượng Updated" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(undefined);
    });
  });
});

describe("AssetDisplayConfigForm — displayOrder updates when switching asset type in create mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: return empty configs so nextDisplayOrder = 1
    mockGet.mockResolvedValue({ configs: [] });
  });

  it("updates displayOrder when user switches from gold to silver inside the form", async () => {
    // Gold tab has 2 configs (max displayOrder = 2), silver has 1 config (max = 5)
    mockGet.mockImplementation((url: string) => {
      if (url.includes("assetType=gold")) {
        return Promise.resolve({ configs: [{ id: 1, displayOrder: 2 }, { id: 2, displayOrder: 1 }] });
      }
      if (url.includes("assetType=silver")) {
        return Promise.resolve({ configs: [{ id: 3, displayOrder: 5 }] });
      }
      return Promise.resolve({ configs: [] });
    });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    // Wait for gold's nextDisplayOrder (2+1=3) to appear
    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("3");
    });

    // Switch to silver
    fireEvent.click(screen.getByRole("button", { name: /silver/i }));

    // displayOrder should update to silver's max+1 (5+1=6)
    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("6");
    });
  });

  it("displays displayOrder = 1 when switching to a type with no existing configs", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("assetType=gold")) {
        return Promise.resolve({ configs: [{ id: 1, displayOrder: 3 }] });
      }
      // currency has no configs
      return Promise.resolve({ configs: [] });
    });

    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("4");
    });

    // Switch to currency
    fireEvent.click(screen.getByRole("button", { name: /currency/i }));

    await waitFor(() => {
      const displayOrderInput = screen.getByLabelText(/display order/i) as HTMLInputElement;
      expect(displayOrderInput.value).toBe("1");
    });
  });
});
