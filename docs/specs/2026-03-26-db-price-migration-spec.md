# DB-Backed Price Migration Specification

## Summary

Three services (`PriceAlertService`, `UserPriceAlertService`, `WatchlistService`) still call live
external APIs (gold, silver, currency) directly on every invocation. This feature migrates all of
them to read from the `asset_price` DB cache that `PriceCacheJob` already maintains, eliminating
per-invocation external API calls for gold, silver, and currency prices. Yahoo Finance calls for
stock/crypto symbols in the watchlist and alert services remain live (no DB cache exists for those).

**Before (current state):**
```
PriceAlertService.CheckAndAlert     → GoldPriceService.FetchAllPrices (live)
                                     → SilverPriceService.FetchAllPrices (live)

UserPriceAlertService.EvaluateAlerts → GoldPriceService.FetchAllPrices (live)
                                      → SilverPriceService.FetchAllPrices (live)
                                      → MarketDataService.GetPrice (Yahoo — stays live)

UserPriceAlertService.fetchCurrentPrice → same as above (per-alert-creation call)
UserPriceAlertService.ListAlerts        → same as above (per-list call)

WatchlistService.ListItems → GoldPriceService.FetchAllPrices (live)
                           → SilverPriceService.FetchAllPrices (live)
                           → CurrencyPriceService.FetchAllPrices (live)
                           → MarketDataService.GetPrice (Yahoo — stays live)
```

**After:**
```
PriceAlertService.CheckAndAlert     → AssetPriceService.GetPricesByAssetType("gold")  (DB)
                                     → AssetPriceService.GetPricesByAssetType("silver") (DB)

UserPriceAlertService.EvaluateAlerts → AssetPriceService.GetPricesByAssetType("gold")  (DB)
                                      → AssetPriceService.GetPricesByAssetType("silver") (DB)
                                      → MarketDataService.GetPrice (Yahoo — unchanged)

UserPriceAlertService.fetchCurrentPrice → AssetPriceService.GetPriceByTypeCode(typeCode) (DB)
UserPriceAlertService.ListAlerts        → same

WatchlistService.ListItems → AssetPriceService.GetAllPrices() (DB, single call for all three types)
                           → MarketDataService.GetPrice (Yahoo — unchanged)
```

---

## User Stories

- As the system, I want price alert evaluation to use the DB cache so that alert checks are
  decoupled from live API availability.
- As a user, I want my watchlist prices to load consistently without depending on live API health.
- As a developer, I want all gold/silver/currency consumers to share a single cache source so
  there are no redundant external API calls between scheduler jobs.

---

## Functional Requirements

### FR-1: AssetPriceService — Add `GetPriceByTypeCode` method

The `AssetPriceService` interface currently exposes:
- `GetAllPrices(ctx)` — returns all prices grouped by asset type
- `GetPricesByAssetType(ctx, assetType)` — returns slice for one type

Neither supports single-item lookup by typeCode, which `fetchCurrentPrice` needs. Add:

```go
// GetPriceByTypeCode looks up a single price row by typeCode.
// Returns nil, nil when not found (cold-start: price not yet in DB).
GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error)
```

**Acceptance criteria:**
- [ ] Method added to `AssetPriceService` interface in `interfaces.go`
- [ ] Implemented in `asset_price_service.go` via `repo.ListAll` scan or a new repo method
- [ ] Unit test added for the method (found, not-found, error cases)

### FR-2: PriceAlertService — Migrate gold/silver to DB

Replace `s.goldPriceSvc.FetchAllPrices(ctx)` and `s.silverPriceSvc.FetchAllPrices(ctx)` in
`doCheckAndAlert` with `s.assetPriceSvc.GetPricesByAssetType("gold")` and `("silver")`.

The `PriceAlertService` struct and constructor must swap the two live-service deps for one
`AssetPriceService`. `services.go` and the constructor call in `NewPriceAlertService` must be
updated accordingly.

**Acceptance criteria:**
- [ ] `priceAlertService` struct no longer holds `goldPriceSvc`, `silverPriceSvc`
- [ ] `priceAlertService` struct holds `assetPriceSvc AssetPriceService`
- [ ] `doCheckAndAlert` uses `GetPricesByAssetType` to get `[]*AssetPriceDTO`
- [ ] Logic adapts: `AssetPriceDTO.Buy` replaces `CachedGoldPrice.Buy` (same field names, same int64 type)
- [ ] `ForceCheckAndAlert` continues to work (no change in logic, only price source changes)
- [ ] Unit tests updated: mock `AssetPriceService` instead of `GoldPriceService`/`SilverPriceService`
- [ ] Stale prices (`IsStale == true`) are skipped or treated as missing (log warning, do not trigger alert)

