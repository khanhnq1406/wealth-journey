# Market Prices Enhancement Specification

## Summary

Enhance the market prices feature with three changes: (1) Add a new "Giá Ngoại Tệ" (Foreign Currency) price table sourced from vangsaigon API's `currencyNationWide` data, displayed on both landing page and dashboard home page alongside existing gold/silver tables; (2) Expand the silver price table with new sources — Phú Quý (dedicated API), DOJI (text file API), Ancarat (JSON API), and SBJ (display with vangsaigon fallback); (3) Restyle all price table headers to be bigger, bolder, with prominent type names — gold-colored for gold, silver-colored for silver, blue for currency — inspired by the Mi Hồng gold price table design.

## User Stories

- As a user, I want to see foreign exchange rates (USD, EUR, JPY, etc.) alongside gold and silver prices so I can track all market data in one place.
- As a user, I want to see silver prices from multiple Vietnamese brands (Phú Quý, DOJI, Ancarat, SBJ) so I can compare prices across vendors.
- As a user, I want prominent, bold table headers so I can quickly identify the commodity type and buy/sell columns at a glance.

## Functional Requirements

### FR-1: Foreign Currency Price Table

**Description:** Add a new "Giá Ngoại Tệ" table that displays exchange rates from the vangsaigon API's `currencyNationWide` array.

**Data source:** `https://vangsaigon.vn/ws-prices/api/v1/c_prices` → `currencyNationWide` field

**Display rules:**
- Show all ~18 currencies from the API
- Use Saigon region prices (fallback to Hanoi if unavailable — same pattern as gold/silver)
- Rename display names:
  - API `"USD"` → display as `"USD Tự Do"`
  - API `"USD Internalbank"` → display as `"USD Vietcombank"`
  - All other currencies use API name as-is
- Columns: Loại Ngoại Tệ | Mua | Bán
- Price format: VND with thousand separators, no decimals (e.g., "26,857")
- Note: Currency prices from the API are already in VND units (not multiplied), unlike gold/silver which need ×1000

**Locations:**
- Dashboard home page (`/dashboard/home`) — new section after silver table/chart
- Landing page (`/landing`) — new section after silver table/chart (public, shows type names with "Login to view" for prices)
- Prices page (`/dashboard/prices`) — new 4th tab "Ngoại Tệ"

**Acceptance criteria:**
- [ ] Currency table displays all currencies from vangsaigon API
- [ ] USD and USD Internalbank are correctly renamed
- [ ] Prices use Saigon region with Hanoi fallback
- [ ] Table appears on home page, landing page, and prices page
- [ ] Blue-themed header styling consistent with gold/silver pattern
- [ ] Loading and empty states handled gracefully

### FR-2: Expanded Silver Price Sources

**Description:** Replace the current silver table data (vangsaigon-only) with an aggregated list from multiple sources, displaying the following silver types in this exact order:

1. Phú Quý thỏi 1L
2. Phú Quý thỏi 5L,10L
3. Phú Quý 999 - 1Kg
4. Bạc Mỹ nghệ Phú Quý
5. Ancarat Ngân Long 1L
6. Ancarat Ngân Long 5L
7. Ancarat Ngân Long 1kg
8. Ancarat thỏi 999 - 1kg
9. SBJ 1L,10L,50L
10. SBJ 1kg
11. DOJI 99.9 1L
12. DOJI 99.9 5L

**Data sources:**

| Source | API Endpoint | Format | Silver Types |
|--------|-------------|--------|-------------|
| Phú Quý | `https://giabac.phuquygroup.vn/PhuQuyPrice/SilverPricePartial` | HTML partial (table) | Thỏi 1L, 5L/10L, 1Kg, Mỹ nghệ |
| Ancarat | `https://giabac.ancarat.com/api/price-data` | JSON 2D array | Ngân Long 1L, 5L, 1Kg; Thỏi 999 1Kg |
| SBJ | N/A (no API) | — | 1L/10L/50L, 1kg (show rows with "--" prices) |
| DOJI | `https://giabac.doji.vn/data/DataBac9991Luong.txt` | Pipe-delimited text: `buy\|sell\|timestamp` | 99.9 1L (5L = 1L × 5) |

