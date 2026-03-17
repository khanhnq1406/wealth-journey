# Price Table Dividers & VND Price Formatting — Implementation Report

## Summary

Added row/column dividers to all 9 native `<table>` price components (3 home dashboard + 3 landing page + 3 table variants) and divided VND prices by 100 with "(x100₫)" header labels. This is a purely cosmetic frontend change — no backend, API, or data model modifications.

## Spec Reference
`docs/specs/2026-03-17-price-table-dividers-and-formatting-spec.md`

## Plan Reference
`docs/plans/2026-03-17-price-table-dividers-and-formatting-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Update `formatPriceValue` — divide VND by 100, remove ₫ symbol | Done | `1a878e2` | `helpers.ts` |
| 2 | Add i18n keys `buyUnit`/`sellUnit` "(x100₫)" | Done | `1a878e2` | 6 JSON files |
| 3 | Add dividers + unit labels to Home dashboard tables | Done | `186696e` | 3 TSX files |
| 4 | Add dividers + unit labels to Landing page tables | Done | `fcce2f7` | 3 TSX files |
| 5 | Add unit labels to Prices page column headers | Done | `ae4ba73` | `page.tsx` |
| 6 | Build verification | Done | — | No errors |

## Changes Detail

### 1. VND Price Formatting (`helpers.ts`)

- Added `VND_DIVISOR = 100` constant
- VND values now divided by 100 before display (e.g., raw `8500000` → displayed as `85,000`)
- Removed `style: "currency"` and `currency: "VND"` from `Intl.NumberFormat` — removes ₫ symbol from cells
- `formatChangeValue` automatically benefits since it delegates to `formatPriceValue`
- USD formatting unchanged

### 2. i18n Keys (6 files)

Added `buyUnit` and `sellUnit` keys with value `"(x100₫)"` to:
- `messages/en/investment.json` → `prices.table.buyUnit` / `prices.table.sellUnit`
- `messages/vi/investment.json` → same
- `messages/en/ui.json` → `dashboard.home.buyUnit` / `dashboard.home.sellUnit`
- `messages/vi/ui.json` → same
- `messages/en/nav.json` → `landing.priceTeaser.buyUnit` / `landing.priceTeaser.sellUnit`
- `messages/vi/nav.json` → same

### 3. Home Dashboard Tables (GoldPriceTable, SilverPriceTable, CurrencyPriceTable)

- Added `border-collapse` to `<table>`
- Header `<th>`: Added `border-x border-white/30` with `first:border-l-0` / `last:border-r-0`
- Buy/Sell headers: Wrapped in `<div>` with unit label `<div className="font-normal text-[10px] tracking-normal opacity-70">`
- Body `<tr>`: Added `border-b border-v2-border-light`
- Body `<td>`: Added `border-x border-v2-border-light` with edge cleanup
- Admin column: Same border treatment with `last:border-r-0`
- Color variants preserved (gold-dark, silver-dark, currency-dark)

### 4. Landing Page Tables (LandingGoldPriceTable, LandingSilverPriceTable, LandingCurrencyPriceTable)

- Same divider pattern as home dashboard tables
- Unit labels added to buy/sell headers (even though cells show login prompt)
- **Additional fix:** `LandingSilverPriceTable` changed from `!p-0` override to `padding="none"` prop for consistency

### 5. Prices Page Column Headers (`page.tsx`)

- **TanStack columns (desktop):** Buy/Sell headers now render unit label via `<div className="font-normal text-[10px] text-gray-400">`
- **Mobile columns:** Buy/Sell headers now render unit label via `<span className="text-[10px] text-gray-400 ml-1">`
- Column dividers NOT added to TanStack/Mobile tables (shared components used elsewhere — pragmatic decision per plan)

## Security Implementation Summary

No security concerns — purely cosmetic frontend change:
- No user input involved
- No API changes
- No data persistence changes
- No authorization changes
- Division is a deterministic display transform

## Files Changed (15 total)

| # | File | Change |
|---|------|--------|
| 1 | `app/[locale]/dashboard/prices/helpers.ts` | Divide VND by 100, remove ₫ symbol |
| 2 | `messages/en/investment.json` | Add `buyUnit`, `sellUnit` to `prices.table` |
| 3 | `messages/vi/investment.json` | Add `buyUnit`, `sellUnit` to `prices.table` |
| 4 | `messages/en/ui.json` | Add `buyUnit`, `sellUnit` to `dashboard.home` |
| 5 | `messages/vi/ui.json` | Add `buyUnit`, `sellUnit` to `dashboard.home` |
| 6 | `messages/en/nav.json` | Add `buyUnit`, `sellUnit` to `landing.priceTeaser` |
| 7 | `messages/vi/nav.json` | Add `buyUnit`, `sellUnit` to `landing.priceTeaser` |
| 8 | `app/[locale]/dashboard/home/GoldPriceTable.tsx` | Dividers + unit labels |
| 9 | `app/[locale]/dashboard/home/SilverPriceTable.tsx` | Dividers + unit labels |
| 10 | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` | Dividers + unit labels |
| 11 | `components/landing/LandingGoldPriceTable.tsx` | Dividers + unit labels |
| 12 | `components/landing/LandingSilverPriceTable.tsx` | Dividers + unit labels + fix !p-0 |
| 13 | `components/landing/LandingCurrencyPriceTable.tsx` | Dividers + unit labels |
| 14 | `app/[locale]/dashboard/prices/page.tsx` | Unit labels on TanStack/Mobile headers |
| 15 | `docs/reports/...progress.md` | Implementation progress tracking |

## How to Test

1. **Landing page** (`/landing`): Gold, Silver, Currency tables should show column dividers (semi-transparent white in headers, light gray in body), row dividers, and "(x100₫)" under Buy/Sell headers
2. **Home dashboard** (`/dashboard/home`): Same dividers and unit labels on all 3 price tables
3. **Prices page** (`/dashboard/prices`): Buy/Sell column headers show "(x100₫)" unit label in all tabs (Gold, Silver, Currency)
4. **VND prices**: Should be shorter numbers (divided by 100, no ₫ symbol) — e.g., `85,000` instead of `8.500.000 ₫`
5. **USD prices**: Should be unchanged
6. **Zebra striping**: Should still alternate correctly alongside the new dividers
7. **Admin mode**: Admin edit column should have proper borders too

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-17 | Changed VND_DIVISOR from 100 to 1000; updated i18n labels from "(x100₫)" to "(x1.000₫)" | Minor | `f047f11` |

## Known Issues / Technical Debt

None identified. All changes are additive CSS and i18n modifications.
