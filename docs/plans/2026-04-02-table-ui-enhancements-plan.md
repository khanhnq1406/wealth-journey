# Table UI Enhancements Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Align TanStackTable desktop styling with the v2 design system and extract a generic SortableList drag-and-drop component from DraggableWatchlistTable.

**Spec:** `docs/specs/2026-04-02-table-ui-enhancements-spec.md`

**Architecture:** Pure frontend changes. TanStackTable is a shared component in `components/table/` used by 5 consumers (prices page ×3, portfolio InvestmentList, TransactionTable, InvestmentDetailModal). SortableList will be a new shared component in the same directory, with DraggableWatchlistTable refactored to delegate to it.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 3.4, @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities (already installed), @tanstack/react-table, lucide-react

## Security Implementation Notes

- Authentication: N/A — no API endpoints involved
- Authorization: N/A — pure UI changes
- Input validation: N/A — no user input (SortableList receives typed `T[]` from caller)
- Data sanitization: N/A — no text rendering from untrusted sources

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `cn()` | `lib/utils/cn` | Merge Tailwind classes in TanStackTable and SortableList |
| `GripVertical` | `lucide-react` | Drag handle icon in SortableList (already used in DraggableWatchlistTable) |
| `@dnd-kit/core` + `@dnd-kit/sortable` | npm packages | DnD infrastructure for SortableList |
| `DraggableWatchlistTable` | `features/watchlist/components/` | Will be refactored to use SortableList |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `SortableList` | `components/table/SortableList.tsx` | Generic reusable drag-and-drop reorder component — DraggableWatchlistTable is domain-specific; no existing shared component handles ordered drag lists |

## C4 Architecture Diagram Updates

Minor: Add `SortableList` to the shared components table in `c4-component-frontend.md`.

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Update the `tables` Component entry in the shared layer to include SortableList: `"MobileTable, TanStackTable, VirtualizedList, SortableList"`
2. Commit diagram changes

---

### Task 1: TanStackTable Desktop Styling Alignment

**Files:**

- Modify: `src/wj-client/components/table/TanStackTable.tsx`
- Test: `src/wj-client/components/table/__tests__/TanStackTable.test.tsx` (create)

**Security notes:** None — pure styling changes.

**Consumers to verify (visual regression):**
- `app/[locale]/dashboard/prices/page.tsx` — Gold, Silver, Currency tables
- `app/[locale]/dashboard/portfolio/components/InvestmentList.tsx`
- `app/[locale]/dashboard/transaction/TransactionTable.tsx`
- `features/investment/components/InvestmentDetailModal.tsx`

**Step 0: Component inventory check**

- [x] Ran Glob on `components/table/` — found TanStackTable.tsx, MobileTable.tsx, VirtualizedTransactionList.tsx
- [x] No existing v2-styled table wrapper — must update TanStackTable directly
- [x] Confirmed all v2 tokens exist in tailwind.config.ts per CLAUDE.md
- Reusing: `cn()` from `@/lib/utils/cn`
- Creating new: None

**Step 1: Write the failing test**

Create `src/wj-client/components/table/__tests__/TanStackTable.test.tsx`:

```tsx
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
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/table/__tests__/TanStackTable.test.tsx --no-coverage
```

Expected: Tests fail because current classes are `bg-v2-maroon-800`, `text-base`, `font-bold`, etc.

**Step 3: Update TanStackTable styling**

Apply these class changes in `TanStackTable.tsx`:

