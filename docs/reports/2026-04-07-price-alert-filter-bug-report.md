# Price Alert Filter Bug — Implementation Report

## Summary

Fixed the `ListAlerts` handler so that the `status_filter` and pagination query parameters are correctly parsed and forwarded to the service layer. The root cause was that Gin's `ShouldBindQuery` uses `form:""` struct tags, but proto-generated structs only carry `json:""` tags — causing both `status_filter` and `pagination.page`/`pagination.page_size` to be silently ignored on every request. Filter tabs ("Đang hoạt động" / "Đã kích hoạt") now work correctly, and users with more than 20 alerts receive the full list (pageSize=100) rather than being silently capped at 20.

## Spec Reference

`docs/specs/2026-04-07-price-alert-filter-bug-spec.md`

## Plan Reference

`docs/plans/2026-04-07-price-alert-filter-bug-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 1   | Fix `ListAlerts` handler — manual `status_filter` binding | Done | `user_price_alert.go`, `user_price_alert_test.go` | 6/6 pass | Yes |
| 2   | Verify pagination binding + add manual parsing if broken | Done | `user_price_alert.go`, `user_price_alert_test.go` | 7/7 pass | Yes |
| 3   | Playwright E2E — verify filter tabs work end-to-end | Done | `price-alerts-settings-flow.spec.ts` | 2 added, pass on Firefox | Yes |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| Backend Handler | `handlers/user_price_alert_test.go` | 7 | 7/7 | status_filter parsing (5 cases), pagination propagation (1), response shape (1) |
| Frontend E2E | `tests/e2e/price-alerts-settings-flow.spec.ts` | 2 new | Pass (Firefox) | Filter tab → network request with correct status_filter param (desktop + mobile) |

## Security Implementation Summary

| Concern | Implementation | Verified |
| -------- | -------------- | -------- |
| Input validation | `strconv.Atoi` for status_filter; invalid values silently default to 0 (UNSPECIFIED = all) | Yes |
| Pagination clamping | page ≥ 1; pageSize clamped to [1, 100], default 20 | Yes |
| Authorization | `handler.GetUserID(c)` from JWT — unchanged; `ListByUserID` scoped by userID | Yes |
| Injection prevention | No new SQL; all params go through proto struct fields consumed by GORM parameterized queries | Yes |
| Data exposure | No new logging; `handler.HandleError` unchanged | Yes |

## Review Results

### Spec Compliance

All three tasks passed spec compliance review on first attempt. No requirements were skipped or misinterpreted.

### Security Review

All tasks approved with no CRITICAL or HIGH findings. Minor notes:
- Task 1: `strconv.Atoi` error silently ignored (StatusFilter stays 0) — intentional per spec; safe behavior.
- Task 2: pageSize max 100 enforced at handler level before service call.

### Code Quality

All tasks approved. Notable strengths flagged by reviewers:
- Comments in handler explain *why* manual parsing is needed (proto structs lack `form:` tags), not just what the code does.
- `ParseInt` with bitSize 32 correctly bounds values to int32 range before the explicit cast.
- E2E tests use `Promise.all([waitForRequest(...), tab.click()])` pattern — correct async ordering, no missed requests.
- E2E accepts both `statusFilter=` (camelCase) and `status_filter=` (snake_case) for serializer robustness.

Minor quality notes (non-blocking, not fixed):
- E2E mobile test only asserts Active tab (not Triggered) — desktop test covers both values so overall coverage is complete.
- `waitForLoadState("networkidle")` in E2E is slightly fragile on pages with long-polling; acceptable given no WebSocket traffic on this page.

## Known Issues / Technical Debt

- The `ShouldBindQuery` call is retained after manual parsing for forward-compatibility. If a future proto update adds `form:` tags to `PaginationParams`, it could overwrite the manually parsed values. Comment at line 81 notes this endpoint currently has no flat query params.
- Chromium browser in E2E environment times out on dev server connection (pre-existing infrastructure issue affecting all 12 tests in the file equally). Firefox passes. Not caused by new tests.
- The `efaceany` modernize lint suggestion (`interface{}` → `any` in test file) is a style note not enabled in the project's golangci-lint config — does not block build or lint.

## Files Changed

| File | Change |
| ---- | ------ |
| `src/go-backend/handlers/user_price_alert.go` | Modified `ListAlerts`: manual `status_filter` parse + manual pagination parse |
| `src/go-backend/handlers/user_price_alert_test.go` | Created: 7 unit tests for filter and pagination binding |
| `src/wj-client/tests/e2e/price-alerts-settings-flow.spec.ts` | Modified: 2 E2E tests for filter tab network requests (desktop + mobile) |
| `docs/reports/2026-04-07-price-alert-filter-bug-progress.md` | Created: implementation progress tracker |

## How to Test

### Unit & Integration Tests

```bash
# Handler unit tests (7 tests, no DB needed)
cd src/go-backend && go test -run TestListAlerts -v ./handlers/

# Full backend build
cd src/go-backend && go build ./...

# Backend lint
cd src/go-backend && task ci:backend-lint
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changed function: `ListAlerts` in `handlers/user_price_alert.go`
Direct callers: Gin router only (registered in `handlers/routes.go`) — no other Go code calls this directly.
Impact: handler-only change; service and repository layers untouched.

### Manual Testing Steps

#### Scenario: Filter tabs work correctly

**Preconditions:** Logged in as a user with at least 1 active and 1 triggered alert.

1. Navigate to `/dashboard/prices` and select the "Price Alerts" tab
2. Default tab "Tất cả" is selected → Expected: all alerts shown
3. Click "Đang hoạt động" → Expected: only alerts with status=ACTIVE shown; empty state if none
4. Click "Đã kích hoạt" → Expected: only alerts with status=TRIGGERED shown; empty state if none
5. Click "Tất cả" → Expected: all alerts shown again

#### Scenario: Validation — non-numeric status_filter

**Preconditions:** Any authenticated user.

1. Call `GET /api/v1/price-alerts?status_filter=abc` directly
2. Expected: HTTP 200, returns all alerts (UNSPECIFIED behavior), no 400/500 error

#### Scenario: Pagination — user with > 20 alerts

**Preconditions:** User has more than 20 alerts.

1. Navigate to Price Alerts tab
2. Expected: all alerts visible (frontend requests pageSize=100, backend now respects it)
3. Previously: only 20 alerts shown due to silent pagination cap

#### Scenario: Authorization boundary

**Preconditions:** Logged in as User A.

1. Call `GET /api/v1/price-alerts?status_filter=1` with User A's JWT
2. Expected: only User A's active alerts returned — no other user's alerts visible
