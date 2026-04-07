# Price Alert Symbol/TypeCode Mismatch — Implementation Report

## Metadata

- **Feature:** price-alert-symbol-mismatch
- **Spec file:** docs/specs/2026-04-07-price-alert-symbol-mismatch-spec.md
- **Plan file:** docs/plans/2026-04-07-price-alert-symbol-mismatch-plan.md
- **Started:** 2026-04-07
- **Completed:** 2026-04-07
- **Status:** Complete

## Summary

Fixed two bugs in `UserPriceAlertService` where gold/silver price lookups used `AssetPriceService.GetPriceByTypeCode` (which queries `asset_price.type_code` directly) instead of `AssetDisplayConfigService.ResolvePrice` (the fetch-code bridge). This caused gold/silver alerts to silently fail because user-facing TypeCodes like "SJC Tự Do" don't exist as raw rows in `asset_price` — they only exist as display config TypeCodes mapped to underlying fetch codes.

## Root Cause

The `asset_price` table stores prices keyed by low-level source TypeCodes (e.g. `SJL1L10`, `SJL1C`). The `asset_display_config` table stores user-facing TypeCodes (e.g. "SJC Tự Do") with `asset_config_fetch_code` rows that map them to the underlying `asset_price` rows. Gold/silver alerts were being validated and evaluated against `asset_price.type_code` directly, which never matched the display-layer TypeCodes users actually submit.

## Changes

### Commits

| Commit | Description |
|--------|-------------|
| `d17284fa` | docs(c4): add UserPriceAlertService → AssetDisplayConfigService dependency |
| `17d7665b` | feat(price-alert): add AssetDisplayConfigService dependency to UserPriceAlertService |
| `111f0dc8` | fix(price-alert): replace GetPriceByTypeCode with ResolvePrice for gold/silver alerts |

### Files Modified

| File | Change |
|------|--------|
| `docs/architecture/c4-component-backend.md` | Added `UserPriceAlertService → AssetDisplayConfigService` relationship |
| `domain/service/user_price_alert_service.go` | Added `displayConfigSvc` field; fixed `CreateAlert` + `fetchPricesForAlerts`; added `assetTypeToString` helper |
| `domain/service/services.go` | Wired `assetDisplayConfigSvc` as 4th arg to `NewUserPriceAlertService` |
| `domain/service/user_price_alert_service_test.go` | Updated gold/silver tests to mock `displayConfigSvc.ResolvePrice`; added `mockAlertDisplayConfigSvc`, `newTestAlertServiceWithDisplayConfig` |

## Implementation Details

### Bug 1 — CreateAlert (Task 2)

**Before:** Gold/silver branch called `assetPriceSvc.GetPriceByTypeCode(ctx, symbol)` — silently failed for display TypeCodes.

**After:** Calls `displayConfigSvc.ResolvePrice(ctx, symbol, assetTypeToString(req.AssetType))`. Error from `ResolvePrice` → `apperrors.NewValidationError` (rejects creation). Stale price is non-fatal — alert created with the stale `currentPriceAtCreation` value.

### Bug 2 — fetchPricesForAlerts (Task 3)

**Before:** Gold/silver alerts looked up `assetPriceSvc.GetPriceByTypeCode` per symbol — same TypeCode mismatch.

**After:** Per-alert loop calls `displayConfigSvc.ResolvePrice`. Stale is fatal during evaluation (alert skipped, not triggered). ResolvePrice errors are logged and skipped.

### assetTypeToString helper

Added at end of file following existing converter function pattern:

```go
func assetTypeToString(t v1.InvestmentType) string {
    if gold.IsGoldType(t) {
        return "gold"
    }
    if silver.IsSilverType(t) {
        return "silver"
    }
    return ""
}
```

## Test Coverage

All existing gold/silver `CreateAlert` tests updated to mock `displayConfigSvc.ResolvePrice` instead of `assetPriceSvc.GetPriceByTypeCode`. Key behavior changes verified in tests:

- Stale is non-fatal for creation (price stored, not 0)
- Invalid/unknown TypeCode (`ResolvePrice` returns error) → creation rejected
- Sell-side price correctly returned
- `fetchPricesForAlerts` stale-fatal behavior covered in `EvaluateAlerts` tests

## Verification

- `go build ./...` — clean
- `task ci:backend-lint` — 0 issues
- `task ci:backend` (lint + build + full test suite with DB) — ALL CI CHECKS PASSED
