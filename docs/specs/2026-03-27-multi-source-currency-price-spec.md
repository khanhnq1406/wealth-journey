# Multi-Source Currency Price Fetching Specification

## Summary

Replace the current waterfall-based currency price fetching (vangsaigon.vn -> vang.today fallback) with a **parallel per-source fetching pattern** — identical to how gold prices are fetched (SJC, DOJI, BTMC, PNJ, vangsaigon, vangtoday in parallel). Each currency source (Vietcombank direct API, vangsaigon.vn, vang.today) runs as an independent goroutine, stores results with its own `source` identifier in `asset_price`, and fails/marks stale independently. Admin controls which sources to display via the existing `asset_display_config` system.

## User Stories

- As a user, I want to see exchange rates from multiple sources (Vietcombank official, free-market aggregators) so that I can compare and make better decisions.
- As an admin, I want to enable/disable individual currency sources per type code so that I can curate which rates are displayed.

## Functional Requirements

### FR-1: Vietcombank Direct API Client

Create a new Go package `pkg/vietcombank/` that fetches exchange rates from the official Vietcombank JSON API.

**API endpoint**: `https://www.vietcombank.com.vn/api/exchangerates?date=YYYY-MM-DD`

**Field mapping**:
| VCB Field | AssetPrice Field | Notes |
|-----------|-----------------|-------|
| `Transfer` (Mua chuyển khoản) | `Buy` | Transfer rate is the standard "buy" used by most apps |
| `Sell` (Bán) | `Sell` | Direct mapping |
| `CurrencyCode` | `TypeCode` | e.g., "USD", "EUR" |
| `CurrencyName` | `Name` | e.g., "US DOLLAR" — override with Vietnamese display names |

**Acceptance criteria:**
- [ ] `pkg/vietcombank/client.go` implements `FetchCurrencyPrices(ctx) ([]*CurrencyPrice, error)`
- [ ] `pkg/vietcombank/types.go` defines `CurrencyPrice` struct with `TypeCode`, `Name`, `Buy`, `Sell`, `Currency` fields
- [ ] HTTP client has configurable timeout (default 5s)
- [ ] Response body limited to 1MB (`io.LimitReader`)
- [ ] Returns raw VND values (no multiplication) — consistent with vangsaigon/vangtoday
- [ ] Handles API errors (non-200 status, invalid JSON) gracefully
- [ ] Filters out entries where both Buy and Sell are 0
- [ ] Maps VCB currency names to Vietnamese display names (e.g., "US DOLLAR" -> "USD Vietcombank")

### FR-2: Currency Price Fetcher Adapters

Create fetcher adapters that normalize each source's output to `CachedCurrencyPrice`, following the `GoldPriceFetcher` pattern.

