# Price Alert Bugs Fix — Implementation Report

## Summary

Fixed two backend bugs in the price alert system:
1. `FormatUserAlertPrice` was incorrectly dividing USD values by 100 (treating whole-unit prices as cents), causing notifications like "$50,000" to display as "$500".
2. `symbolPattern` regex was ASCII-only, rejecting Vietnamese gold product names like "Vàng nhẫn SJC" that come from `asset_display_config`.

## Spec Reference

`docs/specs/2026-04-02-price-alert-bugs-spec.md`

## Plan Reference

`docs/plans/2026-04-02-price-alert-bugs-plan.md`

## Tasks Completed

| #   | Task                                               | Status | Files Changed                                                                  | Tests        | TDD |
| --- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------------ | ------------ | --- |
| 0   | Update C4 Architecture Diagrams                    | Skipped | —                                                                             | —            | —   |
| N-1 | Create/Update Runtime Flow Diagrams                | Skipped | —                                                                             | —            | —   |
| 1   | Fix USD Price Formatting in FormatUserAlertPrice   | Done   | `price_alert_config.go`, `price_alert_config_test.go`                          | 6/6 pass     | Yes |
| 2   | Allow Vietnamese Characters in Symbol Validation   | Done   | `user_price_alert_service.go`, `user_price_alert_service_test.go`              | 17/17 pass   | Yes |
| 3   | Final Verification — Lint & Build                  | Done   | —                                                                              | All pass     | N/A |

## Test Coverage Summary

| Layer           | Test File                                | Tests | Pass  | Coverage Area                                            |
| --------------- | ---------------------------------------- | ----- | ----- | -------------------------------------------------------- |
| Backend Service | `price_alert_config_test.go`             | 6     | 6/6   | FormatUserAlertPrice: VND/USD whole-unit formatting, zero |
| Backend Service | `user_price_alert_service_test.go`       | 17    | 17/17 | symbolPattern: Vietnamese names, ASCII symbols, injection |

## Security Implementation Summary

| Concern          | Implementation                                                              | Verified |
| ---------------- | --------------------------------------------------------------------------- | -------- |
| Input validation | `symbolPattern` now uses `\p{L}\p{N}.\-_ ` (blocks `<`, `>`, `"`, `'`, `;`) | Yes      |
| SQL injection    | Symbol stored via GORM parameterized query — no change to DB access layer    | Yes      |
| Data exposure    | Error message is generic ("symbol contains invalid characters")              | Yes      |
| FormatPriceForDisplay unchanged | System alerts still use cents-based division — untouched          | Yes      |

## Review Results

### Spec Compliance

Both tasks passed Stage 1 on first review. All 6 formatting test cases verified correct. All 12 symbol validation test cases verified (5 Vietnamese must-pass, 3 ASCII must-pass, 4 must-fail).

### Security Review

Both tasks passed Stage 2 APPROVED.
- Task 1: Pure formatting function, no auth surface, no DB, no new security risk.
- Task 2: `\p{L}` confirmed to not match control chars, RTL overrides, or zero-width joiners. Space is literal U+0020 (not `\s`). Injection vectors blocked.

### Code Quality

Both tasks passed Stage 3 APPROVED.
- Task 1: Uniform implementation removes the USD special-case branch entirely; `strings.ToUpper` normalizes caller input defensively.
- Task 2: Detailed comment documents each regex component, Unicode category rationale, and concrete examples. Minor suggestion (add note about `\s` vs literal space in comment) noted but not blocking.

## Known Issues / Technical Debt

None introduced. Pre-existing `TestExecuteImport_*` failures in `domain/service` package are unrelated to these changes.

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/domain/service/price_alert_config.go` | Replace `FormatUserAlertPrice` — remove /100 division, uniform whole-unit formatting |
| `src/go-backend/domain/service/price_alert_config_test.go` | Update `TestFormatUserAlertPrice` with correct expectations |
| `src/go-backend/domain/service/user_price_alert_service.go` | Expand `symbolPattern` to `\p{L}\p{N}.\-_ `; update error message |
| `src/go-backend/domain/service/user_price_alert_service_test.go` | Add `TestSymbolPattern_VietnameseCharacters` |
| `docs/reports/2026-04-02-price-alert-bugs-progress.md` | Progress tracking (created) |

## How to Test

### Unit & Integration Tests

```bash
# Run the specific test suites
cd src/go-backend && go test -run TestFormatUserAlertPrice ./domain/service/ -v
cd src/go-backend && go test -run TestSymbolPattern_VietnameseCharacters ./domain/service/ -v

# Run all backend tests
cd src/go-backend && go test -short ./...
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

`FormatUserAlertPrice` callers: used inside `user_price_alert_service.go` for notification formatting only. No callers outside `domain/service/`.

`symbolPattern` callers: used in `CreateUserPriceAlert` validation block only.

### Manual Testing Steps

#### Scenario: USD price alert notification shows correct value

**Preconditions:** User has a USD price alert with target price 50000 (= $50,000)
1. Trigger the price alert evaluation job (or wait for scheduled run)
2. Expected: notification message reads "50,000 USD" — NOT "500.00 USD" or "500 USD"

#### Scenario: Create price alert for Vietnamese gold symbol

**Preconditions:** Logged in as any user with price alerts enabled
1. `POST /api/v1/price-alerts` with body `{"symbol": "Vàng nhẫn SJC", ...}`
2. Expected: HTTP 201 Created — NOT a 400 validation error

#### Scenario: Injection attempt still rejected

**Preconditions:** Any authenticated user
1. `POST /api/v1/price-alerts` with body `{"symbol": "<script>alert(1)</script>", ...}`
2. Expected: HTTP 400 — "symbol contains invalid characters"

#### Scenario: ASCII symbols still accepted

**Preconditions:** Any authenticated user
1. `POST /api/v1/price-alerts` with body `{"symbol": "BTC-USD", ...}`
2. Expected: HTTP 201 Created
