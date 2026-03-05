# Cross-Cutting Concerns — Runtime Flows

Infrastructure-level flows that are referenced by multiple domain flows. Read this document first to understand caching, API communication, and background processing patterns.

## Table of Contents

- [FX Rate Resolution Chain](#1-fx-rate-resolution-chain)
- [Frontend API Call Lifecycle](#2-frontend-api-call-lifecycle)
- [Background Scheduler Jobs](#3-background-scheduler-jobs)
- [Currency Conversion Logic](#4-currency-conversion-logic)

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
