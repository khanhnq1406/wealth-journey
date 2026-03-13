# Market Prices Enhancement — Implementation Report

## Summary

Implemented three enhancements to the market prices system:
1. **Foreign Currency Price Table (FR-1)**: New "Giá Ngoại Tệ" table displaying 18 currencies from vangsaigon's `currencyNationWide` data, shown on dashboard home, landing page, and prices page (new "Ngoại Tệ" tab).
2. **Multi-Source Silver Prices (FR-2)**: Replaced single-source vangsaigon silver with parallel aggregation from 4 sources (Phú Quý, Ancarat, DOJI, SBJ) showing 12 ordered rows.
3. **Restyled Price Table Headers (FR-3)**: Bolder, bigger headers with commodity-specific color themes (gold amber, silver gray, currency blue).

## Spec Reference

`docs/specs/2026-03-13-market-prices-enhancement-spec.md`

## Plan Reference

`docs/plans/2026-03-13-market-prices-enhancement-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Add currency colors to Tailwind config | Done | 1 | 938159f |
| 2 | Update Proto — add currency field | Done | 2+ generated | 938159f |
| 3 | Backend — Add CurrencyPrice type and parser | Done | 2 | 938159f |
| 4 | Backend — Add CurrencyPriceService + cache | Done | 3 | 938159f |
| 5 | Backend — Add silver price clients | Done | 4 | 938159f |
| 6 | Backend — Update SilverPriceService | Done | 1 | 474f758 |
| 7 | Backend — Update handlers + builder + DI | Done | 3 | 474f758 |
| 8 | Frontend — Restyle table headers | Done | 4 | e7d1404 |
| 9 | Frontend — Create currency table components | Done | 4 | e7d1404 |
| 10 | Frontend — Update pages (home/landing/prices) | Done | 6 | d49104f |
| 11 | Update C4 + flow diagrams | Done | 4 | 2939f02 |

## Architecture Changes

### Backend — New Components

| Component | File | Purpose |
|-----------|------|---------|
| `CurrencyPriceService` | `domain/service/currency_price_service.go` | Fetches currency prices from vangsaigon, caches in Redis |
| `CurrencyPriceCache` | `pkg/cache/currency_price_cache.go` | Redis cache for currency prices (15min TTL) |
| `CurrencyTypes` | `pkg/currency/types.go` | Static list of 18 expected currency types |
| `PhuQuyClient` | `pkg/silverprice/phuquy_client.go` | HTML parser for Phú Quý silver prices |
| `AncaratClient` | `pkg/silverprice/ancarat_client.go` | JSON parser for Ancarat silver prices |
| `DOJIClient` | `pkg/silverprice/doji_client.go` | Text parser for DOJI silver prices |

### Frontend — New Components

| Component | File | Purpose |
|-----------|------|---------|
| `CurrencyPriceTable` | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` | Dashboard currency table (blue theme) |
| `LandingCurrencyPriceTable` | `components/landing/LandingCurrencyPriceTable.tsx` | Landing page currency table with login prompt |

### Proto Changes

- `GetMarketPricesResponse`: Added `repeated PriceItem currency = 6`
- `GetPublicMarketTypesResponse`: Added `repeated MarketTypeItem currency = 6`

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation | Currency prices are read-only; no user input to validate | N/A |
| Authorization | Market prices endpoint requires auth; public endpoint is rate-limited | Yes |
| External API resilience | Parallel fetch with graceful degradation; partial success returns empty slices | Yes |
| Data integrity | Raw VND int64 values (no float); cache with TTL prevents stale data | Yes |
| Error sanitization | 503 only when all 3 categories fail; no internal details leaked | Yes |

## Playwright E2E Results

Created new test file: `tests/e2e/view-prices-flow.spec.ts` (commit: c2b36a1)

| Test | Description |
|------|-------------|
| Display gold tab by default | Verifies all 4 tabs visible, gold tab active |
| Switch to currency tab | Clicks currency tab, verifies USD/EUR data displayed |
| Switch between all tabs | Navigates gold → silver → currency → symbol |
| Refresh button visibility | Visible on commodity tabs, hidden on symbol tab |
| Mobile tab display | Verifies tabs work on 375px viewport |

## Files Changed (Complete List)

