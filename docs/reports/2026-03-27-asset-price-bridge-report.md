# Asset Price Bridge — Implementation Report

## Metadata

- **Feature:** Asset Price Bridge
- **Branch:** `feat/price-fallback`
- **Plan:** `docs/plans/2026-03-27-asset-price-bridge-plan.md`
- **Spec:** `docs/specs/2026-03-27-asset-price-bridge-spec.md`
- **Completed:** 2026-03-27
- **Total tasks:** 23 (all done)
- **Total commits (feature):** 19 (this feature within the branch)
- **Files changed:** 166 files, +32,233 / −2,600 lines

---

## What Was Built

Generalized the gold-only `gold_display_config` system into a multi-asset `asset_display_config` system. Added a fetch-code priority mapping table so admins can configure which price source each config uses. Bridged `MarketDataService` to read from the DB cache instead of calling live APIs per-request. Exposed `price_updated_at` on investments so the portfolio page can show price freshness.

---

## Architecture Changes

### Before

```
MarketDataService ──► GoldPriceService (live API, per-request)
gold_display_config table (gold-only, no price-source control)
Investment (no price timestamp)
```

### After

```
PriceCacheJob ──► asset_price table (sole WRITER, every 15m)
MarketDataService ──► ResolvePrice (DB-first, live API fallback on cold start)
asset_display_config table (gold + silver + any future asset type)
asset_config_fetch_code table (priority-ordered fetch code mappings per config)
Investment.price_updated_at (nullable TIMESTAMPTZ, set by UpdatePrices)
```

**Key invariant:** HTTP request handlers make zero live API calls for gold/silver prices. All price data flows through the DB cache.

---

## Task Breakdown

### Infrastructure (Tasks 0–3)

| Task | Description | Commit |
|------|-------------|--------|
| 0 | C4 architecture diagrams updated — renamed `GoldDisplayConfig*` → `AssetDisplayConfig*`, added `AssetConfigFetchCodeRepo`, updated `MarketDataService` dependency arrows | `b80ff04d` |
| 1 | DB migration: renamed `gold_display_config` → `asset_display_config`, added `asset_type` column, composite unique index `(type_code, asset_type)`, 13 silver seed rows | `b80ff04d` |
| 2 | DB migration: created `asset_config_fetch_code` table with FK to `asset_display_config`, priority index, 15 seed rows covering 9 gold display configs | `b80ff04d` |
| 3 | DB migration: added nullable `price_updated_at TIMESTAMPTZ` column to `investment` table | `b80ff04d` |

### Backend Domain (Tasks 4–10)

| Task | Description | Commit |
|------|-------------|--------|
| 4 | Models: `AssetDisplayConfig`, `AssetConfigFetchCode`, `Investment.PriceUpdatedAt *time.Time`; 13 model tests | `bc837ec6` |
| 5 | `AssetDisplayConfigRepository`: 9 methods (List, Get, Create, Update, Delete, GetByTypeCode, ListEnabled, ListAvailableTypeCodes + fetch code queries); 27 sqlmock tests | `bc837ec6` |
| 6 | `AssetConfigFetchCodeRepository`: 5 methods (ListByConfigID, Create, Update, Delete, GetByID); 15 sqlmock tests | `bc837ec6` |
| 7 | `InvestmentRepository.UpdatePrices` now sets `price_updated_at`; 1 new test | `bc837ec6` |
| 8 | `AssetDisplayConfigService`: `GetDisplayPrices`, `ResolvePrice` (fetch-code priority algorithm), full fetch code CRUD with validation; 24 tests | `fc0502c6` |
| 9 | `MarketDataService` bridged to DB: calls `ResolvePrice` (DB-first) for gold/silver; nil-guard fallback to live API on cold start; 7 tests | `2f05f612` |
| 10 | DI wiring: `AssetDisplayConfigService` wired in `providers.go`, `services.go`, `builder.go`, `routes.go`; `MarketDataService` receives injected service | `89667108` |

### Backend API (Tasks 11–13)

