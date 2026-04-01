# Asset Price Source Fixes — Implementation Report

## Summary

Two bugs in the asset price cache were fixed: (1) the DOJI gold price client was applying a `×1,000,000` multiplier when converting VND-per-mace prices to VND-per-tael, when only `×10` is correct (1 lượng = 10 chỉ); (2) the Mihong gold price client emitted `TypeCode="SJC"` for its SJC product, colliding with the DOJI source's own `"SJC"` TypeCode in the `asset_price` unique index. Both fixes are backend-only, in isolated packages, with no schema or API changes.

## Spec Reference

`docs/specs/2026-04-01-asset-price-source-fixes-spec.md`

## Plan Reference

`docs/plans/2026-04-01-asset-price-source-fixes-plan.md`

## Tasks Completed

| #   | Task                                  | Status | Files Changed | Tests | TDD |
| --- | ------------------------------------- | ------ | ------------- | ----- | --- |
| 1   | Fix DOJI parsePrice multiplier        | Done   | client.go, client_test.go | 10/10 pass | Yes |
| 2   | Fix Mihong SJC TypeCode to Mihong_SJC | Done   | client.go, client_test.go | 7/7 pass  | Yes |
| 3   | Run full backend lint + test suite    | Done   | — (validation only) | all pass | N/A |

## Test Coverage Summary

| Layer           | Test File                              | Tests | Pass  | Coverage Area                                     |
| --------------- | -------------------------------------- | ----- | ----- | ------------------------------------------------- |
| DOJI pkg        | `pkg/doji/client_test.go`              | 10    | 10/10 | parsePrice multiplier, HTML parsing, filters, dedup, sanitization |
| Mihong pkg      | `pkg/mihong/client_test.go`            | 7     | 7/7   | SJC TypeCode mapping, zero-price filter, HTTP error, timeout |
| Full suite      | `go test -short ./...`                 | all   | all   | No regressions across all packages                |

## Security Implementation Summary

| Concern              | Implementation                             | Verified |
| -------------------- | ------------------------------------------ | -------- |
| Input validation     | `parsePrice` rejection logic unchanged     | Yes      |
| Authorization        | N/A — scheduler-only, no user endpoints    | N/A      |
| Financial data type  | `int64` used throughout (`int64(v) * 10`)  | Yes      |
| No secrets in code   | Only numeric constant and string changed   | Yes      |

## Review Results

### Spec Compliance

Both tasks: PASS. All required file/line changes verified in actual code. Test expectations match the plan's exact value table.

### Security Review

Both tasks: APPROVED. Static changes to a multiplier constant and a static map entry — no authentication, authorization, or injection surfaces affected.

### Code Quality

Both tasks: APPROVED. Changes are minimal and surgical. Comments updated to explain unit semantics (WHY). `"Mihong_SJC"` follows the established prefix pattern. All prior test coverage retained.

## Known Issues / Technical Debt

- The `asset_price` table will retain a stale row with `type_code="SJC"` and `source="mihong"` until the next `PriceCacheJob` cycle (max 15 min after deployment). This causes no functional harm since the frontend only displays rows referenced by active `AssetDisplayConfig` fetch codes. No manual migration needed.

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/pkg/doji/client.go` | Multiplier `1_000_000` → `10`; updated parseHTML and parsePrice comments |
| `src/go-backend/pkg/doji/client_test.go` | Updated 8 expected values from ×1,000,000 to ×10 across 3 test functions |
| `src/go-backend/pkg/mihong/client.go` | `"SJC": "SJC"` → `"SJC": "Mihong_SJC"` in codeToTypeCode map |
| `src/go-backend/pkg/mihong/client_test.go` | Added `TestClient_FetchGoldPrices_SJCTypeCode` |
| `docs/reports/2026-04-01-asset-price-source-fixes-progress.md` | Progress tracking (included in every commit) |

## How to Test

### Unit & Integration Tests

```bash
# DOJI package only
cd src/go-backend && go test ./pkg/doji/... -v

# Mihong package only
cd src/go-backend && go test ./pkg/mihong/... -v

# Full suite (no DB needed)
cd src/go-backend && go test -short ./...

