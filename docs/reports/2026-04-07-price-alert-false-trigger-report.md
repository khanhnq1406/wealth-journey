# Price Alert False Trigger — Implementation Report

## Summary

Fixed `EvaluateAlerts` in `user_price_alert_service.go` to normalize `currentPrice` from smallest currency units (cents) to whole units before comparing against `targetPrice` (always whole units). USD-denominated alerts (crypto, stocks, gold USD) were falsely triggering because raw cent values (e.g., `6852028`) were compared directly against whole-dollar thresholds (e.g., `100000`). The fix divides `currentPrice` by `fx.GetDecimalMultiplier(alert.Currency)` before the comparison. VND alerts are unaffected (multiplier=1, no-op).

## Spec Reference

`docs/specs/2026-04-07-price-alert-false-trigger-spec.md`

## Plan Reference

`docs/plans/2026-04-07-price-alert-false-trigger-plan.md`

## Tasks Completed

| #   | Task                                                          | Status | Files Changed                             | Tests     | TDD |
| --- | ------------------------------------------------------------- | ------ | ----------------------------------------- | --------- | --- |
| 1   | Fix EvaluateAlerts — normalize currentPrice before comparison | Done   | user_price_alert_service.go (modified), user_price_alert_service_test.go (modified) | 2 new + all existing pass | Yes |

## Test Coverage Summary

| Layer           | Test File                                    | Tests | Pass | Coverage Area                                               |
| --------------- | -------------------------------------------- | ----- | ---- | ----------------------------------------------------------- |
| Backend Service | `domain/service/user_price_alert_service_test.go` | 2 new | 2/2  | USD false trigger prevention, USD correct trigger behavior |

Existing tests also all pass (gold VND alerts, stale price handling, cooldown, daily cap, etc.).

## Security Implementation Summary

| Concern              | Implementation                                                              | Verified |
| -------------------- | --------------------------------------------------------------------------- | -------- |
| Integer arithmetic   | `int64` division only — no float introduced                                | Yes      |
| Division by zero     | `GetDecimalMultiplier` always returns ≥ 1 — impossible                     | Yes      |
| No new trust boundary | Fix is in background scheduler, no user request path                       | Yes      |
| Raw price preserved  | `currentPrice` (cents) kept in placeholders/metadata — not replaced with `normalizedPrice` | Yes |

## Review Results

### Spec Compliance

PASS — All requirements implemented exactly as specified. `normalizedPrice` used only for comparison; `currentPrice` (raw cents) preserved for notification metadata. Both acceptance criteria tests verified in code.

### Security Review

APPROVED — No new trust boundaries, no user input, integer-only arithmetic, no data exposure changes.

### Code Quality

APPROVED — Normalization block is minimal (3 lines + comment), well-named, and correctly placed. Tests are behavior-based (AssertCalled/AssertNotCalled). Reviewer noted a pre-existing display bug in push notification bodies (raw cents shown as-is) but confirmed it is explicitly out of scope for this task.

## Known Issues / Technical Debt

**Pre-existing (out of scope):** Push notification message bodies display `currentPrice` in raw cents format (e.g., "6,852,028 USD" instead of "$68,520.28") because `FormatUserAlertPrice` only adds thousand separators without dividing by the decimal multiplier. The frontend `formatPrice()` function handles this conversion, but the backend notification text does not. This was pre-existing before this fix and is tracked separately.

## Files Changed

- `src/go-backend/domain/service/user_price_alert_service.go` — modified: added `"wealthjourney/pkg/fx"` import + normalization block before trigger condition
- `src/go-backend/domain/service/user_price_alert_service_test.go` — modified: added 2 new test functions

## How to Test

### Unit & Integration Tests

```bash
# New tests only
cd src/go-backend && go test -short ./domain/service/... -run TestUserPriceAlertService_EvaluateAlerts_CryptoUSD -v

# Full service test suite (regression check)
cd src/go-backend && go test -short ./domain/service/... -v

# Lint check
cd src/go-backend && task ci:backend-lint
```

Expected: all tests pass, lint clean.

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

Changed function: `EvaluateAlerts` in `userPriceAlertService`. Called by:
- `user_price_alert_job.go` (scheduler) — only caller. No handler or API surface change.
- No other callers.

### Manual Testing Steps

#### Scenario: USD alert — no false trigger

**Preconditions:** Active user price alert for BTC-USD with `targetPrice = 100000` (USD $100,000), `direction = "above"`. Current BTC price on market data API is ~$68,520 (raw: 6,852,028 cents).

1. Wait for `UserPriceAlertJob` to run (or trigger manually via scheduler)
2. Expected: alert does NOT fire — no push notification sent, alert status remains `active`

#### Scenario: USD alert — correct trigger

**Preconditions:** Active user price alert for BTC-USD with `targetPrice = 100000` (USD $100,000), `direction = "above"`. Current BTC price on market data API is ~$100,001 (raw: 10,000,100 cents).

1. Wait for `UserPriceAlertJob` to run
2. Expected: alert fires — push notification sent, alert status becomes `triggered`

#### Scenario: VND alert — unaffected

**Preconditions:** Active user price alert for SJC gold with `targetPrice = 108000000` (VND ₫108,000,000/tael), `direction = "above"`. Current price = 109,000,000 VND (raw = 109,000,000, multiplier = 1).

1. Wait for `UserPriceAlertJob` to run
2. Expected: alert fires correctly — VND behavior unchanged (multiplier=1, no-op)
