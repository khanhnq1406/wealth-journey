# Market Prices Server-Side Aggregate Cache — Fix Specification

## Summary

The `FetchAllPrices()` methods in `GoldPriceService`, `SilverPriceService`, and `CurrencyPriceService` bypass Redis cache — they call the external vangsaigon API on every invocation. Individual symbol caches exist but `FetchAllPrices` never reads from them before fetching. When a user repeatedly reloads the Prices page (or multiple users load it concurrently), every reload triggers a direct HTTP call to the vangsaigon API. This fix adds a server-side aggregate cache key per service so the external API is called at most once per 5-minute TTL, regardless of how many frontend reloads occur.

**Original report:** `docs/reports/2026-03-24-symbol-watchlist-report.md`

## User Stories

- As a user, when I reload the Prices page multiple times, I want to see fresh prices without causing backend errors, so that I am not blocked by a rate-limited external API.
- As an operator, I want the backend to shield the vangsaigon API from excessive calls, so that the service remains available for all users.

## Functional Requirements

### FR-1: Aggregate Cache for `FetchAllPrices` — Gold Service

`GoldPriceService.FetchAllPrices(ctx)` must:
1. Check Redis for key `gold_price:all` before calling the external API.
2. If cache hit: unmarshal and return the cached list immediately.
3. If cache miss: call `vnprice.Client.FetchPrices()`, build the result list, write it to `gold_price:all` with 5-minute TTL, then return.

**Acceptance criteria:**
- [ ] Redis key `gold_price:all` is written after a successful API call
- [ ] Repeated calls within 5 min return cached data without hitting the API
- [ ] Cache miss (first call or after TTL) hits the API exactly once
- [ ] API error with no cache → error propagated to caller
- [ ] Individual per-symbol cache keys (`gold_price:<symbol>`) are still written on fetch (no regression)

### FR-2: Aggregate Cache for `FetchAllPrices` — Silver Service

`SilverPriceService.FetchAllPrices(ctx)` must:
1. Check Redis for key `silver_price:all` before calling the external sources.
2. If cache hit: return cached list immediately.
3. If cache miss: fetch from all sources in parallel, build result, write to `silver_price:all` with 5-minute TTL, then return.

**Acceptance criteria:**
- [ ] Redis key `silver_price:all` is written after a successful multi-source fetch
- [ ] Repeated calls within 5 min return cached data
- [ ] Individual per-symbol keys still written (no regression)

### FR-3: Aggregate Cache for `FetchAllPrices` — Currency Service

`CurrencyPriceService.FetchAllPrices(ctx)` must:
1. Check Redis for key `currency_price:all` before calling the external API.
2. If cache hit: return cached list immediately.
3. If cache miss: call API, write to `currency_price:all` with 5-minute TTL, then return.

**Acceptance criteria:**
- [ ] Redis key `currency_price:all` is written after a successful API call
- [ ] Repeated calls within 5 min return cached data
- [ ] Individual per-symbol keys still written (no regression)

### FR-4: Stale Cache Fallback on API Error

If the external API fails and a stale aggregate cache entry exists (TTL expired but key still readable via separate stale key or fallback pattern), serve the stale data with a warning log rather than returning an error.

> **Decision:** Use Redis's native TTL — when TTL expires the key is gone. On API failure with no cache: return the error (existing behavior). Stale-cache-on-error requires a secondary "stale" key strategy and is out of scope for this fix. The scheduler (`price_update_job.go` at 15 min) already pre-warms prices. The 5-minute cache window is sufficient to absorb reload bursts.

### FR-5: Cache TTL Configuration

The aggregate cache TTL must be configurable via a constant (not hardcoded inline). Use `5 * time.Minute` matching the frontend `staleTime`.

**Acceptance criteria:**
- [ ] `AllGoldPricesCacheTTL`, `AllSilverPricesCacheTTL`, `AllCurrencyPricesCacheTTL` constants defined in `pkg/cache/`
- [ ] All set to `5 * time.Minute`

## Non-Functional Requirements

- **Performance:** Cache read adds <1ms latency (Redis local call). No external API call if cache is warm.
- **Correctness:** Aggregate cache stores a JSON-serialized `[]CachedGoldPrice` / `[]CachedSilverPrice` / `[]CachedCurrencyPrice` — same types as individual cache entries.
- **Reliability:** Cache write failure must not block the response (non-fatal, log warning).
- **No new dependencies:** Use existing `pkg/cache` Redis client and JSON serialization patterns.
- **No API changes:** No proto changes, no new endpoints, no frontend changes.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md`** — No structural change (services already shown with Redis). Add note in `GoldPriceService`, `SilverPriceService`, `CurrencyPriceService` descriptions: "FetchAllPrices uses aggregate Redis cache key".
- No new components or containers — this is an internal caching optimization.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-watchlist.md`** — Update the "list+enrich" flow description if it references price service calls to note the aggregate cache path.

