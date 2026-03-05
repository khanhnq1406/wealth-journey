import { render, screen, fireEvent } from "@testing-library/react";
import { DuplicateSection } from "../DuplicateSection";
import { DuplicateMatch } from "@/gen/protobuf/v1/import";

describe("DuplicateSection", () => {
  const mockMatches: DuplicateMatch[] = [
    {
      importedTransaction: {
        rowNumber: 10,
        date: 1707638400 as any,
        amount: { amount: -50000 as any, currency: "VND" },
        description: "CAFE HIGHLANDS",
        type: 2,
        suggestedCategoryId: 123,
        categoryConfidence: 85,
        referenceNumber: "",
        isValid: true,
        validationErrors: [],
        originalAmount: undefined,
        exchangeRate: 0,
        exchangeRateSource: "",
        exchangeRateDate: 0 as any,
      },
      existingTransaction: {
        id: 9876,
        walletId: 42,
        categoryId: 123,
        amount: { amount: -50000 as any, currency: "VND" },
        date: 1707638400 as any,
        note: "CAFE HIGHLANDS - HCM",
        createdAt: 1707638400 as any,
        updatedAt: 1707638400 as any,
        currency: "VND",
        externalId: "",
        originalAmount: undefined,
        originalCurrency: "",
        exchangeRate: 0,
        exchangeRateDate: 0 as any,
        exchangeRateSource: "",
      },
      confidence: 95.5,
      matchReason: "Exact match: same date, amount, and similar description",
    },
    {
      importedTransaction: {
        rowNumber: 15,
        date: 1707638500 as any,
        amount: { amount: -100000 as any, currency: "VND" },
        description: "Grocery Store",
        type: 2,
        suggestedCategoryId: 124,
        categoryConfidence: 80,
        referenceNumber: "",
        isValid: true,
        validationErrors: [],
        originalAmount: undefined,
        exchangeRate: 0,
        exchangeRateSource: "",
        exchangeRateDate: 0 as any,
      },
      existingTransaction: {
        id: 9877,
        walletId: 42,
        categoryId: 124,
        amount: { amount: -100000 as any, currency: "VND" },
        date: 1707638500 as any,
        note: "Grocery",
        createdAt: 1707638500 as any,
        updatedAt: 1707638500 as any,
        currency: "VND",
        externalId: "",
        originalAmount: undefined,
        originalCurrency: "",
        exchangeRate: 0,
        exchangeRateDate: 0 as any,
        exchangeRateSource: "",
      },
      confidence: 75.0,
      matchReason: "Similar date and amount",
    },
  ];

  const mockOnDuplicateHandled = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no duplicates", () => {
    const { container } = render(
      <DuplicateSection
        matches={[]}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays duplicate count in header", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );
    expect(screen.getByText(/2 Potential Duplicates/i)).toBeInTheDocument();
    expect(screen.getByText(/Review to avoid duplicate entries/i)).toBeInTheDocument();
  });

  it("uses singular form for single duplicate", () => {
    render(
      <DuplicateSection
        matches={[mockMatches[0]]}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );
    expect(screen.getByText(/1 Potential Duplicate$/i)).toBeInTheDocument();
  });

  it("expands to show first duplicate by default", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    // Should show row number
    expect(screen.getByText(/Row 10/i)).toBeInTheDocument();

    // Should show confidence
    expect(screen.getByText(/95.5%/i)).toBeInTheDocument();
  });

  it("collapses and expands when clicking header", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    // Initially expanded
    expect(screen.getByText(/Row 10/i)).toBeInTheDocument();

    // Click to collapse
    const header = screen.getByRole("button", { name: /2 Potential Duplicates/i });
    fireEvent.click(header);

    // Should be hidden
    expect(screen.queryByText(/Row 10/i)).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(header);
    expect(screen.getByText(/Row 10/i)).toBeInTheDocument();
  });

  it("displays match reason", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    expect(screen.getByText(/Exact match: same date, amount, and similar description/i)).toBeInTheDocument();
  });

  it("calls onDuplicateHandled with merge when Merge button is clicked", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    const mergeButton = screen.getByText("Merge");
    fireEvent.click(mergeButton);

    expect(mockOnDuplicateHandled).toHaveBeenCalledWith(10, "merge");
  });

  it("calls onDuplicateHandled with keep when Keep Both button is clicked", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    const keepButton = screen.getByText("Keep Both");
    fireEvent.click(keepButton);

    expect(mockOnDuplicateHandled).toHaveBeenCalledWith(10, "keep");
  });

  it("calls onDuplicateHandled with skip when Skip button is clicked", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    const skipButton = screen.getByText("Skip Import");
    fireEvent.click(skipButton);

    expect(mockOnDuplicateHandled).toHaveBeenCalledWith(10, "skip");
  });

  it("moves to next duplicate after handling current one", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    // First duplicate
    expect(screen.getByText(/Row 10/i)).toBeInTheDocument();

    // Click merge
    const mergeButton = screen.getByText("Merge");
    fireEvent.click(mergeButton);

    // Should move to second duplicate
    expect(screen.getByText(/Row 15/i)).toBeInTheDocument();
    expect(screen.getByText(/75.0%/i)).toBeInTheDocument();
  });

  it("shows high confidence badge for confidence >= 90", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    // First duplicate has 95.5% confidence (high)
    const badge = screen.getByText(/95.5%/i);
    expect(badge.className).toContain("danger"); // High confidence uses danger color
  });

  it("shows medium confidence badge for confidence 70-89", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
      />
    );

    // Click to move to second duplicate (75% confidence)
    const mergeButton = screen.getByText("Merge");
    fireEvent.click(mergeButton);

    const badge = screen.getByText(/75.0%/i);
    expect(badge.className).toContain("warning"); // Medium confidence uses warning color
  });

  it("renders with custom currency", () => {
    render(
      <DuplicateSection
        matches={mockMatches}
        onDuplicateHandled={mockOnDuplicateHandled}
        currency="USD"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/2 Potential Duplicates/i)).toBeInTheDocument();
  });
});
