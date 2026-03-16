# Investment Form Enhancements — Implementation Report

## Summary

Enhanced the AddInvestmentForm with four major improvements: (1) reordered type dropdown with merged Gold/Silver entries and new Cash/Foreign Currency types, (2) optional purchase date field for historical investments, (3) price-per-unit input replacing total cost with market price auto-fetch for gold/silver, (4) aligned gold type labels with the price table display names. Changes span all three layers: proto (new enums + field), backend (purchase_date validation and usage), and frontend (form rewrite, i18n, schema, portfolio labels).

## Spec Reference

`docs/specs/2026-03-16-investment-form-enhancements-spec.md`

## Plan Reference

`docs/plans/2026-03-16-investment-form-enhancements-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Proto — Add CASH/FOREIGN_CURRENCY enums and purchase_date field | Done | `04124d9` | investment.proto + generated Go/TS files |
| 2 | Backend — Use purchase_date for initial transaction and lot | Done | `23d6ad8` | investment_service.go |
| 3 | Frontend — Update i18n messages (en + vi) | Done | `4549ea8` | en/investment.json, vi/investment.json |
| 4 | Frontend — Update gold-calculator labels to match price table | Done | `1ef65b8` | gold-calculator.ts |
| 5 | Frontend — Update investment-schema for new types | Done | `d670054` | investment-schema.ts |
| 6 | Frontend — Rewrite AddInvestmentForm with all enhancements | Done | `d53bb5e` | AddInvestmentForm.tsx, silver-calculator.ts |
| 7 | Frontend — Update portfolio page type labels for new types | Done | `e99d08f` | helpers.tsx, PortfolioSummaryEnhanced.tsx, page.tsx |
| 8 | Update Architecture Diagrams | Done | `690ab35` | c4-component-frontend.md, flow-investment.md |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation (purchase_date) | Backend validates `purchase_date > 0` implies `≤ time.Now()` — rejects future dates | Yes |
| Input validation (new types) | New enum values (12, 13) accepted by proto deserialization; backend validates currency/symbol as before | Yes |
| Frontend date constraint | `<input type="date" max={today}>` prevents future date selection in UI | Yes |
| Financial integrity | `totalCost = quantity × pricePerUnit` computed on frontend, sent as `initialCostDecimal`; backend's existing int64 conversion unchanged | Yes |
| Authorization | No changes — JWT middleware + user ownership checks remain | Yes |
| CASH/FOREIGN_CURRENCY handling | Auto-enable custom investment mode (isCustom=true), same validation path as existing custom investments | Yes |

## Architecture Changes

### Proto Layer
- `InvestmentType` enum: Added `INVESTMENT_TYPE_CASH = 12` and `INVESTMENT_TYPE_FOREIGN_CURRENCY = 13`
- `CreateInvestmentRequest`: Added `int64 purchase_date = 11` (optional Unix timestamp, 0 = use current time)
- Generated Go and TypeScript types updated via `task proto:all`

### Backend
- `CreateInvestment` in `investment_service.go`: Added purchase_date validation (must not be future). Added `txDate` variable that uses `time.Unix(req.PurchaseDate, 0)` when provided, otherwise `time.Now()`. Applied to both `InvestmentTransaction.TransactionDate` and `InvestmentLot.PurchasedAt`.

### Frontend
- **AddInvestmentForm** (major rewrite):
  - Type dropdown: 11 items reordered — Gold, Silver, Cash, Foreign Currency, Stock, Crypto, ETF, Bond, Commodity, Mutual Fund, Other
  - Gold/Silver use UI-only values (`GOLD_MERGED`, `SILVER_MERGED`); brand selection determines actual proto type (VND=8/10 or USD=9/11) and currency
  - `getGoldTypeOptions()` / `getSilverTypeOptions()` called without currency filter — all brands shown
  - New `purchaseDate` state with HTML date input, max=today, defaults to today
  - New `pricePerUnit` state replaces `initialCost` form field — totalCost computed as `quantity × pricePerUnit`
  - Auto-fill pricePerUnit from gold/silver market price queries
  - Refresh button for gold/silver price refetch
  - Total cost summary line: "Total cost: {formatted amount}"
  - CASH/FOREIGN_CURRENCY: auto-enable custom investment mode
  - All three submit paths (gold, silver, standard) include `purchaseDate` timestamp
- **gold-calculator.ts**: Updated 6 labels to match price table display names; added missing "Vàng nhẫn SJC" entry (18 VND options total)
- **silver-calculator.ts**: Made `currency` parameter optional in `getSilverTypeOptions()`, returns all options when unspecified
- **investment-schema.ts**: Renamed `GOLD_SILVER_TYPES` → `FLEXIBLE_SYMBOL_TYPES`, added CASH and FOREIGN_CURRENCY
- **i18n**: Added 13 new keys across en + vi (purchaseDate, pricePerUnitLabel, refreshPrice, totalCostSummary, gold/silver/cash/foreignCurrency type labels)
- **Portfolio page**: Added CASH and FOREIGN_CURRENCY to type label maps (helpers.tsx), translation key map (PortfolioSummaryEnhanced.tsx), and filter dropdown (page.tsx)

### Documentation
- C4 frontend diagram: Updated Investment Feature component description
- flow-investment.md: Updated Create Investment sequence diagram with purchase_date validation and txDate branching

## Known Issues / Technical Debt

- The `initialCost` field in `createInvestmentSchema` still exists (used as computed field from `quantity × pricePerUnit`) — could be renamed to `totalCost` for clarity in a future refactor
- ~~Market price auto-fill for standard investments (stocks, crypto, ETF) from `MarketPriceDisplay` is not yet wired to `pricePerUnit` state~~ — **FIXED** (see Fix History below)
- The purchase date HTML `<input type="date">` styling may differ across browsers — could be replaced with a custom DatePicker component in a future UX pass

## Files Changed

### Proto
- `api/protobuf/v1/investment.proto`
- `src/go-backend/protobuf/v1/*.go` (generated)
- `src/wj-client/gen/protobuf/v1/investment.ts` (generated)
- `src/wj-client/utils/generated/api.ts` (generated)
- `src/wj-client/utils/generated/hooks.ts` (generated)

### Backend
- `src/go-backend/domain/service/investment_service.go`

### Frontend
- `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- `src/wj-client/features/investment/utils/gold-calculator.ts`
- `src/wj-client/features/investment/utils/silver-calculator.ts`
- `src/wj-client/features/investment/utils/investment-schema.ts`
- `src/wj-client/messages/en/investment.json`
- `src/wj-client/messages/vi/investment.json`
- `src/wj-client/app/[locale]/dashboard/portfolio/helpers.tsx`
- `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`
- `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`

### Documentation
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-investment.md`
- `docs/reports/2026-03-16-investment-form-enhancements-progress.md`

## How to Test

1. **Merged Gold type**: Navigate to Portfolio → Add Investment → select "Gold". Verify all 19 gold brands (18 VND + 1 USD) appear in the brand dropdown. Select a VND brand — currency should auto-set to VND. Select XAU — currency should auto-set to USD.
2. **Merged Silver type**: Select "Silver". Verify all silver brands (VND + USD) appear. Brand selection auto-sets currency and proto type.
3. **Cash / Foreign Currency**: Select "Cash" or "Foreign Currency". Verify custom investment mode auto-enables (manual symbol/name/currency inputs appear). No market price fetch.
4. **Purchase date**: Verify date input defaults to today. Select a past date. Cannot select a future date (max constraint). Submit — backend should use the selected date for the initial transaction.
5. **Price per unit + auto-fetch**: Select Gold → select a brand (e.g., SJC). Verify price-per-unit auto-fills from market price. Verify total cost summary updates as you change quantity. Click "Current price" to refresh.
6. **Gold label alignment**: In Gold brand dropdown, verify labels match the price table: "SJC" (not "SJC 9999"), "SJC Mi Hồng" (not "Mi Hồng Gold"), "Nhẫn Doji 9999" (not "DOJI 24K"), etc.
7. **Portfolio type filter**: Navigate to Portfolio. Verify "Cash" and "Foreign Currency" appear in the type filter dropdown.
8. **Standard investment**: Select Stock → search for a symbol → manually enter price per unit → set quantity → verify total cost. Submit with a past purchase date.

## Fix History

| Date | Fix | Severity | Commit | Files Changed |
|------|-----|----------|--------|---------------|
| 2026-03-16 | Add missing `typeOptions.gold` and `typeOptions.silver` i18n keys in both en and vi locales — caused IntlError MISSING_MESSAGE in AddInvestmentForm merged gold/silver dropdown | Minor | — | en/investment.json, vi/investment.json |
| 2026-03-16 | Align gold type options (18→9 VND + 1 USD) with `GOLD_TABLE_FILTER` price table; align silver type options (10→11 VND + 1 USD) with silver price API codes | Minor | — | gold-calculator.ts, silver-calculator.ts |
| 2026-03-16 | Add price auto-fill and refresh button to AddInvestmentTransactionForm — uses `useQueryGetMarketPrice` to auto-fill price field on mount, adds refresh button matching AddInvestmentForm pattern, shows market price info box with cached indicator | Minor | — | AddInvestmentTransactionForm.tsx, en/investment.json, vi/investment.json |
| 2026-03-16 | Wire market price auto-fill for standard investments (stocks, crypto, ETF) — adds `useQueryGetMarketPrice` for non-gold/silver symbols, auto-fills `pricePerUnit` via `useEffect`, extends refresh button to standard investments, replaces `MarketPriceDisplay` with inline price display matching gold/silver pattern | Minor | — | AddInvestmentForm.tsx |
| 2026-03-16 | Remove green market price info boxes from AddInvestmentForm — removed the 3 `bg-v2-green-light` display blocks that showed "Giá thị trường hiện tại" for gold, silver, and standard investments. Price queries, auto-fill effects, and refresh button remain functional | Minor | — | AddInvestmentForm.tsx |
| 2026-03-16 | Change default investment type from Stock to Gold — `selectedUIType` now initializes to `GOLD_MERGED`, form defaults to `INVESTMENT_TYPE_GOLD_VND` with VND currency | Minor | — | AddInvestmentForm.tsx |
| 2026-03-16 | Fix price-per-unit auto-fill using `priceDecimal` (human-readable) instead of `price` (smallest currency unit) for gold/silver — previously XAU showed 500784 (cents) in input instead of 5007.84 (dollars). Also fixed total cost display to format consistently without double-dividing by currency multiplier. Same fix applied to AddInvestmentTransactionForm | Minor | — | AddInvestmentForm.tsx, AddInvestmentTransactionForm.tsx |
| 2026-03-16 | Add converted currency display to total cost summary — when investment currency differs from user's preferred currency, shows approximate converted amount below the total cost line (e.g., "Total cost: $100.00" then "≈ ₫2,600,000"). Uses existing `useExchangeRate` hook with 1-hour cache and fallback rates | Minor | — | AddInvestmentForm.tsx, en/investment.json, vi/investment.json |
