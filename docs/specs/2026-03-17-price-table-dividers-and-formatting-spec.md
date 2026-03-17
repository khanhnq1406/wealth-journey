# Price Table Dividers & VND Price Formatting Specification

## Summary

Add thin line dividers between rows and columns in all price tables (landing, home, /dashboard/prices) and divide VND prices by 100 for shorter display. Remove the ₫ currency symbol from cells and add a "(x100₫)" unit label in column headers instead.

## User Stories

- As a user, I want clear visual separation between rows and columns in price tables, so prices are easier to read at a glance
- As a user, I want shorter VND price numbers (955,000 instead of 95,500,000), so the table is less cluttered and easier to scan

## Functional Requirements

### FR-1: Table Line Dividers

Add 1px light gray borders between all rows and all columns in price tables.

**Affected components (9 total):**

| Page | Component | File |
|------|-----------|------|
| Landing | LandingGoldPriceTable | `components/landing/LandingGoldPriceTable.tsx` |
| Landing | LandingSilverPriceTable | `components/landing/LandingSilverPriceTable.tsx` |
| Landing | LandingCurrencyPriceTable | `components/landing/LandingCurrencyPriceTable.tsx` |
| Home | GoldPriceTable | `app/[locale]/dashboard/home/GoldPriceTable.tsx` |
| Home | SilverPriceTable | `app/[locale]/dashboard/home/SilverPriceTable.tsx` |
| Home | CurrencyPriceTable | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` |
| Prices | TanStackTable (gold tab) | `app/[locale]/dashboard/prices/page.tsx` |
| Prices | TanStackTable (silver tab) | `app/[locale]/dashboard/prices/page.tsx` |
| Prices | MobileTable (all tabs) | `app/[locale]/dashboard/prices/page.tsx` |

**Acceptance criteria:**
- [ ] 1px solid light gray border between every row (horizontal divider)
- [ ] 1px solid light gray border between every column (vertical divider)
- [ ] Dividers use existing `border-v2-border-light` color for consistency
- [ ] Header row retains its colored background but gains column dividers
- [ ] Alternating row backgrounds are kept (divider adds to, not replaces, the zebra pattern)
- [ ] No double borders at table edges (table uses `border-collapse: collapse`)

### FR-2: VND Price Division by 100

Divide VND prices by 100 in the display layer for shorter numbers.

**Current:** `95,500,000` (raw value from API)
**New:** `955,000` (divided by 100)

**Acceptance criteria:**
- [ ] All VND prices in landing, home, and /dashboard/prices tables are divided by 100
- [ ] USD prices remain unchanged (already divided by 100 for cents)
- [ ] Division happens in the `formatPriceValue` function (single source of truth)
- [ ] Change values (price changes) are also divided by 100 for VND

### FR-3: Remove ₫ Symbol from Price Cells

Remove the Vietnamese Dong currency symbol from price cells.

**Current:** `₫95,500,000`
**New:** `955,000`

**Acceptance criteria:**
- [ ] No ₫ symbol in any price cell across all price tables
- [ ] Numbers formatted with comma thousand separators (vi-VN locale formatting minus the symbol)

### FR-4: Unit Label in Column Headers

Add "(x100₫)" unit label to Buy/Sell column headers for VND price tables.

**Acceptance criteria:**
- [ ] Buy header shows "MUA (x100₫)" or localized equivalent
- [ ] Sell header shows "BÁN (x100₫)" or localized equivalent
- [ ] Unit label only appears for VND price tables (gold VND, silver VND, currency)
- [ ] USD price tables (if any) do not show the VND unit label
- [ ] Label is styled smaller/lighter than the main header text to not overwhelm

## Non-Functional Requirements

- **Performance**: Division by 100 is O(1) per cell — negligible impact. No concern.
- **Backwards compatibility**: Only display formatting changes. No API, backend, or data model changes.

## Architecture Changes (C4)

No architecture changes needed. This is a frontend-only display formatting change.

## Runtime Flow Diagrams

No flow diagram changes needed. No new business logic or multi-step flows.

## Data Model Changes

None. Backend prices remain unchanged.

## API Changes

None. Frontend-only changes.

## UI/UX Changes

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price formatting | `formatPriceValue()` | `app/[locale]/dashboard/prices/helpers.ts` |
| Gold price table (home) | `GoldPriceTable` | `app/[locale]/dashboard/home/GoldPriceTable.tsx` |
| Silver price table (home) | `SilverPriceTable` | `app/[locale]/dashboard/home/SilverPriceTable.tsx` |
| Currency price table (home) | `CurrencyPriceTable` | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` |
| Gold price table (landing) | `LandingGoldPriceTable` | `components/landing/LandingGoldPriceTable.tsx` |
| Silver price table (landing) | `LandingSilverPriceTable` | `components/landing/LandingSilverPriceTable.tsx` |
| Currency price table (landing) | `LandingCurrencyPriceTable` | `components/landing/LandingCurrencyPriceTable.tsx` |
| TanStack table | `TanStackTable` | `components/table/TanStackTable.tsx` |
| Mobile table | `MobileTable` | `components/table/MobileTable.tsx` |

### New Components

None needed. All changes are modifications to existing components and the shared `formatPriceValue` helper.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Backend API | Raw VND prices (int64) | No | Frontend formatter | Display-only transform |

### Threats Identified

None. This is a purely cosmetic frontend change:
- No user input involved
- No API changes
- No data persistence changes
- No authorization changes
- Division is a deterministic display transform — does not affect stored values

### Issues & Risks Summary

1. **Risk: Confusion about price values** — Mitigated by the "(x100₫)" header label
2. **Risk: Inconsistency if new price tables are added later** — Mitigated by centralizing the division in `formatPriceValue()`

## Edge Cases & Error Handling

- Null/undefined prices: Already handled by `formatPriceValue` returning "-"
- Zero prices: 0 / 100 = 0, displays as "0" — correct
- Very small VND values: If a price is < 100, dividing by 100 gives a decimal. The formatter uses `maximumFractionDigits: 0`, so it rounds. This is acceptable for gold/silver/currency prices which are always large numbers.

## Dependencies & Assumptions

- Assumes all VND prices in the market price tables are large enough that dividing by 100 produces meaningful integers
- Assumes the "(x100₫)" convention is understood by Vietnamese users (standard in gold price displays)

## Out of Scope

- Backend price storage changes
- Non-market-price tables (wallets, transactions, budgets)
- USD price formatting changes
