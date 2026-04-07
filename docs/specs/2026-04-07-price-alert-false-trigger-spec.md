# Price Alert False Trigger Specification

## Summary

Price alerts for USD-denominated assets (crypto, stocks, and gold USD) trigger incorrectly due to a unit mismatch in the backend evaluation loop. `currentPrice` is stored in **smallest currency units** (cents for USD: `6852028` = $68,520.28) while `targetPrice` is stored in **whole currency units** (user input: `100000` = $100,000). The direct `int64` comparison `6852028 >= 100000` evaluates to `true`, causing the alert to fire even when the market price is well below the threshold.

**VND-denominated assets are unaffected** — VND has 0 decimal places (multiplier = 1), so both sides of the comparison are in the same unit.

**Affected asset types:**
- Crypto / stocks with USD currency (e.g., BTC-USD, AAPL)
- Gold USD (INVESTMENT_TYPE_GOLD_USD) — vangtoday stores USD gold buy/sell in cents (×100)
- Any currency with decimal places > 0 (EUR, GBP, SGD, etc.)

## User Stories

- As a user with a BTC-USD "above $100,000" alert, I want the alert to NOT fire when BTC is at $68,520, so I can trust my alert thresholds.
- As a user with a gold-USD "above $2,500/oz" alert, I want the alert to fire only when the actual gold price exceeds $2,500, not when the raw cents value happens to exceed my whole-dollar target.
- As a user setting up any USD alert, I want the system to correctly compare my entered threshold against the real market price.

## Functional Requirements

### FR-1: Normalize prices at evaluation time

In `EvaluateAlerts`, before comparing `currentPrice` against `alert.TargetPrice`, convert `currentPrice` to the same unit as `targetPrice` (whole currency units) by dividing by `fx.GetDecimalMultiplier(alert.Currency)`.

**Acceptance criteria:**
- [ ] BTC-USD alert "above $100,000" does NOT fire when currentPrice = `6852028` (=$68,520.28)
- [ ] BTC-USD alert "above $100,000" DOES fire when currentPrice = `10000001` (=$100,000.01)
- [ ] Gold-USD alert "above $2,500" does NOT fire when currentPrice = `249999` (=$2,499.99)
- [ ] Gold-USD alert "above $2,500" DOES fire when currentPrice = `250001` (=$2,500.01)
- [ ] VND alerts are unaffected (multiplier = 1, no change to behavior)

### FR-2: Normalize current price for display (ListAlerts)

`fetchPricesForAlerts` is also called by `ListAlerts` to populate `currentPrice` on the proto response (used by frontend for display). The frontend `formatPrice()` function currently divides by the currency multiplier. Since `fetchPricesForAlerts` returns cents, the display is already handled by the frontend divisor. **No change needed here** — the display path is handled correctly.

However, `currentPriceAtCreation` for market assets is also stored in cents (set from `MarketData.Price`). The frontend `formatPrice()` already handles this. No change needed.

### FR-3: Preserve VND behavior

The fix must use `fx.GetDecimalMultiplier(alert.Currency)` which returns `1` for VND — so all VND comparisons pass through unchanged.

**Acceptance criteria:**
- [ ] VND gold alerts continue to work as before
- [ ] VND stock alerts continue to work as before

### FR-4: Add unit test for the mismatch scenario

Add a regression test `TestUserPriceAlertService_EvaluateAlerts_CryptoUSD_NoFalsePositive` that proves a BTC-USD alert set to "above $100,000" does NOT fire when currentPrice is $68,520.28 (raw: `6852028`).

Also add `TestUserPriceAlertService_EvaluateAlerts_CryptoUSD_CorrectlyFires` that proves it DOES fire when currentPrice is $100,000.01 (raw: `10000001`).

**Acceptance criteria:**
- [ ] Both tests pass
- [ ] Existing gold/silver VND evaluation tests still pass

## Non-Functional Requirements

- **No API changes**: The fix is entirely in backend service logic. No proto changes.
- **No frontend changes**: Display is handled correctly by the existing `formatPrice()` divisor in `PriceAlertList.tsx`.
- **Backward compatibility**: `targetPrice` storage format (whole units) is intentional per the `FormatUserAlertPrice` comment — do NOT change it.
- **Performance**: `fx.GetDecimalMultiplier` is a pure in-memory lookup — negligible overhead.

## Architecture Changes (C4)

### Diagrams to Update

No structural changes. The fix is within `user_price_alert_service.go` evaluation loop — no new components or dependencies.

## Runtime Flow Diagrams

### Flow Diagrams to Update

