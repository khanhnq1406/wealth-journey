# Fix Watchlist Missing Prices — Specification

## Summary

Some watchlist items display N/A for price despite being successfully added. The root cause is that `watchlistService.ListItems()` builds lookup maps keyed by vendor `TypeCode` (e.g. `"USD_VCB"`, `"SJC_MI_HONG"`) but tries to match against `item.Symbol` (the user-facing identifier stored at add-time, e.g. `"USD"`, `"Eximbank"`, `"Mi hồng"`). The fix routes all gold, silver, and currency items through `MarketDataService.GetPrice()` — which already uses `AssetDisplayConfigService.ResolvePrice()` to correctly bridge symbol → vendor TypeCode → price. This matches the pattern already working for market/crypto items.

## User Stories

- As a user, I want my watchlist to show current buy/sell prices for gold, silver, and currency items so I can monitor them at a glance.
- As a user, I want gold/silver items I added via the star icon to show the same prices as the main gold/silver tab.

## Functional Requirements

### FR-1: Gold Items Must Resolve Prices Correctly

Gold watchlist items (assetType 8 = `GOLD_VND`, assetType 9 = `GOLD_USD`) must return `buyPrice` and `sellPrice` in the list response.

**Acceptance criteria:**

- [ ] "Eximbank" (assetType 8) returns non-zero `buyPrice`/`sellPrice`
- [ ] "SJC Mi Hồng" (symbol "Mi hồng", assetType 8) returns non-zero `buyPrice`/`sellPrice`
- [ ] "Nhẫn Mi Hồng 9999" (symbol "Mihong_999", assetType 8) continues to return prices (regression check)
- [ ] Gold items with no matching config return zero prices gracefully (no panic, no 500)

### FR-2: Currency Items Must Resolve Prices Correctly

Currency watchlist items (assetType 13 = `INVESTMENT_TYPE_FOREIGN_CURRENCY`) must return `buyPrice`/`sellPrice`.

**Acceptance criteria:**

- [ ] "USD Tự Do" (symbol "USD", assetType 13) returns non-zero `buyPrice`/`sellPrice`
- [ ] Currency items with no config return zero prices gracefully

### FR-3: Silver Items Must Resolve Prices Correctly

Silver watchlist items must return `buyPrice`/`sellPrice` via the same fix path.

**Acceptance criteria:**

- [ ] Silver items return non-zero `buyPrice`/`sellPrice` when config exists
- [ ] Silver items with no config return zero prices gracefully

### FR-4: Market/Crypto Items Unaffected

Bitcoin USD (assetType 1) and other market items must continue working exactly as before.

**Acceptance criteria:**

- [ ] "Bitcoin USD" (BTC-USD, assetType 1) continues to return `currentPrice`/`buyPrice`/`sellPrice`
- [ ] No regression in market item price fetch

## Non-Functional Requirements

- **Performance:** All items fetched in parallel goroutines (same `sync.WaitGroup` pattern already used for market items). Latency bounded by slowest single item, not sum of all items. Acceptable for ≤50 items.
- **Resilience:** If `GetPrice()` fails for one item, log warning and continue — same behavior as existing market items. No 500 errors from price fetch failures.
- **No new external calls:** Gold/silver/currency prices already cached in `asset_price` DB table via `PriceCacheJob`. `MarketDataService.GetPrice()` reads from that cache — no new external API calls introduced.

## Architecture Changes (C4)

### Diagrams to Update

**`c4-component-backend.md` (L3 Backend):** No structural change — `WatchlistService` already depends on `MarketDataService`. The fix changes how that dependency is used internally, not the dependency graph itself. No diagram update needed.

### New Diagrams