| Location | Old classes | New classes |
|----------|-----------|------------|
| Main table container (line ~365) | `cn("overflow-x-auto", className)` | `cn("rounded-lg border border-v2-border-light overflow-x-auto", className)` |
| `<thead>` (line ~367) | `bg-v2-maroon-800 z-10 border-b-2 border-v2-maroon-600` | `bg-v2-bg-surface-tint z-10 border-b border-v2-border-light` |
| `<tr>` inside thead (line ~369) | `border-b-2 border-v2-maroon-600` | `border-b border-v2-border-light` |
| `<th>` (line ~373) | `text-v2-gold-accent text-base font-bold cursor-pointer hover:bg-v2-maroon-700` | `text-v2-text-secondary text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-v2-maroon-600` |
| Data row `<tr>` (line ~406) | `border-b border-v2-maroon-600` | `border-b border-v2-border-light` |
| Row hover (line ~407) | `hover:bg-neutral-50` | `hover:bg-v2-bg-surface-tint` |
| Expand button (line ~425) | `text-neutral-600 hover:text-primary-600 ... hover:bg-neutral-100` | `text-v2-text-tertiary hover:text-v2-gold-accent ... hover:bg-v2-bg-surface-tint` |
| Loading skeleton `<thead>` (line ~297) | `bg-v2-maroon-800 z-10 border-b-2 border-v2-maroon-600` | `bg-v2-bg-surface-tint z-10 border-b border-v2-border-light` |
| Loading skeleton `<th>` (line ~303) | `text-v2-gold-accent text-base font-bold` | `text-v2-text-secondary text-xs font-semibold uppercase tracking-wider` |
| Loading skeleton container (line ~295) | `cn("overflow-x-auto", className)` | `cn("rounded-lg border border-v2-border-light overflow-x-auto", className)` |
| Loading skeleton row border (line ~318) | `border-b border-v2-maroon-600` | `border-b border-v2-border-light` |
| Loading skeleton cell pulse (line ~321) | `bg-v2-maroon-600` | `bg-v2-bg-dark` |
| `MobileExpandedRow` container (line ~201) | `bg-neutral-50 border-t border-v2-gold-primary/20` | `bg-v2-bg-dark border-t border-v2-border-light` |
| `MobileExpandedRow` label (line ~212) | `text-neutral-500` | `text-v2-text-tertiary` |
| `MobileExpandedRow` value (line ~215) | `text-neutral-900` | `text-v2-text-secondary` |
| `TablePagination` border (line ~102) | `border-t border-v2-maroon-600` | `border-t border-v2-border-light` |
| `TablePagination` select (line ~115) | `bg-neutral-50 border-2 border-black/50 ... text-gray-900` | `bg-v2-bg-dark border border-v2-border-light ... text-v2-text-secondary` |
| `TablePagination` prev/next buttons (line ~139, ~149) | `border border-v2-maroon-600 ... hover:bg-v2-maroon-700` | `border border-v2-border-light ... hover:bg-v2-bg-surface-tint` |

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest components/table/__tests__/TanStackTable.test.tsx --no-coverage
```

**Step 5: Responsive & accessibility check**

- Mobile (375px): MobileExpandedRow labels now use v2 tokens; touch targets on chevron already ≥ 44px
- Desktop (800px+): Header now matches PriceAlertList styling
- No images involved — no `next/image` needed
- Imports: Direct imports only (no barrel files) ✓

**Step 6: Playwright E2E Audit**

- Affected pages: prices page, portfolio, transaction table
- Run: `cd src/wj-client && npx playwright test tests/e2e/ --reporter=list` (if any E2E tests touch these pages)
- Visual check: Verify no layout breakage on consumers

**Step 7: Commit**

```
feat(ui): align TanStackTable desktop styling with v2 design system
```

---

### Task 2: Create Generic SortableList Component

**Files:**

- Create: `src/wj-client/components/table/SortableList.tsx`
- Test: `src/wj-client/components/table/__tests__/SortableList.test.tsx` (create)

**Security notes:** None — pure UI component with no external data.

**Step 0: Component inventory check**

- [x] Ran Glob on `components/table/` — no existing SortableList or generic drag component
- [x] Confirmed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are installed
- [x] Confirmed `GripVertical` from `lucide-react` is available
- Reusing: `cn()`, `GripVertical`, `@dnd-kit/*` packages
- Creating new: `SortableList` — no existing shared component handles generic ordered drag lists

**Step 1: Write the failing test**

Create `src/wj-client/components/table/__tests__/SortableList.test.tsx`:

```tsx
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
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/table/__tests__/SortableList.test.tsx --no-coverage
```

Expected: Fails because SortableList.tsx doesn't exist yet.

**Step 3: Implement SortableList**

Create `src/wj-client/components/table/SortableList.tsx`:

```tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SortableListProps<T extends { id: string | number }> {
  items: T[];
  onReorder: (newOrder: T[]) => void;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  renderOverlay?: (item: T) => React.ReactNode;
  className?: string;
  hideDragHandle?: boolean;
}

function SortableRow<T extends { id: string | number }>({
  item,
  renderItem,
  hideDragHandle,
}: {
  item: T;
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  hideDragHandle?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 1 : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {!hideDragHandle && (
        <span
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-grab active:cursor-grabbing text-v2-text-tertiary hover:text-v2-text-secondary transition-colors duration-150 flex-shrink-0"
          style={{ touchAction: "none" }}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </span>
      )}
      <div className="flex-1 min-w-0">{renderItem(item, isDragging)}</div>
    </div>
  );
}

export const SortableList = memo(function SortableList<
  T extends { id: string | number },
>({
  items,
  onReorder,
  renderItem,
  renderOverlay,
  className,
  hideDragHandle,
}: SortableListProps<T>) {
  const [localItems, setLocalItems] = useState<T[]>(items);
  const isDraggingRef = useRef(false);
  const [activeItem, setActiveItem] = useState<T | null>(null);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalItems(items);
    }
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      isDraggingRef.current = true;
      const dragged = localItems.find((i) => i.id === event.active.id);
      setActiveItem(dragged ?? null);
    },
    [localItems]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      setActiveItem(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = localItems.findIndex((i) => i.id === active.id);
      const newIndex = localItems.findIndex((i) => i.id === over.id);
      const newOrder = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(newOrder);
      onReorder(newOrder);
    },
    [localItems, onReorder]
  );

  return (
    <div className={cn("w-full", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localItems.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {localItems.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              renderItem={renderItem}
              hideDragHandle={hideDragHandle}
            />
          ))}
        </SortableContext>

        <DragOverlay>
          {activeItem ? (
            <div className="shadow-modal border border-v2-border-light bg-v2-bg-surface-tint rounded cursor-grabbing">
              <div className="flex items-center">
                {!hideDragHandle && (
                  <span className="flex items-center justify-center min-w-[44px] min-h-[44px] text-v2-text-secondary flex-shrink-0">
                    <GripVertical
                      className="w-4 h-4"
                      aria-hidden="true"
                    />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {renderOverlay
                    ? renderOverlay(activeItem)
                    : renderItem(activeItem, true)}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}) as <T extends { id: string | number }>(
  props: SortableListProps<T>
) => React.ReactElement;
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest components/table/__tests__/SortableList.test.tsx --no-coverage
```

**Step 5: Responsive & accessibility check**

- Drag handles have `min-h-[44px] min-w-[44px]` touch targets ✓
- `aria-label="Drag to reorder"` on handles ✓
- `touchAction: "none"` for iOS Safari compatibility ✓
- No images — no `next/image` needed
- Direct imports only (no barrel files) ✓

**Step 6: Commit**

```
feat(ui): add generic SortableList drag-and-drop component
```

---

### Task 3: Refactor DraggableWatchlistTable to Use SortableList

**Files:**

- Modify: `src/wj-client/features/watchlist/components/DraggableWatchlistTable.tsx`
- Test: `src/wj-client/features/watchlist/__tests__/DraggableWatchlistTable.test.tsx` (create)

**Security notes:** None — refactoring existing component with identical behavior.

**Step 1: Write the failing test**

Create `src/wj-client/features/watchlist/__tests__/DraggableWatchlistTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DraggableWatchlistTable } from "../components/DraggableWatchlistTable";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";

const messages = {
  prices: {
    watchlist: {
      column: {
        symbol: "Symbol",
        price: "Price",
        change: "Change",
        type: "Type",
        note: "Note",
      },
    },
  },
};

const items: WatchlistItem[] = [
  {
    id: 1,
    symbol: "AAPL",
    name: "Apple Inc.",
    assetType: "STOCK",
    currentPrice: 150,
    priceChangePercent: 1.5,
    currency: "USD",
    displayOrder: 1,
    note: "",
    userId: 1,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 2,
    symbol: "GOOG",
    name: "Alphabet",
    assetType: "STOCK",
    currentPrice: 2800,
    priceChangePercent: -0.5,
    currency: "USD",
    displayOrder: 2,
    note: "Watch closely",
    userId: 1,
    createdAt: 0,
    updatedAt: 0,
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("DraggableWatchlistTable (SortableList refactor)", () => {
  it("renders all items with symbols visible", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("GOOG")).toBeInTheDocument();
  });

  it("renders drag handles", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    const handles = screen.getAllByLabelText("Drag to reorder");
    expect(handles).toHaveLength(2);
  });

  it("renders delete buttons for each item", () => {
    render(
      <Wrapper>
        <DraggableWatchlistTable
          items={items}
          onReorderCommit={jest.fn()}
          onDelete={jest.fn()}
        />
      </Wrapper>
    );
    expect(
      screen.getByLabelText("Remove AAPL from watchlist")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Remove GOOG from watchlist")
    ).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails (or passes with current implementation)**

```bash
cd src/wj-client && npx jest features/watchlist/__tests__/DraggableWatchlistTable.test.tsx --no-coverage
```

Note: This test validates the refactored output still renders correctly. It should pass after the refactor.

**Step 3: Refactor DraggableWatchlistTable**

Replace the internal DnD setup with `SortableList`. The component becomes a thin wrapper that:
1. Provides the domain-specific `renderItem` (the grid row with symbol, price, change, type, note, delete button)
2. Provides the domain-specific `renderOverlay` (the drag overlay row)
3. Keeps the header row (since SortableList is headerless)
4. Delegates all DnD logic to SortableList

Key changes:
- Remove all `@dnd-kit/*` imports
- Remove `SortableRow`, `handleDragStart`, `handleDragEnd`, `isDraggingRef`, `localItems`, `activeItem`, `sensors` state
- Import `SortableList` from `@/components/table/SortableList`
- Keep `RowContent`, `ChangeCell` (domain-specific rendering)
- Keep `GRID_COLS` for consistent layout
- Pass `items` and `onReorderCommit` to `SortableList`

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest features/watchlist/__tests__/DraggableWatchlistTable.test.tsx --no-coverage
```

**Step 5: Playwright E2E Audit**

- Affected page: prices page (watchlist tab)
- Run: `cd src/wj-client && npx playwright test tests/e2e/ --reporter=list`
- Verify drag-and-drop still works visually

**Step 6: Commit**

```
refactor(watchlist): delegate DraggableWatchlistTable to generic SortableList
```

---

### Task 4: Create/Update Runtime Flow Diagrams

**Skip.** Both changes are local UI interactions with no backend involvement, no multi-service coordination, and no complex error handling. Per the spec: "No flow diagram updates required."

---

## Task Dependency Order

```
Task 0 (C4 diagram update)     — independent, can run first
Task 1 (TanStackTable styling) — independent of Task 2/3
Task 2 (SortableList)          — independent of Task 1
Task 3 (Refactor watchlist)    — depends on Task 2
Task 4 (Flow diagrams)         — skipped
```

**Parallelizable:** Tasks 0, 1, and 2 can be implemented in parallel. Task 3 must wait for Task 2.

**Recommended execution order:** 0 → 1 → 2 → 3
