# Landing Page Slow TTFB (32s) — Root Cause Analysis & Fix Specification

## Summary

The landing page (`/vi/landing`) takes **32.14 seconds** waiting for server response (TTFB). This is a production performance bug, not a feature. The page is an **async Server Component** that calls the backend API at render time. When the backend's Redis cache is cold (miss), the handler fans out to **three external APIs in parallel**, but each of those calls itself makes an uncached, synchronous HTTP request to a slow external Vietnamese price API (`vangsaigon.vn`). The 32-second wait is consistent with a network timeout or slow upstream API combined with zero graceful timeout enforcement at the Next.js SSR layer.

This spec covers root-cause investigation, proposed fixes, and acceptance criteria.

---

## User Stories

- As a visitor, I want the landing page to load in under 2 seconds, so that I don't abandon the site.
- As a visitor, I want to see gold/silver/currency type names immediately even if prices are delayed.
- As a site operator, I want the landing page to never block on external API calls, so that upstream slowness doesn't cause user-facing outages.

---

## Root Cause Analysis

### Request Chain (traced from browser → backend → external API)

```
Browser
  → Vercel Edge (Next.js middleware: locale detection, 308 redirects)
  → Next.js SSR: LandingPage (async Server Component)
      → fetchMarketTypes() ← THIS IS WHERE 32s IS SPENT
          → fetch(`${NEXT_PUBLIC_API_URL}/api/v1/public/market-types`)
              → Go backend: PublicHandler.GetPublicMarketTypes()
                  [3 goroutines in parallel via sync.WaitGroup]
                  ├── goldSvc.FetchAllPrices(ctx)
                  │     → cache.GetAll(ctx)  ← Redis lookup
                  │     → IF cache miss: vnprice.Client.FetchPrices()
                  │           → HTTP GET vangsaigon.vn/ws-prices/api/v1/c_prices (10s timeout)
                  ├── silverSvc.FetchAllPrices(ctx)
                  │     → cache.GetAll(ctx)  ← Redis lookup
                  │     → IF cache miss: vnprice.Client.FetchPrices() (SAME upstream call, 10s timeout)
                  └── currencySvc.FetchAllPrices(ctx)
                        → cache.GetAll(ctx)  ← Redis lookup
                        → IF cache miss: vnprice.Client.FetchPrices() (10s timeout)

  ← SSR blocks until ALL three resolve (wg.Wait())
  ← HTML + hydration sent to browser
```

### Identified Root Causes (in order of severity)

**RC-1 (PRIMARY): No server-side timeout on the SSR `fetch()` call**
- `landing/page.tsx` calls `fetch(url, { next: { revalidate: 300 } })` with **no `signal` or timeout**.
- If the Go backend hangs (e.g., Redis is unreachable and upstream API is slow), Next.js SSR waits indefinitely — explaining the 32s.
- `next: { revalidate: 300 }` is an **ISR hint, not a timeout**. It controls cache staleness, NOT request duration.

**RC-2 (HIGH): Cache miss causes synchronous fan-out to slow external API**
- Gold/silver/currency each call `cache.GetAll()`. On cache miss, all three call `vnprice.Client.FetchPrices()` — the **same** upstream URL (`vangsaigon.vn`).
- The vnprice client has a 10-second timeout. In worst case, 3 goroutines hitting the same slow API → any failure causes all 3 to timeout.
- The aggregate cache TTL is **5 minutes** (`AllGoldPricesCacheTTL`). After restart or cache eviction, the next request is cold.

**RC-3 (HIGH): Silver service makes additional Yahoo Finance calls**
- `silverPriceService.FetchAllPrices()` has additional calls to `phuquyClient`, `ancaratClient`, `dojiClient` and `yahoo.GetQuote()`.
- Each of these has its own network timeout. In the worst case, a silver USD cache miss adds another Yahoo Finance round trip (10s default timeout).

**RC-4 (MEDIUM): Two SSR fetches per landing page load in the layout chain**
- `landing/page.tsx` → `fetchMarketTypes()` (one backend call)
- `landing/layout.tsx` → `fetchSiteSettings()` (a second backend call to `/api/v1/public/site-settings`)
- Both are sequential in Next.js SSR (different segments of the layout tree) — the page does not stream them in parallel.

**RC-5 (MEDIUM): No stale-while-revalidate or short-circuit when backend is slow**
- The `LandingContent` component receives `initialData` from SSR but uses `usePublicMarketTypes()` on the client. If SSR already served data, the client refetch is redundant.
- More critically: when SSR hangs, **nothing** reaches the client until Go responds.

