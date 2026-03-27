# Asset Price Bridge — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Bridge the `asset_price` DB cache into the investment price update path, generalize `gold_display_config` → `asset_display_config`, add fetch code priority mapping, and replace live API calls in `MarketDataService` for gold/silver with DB-only price resolution.

**Spec:** `docs/specs/2026-03-27-asset-price-bridge-spec.md`

**Architecture:** This feature unifies two separate price flows (PriceCacheJob → asset_price and PriceUpdateJob → live API → investment.current_price) into a single flow: PriceCacheJob writes to asset_price, PriceUpdateJob reads from asset_price via config-driven fetch codes. It also renames and generalizes the gold_display_config system to support both gold and silver.

**Tech Stack:** Go 1.25 (GORM, Gin), PostgreSQL 16, Protocol Buffers, Next.js 16 (React 19, TypeScript, Tailwind CSS, React Query v5)

## Security Implementation Notes

- **Authentication:** All admin endpoints require JWT + AdminMiddleware (existing pattern)
- **Authorization:** Fetch code CRUD is admin-only. Public price endpoint remains unauthenticated. Investment price updates are system-only (background job)
- **Input validation:** Server-side: type_code 1-50 chars + DB existence check, priority >= 0, max 10 fetch codes per config, asset_type enum ("gold"/"silver")
- **Data sanitization:** GORM parameterized queries for all DB operations. No user-controlled SQL. No internal error details leaked to frontend

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| MobileTable | `components/table/MobileTable` | Fetch code list in admin form |
| FormInput | `components/forms/FormInput` | Type code input in fetch code form |
| FormNumberInput | `components/forms/FormNumberInput` | Priority input |
| FormToggle | `components/forms/FormToggle` | Enabled/showInInvestment toggles (existing in GoldDisplayConfigForm) |
| ConfirmationDialog | `components/modals/ConfirmationDialog` | Delete fetch code confirmation |
| BaseModal | `components/modals/BaseModal` | Config edit modal (existing) |
| EmptyState | `components/feedback/EmptyState` | No fetch codes state |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| FetchCodeList | `features/admin/components/FetchCodeList.tsx` | Priority-ordered fetch code management with add/remove/reorder. No existing component handles this pattern. |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Rename `GoldDisplayConfigHandler/Service/Repository` → `AssetDisplayConfig*`. Add `AssetConfigFetchCodeRepository`. Update `MarketDataService` dependencies
- Update `docs/architecture/c4-component-frontend.md`: Rename admin components from `GoldDisplayConfig*` → `AssetDisplayConfig*`

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Update backend component diagram: rename GoldDisplayConfig* → AssetDisplayConfig*, add AssetConfigFetchCodeRepository, update MarketDataService to show dependency on AssetDisplayConfigService instead of GoldPriceService/SilverPriceService
2. Update frontend component diagram: rename admin GoldDisplayConfig components → AssetDisplayConfig
3. Commit diagram changes

---

### Task 1: DB Migration — Rename gold_display_config → asset_display_config + add asset_type

**Files:**

- Create: `src/go-backend/cmd/migrate-asset-display-config/main.go`
- Modify: `Taskfile.yml` (add task `backend:migrate-asset-display-config`)

**Security notes:** Migration runs with DB admin privileges. Atomic rename + column add. Backward-compatible: existing gold rows get `asset_type='gold'` default.

**Step 1: Write the migration code**

Create migration that:
1. Renames table `gold_display_config` → `asset_display_config`
2. Adds `asset_type VARCHAR(20) NOT NULL DEFAULT 'gold'` column
3. Drops old unique index `idx_gold_display_config_type_code`
4. Creates new composite unique index `idx_asset_display_config_type_code_asset_type` on `(type_code, asset_type)`
5. Seeds silver display entries if they don't exist

**Step 2: Run migration against local DB to verify**

```bash
cd src/go-backend && go run cmd/migrate-asset-display-config/main.go
```

**Step 3: Commit**

