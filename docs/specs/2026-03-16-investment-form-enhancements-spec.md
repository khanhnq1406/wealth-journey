# Investment Form Enhancements Specification

## Summary

Enhance the AddInvestmentForm with: (1) reordered investment types with two new proto enum values (CASH, FOREIGN_CURRENCY), merging VN/World gold into one "Vàng" and VN/World silver into one "Bạc" (11 items total, auto-detect actual proto type from brand selection), (2) an optional purchase date field defaulting to today, (3) gold/silver dropdown labels aligned with home page price table display names, and (4) replacing "Total Initial Cost" with "Price per unit" that auto-fetches market price and includes a "Giá hiện tại" refresh button.

**Dependency:** This feature layers on top of the decouple-investment-wallet feature (`docs/plans/2026-03-16-decouple-investment-wallet-plan.md`). The decouple plan removes wallet selector, balance validation, and wallet props from AddInvestmentForm. This spec assumes those changes are already applied.

## User Stories

- As a user, I want investment types ordered by my most-used categories (gold, silver, cash first), so I can find the right type faster.
- As a user, I want to optionally record the purchase date when adding an investment.
- As a user, I want gold/silver brand names in the form dropdown to match the names shown in the market prices dashboard.
- As a user, I want to enter the price per unit (not total cost), have it auto-filled from market data, and refresh it with a button — same UX as the transaction form.

## Functional Requirements

### FR-1: Reorder Investment Types and Add New Types

**Description:** Reorder the investment type dropdown and add two new proto enum values: `INVESTMENT_TYPE_CASH (12)` and `INVESTMENT_TYPE_FOREIGN_CURRENCY (13)`. Merge VN and World gold into a single "Vàng" type, and merge VN and World silver into a single "Bạc" type. The brand/type dropdown shows all options (VND + USD) together, and the actual proto `InvestmentType` (GOLD_VND/GOLD_USD/SILVER_VND/SILVER_USD) is auto-determined from the selected brand's currency.

**New ordered list (11 items in main dropdown):**
1. Vàng — brand dropdown shows 18 items (17 VND + 1 USD), actual type auto-set to GOLD_VND or GOLD_USD
2. Bạc — brand dropdown shows 11 items (10 VND + 1 USD), actual type auto-set to SILVER_VND or SILVER_USD
3. Tiền mặt — CASH (new)
4. Ngoại tệ — FOREIGN_CURRENCY (new)
5. Cổ phiếu — STOCK
6. Crypto — CRYPTOCURRENCY
7. ETF
8. Trái phiếu — BOND
9. Hàng hóa — COMMODITY
10. Quỹ tương hỗ — MUTUAL_FUND
11. Khác — OTHER

**Type auto-detection for gold/silver:**
- User selects "Vàng" from main dropdown → brand dropdown shows ALL gold options (VND + USD)
- When user picks a brand (e.g., "SJC" → currency=VND → actual type=GOLD_VND; "Gold World XAU/USD" → currency=USD → actual type=GOLD_USD)
- Same for "Bạc": brand selection determines SILVER_VND or SILVER_USD
- The main dropdown value "Vàng" / "Bạc" is a UI-only grouping; the proto `type` field sent to backend is the specific GOLD_VND/GOLD_USD/SILVER_VND/SILVER_USD

**Acceptance criteria:**
- [ ] Proto enum `InvestmentType` has new values `INVESTMENT_TYPE_CASH = 12` and `INVESTMENT_TYPE_FOREIGN_CURRENCY = 13`
- [ ] Frontend main type dropdown shows 11 items in the specified order
- [ ] Selecting "Vàng" shows a brand dropdown with ALL gold types (VND + USD merged)
- [ ] Selecting "Bạc" shows a brand dropdown with ALL silver types (VND + USD merged)
- [ ] Actual proto `type` value is auto-determined from the selected brand's currency (GOLD_VND vs GOLD_USD, SILVER_VND vs SILVER_USD)
- [ ] CASH and FOREIGN_CURRENCY types behave like OTHER (custom investment — manual symbol, name, currency)
- [ ] Generated TypeScript types include the new enum values after `task proto:all`
- [ ] Backend investment service accepts the new types without errors

### FR-2: Optional Purchase Date Field

