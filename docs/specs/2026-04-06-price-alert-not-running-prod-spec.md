# Price Alert Not Running on Production — Root Cause Analysis Specification

## Summary

Both the system price alert job (`PriceAlertJob`) and the user price alert job (`UserPriceAlertJob`) stopped firing on the production environment after the "filter alert evaluation to admin-enabled type codes only" fix was merged approximately 3 days ago (commit `7da688f3`, April 3 2026). This spec analyses all plausible root causes and defines acceptance criteria for verifying the fix is working correctly on production.

---

## Brainstorm: Root Cause Hypotheses

### The Core Mechanism Introduced by the Filter Fix (commit `7da688f3`)

The commit introduced `buildEnabledSet` in `price_alert_service.go`. In its **original form** (the April 3 version), it:

1. Called `s.configSvc.ListAll(ctx, assetType)` — which returns **all** asset display configs (enabled + disabled) for that asset type.
2. Built a `map[string]bool` keyed by `AssetDisplayConfig.TypeCode` (the **display** type code, e.g. `"Doji_24K"`).
3. Then filtered `asset_price` rows by matching `asset_price.type_code` against the enabled set.

**The bug (fixed in commit `12b7ea02`, April 6):** `asset_price.type_code` stores **internal fetch codes** (e.g. `"DOJI_AVPL_BAN_LE"`), while `AssetDisplayConfig.TypeCode` stores **display codes** (e.g. `"Doji_24K"`). These two namespaces never match, so `enabledGold[p.TypeCode]` always returned `false`, and **zero movers** were ever produced — meaning zero notifications were sent.

The `12b7ea02` fix changed `buildEnabledSet` to call `GetFetchCodesByAssetType` which correctly maps internal fetch codes → display configs.

---

## Hypothesis Taxonomy

### H1 — TYPE CODE MISMATCH (ROOT CAUSE — CONFIRMED in code)

**System alert (`PriceAlertJob`):**
The April 3 fix (`7da688f3`) introduced an enabled-set keyed on `AssetDisplayConfig.TypeCode` (display namespace) but compared against `asset_price.type_code` (fetch-code namespace). These never match in production, so `enabledGold` / `enabledSilver` always returned zero movers → no categories with movers → no notifications → job runs successfully but does nothing.

**Evidence:**
- Code diff of `7da688f3` shows `enabled[c.TypeCode] = true` where `c.TypeCode` = display code (e.g. `"Doji_24K"`).
- The filter `if !enabledGold[p.TypeCode]` then compares against `asset_price.type_code` = internal fetch code (e.g. `"DOJI_AVPL_BAN_LE"`).
- These namespaces have zero overlap by design.
- The `12b7ea02` fix addresses exactly this by using `GetFetchCodesByAssetType` which maps internal codes → configs.

**User alert (`UserPriceAlertJob`):**
`EvaluateAlerts` uses `fetchPricesForAlerts` which looks up gold/silver prices by `goldByCode[a.Symbol]` where `a.Symbol` is a user-entered value (e.g. `"SJL1L10"`) and `goldByCode` is keyed on `asset_price.type_code` (internal fetch codes). This lookup was **unaffected** by the April 3 filter fix — user alerts use a separate code path and were not touched.

**So why are user alerts also not running?** → This requires separate hypotheses (H2–H5 below).

---

### H2 — PRODUCTION HAS NOT BEEN REDEPLOYED (Most Likely for System Alerts after Fix)

The `12b7ea02` fix (April 6) was merged but may not have been deployed to Railway yet. If the production binary still runs the April 3 code, system alerts remain broken.

**Verification:** Check Railway deploy logs. The fix commit `12b7ea02` must be deployed.

---

### H3 — USER ALERT SYMBOL MISMATCH (Likely Independent Root Cause for User Alerts)

User alerts store `alert.Symbol` (e.g. `"SJL1L10"`, a gold type code). `fetchPricesForAlerts` looks up prices via `goldByCode[a.Symbol]` where `goldByCode` is keyed by `asset_price.type_code`.

