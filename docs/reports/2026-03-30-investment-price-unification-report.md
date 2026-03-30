# Investment Price Unification — Implementation Report

## Metadata

- **Feature:** investment-price-unification
- **Branch:** feat/investment-price-unification
- **Plan file:** docs/plans/2026-03-30-investment-price-unification-plan.md
- **Spec file:** docs/specs/2026-03-30-investment-price-unification-spec.md
- **Progress file:** docs/reports/2026-03-30-investment-price-unification-progress.md
- **Started:** 2026-03-30
- **Completed:** 2026-03-30
- **Status:** Done — all 11 tasks complete

---

## Summary

Replaced static gold and silver VND type registries (`pkg/gold/GoldTypes`, `pkg/silver/SilverTypes`) with admin-controlled `asset_display_config` DB queries via `AssetDisplayConfigService.ListForInvestment()`. All VND investment type dropdowns (investment creation, watchlist, price alerts) now read from the database; USD types remain hardcoded. The admin panel controls which VND types appear and in what order — no code deployment needed to add or remove a gold/silver brand.

---

## Tasks Completed

| # | Task | Status | Key Changes |
|---|------|--------|-------------|
| 0 | Update C4 Architecture Diagrams | done | c4-component-backend + c4-component-frontend updated with ListForInvestment relationship |
| 1 | Add ListForInvestment Method to Service + Repository | done | New method on `AssetDisplayConfigRepository` and `AssetDisplayConfigService` interface |
| 2 | Refactor Gold Handler to Read VND Types from DB | done | `GoldHandler` injects `AssetDisplayConfigService`; VND→DB, USD→static, 5 tests |
| 3 | Refactor Silver Handler to Read VND Types from DB | done | `SilverHandler` same pattern, 9 tests |
| 4 | Remove VND Entries from Static Registries | done | `GoldTypes`/`SilverTypes` USD-only; `AliasToCanonical` removed |
| 5 | Seed Migration — Silver show_in_investment = true | done | `cmd/migrate-silver-show-in-investment/main.go` + Taskfile entry |
| 6 | Frontend — Silver Investment Form Reads from Admin Config API | done | `silverDisplayPricesQuery` + `inferSilverUnits()` in AddInvestmentForm, 12 tests |
| 7 | Frontend — Remove Hardcoded VND Option Arrays | done | `GOLD/SILVER_VND_OPTIONS` de-exported; `getXTypeOptions("VND")` returns `[]` |
| 8 | Frontend — Watchlist and Price Alert Forms Use Admin Config | done | `useQueryGetAssetDisplayPrices` in AddToWatchlistForm + CreatePriceAlertForm, 14 tests |
| 9 | Backend Lint + Frontend Lint + Full Build Verification | done | golangci-lint 0 issues, go build clean, all Go tests pass, tsc clean |
| 10 | Create/Update Runtime Flow Diagrams | done | flow-investment.md section 11 added |

---

## Backend Changes

### New Method: `ListForInvestment`

**`domain/repository/asset_display_config_repository.go`**
```go
func (r *assetDisplayConfigRepository) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    var configs []*models.AssetDisplayConfig
    result := r.db.DB.WithContext(ctx).
        Where("asset_type = ? AND enabled = ? AND show_in_investment = ?", assetType, true, true).
        Order("display_order ASC").
        Find(&configs)
    // ...
}
```

**`domain/service/interfaces.go`** — added to `AssetDisplayConfigService` interface:
```go
ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
```

### Refactored Gold Handler

`handlers/gold.go` — `GoldHandler` now injects `AssetDisplayConfigService`:
- `currency=VND` → `ListForInvestment(ctx, "gold")` → mapped to `goldTypeResponse`
- `currency=USD` → static `GetGoldTypesByCurrency("USD")` (only `XAUUSD`)
- `currency=""` → merged (VND from DB + USD static)
- any other value → `400 Bad Request`

### Refactored Silver Handler

`handlers/silver.go` — identical pattern to gold:
- `currency=VND` → `ListForInvestment(ctx, "silver")`
- Type value: `10` (`INVESTMENT_TYPE_SILVER_VND`)
- 9 tests including SQL injection guard via URL-encoded currency param

