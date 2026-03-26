# Multi-Source Gold Price Collection — Implementation Report

## Metadata

- **Feature:** Multi-Source Gold Price Collection
- **Spec:** `docs/specs/2026-03-26-multi-source-gold-price-spec.md`
- **Plan:** `docs/plans/2026-03-26-multi-source-gold-price-plan.md`
- **Branch:** `feat/price-fallback`
- **Status:** Complete
- **Completed:** 2026-03-26

## Summary

Implemented direct gold price collection from 4 Vietnamese gold market sources (SJC, DOJI, BTMC, PNJ) in addition to the existing waterfall fetcher. The `AssetPriceService.RefreshAllPrices` now runs 7 parallel goroutines and stores per-source price rows with a 3-column unique index `(type_code, currency, source)`. Source failures are independent — one source going down does not stale another's rows.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 0 | da7139f | C4 diagrams: 4 new client components + 4 external gold price systems |
| 1 | eff5a89 | DB schema: 3-column unique index (type_code, currency, source); UpsertBatch updated |
| 2 | 100c89a | MarkStaleByAssetTypeAndSource — source-granular stale marking |
| 3 | dd26f58 | Set source="waterfall" in refreshGold/Silver/Currency |
| 4-7 | 765ad9c | SJC, DOJI, BTMC, PNJ client packages |
| 8 | ee7bbaf | Shared SanitizeTypeCode utility |
| 9 | 422e0cd | Integrate 4 sources into AssetPriceService (7-goroutine channel design) |
| 10+11 | f2885e3 | Wire real clients into DI; no-regression verification |
| 13 | 4f13565 | Fix: remove unused mock types; ci:backend-lint passes clean |
| 14 | 46f1b97 | Update flow-cross-cutting.md Section 13 for 7-source diagram |

## Architecture

### Before

- `RefreshAllPrices` ran 3 goroutines (waterfall gold, silver, currency)
- `asset_price` unique index: `(type_code, currency)`
- Stale marking: `MarkStaleByAssetType(ctx, assetType)` — marks all rows of a type

### After

- `RefreshAllPrices` runs 7 goroutines: waterfall gold + SJC + DOJI + BTMC + PNJ + silver + currency
- `asset_price` unique index: `(type_code, currency, source)` — 3-column
- Stale marking: `MarkStaleByAssetTypeAndSource(ctx, assetType, source)` — per-source granularity
- Error threshold: returns error only when all 7 sources fail simultaneously

### TypeCode Namespacing

- Waterfall codes: canonical (`SJC`, `DOJI`, `XAU`, etc.)
- Per-source direct codes: source-prefixed (`SJC_1L10L1KG`, `DOJI_NHANVANG`, `BTMC_SJCBAR`, `PNJ_NHANVANG`)
- No collision possible — the `source` column is part of the unique key

### Client Packages

| Package | Source | Multiplier | TypeCode prefix |
|---------|--------|------------|-----------------|
| `pkg/sjc` | JSON API (sjc.com.vn) | float64→int64 direct | `SJC_` |
| `pkg/doji` | HTML scraper (doji.com.vn) | ×1,000,000 | `DOJI_` |
| `pkg/btmcdirect` | HTML scraper (btmc.com.vn) | ×1,000 | `BTMC_` |
| `pkg/pnj` | JSON API (pnj.com.vn) | ×1,000 (TPHCM region) | `PNJ_` |

All clients use `SanitizeTypeCode(prefix, rawName)` from `pkg/gold` — strips diacritics, uppercase alphanumeric, max 50 chars.

## Test Coverage

- Each client package has its own `_test.go` — happy path, error paths, filtering, deduplication, sanitization, context cancellation, timeout
- `asset_price_service_test.go` updated: all `NewAssetPriceService` calls pass 8 params; 3 new tests for parallel source behavior
- `TestGetPriceByTypeCode_NoCollisionWithSourcePrefixedCodes` verifies exact-match semantics (waterfall codes only match waterfall rows)

## CI Results

- `task ci:backend-lint`: **0 issues**, build passes
- `go test -short ./...`: **all packages pass**

## Files Changed

### New Files

- `src/go-backend/pkg/sjc/client.go` + `client_test.go`
- `src/go-backend/pkg/doji/client.go` + `client_test.go`
- `src/go-backend/pkg/btmcdirect/client.go` + `client_test.go`
- `src/go-backend/pkg/pnj/client.go` + `client_test.go`
- `src/go-backend/cmd/migrate-multi-source/main.go`

### Modified Files