---

### Task 2: DB Migration — Create asset_config_fetch_code table

**Files:**

- Create: `src/go-backend/cmd/migrate-asset-config-fetch-code/main.go`
- Modify: `Taskfile.yml` (add task `backend:migrate-asset-config-fetch-code`)

**Security notes:** Foreign key with CASCADE delete. Unique constraint prevents duplicate fetch codes per config.

**Step 1: Write the migration code**

Create `asset_config_fetch_code` table:
- `id` SERIAL PRIMARY KEY
- `config_id` INTEGER NOT NULL FK → asset_display_config(id) ON DELETE CASCADE
- `type_code` VARCHAR(50) NOT NULL
- `priority` INTEGER NOT NULL DEFAULT 0
- `created_at`, `updated_at`, `deleted_at` TIMESTAMPTZ
- Unique constraint: `(config_id, type_code)`
- Index on `config_id`

Seed default fetch codes per spec's seed data table.

**Step 2: Run migration locally**

**Step 3: Commit**

---

### Task 3: DB Migration — Add price_updated_at to investment table

**Files:**

- Create: `src/go-backend/cmd/migrate-investment-price-updated-at/main.go`
- Modify: `Taskfile.yml`

**Security notes:** Nullable column, no default — existing rows get NULL (indicating "never updated from market data").

**Step 1: Write migration**

Add `price_updated_at TIMESTAMPTZ` column to `investment` table.

**Step 2: Run migration locally**

**Step 3: Commit**

---

### Task 4: Backend Model — AssetDisplayConfig + AssetConfigFetchCode + Investment.PriceUpdatedAt

**Files:**

- Create: `src/go-backend/domain/models/asset_display_config.go` (rename from gold_display_config.go)
- Create: `src/go-backend/domain/models/asset_config_fetch_code.go`
- Modify: `src/go-backend/domain/models/investment.go` (add PriceUpdatedAt field)
- Delete: `src/go-backend/domain/models/gold_display_config.go`
- Modify: `src/go-backend/domain/models/gold_display_config_test.go` → rename to `asset_display_config_test.go`

**Security notes:** No new trust boundaries. Model layer only.

**Step 1: Write tests for new models**

