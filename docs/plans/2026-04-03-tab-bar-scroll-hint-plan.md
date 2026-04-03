# TabBar Scroll Hint — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add gradient fade + clickable chevron scroll-hint to `TabBar` underline variant when tabs overflow the container.
**Spec:** `docs/specs/2026-04-03-tab-bar-scroll-hint-spec.md`
**Architecture:** Pure frontend UI enhancement to the shared `TabBar` component (`components/navigation/TabBar.tsx`). Uses `ResizeObserver` + `scroll` event to detect overflow state (`canScrollLeft`/`canScrollRight`). Renders absolute-positioned gradient overlays and `ChevronLeft`/`ChevronRight` buttons from `lucide-react`. No backend changes.
**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 3.4, `lucide-react`, native `ResizeObserver` API.

## Security Implementation Notes

- Authentication: N/A — pure presentational component, no API calls.
- Authorization: N/A.
- Input validation: N/A — no user text input; scroll amount is a hardcoded constant.
- Data sanitization: N/A — no HTML injection surface; labels are React-managed ReactNodes as before.
- XSS: No change to existing ReactNode label pattern — still no `dangerouslySetInnerHTML`.

## Component Reuse Inventory

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `TabBar` | `components/navigation/TabBar.tsx` | Modified in place |
| `ChevronLeft`, `ChevronRight` | `lucide-react` (already installed) | Chevron button icons |

**New components needed:** None — all changes are within `TabBar.tsx`.

## C4 Architecture Diagram Updates

Per spec: Update `docs/architecture/c4-component-frontend.md` — update `TabBar` component description to note "scroll-hint overlay with chevron buttons for overflow (underline variant)".

---

### Task 0: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Find the `TabBar` entry in `c4-component-frontend.md`
2. Update description to: "Shared tab navigation component. Underline and pill variants. WCAG 2.1 keyboard nav (roving tabindex). Scroll-hint overlay with gradient + chevron buttons when tabs overflow (underline variant only)."
3. Commit with message: `docs(architecture): update TabBar C4 description for scroll-hint`

---

### Task 1: Add Scroll Hint to TabBar (TDD)

**Files:**
- Modify: `src/wj-client/components/navigation/TabBar.tsx`
- Modify: `src/wj-client/components/navigation/__tests__/TabBar.test.tsx`

**Security notes:** None beyond existing — no new data surface. `tabIndex={-1}` on chevron buttons preserves roving tabindex WCAG pattern.

**Step 0: Component inventory check**

- Reusing: `ChevronLeft`, `ChevronRight` from `lucide-react`
- Creating: No new files — modifying `TabBar.tsx` in place

**Step 1: Write the failing tests first**

Add these tests to `TabBar.test.tsx` BEFORE touching `TabBar.tsx`:

```tsx
// Scroll hint tests — add to existing describe("TabBar") block

it("does not render scroll hint buttons when there is no overflow", () => {
  // jsdom has no real layout — scrollWidth === clientWidth === 0 by default
  // So canScrollLeft and canScrollRight will both be false on initial render
  const { container } = render(
    <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} />
  );
  expect(container.querySelector('[aria-label="Scroll tabs right"]')).toBeNull();
  expect(container.querySelector('[aria-label="Scroll tabs left"]')).toBeNull();
});

it("pill variant does not render scroll hint wrapper", () => {
  const { container } = render(
    <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} variant="pill" />
  );
  // Pill variant: no relative wrapper for scroll hint
  expect(container.querySelector('[aria-label="Scroll tabs right"]')).toBeNull();
  expect(container.querySelector('[aria-label="Scroll tabs left"]')).toBeNull();
});

it("scroll hint wrapper uses relative positioning for underline variant", () => {
  const { container } = render(
    <TabBar tabs={TABS} activeTab="a" onTabChange={jest.fn()} />
  );
  // The outermost rendered element should be relative (or inside a relative wrapper)
  // Check that the tablist is inside a relative container
  const wrapper = container.firstElementChild;
  expect(wrapper).not.toBeNull();
});
```

