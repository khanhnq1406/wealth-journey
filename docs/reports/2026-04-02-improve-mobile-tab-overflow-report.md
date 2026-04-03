# Improve Mobile Tab Overflow — Implementation Report

## Summary

Replaced 7 inline tab implementations across the WealthJourney frontend with a single shared `TabBar` component at `components/navigation/TabBar.tsx`. The component provides WCAG 2.1 keyboard navigation (roving tabindex, ArrowRight/Left/Home/End), mobile horizontal scroll (`overflow-x-auto`), `role="tablist"` / `role="tab"` ARIA semantics, underline and pill variants, sticky wrapper support, and `min-h-[44px]` touch targets. All consumer sites were migrated with no behavior regressions.

## Spec Reference

`docs/specs/2026-04-02-improve-mobile-tab-overflow-spec.md`

## Plan Reference

`docs/plans/2026-04-02-improve-mobile-tab-overflow-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 0   | Update C4 Architecture Diagram | Done | `docs/architecture/c4-component-frontend.md` | N/A (docs) | N/A |
| 1   | Create TabBar Component | Done | `components/navigation/TabBar.tsx`, `__tests__/TabBar.test.tsx` | 14/14 pass | Yes |
| 2   | Refactor FinanceTabBar to wrap TabBar | Done | `finance/FinanceTabBar.tsx`, `__tests__/FinanceTabBar.test.tsx` | 4/4 pass | Yes |
| 3   | Migrate InvestmentDetailModal Tabs | Done | `features/investment/components/InvestmentDetailModal.tsx`, `__tests__/InvestmentDetailModalTabs.test.tsx`, `__tests__/InvestmentDetailModal.edit.test.tsx` | 11/11 pass | Yes |
| 4   | Migrate prices/page.tsx Tabs | Done | `app/[locale]/dashboard/prices/page.tsx`, `__tests__/PricesPage.test.tsx`, `__tests__/PricesPageTabs.test.tsx` | 31/31 pass | Yes |
| 5   | Migrate admin/page.tsx Tabs | Done | `app/[locale]/dashboard/admin/page.tsx`, `__tests__/AdminPageTabs.test.tsx` | smoke pass | Yes |
| 6   | Migrate AssetDisplayConfigTable (pill) | Done | `features/admin/components/AssetDisplayConfigTable.tsx`, `__tests__/AssetDisplayConfigTable.test.tsx` | 9/9 pass | Yes |
| 7   | Migrate ProfileTabs | Done | `features/community/components/ProfileTabs.tsx`, `__tests__/ProfileTabs.test.tsx` | 1/1 pass | Yes |
| 8   | Migrate FollowingView (badge labels) | Done | `features/community/components/FollowingView.tsx`, `__tests__/FollowingView.test.tsx` | 1/1 pass | Yes |
| 9   | Full Test Suite + Playwright E2E Audit | Done | — | 803/809 unit pass, 0 lint errors | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| Shared Component | `components/navigation/__tests__/TabBar.test.tsx` | 14 | 14/14 | Renders labels, aria-selected, onTabChange, roving tabindex, ArrowRight/Left/Home/End wrap, skips disabled, pointer-events-none, pill variant, sticky wrapper, empty tabs, ariaLabel |
| Feature Wrapper | `finance/__tests__/FinanceTabBar.test.tsx` | 4 | 4/4 | FINANCE_TABS export, translated labels, onTabChange callback, sticky class |
| Modal Migration | `investment/__tests__/InvestmentDetailModalTabs.test.tsx` | 5 | 5/5 | role="tablist", 4 role="tab" elements, aria-selected states |
| Modal Regression | `investment/__tests__/InvestmentDetailModal.edit.test.tsx` | 6 | 6/6 | Existing interaction tests updated for role="tab" |
| Page Migration | `prices/__tests__/PricesPage.test.tsx` | 25 | 25/25 | Tab switching, content display, existing page behavior |
| Admin Migration | `admin/__tests__/AssetDisplayConfigTable.test.tsx` | 9 | 9/9 | Pill variant tabs, role="tab" after migration |
| Community Migration | `community/__tests__/ProfileTabs.test.tsx` | 1 | 1/1 | Posts/Likes/Shared tabs with role="tab" |
| Community Migration | `community/__tests__/FollowingView.test.tsx` | 1 | 1/1 | Tab count >= 2 with role="tab" |
| **Total** | — | **65+** | **65+/65+** | — |

Full suite: **803 passing, 0 failing, 6 skipped** (all 6 skips are pre-existing, unrelated to this feature).

## Security Implementation Summary

| Concern | Implementation | Verified |
| -------- | -------------- | -------- |
| XSS via ReactNode labels | Labels rendered via React virtual DOM (`{tab.label}`) — no `dangerouslySetInnerHTML`; JSX passed as labels is developer-controlled, not user input | Yes |
| No backend surface | TabBar is a pure presentational component with zero API calls, no data persistence, no auth | Yes |
| Input sanitization | No user text input accepted by TabBar — tab IDs are TypeScript generic string literals | Yes |

## Review Results

### Spec Compliance

All 7 migration sites confirmed. TabBar implements all required spec behaviors:
- `role="tablist"` on the container, `role="tab"` on each button
- `aria-selected="true"` on active tab, `aria-selected="false"` on inactive tabs
- Roving tabindex (`tabIndex={0}` on active, `tabIndex={-1}` on inactive)
- ArrowRight/Left/Home/End keyboard navigation with wrap-around and disabled-tab skipping
- `min-h-[44px]` touch targets
- `overflow-x-auto` horizontal scroll on mobile
- `fullWidthOnMobile` prop for equal-width tabs (default true)
- Underline variant (default) and pill variant
- Sticky wrapper via `sticky` prop
- `React.ReactNode` labels for rich content (badge counts in FollowingView)

### Security Review

APPROVED. No backend changes. XSS not applicable — ReactNode labels are React-managed, not raw HTML injection. No IDOR, no monetary values, no auth surface.

### Code Quality

APPROVED. TabBar follows project conventions:
- `"use client"` directive present (uses `useCallback`, `useRef`)
- TypeScript generic `TabBar<T extends string>` for type-safe tab IDs
- v2 Tailwind tokens throughout (no hardcoded colors)
- `cn()` utility for class merging
- Direct named imports (no barrel files)
- Placed in `components/navigation/` (shared layer, used by 7+ sites)
- FinanceTabBar preserved as a thin wrapper for backward compatibility

**Pre-existing issue noted (out of scope):** `InvestmentDetailModal.tsx:677` calls `setActiveTab("set-price")` directly rather than through `handleTabChange`. This predates the migration and was not introduced by this feature.

## Known Issues / Technical Debt

- `InvestmentDetailModal.tsx:677` — bypasses `handleTabChange` for the "Set Price" tab programmatic switch. Pre-existing behavior preserved during migration; not introduced by this feature. Should be addressed in a separate cleanup task.
- 446 Playwright E2E failures are all pre-existing auth infrastructure failures (desktop context JWT/backend dependency). None are related to TabBar. These pre-dated this feature branch.
- 6 skipped unit test suites are pre-existing (unrelated to TabBar).

## Files Changed

### New Files
- `src/wj-client/components/navigation/TabBar.tsx`
- `src/wj-client/components/navigation/__tests__/TabBar.test.tsx`
- `src/wj-client/app/[locale]/dashboard/finance/__tests__/FinanceTabBar.test.tsx`
- `src/wj-client/features/investment/components/__tests__/InvestmentDetailModalTabs.test.tsx`
- `src/wj-client/app/[locale]/dashboard/prices/__tests__/PricesPageTabs.test.tsx`
- `src/wj-client/app/[locale]/dashboard/admin/__tests__/AdminPageTabs.test.tsx`
- `src/wj-client/features/community/components/__tests__/ProfileTabs.test.tsx`
- `src/wj-client/features/community/components/__tests__/FollowingView.test.tsx`
- `docs/reports/2026-04-02-improve-mobile-tab-overflow-progress.md`
- `docs/reports/2026-04-02-improve-mobile-tab-overflow-report.md` (this file)

### Modified Files
- `docs/architecture/c4-component-frontend.md`
- `src/wj-client/app/[locale]/dashboard/finance/FinanceTabBar.tsx`
- `src/wj-client/features/investment/components/InvestmentDetailModal.tsx`
- `src/wj-client/features/investment/components/__tests__/InvestmentDetailModal.edit.test.tsx`
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- `src/wj-client/app/[locale]/dashboard/prices/__tests__/PricesPage.test.tsx`
- `src/wj-client/app/[locale]/dashboard/admin/page.tsx`
- `src/wj-client/features/admin/components/AssetDisplayConfigTable.tsx`
- `src/wj-client/features/admin/components/__tests__/AssetDisplayConfigTable.test.tsx`
- `src/wj-client/features/community/components/ProfileTabs.tsx`
- `src/wj-client/features/community/components/FollowingView.tsx`

## How to Test

### Unit & Integration Tests

```bash
cd src/wj-client && npm test -- --watchAll=false
# Expected: 803 passing, 0 failing, 6 skipped
```

Run TabBar tests specifically:
```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPattern=TabBar
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