**Phú Quý HTML parsing:**
- Endpoint returns an HTML table partial
- Extract rows: product name, unit (Vnđ/Lượng or Vnđ/Kg), buy price, sell price
- Map to silver types:
  - Row containing "1 lượng" → "Phú Quý thỏi 1L"
  - Row containing "5 lượng" or "10 lượng" → "Phú Quý thỏi 5L,10L"
  - Row containing "Kg" or "1 Kg" → "Phú Quý 999 - 1Kg"
  - Row containing "Mỹ nghệ" or "trang sức" → "Bạc Mỹ nghệ Phú Quý"

**Ancarat JSON parsing:**
- Returns `[[header], [row1], [row2], ...]` where each row = `[name, sell_price, buy_price, code, url?]`
- Prices are comma-formatted strings (e.g., "3,178,000") — need to strip commas and parse as int
- Map by product name:
  - "Ngân Long Quảng Tiến 999 - 1 lượng" → "Ancarat Ngân Long 1L"
  - "Ngân Long Quảng Tiến 999 - 5 lượng" → "Ancarat Ngân Long 5L"
  - "Ngân Long Quảng Tiến 999 - 1 Kilo" → "Ancarat Ngân Long 1kg"
  - "Bạc thỏi ... Ancarat 999 - 1000 gram" → "Ancarat thỏi 999 - 1kg"

**DOJI text file parsing:**
- Endpoint returns multi-line text with `buy|sell|timestamp` per line
- Use the LAST line for current price
- Example: `3054000|3189000|14:20:33 13/03/2026`
- Parse timestamp as update time
- 5L price = 1L price × 5

**SBJ:**
- No API available (prices published as images only)
- Display rows with "--" for buy/sell prices
- Add tooltip or note: "Xem giá tại sacombank-sbj.com"

