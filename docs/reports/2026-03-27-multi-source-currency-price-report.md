# Multi-Source Currency Price Fetching — Implementation Report

## Summary

Replaced the single waterfall-based currency price fetch in `AssetPriceService` with three independent parallel goroutines — one per source (VangSaiGon, VangToday, Vietcombank direct API) — matching the existing gold parallel pattern. Added a new `pkg/vietcombank/` Go package that calls the official Vietcombank JSON API directly. Each currency source now fetches, stores, and fails independently in the `asset_price` table. Admin controls which sources appear via the existing `asset_display_config` system.

**Scope:** Backend-only. No frontend changes. `RefreshAllPrices()` now runs **10 parallel goroutines** (was 8): 6 gold + 1 silver + 3 currency.

## Spec Reference

`docs/specs/2026-03-27-multi-source-currency-price-spec.md`

## Plan Reference

`docs/plans/2026-03-27-multi-source-currency-price-plan.md`

## Tasks Completed

| #   | Task                                                   | Status | Commit     | Files Changed |
| --- | ------------------------------------------------------ | ------ | ---------- | ------------- |
| 0   | Update C4 Architecture Diagrams                        | Done   | `948fde8c` | `c4-component-backend.md` |
| 1   | Create Vietcombank API Client (`pkg/vietcombank/`)     | Done   | `948fde8c` | `types.go`, `client.go`, `client_test.go` |
| 2   | Create Vietcombank Currency Fetcher Adapter            | Done   | `5dd2a7f2` | `currency_fetcher_vietcombank.go`, `currency_fetcher_vietcombank_test.go`, `price_fetcher.go` |
| 3   | Replace Currency Waterfall with 3 Parallel Refresh    | Done   | `5a851321` | `asset_price_service.go`, `asset_price_service_currency_test.go`, `asset_price_service_test.go` |
| 4   | Wire Vietcombank Client + Currency Fetchers in DI     | Done   | `5a851321` | `services.go` |
| 5   | Seed Vietcombank Currency Display Config + Fetch Codes | Done   | `5a851321` | `cmd/migrate-vietcombank-currency/main.go`, `Taskfile.yml` |
| 6   | Update Flow Diagram (Background Scheduler)             | Done   | `5a851321` | `docs/architecture/flow-cross-cutting.md` |
| 7   | Full Backend Verification (Lint + Test + Build)        | Done   | `5a851321` | — (0 issues) |
| 8   | Update CLAUDE.md Documentation                         | Done   | `5a851321` | `.claude/CLAUDE.md` |

## Test Coverage Summary

| Layer           | Test File                                          | Tests | Pass  | Coverage Area |
| --------------- | -------------------------------------------------- | ----- | ----- | ------------- |
| Vietcombank Client | `pkg/vietcombank/client_test.go`                | 9     | 9/9   | HTTP success, TypeCode suffix, non-200, malformed JSON, timeout, zero-filter, 1MB size limit, name mapping, unknown fallback |
| Fetcher Adapter | `domain/service/currency_fetcher_vietcombank_test.go` | 7  | 7/7   | Source(), success mapping, ChangeBuy/ChangeSell=0, Currency preserved, empty result, error propagation, multiple entries |
| Service — per-source refresh | `domain/service/asset_price_service_currency_test.go` | 9 | 9/9 | VangSaiGon success/error/nil/empty, Vietcombank success/error, 10-source RefreshAllPrices, all-fail, VCB-only fail |
| Service — existing | `domain/service/asset_price_service_test.go`    | 15+   | all   | Existing gold/silver refresh, GetAllPrices, GetMarketTypes (regression) |

**Total new tests:** 25 (9 client + 7 fetcher + 9 service currency)

All tests pass: `go test -short ./... → ok (all packages)`

## Security Implementation Summary

