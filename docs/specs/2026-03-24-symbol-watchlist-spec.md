# Symbol Watchlist Specification

## Summary

Allow users to create a personal watchlist of symbols (stocks, crypto, ETFs, gold types, silver types) to monitor on the Prices page. The watchlist appears as a new first tab ("Watchlist") alongside the existing Gold, Silver, Currency, and Symbol Lookup tabs. Each watchlist item shows the symbol, name, current price, daily change, currency, and asset type. Users can add items from the Watchlist tab (via a quick-add modal) or from the Symbol Lookup tab, reorder items via drag-and-drop, and attach an optional note per item. Maximum 50 items per user.

## User Stories

- As a user, I want to save my favorite symbols to a watchlist so that I can quickly check their prices without searching each time.
- As a user, I want to reorder my watchlist via drag-and-drop so that I can prioritize the symbols I care about most.
- As a user, I want to add a short note to each watchlist item so that I can remember my intent (e.g., "buy if drops to 80M").
- As a user, I want to add gold/silver types and stocks/crypto to the same watchlist so that I have one unified view.
- As a user, I want to add symbols to my watchlist from the Symbol Lookup tab so that I can save a symbol I just searched for.
- As a user, I want to access the Prices page from the navigation so that I can quickly get to my watchlist and market prices.

## Functional Requirements

### FR-1: Watchlist Tab on Prices Page

A new "Watchlist" tab is added as the **first tab** (leftmost) on the Prices page (`/dashboard/prices`). When the user navigates to the Prices page, Watchlist is the default active tab.

**Display per row:**

| Field | Description |
|-------|-------------|
| Symbol | Ticker code (e.g., AAPL, BTC-USD, SJL1L10) |
| Name | Display name (e.g., "Apple Inc.", "SJC 1L-10L") |
| Current Price | Latest price — buy/sell for gold/silver, market price for others |
| Daily Change | Price change amount and percentage (if available) |
| Currency | VND, USD, etc. |
| Asset Type | Icon or badge indicating stock, crypto, gold, silver, etc. |
| Note | User's note (if set), shown as a subtle subtitle or tooltip |

**Table behavior:**
- Desktop: TanStackTable (consistent with other Prices tabs)
- Mobile: MobileTable with expandable rows (note, change, asset type in expanded view)
- Drag handle visible on each row for reordering (both desktop and mobile)
- Remove button (trash icon) per row
- Edit note inline or via a small popover
- Empty state when no items: "Your watchlist is empty. Add symbols to track their prices."

**Price fetching:**
- Prices fetched on tab mount via React Query (`refetchOnMount: "always"`)
- No auto-refresh — prices update each time the user switches to the tab
- Backend fetches current prices for all symbols in the user's watchlist in one batched call
- Gold/silver items: show both buy and sell prices
- Other items: show market price

**Acceptance criteria:**
- [ ] Watchlist tab is the first tab on the Prices page
- [ ] Watchlist tab is the default active tab when navigating to Prices
- [ ] Each row shows symbol, name, current price, daily change, currency, asset type
- [ ] Notes are visible (as subtitle on mobile, as a column or tooltip on desktop)
- [ ] Rows are draggable for reordering
- [ ] Remove button deletes item from watchlist
- [ ] Empty state shown when watchlist is empty
- [ ] Desktop uses TanStackTable, mobile uses MobileTable
- [ ] Prices fetched on tab mount, no auto-refresh

### FR-2: Add to Watchlist

Users can add symbols to their watchlist from two entry points:

**Entry Point 1: Watchlist tab "+" button**
- A FloatingActionButton or header button opens a quick-add modal
- Modal uses a **3-step progressive disclosure** form (same pattern as price alerts):
  - **Step 1: Asset category** — Toggle buttons: Gold | Silver | Other Assets
  - **Step 2: Select symbol:**
    - Gold → Gold type dropdown (VND types only, reuses `goldTypeOptions`)
    - Silver → Silver type dropdown (VND types only, reuses `silverTypeOptions`)
    - Other Assets → SymbolAutocomplete free-text search
  - **Step 3: Optional note** — Text input (max 200 chars)