**RC-6 (LOW): Redis connectivity issues cause cascading slow path**
- If Redis is unreachable, `cache.GetAll()` returns an error (not nil), falling through to the external API.
- There is no circuit breaker or health check for Redis before attempting cache reads.

### Why 32 seconds specifically?
The most likely scenario: **Redis cache was cold + `vangsaigon.vn` was slow/unreachable**, causing all three goroutines to hit the 10s timeout sequentially (or the upstream itself took 32s without hitting the timeout). Since all three share the same upstream URL and the parallel goroutines all fail at the same time, the bottleneck is: `max(goldTimeout, silverTimeout, currencyTimeout)` — but if the upstream itself is just slow (not timing out), all three goroutines wait for it together, resulting in a single long wait.

---

## Functional Requirements

### FR-1: SSR fetch must have a hard timeout

The `fetchMarketTypes()` and `fetchSiteSettings()` calls in the Server Components must complete within **3 seconds maximum**. On timeout, return `null` (use fallback/static data).

**Acceptance criteria:**
- [ ] `fetchMarketTypes()` passes an `AbortController` signal with `setTimeout(3000)` to `fetch()`
- [ ] `fetchSiteSettings()` in `layout.tsx` passes the same 3s signal
- [ ] On timeout, both functions return `null` (not throw)
- [ ] The landing page renders with static fallback data when SSR fetch times out

### FR-2: Backend must enforce a request-scoped deadline for external API calls

The Go handler `GetPublicMarketTypes` must enforce a **5-second total deadline** (not per-goroutine) for the full external API fan-out. The Gin handler should derive a `context.WithTimeout` and pass it to all service calls.

**Acceptance criteria:**
- [ ] `GetPublicMarketTypes` wraps the request context with `context.WithTimeout(ctx, 5*time.Second)`
- [ ] All three service goroutines receive this deadline-bound context
- [ ] On deadline exceeded, each goroutine falls back to static registry (not error)
- [ ] Handler always returns within 5.1 seconds in the worst case

### FR-3: All three services (gold, silver, currency) must share a single external API call when the aggregate cache is cold

Currently, gold, silver, and currency each have their own `FetchAllPrices` which calls the same upstream URL separately. A cache miss causes 3 trips to the same API.

**Acceptance criteria:**
- [ ] A single upstream call to `vangsaigon.vn` fetches all prices at once (already the case via `vnprice.Client.FetchPrices()` which returns gold + silver + currency in one response)
- [ ] On cache miss, the backend makes exactly **1** call to the upstream URL, not 3 (via a shared "warm cache on first miss" pattern)
- [ ] The result is stored in the aggregate cache immediately

> **Note:** Looking at the code, `vnprice.Client.FetchPrices()` already fetches all three in one call. The issue is that gold, silver, and currency services each hold separate `*vnprice.Client` instances and each call `FetchPrices()` independently. On cache miss, 3 clients hit the same URL = 3 network calls (or at minimum 3 concurrent waits for the same slow server).

### FR-4: Landing page must render immediately with cached/static fallback

The landing page must never block the user for more than 3 seconds. If the backend is slow, it should:
1. Show the page with **static type names** (from static registries already in the code)
2. Load live prices on the client side via `usePublicMarketTypes` hook

**Acceptance criteria:**
- [ ] When SSR fetch returns `null`, `LandingContent` renders with empty arrays (already handled: `goldTypes = effectiveData?.gold ?? []`)
- [ ] Client-side React Query hook fetches prices independently after hydration
- [ ] Loading skeleton is shown while client-side fetch is in progress

### FR-5: Extend the aggregate cache warm-up via the background scheduler

The `price_update_job.go` runs every 15 minutes and refreshes per-user investment prices but does **NOT** warm the aggregate gold/silver/currency caches that the public landing page uses.

**Acceptance criteria:**
- [ ] Add a `PublicPriceWarmupJob` to the scheduler (or extend the existing price update job) that:
  - Calls `goldSvc.FetchAllPrices()`, `silverSvc.FetchAllPrices()`, `currencySvc.FetchAllPrices()` on a schedule
  - Runs every **5 minutes** (matching `AllGoldPricesCacheTTL`)
  - Logs success/failure but does not crash on external API failure

---

## Non-Functional Requirements

- **TTFB**: Landing page must achieve TTFB < 3 seconds in 95th percentile
- **Cache hit rate**: After warmup job runs once, >99% of landing page requests should be served from Redis cache
- **Graceful degradation**: Landing page must always render (even if empty tables) — never a blank page or 30s hang
- **Cold start**: After a backend restart, the first request should trigger cache warm-up asynchronously, NOT block the user
- **Security**: Timeout prevents DoS via slow upstream (slowloris-style resource exhaustion)

