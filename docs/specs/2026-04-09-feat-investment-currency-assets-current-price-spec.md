# Investment Currency Assets — Auto Current Price Specification

## Summary

Currently, `INVESTMENT_TYPE_FOREIGN_CURRENCY` investments are treated as fully custom assets: `isCustom` is forced to `true`, automatic price updates are skipped, and users must set the exchange rate manually. This feature connects foreign currency investments to the existing admin-configured asset display price system (same infrastructure used by gold and silver), so that the portfolio shows real-time/cached current prices automatically — users no longer need to manually update the exchange rate.

## User Stories

- As a user holding foreign currency (USD, EUR, etc.), I want the current exchange rate to update automatically so my portfolio value stays accurate without manual effort.
- As a user creating a foreign currency investment, I want to select the currency from a dropdown (populated by admin-configured currencies) so I can't enter an unsupported or misspelled currency code.
- As a user viewing my portfolio, I want to see the current value of my foreign currency holdings in VND (auto-calculated from the latest exchange rate) the same way gold shows its current value.

## Functional Requirements

### FR-1: Currency Selection from Admin-Configured List

When creating a FOREIGN_CURRENCY investment, the currency selector dropdown is populated from `GET /api/v1/public/asset-display-prices?assetType=currency`. Only currencies that the admin has enabled appear in the list.

**Acceptance criteria:**
- [ ] Investment creation form fetches enabled currency configs via `useQueryGetAssetDisplayPrices({ assetType: "currency" })`
- [ ] Dropdown shows `displayName` (e.g., "US Dollar") with `typeCode` as value (e.g., "USD")
- [ ] Selecting a currency sets the investment `symbol` to the `typeCode` (e.g., "USD")
- [ ] Free-text entry is removed for FOREIGN_CURRENCY type
- [ ] If no currencies are configured, show an empty state message

### FR-2: Remove Forced isCustom for FOREIGN_CURRENCY

Foreign currency investments are no longer treated as custom assets. The backend service stops forcing `isCustom = true` for `INVESTMENT_TYPE_FOREIGN_CURRENCY`.

**Acceptance criteria:**
- [ ] `CreateInvestment()` no longer sets `isCustom = true` for FOREIGN_CURRENCY type
- [ ] `isCustom` is stored as `false` for new FOREIGN_CURRENCY investments
- [ ] `UpdatePrices()` includes FOREIGN_CURRENCY investments in the price refresh loop (no longer skips them)
- [ ] Existing FOREIGN_CURRENCY investments with `isCustom = true` continue to work (backward compat — users can still manually set price via the detail modal)

### FR-3: Auto Price Lookup via Asset Display Config

The investment price refresh job (`UpdatePrices()`) resolves the current price for FOREIGN_CURRENCY investments using the asset display config service — same as how gold price is resolved.

**Price resolution logic:**
1. Investment has `symbol = "USD"` and `type = INVESTMENT_TYPE_FOREIGN_CURRENCY`
2. Call `assetDisplayConfigService.ResolvePrice(ctx, "USD", "currency")`
3. Returns `(buy int64, sell int64, isStale bool)`
4. Store `buy` price as `currentPrice` on the investment (price in VND per 1 unit of foreign currency)
5. Recalculate `currentValue` and `unrealizedPNL`

**Acceptance criteria:**
- [ ] `UpdatePrices()` calls `ResolvePrice("USD", "currency")` for each FOREIGN_CURRENCY investment grouped by symbol
- [ ] `currentPrice` is stored in VND (integer, no divisor — VND has no cent unit)
- [ ] `priceUpdatedAt` is updated on successful price resolution
- [ ] If `isStale = true`, price is still stored (stale data is better than 0) and `priceUpdatedAt` reflects the stale fetch time
- [ ] If `ResolvePrice` returns error (currency not in admin config), skip that investment and log a warning — do NOT fail the whole job
- [ ] Batch: group investments by symbol to call `ResolvePrice` once per currency, not once per investment row

