# Real Chart Data (Gold, Silver, PNL) Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace three "Coming soon" placeholder charts on the V2 home dashboard with real, interactive Recharts area charts powered by live data.
**Spec:** `docs/specs/2026-03-09-real-chart-data-spec.md`
**Architecture:** Backend proxy endpoints for gold (mihong.vn) and silver (giabac.vn domestic + Yahoo Finance global) with Redis caching. Frontend consumes new endpoints via auto-generated React Query hooks. PNL chart uses existing `/portfolio/historical-values` endpoint.
**Tech Stack:** Go 1.23, Gin, Redis, Recharts, React Query, Protocol Buffers, Next.js 15

## Security Implementation Notes
- All chart endpoints require JWT authentication (same as `/investments/` routes)
- Query parameters validated via allowlists (market, goldCode, period, type, days)
- External API responses validated for structure and size-limited (1MB max)
- No user-specific data in chart responses — prices are public market data
- Rate limiting inherited from existing investment route group
- External API timeouts: 10 seconds with Redis cache fallback

## C4 Architecture Diagram Updates
- **Modify:** `docs/architecture/c4-component-backend.md` — Add `GoldChartHandler` and `SilverChartHandler` in Handlers container
- **Modify:** `docs/architecture/c4-component-frontend.md` — Update Home Page section to show chart components consuming new endpoints

## Runtime Flow Diagram Updates
- **Add to:** `docs/architecture/flow-investment.md` — Gold/Silver Chart Data Flow (sequenceDiagram)

---

### Task 0: Add Protobuf Types and Generate Code

**Files:**
- Modify: `api/protobuf/v1/investment.proto`
- Auto-generated: `src/go-backend/protobuf/v1/`, `src/wj-client/gen/protobuf/v1/`, `src/wj-client/utils/generated/api.ts`, `src/wj-client/utils/generated/hooks.ts`

**Security notes:** Proto types define the API contract. Ensure field types are appropriate (int64 for timestamps, double for prices).

**Steps:**

1. Add new protobuf messages to `api/protobuf/v1/investment.proto`:
   ```protobuf
   // Chart data point for price history
   message ChartDataPoint {
     int64 timestamp = 1 [json_name = "timestamp"];
     double buy = 2 [json_name = "buy"];
     double sell = 3 [json_name = "sell"];
   }

   // Gold chart
   message GetGoldChartRequest {
     string market = 1 [json_name = "market"];
     string goldCode = 2 [json_name = "goldCode"];
     string period = 3 [json_name = "period"];
   }

   message GetGoldChartResponse {
     bool success = 1 [json_name = "success"];
     string message = 2 [json_name = "message"];
     repeated ChartDataPoint data = 3 [json_name = "data"];
     string market = 4 [json_name = "market"];
     string goldCode = 5 [json_name = "goldCode"];
     string period = 6 [json_name = "period"];
     string currency = 7 [json_name = "currency"];
     string timestamp = 8 [json_name = "timestamp"];
   }

   // Silver chart
   message GetSilverChartRequest {
     string market = 1 [json_name = "market"];
     string type = 2 [json_name = "type"];
     int32 days = 3 [json_name = "days"];
   }

   message GetSilverChartResponse {
     bool success = 1 [json_name = "success"];
     string message = 2 [json_name = "message"];
     repeated ChartDataPoint data = 3 [json_name = "data"];
     string market = 4 [json_name = "market"];
     string type = 5 [json_name = "type"];
     int32 days = 6 [json_name = "days"];
     string currency = 7 [json_name = "currency"];
     string timestamp = 8 [json_name = "timestamp"];
   }
   ```

2. Add new RPCs to `InvestmentService`:
   ```protobuf
   rpc GetGoldChart(GetGoldChartRequest) returns (GetGoldChartResponse) {
     option (google.api.http) = {
       get: "/api/v1/investments/gold-chart"
     };
   }

   rpc GetSilverChart(GetSilverChartRequest) returns (GetSilverChartResponse) {
     option (google.api.http) = {
       get: "/api/v1/investments/silver-chart"
     };
   }
   ```

3. Run `task proto:all` to generate Go + TypeScript + API client code.

4. Verify generated code compiles: `cd src/go-backend && go build ./...`

5. Commit: `feat(chart): add protobuf types for gold/silver chart endpoints`

---

### Task 1: Implement Gold Chart Backend Handler