The existing `flow-cross-cutting.md` or `flow-investment.md` should have the alert evaluation flow updated to note the currency normalization step. This is a minor clarification, not a new diagram.

## Data Model Changes

None. The storage format is correct:
- `targetPrice`: whole units (intentional — user input)
- `currentPrice` (MarketData.Price): cents for USD (intentional — Yahoo Finance pipeline)
- `asset_price.Buy/Sell` gold VND: whole VND (intentional — VND has 0 decimal places)
- `asset_price.Buy/Sell` gold USD: cents (intentional — consistent with USD convention)

## API Changes

None.

## UI/UX Changes

None. The frontend correctly applies `getCurrencyDivisor(currency)` in `formatPrice()` for display.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | `asset_price` DB | `Buy/Sell` (int64, cents for USD) | No (internal) | `fetchPricesForAlerts` → `EvaluateAlerts` | Fix: normalize before comparison |
| 2 | `user_price_alert` DB | `TargetPrice` (int64, whole units) | No (internal) | `EvaluateAlerts` comparison | Source of truth for threshold |
| 3 | `MarketData` DB | `Price` (int64, cents for USD) | No (internal) | `fetchPricesForAlerts` → `EvaluateAlerts` | Fix: normalize before comparison |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internal service layer | DB reads only | No external input at comparison time |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internal | Tampering | Attacker stores crafted `asset_price.Buy` to trigger alerts | Low | DB access is internal-only; no external write path to `asset_price` |
| T-2 | 2 | Internal | Elevation of Privilege | False trigger could cause user to act on wrong financial data | Medium | Fix the mismatch (this spec); add regression test |

### Authorization Rules

No change. Alert evaluation runs in background scheduler — no user-facing authorization involved.

### Input Validation Rules

No new user input. The fix is in an internal evaluation loop.

### External Dependency Risks

- `fx.GetDecimalMultiplier` is a pure in-memory map lookup (no external calls). Zero risk.

### Sensitive Data Handling

No change.

### Issues & Risks Summary

1. **Root cause: unit mismatch in EvaluateAlerts** — `currentPrice` is in cents (USD), `targetPrice` is in whole dollars. Fix: divide `currentPrice` by `fx.GetDecimalMultiplier(currency)` before comparison.
2. **VND unaffected** — multiplier = 1; division is a no-op.
3. **Gold USD also affected** — `asset_price.Buy` for XAU/USD is stored in cents (vangtoday client multiplies by 100); this same fix covers gold USD alerts.
4. **Display path is already correct** — frontend `formatPrice()` divides by the multiplier; no frontend changes needed.
5. **`currentPriceAtCreation` for market assets** — stored in cents (from `MarketData.Price`) and displayed via `formatPrice()` (divides by multiplier). This is consistent and correct. No fix needed.

## Edge Cases & Error Handling

| Case | Behavior |
|------|----------|
| VND currency | `GetDecimalMultiplier("VND") = 1` → division is a no-op; no behavioral change |
| Unknown currency | `GetDecimalMultiplier` defaults to 100 (2 decimal places) — safe for any unknown currency |
| `currentPrice = 0` | Already skipped in `EvaluateAlerts` (`currentPrice <= 0` guard at line 367) |
| Gold VND alerts (e.g., SJC at 9,100,000,000 VND) | VND multiplier = 1 → comparison unchanged; alert fires correctly |
| Gold USD alerts (e.g., XAU at $2,500 → stored as 250000 cents) | Divide by 100 → 2500; compare against targetPrice 2500 → fires correctly |

## Affected Files

| File | Change |
|------|--------|
| `src/go-backend/domain/service/user_price_alert_service.go` | In `EvaluateAlerts`: divide `currentPrice` by `fx.GetDecimalMultiplier(alert.Currency)` before the fired check |
| `src/go-backend/domain/service/user_price_alert_service_test.go` | Add 2 new tests: `CryptoUSD_NoFalsePositive` and `CryptoUSD_CorrectlyFires` |

## Dependencies & Assumptions

- `pkg/fx` is already imported in the service package (used elsewhere in the codebase).
- `alert.Currency` is always set at creation time and matches the currency stored in `asset_price` / `MarketData`.
- The `targetPrice` whole-unit convention is intentional and documented in `FormatUserAlertPrice` comments — do NOT change it.

## Out of Scope

- Changing `targetPrice` storage to cents (would require a DB migration and is explicitly documented as whole units)
- Fixing display bugs (covered by the prior `2026-04-07-price-alert-usd-display-bug` spec, now Done)
- Adding currency normalization to gold/silver VND comparison (already correct)
- Changing the Yahoo Finance price pipeline format
