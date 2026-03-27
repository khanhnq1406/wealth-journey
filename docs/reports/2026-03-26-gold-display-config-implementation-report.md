# Gold Display Config — Implementation Report

**Feature:** Gold Display Configuration
**Branch:** `feat/price-fallback`
**Date:** 2026-03-26
**Status:** Complete

---

## Summary

Replaced hardcoded gold type display constants in the frontend (`gold-filter.ts`, `GOLD_TABLE_FILTER`, `filterGoldPrices`) with a backend-managed `gold_display_config` database table. Admins can now configure which gold types appear in price tables and investment dropdowns without a frontend deployment. All three frontend consumers — the home dashboard price table, the landing page teaser table, and the investment gold type dropdown — now fetch display configuration from the new public API endpoint.

---

## Commits

| # | Commit | Task | Description |
|---|--------|------|-------------|
| 1 | `ba5b7cb` | 0 | C4 architecture diagrams updated |
| 2 | `5ad8313` | 1 | Proto definitions — 11 new messages |
| 3 | `fc15ebb` | 2 | GORM model, migration command, seed data |
| 4 | `dc2ac57` | 3 | Repository layer — 7 methods |
| 5 | `ed7f357` | 4 | Service layer — price join, CRUD, 16 tests |
| 6 | `4d4f5e3` | 5 | Handler + routes — 5 methods, 14 tests |
| 7 | `0371992` | 6–9 | All frontend consumers migrated |
| 8 | `6d66ba0` | 10 | Deleted dead `gold-filter.ts` |
| 9 | `a0c6b2c` | 11 | Runtime flow diagrams (sections 14–15) |

**Total:** 9 commits, 36 files changed, +6,283 / −585 lines

---

## Architecture

### New Backend Components

```
gold_display_config (DB table)
        │
        ▼
GoldDisplayConfigRepository     ← repository/gold_display_config_repository.go
  - ListAll(ctx)                   Returns all rows (including disabled), ordered by display_order
  - ListEnabled(ctx)               Returns only enabled rows — used by public endpoint
  - GetByID(ctx, id)               Returns single row or NotFoundError
  - GetByTypeCode(ctx, typeCode)   Returns nil (not error) if absent — used for duplicate check
  - Create(ctx, cfg)
  - Update(ctx, cfg)
  - Delete(ctx, id)               GORM soft delete via DeletedAt
        │
        ▼
GoldDisplayConfigService        ← domain/service/gold_display_config_service.go
  - GetDisplayPrices(ctx)          ListEnabled + join with AssetPriceService.GetPricesByAssetType("gold")
  - ListAll(ctx)                   Pass-through to repo
  - Create(...)                    Validates typeCode ≤50, displayName trimmed ≤100, order ≥0, no duplicate
  - Update(...)                    Validates displayName/order, fetches+saves
  - Delete(...)                    Delegates to repo
        │
        ▼
GoldDisplayConfigHandler        ← handlers/gold_display_config.go
  GET  /api/v1/public/gold-display-prices       → GetDisplayPrices (public, no auth)
  GET  /api/v1/admin/gold-display-config        → ListAll  (JWT + admin role)
  POST /api/v1/admin/gold-display-config        → Create
  PUT  /api/v1/admin/gold-display-config/:id    → Update
  DELETE /api/v1/admin/gold-display-config/:id  → Delete
```

### Price Override Integration

The handler applies Redis price overrides on top of the service response, identical to the pattern used in `market_prices.go`:

```
service result (DB prices)
    +
PriceOverrideCache.GetAll(ctx)  [Redis, graceful skip if nil]
    ↓
key: typeCode + ":" + currency
    ↓
Override buy/sell if present → final response
```

Override cache is `nil`-safe — no Redis means no overrides, not an error.

### Frontend Hook

Added to `utils/generated/hooks.ts` and `utils/generated/api.ts`:

```typescript
useQueryGetGoldDisplayPrices(options?)
// → GET /api/v1/public/gold-display-prices
// → data?.prices: GoldDisplayPrice[]
// Each item: typeCode, displayName, buy, sell, currency, updatedAt, isStale,
//            showInInvestment, displayOrder, changeBuy, changeSell
```

---

## Consumer Changes

### Task 6 — Home Dashboard GoldPriceTable

**File:** `app/[locale]/dashboard/home/GoldPriceTable.tsx`

- Component is now self-fetching — no props from parent
- Removed `filterGoldPrices` import
- `data?.prices ?? []` as table source; display order from backend
- `item.isStale ? "--" : formatPriceValue(item.buy, ...)` for stale handling
- Buy column: `text-v2-red-negative` | Sell column: `text-v2-green-positive`
- Parent `page.tsx` no longer manages gold price variables

### Task 7 — Landing Page LandingGoldPriceTable

**File:** `components/landing/LandingGoldPriceTable.tsx`

- Removed `GOLD_TABLE_FILTER` import
- `useQueryGetGoldDisplayPrices()` hook
- Preserves "Login to view prices" masking (buy/sell cells show `loginPrompt` rich text)
- Masked cells use `text-v2-text-secondary` (removed hardcoded `text-green-700`)
- `updatedTime` derived from first price entry with `updatedAt > 0`

### Task 8 — Investment Form Gold Dropdown

**File:** `features/investment/forms/AddInvestmentForm.tsx`