| Task | Description | Commit |
|------|-------------|--------|
| 11 | `AssetDisplayConfigHandler`: 10 endpoints (public `GetDisplayPrices` + admin CRUD for configs and fetch codes); 30 tests; deleted `gold_display_config*` handler and service files | `f4e154bb` |
| 12 | Proto: renamed 11 `Gold*` → `Asset*` messages, added 9 fetch code messages, added `Investment.price_updated_at` field (field 29); ran `task proto:all` | `7e9448d9` |
| 13 | `Investment.ToProto()`: nil-guards `PriceUpdatedAt *time.Time` → `int64` Unix timestamp; 2 new tests (nil + non-nil cases) | `c556e742` |

### Frontend (Tasks 14–19)

| Task | Description | Commit |
|------|-------------|--------|
| 14 | i18n: `goldDisplayConfig` → `assetDisplayConfig` in `en` and `vi` admin namespaces; added `fetchCodes` sub-namespace with full key set | `82622f15` |
| 15 | Admin components renamed: `GoldDisplayConfigForm` → `AssetDisplayConfigForm`, `GoldDisplayConfigTable` → `AssetDisplayConfigTable`; deleted old files; updated admin page | `8fecc669` |
| 16 | Public price consumers: added `useQueryGetAssetDisplayPrices` hook to `api.ts` + `hooks.ts`; replaced removed `useQueryGetGoldDisplayPrices` in `GoldPriceTable`, `LandingGoldPriceTable`, `AddInvestmentForm` | `4475807f` |
| 17 | `FetchCodeList` admin component: list fetch codes by priority, add (typeCode + priority), delete with `ConfirmationDialog`; integrated into `AssetDisplayConfigForm` edit mode | `698ae935` |
| 18 | Portfolio staleness indicator: `getPriceStaleClass()` pure function with 5-tier color system based on `priceUpdatedAt` (green <15m, yellow 15–60m, orange 1–24h, red >24h, gray null); tooltip; 13 boundary tests | `3d0887c7` |
| 19 | E2E specs: renamed admin spec file, updated route mocks `gold-display-config` → `asset-display-config`, updated text assertions; updated home gold price table mock | `8435f660` |

### Documentation & CI (Tasks 20–22)

| Task | Description | Commit |
|------|-------------|--------|
| 20 | `flow-investment.md` §5 updated to DB-backed flow; §10 new fetch-code sequence diagram + ResolvePrice algorithm summary. `flow-cross-cutting.md` §3+§13 WRITER/READER labels + producer-consumer table | `10741acf` |
| 21 | Backend CI: removed unused `runAssetDisplayConfigRequest` helper from test file; lint 0 issues, build pass, all tests pass | `705e53ea` |
| 22 | Frontend CI: fixed `AssetDisplayConfigTable.test.tsx` to pass real `adminMessages` to `NextIntlClientProvider` (was passing `{}`); lint 0 errors, build clean, 449 tests pass | `9f686638` |

---

## Key Design Decisions

**`ResolvePrice` algorithm** — when `MarketDataService` needs a price for a given `typeCode`:
1. Load the `AssetDisplayConfig` for that typeCode
2. Load its fetch codes ordered by priority ASC
3. For each fetch code: look up the price in `asset_price` table by `type_code`
4. Return the first non-zero, non-stale price found
5. Fall back to next fetch code on miss
6. If all fetch codes exhausted: nil (MarketDataService then falls back to live API)

**`toQueryParams` camelCase bug** — the existing `toQueryParams` helper in `api.ts` converts camelCase to snake_case. The new `getAssetDisplayPrices` endpoint uses `?assetType=gold` (camelCase, matching backend `c.Query("assetType")`). Fixed by explicitly constructing the query string instead of using the helper.

**`price_updated_at` semantics** — distinct from `updated_at`. Only set when `UpdatePrices` is called by the background job. Allows the UI to show actual price freshness rather than any-field staleness.

---

## Test Coverage

| Layer | Tests added |
|-------|------------|
| Backend models | 13 |
| Backend repositories | 43 (27 + 15 + 1) |
| Backend services | 31 (24 + 7) |
| Backend handlers | 32 (30 + 2) |
| Frontend unit | ~30 (FetchCodeList: 11, staleness: 13, GoldPriceTable: 8, others) |
| **Total new tests** | **~149** |

All CI checks pass on the final commit:
- `task ci:backend-lint` — 0 issues
- `go test ./... -short` — all packages pass
- `npm run lint` — 0 errors (89 pre-existing warnings in generated files)
- `npm run build` — clean
- `npm test` — 449 pass, 5 skipped (pre-existing)

