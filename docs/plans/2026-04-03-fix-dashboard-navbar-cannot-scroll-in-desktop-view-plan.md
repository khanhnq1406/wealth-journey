# Fix Dashboard Navbar Cannot Scroll in Desktop View — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Remove the `h-full` + `flex-1` spacer pattern from the sidebar nav inner wrapper so `overflow-y-auto` on `<nav>` can activate when items overflow.
**Spec:** `docs/specs/2026-04-03-fix-dashboard-navbar-cannot-scroll-in-desktop-view-spec.md`
**Architecture:** Single-file CSS/Tailwind change in `DashboardLayout.tsx`. No new components, no backend, no proto changes. The sidebar `<aside>` remains fixed-height; only the inner `<nav>` scrolls.
**Tech Stack:** Next.js 16, React 19, Tailwind CSS 3.4 — pure class change, zero runtime cost.

## Security Implementation Notes

- Authentication: No change — auth gates are unaffected.
- Authorization: No change — `user?.isAdmin` guard on Admin nav item is untouched.
- Input validation: Not applicable — no user input.
- Data sanitization: Not applicable — no data flows.

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| DashboardLayout | `app/[locale]/dashboard/DashboardLayout.tsx` | File being modified |
| NavItem | `components/navigation/NavItem.tsx` | Used as-is, no changes |
| SidebarToggle | `components/navigation/SidebarToggle.tsx` | Used as-is, no changes |

**New components needed:** None — change is entirely within existing `DashboardLayout.tsx`.

## C4 Architecture Diagram Updates

None required per spec — DashboardLayout component's responsibilities are unchanged; no new components or data flows introduced.

---

### Task 0: Update C4 Architecture Diagrams

**Skip** — spec explicitly states no C4 updates needed (no structural changes, no new components, no new data flows).

---

### Task 1: Fix Sidebar Nav Scroll — Remove `h-full` and `flex-1` spacer

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` (lines 361, 457–460)

**Security notes:** Pure CSS class change. No auth, data, or state involved.

**Step 0: Component inventory check**

- [x] Ran Glob on `components/navigation/` — NavItem, SidebarToggle exist and are unchanged
- [x] No new components needed — single-file change
- [x] No icons or images needed

**Step 1: Write the failing test**

Create a Playwright E2E test that verifies the nav is scrollable when viewport is short. Since this is a visual/layout fix, the test checks that the `<nav>` element has `scrollHeight > clientHeight` at 600px viewport height (simulating a small laptop).

File: `src/wj-client/tests/e2e/dashboard-navbar-scroll.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard sidebar navbar scroll", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (requires auth — use storageState if available,
    // otherwise skip auth check and just verify layout structure)
    await page.goto("/en/dashboard/home");
  });

  test("nav element allows vertical scroll when viewport is short", async ({
    page,
  }) => {
    // Set a short viewport to force overflow
    await page.setViewportSize({ width: 1024, height: 600 });

    const nav = page.locator("nav[aria-label]").first();
    await expect(nav).toBeVisible();

    // Nav should be scrollable: scrollHeight > clientHeight
    const isScrollable = await nav.evaluate(
      (el) => el.scrollHeight > el.clientHeight,
    );
    expect(isScrollable).toBe(true);
  });

  test("User section remains visible without scrolling the nav", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 600 });

    // The user section is OUTSIDE <nav> — it should always be in viewport
    // Check it exists in the sidebar (outside nav)
    const userSection = page
      .locator("aside")
      .locator("div.px-3.pt-2.pb-3")
      .first();
    await expect(userSection).toBeVisible();
  });

  test("all nav items are reachable by scrolling at 768px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });

    // Settings nav item should exist in the DOM (may need scrolling to be in view)
    const settingsLink = page.locator('a[href*="/dashboard/settings"]').first();
    await expect(settingsLink).toBeAttached();

    // Scroll to it
    await settingsLink.scrollIntoViewIfNeeded();
    await expect(settingsLink).toBeVisible();
  });
});
```

**Step 2: Run test to verify it fails (before fix)**

```bash
cd src/wj-client && npx playwright test tests/e2e/dashboard-navbar-scroll.spec.ts --reporter=list
```

Expected: test "nav element allows vertical scroll" fails because `scrollHeight === clientHeight` (no overflow due to `h-full`).

**Step 3: Write minimal implementation**

In `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx`:

**Change 1** — Line 361: Remove `h-full` from inner nav wrapper div:

```tsx
// BEFORE
<div className="flex flex-col h-full">

// AFTER
<div className="flex flex-col">
```

**Change 2** — Lines 457–460: Replace `flex-1` spacer + `border-t` divider with simple top margin:

```tsx
// BEFORE
{/* Spacer + Divider + Settings */}
<div className="flex-1" />
<div className="border-t border-v2-border-light" />
<div className="h-2" />
<NavItem
  href="/dashboard/settings"
  ...

// AFTER
{/* Settings */}
<div className={cn(isExpanded ? "mt-3" : "mt-4")} />
<NavItem
  href="/dashboard/settings"
  ...
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx playwright test tests/e2e/dashboard-navbar-scroll.spec.ts --reporter=list
```

Expected: all 3 tests pass.

**Step 5: Responsive & accessibility check**

- Mobile (375px): `<aside>` is `hidden sm:flex` — mobile nav is a completely separate code path (lines 640+). Not affected.
- Desktop expanded (`sm:w-64 lg:w-72`): nav items with labels scroll correctly.
- Desktop collapsed (`sm:w-20`): icon-only mode — same scroll behavior, `min-h-[44px]` touch targets preserved.
- Accessibility: `<nav>` uses native browser scroll — keyboard (Tab, arrow keys) navigation is unaffected. `aria-label` unchanged.
- No hardcoded colors introduced — only `mt-3`/`mt-4` Tailwind spacing utilities.

**Step 6: Playwright E2E Audit**

- Affected pages: `/dashboard/home` (and any dashboard route that loads DashboardLayout)
- Run existing E2E specs to confirm no regression:

```bash
cd src/wj-client && npx playwright test tests/e2e/ --reporter=list
```

Document result under `## Playwright E2E Results` in the implementation report.

**Step 7: Commit**

```
fix(dashboard): remove h-full and flex-1 spacer from sidebar nav to enable scroll
```

---

## Implementation Summary

| Task | File | Type | Effort |
|------|------|------|--------|
| Task 1 | `DashboardLayout.tsx` lines 361, 457–460 | CSS class removal | ~2 min |
| Task 1 | `tests/e2e/dashboard-navbar-scroll.spec.ts` | New E2E test | ~5 min |

**Total tasks:** 1 implementation task + 1 E2E test file.

**Risk:** Low. Two-line removal. Mitigation: `mt-3`/`mt-4` top margin preserves visual separation between standard nav items and Settings group.
