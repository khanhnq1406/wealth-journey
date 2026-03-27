# Remove Gold Waterfall — Direct Source Parallelism Specification

## Summary

The current `RefreshAllPrices` runs 7 goroutines: one "waterfall" goroutine for gold (tries VangSaiGon → VangToday → BTMC → Mihong in priority order, returns on first success, stores with `source="waterfall"`) plus 4 direct per-source goroutines (SJC, DOJI, BTMC, PNJ) plus silver and currency. The waterfall approach means only one gold source's data is ever stored per cycle — if VangSaiGon succeeds, VangToday data is never fetched or stored.

The new design **removes the waterfall goroutine entirely** and replaces it with two independent direct-source goroutines: one for VangSaiGon (`pkg/vnprice`) and one for VangToday (`pkg/vangtoday`). Each source runs in parallel, fetches independently, and upserts its own rows with its own `source` value. One source failing does not prevent the other from storing its data.

This is a backend-only change. No API, proto, or frontend changes are needed.

## Original Feature Reference

- Original spec: `docs/specs/2026-03-26-multi-source-gold-price-spec.md`
- Original plan: `docs/plans/2026-03-26-multi-source-gold-price-plan.md`
- Original report: `docs/reports/2026-03-26-multi-source-gold-price-report.md`

## Issues to Fix

| # | Issue | Severity |
|---|-------|----------|
| 1 | Gold waterfall goroutine prevents parallel independent fetch from VangSaiGon and VangToday | Architectural |
| 2 | Only one gold source's data stored per 15-minute cycle (first waterfall success wins) | Functional |
| 3 | `source="waterfall"` rows in DB — semantically meaningless, masks which API actually provided the data | Data quality |

## Root Cause Analysis

The waterfall pattern was designed for Redis cache fallback — if VangSaiGon fails, fall back to VangToday, return the first good result. This is correct for real-time per-request price lookups. But for the DB cache job, which stores ALL prices for all sources, the waterfall pattern discards data from healthy sources that weren't first in priority order. VangToday and VangSaiGon carry different TypeCodes and price data that should be independently preserved.

## User Stories

- As a user, I want to see gold prices from VangSaiGon and VangToday independently, so that if one API goes down I still see the other's data
- As an operator, I want the price cache logs to clearly identify which source provided each set of prices, with no ambiguous `source="waterfall"` label

## Functional Requirements

### FR-1: Remove Gold Waterfall Goroutine

Remove the `refreshGold` method and its corresponding goroutine from `RefreshAllPrices`. Remove the `goldSvc GoldPriceService` dependency from `assetPriceService` for the cache job path.

**Note:** `goldSvc` is still needed by investment portfolio services for `FetchPriceForSymbol` lookups — it must NOT be deleted from the codebase. Only the `refreshGold` goroutine in the price cache job is removed.

**Acceptance criteria:**
- [ ] `refreshGold()` method removed from `asset_price_service.go`
- [ ] `RefreshAllPrices` no longer spawns a waterfall gold goroutine
- [ ] `goldSvc GoldPriceService` field removed from `assetPriceService` struct
- [ ] No rows with `source="waterfall"` and `asset_type="gold"` are inserted after this change

### FR-2: Add Direct VangSaiGon Gold Goroutine

Add `refreshGoldVangSaiGon` method that calls `vangSaiGonGoldFetcher.FetchGoldPrices()` directly, normalizes TypeCodes via `gold.AliasToCanonical`, and upserts with `source="vangsaigon"`.

**TypeCode normalization:** VangSaiGon returns raw names (e.g., `"SJC"`, `"Vàng nhẫn DOJI"`). Apply `gold.AliasToCanonical` mapping the same way the old waterfall did, so canonical codes (e.g., `"SJC"`, `"DOJI"`) are stored.

**Acceptance criteria:**
- [ ] `refreshGoldVangSaiGon()` added to `asset_price_service.go`
- [ ] Prices upserted with `source="vangsaigon"`, `asset_type="gold"`, `IsStale=false`
- [ ] TypeCodes normalized via `gold.AliasToCanonical` (alias → canonical)
- [ ] On fetch failure: `MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")`
- [ ] Goroutine log tag: `gold_vangsaigon=OK(N)` or `gold_vangsaigon=FAIL(...)`

### FR-3: Add Direct VangToday Gold Goroutine

Add `refreshGoldVangToday` method that calls `vangTodayGoldFetcher.FetchGoldPrices()` directly and upserts with `source="vangtoday"`.

**TypeCode normalization:** VangToday already returns canonical TypeCodes (field-copy in existing fetcher). No alias normalization needed.

