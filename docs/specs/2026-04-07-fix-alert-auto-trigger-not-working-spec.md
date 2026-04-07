# Fix: Alert Auto-Trigger Not Working — Specification

## Summary

Two distinct alert mechanisms exist in WealthJourney: (1) the **system price alert** (`PriceAlertJob` / `CheckAndAlert`) that broadcasts gold/silver movement notifications to all users when price changes exceed a threshold, and (2) the **user price alert** (`UserPriceAlertJob` / `EvaluateAlerts`) that fires personal notifications when a user's specific target price is crossed. Both are scheduled every 15 minutes by the background scheduler.

The admin "trigger now" button calls `ForceCheckAndAlert` (force mode), which works every time. But the automatic scheduler calls `CheckAndAlert` (normal mode), which silently produces zero notifications on almost every cycle. The user alert job (`EvaluateAlerts`) was also confirmed returning zero active alerts from the database in the log snapshot.

Deep investigation of the log file (`logs.1775528003063.log`) and codebase reveals **three distinct root causes**, all requiring fixes.

---

## Root Cause Analysis

### Root Cause 1: System Price Alert — Baseline Mechanism Silences Normal Mode Every First Run

**What the code does:**

`checkPrice()` is called for each asset in normal (scheduled) mode:

```go
func (s *priceAlertService) checkPrice(ctx context.Context, typeCode string, currentBuy int64) *priceMover {
    baselineKey := fmt.Sprintf("price_alert:baseline:%s", typeCode)
    baselineStr, err := s.redisClient.GetClient().Get(ctx, baselineKey).Result()
    if err != nil {
        // First run: store baseline and skip
        s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 0)
        return nil  // <-- silently skips
    }
    // ...compares changePct against threshold...
}
```

After the first run sets baselines, subsequent runs compare current price to the stored baseline. The default threshold is **2%** (`ThresholdPct: 2.0`). Gold prices need to move 2% = ~3.4 million VND in a single 15-minute window to fire.

**Why this silences scheduled alerts:**

1. Server restarts: baselines are reset in Redis (or Redis was flushed) → first run sets baselines, no alert.
2. After a force-trigger: force mode calls `checkPriceForce` which does NOT update baselines. The normal scheduler still has the old baselines. If prices haven't moved 2% since the last scheduled run that DID fire, no alert.
3. After a scheduled alert fires: `if !force { ... update baselines }` resets baselines to current price. The next 15-minute cycle starts fresh — needs another 2% move.

**Evidence in logs:**

- 02:07:40 — scheduler startup, jobs start
- 02:07:42 — "Price alert check completed" with **zero notifications** (first run, baselines set)
- 02:12:57 — next scheduler run (15 min later), force-trigger from admin at 02:13:04 fires fine
- The scheduled job between 02:07 and 02:22 never sends any notification

**The core design issue:** Baselines are initialized from current price on every Redis-key-miss. If Redis loses the key (restart, eviction, TTL), the baseline is reset and no alert fires for that cycle. There is **no TTL** set on baseline keys (`Set(ctx, baselineKey, currentBuy, 0)` — TTL = 0 = no expiry), so they persist indefinitely — but Redis flushes on restart.

### Root Cause 2: System Price Alert — Cooldown Key Blocks 120 Minutes of Scheduler Runs

After a scheduled alert fires (normal mode), the cooldown key is set:

```go
if !force {
    cooldownDuration := time.Duration(cfg.CooldownMinutes) * time.Minute  // default: 120 min
    s.redisClient.GetClient().Set(ctx, cooldownKey, "1", cooldownDuration)
}
```

This means for the next **8 scheduler cycles** (120 min / 15 min), the category is silently skipped:

```go
if !force {
    exists, _ := s.redisClient.GetClient().Exists(ctx, cooldownKey).Result()
    if exists > 0 {
        continue  // silently skipped
    }
}
```

**The problem:** There is no log line emitted when a category is skipped due to cooldown. The log only says "Price alert check completed" — indistinguishable from "no significant movers found" or "first run baseline set". This makes debugging impossible from logs alone.

**Evidence in logs:** Force-trigger at 02:13:04 fires correctly (force mode ignores cooldown). No evidence of a scheduled alert firing in the entire log window. This is consistent with either (1) cooldown blocking or (2) threshold never reached in 15-min windows.

### Root Cause 3: User Price Alerts — `ListActive` Returns 0 Rows

At 02:07:46, the user alert job queries:

```sql
SELECT * FROM "user_price_alert" WHERE status = 'active' AND "user_price_alert"."deleted_at" IS NULL
-- rows: 0
```

**Possible sub-causes (in order of likelihood):**

**3a. Alerts triggered with `once` mode stay in `triggered` status:**
When a `once`-mode alert fires, `UpdateStatus` sets `status = 'triggered'`. These are never reactivated. If the user created their alerts, they triggered once (possibly during a force test), and now have 0 active rows.

**3b. Alert status filter bug — stored value mismatch:**
`ListActive` queries `status = 'active'` (lowercase). `CreateAlert` sets `Status: "active"`. This is consistent. **But** if alerts were ever set via raw DB or a proto field with wrong casing, they'd be invisible to the query.

**3c. All alerts are paused:**
User may have paused alerts from the UI without realizing it.

**3d. No alerts exist yet:**
The most likely explanation for a fresh test setup.

**The missing piece:** `UserPriceAlertJob.Run` does NOT log a summary line like `EvaluateAlerts` does ("`EvaluateAlerts: total=X triggered=Y...`"). If `len(alerts) == 0` it returns `nil` silently. The scheduler's `runJob` wrapper only logs errors, not "no alerts found". This makes it impossible to distinguish "0 active alerts" from "job errored silently".

### Root Cause 4: `fetchPricesForAlerts` Uses Nested Timeout — Market Assets Can Time Out in 5s

In `EvaluateAlerts`:

```go
fetchCtx, cancel := context.WithTimeout(ctx, alertEvalPriceFetchTimeout)  // 30s
defer cancel()
priceMap := s.fetchPricesForAlerts(fetchCtx, alerts)
```

Inside `fetchPricesForAlerts`:

```go
fetchCtx, cancel := context.WithTimeout(ctx, alertPriceFetchTimeout)  // 5s from OUTER ctx
defer cancel()
```

This creates a 5-second sub-timeout from the already-30s context. Gold/silver prices from DB are fast. But **market symbol prices** (Yahoo Finance via `GetPrice`) each get called sequentially inside a 5-second total budget:

```go
for _, a := range marketAlerts {
    md, err := s.marketDataSvc.GetPrice(fetchCtx, a.Symbol, ...)
    // if this times out, alert is silently skipped (no price → condition not evaluated)
}
```

If a user has 3+ market-type alerts (stocks, crypto), sequential Yahoo Finance calls within a 5-second window will time out, silently skip those alerts.

---

## User Stories

- As a developer, I want to see clear log output when the system price alert job skips categories (cooldown, threshold, cold-start), so I can diagnose why alerts aren't firing.
- As a developer, I want the user price alert job to log how many active alerts it found, even when that count is zero.
- As a user, I want my price alerts to fire automatically on schedule, not only when an admin manually triggers them.
- As a developer, I want baseline initialization to not silently prevent the first meaningful detection cycle.

---

## Functional Requirements

### FR-1: Add Diagnostic Logging Throughout `CheckAndAlert` / `doCheckAndAlert`

Add log lines for every silent skip path so the behavior is observable from logs:

**In `checkPrice` (first-run baseline set):**
```go
log.Printf("Price alert: set initial baseline for %s = %d (first run)", typeCode, currentBuy)
return nil
```

**In `doCheckAndAlert` (cooldown skip):**
```go
log.Printf("Price alert: category '%s' skipped — cooldown active", cat.category)
```

**In `doCheckAndAlert` (threshold not met):**
```go
log.Printf("Price alert: category '%s' — %d movers, none exceed %.1f%% threshold", cat.category, len(cat.movers), catCfg.ThresholdPct)
```

**In `doCheckAndAlert` (category not enabled):**
```go
log.Printf("Price alert: category '%s' not enabled — skipping", cat.category)
```

**In `doCheckAndAlert` (no movers found after filter):**
Already logs "no enabled configs" — keep as-is.

**Acceptance criteria:**
- [ ] Every silent skip path emits a log line with the reason
- [ ] Log line for cooldown includes the category name
- [ ] Log line for baseline initialization includes typeCode and current value
- [ ] Threshold-not-met log shows both the mover count and the threshold value

### FR-2: Add Summary Logging to `UserPriceAlertJob.Run` and `EvaluateAlerts`

**In `UserPriceAlertJob.Run`:**
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

**In `EvaluateAlerts` — log when no active alerts:**
```go
if len(alerts) == 0 {
    log.Println("EvaluateAlerts: no active alerts found — skipping evaluation")
    return nil
}
```

