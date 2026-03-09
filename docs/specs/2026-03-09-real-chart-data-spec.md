# Real Chart Data (Gold, Silver, PNL) Specification

## Summary

Replace the three "Coming soon" placeholder charts on the V2 home dashboard with real, interactive charts powered by live data. Gold and silver price history is fetched via backend proxy endpoints that call external APIs with Redis caching. Gold supports both domestic (mihong.vn, VND) and global (mihong.vn Kitco, USD) markets. Silver supports both domestic (giabac.vn, VND) and global (Yahoo Finance SI=F futures, USD) markets. The PNL chart uses the existing `/portfolio/historical-values` endpoint. All charts use the existing Recharts `LineChart` component with area fills.

## User Stories

- As a user, I want to see gold price trends over time so I can decide when to buy/sell gold.
- As a user, I want to see silver price trends over time so I can track silver market movement.
- As a user, I want to see my portfolio value trend so I can understand my investment performance.

## Functional Requirements

### FR-1: Gold Price Chart (Backend Proxy)

A new backend endpoint proxies the mihong.vn gold price history API for both domestic (VND) and global (USD) markets, caches results in Redis, and returns normalized data to the frontend.

**Endpoint:** `GET /api/v1/investments/gold-chart`

**Query Parameters:**
| Param | Type | Required | Default | Values | Description |
|-------|------|----------|---------|--------|-------------|
| `market` | string | No | `domestic` | `domestic`, `global` | Market type |
| `goldCode` | string | No | `SJC` | `SJC`, `999` (domestic only, ignored for global) | Gold type code |
| `period` | string | No | `24h` | `24h`, `15d`, `1m`, `6m`, `1y` | Time period |

**Response shape:**
```json
{
  "success": true,
  "message": "Gold chart data retrieved successfully",
  "data": [
    {
      "timestamp": 1741489200,
      "buy": 18120000,
      "sell": 18400000
    }
  ],
  "market": "domestic",
  "goldCode": "SJC",
  "period": "24h",
  "currency": "VND",
  "timestamp": "2026-03-09T08:30:00Z"
}
```

**External APIs:**

1. **Domestic (VND):** `https://api.mihong.vn/v1/gold-prices?market=domestic&goldCode={goldCode}&last={period}`
   - Returns bare JSON array with `buyingPrice` (int), `sellingPrice` (int), `code`, `dateTime` (DD/MM/YYYY HH:mm format, UTC+7)
   - ~5min intervals for 1h, ~30min for 24h, daily for 15d+
   - Prices in VND per tael

2. **Global (USD):** `https://api.mihong.vn/v1/gold-prices?market=global&last={period}`
   - Returns bare JSON array with `buyingPrice` (float), `sellingPrice` (float), `code` ("Kitco"), `dateTime` (DD/MM/YYYY HH:mm format)
   - `goldCode` param is ignored — only one global code ("Kitco")
   - 24h: ~1min intervals (~1000 points), 15d: daily (~14 points), 1y: monthly (~12 points)
   - Prices in USD per ounce (e.g., 5079.98)
   - Buy and sell prices are often identical (no spread)

**Cache:** Redis key `gold_chart:{market}:{goldCode}:{period}`, TTL = 5 minutes for 24h, 15 minutes for 15d+.

**Acceptance criteria:**
- [ ] Endpoint returns normalized array with Unix timestamps
- [ ] Date parsing handles DD/MM/YYYY HH:mm format correctly (UTC+7)
- [ ] Domestic: prices pass through as-is (VND per tael, integers)
- [ ] Global: prices pass through as-is (USD per ounce, floats)
- [ ] Response includes `currency` field ("VND" for domestic, "USD" for global)
- [ ] Invalid market returns 400
- [ ] Invalid goldCode returns 400 (domestic only)
- [ ] Invalid period returns 400
- [ ] External API failure returns 503 with fallback to cache if available
- [ ] Redis cache hit skips external API call
- [ ] Global market with 24h period downsamples to ~100 points max (avoid sending 1000+ points to frontend)

### FR-2: Silver Price Chart (Backend Proxy)