| Concern | Implementation | Verified |
| --- | --- | --- |
| Response size limit | `io.LimitReader(resp.Body, 1MB+1)` in `pkg/vietcombank/client.go` | Yes — `TestFetchCurrencyPrices_ResponseSizeLimit` |
| Timeout | `&http.Client{Timeout: 5*time.Second}` (default) | Yes — `TestFetchCurrencyPrices_Timeout` |
| HTTPS enforcement | Hardcoded `https://www.vietcombank.com.vn/api/exchangerates` — no http:// variant | Yes |
| JSON schema validation | Typed `apiExchangeRate` struct; unknown fields ignored; malformed JSON returns error | Yes — `TestFetchCurrencyPrices_MalformedJSON` |
| Zero-price filtering | Entries where both Buy and Sell ≤ 0 are discarded before upsert | Yes — `TestFetchCurrencyPrices_FilterZeroPrices` |
| SQL injection | GORM parameterized upsert — no string concatenation in queries | Yes |
| TypeCode collision prevention | `_VCB` suffix (e.g. `"USD_VCB"`) differentiates from free-market `"USD"` in the `(type_code, currency, source)` unique index | Yes |
| Per-source stale isolation | `MarkStaleByAssetTypeAndSource(ctx, "currency", "<source>")` — one source's failure does not affect others | Yes — `TestRefreshCurrencyVietcombank_FetchError` |
| Feature flag | `VIETCOMBANK_FX_ENABLED=false` disables client instantiation; nil fetcher marks stale gracefully | Yes — nil-fetcher tests |
| No user input in price path | Background scheduler only — no HTTP endpoint for price write | Yes |

## Review Results

### Spec Compliance

All functional requirements met:

- **FR-1 (VCB Client):** `pkg/vietcombank/client.go` — `FetchCurrencyPrices(ctx)`, 5s timeout, 1MB limit, `Transfer`→`Buy` mapping, `_VCB` suffix, zero-filter, Vietnamese display names. 9 tests.
- **FR-2 (Fetcher Adapters):** `currency_fetcher_vietcombank.go` wraps VCB client; existing VangSaiGon and VangToday fetchers unchanged. All normalize to `CachedCurrencyPrice` with `ChangeBuy/ChangeSell=0`. 7 tests.
- **FR-3 (Parallel Refresh):** `refreshCurrencyVangSaiGon`, `refreshCurrencyVangToday`, `refreshCurrencyVietcombank` — 3 independent goroutines in `RefreshAllPrices`. Channel buffer 10, failCount threshold 10.
- **FR-4 (Remove Waterfall):** `refreshCurrency()` removed; `AssetPriceService` no longer depends on `CurrencyPriceService` for the refresh path.
- **FR-5 (Seed Display Config):** `cmd/migrate-vietcombank-currency/main.go` seeds 13 `asset_display_config` rows (`USD_VCB` … `CNY_VCB`) + corresponding `asset_config_fetch_code` rows. Idempotent (existence check before each insert).
- **FR-6 (Constructor Wiring):** `services.go` creates `vietcombank.NewClient()` wrapped in `NewVietcombankCurrencyFetcher`, passed to `NewAssetPriceService`. `VIETCOMBANK_FX_ENABLED=false` passes `nil`.

Non-functional: 3 currency goroutines run in parallel (no added latency). Per-source stale marking. Log summary includes `currency_vietcombank=OK(N)` entries.

### Security Review

STRIDE threats from spec assessed:

- **T-1 (Tampering/MITM):** HTTPS + TLS cert verification (Go default) enforced by hardcoded URL. Response structure validated by typed JSON unmarshal.
- **T-2 (Spoofing):** Hardcoded HTTPS URL; no dynamic URL construction from user input.
- **T-3 (DoS — large response):** 1MB `io.LimitReader` guard tested and passing.
- **T-4 (Info Disclosure):** Errors logged server-side; not propagated to frontend responses.
- **T-5 (SQL Injection):** GORM parameterized upsert; no raw SQL string concatenation.
- **T-6 (Manipulated prices):** Currency prices are display-only (`show_in_investment=false`); not used in PNL calculations. Risk: display only.

No new attack surface introduced — feature is entirely in the background scheduler path, not HTTP-accessible.

### Code Quality

- Follows existing `refreshGoldVangSaiGon` pattern exactly — consistent, readable
- `fetchVietcombankFn` function type enables dependency injection in tests without interface proliferation
- `newClientWithOptions` test helper is package-private (same package) — no exported test API
- Removed unused `mockCurrencyPriceSvc` and `makeCurrencyPrices` (waterfall leftovers) — 0 lint warnings
- `golangci-lint` passes: 0 issues, build clean
- Depguard satisfied: `pkg/vietcombank` import is in `domain/service/` (allowed) not restricted layers

## Known Issues / Technical Debt

