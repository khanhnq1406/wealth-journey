# Gold & Currency Price Fallback System Specification

## Summary

When the primary price API (vangsaigon.vn / vang247) is down, **all gold and currency price features break** — the market prices page shows empty, portfolio valuations stall, and the landing page TTFB spikes to 32+ seconds. This feature adds a multi-source fallback chain for gold and currency prices, so the system degrades gracefully by trying alternative sources in priority order with aggressive timeouts. Silver prices are already resilient (3 independent sources) and are out of scope.

## User Stories

- As a user, I want to see gold prices even when the primary data source is down, so that I can track my gold investments without interruption.
- As a user, I want to see currency exchange rates even when the primary data source is down, so that my multi-currency portfolio valuations remain accurate.
- As a user, I want prices to load quickly (< 10s) even during outages, so that the app feels responsive regardless of upstream API health.

## Functional Requirements

### FR-1: Waterfall Fallback Chain for Gold Prices

The gold price service must try multiple sources in priority order with aggressive per-source timeouts.

**Fallback chain:**
1. **vangsaigon.vn** (current primary) — timeout: 5 seconds
2. **vang.today API** (`www.vang.today/api/prices`) — timeout: 5 seconds
3. **BTMC API** (`api.btmc.vn/api/BTMCAPI/getpricebtmc`) — timeout: 5 seconds

If source N fails (timeout, HTTP error, parse error), immediately try source N+1. Total worst-case latency: ~15 seconds (3 sources × 5s each).

**Acceptance criteria:**
- [ ] When vangsaigon is down, vang.today is tried within 5 seconds
- [ ] When both vangsaigon and vang.today are down, BTMC is tried
- [ ] When a source returns invalid/unparseable data, it counts as a failure and the next source is tried
- [ ] The response format to the frontend is identical regardless of which source provided the data
- [ ] Existing per-symbol and aggregate cache behavior is preserved
- [ ] Source failures are logged with source name, error type, and duration

### FR-2: Waterfall Fallback Chain for Currency Prices

The currency price service must follow the same fallback pattern.

**Fallback chain:**
1. **vangsaigon.vn** (current primary) — timeout: 5 seconds
2. **vang.today API** (same endpoint includes currency data) — timeout: 5 seconds

BTMC does not provide currency data, so the currency chain is shorter.

**Acceptance criteria:**
- [ ] When vangsaigon is down, vang.today currency data is used
- [ ] Currency data format matches existing `CachedCurrencyPrice` struct
- [ ] Cache behavior identical to current implementation

### FR-3: vang.today Client Integration

Add a new client in `pkg/vnprice/` (or alongside existing client) that calls the vang.today API directly.

**API details:**
- Endpoint: `GET https://www.vang.today/api/prices`
- Auth: None required
- Format: JSON
- Fields: `type_code`, `buy`, `sell`, `change_buy`, `change_sell`, `update_time`
- Coverage: SJC, DOJI, PNJ, Bao Tin, XAU/USD + currency rates

**Acceptance criteria:**
- [ ] Client fetches and parses vang.today JSON response
- [ ] Response is normalized to the same `GoldPrice` / `CurrencyPrice` structs used by the vangsaigon client
- [ ] 5-second timeout enforced via `context.WithTimeout`
- [ ] HTTP errors (non-200) return a typed error

### FR-4: BTMC Client Integration

Add a new client in `pkg/btmc/` that calls the Bao Tin Minh Chau official API.

**API details:**
- Endpoint: `GET http://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=3kd8ub1llcg9t45hnoh8hmn7t5kc2v`
- Auth: Public API key in query string (officially published by BTMC)
- Format: XML
- Fields per row: `n_1` (name), `k_1` (karat), `h_1` (purity %), `pb_1` (buy), `ps_1` (sell), `pt_1` (world price), `d_1` (timestamp)
- Coverage: SJC bars, BTMC branded gold, rings, jewelry (8 categories)

