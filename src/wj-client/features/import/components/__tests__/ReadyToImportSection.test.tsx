import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-utils";
import { ReadyToImportSection } from "../ReadyToImportSection";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";

describe("ReadyToImportSection", () => {
  const mockTransactions: ParsedTransaction[] = [
    {
      rowNumber: 1,
      date: 1707638400 as any,
      // Import amounts use ×10000 format: 500000000 = 50,000 VND
      amount: { amount: 500000000 as any, currency: "VND" },
      description: "Coffee Shop",
      type: 2,
      suggestedCategoryId: 1,
      categoryConfidence: 95,
      referenceNumber: "",
      isValid: true,
      validationErrors: [],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
      originalDescription: "Coffee Shop",
    },
    {
      rowNumber: 2,
      date: 1707638500 as any,
      // Import amounts use ×10000 format: 1000000000 = 100,000 VND
      amount: { amount: 1000000000 as any, currency: "VND" },
      description: "Salary",
      type: 1, // INCOME
      suggestedCategoryId: 2,
      categoryConfidence: 98,
      referenceNumber: "",
      isValid: true,
      validationErrors: [],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
      originalDescription: "Salary",
    },
  ];

  const mockCategories = [
    { id: 1, name: "Food & Dining", type: 2 },
    { id: 2, name: "Salary", type: 1 },
  ];

  const mockOnToggleExclude = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no ready transactions", () => {
    const { container } = render(
      <ReadyToImportSection
        transactions={[]}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays ready count in header", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );
    expect(screen.getByText(/2 Ready to Import/i)).toBeInTheDocument();
    expect(screen.getByText(/High confidence, auto-categorized/i)).toBeInTheDocument();
  });

  it("expands to show transaction list when clicking header", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Initially collapsed — transactions not visible
    expect(screen.queryByText("Coffee Shop")).not.toBeInTheDocument();

    // Expand
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("collapses and expands when clicking header", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    const header = screen.getByRole("button", { name: /2 Ready to Import/i });

    // Click to expand
    fireEvent.click(header);
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(header);
    expect(screen.queryByText("Coffee Shop")).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(header);
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
  });

  it("displays category names correctly", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Expand to see transactions
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    expect(screen.getByText(/Food & Dining/i)).toBeInTheDocument();
  });

  it("shows transaction without category in the list", () => {
    const txWithoutCategory: ParsedTransaction[] = [
      {
        ...mockTransactions[0],
        suggestedCategoryId: 0,
      },
    ];

    render(
      <ReadyToImportSection
        transactions={txWithoutCategory}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Expand to see transactions
    const header = screen.getByRole("button", { name: /1 Ready to Import/i });
    fireEvent.click(header);

    // Transaction with no category still appears in the list
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
  });

  it("calls onToggleExclude when row toggle button is clicked", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Expand to see transactions
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    // Toggle row 1 button (aria-label: "Toggle row 1")
    const toggleButtons = screen.getAllByRole("button", { name: /Toggle row/i });
    fireEvent.click(toggleButtons[0]);

    expect(mockOnToggleExclude).toHaveBeenCalledWith(1);
    expect(mockOnToggleExclude).toHaveBeenCalledTimes(1);
  });

  it("displays amounts with correct formatting", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Expand to see transactions
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    // Check that amounts are displayed (VND locale uses dot as thousand separator: 50.000)
    expect(screen.getByText(/50[.,]000/i)).toBeInTheDocument();
    expect(screen.getByText(/100[.,]000/i)).toBeInTheDocument();
  });

  it("renders with custom currency", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
        currency="USD"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/2 Ready to Import/i)).toBeInTheDocument();
  });

  it("handles single transaction with singular text", () => {
    render(
      <ReadyToImportSection
        transactions={[mockTransactions[0]]}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    expect(screen.getByText(/1 Ready to Import/i)).toBeInTheDocument();
  });

  it("displays row toggle buttons for each transaction when expanded", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        excludedRows={new Set()}
        onToggleExclude={mockOnToggleExclude}
      />
    );

    // Expand to see transactions
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    // Each transaction has a toggle button with aria-label "Toggle row N"
    expect(screen.getByRole("button", { name: /Toggle row 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Toggle row 2/i })).toBeInTheDocument();
  });
});