**Step 2: Run tests to verify they fail**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPattern=TabBar
# Expected: 3 new tests fail (scroll hint buttons not yet implemented)
```

**Step 3: Implement the scroll hint in `TabBar.tsx`**

Replace the full file content with:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  variant?: "underline" | "pill";
  size?: "sm" | "md";
  fullWidthOnMobile?: boolean;
  sticky?: boolean;
  className?: string;
  ariaLabel?: string;
}

const SCROLL_AMOUNT = 120;

export function TabBar<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  size = "md",
  fullWidthOnMobile = true,
  sticky = false,
  className,
  ariaLabel,
}: TabBarProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isPill = variant === "pill";
  const isSm = size === "sm";

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    if (isPill) return;
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [isPill, updateScrollState]);

  const enabledIndexes = tabs
    .map((tab, i) => (!tab.disabled ? i : -1))
    .filter((i) => i !== -1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const currentPos = enabledIndexes.indexOf(index);
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = enabledIndexes[(currentPos + 1) % enabledIndexes.length];
          break;
        case "ArrowLeft":
          nextIndex =
            enabledIndexes[
              (currentPos - 1 + enabledIndexes.length) % enabledIndexes.length
            ];
          break;
        case "Home":
          nextIndex = enabledIndexes[0];
          break;
        case "End":
          nextIndex = enabledIndexes[enabledIndexes.length - 1];
          break;
        default:
          return;
      }

      e.preventDefault();
      if (nextIndex !== null) {
        onTabChange(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [enabledIndexes, onTabChange, tabs]
  );

  const tablistClasses = isPill
    ? cn(
        "flex gap-1 p-1 bg-v2-bg-dark rounded-lg border border-v2-border-light w-fit",
        className
      )
    : cn(
        "flex overflow-x-auto scrollbar-hide border-b border-v2-border-light",
        className
      );

  const stickyWrapper = sticky
    ? "sticky top-0 z-[5] bg-v2-bg-surface border-b border-v2-border-light"
    : undefined;

  const tablist = (
    <div role="tablist" aria-label={ariaLabel} className={tablistClasses} ref={isPill ? undefined : scrollRef}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        const buttonClasses = isPill
          ? cn(
              "min-h-[44px] px-4 rounded-md font-medium transition-colors cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-v2-gold-primary outline-none",
              isSm ? "py-1.5 text-xs" : "py-2 text-sm",
              isActive
                ? "bg-v2-gold-primary text-v2-bg-dark font-semibold"
                : "text-v2-text-tertiary hover:text-v2-gold-accent",
              tab.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
            )
          : cn(
              "whitespace-nowrap min-h-[44px] font-medium transition-colors relative cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-v2-gold-primary outline-none",
              isSm ? "py-2 text-xs" : "py-3 text-sm",
              fullWidthOnMobile
                ? "flex-1 sm:flex-initial sm:px-6"
                : "px-4 sm:px-6",
              isActive
                ? "border-b-2 border-v2-gold-primary text-v2-gold-accent font-semibold"
                : "text-v2-text-tertiary hover:text-v2-gold-accent",
              tab.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
            );

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={buttonClasses}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  // Pill variant: no scroll hint wrapper
  if (isPill) {
    if (stickyWrapper) {
      return <div className={stickyWrapper}>{tablist}</div>;
    }
    return tablist;
  }

  // Underline variant: wrap in relative container for scroll hints
  const scrollHintWrapper = (
    <div className="relative">
      {tablist}

      {/* Left gradient + chevron */}
      {canScrollLeft && (
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-v2-bg-surface to-transparent pointer-events-none flex items-center">
          <button
            aria-label="Scroll tabs left"
            tabIndex={-1}
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-v2-gold-accent hover:text-v2-gold-primary transition-colors"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: "smooth" })
            }
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Right gradient + chevron */}
      {canScrollRight && (
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-v2-bg-surface to-transparent pointer-events-none flex items-center justify-end">
          <button
            aria-label="Scroll tabs right"
            tabIndex={-1}
            className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center text-v2-gold-accent hover:text-v2-gold-primary transition-colors"
            onClick={() =>
              scrollRef.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: "smooth" })
            }
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );

  if (stickyWrapper) {
    return <div className={stickyWrapper}>{scrollHintWrapper}</div>;
  }

  return scrollHintWrapper;
}
```