**Files:**
- Create: `src/go-backend/handlers/gold_chart.go`
- Modify: `src/go-backend/handlers/builder.go` — Add `GoldChart` field to `AllHandlers` + wire in `NewHandlers()`
- Modify: `src/go-backend/handlers/routes.go` — Register `GET /investments/gold-chart`

**Security notes:**
- Allowlist validation for `market` (domestic, global), `goldCode` (SJC, 999), `period` (24h, 15d, 1m, 6m, 1y)
- 10-second timeout for external API
- Response size limit for external API (1MB)
- Redis cache with stale fallback on API failure

**Steps:**

1. Create `gold_chart.go` with `GoldChartHandler` struct:
   - Dependencies: `redisClient *redis.Client` (for caching)
   - Constructor: `NewGoldChartHandler(redisClient *redis.Client) *GoldChartHandler`

2. Implement `GetGoldChart(c *gin.Context)` handler:
   - Parse query params: `market` (default "domestic"), `goldCode` (default "SJC"), `period` (default "24h")
   - Validate against allowlists, return 400 for invalid values
   - For global market, ignore goldCode param
   - Build Redis cache key: `gold_chart:{market}:{goldCode}:{period}`
   - Check Redis cache first — if hit, return cached data
   - On cache miss, call mihong.vn API:
     - Domestic: `https://api.mihong.vn/v1/gold-prices?market=domestic&goldCode={goldCode}&last={period}`
     - Global: `https://api.mihong.vn/v1/gold-prices?market=global&last={period}`
   - Parse response: array of `{buyingPrice, sellingPrice, code, dateTime}`
   - Convert `dateTime` (DD/MM/YYYY HH:mm format, UTC+7) to Unix timestamps
   - Normalize to `ChartDataPoint{timestamp, buy, sell}` — pass prices through as-is
   - For global 24h: downsample to ~100 points max (every Nth point)
   - Cache with TTL: 5 min for 24h, 15 min for 15d+
   - On external API failure: return stale cache if available, else 503
   - Response: `gin.H{success, message, data, market, goldCode, period, currency, timestamp}`
   - Currency: "VND" for domestic, "USD" for global

3. Wire handler in `builder.go`:
   - Add `GoldChart *GoldChartHandler` to `AllHandlers`
   - In `NewHandlers()`: `if deps.RDB != nil { NewGoldChartHandler(deps.RDB.GetClient()) }`

4. Register route in `routes.go`:
   - Add `investments.GET("/gold-chart", h.GoldChart.GetGoldChart)` — BEFORE `:id` parameterized routes
   - Check for nil: `if h.GoldChart != nil { ... }`

5. Verify compilation: `cd src/go-backend && go build ./...`

6. Commit: `feat(chart): implement gold chart backend proxy endpoint`

---

### Task 2: Implement Silver Chart Backend Handler

**Files:**
- Create: `src/go-backend/handlers/silver_chart.go`
- Modify: `src/go-backend/handlers/builder.go` — Add `SilverChart` field
- Modify: `src/go-backend/handlers/routes.go` — Register `GET /investments/silver-chart`

**Security notes:**
- Same allowlist pattern as gold chart
- Yahoo Finance calls respect existing global throttler (120 req/min)
- Domestic giabac.vn API: validate response structure
- Global Yahoo Finance: filter null OHLCV entries

**Steps:**

1. Create `silver_chart.go` with `SilverChartHandler` struct:
   - Dependencies: `redisClient *redis.Client`
   - Constructor: `NewSilverChartHandler(redisClient *redis.Client) *SilverChartHandler`

2. Implement `GetSilverChart(c *gin.Context)` handler:
   - Parse query params: `market` (default "domestic"), `type` (default "L"), `days` (default "7")
   - Validate: `market` allowlist, `type` allowlist (C, L, KG — domestic only), `days` allowlist (1, 7, 30, 90, 365)
   - Build Redis cache key: `silver_chart:{market}:{type}:{days}`
   - Check cache first

3. Implement domestic silver fetch:
   - Call `https://giabac.vn/SilverInfo/GetGoldPriceChartFromSQLData?days={days}&type={type}`
   - Parse response: `{Type, Dates[], LastBuyPrices[], LastSellPrices[]}`
   - Handle date formats: `days=1` → ISO timestamps with time; `days>1` → `YYYY-MM-DD` date strings
   - Normalize to `ChartDataPoint{timestamp, buy, sell}`

