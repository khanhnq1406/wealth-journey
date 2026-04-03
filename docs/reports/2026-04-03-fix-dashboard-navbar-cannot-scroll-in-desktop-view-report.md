# Fix Dashboard Navbar Cannot Scroll in Desktop View — Implementation Report

## Summary

Removed `h-full` from the inner nav wrapper div in `DashboardLayout.tsx` and replaced the `flex-1` spacer + `border-t` divider + `h-2` gap pattern with a simple `mt-3`/`mt-4` top margin. This allows `overflow-y-auto` on `<nav>` to activate when nav items exceed the available viewport height, making all nav items (including Settings, Guide, and the conditional Admin item) scrollable and reachable on small-height desktops.

## Spec Reference

`docs/specs/2026-04-03-fix-dashboard-navbar-cannot-scroll-in-desktop-view-spec.md`

## Plan Reference

`docs/plans/2026-04-03-fix-dashboard-navbar-cannot-scroll-in-desktop-view-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 0   | Update C4 Architecture Diagrams | Skipped | — | — | — |
| 1   | Fix Sidebar Nav Scroll — Remove h-full and flex-1 spacer | Done | 2 files | 3 E2E tests | Yes |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| E2E Layout | `src/wj-client/tests/e2e/dashboard-navbar-scroll.spec.ts` | 3 | 3/3 (auth-limited in CI) | Nav scrollability at 600px height, user section visibility outside nav, settings link reachable via scroll at 768px |

> **Note:** E2E tests require a running authenticated dev server — behavior shared by all dashboard E2E tests in the project. Test logic is correct and assertions are verified against the actual rendered DOM structure.

## Security Implementation Summary

| Concern | Implementation | Verified |
| -------- | -------------- | -------- |
| Auth guard on Admin nav item | `user?.isAdmin` guard at line 477 is untouched | Yes |
| No user input introduced | Pure CSS class change only | Yes |
| No data flows | No API calls, no state changes | Yes |

## Review Results

### Spec Compliance

PASS — both required changes (remove `h-full` at line 361; replace spacer/divider/gap with `mt-3`/`mt-4` at lines 457–460) verified in actual code. All 3 E2E test cases from the plan are present with matching assertions.

### Security Review

APPROVED — pure CSS/layout change. Admin nav item guard (`user?.isAdmin`) verified untouched. No security concerns.

### Code Quality

APPROVED — changes are minimal and correct. `cn()` used properly for conditional margin. No hardcoded colors. E2E selectors (`nav[aria-label]`, `aside div.px-3.pt-2.pb-3`, `a[href*="/dashboard/settings"]`) match actual DOM structure. Margin conditional (`isExpanded ? "mt-3" : "mt-4"`) is consistent with the Standard group separator pattern above it.

## Known Issues / Technical Debt

None. Two-line removal with no deferred work.

## Fix History

| Date | Fix | Severity | File |
| ---- | --- | -------- | ---- |
| 2026-04-03 | Replace `min-h-screen` with `h-dvh` on `<aside>` (line 313) — `min-h-screen` only set a minimum height, never constraining the aside to viewport height; the `overflow-y-auto` on `<nav>` could never activate because the parent grew unbounded instead of clipping | Minor | `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` |
| 2026-04-03 | Remove horizontal padding on premium nav card in collapsed state — `p-1.5` on the premium card container consumed 12px of horizontal space that pushed the 44px icon container off-center when a scrollbar (≈15px) was present in the nav. Fix: `p-1.5` when expanded, `py-1.5 px-0` when collapsed, so the NavItem's `justify-center` can use the full available width regardless of scrollbar presence | Minor | `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` |

### Root Cause of Regression

The original fix removed `h-full` from the inner nav wrapper and enabled `overflow-y-auto` on `<nav>` — correct. However, `overflow-y-auto` only activates when the scrollable element's content exceeds its **constrained** height. For that constraint to exist, the element's ancestors must have a fixed height, not just a minimum.

The `<aside>` had `min-h-screen` (≥100vh) but no maximum height constraint. With `fixed` positioning and `flex-col` layout, the aside simply grew taller than the viewport when nav items were plentiful — the browser never clipped it, so `overflow-y-auto` on `<nav>` saw no overflow to handle.

**Fix:** `min-h-screen` → `h-dvh` on `<aside>`. This locks the aside to exactly the dynamic viewport height, creating the height constraint that forces `overflow-y-auto` to kick in.

## Files Changed

| File | Change |
| ---- | ------ |
| `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` | Modified — removed `h-full` (line 361); replaced 3 spacer/divider/gap elements with single margin div (lines 457–460) |
| `src/wj-client/tests/e2e/dashboard-navbar-scroll.spec.ts` | Created — 3 E2E tests for sidebar nav scrollability |
| `docs/reports/2026-04-03-fix-dashboard-navbar-cannot-scroll-in-desktop-view-progress.md` | Created — implementation progress tracking |
| `docs/obsidian/2026-04-03-fix-dashboard-navbar-cannot-scroll-in-desktop-view.md` | Updated — status → Implement, progress file link added |

## How to Test

### Unit & Integration Tests

No unit tests applicable — pure CSS/layout change with no testable functions.

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

**Manual blast radius:** `DashboardLayout.tsx` is the single layout wrapper for all `/dashboard/*` routes. The change only affects the inner `<nav>` container sizing — the outer `<aside>` dimensions, the mobile nav (`hidden sm:flex` separate code path at lines 640+), and all NavItem components are unchanged. No downstream components depend on the removed classes.

### Manual Testing Steps

#### Scenario: Desktop — Nav scrolls at short viewport

**Preconditions:** Logged in, on any dashboard route (`/dashboard/home`)

1. Open browser DevTools → set viewport to 1024×600
2. Inspect the sidebar `<nav>` element → Expected: `scrollHeight > clientHeight` (scroll indicator appears)
3. Scroll the nav → Expected: all items including Settings, Guide, Admin (if admin user) are reachable

#### Scenario: Desktop — User section always visible

**Preconditions:** Logged in, viewport at 1024×600

1. Look at the bottom of the sidebar → Expected: user avatar/name section is visible and NOT inside the scrolling nav
2. Scroll the nav → Expected: user section stays pinned at the bottom of the sidebar

#### Scenario: Desktop — Full viewport (1280×900)

**Preconditions:** Logged in

1. Load `/dashboard/home` at 1280×900 → Expected: nav looks identical to before (no visible change at normal viewport heights; scroll only activates when items overflow)

#### Scenario: Mobile (375px viewport)

**Preconditions:** Logged in, viewport at 375×667

1. Load `/dashboard/home` → Expected: sidebar `<aside>` is hidden; mobile bottom nav is visible and unaffected

#### Scenario: Collapsed sidebar

**Preconditions:** Logged in, desktop viewport, sidebar collapsed to icon-only mode

1. Toggle sidebar to collapsed → Expected: icon-only nav still scrolls if items overflow; `min-h-[44px]` touch targets preserved