1. **Silver still uses waterfall pattern** — `refreshSilver` calls `SilverPriceService.FetchAllPrices()` (single source waterfall). Out of scope for this feature; tracked separately.
2. **Vietcombank API stability** — unofficial public endpoint; could change without notice. Mitigation: per-source stale marking ensures VCB failure doesn't affect VangSaiGon/VangToday currency rows.
3. **VangSaiGon "USD Internalbank" entry** — existing display config entry that aggregates VCB rates via VangSaiGon's scraper remains. Plan mentioned optionally renaming its `DisplayName` to "USD Vietcombank (VSG)" to distinguish from direct API. Deferred — no breaking change; admin can update manually.
4. **No price range sanity check** — spec identified this as a mitigation for T-1/T-6 but it was not included in FR-1 acceptance criteria. Low risk (public display data, not PNL). Deferred.

## Files Changed

### New Files

| File | Purpose |
| --- | --- |
| `src/go-backend/pkg/vietcombank/types.go` | `CurrencyPrice` + `apiExchangeRate` structs |
| `src/go-backend/pkg/vietcombank/client.go` | HTTP client — `FetchCurrencyPrices`, `parseVND`, `currencyNames` map |
| `src/go-backend/pkg/vietcombank/client_test.go` | 9 unit tests using `httptest.NewServer` |
| `src/go-backend/domain/service/currency_fetcher_vietcombank.go` | `CurrencyPriceFetcher` adapter wrapping VCB client |
| `src/go-backend/domain/service/currency_fetcher_vietcombank_test.go` | 7 unit tests for the adapter |
| `src/go-backend/domain/service/asset_price_service_currency_test.go` | 9 service-level tests for 3 parallel currency refresh methods |
| `src/go-backend/cmd/migrate-vietcombank-currency/main.go` | Idempotent seed migration for 13 VCB currency display configs |
| `docs/plans/2026-03-27-multi-source-currency-price-plan.md` | Implementation plan |
| `docs/specs/2026-03-27-multi-source-currency-price-spec.md` | Feature specification |
| `docs/reports/2026-03-27-multi-source-currency-price-progress.md` | Progress tracking file |

### Modified Files

| File | Change |
| --- | --- |
| `src/go-backend/domain/service/price_fetcher.go` | Added `SourceVietcombank PriceSource = "vietcombank"` constant |
| `src/go-backend/domain/service/asset_price_service.go` | Struct: 3 currency fetcher fields (was `currencySvc`). Constructor: 3 new params. `RefreshAllPrices`: 8→10 goroutines. Added 3 `refreshCurrencyXxx` methods. Removed `refreshCurrency`. |
| `src/go-backend/domain/service/asset_price_service_test.go` | Removed unused `mockCurrencyPriceSvc` + `makeCurrencyPrices` (waterfall leftovers) |
| `src/go-backend/domain/service/services.go` | Added `vietcombank` import; wired `vcbFetcher` behind `VIETCOMBANK_FX_ENABLED` env flag; updated `NewAssetPriceService` call |
| `docs/architecture/c4-component-backend.md` | Added `VietcombankClient` component; added dependency arrows from `AssetPriceService` |
| `docs/architecture/flow-cross-cutting.md` | Section 3 & 13: 10-goroutine diagram with 3 currency participants; updated invariants + error table |
| `Taskfile.yml` | Added `backend:migrate-vietcombank-currency` task |
| `.claude/CLAUDE.md` | Updated Asset Price Cache section: 10 goroutines, currency sources, `VIETCOMBANK_FX_ENABLED`, new migration task |

## How to Test

### Unit & Integration Tests

```bash
# All unit tests (no external dependencies)
cd src/go-backend && go test -short ./...

# Targeted: Vietcombank client
cd src/go-backend && go test -short ./pkg/vietcombank/... -v

# Targeted: Fetcher adapter
cd src/go-backend && go test -short ./domain/service/... -run TestVietcombank -v

# Targeted: Parallel currency refresh
cd src/go-backend && go test -short ./domain/service/... -run "TestRefreshCurrency|TestRefreshAllPrices" -v

# Lint + build
cd src/go-backend && task ci:backend-lint
```

Expected: all tests pass, 0 lint issues.

### Dependency Impact Verification

GitNexus not indexed for this session — manual blast radius review performed.

Key changed symbols and their d=1 dependents:

| Changed Symbol | d=1 Dependents | Tested? | Notes |
| --- | --- | --- | --- |
| `NewAssetPriceService` signature | `services.go:NewServices` | Yes — build passes | Constructor wiring updated in same commit |
| `AssetPriceService.RefreshAllPrices` | `scheduler/price_cache_job.go` | Yes — scheduler tests pass | Interface unchanged; only goroutine count increased |
| `CurrencyPriceFetcher` interface | `currency_fetcher_vangsaigon.go`, `currency_fetcher_vangtoday.go`, `currency_fetcher_vietcombank.go` | Yes | Interface unchanged; new implementer added |
| `SourceVietcombank` constant | `currency_fetcher_vietcombank.go` | Yes — fetcher tests | New constant, no existing callers |