**Acceptance criteria:**
- [ ] `currency_fetcher_vietcombank.go` wraps `pkg/vietcombank/client.go` into a `CurrencyPriceFetcher`
- [ ] Existing `currency_fetcher_vangsaigon.go` and `currency_fetcher_vangtoday.go` remain as-is (already work)
- [ ] All fetchers normalize to `CachedCurrencyPrice` (TypeCode, Name, Buy, Sell, ChangeBuy, ChangeSell, Currency, UpdateTime)
- [ ] Vietcombank fetcher sets `ChangeBuy=0, ChangeSell=0` (API doesn't provide change data)

### FR-3: Parallel Currency Fetching in AssetPriceService

Replace the single `refreshCurrency()` method (which calls the waterfall `CurrencyPriceService`) with 3 parallel goroutines — one per source — following the gold pattern exactly.

**New methods:**
- `refreshCurrencyVangSaiGon(ctx) refreshResult` — source: `"vangsaigon"`
- `refreshCurrencyVangToday(ctx) refreshResult` — source: `"vangtoday"`
- `refreshCurrencyVietcombank(ctx) refreshResult` — source: `"vietcombank"`

**Each method follows the gold refresh pattern:**
1. Nil-check the client → mark stale by source on nil
2. Call `client.FetchCurrencyPrices(ctx)`
3. Convert to `[]*models.AssetPrice` with `AssetType: "currency"`, `Source: "<source>"`
4. Filter out entries where both Buy and Sell <= 0
5. `UpsertBatch` to DB
6. On any failure: `MarkStaleByAssetTypeAndSource(ctx, "currency", "<source>")`
7. Return `refreshResult{source: "currency_<source>", count, err}`

**RefreshAllPrices changes:**
- Remove the single `refreshCurrency()` goroutine
- Add 3 goroutines for currency (vangsaigon, vangtoday, vietcombank)
- Update channel buffer size from 8 to 10 (6 gold + 1 silver + 3 currency)

**Acceptance criteria:**
- [ ] `refreshCurrency()` removed from `asset_price_service.go`
- [ ] 3 new `refreshCurrencyXxx()` methods added
- [ ] `RefreshAllPrices()` launches 10 parallel goroutines (6 gold + 1 silver + 3 currency)
- [ ] Each currency source fetches, stores, and fails independently
- [ ] Per-source stale marking via `MarkStaleByAssetTypeAndSource`
- [ ] DB rows have distinct `source` values: `"vangsaigon"`, `"vangtoday"`, `"vietcombank"`

### FR-4: Remove Waterfall for Currency

The `CurrencyPriceService` waterfall pattern is no longer needed for the price cache flow. The parallel fetchers call the underlying clients directly.

**Acceptance criteria:**
- [ ] `AssetPriceService` no longer depends on `CurrencyPriceService` for `RefreshAllPrices()`
- [ ] `AssetPriceService` struct gains 3 currency fetcher fields (or 3 client fields) instead of `currencySvc`
- [ ] Waterfall code in `currency_price_service.go` can be deprecated (but keep for now if used elsewhere — e.g., by other services that need a single "best" currency price)
- [ ] Redis caching for currency (aggregate, emergency) is no longer needed for the price cache path — DB is the cache

### FR-5: Seed Asset Display Config for New Sources

Update the `migrate-asset-display-config` migration to seed currency entries per source.

**New seed entries** (for each existing currency type code, add vietcombank source rows):

| TypeCode | Source | DisplayName | DisplayOrder | Enabled |
|----------|--------|-------------|--------------|---------|
| USD | vietcombank | USD Vietcombank | 2 | true |
| EUR | vietcombank | EUR Vietcombank | 20 | true |
| GBP | vietcombank | GBP Vietcombank | 21 | true |
| JPY | vietcombank | JPY Vietcombank | 22 | true |
| ... (all currencies VCB provides) | ... | ... | ... | ... |

**Note:** The existing `asset_display_config` unique index is `(type_code, asset_type)`. Since we now have the same `type_code` from multiple sources, the display config needs to work with the `(type_code, currency, source)` key on `asset_price`. Two approaches:
1. Use `AssetConfigFetchCode` table (already exists) to map display config to source-specific fetch codes
2. Or expand display config to include `source` in the unique index

**Recommended:** Use the existing `AssetConfigFetchCode` pattern — same as gold. One display config entry "USD Vietcombank" maps to fetch code `USD` with source `vietcombank`.

**Acceptance criteria:**
- [ ] Migration seeds Vietcombank currency entries in `asset_display_config`
- [ ] Each display config entry has appropriate `AssetConfigFetchCode` mappings
- [ ] Existing vangsaigon/vangtoday currency configs remain unchanged
- [ ] Admin can enable/disable each source independently

### FR-6: Constructor Wiring

Wire the Vietcombank client into `AssetPriceService` via constructor injection.

**Acceptance criteria:**
- [ ] `internal/app/providers.go` creates `vietcombank.NewClient()` and passes to `AssetPriceService`
- [ ] `AssetPriceService` constructor accepts the new client dependency
- [ ] Feature flag env var `VIETCOMBANK_FX_ENABLED` (default: `true`) controls whether client is instantiated

## Non-Functional Requirements

- **Performance**: 3 currency fetches run in parallel (not sequential) — no added latency vs current waterfall
- **Reliability**: Each source fails independently; one failure does not block others
- **Observability**: Log summary includes per-source currency results (e.g., `currency_vietcombank=OK(15), currency_vangsaigon=OK(18)`)
- **Timeout**: Each source client has 5s timeout (consistent with gold clients)
- **Response size limit**: 1MB per source response (prevent memory exhaustion)

## Architecture Changes (C4)

### Diagrams to Update

**L1 Context (`c4-context.md`):**
- Add "Vietcombank API" as a new external system (alongside existing Yahoo Finance, vang.today, vangsaigon.vn)

**L3 Backend Components (`c4-component-backend.md`):**
- Add `VietcombankClient` component in `pkg/vietcombank/`
- Update `AssetPriceService` description to mention 3 currency sources (parallel, not waterfall)
- Add dependency arrow: `AssetPriceService` → `VietcombankClient`

### New Diagrams

None needed — this follows the existing gold parallel pattern. No new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`:**
- Update the "Background Scheduler — Price Cache Refresh" sequence diagram
- Show 10 parallel goroutines instead of 8 (add 3 currency, remove 1 currency waterfall)
- Show per-source stale marking for currency (matching gold pattern)

### New Flow Diagrams

None — the pattern is identical to existing gold parallel fetch flow.

## Data Model Changes

**No schema changes to `asset_price` table.** The existing composite unique index `(type_code, currency, source)` already supports multiple sources for the same currency code.

**`asset_display_config` changes:**
- New seed rows for Vietcombank currency types
- New `asset_config_fetch_code` rows mapping display configs to source-specific fetch codes

## API Changes

**No API endpoint changes.** The existing `GET /api/v1/investments/market-prices` handler reads from `asset_price` filtered by `asset_display_config` — new source rows will automatically appear when admin enables them.

## UI/UX Changes

**None.** Backend-only feature. The frontend already displays `name` field from `asset_price`, which will show "USD Vietcombank" vs "USD Tự Do" naturally.

### Existing Component Inventory (REQUIRED)

No frontend components needed.

| Need | Existing Component | Location |
|------|--------------------|----------|
| N/A — backend only | N/A | N/A |

### New Components (if any)

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Vietcombank API | JSON exchange rates (buy/transfer/sell per currency) | Yes: External → App | VietcombankClient | Untrusted external response |
| 2 | VietcombankClient | Parsed `[]*CurrencyPrice` | No (same tier) | AssetPriceService | Validated/filtered by client |
| 3 | AssetPriceService | `[]*models.AssetPrice` | Yes: App → DB | PostgreSQL `asset_price` | GORM parameterized upsert |
| 4 | VangSaiGon API | JSON prices | Yes: External → App | VangSaiGon client | Already exists — same trust level |
| 5 | VangToday API | JSON prices | Yes: External → App | VangToday client | Already exists — same trust level |
| 6 | PostgreSQL | Cached prices | Yes: DB → App | Market Prices Handler | Filtered by display config |
| 7 | Market Prices Handler | JSON response | Yes: App → Internet | User browser | Public price data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| External API → App | Vietcombank API response | Response size limit (1MB), JSON schema validation, price range checks, timeout (5s) |
| App → DB | Upsert queries | GORM parameterized queries, no user input in query |
| DB → App (handler) | Cached price reads | Display config filtering, admin override layer |
| App → Internet | Market prices response | Public endpoint (no auth required for market types) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | External → App | Tampering | Vietcombank API response could be manipulated (MITM, DNS hijack) | Medium | HTTPS enforced; validate response structure; price range sanity checks |
| T-2 | 1 | External → App | Spoofing | Fake API endpoint pretending to be Vietcombank | Low | Hardcoded HTTPS URL; TLS cert verification (Go default) |
| T-3 | 1 | External → App | DoS | Vietcombank API returns extremely large response | Low | 1MB response limit via `io.LimitReader` |
| T-4 | 1 | External → App | Info Disclosure | Error messages from Vietcombank API leaking in logs | Low | Log error message, don't propagate to frontend |
| T-5 | 3 | App → DB | Tampering | SQL injection via price data | Low | GORM parameterized upsert; no string concatenation |
| T-6 | 1 | External → App | Data Integrity | Manipulated prices causing incorrect portfolio valuations | Medium | Prices are display-only for currency tab (not used in PNL calculations); `show_in_investment=false` |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated | Notes |
|-----------|-------|------------|-----------------|-------|
| View market prices | All users | All users | Yes (public endpoint) | GET /api/v1/investments/market-prices |
| Enable/disable sources | Admin only | No | No | Via admin panel asset display config |
| Trigger price refresh | System only (scheduler) | No | No | Background job, no HTTP trigger |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| VCB API response body | JSON | Max 1MB | `io.LimitReader`, JSON unmarshal with typed struct |
| VCB `Transfer` field | string/float | Must parse to positive number | Parse to float64, convert to int64, reject <= 0 |
| VCB `Sell` field | string/float | Must parse to positive number | Parse to float64, convert to int64, reject <= 0 |
| VCB `CurrencyCode` | string | 3-char ISO code | Validate against known currency list |

### External Dependency Risks

| External Service | Data Exchanged | Trust Level | Failure Impact | Compromise Impact | Mitigations |
|-----------------|----------------|-------------|----------------|-------------------|-------------|
| Vietcombank API | Exchange rates (public data) | Low (public data) | VCB currency rows marked stale; other sources unaffected | Manipulated display prices (not investment PNL) | HTTPS, response validation, per-source stale marking, price range checks |
| vangsaigon.vn | Exchange rates (public data) | Low (public data) | VangSaiGon rows marked stale | Same as VCB | Already mitigated (existing) |
| vang.today | Exchange rates (public data) | Low (public data) | VangToday rows marked stale | Same as VCB | Already mitigated (existing) |

**No new npm/Go packages required.** The Vietcombank client uses only `net/http` and `encoding/json` from the standard library.

### Sensitive Data Handling

No sensitive data involved. Exchange rates are public information. No user-specific data is exchanged with external APIs.

### Issues & Risks Summary

1. **Vietcombank API stability** — unofficial endpoint, could change without notice. Mitigation: per-source stale marking; other 2 sources continue independently.
2. **Rate consistency across sources** — different sources may report slightly different rates for the same currency. This is expected and valuable (users can compare). Not a data integrity issue.
3. **Display config migration** — adding new rows must be idempotent (re-runnable without duplicates). Use `ON CONFLICT DO NOTHING` or check existence before insert.

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| VCB API returns empty list | Mark vietcombank source stale; other sources unaffected |
| VCB API returns non-200 | Mark vietcombank source stale; log error |
| VCB API returns malformed JSON | Mark vietcombank source stale; log parse error |
| VCB API timeout (>5s) | Mark vietcombank source stale; goroutine returns error |
| VCB `Transfer` field is 0 or empty for a currency | Skip that currency row (don't upsert 0 price) |
| Same `type_code` from multiple sources with different prices | Expected — each stored with different `source` value; admin controls which to display |
| Cold start (empty DB) | All sources attempt fetch; `GetPublicMarketTypes` falls back to static registries |
| All 3 currency sources fail simultaneously | All currency rows marked stale; frontend shows "--" for prices |

## Dependencies & Assumptions

- Vietcombank JSON API at `https://www.vietcombank.com.vn/api/exchangerates` is publicly accessible and returns JSON with `CurrencyCode`, `Transfer`, `Sell` fields
- The API does not require authentication or API keys
- The API returns VND exchange rates (not inverse rates)
- Existing `asset_price` composite unique index `(type_code, currency, source)` is sufficient — no schema migration needed
- Existing `AssetConfigFetchCode` pattern can be reused for currency source mapping

## Out of Scope

- HTML scraping for banks without JSON APIs (webgia.com, Agribank, etc.)
- VNAppMob aggregator API (requires rotating API key)
- Frontend UI changes (source grouping, bank logos, comparison view)
- Historical FX rate tracking per bank
- Adding more banks beyond Vietcombank/vangsaigon/vangtoday in this iteration
- Modifying the `FXRateService` (used for cross-currency conversion in investment/wallet) — this feature only affects the market prices display cache
