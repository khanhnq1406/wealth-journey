# Cross-Cutting Concerns — Runtime Flows

Infrastructure-level flows that are referenced by multiple domain flows. Read this document first to understand caching, API communication, and background processing patterns.

## Table of Contents

- [FX Rate Resolution Chain](#1-fx-rate-resolution-chain)
- [Frontend API Call Lifecycle](#2-frontend-api-call-lifecycle)
- [Background Scheduler Jobs](#3-background-scheduler-jobs)
- [Currency Conversion Logic](#4-currency-conversion-logic)
- [Market Prices Aggregation Flow](#5-market-prices-aggregation-flow)
- [Admin Price Override Flow](#6-admin-price-override-flow)
- [Price Alert Detection Flow](#7-price-alert-detection-flow)
- [Admin Broadcast Flow](#8-admin-broadcast-flow)
- [Admin Price Alert Config Flow](#9-admin-price-alert-config-flow)

---

## 1. FX Rate Resolution Chain

**Trigger:** Any service calls `FXRateService.GetRate(from, to)`
**Source:** `domain/service/fx_rate_service.go`

```mermaid
flowchart TD
    A["GetRate(from, to)"] --> B{Same currency?}
    B -- Yes --> C["Return 1.0"]
    B -- No --> D["Redis Cache\nfx_rate:FROM:TO"]

    D --> E{Cache hit?}
    E -- Yes --> F["Return cached rate"]
    E -- No --> G["PostgreSQL\nfx_rate table"]

    G --> H{DB record exists?}
    H -- No --> K["Fetch from Yahoo Finance\nSymbol: FROMTO=X"]
    H -- Yes --> I{"Fresh?\n(< 15 min)"}
    I -- Yes --> J["Update Redis async\nReturn DB rate"]
    I -- No --> K

    K --> L["Throttler.Wait()\n120 req/min limit"]
    L --> M["yahoo.GetQuote()"]
    M --> N{API success?}
    N -- Yes --> O["ValidateRate()\nCheck FxRanges bounds"]
    O --> P["Store in Redis (1h TTL)\nUpsert in PostgreSQL"]
    P --> Q["Return fresh rate"]

    N -- No --> R{Stale DB\nrecord exists?}
    R -- Yes --> S["Log warning\nReturn stale rate"]
    R -- No --> T["Return error"]:::error

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Same-currency requests (`USD→USD`) always return `1.0` without any lookup
- Redis TTL is 1 hour; DB freshness window is 15 minutes
- External API failures never crash the caller — stale cache is used as fallback
- Rate validation rejects values outside known bounds per currency pair (e.g., USD:VND must be 20,000–30,000)

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Redis miss | Fall through to DB | Transparent |
| DB record stale | Fall through to API | Transparent |
| Yahoo Finance timeout/error | Use stale DB rate | Logged warning |
| No cache at all + API failure | Return error | Caller handles |
| Rate outside valid range | Reject, retry | Use stale cache |

---

## 2. Frontend API Call Lifecycle

**Trigger:** Component calls a generated React Query hook
**Source:** `wj-client/utils/api-client.ts`, `wj-client/utils/generated/hooks.ts`

```mermaid
sequenceDiagram
    participant C as Component
    participant H as React Query Hook
    participant A as apiClient
    participant B as Backend API

    C->>H: useMutationCreateWallet() / useQueryListWallets()
    H->>A: apiClient.post/get(endpoint, data)

    activate A
    A->>A: getAuthToken()<br/>localStorage → in-memory cache
    A->>A: Build headers<br/>Authorization: Bearer {token}
    A->>B: fetch(url, options)

    alt 2xx Success
        B-->>A: JSON response
        A-->>H: Parsed response
        H-->>C: { data, isLoading: false }
    else 5xx / 408 / 429 (Retryable)
        B-->>A: Error response
        A->>A: Attempt 2 (wait 1s)
        A->>B: fetch(url, options)
        alt Still failing
            A->>A: Attempt 3 (wait 2s)
            A->>B: fetch(url, options)
            B-->>A: Error response
            A-->>H: ApiRequestError
            H-->>C: { error, isLoading: false }
        else Succeeds
            B-->>A: JSON response
            A-->>H: Parsed response
            H-->>C: { data, isLoading: false }
        end
    else 4xx Client Error (Not Retryable)
        B-->>A: Error response
        A->>A: parseErrorResponse()<br/>Extract message from body
        A-->>H: ApiRequestError(status, message)
        H-->>C: { error, isLoading: false }
    end
    deactivate A

    Note over C,H: Mutations: no auto-retry<br/>Queries: React Query manages cache + refetch
```

### Key Invariants

- Token is cached in-memory; `localStorage` read only on cold start or cache invalidation
- Mutations (`useMutation*`) have `retry: false` — no automatic retries
- Queries (`useQuery*`) are cached by `[EVENT_Name, payload]` key and managed by React Query
- Only 5xx, 408, and 429 responses trigger retry; all other 4xx errors fail immediately
- Exponential backoff: 1s, 2s, 3s (3 max attempts)

### Error Paths

| Condition | Retry? | User Impact |
|-----------|--------|-------------|
| Network failure | Yes (3x) | Spinner, then error toast |
| 401 Unauthorized | No | Redirect to login |
| 400 Bad Request | No | Show validation error |
| 500 Internal Server Error | Yes (3x) | Spinner, then error toast |
| 429 Rate Limited | Yes (3x) | Transparent retry with backoff |

---

## 3. Background Scheduler Jobs

**Trigger:** Application startup in `cmd/main.go`
**Source:** `internal/scheduler/scheduler.go`

```mermaid
flowchart LR
    subgraph Startup["App Startup"]
        S["ProvideScheduler()"]
        S --> Start["scheduler.Start(ctx)"]
    end

    Start --> KA["DB Keep-Alive\n⏱ ~2 min\n⏳ immediate"]
    Start --> PU["Price Update\n⏱ 15 min\n⏳ 5s delay"]
    Start --> PS["Portfolio Snapshot\n⏱ 1 hour\n⏳ 10s delay"]
    Start --> SC["Session Cleanup\n⏱ ~6 hours\n⏳ staggered"]
    Start --> FC["File Cleanup\n⏱ ~1 hour\n⏳ staggered"]
    Start --> PA["Price Alert\n⏱ 15 min\n⏳ 30s delay"]

    subgraph PriceUpdate["Price Update Job Detail"]
        PU --> PU1["List all users"]
        PU1 --> PU2["For each user:\ninvestmentSvc.UpdatePrices()"]
        PU2 --> PU3["Log: X updated, Y errors"]
    end

    subgraph PortfolioSnapshot["Portfolio Snapshot Job Detail"]
        PS --> PS1["List all users"]
        PS1 --> PS2["Filter: users with\nINVESTMENT wallets"]
        PS2 --> PS3["CreateAggregatedSnapshot()\nper user"]
        PS3 --> PS4["Log: X success, Y skip, Z errors"]
    end

    subgraph Shutdown["Graceful Shutdown"]
        CTX["ctx.Done()"] --> STOP["Stop all tickers"]
        STOP --> WAIT["wg.Wait()\nAll goroutines exit"]
    end
```

### Key Invariants

- Each job runs in its own goroutine with independent error handling
- Job failures are logged but never crash the scheduler or other jobs
- Startup delays prevent thundering herd on application boot
- `scheduler.Stop()` waits for all jobs to finish gracefully via `sync.WaitGroup`
- Conditional jobs (Session Cleanup, File Cleanup) only run if enabled via environment variables

### Job Configuration

| Job | Interval | Startup Delay | Condition |
|-----|----------|---------------|-----------|
| DB Keep-Alive | ~2 min | Immediate | Always |
| Price Update | 15 min | 5 sec | Always |
| Portfolio Snapshot | 1 hour | 10 sec | Always |
| Session Cleanup | ~6 hours | Staggered | `ENABLE_SESSION_CLEANUP` |
| File Cleanup | ~1 hour | Staggered | `ENABLE_FILE_CLEANUP` |
| Price Alert | 15 min | 30 sec | Redis available |

---

## 4. Currency Conversion Logic

**Trigger:** `FXRateService.ConvertAmount(ctx, amount, from, to)` or `ConvertAmountWithRate()`
**Source:** `domain/service/fx_rate_service.go`, `pkg/fx/validator.go`

```mermaid
flowchart TD
    A["ConvertAmount(amount, from, to)"] --> B{from == to?}
    B -- Yes --> C["Return amount unchanged"]
    B -- No --> D["GetRate(from, to)\n(see FX Resolution Chain)"]
    D --> E["GetDecimalMultiplier(from)\nGetDecimalMultiplier(to)"]

    E --> F["Lookup CurrencyDecimalPlaces"]
    F --> G{"Currency found?"}
    G -- Yes --> H["places = map value\n(0 or 2)"]
    G -- No --> I["Default: places = 2"]
    H --> J["multiplier = 10^places"]
    I --> J

    J --> K["Formula:\nresult = (amount / fromMult) * rate * toMult"]

    K --> L["Decimal precision via\nshopspring/decimal library"]
    L --> M["Round to int64"]
    M --> N["Return converted amount"]

    subgraph Multipliers["Decimal Multipliers"]
        direction LR
        M1["VND, JPY, KRW, IDR\n0 places → ×1"]
        M2["USD, EUR, GBP, SGD...\n2 places → ×100"]
    end
```

### Key Invariants

- All monetary values are stored as `int64` in the smallest currency unit (VND = whole dong, USD = cents)
- Conversion uses `shopspring/decimal` for arbitrary-precision arithmetic — no floating-point rounding errors
- Same-currency conversion is a no-op returning the input value
- Unknown currencies default to 2 decimal places (×100 multiplier)

### Conversion Examples

| Input | From | Rate | To | Calculation | Result |
|-------|------|------|----|-------------|--------|
| 4200 (cents) | USD (×100) | 25,850 | VND (×1) | (4200/100) × 25850 × 1 | 1,085,700 VND |
| 1,000,000 VND | VND (×1) | 0.0000387 | USD (×100) | (1000000/1) × 0.0000387 × 100 | 3,870 cents ($38.70) |
| 10,000 JPY | JPY (×1) | 172.5 | VND (×1) | (10000/1) × 172.5 × 1 | 1,725,000 VND |

---

## 5. Market Prices Aggregation Flow

**Trigger:** `GET /api/v1/investments/market-prices` (authenticated) or `GET /api/v1/public/market-types` (public)
**Source:** `handlers/market_prices.go`, `handlers/public.go`

```mermaid
sequenceDiagram
    participant C as Frontend
    participant H as MarketPricesHandler
    participant G as GoldPriceService
    participant S as SilverPriceService
    participant CR as CurrencyPriceService
    participant PQ as Phú Quý Client
    participant AN as Ancarat Client
    participant DJ as DOJI Client
    participant V as vangsaigon.vn
    participant R as Redis

    C->>H: GET /market-prices

    par Gold prices
        H->>G: FetchAllPrices(ctx)
        G->>R: Check cache
        alt Cache hit
            R-->>G: Cached gold prices
        else Cache miss
            G->>V: Fetch gold prices
            V-->>G: Gold price data
            G->>R: Cache async (15min TTL)
        end
        G-->>H: []*CachedGoldPrice
    and Silver prices (multi-source)
        H->>S: FetchAllPrices(ctx)
        par Phú Quý
            S->>PQ: FetchPrices(ctx)
            PQ-->>S: 4 silver prices (HTML)
        and Ancarat
            S->>AN: FetchPrices(ctx)
            AN-->>S: 4 silver prices (JSON)
        and DOJI
            S->>DJ: FetchPrices(ctx)
            DJ-->>S: 2 silver prices (text)
        end
        Note over S: Merge into 12 ordered rows:<br/>4 Phú Quý + 4 Ancarat + 2 SBJ (static) + 2 DOJI
        S->>R: Cache each price async
        S-->>H: []*CachedSilverPrice
    and Currency prices
        H->>CR: FetchAllPrices(ctx)
        CR->>R: Check cache
        alt Cache hit
            R-->>CR: Cached currency prices
        else Cache miss
            CR->>V: Fetch currency prices
            V-->>CR: Currency nationwide data
            CR->>R: Cache async (15min TTL)
        end
        CR-->>H: []*CachedCurrencyPrice
    end

    alt All three failed
        H-->>C: 503 Service Unavailable
    else Partial or full success
        Note over H: Empty slice for failed categories<br/>(never null)
        H-->>C: 200 {gold, silver, currency, timestamp}
    end
```

### Key Invariants

- Gold, silver, and currency are fetched in parallel via `sync.WaitGroup` — one failure does not block others
- Silver aggregates from 4 sources (Phú Quý, Ancarat, DOJI, SBJ); SBJ entries are static (prices = 0, displayed as "—")
- Currency prices come from vangsaigon's `currencyNationWide` field — raw VND values (no ×1000 multiplier)
- 503 is returned only if ALL THREE categories fail; partial success returns empty slices for failed categories
- All prices are cached in Redis with 15-minute TTL; cache writes are non-blocking goroutines

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| One category fails (e.g., silver) | 200 with empty `silver: []` | Other categories still returned |
| All three categories fail | 503 Service Unavailable | No fallback |
| Individual silver source fails (e.g., Phú Quý down) | Rows from that source omitted | Other sources still included |
| Redis cache write fails | Logged warning | Next request re-fetches from source |
| vangsaigon.vn timeout | Gold/currency return empty | Stale cache if available |

---

## 6. Admin Price Override Flow

Admin users can manually override buy/sell prices for any market price item (gold, silver, currency). Overrides are stored in Redis with no TTL and merged into the GetMarketPrices response at read time.

### 6a. Set Price Override

**Trigger:** Admin clicks the edit (pencil) icon on `InlinePriceEdit`, enters new buy/sell values, clicks save
**Endpoint:** `POST /api/v1/admin/price-overrides`
**Source:** `handlers/price_override.go`, `pkg/cache/price_override_cache.go`, `features/market-prices/components/InlinePriceEdit.tsx`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant RQ as React Query
    participant AM as AuthMiddleware
    participant ADM as AdminMiddleware
    participant PH as PriceOverrideHandler
    participant POC as PriceOverrideCache
    participant R as Redis
    participant MPH as MarketPricesHandler

    SPA->>SPA: Admin clicks edit pencil on InlinePriceEdit<br/>Pre-fills buy/sell inputs with current values
    SPA->>SPA: Admin modifies values, clicks save
    SPA->>SPA: Client-side validation<br/>(parseInt, > 0 check)

    SPA->>AM: POST /api/v1/admin/price-overrides<br/>{category, typeCode, currency, buy, sell, name}<br/>Authorization: Bearer {token}

    AM->>AM: ExtractBearerToken()
    AM->>AM: VerifyAuth(token)
    alt Invalid/expired token
        AM-->>SPA: 401 Unauthorized
    end
    AM->>AM: Set user_id, is_admin in context

    AM->>ADM: Next()
    ADM->>ADM: Check is_admin == true
    alt Not admin
        ADM-->>SPA: 403 Forbidden<br/>"Admin access required"
    end

    ADM->>PH: SetPriceOverride(ctx)
    activate PH
    PH->>PH: BindJSON → setPriceOverrideRequest
    PH->>PH: Validate category ∈ {gold, silver, currency, stock}
    PH->>PH: Validate typeCode length ≤ 50
    PH->>PH: Validate currency matches ^[A-Z]{3}$
    PH->>PH: Validate buy > 0 and sell > 0
    PH->>PH: Validate name length ≤ 100

    alt Any validation fails
        PH-->>SPA: 400 Bad Request<br/>{success: false, message: "..."}
    end

    PH->>PH: Build PriceOverride struct<br/>(updatedBy = user_id, updatedAt = now)
    PH->>POC: Set(ctx, override)
    POC->>R: SET price_override:{category}:{typeCode}:{currency}<br/>JSON payload, TTL = 0 (no expiry)

    alt Redis error
        R-->>POC: Error
        POC-->>PH: Error
        PH-->>SPA: 503 Service Unavailable<br/>"Failed to save price override"
    end

    R-->>POC: OK
    POC-->>PH: nil
    deactivate PH
    PH-->>SPA: 200 {success: true, message: "Price override saved", override}

    SPA->>RQ: invalidateQueries([EVENT_InvestmentGetMarketPrices])
    RQ->>MPH: GET /api/v1/investments/market-prices (refetch)

    activate MPH
    Note over MPH: Parallel fetch: gold + silver + currency
    MPH->>POC: GetAll(ctx)
    POC->>R: SCAN price_override:*
    R-->>POC: All overrides
    POC-->>MPH: []*PriceOverride
    MPH->>MPH: Build overrideMap[typeCode:currency]
    MPH->>MPH: applyOverrides(goldItems, overrideMap)<br/>applyOverrides(silverItems, overrideMap)<br/>applyOverrides(currencyItems, overrideMap)
    Note over MPH: Matching items get buy/sell replaced<br/>and isOverridden = true
    deactivate MPH

    MPH-->>RQ: 200 {gold, silver, currency, timestamp}
    RQ-->>SPA: Updated data with overridden prices
    SPA->>SPA: Re-render table<br/>Blue dot appears on overridden item
```

### 6b. Delete Price Override

**Trigger:** Admin clicks the blue override indicator dot on an overridden item, confirms removal
**Endpoint:** `DELETE /api/v1/admin/price-overrides`
**Source:** `handlers/price_override.go`, `pkg/cache/price_override_cache.go`, `features/market-prices/components/InlinePriceEdit.tsx`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant RQ as React Query
    participant AM as AuthMiddleware
    participant ADM as AdminMiddleware
    participant PH as PriceOverrideHandler
    participant POC as PriceOverrideCache
    participant R as Redis
    participant MPH as MarketPricesHandler

    SPA->>SPA: Admin clicks blue override dot<br/>on InlinePriceEdit
    SPA->>SPA: Browser confirm() dialog
    alt User cancels
        SPA->>SPA: No-op, return
    end

    SPA->>AM: DELETE /api/v1/admin/price-overrides<br/>{category, typeCode, currency}<br/>Authorization: Bearer {token}

    AM->>AM: ExtractBearerToken() → VerifyAuth()
    alt Invalid/expired token
        AM-->>SPA: 401 Unauthorized
    end
    AM->>AM: Set user_id, is_admin in context

    AM->>ADM: Next()
    ADM->>ADM: Check is_admin == true
    alt Not admin
        ADM-->>SPA: 403 Forbidden
    end

    ADM->>PH: DeletePriceOverride(ctx)
    activate PH
    PH->>PH: BindJSON → deletePriceOverrideRequest<br/>{category, typeCode, currency}
    PH->>POC: Delete(ctx, category, typeCode, currency)
    POC->>R: DEL price_override:{category}:{typeCode}:{currency}

    alt Redis error
        R-->>POC: Error
        POC-->>PH: Error
        PH-->>SPA: 503 Service Unavailable<br/>"Failed to delete price override"
    end

    R-->>POC: OK
    POC-->>PH: nil
    deactivate PH
    PH-->>SPA: 200 {success: true, message: "Price override removed"}

    SPA->>RQ: invalidateQueries([EVENT_InvestmentGetMarketPrices])
    RQ->>MPH: GET /api/v1/investments/market-prices (refetch)
    Note over MPH: Override no longer in Redis<br/>→ item.isOverridden = false
    MPH-->>RQ: 200 {gold, silver, currency, timestamp}
    RQ-->>SPA: Updated data without override
    SPA->>SPA: Re-render table<br/>Blue dot disappears, original price restored
```

### Key Invariants

- Only users with `is_admin = true` can access `/api/v1/admin/*` routes — enforced by `AuthMiddleware` + `AdminMiddleware` chain
- Price overrides are stored in Redis with **no TTL** — they persist until explicitly deleted
- Redis key format: `price_override:{category}:{typeCode}:{currency}` — uniquely identifies one price row
- Override merge happens at **read time** in `GetMarketPrices` — overrides do not mutate the upstream price source data
- The `applyOverrides` function matches by `typeCode:currency` composite key and replaces only `buy` and `sell` fields, preserving all other fields (changeBuy, changeSell, updatedAt, name)
- The `isOverridden` flag is set to `true` on matched items so the frontend can display the blue indicator dot
- Override cache failures during `GetMarketPrices` are **graceful** — original prices are returned without overrides (no 503)
- Category validation allows `gold`, `silver`, `currency`, `stock` — a fixed allowlist, not a dynamic enum
- Client-side validation (parseInt, positive check) runs before the API call; server-side validation is the authoritative gate
- Delete operation is idempotent — deleting a non-existent key returns success

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | Redirect to login |
| Non-admin user | 403 Forbidden | No fallback |
| Invalid category | 400 Bad Request | Client shows error toast |
| TypeCode > 50 chars | 400 Bad Request | Client shows error toast |
| Currency not `^[A-Z]{3}$` | 400 Bad Request | Client shows error toast |
| Buy or sell ≤ 0 | 400 Bad Request | Client shows error toast |
| Name > 100 chars | 400 Bad Request | Client shows error toast |
| Redis SET/DEL failure | 503 Service Unavailable | Client shows error toast |
| Redis SCAN failure during GetMarketPrices | Original prices returned (no override applied) | Graceful degradation |
| Delete non-existent override | 200 OK (idempotent) | No-op |

---

## 7. Price Alert Detection Flow

**Trigger:** Scheduler runs `PriceAlertJob` every 15 minutes (30-second startup delay)
**Source:** `internal/scheduler/price_alert_job.go`, `domain/service/price_alert_service.go`

```mermaid
sequenceDiagram
    participant SCH as Scheduler
    participant PAJ as PriceAlertJob
    participant PAS as PriceAlertService
    participant GPS as GoldPriceService
    participant SPS as SilverPriceService
    participant R as Redis
    participant NR as NotificationRepository
    participant UR as UserRepository
    participant SSE as SSE Channels
    participant PUSH as PushService

    SCH->>PAJ: Run(ctx) every 15 min
    PAJ->>PAS: CheckAndAlert(ctx)

    PAS->>R: GET price_alert:config
    alt Config exists in Redis
        R-->>PAS: PriceAlertConfig JSON
    else No config in Redis
        Note over PAS: Use DefaultPriceAlertConfig()<br/>(env var fallback)
    end

    par Fetch gold prices
        PAS->>GPS: FetchAllPrices(ctx)
        GPS-->>PAS: []*CachedGoldPrice
    and Fetch silver prices
        PAS->>SPS: FetchAllPrices(ctx)
        SPS-->>PAS: []*CachedSilverPrice
    end

    loop For each category (gold_vnd, gold_usd, silver_vnd, silver_usd)
        PAS->>PAS: Check catCfg.Enabled
        alt Category disabled
            Note over PAS: Skip this category
        else Category enabled
            PAS->>R: GET price_alert:baseline:{category}
            alt No baseline
                PAS->>R: SET price_alert:baseline:{category}
                Note over PAS: First run — set baseline, skip alert
            else Baseline exists
                PAS->>PAS: Compare current vs baseline<br/>Calculate % change per item
                PAS->>PAS: Filter items exceeding catCfg.ThresholdPct<br/>Take top cfg.TopMoversCount movers

                alt Significant movers found
                    PAS->>R: GET price_alert:cooldown:{category}
                    alt Cooldown active (< cfg.CooldownMinutes)
                        Note over PAS: Skip this category
                    else No cooldown
                        PAS->>UR: GetAllUserIDs(ctx)
                        UR-->>PAS: []int32

                        PAS->>PAS: ResolvePlaceholders(catCfg.TitleTemplate, values)<br/>ResolvePlaceholders(catCfg.BodyTemplate, values)
                        PAS->>PAS: Build notifications with metadata JSON<br/>{category, movers: [{typeCode, name, direction, changePct, priceDiff}]}
                        PAS->>NR: BatchCreate(ctx, notifications)

                        par SSE delivery
                            loop Each user
                                PAS->>R: PUBLISH user:{id}:notifications
                            end
                        and Push delivery
                            PAS->>PUSH: SendToAll(ctx, resolvedTitle, resolvedBody, url)
                        end

                        PAS->>R: SET price_alert:cooldown:{category} EX (cfg.CooldownMinutes*60)
                        PAS->>R: SET price_alert:baseline:{category}
                        Note over PAS: Update baseline after alert
                    end
                else No significant changes
                    Note over PAS: No alert — continue
                end
            end
        end
    end

    PAS-->>PAJ: nil (or error)
    PAJ-->>SCH: Done
```

### Key Invariants

- Each category is checked independently — a gold alert does not affect silver alerts
- Categories can be individually enabled/disabled via admin config (`catCfg.Enabled`)
- Baselines are set on first run and updated only after an alert is sent
- Cooldown period is configurable via admin UI (`cfg.CooldownMinutes`, default 120 min)
- Thresholds are configurable per category via admin UI (`catCfg.ThresholdPct`), with env var fallback defaults
- Notification title and body use template resolution with placeholders (`{moverName}`, `{changePct}`, `{direction}`, etc.)
- Config is loaded from Redis at runtime via `LoadPriceAlertConfig(ctx, rdb)` — falls back to `DefaultPriceAlertConfig()` which reads env vars
- Push delivery failures are non-fatal — SSE and DB notifications still persist
- Only the top N movers (`cfg.TopMoversCount`, default 5) are included in notification metadata
- Notification metadata includes `priceDiff` (absolute price change) in addition to `changePct`

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Gold price fetch failure | Skip gold categories | Silver categories still checked |
| Silver price fetch failure | Skip silver categories | Gold categories still checked |
| Redis baseline read failure | Skip that category | Other categories still checked |
| BatchCreate failure | Error logged, alert not sent | Next run retries |
| SSE publish failure | Non-fatal, logged | DB notification persists |
| Push delivery failure | Non-fatal, logged | SSE + DB notifications still work |
| All price fetches fail | Job returns error, scheduler logs it | Next run retries |

---

## 8. Admin Broadcast Flow

**Trigger:** Admin submits broadcast message via `POST /api/v1/admin/broadcast`
**Source:** `handlers/admin_broadcast.go`, `domain/service/admin_service.go`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant AM as AuthMiddleware
    participant ADM as AdminMiddleware
    participant ABH as AdminBroadcastHandler
    participant AS as AdminService
    participant R as Redis
    participant UR as UserRepository
    participant NR as NotificationRepository
    participant SSE as SSE Channels
    participant PUSH as PushService

    SPA->>SPA: Admin types message (max 500 chars)<br/>Clicks "Gửi thông báo"

    SPA->>AM: POST /api/v1/admin/broadcast<br/>{message: "..."}<br/>Authorization: Bearer {token}

    AM->>AM: VerifyAuth(token)
    alt Invalid token
        AM-->>SPA: 401 Unauthorized
    end

    AM->>ADM: Next()
    ADM->>ADM: Check is_admin == true
    alt Not admin
        ADM-->>SPA: 403 Forbidden
    end

    ADM->>ABH: SendBroadcast(ctx)
    ABH->>ABH: BindJSON → {message}
    ABH->>AS: Broadcast(ctx, adminUserID, message)

    activate AS
    AS->>AS: Validate message length (1-500 chars)
    AS->>AS: Strip HTML tags (regex)

    AS->>R: INCR admin_broadcast:rate:{adminUserID}
    AS->>R: EXPIRE admin_broadcast:rate:{adminUserID} 3600
    R-->>AS: count

    alt count > 10
        AS-->>ABH: Rate limit error (10/hour/admin)
        ABH-->>SPA: 429 Too Many Requests
    end

    AS->>UR: GetAllUserIDs(ctx)
    UR-->>AS: []int32 (all users)

    AS->>R: GET price_alert:config
    Note over AS: LoadPriceAlertConfig → cfg.BroadcastTitle

    AS->>AS: Build notifications for each user<br/>type="admin_broadcast", actorId=0<br/>metadata={message, adminName, broadcastTitle}

    AS->>NR: BatchCreate(ctx, notifications)

    par SSE delivery
        loop Each user
            AS->>R: PUBLISH user:{id}:notifications
        end
    and Push delivery
        AS->>PUSH: SendToAll(ctx, cfg.BroadcastTitle, message, "/dashboard/home")
    end

    deactivate AS
    AS-->>ABH: recipientCount
    ABH-->>SPA: 200 {success: true, recipientCount: N}

    SPA->>SPA: Show success toast<br/>"Đã gửi thông báo đến N người dùng"
```

### Key Invariants

- Only users with `is_admin = true` can broadcast — enforced by double middleware (Auth + Admin)
- Rate limit: 10 broadcasts per hour per admin, tracked via Redis INCR with 1-hour TTL
- HTML tags are stripped from messages to prevent injection — plain text only
- Message length: minimum 1 character, maximum 500 characters
- Notifications use `actorId = 0` to indicate system origin (no user avatar)
- Metadata JSON stores the broadcast message text, admin name, and `broadcastTitle` (from config)
- Push notification title uses `cfg.BroadcastTitle` from `LoadPriceAlertConfig` — configurable via admin UI
- SSE and Push delivery are best-effort — DB notifications are the source of truth

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | Client redirects to login |
| Non-admin user | 403 Forbidden | Client shows error |
| Empty message | 400 Bad Request | Client shows validation error |
| Message > 500 chars | 400 Bad Request | Client-side char counter prevents this |
| Rate limit exceeded (10/hr) | 429 Too Many Requests | Admin must wait |
| GetAllUserIDs failure | 500 Internal Server Error | Admin can retry |
| BatchCreate failure | 500 Internal Server Error | Admin can retry |
| SSE publish failure | Non-fatal, logged | DB notifications persist |
| Push delivery failure | Non-fatal, logged | SSE + DB notifications still work |

---

## 9. Admin Price Alert Config Flow

**Trigger:** Admin opens "Notifications" tab on Admin CMS page, views or updates price alert configuration
**Source:** `handlers/price_alert_config.go`, `domain/service/price_alert_config.go`, `features/admin/components/PriceAlertConfigForm.tsx`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant AM as AuthMiddleware
    participant ADM as AdminMiddleware
    participant PACH as PriceAlertConfigHandler
    participant R as Redis

    Note over SPA: Admin navigates to /dashboard/admin?tab=notifications

    SPA->>AM: GET /api/v1/admin/price-alert-config<br/>Authorization: Bearer {token}
    AM->>AM: VerifyAuth(token)
    AM->>ADM: Next()
    ADM->>ADM: Check is_admin == true

    ADM->>PACH: GetConfig(ctx)
    activate PACH
    PACH->>R: GET price_alert:config
    alt Config in Redis
        R-->>PACH: PriceAlertConfig JSON
        PACH->>PACH: Merge missing categories from defaults
    else No config
        Note over PACH: DefaultPriceAlertConfig()<br/>(reads env vars as fallback)
    end
    deactivate PACH
    PACH-->>SPA: 200 {success: true, config: {...}}

    SPA->>SPA: Render PriceAlertConfigForm<br/>Global settings + per-category accordions

    Note over SPA: Admin modifies settings and clicks Save

    SPA->>AM: PUT /api/v1/admin/price-alert-config<br/>{cooldownMinutes, topMoversCount, broadcastTitle,<br/>categories: {gold_vnd: {...}, ...}}
    AM->>AM: VerifyAuth(token)
    AM->>ADM: Next()
    ADM->>ADM: Check is_admin == true

    ADM->>PACH: UpdateConfig(ctx)
    activate PACH
    PACH->>PACH: BindJSON → incoming config
    PACH->>R: GET price_alert:config
    R-->>PACH: Current config (or defaults)
    PACH->>PACH: mergeConfig(current, incoming)<br/>Only update non-zero/non-empty fields
    PACH->>PACH: SanitizePriceAlertConfig<br/>Strip HTML from all string fields
    PACH->>PACH: ValidatePriceAlertConfig
    alt Validation errors
        PACH-->>SPA: 400 {success: false, errors: {...}}
    end
    PACH->>R: SET price_alert:config (no TTL)
    R-->>PACH: OK
    deactivate PACH
    PACH-->>SPA: 200 {success: true, config: {...}}

    SPA->>SPA: Show success toast<br/>"Price alert configuration updated"
```

### Key Invariants

- Config is stored in Redis under key `price_alert:config` with **no TTL** — persists until explicitly overwritten
- When no config exists in Redis, `DefaultPriceAlertConfig()` provides defaults from environment variables
- Missing categories are merged from defaults — adding a new category to defaults auto-fills it for existing configs
- All string fields are sanitized (HTML stripped) before saving to prevent XSS
- Validation enforces: cooldownMinutes 1–1440, topMoversCount 1–20, thresholdPct 0.1–50, non-empty templates and broadcastTitle
- Partial updates: `mergeConfig` only overwrites fields with non-zero/non-empty values from the incoming request
- Config changes take effect on the **next** scheduler run (no restart needed) — `PriceAlertService.CheckAndAlert` reads config from Redis each invocation

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Missing/invalid JWT | 401 Unauthorized | Client redirects to login |
| Non-admin user | 403 Forbidden | Client shows error |
| Redis read failure on GET | Returns DefaultPriceAlertConfig() | Transparent fallback |
| Redis write failure on PUT | 500 Internal Server Error | Admin can retry |
| Validation error (e.g., cooldown=0) | 400 {errors: {cooldownMinutes: "..."}} | Client shows field-level error |
| HTML-only template (empty after strip) | 400 validation error | Client shows error |