Test AssetDisplayConfig: table name is "asset_display_config", has AssetType field, unique index on (type_code, asset_type).
Test AssetConfigFetchCode: table name is "asset_config_fetch_code", FK to config_id, unique on (config_id, type_code).
Test Investment.PriceUpdatedAt: field exists, is nullable.

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test ./domain/models/...
```

**Step 3: Implement models**

AssetDisplayConfig struct:
```go
type AssetDisplayConfig struct {
    ID               int32          `gorm:"primaryKey;autoIncrement"`
    TypeCode         string         `gorm:"size:50;not null;uniqueIndex:idx_asset_display_config_type_code_asset_type"`
    AssetType        string         `gorm:"size:20;not null;default:'gold';uniqueIndex:idx_asset_display_config_type_code_asset_type"`
    DisplayName      string         `gorm:"size:100;not null"`
    DisplayOrder     int32          `gorm:"not null;default:0"`
    Enabled          bool           `gorm:"not null;default:true"`
    ShowInInvestment bool           `gorm:"not null;default:true"`
    CreatedAt        time.Time
    UpdatedAt        time.Time
    DeletedAt        gorm.DeletedAt `gorm:"index"`
    FetchCodes       []AssetConfigFetchCode `gorm:"foreignKey:ConfigID"`
}
```

AssetConfigFetchCode struct:
```go
type AssetConfigFetchCode struct {
    ID        int32          `gorm:"primaryKey;autoIncrement"`
    ConfigID  int32          `gorm:"not null;uniqueIndex:idx_asset_config_fetch_code_unique;index:idx_asset_config_fetch_code_config_id"`
    TypeCode  string         `gorm:"size:50;not null;uniqueIndex:idx_asset_config_fetch_code_unique"`
    Priority  int32          `gorm:"not null;default:0"`
    CreatedAt time.Time
    UpdatedAt time.Time
    DeletedAt gorm.DeletedAt `gorm:"index"`
}
```

Investment: add `PriceUpdatedAt *time.Time` field.

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 5: Backend Repository — AssetDisplayConfigRepository (rename from Gold)

**Files:**

- Create: `src/go-backend/domain/repository/asset_display_config_repository.go` (rename from gold_display_config_repository.go)
- Rename: `gold_display_config_repository_test.go` → `asset_display_config_repository_test.go`
- Delete: `src/go-backend/domain/repository/gold_display_config_repository.go`

**Security notes:** Parameterized queries only (GORM). Exact-match on type_code (no LIKE).

**Step 1: Write tests for renamed repository**

Update all tests from GoldDisplayConfig → AssetDisplayConfig. Add test for new `ListByAssetType(ctx, assetType)` method. Add test for `GetByTypeCodeAndAssetType(ctx, typeCode, assetType)`.

**Step 2: Run tests to verify they fail**

**Step 3: Implement AssetDisplayConfigRepository**

Interface adds:
- `ListByAssetType(ctx, assetType string) ([]*models.AssetDisplayConfig, error)` — WHERE asset_type = ? AND enabled = true
- `GetByTypeCodeAndAssetType(ctx, typeCode, assetType string) (*models.AssetDisplayConfig, error)`
- Keep existing methods but update types from `*models.GoldDisplayConfig` → `*models.AssetDisplayConfig`

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 6: Backend Repository — AssetConfigFetchCodeRepository

**Files:**

- Create: `src/go-backend/domain/repository/asset_config_fetch_code_repository.go`
- Create: `src/go-backend/domain/repository/asset_config_fetch_code_repository_test.go`

**Security notes:** Parameterized queries. Cap fetch codes per config at 10 (enforced at service layer, not repo).

**Step 1: Write tests**

Test CRUD operations: ListByConfigID (ordered by priority ASC), Create, Update, Delete. Test ListByConfigIDWithPriority returns ordered results.

**Step 2: Run tests to verify fail**

**Step 3: Implement repository**

Interface:
```go
type AssetConfigFetchCodeRepository interface {
    ListByConfigID(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error)
    Create(ctx context.Context, fc *models.AssetConfigFetchCode) error
    Update(ctx context.Context, fc *models.AssetConfigFetchCode) error
    Delete(ctx context.Context, id int32) error
    CountByConfigID(ctx context.Context, configID int32) (int64, error)
}
```

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 7: Backend Repository — Update InvestmentRepository for PriceUpdatedAt

**Files:**

- Modify: `src/go-backend/domain/repository/investment_repository_impl.go` (UpdatePrices method)
- Modify: `src/go-backend/domain/repository/investment_repository_impl_test.go`

**Security notes:** PriceUpdatedAt is system-set only (never from user input).

**Step 1: Update tests**

Add test that UpdatePrices also sets `price_updated_at` in the UPDATE map.

**Step 2: Run test to verify fail**

**Step 3: Update UpdatePrices implementation**

In the Updates map (line 191), add:
```go
"price_updated_at": time.Unix(update.Timestamp, 0),
```

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 8: Backend Service — AssetDisplayConfigService (rename + add ResolvePrice + fetch codes)

**Files:**

- Create: `src/go-backend/domain/service/asset_display_config_service.go` (rename from gold_display_config_service.go)
- Rename test file accordingly
- Modify: `src/go-backend/domain/service/interfaces.go` (rename interface + add ResolvePrice + add fetch code methods)
- Delete: `src/go-backend/domain/service/gold_display_config_service.go`

**Security notes:** ResolvePrice is internal (no user input). Fetch code CRUD validates: type_code 1-50 chars, priority >= 0, max 10 per config, type_code exists in asset_price.

**Step 1: Write tests for ResolvePrice**

Test priority-based resolution:
- Happy path: first non-stale fetch code returns price
- All stale: returns freshest stale price with isStale=true
- No asset_price rows: returns error
- Config has no fetch codes: returns error

Test fetch code CRUD:
- Create: validates type_code, priority, max 10 cap
- Update: validates priority
- Delete: success path

**Step 2: Run tests to verify fail**

**Step 3: Implement**

Interface changes in `interfaces.go`:
```go
type AssetDisplayConfigService interface {
    // Existing (renamed from GoldDisplayConfigService)
    GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error)
    ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error)
    Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error)
    Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error)
    Delete(ctx context.Context, id int32) error

    // NEW: Price resolution via fetch codes
    ResolvePrice(ctx context.Context, typeCode, assetType string) (price int64, isStale bool, err error)

    // NEW: Fetch code management
    ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error)
    CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error)
    UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error)
    DeleteFetchCode(ctx context.Context, id int32) error
    ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error)
}
```

Rename DTO: `GoldDisplayPriceDTO` → `AssetDisplayPriceDTO`

ResolvePrice logic:
1. Get config by typeCode + assetType
2. Get fetch codes ordered by priority ASC
3. For each fetch code, query asset_price for non-stale rows (any source)
4. Return first non-stale price
5. If all stale, return freshest (by FetchedAt)
6. If no rows at all, return error

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 9: Backend Service — Bridge MarketDataService (replace live API with DB read)

**Files:**

- Modify: `src/go-backend/domain/service/market_data_service.go`
- Add tests for new bridge logic

**Security notes:** No new trust boundaries. DB reads only (no user input). Emergency fallback to GoldPriceService for cold start.

**Step 1: Write tests**

Test:
- Gold investment price fetched from AssetDisplayConfigService.ResolvePrice (not live API)
- Silver investment price fetched from AssetDisplayConfigService.ResolvePrice (not live API)
- Regular investments still go through Yahoo Finance (unchanged)
- Cold start fallback: when ResolvePrice fails, falls back to GoldPriceService/SilverPriceService
- Price normalization (tael→gram) still applied after DB read

**Step 2: Run tests to verify fail**

**Step 3: Implement**

Changes to `marketDataService` struct:
```go
type marketDataService struct {
    marketDataRepo              repository.MarketDataRepository
    goldPriceService            GoldPriceService     // kept for cold-start fallback
    silverPriceService          SilverPriceService   // kept for cold-start fallback
    assetDisplayConfigService   AssetDisplayConfigService  // NEW
    goldConverter               *gold.Converter
    silverConverter             *silver.Converter
}
```

Constructor adds `AssetDisplayConfigService` parameter.

`fetchGoldPriceFromAPI` becomes `fetchGoldPriceFromDB`:
1. Call `assetDisplayConfigService.ResolvePrice(ctx, symbol, "gold")`
2. If success: normalize price (tael→gram via goldConverter) → return MarketData
3. If error (cold start): fall back to `goldPriceService.FetchPriceForSymbol(ctx, symbol)`

Same pattern for silver.

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 10: Backend DI Wiring — Update providers, services, builder

**Files:**

- Modify: `src/go-backend/domain/service/services.go` (rename field + update constructor)
- Modify: `src/go-backend/internal/app/providers.go` (rename repository)
- Modify: `src/go-backend/handlers/builder.go` (rename handler field)

**Security notes:** DI wiring only. No new trust boundaries.

**Step 1: Update services.go**

- Rename `GoldDisplayConfig` → `AssetDisplayConfig` in Services struct
- Rename `GoldDisplayConfig` → `AssetDisplayConfig` in Repositories struct
- Update NewServices: pass `assetDisplayConfigSvc` to MarketDataService constructor
- Update GoldDisplayConfigService → AssetDisplayConfigService instantiation
- Add AssetConfigFetchCode repository to Repositories struct

**Step 2: Update providers.go**

- Rename `GoldDisplayConfig` → `AssetDisplayConfig` repository creation
- Add `AssetConfigFetchCode` repository creation

**Step 3: Update builder.go**

- Rename `GoldDisplayConfig` → `AssetDisplayConfig` handler field
- Update handler creation

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 11: Backend Handler — AssetDisplayConfigHandler (rename + add fetch code endpoints)

**Files:**

- Create: `src/go-backend/handlers/asset_display_config.go` (rename from gold_display_config.go)
- Rename test file accordingly
- Modify: `src/go-backend/handlers/routes.go` (update routes)
- Delete: `src/go-backend/handlers/gold_display_config.go`

**Security notes:** Admin endpoints use AdminMiddleware. Public endpoint remains unauthenticated. Input validation on all write operations.

**Step 1: Write tests for new endpoints**

Test fetch code CRUD handlers:
- GET /:id/fetch-codes → 200 with list
- POST /:id/fetch-codes → 201 with new fetch code
- PUT /:id/fetch-codes/:fcId → 200 with updated fetch code
- DELETE /:id/fetch-codes/:fcId → 200 with success
- GET /asset-price-type-codes?assetType=gold → 200 with type code list

Test renamed endpoints:
- GET /api/v1/public/asset-display-prices?assetType=gold → 200
- GET /api/v1/admin/asset-display-config?assetType=gold → 200

**Step 2: Run tests to verify fail**

**Step 3: Implement handler**

Rename handler struct: `AssetDisplayConfigHandler`

New endpoints:
```go
// Fetch code CRUD
func (h *AssetDisplayConfigHandler) ListFetchCodes(c *gin.Context)     // GET /:id/fetch-codes
func (h *AssetDisplayConfigHandler) CreateFetchCode(c *gin.Context)   // POST /:id/fetch-codes
func (h *AssetDisplayConfigHandler) UpdateFetchCode(c *gin.Context)   // PUT /:id/fetch-codes/:fcId
func (h *AssetDisplayConfigHandler) DeleteFetchCode(c *gin.Context)   // DELETE /:id/fetch-codes/:fcId
func (h *AssetDisplayConfigHandler) ListAvailableTypeCodes(c *gin.Context) // GET /asset-price-type-codes
```

Updated endpoints:
- `GetDisplayPrices` reads `assetType` query param (default "gold")
- `ListAll` reads `assetType` query param (default "gold")
- `Create` reads `assetType` from request body

Update routes.go:
```go
// Public
publicGroup.GET("/asset-display-prices", h.AssetDisplayConfig.GetDisplayPrices)