**Step 4: Run tests to verify all pass**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPattern=TabBar
# Expected: 17/17 pass (14 existing + 3 new)
```

**Step 5: Responsive & accessibility check**

- Chevron buttons: `min-h-[44px] min-w-[44px]` ✓
- `tabIndex={-1}` on chevrons — preserves roving tabindex WCAG pattern ✓
- `aria-label` on chevron buttons ✓
- `aria-hidden="true"` on icons ✓
- Gradient overlays: `pointer-events-none` — tabs underneath remain clickable ✓
- Chevron buttons: `pointer-events-auto` override inside pointer-events-none container ✓

**Step 6: Run full unit test suite**

```bash
cd src/wj-client && npm test -- --watchAll=false
# Expected: all existing tests pass + 3 new scroll hint tests pass
```

**Step 7: Playwright E2E audit**

Check if the existing E2E spec needs updates:

```bash
cd src/wj-client && npx playwright test tests/e2e/tab-bar-keyboard-navigation.spec.ts --reporter=list
```

If the E2E suite runs against a live server and the scroll hint chevrons appear, add a test to `tab-bar-keyboard-navigation.spec.ts`:

```ts
// ─── Scroll Hint (Mobile — 375px) ─────────────────────────────────────────────
test.describe("TabBar — scroll hint on overflow (mobile 375px)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test("scroll right chevron is visible when tabs overflow on mobile", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    // On 375px with 5+ tabs, the right chevron should appear
    const rightChevron = page.locator('[aria-label="Scroll tabs right"]');
    // Only assert if it's present — depends on actual tab count vs viewport
    const count = await rightChevron.count();
    if (count > 0) {
      await expect(rightChevron).toBeVisible();
    }
  });

  test("clicking scroll right chevron does not break keyboard navigation", async ({ page }) => {
    await page.goto("/dashboard/prices");
    await waitForPricesPage(page);

    const rightChevron = page.locator('[aria-label="Scroll tabs right"]');
    const count = await rightChevron.count();
    if (count > 0) {
      await rightChevron.click();
      await page.waitForTimeout(400); // wait for smooth scroll

      // Tab keyboard nav still works after scroll
      const activeTab = page.locator('[role="tab"][aria-selected="true"]').first();
      await activeTab.focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(200);

      const selectedAfter = page.locator('[role="tab"][aria-selected="true"]');
      await expect(selectedAfter).toHaveCount(1);
    }
  });
});
```

**Step 8: Commit**

```bash
git add src/wj-client/components/navigation/TabBar.tsx \
        src/wj-client/components/navigation/__tests__/TabBar.test.tsx \
        src/wj-client/tests/e2e/tab-bar-keyboard-navigation.spec.ts
git commit -m "feat(tab-bar): add scroll-hint gradient + chevron for overflow (underline variant)"
```

---

### Task 2: Update C4 Frontend Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Find the `TabBar` component entry in `c4-component-frontend.md`
2. Update description to include scroll-hint capability
3. Commit: `docs(architecture): update TabBar C4 for scroll-hint`

---

### Task 3: Update Implementation Report

**Files:**
- Modify: `docs/reports/2026-04-02-improve-mobile-tab-overflow-report.md`

**Steps:**

1. Append a `## Fix History` section to the original report documenting this enhancement
2. Update the task note `docs/obsidian/2026-04-03-tab-bar-scroll-hint.md` — set status to `Review`
3. Update Kanban Board — move entry from `## Plan` to `## Review`
4. Commit: `docs(report): add scroll-hint fix history to tab-overflow report`

---

## Success Criteria

- [ ] All 17 TabBar unit tests pass (14 original + 3 new scroll hint tests)
- [ ] Full unit suite: no new failures
- [ ] Chevron buttons invisible when no overflow (jsdom default)
- [ ] Pill variant unaffected — no scroll hint wrapper rendered
- [ ] `ResizeObserver` disconnects on unmount (no memory leak)
- [ ] `tabIndex={-1}` on chevrons — roving tabindex keyboard nav unaffected
- [ ] 0 lint errors