---

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend** (`c4-component-backend.md`): Add `PublicPriceWarmupJob` to the scheduler section
- **L3 Frontend** (`c4-component-frontend.md`): No changes needed (client hook already exists)

### New Diagrams

No new L4 diagram needed.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — Add a new sequence diagram: "Landing Page SSR with timeout + fallback"

Describe:
- Browser → Vercel → Next.js SSR → Go backend with 3s deadline
- Cache hit path (fast, <100ms)
- Cache miss path with timeout fallback to static data
- Client-side hydration with React Query refetch

**`flow-cross-cutting.md`** — Add: "Public price warmup job (5-minute interval)"

---

## Data Model Changes

No database changes required.

---

## API Changes

### Backend: `GET /api/v1/public/market-types`

**Change 1:** Add a 5-second `context.WithTimeout` inside `GetPublicMarketTypes` handler.

```go
// Before
ctx := c.Request.Context()

// After
ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
defer cancel()
```

**Change 2:** On timeout or error from `FetchAllPrices`, always fall back to static registry (already implemented for fallback when service is nil or err != nil, but NOT for context deadline exceeded — need to check for `errors.Is(err, context.DeadlineExceeded)`).

### Backend: New `PublicPriceWarmupJob` scheduler

```go
// internal/scheduler/public_price_warmup_job.go
type PublicPriceWarmupJob struct {
    goldSvc     service.GoldPriceService
    silverSvc   service.SilverPriceService
    currencySvc service.CurrencyPriceService
}

func (j *PublicPriceWarmupJob) Name() string            { return "public-price-warmup" }
func (j *PublicPriceWarmupJob) Interval() time.Duration  { return 5 * time.Minute }
func (j *PublicPriceWarmupJob) StartupDelay() time.Duration { return 10 * time.Second }
```

### Frontend: `landing/page.tsx` — Add fetch timeout

```typescript
// Before
const res = await fetch(`${apiUrl}/api/v1/public/market-types`, {
  next: { revalidate: 300 },
});

// After
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);
try {
  const res = await fetch(`${apiUrl}/api/v1/public/market-types`, {
    next: { revalidate: 300 },
    signal: controller.signal,
  });
  // ...
} catch {
  return null; // graceful fallback
} finally {
  clearTimeout(timeoutId);
}
```

### Frontend: `landing/layout.tsx` — Add fetch timeout to `fetchSiteSettings`

Same pattern as above: 3s AbortController.

---

## UI/UX Changes

No visible UI changes. The loading state is already handled: `showLoading = isLoading && !effectiveData` — when SSR returns null and client is loading, skeleton/loading states appear.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | GET /vi/landing | No (public page) | Vercel CDN → Next.js SSR | Public, no auth |
| 2 | Next.js SSR | GET /api/v1/public/market-types | Yes: Vercel → Railway (internet) | Go backend | No auth, rate limited by IP |
| 3 | Go backend | GET vangsaigon.vn | Yes: Railway → external internet | vangsaigon.vn API | No auth, external API |
| 4 | Go backend | Redis GET/SET | Yes: Railway → Redis (private VPC) | Redis cache | Internal, no auth needed |
| 5 | Next.js SSR | GET /api/v1/public/site-settings | Yes: Vercel → Railway | Go backend | No auth, rate limited |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Vercel | User browser | Vercel DDoS protection |
| Vercel → Railway | SSR fetch | IP allowlist (Railway) |
| Railway → external internet | Price API calls | HTTP client timeout |
| Railway → Redis | Cache R/W | Private network, no TLS needed |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|---------|--------|--------|---------|------------|
| T-1 | 2 | Vercel→Railway | DoS | Slow upstream API causes SSR thread pool exhaustion | High | Add 3s AbortController timeout in SSR fetch |
| T-2 | 3 | Railway→external | DoS | vangsaigon.vn is slow/down, goroutines blocked indefinitely | High | context.WithTimeout(5s) in handler |
| T-3 | 2 | Internet→Vercel | DoS | Attacker floods /vi/landing to exhaust SSR capacity | Medium | Already rate-limited by IP on Railway side; Vercel has its own protection |
| T-4 | 3 | Railway→external | Tampering | External API returns malformed JSON injected prices | Low | Strict JSON parsing, type assertions; not financial-critical (display only) |
| T-5 | 4 | Railway→Redis | Availability | Redis goes down, all caches miss, all SSR calls hit upstream | Medium | Fallback to static registry on any Redis error (already implemented) |

### Authorization Rules

