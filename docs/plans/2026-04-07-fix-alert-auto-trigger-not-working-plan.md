# Fix: Alert Auto-Trigger Not Working — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add diagnostic logging to all silent skip paths in the price alert scheduler jobs, fix the inner timeout bug in `fetchPricesForAlerts`, and add TTL to baseline Redis keys.
**Spec:** `docs/specs/2026-04-07-fix-alert-auto-trigger-not-working-spec.md`
**Architecture:** All changes are internal to two service files (`price_alert_service.go`, `user_price_alert_service.go`) and one scheduler file (`user_price_alert_job.go`). No new components, no proto changes, no API changes.
**Tech Stack:** Go 1.25, Redis (miniredis for tests), testify/mock

---

## Security Implementation Notes

- **Authentication:** N/A — background job, no HTTP request.
- **Authorization:** N/A — internal job, no user-owned resource access.
- **Input validation:** N/A — no user inputs in this code path.
- **Data sanitization:** Log lines only print gold/silver prices (public market data) and internal type codes. No PII risk.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend changes required.

---

## C4 Architecture Diagram Updates

Per spec: No structural changes. Update `flow-cross-cutting.md` only (Task 4).

---

### Task 1: Add Diagnostic Logging to `checkPrice` and `doCheckAndAlert` (FR-1)

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go:378-411` (`checkPrice`)
- Modify: `src/go-backend/domain/service/price_alert_service.go:210-340` (`doCheckAndAlert` — category loop)
- Modify: `src/go-backend/domain/service/price_alert_service_test.go` (add test for log output)

**Security notes:** Log lines contain only gold/silver prices (public data) and internal type codes. No PII.

**Step 1: Write the failing test**

Add to `price_alert_service_test.go` a test that verifies the new log lines appear. The existing test harness uses `miniredis` for Redis simulation and `testify/mock` for the asset price service.

Test: `TestCheckPrice_FirstRun_LogsBaselineSet`

```go
func TestCheckPrice_FirstRun_LogsBaselineSet(t *testing.T) {
    mr := miniredis.RunT(t)
    rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
    pkgRDB := pkgredis.NewRedisClientFromExisting(rdb)

    svc := &priceAlertService{redisClient: pkgRDB}

    // Capture log output
    var buf bytes.Buffer
    log.SetOutput(&buf)
    defer log.SetOutput(os.Stderr)

    result := svc.checkPrice(context.Background(), "SJ9999", 9_000_000)
    assert.Nil(t, result, "first run should return nil (baseline not set yet)")
    assert.Contains(t, buf.String(), "set initial baseline for SJ9999")
}
```

Test: `TestDoCheckAndAlert_CategoryNotEnabled_Logs`

```go
func TestDoCheckAndAlert_CategoryNotEnabled_Logs(t *testing.T) {
    // Uses existing mock infrastructure in price_alert_service_test.go
    // Sets up a category with Enabled=false, runs doCheckAndAlert(force=false)
    // Asserts log contains "not enabled — skipping"
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestCheckPrice_FirstRun_LogsBaselineSet ./domain/service/...
```
Expected: FAIL — no log line for baseline set currently.

**Step 3: Write minimal implementation**

In `checkPrice` (line ~387, `price_alert_service.go`):
```go
// First run: store baseline and skip
s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 0)
log.Printf("Price alert: set initial baseline for %s = %d (first run)", typeCode, currentBuy)
return nil
```

In `checkPrice` (line ~393, invalid parse fallback):
```go
s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 0)
log.Printf("Price alert: reset invalid baseline for %s = %d", typeCode, currentBuy)
return nil
```

In `doCheckAndAlert` category loop (line ~213, category not enabled):
```go
if !ok || !catCfg.Enabled {
    log.Printf("Price alert: category '%s' not enabled — skipping", cat.category)
    continue
}
```

In `doCheckAndAlert` threshold not met (line ~229, `len(significant) == 0` after filter):
```go
if len(significant) == 0 {
    log.Printf("Price alert: category '%s' — %d movers, none exceed %.1f%% threshold",
        cat.category, len(cat.movers), catCfg.ThresholdPct)
    continue
}
```

In `doCheckAndAlert` cooldown check (line ~237, cooldown skip):
```go
if !force {
    exists, _ := s.redisClient.GetClient().Exists(ctx, cooldownKey).Result()
    if exists > 0 {
        log.Printf("Price alert: category '%s' skipped — cooldown active", cat.category)
        continue
    }
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run "TestCheckPrice_FirstRun|TestDoCheckAndAlert" ./domain/service/...
```

**Step 5: Run full lint + build**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**
```
fix(price-alert): add diagnostic logging to all silent skip paths (FR-1)
```

---

### Task 2: Add Summary Logging to `UserPriceAlertJob` and `EvaluateAlerts` (FR-2, FR-3)

**Files:**
- Modify: `src/go-backend/internal/scheduler/user_price_alert_job.go:26-32` (`Run`)
- Modify: `src/go-backend/domain/service/user_price_alert_service.go:339-346` (`EvaluateAlerts` — early return when 0 alerts)
- Modify: `src/go-backend/domain/service/user_price_alert_service_test.go` (add test)

**Security notes:** Log lines are internal metrics only. No PII.

**Step 1: Write the failing test**

Add to `user_price_alert_service_test.go`:

```go
func TestEvaluateAlerts_ZeroActiveAlerts_Logs(t *testing.T) {
    mockRepo := new(mockUPAAlertRepo)
    mockRepo.On("ListActive", mock.Anything).Return([]*models.UserPriceAlert{}, nil)

    svc := &userPriceAlertService{alertRepo: mockRepo}

    var buf bytes.Buffer
    log.SetOutput(&buf)
    defer log.SetOutput(os.Stderr)

    err := svc.EvaluateAlerts(context.Background())
    assert.NoError(t, err)
    assert.Contains(t, buf.String(), "no active alerts found")
}
```

Add to `user_price_alert_job_test.go` (new file or alongside job tests):

```go
func TestUserPriceAlertJob_Run_LogsCompletion(t *testing.T) {
    mockSvc := new(mockUPAService)
    mockSvc.On("EvaluateAlerts", mock.Anything).Return(nil)
    job := NewUserPriceAlertJob(mockSvc)

    var buf bytes.Buffer
    log.SetOutput(&buf)
    defer log.SetOutput(os.Stderr)

    err := job.Run(context.Background())
    assert.NoError(t, err)
    assert.Contains(t, buf.String(), "completed")
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run "TestEvaluateAlerts_ZeroActiveAlerts" ./domain/service/...
```

**Step 3: Write minimal implementation**

In `user_price_alert_service.go`, `EvaluateAlerts` (line ~344):
```go
if len(alerts) == 0 {
    log.Println("EvaluateAlerts: no active alerts found — skipping evaluation")
    return nil
}
```

In `user_price_alert_job.go`, `Run` (lines 26-32):
```go
func (j *UserPriceAlertJob) Run(ctx context.Context) error {
    log.Println("Running user price alert evaluation...")
    if err := j.alertService.EvaluateAlerts(ctx); err != nil {
        log.Printf("User price alert evaluation failed: %v", err)
        return err
    }
    log.Println("User price alert evaluation completed")
    return nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run "TestEvaluateAlerts_ZeroActiveAlerts|TestUserPriceAlertJob" ./domain/service/... ./internal/scheduler/...
```

**Step 5: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**
```
fix(user-price-alert): add summary logging to job and EvaluateAlerts (FR-2, FR-3)
```

---

### Task 3: Fix `fetchPricesForAlerts` — Remove Inner Timeout Wrapper (FR-4)

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go:580-581` (`fetchPricesForAlerts`)
- Modify: `src/go-backend/domain/service/user_price_alert_service_test.go` (add test verifying caller ctx is used)

**Security notes:** Timeout is an internal resource control. No security impact.

**Step 1: Write the failing test**

The bug: `fetchPricesForAlerts` creates an inner `context.WithTimeout(ctx, alertPriceFetchTimeout)` (5s) that shadow-cancels the outer 30s context from `EvaluateAlerts`.

Test: Verify that `fetchPricesForAlerts` uses the provided context directly, not a sub-timeout. The simplest test is a compilation/runtime check — use an already-cancelled context and verify the function returns promptly (not hanging on a new 5s timeout).

```go
func TestFetchPricesForAlerts_UsesCallerContext(t *testing.T) {
    // If inner timeout is still present, this test is still correct —
    // we are verifying the behavior after the fix.
    // After fix: uses caller ctx directly, no inner WithTimeout.
    svc := buildTestUserPriceAlertSvc(t)
    ctx, cancel := context.WithCancel(context.Background())
    cancel() // immediately cancelled
    alerts := []*models.UserPriceAlert{
        {AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK), Symbol: "AAPL", PriceSide: "buy"},
    }
    // Should return empty map quickly without panic
    result := svc.fetchPricesForAlerts(ctx, alerts)
    assert.NotNil(t, result)
}
```

**Step 2: Run test to verify it fails (or documents pre-condition)**
```bash
cd src/go-backend && go test -run TestFetchPricesForAlerts_UsesCallerContext ./domain/service/...
```

**Step 3: Write minimal implementation**

In `user_price_alert_service.go`, `fetchPricesForAlerts` (lines ~580-581), remove the inner timeout:

**Before:**
```go
fetchCtx, cancel := context.WithTimeout(ctx, alertPriceFetchTimeout)
defer cancel()

// Fetch gold prices from DB cache (non-stale only)
var goldByCode map[string]*AssetPriceDTO
if hasGold {
    prices, err := s.assetPriceSvc.GetPricesByAssetType(fetchCtx, "gold")
```

**After:**
```go
// No inner timeout — caller (EvaluateAlerts) already wraps with 30s timeout.
// Using caller ctx directly gives market-type alert price fetches the full 30s budget.

// Fetch gold prices from DB cache (non-stale only)
var goldByCode map[string]*AssetPriceDTO
if hasGold {
    prices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")
```

Also update silver and market alert calls from `fetchCtx` → `ctx`.

Also remove the now-unused `alertPriceFetchTimeout` constant if it is only used in `fetchPricesForAlerts`. **Check first:** `alertPriceFetchTimeout` is also used in `fetchCurrentPrice` (line ~516) — do NOT remove the constant, only remove the `WithTimeout` in `fetchPricesForAlerts`.

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestFetchPricesForAlerts_UsesCallerContext ./domain/service/...
```

**Step 5: Verify build compiles cleanly**
```bash
cd src/go-backend && go build ./...
```

**Step 6: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 7: Commit**
```
fix(user-price-alert): remove inner 5s timeout in fetchPricesForAlerts (FR-4)
```

---

### Task 4: Add TTL to Baseline Redis Keys (FR-5)

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go` — all 3 `Set(ctx, baselineKey, ...)` calls
- Modify: `src/go-backend/domain/service/price_alert_service_test.go` (verify TTL is set)

**Security notes:** Adding TTL to a Redis key is a resilience fix. No security impact.

**Step 1: Write the failing test**

```go
func TestCheckPrice_BaselineKey_HasTTL(t *testing.T) {
    mr := miniredis.RunT(t)
    rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
    pkgRDB := pkgredis.NewRedisClientFromExisting(rdb)

    svc := &priceAlertService{redisClient: pkgRDB}
    svc.checkPrice(context.Background(), "SJ9999", 9_000_000)

    // Verify TTL is set (should be ~24h, not 0)
    ttl := mr.TTL("price_alert:baseline:SJ9999")
    assert.Greater(t, int(ttl.Hours()), 0, "baseline key should have a TTL > 0")
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestCheckPrice_BaselineKey_HasTTL ./domain/service/...
```
Expected: FAIL — TTL is 0 (no expiry) currently.

**Step 3: Write minimal implementation**

In `price_alert_service.go`, find all 3 occurrences of `Set(ctx, baselineKey, ..., 0)` and change to `24*time.Hour`:

**Occurrence 1** — `checkPrice`, first-run:
```go
s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 24*time.Hour)
```

**Occurrence 2** — `checkPrice`, invalid parse fallback:
```go
s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 24*time.Hour)
```

**Occurrence 3** — `doCheckAndAlert`, baseline update loop after alert fires (line ~333):
```go
s.redisClient.GetClient().Set(ctx, baselineKey, m.Current, 24*time.Hour)
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestCheckPrice_BaselineKey_HasTTL ./domain/service/...
```

**Step 5: Run full test suite**
```bash
cd src/go-backend && go test -short ./domain/service/...
```

**Step 6: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 7: Commit**
```
fix(price-alert): add 24h TTL to baseline Redis keys (FR-5)
```

---

### Task 5: Update Runtime Flow Diagram (docs)

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**When to skip:** This task is NOT skipped — the spec explicitly requests a flow diagram note.

**Step 1: Read the current flow-cross-cutting.md**
Read the file and locate the background scheduler section.

**Step 2: Add note for price-alert baseline/cooldown mechanism**

Append to the `price-alert` job description in the scheduler section:

> **Baseline/Cooldown mechanism (normal mode only):**
> - **First run (cold-start):** Baseline Redis keys are set from current price; no alert fires for this cycle. Log: `"Price alert: set initial baseline for X"`. Baselines expire after 24 hours.
> - **Subsequent runs:** Change% is computed vs baseline. Alert fires only if `change% >= threshold` (default: 2%) AND no cooldown key active.
> - **After alert fires:** Cooldown key set for 120 minutes (8 cycles). Baseline updated to current price.
> - **Force-trigger mode (admin):** Bypasses threshold filter and cooldown; never updates baselines or sets cooldowns.

**Step 3: Commit**
```
docs(flow): add baseline/cooldown mechanism note to price-alert job in flow-cross-cutting.md
```

---

### Task 6: Investigate FR-6 — Confirm Root Cause of 0 Active Alerts

**Files:**
- No code change (investigation task)
- Possible: Add DB migration if sub-cause 3b confirmed
- Possible: Add UI message in `features/price-alert/components/PriceAlertList.tsx` if sub-cause 3a confirmed

**Step 1: Confirm actual `status` values in DB**

Run via Supabase SQL editor or Railway console:
```sql
SELECT status, COUNT(*) FROM user_price_alert WHERE deleted_at IS NULL GROUP BY status;
```

**Step 2: Confirm `ListActive` query is correct**

Read `src/go-backend/domain/repository/` — find `UserPriceAlertRepository.ListActive`. Verify it queries `status = 'active'` (lowercase) and `deleted_at IS NULL`.

**Step 3: Decision tree**

| DB Result | Sub-cause | Action |
|-----------|-----------|--------|
| All rows have `status = 'triggered'` | 3a (once-mode triggered) | Document in code comment; add UI message (Step 4) |
| Rows exist with different status casing (e.g. `'Active'`) | 3b (stored value mismatch) | Add migration to fix values; add unit test |
| All rows `status = 'paused'` | 3c | No code change; user action |
| 0 rows total | 3d | No code change; user must create alerts |

**Step 4: If sub-cause 3a — add UI message to PriceAlertList**

In `src/wj-client/features/price-alert/components/PriceAlertList.tsx`, update the empty state to distinguish "no alerts" from "all triggered":

```tsx
// Existing empty state check
if (alerts.length === 0) {
    return <EmptyState message="No price alerts yet. Create your first alert." />;
}

// New: all-triggered state
const allTriggered = alerts.every(a => a.status === "ALERT_STATUS_TRIGGERED");
if (allTriggered) {
    return (
        <EmptyState
            message="All your alerts have been triggered."
            subMessage="Create new alerts to continue monitoring prices."
        />
    );
}
```

**Step 5: Commit (if code change made)**
```
fix(user-price-alert): add triggered-state UI message and/or DB fix for FR-6
```

---

## Task Ordering Summary

| Order | Task | Dependency |
|-------|------|------------|
| 1 | Add diagnostic logging to `checkPrice` / `doCheckAndAlert` | None |
| 2 | Add summary logging to `UserPriceAlertJob` and `EvaluateAlerts` | None |
| 3 | Remove inner timeout in `fetchPricesForAlerts` | None |
| 4 | Add TTL to baseline Redis keys | None |
| 5 | Update flow diagram | None |
| 6 | Investigate FR-6 (0 active alerts) | None (investigation) |

Tasks 1-6 are all **independent** — safe to implement sequentially in any order. Recommended order: 1 → 2 → 3 → 4 → 5 → 6.

---

## Test File Reference

| File | Pattern |
|------|---------|
| `src/go-backend/domain/service/price_alert_service_test.go` | Uses `miniredis`, `testify/mock`, `mockPAAssetPriceSvc` |
| `src/go-backend/domain/service/user_price_alert_service_test.go` | Uses `miniredis`, `testify/mock`, `mockUPA*` mocks |
| `src/go-backend/internal/scheduler/` | No existing test file for jobs — create inline with `_test.go` |

**Note:** Import `bytes` and `os` for log capture in new tests. The existing test files use `"github.com/alicebob/miniredis/v2"` and `"wealthjourney/pkg/redis"` — follow the same pattern.
