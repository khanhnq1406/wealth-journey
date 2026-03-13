# Market Prices Enhancement Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add foreign currency price table, expand silver sources (Phú Quý, DOJI, Ancarat, SBJ), and restyle all price table headers.
**Spec:** `docs/specs/2026-03-13-market-prices-enhancement-spec.md`
**Architecture:** Extends existing vangsaigon API integration to extract `currencyNationWide` data. Adds 3 new external silver price APIs (Phú Quý HTML, Ancarat JSON, DOJI text) fetched in parallel. Frontend adds `CurrencyPriceTable` component and restyled table headers across all 3 commodity types.
**Tech Stack:** Go (Gin, HTTP clients), Next.js/React, Tailwind CSS, Redis, Protocol Buffers

## Security Implementation Notes

- **Authentication:** Currency prices follow same pattern as gold/silver — authenticated via JWT for actual prices, public endpoint returns type names only
- **Authorization:** Market prices are read-only, no user-specific data involved
- **Input validation:** All external API responses validated (price ranges, response format). HTML from Phú Quý parsed as data only. Text from DOJI validated as pipe-delimited format.
- **Data sanitization:** No user-generated content. External API data is numeric prices and type names — validated and sanitized before caching.

---

### Task 1: Add currency colors to Tailwind config

**Files:**
- Modify: `src/wj-client/tailwind.config.ts`

**Steps:**

1. Add currency color tokens to the `v2` object in Tailwind config:
   - `"currency-primary": "#1E40AF"` (blue-800)
   - `"currency-dark": "#1E3A8A"` (blue-900)
   - `"currency-light": "#EFF6FF"` (blue-50)
   - `"currency-accent": "#3B82F6"` (blue-500)

---

### Task 2: Update Proto — add `currency` field to GetMarketPricesResponse and GetPublicMarketTypesResponse

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

**Steps:**

1. Add `repeated PriceItem currency = 6 [json_name = "currency"];` to `GetMarketPricesResponse` (after field 5 `timestamp`)
2. Add `repeated MarketTypeItem currency = 6 [json_name = "currency"];` to `GetPublicMarketTypesResponse` (after field 5 `timestamp`)
3. Add `int64 goldUpdatedAt = 6 [json_name = "goldUpdatedAt"];` and `int64 silverUpdatedAt = 7 [json_name = "silverUpdatedAt"];` and `int64 currencyUpdatedAt = 8 [json_name = "currencyUpdatedAt"];` to `GetPublicMarketTypesResponse` — but wait, field 6 will conflict with currency. Let me renumber:
   - In `GetPublicMarketTypesResponse`: add `repeated MarketTypeItem currency = 6 [json_name = "currency"];` and `int64 goldUpdatedAt = 7 [json_name = "goldUpdatedAt"];` and `int64 silverUpdatedAt = 8 [json_name = "silverUpdatedAt"];` and `int64 currencyUpdatedAt = 9 [json_name = "currencyUpdatedAt"];`
   - Note: The current response already has `goldUpdatedAt`/`silverUpdatedAt` as gin.H fields but they're NOT in the proto. Since the custom hook `usePublicMarketTypes` doesn't use proto types, we only need to add `currency` to the proto.
4. Run `task proto:all` to regenerate Go + TypeScript types

**Note:** The `GetPublicMarketTypesResponse` proto currently doesn't have `goldUpdatedAt`/`silverUpdatedAt` fields — those are returned via `gin.H` directly. We'll follow the same pattern for `currencyUpdatedAt`.

**Revised proto changes:**
- `GetMarketPricesResponse`: add `repeated PriceItem currency = 6 [json_name = "currency"];`
- `GetPublicMarketTypesResponse`: add `repeated MarketTypeItem currency = 6 [json_name = "currency"];`

---

### Task 3: Backend — Add `CurrencyPrice` type and parser to `pkg/vnprice`

**Files:**
- Modify: `src/go-backend/pkg/vnprice/types.go` — add `CurrencyPrice` struct
- Modify: `src/go-backend/pkg/vnprice/client.go` — extract `currencyNationWide` into `PricesResponse`

**Steps:**

1. Add `CurrencyPrice` struct to `types.go`:
   ```go
   type CurrencyPrice struct {
       Name       string
       Buy        float64
       Sell       float64
       BuyChange  float64
       SellChange float64
       Currency   string  // Always "VND"
       UpdateAt   time.Time
   }
   ```

2. Add `CurrencyPrices []CurrencyPrice` field to `PricesResponse`