**Description:** Add an optional date field "Ngày mua" to AddInvestmentForm that defaults to today's date but is not required for submission.

**Acceptance criteria:**
- [ ] Date input field appears in the form (after quantity, before price)
- [ ] Defaults to today's date (YYYY-MM-DD format)
- [ ] User can clear the date or change it
- [ ] Form submits successfully without a date (sends 0 or empty to backend)
- [ ] If a date is provided, it's sent as a Unix timestamp to `CreateInvestment`
- [ ] Proto `CreateInvestmentRequest` includes a `purchase_date` field (int64 Unix timestamp, 0 = not set)
- [ ] Backend stores the date on the first investment transaction (or on the investment record)

### FR-3: Align Gold/Silver Dropdown Labels with Price Table

**Description:** Update gold/silver type dropdown options so their `label` values match the `displayName` values used in the home page gold price table and dashboard market prices page.

**Current mismatches to fix:**

| Form Dropdown (label) | Price Table (displayName) | Aligned Label |
|----------------------|--------------------------|---------------|
| SJC 9999 | SJC | SJC |
| Mi Hồng Gold | SJC Mi Hồng | SJC Mi Hồng |
| Bảo Tín SJC | SJC BTMC | SJC BTMC |
| DOJI 24K | Nhẫn Doji 9999 | Nhẫn Doji 9999 |
| Bảo Tín 24K | Nhẫn BTMC | Nhẫn BTMC |
| Mi Hồng 999 | Nhẫn Mi Hồng 9999 | Nhẫn Mi Hồng 9999 |
| Vàng nhẫn SJC (not in form) | Nhẫn SJC 9999 | Nhẫn SJC 9999 |

Additionally, the dropdown should show the `value` (type code) alongside the label for easier identification, similar to stock ticker symbols.

**Acceptance criteria:**
- [ ] Gold VND dropdown labels match the GOLD_TABLE_FILTER `displayName` values where overlap exists
- [ ] Gold types not in the price table keep their current labels (Eximbank, TPBank, etc.)
- [ ] Silver dropdown labels are consistent with silver price table display
- [ ] Dropdown option shows both the display name and the type code (e.g., "SJC" or "SJC TD")

### FR-4: Replace Total Cost with Price Per Unit + Auto-Fetch

**Description:** In AddInvestmentForm, replace the "Total Initial Cost" field with a "Price per unit" (Đơn giá) field. Auto-fill the price from market data when a symbol/type is selected. Add a "Giá hiện tại" button to refresh the current market price. Calculate total cost internally as `quantity × price`.

**Acceptance criteria:**
- [ ] "Total Initial Cost" field replaced with "Đơn giá (đ/unit)" field
- [ ] Price auto-fills from market data when:
  - Gold/silver type is selected (using existing `useQueryGetMarketPrice`)
  - Symbol is selected via SymbolAutocomplete (for stocks/crypto/ETF)
- [ ] "Giá hiện tại" button next to price field that re-fetches the current market price
- [ ] Button shows loading spinner while fetching
- [ ] User can manually override the auto-filled price
- [ ] Total cost calculated as `quantity × pricePerUnit` (used in mutation)
- [ ] A read-only summary line below the price field shows "Tổng chi phí: {formatted amount}" — auto-updates as quantity or price changes
- [ ] For gold VND: price is per lượng (tael), displayed with Vietnamese number formatting
- [ ] For gold USD: price is per ounce
- [ ] For stocks/crypto: price is per share/unit
- [ ] Backend `CreateInvestmentRequest` field changes: use `initialCostDecimal` = `quantity × pricePerUnit` (calculated on frontend)
- [ ] Balance preview (if still shown) uses calculated total cost
- [ ] The AddInvestmentTransactionForm already has this pattern — reuse the same UX

## Non-Functional Requirements

- **Performance:** Market price auto-fetch uses existing 5-minute cache. No additional API calls.
- **Backward compatibility:** New proto enum values are additive. Old clients that don't know about CASH/FOREIGN_CURRENCY will see enum value 12/13 as UNRECOGNIZED, which is safe.
- **i18n:** All new labels must have Vietnamese (vi) and English (en) translations.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-frontend.md`** — Update AddInvestmentForm description to reflect new type grouping, date field, and price-per-unit UX.

### New Diagrams

None needed — this is a form UI enhancement, no new domain complexity.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-investment.md`** — Update "Create Investment" flow to show the optional `purchase_date` field being stored. Minor update only.