- Asset type, currency, symbol, and name are auto-determined from selection
- Current price shown as confirmation before adding

**Entry Point 2: Symbol Lookup tab**
- After a symbol is searched and price is displayed, show an "Add to Watchlist" button (star/bookmark icon)
- One-tap add — symbol, name, currency, and asset type auto-filled from the search result
- Optional: prompt for note via a small inline input or skip (no note)
- If symbol is already in watchlist, show "Already in Watchlist" instead (disabled state)

**Acceptance criteria:**
- [ ] "+" button on Watchlist tab opens add modal
- [ ] Modal has Gold / Silver / Other Assets category toggle
- [ ] Gold category: gold type dropdown (VND types only)
- [ ] Silver category: silver type dropdown (VND types only)
- [ ] Other Assets: SymbolAutocomplete input
- [ ] Optional note field (max 200 chars)
- [ ] Current price shown as confirmation
- [ ] Symbol Lookup tab shows "Add to Watchlist" button after price lookup
- [ ] Duplicate detection: if symbol already in watchlist, show disabled state
- [ ] Maximum 50 items enforced (server-side), clear error shown when limit reached
- [ ] Success state shown after adding

### FR-3: Reorder Watchlist (Drag-and-Drop)

Users can reorder their watchlist items via drag-and-drop.

**Behavior:**
- Each row has a drag handle (grip icon) on the left
- User drags a row to a new position
- On drop, the new order is persisted to the backend
- `sort_order` field stored per item (integer, lower = higher position)
- Optimistic update: UI reorders immediately, backend call follows
- On error: revert to previous order, show toast error

**Implementation:**
- Use `framer-motion`'s `Reorder` component (already installed in the project)
- Works on both desktop and mobile (touch drag supported)

**Acceptance criteria:**
- [ ] Drag handle visible on each row
- [ ] Drag-and-drop reorders items visually
- [ ] New order persisted to backend on drop
- [ ] Optimistic update with rollback on error
- [ ] Works on both desktop (mouse) and mobile (touch)
- [ ] `sort_order` values updated for affected items

### FR-4: Remove from Watchlist

Users can remove items from their watchlist.

**Behavior:**
- Trash icon button on each row
- No confirmation dialog (lightweight action, easily re-added)
- Soft delete on backend
- Item removed from UI immediately (optimistic)

**Acceptance criteria:**
- [ ] Trash icon on each row
- [ ] One-tap removal without confirmation
- [ ] Item disappears immediately (optimistic update)
- [ ] Soft delete on backend

### FR-5: Edit Watchlist Item Note

Users can edit the note on an existing watchlist item.

**Behavior:**
- Tap on the note area (or an edit icon) to open an inline edit or small popover
- Save on blur or enter key
- Max 200 characters

**Acceptance criteria:**
- [ ] Note is editable inline or via popover
- [ ] Saves on blur or enter
- [ ] Max 200 chars enforced

### FR-6: Re-add Prices Page to Navigation

The Prices page (`/dashboard/prices`) is currently not shown in any navigation. It must be re-added to all three navigation surfaces so users can access their watchlist and market prices.

**1. Desktop Sidebar** — Add "Prices" to the Standard group, after Finance and before Wallets.
- Icon: `TrendingUp` from lucide-react (or similar price/chart icon)
- Animation delay: follows existing 30ms increment pattern (adjust subsequent items)
- Translation key: `t("prices")` (already exists in `en/nav.json` and `vi/nav.json`)

**2. Mobile Slide-Out Menu** — Add "Prices" to the standardItems array, after Finance and before Wallets.
- Same icon as desktop (`TrendingUp`, size 22)

**3. Mobile Bottom Navigation** — Add "Prices" as a 4th item.
- Current items: Portfolio, Home, Community (3 items at 33.33% width)
- New items: Portfolio, Home, Prices, Community (4 items)
- CSS change: Update `max-w-[33.33%]` to `max-w-[25%]` in BottomNav
- Icon: Needs a custom SVG icon matching the existing BottomNav icon style, or use a lucide icon