3. In `client.go` `FetchPrices()`, add parsing loop for `apiResp.CurrencyNationWide`:
   - Iterate entries, skip empty names
   - Use Saigon region, fallback to Hanoi (same pattern as gold/silver)
   - Currency is always "VND" for FX rates
   - Rename: `"USD"` → `"USD Tự Do"`, `"USD Internalbank"` → `"USD Vietcombank"` (set on `CurrencyPrice.Name`, keep original as a separate field or use original as code)
   - Store original API name as a `Code` field for identification
   - Append to `CurrencyPrices` slice

**Important:** Currency prices from vangsaigon are in raw VND (NOT multiplied by 1000 like gold/silver). The `Buy`/`Sell` values are already in VND units.

---

### Task 4: Backend — Add `CurrencyPriceService`

**Files:**
- Create: `src/go-backend/domain/service/currency_price_service.go`

**Steps:**

1. Define `CurrencyPriceService` interface:
   ```go
   type CurrencyPriceService interface {
       FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error)
   }
   ```

2. Define `CachedCurrencyPrice` struct:
   ```go
   type CachedCurrencyPrice struct {
       TypeCode   string    // Original API name (e.g., "USD", "EUR")
       Name       string    // Display name (e.g., "USD Tự Do", "EUR")
       Buy        int64     // Price in VND (NOT multiplied, already in VND units)
       Sell       int64     // Price in VND
       ChangeBuy  int64
       ChangeSell int64
       Currency   string    // Always "VND"
       UpdateTime time.Time
   }
   ```

3. Implement `currencyPriceService`:
   - Uses `vnprice.Client` to fetch prices
   - Uses Redis cache with key `currency_price:{code}` and 15-min TTL
   - Reuse `cache.SilverPriceCache` pattern (or create a generic one)
   - **Price conversion:** Currency prices from API are in raw VND. Store as `int64(apiPrice.Buy)` — NO multiplication by 1000 (unlike gold/silver)
   - Rename logic: if `entry.Name == "USD"` → display "USD Tự Do"; if `entry.Name == "USD Internalbank"` → display "USD Vietcombank"
   - Skip entries with zero buy AND sell prices

4. Create cache helper: `src/go-backend/pkg/cache/currency_price_cache.go`
   - Same pattern as `gold_price_cache.go` and `silver_price_cache.go`
   - Key format: `currency_price:{code}`
   - TTL: 15 minutes

---

### Task 5: Backend — Add silver price clients for Phú Quý, Ancarat, DOJI

**Files:**
- Create: `src/go-backend/pkg/silverprice/phuquy_client.go`
- Create: `src/go-backend/pkg/silverprice/ancarat_client.go`
- Create: `src/go-backend/pkg/silverprice/doji_client.go`
- Create: `src/go-backend/pkg/silverprice/types.go`

**Steps:**

1. Create shared types in `types.go`:
   ```go
   type ExternalSilverPrice struct {
       Name     string
       Buy      int64  // In VND (already converted)
       Sell     int64  // In VND
       Source   string // "phuquy", "ancarat", "doji", "sbj"
   }
   ```

2. **Phú Quý client** (`phuquy_client.go`):
   - Endpoint: `https://giabac.phuquygroup.vn/PhuQuyPrice/SilverPricePartial`
   - Parse HTML response using `golang.org/x/net/html` or regex
   - Extract table rows: product name, buy price, sell price
   - Map rows to types:
     - "1 lượng" → "Phú Quý thỏi 1L"
     - "5 lượng" or "10 lượng" → "Phú Quý thỏi 5L,10L"
     - "Kg" or "1 Kg" → "Phú Quý 999 - 1Kg"
     - "Mỹ nghệ" or "trang sức" → "Bạc Mỹ nghệ Phú Quý"
   - Prices are in VND per unit — store as int64
   - 10-second timeout, return error on failure

3. **Ancarat client** (`ancarat_client.go`):
   - Endpoint: `https://giabac.ancarat.com/api/price-data`
   - Parse JSON 2D array: `[[header], [row1], [row2], ...]`
   - Each row: `[name, sell_price, buy_price, code, url?]`
   - Strip commas from prices, parse as int
   - Map by name:
     - "Ngân Long Quảng Tiến 999 - 1 lượng" → "Ancarat Ngân Long 1L"
     - "Ngân Long Quảng Tiến 999 - 5 lượng" → "Ancarat Ngân Long 5L"
     - "Ngân Long Quảng Tiến 999 - 1 Kilo" → "Ancarat Ngân Long 1kg"
     - "Bạc thỏi ... Ancarat 999 - 1000 gram" → "Ancarat thỏi 999 - 1kg"
   - **Note:** Ancarat returns sell BEFORE buy in the array — `[name, sell, buy, ...]`
   - 10-second timeout