**The question:** Does `asset_price.type_code` match the gold type codes that users enter when creating alerts?

Gold type codes (from `pkg/gold/` registry) like `"SJL1L10"`, `"SJC_1L"`, etc. may differ from the internal fetch codes written to `asset_price` by the price cache job. If the SJC/gold price cache job writes rows with fetch codes like `"SJC_BAN_LE"` but users create alerts using type codes `"SJL1L10"`, `goldByCode[a.Symbol]` returns nil and the alert is silently skipped every cycle.

**How it connects to April 3:** The filter fix added `configSvc` dependency to `priceAlertService` but may have also changed how the `AssetPriceService` behaves — specifically whether `GetPricesByAssetType` returns rows keyed by the internal fetch code or by something else.

---

### H4 — `asset_config_fetch_code` TABLE EMPTY OR NOT MIGRATED IN PRODUCTION

`GetFetchCodesByAssetType` (used in the `12b7ea02` fix) calls `fetchCodeRepo.ListByConfigID` for each config. If the `asset_config_fetch_code` table was never populated in production (migration `task backend:migrate-asset-config-fetch-code` was not run), then:

- `GetFetchCodesByAssetType` returns an empty map.
- `buildEnabledSet` detects `len(fcMap) == 0` → logs "no enabled configs with fetch codes — skipping (cold-start or unconfigured)".
- **Both gold and silver sections are skipped entirely.**
- Zero notifications.

**This would affect the `12b7ea02` fix too**, meaning even the corrected code produces nothing if the DB table is empty.

---

### H5 — `asset_display_config` TABLE EMPTY OR ALL DISABLED IN PRODUCTION

Similar to H4: if no display configs exist or all are `enabled = false`, `GetFetchCodesByAssetType` returns an empty map → cold-start path → zero movers → no alerts.

The `task backend:migrate-vietcombank-currency` migration seeds VCB currency display configs but only for currency type. If gold/silver display configs were never created via the admin panel or a seed migration, the filter correctly produces nothing.

---

### H6 — `asset_price` TABLE EMPTY OR ALL STALE IN PRODUCTION

`GetPricesByAssetType` (called before the filter) could return empty or all-stale rows if the `PriceCacheJob` is not running or failed repeatedly. Stale prices are skipped in the loop. If all prices are stale, zero movers are produced.

**Check:** Does production have non-stale rows in `asset_price`? The `PriceCacheJob` runs every 15 minutes. If it's failing silently, prices go stale within a few cycles.

---

### H7 — `GetFetchCodesByAssetType` RETURNS ERROR (Silent Skip)

`GetFetchCodesByAssetType` calls `s.fetchCodeRepo.ListByConfigID` in a loop. If the DB connection to Supabase's pooler fails (e.g. pool exhaustion, idle timeout), this returns an error. The `buildEnabledSet` function catches the error and returns `nil, false` → the entire gold/silver section is **skipped** (not just one price). This is graceful degradation but silences the scheduler.

**Production DB:** Supabase connection pooler `aws-1-ap-northeast-1.pooler.supabase.com` uses PgBouncer in transaction mode. Prepared statements can fail in this mode if not handled correctly.

---

### H8 — SCHEDULER NOT STARTING ON RAILWAY (Unlikely but Check)

If the `PriceAlertJob` or `UserPriceAlertJob` goroutines panic and exit during startup, they would not run. The scheduler uses a simple `time.AfterFunc` or ticker pattern. A panic at startup would be logged but the job wouldn't run again.

---

## Impact Assessment

| Hypothesis | Affects System Alert | Affects User Alert | Likelihood | Verification Method |
|---|---|---|---|---|
| H1 — TypeCode mismatch (April 3 code) | YES | NO | **Confirmed** (code) | Deploy `12b7ea02` |
| H2 — Not redeployed | YES (12b7ea02 fix not live) | NO | **High** | Check Railway deploy |
| H3 — Symbol mismatch in user alerts | NO | YES | **High** | Query `asset_price` table |
| H4 — `asset_config_fetch_code` empty | YES (after 12b7ea02) | NO | **High** | Query production DB |
| H5 — `asset_display_config` empty/disabled | YES | NO | **Medium** | Query production DB |
| H6 — `asset_price` empty/stale | YES | YES | **Medium** | Query production DB |
| H7 — DB connection error on fetch codes | YES | NO | **Low-Medium** | Check Railway logs |
| H8 — Scheduler not starting | YES | YES | **Low** | Check Railway logs |

