# User Price Alert Notification Template Configuration — Implementation Report

## Summary

Replaced hardcoded user price alert notification messages with admin-configurable templates, reusing the existing `PriceAlertConfig` Redis-based infrastructure. Added 3 new string fields to the config struct, a `FormatUserAlertPrice()` / `priceSideDisplayName()` helper pair, wired templates into `EvaluateAlerts()`, extended validation/sanitization/merge logic, and added a new UI section in `PriceAlertConfigForm.tsx`.

## Spec Reference

`docs/specs/2026-04-02-notification-template-spec.md`

## Plan Reference

`docs/plans/2026-04-02-notification-template-plan.md`

## Tasks Completed

| #   | Task                                                   | Status | Commit   | Files Changed | Tests    | TDD |
| --- | ------------------------------------------------------ | ------ | -------- | ------------- | -------- | --- |
| 0   | Update C4 Architecture Diagrams                        | Skipped | —       | —             | —        | —   |
| 1   | Extend PriceAlertConfig Struct + Defaults + Validation | Done   | 6218e1a2 | 2             | 6/6 pass | Yes |
| 2   | Extend mergeConfig for User Alert Templates            | Done   | e1465f0f | 3             | 1/1 pass | Yes |
| 3   | Wire Templates into EvaluateAlerts                     | Done   | e6881ed6 | 2             | 2/2 pass | Yes |
| 4   | Admin UI — User Alert Templates Section                | Done   | 48a97ee7 | 5             | 13/13 pass | Yes |
| 5   | End-to-End Verification & Lint                         | Done   | (final)  | 2 (report+progress) | All pass | — |

## Test Coverage Summary

| Layer                    | Test File                                        | Tests  | Pass   | Coverage Area                                        |
| ------------------------ | ------------------------------------------------ | ------ | ------ | ---------------------------------------------------- |
| Backend Service          | `domain/service/price_alert_config_test.go`      | +6     | 6/6    | Defaults, validation, sanitization, backwards compat, FormatUserAlertPrice, priceSideDisplayName |
| Backend Handler          | `handlers/price_alert_config_test.go`            | 1      | 1/1    | mergeConfig empty-means-keep semantics               |
| Backend Service          | `domain/service/user_price_alert_service_test.go` | +2    | 2/2    | EvaluateAlerts template usage, default fallback      |
| Frontend Component       | `features/admin/components/__tests__/PriceAlertConfigForm.test.tsx` | 13 | 13/13 | Renders, field values, chips, preview, guide, PUT body |
| E2E (authored)           | `tests/e2e/admin-price-alert-config-flow.spec.ts` | 8     | —      | Section visible, chips, guide, mobile 375px          |

## Security Implementation Summary

| Concern              | Implementation                                                                  | Verified |
| -------------------- | ------------------------------------------------------------------------------- | -------- |
| Input validation     | `ValidatePriceAlertConfig` checks length after HTML strip (title 1-200, body 1-500) | Yes  |
| HTML sanitization    | `SanitizePriceAlertConfig` strips HTML from all 3 template fields via `stripHTML()` | Yes  |
| Authorization        | Existing `AuthMiddleware` + `AdminMiddleware` on admin endpoints — no change needed | Yes  |
| XSS (frontend)       | Preview uses React text nodes (`{resolvePlaceholders(...)}`) — never `dangerouslySetInnerHTML` | Yes |
| Backwards compat     | `LoadPriceAlertConfig` fills defaults when fields missing in existing Redis JSON | Yes  |
| Template resolution  | Templates loaded once per cycle (not per alert); fallback to defaults if Redis down | Yes |
| Monetary values      | `FormatUserAlertPrice(price int64, currency string)` — int64 throughout         | Yes  |

## Review Results

### Spec Compliance

All tasks passed Stage 1 on first submission. No spec compliance issues found.

### Security Review