**Acceptance criteria:**
- [ ] `refreshGoldVangToday()` added to `asset_price_service.go`
- [ ] Prices upserted with `source="vangtoday"`, `asset_type="gold"`, `IsStale=false`
- [ ] On fetch failure: `MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")`
- [ ] Goroutine log tag: `gold_vangtoday=OK(N)` or `gold_vangtoday=FAIL(...)`

### FR-4: Update assetPriceService Constructor

Replace `goldSvc GoldPriceService` field with `vangSaiGonFetcher GoldPriceFetcher` and `vangTodayFetcher GoldPriceFetcher` in the `assetPriceService` struct and `NewAssetPriceService` constructor.

**Acceptance criteria:**
- [ ] `assetPriceService` struct has `vangSaiGonFetcher GoldPriceFetcher` and `vangTodayFetcher GoldPriceFetcher` fields
- [ ] `NewAssetPriceService` signature updated accordingly
- [ ] `services.go` passes `NewVangSaiGonGoldFetcher(timeout)` and `NewVangTodayGoldFetcher(timeout)` when constructing `assetPriceService`
- [ ] `goldSvc` removed from the constructor call in `services.go`

### FR-5: Update RefreshAllPrices Goroutine Count

`RefreshAllPrices` changes from 7 to 8 goroutines: remove 1 waterfall gold goroutine, add 2 new direct gold goroutines (VangSaiGon, VangToday). The all-fail threshold updates to 8.

**Goroutine set after change:**
1. `gold_vangsaigon` — VangSaiGon gold direct
2. `gold_vangtoday` — VangToday gold direct
3. `gold_sjc` — SJC direct (unchanged)
4. `gold_doji` — DOJI direct (unchanged)
5. `gold_btmc` — BTMC direct (unchanged)
6. `gold_pnj` — PNJ direct (unchanged)
7. `silver_waterfall` — silver (unchanged)
8. `currency_waterfall` — currency (unchanged)

**Acceptance criteria:**
- [ ] `RefreshAllPrices` spawns exactly 8 goroutines
- [ ] Channel buffer size = 8
- [ ] `failCount == 8` check for all-fail error return
- [ ] Log format still `"[assetPriceService] Price cache job completed: ..."`

### FR-6: Update Tests

Update `asset_price_service_test.go` to match the new constructor signature and add tests for the two new goroutines.

**Acceptance criteria:**
- [ ] All existing `NewAssetPriceService(...)` calls updated to pass `vangSaiGonFetcher` and `vangTodayFetcher` instead of `goldSvc`
- [ ] New test: `TestRefreshAllPrices_VangSaiGonSuccess` — verifies rows upserted with `source="vangsaigon"` and canonical TypeCodes
- [ ] New test: `TestRefreshAllPrices_VangTodaySuccess` — verifies rows upserted with `source="vangtoday"`
- [ ] New test: `TestRefreshAllPrices_VangSaiGonFail` — verifies stale marked for `"vangsaigon"`, other sources unaffected
- [ ] New test: `TestRefreshAllPrices_VangTodayFail` — verifies stale marked for `"vangtoday"`, other sources unaffected
- [ ] Existing `mockGoldPriceService` mock removed (no longer needed) or kept if any other test still uses it
- [ ] Add `mockGoldPriceFetcher` that implements `GoldPriceFetcher` interface

### FR-7: Update Architecture Documentation

Update `flow-cross-cutting.md` Section 13 to reflect 8 goroutines and remove `gold_waterfall` from the diagram.

**Acceptance criteria:**
- [ ] Section 13 diagram shows `gold_vangsaigon` and `gold_vangtoday` parallel participants
- [ ] `gold_waterfall` participant and its `par` block removed
- [ ] Error path table updated (remove waterfall row, add vangsaigon/vangtoday rows)
- [ ] goroutine count updated from 7 to 8 in prose

## Non-Functional Requirements

- Performance: 8 goroutines still all parallel — no latency regression
- Backward compatibility: existing rows with `source="waterfall"` remain in DB (they become stale on next cycle when not refreshed)
- No DB migration needed: 3-column unique index `(type_code, currency, source)` already supports any source string value

## Architecture Changes (C4)

### Diagrams to Update

- `flow-cross-cutting.md` Section 13: remove `GoldPriceService (waterfall)` participant, add `VangSaiGonFetcher` and `VangTodayFetcher` participants; update goroutine count from 7 to 8
- `c4-component-backend.md`: update `AssetPriceService` component description to remove reference to `GoldPriceService` as a dependency for the cache job

### New Diagrams

None needed.

## Data Model Changes

No schema changes. The `source` column already accepts any string. New source values `"vangsaigon"` and `"vangtoday"` are stored without migration.