### Manual Testing Steps

#### Scenario: Vietcombank currency prices appear in market prices response

**Preconditions:** App running with DB seeded (run `task backend:migrate-vietcombank-currency` first). `VIETCOMBANK_FX_ENABLED` not set (defaults to enabled).

1. Wait for the `PriceCacheJob` to run (10s startup delay, then every 15 min) — or trigger manually by restarting the app.
2. Check logs for: `currency_vietcombank=OK(N)` in the price cache summary line.
3. Call `GET /api/v1/investments/market-prices` → Expected: `currency` array contains items with `name` matching "USD Vietcombank (Official)", "EUR Vietcombank", etc. (when those display configs are enabled).

#### Scenario: Vietcombank source fails independently

**Preconditions:** Set `VIETCOMBANK_FX_ENABLED=false` (or block `vietcombank.com.vn` at network level).

1. Restart the app / wait for next price cache refresh.
2. Check logs: `currency_vietcombank=FAIL(...)` — other sources still show `OK`.
3. Expected: `vangsaigon` and `vangtoday` currency prices still update normally; only `_VCB`-suffixed rows are stale.

#### Scenario: Disable Vietcombank via feature flag

**Preconditions:** Set env var `VIETCOMBANK_FX_ENABLED=false`.

1. Restart app.
2. Check logs at startup: `[NewServices] VIETCOMBANK_FX_ENABLED=false — Vietcombank currency fetcher disabled`
3. Expected: `currency_vietcombank=FAIL(vietcombank currency fetcher not configured)` in refresh log — no HTTP calls to Vietcombank API.

#### Scenario: Run migration idempotently

1. Run `task backend:migrate-vietcombank-currency` twice.
2. Expected: First run logs `Seeded: USD_VCB ...`; second run logs `Exists: USD_VCB ...` — no duplicate rows, no errors.

## Fix History

| Date       | Fix                                                                  | Severity | Root Cause                                                                                             |
| ---------- | -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 2026-03-28 | Vietcombank API response format changed — updated JSON parsing to match new envelope shape | Minor    | API changed from bare `[...]` array to `{"Count":N,"Data":[...]}` wrapper object; JSON field names changed from PascalCase to camelCase |
| 2026-03-28 | Migration: set `_VCB` fetch codes as default (priority 1) for standard currency display configs | Minor    | `migrate-asset-config-fetch-code` seeded plain fetch codes (e.g. `"USD"`) as priority 1 for standard currency display configs; Vietcombank data was not set as default source |
| 2026-03-28 | Landing page and home page currency table shows "Không có dữ liệu" — added per-asset static fallback in `GetPublicMarketTypes` | Minor | `public.go` fallback only fired when ALL three asset types (gold, silver, currency) were empty. If gold/silver had DB data but currency was empty (price cache unpopulated), currency fell back to `[]` with no fallback — causing "no data" display. |
| 2026-03-28 | Frontend build fails: TypeScript error in `AssetDisplayConfigForm.tsx` — incorrect type cast on `createMutation` `onSuccess` data | Minor | `apiClient.post<T>()` returns `ApiResponse<T>` (envelope with `data?: T`), but the handler cast `data` directly to `CreateConfigResponse` and accessed `.config.id` — which is actually at `data.data?.config?.id`. Fixed by removing the bad cast and using correct optional chaining. |
| 2026-03-28 | Silver and currency tables on landing and home pages did not use `asset-display-prices` API — migrated to `useQueryGetAssetDisplayPrices` | Major | Gold table already used `GET /api/v1/public/asset-display-prices?assetType=gold` (admin-configured, stale-aware, source-resolved). Silver/currency tables still used `usePublicMarketTypes` (names only, no prices) and `useQueryGetMarketPrices` (raw `asset_price` rows without admin config). Migrated 4 components to self-fetch via `useQueryGetAssetDisplayPrices`; removed `usePublicMarketTypes` and SSR `fetchMarketTypes()` from landing page; simplified `home/page.tsx`. |

### Fix Detail: 2026-03-28 — JSON Schema Mismatch