**Fallback strategy:**
- If a source API fails, skip those types (don't block others)
- Log warning for failed sources
- Each source is fetched independently and in parallel

**Acceptance criteria:**
- [ ] Silver table shows exactly 12 rows in the specified order
- [ ] Phú Quý prices fetched from dedicated API
- [ ] DOJI prices fetched from text file API
- [ ] Ancarat prices fetched from JSON API
- [ ] SBJ rows display "--" with link to SBJ website
- [ ] Failed sources don't block other sources
- [ ] XAGUSD (Silver World) removed from the main silver table (or kept at bottom as reference)

### FR-3: Enhanced Table Header Styling

**Description:** Restyle all three price tables (gold, silver, currency) with bigger, bolder headers inspired by Image #3 (Mi Hồng style).

**Current styling (gold example):**
```
bg-v2-gold-light → text-[11px] font-semibold tracking-[1px]
```

**New styling:**
- **Type name column (first column):** Bold, larger text (16px), prominent font weight (700)
- **MUA/BÁN headers:** Bold, uppercase, larger text (14px), strong contrast
- **Header row:** Taller padding (py-3.5 instead of py-2.5), stronger background
- **Type name cells in tbody:** Bolder (font-bold instead of font-medium), slightly larger (14px)

**Color themes per table:**
- **Gold:** Background `bg-v2-gold-light`, text `text-v2-gold-dark` (existing amber/gold tones)
- **Silver:** Background `bg-v2-silver-light`, text `text-v2-silver-dark` (existing gray tones)
- **Currency:** New blue theme — need to add to Tailwind config:
  - `v2-currency-primary`: `#1E40AF` (blue-800)
  - `v2-currency-dark`: `#1E3A8A` (blue-900)
  - `v2-currency-light`: `#EFF6FF` (blue-50)
  - `v2-currency-accent`: `#3B82F6` (blue-500)

**Acceptance criteria:**
- [ ] Gold table headers are bigger, bolder with gold color theme
- [ ] Silver table headers match the same enhanced style with silver theme
- [ ] Currency table headers match with blue theme
- [ ] Type name column is more prominent (bolder, larger)
- [ ] Consistent styling across all tables (home, landing, prices page)
- [ ] Landing page tables follow the same header pattern

## Non-Functional Requirements

- **Performance:** Currency/silver API calls must not block gold prices. All sources fetched in parallel.
- **Reliability:** Individual source failures must not break the entire market prices response. Graceful degradation.
- **Caching:** Currency prices cached in Redis with 15-minute TTL (same as gold/silver).
- **Security:** Public endpoints (landing page) show type names only, no prices.

## Architecture Changes (C4)

### Diagrams to Update

**L3 Backend (`c4-component-backend.md`):**
- Add `CurrencyPriceService` component in the Service layer
- Add external system connections: `giabac.phuquygroup.vn`, `giabac.ancarat.com`, `giabac.doji.vn`
- Update `SilverPriceService` description to mention multi-source aggregation

**L3 Frontend (`c4-component-frontend.md`):**
- Add `CurrencyPriceTable` component to the Market Prices feature module
- Add `LandingCurrencyPriceTable` to Landing components

### New Diagrams

No new L4 diagrams needed — this extends existing services, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`:**
- Add sequence diagram for "Multi-Source Silver Price Aggregation" showing parallel fetch from 4 sources
- Add sequence diagram for "Currency Price Fetch" from vangsaigon API

### New Flow Diagrams

None needed — these are extensions of existing market price flows.

## Data Model Changes

No database model changes. All price data is API-sourced and cached in Redis.

**New Redis cache keys:**
- `currency_price:{symbol}` — Individual currency prices (TTL: 15 min)
- Silver prices continue using `silver_price:{symbol}:{currency}`

## API Changes

### Modified: `GetMarketPrices` Response

Add `currency` field to the existing response:

```protobuf
message GetMarketPricesResponse {
  bool success = 1;
  string message = 2;
  repeated PriceItem gold = 3;
  repeated PriceItem silver = 4;
  string timestamp = 5;
  repeated PriceItem currency = 6;  // NEW
}
```

### Modified: `GetPublicMarketTypes` Response

Add currency types to the public endpoint:

```json
{
  "success": true,
  "gold": [...],
  "silver": [...],
  "currency": [{"code": "USD", "name": "USD Tự Do", "currency": "VND"}, ...],
  "goldUpdatedAt": ...,
  "silverUpdatedAt": ...,
  "currencyUpdatedAt": ...,
  "timestamp": "..."
}
```

### Reuse existing `PriceItem` for currency

The `PriceItem` proto message already has all needed fields:
- `typeCode` = currency code (e.g., "USD")
- `name` = display name (e.g., "USD Tự Do")
- `buy` / `sell` = exchange rates in VND
- `changeBuy` / `changeSell` = rate changes
- `currency` = "VND" (always, since FX rates are in VND)
- `updatedAt` = timestamp

## UI/UX Changes

### Dashboard Home Page (`/dashboard/home`)

**Current layout (mobile):**
Net Worth → PNL → Gold Table → Gold Chart → Silver Table → Silver Chart → Wallets

**New layout (mobile):**
Net Worth → PNL → Gold Table → Gold Chart → Silver Table → Silver Chart → **Currency Table** → Wallets

**Desktop layout:** Add Currency Table row after Silver row (full width or 2-column with potential Currency Chart placeholder).

### Landing Page (`/landing`)

**New section after silver:** Currency table showing type names with "Login to view" for prices.

### Prices Page (`/dashboard/prices`)

**New 4th tab:** "Ngoại Tệ" alongside Gold, Silver, Symbol Lookup.

### Header Styling (All Tables)

**Before (current):**
- Header row: Small text (11px), light background, thin padding
- Type names in body: Regular weight (medium), 13px

**After (enhanced — inspired by Mi Hồng):**
- Header row: Larger text (13-14px), bold (700), stronger background, thicker padding
- MUA/BÁN: Uppercase, bold, 14px
- Type names in body: Bold (700), 14px, more prominent
- First column (type name) in header: Larger (14px), bold

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | vangsaigon API | Currency rates, gold/silver prices | Yes: Internet → Backend | Go backend | Existing trust boundary |
| 2 | giabac.phuquygroup.vn | Silver prices (HTML) | Yes: Internet → Backend | Go backend | New external source |
| 3 | giabac.ancarat.com | Silver prices (JSON array) | Yes: Internet → Backend | Go backend | New external source |
| 4 | giabac.doji.vn | Silver prices (text file) | Yes: Internet → Backend | Go backend | New external source |
| 5 | Go backend | Processed prices | Yes: Backend → Frontend | Next.js frontend | Existing auth boundary |
| 6 | Go backend (public) | Type names only | Yes: Backend → Public | Landing page | No prices exposed |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Backend (vangsaigon) | Price fetch | Timeout, response size limit, JSON schema validation |
| Internet → Backend (Phú Quý) | Price fetch | Timeout, HTML sanitization, response size limit |
| Internet → Backend (Ancarat) | Price fetch | Timeout, JSON validation, response size limit |
| Internet → Backend (DOJI) | Price fetch | Timeout, text parsing validation, response size limit |
| Backend → Auth Frontend | Authenticated price data | JWT validation, rate limiting |
| Backend → Public Frontend | Type names only | Rate limiting, no price data |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2,3,4 | Internet → Backend | Tampering | Malicious price data from compromised external API | Medium | Validate price ranges (reject < 0, reject absurd values), log anomalies |
| T-2 | 2 | Internet → Backend | Spoofing | HTML injection in Phú Quý response | Low | Parse HTML as data only, never render in backend |
| T-3 | 1-4 | Internet → Backend | DoS | External API hangs/slowness cascading to our backend | Medium | Per-source timeouts (10s), parallel fetch, graceful degradation |
| T-4 | 5 | Backend → Frontend | Info Disclosure | Error messages leaking internal API details | Low | Sanitize error messages, return generic "price unavailable" |
| T-5 | 6 | Backend → Public | Info Disclosure | Currency prices exposed on public endpoint | Low | Public endpoint returns ONLY type names and timestamps, NEVER prices |

### Authorization Rules

- Market prices (with actual values): Requires valid JWT token
- Public market types (names only): No auth required, rate limited by IP

### Input Validation Rules

- Currency rates: Must be > 0, < 1,000,000 VND (sanity check)
- Silver prices: Must be > 0, < 1,000,000,000 VND
- External API responses: Must parse correctly or be skipped
- HTML from Phú Quý: Parse as structured data, never eval/render

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|------------|
| vangsaigon API | Downtime or rate changes | 15-min Redis cache, return stale data on failure |
| Phú Quý API | HTML format changes | Robust parsing with fallback, log parse errors |
| Ancarat API | JSON schema changes | Validate array structure, skip malformed rows |
| DOJI text file | Format changes or removal | Validate pipe-delimited format, skip on parse error |

### Sensitive Data Handling

No sensitive data involved. Exchange rates and silver prices are public market data.

### Issues & Risks Summary

1. **Phú Quý HTML parsing is fragile** — if they change their HTML structure, parsing breaks. Mitigate with robust error handling and logging.
2. **SBJ has no API** — prices will show "--". Users may be confused. Add tooltip explaining unavailability.
3. **Multiple external API calls per request** — could slow down response. Mitigate with parallel fetching and Redis caching.
4. **Currency price format differs from gold/silver** — vangsaigon returns currency prices in raw VND (not ×1000). Must handle differently in the price conversion layer.

## Edge Cases & Error Handling

- **All external silver APIs fail:** Show only SBJ rows with "--" (all sources failed gracefully)
- **vangsaigon API fails but cache exists:** Return cached currency/gold/silver data
- **Ancarat returns empty array or malformed JSON:** Skip Ancarat types, log error
- **DOJI text file is empty:** Skip DOJI types, log error
- **Phú Quý returns unexpected HTML:** Skip Phú Quý types, log error
- **Currency with zero buy/sell:** Skip that currency entry
- **USD Internalbank not in API response:** Skip "USD Vietcombank" row

## Dependencies & Assumptions

- vangsaigon API continues to include `currencyNationWide` in its response (confirmed present)
- Phú Quý, Ancarat, and DOJI APIs remain available and in their current format
- Redis is available for caching (existing infrastructure)
- The `PriceItem` proto message is sufficient for currency data (no new proto types needed)

## Out of Scope

- Currency price charts (no chart data source for FX rates currently)
- Historical FX rate tracking in database
- SBJ silver price scraping (no API available)
- Silver price charts for new sources (Phú Quý, DOJI, Ancarat)
- Currency conversion feature using FX rates (separate feature)
- XAGUSD (Silver World) — to be determined if kept at bottom of silver table or removed