- `/api/v1/public/*` — No authentication required. Rate limited by IP.
- No user data involved. No authorization gaps.

### Input Validation Rules

- SSR fetch receives only typed JSON responses. The `fetchMarketTypes()` already checks `res.ok` and `data?.success` before returning.
- No user input reaches the backend for this flow.

### External Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|-----------|
| `vangsaigon.vn` | Slow/down causes 32s TTFB | 5s context deadline + static fallback |
| Yahoo Finance (silver USD) | Rate limit / slow | Already has 10s timeout; silver USD not critical for landing types |
| Redis (Supabase) | Unreachable after restart | Static registry fallback; warmup job re-populates |

### Sensitive Data Handling

No sensitive data. All prices are public information.

### Issues & Risks Summary

1. **PRIMARY**: No SSR fetch timeout in `landing/page.tsx` and `landing/layout.tsx` — a single slow backend call blocks the entire page for up to 32s.
2. **HIGH**: `GetPublicMarketTypes` has no context deadline — when Redis is cold, all 3 goroutines wait for `vangsaigon.vn` for up to 10s each.
3. **HIGH**: Gold, silver, and currency services each instantiate their own `vnprice.Client` — a cold cache causes 3 independent HTTP calls to the same upstream URL instead of 1.
4. **MEDIUM**: No background warmup job for the aggregate public price cache — after any restart, the first user request is always cold.
5. **MEDIUM**: `fetchSiteSettings()` in `landing/layout.tsx` is a second blocking SSR call with no timeout.

---

## Edge Cases & Error Handling

| Scenario | Current Behavior | Target Behavior |
|----------|-----------------|----------------|
| Redis cold + upstream slow | 32s TTFB, page eventually loads | 3s timeout → SSR returns null → page renders with empty tables → client fetch loads data |
| Redis down | Fallback to static registries (correct) | Same — no change needed |
| Backend unreachable from Vercel | SSR fetch hangs until Node.js default 5min timeout | 3s AbortController → null → client-side React Query loads data |
| vangsaigon.vn returns 5xx | HTTP client returns error, handler returns static fallback | Same — timeout added prevents excessive wait |
| Cold start after deploy | First request triggers cache miss | Warmup job fires 10s after startup and pre-populates cache |

---

## Dependencies & Assumptions

- The `vnprice.Client.FetchPrices()` already fetches all gold + silver + currency in one API call. RC-3 is about 3 separate service instances calling it separately.
- The Railway deployment is in Southeast Asia (close to `vangsaigon.vn`). Round-trip should be <200ms when upstream is healthy.
- Redis is Supabase-hosted. After a cache hit, the handler response is <10ms.
- The `AllGoldPricesCacheTTL = 5 minutes` is correct for the use case.
- `NEXT_PUBLIC_API_URL` environment variable is always set in production.

---

## Proposed Fix Approaches

### Approach A: Minimal (Recommended for immediate production fix)
**Scope:** Only fix the Next.js SSR timeouts (FR-1). No backend changes.
- Add 3s AbortController to `fetchMarketTypes()` and `fetchSiteSettings()`
- Deploy to Vercel — **zero backend changes, zero risk, instant improvement**
- The client-side `usePublicMarketTypes()` hook will load data after hydration
- **Time to implement:** ~30 minutes
- **Risk:** Low — only changes two `try/catch` blocks in server components

### Approach B: Full Fix (Recommended for long-term)
**Scope:** FR-1 + FR-2 + FR-5
- Frontend: 3s timeout (Approach A)
- Backend: Add `context.WithTimeout(5s)` in `GetPublicMarketTypes`
- Backend: Add `PublicPriceWarmupJob` to scheduler (5-minute interval)
- **Time to implement:** ~3-4 hours
- **Risk:** Low-Medium — scheduler job is additive; timeout change is conservative

### Approach C: Architectural (Future optimization)
**Scope:** FR-3 — deduplicate upstream API calls on cold cache miss
- Share a single `vnprice.Client` across all three price services
- Use `singleflight.Group` to deduplicate concurrent cache misses
- **Time to implement:** ~1-2 days
- **Risk:** Medium — requires refactoring service constructors and DI wiring

**Selected approach for this spec: Approach B (Frontend + Backend timeout + Warmup job)**

---

## Out of Scope

- Reducing the aggregate cache TTL below 5 minutes (price data doesn't change that fast)
- Replacing `vangsaigon.vn` with a different upstream API
- Adding CDN caching in front of the `/api/v1/public/market-types` endpoint (valid future optimization)
- Streaming SSR with React Suspense (more complex refactor)
- The `singleflight` deduplication pattern (Approach C — future work)
