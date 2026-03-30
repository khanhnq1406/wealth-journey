import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterableAutocomplete } from "../FilterableAutocomplete";

describe("FilterableAutocomplete", () => {
  const suggestions = ["SJC_1L", "SJC_5C", "DOJI_1L", "BTMC_1L"];
  const defaultProps = {
    suggestions,
    value: "",
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders input with placeholder", () => {
    render(<FilterableAutocomplete {...defaultProps} placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("shows dropdown with all suggestions on focus", async () => {
    render(<FilterableAutocomplete {...defaultProps} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("filters suggestions case-insensitively as user types", async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <FilterableAutocomplete {...defaultProps} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole("combobox"));
    // Simulate controlled component: parent calls onChange, then rerenders with new value
    await userEvent.type(screen.getByRole("combobox"), "sjc");
    // Parent would rerender with value="sjc"
    rerender(<FilterableAutocomplete {...defaultProps} value="sjc" onChange={onChange} />);
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2); // SJC_1L, SJC_5C
  });

  it("shows 'No matches' when no suggestions match", async () => {
    render(<FilterableAutocomplete {...defaultProps} value="zzz" />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("calls onChange with suggestion value when clicking a suggestion", async () => {
    const onChange = jest.fn();
    render(<FilterableAutocomplete {...defaultProps} onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByText("SJC_1L"));
    expect(onChange).toHaveBeenCalledWith("SJC_1L");
  });

  it("navigates suggestions with ArrowDown/ArrowUp and selects with Enter", async () => {
    const onChange = jest.fn();
    render(<FilterableAutocomplete {...defaultProps} onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("SJC_5C"); // Second item
  });

  it("closes dropdown on Escape without clearing input", async () => {
    render(<FilterableAutocomplete {...defaultProps} value="SJC" />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(screen.queryAllByRole("option").length).toBeGreaterThan(0);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(input).toHaveValue("SJC"); // NOT cleared
  });

  it("closes dropdown on Tab", async () => {
    render(<FilterableAutocomplete {...defaultProps} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryAllByRole("option").length).toBeGreaterThan(0);
    await userEvent.tab();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("never clears input on blur", async () => {
    render(<FilterableAutocomplete {...defaultProps} value="custom_code" />);
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    await userEvent.tab(); // blur
    expect(input).toHaveValue("custom_code");
  });

  it("shows loading state", () => {
    render(<FilterableAutocomplete {...defaultProps} isLoading />);
    // Loading spinner should be visible (svg with animate-spin)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows custom noMatchText", async () => {
    render(
      <FilterableAutocomplete {...defaultProps} value="zzz" noMatchText="Nothing found" />
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Nothing found")).toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(<FilterableAutocomplete {...defaultProps} />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("disables input when disabled prop is true", () => {
    render(<FilterableAutocomplete {...defaultProps} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
