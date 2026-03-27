# Remove Gold Waterfall — Implementation Report

## Metadata

- **Feature:** Remove Gold Waterfall — Direct Source Parallelism
- **Spec file:** `docs/specs/2026-03-27-remove-gold-waterfall-spec.md`
- **Plan file:** `docs/plans/2026-03-27-remove-gold-waterfall-plan.md`
- **Branch:** `feat/price-fallback`
- **Completed:** 2026-03-27T10:20:00Z
- **Status:** COMPLETE

## Summary

Removed the waterfall gold goroutine from `assetPriceService.RefreshAllPrices`. VangSaiGon and VangToday now run as two independent, parallel goroutines — identical in pattern to SJC, DOJI, BTMC, and PNJ. Each fetches independently, writes its own source-tagged rows to the `asset_price` DB table, and marks only its own rows stale on failure. Total goroutines: 6 gold (VangSaiGon, VangToday, SJC, DOJI, BTMC, PNJ) + 1 silver + 1 currency = **8**.

## Changes

### `domain/service/asset_price_service.go`

- **Struct**: removed `goldSvc GoldPriceService`, added `vangSaiGonFetcher GoldPriceFetcher` + `vangTodayFetcher GoldPriceFetcher`
- **Constructor** `NewAssetPriceService`: signature updated to 9 args (removed `goldSvc`, added two fetchers)
- **`RefreshAllPrices`**: channel buffer 7→8; goroutine count updated; waterfall `go refreshGold()` call removed; two new goroutines wired:
  ```go
  go func() { defer wg.Done(); results <- s.refreshGoldVangSaiGon(ctx) }()
  go func() { defer wg.Done(); results <- s.refreshGoldVangToday(ctx) }()
  ```
- **`refreshGold` (waterfall)**: removed entirely
- **`refreshGoldVangSaiGon`** (new): nil-guard → fetch via `vangSaiGonFetcher` → normalize TypeCodes via `gold.AliasToCanonical` → skip prices with buy≤0&&sell≤0 → upsert with `source="vangsaigon"` → mark stale on any failure
- **`refreshGoldVangToday`** (new): nil-guard → fetch via `vangTodayFetcher` → skip prices with buy≤0&&sell≤0 → upsert with `source="vangtoday"` → mark stale on any failure
- **Import added**: `"wealthjourney/pkg/gold"` for `gold.AliasToCanonical`

### `domain/service/asset_price_service_test.go`

- Added `mockSimpleGoldPriceFetcher` struct (named "Simple" to avoid collision with testify/mock-based `mockGoldPriceFetcher` in `price_fetcher_test.go`, same package)
- Removed unused `mockGoldPriceSvc` struct and `keys` helper function (lint requirement)
- All `NewAssetPriceService` call sites updated to 9-arg signature
- Removed `TestRefreshGold_SetsSourceWaterfall` (waterfall gone)
- Replaced `TestAssetPriceService_RefreshGold_DeduplicatesCanonicalCodes` with `TestAssetPriceService_RefreshGoldVangSaiGon_AliasNormalization`
- Updated `TestRefreshAllPrices_AllFailIncludingNilClients`, `TestRefreshAllPrices_IncludesNewSources`, `TestRefreshAllPrices_SourceFailureIndependent` for 8-goroutine model
- Added 4 new TDD tests (written first, red→green via implementation):
  - `TestRefreshAllPrices_VangSaiGonSuccess`
  - `TestRefreshAllPrices_VangTodaySuccess`
  - `TestRefreshAllPrices_VangSaiGonFail_MarksStale`
  - `TestRefreshAllPrices_VangSaiGonEmptyPrices_MarksStale`

### `domain/service/services.go`

- `NewAssetPriceService` call updated: removed `goldPriceSvc` arg, added `NewVangSaiGonGoldFetcher(waterfallSourceTimeout)` and `NewVangTodayGoldFetcher(waterfallSourceTimeout)`
- `goldPriceSvc` preserved: still used by `NewMarketDataService(repos.MarketData, goldPriceSvc, silverPriceSvc)` for per-symbol investment portfolio lookups

### `docs/architecture/flow-cross-cutting.md`

- Section 13 only; sections 1–12, 14, 15 untouched
- Removed `GPS as GoldPriceService<br/>(waterfall)` participant
- Added `VSG as VangSaiGonFetcher` and `VT as VangTodayFetcher` participants
- Replaced waterfall `par` block with two new `par` sub-blocks (VangSaiGon + VangToday)
- Updated error paths table: removed waterfall row, added VangSaiGon and VangToday rows
- Updated goroutine count 7→8, key invariants, TypeCode normalization note

## CI Results

| Check | Result |
|-------|--------|
| `golangci-lint` | ✅ 0 issues |
| `go build ./...` | ✅ Clean |
| `go test -short ./domain/service/ -run TestRefreshAllPrices_Vang` (4 new tests) | ✅ PASS |
| `go test -short ./...` (full suite) | ✅ All packages `ok` |

## Design Decisions

- **TypeCode normalization (VangSaiGon only)**: VangSaiGon returns raw alias TypeCodes; `refreshGoldVangSaiGon` applies `gold.AliasToCanonical` per entry. VangToday already returns canonical codes. Dedup is handled by the DB's 3-column unique index `(type_code, source, currency)` — no in-memory dedup needed per source.
- **Stale marking scope**: Each source marks only its own rows stale via `MarkStaleByAssetTypeAndSource`. A VangSaiGon failure does not affect VangToday rows, and vice versa.
- **`goldSvc` preservation**: The waterfall `GoldPriceService` is still used by `MarketDataService.FetchPriceForSymbol` for live investment portfolio lookups. Removing it from `assetPriceService` only removes the old redundant DB-cache write path via the waterfall.
- **Old `source="waterfall"` DB rows**: Will persist but never be updated again. Per spec, a cleanup migration is out of scope and acceptable.
- **`mockSimpleGoldPriceFetcher` naming**: Named explicitly to avoid a duplicate symbol declaration with `mockGoldPriceFetcher` (testify/mock-based) in `price_fetcher_test.go` in the same `service` package.
