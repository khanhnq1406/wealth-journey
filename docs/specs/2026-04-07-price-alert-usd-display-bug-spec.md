# Price Alert USD Display Bug Specification

## Summary

Price values displayed in the Price Alert table are incorrect for USD-denominated assets (e.g., BTC, stocks). The backend stores all monetary values in **smallest currency units** (cents for USD — e.g., $68,472.03 → `6847203`). The frontend `formatPrice()` function in `PriceAlertList.tsx` passes this raw `int64` value directly to `Intl.NumberFormat` without first dividing by the currency's decimal multiplier. As a result, `6847203` cents is displayed as `$6,847,203.00` instead of `$68,472.03` — a 100× error. The bug affects `currentPrice`, `targetPrice`, and `currentPriceAtCreation` for any currency with decimal places (USD, EUR, GBP, etc.). VND is unaffected because it has 0 decimal places (multiplier = 1).

## User Stories

- As a user with a BTC price alert, I want the current price column to show `$68,472.03`, not `$6,847,203.00`, so that I can trust the displayed value.
- As a user with a USD stock alert (e.g., AAPL), I want the target price I set to be displayed correctly, so that I can verify my alert threshold is correct.
- As a user reviewing triggered alerts, I want the price-at-creation to match what I remember setting the alert at, so that I can audit alert history accurately.

## Functional Requirements

### FR-1: Correct USD Price Display

The `formatPrice()` function in `PriceAlertList.tsx` must convert the raw `int64` value (cents) to the correct decimal representation before formatting.

**Root cause:** `int64` from the backend represents the price in smallest currency units:
- USD: `6847203` = $68,472.03 (divide by 100)
- VND: `1500000` = 1,500,000 VND (divide by 1)
- KWD: `1234` = 1.234 KWD (divide by 1000)

**Acceptance criteria:**
- [ ] BTC at $68,472.03 is stored as `6847203` and displayed as `$68,472.03`
- [ ] AAPL at $175.50 is stored as `17550` and displayed as `$175.50`
- [ ] VND gold at 1,500,000 VND is stored as `1500000` and displayed as `1.500.000 ₫`
- [ ] `targetPrice`, `currentPrice`, and `currentPriceAtCreation` are ALL fixed with the same conversion

### FR-2: Consistent Price Formatting Utility

The `formatPrice()` function must be updated to accept the raw backend int64 and apply the correct divisor per currency before passing to `Intl.NumberFormat`. The divisor must follow the same rules as the backend's `GetCurrencyDecimalPlaces`:
- 0 decimals → multiplier 1 (VND, JPY, KRW)
- 2 decimals → multiplier 100 (USD, EUR, GBP, SGD, etc.)
- 3 decimals → multiplier 1000 (KWD, BHD, OMR)

**Acceptance criteria:**
- [ ] `formatPrice(6847203, "USD")` → `"$68,472.03"`
- [ ] `formatPrice(1500000, "VND")` → `"1.500.000 ₫"`
- [ ] `formatPrice(17550, "USD")` → `"$175.50"`
- [ ] `formatPrice(0, "USD")` → `"-"` (no price available)
- [ ] Unit tests cover the above cases

### FR-3: Target Price Display in Alert Creation Confirmation

The `CreatePriceAlertForm.tsx` step-3 summary view also displays the target price. Verify whether it formats the proto value or the local form value (user-entered). If it formats a proto value, apply the same fix.

**Acceptance criteria:**
- [ ] Step-3 confirmation in `CreatePriceAlertForm.tsx` shows the correct target price
- [ ] If it uses a form state value (user input), no fix needed; if it uses proto int64, fix required

## Non-Functional Requirements

- **Performance**: No new API calls. Fix is purely in the frontend formatting layer.
- **Correctness**: The fix must cover all three price fields: `currentPrice`, `targetPrice`, `currentPriceAtCreation`.
- **Backward compatibility**: The backend storage format (`int64` in smallest currency units) is correct and must NOT be changed — only the frontend display needs fixing.
- **Test coverage**: Add/update Jest unit tests for `formatPrice()` with USD, VND, and edge-case currencies.

## Architecture Changes (C4)

### Diagrams to Update

No structural changes — this is a pure frontend display bug fix. No new components, no new API endpoints, no new backend logic.

- **No C4 diagrams need updating** — the architecture is unchanged.

## Runtime Flow Diagrams

No new flows — the data flow is unchanged. The fix is at the final display step only.

## Data Model Changes

None. The backend int64 storage format is correct.

## API Changes

None. The proto definition and backend responses are correct.

## UI/UX Changes

### Affected Files

| File | Change |
|------|--------|
| `src/wj-client/features/price-alert/components/PriceAlertList.tsx` | Fix `formatPrice()` to divide by currency decimal multiplier before formatting |
| `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx` | Audit step-3 summary display; fix if it uses proto int64 value |
| `src/wj-client/features/price-alert/__tests__/` | Add/update unit tests for `formatPrice()` |