### FR-4: Portfolio Display — Current Value in VND

The investment portfolio list and detail modal display foreign currency current value correctly.

**Storage & calculation:**
- Quantity stored as: `amount × 10000` (e.g., 1000 USD → stored as 10,000,000)
- Divisor: 10000 (consistent with all other investment types)
- `currentPrice` = VND per 1 unit (e.g., 25,500,000 for 1 USD at 25,500 VND — stored as int64 VND)
- `currentValue = (quantity / 10000) × currentPrice`

**Acceptance criteria:**
- [ ] Portfolio list shows `currentPrice` formatted as VND (e.g., "25,500 ₫") for foreign currency investments
- [ ] Portfolio list shows `currentValue` in VND (e.g., "25,500,000 ₫" for 1000 USD)
- [ ] Staleness indicator (dot color) works the same as gold — based on `priceUpdatedAt`
- [ ] `unrealizedPNL` is calculated and displayed (not "N/A") once price is set
- [ ] Display currency conversion (wallet currency ≠ VND) uses existing enrichment pipeline

### FR-5: Investment Creation — Quantity & Cost Input

The investment creation form for FOREIGN_CURRENCY collects the foreign currency amount (e.g., 1000 USD) and the purchase cost in VND.

**Acceptance criteria:**
- [ ] Quantity input label shows the selected currency code (e.g., "Amount (USD)")
- [ ] Quantity stored as `amount × 10000` (e.g., 1000 → 10,000,000)
- [ ] Purchase price input accepts VND per unit (exchange rate at purchase time)
- [ ] `totalCost` is calculated as `(quantity / 10000) × purchasePricePerUnit`
- [ ] No unit conversion needed (unlike gold: mace → gram) — 1 USD = 1 USD

## Non-Functional Requirements

- **Performance:** `ResolvePrice` in `UpdatePrices()` must batch by symbol — O(currencies) calls, not O(investments). A user with 10 USD investments makes 1 call, not 10.
- **Backward compatibility:** Existing FOREIGN_CURRENCY investments with `isCustom = true` remain functional; manual price override via detail modal still works.
- **Graceful degradation:** If asset display config has no entry for a currency symbol, the investment falls back to its last known `currentPrice` (no crash, logged warning).
- **No new external dependencies:** Uses existing asset price cache infrastructure only.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3 Backend):** `InvestmentService` now has a new dependency on `AssetDisplayConfigService` for price resolution. Add arrow: `InvestmentService → AssetDisplayConfigService: ResolvePrice(typeCode, assetType)`.
- **`c4-component-frontend.md` (L3 Frontend):** `AddInvestmentForm` now depends on `useQueryGetAssetDisplayPrices` hook. Document the new data flow from currency config API to form dropdown.

### New Diagrams