None required. This is an internal behavior fix within existing components.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-watchlist.md` — Section 2: List Watchlist with Price Enrichment**

Update the sequence diagram to reflect that gold/silver/currency items now go through `MarketDataService.GetPrice()` (same path as market items), instead of the direct `AssetPriceService.GetAllPrices()` + map lookup path. Specifically:

- Remove the `GPS` (GoldPriceService) and `SPS` (SilverPriceService) participants from the list flow
- Remove the separate synchronous gold/silver/currency enrichment blocks
- Show all items (gold + silver + currency + market) as a single parallel goroutine fan-out through `MDS.GetPrice()`
- Add note: `MDS → AssetDisplayConfigService.ResolvePrice() for gold/silver/currency`

### New Flow Diagrams

None required.

## Data Model Changes

None. No schema changes required.

## API Changes

None. Request/response shape of `GET /api/v1/watchlist` is unchanged. Items that previously returned no price fields will now return `buyPrice`/`sellPrice`/`currentPrice` with correct values.

## UI/UX Changes

None. Frontend already handles price display — the fix is purely backend. The `formatWatchlistPrice()` function in `prices/page.tsx` already divides gold/silver by 1000 and others by 100, which will continue to work correctly once prices are populated.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price display | `formatWatchlistPrice()` | `app/[locale]/dashboard/prices/page.tsx` |
| Watchlist table | `DraggableWatchlistTable` | `features/watchlist/` |

No new components needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | `GET /api/v1/watchlist` + JWT | Yes: Internet → App | WatchlistHandler | JWT validated by auth middleware |
| 2 | WatchlistHandler | userID (from JWT) | No (same tier) | WatchlistService | userID never from request params |
| 3 | WatchlistService | symbol, assetType (from DB row) | No (same tier) | MarketDataService.GetPrice() | Input comes from DB, not user |
| 4 | MarketDataService | symbol, assetType | Yes: App → DB | asset_price table (via AssetDisplayConfigService) | Parameterized GORM query |
| 5 | asset_price table | buyPrice, sellPrice (int64) | Yes: DB → App | WatchlistService | Trusted DB tier |
| 6 | WatchlistService | enriched WatchlistItem list | No (same tier) | WatchlistHandler | |
| 7 | WatchlistHandler | JSON response | Yes: App → Internet | User (browser) | Only user's own items returned |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | GET /api/v1/watchlist request | JWT auth middleware; userID from token |
| App → DB | asset_price + asset_display_config queries | GORM parameterized queries; no user input reaches DB in this fix |
| App → External API | Yahoo Finance (market items only — unchanged) | Existing timeout + cache pattern; unchanged by this fix |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | JWT forged to access another user's watchlist | Medium | Existing JWT validation + Redis whitelist; unchanged |
| T-2 | 1 | Internet → App | DoS | Flood GET /api/v1/watchlist to exhaust DB connections | Low | Existing rate limiting; goroutine fan-out bounded by 50-item limit |
| T-3 | 3 | App → DB | Info Disclosure | symbol/assetType from DB row used in ResolvePrice — no user input path | None | Input to ResolvePrice comes from DB, not user-controlled; no injection risk |
| T-4 | 4 | App → DB | Tampering | SQL injection via symbol in ResolvePrice | None | GORM parameterized queries; symbol sourced from DB, not request |
| T-5 | 6 | App → Internet | Info Disclosure | Error details from GetPrice() leaked to client | Low | Existing pattern: log warning, return zero prices (not error message) |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| List watchlist with prices | Allowed (own items only) | Denied (userID from JWT) | Denied (401) |

No change from current authorization model. The fix does not introduce new endpoints or new authorization paths.

### Input Validation Rules

No new user input in this fix. The symbol and assetType values passed to `GetPrice()` originate from the `watchlist` DB table (written at add-time with existing validation), not from the current request.

### External Dependency Risks

| Service | Risk | Mitigation |
|---------|------|-----------|
| asset_price DB table (gold/silver/currency cache) | Stale/empty on cold start | `GetPrice()` returns error → zero prices shown (graceful); `PriceCacheJob` repopulates every 15m |
| Yahoo Finance (market items) | Unchanged | Existing fallback behavior unchanged |

### Sensitive Data Handling

Watchlist items contain symbol names and prices — not personally identifiable financial secrets. No change to data sensitivity profile.

### Issues & Risks Summary

1. **Cold-start gap:** If `PriceCacheJob` hasn't run yet, `asset_price` table is empty and gold/silver/currency items will show zero prices. This is the same behavior as the rest of the app on cold start — acceptable.
2. **Missing AssetDisplayConfig for some symbols:** Items like "Eximbank" require a matching row in `asset_display_config` with TypeCode = "Eximbank". If no config row exists, `ResolvePrice()` returns an error and the item shows zero prices. This is a data issue, not a code issue — but worth verifying config exists for the affected items.
3. **Goroutine fan-out for all items:** Moving gold/silver/currency from synchronous to goroutine-per-item slightly increases DB connection pool pressure. With a 50-item cap this is negligible, but worth noting.

## Edge Cases & Error Handling

| Scenario | Current Behavior | Expected After Fix |
|----------|-----------------|-------------------|
| Symbol has no AssetDisplayConfig | Zero prices (map miss) | Zero prices (GetPrice returns error → logged, skipped) |
| asset_price table empty (cold start) | Zero prices | Zero prices (same) |
| All items are market/crypto | Unchanged | Unchanged |
| Gold item + GetPrice timeout | Zero prices | Zero prices + warning log |
| Watchlist empty | Empty list, no price fetch | Empty list, no price fetch (unchanged) |

## Dependencies & Assumptions

- `MarketDataService.GetPrice()` correctly handles `GOLD_VND`, `GOLD_USD`, `SILVER_VND`, and `FOREIGN_CURRENCY` asset types via `AssetDisplayConfigService.ResolvePrice()` — confirmed by reading `market_data_service.go` lines 85-93.
- `AssetDisplayConfig` rows must exist for the affected symbols (`Eximbank`, `Mi hồng`, `USD`). The code fix enables the correct lookup path; data must be present for prices to resolve.
- `PriceCacheJob` runs every 15 minutes and populates `asset_price` table — existing behavior, no change.

## Out of Scope

- Adding missing `AssetDisplayConfig` rows for specific gold/currency symbols — that is a data migration task separate from this code fix.
- Changing how prices are displayed on the frontend — `formatWatchlistPrice()` is correct as-is.
- Modifying the watchlist add flow or symbol validation.
- Changing the 50-item watchlist limit.