### FR-3: UserPriceAlertService — Migrate gold/silver to DB

Replace live-API calls for gold/silver in:
1. `fetchCurrentPrice` — single-item lookup by `typeCode` → use `assetPriceSvc.GetPriceByTypeCode(typeCode)`
2. `fetchPricesForAlerts` — batch lookup for gold/silver → use `assetPriceSvc.GetPricesByAssetType("gold")` and `("silver")`

The struct and constructor must swap `goldPriceSvc`, `silverPriceSvc` for `assetPriceSvc`.
Yahoo Finance path (`marketDataSvc.GetPrice`) remains unchanged.

**Acceptance criteria:**
- [ ] `userPriceAlertService` struct no longer holds `goldPriceSvc`, `silverPriceSvc`
- [ ] `userPriceAlertService` struct holds `assetPriceSvc AssetPriceService`
- [ ] `fetchCurrentPrice` uses DB for gold/silver, Yahoo for market (unchanged)
- [ ] `fetchPricesForAlerts` uses DB for gold/silver batch, Yahoo per item (unchanged)
- [ ] Stale prices treated as 0 / missing (non-fatal, same behavior as API failure today)
- [ ] `services.go` and `providers.go` wiring updated
- [ ] Unit tests updated: mock `AssetPriceService`

### FR-4: WatchlistService — Migrate gold/silver/currency to DB

Replace the three parallel goroutines that call live APIs in `ListItems` with a single
`assetPriceSvc.GetAllPrices(ctx)` call (one DB query). Build lookup maps from the `AllAssetPrices`
result. Yahoo Finance per-item goroutines remain unchanged.

The struct and constructor must swap `goldPriceSvc`, `silverPriceSvc`, `currencyPriceSvc` for
`assetPriceSvc`.

**Acceptance criteria:**
- [ ] `watchlistService` struct no longer holds `goldPriceSvc`, `silverPriceSvc`, `currencyPriceSvc`
- [ ] `watchlistService` struct holds `assetPriceSvc AssetPriceService`
- [ ] `ListItems` calls `GetAllPrices` once; builds `goldByCode`, `silverByCode`, `currencyByCode` maps
- [ ] Yahoo Finance goroutines per market item remain unchanged
- [ ] `services.go` wiring updated
- [ ] Unit tests added for WatchlistService (none currently exist)
- [ ] Stale entries: `IsStale == true` rows serve prices but no special handling needed (display-level concern)

### FR-5: services.go DI wiring updated

`NewPriceAlertService`, `NewUserPriceAlertService`, and `NewWatchlistService` in `services.go`
must pass `assetPriceSvc` instead of `goldPriceSvc`/`silverPriceSvc`/`currencyPriceSvc`.

**Acceptance criteria:**
- [ ] `services.go` compiles cleanly after all constructor changes
- [ ] No orphaned service instantiations (`goldPriceSvc`, `silverPriceSvc`, `currencyPriceSvc` remain
  in Phase 1 because `assetPriceSvc` still needs them for `RefreshAllPrices`)

---

## Non-Functional Requirements

- **Performance:** `WatchlistService.ListItems` reduces from 3 parallel external API calls to 1 DB
  read for gold/silver/currency — strictly faster on average.
- **Reliability:** Alert evaluation and watchlist enrichment no longer fail when live APIs are
  transiently unavailable; they use cached (possibly stale) data instead.
- **Backward compatibility:** No API contract changes. No proto changes. No frontend changes.
- **Test coverage:** All three migrated services must have unit tests after migration. `WatchlistService`
  currently has zero tests — at least 5 unit tests must be added.

---

## Architecture Changes (C4)

### Diagrams to Update

**`docs/architecture/c4-component-backend.md`** — L3 Backend:
- `PriceAlertService`: remove dependencies on `GoldPriceService` and `SilverPriceService`; add
  dependency on `AssetPriceService`
- `UserPriceAlertService`: same change
- `WatchlistService`: remove dependencies on `GoldPriceService`, `SilverPriceService`,
  `CurrencyPriceService`; add dependency on `AssetPriceService`

### New Diagrams