All tasks passed Stage 2. No HIGH or CRITICAL issues found. Reviewer noted:
- `stripHTML` regex handles `<...>` tag removal correctly for the threat model (push notifications don't render HTML)
- Template preview in admin UI is rendered as plain React text — no XSS vector

### Code Quality

All tasks passed Stage 3. Minor observations (non-blocking):
- `TestLoadPriceAlertConfig_BackwardsCompatible` manually reimplements merge logic inline rather than going through the real function — acceptable, noted for future improvement
- `updateUserAlertField` uses untyped string key vs the typed generic `updateGlobal` — functionally correct, minor type-safety observation

## Known Issues / Technical Debt

- `updateUserAlertField` in `PriceAlertConfigForm.tsx` uses `field: string` (untyped key) instead of `K extends keyof PriceAlertConfig`. This is functionally correct but slightly weaker than the existing `updateGlobal` pattern. Low priority to fix.
- `TestLoadPriceAlertConfig_BackwardsCompatible` tests the logic inline rather than through the real `LoadPriceAlertConfig` call path. Acceptable coverage given the function is also covered by round-trip tests.

## Files Changed

### Backend
- `src/go-backend/domain/service/price_alert_config.go` — struct fields, defaults, envString, LoadPriceAlertConfig compat, ValidatePriceAlertConfig, SanitizePriceAlertConfig, FormatUserAlertPrice, priceSideDisplayName
- `src/go-backend/domain/service/price_alert_config_test.go` — 6 new TDD tests; lint fix (errcheck)
- `src/go-backend/handlers/price_alert_config.go` — mergeConfig extended for 3 template fields
- `src/go-backend/handlers/price_alert_config_test.go` — created; TestMergeConfig_UserAlertTemplates
- `src/go-backend/domain/service/user_price_alert_service.go` — EvaluateAlerts: LoadPriceAlertConfig once per cycle, placeholder map, ResolvePlaceholders, rune-safe title truncation, resolved push title/body, metadata fields
- `src/go-backend/domain/service/user_price_alert_service_test.go` — 2 new TDD tests

### Frontend
- `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx` — TypeScript interface extended, constants, state/refs, updateUserAlertField, new UI section
- `src/wj-client/messages/en/admin.json` — 7 new keys under priceAlertConfig
- `src/wj-client/messages/vi/admin.json` — 7 new keys under priceAlertConfig
- `src/wj-client/features/admin/components/__tests__/PriceAlertConfigForm.test.tsx` — created; 13 TDD tests
- `src/wj-client/tests/e2e/admin-price-alert-config-flow.spec.ts` — created; 8 E2E tests (6 desktop + 2 mobile)

### Docs
- `docs/reports/2026-04-02-notification-template-progress.md` — created; progress tracking
- `docs/reports/2026-04-02-notification-template-report.md` — this file

## Fix History

| Date       | Fix                                                                                                  | Severity | Commit  |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------- | ------- |
| 2026-04-02 | `NotificationItem.tsx`: in-app web notification for `user_price_alert` now uses `resolvedTitle`/`resolvedBody` from metadata (same configurable templates as push notifications), with fallback for older notifications without those fields | Minor | pending |

## How to Test

### Unit & Integration Tests

```bash
# Backend
cd src/go-backend
go test -short -count=1 ./domain/service/...   # service layer tests
go test -short -count=1 ./handlers/...         # handler tests
task ci:backend-lint                           # lint (expects: 2/2 passed)

# Frontend
cd src/wj-client
npx jest --watchAll=false --testPathPatterns="PriceAlertConfigForm"  # 13 tests
npx jest --watchAll=false                      # 725 tests, 0 failures
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changed files and their downstream consumers:
- `price_alert_config.go` struct change → consumed by `user_price_alert_service.go` (Task 3), `handlers/price_alert_config.go` (Task 2) — both updated in this feature
- `EvaluateAlerts()` in `user_price_alert_service.go` → called by `user_price_alert_job.go` scheduler — no interface change, scheduler unaffected
- `PriceAlertConfigForm.tsx` → used in admin page — tested via unit tests and E2E spec

### Manual Testing Steps

#### Scenario: Admin configures user alert templates
**Preconditions:** Logged in as admin user, on `/dashboard/admin`

1. Navigate to Admin panel → Price Alert Config section
2. Scroll to "Mẫu thông báo cảnh báo giá cá nhân" (vi) / "User Price Alert Templates" (en) section
3. Verify 3 fields present: Title Template, Body Template (Above), Body Template (Below)
4. Verify each field shows the default Vietnamese template text
5. Click a placeholder chip (e.g., `{name}`) → Expected: inserted at cursor position in the field
6. Verify live preview box updates with sample values replacing `{name}` → "SJC 9999"
7. Click "Hướng dẫn placeholder" → Expected: guide expands showing 6 placeholder descriptions
8. Modify title template → click Save → Expected: success toast
9. Refresh page → Expected: updated template persists (loaded from Redis)

#### Scenario: Config reset restores defaults
**Preconditions:** Custom templates saved

1. Click reset/delete config button → Expected: confirmation dialog
2. Confirm → Expected: all fields revert to Vietnamese defaults

#### Scenario: Validation prevents overly long templates
**Preconditions:** Admin on config page

1. Paste 201+ character string into Title Template → Save → Expected: validation error on title field
2. Paste 501+ character string into Body Template → Save → Expected: validation error on body field

#### Scenario: Old Redis config without template fields gets defaults
**Preconditions:** Redis contains old-format config JSON without userAlert* fields

1. Start backend → GET /api/v1/admin/price-alert-config
2. Expected: response includes `userAlertTitleTemplate: "Cảnh báo giá {name}"` (default filled in)

#### Scenario: User alert fires with configured template
**Preconditions:** User has an active price alert set; admin has configured custom template with `{name}` and `{price}`

1. Wait for alert evaluation cycle (or trigger manually via scheduler)
2. Expected: push notification title/body uses configured template with resolved values
3. Expected: notification metadata contains `resolvedTitle` and `resolvedBody`

#### Scenario: Mobile viewport (375px)
**Preconditions:** Browser devtools at 375px width

1. Navigate to admin config page
2. Scroll to User Alert Templates section
3. Expected: inputs stack vertically, chip buttons wrap and are ≥ 44px height, no horizontal scroll