---

## Fix History

| Date       | Fix                                                                          | Severity | Files changed |
| ---------- | ---------------------------------------------------------------------------- | -------- | ------------- |
| 2026-03-27 | Split Gold / Silver tabs in admin config table and create form               | Minor    | 4 files       |
| 2026-03-27 | Backend `ListAll` ignored `assetType` — both tabs returned identical data    | Major    | 4 files       |
| 2026-03-27 | Show Asset Type badge in admin create form (Gold/Silver indicator missing)    | Minor    | 3 files       |
| 2026-03-27 | Show available type codes from DB as selectable pills in FetchCodeList add form | Minor   | 4 files       |
| 2026-03-27 | Apply `encodeURIComponent` to `assetType` in `AssetDisplayConfigTable` query URL (consistency with FetchCodeList) | Minor | 1 file |
| 2026-03-27 | Replace read-only Asset Type badge with interactive Gold/Silver selector in create form; auto-open edit mode after create so fetch codes can be added immediately | Minor | 3 files |

### Fix detail — Gold/Silver tab split

**Issue:** The admin `AssetDisplayConfigTable` showed all asset types (gold + silver) in one flat list. No visual separation made it hard to manage the two asset families.

**What changed:**
- `AssetDisplayConfigTable.tsx` — Added `activeTab: "gold" | "silver"` state; query now fetches `?assetType=gold` or `?assetType=silver`; added a pill-style tab switcher above the table using `v2-gold-primary` / `v2-bg-dark` tokens
- `AssetDisplayConfigForm.tsx` — Added `assetType` prop; the create request body now includes the active tab's asset type so new entries are created in the correct group
- `messages/en/admin.json` + `messages/vi/admin.json` — Added `assetDisplayConfig.tabs.gold` / `.silver` i18n keys
- `AssetDisplayConfigTable.test.tsx` — Updated URL assertion to `?assetType=gold`

**Security review:** PASS — `assetType` is a `"gold" | "silver"` TypeScript literal union; no user-controlled text reaches the query string or request body.

### Fix detail — Backend `ListAll` asset type filter

**Root cause:** `AssetDisplayConfigService.ListAll(ctx, assetType)` was calling `s.configRepo.ListAll(ctx)` — it silently dropped the `assetType` argument. The repository query had no `WHERE asset_type = ?` clause, so both tabs returned all rows regardless of asset type.

**What changed:**
- `asset_display_config_repository.go` — Interface and impl: `ListAll(ctx)` → `ListAll(ctx, assetType string)`; added `Where("asset_type = ?", assetType)` to the GORM query
- `asset_display_config_service.go` — Service now passes `assetType` through: `s.configRepo.ListAll(ctx, assetType)`
- `asset_display_config_repository_test.go` — Updated 3 `ListAll` tests: pass `assetType` arg, assert the `WHERE asset_type = ?` clause and arg value in SQL mock
- `asset_display_config_service_test.go` — Updated `adcConfigRepo` mock signature + `TestListAll_DelegatesToRepo` now asserts `assetType` is forwarded to the repo for both `"gold"` and `"silver"`

**CI:** `go test -short ./domain/repository/... ./domain/service/...` — all pass; `task ci:backend-lint` — 0 issues.

### Fix detail — Asset Type badge in admin create form

**Issue:** When clicking "+ Add Asset Type" in the admin panel, the create form showed no indicator of which asset type (Gold or Silver) the new entry would belong to. The asset type was silently determined by the active tab, leaving users unable to see at a glance which group they were creating for.

**What changed:**
- `AssetDisplayConfigForm.tsx` — Added a read-only pill badge at the top of the create-mode form displaying the active asset type ("Gold" / "Silver") using the existing `tabs.gold` / `tabs.silver` i18n keys; the badge uses `bg-v2-gold-primary/20` + `text-v2-gold-accent` + `border-v2-border-light` tokens; purely cosmetic — no logic change
- `messages/en/admin.json` — Added `assetDisplayConfig.form.assetType` key: `"Asset Type"`
- `messages/vi/admin.json` — Added `assetDisplayConfig.form.assetType` key: `"Loại tài sản"`

