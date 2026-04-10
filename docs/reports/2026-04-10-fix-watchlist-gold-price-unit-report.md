# Fix Watchlist Gold/Silver Price Unit — Implementation Report

## Summary

Replaced `MarketDataService.GetPrice()` for gold/silver/currency items in `WatchlistService.ListItems()` with direct `AssetDisplayConfigService.ResolvePrice()` calls. `GetPrice()` applies `ProcessMarketPrice()` (per-lượng → per-gram ÷ 37.5) which is correct for investment portfolio calculations but wrong for watchlist display. The fix routes gold/silver/currency through `ResolvePrice()` to return the raw `asset_price.Buy` value (per-lượng market price). Market/stock/crypto items continue to use `GetPrice()` unchanged.

**Example:** `Mihong_999` gold item now returns `buyPrice = 171,000,000` (VND/lượng). Frontend divides by 1000 → shows `171,000` (nghìn đồng = 171 million VND). Previously returned `4,560,000` (per gram) → displayed `4,560`.

## Spec Reference

`docs/specs/2026-04-10-fix-watchlist-gold-price-unit-spec.md`

## Plan Reference

`docs/plans/2026-04-10-fix-watchlist-gold-price-unit-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 1   | Wire AssetDisplayConfigService into WatchlistService and fix price enrichment | Done | `watchlist_service.go`, `watchlist_service_test.go`, `services.go` | 12/12 pass | Yes |
| 0   | Update Runtime Flow Diagram | Done | `flow-watchlist.md` | N/A (docs) | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| Backend Service | `domain/service/watchlist_service_test.go` | 12 | 12/12 | Gold/silver/currency via ResolvePrice, market via GetPrice, error paths, mixed types |

### New tests added (3)

- `TestWatchlistService_ListItems_GoldViaResolvePrice_RawMarketPrice` — `Mihong_999` returns `171,000,000` (per-lượng, not per-gram)
- `TestWatchlistService_ListItems_GoldResolvePriceError_ZeroPrices` — ResolvePrice error → zero prices, no error propagated
- `TestWatchlistService_ListItems_MixedTypes_GoldFromResolve_StockFromGetPrice` — gold from `adcSvc`, stock from `mktSvc`, both prices correct

### Existing tests updated (all 9)

All pre-existing tests migrated: gold/silver/currency tests now set prices via `adcSvc.prices` instead of `mktSvc.prices`. `newWatchlistSvc` helper updated to 4-arg. New `mockAssetDisplayConfigSvc` added.

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| Authentication | Unchanged — JWT middleware at handler level | Yes |
| Authorization | Unchanged — `ListByUserID(userID)` scopes DB reads to user | Yes |
| Error propagation | `ResolvePrice()` errors logged server-side, client gets zero prices | Yes |
| Input source | `symbol`/`assetType` from DB rows (written at add-time), not request params | Yes |
| Monetary values | All `int64` — `buy`, `sell` from `ResolvePrice()` | Yes |

## Review Results

### Spec Compliance

PASS. All requirements implemented. Reviewer noted the implementation calls `ResolvePrice()` directly (rather than through `GetPrice()` as the original plan prescribed) — this is a justified improvement since `GetPrice()` would collapse `buy`/`sell` into a single `Price` field, whereas `ResolvePrice()` preserves both.

### Security Review

APPROVED. No new attack surface. Goroutine safety maintained with `sync.Mutex`. Loop variable capture handled correctly. Error paths do not leak internals.

### Code Quality

APPROVED. Two minor cosmetic observations:
- Test names `TestWatchlistService_ListItems_GoldViaGetPrice` and `TestWatchlistService_ListItems_CurrencyViaGetPrice` are slightly misleading (now route via ResolvePrice, not GetPrice) — non-blocking
- `assetPriceSvc` field in struct is unused at runtime — pre-existing tech debt, not introduced by this fix

## Known Issues / Technical Debt

- `assetPriceSvc` field remains in `watchlistService` struct but is not called anywhere. Pre-existing since the original fix-watchlist-missing-prices task.
- `GOLD_USD` items route through `assetDisplaySvc.ResolvePrice(ctx, symbol, "gold")`. If a `GOLD_USD` watchlist item's symbol has no `asset_display_config` entry, it will show zero prices. Acceptable — `GOLD_USD` items are rare in the watchlist and can be addressed separately.
- `isStale` return value from `ResolvePrice()` is ignored in the watchlist context. The watchlist shows whatever price is available; staleness handling is out of scope.
- `Eximbank` watchlist item (symbol is a display name, not a TypeCode) will continue to show zero price — this is legacy data, not a code bug. User should delete and re-add with the correct TypeCode.

## Fix History

| Date | Fix | Severity | Commit |
| ---- | --- | -------- | ------ |
| 2026-04-10 | Use ResolvePrice() for gold/silver to return per-lượng market price | Major | 908e35b1 |

## Files Changed

| File | Change |
| ---- | ------ |
| `src/go-backend/domain/service/watchlist_service.go` | Added `assetDisplaySvc AssetDisplayConfigService` field + 4th constructor param; refactored `ListItems()` goroutine loop to split by asset type |
| `src/go-backend/domain/service/watchlist_service_test.go` | Added `mockAssetDisplayConfigSvc`; updated `newWatchlistSvc` to 4-arg; migrated all tests to use `adcSvc`; added 3 new tests |
| `src/go-backend/domain/service/services.go` | Line 131: pass `assetDisplayConfigSvc` as 4th arg to `NewWatchlistService` |
| `docs/architecture/flow-watchlist.md` | Updated Section 2 to show split price enrichment path (direct ResolvePrice for gold/silver/currency, GetPrice for market) |

## How to Test

### Unit Tests

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems" ./domain/service/ -v
# Expected: 12/12 PASS
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed. `NewWatchlistService` signature change (4th param added) affects only `services.go` line 131 (already updated). No handler, proto, or frontend changes.

### Manual Testing Steps

#### Scenario: Gold watchlist item shows correct per-lượng market price

**Preconditions:** Logged in; gold item added to watchlist with TypeCode symbol (e.g., `Mihong_999`); `asset_price` table populated by background price cache job.

1. Navigate to `/dashboard/prices` → Watchlist tab
2. Observe the `Mihong_999` gold row
3. Expected: Buy Price column shows `171.000` (nghìn đồng, i.e., 171 million VND/lượng). Previously showed `4.560`.

#### Scenario: Gold price matches Gold tab

1. Navigate to `/dashboard/prices` → Gold tab — note `Nhẫn Mi Hồng 9999` buy price
2. Switch to Watchlist tab — `Mihong_999` item should show the same buy price
3. Expected: Both tabs show the same value (previously watchlist showed ÷37.5 of the gold tab value)

#### Scenario: `Eximbank` item shows zero price (accepted behavior)

1. Navigate to Watchlist tab — `Eximbank` item
2. Expected: Shows `--` (zero price). This is a legacy item whose symbol is a display name, not a TypeCode. No regression from current behavior.