**Acceptance criteria:**
- [ ] Job logs "completed" at end (currently missing)
- [ ] Job logs "no active alerts found" when count is 0
- [ ] Existing final summary log preserved: `"EvaluateAlerts: total=%d triggered=%d..."`

### FR-3: Fix `UserPriceAlertJob` — Log Error When `EvaluateAlerts` Returns Error

Currently `UserPriceAlertJob.Run` returns the error but does not log it before returning. The scheduler's `runJob` logs `ERROR: Job 'X' failed: ...` — so the error IS logged eventually. But adding an explicit log in the job itself makes debugging easier (both the job name and error context appear together).

**Acceptance criteria:**
- [ ] When `EvaluateAlerts` returns error, the job logs: `"User price alert evaluation failed: %v"`

### FR-4: Fix `fetchPricesForAlerts` — Remove Inner Timeout Wrapper

The outer `EvaluateAlerts` already wraps the fetch in a 30-second timeout. The inner 5-second timeout inside `fetchPricesForAlerts` is too aggressive for sequential Yahoo Finance calls and creates confusing double-timeout nesting.

**Fix:** Remove the inner `context.WithTimeout` from `fetchPricesForAlerts`. Use the `ctx` parameter directly (which already has the 30-second timeout from the caller).

**Acceptance criteria:**
- [ ] `fetchPricesForAlerts` does not create an inner timeout context
- [ ] Market alert price fetches use the caller-provided context directly
- [ ] Gold/silver DB fetches also use caller context (they were fast anyway — no regression)

### FR-5: Add Baseline Staleness — Set TTL on Baseline Keys

**Current problem:** Baseline keys have no TTL (`Set(ctx, key, value, 0)`). After a server restart, Redis may or may not have the keys (depends on persistence config). This means behavior after restart is non-deterministic.

**Fix:** Set baseline keys with TTL = 24 hours. This ensures:
- Baselines survive normal 15-min scheduler cycles (they refresh every cycle anyway)
- After 24 hours of inactivity (e.g. server down overnight), baselines expire and are re-initialized on the next cycle
- Redis restart with no persistence: baselines re-initialize cleanly (same behavior as before, but now deterministic)

**Acceptance criteria:**
- [ ] Baseline keys set with 24-hour TTL: `Set(ctx, baselineKey, currentBuy, 24*time.Hour)`
- [ ] Applied in both `checkPrice` (initial set AND re-set after significant move) and the baseline-update loop at end of `doCheckAndAlert`

### FR-6: Fix `UserPriceAlertJob` — Investigate and Fix 0 Active Alerts

This requires a runtime investigation. The spec identifies three sub-causes. The fix depends on which is true:

**Sub-cause 3a (triggered once-mode alerts):** No code change needed — this is expected behavior. User must create new alerts. However, add a UI message on the alerts page when all alerts are triggered: "All your alerts have been triggered. Create new alerts to continue monitoring."

**Sub-cause 3b (status value mismatch):** Query the DB directly to check actual status values. If rows exist but with different status strings, fix the stored values via migration and validate the `CreateAlert` path stores exactly `"active"`.

**Sub-cause 3c (all paused):** No code change. User action needed.

**Sub-cause 3d (no alerts):** No code change. User must create alerts.

**Acceptance criteria:**
- [ ] DB query confirms the actual state of `user_price_alert.status` column
- [ ] If sub-cause 3a: document expected behavior in code comment; optionally add UI message
- [ ] If sub-cause 3b: add migration to fix incorrect status values; add unit test for CreateAlert status field
- [ ] `ListActive` repository query confirmed correct for the actual stored status strings

---

## Non-Functional Requirements

- **Observability:** After this fix, it must be possible to determine from logs alone why a scheduled alert cycle produced no notifications (cooldown / threshold / no movers / cold-start / no active user alerts).
- **Performance:** Diagnostic log lines are cheap (`O(n)` per category, n ≤ 10 categories). No performance concern.
- **Correctness:** Removing the inner timeout in FR-4 only affects market-type user alerts. Gold/silver user alerts are unaffected (they use DB, not Yahoo Finance).

---

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3):** No structural change — these are internal behavior fixes within `PriceAlertService` and `UserPriceAlertService`. No new components.

### New Diagrams

