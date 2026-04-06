# Fix Push Price Notification Auto-Trigger — Implementation Report

## Summary

Fixed the scheduled push price notification system that was silently suppressing all automated alerts. The root cause was a namespace mismatch in `buildEnabledSet`: it was keying the enabled set by `asset_display_config.type_code` (admin-facing codes like `"Doji_24K"`) but comparing against `asset_price.type_code` (internal fetch codes like `"DOJI_AVPL_BAN_LE"`). These never matched, so no movers were ever emitted and no alerts ever fired. Manual/forced triggers worked because they bypass the enabled-set check entirely.

## Spec Reference

`docs/specs/2026-04-06-fix-push-price-notification-auto-trigger-spec.md`

## Plan Reference

`docs/plans/2026-04-06-fix-push-price-notification-auto-trigger-plan.md`

## Tasks Completed

| #   | Task                                                  | Status | Files Changed | Tests    | TDD |
| --- | ----------------------------------------------------- | ------ | ------------- | -------- | --- |
| 0   | Add GetFetchCodesByAssetType to AssetDisplayConfigService | Done | 6 files | All pass | Yes |
| 1   | Fix buildEnabledSet in price_alert_service.go         | Done   | 2 files | 18/18 pass | Yes |
| 2   | Update Runtime Flow Diagram                           | Done   | 1 file  | N/A (docs) | N/A |

## Test Coverage Summary

| Layer           | Test File                         | Tests | Pass | Coverage Area                                |
| --------------- | --------------------------------- | ----- | ---- | -------------------------------------------- |
| Backend Service | `price_alert_service_test.go`     | 18    | 18/18 | FR-1 namespace fix, FR-2 DisplayName, FR-3 dedup, cold-start, DB error, stale, cooldown, force mode |

## Security Implementation Summary

| Concern            | Implementation                                           | Verified |
| ------------------ | -------------------------------------------------------- | -------- |
| Input validation   | No user input — scheduler job only                       | N/A      |
| Authorization      | No user data — all data from admin-maintained DB tables  | N/A      |
| Injection          | All DB access via parameterized GORM queries             | Yes      |
| Data exposure      | Log messages contain only public market data (type codes) | Yes      |
| Monetary integrity | All price values remain int64 throughout                 | Yes      |

## Review Results

### Spec Compliance

All three functional requirements verified in code:
- **FR-1**: `buildEnabledSet` now uses `GetFetchCodesByAssetType` → `map[fetchCode → AssetDisplayConfig]`; loop key `p.TypeCode` (asset_price) matches map key (asset_config_fetch_code.type_code)
- **FR-2**: `mover.Name = cfg.DisplayName` — human-readable name from admin config
- **FR-3**: `seenConfigIDs map[int32]bool` deduplicates to one mover per display config

### Security Review

APPROVED — no new security surface. Read-only service method, no endpoints, no user input.

### Code Quality

APPROVED — clean implementation. `goto` labels preserved, empty-map cold-start handled correctly, dedup and stale checks positioned correctly. One pre-existing `gorm.io/datatypes` import in service layer noted but not introduced by this task.

## Known Issues / Technical Debt

- `price_alert_service.go` has a pre-existing `gorm.io/datatypes` import in the service layer (used for `datatypes.JSON` in notification marshalling). This predates this fix. The `task ci:backend-lint` currently passes, confirming the depguard config permits `gorm.io/datatypes` (only `gorm.io/gorm` is banned).

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/domain/service/interfaces.go` | Added `GetFetchCodesByAssetType` to `AssetDisplayConfigService` interface |
| `src/go-backend/domain/service/asset_display_config_service.go` | Implemented `GetFetchCodesByAssetType` |
| `src/go-backend/domain/service/price_alert_service_test.go` | Updated 14 existing tests + added 2 new tests; added mock method |
| `src/go-backend/domain/service/price_alert_service.go` | Replaced `buildEnabledSet` closure and gold/silver loops |
| `src/go-backend/handlers/asset_display_config_test.go` | Added mock stub for new interface method |
| `src/go-backend/handlers/silver_test.go` | Added mock stub for new interface method |
| `src/go-backend/domain/service/market_data_service_bridge_test.go` | Added mock stub for new interface method |
| `docs/architecture/flow-cross-cutting.md` | Updated price alert section with fixed flow, FR-2, FR-3 |

## How to Test

### Unit & Integration Tests

```bash
# Run price alert tests specifically
cd src/go-backend && go test -v -run "TestPriceAlertService" ./domain/service/...
# Expected: 18/18 PASS

# Run full suite
cd src/go-backend && go test -short ./...
# Expected: all PASS, no FAIL

# Run lint
task ci:backend-lint
# Expected: ALL CI CHECKS PASSED
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changed symbols and their callers:
| Changed Symbol | Direct Callers | Tested? |
|---|---|---|
| `AssetDisplayConfigService.GetFetchCodesByAssetType` | `price_alert_service.go::buildEnabledSet` | Yes — 18 price alert tests |
| `buildEnabledSet` (internal closure) | `doCheckAndAlert` | Yes — all price alert tests exercise this |
| `doCheckAndAlert` (gold/silver loop) | `CheckAndAlert`, `ForceCheckAndAlert` | Yes — both entry points covered |

All mock implementations updated in 4 test files — no compile breakage.

### Manual Testing Steps

#### Scenario: Scheduled alert fires after fix (happy path)
**Preconditions:** At least one gold asset display config with a fetch code exists in DB, prices have changed ≥ 2% since last alert
1. Ensure price alert scheduler is running (background job fires every 5 minutes)
2. Wait for a price change ≥ `PRICE_ALERT_GOLD_VND_PCT`% or set a low threshold temporarily
3. Expected: push notification delivered to all subscribed users with gold category movers; `mover.Name` equals `AssetDisplayConfig.DisplayName` (e.g., "Vàng SJC" not "SJC_CODE_A")

#### Scenario: Cold-start / no display configs configured
**Preconditions:** No `asset_display_config` rows in DB
1. Trigger `ForceCheckAndAlert`
2. Expected: job completes silently with log "no enabled configs with fetch codes for gold — skipping (cold-start or unconfigured)"; no notifications sent; no error returned

#### Scenario: DB error on GetFetchCodesByAssetType
**Preconditions:** DB temporarily unavailable
1. Trigger alert check
2. Expected: asset type is skipped with error log; other asset types still processed; no crash

#### Scenario: Multiple fetch codes per display config (dedup)
**Preconditions:** One `AssetDisplayConfig` has 2+ fetch codes, both showing significant price movement
1. Trigger alert check
2. Expected: only 1 mover emitted for that display config (not 2+)

#### Scenario: Mobile viewport
N/A — backend-only fix, no UI changes