**Security review:** PASS — `assetType` prop is application-controlled (`"gold" | "silver"` tab state); value is gated by ternary and never interpolated raw into the DOM; admin-only route; ESLint 0 errors; 6 existing tests pass.

### Fix detail — Available type codes from DB in FetchCodeList add form

**Issue:** When adding a fetch price code in the `FetchCodeList` admin component, the type code field was a free-text input only. Admins had no visibility into which type codes actually exist in the `asset_price` table, leading to trial-and-error entry. The backend already rejected invalid codes (via `ListAvailableTypeCodes` validation), but the error only appeared after submission.

**Root cause:** The `assetType` prop was accepted by `FetchCodeList` but intentionally unused (`_assetType` rename). The backend endpoint `GET /api/v1/admin/asset-price-type-codes?assetType=` existed but was never called from the frontend.

**What changed:**
- `FetchCodeList.tsx` — Renamed `_assetType` → `assetType`; added a `useQuery` calling `GET /api/v1/admin/asset-price-type-codes?assetType={encodeURIComponent(assetType)}`; renders results as clickable monospace pills above the type code input; clicking a pill fills the input (no submit); hides the section when no codes are available; shows "Loading codes..." during fetch; `encodeURIComponent` added for URL safety
- `FetchCodeList.test.tsx` — Added 5 new tests: endpoint called with `assetType` param; pills rendered from server data; pill click populates input; loading state shown; empty response hides section; 16/16 tests pass
- `messages/en/admin.json` — Added `fetchCodes.form.availableCodes`: `"Available codes"` and `fetchCodes.form.availableCodesLoading`: `"Loading codes..."`
- `messages/vi/admin.json` — Added same keys in Vietnamese: `"Mã khả dụng"` / `"Đang tải mã..."`

**Security review:** PASS — `assetType` value originates from server config records (not a free-text user field); `encodeURIComponent` applied before URL interpolation; server data rendered via React JSX text (XSS-safe); pill-selected value POSTed as JSON body (no injection vector); endpoint is admin-only (`AuthMiddleware` + `AdminMiddleware` applied); ESLint 0 errors; all 16 tests pass.

### Fix detail — Interactive asset type selector + auto-open edit after create

**Issues:**
1. The create form showed only a read-only badge for asset type. Users had to know to switch the table tab first, then click "+ Add", making the flow non-obvious.
2. After creating a config, the modal closed. Users had to find the newly created row, click Edit, then scroll down to add fetch codes — three extra interactions.

**Root cause:**
- `assetType` was derived from the parent's `activeTab` state and passed as a prop — the form had no internal selector.
- `FetchCodeList` is only rendered in `mode === "edit"` (requires a real `configId`). In create mode there is no `id` yet, so fetch codes cannot be added before the record exists. The form never re-opened in edit mode after creation.

**What changed:**
- `AssetDisplayConfigForm.tsx` — Replaced the read-only badge with an interactive Gold/Silver pill selector (same style as the table tabs). Added `selectedAssetType` local state defaulting to the `assetType` prop. `onSubmit` now uses `selectedAssetType` for the `assetType` field. `onSuccess` callback signature extended to `(createdId?: number) => void` — passes `data.config.id` from the create API response on success, `undefined` on edit.
- `AssetDisplayConfigTable.tsx` — `handleModalSuccess` now accepts `(createdId?: number)`. When `createdId` is present (create flow), sets `modalState` to that ID instead of closing the modal, transitioning directly to edit mode. Added a loading spinner for the moment between state transition and query refetch completing.
- `AssetDisplayConfigForm.test.tsx` (new) — 8 tests covering: Gold/Silver pills visible in create mode; correct default; pill switching; `assetType` in POST body reflects selected pill; no selector in edit mode; `onSuccess` called with `createdId` after create; `onSuccess` called with `undefined` after edit.

**CI:** `npm test` — 462 pass, 5 skipped (pre-existing); `npm run lint` — 0 errors (89 pre-existing warnings in generated files).

**Security review:** PASS — `selectedAssetType` is constrained to `["gold", "silver"] as const`; no user text can set it; `createdId` is a numeric DB ID used only for local modal state; no XSS, injection, or authorization bypass vectors. Admin-only route unchanged.
