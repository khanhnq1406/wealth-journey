import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ErrorSection } from "../ErrorSection";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";

describe("ErrorSection", () => {
  const mockTransactions: ParsedTransaction[] = [
    {
      rowNumber: 45,
      date: 1707638400 as any,
      amount: { amount: -50000 as any, currency: "VND" },
      description: "Invalid transaction",
      type: 2, // EXPENSE
      suggestedCategoryId: 0,
      categoryConfidence: 0,
      referenceNumber: "",
      isValid: false,
      validationErrors: [
        { field: "date", message: "Invalid date format", severity: "error" },
        { field: "amount", message: "Amount cannot be zero", severity: "error" },
      ],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
    },
    {
      rowNumber: 52,
      date: 1707638400 as any,
      amount: { amount: 0 as any, currency: "VND" },
      description: "Another error",
      type: 2,
      suggestedCategoryId: 0,
      categoryConfidence: 0,
      referenceNumber: "",
      isValid: false,
      validationErrors: [
        { field: "description", message: "Description is required", severity: "error" },
      ],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
    },
  ];

  const mockOnTransactionUpdate = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no error transactions", () => {
    const { container } = render(
      <ErrorSection
        transactions={[]}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays error count in header", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText(/2 Need Fixes/i)).toBeInTheDocument();
    expect(screen.getByText(/Must fix before import/i)).toBeInTheDocument();
  });

  it("expands to show error details by default", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );
    expect(screen.getByText("Row 45")).toBeInTheDocument();
    expect(screen.getByText("Row 52")).toBeInTheDocument();
  });

  it("collapses and expands when clicking header", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    // Initially expanded
    expect(screen.getByText("Row 45")).toBeInTheDocument();

    // Click to collapse
    const header = screen.getByRole("button", { name: /2 Need Fixes/i });
    fireEvent.click(header);

    // Should be hidden
    expect(screen.queryByText("Row 45")).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(header);
    expect(screen.getByText("Row 45")).toBeInTheDocument();
  });

  it("displays all validation errors for each transaction", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    // Check first transaction errors
    expect(screen.getByText(/Invalid date format/i)).toBeInTheDocument();
    expect(screen.getByText(/Amount cannot be zero/i)).toBeInTheDocument();

    // Check second transaction errors
    expect(screen.getByText(/Description is required/i)).toBeInTheDocument();
  });

  it("calls onSkip when skip button is clicked", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    const skipButtons = screen.getAllByText("Skip");
    fireEvent.click(skipButtons[0]);

    expect(mockOnSkip).toHaveBeenCalledWith(45);
    expect(mockOnSkip).toHaveBeenCalledTimes(1);
  });

  it("shows edit form when Fix button is clicked", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    const fixButtons = screen.getAllByText("Fix");
    fireEvent.click(fixButtons[0]);

    // Should show Cancel button instead of Fix
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("toggles edit mode when clicking Fix and Cancel", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    const fixButtons = screen.getAllByText("Fix");

    // Click Fix
    fireEvent.click(fixButtons[0]);
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Click Cancel
    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    // Should show Fix again
    expect(screen.getAllByText("Fix").length).toBeGreaterThan(0);
  });

  it("renders with custom currency", () => {
    render(
      <ErrorSection
        transactions={mockTransactions}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
        currency="USD"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/2 Need Fixes/i)).toBeInTheDocument();
  });

  it("handles empty validation errors array", () => {
    const txWithNoErrors: ParsedTransaction[] = [
      {
        rowNumber: 1,
        date: 1707638400 as any,
        amount: { amount: -50000 as any, currency: "VND" },
        description: "Test",
        type: 2,
        suggestedCategoryId: 0,
        categoryConfidence: 0,
        referenceNumber: "",
        isValid: false,
        validationErrors: [],
        originalAmount: undefined,
        exchangeRate: 0,
        exchangeRateSource: "",
        exchangeRateDate: 0 as any,
      },
    ];

    render(
      <ErrorSection
        transactions={txWithNoErrors}
        onTransactionUpdate={mockOnTransactionUpdate}
        onSkip={mockOnSkip}
      />
    );

    expect(screen.getByText("Row 1")).toBeInTheDocument();
  });
});
