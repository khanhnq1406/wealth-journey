import React from "react";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { AssetDisplayConfigForm } from "../AssetDisplayConfigForm";
import adminMessages from "../../../../messages/en/admin.json";

// Mock api-client
const mockPost = jest.fn();
const mockPut = jest.fn();

jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: jest.fn(),
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

  it("shows both Gold and Silver selector pills in create mode", () => {
    renderWithProviders(
      <AssetDisplayConfigForm mode="create" assetType="gold" />
    );

    expect(screen.getByRole("button", { name: /gold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /silver/i })).toBeInTheDocument();
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

    // In edit mode, no Gold/Silver selector pills
    expect(screen.queryByRole("button", { name: /^gold$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^silver$/i })).not.toBeInTheDocument();
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