**Acceptance criteria:**
- [ ] Prices page accessible from desktop sidebar (Standard group, after Finance)
- [ ] Prices page accessible from mobile slide-out menu (after Finance)
- [ ] Prices page accessible from mobile bottom nav (4th item)
- [ ] Bottom nav adjusts width to accommodate 4 items
- [ ] Active state indicator works correctly on all 3 navigation surfaces
- [ ] Translation keys used for label (both en and vi)

## Non-Functional Requirements

- **Performance:** Watchlist price fetch should complete within 3 seconds for 50 items. Gold/silver prices are already cached (15-min TTL). Stock/crypto prices fetched in batch from MarketDataService cache.
- **Scalability:** Max 50 items per user. With 1,000 users × 50 items = 50,000 max watchlist items.
- **Reliability:** If price fetch fails for a symbol, show "N/A" for that row's price. Don't block other rows.
- **Security:** Users can only CRUD their own watchlist items. Server-side ownership validation on all operations.

## Architecture Changes (C4)

### Diagrams to Update

1. **c4-component-backend.md** — Add:
   - `WatchlistRepository` component in Repository layer
   - `WatchlistService` component in Service layer
   - `WatchlistHandler` component in Handler layer
   - Relationships: WatchlistService → MarketDataService, GoldPriceService, SilverPriceService (for price enrichment)

2. **c4-component-frontend.md** — Add:
   - New feature module: `features/watchlist/`
   - Watchlist tab on Prices page
   - AddToWatchlistForm component
   - Prices page re-added to navigation (sidebar, mobile menu, bottom nav)

### New Diagrams

No new L4 code diagram needed — the domain is simple (one model with CRUD + reorder + price enrichment).

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — this is a new domain.

### New Flow Diagrams

1. **New file: `flow-watchlist.md`** — sequenceDiagram for:
   - **List Watchlist with Prices flow**: User opens Watchlist tab → REST Handler → WatchlistService.ListWithPrices() → WatchlistRepo (get items) → [group by asset type] → GoldPriceService / SilverPriceService / MarketDataService (cached prices) → Merge & return
   - **Reorder flow**: User drops item → REST Handler → WatchlistService.Reorder() → WatchlistRepo (bulk update sort_order) → Response

## Data Model Changes

### New Table: `watchlist`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int32 | PK, auto-increment | Watchlist item ID |
| user_id | int32 | NOT NULL, INDEX | Owner |
| symbol | varchar(50) | NOT NULL | Symbol code (e.g., "AAPL", "SJL1L10", "XAU") |
| name | varchar(200) | NOT NULL | Display name (e.g., "Apple Inc.", "SJC 1L-10L") |
| asset_type | int32 | NOT NULL | InvestmentType enum value (1=crypto, 2=stock, 8=gold_vnd, 10=silver_vnd, etc.) |
| currency | varchar(3) | NOT NULL | ISO 4217 (VND, USD) |
| note | varchar(200) | | Optional user note |
| sort_order | int32 | NOT NULL, DEFAULT 0 | Display order (lower = higher position) |
| created_at | timestamp | NOT NULL | Creation time |
| updated_at | timestamp | NOT NULL | Last update |
| deleted_at | timestamp | INDEX | Soft delete |

**Indexes:**
- `idx_watchlist_user_id` on `(user_id)` — for listing user's watchlist
- `idx_watchlist_user_symbol` UNIQUE on `(user_id, symbol, deleted_at)` — prevent duplicate symbols per user (with soft delete awareness)
- `idx_watchlist_user_sort` on `(user_id, sort_order)` — for ordered listing

## API Changes

### New Proto: `watchlist.proto`

