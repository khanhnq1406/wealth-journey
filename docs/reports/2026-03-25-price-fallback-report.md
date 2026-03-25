# Gold & Currency Price Fallback System — Implementation Report

**Feature:** Gold & Currency Price Fallback
**Branch:** `feat/price-fallback`
**Date:** 2026-03-25
**Status:** Complete — all 15 tasks done, 0 lint issues, all tests green

---

## 1. Problem Statement

The gold and currency price services previously depended on a single external API (`vangsaigon.vn` via the `pkg/vnprice` client). When that source went down, the entire price pipeline failed — portfolio valuations returned errors, watchlist enrichment broke, and the Prices page showed 503. There was no fallback and no stale-data safety net beyond the regular 5-minute Redis cache.

---

## 2. Solution Overview

A **multi-source waterfall fallback chain** with Redis-backed source health tracking and a 1-hour emergency cache. When the primary source fails, the system automatically tries the next source. If all live sources fail, it serves stale emergency cache data rather than returning an error.

**Gold chain:** vangsaigon → vang.today → BTMC (optional, requires `BTMC_API_KEY`)
**Currency chain:** vangsaigon → vang.today

The API response format is **identical** regardless of which source provides the data — callers see no difference.

---

## 3. Architecture

### New Components

```
pkg/
├── vangtoday/          NEW — HTTPS JSON client for vang.today API
│   ├── client.go           HTTP client, 1MB body limit, price normalization
│   └── types.go            API response structs
│
└── btmc/               NEW — HTTP XML client for BTMC API
    ├── client.go           XML parser, 1MB limit, xml.Decoder guard (XML bomb)
    └── types.go            XML response structs + type-code mapping

domain/service/
├── price_fetcher.go    NEW — interfaces + waterfall + health adapter
│   ├── GoldPriceFetcher        interface (FetchGoldPrices, Source)
│   ├── CurrencyPriceFetcher    interface (FetchCurrencyPrices, Source)
│   ├── SourceHealthTracker     interface (IsHealthy, MarkUnhealthy)
│   ├── WaterfallGoldFetcher    priority-ordered source iteration
│   ├── WaterfallCurrencyFetcher
│   └── sourceHealthCacheAdapter  bridges pkg/cache → SourceHealthTracker
│
├── gold_fetcher_vangsaigon.go  NEW — vangsaigon gold adapter
├── gold_fetcher_vangtoday.go   NEW — vang.today gold adapter
├── gold_fetcher_btmc.go        NEW — BTMC gold adapter
├── currency_fetcher_vangsaigon.go  NEW — vangsaigon currency adapter
└── currency_fetcher_vangtoday.go   NEW — vang.today currency adapter

pkg/cache/
├── source_health_cache.go  NEW — Redis health flag (TTL=2min, fail-open)
├── gold_price_cache.go     MODIFIED — added SetEmergency/GetEmergency (TTL=1h)
└── currency_price_cache.go MODIFIED — added SetEmergency/GetEmergency (TTL=1h)
```

### Modified Components

| File | Change |
|------|--------|
| `domain/service/gold_price_service.go` | Replaced single `vnprice.Client` with `WaterfallGoldFetcher`; 4-step flow |
| `domain/service/currency_price_service.go` | Replaced single `vnprice.Client` with `WaterfallCurrencyFetcher`; 4-step flow |
| `domain/service/services.go` | Read `BTMC_API_KEY` env var; added startup warning when absent |
| `handlers/builder.go` | Updated all `NewGoldPriceService` call sites |
| `docs/architecture/c4-context.md` | Added vang.today and BTMC as external systems |
| `docs/architecture/c4-component-backend.md` | Updated GoldPriceService to show 3-source chain |
| `docs/architecture/flow-investment.md` | §5 waterfall nodes + updated Price Sources table |
| `docs/architecture/flow-cross-cutting.md` | §11 full waterfall sequence diagram; new §12 with flowchart + state machine |

---

## 4. Key Design Decisions

### 4.1 Last-Source Guarantee
The waterfall **always tries the last source** in the chain, regardless of health status. This prevents the pathological case where all sources are marked unhealthy simultaneously (e.g., after Redis restart) — the last fetcher is always attempted.

### 4.2 Fail-Open Health Tracker
`IsHealthy` returns `true` on any Redis error. This is intentional — it is safer to make an extra API call to a possibly-healthy source than to silently block it. The 2-minute TTL on health keys means a misbehaving source self-heals within one scheduler cycle.

### 4.3 Emergency Cache Freshness
The emergency cache is updated **on every successful fetch**, regardless of which source provided the data. This ensures the stale data served during a full outage is as recent as possible — at most 5 minutes old when the outage began, never more than 1 hour old.

### 4.4 Non-Blocking Cache Writes
Both regular and emergency cache writes happen in background goroutines. The fetch response is returned to the caller immediately, and cache failures are logged but never surface as errors.

### 4.5 BTMC API Key Optional
If `BTMC_API_KEY` is absent at startup, `NewGoldPriceService` logs a warning and runs with a 2-source chain. No panic, no config error. This avoids breaking existing deployments that haven't yet obtained a BTMC key.

### 4.6 Circular Import Prevention
`SourceHealthCache` in `pkg/cache` uses `string` (not `PriceSource`) to avoid a circular import with `domain/service`. The `sourceHealthCacheAdapter` in `price_fetcher.go` bridges the type — `PriceSource` is a `string` type alias so `string(source)` converts cleanly with zero runtime cost.