**Note on stale waterfall rows:** Existing rows with `source="waterfall"` and `asset_type="gold"` will NOT be refreshed after this change. They will remain in the DB with their last values. After the next `RefreshAllPrices` cycle they will not be marked stale (since there is no `MarkStaleByAssetTypeAndSource(ctx, "gold", "waterfall")` call). A one-time cleanup migration or leaving them to persist are both acceptable — the frontend displays `"--"` only when `isStale=true`, and these waterfall rows will never be stale-flagged (just never updated). A follow-up `cmd/migrate-remove-waterfall-gold/main.go` can DELETE these rows. **This migration is out of scope of the current change but should be tracked.**

## API Changes

None. The `GetMarketPrices` and `GetPublicMarketTypes` handlers read from DB unchanged.

## UI/UX Changes

None. Frontend behavior unchanged — it reads `buy/sell/isStale` from the DB cache. The new `source` values are not exposed to the frontend.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | VangSaiGon API (vangsaigon.vn) | Gold prices (float64) | Yes: Internet → Backend | `asset_price` DB table | External public API |
| 2 | VangToday API (vang.today) | Gold prices (int64, already normalized) | Yes: Internet → Backend | `asset_price` DB table | External public API |
| 3 | `asset_price` DB table | Prices | Internal | HTTP handlers → Frontend | No boundary crossing, internal only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Backend | VangSaiGon/VangToday HTTP responses | Context timeout (5s), 1MB response cap, SanitizeTypeCode |
| Backend → DB | GORM `UpsertBatch` | Parameterized queries, no raw SQL |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1, 2 | Internet → Backend | Tampering | Malicious price data from compromised API | Low | Prices are display-only; `int64` prevents float injection; buy/sell <= 0 filtered |
| T-2 | 1, 2 | Internet → Backend | DoS | Slow API holds goroutine indefinitely | Low | `context.WithTimeout` (5s) on each fetch call |
| T-3 | 1 | Internet → Backend | Tampering | Injection via TypeCode name containing SQL/special chars | Low | `gold.SanitizeTypeCode` strips all non-alphanumeric; GORM parameterized queries |

### Authorization Rules

No authorization change — price refresh is a background job with no user context.

### Input Validation Rules

- TypeCodes from VangSaiGon: sanitized via `gold.AliasToCanonical` + already-valid canonical strings
- TypeCodes from VangToday: already canonical, no extra sanitization needed
- Buy/Sell prices: skip if both <= 0 (same guard as SJC/DOJI/BTMC/PNJ)

### External Dependency Risks

| API | Risk | Mitigation |
|-----|------|-----------|
| vangsaigon.vn | Slow / down | 5s timeout, failure marks `vangsaigon` stale, other 7 sources unaffected |
| vang.today | Slow / down | 5s timeout, failure marks `vangtoday` stale, other 7 sources unaffected |

### Issues & Risks Summary

1. Existing `source="waterfall"` gold rows remain in DB indefinitely (never updated, never stale-flagged). They add noise. Recommend a follow-up DELETE migration.
2. VangSaiGon and VangToday may return overlapping TypeCodes (e.g., both return `"SJC"`). Since they have different `source` values, the 3-column unique index handles this correctly — no collision.
3. `goldSvc GoldPriceService` is removed from `assetPriceService` constructor — but `GoldPriceService` is still used elsewhere (`MarketDataService`, `FetchPriceForSymbol` for investment portfolio). Ensure no other service reads `goldSvc` from `assetPriceService`.

## Edge Cases & Error Handling

- **Both VangSaiGon and VangToday fail:** Both goroutines mark stale independently; other 6 sources unaffected; only if all 8 fail does `RefreshAllPrices` return error
- **VangSaiGon returns empty prices (no gold types):** Same guard as other clients — `if len(batch) == 0`: mark stale, return error result
- **TypeCode alias normalization for VangSaiGon:** Apply `gold.AliasToCanonical` map after building the batch (same as old waterfall code did in `price_fetcher.go`)
- **Nil fetcher:** `if s.vangSaiGonFetcher == nil` → mark stale, return error result (same guard as SJC/DOJI/BTMC/PNJ nil-client check)

## Dependencies & Assumptions

- `GoldPriceFetcher` interface already exists in `price_fetcher.go` — VangSaiGon and VangToday fetchers already implement it
- `gold.AliasToCanonical` map already exists in `pkg/gold/types.go`
- No new packages needed — reuse existing fetchers in service layer
- `MarkStaleByAssetTypeAndSource` already exists in repository

## Out of Scope

- Removing `GoldPriceService` / waterfall from the codebase (still needed for investment portfolio symbol lookups)
- Silver or currency waterfall changes
- Mihong fetcher as an independent direct source (can be a follow-up)
- Frontend changes
- Proto changes
- Cleaning up old `source="waterfall"` rows (follow-up migration)