4. **DOJI client** (`doji_client.go`):
   - Endpoint: `https://giabac.doji.vn/data/DataBac9991Luong.txt`
   - Parse multi-line text, use LAST line
   - Format: `buy|sell|timestamp`
   - Parse prices as int64
   - 5L price = 1L price × 5
   - Output two entries: "DOJI 99.9 1L" and "DOJI 99.9 5L"
   - 10-second timeout

---

### Task 6: Backend — Update `SilverPriceService` for multi-source aggregation

**Files:**
- Modify: `src/go-backend/domain/service/silver_price_service.go`

**Steps:**

1. Add dependencies for the new silver price clients (Phú Quý, Ancarat, DOJI)

2. Update `NewSilverPriceService` constructor to accept or create the external clients

3. Update `FetchAllPrices()` to:
   - Fetch from all sources in parallel using goroutines:
     - vangsaigon API (existing — but we'll no longer use its silver data directly since we're replacing with multi-source)
     - Phú Quý API
     - Ancarat API
     - DOJI API
   - Add SBJ static entries with `Buy: 0, Sell: 0` (displayed as "--" on frontend)
   - Aggregate all results into the specified order (12 rows as per spec)
   - If a source fails, skip those types (log warning), don't block others
   - Remove XAGUSD from the main silver table (or keep at bottom — per spec, remove from main table)

4. The ordered output should be:
   ```
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
   ```

5. Each entry uses `CachedSilverPrice` struct (existing):
   - For SBJ: `Buy: 0, Sell: 0, Name: "SBJ 1L,10L,50L"`, `TypeCode: "SBJ_1L10L50L"`
   - For external sources: convert prices to VND int64 (no ×1000 since these APIs return raw VND prices — verify each source)

**Important price conversion notes:**
- Phú Quý: Returns raw VND prices — store directly as int64
- Ancarat: Returns VND with commas — strip commas, parse as int64
- DOJI: Returns raw VND prices — parse as int64
- SBJ: No prices, use 0
- **Frontend display must be updated** to handle these raw VND values vs the ×1000 vangsaigon pattern. Since we're replacing the silver source, we need to be consistent. The simplest approach: store all silver prices in the same format as before (×1000), OR change the format. Since the current silver prices from vangsaigon are multiplied by 1000, and the new sources return raw VND, we have two options:
  - Option A: Multiply new source prices by 1000 too (to match existing format) — but then frontend still divides by 1000
  - Option B: Store raw VND and update frontend — but this breaks gold/silver consistency

**Decision: Option A** — multiply all new silver prices by 1000 to match existing vangsaigon format. Wait — actually, re-examining the code: the vangsaigon API returns prices like `3050.5` which means `3,050,500 VND/lượng`. The `× 1000` converts the API's "thousands" format to full VND. The new APIs (Phú Quý, Ancarat, DOJI) likely return full VND prices like `3050000`. So we should NOT multiply these by 1000.

**Revised approach:** Since we're completely replacing the silver source data in `FetchAllPrices()`, all new silver prices are stored as raw VND (no multiplication). However, the handler still converts `CachedSilverPrice.Buy` to `PriceItem.Buy` — and the frontend `formatPriceValue` for VND does `Intl.NumberFormat("vi-VN", { currency: "VND" })` directly on the value. So if we store raw VND:
- Value `3050000` → formatted as `₫3,050,000` ✓

But the CURRENT silver prices from vangsaigon are stored as `× 1000` (e.g., API `3050.5` → stored `3050500`), and the frontend formats that correctly.

So the question is: do the new APIs return prices in the same "thousands" format as vangsaigon, or as full VND?
- Phú Quý HTML: Likely displays prices like "3,050,000" (full VND)
- Ancarat JSON: Returns "3,178,000" (full VND with commas)
- DOJI text: Returns "3054000" (full VND)

So the new sources return **full VND**. To maintain consistency, we should store them directly as int64 without ×1000. This means the silver table will have prices in raw VND, which is different from the vangsaigon ×1000 format.