### Backend
- `src/go-backend/pkg/vnprice/types.go` — Added `CurrencyPrice` struct
- `src/go-backend/pkg/vnprice/client.go` — Added currency parsing in `FetchPrices()`
- `src/go-backend/pkg/cache/currency_price_cache.go` — New Redis cache
- `src/go-backend/pkg/currency/types.go` — New static currency types
- `src/go-backend/pkg/silverprice/types.go` — New `ExternalSilverPrice` struct
- `src/go-backend/pkg/silverprice/phuquy_client.go` — New Phú Quý client
- `src/go-backend/pkg/silverprice/ancarat_client.go` — New Ancarat client
- `src/go-backend/pkg/silverprice/doji_client.go` — New DOJI client
- `src/go-backend/domain/service/currency_price_service.go` — New service
- `src/go-backend/domain/service/silver_price_service.go` — Rewritten `FetchAllPrices()`
- `src/go-backend/handlers/market_prices.go` — Added currency support
- `src/go-backend/handlers/public.go` — Added currency types + timestamp
- `src/go-backend/handlers/builder.go` — Wired CurrencyPriceService

### Frontend
- `src/wj-client/tailwind.config.ts` — Added v2-currency color tokens
- `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx` — New component
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx` — Restyled headers
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx` — Restyled headers
- `src/wj-client/app/[locale]/dashboard/home/page.tsx` — Added currency table
- `src/wj-client/app/[locale]/dashboard/prices/page.tsx` — Added currency tab
- `src/wj-client/app/[locale]/landing/page.tsx` — Added currency section
- `src/wj-client/components/landing/LandingCurrencyPriceTable.tsx` — New component
- `src/wj-client/components/landing/LandingGoldPriceTable.tsx` — Restyled headers
- `src/wj-client/components/landing/LandingSilverPriceTable.tsx` — Restyled headers
- `src/wj-client/features/market-prices/hooks/usePublicMarketTypes.ts` — Added currency fields
- `src/wj-client/messages/en/ui.json` — Currency translations
- `src/wj-client/messages/vi/ui.json` — Currency translations
- `src/wj-client/messages/en/nav.json` — Currency tab translation
- `src/wj-client/messages/vi/nav.json` — Currency tab translation
- `src/wj-client/messages/en/investment.json` — Currency prices translations
- `src/wj-client/messages/vi/investment.json` — Currency prices translations

### Proto
- `api/protobuf/v1/investment.proto` — Added currency fields

### Architecture Docs
- `docs/architecture/c4-component-backend.md` — Updated for new services/clients
- `docs/architecture/c4-component-frontend.md` — Updated page/feature descriptions
- `docs/architecture/flow-cross-cutting.md` — Added Market Prices Aggregation Flow

### Tests
- `src/wj-client/tests/e2e/view-prices-flow.spec.ts` — New Playwright tests

## How to Test

1. **Backend**: `cd src/go-backend && go build ./...` — verify compilation
2. **Frontend**: `cd src/wj-client && npm run build` — verify build
3. **E2E**: `cd src/wj-client && npx playwright test tests/e2e/view-prices-flow.spec.ts`
4. **Manual**:
   - Navigate to `/dashboard/prices` → verify 4 tabs (Gold, Silver, Ngoại Tệ, Symbol)
   - Click "Ngoại Tệ" tab → verify currency prices displayed
   - Navigate to `/dashboard/home` → scroll to see currency table
   - Navigate to landing page → verify currency section after silver

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-13 | TypeCode column text color now matches commodity-specific header color (gold amber, silver gray, currency blue) across all 7 price table components | Minor | pending |
| 2026-03-13 | LandingCurrencyPriceTable thead/tbody font weight, size, and padding now matches homepage CurrencyPriceTable (font-bold 14px for type col, font-bold 13px uppercase for buy/sell, py-3.5 padding) | Minor | pending |
| 2026-03-13 | Public endpoint now derives gold/silver/currency type lists from live price services instead of static registries, ensuring landing page shows the same items as the authenticated home page. Falls back to static lists when services are unavailable. | Minor | pending |

## Known Issues / Technical Debt

- Silver SBJ entries are static (Buy/Sell = 0) — displayed as "—" on frontend. Real SBJ API integration deferred.
- No unit tests for new silver price clients (Phú Quý, Ancarat, DOJI) — these parse external HTML/JSON which would require mock servers for proper testing.
- Currency prices rely on vangsaigon API's `currencyNationWide` field format remaining stable.
