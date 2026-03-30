# FetchCode TypeCode Autocomplete — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the flat button grid of available type codes in the FetchCodeList "Add Fetch Code" form with a `FilterableAutocomplete` component — a free-text input with filtered suggestion dropdown.

**Spec:** `docs/specs/2026-03-30-fetchcode-autocomplete-spec.md`

**Architecture:** Frontend-only change. A new shared `FilterableAutocomplete` component in `components/forms/` provides a controlled text input with optional suggestions (case-insensitive substring match, keyboard navigation, ARIA combobox). `FetchCodeList.tsx` replaces its button grid and plain `<input>` with this component.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 3.4

## Security Implementation Notes

- Authentication: No change — admin-only feature behind `AuthMiddleware` + `AdminMiddleware`
- Authorization: No change — existing server-side admin checks remain
- Input validation: No change — server validates typeCode (1-50 chars, must exist in `asset_price`)
- Data sanitization: No new data flows cross trust boundaries; client-side filtering only

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| LoadingSpinner SVG pattern | `components/forms/SymbolAutocomplete.tsx:167-175` | Spinner inside dropdown when `isLoading=true` |
| ARIA combobox pattern | `components/select/Select.tsx:340-350` | `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"` |
| Blur handling (relatedTarget) | `components/select/Select.tsx:293-308` | Prevents dropdown close when clicking suggestion |
| Keyboard navigation | `components/select/CreatableSelect.tsx:104-141` | ArrowUp/Down, Enter, Escape, Tab handling |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `FilterableAutocomplete` | `components/forms/FilterableAutocomplete.tsx` | Existing `Select` resets input on blur; `CreatableSelect` shows unwanted "Create" prompt. A lightweight free-text input with suggestion dropdown that never clears the input is needed. Reusable as a shared component. |

## C4 Architecture Diagram Updates

None — UI-only change to an existing admin component. No new services, handlers, or repositories.

## Runtime Flow Diagrams

None — no backend changes, no new API calls.

---

### Task 1: Create FilterableAutocomplete Component

**Files:**

- Create: `src/wj-client/components/forms/FilterableAutocomplete.tsx`
- Test: `src/wj-client/components/forms/__tests__/FilterableAutocomplete.test.tsx`

**Security notes:** No data crosses trust boundaries. Pure client-side UI component.

**Step 0: Component inventory check (MANDATORY)**

- [x] Confirmed `Select.tsx` resets input on blur — not suitable
- [x] Confirmed `CreatableSelect.tsx` has "Create" prompt UX — not suitable
- [x] Confirmed `SymbolAutocomplete.tsx` wraps `Select` — too tightly coupled to symbol search
- [x] No existing component provides free-text + suggestion dropdown without clearing input
- Reusing: ARIA pattern from `Select.tsx`, keyboard nav pattern from `CreatableSelect.tsx`, spinner SVG from `SymbolAutocomplete.tsx`
- Creating new: `FilterableAutocomplete` — justified above

**Step 1: Write the failing test**

Create `src/wj-client/components/forms/__tests__/FilterableAutocomplete.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
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
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/forms/__tests__/FilterableAutocomplete.test.tsx --no-coverage 2>&1 | head -30
```

Expected: All tests fail — component does not exist yet.

**Step 3: Implement FilterableAutocomplete**