**Final decision:** Since we're replacing ALL silver sources in the new FetchAllPrices, we store all new silver prices as raw VND int64. The frontend `formatPriceValue` already handles VND correctly (`Intl.NumberFormat` with currency: "VND"). The ×1000 was only needed because vangsaigon returns values in "thousands" (e.g., 3050.5 = 3,050,500 VND). The new APIs return full VND, so no multiplication needed.

**But wait** — we need to verify: does the handler or any downstream code divide by 1000? Let me check... The handler just copies `p.Buy` to `PriceItem.Buy`. The frontend `formatPriceValue` for VND just formats the number as-is with `Intl.NumberFormat`. So if we store `3050000`, the frontend shows `₫3,050,000`. That's correct.

**One more issue:** The existing `FetchAllPrices()` also caches individual prices via `s.cache.Set()`. We need to ensure cache keys don't collide between old and new formats. Since we're replacing the entire silver source, this should be fine — old cache keys will expire naturally.

---

### Task 7: Backend — Update `MarketPricesHandler` to include currency prices

**Files:**
- Modify: `src/go-backend/handlers/market_prices.go`

**Steps:**

1. Add `currencySvc service.CurrencyPriceService` to `MarketPricesHandler` struct

2. Update `NewMarketPricesHandler` to accept `currencySvc`

3. Update `GetMarketPrices` to fetch currency prices in parallel (3 goroutines total: gold, silver, currency):
   ```go
   wg.Add(3)  // was 2

   go func() {
       defer wg.Done()
       prices, err := h.currencySvc.FetchAllPrices(ctx)
       if err != nil {
           currencyErr = err
           return
       }
       currencyItems = make([]*investmentv1.PriceItem, len(prices))
       for i, p := range prices {
           currencyItems[i] = &investmentv1.PriceItem{
               TypeCode:   p.TypeCode,
               Buy:        p.Buy,
               Sell:       p.Sell,
               ChangeBuy:  p.ChangeBuy,
               ChangeSell: p.ChangeSell,
               Currency:   p.Currency,
               UpdatedAt:  p.UpdateTime.Unix(),
               Name:       p.Name,
           }
       }
   }()
   ```

4. Add `"currency": currencyItems` to response `gin.H`

5. Update error handling: return 503 only if ALL three fail. Partial success returns empty slice for failed ones.

---

### Task 8: Backend — Update `PublicHandler` to include currency types

**Files:**
- Modify: `src/go-backend/handlers/public.go`

**Steps:**

1. Add `currencySvc service.CurrencyPriceService` to `PublicHandler` struct and constructor

2. In `GetPublicMarketTypes`, build currency types (code, name, currency only — no prices):
   - Fetch from `currencySvc.FetchAllPrices()` to get the type names
   - Or define a static list of currency type names (since the public endpoint should NOT fetch actual prices, just type names)
   - **Better approach:** Create a `CurrencyTypes` variable (like `gold.GoldTypes` / `silver.SilverTypes`) that lists all expected currency types with their display names. This avoids hitting external APIs for the public endpoint.

3. Add `"currency": currencyTypes` and `"currencyUpdatedAt": currencyUpdatedAt` to response

---

### Task 9: Backend — Update builder, routes, and DI wiring

**Files:**
- Modify: `src/go-backend/handlers/builder.go`
- Modify: `src/go-backend/handlers/routes.go`

**Steps:**

1. In `builder.go`:
   - Create `CurrencyPriceService` alongside gold/silver services
   - Pass to `NewMarketPricesHandler(goldSvc, silverSvc, currencySvc)`
   - Pass to `NewPublicHandler(goldSvc, silverSvc, currencySvc)`

2. In `routes.go`: No changes needed — the existing market-prices and public routes already serve these handlers.

---

### Task 10: Generate protobuf code

**Steps:**

1. Run `task proto:all` to generate Go and TypeScript code
2. Verify generated types include the `currency` field in both response types
3. Verify `go build ./...` succeeds
4. Verify TypeScript types in `src/wj-client/gen/protobuf/v1/investment.ts` have `currency` field

---

### Task 11: Frontend — Restyle gold/silver table headers (FR-3)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingSilverPriceTable.tsx`

**Steps:**

1. Update table header `<th>` styling across all 4 files:

   **Current:**
   ```
   font-jetbrains font-semibold text-[11px] tracking-[1px]
   py-2.5
   ```

   **New (enhanced — Mi Hồng inspired):**
   - Type name column (first th): `font-vietnam font-bold text-[14px] tracking-normal`
   - MUA/BÁN columns: `font-jetbrains font-bold text-[13px] uppercase tracking-[1px]`
   - Header row padding: `py-3.5` (was `py-2.5`)