**Acceptance criteria:**
- [ ] Client fetches and parses BTMC XML response
- [ ] Response is normalized to `GoldPrice` structs with consistent type codes
- [ ] BTMC type codes are mapped to match existing vangsaigon type codes where possible (e.g., SJC bars → same type code)
- [ ] Unknown BTMC-only types are included with BTMC-prefixed type codes
- [ ] 5-second timeout enforced
- [ ] API key is stored in environment variable `BTMC_API_KEY` (not hardcoded)
- [ ] XML parsing uses Go's `encoding/xml` (no third-party dependency)

### FR-5: Stale Cache as Last Resort (1-Hour Emergency Cache)

When ALL live sources fail and the regular cache is expired, serve stale data up to 1 hour old.

**Implementation:**
- Add a separate "emergency cache" key with 1-hour TTL alongside the regular cache
- Emergency cache is written on every successful fetch (same data as regular cache, longer TTL)
- Emergency cache is ONLY read when all live sources fail AND regular cache is expired

**Acceptance criteria:**
- [ ] Emergency cache key: `gold_price:emergency`, `currency_price:emergency` with 1-hour TTL
- [ ] Emergency cache is updated on every successful fetch from any source
- [ ] Emergency cache is only consulted after all sources in the fallback chain fail
- [ ] When emergency cache is served, a warning is logged: "Serving stale emergency cache (age: Xm)"
- [ ] When emergency cache is also expired (> 1 hour), return error (current behavior)

### FR-6: Source Health Tracking

Track which sources are healthy to enable faster failover on subsequent requests.

**Implementation:**
- After a source fails, mark it as "unhealthy" in Redis with a short TTL (e.g., 2 minutes)
- On the next request, skip known-unhealthy sources and jump to the next one
- This reduces latency from 15s (3 × 5s timeout) to 5s (1 healthy source) during sustained outages
- When the TTL expires, the source is retried (self-healing)

**Acceptance criteria:**
- [ ] Health status key: `price_source_health:<source_name>` with 2-minute TTL
- [ ] Unhealthy sources are skipped in the fallback chain
- [ ] At least one source is always tried (never skip all)
- [ ] Health status is per-source, not global

## Non-Functional Requirements

- **Latency**: When primary source is healthy, zero additional latency (same as current). When primary is down, response within 10 seconds (one fallback timeout + processing).
- **Availability**: Price data available as long as at least 1 of 3 gold sources is up, or within 1 hour of last successful fetch.
- **No new frontend changes**: The API response format stays identical. Frontend code is unaffected.
- **Backward compatible**: If only vangsaigon is configured (no BTMC key), the system works with reduced fallback chain.
- **Observability**: Each source attempt is logged with source name, success/failure, latency, and error details.

## Architecture Changes (C4)

### Diagrams to Update

**L1 Context (`c4-context.md`):**
- Add "vang.today Price API" as an external system
- Add "BTMC Price API" as an external system
- Both connect to WealthJourney with "Fetches gold/currency prices [HTTPS]"

**L3 Backend Components (`c4-component-backend.md`):**
- Update GoldPriceService to show fallback chain dependency on 3 external sources
- Update CurrencyPriceService similarly
- Add `btmc` package in pkg layer

### New Diagrams