```protobuf
syntax = "proto3";

package wealthjourney.watchlist.v1;

import "google/api/annotations.proto";
import "protobuf/v1/common.proto";
import "protobuf/v1/investment.proto";

// ── Watchlist Messages ──

message WatchlistItem {
  int32 id = 1 [json_name = "id"];
  int32 user_id = 2 [json_name = "userId"];
  string symbol = 3 [json_name = "symbol"];
  string name = 4 [json_name = "name"];
  wealthjourney.investment.v1.InvestmentType asset_type = 5 [json_name = "assetType"];
  string currency = 6 [json_name = "currency"];
  string note = 7 [json_name = "note"];
  int32 sort_order = 8 [json_name = "sortOrder"];
  // Price fields (enriched at response time, not stored)
  int64 current_price = 9 [json_name = "currentPrice"];
  int64 price_change = 10 [json_name = "priceChange"];
  double price_change_percent = 11 [json_name = "priceChangePercent"];
  // For gold/silver: buy and sell prices
  int64 buy_price = 12 [json_name = "buyPrice"];
  int64 sell_price = 13 [json_name = "sellPrice"];
  int64 created_at = 14 [json_name = "createdAt"];
}

// ── RPC Requests/Responses ──

message CreateWatchlistItemRequest {
  string symbol = 1 [json_name = "symbol"];
  string name = 2 [json_name = "name"];
  wealthjourney.investment.v1.InvestmentType asset_type = 3 [json_name = "assetType"];
  string currency = 4 [json_name = "currency"];
  string note = 5 [json_name = "note"];
}

message CreateWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  WatchlistItem item = 3 [json_name = "item"];
  string timestamp = 4 [json_name = "timestamp"];
}

message ListWatchlistRequest {
  // No pagination needed — max 50 items, always fetch all
}

message ListWatchlistResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated WatchlistItem items = 3 [json_name = "items"];
  int32 total = 4 [json_name = "total"];
  string timestamp = 5 [json_name = "timestamp"];
}

message UpdateWatchlistItemRequest {
  string note = 1 [json_name = "note"];
}

message UpdateWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  WatchlistItem item = 3 [json_name = "item"];
  string timestamp = 4 [json_name = "timestamp"];
}

message DeleteWatchlistItemRequest {}

message DeleteWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message ReorderWatchlistRequest {
  repeated int32 item_ids = 1 [json_name = "itemIds"];
  // Ordered list of item IDs — position in array = new sort_order
}

message ReorderWatchlistResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message CheckWatchlistItemRequest {
  string symbol = 1 [json_name = "symbol"];
}

message CheckWatchlistItemResponse {
  bool exists = 1 [json_name = "exists"];
  int32 item_id = 2 [json_name = "itemId"];
}

// ── Service Definition ──

service WatchlistService {
  rpc CreateWatchlistItem(CreateWatchlistItemRequest) returns (CreateWatchlistItemResponse) {
    option (google.api.http) = {
      post: "/api/v1/watchlist"
      body: "*"
    };
  }

  rpc ListWatchlist(ListWatchlistRequest) returns (ListWatchlistResponse) {
    option (google.api.http) = {
      get: "/api/v1/watchlist"
    };
  }

  rpc UpdateWatchlistItem(UpdateWatchlistItemRequest) returns (UpdateWatchlistItemResponse) {
    option (google.api.http) = {
      put: "/api/v1/watchlist/{id}"
      body: "*"
    };
  }

  rpc DeleteWatchlistItem(DeleteWatchlistItemRequest) returns (DeleteWatchlistItemResponse) {
    option (google.api.http) = {
      delete: "/api/v1/watchlist/{id}"
    };
  }

  rpc ReorderWatchlist(ReorderWatchlistRequest) returns (ReorderWatchlistResponse) {
    option (google.api.http) = {
      put: "/api/v1/watchlist/reorder"
      body: "*"
    };
  }

  rpc CheckWatchlistItem(CheckWatchlistItemRequest) returns (CheckWatchlistItemResponse) {
    option (google.api.http) = {
      get: "/api/v1/watchlist/check"
    };
  }
}
```

### REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/watchlist` | Required | Add item to watchlist |
| GET | `/api/v1/watchlist` | Required | List all watchlist items with current prices |
| PUT | `/api/v1/watchlist/:id` | Required | Update item (note only) |
| DELETE | `/api/v1/watchlist/:id` | Required | Remove item (soft delete) |
| PUT | `/api/v1/watchlist/reorder` | Required | Reorder items (bulk sort_order update) |
| GET | `/api/v1/watchlist/check?symbol=AAPL` | Required | Check if symbol is already in watchlist |

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Symbol search input | SymbolAutocomplete | `features/investment/components/SymbolAutocomplete.tsx` |
| Number display formatting | `formatPriceValue`, `formatChangeValue` | `app/[locale]/dashboard/prices/helpers.ts` |
| Gold type options | `goldTypeOptions` (VND types) | `features/investment/utils/gold-calculator.ts` |
| Silver type options | `silverTypeOptions` (VND types) | `features/investment/utils/silver-calculator.ts` |
| Text input | FormInput | `components/forms/FormInput.tsx` |
| Modal wrapper | BaseModal | `components/modals/BaseModal.tsx` |
| Success animation | Success | `components/modals/Success.tsx` |
| Empty state | EmptyState | `components/feedback/EmptyState.tsx` |
| Table (desktop) | TanStackTable | `components/table/TanStackTable.tsx` |
| Table (mobile) | MobileTable | `components/table/MobileTable.tsx` |
| Loading spinner | LoadingSpinner | `components/loading/LoadingSpinner.tsx` |
| Button | Button | `components/Button.tsx` |
| Floating action button | FloatingActionButton | `components/Button.tsx` |
| Toast notifications | Toast | `components/feedback/Toast.tsx` |
| Drag/reorder animation | `framer-motion` Reorder | Already installed (`framer-motion` v12.27.5) |
| Tab bar pattern | Manual tab buttons | `app/[locale]/dashboard/prices/page.tsx` (reuse same pattern) |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| AddToWatchlistForm | `features/watchlist/forms/AddToWatchlistForm.tsx` | Feature-specific form with category toggle and gold/silver type dropdowns |
| WatchlistTab | `features/watchlist/components/WatchlistTab.tsx` | Watchlist tab content with drag-and-drop table |
| WatchlistRow | `features/watchlist/components/WatchlistRow.tsx` | Draggable row component wrapping framer-motion Reorder.Item |
| AssetTypeBadge | `features/watchlist/components/AssetTypeBadge.tsx` | Small colored badge/icon for asset type (stock, crypto, gold, silver) |

### UI Layout

**Prices Page Tab Bar (updated):**
```
[Watchlist] [Gold] [Silver] [Currency] [Symbol Lookup]
     ^
  NEW (default active)
```

**Watchlist Tab — Desktop Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Watchlist (12 items)                                    [+ Add]     │
├────┬──────────┬──────────────┬───────────┬──────────┬───────┬──────┤
│ ⠿  │ Symbol   │ Name         │ Price     │ Change   │ Note  │      │
├────┼──────────┼──────────────┼───────────┼──────────┼───────┼──────┤
│ ⠿  │ AAPL     │ Apple Inc.   │ $185.50   │ +$2.30   │ Buy…  │ 🗑   │
│    │          │              │           │ (+1.26%) │       │      │
│ ⠿  │ SJL1L10  │ SJC 1L-10L   │ B: 85,000 │ +200     │       │ 🗑   │
│    │          │              │ S: 85,500 │          │       │      │
│ ⠿  │ BTC-USD  │ Bitcoin      │ $67,230   │ -$1,050  │ Hold  │ 🗑   │
│    │          │              │           │ (-1.54%) │       │      │
└────┴──────────┴──────────────┴───────────┴──────────┴───────┴──────┘
```

**Watchlist Tab — Mobile Layout (MobileTable, collapsed):**
```
┌─────────────────────────────────┐
│ ⠿  AAPL          $185.50  🗑   │
│    Apple Inc.     +1.26%        │
├─────────────────────────────────┤
│ ⠿  SJL1L10       B: 85,000 🗑  │
│    SJC 1L-10L     S: 85,500    │
├─────────────────────────────────┤
│ ⠿  BTC-USD       $67,230  🗑   │
│    Bitcoin        -1.54%        │
│                   Note: Hold    │
└─────────────────────────────────┘
          [+ Add to Watchlist]   ← FloatingActionButton
