import { render, screen } from "@testing-library/react";
import { TanStackTable } from "../TanStackTable";
import { ColumnDef } from "@tanstack/react-table";

type TestRow = { id: number; name: string; value: string };

const columns: ColumnDef<TestRow, any>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "value", header: "Value" },
];

const data: TestRow[] = [
  { id: 1, name: "Alpha", value: "100" },
  { id: 2, name: "Beta", value: "200" },
];

describe("TanStackTable v2 styling", () => {
  it("renders header with v2 surface-tint background", () => {
    render(<TanStackTable data={data} columns={columns} />);
    const thead = screen.getByRole("table").querySelector("thead");
    expect(thead?.className).toContain("bg-v2-bg-surface-tint");
    expect(thead?.className).not.toContain("bg-v2-maroon-800");
  });

  it("renders header cells with v2 text styling", () => {
    render(<TanStackTable data={data} columns={columns} />);
    const headers = screen.getAllByRole("columnheader");
    headers.forEach((header) => {
      expect(header.className).toContain("text-xs");
      expect(header.className).toContain("font-semibold");
      expect(header.className).toContain("uppercase");
      expect(header.className).toContain("tracking-wider");
      expect(header.className).not.toContain("text-base");
      expect(header.className).not.toContain("font-bold");
    });
  });

  it("renders table container with rounded border", () => {
    const { container } = render(
      <TanStackTable data={data} columns={columns} />
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("rounded-lg");
    expect(wrapper?.className).toContain("border-v2-border-light");
  });

  it("renders row borders with v2 border-light", () => {
    render(<TanStackTable data={data} columns={columns} />);
    const rows = screen.getAllByRole("row");
    // First data row (index 1, after header row)
    const dataRow = rows[1];
    expect(dataRow.className).toContain("border-v2-border-light");
    expect(dataRow.className).not.toContain("border-v2-maroon-600");
  });

  it("renders loading skeleton with v2 header styling", () => {
    render(<TanStackTable data={[]} columns={columns} isLoading={true} />);
    const thead = document.querySelector("thead");
    expect(thead?.className).toContain("bg-v2-bg-surface-tint");
    expect(thead?.className).not.toContain("bg-v2-maroon-800");
  });
});