Create `src/wj-client/components/forms/FilterableAutocomplete.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";

export interface FilterableAutocompleteProps {
  suggestions: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  noMatchText?: string;
  className?: string;
}

export function FilterableAutocomplete({
  suggestions,
  value,
  onChange,
  placeholder,
  disabled = false,
  isLoading = false,
  noMatchText = "No matches",
  className,
}: FilterableAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!value) return suggestions;
    const lower = value.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(lower));
  }, [suggestions, value]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered]);

  const handleSelect = useCallback(
    (item: string) => {
      onChange(item);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        setIsOpen(true);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filtered.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            handleSelect(filtered[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
        case "Tab":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, filtered, highlightedIndex, handleSelect],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const relatedTarget = e.relatedTarget as Node;
      if (containerRef.current?.contains(relatedTarget)) return;
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [],
  );

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const option = listboxRef.current.children[highlightedIndex] as HTMLElement;
      option?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const listboxId = "filterable-autocomplete-listbox";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`} onBlur={handleBlur}>
      <div className="relative">
        <input
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && highlightedIndex >= 0
              ? `autocomplete-option-${highlightedIndex}`
              : undefined
          }
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 min-h-[44px] rounded-md bg-v2-bg-dark border border-v2-border text-v2-text-secondary placeholder:text-v2-text-placeholder text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-v2-gold-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <ul
          id={listboxId}
          ref={listboxRef}
          role="listbox"
          className="absolute z-dropdown w-full mt-1 bg-v2-bg-surface border border-v2-border-light rounded-md shadow-dropdown max-h-60 overflow-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-v2-text-tertiary text-sm">{noMatchText}</li>
          ) : (
            filtered.map((item, index) => (
              <li
                key={item}
                id={`autocomplete-option-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                className={`px-3 py-2 text-sm font-mono cursor-pointer transition-colors ${
                  highlightedIndex === index
                    ? "bg-v2-bg-surface-tint text-v2-gold-primary"
                    : "text-v2-text-secondary hover:bg-v2-bg-surface-tint hover:text-v2-gold-accent"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {item}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/wj-client && npx jest components/forms/__tests__/FilterableAutocomplete.test.tsx --no-coverage
```

Expected: All 12 tests pass.

**Step 5: Responsive & accessibility check**

- Mobile (375px): Input is full-width, `min-h-[44px]` touch target. Dropdown max-h scrollable.
- Desktop: Same layout, wider dropdown auto-sizes to input width.
- ARIA: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`, `role="listbox"`, `role="option"`, `aria-selected`.
- Focus ring: `focus-visible:ring-2 focus-visible:ring-v2-gold-primary`.
- No images needed, no barrel imports.

**Step 6: Commit**

```
feat(frontend): add FilterableAutocomplete shared form component

Free-text input with filtered suggestion dropdown, keyboard navigation
(ArrowUp/Down, Enter, Escape, Tab), ARIA combobox pattern, loading state.
```

---

### Task 2: Integrate FilterableAutocomplete into FetchCodeList

**Files:**

- Modify: `src/wj-client/features/admin/components/FetchCodeList.tsx`
- Test: `src/wj-client/features/admin/components/__tests__/FetchCodeList.test.tsx` (update if exists, or verify via E2E)

**Security notes:** No change to data flows. The create fetch code mutation still sends the same typeCode string to the existing admin endpoint.

**Step 1: Write the failing test**

Add integration test for the new autocomplete behavior (or update existing test):

```typescript
// In FetchCodeList test file — verify FilterableAutocomplete is rendered
it("renders FilterableAutocomplete instead of button grid for typeCode input", () => {
  render(<FetchCodeList configId={1} />);
  // Should find combobox (FilterableAutocomplete)
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  // Should NOT find the old button grid pills
  expect(screen.queryByText("Available Codes:")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest features/admin/components/__tests__/FetchCodeList.test.tsx --no-coverage 2>&1 | head -20
```

Expected: Fails — button grid still present, no combobox.

**Step 3: Modify FetchCodeList.tsx**

Changes to `FetchCodeList.tsx`:

1. **Add import** at top:
```typescript
import { FilterableAutocomplete } from "@/components/forms/FilterableAutocomplete";
```

2. **Remove the button grid section** (the "Available Codes" label + flex-wrap button list):
   - Remove the `{/* Available codes as pills */}` section
   - Remove the `availableCodesData?.typeCodes?.map(...)` button rendering

3. **Replace the plain `<input type="text">` for typeCode** with:
```typescript
<FilterableAutocomplete
  suggestions={availableCodesData?.typeCodes ?? []}
  value={typeCodeInput}
  onChange={setTypeCodeInput}
  placeholder={t("form.typeCodePlaceholder")}
  isLoading={availableCodesLoading}
  disabled={addMutation.isPending}
/>
```

4. **Remove** any "Available Codes:" label/header that prefixed the button grid.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest features/admin/components/__tests__/FetchCodeList.test.tsx --no-coverage
```

**Step 5: Verify form submission still works**

Manual verification that:
- Typing a code and clicking Add still calls the create mutation
- Selecting from suggestions fills the input and submits correctly
- Custom codes (not in suggestions) can still be submitted
- Priority input still works alongside the autocomplete

**Step 6: Playwright E2E audit**

- Check if `tests/e2e/` has any spec covering the admin fetch code flow
- If yes: run it, verify it passes with the new autocomplete
- If no: skip (admin-only feature, low traffic)

```bash
cd src/wj-client && ls tests/e2e/ | grep -i fetch || echo "No E2E spec for fetch codes"
```

**Step 7: Commit**

```
feat(admin): replace fetch code button grid with autocomplete

Integrates FilterableAutocomplete into FetchCodeList, replacing the
flat button grid with a searchable dropdown. Admin can still type
custom codes not in the suggestion list.
```

---

## Task Summary

| Task | Description | Dependencies | Estimated Effort |
|------|-------------|-------------|-----------------|
| 1 | Create `FilterableAutocomplete` component + tests | None | Small |
| 2 | Integrate into `FetchCodeList`, remove button grid | Task 1 | Small |

**Total:** 2 tasks, sequential (Task 2 depends on Task 1).
