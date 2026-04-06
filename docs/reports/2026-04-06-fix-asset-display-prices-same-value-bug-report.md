# Fix Asset Display Prices Same-Value Bug — Implementation Report

## Summary

Fixed a query parameter naming mismatch that caused the silver and currency price tables on the home dashboard to always display gold prices. The generated TypeScript API client converts camelCase query params to snake_case via `toQueryParams()`, sending `?asset_type=silver` instead of `?assetType=silver`. The three `AssetDisplayConfigHandler` methods only read `c.Query("assetType")`, so the param was always empty and defaulted to `"gold"`. Applied the same camelCase+snake_case dual-read fallback pattern already used in `handlers/investment.go` to all three affected handler methods.

## Spec Reference

`docs/specs/2026-04-06-fix-asset-display-prices-same-value-bug-spec.md`

## Plan Reference

`docs/plans/2026-04-06-fix-asset-display-prices-same-value-bug-plan.md`

## Tasks Completed

| #   | Task                                                    | Status | Files Changed                          | Tests    | TDD |
| --- | ------------------------------------------------------- | ------ | -------------------------------------- | -------- | --- |
| 1   | Fix GetDisplayPrices handler — add snake_case fallback  | Done   | asset_display_config.go, _test.go      | 2 new, all pass | Yes |
| 2   | Fix ListAll handler — add snake_case fallback           | Done   | asset_display_config.go, _test.go      | 1 new, all pass | Yes |
| 3   | Fix ListAvailableTypeCodes handler — snake_case fallback | Done  | asset_display_config.go, _test.go      | 1 new, all pass | Yes |
| 4   | Full verification                                       | Done   | progress.md                            | 102 pass | N/A |

## Test Coverage Summary

| Layer           | Test File                                               | Tests Added | Pass   | Coverage Area                                          |
| --------------- | ------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------ |
| Backend Handler | `src/go-backend/handlers/asset_display_config_test.go`  | 4 new       | 4/4    | snake_case asset_type param reaches service as correct value |

**Total handler suite:** 102 passing, 0 failing (all pre-existing tests unchanged).

## Security Implementation Summary

| Concern          | Implementation                                                | Verified |
| ---------------- | ------------------------------------------------------------- | -------- |
| Injection        | `assetType` passed to GORM parameterized query — unchanged    | Yes      |
| Authorization    | `GetDisplayPrices` public; `ListAll` + `ListAvailableTypeCodes` behind `AdminMiddleware` — unchanged | Yes |
| Input validation | Unknown `asset_type` values return empty `[]` gracefully — unchanged | Yes |
| Data exposure    | No new fields exposed; error format unchanged                 | Yes |

## Review Results

### Spec Compliance

All three reviewers returned PASS on spec compliance:
- `GetDisplayPrices`, `ListAll`, `ListAvailableTypeCodes` all implement the exact three-step fallback (camelCase → snake_case → default `"gold"`)
- Each task's fix was scoped precisely to its handler — no accidental cross-contamination
- All 4 new tests verify the snake_case param reaches the service as the correct value (not just HTTP 200)

### Security Review

All three reviewers returned APPROVED:
- No SQL concatenation — `assetType` string flows through to GORM parameterized `WHERE asset_type = ?` unchanged
- No new auth bypass — middleware chains untouched
- No sensitive data leakage — response shapes unchanged

### Code Quality

All three reviewers returned APPROVED:
- Pattern is consistent with `handlers/investment.go` (walletId/wallet_id, typeFilter/type_filter)
- Explanatory comments on each fallback line: `// Fallback: generated client sends snake_case`
- Tests use captured-variable pattern to assert the service receives the correct value (behavioral, not just HTTP status)
- No dead code, no over-engineering

## Known Issues / Technical Debt

None. The fix is minimal and scoped to the handler query-param read layer only.

**Out of scope (documented in spec):**
- Secondary bug in `AssetDisplayConfigService.Create`: uses `GetByTypeCode(ctx, typeCode)` without `asset_type` filter, preventing creation of same TypeCode for different asset types even though the DB composite unique index allows it. Not part of this bug report.
- Auditing other handlers for the same snake_case issue — only these three are confirmed affected.

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/handlers/asset_display_config.go` | Added snake_case fallback in `GetDisplayPrices`, `ListAll`, `ListAvailableTypeCodes` (3 × 2 lines each) |
| `src/go-backend/handlers/asset_display_config_test.go` | Added 4 new test functions |
| `docs/reports/2026-04-06-fix-asset-display-prices-same-value-bug-progress.md` | Created (implementation progress tracking) |
| `docs/obsidian/Kanban Board.md` | Moved task to Implement column |
| `docs/obsidian/2026-04-06-fix-asset-display-prices-same-value-bug.md` | Updated status and artifact links |

**Commit:** `ec8a64fd` — `fix(handlers): accept snake_case asset_type query param in asset display config handlers`

## How to Test

### Unit & Integration Tests

```bash
cd src/go-backend && go test ./handlers/ -v -run TestGetDisplayPrices_SnakeCaseAssetType
cd src/go-backend && go test ./handlers/ -v -run TestListAll_SnakeCaseAssetTypeParam
cd src/go-backend && go test ./handlers/ -v -run TestListAvailableTypeCodes_SnakeCaseAssetTypeParam
cd src/go-backend && go test ./handlers/   # full suite — should be 102 pass, 0 fail
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed.

Only query-param reading in handler methods was changed. Service, repository, model, proto, and frontend layers are untouched. The only callers of these three handler methods are the route registrations in `handlers/routes.go` (unchanged). Impact is limited to the three handler methods.

### Manual Testing Steps

**Preconditions:** Backend running locally on port 5000, asset display config populated with silver and currency configs.

#### Scenario: Silver prices display correctly

1. `curl "http://localhost:5000/api/v1/public/asset-display-prices?asset_type=silver"`
2. Expected: response contains `prices` array with silver type codes (e.g., `PH_QU_THI_1L`), NOT gold codes (e.g., `SJC`)

#### Scenario: Currency prices display correctly

1. `curl "http://localhost:5000/api/v1/public/asset-display-prices?asset_type=currency"`
2. Expected: response contains `prices` array with currency type codes (e.g., `USD`), NOT gold codes

#### Scenario: camelCase param still works (backward compat)

1. `curl "http://localhost:5000/api/v1/public/asset-display-prices?assetType=silver"`
2. Expected: same silver prices as above

#### Scenario: No param defaults to gold

1. `curl "http://localhost:5000/api/v1/public/asset-display-prices"`
2. Expected: gold prices (default behavior unchanged)

#### Scenario: Home dashboard (end-to-end)

**Preconditions:** Logged in as any user.
1. Navigate to `/dashboard/home`
2. Silver Price Table → Expected: shows silver prices (was showing gold prices before fix)
3. Currency Price Table → Expected: shows exchange rates (was showing gold prices before fix)