2. Update table body type name cells:

   **Current:**
   ```
   font-vietnam font-medium text-[13px]
   ```

   **New:**
   ```
   font-vietnam font-bold text-[14px]
   ```

3. Apply to gold tables (GoldPriceTable + LandingGoldPriceTable) with gold theme:
   - Header bg: `bg-v2-gold-light` (unchanged)
   - Header text: `text-v2-gold-dark` (unchanged)

4. Apply to silver tables (SilverPriceTable + LandingSilverPriceTable) with silver theme:
   - Header bg: `bg-v2-silver-light` (unchanged)
   - Header text: `text-v2-silver-dark` (unchanged)

---

### Task 12: Frontend — Create `CurrencyPriceTable` for dashboard home

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx`

**Steps:**

1. Create component following same pattern as `GoldPriceTable.tsx` / `SilverPriceTable.tsx`

2. Props: `{ prices: PriceItem[], updatedTime?: string }`

3. Table structure:
   - Header: "Loại Ngoại Tệ" | "MUA" | "BÁN"
   - Header styling: blue theme — `bg-v2-currency-light` background, `text-v2-currency-dark` text
   - Apply enhanced Mi Hồng-inspired header styling (same as Task 11)

4. Price formatting: Use `formatPriceValue()` — currency prices are in VND

5. Display `item.name || item.typeCode` for the type name column

---

### Task 13: Frontend — Create `LandingCurrencyPriceTable` for landing page

**Files:**
- Create: `src/wj-client/components/landing/LandingCurrencyPriceTable.tsx`

**Steps:**

1. Follow pattern of `LandingGoldPriceTable.tsx` / `LandingSilverPriceTable.tsx`

2. Props: `{ types: MarketTypeItem[], updatedTime?: string, isLoading?: boolean }`

3. Same blue theme header as `CurrencyPriceTable`

4. Instead of prices, show "Login to view" prompt (same pattern as existing landing tables)

---

### Task 14: Frontend — Update dashboard home page to show currency table

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Steps:**

1. Import `CurrencyPriceTable` component

2. Extract currency prices from `marketPrices`:
   ```typescript
   const currencyPrices = marketPrices?.currency ?? [];
   const currencyUpdatedTime = formatUpdateTimestamp(getLatestTimestamp(currencyPrices));
   ```

3. Add currency table to **mobile layout** after silver chart (position 7, before wallets):
   ```tsx
   {/* 7. Currency Price Table */}
   <CurrencyPriceTable prices={currencyPrices} updatedTime={currencyUpdatedTime} />
   ```

4. Add currency table to **desktop layout** as Row 5 (full width, after silver row):
   ```tsx
   {/* Row 5: Currency Table (full width) */}
   <div className="grid grid-cols-2 gap-6">
     <CurrencyPriceTable prices={currencyPrices} updatedTime={currencyUpdatedTime} />
     {/* placeholder for future currency chart */}
     <div />
   </div>
   ```

---

### Task 15: Frontend — Update landing page to show currency types

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`

**Steps:**

1. Import `LandingCurrencyPriceTable`

2. Extract currency types from public market types response:
   ```typescript
   const currencyTypes = data?.currency ?? [];
   const currencyUpdatedTime = data?.currencyUpdatedAt
     ? formatUpdateTimestamp(data.currencyUpdatedAt)
     : undefined;
   ```

3. Add currency table section after silver section (both mobile and desktop layouts)

4. Update `usePublicMarketTypes` hook interface to include `currency` and `currencyUpdatedAt`:
   - Modify: `src/wj-client/features/market-prices/hooks/usePublicMarketTypes.ts`
   - Add `currency: MarketTypeItem[]` and `currencyUpdatedAt: number` to `PublicMarketTypesResponse`

---

### Task 16: Frontend — Add "Ngoại Tệ" tab to prices page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**Steps:**

1. Update `Tab` type: `type Tab = "gold" | "silver" | "currency" | "symbol";`

2. Add "Ngoại Tệ" tab to `TABS` array (4th position, before symbol)

3. Add currency tab content section using same TanStack/MobileTable pattern:
   - Data: `data?.currency ?? []`
   - Reuse same `tanstackColumns` and `mobileColumns` (same PriceItem shape)

4. Update refresh button logic: show for "currency" tab too

---

