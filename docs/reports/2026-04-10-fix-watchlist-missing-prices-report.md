# Fix Watchlist Missing Prices — Implementation Report

## Summary

Replaced the broken TypeCode-keyed lookup maps for gold/silver/currency items in `WatchlistService.ListItems()` with `MarketDataService.GetPrice()` calls — the same path already used by market/stock items. Gold/silver/currency prices were always zero because the old code looked up prices by `item.Symbol` (display name, e.g. "Eximbank") against a map keyed by TypeCode (e.g. "SJCBL"), which never matched. The fix routes all asset types through a single unified goroutine loop, which internally delegates to `AssetDisplayConfigService.ResolvePrice()` for non-market items.

## Spec Reference

`docs/specs/2026-04-10-fix-watchlist-missing-prices-spec.md`

## Plan Reference

`docs/plans/2026-04-10-fix-watchlist-missing-prices-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests    | TDD |
| --- | ---- | ------ | ------------- | -------- | --- |
| 1   | Rewrite ListItems() Price Enrichment Logic | Done | `watchlist_service.go`, `watchlist_service_test.go` | 9/9 pass | Yes |
| 2   | Update Existing Tests to Match New Architecture | Done (completed as part of Task 1) | `watchlist_service_test.go` | 9/9 pass | Yes |
| 0   | Update Runtime Flow Diagram | Done | `flow-watchlist.md` | N/A (docs) | N/A |

## Test Coverage Summary

| Layer              | Test File                                                     | Tests | Pass | Coverage Area                                          |
| ------------------ | ------------------------------------------------------------- | ----- | ---- | ------------------------------------------------------ |
| Backend Service    | `domain/service/watchlist_service_test.go`                    | 9     | 9/9  | Gold/silver/currency/market price enrichment, error paths, mixed types |

### New tests added

- `TestWatchlistService_ListItems_GoldViaGetPrice` — gold item with display-name symbol (not TypeCode) gets price via `GetPrice()`
- `TestWatchlistService_ListItems_CurrencyViaGetPrice` — currency item resolved via `GetPrice()` not TypeCode lookup
- `TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices` — `GetPrice()` error → zero prices, no error returned to caller

### Existing tests updated (5)

All pre-existing tests migrated from `assetSvc.allPrices` mock data to `mktSvc.prices` map.

## Security Implementation Summary

| Concern          | Implementation                                              | Verified |
| ---------------- | ----------------------------------------------------------- | -------- |
| Authentication   | Unchanged — JWT middleware at handler level                 | Yes      |
| Authorization    | Unchanged — `ListByUserID(userID)` scopes DB reads to user  | Yes      |
| Error propagation | `GetPrice()` errors logged server-side, client gets zero prices | Yes |
| Input source     | symbol/assetType from DB rows (written at add-time), not request params | Yes |
| Monetary values  | All `int64` — `md.Price` field, `priceInfo` fields          | Yes      |

## Review Results

### Spec Compliance

PASS across all tasks. All requirements implemented as specified. No over-engineering.

### Security Review

APPROVED. No new attack surface introduced. Error path correctly suppressed from client response.

### Code Quality

APPROVED. Two minor cosmetic observations flagged (residual `emptyAllPrices` scaffolding in tests still present but harmless; one slightly misleading comment in test file) — neither blocked commit.

## Known Issues / Technical Debt

- The `assetPriceSvc` field in `watchlistService` struct is now unused at runtime — all prices flow through `marketDataSvc`. Retained for DI constructor stability. Can be removed in a future cleanup if confirmed no other method needs it.
- `SellPrice` in the watchlist proto response equals `BuyPrice` for all asset types, since `MarketData.Price` is a single value. If buy/sell spread is needed for the watchlist UI, `MarketData` would need `BuyPrice`/`SellPrice` fields added.

## Files Changed

| File | Change |
| ---- | ------ |
| `src/go-backend/domain/service/watchlist_service.go` | Replaced lines 120–234 (type-split enrichment) with unified `GetPrice()` goroutine loop; removed unused `pkg/gold` and `pkg/silver` imports |
| `src/go-backend/domain/service/watchlist_service_test.go` | Added 3 new tests; updated 5 existing tests to use `mktSvc` instead of `assetSvc`; removed 3 unused helper functions |
| `docs/architecture/flow-watchlist.md` | Updated Section 2 to reflect unified architecture (removed GPS/SPS participants, added ADCS/DB, replaced par block with loop) |
| `docs/reports/2026-04-10-fix-watchlist-missing-prices-progress.md` | Progress tracking (all tasks done) |

## How to Test

### Unit & Integration Tests

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems" ./domain/service/ -v
# Expected: 9/9 PASS
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

Changed symbol: `WatchlistService.ListItems()` internal price enrichment logic. No interface changes, no struct changes, no handler changes. The only callers are the existing handler that invokes `ListItems()` — behavior is unchanged at the API level (same response shape, same HTTP endpoint).

### Manual Testing Steps

#### Scenario: Gold watchlist item shows price

**Preconditions:** Logged in as a user; gold item added to watchlist (e.g., a gold type with display name "Eximbank"); asset_price table populated by the background price cache job.

1. Navigate to `/dashboard/watchlist`
2. Observe the gold item row
3. Expected: `Buy Price` column shows a non-zero value (previously showed `--` or `0`)

#### Scenario: Currency watchlist item shows price

**Preconditions:** USD added to watchlist; Vietcombank FX rates cached in asset_price table.

1. Navigate to `/dashboard/watchlist`
2. Observe the USD currency row
3. Expected: Buy price shows the cached VND rate (e.g., 25,800,000 VND)

#### Scenario: GetPrice failure → zero prices, no error

**Preconditions:** asset_price table empty (cold start) or Redis down.

1. Navigate to `/dashboard/watchlist`
2. Expected: Page loads successfully; gold/silver/currency rows show `--` (zero price display), no error toast or API error

#### Scenario: Mixed watchlist (gold + stock)

**Preconditions:** Both a gold item and a stock (e.g., AAPL) added to watchlist.

1. Navigate to `/dashboard/watchlist`
2. Expected: Both items show prices — gold from DB cache, stock from Yahoo Finance