### New Flow Diagrams

None needed.

## Data Model Changes

### Proto Changes

```protobuf
// In investment.proto — add to InvestmentType enum:
INVESTMENT_TYPE_CASH = 12;              // Cash/savings tracking
INVESTMENT_TYPE_FOREIGN_CURRENCY = 13;  // Foreign currency holdings

// In investment.proto — add to CreateInvestmentRequest:
int64 purchase_date = 11;  // Optional: Unix timestamp of purchase date (0 = not set)
```

### Database Changes

No schema changes. The `purchase_date` will be stored as the `transaction_date` of the initial BUY transaction that `CreateInvestment` already creates internally. The investment type column already supports any int value.

## API Changes

### Modified Proto Messages

| Message | Change |
|---------|--------|
| `InvestmentType` enum | Add `CASH = 12`, `FOREIGN_CURRENCY = 13` |
| `CreateInvestmentRequest` | Add `int64 purchase_date = 11` (optional, 0 = not set) |

### Behavior Changes

| Endpoint | Change |
|----------|--------|
| `POST /api/v1/investments` | Accepts new types (12, 13). Uses `purchase_date` as transaction date for the initial BUY transaction if > 0, else uses current time. |

## UI/UX Changes

### AddInvestmentForm — New Layout

```
┌─────────────────────────────────────┐
│ Loại đầu tư *                       │
│ ┌─────────────────────────────┐     │
│ │ Vàng                     ▼  │     │ ← 11 items, new order
│ └─────────────────────────────┘     │
│                                     │
│ Thương hiệu *                       │ ← Only for gold/silver types
│ ┌─────────────────────────────┐     │
│ │ SJC                      ▼  │     │ ← Dropdown with aligned labels
│ └─────────────────────────────┘     │
│                                     │
│ Ngày mua                            │ ← Optional, defaults today
│ ┌─────────────────────────────┐     │
│ │ 16/03/2026             📅   │     │
│ └─────────────────────────────┘     │
│                                     │
│ Số lượng (lượng) *                  │
│ ┌─────────────────────────────┐     │
│ │ 0.0                         │     │
│ └─────────────────────────────┘     │
│                                     │
│ Đơn giá (đ/lượng) *                │
│ ┌──────────────────┐ ┌───────────┐  │
│ │ 17.350.000       │ │↻ Giá hiện │  │ ← Price + refresh button
│ └──────────────────┘ │   tại     │  │
│                      └───────────┘  │
│                                     │
│ Tổng chi phí: 34.700.000 đ         │ ← Read-only, auto-calculated
│                                     │
│ ┌─────────────────────────────────┐ │
│ │             Lưu                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Type Selection Flow:**

For "Vàng":
1. User selects "Vàng" from the main dropdown (11 items)
2. Brand dropdown appears with ALL gold types merged (17 VND + 1 USD = 18 items)
3. User picks a brand → currency auto-detected from brand → actual proto type set (GOLD_VND or GOLD_USD)
4. Price auto-fills from market data for the selected brand

For "Bạc":
1. User selects "Bạc" from the main dropdown
2. Brand dropdown appears with ALL silver types merged (10 VND + 1 USD = 11 items)
3. User picks a brand → currency auto-detected → actual proto type set (SILVER_VND or SILVER_USD)
4. Price auto-fills from market data for the selected brand

For CASH and FOREIGN_CURRENCY (new types):
1. Behave like custom investments (manual symbol/name/currency input)
2. Same UI flow as selecting OTHER with custom investment toggle on

For all other types (Cổ phiếu, Crypto, ETF, etc.):
1. Standard behavior — unchanged from current

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Type dropdown | RHFFormSelect (FormSelect) | `components/forms/RHFFormSelect` |
| Gold/silver type dropdown | BasicFormSelect (FormSelect) | `components/forms/FormSelect` |
| Date input | RHFFormInput with type="date" | `components/forms/RHFFormInput` |
| Price input | FormNumberInput | `components/forms/FormNumberInput` |
| Market price display | MarketPriceDisplay | `components/forms/MarketPriceDisplay` |
| Price refresh button | Button | `components/Button` |

### New Components

None — all existing components are sufficient.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | CreateInvestmentRequest (new types, purchase_date, pricePerUnit) | Yes: Internet → App | Investment Handler | Validated server-side |
| 2 | Browser | GetMarketPrice (auto-fetch for price) | Yes: Internet → App | Market Price Handler | Read-only, cached |
| 3 | Market Price Handler | Price data | No: internal | Frontend form | Auto-fills price field |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | CreateInvestment (#1) | JWT auth + server-side validation |
| Internet → App | GetMarketPrice (#2) | JWT auth + rate limiting + cache |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Client sends invalid investment type (e.g., 99) | Low | Backend validates against known enum values |
| T-2 | 1 | Internet → App | Tampering | Client sends negative `purchase_date` | Low | Backend validates: must be 0 or positive Unix timestamp ≤ now |
| T-3 | 1 | Internet → App | Tampering | Client sends manipulated price to inflate/deflate cost basis | Low | Price is user-input (not enforced to match market). This is by design — user may have bought at a different price. |
| T-4 | 3 | Internal | Information Disclosure | Market price data cached and reused | Low | Price data is not sensitive. Cache TTL is 5 minutes. |

### Authorization Rules

No changes — all endpoints already require JWT authentication and user ownership verification.

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| `type` (new values 12, 13) | Must be valid InvestmentType enum value | Backend service |
| `purchase_date` | If > 0: must be valid Unix timestamp, not in the future | Backend service |
| `pricePerUnit` (frontend only) | Must be ≥ 0. Total cost = quantity × price. | Frontend form + existing backend validation for `initialCostDecimal` |

### External Dependency Risks

No new external dependencies. Market price fetching uses existing Yahoo Finance and vang.today integrations.

### Sensitive Data Handling

No changes. Monetary values continue to use `int64` in smallest currency units.

### Issues & Risks Summary

1. **Risk: Proto enum values conflict** — New values 12 and 13 must not conflict with any existing values. Current max is 11 (SILVER_USD). Using 12 and 13 is safe.
2. **Risk: CASH/FOREIGN_CURRENCY behavior undefined** — These are treated like OTHER/custom investments. No market price fetching, manual symbol/name/currency.
3. **Risk: Price auto-fill may confuse users** — If market price differs from actual purchase price, user may not notice. Mitigated by allowing manual edit and showing the source clearly.
4. **Risk: Coordination with decouple-wallet feature** — Both features modify AddInvestmentForm. Plan tasks to layer on top of decouple changes.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|----------|
| Market price unavailable for auto-fill | Leave price field empty, show "Không thể lấy giá" message. User enters manually. |
| User selects "Vàng" then switches to "Cổ phiếu" | Reset brand dropdown and clear price auto-fill. |
| Purchase date in the future | Backend rejects with validation error. Frontend uses `max={today}` attribute. |
| Purchase date cleared by user | Send 0 to backend. Backend uses current time for initial transaction. |
| New type CASH selected | Show manual symbol/name/currency inputs (same as custom investment flow). |
| Price auto-fill then user edits quantity | Total cost recalculates. Price stays at auto-filled value. |
| Price auto-fill returns 0 | Show price as 0, user can change it. |

## Dependencies & Assumptions

- **Dependency:** Decouple-investment-wallet feature must be implemented first (or concurrently). AddInvestmentForm changes build on the simplified form (no wallet selector).
- **Assumption:** Backend `CreateInvestment` already creates an initial BUY transaction internally — `purchase_date` is applied to that transaction's date.
- **Assumption:** CASH and FOREIGN_CURRENCY investments don't need special backend logic — they're just custom investments with a different type code.

## Out of Scope

- Number-to-text display (e.g., "Mười bảy triệu...") — shown in reference image but not part of this spec. Can be added later.
- Note/image tabs shown in reference image — not part of this spec.
- Changes to AddInvestmentTransactionForm — it already has price-per-unit with MarketPriceDisplay. No changes needed.
- Silver price table filter (silver currently shows all types unfiltered).
- Reorganizing the gold-calculator.ts or silver-calculator.ts data arrays (only labels change).
