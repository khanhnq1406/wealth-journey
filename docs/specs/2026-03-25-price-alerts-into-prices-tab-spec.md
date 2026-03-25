# Price Alerts Tab in Prices Screen — Specification

## Summary

Move the Price Alerts management UI from `/dashboard/settings/alerts` into the Prices page (`/dashboard/prices`) as the **first tab**. The new tab order will be: Price Alerts → Watchlist → Gold → Silver → Currency → Search Symbol. The settings page link to Alerts is removed; notification routing for `user_price_alert` is updated to go to `/dashboard/prices`.

The `/dashboard/settings/alerts` route will be kept as a redirect page pointing to `/dashboard/prices` so that any bookmarked or cached links still work.

## User Stories

- As a user, I want to manage my price alerts directly on the Market Prices page, so that alerts and live prices are co-located for a natural workflow.
- As a user clicking a price alert notification, I want to land on the Prices page (alerts tab), so that I can immediately see/manage alerts without navigating through Settings.

## Functional Requirements

### FR-1: Price Alerts as First Tab on Prices Page

Add `"priceAlerts"` as the first tab in the `Tab` union type. Render the full `PriceAlertList` component with filter tabs (All / Active / Triggered) and a "Create Alert" button inside this tab. The tab label key is `prices.tabs.priceAlerts` in i18n.

**Acceptance criteria:**
- [ ] "Price Alerts" tab appears first in the tab bar on `/dashboard/prices`
- [ ] Tab renders `PriceAlertList` with status filter buttons (All / Active / Triggered)
- [ ] "Create Alert" button opens `CreatePriceAlertForm` modal
- [ ] Existing tabs (Watchlist, Gold, Silver, Currency, Symbol Lookup) are unaffected
- [ ] Default tab on page load remains `priceAlerts` (first tab)

### FR-2: Update Notification Routing

`NotificationPanel.tsx` currently routes `user_price_alert` notifications to `/dashboard/settings/alerts`. Update to route to `/dashboard/prices` instead.

**Acceptance criteria:**
- [ ] Clicking a `user_price_alert` notification navigates to `/dashboard/prices`

### FR-3: Remove Alerts Link from Settings Page

Remove the Price Alerts card link from `/dashboard/settings/page.tsx`. Users now access alerts via the Prices page.

**Acceptance criteria:**
- [ ] Settings page no longer shows a "Price Alerts" link card

### FR-4: Redirect `/dashboard/settings/alerts` to `/dashboard/prices`

Replace the content of `/dashboard/settings/alerts/page.tsx` with a Next.js `redirect()` to `/dashboard/prices` so old links / bookmarks still work.

**Acceptance criteria:**
- [ ] Navigating to `/dashboard/settings/alerts` redirects to `/dashboard/prices`

### FR-5: i18n Keys

Add `priceAlerts` tab label key to `messages/en/investment.json` and `messages/vi/investment.json` under the `prices.tabs` namespace.

**Acceptance criteria:**
- [ ] `prices.tabs.priceAlerts` exists in both en and vi message files

## Non-Functional Requirements

- **Performance:** `PriceAlertList` query is only fired when the `priceAlerts` tab is active (React Query enabled-flag or conditional render)
- **No regression:** All 12 existing `PricesPage.test.tsx` tests pass after changes

## Architecture Changes (C4)

### Diagrams to Update

- `c4-component-frontend.md` — Update the Prices Page component description to note it now includes the Price Alerts tab. No new components added.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — the price alert CRUD flows are unchanged. Only routing changes.

## Data Model Changes

None. No backend changes.

## API Changes

None. No proto changes.

## UI/UX Changes

**Tab bar** (`prices/page.tsx`):
- New `Tab` value: `"priceAlerts"`
- `TABS` array reordered: priceAlerts → watchlist → gold → silver → currency → symbol
- Default `activeTab` state: `"priceAlerts"` (was `"watchlist"`)

