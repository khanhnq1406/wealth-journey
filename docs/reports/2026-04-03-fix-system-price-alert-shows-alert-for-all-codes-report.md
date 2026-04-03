# Fix: System Price Alert Shows Alert for All Codes — Implementation Report

## Summary

Fixed a bug where `priceAlertService.doCheckAndAlert` evaluated price alerts for ALL asset type codes regardless of whether the admin had enabled them in `asset_display_config`. The fix injects `AssetDisplayConfigService` into `priceAlertService` and calls `ListAll(assetType)` before each price evaluation loop to build an in-memory enabled-codes set. Only prices whose TypeCode appears in that set (and has `Enabled: true`) are evaluated. Codes absent from config or explicitly disabled are silently skipped.

## Spec Reference

`docs/specs/2026-04-03-fix-system-price-alert-shows-alert-for-all-codes-spec.md`

## Plan Reference

`docs/plans/2026-04-03-fix-system-price-alert-shows-alert-for-all-codes-plan.md`

## Tasks Completed

| #   | Task                                                      | Status | Files Changed                                                        | Tests       | TDD |
| --- | --------------------------------------------------------- | ------ | -------------------------------------------------------------------- | ----------- | --- |
| 1   | Inject AssetDisplayConfigService into priceAlertService   | Done   | price_alert_service.go, services.go, price_alert_service_test.go    | 13/13 pass  | Yes |
| 2   | Implement enabled-code filter in doCheckAndAlert          | Done   | price_alert_service.go, price_alert_service_test.go                  | 16/16 pass  | Yes |
| 4   | Update existing tests to wire configSvc mock              | Done   | price_alert_service_test.go (covered in Task 2)                      | 16/16 pass  | Yes |
| 3   | Update C4 + runtime flow diagrams                        | Done   | c4-component-backend.md, flow-cross-cutting.md                       | N/A (docs)  | N/A |

## Test Coverage Summary

| Layer           | Test File                        | Tests | Pass  | Coverage Area                                            |
| --------------- | -------------------------------- | ----- | ----- | -------------------------------------------------------- |
| Backend Service | `price_alert_service_test.go`    | 16    | 16/16 | Filter logic, error skip, empty config, existing behavior |

**New tests (Task 2):**

| Test | Behavior Verified |
|------|-------------------|
| `TestPriceAlertService_DisabledCodeExcluded` | TypeCode absent from config never gets baseline set |
| `TestPriceAlertService_ConfigSvcError_SkipsAssetType` | `ListAll` error → asset type skipped, no panic, no BatchCreate |
| `TestPriceAlertService_EmptyConfig_NoAlerts` | Empty config → no prices pass filter → no alerts |

## Security Implementation Summary

| Concern          | Implementation                                                        | Verified |
| ---------------- | --------------------------------------------------------------------- | -------- |
| Input validation | N/A — scheduler job, no user input                                    | N/A      |
| Authorization    | N/A — internal service-to-service call only                           | N/A      |
| Injection risk   | `assetType` passed to `ListAll` is hardcoded literal, not user input  | Yes      |
| Data integrity   | In-memory map filter, no monetary arithmetic introduced               | Yes      |
| Error handling   | `ListAll` error → graceful skip via `goto`, returns `nil` to caller   | Yes      |

## Review Results

### Spec Compliance

All requirements met. Filter applied before price loops for both gold and silver. Error from `ListAll` causes graceful skip. Empty config results in no alerts (safer cold-start posture than previous behavior). All 3 new tests verified the required edge cases.

### Security Review

No security concerns. All `assetType` values are hardcoded literals. No user input flows into the filter path. `log.Printf` only logs asset type name and error value — no internal DB details.

### Code Quality

`buildEnabledSet` closure is idiomatic Go (result + ok pattern). `goto` usage is safe (no variable declaration skips) and justified to avoid deep nesting. Architecture diagrams updated consistently with existing styles.

## Known Issues / Technical Debt

None. The fix is minimal and targeted — no schema changes, no API changes, no frontend changes.

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/domain/service/price_alert_service.go` | Added `configSvc` field; updated constructor; added `buildEnabledSet` + filter in `doCheckAndAlert` |
| `src/go-backend/domain/service/services.go` | Updated `NewPriceAlertService` call to pass `assetDisplayConfigSvc` |
| `src/go-backend/domain/service/price_alert_service_test.go` | Added `mockPAConfigSvc`; updated helper + all test call sites; added 3 new tests |
| `docs/architecture/c4-component-backend.md` | Added `PriceAlertService → AssetDisplayConfigService` dependency arrow |
| `docs/architecture/flow-cross-cutting.md` | Added `ListAll` call + filter step in price alert sequence diagram |

## Commits

| Commit     | Message |
|------------|---------|
| `1907bbe0` | fix(price-alert): inject AssetDisplayConfigService into priceAlertService constructor |
| `7da688f3` | fix(price-alert): filter alert evaluation to admin-enabled type codes only |
| `c7580d96` | docs(architecture): update C4 + flow diagrams for price alert config filter |

## How to Test

### Unit & Integration Tests

```bash
cd src/go-backend && go test -short -count=1 ./domain/service/... -run "TestPriceAlertService" -v
# Expected: 16/16 PASS

cd src/go-backend && go test -short ./...
# Expected: all packages pass

cd src/go-backend && task ci:backend-lint
# Expected: 0 issues, ALL CI CHECKS PASSED
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Changed symbols: `NewPriceAlertService` (constructor signature), `priceAlertService.doCheckAndAlert` (behavior).

Callers of `NewPriceAlertService`:
- `src/go-backend/domain/service/services.go` — updated ✓
- `src/go-backend/domain/service/price_alert_service_test.go` — updated ✓

No other callers exist. `doCheckAndAlert` is a private method called only from `CheckAndAlert` and `ForceCheckAndAlert`, both of which are tested.

### Manual Testing Steps

#### Scenario: Enabled type code fires alert normally

**Preconditions:** Admin has `asset_display_config` row for `SJC_1L` with `enabled=true`. Gold price for `SJC_1L` has changed >threshold since last run.

1. Wait for the price alert scheduler job to run (or trigger `ForceCheckAndAlert` via the API).
2. Expected: Alert notification is sent for `SJC_1L`.

#### Scenario: Disabled type code does NOT fire alert

**Preconditions:** Admin has `asset_display_config` row for `SJC_RING` with `enabled=false` (or no row exists for it at all).

1. Wait for the price alert scheduler job to run.
2. Expected: No alert fired for `SJC_RING`, regardless of price movement.

#### Scenario: Empty config (cold start)

**Preconditions:** `asset_display_config` table is empty.

1. Run the price alert job.
2. Expected: No alerts fire. Log shows "no enabled configs for gold/silver — skipping".

#### Scenario: Config service DB error

**Preconditions:** DB is temporarily unavailable when the job runs.

1. Run the price alert job.
2. Expected: Job completes without panic. Log shows "failed to fetch gold/silver display configs". No partial alerts fired.