Blast radius of `TabBar` component:
- `FinanceTabBar` — wraps TabBar, all 4 tests pass
- `InvestmentDetailModal` — 4-tab inline replaced, 11 tests pass
- `prices/page.tsx` — 3-tab inline replaced, 31 tests pass
- `admin/page.tsx` — 4-tab inline replaced, smoke passes
- `AssetDisplayConfigTable` — pill variant 3-tab inline replaced, 9 tests pass
- `ProfileTabs` — 3-tab inline replaced, 1 test passes
- `FollowingView` — 2-tab inline with absolute underline replaced, 1 test passes

All d=1 dependents tested and verified compatible.

### Manual Testing Steps

#### Scenario: Keyboard navigation on market prices page

**Preconditions:** Logged in, on `/dashboard/prices`

1. Navigate to `/dashboard/prices` → Expected: Gold tab is active (underline visible)
2. Tab to the tab bar → Expected: Gold tab receives focus (gold focus ring visible)
3. Press ArrowRight → Expected: Silver tab activates and receives focus
4. Press ArrowRight → Expected: Symbol Lookup tab activates
5. Press ArrowRight → Expected: Wraps back to Gold tab
6. Press End → Expected: Symbol Lookup tab activates
7. Press Home → Expected: Gold tab activates
8. Press ArrowLeft → Expected: Wraps to Symbol Lookup tab
9. Press Escape (does nothing for tablist) → Expected: focus remains on last active tab