- `src/go-backend/domain/models/asset_price.go` — added `Source string` field
- `src/go-backend/domain/repository/asset_price_repository.go` — `MarkStaleByAssetTypeAndSource`; UpsertBatch with 3-column conflict
- `src/go-backend/domain/service/asset_price_service.go` — 7-goroutine design; 4 new client fields; 4 new refresh methods
- `src/go-backend/domain/service/asset_price_service_test.go` — updated constructor calls; new tests
- `src/go-backend/domain/service/services.go` — wired real sjc/doji/btmc/pnj clients
- `src/go-backend/pkg/gold/types.go` — `SanitizeTypeCode` + `AliasToCanonical` map
- `docs/architecture/c4-container.md` — 4 new client components + 4 external gold systems
- `docs/architecture/c4-component-backend.md` — matching component updates
- `docs/architecture/flow-cross-cutting.md` — Section 13 updated for 7-source parallel diagram

## Fix History

| Date       | Fix                                                                 | Severity | Action |
| ---------- | ------------------------------------------------------------------- | -------- | ------ |
| 2026-03-26 | DB schema mismatch: `migrate-multi-source` not applied to local DB — run `task backend:migrate-multi-source` | Minor | Runbook — no code change needed |
| 2026-03-26 | PNJ: `no regions in response` — empty regions treated as error instead of "no data" | Minor | `pkg/pnj/client.go`: return `[]*GoldPrice{}, nil` when no region; `pkg/pnj/client_test.go`: updated `TestFetchGoldPrices_EmptyRegions` + added `TestFetchGoldPrices_NullRegions` |
| 2026-03-26 | SJC: `context deadline exceeded` — 5s timeout too short for sjc.com.vn response latency | Minor | `pkg/sjc/client.go`: increase `requestTimeout` 5s → 15s; update `NewClient` doc comment |

### Fix Details: PNJ — `no regions in response`

**Symptom:** `gold_pnj=FAIL(pnj: no regions in response)` in price cache job log.

**Root cause:** The PNJ API at `edge-cf-api.pnj.io` returned an HTTP 200 response with an empty `regions` array (or omitted the field entirely). The original code treated `selectRegion() == nil` as a hard error. This is too strict — PNJ legitimately returns no regions during off-hours or maintenance windows.

**Fix:** `pkg/pnj/client.go` — when `selectRegion()` returns nil, return `[]*GoldPrice{}, nil` instead of `fmt.Errorf("pnj: no regions in response")`. The asset price service already handles empty slices by calling `MarkStaleByAssetTypeAndSource` and returning `err: fmt.Errorf("pnj: no valid prices")`, so stale behavior is preserved. The log now shows `gold_pnj=FAIL(pnj: no valid prices)` in this case.

**Tests:** `TestFetchGoldPrices_EmptyRegions` updated (was asserting error, now asserts empty slice + nil error); `TestFetchGoldPrices_NullRegions` added.

---

### Fix Details: SJC — `context deadline exceeded`

**Symptom:** `gold_sjc=FAIL(sjc: fetch: Get "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx?LocationId=2&method=AllBranch": context deadline exceeded (Client.Timeout exceeded while awaiting headers))`.

**Root cause:** The SJC client had a 5-second `requestTimeout`. The `sjc.com.vn` endpoint is slow to respond and frequently exceeds 5 seconds before returning headers, causing every request to fail.

**Fix:** `pkg/sjc/client.go` — increase `requestTimeout` constant from `5 * time.Second` to `15 * time.Second`. The caller's context still provides an upper bound; the client timeout is now a harder cap at 15s. Also updated the stale `NewClient()` doc comment from "5-second" to "15-second".

---

### Fix Details: SQLSTATE 42P10 — ON CONFLICT constraint mismatch

**Symptom:** `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification (SQLSTATE 42P10)` — all gold/silver/waterfall upserts fail, all asset prices marked stale.

**Root cause:** The `migrate-asset-prices` migration was run against the DB, creating the table with the old 2-column unique index `(type_code, currency)`. The multi-source feature changed the unique key to 3 columns `(type_code, currency, source)` and wrote `cmd/migrate-multi-source/main.go` to perform the transition. However, `task backend:migrate-multi-source` was never executed on this database instance. The upsert code does `ON CONFLICT ("type_code", "currency", "source")` which requires the 3-column constraint to exist — PostgreSQL rejects the statement with 42P10 when it doesn't.

**Fix:** Run `task backend:migrate-multi-source`. The migration:
1. Backfills `source='waterfall'` for any rows with NULL/empty source
2. Drops old `idx_asset_price_type_code_currency` (2-column) index
3. Calls `AutoMigrate(&models.AssetPrice{})` to create the new `idx_asset_price_type_code_currency_source` (3-column) constraint

No code changes were required — the migration was already written; it just needed to be run.
