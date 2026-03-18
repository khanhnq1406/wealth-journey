import { screen, fireEvent } from "@testing-library/react";
import { renderWithIntl as render } from "@/test-utils";
import { Pagination } from "../Pagination";

describe("Pagination", () => {
  const mockOnPageChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={mockOnPageChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when totalPages is 0", () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} onPageChange={mockOnPageChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Prev and Next buttons when totalPages > 1", () => {
    render(
      <Pagination page={1} totalPages={3} onPageChange={mockOnPageChange} />
    );
    expect(screen.getByText("Prev")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("displays current page and total pages", () => {
    render(
      <Pagination page={2} totalPages={5} onPageChange={mockOnPageChange} />
    );
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("disables Prev button on first page", () => {
    render(
      <Pagination page={1} totalPages={3} onPageChange={mockOnPageChange} />
    );
    expect(screen.getByText("Prev")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination page={3} totalPages={3} onPageChange={mockOnPageChange} />
    );
    expect(screen.getByText("Prev")).not.toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with page-1 when Prev is clicked", () => {
    render(
      <Pagination page={2} totalPages={3} onPageChange={mockOnPageChange} />
    );
    fireEvent.click(screen.getByText("Prev"));
    expect(mockOnPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with page+1 when Next is clicked", () => {
    render(
      <Pagination page={2} totalPages={3} onPageChange={mockOnPageChange} />
    );
    fireEvent.click(screen.getByText("Next"));
    expect(mockOnPageChange).toHaveBeenCalledWith(3);
  });
});
