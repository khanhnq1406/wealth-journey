import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryReviewSection } from "../CategoryReviewSection";
import { ParsedTransaction } from "@/gen/protobuf/v1/import";

// Mock the Select component
jest.mock("@/components/select/Select", () => ({
  Select: ({ value, onChange, options, placeholder }: any) => (
    <select
      data-testid="category-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

describe("CategoryReviewSection", () => {
  const mockCategories = [
    { id: 1, name: "Food & Dining", type: 2 },
    { id: 2, name: "Transportation", type: 2 },
    { id: 3, name: "Salary", type: 1 },
  ];

  const mockTransactions: ParsedTransaction[] = [
    {
      rowNumber: 1,
      date: 1707638400 as any,
      amount: { amount: -50000 as any, currency: "VND" },
      description: "Coffee Shop",
      type: 2,
      suggestedCategoryId: 1,
      categoryConfidence: 85,
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
      amount: { amount: -30000 as any, currency: "VND" },
      description: "Grab ride",
      type: 2,
      suggestedCategoryId: 2,
      categoryConfidence: 75,
      referenceNumber: "",
      isValid: true,
      validationErrors: [],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
    },
    {
      rowNumber: 3,
      date: 1707638600 as any,
      amount: { amount: -25000 as any, currency: "VND" },
      description: "Unknown transaction",
      type: 2,
      suggestedCategoryId: 0,
      categoryConfidence: 0,
      referenceNumber: "",
      isValid: true,
      validationErrors: [],
      originalAmount: undefined,
      exchangeRate: 0,
      exchangeRateSource: "",
      exchangeRateDate: 0 as any,
    },
  ];

  const mockOnCategoryChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when there are no transactions to review", () => {
    const { container } = render(
      <CategoryReviewSection
        transactions={[]}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("displays review count in header", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );
    expect(screen.getByText(/3 Need Category Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm or change auto-assigned categories/i)).toBeInTheDocument();
  });

  it("collapses to show only low confidence transactions by default", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // Low confidence transaction (0% or <70%) should be visible
    expect(screen.getByText("Unknown transaction")).toBeInTheDocument();
  });

  it("toggles expansion when clicking header", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    const header = screen.getByRole("button", { name: /3 Need Category Review/i });

    // Initially collapsed (showing only low confidence)
    expect(screen.queryByText("Coffee Shop")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(header);

    // All transactions should be visible
    expect(screen.getByText("Coffee Shop")).toBeInTheDocument();
    expect(screen.getByText("Grab ride")).toBeInTheDocument();
    expect(screen.getByText("Unknown transaction")).toBeInTheDocument();
  });

  it("displays confidence badges correctly", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // Expand to see all transactions
    const header = screen.getByRole("button", { name: /3 Need Category Review/i });
    fireEvent.click(header);

    expect(screen.getByText("85%")).toBeInTheDocument(); // High confidence
    expect(screen.getByText("75%")).toBeInTheDocument(); // Medium confidence
  });

  it("shows correct category names for suggested categories", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // Expand to see all
    const header = screen.getByRole("button", { name: /3 Need Category Review/i });
    fireEvent.click(header);

    expect(screen.getByText("Food & Dining")).toBeInTheDocument();
    expect(screen.getByText("Transportation")).toBeInTheDocument();
  });

  it("shows Uncategorized for transactions without category", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("renders with custom currency", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
        currency="USD"
      />
    );

    // Component should render without errors
    expect(screen.getByText(/3 Need Category Review/i)).toBeInTheDocument();
  });

  it("handles transactions with different confidence levels", () => {
    render(
      <CategoryReviewSection
        transactions={mockTransactions}
        categories={mockCategories}
        onCategoryChange={mockOnCategoryChange}
      />
    );

    // Component should render with mix of confidence levels
    expect(screen.getByText(/3 Need Category Review/i)).toBeInTheDocument();
  });
});