---

## Functional Requirements

### FR-1: Diagnose System Alert Failure

Verify which of H1–H8 applies to the **system price alert** (`PriceAlertJob`) on production.

**Acceptance criteria:**
- [ ] Production Railway has deployed commit `12b7ea02` or later
- [ ] `asset_display_config` table has at least 1 enabled row for `asset_type = 'gold'`
- [ ] `asset_config_fetch_code` table has at least 1 row for an enabled gold config
- [ ] The fetch code in `asset_config_fetch_code.type_code` matches a value in `asset_price.type_code WHERE asset_type = 'gold'`
- [ ] `asset_price` table has non-stale gold rows (verified by `is_stale = false` and `fetched_at` recent)
- [ ] Railway logs show "Price alert: sent gold_vnd alert to N users" on next job run

### FR-2: Diagnose User Alert Failure

Verify what prevents **user price alerts** (`UserPriceAlertJob`) from triggering.

**Acceptance criteria:**
- [ ] Active user alerts exist in `user_price_alert` table with `status = 'active'`
- [ ] `alert.symbol` values match `asset_price.type_code` for gold/silver alerts OR match Yahoo Finance symbols for market alerts
- [ ] `EvaluateAlerts` logs "total=N triggered=M" — confirm N > 0 and M reflects actual conditions
- [ ] If M = 0, confirm either conditions not met OR symbol mismatch (H3)

### FR-3: Fix Any Remaining Issues

After diagnosis, if additional bugs are found (H3–H8), implement targeted fixes.

**Acceptance criteria:**
- [ ] System alerts fire when price moves ≥ threshold and at least one enabled display config with fetch codes exists
- [ ] User alerts fire when target price conditions are met and symbol lookup succeeds
- [ ] No silent "skip" paths remain without adequate logging

---

## Non-Functional Requirements

- **Observability**: All skip paths in both jobs must emit a log line with reason (already done for most paths)
- **Idempotency**: Running both jobs multiple times in a row must not cause duplicate notifications (cooldown keys in Redis handle this)
- **Production safety**: Diagnosis must use read-only DB queries — no writes to production

---

## Architecture Changes (C4)

### Diagrams to Update

None required for diagnosis. If H3 (symbol mismatch) is confirmed and a fix is needed, `c4-component-backend.md` should be updated to show that `UserPriceAlertService.fetchPricesForAlerts` depends on `AssetPriceService` with the correct key mapping.

### New Diagrams

None.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — the background scheduler section should be updated to show the full `PriceAlertJob` flow including the `buildEnabledSet` → fetch-code matching path.

### New Flow Diagrams

Add a sequence diagram showing the `EvaluateAlerts` flow for user alerts (gold path):
- `UserPriceAlertJob` → `EvaluateAlerts` → `fetchPricesForAlerts` → `AssetPriceService.GetPricesByAssetType` → filter stale → `goldByCode[alert.Symbol]` lookup → check trigger → notify.

---

## Data Model Changes

No schema changes required for diagnosis.

---

## API Changes

None.

---

## Diagnosis SQL Queries (Production)

