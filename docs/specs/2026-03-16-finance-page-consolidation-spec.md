# Finance Page Consolidation Specification

## Summary

Merge the three separate pages — Transaction (`/dashboard/transaction`), Report (`/dashboard/report`), and Budget (`/dashboard/budget`) — into a single unified "Quản lý tài chính cá nhân" (Personal Finance Management) page at `/dashboard/finance`. The page uses a sticky top tab bar to switch between the three views. The sidebar and mobile menu collapse from 3 nav items to 1 "Finance" item. Old routes redirect to the new page with the correct tab selected.

## User Stories

- As a user, I want to access all my personal finance tools (transactions, reports, budgets) from one page, so that I can navigate between them quickly without leaving the context.
- As a user, I want my bookmarked old URLs (`/dashboard/transaction`, etc.) to still work by redirecting to the new page.
- As a user, I want the tab state to be reflected in the URL (`?tab=report`) so I can share or bookmark specific tabs.

## Functional Requirements

### FR-1: Unified Finance Page at `/dashboard/finance`

A new page at `/dashboard/finance` renders a tab container with three tabs:
1. **Transactions** (default) — renders existing transaction page content
2. **Report** — renders existing report page content
3. **Budget** — renders existing budget page content

**Acceptance criteria:**
- [ ] Page loads at `/dashboard/finance` with Transactions tab active by default
- [ ] Tab state is managed via `?tab=transaction|report|budget` query parameter
- [ ] Navigating to `/dashboard/finance` (no query param) defaults to `transaction` tab
- [ ] Tab content is lazy-loaded (only the active tab's content renders)
- [ ] Tab switch is instant — no full page reload
- [ ] URL updates when switching tabs (via `router.replace` to avoid polluting browser history)
- [ ] Browser back/forward navigates between tab states correctly

### FR-2: Sticky Top Tab Bar

A horizontal tab bar sits below the page header and sticks to the top while scrolling.

**Acceptance criteria:**
- [ ] Tab bar has 3 items: "Giao dịch" / "Báo cáo" / "Ngân sách" (i18n keys)
- [ ] Active tab has an underline indicator (matching v2 design — crimson/red accent)
- [ ] Tab bar is sticky (stays visible when scrolling tab content)
- [ ] Mobile: tabs are full-width, equally distributed
- [ ] Desktop: tabs are left-aligned with appropriate spacing
- [ ] Smooth animated transition on the underline indicator when switching tabs
- [ ] Touch-friendly tab targets (min 44px height)

### FR-3: Old Route Redirects

The old routes redirect to the new finance page with the appropriate tab.

**Acceptance criteria:**
- [ ] `/dashboard/transaction` → redirect to `/dashboard/finance?tab=transaction`
- [ ] `/dashboard/report` → redirect to `/dashboard/finance?tab=report`
- [ ] `/dashboard/budget` → redirect to `/dashboard/finance?tab=budget`
- [ ] Redirects use HTTP 308 (permanent redirect) or client-side `redirect()` in Next.js
- [ ] Redirect preserves any existing query parameters (e.g., `/dashboard/transaction?filter=...` → `/dashboard/finance?tab=transaction&filter=...`)

### FR-4: Navigation Consolidation

Replace 3 sidebar/menu items with 1 "Finance" item.

**Acceptance criteria:**
- [ ] Desktop sidebar: single "Tài chính" / "Finance" nav item with appropriate icon
- [ ] Mobile slide-out menu: single "Tài chính" / "Finance" nav item
- [ ] Nav item highlights as active when on `/dashboard/finance` regardless of tab
- [ ] Bottom nav is NOT affected (it currently shows Home, Portfolio, Community — no change needed)
- [ ] Remove Transaction, Report, Budget individual nav items from sidebar and mobile menu
- [ ] Animation delays adjusted for the reduced number of items

### FR-5: Page Title and Tab Labels (i18n)

**Acceptance criteria:**
- [ ] Page title: "Quản lý tài chính cá nhân" (vi) / "Personal Finance" (en)
- [ ] Tab labels: "Giao dịch" / "Transactions", "Báo cáo" / "Reports", "Ngân sách" / "Budget"
- [ ] Nav label: "Tài chính" / "Finance"
- [ ] All strings use `next-intl` translation keys

## Non-Functional Requirements

- **Performance**: Only the active tab's content should render. Inactive tabs should be unmounted or use `display: none` to avoid unnecessary API calls and rendering. Tab content should lazy-load via `dynamic()` imports.
- **Bundle size**: Tab content components should be code-split so the initial bundle only includes the active tab.
- **Accessibility**: Tab bar must use `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"` ARIA attributes. Keyboard navigation with arrow keys between tabs.
- **URL stability**: Tab state synced with URL query params. Direct navigation to `?tab=report` should work on first load.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-frontend.md`** — Update to show:
   - New `FinancePage` component under Dashboard Pages
   - `FinanceTabBar` shared component
   - Remove separate Transaction, Report, Budget page entries (they become tab content within FinancePage)
   - Update navigation flow arrows

### New Diagrams

No new L4 code diagrams needed — this is a frontend-only UI reorganization with no new domain models or complex business logic.

## Runtime Flow Diagrams

### Flow Diagrams to Update

No backend flow changes. This is purely a frontend routing/navigation refactor.

### New Flow Diagrams

None needed — no new multi-step business logic or backend coordination.

## Data Model Changes

None. This is a frontend-only change.

## API Changes

None. All existing API hooks continue to work unchanged.

## UI/UX Changes

### Page Layout

```
┌──────────────────────────────────────────┐
│  Header / App Bar                        │
├──────────────────────────────────────────┤
│  ┌──────────┐ ┌────────┐ ┌────────┐     │
│  │ Giao dịch│ │ Báo cáo│ │Ngân sách│    │  ← sticky tab bar
│  └──────────┘ └────────┘ └────────┘     │
│  ════════════                            │  ← active underline
├──────────────────────────────────────────┤
│                                          │
│  Active tab content (scrollable)         │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

### Navigation Changes (Sidebar)

**Before:**
```
Home          ← premium card
Portfolio     ← premium card
Community     ← premium card
──────────────
Transactions  ← standard group
Wallets       ← standard group
Reports       ← standard group
Budget        ← standard group
```

**After:**
```
Home          ← premium card
Portfolio     ← premium card
Community     ← premium card
──────────────
Finance       ← standard group (replaces Transactions, Reports, Budget)
Wallets       ← standard group
Prices        ← standard group (existing, was accessed via other means)
```

**Note:** The Prices page (`/dashboard/prices`) is currently accessible but not in the sidebar standard group. Consider adding it for discoverability — but this is **out of scope** for this feature. The sidebar will have: Finance, Wallets (2 items in standard group).

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Card container | BaseCard | `components/BaseCard.tsx` |
| Tab bar | **NEW — FinanceTabBar** | `app/[locale]/dashboard/finance/FinanceTabBar.tsx` |
| Transaction content | Existing page content | `app/[locale]/dashboard/transaction/page.tsx` → extract to component |
| Report content | Existing page content | `app/[locale]/dashboard/report/page.tsx` → extract to component |
| Budget content | Existing page content | `app/[locale]/dashboard/budget/page.tsx` → extract to component |
| Navigation items | NavItem, ActiveLink | `components/navigation/NavItem.tsx` |
| Icons | lucide-react | Already imported |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `FinanceTabBar` | `app/[locale]/dashboard/finance/FinanceTabBar.tsx` | New tab navigation component specific to the finance page. Not a generic shared component because it's coupled to the 3 specific tabs and their routing logic. |
| `TransactionTabContent` | `app/[locale]/dashboard/finance/TransactionTabContent.tsx` | Wrapper that extracts transaction page content into a renderable component (may just re-export existing content with minor adjustments) |
| `ReportTabContent` | `app/[locale]/dashboard/finance/ReportTabContent.tsx` | Same for report |
| `BudgetTabContent` | `app/[locale]/dashboard/finance/BudgetTabContent.tsx` | Same for budget |

**Approach:** Rather than creating wrapper components, the cleanest approach is to:
1. Rename the existing page content into exportable components (e.g., `TransactionContent`, `ReportContent`, `BudgetContent`)
2. The new `/dashboard/finance/page.tsx` imports them via `dynamic()` for code-splitting
3. The old `/dashboard/transaction/page.tsx` becomes a redirect

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User browser | Tab selection (query param) | No | Client-side router | Local state only |
| 2 | Client router | API requests | Yes: Browser → Backend | Go backend | Same as before — no new API calls |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Browser → Backend | Existing API calls | JWT + validation (unchanged) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | N/A (client-only) | Tampering | User manipulates `?tab=` param to invalid value | Low | Validate tab param against allowed values, fallback to default "transaction" |

### Authorization Rules

No changes — existing per-user authorization on all API calls remains unchanged.

### Input Validation Rules

- `tab` query parameter: Must be one of `"transaction"`, `"report"`, `"budget"`. Any other value falls back to `"transaction"`.
- No new server-side inputs.

### External Dependency Risks

None — no new external dependencies.

### Sensitive Data Handling

No changes — all sensitive financial data handling remains identical.

### Issues & Risks Summary

1. **Performance risk**: If tab content isn't properly lazy-loaded, all 3 tabs' API calls could fire simultaneously on page load. **Mitigation**: Use `dynamic()` imports and conditional rendering to ensure only the active tab renders.
2. **State loss on tab switch**: If tabs unmount, users lose scroll position, filter state, etc. when switching back. **Mitigation**: Use `display: none` for inactive tabs (keeps DOM alive) OR accept re-mount with React Query cache providing instant data. Decision: unmount inactive tabs (simpler, React Query cache handles data) — filter state is URL-based for transactions anyway.
3. **SEO/Bookmarking**: Query-param-based tab state means `/dashboard/finance?tab=report` is bookmarkable. This is fine for an authenticated app.

## Edge Cases & Error Handling

1. **Invalid tab param**: `?tab=invalid` → fallback to `transaction` tab
2. **Missing tab param**: `/dashboard/finance` → default to `transaction`
3. **Deep linking with filters**: `/dashboard/finance?tab=transaction&search=food` → transaction tab with search filter preserved (existing filter logic uses query params or local state — verify compatibility)
4. **Redirect with query params**: `/dashboard/transaction?page=2` → `/dashboard/finance?tab=transaction&page=2`
5. **Mobile back button**: User switches tabs via tab bar, then presses browser back — should go to previous page (not previous tab), since we use `router.replace` for tab switches

## Dependencies & Assumptions

- **Assumes**: The existing transaction, report, and budget page content can be extracted into standalone components without significant refactoring.
- **Assumes**: React Query cache handles data persistence across tab switches (no need for manual state preservation).
- **Depends on**: `next-intl` for i18n of tab labels and nav items.
- **Depends on**: Next.js App Router `useSearchParams` for tab state management.

## Out of Scope

- Adding the Prices page to the sidebar navigation (separate task)
- Merging the Wallets page into the finance page
- Any backend API changes
- Redesigning the content within any of the 3 tabs
- Adding new tabs (e.g., "Goals", "Savings")
- Changing the bottom mobile navigation (it stays as Home, Portfolio, Community)
