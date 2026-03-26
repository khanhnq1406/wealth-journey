# Gold Canonical TypeCode Normalization — Implementation Report

## Metadata

- **Feature:** Gold Canonical TypeCode Normalization
- **Spec:** `docs/specs/2026-03-26-gold-canonical-typecode-spec.md`
- **Plan:** `docs/plans/2026-03-26-gold-canonical-typecode-plan.md`
- **Branch:** `feat/price-fallback`
- **Completed:** 2026-03-26
- **Commits:** `62f55b8`, `6caf556`, `79335cc`

## Problem Summary

External gold price APIs return different TypeCode strings for the same physical product:
- **vangsaigon.vn**: uses canonical codes matching `pkg/gold/types.go` (e.g., `SJC`, `Doji`, `BTMC`)
- **vang.today**: returns uppercase alias codes (e.g., `VNGSJC`, `DOHN`, `DOHCM`, `BTSJC`, `BT9999`, `VIETTINM`)

Without normalization, the `asset_price` DB table would contain inconsistent TypeCodes depending on which source was active during the last cache refresh cycle. This caused silent mismatches in portfolio valuation, price alerts, and frontend filtering.

## Changes Made

### Task 1 — `pkg/gold/types.go` (commit `62f55b8`)

Added exported `AliasToCanonical map[string]string` with 9 entries:

| Alias | Canonical |
|-------|-----------|
| `VNGSJC` | `SJC` |
| `SJL1L10` | `SJC` |
| `SJ9999` | `Vàng nhẫn SJC` |
| `MIHONG_999` | `Mihong_999` |
| `DOHN` | `Doji` |
| `DOHCM` | `Doji` |
| `BTSJC` | `BTMC` |
| `BT9999` | `BTMC_24K` |
| `VIETTINM` | `VietinGold` |

Added 2 tests in `pkg/gold/types_test.go`:
- `TestAliasToCanonical_AllTargetsExistInGoldTypes` — structural: all canonical targets must exist in `GoldTypes`
- `TestAliasToCanonical_KnownMappings` — 9 specific alias→canonical pairs

### Task 2 — `domain/service/price_fetcher.go` (commit `6caf556`)

- Deleted private `aliasToCanonical` var (was incomplete 4-entry map)
- Added `import "wealthjourney/pkg/gold"`
- `FetchGoldPrices` (waterfall single-source): added normalization loop after successful fetch
- `FetchGoldPricesAllSources` (all-sources merge): replaced private map lookup with `gold.AliasToCanonical`
- Added test `TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias` in `price_fetcher_test.go`

### Task 3 — `domain/service/asset_price_service.go` (commit `6caf556`)

- Removed `import "wealthjourney/pkg/gold"` (no longer needed)
- Removed alias normalization loop from `refreshGold` — normalization now happens upstream at the waterfall layer
- Kept first-wins deduplication for canonical codes (still needed when two sources return the same canonical code)
- Updated `TestAssetPriceService_RefreshGold_NormalizesAliasCodes` → renamed to `TestAssetPriceService_RefreshGold_DeduplicatesCanonicalCodes` and updated inputs to canonical codes (matching new layer contract)

### Task 4 — `docs/architecture/flow-cross-cutting.md` (commit `79335cc`)

- Section 13 sequence diagram: added normalization note on `GPS` node
- Section 13 Key Invariants: added alias normalization boundary invariant
- FetchPriceForSymbol section: updated alias map table to 9 entries; changed source reference from `price_fetcher.go` private var to `pkg/gold/types.go`
- Updated Key Invariants for FetchPriceForSymbol: both `FetchGoldPrices` and `FetchGoldPricesAllSources` normalize; alias map lives in `pkg/gold/types.go`

## Architecture After This Fix

```
vang.today API ──► WaterfallGoldFetcher.FetchGoldPrices()
                         │ gold.AliasToCanonical lookup
                         ▼ (canonical TypeCodes only)
                   GoldPriceService.FetchAllPrices()
                         │ (aggregate cache hit → bypass waterfall)
                         ▼
                   AssetPriceService.refreshGold()
                         │ deduplicate canonical codes (first-wins)
                         ▼
                   AssetPriceRepository.UpsertBatch()
                         │
                         ▼
                   asset_price table (always canonical TypeCodes)
```

Normalization happens **exactly once**, at the trust boundary where external data enters the service layer.

## Test Results

```
ok  wealthjourney/domain/service   1.541s
ok  wealthjourney/pkg/gold         1.324s
```

All 30 `pkg/gold` tests + all `domain/service` tests pass.

## Non-Functional Notes

- **No DB migration**: existing rows with alias TypeCodes will be overwritten on next `PriceCacheJob` run via `ON CONFLICT DO UPDATE`
- **No proto/API changes**: purely internal backend normalization
- **No frontend changes**: frontend already uses canonical codes for filtering
- **Performance**: O(1) map lookup — no measurable impact