**Price Alerts tab content** (rendered inline inside `PricesPage`):
- Header row: tab title left, "+ Create Alert" button right
- Status filter row: All / Active / Triggered (same as settings page)
- `PriceAlertList` component below filter row
- `BaseModal` with `CreatePriceAlertForm` (already exists in `PricesPage`)

**Refresh button** (`activeTab !== "symbol" && activeTab !== "watchlist"` condition):
- Update to also exclude `"priceAlerts"` tab from showing the Refresh button

**`TAB_TYPE_COLOR_DESKTOP` and `TAB_TYPE_COLOR_MOBILE`** Records:
- Add `priceAlerts` key (same value as `watchlist` — uses gold text on dark bg)

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Alert list with filter | `PriceAlertList` | `features/price-alert/components/PriceAlertList.tsx` |
| Create alert form | `CreatePriceAlertForm` | `features/price-alert/forms/CreatePriceAlertForm.tsx` |
| Modal container | `BaseModal` | `components/modals/BaseModal.tsx` |
| Status filter tabs | Inline buttons (same pattern as settings/alerts/page.tsx) | — |
| Create button | `Button` | `components/Button.tsx` |

### New Components

None — all existing components can be reused.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User browser | Tab selection | No | React state | Client-only routing |
| 2 | React Query cache | Alert list | No | PriceAlertList | Same auth context as before |
| 3 | User click | Navigation | No | Next.js router | URL change only |

### Trust Boundaries

No new trust boundaries introduced. This is a pure frontend UX restructuring.

### Threats Identified (STRIDE)

No new threats. All API calls to `/api/v1/price-alerts` are unchanged. Auth checks, IDOR protections, and rate limiting remain in place on the backend. The tab change does not alter the data security posture.

### Authorization Rules

Unchanged — `PriceAlertList` and `CreatePriceAlertForm` already use the user's JWT via the existing React Query hooks.

### Input Validation Rules

Unchanged — `CreatePriceAlertForm` has its existing Zod validation.

### External Dependency Risks

None introduced.

### Sensitive Data Handling

Unchanged.

### Issues & Risks Summary

1. **Default tab change (watchlist → priceAlerts):** Users who relied on the Watchlist being default will need to click one more tab. Low risk — Watchlist is still second tab.
2. **Redirect for bookmarked `/settings/alerts`:** Must implement server-side redirect to avoid 404 for any cached links.
3. **Refresh button condition:** Must exclude `priceAlerts` from the condition, or the Refresh button would incorrectly appear on the alert tab.
4. **Test update scope:** `PricesPage.test.tsx` tests click "Gold" and "Silver" tabs by name — these still work after reordering since tabs are rendered by label. However the default tab is now `priceAlerts` so `screen.queryByTestId("create-price-alert-form")` initially not in DOM assertion must still hold (modal not open, but tab is active — list is shown, not form).

## Edge Cases & Error Handling

- If the user is on `/dashboard/prices` with `priceAlerts` tab and has 0 alerts: `PriceAlertList` renders its own `EmptyState` component.
- If `PriceAlertList` query errors: component handles it internally with `ErrorState`.
- Redirect from `/settings/alerts` uses Next.js `redirect()` which is a 307 temporary redirect — correct for a UX move.

## Dependencies & Assumptions

- `PriceAlertList` accepts a `statusFilter` prop of type `AlertStatus` — already exists.
- `CreatePriceAlertForm` is already imported in `prices/page.tsx` — no new import needed.
- `EVENT_InvestmentListUserPriceAlerts` query key is available from `@/utils/generated/hooks`.

## Out of Scope

- Moving the "Set Alert" bell buttons from the Gold/Silver/Portfolio tabs — those remain.
- Changing the backend API or notification system.
- Adding deep-link support (e.g., `/dashboard/prices?tab=priceAlerts`) — URL state management is out of scope.