### Static Registry Cleanup

- `pkg/gold/types.go`: `GoldTypes` array → USD-only (`XAUUSD`); `AliasToCanonical` map removed
- `pkg/silver/types.go`: `SilverTypes` array → USD-only (`XAGUSD`)
- Internal `GOLD_VND_OPTIONS` slice retained in `types.go` (needed by `GetGoldTypeByCode` for existing investment symbol lookup)

### Silver Seed Migration

- `cmd/migrate-silver-show-in-investment/main.go` — idempotent `UPDATE asset_display_config SET show_in_investment = true WHERE asset_type = 'silver'`
- `Taskfile.yml` — task `backend:migrate-silver-show-in-investment`

---

## Frontend Changes

### AddInvestmentForm (Task 6)

- Added `silverDisplayPricesQuery = useQueryGetAssetDisplayPrices({ assetType: "silver" }, { enabled: isSilverInvestment })`
- Added `inferSilverUnits(typeCode)` — maps `KG` suffix → `["kg"]`, `L`/tael → `["tael"]`, default → `["tael"]`
- `silverTypeOptions` useMemo: API VND types + static `SILVER_USD_OPTIONS`

### getGoldTypeOptions / getSilverTypeOptions (Task 7)

- `features/investment/utils/gold-calculator.ts`: `GOLD_VND_OPTIONS` unexported; `getGoldTypeOptions("VND")` returns `[]`
- `features/investment/utils/silver-calculator.ts`: `SILVER_VND_OPTIONS` unexported; `getSilverTypeOptions("VND")` returns `[]`

### AddToWatchlistForm (Task 8)

- Replaced hardcoded `GOLD/SILVER_VND_OPTIONS` with `useQueryGetAssetDisplayPrices` hooks
- Loading state on dropdowns while fetch is in flight
- 14 tests: API hook calls, loading, empty response fallback, category switching

### CreatePriceAlertForm (Task 8)

- Replaced static `GOLD/SILVER_VND_ALERT_OPTIONS` with API-driven options
- `useRef` one-shot init pattern prevents infinite re-render loop when options change
- Zod validation changed from static symbol allowlist to format-only (non-empty, max 50 chars)

---

## Architecture Impact

- `flow-investment.md` — added section 11: "Gold/Silver VND Investment Type Selection (Admin Config–Driven)"
  - Sequence diagram: SPA → GoldHandler/SilverHandler → AssetDisplayConfigService → DB
  - Key invariants, frontend integration table, error paths
- `c4-component-backend.md` — added `Rel(price_h, gold_display_config_svc, "GoldHandler + SilverHandler read VND type lists via ListForInvestment()")`
- `c4-component-frontend.md` — updated `invest_feat` description: silver VND dropdown API-driven

---

## Test Coverage

| Area | Tests Added |
|------|------------|
| `handlers/gold_test.go` | 5 (VND/USD/merged/bad-currency/service-error) |
| `handlers/silver_test.go` | 9 (VND/USD/merged/bad-currency/service-error/SQL-injection) |
| `pkg/gold/types_test.go` | 5 (existing; updated VND→nil assertions) |
| `AddInvestmentForm` (frontend) | 12 |
| `AddToWatchlistForm` (frontend) | 14 (new) |
| `CreatePriceAlertForm` (frontend) | Updated for API-driven options |
| `price-alert-validation` (frontend) | Updated for format-only Zod schema |

---

## Spec Deviations

| Deviation | Reason |
|-----------|--------|
| No new seed migration for gold display configs | DB already had gold configs correctly; only silver needed `show_in_investment = true` update |
| Internal `GOLD_VND_OPTIONS` slice not deleted | Still required by `GetGoldTypeByCode()` for existing investment symbol lookups from DB |

---

## CI Result

| Check | Result |
|-------|--------|
| `golangci-lint` | 0 issues |
| `go build ./...` | Clean |
| `go test -short ./...` | All pass |
| `tsc --noEmit` | Clean |
| `npm run lint` | 1 pre-existing error in `FilterableAutocomplete.tsx` (not from this feature) |