---

## 5. Request Flow

```
FetchAllPrices(ctx)
│
├── 1. Check gold_price:all (Redis, TTL=5min)
│      └── HIT → return immediately (no external call)
│
├── 2. Waterfall loop [vangsaigon, vang.today, BTMC]
│      ├── Is source healthy? (Redis, fail-open)
│      │      └── NO (and not last) → skip
│      ├── Fetch with 5s context timeout
│      │      ├── SUCCESS → write caches async, return data
│      │      └── FAIL → mark unhealthy (2min), try next
│      └── All failed → step 3
│
├── 3. Check gold_price:emergency (Redis, TTL=1h)
│      ├── HIT → log warning, return stale data
│      └── MISS → step 4
│
└── 4. Return error (propagated to handler → 503)
```

---

## 6. Test Coverage

### Unit Tests (84 total across the feature)

| Package / File | Tests | Notes |
|----------------|-------|-------|
| `pkg/vangtoday/client_test.go` | ~12 | httptest server: valid JSON, HTTP 500, invalid JSON, timeout, zero prices, body > 1MB |
| `pkg/btmc/client_test.go` | ~14 | httptest server: valid XML, invalid XML, missing API key, body > 1MB, price parsing |
| `pkg/cache/source_health_cache_test.go` | ~6 | fresh=healthy, mark unhealthy, TTL expiry, Redis error fail-open |
| `pkg/cache/emergency_cache_test.go` | ~8 | SetEmergency/GetEmergency for gold and currency |
| `domain/service/price_fetcher_test.go` | ~12 | waterfall order, unhealthy skip, last-always-tried, all-fail error |
| `domain/service/gold_fetcher_vangsaigon_test.go` | ~6 | VND×1000, USD×100, Source() |
| `domain/service/gold_fetcher_vangtoday_test.go` | ~6 | field mapping, ChangeBuy/ChangeSell |
| `domain/service/gold_fetcher_btmc_test.go` | ~5 | type-code mapping, Source(), empty apiKey |
| `domain/service/currency_fetcher_vangsaigon_test.go` | ~8 | raw VND, Source() |
| `domain/service/currency_fetcher_vangtoday_test.go` | ~6 | field mapping, Source() |
| `domain/service/gold_price_service_test.go` | 10 | aggregate cache hit, waterfall success, fallback chain, emergency cache, symbol lookup |
| `domain/service/currency_price_service_test.go` | 5 | aggregate cache hit, primary success, fallback, emergency, expired emergency |

All tests are **hermetic**: no real Redis (miniredis in-process), no real HTTP (httptest.Server or function injection). The `-short` flag is respected — no external calls.

---

## 7. Security Notes

| Threat | Mitigation |
|--------|------------|
| T-1: Manipulated prices | `pkg/vangtoday` and `pkg/btmc` reject zero/negative Buy or Sell values |
| T-2: DNS hijacking | vang.today: HTTPS (Go default TLS). BTMC: HTTP only (public price data, documented) |
| T-3: XML bomb | `pkg/btmc`: `io.LimitReader(1MB)` + `xml.NewDecoder` with explicit token reading |
| T-4: Slow-loris DoS | All fetchers use `context.WithTimeout(5s)` per source |
| T-5: API key exposure | `BTMC_API_KEY` read from environment variable only — never hardcoded |
| T-6: Repudiation | Every source attempt logs source name, success/failure, latency, and error |
| T-7: Architecture violation | `depguard` lint rule: service layer does not import `go-redis` directly — `SourceHealthCache` stays in `pkg/cache`, bridged by adapter |

---

## 8. CI Results

```
golangci-lint:  0 issues
go build ./...: clean (no output)
go test -short ./...: all packages green

Key package results:
  ok  wealthjourney/domain/service  1.691s   (15 new tests)
  ok  wealthjourney/pkg/btmc        (cached)
  ok  wealthjourney/pkg/vangtoday   (cached)
  ok  wealthjourney/pkg/cache       (cached)
  ok  wealthjourney/handlers        3.328s
```

---

## 9. Deployment Notes

**New environment variable (optional):**

| Variable | Required | Description |
|----------|----------|-------------|
| `BTMC_API_KEY` | No | Enables BTMC as tertiary gold source. If absent, gold runs with 2-source chain. Startup warning logged. |

No database migrations required. No proto changes. No frontend changes.

---

## 10. Commit History

| Commit | Tasks | Description |
|--------|-------|-------------|
| `0c11373` | 0 | C4 diagrams: add vang.today + BTMC as external systems |
| `c8418ad` | 1–3 | PriceFetcher interfaces, waterfall, health tracker, emergency cache |
| `81fd21a` | 4–5 | `pkg/vangtoday` and `pkg/btmc` HTTP clients |
| `f16a3fe` | 6–9 | 5 source adapters (vangsaigon gold/currency, vangtoday gold/currency, BTMC gold) |
| `7518ddf` | 10–11 | Refactor gold + currency services to use waterfall; 15 service tests |
| `7ba5e65` | 12–13 | DI wiring complete; lint=0, all tests green |
| `ccbb84c` | 14 | Runtime flow diagrams updated |
| `1941fba` | — | Progress tracker finalised |

---

## 11. Files Changed (Summary)

- **New files:** 21 (10 implementation, 11 test)
- **Modified files:** 8
- **Deleted files:** 0
- **Total diff:** +4,461 / −269 lines
- **No proto changes, no frontend changes, no DB migrations**