### Task 17: Frontend — Add i18n translations for currency

**Files:**
- Modify: Translation files for currency-related labels

**Steps:**

1. Find existing translation files and add currency-related keys:
   - `currencyPriceTitle`: "Giá Ngoại Tệ"
   - `currencyType`: "Loại Ngoại Tệ"
   - Tab label: "Ngoại Tệ"
   - Any other missing keys

---

### Task 18: Frontend — Update prices page helpers for currency formatting

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/helpers.ts`

**Steps:**

1. The existing `formatPriceValue` should already handle VND currency prices correctly
2. Currency prices from the API are in raw VND (int64) — verify that `formatPriceValue(26857, "VND")` produces `₫26,857`
3. If currency prices need different formatting (no ₫ symbol, just number with commas), add a `formatCurrencyRate` helper:
   ```typescript
   export function formatCurrencyRate(value: number | null | undefined): string {
     if (value === null || value === undefined || value === 0) return "--";
     return new Intl.NumberFormat("vi-VN").format(value);
   }
   ```

---

### Task 19: Backend — Define static currency types list

**Files:**
- Create: `src/go-backend/pkg/currency/types.go`

**Steps:**

1. Define `CurrencyType` struct and `CurrencyTypes` variable listing all expected currencies from vangsaigon API:
   ```go
   type CurrencyType struct {
       Code     string // Original API name
       Name     string // Display name
       Currency string // Always "VND"
   }

   var CurrencyTypes = []CurrencyType{
       {Code: "USD", Name: "USD Tự Do", Currency: "VND"},
       {Code: "USD Internalbank", Name: "USD Vietcombank", Currency: "VND"},
       {Code: "EUR", Name: "EUR", Currency: "VND"},
       {Code: "GBP", Name: "GBP", Currency: "VND"},
       {Code: "JPY", Name: "JPY", Currency: "VND"},
       // ... remaining currencies from the API response
   }
   ```

2. This is used by `PublicHandler` to return currency type names without fetching actual prices

---

### Task 20: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. **Backend L3:** Add `CurrencyPriceService` component in Service layer. Add external system connections for `giabac.phuquygroup.vn`, `giabac.ancarat.com`, `giabac.doji.vn`. Update `SilverPriceService` description.

2. **Frontend L3:** Add `CurrencyPriceTable` component to Dashboard Home. Add `LandingCurrencyPriceTable` to Landing components.

---

### Task 21: Create/Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Add sequence diagram for "Multi-Source Silver Price Aggregation" showing parallel fetch from Phú Quý, Ancarat, DOJI, and SBJ static
2. Add sequence diagram for "Currency Price Fetch" from vangsaigon API
3. Update existing market price flow to reference the new sources

---

## Task Execution Order

**Phase 1: Backend Foundation (Tasks 1-4, can partially parallel)**
- Task 2: Proto changes → Task 10: Generate code (blocking)
- Task 3: vnprice currency parser (independent)
- Task 4: CurrencyPriceService (depends on Task 3)
- Task 19: Static currency types (independent)

**Phase 2: Backend Silver Sources (Task 5-6, sequential)**
- Task 5: External silver clients (independent)
- Task 6: Update SilverPriceService (depends on Task 5)

**Phase 3: Backend Integration (Tasks 7-9, sequential)**
- Task 7: Update MarketPricesHandler (depends on Tasks 4, 6)
- Task 8: Update PublicHandler (depends on Task 19)
- Task 9: Update builder/routes (depends on Tasks 7, 8)

**Phase 4: Frontend (Tasks 1, 10-18, partially parallel)**
- Task 1: Tailwind config (independent, do first)
- Task 10: Proto generation (do after Task 2)
- Task 11: Restyle headers (independent of backend)
- Tasks 12-16: New components and page updates (depend on Task 10 for types)
- Tasks 17-18: Translations and helpers

**Phase 5: Documentation (Tasks 20-21)**
- Task 20: C4 diagrams
- Task 21: Flow diagrams

## Dependencies Graph

```
Task 2 (proto) → Task 10 (codegen) → Tasks 12-16 (frontend components)
Task 3 (vnprice) → Task 4 (CurrencyPriceService) → Task 7 (handler)
Task 5 (silver clients) → Task 6 (SilverPriceService) → Task 7 (handler)
Task 19 (static types) → Task 8 (PublicHandler)
Task 7, 8 → Task 9 (builder/routes)
Task 1 (tailwind) → Tasks 11-13 (styling)
```
