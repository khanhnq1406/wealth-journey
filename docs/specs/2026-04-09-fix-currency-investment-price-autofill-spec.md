# Fix: Currency Investment Price Auto-Fill Specification

## Summary

Two bugs exist in the Add Investment form for FOREIGN_CURRENCY type:
1. When a user selects a foreign currency (e.g., USD) from the dropdown, the "price per unit" field is never auto-filled with the VCB buy rate — because `setSelectedSymbol` is never called, so the price query is never enabled.
2. The `CurrencyBadge` next to the price-per-unit field is interactive (allows changing currency), but FOREIGN_CURRENCY prices are always in VND (VCB buy rate in VND per 1 unit of foreign currency). The badge must be locked to VND and non-interactive.

## Original Feature Reference

- Spec: `docs/specs/2026-04-09-feat-investment-currency-assets-current-price-spec.md`
- Plan: `docs/plans/2026-04-09-feat-investment-currency-assets-current-price-plan.md`
- Report: `docs/reports/2026-04-09-feat-investment-currency-assets-current-price-report.md`

## Issues to Fix

| #   | Issue                                                                                  | Source       | Severity |
| --- | -------------------------------------------------------------------------------------- | ------------ | -------- |
| 1   | `setSelectedSymbol` never called in currency dropdown `onChange` → price query disabled | User report  | Major    |
| 2   | `CurrencyBadge` allows currency change for FOREIGN_CURRENCY → should be locked to VND | User report  | Major    |
| 3   | Backend `GetPrice` routes FOREIGN_CURRENCY to Yahoo Finance → should use VCB DB cache | Root cause   | Major    |

## Root Cause Analysis

**Issue 1 (Frontend):** The currency dropdown `onChange` at line 684 calls `setValue("symbol", value)` and `setValue("name", ...)` and `setValue("currency", "VND")` but never calls `setSelectedSymbol(value)`. The `isStandardWithSymbol` flag depends on `selectedSymbol !== ""`, so the `standardPriceQuery` is never enabled, and no price is fetched.

**Issue 2 (Frontend):** The `CurrencyBadge` at line 1063–1068 is shown for all non-custom investments including FOREIGN_CURRENCY. Its `disabled` prop only disables for gold/silver/symbolSelected — not for FOREIGN_CURRENCY. Since the form starts with `currency: "VND"` but the badge is interactive, the user can change it, which breaks the VND-only price contract.

**Issue 3 (Backend):** `GetPrice` in `market_data_service.go` (line 84–91) only routes gold and silver to their DB caches. FOREIGN_CURRENCY falls into the `else` branch → `fetchPriceFromAPI` → Yahoo Finance. Yahoo Finance does not serve VCB buy rates. The correct source is `assetDisplayConfigService.ResolvePrice(ctx, symbol, "currency")` — the same path used by `UpdatePricesForInvestments`.

## Functional Requirements

### FR-1: Currency Price Auto-Fill
When user selects a currency from the dropdown, `setSelectedSymbol(value)` must be called so the price query is enabled. The price (VCB buy rate in VND) must be fetched via `useQueryGetMarketPrice` and auto-filled into `pricePerUnit`.

**Acceptance criteria:**
- [ ] Selecting "USD_VCB" from dropdown triggers a price fetch
- [ ] `pricePerUnit` is auto-filled with the fetched VCB buy rate
- [ ] Loading and error states are shown near the currency dropdown

### FR-2: Price Currency Locked to VND
The price-per-unit currency for FOREIGN_CURRENCY investments is always VND. The currency display must be a read-only badge (not interactive).

**Acceptance criteria:**
- [ ] For FOREIGN_CURRENCY, `CurrencyBadge` is replaced with a static read-only span showing "VND"
- [ ] The form field `currency` stays "VND" and cannot be changed by the user

### FR-3: Backend Routes FOREIGN_CURRENCY to VCB Cache
`GetPrice` must route `INVESTMENT_TYPE_FOREIGN_CURRENCY` to `assetDisplayConfigService.ResolvePrice(ctx, symbol, "currency")` returning the buy price in VND.

**Acceptance criteria:**
- [ ] `GET /api/v1/investments/market-price?symbol=USD_VCB&currency=VND&type=6` returns the VCB buy rate
- [ ] Falls back gracefully when price is stale (return stale price with a log warning)
- [ ] Returns `success: false` (not 500) when symbol is not found in asset_display_config

### FR-4: Refresh Button Available for FOREIGN_CURRENCY
The refresh button (currently only shown for gold/silver/standard) must also be shown for FOREIGN_CURRENCY after a currency is selected.

**Acceptance criteria:**
- [ ] Refresh button appears when `isForeignCurrencyInvestment && !!selectedSymbol`
- [ ] Clicking refresh re-fetches from the VCB cache endpoint