- Replaces `GOLD_VND_OPTIONS` constant with live API fetch
- Filter: `data?.prices?.filter(p => p.showInInvestment)` — only investment-eligible types
- `GOLD_USD_OPTIONS` appended unchanged (XAU/USD remains static)
- Hook has `enabled: isGoldInvestment` guard — no request unless gold investment type selected
- Dropdown shows loading state and is disabled while fetching

### Task 9 — Admin Gold Display Config UI

**Files created:**
- `features/admin/components/GoldDisplayConfigTable.tsx`
- `features/admin/components/GoldDisplayConfigForm.tsx`

**File modified:** `app/[locale]/dashboard/admin/page.tsx`

Table features:
- MobileTable with columns: order, typeCode, displayName, enabled (toggle), showInInvestment (toggle), edit/delete
- Per-row toggle loading tracked via `Set<string>` — avoids disabling entire table on single toggle
- BaseModal for create/edit; ConfirmationDialog for delete
- Uses `apiClient` directly (no generated hooks — admin CRUD has no proto RPCs defined)
- Cache key `QUERY_KEY_GOLD_DISPLAY_CONFIG` exported for invalidation

Admin page: added `"gold-config"` tab to the existing tab set.

---

## Cleanup

### Task 10 — Deleted Dead Constants

- **Deleted:** `features/market-prices/constants/gold-filter.ts`
  - Exported `GOLD_TABLE_FILTER` (array of 9 gold type display configs)
  - Exported `filterGoldPrices` (filter + reorder helper)
  - Zero remaining imports after Tasks 6 and 7 migration
- **Updated:** `features/investment/utils/gold-calculator.ts`
  - Removed stale comment referencing `GOLD_TABLE_FILTER`
  - `GOLD_VND_OPTIONS` **retained** — still used by watchlist feature and investment form fallback

---

## Data Model

```sql
CREATE TABLE gold_display_config (
  id               SERIAL PRIMARY KEY,
  type_code        VARCHAR(50) NOT NULL,
  display_name     VARCHAR(100) NOT NULL,
  display_order    INTEGER NOT NULL DEFAULT 0,
  enabled          BOOLEAN NOT NULL DEFAULT true,
  show_in_investment BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,        -- GORM soft delete
  CONSTRAINT idx_gold_display_config_type_code UNIQUE (type_code)
);
```

Migration command: `task backend:migrate-gold-display-config`

Seed data (9 entries matching the previous `GOLD_TABLE_FILTER`): SJC, SJC TD, Nhẫn SJC 9999, Nhẫn Doji 9999, SJC Mi Hồng, Nhẫn Mi Hồng 9999, SJC BTMC, Nhẫn BTMC, PNJ.

---

## Test Coverage

| Layer | File | Tests |
|-------|------|-------|
| Handler | `handlers/gold_display_config_test.go` | 14 unit tests |
| Service | `domain/service/gold_display_config_service_test.go` | 16 unit tests |
| Frontend unit | `app/[locale]/dashboard/home/__tests__/GoldPriceTable.test.tsx` | 8 tests |
| Frontend unit | `features/admin/components/__tests__/GoldDisplayConfigTable.test.tsx` | 6 tests |
| E2E | `tests/e2e/home-gold-price-table-flow.spec.ts` | Playwright spec |
| E2E | `tests/e2e/gold-display-config-admin-flow.spec.ts` | Playwright spec |

Handler tests cover: GetDisplayPrices (happy, empty list, service error), ListAll (happy), Create (happy), Update (invalid non-numeric/zero/negative ID → 400, happy path → 200), Delete (invalid IDs → 400, happy, service error → 500), struct field compile check.

---

## Security Notes

- Public endpoint (`GET /api/v1/public/gold-display-prices`) requires no authentication. Returns display configuration only — no internal DB IDs exposed beyond config ID.
- Admin CRUD endpoints protected by existing `AuthMiddleware` + `AdminMiddleware` (JWT + admin role check).
- ID path params validated: `strconv.Atoi` + `id <= 0` guard → 400 Bad Request on invalid input.
- All service inputs validated: `typeCode` ≤ 50 chars, `displayName` trimmed ≤ 100 chars, `displayOrder` ≥ 0. Duplicate `typeCode` returns 409 Conflict.
- GORM parameterized queries throughout — no raw SQL.
- `typeCode` is immutable after creation (Update endpoint does not accept `typeCode`).

---

## Architecture Documentation

- `docs/architecture/c4-component-backend.md` — `GoldDisplayConfigHandler`, `GoldDisplayConfigService`, `GoldDisplayConfigRepository` added
- `docs/architecture/c4-component-frontend.md` — noted removal of `gold-filter.ts`, migration to API hook
- `docs/architecture/flow-cross-cutting.md` — added sections 14 and 15:
  - **§14 Gold Display Prices Read Flow** — public endpoint trace from hook → service join → Redis override
  - **§15 Admin Gold Display Config CRUD Flow** — admin table load and Create/Update/Delete write path

---

## Fix History

| Date       | Fix                                                                 | Severity | Files Changed |
| ---------- | ------------------------------------------------------------------- | -------- | ------------- |
| 2026-03-27 | Show existing DB type codes as reference chips in the Add Gold Type modal | Minor | `GoldDisplayConfigForm.tsx`, `GoldDisplayConfigTable.tsx` |
| 2026-03-27 | Wire `formState.errors` to FormInput `error` props — validation messages were not displayed | Minor | `GoldDisplayConfigForm.tsx` |