4. Implement global silver fetch:
   - Reuse Yahoo Finance patterns from `pkg/yahoo/quote.go`
   - URL: `https://query2.finance.yahoo.com/v8/finance/chart/SI=F?period1={start}&period2={end}&interval={interval}`
   - Interval mapping: days=1 → 5m, days=7 → 1h, days=30 → 1d, days=90 → 1d, days=365 → 1wk
   - Calculate `period1` = now - days, `period2` = now (Unix seconds)
   - Use existing User-Agent header and throttler: `yahoo.GetGlobalThrottler().Wait(ctx)`
   - Parse `chart.result[0].timestamp[]` and `chart.result[0].indicators.quote[0].close[]`
   - Filter null values in close array
   - For silver chart: use `close` for both buy and sell (no spread in futures data)

5. Cache response, fallback to stale cache on failure

6. Wire handler in `builder.go`, register route in `routes.go` (same pattern as gold chart)

7. Verify compilation: `cd src/go-backend && go build ./...`

8. Commit: `feat(chart): implement silver chart backend proxy endpoint`

---

### Task 3: Add i18n Translation Keys for Chart UI

**Files:**
- Modify: `src/wj-client/messages/en/ui.json`
- Modify: `src/wj-client/messages/vi/ui.json`

**Steps:**

1. Add new translation keys under `dashboard.home`:
   ```json
   {
     "domestic": "Domestic",
     "global": "Global",
     "price": "PRICE",
     "loading": "Loading...",
     "errorLoading": "Failed to load chart data",
     "noData": "No data available",
     "retry": "Retry",
     "unitC": "Chỉ",
     "unitL": "Lượng",
     "unitKG": "KG"
   }
   ```

2. Add corresponding Vietnamese translations.

3. Commit: `feat(chart): add i18n translation keys for chart components`

---

### Task 4: Implement Gold Price Chart Frontend

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`
- Modify: `src/wj-client/utils/generated/hooks.ts` (already generated in Task 0)
- Modify: `src/wj-client/utils/generated/api.ts` (already generated in Task 0)

**Security notes:** No sensitive data displayed. Sanitize any error messages from API before display.

**Steps:**

1. Replace GoldPriceChart placeholder with real chart implementation:
   - Add state: `selectedMarket` (domestic/global)
   - Add market toggle (Domestic/Global pill toggle) in header
   - Wire period tabs to fetch new data on change
   - Wire type selector to trigger new data fetch (domestic only, hide for global)
   - Map period keys: "24h" → "24h", "week" → "15d", "month" → "1m", "year" → "1y"

2. Data fetching:
   - Use `useQueryGetGoldChart` hook (auto-generated from proto) or manual fetch with `useQuery`
   - If hook not generated (because we use `gin.H{}` responses, not proto directly), create a manual fetch hook:
     ```typescript
     const { data, isLoading, error, refetch } = useQuery({
       queryKey: ["gold-chart", selectedMarket, selectedType, selectedPeriod],
       queryFn: () => apiClient.get(`/api/v1/investments/gold-chart`, {
         params: { market: selectedMarket, goldCode: goldCodeMapping, period: periodMapping }
       }),
       staleTime: 5 * 60 * 1000,
     });
     ```

3. Chart rendering:
   - Use existing `LineChart` component with `chartType: "area"` series
   - Domestic: two series — Buy (color: `#B91C1C` red) and Sell (color: `#16A34A` green)
   - Global: single series — Price (color: `#B8860B` gold) — use buy value only since buy ≈ sell
   - X-axis: formatted time/date based on period (short time for 24h, date for longer)
   - Y-axis: formatted price with currency symbol (₫ for VND, $ for USD)
   - Height: 200px (matching current placeholder)

4. States:
   - Loading: show skeleton/spinner in chart area
   - Error: show error message with retry button
   - Empty data: show "No data available" message
   - Hide type selector when global market selected
   - Update current price display based on market currency

5. Map goldCode from type selector:
   - VND gold types (SJL*, SJR*, SJT*) → `goldCode=SJC`
   - 999-prefixed types → `goldCode=999`
   - USD types (XAU) → global market (goldCode ignored)

6. Commit: `feat(chart): implement gold price chart with real data`

---

### Task 5: Implement Silver Price Chart Frontend

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`

**Security notes:** Same as gold chart — no sensitive data.

**Steps:**

1. Same pattern as GoldPriceChart but for silver:
   - Add market toggle (Domestic/Global)
   - Domestic: unit type selector (C/L/KG), default "L"
   - Global: hide unit type selector
   - Period tabs map to days: "24h" → 1, "week" → 7, "month" → 30, "year" → 365

2. Data fetching:
   - Call `/api/v1/investments/silver-chart?market={market}&type={type}&days={days}`
   - Use `useQuery` with appropriate query key

3. Chart rendering:
   - Domestic: two series — Buy (color: `#4B5563` gray) and Sell (color: `#16A34A` green)
   - Global: single series — SI=F price (color: `#8B929E` silver)
   - Y-axis: VND format for domestic, USD format for global

