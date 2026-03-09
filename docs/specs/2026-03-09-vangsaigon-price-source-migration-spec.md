# vangsaigon.vn Price Source Migration Specification

## Summary

The current gold and silver price data source (`https://services.vang247.vn/ws-prices/api/v1/c_prices`) has broken its API — the response no longer contains valid price data (all arrays are empty or the structure changed). The `TestClient_FetchPrices` test confirms this: gold prices empty, silver prices empty, XAUUSD missing.

`vangsaigon.vn` exposes an identical REST endpoint at `https://vangsaigon.vn/ws-prices/api/v1/c_prices` that returns the exact same JSON structure with live, correct data. The migration is a **single constant change** in `pkg/vang247/client.go` plus updating the test to use the new URL.

Additionally, `vangsaigon.vn` exposes a WebSocket at `wss://vangsaigon.vn/ws-prices/ws/v1/prices` for real-time push updates. This spec covers both the immediate fix (REST URL migration) and evaluates the WebSocket option. The recommendation is to start with the REST URL change (minimal risk, immediate fix) and optionally add WebSocket support as a future enhancement.

## User Stories

- As a user on the market prices page, I want to see current gold and silver prices, so I can track my portfolio's value
- As a developer, I want the price service to recover gracefully if the primary source fails, so that the app stays functional

## Functional Requirements

### FR-1: Migrate REST Base URL

Replace `https://services.vang247.vn/ws-prices/api/v1/c_prices` with `https://vangsaigon.vn/ws-prices/api/v1/c_prices` as the price source.

**Acceptance criteria:**
- [ ] `pkg/vang247/client.go` `BaseURL` constant points to vangsaigon.vn
- [ ] `TestClient_FetchPrices` passes — gold prices non-empty, silver prices non-empty, XAUUSD present
- [ ] Market prices endpoint `/api/v1/investments/market-prices` returns correct data
- [ ] No changes to the JSON parsing logic (structure is identical)

### FR-2: Update Package Name / Documentation (Optional)

The package is currently named `vang247` — with the new source being vangsaigon.vn, this creates a naming inconsistency. The package can be renamed to `vnprice` or `precious_metals` to decouple it from any specific vendor.

**Acceptance criteria (if in scope):**
- [ ] Package renamed in all files
- [ ] All imports updated across the codebase

> **Decision needed from user:** Rename package or leave as-is for now?

### FR-3: WebSocket Option (Future Enhancement — Out of Scope for This PR)

`wss://vangsaigon.vn/ws-prices/ws/v1/prices` streams real-time price pushes without polling. The server pushes a full prices message whenever prices change.

Advantages of WebSocket:
- Real-time prices (sub-second updates vs 15-minute cache TTL)
- Reduced server load (no polling every 15 minutes)
- Lower latency on the prices page

Disadvantages:
- Persistent WebSocket connections from a Vercel serverless function are **not supported** (functions are stateless, ephemeral)
- Would require a dedicated long-running process (separate from Vercel deployment) or client-side WebSocket from the browser
- Significantly higher implementation complexity
- The current architecture (poll-on-request + Redis cache) works fine for the use case

**Recommendation:** Keep the REST + Redis cache architecture. The WebSocket stream is designed for browser-side real-time dashboards (like vangsaigon.vn itself), not for server-side polling backends.

## Non-Functional Requirements

- **Reliability:** If vangsaigon.vn also breaks in the future, add a fallback mechanism (future work)
- **Performance:** No change (same REST + Redis cache architecture)
- **Security:** Same — no authentication on the price API, no sensitive data exposed

## Architecture Changes (C4)

### Diagrams to Update

**`docs/architecture/c4-component-backend.md`** — Update the external price source label from "vang247.vn API" to "vangsaigon.vn API" in the `Vang247Client` component's dependency arrow.

No new components — this is a configuration change, not a structural change.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None needed — the `flow-investment.md` market price update flow is unchanged. Only the external URL changes.

## Data Model Changes

None.

## API Changes

None — all existing REST endpoints and proto definitions remain identical.

## UI/UX Changes

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | vangsaigon.vn REST API | Gold/silver prices (JSON) | Yes: Internet → App | `pkg/vang247` Client | HTTPS, no auth |
| 2 | `pkg/vang247` Client | Parsed price structs | No | `GoldPriceService` / `SilverPriceService` | Internal Go call |
| 3 | Price services | `CachedGoldPrice` / `CachedSilverPrice` | No | Redis Cache | Internal |
| 4 | Price services | `CachedGoldPrice` / `CachedSilverPrice` | No | `MarketPricesHandler` | Internal |
| 5 | `MarketPricesHandler` | `PriceItem` JSON array | Yes: App → Browser | Frontend client | HTTPS, JWT-authenticated |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App (inbound) | User requests to `/api/v1/investments/market-prices` | JWT middleware |
| App → Internet (outbound) | HTTPS GET to vangsaigon.vn | TLS (HTTPS), no auth token needed |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | App → Internet | Tampering | Man-in-the-middle on price data | Low | HTTPS/TLS enforced |
| T-2 | 1 | App → Internet | Denial of Service | vangsaigon.vn goes down (same as current vang247 issue) | Medium | Redis cache serves stale data; log warning; return empty array gracefully |
| T-3 | 1 | App → Internet | Information Disclosure | IP of backend server exposed to vangsaigon.vn via outbound request | Low | Acceptable — no sensitive data in the request |
| T-4 | 1 | App → Internet | Elevation of Privilege | Malicious price data injection from vangsaigon.vn | Low | Prices are display-only; no price data affects financial calculations directly |

### Authorization Rules

No change — market prices endpoint requires valid JWT (existing middleware).

### Input Validation Rules

No change — the price values are parsed as `float64` and converted to `int64`. No user-controlled input in this flow.

### External Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|-----------|
| vangsaigon.vn REST API | Same availability risk as vang247 — if they change API structure again, prices break | Redis cache serves stale data up to 15 min; graceful degradation returns empty arrays |
| vangsaigon.vn trust level | Unknown operator; public Vietnamese gold price aggregator site | Prices are informational display only; no financial operations are automatically triggered by these prices |

### Sensitive Data Handling

No sensitive data involved. Price data is public market information.

### Issues & Risks Summary

1. **vangsaigon.vn may also change/break** — same fragility as vang247. Long-term, consider multi-source resilience.
2. **Package name `vang247` is now misleading** — rename deferred to minimize scope.
3. **WebSocket approach not viable for Vercel serverless** — REST polling remains the right architecture.

## Edge Cases & Error Handling

- If vangsaigon.vn returns 4xx/5xx: error propagates to `MarketPricesHandler`, which returns empty `[]` for that price category (existing behavior)
- If vangsaigon.vn returns malformed JSON: parse error logged, empty response returned
- Redis cache miss + API failure: returns error (existing behavior, handler converts to empty array)

## Dependencies & Assumptions

- `vangsaigon.vn/ws-prices/api/v1/c_prices` returns identical JSON structure as `vang247.vn` — **confirmed via live test on 2026-03-09**
- No authentication or API key required
- HTTPS supported

## Out of Scope

- WebSocket (`wss://vangsaigon.vn/ws-prices/ws/v1/prices`) implementation
- Adding a secondary fallback price source
- Renaming the `vang247` package
- Any frontend changes