// Admin
admin.GET("/asset-display-config", h.AssetDisplayConfig.ListAll)
admin.POST("/asset-display-config", h.AssetDisplayConfig.Create)
admin.PUT("/asset-display-config/:id", h.AssetDisplayConfig.Update)
admin.DELETE("/asset-display-config/:id", h.AssetDisplayConfig.Delete)
admin.GET("/asset-display-config/:id/fetch-codes", h.AssetDisplayConfig.ListFetchCodes)
admin.POST("/asset-display-config/:id/fetch-codes", h.AssetDisplayConfig.CreateFetchCode)
admin.PUT("/asset-display-config/:id/fetch-codes/:fcId", h.AssetDisplayConfig.UpdateFetchCode)
admin.DELETE("/asset-display-config/:id/fetch-codes/:fcId", h.AssetDisplayConfig.DeleteFetchCode)
admin.GET("/asset-price-type-codes", h.AssetDisplayConfig.ListAvailableTypeCodes)
```

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 12: Proto — Rename messages + add new fields

**Files:**

- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** Proto is source of truth for API contract. No internal details exposed.

**Step 1: Update proto messages**

Rename:
- `GoldDisplayConfig` → `AssetDisplayConfig` (add `asset_type` field)
- `GoldDisplayPrice` → `AssetDisplayPrice`
- `GetGoldDisplayPricesRequest` → `GetAssetDisplayPricesRequest` (add `asset_type` field)
- `GetGoldDisplayPricesResponse` → `GetAssetDisplayPricesResponse`
- `ListGoldDisplayConfigRequest` → `ListAssetDisplayConfigRequest` (add `asset_type` field)
- `ListGoldDisplayConfigResponse` → `ListAssetDisplayConfigResponse`
- `CreateGoldDisplayConfigRequest` → `CreateAssetDisplayConfigRequest` (add `asset_type` field)
- `CreateGoldDisplayConfigResponse` → `CreateAssetDisplayConfigResponse`
- `UpdateGoldDisplayConfigRequest` → `UpdateAssetDisplayConfigRequest`
- `UpdateGoldDisplayConfigResponse` → `UpdateAssetDisplayConfigResponse`
- `DeleteGoldDisplayConfigResponse` → `DeleteAssetDisplayConfigResponse`

Add new messages:
- `AssetConfigFetchCode` (id, config_id, type_code, priority)
- `ListFetchCodesResponse` (repeated AssetConfigFetchCode)
- `CreateFetchCodeRequest` (type_code, priority)
- `CreateFetchCodeResponse` (fetch_code)
- `UpdateFetchCodeRequest` (priority)
- `UpdateFetchCodeResponse` (fetch_code)
- `DeleteFetchCodeResponse` (success)
- `ListAssetPriceTypeCodesRequest` (asset_type)
- `ListAssetPriceTypeCodesResponse` (repeated string type_codes)

Add to Investment message:
- `int64 priceUpdatedAt = 29 [json_name = "priceUpdatedAt"];`

**Step 2: Generate code**

```bash
task proto:all
```

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 13: Backend — Update Investment.ToProto + handler for PriceUpdatedAt

**Files:**

- Modify: `src/go-backend/domain/models/investment.go` (ToProto method)
- Modify: `src/go-backend/handlers/investment.go` (if needed)

**Security notes:** PriceUpdatedAt is read-only for clients. System-set only.

**Step 1: Write test**

Test that ToProto includes PriceUpdatedAt when set, and 0 when nil.

**Step 2: Run test to verify fail**

**Step 3: Implement**

Update `ToProto()`:
```go
func (i *Investment) ToProto() *v1.Investment {
    proto := &v1.Investment{
        // ... existing fields ...
        PriceUpdatedAt: 0,
    }
    if i.PriceUpdatedAt != nil {
        proto.PriceUpdatedAt = i.PriceUpdatedAt.Unix()
    }
    return proto
}
```

**Step 4: Run tests to verify pass**

**Step 5: Commit**

---

### Task 14: Frontend — Update i18n translations (admin namespace rename)

**Files:**

- Modify: `src/wj-client/messages/en/admin.json`
- Modify: `src/wj-client/messages/vi/admin.json`

**Security notes:** No security impact. Text-only changes.

**Step 1: Rename translation namespace**

Change `goldDisplayConfig` → `assetDisplayConfig` in both en and vi JSON files. Update text strings to be asset-generic where appropriate (e.g., "Gold Display Configs" → "Asset Display Configs", "Add Gold Type" → "Add Asset Type").

**Step 2: Commit**

---

### Task 15: Frontend — Rename admin components (GoldDisplayConfig → AssetDisplayConfig)

**Files:**

- Rename: `features/admin/components/GoldDisplayConfigTable.tsx` → `AssetDisplayConfigTable.tsx`
- Rename: `features/admin/components/GoldDisplayConfigForm.tsx` → `AssetDisplayConfigForm.tsx`
- Rename: `features/admin/components/__tests__/GoldDisplayConfigTable.test.tsx` → `AssetDisplayConfigTable.test.tsx`
- Modify: `app/[locale]/dashboard/admin/page.tsx`

**Security notes:** No security impact. Frontend rename only.

**Step 0: Component inventory check**

- [x] Existing components: MobileTable, FormInput, FormNumberInput, FormToggle, ConfirmationDialog, BaseModal, EmptyState — all reused
- [x] No new shared components needed for this task (FetchCodeList is task 17)

**Step 1: Rename files and update internal references**

- Update all interface names, query keys, API endpoints, translation keys
- Update admin page imports
- Add `assetType` query param to API calls (default "gold")
- Add sub-tabs for Gold/Silver in admin page (or asset type filter)

**Step 2: Update tests**

Rename test file, update import paths, update mock API endpoints.

**Step 3: Verify frontend build**

```bash
cd src/wj-client && npm run build
```

**Step 4: Commit**

---

### Task 16: Frontend — Update public price consumers (GoldPriceTable, LandingGoldPriceTable, AddInvestmentForm)

**Files:**

- Modify: `app/[locale]/dashboard/home/GoldPriceTable.tsx`
- Modify: `components/landing/LandingGoldPriceTable.tsx`
- Modify: `features/investment/forms/AddInvestmentForm.tsx`
- Modify: `app/[locale]/dashboard/home/__tests__/GoldPriceTable.test.tsx`

**Security notes:** No security impact. Hook rename + add assetType param.

**Step 1: Update hook usage**

Replace `useQueryGetGoldDisplayPrices` with `useQueryGetAssetDisplayPrices` (auto-generated after proto rename). Pass `{ assetType: "gold" }` as request parameter.

**Step 2: Update tests**

Update mock hook names and test descriptions.

**Step 3: Verify build**

```bash
cd src/wj-client && npm run build
```

**Step 4: Commit**

---

### Task 17: Frontend — FetchCodeList component for admin form

**Files:**

- Create: `src/wj-client/features/admin/components/FetchCodeList.tsx`
- Modify: `src/wj-client/features/admin/components/AssetDisplayConfigForm.tsx` (integrate FetchCodeList)

**Security notes:** Admin-only component. Input validated server-side. No sensitive data displayed.

**Step 0: Component inventory check**

- Reusing: FormInput, FormNumberInput, EmptyState
- Creating new: FetchCodeList (no existing component handles ordered tag list with priority)

**Step 1: Write component test**

Test FetchCodeList renders fetch codes ordered by priority, can add/remove/reorder.

**Step 2: Run test to verify fail**

**Step 3: Implement FetchCodeList**

Props:
```typescript
interface FetchCodeListProps {
    configId: number;
    assetType: string;
}
```

Features:
- Ordered list showing current fetch codes with priority numbers
- "Add" button with autocomplete from available type codes (from `/api/v1/admin/asset-price-type-codes?assetType=...`)
- Up/down arrows to change priority
- Delete button per fetch code with confirmation
- Loading states per mutation

**Step 4: Integrate into AssetDisplayConfigForm**

Add "Fetch Codes" section below existing form fields (only visible in edit mode, since configId is needed).

**Step 5: Run tests and build**

**Step 6: Commit**

---

### Task 18: Frontend — Portfolio page PriceUpdatedAt staleness indicator

**Files:**

- Modify: `app/[locale]/dashboard/portfolio/components/InvestmentCardEnhanced.tsx` (or similar)
- Modify: `app/[locale]/dashboard/portfolio/helpers.ts` (if staleness logic exists there)

**Security notes:** Display-only. No user input processed.

**Step 1: Identify existing staleness indicator**

Check InvestmentCardEnhanced for existing pulsing dot. Read the component to understand current staleness logic.

**Step 2: Update staleness logic**

Replace `updatedAt`-based check with `priceUpdatedAt`-based:
- Green: < 15 minutes ago
- Yellow: 15-60 minutes ago
- Orange: 1-24 hours ago
- Red: > 24 hours ago
- Gray: null (never updated from market data)

Tooltip: "Price last updated X ago"

**Step 3: Verify build and test**

**Step 4: Commit**

---

### Task 19: E2E Tests — Update Playwright specs

**Files:**

- Modify: `tests/e2e/gold-display-config-admin-flow.spec.ts` → rename to `asset-display-config-admin-flow.spec.ts`
- Modify: `tests/e2e/home-gold-price-table-flow.spec.ts`

**Security notes:** Test-only changes.

**Step 1: Update admin E2E test**

Rename file, update mock routes from `/api/v1/admin/gold-display-config` → `/api/v1/admin/asset-display-config`, update assertions.

**Step 2: Update home gold price table E2E test**

Update mock route from `/api/v1/public/gold-display-prices` → `/api/v1/public/asset-display-prices`.

**Step 3: Run E2E tests**

```bash
cd src/wj-client && npx playwright test tests/e2e/asset-display-config-admin-flow.spec.ts --reporter=list
cd src/wj-client && npx playwright test tests/e2e/home-gold-price-table-flow.spec.ts --reporter=list
```

**Step 4: Commit**

---

### Task 20: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-investment.md`
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read implemented service code to trace actual runtime flow
2. Update "Market Price Update" sequence in flow-investment.md: replace GoldPriceService waterfall with AssetDisplayConfigService.ResolvePrice() → asset_price DB read
3. Add new sequence diagram "Gold/Silver Price Resolution via Fetch Codes": PriceUpdateJob → MarketDataService → AssetDisplayConfigService.ResolvePrice() → asset_config_fetch_code → asset_price → pick best by priority → return price
4. Update flow-cross-cutting.md: clarify PriceCacheJob is sole writer to asset_price, PriceUpdateJob is now a reader
5. Commit diagram changes