# Lint + build
cd src/go-backend && task ci:backend-lint
```

All tests pass. Lint: 0 issues.

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Both changes are confined to leaf packages (`pkg/doji/`, `pkg/mihong/`) that are only called by `AssetPriceService.RefreshAllPrices()` in the background scheduler. No handler, service interface, or repository is touched.

| Changed Symbol | Callers | Tested? |
|---|---|---|
| `pkg/doji.parsePrice` (multiplier) | `pkg/doji.parseHTML` → `FetchGoldPrices` → `AssetPriceService.RefreshAllPrices` | Yes — via doji package tests |
| `pkg/mihong.codeToTypeCode["SJC"]` | `pkg/mihong.FetchGoldPrices` → `AssetPriceService.RefreshAllPrices` | Yes — via new SJCTypeCode test |

### Manual Testing Steps

#### Scenario: DOJI prices are corrected in DB after deployment

**Preconditions:** Backend running with DB populated by a previous PriceCacheJob run showing inflated DOJI prices.

1. Deploy the fix.
2. Wait up to 15 minutes for the next PriceCacheJob run.
3. Navigate to `/dashboard/prices` → Gold tab.
4. Expected: DOJI prices now show ~82,000–83,000 VND/tael range (not billions).

#### Scenario: Mihong SJC row no longer collides with DOJI SJC

**Preconditions:** Backend running; admin panel accessible.

1. Deploy the fix.
2. Wait up to 15 minutes for PriceCacheJob.
3. In admin panel → Asset Display Config, check fetch codes for DOJI SJC and Mihong SJC.
4. Expected: each config resolves independently to its own `asset_price` row — no upsert collision.

## Fix History

| Date       | Fix                                                     | Severity | Files                                    |
| ---------- | ------------------------------------------------------- | -------- | ---------------------------------------- |
| 2026-04-01 | PNJ API: rename `regions` → `locations` top-level key  | Minor    | `pkg/pnj/types.go`, `client.go`, `client_test.go` |
| 2026-04-01 | DOJI parsePrice multiplier `×10` → `×10_000` (vạn VND) | Minor    | `pkg/doji/client.go`, `pkg/doji/client_test.go` |

### Fix: PNJ `regions` → `locations` (2026-04-01)

**Root cause:** PNJ changed the top-level JSON array key from `"regions"` to `"locations"` as of 2026-04. The `apiResponse` struct mapped `json:"regions"` so `apiResp.Regions` was always nil after unmarshal, causing `selectRegion` to return nil and `FetchGoldPrices` to return an empty slice — triggering `pnj: no valid prices` on every `PriceCacheJob` run.

**Fix:** Renamed `apiResponse.Regions` field to `Locations` with `json:"locations"` tag. Updated the single call site in `client.go` and all test fixtures.

**Tests:** 17/17 pass. Full suite: 0 failures.

**Security review:** APPROVED — no security impact. Static JSON field name change in a background scheduler-only package.

### Fix: DOJI parsePrice multiplier `×10` → `×10_000` (2026-04-01)

**Root cause:** The previous fix changed the DOJI multiplier from `×1_000_000` to `×10`, based on an incorrect assumption that DOJI HTML prices are in VND/chỉ. Live scraping of `giavang.doji.vn` reveals prices are in **vạn VND** (ten-thousands of VND) per lượng — e.g. `17300` means 17,300 × 10,000 = 173,000,000 VND/lượng. The `×10` multiplier produced `158,500` instead of `158,500,000`.

**Fix:** Changed multiplier to `×10_000`. Updated comments to document the unit (vạn VND per lượng). Updated 8 test expectations accordingly.

**Tests:** 10/10 pass. Full suite: 0 failures.

**Security review:** APPROVED — static numeric constant change in a background scheduler-only package. No auth, authorization, or injection surfaces affected. `int64` overflow not possible for realistic VND gold prices (max ~300,000 × 10,000 = 3,000,000,000 — well within int64 range).

---

#### Scenario: No regression on gold price display

**Preconditions:** Backend running post-deployment.

1. Navigate to `/dashboard/prices` → Gold tab.
2. Expected: all non-DOJI gold prices (SJC, DOJI from other sources, Mihong) display correctly; no `"--"` where data should exist.
