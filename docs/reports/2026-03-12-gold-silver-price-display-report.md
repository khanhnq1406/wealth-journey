# Gold & Silver Price Display Improvements — Implementation Report

## Summary

Implemented three display improvements across the gold/silver price UI on both the home dashboard and landing page:

1. **Gold table filtering** — Gold price tables now show exactly 9 curated types (SJC, SJC Tự Do, Nhẫn SJC 9999, Nhẫn Doji 9999, SJC Mi Hồng, Nhẫn Mi Hồng 9999, SJC BTMC, Nhẫn BTMC, PNJ) with custom display names, in a fixed order.
2. **API-sourced timestamps** — All 4 price tables (home gold, home silver, landing gold, landing silver) now display "Cập nhật dd/mm/yyyy HH:mm" using real API timestamps instead of browser clock time.
3. **Toggle buttons** — Select dropdowns in GoldPriceChart (SJC/999) and SilverPriceChart (C/L/KG) replaced with toggle button groups matching the market domestic/global toggle styling.

## Spec Reference

`docs/specs/2026-03-12-gold-silver-price-display-spec.md`

## Plan Reference

`docs/plans/2026-03-12-gold-silver-price-display-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 1 | Parse vsg_gold_table in vnprice client | Done | `pkg/vnprice/client.go` |
| 2 | Add timestamps to public endpoint | Done | `handlers/public.go`, `handlers/builder.go` |
| 3 | Create gold filter constant | Done | `features/market-prices/constants/gold-filter.ts` (new) |
| 4 | Create timestamp formatting utility | Done | `features/market-prices/utils/format-update-time.ts` (new) |
| 5 | Update GoldPriceTable + page.tsx | Done | `GoldPriceTable.tsx`, `page.tsx` |
| 7 | Update landing tables + hook + page | Done | `LandingGoldPriceTable.tsx`, `LandingSilverPriceTable.tsx`, `usePublicMarketTypes.ts`, `landing/page.tsx` |
| 8-10 | Replace Select dropdowns with toggles | Done | `GoldPriceChart.tsx`, `SilverPriceChart.tsx`, `LandingGoldPriceChart.tsx` |
| 11 | Update i18n translations | Done | `vi/nav.json`, `en/nav.json` |
| 12 | Build verification | Done | Backend + frontend build successfully |

## Commits

| Commit | Message |
|--------|---------|
| `d4f35ad` | feat(prices): parse vsg_gold_table, add timestamps to public endpoint, create gold filter & timestamp utils |
| `801f00d` | feat(prices): filter gold table to 9 types and use API timestamps |
| `9dfa3f9` | feat(prices): update landing page tables with gold filter and timestamps |
| `657ab87` | feat(prices): replace Select dropdowns with toggle buttons in charts |
| `f1dcb08` | feat(i18n): add updatedTime translation for landing page price tables |
| `d1f441e` | docs(prices): mark gold-silver price display implementation as complete |
| `febfea7` | fix(prices): adjust chart heights and polish table padding/formatting |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| No new endpoints | Public endpoint enhanced with read-only timestamps | Yes |
| No new user inputs | All changes are display/formatting only | Yes |
| Data source trust | vsg_gold_table uses same trusted vangsaigon.vn API | Yes |
| Gold type matching | Strict type code matching, not index-based | Yes |
| Timestamp validation | Guards against invalid/zero timestamps with fallback | Yes |
| Price service nil safety | Nil checks on goldSvc/silverSvc before use | Yes |

## Files Changed (Complete List)

### Backend (Go)

| File | Change |
|------|--------|
| `src/go-backend/pkg/vnprice/client.go` | Added `VSGGoldTable` parsing loop after `GoldNationWide` in `FetchPrices()` |
| `src/go-backend/handlers/public.go` | Added `GoldPriceService`/`SilverPriceService` fields, parallel timestamp fetch, `goldUpdatedAt`/`silverUpdatedAt` in response |
| `src/go-backend/handlers/builder.go` | Wired price services into `NewPublicHandler()` with nil-safe initialization |

### Frontend — New Files

| File | Purpose |
|------|---------|
| `src/wj-client/features/market-prices/constants/gold-filter.ts` | `GOLD_TABLE_FILTER` constant (9 types) + `filterGoldPrices()` function |
| `src/wj-client/features/market-prices/utils/format-update-time.ts` | `formatUpdateTimestamp()` + `getLatestTimestamp()` utilities |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `app/[locale]/dashboard/home/GoldPriceTable.tsx` | Import `filterGoldPrices`, filter prices, display `displayName` |
| `app/[locale]/dashboard/home/page.tsx` | Replace `formatUpdateTime()` with `formatUpdateTimestamp(getLatestTimestamp(...))` for gold/silver independently |
| `app/[locale]/dashboard/home/GoldPriceChart.tsx` | Remove `Select` import, replace with toggle button group |
| `app/[locale]/dashboard/home/SilverPriceChart.tsx` | Remove `Select` import, replace with toggle button group |
| `app/[locale]/dashboard/home/SilverPriceTable.tsx` | Padding/formatting polish (linter) |
| `app/[locale]/landing/page.tsx` | Import `formatUpdateTimestamp`, compute and pass timestamps to table components |
| `components/landing/LandingGoldPriceTable.tsx` | Import `GOLD_TABLE_FILTER`, filter types, add `updatedTime` prop + display |
| `components/landing/LandingSilverPriceTable.tsx` | Add `updatedTime` prop + timestamp display in header |
| `components/landing/LandingGoldPriceChart.tsx` | Replace placeholder div with SJC/999 toggle button group |
| `features/market-prices/hooks/usePublicMarketTypes.ts` | Add `goldUpdatedAt`/`silverUpdatedAt` to `PublicMarketTypesResponse` |

### i18n

| File | Change |
|------|--------|
| `src/wj-client/messages/vi/nav.json` | Added `"updatedTime": "Cập nhật {time}"` to `priceTeaser` |
| `src/wj-client/messages/en/nav.json` | Added `"updatedTime": "Updated {time}"` to `priceTeaser` |

## How to Test

### Gold Table Filtering
1. Navigate to `/dashboard/home` — gold table should show exactly 9 rows
2. Verify display names match: SJC, SJC Tự Do, Nhẫn SJC 9999, Nhẫn Doji 9999, SJC Mi Hồng, Nhẫn Mi Hồng 9999, SJC BTMC, Nhẫn BTMC, PNJ
3. Navigate to `/landing` — landing gold table should show the same 9 filtered types
4. Silver tables should show all types (no filtering)

### Timestamps
1. Gold and silver tables on `/dashboard/home` should display "Cập nhật dd/mm/yyyy HH:mm" with API data timestamp
2. Landing page tables should also display timestamps (sourced from public endpoint)
3. Gold and silver timestamps should be independent (different update times)

### Toggle Buttons
1. Gold chart on `/dashboard/home` — SJC/999 toggle (not dropdown) in domestic mode
2. Silver chart on `/dashboard/home` — C/L/KG toggle (not dropdown) in domestic mode
3. Both toggles should hide when in global mode
4. Toggle active state: white bg + shadow; inactive: transparent + secondary text
5. Landing gold chart — shows SJC/999 toggle placeholder (disabled)
6. Mobile: all toggles should be tappable without overflow

### Build Verification
```bash
cd src/go-backend && go build ./pkg/vnprice/... ./handlers/...
cd src/wj-client && npx next build
```

## Known Issues / Technical Debt

- Pre-existing build errors in `tests/test-files/` and `cmd/migrate-import/` are unrelated to this feature
- If `vsg_gold_table` API array stops returning "Vàng nhẫn SJC" or "PNJ HCM", the table gracefully degrades to 7 rows