No new L4 code diagram needed — the fallback logic lives within existing services.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-investment.md`** — Update the "market price update" sequence diagram to show the fallback chain:
- Current: GoldPriceService → vangsaigon API
- New: GoldPriceService → vangsaigon → (on fail) → vang.today → (on fail) → BTMC → (on fail) → emergency cache

### New Flow Diagrams

**Add to `flow-cross-cutting.md`** — "Price Fallback Chain" flowchart:
- Flowchart showing the waterfall decision logic
- Include health check bypass, emergency cache path
- Diagram type: `flowchart TD`

## Data Model Changes

No database schema changes. All changes are in the caching layer (Redis) and service layer.

**New Redis keys:**

| Key | TTL | Purpose |
|-----|-----|---------|
| `gold_price:emergency` | 1 hour | Emergency stale cache for gold prices |
| `currency_price:emergency` | 1 hour | Emergency stale cache for currency prices |
| `price_source_health:vangsaigon` | 2 min | Health status for vangsaigon |
| `price_source_health:vangtoday` | 2 min | Health status for vang.today |
| `price_source_health:btmc` | 2 min | Health status for BTMC |

## API Changes

**No API changes.** The `GET /api/v1/investments/market-prices` endpoint returns the same response format regardless of which source provided the data. This is a backend-only change.

## UI/UX Changes

**No UI changes.** The frontend already displays `updatedAt` timestamps per price item. When stale data is served, users see the original timestamp from the data source, which naturally communicates freshness.

### Existing Component Inventory

No new frontend components needed.

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price display | Already built | `app/[locale]/dashboard/prices/page.tsx` |
| Market prices hook | Already generated | `useQueryGetMarketPrices` in `utils/generated/hooks.ts` |

### New Components

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | vangsaigon.vn API | Gold/currency JSON | Yes: External API → App | GoldPriceService | Current flow, untrusted external data |
| 2 | vang.today API | Gold/currency JSON | Yes: External API → App | GoldPriceService | NEW — untrusted external data |
| 3 | BTMC API | Gold XML | Yes: External API → App | GoldPriceService | NEW — untrusted external data, XML format |
| 4 | GoldPriceService | Normalized prices | No (same tier) | Redis cache | Internal, trusted after validation |
| 5 | Redis cache | Cached prices | Yes: App → Cache store | GoldPriceService | Trusted (we wrote it) |
| 6 | GoldPriceService | Price response | Yes: App → Internet | Frontend (user) | Public price data, non-sensitive |
| 7 | GoldPriceService | Health status | No (same tier) | Redis | Boolean health flag |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| External API → App | Price data from 3 sources | Response validation, price range checks, timeout enforcement |
| App → Redis | Cache reads/writes | Redis auth, TLS, trusted internal network |
| App → Internet | Price response to users | JWT auth on endpoint, no sensitive data exposed |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2, 3 | External → App | Tampering | Malicious API response with manipulated prices (e.g., BTMC API compromised, returns gold price of 0 or 999B VND) | **High** | Price range validation: reject prices outside ±50% of last known good price. Log anomalies. |
| T-2 | 2, 3 | External → App | Spoofing | DNS hijacking — requests to vang.today or btmc.vn are redirected to attacker-controlled server | Medium | Use HTTPS for all external calls. Validate TLS certificates (Go's default). |
| T-3 | 3 | External → App | Injection | XML bomb / billion laughs attack in BTMC XML response | **High** | Use `xml.Decoder` with `MaxTokenSize` limit. Set max response body size (1 MB). |
| T-4 | 2, 3 | External → App | DoS | Slow-loris from external API — connection stays open, exhausts goroutines | Medium | Per-source 5-second context timeout. HTTP client with `Timeout` field. |
| T-5 | 5 | App → Redis | Info Disclosure | Emergency cache leaks stale prices to wrong user context | Low | Price data is public (not user-specific). No user data in cache. |
| T-6 | 2, 3 | External → App | Repudiation | Cannot prove which source provided a specific price at a given time | Low | Log source name + timestamp on every successful fetch. |
| T-7 | 6 | App → Internet | DoS | Attacker spams `/market-prices` to force repeated external API calls | Medium | Existing 5-minute aggregate cache prevents fan-out. Rate limiting on API endpoint. |

### Authorization Rules

No changes. The `GET /api/v1/investments/market-prices` endpoint is already authenticated (JWT middleware). Price data is the same for all users (public market data).

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| vang.today JSON response | External API response | Must have `type_code`, `buy`, `sell` fields; prices must be positive integers | JSON schema validation, price range check |
| BTMC XML response | External API response | Must parse as valid XML; `pb_1`/`ps_1` must be numeric; response < 1 MB | XML decoder with size limit, numeric validation, price range check |
| BTMC API key | Environment variable | Non-empty string | Startup validation — warn if missing, reduce fallback chain |

### External Dependency Risks

| External Service | Data Exchanged | Trust Level | Failure Impact | Compromise Impact | Mitigations |
|-----------------|----------------|-------------|----------------|-------------------|-------------|
| vangsaigon.vn (existing) | Gold/currency prices | Low (public data) | Try next source | Manipulated prices | Price range validation, fallback chain |
| vang.today (NEW) | Gold/currency prices | Low (public data) | Try next source | Manipulated prices | Price range validation, HTTPS, TLS verification |
| BTMC API (NEW) | Gold prices (XML) | Low (public data) | Try next source | Manipulated prices, XML bomb | Price range validation, XML size limit, HTTPS |

**New Go dependencies:** None. `encoding/xml` is in the standard library. No new npm packages.

### Sensitive Data Handling

No sensitive data involved. All price data is public market information. No user-specific data is fetched or cached in this feature.

### Issues & Risks Summary

1. **T-1: Price manipulation via compromised API** — Mitigated by price range validation (reject prices deviating > 50% from last known good). This is the highest risk.
2. **T-3: XML bomb from BTMC** — Mitigated by setting max response body size (1 MB) and using `xml.Decoder` with limits.
3. **Source data inconsistency** — Different sources may report slightly different prices for the same gold type (SJC). This is expected and acceptable — the user sees whichever source is available.
4. **BTMC type code mapping** — BTMC uses different product names than vangsaigon. The mapping must be maintained manually. If BTMC changes names, the mapping breaks silently (prices for some types disappear).
5. **vang.today availability correlation** — vang.today and vangsaigon may share the same backend infrastructure. If so, both fail together, reducing the effective fallback to BTMC only. This is acceptable since BTMC is genuinely independent.
6. **BTMC API key rotation** — The publicly documented key may be rotated without notice. Store in env var for easy rotation without code deploy.

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| vangsaigon down, vang.today up | Serve vang.today data, log vangsaigon failure |
| All 3 sources down, regular cache valid | Serve regular cache (5-minute TTL) |
| All 3 sources down, regular cache expired, emergency cache valid (< 1h) | Serve emergency cache, log warning with cache age |
| All 3 sources down, emergency cache expired (> 1h) | Return error (HTTP 503 for gold portion), silver and currency serve independently |
| Source returns HTTP 200 but invalid JSON/XML | Treat as failure, try next source |
| Source returns valid format but price = 0 or negative | Treat as failure (price range check), try next source |
| Source returns valid format but price deviates > 50% from last known | Log anomaly warning, still serve the data (do NOT reject — market volatility is possible during crises) |
| BTMC API key missing from env | Skip BTMC in fallback chain, log startup warning, operate with 2-source chain |
| Redis down | All cache operations fail gracefully (return nil), every request hits external APIs (existing behavior) |
| Network partition — app can reach some sources but not others | Waterfall handles this naturally — failing sources time out, working sources respond |

## Dependencies & Assumptions

**Dependencies:**
- vangsaigon.vn API continues to work as primary (no changes to current client)
- vang.today API remains free and unauthenticated
- BTMC API remains publicly accessible with the documented key
- Redis is available for caching (existing dependency)

**Assumptions:**
- vang.today and vangsaigon may share infrastructure (correlated failures expected)
- BTMC provides SJC bar prices that can be mapped to vangsaigon's type codes
- Gold prices don't change by more than 50% within a 1-hour emergency cache window
- The BTMC API key is stable (publicly documented, unlikely to rotate frequently)

## Out of Scope

- **Silver price fallback** — Already has 3 independent sources (Phu Quy, Ancarat, DOJI). Not needed.
- **Frontend changes** — API contract stays the same. No UI work.
- **cafef.vn or giavang.org integration** — Reserved for future iteration if the 2 fallbacks prove insufficient.
- **World gold (XAU/USD) fallback** — Currently served by Yahoo Finance, which is reliable. Out of scope.
- **Real-time WebSocket price streaming** — Different feature entirely.
- **Admin dashboard for source health monitoring** — Nice-to-have, but out of scope for v1.
- **Automatic source preference learning** — e.g., always prefer the fastest source. Waterfall with health checks is sufficient for now.
- **Price cross-validation** — e.g., comparing prices across sources to detect anomalies. Deferred to future iteration.