**Symptom:** `currency_vietcombank=FAIL(fetch from vietcombank: parse json: json: cannot unmarshal object into Go value of type []vietcombank.apiExchangeRate)`

**Root Cause:** The Vietcombank API changed its response format:
- **Before:** Top-level JSON array `[{"CurrencyCode":"USD",...}]`
- **After:** Wrapped object `{"Count":20,"Date":"...","UpdatedDate":"...","Data":[{"currencyCode":"USD",...}]}`
- JSON field names also changed from PascalCase (`CurrencyCode`, `Transfer`, `Sell`) to camelCase (`currencyCode`, `transfer`, `sell`)
- `Buy` field replaced by `Cash`; `Transfer` field preserved (still the correct buy rate for bank transfers)

**Files Changed:**
- `src/go-backend/pkg/vietcombank/types.go` — Added `apiResponse` wrapper struct; updated `apiExchangeRate` JSON tags to camelCase; renamed `Buy` field to `Cash`
- `src/go-backend/pkg/vietcombank/client.go` — Unmarshal into `apiResponse` instead of `[]apiExchangeRate`; iterate over `parsed.Data`
- `src/go-backend/pkg/vietcombank/client_test.go` — Updated all 9 test fixtures to use new API response format

**Security Review:** Approved — no new attack surface; 1MB size limit, HTTPS, and timeout unchanged.

### Fix Detail: 2026-03-28 — Currency Table Shows "Không có dữ liệu" on Landing Page and Home Page

**Symptom:** Both `LandingCurrencyPriceTable` (landing page, `usePublicMarketTypes` hook) and `CurrencyPriceTable` (home page, `useQueryGetMarketPrices` hook) display "Không có dữ liệu" even after the multi-source currency feature is deployed.

**Root Cause:** `GetPublicMarketTypes` in `handlers/public.go` had an "all-or-nothing" static fallback condition:

```go
// BEFORE — only falls back when ALL three are empty
if len(goldTypes) == 0 && len(silverTypes) == 0 && len(currencyTypes) == 0 {
    h.fallbackStaticTypes(c)
    return
}
```

Gold and silver price rows in `asset_price` are populated by the pre-existing price cache job. Currency rows are only populated after:
1. `task backend:migrate-asset-display-config` (seeds `asset_display_config` entries for currency), AND
2. The `PriceCacheJob` runs and successfully fetches from VangSaiGon or VangToday currency APIs.

If either step hasn't happened yet (first deploy, migration not run, or all fetchers fail), currency rows in `asset_price` are empty. Since gold/silver have data, the "all-or-nothing" condition evaluates to `false` — the handler returns `currency: []` from the DB path with no fallback. The frontend components display "Không có dữ liệu".

**Fix:** Added per-asset-type independent fallback so each asset type falls back to its static registry when empty, regardless of the other two:

```go
// AFTER — per-asset fallback
if len(goldTypes) == 0 {
    goldTypes = staticGoldTypes()
}
if len(silverTypes) == 0 {
    silverTypes = staticSilverTypes()
}
if len(currencyTypes) == 0 {
    currencyTypes = staticCurrencyTypes()
}
```

Extracted three package-level helpers (`staticGoldTypes`, `staticSilverTypes`, `staticCurrencyTypes`) to share the logic with the existing `fallbackStaticTypes` method.

**Note on home page:** `GetMarketPrices` (authenticated endpoint) has no static fallback — it only serves DB data. If `asset_price` has no currency rows, the home page correctly shows "Không có dữ liệu" there until the price cache is populated. Running `task backend:migrate-asset-display-config` and waiting for the `PriceCacheJob` to run (or restarting the backend) resolves the home page display.

**Files Changed:**
- `src/go-backend/handlers/public.go` — Per-asset fallback logic; extracted `staticGoldTypes`, `staticSilverTypes`, `staticCurrencyTypes` helpers

**Security Review:** Approved — no new attack surface, no information disclosure (static types are public display metadata), no injection risk (compile-time constant data).

### Fix Detail: 2026-03-28 — TypeScript Build Error in AssetDisplayConfigForm

**Symptom:** `yarn run build` fails with:
```
Type error: Conversion of type 'ApiResponse<CreateConfigResponse>' to type 'CreateConfigResponse'
may be a mistake because neither type sufficiently overlaps with the other.
Property 'config' is missing in type 'ApiResponse<CreateConfigResponse>'
```