### Fix Detail

**Current broken implementation (`PriceAlertList.tsx:39-54`):**
```typescript
function formatPrice(price: number, currency: string): string {
  if (!price) return "-";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(price);  // ✅ VND: 1500000 → "1.500.000 ₫" (correct, multiplier=1)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);  // ❌ USD: 6847203 → "$6,847,203.00" (wrong! should be "$68,472.03")
}
```

**Fixed implementation:**
```typescript
/** Maps currency to its decimal-place divisor (matches backend GetCurrencyDecimalPlaces). */
const CURRENCY_DIVISORS: Record<string, number> = {
  VND: 1, JPY: 1, KRW: 1, // 0 decimals
  KWD: 1000, BHD: 1000, OMR: 1000, // 3 decimals
  // All others default to 100 (2 decimals: USD, EUR, GBP, etc.)
};

function getCurrencyDivisor(currency: string): number {
  return CURRENCY_DIVISORS[currency] ?? 100;
}

function formatPrice(rawInt64: number, currency: string): string {
  if (!rawInt64) return "-";
  const divisor = getCurrencyDivisor(currency);
  const price = rawInt64 / divisor;
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
```

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Price formatting utility | `formatPrice()` in `PriceAlertList.tsx` | `features/price-alert/components/PriceAlertList.tsx:39` |
| No new component needed | — | — |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Backend API | `UserPriceAlert.currentPrice` (int64 cents) | Yes: Backend → Frontend | `PriceAlertList.tsx` | Read-only; no mutation |
| 2 | Backend API | `UserPriceAlert.targetPrice` (int64 cents) | Yes: Backend → Frontend | `PriceAlertList.tsx` | Read-only; no mutation |
| 3 | Backend API | `UserPriceAlert.currentPriceAtCreation` (int64 cents) | Yes: Backend → Frontend | `PriceAlertList.tsx` | Read-only; no mutation |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Backend API → Browser | ListUserPriceAlerts response | JWT auth; data is user's own alerts only |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1–3 | API → Browser | Tampering | Malicious actor swaps currency field to inflate/deflate displayed price | Low | Display-only; no financial transaction depends on this displayed value. Alert trigger logic runs on backend. |
| T-2 | 1–3 | API → Browser | Information Disclosure | Displaying wrong price could cause user to make incorrect financial decisions | Medium | Fix the bug (this spec). Display note that prices are informational. |

### Authorization Rules

- No change. All displayed data is the authenticated user's own alerts (existing auth middleware).
- No new endpoints or data exposure.

### Input Validation Rules

- No user input involved in this fix — display only.

### External Dependency Risks

- None. Fix is purely in frontend formatting code.

### Sensitive Data Handling

- Price data is informational. No PII involved.
- No new data exposure.

### Issues & Risks Summary

1. **Root cause is display-only**: The backend storage and API response are correct. Only the frontend `formatPrice()` function fails to divide by the currency decimal multiplier.
2. **All three price fields affected**: `currentPrice`, `targetPrice`, and `currentPriceAtCreation` all use the same `formatPrice()` function and are all broken for USD assets.
3. **VND is unaffected**: Divisor for VND is 1 (0 decimal places), so `format(1500000)` → correct.
4. **CreatePriceAlertForm step-3 may also be affected**: Audit needed — if it shows a proto int64 in the confirmation step, it has the same bug.

## Edge Cases & Error Handling

| Case | Behavior |
|------|----------|
| `currentPrice = 0` | Display `"-"` (no price available — not a bug, gold can be stale) |
| Unknown currency (e.g., SGD) | Default divisor = 100 (2 decimal places) — correct for most currencies |
| KWD (3 decimal places) | Divisor = 1000; e.g., `1234` → `1.234 KWD` |
| Negative price (impossible in practice) | Not guarded — will display as negative; acceptable |
| Very large BTC price | No overflow risk — JavaScript numbers handle up to 2^53 safely |

## Dependencies & Assumptions

- **Backend is correct**: The int64 storage and API response format are correct — do NOT change them.
- **`GetCurrencyDecimalPlaces` is the source of truth**: The frontend divisor map must match the backend `pkg/yahoo/quote.go` currency decimal places map.
- The `CreatePriceAlertForm` target price input is in **user-visible units** (e.g., `68472.03`), not cents. The form sends the user input * 100 to the backend. The step-3 summary shows the form state value (not proto int64) — likely correct already, but must be verified.

## Out of Scope

- Changing backend storage format (backend is correct)
- Fixing any other pages besides `PriceAlertList.tsx` and `CreatePriceAlertForm.tsx`
- Adding server-side price formatting
- Changing the proto definition
