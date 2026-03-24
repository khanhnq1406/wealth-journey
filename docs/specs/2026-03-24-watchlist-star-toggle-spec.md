# Watchlist Star Toggle in Price Tables — Specification

## Summary

Add a star icon toggle to every row in the Gold, Silver, and Currency price tables on the Prices page. Clicking an empty star on a row immediately adds that item to the user's watchlist (no modal, no note step). Clicking a filled/highlighted star immediately removes the item from the watchlist. The star state is driven by a per-symbol check against the user's watchlist. This enables one-click watchlist management directly from the price table, complementing the existing 3-step modal flow (which remains available from the Watchlist tab's "Add Symbol" button).

## User Stories

- As a logged-in user, I want to click a star icon on any gold/silver/currency row so that I can instantly track that price without navigating away from the table.
- As a logged-in user, I want the star to appear filled/highlighted when a row is already in my watchlist, so that I can see my tracking status at a glance.
- As a logged-in user, I want to click a filled star to instantly remove that item from my watchlist, so that I can stop tracking it without navigating to the Watchlist tab.
- As a logged-in user, I want the star to reflect the current state without full page reload, so that the interaction feels immediate.

## Functional Requirements

### FR-1: Star Column in Price Tables

A star icon column is added as the **last column** in the Gold, Silver, and Currency TanStack tables (desktop) and MobileTable columns (mobile). The star column:

- Is **always visible** (not admin-gated)
- Shows an **empty star** (outline) when the item is not in the watchlist
- Shows a **filled/highlighted star** (solid yellow/gold) when the item is in the watchlist
- Is **not shown on the Symbol Lookup tab** (that tab already has an "Add to Watchlist" button) and **not on the Watchlist tab** (already tracked items)

**Acceptance criteria:**
- [ ] Star column appears in gold, silver, and currency tables on both desktop and mobile
- [ ] Star is absent from Watchlist tab and Symbol Lookup tab
- [ ] Empty star uses outline SVG; filled star uses solid SVG with gold/amber color
- [ ] Star button has accessible `aria-label` ("Add to watchlist" / "Remove from watchlist")

### FR-2: Watchlist State Lookup

The Prices page fetches the full watchlist (`useQueryListWatchlist`) to derive a `Set<string>` of symbols currently being watched, and a `Map<string, number>` of symbol → watchlist item ID (needed for deletion).

- The watchlist query is already available from the existing `WatchlistTab` (which runs `useQueryListWatchlist` internally). To avoid a second identical request, **the Prices page fetches the watchlist once** at page level and passes the derived state down as props.
- The check is done purely client-side by comparing `row.typeCode` against the watched symbol set — no per-row `useQueryCheckWatchlistItem` calls (avoids N×API calls on render).

**Acceptance criteria:**
- [ ] Watchlist state derived from a single `useQueryListWatchlist` call at page level
- [ ] No per-row API calls to `CheckWatchlistItem`
- [ ] Star state updates immediately after add/remove mutation succeeds (optimistic or via refetch)

### FR-3: One-Click Add to Watchlist

When the user clicks an empty star on a Gold row:
- Calls `useMutationCreateWatchlistItem` with:
  - `symbol`: `row.typeCode` (e.g. `"SJC"`, `"Vàng nhẫn SJC"`)
  - `name`: `row.name || row.typeCode`
  - `assetType`: `InvestmentType.INVESTMENT_TYPE_GOLD_VND` (8)
  - `currency`: `row.currency` (always `"VND"` for gold)
  - `note`: `""` (empty — no note in quick-add)

When the user clicks an empty star on a Silver row:
- Same as gold but `assetType`: `InvestmentType.INVESTMENT_TYPE_SILVER_VND` (10)

When the user clicks an empty star on a Currency row:
- `assetType`: `InvestmentType.INVESTMENT_TYPE_OTHER` (7)
- `currency`: `row.currency`
- No modal, no note

On success: invalidate `EVENT_WatchlistListWatchlist` so the watchlist query refetches and the star fills.

**Acceptance criteria:**
- [ ] Clicking empty star immediately fires mutation (no modal)
- [ ] Gold rows use `INVESTMENT_TYPE_GOLD_VND`
- [ ] Silver rows use `INVESTMENT_TYPE_SILVER_VND`
- [ ] Currency rows use `INVESTMENT_TYPE_OTHER`
- [ ] On success, watchlist query is invalidated and star becomes filled
- [ ] While mutation is pending, star shows a loading spinner (or disabled state) to prevent double-clicks
- [ ] On error (e.g. 50-item limit, duplicate), show a brief toast notification with the error message

### FR-4: One-Click Remove from Watchlist

When the user clicks a filled star:
- Calls `useMutationDeleteWatchlistItem` with `{ id: watchlistItemId }` where `watchlistItemId` is looked up from the page-level `Map<symbol, itemId>`
- On success: invalidate `EVENT_WatchlistListWatchlist` so the star becomes empty

**Acceptance criteria:**
- [ ] Clicking filled star fires delete mutation (no confirmation dialog)
- [ ] Item ID is resolved from the page-level symbol→ID map
- [ ] On success, watchlist query is invalidated and star becomes empty
- [ ] While mutation is pending, star shows loading state (disabled)
- [ ] On error, show toast with error message

### FR-5: Error Feedback via Toast

Since there is no modal for error display, errors from add/remove mutations surface via the existing `NotificationContext` toast system.

- "Already in your watchlist" (duplicate) — shown as warning toast
- "Maximum of 50 items reached" — shown as warning toast
- "Failed to add/remove" (generic) — shown as error toast

**Acceptance criteria:**
- [ ] All mutation errors surface as toast notifications
- [ ] Success does NOT show a toast (star fill is sufficient feedback)
- [ ] Toast messages use existing translation keys

### FR-6: WatchlistTab Integration

The `WatchlistTab` currently calls `useQueryListWatchlist` internally. After this change, the Prices page also calls it at the top level. To avoid duplicate fetches:

- Move `useQueryListWatchlist` call to `PricesPage` (page level)
- Pass `items` and `total` as props to `WatchlistTab` (or pass the query result)
- `WatchlistTab` no longer owns the list query; it receives data as props

**Acceptance criteria:**
- [ ] Single `useQueryListWatchlist` call in `PricesPage`
- [ ] `WatchlistTab` receives watchlist data as props instead of fetching internally
- [ ] Watchlist tab still shows loading/error states correctly
- [ ] Existing drag-reorder and delete in `WatchlistTab` still work

## Non-Functional Requirements

- **Performance**: No per-row API calls. Symbol lookup is O(1) from a `Set`/`Map` built once from the watchlist response.
- **Responsiveness**: Star icon is at least 44×44px tap target on mobile.
- **Accessibility**: Star buttons have `aria-label`, `role="button"`, `aria-pressed` for screen readers.
- **Security**: Add/remove mutations use the same authenticated endpoints as the existing watchlist feature. No new endpoints.

## Architecture Changes (C4)

### Diagrams to Update

**L3 Frontend (`c4-component-frontend.md`)**: No structural changes — `StarToggle` is a sub-component within `PricesPage`, not a new feature module. No update needed.

### New Diagrams

None — this is a UI enhancement to an existing feature. No new L4 code diagram needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-watchlist.md`**: Add two new sequence flows:
1. **Quick-add via star icon** — user clicks empty star → `PricesPage` fires `CreateWatchlistItem` → success → invalidate list query → star fills
2. **Quick-remove via star icon** — user clicks filled star → `PricesPage` fires `DeleteWatchlistItem` → success → invalidate list query → star empties

These are short flows (3–4 steps each), added as new diagrams to the existing file.

## Data Model Changes

None. No new tables, fields, or proto changes. The feature reuses existing `CreateWatchlistItem` and `DeleteWatchlistItem` RPCs.

## API Changes

None. All existing endpoints (`POST /api/v1/watchlist`, `DELETE /api/v1/watchlist/:id`) are reused without modification.

## UI/UX Changes

### Star Icon Design

- **Empty** (not in watchlist): outline star SVG, `text-v2-text-tertiary` color, hover → `text-v2-gold-accent`
- **Filled** (in watchlist): solid star SVG, `text-v2-gold-accent` or `text-amber-400` color
- **Loading**: small spinner replacing star (same size), disabled pointer events
- **Button wrapper**: `p-1.5` padding, `rounded`, `hover:bg-v2-bg-dark/50` background, `transition-colors`

### Column Placement

Star column is added after the admin column (if admin) or after the change column (if not admin). On mobile, it appears as a non-expanded column (always visible in collapsed view) in `MobileColumnDef`.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Star icon (outline) | Use lucide-react `Star` or inline SVG | Inline SVG preferred (consistent with codebase) |
| Star icon (filled) | Inline SVG | Inline SVG |
| Loading spinner | `LoadingSpinner` | `@/components/loading/LoadingSpinner` |
| Toast notification | `NotificationContext` via `useNotification()` | `@/contexts/NotificationContext` |
| Mutation hooks | `useMutationCreateWatchlistItem`, `useMutationDeleteWatchlistItem` | `@/utils/generated/hooks` |
| List query | `useQueryListWatchlist` | `@/utils/generated/hooks` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `StarToggleButton` | inline in `page.tsx` or extracted to `features/watchlist/components/StarToggleButton.tsx` | Small enough to inline in page; extract only if reused elsewhere |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Click event (row typeCode) | No (client-side) | Page state / mutation call | No user text input |
| 2 | `PricesPage` | `CreateWatchlistItemRequest` (symbol, name, assetType, currency, note="") | Yes: Browser → App | REST Handler `/api/v1/watchlist` | Authenticated with JWT |
| 3 | REST Handler | Parsed request | No (same tier) | `WatchlistService` | Validated server-side |
| 4 | `WatchlistService` | Validated item | Yes: App → DB | PostgreSQL | GORM parameterized query |
| 5 | `PricesPage` | `DeleteWatchlistItemRequest` (id) | Yes: Browser → App | REST Handler `DELETE /api/v1/watchlist/:id` | Authenticated with JWT |
| 6 | REST Handler | Item ID | No (same tier) | `WatchlistService` → ownership check | GetByIDForUser before delete |
| 7 | `PricesPage` | `ListWatchlistRequest` | Yes: Browser → App | REST Handler `GET /api/v1/watchlist` | Authenticated with JWT |
| 8 | REST Handler | Watchlist items | Yes: App → Browser | React Query cache | Filtered by userID server-side |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Browser → App | Add/remove star clicks | JWT middleware (existing), user ID from token |
| App → DB | Watchlist CRUD | GORM parameterized queries, `WHERE user_id = ?` on all queries |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 2 | Browser → App | Spoofing | Unauthenticated user adds to watchlist | Medium | JWT middleware already on all `/api/v1/watchlist` routes — no change needed |
| T-2 | 5 | Browser → App | Tampering | User sends arbitrary item ID to delete another user's item | High | Existing `GetByIDForUser(itemID, userID)` ownership check in handler — no change needed |
| T-3 | 2 | Browser → App | DoS | Rapid star clicks flood the create endpoint | Low | 50-item server limit acts as natural throttle; existing rate limiting applies |
| T-4 | 2,5 | Browser → App | Info Disclosure | Error responses leak internal details | Low | Existing `apperrors` typed errors — no stack traces to client |
| T-5 | 1 | Client-side | Tampering | Client-side symbol→ID map could be manipulated | Low | ID used only for delete; server validates ownership regardless |
| T-6 | 2 | Browser → App | Elevation | Non-admin user calls admin endpoints | N/A | Star icon uses same user-scoped endpoints, not admin endpoints |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Add to watchlist (star) | Allowed | N/A (own watchlist only) | Blocked (JWT required) |
| Remove from watchlist (star) | Allowed | Blocked (ownership check) | Blocked (JWT required) |
| List watchlist (for star state) | Allowed | N/A (own data only) | Blocked (JWT required) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|------------------------|
| `symbol` | string | Derived from `PriceItem.typeCode` (server-generated) | 1–50 chars (existing) |
| `name` | string | Derived from `PriceItem.name` (server-generated) | 1–200 chars (existing) |
| `assetType` | enum | Hardcoded per tab (gold/silver/other) | Valid InvestmentType enum (existing) |
| `currency` | string | Derived from `PriceItem.currency` (server-generated) | 2–3 chars ISO (existing) |
| `note` | string | Always `""` for quick-add | 0–200 chars (existing) |
| `id` (delete) | int | From server-returned watchlist item | Ownership check via GetByIDForUser (existing) |

**Key observation:** All symbol/name/currency data originates from the server's own price API response — it is NOT user-typed free text. This eliminates injection risk for these fields.

### External Dependency Risks

No new external dependencies. The feature reuses existing watchlist mutations and the market prices query.

### Sensitive Data Handling

No sensitive financial data (amounts, balances) involved. Watchlist items are non-sensitive preferences (which symbols a user tracks).

### Issues & Risks Summary

1. **Double-click during pending**: If mutation takes >500ms, user may click star again. Mitigation: disable star button while `isPending` (loading state per row).
2. **Stale watchlist state**: If user adds via the 3-step modal while on gold tab, star state won't reflect until query refetches. Mitigation: `EVENT_WatchlistListWatchlist` invalidation on modal success already triggers refetch.
3. **WatchlistTab refactoring risk**: Moving the list query from `WatchlistTab` to `PricesPage` changes the component's props contract. Mitigation: straightforward prop threading; existing delete/reorder mutations in `WatchlistTab` are independent.
4. **50-item limit feedback**: No modal to show errors → use toast. Mitigation: FR-5 covers this with `NotificationContext`.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| User clicks star while at 50-item limit | Mutation fails → "Maximum of 50 items reached" toast |
| User clicks star on already-tracked item (stale state) | Mutation fails with 409 → "Already in your watchlist" toast; list refetches and star fills correctly |
| User clicks filled star on item not in watchlist (stale state) | ID lookup returns undefined → guard: do nothing, show no error; refetch corrects the state |
| Watchlist list query fails to load | Stars all render as empty (can't determine state) — acceptable degraded state |
| Delete mutation fails | Toast error; star remains filled |
| Rapid repeated clicks | First click disables button; subsequent clicks ignored until mutation resolves |

## Translation Keys Required

New keys to add under `prices.watchlist`:

| Key | English | Vietnamese |
|-----|---------|-----------|
| `prices.watchlist.addedToWatchlist` | "Added to watchlist" | "Đã thêm vào danh sách theo dõi" |
| `prices.watchlist.removedFromWatchlist` | "Removed from watchlist" | "Đã xóa khỏi danh sách theo dõi" |
| `prices.watchlist.starAdd` | "Add to watchlist" | "Thêm vào danh sách theo dõi" |
| `prices.watchlist.starRemove` | "Remove from watchlist" | "Xóa khỏi danh sách theo dõi" |

Error toasts reuse existing keys:
- `prices.watchlist.form.errors.alreadyInWatchlist`
- `prices.watchlist.form.errors.limitReached`
- `prices.watchlist.form.errors.failedToAdd`

## Dependencies & Assumptions

- The existing `useQueryListWatchlist` hook and `EVENT_WatchlistListWatchlist` event constant are available for cache invalidation.
- `NotificationContext` / `useNotification()` hook exists for toast display.
- `WatchlistTab` can be refactored to accept watchlist data as props without breaking existing functionality.
- Gold rows in the price table use `typeCode` values that match `GOLD_VND_OPTIONS[].value` (confirmed: both use the same apiName e.g. `"SJC"`, `"Vàng nhẫn SJC"`).
- Silver rows similarly use `typeCode` values matching `SILVER_VND_OPTIONS[].value`.

## Out of Scope

- Adding a star to the Symbol Lookup tab result card (already has "Add to Watchlist" button)
- Note input in the quick-add flow (always empty note)
- Confirmation dialog before removal (instant removal on click)
- Star icon on the Watchlist tab rows (they're already tracked)
- Any backend changes (no new endpoints or models)