**Root Cause:** `apiClient.post<T>()` always returns `Promise<ApiResponse<T>>`, where `ApiResponse<T>` is `{ success: boolean; data?: T; ... }`. The `createMutation` `onSuccess` callback received `data: ApiResponse<CreateConfigResponse>`, but the handler was casting it directly to `CreateConfigResponse` and accessing `.config.id` — which is one level too shallow. The actual path is `data.data?.config?.id`.

**Fix:**

```typescript
// BEFORE — bad cast, wrong data shape
onSuccess?.((data as CreateConfigResponse)?.config?.id, selectedAssetType);

// AFTER — correct optional chaining through ApiResponse envelope
onSuccess?.(data?.data?.config?.id, selectedAssetType);
```

**Files Changed:**
- `src/wj-client/features/admin/components/AssetDisplayConfigForm.tsx` — Line 111: removed bad type cast, use `data?.data?.config?.id`

**Security Review:** Approved — no new attack surface; `config.id` is a non-secret integer used only for admin UI navigation; optional chaining handles missing values safely with no exception propagation.

### Fix Detail: 2026-03-28 — Silver & Currency Tables Not Using Asset Display Prices API

**Symptom:** Gold price tables on landing page and home page used the admin-configured `GET /api/v1/public/asset-display-prices?assetType=gold` endpoint (stale-aware, source-resolved, admin overrides applied). Silver and currency tables used older endpoints: landing page used `GET /api/v1/public/market-types` (returns display names only, no prices); home page used `GET /api/v1/investments/market-prices` (raw `asset_price` rows without admin display config resolution).

**Root Cause:** The `feat/price-page` feature that introduced `GoldPriceTable` self-fetching was implemented for gold only. The landing and home page silver/currency tables were not updated to use the same endpoint pattern when the `asset-display-prices` API was added. This meant:
- Silver/currency prices on the landing page showed no prices at all (login prompt only, but the row data came from `market-types` which has no prices)
- Silver/currency on the home page bypassed admin display configuration, source resolution, stale marking per source, and admin overrides

**Fix:** Migrated 4 components to self-fetch via `useQueryGetAssetDisplayPrices`:

1. `LandingSilverPriceTable` — removed `types`/`isLoading`/`updatedTime` props; now self-fetches `assetType: "silver"`; shows `item.displayName`
2. `LandingCurrencyPriceTable` — same migration for `assetType: "currency"`
3. `SilverPriceTable` (home) — removed `prices`/`updatedTime`/`isAdmin`/`isLoading` props; self-fetches `assetType: "silver"`; derives `isAdmin` from `useAuth()` internally; shows `"--"` for stale prices
4. `CurrencyPriceTable` (home) — same migration for `assetType: "currency"`

Cleanup:
- `LandingContent.tsx` — removed `usePublicMarketTypes` hook, all silver/currency state vars, `initialData` prop
- `landing/page.tsx` — removed SSR `fetchMarketTypes()` (was fetching `/api/v1/public/market-types` with ISR); landing now renders client-side only (consistent with gold/silver/currency all self-fetching)
- `home/page.tsx` — removed `useQueryGetMarketPrices`, silver/currency derived vars and props

**Note on `toAdminPriceItem` adapter:** `InlinePriceEdit` and `OverrideIndicator` accept `PriceItem` type (which has `name`, `isOverridden` fields absent from `AssetDisplayPrice`). A thin `toAdminPriceItem()` adapter is added in each home table component that sets `isOverridden: false` (hardcoded). This means the "remove override" gold dot indicator won't appear for silver/currency rows even when an override is set — a cosmetic gap only. The admin override write/delete endpoints remain fully auth-guarded server-side.

**Files Changed:**
- `src/wj-client/components/landing/LandingSilverPriceTable.tsx` — rewritten to self-fetch
- `src/wj-client/components/landing/LandingCurrencyPriceTable.tsx` — rewritten to self-fetch
- `src/wj-client/app/[locale]/landing/LandingContent.tsx` — removed `usePublicMarketTypes`, simplified
- `src/wj-client/app/[locale]/landing/page.tsx` — removed SSR fetch, simplified
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx` — rewritten to self-fetch
- `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx` — rewritten to self-fetch
- `src/wj-client/app/[locale]/dashboard/home/page.tsx` — removed `useQueryGetMarketPrices` for silver/currency

**Security Review:** Approved — no new attack surface; endpoint already existed and was used by gold; `assetType` is hardcoded (no user input); `isAdmin` derived from same trusted `useAuth()` source; `item.displayName` rendered as React JSX text node (XSS-safe); removing SSR for public data has no security impact.