None required.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-cross-cutting.md`:** Add a note to the background scheduler section describing the baseline/cooldown mechanism for `price-alert` job: "First run sets baselines (no alert). Subsequent runs compare change% vs threshold. Alert fires only if threshold exceeded AND cooldown not active."

### New Flow Diagrams

None needed — existing `flow-cross-cutting.md` background scheduler section is sufficient.

---

## Data Model Changes

None required for FR-1 through FR-5.

**FR-6 (conditional):** If sub-cause 3b is confirmed, a DB migration to fix status values may be needed.

---

## API Changes

None. All changes are internal to background jobs and service layer.

---

## UI/UX Changes

**Conditional (FR-6 sub-cause 3a):** Add empty/triggered state message to the alerts settings page when `alerts.length === 0` or all alerts have `status === 'triggered'`. This is a minor UX improvement.

**No other UI changes.**

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Redis | Baseline price values | No | `priceAlertService` | Internal cache; no user input |
| 2 | Redis | Cooldown keys | No | `priceAlertService` | Internal rate limiting; no user input |
| 3 | DB | `user_price_alert` rows | No | `userPriceAlertService` | Internal read; output is notification |
| 4 | Yahoo Finance API | Market price | Yes — external API | `userPriceAlertService` | Read-only; no PII sent |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| App → Redis | Baseline/cooldown read-write | Internal service; Redis on private network |
| App → Yahoo Finance | Market price fetch for user alert | Read-only; no auth token sent; rate-limited by throttler |
| App → DB | `ListActive` query | GORM parameterized query; no user input in this path |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | Baseline key | Redis internal | Tampering | Redis key poisoned with wrong baseline → alert never fires or always fires | Low | Redis on private network; no user access |
| T-2 | Yahoo Finance | External API | Denial of Service | Yahoo Finance returns 429 → all market-type user alerts skip | Low | Already silently skipped with log warning; no DB corruption |
| T-3 | Log output | App → Log system | Information Disclosure | Baseline values (gold prices) appear in logs | Negligible | Gold prices are public market data |

### Authorization Rules

No changes to authorization — these are all background job fixes.

### Input Validation Rules

No new user inputs. `ListActive` is an internal background job query.

### External Dependency Risks

- **Yahoo Finance (market alert price fetch):** If unavailable, affected user alerts are silently skipped for that cycle. FR-4 (removing inner timeout) improves resilience by giving Yahoo Finance the full 30-second budget instead of 5 seconds.

### Sensitive Data Handling

Baseline prices logged in FR-1 are public gold/silver market prices. Not sensitive.

### Issues & Risks Summary

1. **Silent failures are the core problem.** Every root cause shares the trait that the code path completes successfully (returns `nil`) without observable output. The primary fix is observability (FR-1, FR-2, FR-3).
2. **Baseline cold-start always skips first cycle.** This is by design (can't compute change% without a previous price), but the lack of logging makes it look like a bug. FR-1 makes this visible.
3. **User alert 0-row mystery requires DB investigation.** Cannot be fully resolved from code alone — need to check actual DB state. FR-6 provides the investigation steps.

---

## Edge Cases & Error Handling

| Scenario | Expected Behavior After Fix |
|----------|---------------------------|
| Server restart, Redis flushed | First scheduler cycle: baseline keys set, log "set initial baseline for X", no alert. Next cycle: normal comparison. |
| Cooldown active (120 min after scheduled alert) | Log "category 'X' skipped — cooldown active" every 15-min cycle until cooldown expires |
| All user price alerts in 'triggered' status | Log "no active alerts found" every cycle. UI shows triggered state. |
| Market alert with Yahoo Finance timeout | Log "Warning: failed to fetch market price for alert (symbol=X)" — existing behavior, now works within 30s budget |
| Threshold 2% — prices moved only 1.8% | Log "category 'gold_vnd' — N movers, none exceed 2.0% threshold" |

---

## Dependencies & Assumptions

- Redis is available and connected (all baseline/cooldown logic depends on it). If Redis is nil, `checkPrice` will panic on `.GetClient()` call — but this is an existing issue unrelated to this bug.
- The background scheduler starts successfully and both jobs are registered. Confirmed from logs: both `price-alert` and `user-price-alert` jobs appear to run.
- Log output is captured (Railway deployment logs). Confirmed from the provided log file.

---

## Out of Scope

- Changing the threshold percentage (2%) — that's a config/admin concern.
- Changing the cooldown duration (120 min) — that's a config/admin concern.
- Adding push notification retry logic.
- Adding persistence to Redis baseline keys (Redis AOF/RDB persistence is an infrastructure concern).
- Fixing the original bug from the previous spec (home page price alert creation UI) — tracked separately in `2026-04-06-fix-price-alert-cannot-use-home-page-prices-spec.md`.