#### Scenario: Mobile horizontal scroll

**Preconditions:** Mobile viewport (375px), logged in, on `/dashboard/prices`

1. Open `/dashboard/prices` on mobile → Expected: Tab bar is visible, no horizontal overflow on the page
2. Tap Silver tab → Expected: Silver content shows
3. Tap Gold tab → Expected: Gold content shows; tab bar does not trigger page scroll

#### Scenario: Pill variant (admin page)

**Preconditions:** Logged in as admin, on `/dashboard/admin`

1. Navigate to `/dashboard/admin` → Expected: Asset Display Config table shows pill-style tabs (rounded full, gold background on active)
2. Click a tab → Expected: Active pill has gold background with dark text; inactive has transparent background

#### Scenario: Badge labels in FollowingView

**Preconditions:** Logged in, on community page with Following tab open

1. Open the community page and navigate to Following view → Expected: Tabs show "Following (N)" / "Followers (N)" with counts in small `(N)` span
2. Click between tabs → Expected: Content switches correctly; badge counts remain visible

#### Scenario: Mobile viewport (375px — verify layout)

**Preconditions:** Browser or devtools set to 375px width

1. Open any page with a TabBar → Expected: Tabs are horizontally scrollable if they overflow; no content is cut off; touch targets are ≥ 44px tall
