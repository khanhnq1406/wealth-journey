import React from "react";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { PriceAlertConfigForm } from "../PriceAlertConfigForm";
import adminMessagesEn from "../../../../messages/en/admin.json";

// Mock api-client
const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock("@/utils/api-client", () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: jest.fn(),
  },
}));

// Base config returned by GET — includes new user alert template fields
const baseConfig = {
  cooldownMinutes: 60,
  topMoversCount: 3,
  userAlertTitleTemplate: "{name} cảnh báo giá",
  userAlertAboveBodyTemplate: "{name} vượt mức {price}. Giá hiện tại: {currentPrice}",
  userAlertBelowBodyTemplate: "{name} giảm dưới {price}. Giá hiện tại: {currentPrice}",
  categories: {
    gold_vnd: {
      enabled: true,
      thresholdPct: 2.0,
      titleTemplate: "Cảnh báo vàng {direction}",
      bodyTemplate: "Giá vàng {directionText} {changePct}%",
    },
    gold_usd: {
      enabled: true,
      thresholdPct: 1.5,
      titleTemplate: "Gold alert {direction}",
      bodyTemplate: "Gold price {directionText} {changePct}%",
    },
    silver_vnd: {
      enabled: false,
      thresholdPct: 3.0,
      titleTemplate: "",
      bodyTemplate: "",
    },
    silver_usd: {
      enabled: false,
      thresholdPct: 2.5,
      titleTemplate: "",
      bodyTemplate: "",
    },
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={adminMessagesEn}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("PriceAlertConfigForm — user alert templates section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ success: true, config: baseConfig });
  });

  it("renders the user alert templates section heading", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByText("User Price Alert Templates")).toBeInTheDocument();
    });
  });

  it("renders 3 user alert template fields: title input and 2 textareas", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByText("Title Template")).toBeInTheDocument();
      expect(screen.getByText("Body Template (Above Target)")).toBeInTheDocument();
      expect(screen.getByText("Body Template (Below Target)")).toBeInTheDocument();
    });
  });

  it("displays the title template input with the fetched value", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue("{name} cảnh báo giá");
      expect(titleInput).toBeInTheDocument();
      expect(titleInput.tagName).toBe("INPUT");
    });
  });

  it("displays above body textarea with the fetched value", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      const aboveTextarea = screen.getByDisplayValue(
        "{name} vượt mức {price}. Giá hiện tại: {currentPrice}"
      );
      expect(aboveTextarea).toBeInTheDocument();
      expect(aboveTextarea.tagName).toBe("TEXTAREA");
    });
  });

  it("displays below body textarea with the fetched value", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      const belowTextarea = screen.getByDisplayValue(
        "{name} giảm dưới {price}. Giá hiện tại: {currentPrice}"
      );
      expect(belowTextarea).toBeInTheDocument();
      expect(belowTextarea.tagName).toBe("TEXTAREA");
    });
  });

  it("renders placeholder chips for the user alert title template", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      // We expect USER_ALERT_PLACEHOLDERS chips: name, symbol, price, currentPrice, currency, priceSide
      // Each chip appears multiple times (once per field row), check at least one exists
      const nameChips = screen.getAllByText("{name}");
      expect(nameChips.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders {price} and {priceSide} placeholder chips in user alert section", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      const priceChips = screen.getAllByText("{price}");
      expect(priceChips.length).toBeGreaterThanOrEqual(1);

      const priceSideChips = screen.getAllByText("{priceSide}");
      expect(priceSideChips.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("updates title template when user types in the input", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("{name} cảnh báo giá")).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue("{name} cảnh báo giá");
    fireEvent.change(titleInput, { target: { value: "New title" } });

    expect(screen.getByDisplayValue("New title")).toBeInTheDocument();
  });

  it("shows live preview for title template when value is set", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      // Preview should resolve {name} -> "SJC 9999" in the sample values
      expect(screen.getByText("SJC 9999 cảnh báo giá")).toBeInTheDocument();
    });
  });

  it("shows live preview for above body template", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      // {name} -> "SJC 9999", {price} -> "50,000 VND", {currentPrice} -> "51,200 VND"
      expect(
        screen.getByText("SJC 9999 vượt mức 50,000 VND. Giá hiện tại: 51,200 VND")
      ).toBeInTheDocument();
    });
  });

  it("renders collapsible user alert placeholder guide", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByText("User Alert Placeholder Guide")).toBeInTheDocument();
    });
  });

  it("expands user alert placeholder guide on click", async () => {
    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByText("User Alert Placeholder Guide")).toBeInTheDocument();
    });

    const guideButton = screen.getByText("User Alert Placeholder Guide");
    fireEvent.click(guideButton);

    await waitFor(() => {
      // Guide descriptions become visible
      expect(screen.getByText("Asset name (e.g., SJC 9999)")).toBeInTheDocument();
      expect(screen.getByText("Target price with currency")).toBeInTheDocument();
    });
  });

  it("includes user alert fields in the PUT request body on save", async () => {
    mockPut.mockResolvedValue({ success: true, config: baseConfig });

    renderWithProviders(<PriceAlertConfigForm />);

    await waitFor(() => {
      expect(screen.getByText("User Price Alert Templates")).toBeInTheDocument();
    });

    // Change the title template value
    const titleInput = screen.getByDisplayValue("{name} cảnh báo giá");
    fireEvent.change(titleInput, { target: { value: "Updated title {name}" } });

    // Click save
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        "/api/v1/admin/price-alert-config",
        expect.objectContaining({
          userAlertTitleTemplate: "Updated title {name}",
          userAlertAboveBodyTemplate: "{name} vượt mức {price}. Giá hiện tại: {currentPrice}",
          userAlertBelowBodyTemplate: "{name} giảm dưới {price}. Giá hiện tại: {currentPrice}",
        })
      );
    });
  });
});
