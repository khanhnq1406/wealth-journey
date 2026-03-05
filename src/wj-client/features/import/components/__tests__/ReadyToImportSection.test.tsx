import { render, screen, fireEvent } from "@testing-library/react";
import { ReadyToImportSection } from "../ReadyToImportSection";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";

describe("ReadyToImportSection", () => {
  const mockTransactions: ParsedTransaction[] = [
    {
      rowNumber: 1,
      date: 1707638400 as any,
      amount: { amount: -50000 as any, currency: "VND" },
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
    },
    {
      rowNumber: 2,
      date: 1707638500 as any,
      amount: { amount: 100000 as any, currency: "VND" },
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
    },
  ];

  const mockCategories = [
    { id: 1, name: "Food & Dining", type: 2 },
    { id: 2, name: "Salary", type: 1 },
  ];

  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no ready transactions", () => {
    const { container } = render(
      <ReadyToImportSection
        transactions={[]}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays ready count in header", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText(/2 Ready to Import/i)).toBeInTheDocument();
    expect(screen.getByText(/These transactions will be imported/i)).toBeInTheDocument();
  });

  it("expands to show transaction list by default", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("collapses and expands when clicking header", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );

    // Initially expanded
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();

    // Click to collapse
    const header = screen.getByRole("button", { name: /2 Ready to Import/i });
    fireEvent.click(header);

    // Should be hidden
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
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText("Food & Dining")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();
  });

  it("shows Uncategorized for transactions without category", () => {
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
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("calls onSkip when skip button is clicked", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );

    const skipButtons = screen.getAllByText("Skip");
    fireEvent.click(skipButtons[0]);

    expect(mockOnSkip).toHaveBeenCalledWith(1);
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it("displays amounts with correct formatting", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );

    // Check that amounts are displayed (exact format depends on formatCurrency implementation)
    expect(screen.getByText(/50,000/i)).toBeInTheDocument();
    expect(screen.getByText(/100,000/i)).toBeInTheDocument();
  });

  it("renders with custom currency", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
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
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText(/1 Ready to Import/i)).toBeInTheDocument();
  });

  it("displays row numbers correctly", () => {
    render(
      <ReadyToImportSection
        transactions={mockTransactions}
        categories={mockCategories}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText(/Row 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Row 2/i)).toBeInTheDocument();
  });
});
