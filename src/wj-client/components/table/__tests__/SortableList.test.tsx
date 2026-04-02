import { render, screen } from "@testing-library/react";
import { SortableList } from "../SortableList";

type TestItem = { id: number; label: string };

const items: TestItem[] = [
  { id: 1, label: "First" },
  { id: 2, label: "Second" },
  { id: 3, label: "Third" },
];

describe("SortableList", () => {
  it("renders all items", () => {
    const onReorder = jest.fn();
    render(
      <SortableList
        items={items}
        onReorder={onReorder}
        renderItem={(item) => <span>{item.label}</span>}
      />
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("renders drag handles with proper aria-label", () => {
    const onReorder = jest.fn();
    render(
      <SortableList
        items={items}
        onReorder={onReorder}
        renderItem={(item) => <span>{item.label}</span>}
      />
    );
    const handles = screen.getAllByLabelText("Drag to reorder");
    expect(handles).toHaveLength(3);
  });

  it("hides drag handles when hideDragHandle is true", () => {
    const onReorder = jest.fn();
    render(
      <SortableList
        items={items}
        onReorder={onReorder}
        renderItem={(item) => <span>{item.label}</span>}
        hideDragHandle
      />
    );
    expect(screen.queryByLabelText("Drag to reorder")).not.toBeInTheDocument();
  });

  it("renders empty container for empty items", () => {
    const onReorder = jest.fn();
    const { container } = render(
      <SortableList
        items={[]}
        onReorder={onReorder}
        renderItem={(item: TestItem) => <span>{item.label}</span>}
      />
    );
    expect(container.firstElementChild).toBeInTheDocument();
  });
});
