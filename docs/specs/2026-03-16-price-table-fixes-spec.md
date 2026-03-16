# Price Table Fixes Specification

## Summary

Fix a critical bug in the Phú Quý silver price parser that misreads column indices (skipping the "ĐƠN VỊ" unit column), resulting in Buy prices showing as "-" and Sell prices showing the wrong value. Additionally, apply UI improvements to all price table tabs: bigger/bolder Buy/Sell headers, remove currency unit formatting from price cells, and color-code Buy (red) and Sell (green) prices.

## User Stories

- As a user, I want to see **both buy and sell prices** for Phú Quý silver products, so I can compare dealer buy-in vs sell-out rates.
- As a user, I want the Buy/Sell column headers to be more prominent, so I can quickly distinguish which column is which.
- As a user, I want prices displayed as plain numbers without currency symbols, so the table is cleaner and easier to scan.
- As a user, I want Buy cells in red and Sell cells in green, so I can visually differentiate price types at a glance.

## Functional Requirements

### FR-1: Fix Phú Quý Silver Price Parser (Bug Fix)

The HTML partial from `https://giabac.phuquygroup.vn/PhuQuyPrice/SilverPricePartial` has **4 columns** per data row:

| Index | Column | Example |
|-------|--------|---------|
| cells[0] | SẢN PHẨM (Product) | "BẠC MIẾNG PHÚ QUÝ 999 1 LƯỢNG" |
| cells[1] | ĐƠN VỊ (Unit) | "Vnđ/Lượng" |
| cells[2] | GIÁ MUA VÀO (Buy) | "3,022,000" |
| cells[3] | GIÁ BÁN RA (Sell) | "3,115,000" |

**Current bug:** The parser reads `cells[1]` as buy (gets "Vnđ/Lượng" → parses to 0 → shows "-") and `cells[2]` as sell (gets 3,022,000 which is actually the buy price). `cells[3]` (actual sell price) is never read.

**Fix:** Update `parsePhuQuyHTML()` in `pkg/silverprice/phuquy_client.go` to:
1. Require `len(cells) >= 4` (was `>= 3`)
2. Read `cells[2]` as buy price (GIÁ MUA VÀO)
3. Read `cells[3]` as sell price (GIÁ BÁN RA)
4. Skip `cells[1]` (unit column)

**Acceptance criteria:**
- [ ] Phú Quý silver items show buy price (e.g., 3,022,000) in the Buy column
- [ ] Phú Quý silver items show sell price (e.g., 3,115,000) in the Sell column
- [ ] No regression for Ancarat, DOJI, or SBJ silver prices
- [ ] No regression for gold prices

### FR-2: Bigger/Bolder Buy/Sell Column Headers

Make the Buy and Sell column headers more visually prominent in all price tables (Gold, Silver, Currency tabs).

**Acceptance criteria:**
- [ ] Buy/Sell headers use larger font size (text-base or text-lg vs current default)
- [ ] Buy/Sell headers use font-bold weight
- [ ] Applies to both TanStack (desktop) and MobileTable (mobile) column headers
- [ ] Other column headers (Type, Change) remain unchanged

### FR-3: Remove Currency Unit from Price Cells

Remove the currency symbol/unit from formatted prices in the price table. Show only the number.

**Current:** `3.022.000 ₫` or `$2,800.00`
**New:** `3,022,000` or `2,800.00`

**Acceptance criteria:**
- [ ] VND prices show as formatted number without "₫" symbol (e.g., "3,022,000")
- [ ] USD prices show as formatted number without "$" prefix (e.g., "2,800.00")
- [ ] Change column also removes currency unit
- [ ] Applies to all tabs (Gold, Silver, Currency)

### FR-4: Color-Code Buy and Sell Price Cells

Apply distinctive colors to Buy and Sell price cells for visual differentiation.

**Color scheme:**
- Buy cells: **red text** (`text-lred` / `#DC2626` — existing design token)
- Sell cells: **green text** (`text-v2-green-positive` — existing design token)

**Acceptance criteria:**
- [ ] Buy price cells render in red across all tabs
- [ ] Sell price cells render in green across all tabs
- [ ] Colors apply in both desktop (TanStack) and mobile (MobileTable) views
- [ ] Dark mode compatible (check existing dark: variants for these colors)

## Non-Functional Requirements

- Performance: No impact (styling-only changes for FR-2/3/4, parser fix for FR-1)
- Security: No new attack surfaces — parser fix is read-only HTML parsing

## Data Model Changes

None.

## API Changes

None — the PriceItem proto already has both `buy` and `sell` fields. The fix is in the parser that populates them.

## UI/UX Changes

### Affected Pages
- `/dashboard/prices` — all tabs (Gold, Silver, Currency)

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price table (desktop) | TanStackTable | `components/table/TanStackTable` |
| Price table (mobile) | MobileTable | `components/table/MobileTable` |
| Price formatting | formatPriceValue | `app/[locale]/dashboard/prices/helpers.ts` |
| Change formatting | formatChangeValue | `app/[locale]/dashboard/prices/helpers.ts` |

### New Components
None — all changes are modifications to existing code.

## Security & Risk Assessment

### Data Flow Diagram
| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Phú Quý HTML API | Silver prices HTML | Yes: Internet → Backend | parsePhuQuyHTML() | Read-only fetch |
| 2 | parsePhuQuyHTML() | ExternalSilverPrice | No | SilverPriceService | Internal |
| 3 | SilverPriceService | CachedSilverPrice | No | MarketPricesHandler | Internal |
| 4 | MarketPricesHandler | PriceItem JSON | Yes: Backend → Frontend | Browser | JWT-authenticated |

### Threats Identified (STRIDE per boundary crossing)
| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → Backend | Tampering | Phú Quý HTML structure changes | Low | Parser validates cell count; logs warnings on parse failure |
| T-2 | 1 | Internet → Backend | Spoofing | DNS hijack returning fake prices | Low | HTTPS, no action — standard risk for price feeds |

### Issues & Risks Summary
1. **Low risk:** If Phú Quý changes their HTML structure again, the parser could break. Mitigation: the `len(cells) >= 4` check will cause rows to be skipped (returning "-") rather than showing wrong data.

## Edge Cases & Error Handling

- **Phú Quý HTML changes:** If they add/remove columns, the `>= 4` check safely skips unparseable rows
- **Category headers in HTML:** Already filtered by name check (`strings.Contains(nameLower, "sản phẩm")`)
- **Zero prices:** Both buy=0 and sell=0 → row is skipped (existing behavior)
- **Dark mode:** Verify `text-lred` and `text-v2-green-positive` have appropriate dark mode variants

## Out of Scope

- Gold price parser changes (gold uses a different data source — vnprice/vang.today, not Phú Quý HTML)
- Relabeling "Mua"/"Bán" to "Mua vào"/"Bán ra" (not requested)
- Adding a unit/currency column to the table
- ChangeSell display (only ChangeBuy is shown — not part of this change)