## Non-Functional Requirements

- No new external API dependencies — uses existing VCB DB cache
- Price fetch on currency select must respond in < 500ms (cache hit path)

## Architecture Changes (C4)

No new components or diagrams needed. The `GetPrice` routing change is an internal service detail.

## Runtime Flow Diagrams

Update `docs/architecture/flow-investment.md` — section 12 "Currency Price Refresh" already exists. Add a sub-section or note clarifying the `GetMarketPrice` frontend call path (separate from the scheduler path).

## Data Model Changes

None.

## API Changes

`GET /api/v1/investments/market-price?symbol=USD_VCB&currency=VND&type=6`
- Previously: routed to Yahoo Finance (wrong, likely error)
- After fix: routed to `assetDisplayConfigService.ResolvePrice(ctx, "USD_VCB", "currency")` → returns VCB buy rate in VND smallest unit

## UI/UX Changes

In `AddInvestmentForm.tsx`:
1. Add `setSelectedSymbol(value)` in currency dropdown `onChange`
2. Change the `CurrencyBadge` condition: for `isForeignCurrencyInvestment`, always render a read-only span "VND" (same pattern as the `isCustomInvestment` badge at line 1071–1075)
3. Add loading/error state display below the currency dropdown (same pattern as gold/silver)
4. Add `isForeignCurrencyInvestment && !!selectedSymbol` to the refresh button condition

## Security & Risk Assessment

### Data Flow Diagram

| #   | Source               | Data                          | Trust Boundary Crossed? | Destination           | Notes                                      |
| --- | -------------------- | ----------------------------- | ----------------------- | --------------------- | ------------------------------------------ |
| 1   | Browser (user)       | Symbol (typeCode from API)    | Yes: Internet → Backend | GetMarketPrice handler | Symbol from dropdown, not free-text        |
| 2   | GetMarketPrice handler | symbol, "currency" string   | No                      | assetDisplayConfigService.ResolvePrice | Internal service call |
| 3   | asset_price DB table | buy price (int64 VND)         | No                      | Frontend pricePerUnit field | Read-only, no financial write |

### Trust Boundaries

| Boundary           | Crossed By              | Security Control                              |
| ------------------ | ----------------------- | --------------------------------------------- |
| Internet → Backend | GetMarketPrice request  | JWT auth required; symbol validated by DB lookup (ResolvePrice returns error for unknown) |

### Threats Identified (STRIDE)

| #   | Data Flow | Boundary       | STRIDE    | Threat                                               | Severity | Mitigation                                      |
| --- | --------- | -------------- | --------- | ---------------------------------------------------- | -------- | ----------------------------------------------- |
| T-1 | 1         | Internet → App | Tampering | User passes arbitrary symbol to GetMarketPrice       | Low      | ResolvePrice returns error for unknown typeCode — handler returns `success: false`, not 500 |
| T-2 | 1         | Internet → App | DoS       | Rapid price fetch requests per authenticated user    | Low      | Existing 15-min cache means DB is hit only once per window; no new rate limit needed |

### Authorization Rules

- `GetMarketPrice` already requires JWT auth (line 900–905 in investment.go) — no change needed

### Input Validation Rules

- Symbol comes from the API dropdown (not free-text) — server-side validation via `ResolvePrice` returning error for unknown symbols
- `currency` param is validated by `validator.Currency()` (already in place, line 70)

### External Dependency Risks

- No new external dependencies — all prices come from the existing VCB DB cache (`asset_price` table)

### Issues & Risks Summary

1. If VCB rates have not been fetched yet (cold start), `ResolvePrice` returns an error — handler returns `success: false` which is graceful
2. Stale prices are returned with a log warning — acceptable since 15-min freshness window is the SLA for currency prices

## Edge Cases & Error Handling

- **No price in DB (cold start):** `ResolvePrice` errors → handler returns `{success: false, message: "Price unavailable for USD_VCB"}` → frontend shows "Unable to fetch price" inline message
- **Stale price:** Returned with `isStale=true` — frontend still uses it for auto-fill (same as gold/silver behavior)
- **User clears currency selection:** `setSelectedSymbol("")` should be called to disable the query and clear pricePerUnit

## Dependencies & Assumptions

- `asset_display_config` has rows for currency TypeCodes (e.g., `USD_VCB`) with `show_in_investment=true` (migration already run in the original feature)
- `asset_price` table is populated by the VCB price cache job (already running)

## Out of Scope

- Changing which currencies appear in the dropdown (admin config)
- Supporting non-VND price currency for FOREIGN_CURRENCY (by design, always VND)
- E2E test execution in CI