```

**Add to Watchlist Modal:**
```
┌─────────────────────────────────┐
│ Add to Watchlist                │
│                                 │
│ Asset Type                      │
│ [Gold] [Silver] [Other Assets]  │
│                                 │
│ Gold Type*   [SJC 1L-10L    ▼] │
│                                 │
│ Current: B 85,000 | S 85,500   │
│                                 │
│ Note (optional) [____________] │
│                                 │
│        [Add to Watchlist]       │
└─────────────────────────────────┘
```

**Symbol Lookup tab — "Add to Watchlist" button:**
```
┌─────────────────────────────────┐
│ Symbol: AAPL                    │
│ Apple Inc. — NASDAQ             │
│ Price: $185.50                  │
│ Change: +$2.30 (+1.26%)        │
│                                 │
│ [☆ Add to Watchlist]            │
│   or                            │
│ [★ Already in Watchlist]  (dim) │
└─────────────────────────────────┘
```

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Watchlist form data (symbol, name, asset type, currency, note) | Yes: Internet → App | REST Handler | Untrusted input |
| 2 | REST Handler | Validated request + userID from JWT | No (same tier) | WatchlistService | Handler validates & extracts userID |
| 3 | WatchlistService | Watchlist model | Yes: App → DB | PostgreSQL | GORM parameterized queries |
| 4 | WatchlistService | Price fetch requests (grouped by type) | Yes: App → External API | Yahoo Finance / vang.today | Via cached MarketDataService / GoldPriceService / SilverPriceService |
| 5 | External API | Price responses | Yes: External → App | Service cache layer | Validated by existing services |
| 6 | WatchlistService | Enriched watchlist items | No (same tier) | REST Handler → JSON response | Prices merged with stored items |
| 7 | User (browser) | Reorder request (array of item IDs) | Yes: Internet → App | REST Handler | Must validate all IDs belong to user |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Watchlist CRUD + reorder requests | JWT auth + input validation |
| App → DB | Watchlist storage/retrieval | GORM parameterized queries + user_id ownership check |
| App → External API | Price fetches (cached) | Existing cache/throttle/timeout controls (unchanged) |
| External → App | Price responses | Existing validation in price services (unchanged) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Unauthenticated user manages watchlist | High | JWT auth middleware on all endpoints |
| T-2 | 1 | Internet → App | Tampering | User modifies another user's watchlist items | High | Server extracts userID from JWT; ownership check on all operations |
| T-3 | 1 | Internet → App | Tampering | User sends malicious note content (XSS) | Medium | Server-side trim + sanitize; frontend escapes output |
| T-4 | 1 | Internet → App | DoS | User creates excessive watchlist items | Low | Max 50 items per user (server-enforced) |
| T-5 | 7 | Internet → App | Tampering | Reorder request includes IDs not owned by user | Medium | Validate ALL item IDs in reorder array belong to requesting user |
| T-6 | 7 | Internet → App | Tampering | Reorder request with duplicate or missing IDs | Low | Validate array contains exactly the user's active item IDs |
| T-7 | 3 | App → DB | Info Disclosure | User queries another user's watchlist | High | WHERE user_id = ? on all queries |
| T-8 | 6 | App → Client | Info Disclosure | Price response leaks other users' watchlist data | Low | Price enrichment scoped to requesting user's items only |
| T-9 | 1 | Internet → App | Elevation | User bypasses 50-item limit via concurrent requests | Low | Use DB-level count within transaction |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Create | Allowed (max 50) | Denied | Denied |
| Read/List | Own items only | Denied | Denied |
| Update (note) | Own items only | Denied | Denied |
| Delete | Own items only | Denied | Denied |
| Reorder | Own items only | Denied | Denied |
| Check existence | Own items only | Denied | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| symbol | string | 1-50 chars | Required, trim, alphanumeric + dots/hyphens/underscores |
| name | string | 1-200 chars | Required, trim |
| asset_type | int32 | Valid InvestmentType enum | Required, enum check |
| currency | string | 3 chars, ISO 4217 | Required, allowed list (VND, USD, EUR, etc.) |
| note | string | 0-200 chars | Optional, trim, sanitize HTML |
| item_ids (reorder) | []int32 | Non-empty, no duplicates | Required, all must belong to user, must contain all active items |

### External Dependency Risks

No new external dependencies introduced. All price fetching reuses existing services (GoldPriceService, SilverPriceService, MarketDataService) with their established caching, rate limiting, and fallback behavior.

| External Service | Data Exchanged | Trust Level | Failure Impact | Mitigation |
|-----------------|----------------|-------------|----------------|------------|
| Yahoo Finance | Market prices (via cache) | Low (public) | "N/A" shown for affected items | Graceful fallback — show stale or "N/A" |
| vang.today | Gold prices (via cache) | Low (public) | "N/A" shown for gold items | Graceful fallback |

**New package:** None for backend. Frontend uses `framer-motion` Reorder (already installed, v12.27.5).

### Sensitive Data Handling

| Data Field | Sensitivity | Protection Required |
|-----------|------------|-------------------|
| note | Internal (user's personal notes) | User-scoped access only; sanitized input; HTML escaped on output |
| symbol/name/price | Public (market data) | No special protection needed |
| watchlist composition | Internal (user's interests) | User-scoped access only — reveals user's investment interests |

### Issues & Risks Summary

1. **Price fetch latency for large watchlists** — 50 items across multiple asset types requires grouping and batch fetching. Mitigated by using cached prices (15-min TTL) and parallel fetching per asset type.
2. **Drag-and-drop on mobile** — Touch-based drag can conflict with scroll. Mitigated by using explicit drag handles (not full-row drag) and `framer-motion`'s touch support.
3. **Unique constraint with soft deletes** — Unique index on `(user_id, symbol)` must account for soft-deleted rows. Use a partial unique index or include `deleted_at` in the constraint.
4. **Reorder atomicity** — Bulk sort_order update must be atomic. Use a single transaction with a batch update.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| Adding a symbol that's already in watchlist | Return 409 Conflict with message: "Symbol already in your watchlist." Frontend shows disabled "Already in Watchlist" state. |
| Max 50 items reached | Return 400 with message: "Maximum of 50 watchlist items reached. Remove an item to add a new one." |
| Price fetch fails for some symbols | Show "N/A" for failed symbols. Don't block entire response. |
| Symbol delisted or unavailable | Item stays in watchlist, shows "N/A" for price. User can remove manually. |
| Reorder with stale item list | If item IDs don't match current active items (e.g., item was deleted by another session), return 400 and force client to refresh. |
| Empty watchlist | Show EmptyState component with add CTA. |
| Concurrent add of same symbol (race condition) | Unique constraint prevents duplicate. Second request gets 409. |
| User deletes account | Watchlist items soft-deleted via cascade or account cleanup. |
| Gold/silver type temporarily unavailable in price API | Show "N/A" for that item's price. Item remains in watchlist. |
| Note with special characters | Trim and sanitize server-side. Frontend HTML-escapes on render. |

## Dependencies & Assumptions

- Existing `GoldPriceService`, `SilverPriceService`, `MarketDataService` continue to cache prices with 15-min TTL
- Existing `SymbolAutocomplete` component works for all asset types
- `framer-motion` v12.27.5 (already installed) supports `Reorder` component for drag-and-drop
- Gold/silver type options from `gold-calculator.ts` and `silver-calculator.ts` are reusable
- Price helpers (`formatPriceValue`, `formatChangeValue`) from Prices page are reusable
- The `InvestmentType` proto enum is importable from `investment.proto` in the new `watchlist.proto`

## Out of Scope

- Price alerts integration (separate feature, already specced)
- Portfolio integration ("Add to Watchlist" from Portfolio page) — can be added later
- Historical price charts per watchlist item — future enhancement
- Watchlist sharing or public watchlists
- Multiple named watchlists (e.g., "Tech Stocks", "Gold") — future enhancement
- Auto-grouping by asset type within the watchlist
- Price auto-refresh while on the tab (manual refresh only)
- Push notifications for watchlist items (use price alerts for that)
