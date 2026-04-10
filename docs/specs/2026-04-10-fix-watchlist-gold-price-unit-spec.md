# Fix Watchlist Gold/Silver Price Unit Spec

## Summary

Gold and silver watchlist items display incorrect prices because `MarketDataService.GetPrice()` applies a per-lượng → per-gram unit conversion (`ProcessMarketPrice`) before returning. The `asset_price` table stores gold VND prices in per-lượng units (e.g., `171,000,000`). After conversion the watchlist API returns `4,560,000` (per gram). The frontend divides by 1000 for display, showing `4,560` instead of `171,000` (nghìn đồng, i.e., 171 million VND per lượng). The fix routes gold/silver/currency watchlist items directly through `AssetDisplayConfigService.ResolvePrice()` to obtain the raw market price, bypassing the investment-unit conversion.

The `Eximbank` item (zero price, symbol is a display name not a TypeCode) is accepted as-is — legacy data with no TypeCode match; user should delete and re-add with correct TypeCode.

## User Stories

- As a user, I want the gold watchlist to show the current per-lượng gold market price (e.g., `171,000`), so that I can compare it to the Gold tab on the same screen.
- As a user, I want the silver watchlist to show the correct per-lượng/per-kg silver market price, so that I can monitor silver prices accurately.

## Functional Requirements

### FR-1: Gold/Silver Watchlist Items Show Raw Market Price

The watchlist API must return the `asset_price.Buy` value directly for gold and silver items (without applying `ProcessMarketPrice`).

**Acceptance criteria:**

- [ ] Gold `GOLD_VND` watchlist item with symbol `Mihong_999` returns `buyPrice = 171,000,000` (matching `asset_price` table, matching Gold tab `/prices`)
- [ ] Gold `GOLD_VND` watchlist item with symbol `Mi hồng` returns `buyPrice = 171,000,000`
- [ ] Silver watchlist items return the raw `asset_price.Buy` value (no tael→gram conversion)
- [ ] `GetPrice()` flow (for market/crypto/stock items) is unchanged
- [ ] Currency `FOREIGN_CURRENCY` items continue to use the existing DB cache path (unchanged)
- [ ] If `ResolvePrice()` returns an error for a gold/silver item, log a warning and return zero price (no error to caller) — same behaviour as the current `GetPrice()` error path

### FR-2: DI Wiring Updated

`NewWatchlistService` accepts `AssetDisplayConfigService` as a new dependency.

**Acceptance criteria:**

- [ ] `NewWatchlistService` has a 4th parameter: `assetDisplayConfigSvc AssetDisplayConfigService`
- [ ] `services.go` passes `assetDisplayConfigSvc` when constructing `watchlistSvc`
- [ ] All unit tests compile and pass

## Non-Functional Requirements

- **Performance**: `ResolvePrice()` is a DB read (already used by the existing `GetPrice()` gold/silver path). No additional external calls.
- **Security**: No change to auth, authorization, or data exposure surface.
- **Backward compatibility**: No proto changes; API response shape unchanged.

## Architecture Changes (C4)

### Diagrams to Update

None — `WatchlistService` already depends on `AssetDisplayConfigService` indirectly via `MarketDataService`. The change promotes it to a direct dependency, which is a wiring detail not worth a C4 update.

### Runtime Flow Diagrams to Update

**`docs/architecture/flow-watchlist.md` — Section 2 (List Watchlist with Price Enrichment)**

Replace the single `GetPrice()` loop with a split path:
- Gold/silver: `WS → ADCS: ResolvePrice(ctx, symbol, assetType)` directly
- Currency: `WS → ADCS: ResolvePrice(ctx, symbol, "currency")` directly  
- Market/stock/crypto: `WS → MDS: GetPrice(ctx, symbol, currency, assetType, 15m)` (unchanged)

## Data Model Changes

None.

## API Changes

None — response shape unchanged (`buyPrice`, `sellPrice`, `currentPrice` fields). Values for gold/silver items will now be correct.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Client | `GET /api/v1/watchlist` + JWT | Yes: Internet → App | WatchlistHandler | JWT validated by middleware |
| 2 | DB | `asset_price` rows | No | AssetDisplayConfigService | Internal service-to-repo call |
| 3 | DB | `watchlist_item` rows | No | WatchlistRepository | Scoped by `user_id` from JWT |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| Internet → App | ListWatchlist request | JWT middleware (unchanged) |
| App → DB | `asset_price` read | Parameterized GORM queries (unchanged) |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Elevation | User accesses another user's watchlist | Low | `ListByUserID(userID)` already scopes to JWT userID — unchanged |
| T-2 | 2 | App → DB | Tampering | Manipulate `asset_price.Buy` in DB | Low | DB write access restricted to backend; no new write path added |

### Authorization Rules

Unchanged — `ListByUserID(userID)` scopes DB reads to the authenticated user.

### Input Validation Rules

Unchanged — no new inputs. `symbol` and `assetType` come from DB rows written at item-creation time.

### External Dependency Risks

None new. `ResolvePrice()` reads from the `asset_price` table (populated by `PriceCacheJob`). If the table is empty (cold start), `ResolvePrice()` returns an error; the watchlist returns zero prices — same behaviour as before.

### Sensitive Data Handling

No change — prices are non-sensitive public market data.

### Issues & Risks Summary

1. **Unit test mocks**: Existing tests mock `GetPrice()`. New tests must mock `AssetDisplayConfigService.ResolvePrice()` directly for gold/silver items. The mock setup changes but no interface changes.
2. **Cold start**: Same zero-price fallback as before. Acceptable.
3. **`assetPriceSvc` field**: Already noted as unused at runtime in the original report. This fix does not add another unused field.

## Edge Cases & Error Handling

- `ResolvePrice()` error → log + zero price, no error returned to caller (matches existing `GetPrice()` error handling)
- `asset_price` table empty (cold start) → `ResolvePrice()` returns not-found → zero price shown
- Mixed watchlist (gold + stock) → gold uses `ResolvePrice()`, stock uses `GetPrice()` — both in the same goroutine loop

## Dependencies & Assumptions

- `AssetDisplayConfigService` is already constructed before `WatchlistService` in `services.go`
- `asset_price` table is populated by `PriceCacheJob` every 15 minutes
- `asset_display_config` and `asset_config_fetch_code` tables have configs for all TypeCodes used as watchlist symbols (e.g., `Mihong_999`, `Mi hồng`)

## Out of Scope

- Fixing `Eximbank` zero price (legacy data issue — symbol is not a valid TypeCode)
- Adding buy/sell spread to watchlist (noted as tech debt in original report)
- Silver USD path
- Any frontend changes