None required — no new domain.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-cross-cutting.md`** — Section 13 (Price Cache Job) and/or Section 5
(Market Prices flow):
- Add notes that `PriceAlertJob`, `UserPriceAlertJob`, and `WatchlistService` now read from
  `asset_price` DB instead of live APIs for gold/silver/currency
- Update the consumer list for `AssetPriceService`

No new flow diagram file is needed — the existing flow-cross-cutting.md already covers the
background scheduler and price cache patterns.

---

## Data Model Changes

None. The `asset_price` table schema is unchanged. No new tables or columns.

---

## API Changes

None. No proto changes. No new endpoints.

---

## UI/UX Changes

None. Pure backend refactor.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | `asset_price` DB | Gold/Silver/Currency buy/sell int64 | No (internal DB) | `PriceAlertService` | Parameterized query via GORM |
| 2 | `asset_price` DB | Same | No | `UserPriceAlertService` | Same |
| 3 | `asset_price` DB | Same | No | `WatchlistService` | Same |
| 4 | Yahoo Finance API | Stock/crypto price float | Yes (external API → app) | `UserPriceAlertService`, `WatchlistService` | Unchanged — already existed |
| 5 | Background job | Trigger condition evaluation | No | Notification system | Alert evaluation logic unchanged |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| App → PostgreSQL | DB queries | GORM parameterized queries, no user input in query path |
| Internet → App | Yahoo Finance response | Existing validation in `MarketDataService` (unchanged) |
| Internal scheduler → Notification | Alert triggers | Existing validation in `UserPriceAlertService` (unchanged) |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1-3 | App → DB | Tampering | Stale/wrong DB prices trigger wrong alerts | Low | `IsStale` flag exposed; alert logic should treat stale prices as missing (no trigger) |
| T-2 | 1-3 | App → DB | Denial of Service | DB unavailable → alerts/watchlist fail | Low | Same failure mode as live API unavailability today; no change in risk posture |
| T-3 | 4 | Internet → App | Spoofing | Yahoo Finance returns manipulated prices | Low | Unchanged existing risk; MarketDataService validates format |

### Authorization Rules

No change — price data is non-user-specific. Alert evaluation is already authorized at the user level (`userID` ownership checks unchanged).

### Input Validation Rules

No new inputs introduced. `typeCode` for DB lookup comes from the alert model (stored by the service, not user-input at lookup time).

### External Dependency Risks

- `asset_price` table: if empty (cold-start before first `PriceCacheJob` run), all three services
  will return empty slices — same behavior as a live API failure today (graceful degradation).
- Yahoo Finance: unchanged dependency for stock/crypto prices.

### Sensitive Data Handling

Price data is not user-PII. No exposure risk change.

### Issues & Risks Summary

1. **Stale data on cold start (10s delay)**: Alert evaluation and watchlist will return no gold/silver/currency prices until first `PriceCacheJob` run. Acceptable — same behavior as live API timeout today.
2. **IsStale flag handling in alerts**: If the DB has stale entries, alerts comparing against stale prices could give inaccurate trigger results. Mitigation: treat `IsStale == true` as price-not-available (return 0) in alert path.
3. **PriceAlertService test refactoring**: Tests mock `GoldPriceService`/`SilverPriceService`; they must be updated to mock `AssetPriceService` instead. Risk of accidentally leaving old mocks.

---

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| `asset_price` DB empty (cold start) | `GetAllPrices` returns empty slices; services log warning and skip processing |
| All rows have `IsStale = true` | Alert path: treat as 0 (no price); watchlist: serve stale price (display-level) |
| `GetPriceByTypeCode` returns not-found | `fetchCurrentPrice` returns 0 (non-fatal, same as live API failure today) |
| DB query error | Return error, services log and skip (non-fatal for alert/watchlist paths) |
| Yahoo Finance still fails | Unchanged behavior (per-item market price missing from watchlist/alert) |

---

## Dependencies & Assumptions

- `PriceCacheJob` is running and has populated `asset_price` table before alert evaluation first runs (10s startup delay → 15m refresh interval, so at most 15m of empty prices on first deploy).
- `AssetPriceService` is already wired in `services.go` and `providers.go` — it just needs to be passed to the additional constructors.
- No proto or frontend changes required.

---

## Out of Scope

- Migrating `MarketDataService.GetPrice` (Yahoo Finance) to a DB cache — that's a separate feature.
- Migrating `InvestmentService.UpdatePrices` or `PriceUpdateJob` — those are investment PNL jobs, not market display jobs.
- Adding FX rate DB cache — `FXRateService` already has its own DB-backed pattern.
- Changing alert trigger logic or watchlist display logic — pure price-source swap only.