A new backend endpoint proxies silver price history from two sources: giabac.vn for domestic (VND) and Yahoo Finance v8 chart API for global (USD).

**Endpoint:** `GET /api/v1/investments/silver-chart`

**Query Parameters:**
| Param | Type | Required | Default | Values | Description |
|-------|------|----------|---------|--------|-------------|
| `market` | string | No | `domestic` | `domestic`, `global` | Market type |
| `type` | string | No | `L` | `C`, `L`, `KG` (domestic only, ignored for global) | Unit type (Chỉ, Lượng, Kilogram) |
| `days` | int | No | `7` | `1`, `7`, `30`, `90`, `365` | Number of days |

**Response shape:**
```json
{
  "success": true,
  "message": "Silver chart data retrieved successfully",
  "data": [
    {
      "timestamp": 1741489200,
      "buy": 3020000.0,
      "sell": 3113400.0
    }
  ],
  "market": "domestic",
  "type": "L",
  "days": 7,
  "currency": "VND",
  "timestamp": "2026-03-09T08:30:00Z"
}
```

**External APIs:**

1. **Domestic (VND):** `https://giabac.vn/SilverInfo/GetGoldPriceChartFromSQLData?days={days}&type={type}`
   - Returns `{ Type, Dates[], LastBuyPrices[], LastSellPrices[] }`
   - `days=1` returns ISO timestamps with time (e.g., `2026-03-09T08:30:20`); `days>1` returns `YYYY-MM-DD` date-only strings
   - Prices are floats (VND per unit type)

2. **Global (USD):** `https://query2.finance.yahoo.com/v8/finance/chart/SI=F?period1={start}&period2={end}&interval={interval}`
   - Uses the same Yahoo Finance v8 chart API already integrated in the backend (`pkg/yahoo/`)
   - Reuse existing `User-Agent` header and throttler patterns
   - Returns `chart.result[0].timestamp[]` (Unix) and `chart.result[0].indicators.quote[0]` with OHLCV arrays
   - For silver chart, use `close` prices for both buy and sell (futures have no bid/ask spread in chart data)
   - `SI=F` = Silver Futures (COMEX), currency = USD per ounce
   - Interval mapping: `days=1` → `interval=5m`, `days=7` → `interval=1h`, `days=30` → `interval=1d`, `days=90` → `interval=1d`, `days=365` → `interval=1wk`
   - `period1`/`period2` calculated from current time minus `days`
   - Null values in OHLCV arrays (incomplete periods) should be filtered out

**Cache:** Redis key `silver_chart:{market}:{type}:{days}`, TTL = 5 minutes for days<=1, 15 minutes for days>1.

**Acceptance criteria:**
- [ ] Endpoint returns normalized array with Unix timestamps
- [ ] Domestic: handles both ISO datetime (days=1) and date-only (days>1) formats
- [ ] Domestic: prices pass through as floats (VND)
- [ ] Global: uses Yahoo Finance v8 chart API with proper interval mapping
- [ ] Global: filters out null OHLCV entries
- [ ] Global: prices are USD floats (per ounce)
- [ ] Response includes `currency` field ("VND" for domestic, "USD" for global)
- [ ] Invalid market returns 400
- [ ] Invalid type returns 400 (domestic only)
- [ ] Invalid days returns 400
- [ ] External API failure returns 503 with fallback to cache
- [ ] Redis cache hit skips external API call
- [ ] Yahoo Finance calls respect existing global throttler (120 req/min)

### FR-3: Gold Price Chart (Frontend)

Replace the "Coming soon" placeholder in `GoldPriceChart.tsx` with a Recharts area chart.

**Behavior:**
- On mount and when `selectedType`, `selectedPeriod`, or `selectedMarket` changes, fetch `/investments/gold-chart?market={market}&goldCode={code}&period={period}`
- Market toggle: "Domestic" (VND) / "Global" (USD) — small toggle above chart
- Domestic mode: goldCode selector visible (SJC types → `SJC`, 999 types → `999`). Two area series: Buy (red) and Sell (green)
- Global mode: goldCode selector hidden (only one Kitco code). Single area series (buy ≈ sell, so show one line labeled "Price")
- Period tabs: 24h, 15d (week), 1m (month), 1y (year)
- X-axis: formatted time/date based on period
- Y-axis: formatted price with currency symbol (₫ or $)
- Loading state: skeleton/spinner in chart area
- Error state: show error message in chart area

