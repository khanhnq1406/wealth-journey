# Price Alert USD Display Bug — Implementation Report

## Summary

Fixed `formatPrice()` in `PriceAlertList.tsx` to divide raw `int64` backend values by the correct currency decimal multiplier before display. USD prices were appearing 100× too large (e.g., `$6,847,203.00` instead of `$68,472.03`). The fix adds a `CURRENCY_DIVISORS` map and `getCurrencyDivisor()` helper inline in the same file, exports `formatPrice()` for direct unit testing, and derives decimal places from the divisor to correctly handle 3-decimal currencies (KWD). The audit of `CreatePriceAlertForm.tsx` confirmed no raw int64 values are displayed there; the E2E spec has no price display assertions affected by this fix.

## Spec Reference

`docs/specs/2026-04-07-price-alert-usd-display-bug-spec.md`

## Plan Reference

`docs/plans/2026-04-07-price-alert-usd-display-bug-plan.md`

## Tasks Completed

| #   | Task                                               | Status | Files Changed                                                                                                    | Tests     | TDD |
| --- | -------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- | --------- | --- |
| 1   | Fix `formatPrice()` with currency divisor + tests  | Done   | `PriceAlertList.tsx` (modified), `formatPrice.test.ts` (created)                                                 | 9/9 pass  | Yes |
| 2   | Audit `CreatePriceAlertForm` step-3 (read-only)   | Done   | None — read-only audit                                                                                            | N/A       | N/A |
| 3   | Playwright E2E audit for price display fix         | Done   | None — no price display assertions in spec                                                                        | N/A       | N/A |

## Test Coverage Summary

| Layer              | Test File                                               | Tests | Pass | Coverage Area                                               |
| ------------------ | ------------------------------------------------------- | ----- | ---- | ----------------------------------------------------------- |
| Frontend Utility   | `features/price-alert/__tests__/formatPrice.test.ts`    | 9     | 9/9  | USD (3 cases), VND (2 cases), KWD (1 case), edge cases (3) |

## Security Implementation Summary

| Concern              | Implementation                                                              | Verified |
| -------------------- | --------------------------------------------------------------------------- | -------- |
| XSS prevention       | `Intl.NumberFormat` is a safe browser API — no `dangerouslySetInnerHTML`   | Yes      |
| Data integrity       | Raw `int64` value is NOT mutated — division result stored in local `const`  | Yes      |
| No new endpoints     | Display-only fix — no auth, no API, no backend changes                      | Yes      |

## Review Results

### Spec Compliance

PASS. All requirements verified in actual code: `CURRENCY_DIVISORS` map (VND/JPY/KRW→1, KWD/BHD/OMR→1000, default 100), `getCurrencyDivisor()` helper, `formatPrice()` exported and dividing before format. One beneficial deviation: decimal places are derived from the divisor (instead of hardcoding 2) so KWD correctly displays 3 decimal places, resolving a latent contradiction in the spec's own example code.

### Security Review

APPROVED. Display-only fix. `Intl.NumberFormat` is XSS-safe. Raw `rawInt64` input not mutated. No new endpoints, auth changes, or sensitive data exposure.

### Code Quality

APPROVED. `CURRENCY_DIVISORS` and `getCurrencyDivisor()` co-located correctly in the feature module. Single source of truth: divisor governs both arithmetic conversion and decimal display precision. Test names are behavioral and specific. Edge cases well-covered (zero values, unknown currency fallback, all three decimal tiers).

## Known Issues / Technical Debt

None. The `export` on `formatPrice` technically expands the module's public surface, but the ESLint `no-restricted-imports` rule guards against cross-feature usage at the boundary level.

E2E failures observed during Task 3 audit are pre-existing infrastructure failures (dev server offline) — not regressions from this fix.

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/features/price-alert/components/PriceAlertList.tsx` | Modified — replaced `formatPrice()` with currency-divisor-aware version; added `CURRENCY_DIVISORS` and `getCurrencyDivisor`; exported `formatPrice` |
| `src/wj-client/features/price-alert/__tests__/formatPrice.test.ts` | Created — 9 unit tests (USD, VND, KWD, edge cases) |
| `docs/reports/2026-04-07-price-alert-usd-display-bug-progress.md` | Created — implementation progress tracking |

## How to Test

### Unit & Integration Tests

```bash
# Run formatPrice unit tests
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
# Expected: 9 tests pass

# Run all PriceAlertList tests (regression check)
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PriceAlertList"
# Expected: all existing tests still pass

# Full frontend lint
cd src/wj-client && npm run lint
# Expected: no errors
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

Changed symbols: `formatPrice` (in `PriceAlertList.tsx`). Direct callers: internal to `PriceAlertList.tsx` only (`alert.targetPrice` and `alert.currentPrice` display cells). No cross-feature callers.

| Changed Symbol | d=1 Dependents | Tested? | Notes |
|---|---|---|---|
| `formatPrice` | Internal callers in `PriceAlertList.tsx` | Yes — 9 unit tests | No cross-feature callers |

### Manual Testing Steps

#### Scenario: USD price alert displayed correctly
**Preconditions:** Logged in as a user with at least one active USD price alert for a USD-denominated asset (e.g., BTC target price $68,472.03, stored as int64 `6847203` cents)
1. Navigate to `/dashboard/settings/alerts`
2. View the alerts list → Expected: target price shows as `$68,472.03` (NOT `$6,847,203.00`)
3. View the current price column → Expected: correctly formatted USD value

#### Scenario: VND price alert unchanged
**Preconditions:** Logged in as a user with at least one active VND price alert
1. Navigate to `/dashboard/settings/alerts`
2. View the alerts list → Expected: target price shows as `85.000 ₫` for a `targetPrice: 85000` alert (divisor=1, unchanged behavior)

#### Scenario: Zero price shows dash
**Preconditions:** Any alert with `targetPrice: 0` or `currentPrice: 0`
1. View the alerts list → Expected: `"-"` shown instead of a price

#### Scenario: Mobile viewport
**Preconditions:** Logged in, at 375px width
1. Navigate to `/dashboard/settings/alerts`
2. Expected: alerts table displays correctly, no horizontal scroll, touch targets ≥ 44px