No new L4 diagram needed — the existing `c4-code-investment.md` can be updated if necessary, but this change is localized to service wiring, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-investment.md`** — Add new sequence: "Currency Investment Price Refresh"

Flow: Background scheduler → `UpdatePrices()` → groups FOREIGN_CURRENCY investments by symbol → `AssetDisplayConfigService.ResolvePrice("USD", "currency")` → reads from `asset_price` table → returns buy price → updates `investment.currentPrice` → `investment.Recalculate()` → saves to DB.

Also update the "Market price update" flow to note that FOREIGN_CURRENCY is now included.

### New Flow Diagrams

None needed.

## Data Model Changes

No new tables or columns. Behavior changes only:

- `investments.is_custom`: FOREIGN_CURRENCY investments now created with `false` (previously `true`)
- `investments.current_price`: Now auto-updated by price refresh job (VND int64)
- `investments.price_updated_at`: Now set by price refresh job

**Migration:** No schema migration needed. Existing rows with `is_custom = true` continue to work via the existing manual price update path.

## API Changes

### Modified: `POST /api/v1/investments` (CreateInvestment)

Backend stops forcing `isCustom = true` for FOREIGN_CURRENCY. No request/response shape change — callers already pass `isCustom` explicitly; the server-side override is simply removed.

### No new endpoints needed

The existing `GET /api/v1/public/asset-display-prices?assetType=currency` already returns the currency list for the dropdown. No new proto RPCs required.

## UI/UX Changes

### Modified: `AddInvestmentForm.tsx`

**FOREIGN_CURRENCY investment section:**
- Replace free-text currency entry with a dropdown (`FormSelect`) populated from `useQueryGetAssetDisplayPrices({ assetType: "currency" })`
- Remove the `isCashOrForeignCurrency → setIsCustomInvestment(true)` side-effect for FOREIGN_CURRENCY (keep it for CASH only)
- Show quantity input labeled with selected currency code
- Show purchase rate input (VND per 1 unit, e.g., "Purchase rate (VND/USD)")

**REQUIRED for any frontend/UI work:**
- Follow **mobile-first design** — use `responsive-design` skill for Tailwind breakpoints
- Follow **ui-ux-pro-max** skill for design system and component patterns
- Follow **react-best-practices** skill for performance

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Currency dropdown | `FormSelect` | `components/forms/FormSelect.tsx` |
| Quantity input | `FormNumberInput` | `components/forms/FormNumberInput.tsx` |
| Loading state | `LoadingSpinner` | `components/loading/` |
| Empty state | `EmptyState` | `components/EmptyState.tsx` |
| Price display in portfolio | Existing investment card/list | `portfolio/components/InvestmentCard.tsx`, `InvestmentList.tsx` |

### New Components

None. All UI needs are covered by existing components.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | FOREIGN_CURRENCY investment create request | Yes: Internet → App | REST Handler | JWT-authenticated |
| 2 | REST Handler | Parsed CreateInvestmentRequest | No (same tier) | InvestmentService | Validated by handler |
| 3 | InvestmentService | Investment model | Yes: App → DB | PostgreSQL | GORM parameterized |
| 4 | Background Scheduler | Price refresh trigger | No (internal) | InvestmentService.UpdatePrices() | Internal goroutine |
| 5 | InvestmentService | ResolvePrice call | No (same process) | AssetDisplayConfigService | Internal call |
| 6 | AssetDisplayConfigService | DB query for asset prices | Yes: App → DB | PostgreSQL (asset_price table) | GORM parameterized |
| 7 | PostgreSQL | AssetPrice rows | Yes: DB → App | AssetDisplayConfigService | Read-only price data |
| 8 | User (browser) | GET asset display prices request | Yes: Internet → App | Public REST Handler | No auth needed (public endpoint) |
| 9 | Public REST Handler | Currency config list | Yes: App → Browser | User (browser) | No sensitive data — public prices |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Investment create/read requests | JWT auth middleware |
| Internet → App | GET /api/v1/public/asset-display-prices | No auth (public endpoint, read-only) |
| App → DB | All GORM queries | Parameterized queries, user_id ownership filter |
| App → DB | ResolvePrice reads | Read-only, no user data exposed |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | User creates investment as another user | High | JWT auth + user_id from token (not request body) |
| T-2 | 1 | Internet → App | Tampering | User sends negative quantity or overflow int64 | Medium | Server-side validation: quantity > 0, max value check |
| T-3 | 1 | Internet → App | Elevation | User sets `isCustom=false` to bypass validation | Low | `isCustom` now defaults false for FOREIGN_CURRENCY — no bypass possible |
| T-4 | 8 | Internet → App | DoS | Flood public currency prices endpoint | Low | Existing rate limiting on public endpoints |
| T-5 | 3,6 | App → DB | Info Disclosure | Query leaks another user's investment data | High | All investment queries filter by `user_id` (existing pattern) |
| T-6 | 4 | Internal | Tampering | Price data in asset_price table manipulated | Medium | Only admin can write to asset_price (via refresh job); no user-facing write path |
| T-7 | 7 | DB → App | Tampering | Stale/manipulated exchange rate causes incorrect PNL | Low | `isStale` flag surfaced to user; price comes from trusted admin-configured sources |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Create FOREIGN_CURRENCY investment | Allowed | Denied (user_id from JWT) | Denied |
| View own portfolio | Allowed | Denied | Denied |
| Update investment price (manual) | Allowed | Denied | Denied |
| GET public currency display prices | N/A | N/A | Allowed (read-only public data) |
| Admin: configure currency display | Admin only | Denied | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| Currency symbol (from dropdown) | string | Must match an enabled `typeCode` in asset display config | Validate typeCode exists in config |
| Quantity | int64 | > 0, stored as amount × 10000, max = MaxInt64/10000 | Required, positive, overflow check |
| Purchase price per unit | int64 | ≥ 0 (VND, integer) | Non-negative |
| isCustom | bool | Default false for FOREIGN_CURRENCY | Server ignores client value; forces false |

### External Dependency Risks

This feature adds **no new external dependencies**. It reuses:
- Existing `asset_price` table (already populated by VangSaiGon, VangToday, Vietcombank fetchers)
- Existing `AssetDisplayConfigService.ResolvePrice()` method
- Existing admin-configured currency display configs

**Risk:** If the admin hasn't configured any currency in the display config, no currencies appear in the dropdown. Mitigation: document in admin guide; show clear empty state to user.

### Sensitive Data Handling

- Exchange rates are public market data — not sensitive
- Investment holdings (amount of USD held) are user financial data — stored in existing `investments` table with same protections
- No new sensitive data fields introduced

### Issues & Risks Summary

1. **Existing isCustom=true investments:** Users who previously created FOREIGN_CURRENCY investments have `isCustom=true`. They won't get auto price updates until the admin adds their currency to the display config AND the user recreates/updates the investment. Document this as a known limitation.
2. **Symbol mismatch:** If a user somehow has an investment with `symbol = "USD"` but admin hasn't configured "USD" in the currency display config, `ResolvePrice` returns an error and the investment is skipped silently. Log a warning so admins can detect and fix.
3. **VND price precision:** Exchange rates like 25,500 VND/USD are stored as plain integers. No precision loss (VND has no decimal places). This is safe.

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| Admin hasn't configured any currencies | Dropdown shows empty state; user cannot create FOREIGN_CURRENCY investment |
| Admin disables a currency after user already has an investment | Price refresh skips that investment with a warning log; `currentPrice` retains last known value |
| All currency price sources are stale | `isStale=true` price still used; staleness indicator shown to user |
| `ResolvePrice` returns 0 (no price yet) | Store 0, show staleness indicator; unrealizedPNL shows as 0 |
| User has 1000 investments in USD | `UpdatePrices()` calls `ResolvePrice("USD", "currency")` once, applies result to all 1000 rows |
| Quantity overflow: user enters 9,999,999,999,999 | Server validation rejects: max quantity × 10000 must fit int64 |

## Dependencies & Assumptions

- The asset display config for `assetType="currency"` is already seeded (USD, EUR, GBP, JPY, etc.) from the Vietcombank currency migration. `ShowInInvestment` can be toggled per-currency via the existing admin UI — no new migration needed. The admin enables currencies for investment use before this feature goes live.
- `AssetDisplayConfigService.ResolvePrice()` already handles priority-based source selection and staleness — no changes needed to that method
- The background price refresh scheduler already runs every 15 minutes — FOREIGN_CURRENCY investments will be updated on the next cycle after the feature is deployed
- `Investment.Recalculate()` already handles `divisor=10000` for all types — no changes needed

## Out of Scope

- Adding new currency data sources (the existing 3 sources — VangSaiGon, VangToday, Vietcombank — are sufficient)
- Admin UI for configuring currency display (already exists)
- Multi-currency portfolio (wallet currency vs. investment currency conversion) — existing enrichment pipeline handles this
- Migrating existing `isCustom=true` FOREIGN_CURRENCY investments to `isCustom=false` automatically (users keep manual control unless they recreate)
- Price alerts for currency exchange rates