**Acceptance criteria:**
- [ ] Chart renders with real data from API
- [ ] Market toggle switches between domestic/global
- [ ] Period tabs trigger new data fetch
- [ ] Type selector triggers new data fetch (domestic only)
- [ ] Type selector hidden in global mode
- [ ] Y-axis shows correct currency format (VND vs USD)
- [ ] Loading skeleton shows during fetch
- [ ] Error message shows on failure
- [ ] Chart is responsive (fills container width)
- [ ] Buy/sell color coding matches existing dot indicators (red = buy, green = sell)

### FR-4: Silver Price Chart (Frontend)

Replace the "Coming soon" placeholder in `SilverPriceChart.tsx` with a Recharts area chart.

**Behavior:**
- Same pattern as gold chart but calls `/investments/silver-chart?market={market}&type={type}&days={days}`
- Market toggle: "Domestic" (VND) / "Global" (USD)
- Domestic mode: unit type selector visible (C/L/KG), default `L`. Two area series: Buy and Sell
- Global mode: unit type selector hidden (SI=F futures, USD/oz). Single area series (close price only, no bid/ask spread)
- Period tabs: 24h (days=1), 7d (days=7), 30d (days=30), 1y (days=365)

**Acceptance criteria:**
- [ ] Chart renders with real silver data
- [ ] Market toggle switches between domestic/global
- [ ] Unit type toggle (C/L/KG) triggers new data fetch (domestic only)
- [ ] Unit type selector hidden in global mode
- [ ] Period tabs trigger new data fetch
- [ ] Y-axis shows correct currency format (VND vs USD)
- [ ] Loading/error states
- [ ] Responsive

### FR-5: PNL Chart (Frontend)

Replace the "Coming soon" placeholder in `PNLCard.tsx` with a Recharts area chart showing portfolio value over time.

**Behavior:**
- Uses existing `useQueryGetHistoricalPortfolioValues` hook
- Period tabs: 7d (days=7, points=7) and 30d (days=30, points=30)
- Single area series: portfolio total value
- Color: green if latest value > earliest value, red otherwise
- X-axis: formatted date
- Y-axis: formatted VND amount

**Acceptance criteria:**
- [ ] Chart renders with real portfolio history data
- [ ] Period tabs (7d/30d) change the query parameters
- [ ] Chart color reflects positive/negative trend
- [ ] Loading/error states
- [ ] Handles empty data gracefully (no portfolio history yet)
- [ ] Responsive

## Non-Functional Requirements

- **Performance:** Chart data endpoints must respond within 2 seconds (cache hit < 100ms). External API timeout = 10 seconds with fallback to stale cache.
- **Caching:** Redis caching with appropriate TTLs to reduce external API load.
- **Error resilience:** External API failures must not crash the page. Stale cache data served as fallback.
- **Bundle size:** No new charting libraries — use existing Recharts.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Add `GoldChartHandler` and `SilverChartHandler` components in the Handlers container, with connections to external APIs (mihong.vn, giabac.vn, Yahoo Finance) and Redis cache.

2. **`docs/architecture/c4-component-frontend.md`** — Update Home Page section to show chart components consuming new backend endpoints.

### New Diagrams

None needed — this feature adds handlers/components to existing containers, not new bounded contexts.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — existing flow diagrams cover investment and market data patterns.

### New Flow Diagrams

**Add to `docs/architecture/flow-investment.md`:**

1. **Gold/Silver Chart Data Flow** (sequenceDiagram) — Browser → Backend handler → Redis cache check → External API (if cache miss) → Parse/normalize → Cache → Response. Include error/fallback path.

## Data Model Changes

None. No new database tables. Only Redis cache keys are added:
- `gold_chart:{market}:{goldCode}:{period}` — Cached gold chart JSON response
- `silver_chart:{market}:{type}:{days}` — Cached silver chart JSON response