4. States: loading, error, empty — same pattern as gold chart

5. Commit: `feat(chart): implement silver price chart with real data`

---

### Task 6: Implement PNL Chart Frontend

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`

**Security notes:** Uses existing authenticated endpoint. No new security concerns.

**Steps:**

1. Replace PNLCard chart placeholder with real chart:
   - Use existing `useQueryGetHistoricalPortfolioValues` hook
   - Wire period tabs: 7d → `{days: 7, points: 7}`, 30d → `{days: 30, points: 30}`
   - Query with `walletId: 0` (all investment wallets), `typeFilter: 0` (all types)

2. Chart rendering:
   - Single area series: portfolio total value
   - Dynamic color: green (`#16A34A`) if latest value > earliest value, red (`#DC2626`) otherwise
   - X-axis: formatted date (short date format)
   - Y-axis: formatted VND amount
   - Height: 200px

3. Data transformation:
   - Map `HistoricalPortfolioValue[]` to `LineChartDataPoint[]`:
     ```typescript
     data.map(point => ({
       date: formatDate(point.timestamp),
       value: Number(point.totalValue) / 100, // smallest unit → display
     }))
     ```
   - Parse protobuf int64 strings using appropriate utility

4. Edge cases:
   - Empty data: show "No data available" message
   - Single data point: show flat line
   - Loading state: show skeleton

5. Commit: `feat(chart): implement PNL chart with real portfolio data`

---

### Task 7: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Update backend component diagram:
   - Add `GoldChartHandler` component in Handlers container
   - Add `SilverChartHandler` component in Handlers container
   - Add connections: GoldChartHandler → mihong.vn API, SilverChartHandler → giabac.vn + Yahoo Finance
   - Add connections: Both handlers → Redis cache

2. Update frontend component diagram:
   - Update Home Page section to show GoldPriceChart, SilverPriceChart, PNLCard consuming new backend endpoints

3. Commit: `docs(chart): update C4 architecture diagrams for chart endpoints`

---

### Task 8: Create Runtime Flow Diagram

**Files:**
- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Add "Gold/Silver Chart Data Flow" sequenceDiagram:
   - Browser → Backend handler → Redis cache check
   - Cache hit → return cached data
   - Cache miss → External API call → Parse/normalize → Cache write → Response
   - Error path: API failure → Check stale cache → Return stale or 503

2. Include key invariants:
   - Cache key format
   - TTL rules (5 min for short periods, 15 min for longer)
   - Downsampling rule for global gold 24h

3. Add error paths table.

4. Commit: `docs(chart): add chart data flow diagram to investment flows`

---

## Task Dependencies

```
Task 0 (Proto) ─────┬──→ Task 1 (Gold Backend) ──→ Task 4 (Gold Frontend)
                     ├──→ Task 2 (Silver Backend) ──→ Task 5 (Silver Frontend)
                     └──→ Task 3 (i18n) ──────────┬──→ Task 4
                                                   ├──→ Task 5
                                                   └──→ Task 6 (PNL Frontend)
Task 7 (C4 Diagrams) — independent
Task 8 (Flow Diagram) — after Tasks 1 & 2
```

**Parallel groups:**
- Group A: Tasks 1 + 2 + 3 (after Task 0)
- Group B: Tasks 4 + 5 + 6 (after Group A)
- Group C: Tasks 7 + 8 (after Group B, or in parallel if comfortable)

## Estimated Scope

| Task | Files Created | Files Modified | Complexity |
|------|--------------|----------------|------------|
| 0. Proto | 0 | 1 + auto-gen | Low |
| 1. Gold Backend | 1 | 2 | Medium |
| 2. Silver Backend | 1 | 2 | Medium-High (Yahoo Finance) |
| 3. i18n | 0 | 2 | Low |
| 4. Gold Frontend | 0 | 1 | Medium |
| 5. Silver Frontend | 0 | 1 | Medium |
| 6. PNL Frontend | 0 | 1 | Low-Medium |
| 7. C4 Diagrams | 0 | 2 | Low |
| 8. Flow Diagram | 0 | 1 | Low |
| **Total** | **2** | **~13 + auto-gen** | |