**Add to `flow-cross-cutting.md`** — Add a new `FetchAllPrices Cache Flow` sequence diagram showing:
- Cache hit path (Redis → return)
- Cache miss path (Redis miss → external API → cache write → return)
- Error path (external API error, no cache → propagate error)

## Data Model Changes

No database changes. Redis key additions only:

| Key | Type | TTL | Value |
|-----|------|-----|-------|
| `gold_price:all` | string (JSON) | 5 min | `[]CachedGoldPrice` |
| `silver_price:all` | string (JSON) | 5 min | `[]CachedSilverPrice` |
| `currency_price:all` | string (JSON) | 5 min | `[]CachedCurrencyPrice` |

## API Changes

None — no proto changes, no endpoint changes, no frontend changes.

## UI/UX Changes

None — this is a pure backend caching fix.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Frontend (browser) | GET /api/v1/investments/market-prices | Yes: Internet → App | MarketPricesHandler | JWT auth required |
| 2 | MarketPricesHandler | FetchAllPrices() call | No | GoldPriceService | Internal call |
| 3 | GoldPriceService | Redis GET `gold_price:all` | No | Redis (internal) | Cache read |
| 4 | GoldPriceService | HTTP GET vangsaigon API | Yes: App → External API | vangsaigon.vn | Only on cache miss |
| 5 | GoldPriceService | Redis SET `gold_price:all` | No | Redis (internal) | Cache write |
| 6 | GoldPriceService | `[]CachedGoldPrice` | No | MarketPricesHandler | Internal return |
| 7 | MarketPricesHandler | JSON response | Yes: App → Internet | Frontend | Price data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User HTTP requests | JWT middleware (existing) |
| App → External API | vangsaigon HTTP calls | None (public API); rate limiting mitigated by cache |
| App → Redis | Cache read/write | Internal network; existing Redis auth |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1 | Internet → App | DoS | Rapid page reloads exhaust vangsaigon rate limit | Medium | **This fix** — aggregate cache prevents repeated API calls |
| T-2 | 4 | App → External API | Tampering | Malicious data from compromised vangsaigon API | Low | Prices are display-only (not used for financial transactions); no user funds at risk |
| T-3 | 5 | Redis write | Tampering | Redis cache poisoning if Redis is exposed | Low | Redis is internal-only; existing network controls apply |
| T-4 | 7 | App → Internet | Info Disclosure | Price data returned to unauthorized user | Low | JWT auth on endpoint (existing); price data is not personal/sensitive |

### Authorization Rules

- No change — endpoint remains JWT-authenticated (existing middleware). The cache operates server-side and is not user-scoped (prices are global market data).

### Input Validation Rules

- No new inputs. Cache key is hardcoded constant — no injection risk.

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|-----------|
| vangsaigon.vn API | Rate limiting, downtime | **This fix** reduces calls via cache; error propagated to caller on miss |
| Redis | Unavailable | Cache write/read errors are logged as warnings; service still functions (cache miss path) |

### Sensitive Data Handling

Price data is public market data — not personal, not financial transactions. No PII, no monetary balances. Low sensitivity.

### Issues & Risks Summary

1. **Cache key collision:** `gold_price:all` is a new key — must verify it doesn't conflict with existing `gold_price:<symbol>` pattern. Confirmed: `buildKey(symbol)` produces `gold_price:<symbol>` so `gold_price:all` is distinguishable.
2. **Stale data on refresh:** Users who click "Refresh" will get cached data for up to 5 min. Acceptable — gold prices update every 15 min by the scheduler anyway.
3. **Silver service has multiple sources (Phú Quý, Ancarat, DOJI, Yahoo Finance):** The aggregate cache must store the fully assembled result (including SBJ static rows), not raw per-source data.

## Edge Cases & Error Handling

| Case | Expected Behavior |
|------|------------------|
| Redis unavailable on read | Cache miss — proceed to API call. Log warning. |
| Redis unavailable on write | Log warning. Return result from API anyway. |
| External API error, cache warm | Return cached data (within TTL — key still exists). |
| External API error, cache cold | Return error to caller (existing behavior). |
| Partial silver source failure (e.g., Phú Quý down) | Build best-effort result (existing behavior); cache that partial result. |
| `gold_price:all` key exists with 0 items | Return empty slice — valid cached response. |

## Dependencies & Assumptions

- Redis 7 is running and accessible (existing requirement).
- `pkg/cache/gold_price_cache.go`, `silver_price_cache.go`, `currency_price_cache.go` will each get a new `GetAll` / `SetAll` method pair — following the existing `Get`/`Set` pattern.
- No changes to `handlers/market_prices.go` — the fix is entirely in the service layer.
- No proto changes required.

## Out of Scope

- Stale-while-revalidate pattern (serve stale on API error) — too complex for this fix.
- Per-user cache (prices are global market data).
- Frontend `staleTime` adjustment (already set to 5 min, matching the new server-side TTL).
- Rate limiting middleware on the `/api/v1/investments/market-prices` endpoint.
- Watchlist enrichment path (`watchlist_service.go`) — the watchlist uses individual `FetchPriceForSymbol()` calls which already check per-symbol cache; not affected.