## API Changes

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/investments/gold-chart` | Gold price history (proxy to mihong.vn) |
| GET | `/api/v1/investments/silver-chart` | Silver price history (proxy to giabac.vn) |

### New Protobuf Types

```protobuf
// Chart data point for price history
message ChartDataPoint {
  int64 timestamp = 1 [json_name = "timestamp"];
  double buy = 2 [json_name = "buy"];
  double sell = 3 [json_name = "sell"];
}

// Gold chart
message GetGoldChartRequest {
  string market = 1 [json_name = "market"];     // "domestic" or "global"
  string goldCode = 2 [json_name = "goldCode"]; // "SJC", "999" (domestic only)
  string period = 3 [json_name = "period"];     // "24h", "15d", "1m", "6m", "1y"
}

message GetGoldChartResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated ChartDataPoint data = 3 [json_name = "data"];
  string market = 4 [json_name = "market"];
  string goldCode = 5 [json_name = "goldCode"];
  string period = 6 [json_name = "period"];
  string currency = 7 [json_name = "currency"]; // "VND" or "USD"
  string timestamp = 8 [json_name = "timestamp"];
}

// Silver chart
message GetSilverChartRequest {
  string market = 1 [json_name = "market"];   // "domestic" or "global"
  string type = 2 [json_name = "type"];       // "C", "L", "KG" (domestic only)
  int32 days = 3 [json_name = "days"];        // 1, 7, 30, 90, 365
}

message GetSilverChartResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated ChartDataPoint data = 3 [json_name = "data"];
  string market = 4 [json_name = "market"];
  string type = 5 [json_name = "type"];
  int32 days = 6 [json_name = "days"];
  string currency = 7 [json_name = "currency"]; // "VND" or "USD"
  string timestamp = 8 [json_name = "timestamp"];
}
```

### New RPCs

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

## UI/UX Changes

### Gold Price Chart
- Replace 200px "Coming soon" placeholder with Recharts area chart
- Add market toggle (Domestic/Global) as compact pill toggle in header area
- Domestic: two series — Buy (red/crimson area) and Sell (green area), goldCode selector visible
- Global: single series — Price (gold area), goldCode selector hidden, Y-axis in USD
- Period tabs already exist: rewire to trigger API calls
- Type selector already exists: rewire to trigger API calls with goldCode mapping
- Add loading skeleton during data fetch
- Mobile-first: chart fills container width, height 200px
- Current price display updates based on market: show VND prices for domestic, USD for global

### Silver Price Chart
- Same as gold chart pattern with market toggle
- Add unit type selector (Chỉ/Lượng/KG) as small toggle below or next to type selector (domestic only)
- Domestic: two series — Buy (gray area) and Sell (green area)
- Global: single series — SI=F futures price (silver area), unit selector hidden, Y-axis in USD

### PNL Card Chart
- Replace 200px "Coming soon" placeholder with Recharts area chart
- Single series: portfolio value
- Green fill if trending up, red fill if trending down
- Period tabs already exist (7d/30d): rewire to trigger different query params

**Design tokens used (existing V2 theme):**
- `v2-red-primary` (#B91C1C) — gold buy line
- `v2-green-positive` (#16A34A) — sell line
- `v2-silver-dark` — silver buy line
- `v2-text-secondary` — axis labels
- `v2-border-light` — grid lines

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | Chart request (market, goldCode, period) | Yes: Internet → App | Go backend | User-supplied params |
| 2 | Go backend | Proxied request | Yes: App → External API | mihong.vn / giabac.vn / Yahoo Finance | Outbound to 3rd party |
| 3 | External API | Price JSON response | Yes: External API → App | Go backend | Untrusted data |
| 4 | Go backend | Parsed chart data | No (internal) | Redis cache | Cache storage |
| 5 | Go backend | Normalized response | Yes: App → Internet | Browser | API response |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User chart requests | JWT auth + input validation |
| App → External API | Proxied price requests | Allowlist params, timeout, no user data sent |
| External API → App | Price responses | Response validation, size limits |
| App → Internet | Chart data response | No sensitive data exposed |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Malicious goldCode/period params | Low | Allowlist validation on server |
| T-2 | 2 | App → External API | Information Disclosure | Leaking user info to external API | Low | Only send goldCode/period — no user data |
| T-3 | 3 | External API → App | Spoofing | Fake/manipulated price data | Medium | HTTPS only, response structure validation |
| T-4 | 3 | External API → App | Denial of Service | External API returns huge payload | Low | Response size limit (1MB), timeout (10s) |
| T-5 | 1 | Internet → App | Denial of Service | Flood chart requests to abuse external API | Medium | Rate limiting (existing), Redis cache |

### Authorization Rules

- Chart endpoints require JWT authentication (same as all `/investments/` routes)
- No user-specific data in chart responses — prices are public market data
- No ownership checks needed — chart data is the same for all users

### Input Validation Rules

| Parameter | Validation | Where |
|-----------|-----------|-------|
| `market` | Allowlist: `domestic`, `global` | Backend handler |
| `goldCode` | Allowlist: `SJC`, `999` (domestic only) | Backend handler |
| `period` | Allowlist: `24h`, `15d`, `1m`, `6m`, `1y` | Backend handler |
| `type` (silver) | Allowlist: `C`, `L`, `KG` (domestic only) | Backend handler |
| `days` (silver) | Allowlist: `1`, `7`, `30`, `90`, `365` | Backend handler |

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| mihong.vn API (gold domestic + global) | Downtime, rate limiting, format changes | Redis cache fallback, response structure validation, timeout |
| giabac.vn API (silver domestic) | Downtime, format changes | Redis cache fallback, response structure validation, timeout |
| Yahoo Finance v8 chart API (silver global) | Rate limiting (120/min), blocking UA, format changes | Existing global throttler, User-Agent header, cache fallback |
| No APIs require auth keys | Low risk of credential leak | N/A |

### Sensitive Data Handling

No sensitive data involved. Chart data is public market price information. No PII, no user financial data exposed in chart endpoints.

### Issues & Risks Summary

1. **External API reliability** — mihong.vn, giabac.vn, and Yahoo Finance are external with unknown/varying SLAs. Redis cache fallback mitigates this.
2. **Date parsing complexity** — mihong.vn uses DD/MM/YYYY HH:mm (non-standard). giabac.vn uses ISO dates (days>1) and ISO timestamps (days=1). Yahoo Finance uses Unix timestamps. Backend must handle all formats correctly.
3. **Price unit consistency** — Domestic gold: VND/tael integers. Global gold: USD/ounce floats. Domestic silver: VND/unit floats. Global silver: USD/ounce floats. Frontend must display appropriate currency formatting per market.
4. **Yahoo Finance rate limiting** — The existing global throttler (120 req/min) is shared across all Yahoo Finance calls (quotes + silver chart). Heavy chart usage could compete with scheduled price updates.

## Edge Cases & Error Handling

| Case | Handling |
|------|---------|
| External API timeout (>10s) | Return stale cache if available, else 503 |
| External API returns empty array | Return empty `data: []`, frontend shows "No data available" |
| External API returns malformed JSON | Log error, return stale cache or 503 |
| Redis cache unavailable | Fetch directly from external API (no cache) |
| User has no portfolio history (PNL) | Show empty state message in PNL chart area |
| Very small price movements | Y-axis auto-scales via Recharts domain |
| mihong.vn changes date format | Date parser with fallback, log warning |

## Dependencies & Assumptions

- Redis is available (already used for gold/silver price caching)
- JWT auth middleware is applied to `/investments/` routes (already configured)
- Recharts v3.7.0 is installed and working
- Existing `LineChart` component supports area series
- mihong.vn, giabac.vn, and Yahoo Finance APIs are publicly accessible without API keys
- Domestic prices are in VND, global prices are in USD — no cross-currency conversion needed (display as-is)
- Yahoo Finance v8 chart API patterns already exist in `pkg/yahoo/quote.go` (URL building, headers, response parsing)

## Out of Scope

- Real-time WebSocket price streaming
- Chart annotations or technical indicators (moving averages, RSI, etc.)
- Custom date range picker (only preset periods)
- Chart data export (CSV/image)
- PNL breakdown by investment type
- Unit tests for external API parsers (deferred to future)
- OHLC candlestick charts (area charts only for v1)
