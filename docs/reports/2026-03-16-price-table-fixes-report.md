# Price Table Fixes — Implementation Report

## Summary

Fixed a critical bug in the Phú Quý silver price parser that caused Buy prices to show as "-" and Sell prices to display the wrong value. Additionally applied UI improvements to all price table tabs: bigger/bolder Buy/Sell headers and color-coded Buy (red) / Sell (green) price cells.

## Spec Reference

`docs/specs/2026-03-16-price-table-fixes-spec.md`

## Changes

### 1. Bug Fix: Phú Quý Silver Price Parser (Critical)

**File:** `src/go-backend/pkg/silverprice/phuquy_client.go`

**Root cause:** The Phú Quý HTML partial (`/PhuQuyPrice/SilverPricePartial`) has 4 columns per data row:

| Index | Column | Example |
|-------|--------|---------|
| cells[0] | SẢN PHẨM (Product) | "BẠC MIẾNG PHÚ QUÝ 999 1 LƯỢNG" |
| cells[1] | ĐƠN VỊ (Unit) | "Vnđ/Lượng" |
| cells[2] | GIÁ MUA VÀO (Buy) | "3,022,000" |
| cells[3] | GIÁ BÁN RA (Sell) | "3,115,000" |

The parser was reading `cells[1]` (Unit) as buy and `cells[2]` (Buy) as sell, completely missing `cells[3]` (actual Sell price).

**Fix:**
- Changed minimum cell count check from `>= 3` to `>= 4`
- Read `cells[2]` as buy price (was `cells[1]`)
- Read `cells[3]` as sell price (was `cells[2]`)
- Skip `cells[1]` (unit column)

**Before:** Phú Quý rows showed "-" for Buy, and the Buy price (3,022,000) in the Sell column.
**After:** Both Buy (3,022,000) and Sell (3,115,000) display correctly.

### 2. UI: Bigger/Bolder Buy/Sell Headers

**File:** `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

- Desktop (TanStack): Buy/Sell headers now use `text-base font-bold` via custom header render function
- Mobile (MobileTable): Buy/Sell headers now use `text-base` (MobileTable wrapper already applies `font-bold`)
- Applies to all tabs: Gold, Silver, Currency

### 3. UI: Color-Coded Buy/Sell Price Cells

**File:** `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

- Buy cells: `text-lred` (#DC2626 — red) in both desktop and mobile
- Sell cells: `text-v2-green-positive` (green) in both desktop and mobile
- Applies to all tabs: Gold, Silver, Currency

### 4. Infrastructure: MobileTable ReactNode Header Support

**File:** `src/wj-client/components/table/MobileTable.tsx`

- Previously, when `header` was a ReactNode (not a string), the component fell back to `column.id` as plain text
- Updated to render `column.header` directly regardless of type (string or ReactNode)
- This enables styled headers (like the bold Buy/Sell) in MobileTable

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `src/go-backend/pkg/silverprice/phuquy_client.go` | Bug fix | Fix column index mapping for 4-column HTML table |
| `src/wj-client/app/[locale]/dashboard/prices/page.tsx` | UI enhancement | Bold headers + color-coded Buy/Sell cells |
| `src/wj-client/components/table/MobileTable.tsx` | Enhancement | Support ReactNode headers |

## Not Changed (Reverted)

- **Currency symbol removal** — Initially removed ₫ and $ symbols from price formatting in `helpers.ts`. Reverted per user request. Prices still display with currency symbols.

## How to Test

1. **Phú Quý parser fix:** Navigate to `/dashboard/prices` → Silver tab. Phú Quý items should now show both Buy and Sell prices (not "-" for Buy).
2. **Header styling:** All tabs should show Buy/Sell headers in larger, bolder text compared to Type and Change headers.
3. **Color coding:** Buy prices should appear in red, Sell prices in green across all tabs (Gold, Silver, Currency) on both desktop and mobile.
4. **Regression:** Verify Ancarat, DOJI, and SBJ silver prices still display correctly. Verify Gold and Currency tabs are unaffected by the parser change.