```sql
-- 1. Check asset_display_config (are there enabled gold configs?)
SELECT id, type_code, display_name, enabled, asset_type
FROM asset_display_config
WHERE asset_type = 'gold';

-- 2. Check asset_config_fetch_code (are fetch codes mapped?)
SELECT fc.id, fc.config_id, fc.type_code AS fetch_code, adc.display_name, adc.enabled
FROM asset_config_fetch_code fc
JOIN asset_display_config adc ON fc.config_id = adc.id
WHERE adc.asset_type = 'gold';

-- 3. Check asset_price (are there non-stale gold prices?)
SELECT type_code, buy, sell, is_stale, fetched_at
FROM asset_price
WHERE asset_type = 'gold'
ORDER BY fetched_at DESC;

-- 4. Cross-check: do fetch codes match asset_price type_codes?
SELECT fc.type_code AS fetch_code, ap.type_code AS price_code, ap.buy, ap.is_stale
FROM asset_config_fetch_code fc
LEFT JOIN asset_price ap ON ap.type_code = fc.type_code AND ap.asset_type = 'gold'
JOIN asset_display_config adc ON fc.config_id = adc.id AND adc.enabled = true;

-- 5. Check user alerts
SELECT id, user_id, symbol, asset_type, price_side, direction, target_price, status
FROM user_price_alert
WHERE status = 'active';

-- 6. Check if user alert symbols match asset_price (H3)
SELECT ua.symbol, ap.type_code, ap.buy, ap.sell, ap.is_stale
FROM user_price_alert ua
LEFT JOIN asset_price ap ON ap.type_code = ua.symbol
WHERE ua.status = 'active' AND ua.asset_type IN (8, 9); -- gold types
```

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Scheduler goroutine | Job trigger | No | PriceAlertService | Internal |
| 2 | PriceAlertService | DB query for configs | No | Supabase PostgreSQL | Internal network |
| 3 | PriceAlertService | Price data | No | Redis cache | Internal |
| 4 | UserPriceAlertService | Alert list | No | Supabase PostgreSQL | Internal |
| 5 | UserPriceAlertService | Price lookup | No | AssetPriceService | Internal |
| 6 | Both services | Notification | No | Redis pub/sub | Internal |

### Threats Identified

| # | STRIDE | Threat | Severity | Mitigation |
|---|--------|--------|----------|------------|
| T-1 | Denial of Service | Supabase pooler connection exhaustion silences alerts | Medium | Add connection pool health check; log DB errors prominently |
| T-2 | Information Disclosure | Railway logs may contain user price data | Low | Log only alert IDs, not prices |
| T-3 | Tampering | Admin disabling all display configs silences system alerts silently | Low | Add monitoring alert if 0 movers for >2 cycles |

### Authorization Rules

Diagnosis queries are read-only. No authorization changes needed.

### External Dependency Risks

- **Supabase PgBouncer pooler** in transaction mode: prepared statements may fail. If `GetFetchCodesByAssetType` uses prepared statements internally via GORM, connection errors cause silent alert suppression (H7).
- **Railway environment**: if deployment of `12b7ea02` was not triggered, production still runs broken code.

### Issues & Risks Summary

1. **Critical**: System alerts definitively broken from April 3–6 due to TypeCode namespace mismatch (H1). Fixed in `12b7ea02` but may not be deployed.
2. **High**: If `asset_config_fetch_code` table is empty in production, even the fixed code produces nothing (H4).
3. **High**: User alerts may silently skip gold/silver because user-entered symbols (gold type codes) may not match internal fetch codes in `asset_price.type_code` (H3).
4. **Medium**: No alerting exists if the scheduler job runs but produces zero notifications for multiple consecutive cycles.

---

## Edge Cases & Error Handling

- **Cold-start (empty DB)**: Both jobs gracefully log and skip — this is correct behavior.
- **All prices stale**: Job skips stale prices — no notifications. This is correct if prices are genuinely stale (source API down). But could mask the H6 scenario where the price cache job itself is broken.
- **Redis unavailable**: Cooldown and daily cap checks are skipped (`rdb != nil` guards). Alerts still fire.
- **No active user alerts**: `EvaluateAlerts` returns immediately with nil error — correct.

---

## Dependencies & Assumptions

- Production DB is Supabase PostgreSQL with PgBouncer pooler (transaction mode)
- Railway is the deployment platform — deployments are triggered manually or via CI
- Redis is available on production for cooldown/cap tracking
- The `12b7ea02` commit has been pushed to the `main` branch

## Out of Scope

- Re-architecting the scheduler approach
- Adding new alert types
- Changing the `asset_config_fetch_code` data model
