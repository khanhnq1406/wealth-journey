# Fix Alert Auto-Trigger Not Working — Implementation Report

## Metadata

- **Feature:** fix-alert-auto-trigger-not-working
- **Branch:** fix/price-alert
- **Spec:** `docs/specs/2026-04-07-fix-alert-auto-trigger-not-working-spec.md`
- **Plan:** `docs/plans/2026-04-07-fix-alert-auto-trigger-not-working-plan.md`
- **Started:** 2026-04-07
- **Completed:** 2026-04-07
- **Final review verdict:** APPROVED

---

## Summary

Resolved the silent-failure problem in the price alert auto-trigger system. The scheduler was producing no log output on trigger failures, making it impossible to diagnose why alerts weren't firing. Root cause of FR-6 (0 active alerts showing) was confirmed: once-mode alerts correctly transition to `"triggered"` after firing, making them invisible to `ListActive`. This is by design; users simply need to create new alerts.

---

## Changes by Task

### Task 1 — Diagnostic logging in checkPrice and doCheckAndAlert (commit `0e2f5d8f`)

**File:** `src/go-backend/domain/service/price_alert_service.go`

Added 5 log points at all silent skip paths:

| Location | Condition | Log message |
|----------|-----------|-------------|
| `checkPrice` L392 | First run — no baseline key | `"Price alert: set initial baseline for %s = %d (first run)"` |
| `checkPrice` L399 | Corrupt baseline — parse fails | `"Price alert: reset invalid baseline for %s = %d"` |
| `doCheckAndAlert` L214 | Category not enabled in config | `"Price alert: category '%s' not enabled — skipping"` |
| `doCheckAndAlert` L231 | Threshold not met (movers count) | `"Price alert: category '%s' — %d movers, none exceed %.1f%% threshold"` |
| `doCheckAndAlert` L241 | Cooldown active | `"Price alert: category '%s' skipped — cooldown active"` |

**Tests added:** `TestCheckPrice_FirstRun_LogsBaselineSet`, `TestDoCheckAndAlert_CategoryNotEnabled_Logs`

---

### Task 2 — Summary logging in UserPriceAlertJob and EvaluateAlerts (commit `6467cabb`)

**Files:**
- `src/go-backend/internal/scheduler/user_price_alert_job.go` — `Run()` now logs start, completion, and errors
- `src/go-backend/domain/service/user_price_alert_service.go` — `EvaluateAlerts` logs when 0 active alerts found
- `src/go-backend/internal/scheduler/user_price_alert_job_test.go` (created) — 3 tests + interface check

**Tests added:** `TestUserPriceAlertJob_Run_LogsCompletion`, `TestUserPriceAlertJob_Run_LogsError`, `TestEvaluateAlerts_ZeroActiveAlerts_Logs`

---

### Task 3 — Remove inner timeout in fetchPricesForAlerts (commit `58037a74`)

**File:** `src/go-backend/domain/service/user_price_alert_service.go`

Removed `fetchCtx, cancel := context.WithTimeout(ctx, alertPriceFetchTimeout)` + `defer cancel()`. Replaced all 3 `fetchCtx` usages with `ctx`. The caller (`EvaluateAlerts`) already wraps with a 30s context — the inner 5s timeout was silently cancelling price fetches before they could complete, causing the entire evaluation to skip with no log output.

**Comment added at removal site:** `// No inner timeout — caller (EvaluateAlerts) already wraps with a 30s context.`

**Test added:** `TestFetchPricesForAlerts_UsesCallerContext`

---

### Task 4 — Add TTL to baseline Redis keys (commit `7e59c27b`)

**File:** `src/go-backend/domain/service/price_alert_service.go`

Changed all 3 `rdb.Set(ctx, baselineKey, ..., 0)` calls to `24*time.Hour`:

| Line | Context |
|------|---------|
| L337 | Baseline update after alert fires (`doCheckAndAlert`) |
| L391 | First-run baseline set (`checkPrice`) |
| L398 | Invalid-parse baseline reset (`checkPrice`) |

Without TTL, baseline keys accumulated indefinitely in Redis. With 24h TTL, stale keys are automatically evicted.

**Test added:** `TestCheckPrice_BaselineKey_HasTTL`

---

### Task 5 — Update runtime flow diagram (commit `f46535ac`)

**File:** `docs/architecture/flow-cross-cutting.md`

Added detailed baseline/cooldown mechanism note to Section 7 (Price Alert Detection Flow) Key Invariants:
- First-run behavior (no baseline → set baseline, skip evaluation)
- 24h TTL on all baseline keys
- Subsequent-run comparison logic
- Post-alert baseline update (once-mode vs. repeat-mode)
- Force-trigger mode bypass
- Silent skip paths logging note

---

### Task 6 — Investigate FR-6: root cause of 0 active alerts (commit `5dca3183`)

**Root cause confirmed:** Once-mode alerts transition status to `"triggered"` (line 478 of `user_price_alert_service.go`) after firing. `ListActive` queries `WHERE status = 'active'` — triggered alerts are correctly excluded. This is intentional behavior; users must create new alerts after their once-mode alerts fire.

**Fix:** Informational UI banner in `PriceAlertList` when all alerts are triggered.

**Files changed:**
- `src/wj-client/features/price-alert/components/PriceAlertList.tsx` — `allTriggered` computed flag, banner in both mobile and desktop views
- `src/wj-client/messages/en/investment.json` — `"allTriggeredHint"` key added
- `src/wj-client/messages/vi/investment.json` — `"allTriggeredHint"` key added (Vietnamese translation)

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `0e2f5d8f` | feat(price-alert): add diagnostic logging to checkPrice and doCheckAndAlert |
| 2 | `6467cabb` | feat(price-alert): add summary logging to UserPriceAlertJob and EvaluateAlerts |
| 3 | `58037a74` | fix(price-alert): remove inner timeout from fetchPricesForAlerts |
| 4 | `7e59c27b` | fix(price-alert): add 24h TTL to all baseline Redis keys |
| 5 | `f46535ac` | docs(price-alert): update flow-cross-cutting with baseline/cooldown mechanism |
| 6 | `5dca3183` | fix(price-alert): add all-triggered hint banner and i18n for FR-6 |

---

## Testing

All tests pass with `go test -short ./...` for the backend. ESLint reports 0 errors on the frontend.

**Backend tests added:**
- `TestCheckPrice_FirstRun_LogsBaselineSet`
- `TestDoCheckAndAlert_CategoryNotEnabled_Logs`
- `TestCheckPrice_BaselineKey_HasTTL`
- `TestUserPriceAlertJob_Run_LogsCompletion`
- `TestUserPriceAlertJob_Run_LogsError`
- `TestUserPriceAlertJob_ImplementsJobInterface`
- `TestEvaluateAlerts_ZeroActiveAlerts_Logs`
- `TestFetchPricesForAlerts_UsesCallerContext`

---

## Security Review

Final reviewer verdict: **APPROVED** — no CRITICAL or HIGH issues found.

- No new user input surfaces introduced
- Log output contains only public market data (no PII, no per-user data)
- TTL change (Task 4) is security-positive: reduces stale key accumulation
- Inner timeout removal (Task 3): caller context is never nil, propagates from scheduler job context
- UI banner (Task 6): pure i18n string, no user-controlled content, no XSS surface
