import { render, screen } from "@testing-library/react";
import { BankTemplateStep } from "../BankTemplateStep";

// Mock the query hook
jest.mock("@/utils/generated/hooks", () => ({
  useQueryListBankTemplates: jest.fn(() => ({
    data: {
      success: true,
      templates: [
        { id: "vcb-csv", name: "Vietcombank CSV", bankCode: "VCB" },
        { id: "tcb-csv", name: "Techcombank CSV", bankCode: "TCB" },
      ],
    },
    isLoading: false,
    error: null,
  })),
}));

describe("BankTemplateStep", () => {
  const mockOnTemplateSelected = jest.fn();
  const mockOnNext = jest.fn();
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <BankTemplateStep
        onTemplateSelected={mockOnTemplateSelected}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );

    // Should render the component
    expect(screen.getByText(/Select Bank Template/i)).toBeInTheDocument();
  });

  it("displays bank template options when loaded", () => {
    render(
      <BankTemplateStep
        onTemplateSelected={mockOnTemplateSelected}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );

    expect(screen.getByText(/Vietcombank CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Techcombank CSV/i)).toBeInTheDocument();
  });

  it("accepts required props correctly", () => {
    // This is a type-check test to ensure props interface is correct
    const { container } = render(
      <BankTemplateStep
        onTemplateSelected={mockOnTemplateSelected}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );

    expect(container).toBeInTheDocument();
  });
});