---

### Task 21: Backend CI Verification

**Files:** None (verification only)

**Step 1: Run full backend CI**

```bash
cd src/go-backend && task ci:backend-lint
cd src/go-backend && go test ./...
```

**Step 2: Fix any lint/test failures**

**Step 3: Commit fixes if any**

---

### Task 22: Frontend CI Verification

**Files:** None (verification only)

**Step 1: Run full frontend CI**

```bash
cd src/wj-client && npm run lint
cd src/wj-client && npm run build
cd src/wj-client && npm test
```

**Step 2: Fix any lint/build/test failures**

**Step 3: Commit fixes if any**

---

## Task Dependency Graph

```
Task 0: C4 diagrams (independent)
Task 1: DB migration (table rename) ──┐
Task 2: DB migration (fetch codes)  ──┤
Task 3: DB migration (investment)   ──┤
                                      ▼
Task 4: Backend models ───────────────┤
                                      ▼
Task 5: Repository (AssetDisplayConfig) ──┐
Task 6: Repository (FetchCode)         ──┤
Task 7: Repository (Investment update)  ──┤
                                          ▼
Task 8: Service (AssetDisplayConfig + ResolvePrice) ──┐
                                                       ▼
Task 9: Service (MarketDataService bridge) ────────────┤
                                                       ▼
Task 10: DI wiring ───────────────────────────────────┤
                                                       ▼
Task 11: Handler (rename + fetch codes) ──────────────┤
Task 12: Proto (rename messages) ─────────────────────┤
Task 13: Investment.ToProto (PriceUpdatedAt) ─────────┤
                                                       ▼
Task 14: i18n translations ────┐
Task 15: Admin components ─────┤ (can parallel after proto)
Task 16: Public consumers ─────┤
Task 17: FetchCodeList ────────┤
Task 18: Staleness indicator ──┤
                                ▼
Task 19: E2E tests ────────────┤
                                ▼
Task 20: Flow diagrams ────────┤
Task 21: Backend CI ───────────┤
Task 22: Frontend CI ──────────┘
```

## Parallel-Safe Task Groups

**Group A (backend models/repos, can parallel):** Tasks 4, 5, 6, 7

**Group B (frontend, can parallel after proto):** Tasks 14, 15, 16, 17, 18

**Sequential chains:**
- Tasks 1→2→3 (migrations, must be sequential for FK dependency)
- Task 8 depends on 5, 6
- Task 9 depends on 8
- Task 10 depends on 9
- Task 11 depends on 10
- Task 12 should be before frontend tasks
