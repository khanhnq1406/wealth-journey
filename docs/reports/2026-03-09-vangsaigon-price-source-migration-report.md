# vangsaigon.vn Price Source Migration — Implementation Report

## Summary

Fixed broken gold and silver price fetching by:
1. Migrating the price source URL from the dead `vang247.vn` API to `vangsaigon.vn`
2. Renaming the `vang247` package to `vnprice` for vendor independence
3. Updating the C4 architecture diagram to reflect the new source

## Spec Reference

`docs/specs/2026-03-09-vangsaigon-price-source-migration-spec.md`

## Plan Reference

`docs/plans/2026-03-09-vangsaigon-price-source-migration-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests |
|---|------|--------|---------------|-------|
| 1 | Change BaseURL constant to vangsaigon.vn | Done | `pkg/vnprice/client.go` | TestClient_FetchPrices PASS |
| 2 | Rename package vang247 → vnprice | Done | `pkg/vnprice/` (renamed), `gold_price_service.go`, `silver_price_service.go` | Build PASS; TestClient_FetchPrices PASS |
| 3 | Update C4 architecture diagram | Done | `docs/architecture/c4-component-backend.md` | N/A (docs only) |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| HTTPS enforced | No change — existing `https://` URL scheme retained | Yes |
| No auth token exposure | No credentials in outbound requests | Yes |
| Price data is display-only | No downstream financial operations triggered | Yes |

## Review Results

### Spec Compliance

All FR-1 and FR-2 acceptance criteria met:
- `BaseURL` points to `vangsaigon.vn` ✓
- `TestClient_FetchPrices` passes — gold prices non-empty, silver prices non-empty, XAUUSD present ✓
- Package renamed `vang247` → `vnprice`, all imports updated ✓
- No JSON parsing logic changes (identical response structure) ✓

### Security Review

No security changes introduced. HTTPS retained. No credentials added. Price data remains display-only.

### Code Quality

Pure refactor — no logic changes, no new abstractions. Comments referencing "vang247" remain in service files (e.g., doc comments like "GoldPriceService handles fetching gold prices from vang247") — these are cosmetic and left as-is to keep the diff minimal per the plan scope.

## Known Issues / Technical Debt

- Service doc comments (`// GoldPriceService handles fetching gold prices from vang247`) still mention `vang247` — minor cosmetic issue, out of scope per plan
- `vangsaigon.vn` carries the same availability risk as `vang247.vn` — long-term, consider multi-source resilience (tracked in spec)

## Files Changed

| File | Change |
|------|--------|
| `src/go-backend/pkg/vnprice/client.go` | Renamed from `pkg/vang247/`; updated `BaseURL` constant and `package` declaration |
| `src/go-backend/pkg/vnprice/types.go` | Renamed; updated `package` declaration |
| `src/go-backend/pkg/vnprice/client_test.go` | Renamed; updated `package` declaration |
| `src/go-backend/domain/service/gold_price_service.go` | Updated import `vang247` → `vnprice`; updated struct field and constructor call |
| `src/go-backend/domain/service/silver_price_service.go` | Updated import `vang247` → `vnprice`; updated struct field and constructor call |
| `docs/architecture/c4-component-backend.md` | Updated component label, trust boundary comment, and data flow description |

## Commits

| Hash | Message |
|------|---------|
| `eb43d21` | fix(prices): migrate price source from vang247.vn to vangsaigon.vn |
| `cc69add` | refactor(prices): rename vang247 package to vnprice for vendor independence |
| `fe837c2` | docs(architecture): update C4 diagram to reflect vnprice/vangsaigon.vn migration |

## How to Test

```bash
# Verify test passes with live API
cd src/go-backend && go test ./pkg/vnprice/... -v -timeout 15s

# Verify build compiles
cd src/go-backend && go build ./pkg/vnprice/... ./domain/service/... ./handlers/...

# Manual: start the backend and hit the prices endpoint
# GET /api/v1/investments/market-prices
# Should return gold and silver prices from vangsaigon.vn
```
