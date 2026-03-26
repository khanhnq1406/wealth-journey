# Gold Display Configuration Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Move hardcoded gold type display filter to a backend-managed, admin-configurable `gold_display_config` table with public and admin endpoints, and update all frontend consumers to use the new API.

**Spec:** `docs/specs/2026-03-26-gold-display-config-spec.md`

**Architecture:** New GORM model + repository + service for `gold_display_config` table. A public endpoint returns enabled configs joined with `asset_price` prices and admin overrides. Admin CRUD endpoints behind `AdminMiddleware`. Frontend home page, landing page, and investment form all switch from client-side constants to the new API.

**Tech Stack:** Go (GORM, Gin), Protocol Buffers, TypeScript (React Query hooks), Next.js, Tailwind CSS

## Security Implementation Notes

- **Authentication:** Public endpoint (`GET /api/v1/gold-display-prices`) requires no auth. Admin endpoints (`/api/v1/admin/gold-display-config/*`) require JWT + admin role.
- **Authorization:** Admin CRUD protected by existing `AuthMiddleware` + `AdminMiddleware`. Public endpoint returns only display data (no internal DB IDs exposed beyond config ID).
- **Input validation:** Server-side validation for all admin inputs — `type_code` max 50 chars, must exist in gold registry or `asset_price`; `display_name` max 100 chars, non-empty after trim; `display_order` >= 0. GORM parameterized queries throughout.
- **Data sanitization:** No user-generated HTML/JS. String inputs sanitized by GORM binding. No raw SQL.

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| MobileTable | `components/table/MobileTable.tsx` | Admin config list table |
| BaseModal | `components/modals/BaseModal.tsx` | Add/edit config modal |
| ConfirmationDialog | `components/modals/ConfirmationDialog.tsx` | Delete confirmation |
| FormInput | `components/forms/FormInput.tsx` | type_code, display_name inputs |
| FormNumberInput | `components/forms/FormNumberInput.tsx` | display_order input |
| Button | `components/Button.tsx` | Action buttons |
| EmptyState | `components/feedback/EmptyState.tsx` | Empty config table state |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| GoldDisplayConfigTable | `features/admin/components/GoldDisplayConfigTable.tsx` | Admin-specific config CRUD table — wraps MobileTable with config-specific columns, toggles, and action buttons |
| GoldDisplayConfigForm | `features/admin/components/GoldDisplayConfigForm.tsx` | Create/edit form for gold display config — feature-specific fields (type_code autocomplete, display_name, booleans) |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Add `GoldDisplayConfigHandler`, `GoldDisplayConfigService`, `GoldDisplayConfigRepository` to their respective sections
- Update `docs/architecture/c4-component-frontend.md`: Note removal of `gold-filter.ts` constant and move to API-driven data

## Runtime Flow Diagram Updates

Add gold display prices read flow to `docs/architecture/flow-cross-cutting.md` (simple CRUD, sequence diagram).

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read current backend C4 diagram
2. Add `GoldDisplayConfigHandler` to Handlers section
3. Add `GoldDisplayConfigService` to Services section
4. Add `GoldDisplayConfigRepository` to Repositories section
5. Update frontend C4 to note `gold-filter.ts` removed, replaced by API hook
6. Commit diagram changes

---

### Task 1: Proto Definitions

**Files:**

- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** Proto messages define the API contract. Ensure no sensitive fields are exposed in public response.

**Step 1: Add proto messages and RPC definitions**

Add to `investment.proto`:

```protobuf
// Gold Display Config messages
message GoldDisplayPrice {
  string type_code = 1 [json_name = "typeCode"];
  string display_name = 2 [json_name = "displayName"];
  int64 buy = 3 [json_name = "buy"];
  int64 sell = 4 [json_name = "sell"];
  int64 change_buy = 5 [json_name = "changeBuy"];
  int64 change_sell = 6 [json_name = "changeSell"];
  string currency = 7 [json_name = "currency"];
  int64 updated_at = 8 [json_name = "updatedAt"];
  bool is_stale = 9 [json_name = "isStale"];
  bool show_in_investment = 10 [json_name = "showInInvestment"];
  int32 display_order = 11 [json_name = "displayOrder"];
}

message GetGoldDisplayPricesRequest {}

message GetGoldDisplayPricesResponse {
  repeated GoldDisplayPrice prices = 1 [json_name = "prices"];
}

message GoldDisplayConfig {
  int32 id = 1 [json_name = "id"];
  string type_code = 2 [json_name = "typeCode"];
  string display_name = 3 [json_name = "displayName"];
  int32 display_order = 4 [json_name = "displayOrder"];
  bool enabled = 5 [json_name = "enabled"];
  bool show_in_investment = 6 [json_name = "showInInvestment"];
}

message ListGoldDisplayConfigRequest {}

message ListGoldDisplayConfigResponse {
  repeated GoldDisplayConfig configs = 1 [json_name = "configs"];
}

message CreateGoldDisplayConfigRequest {
  string type_code = 1 [json_name = "typeCode"];
  string display_name = 2 [json_name = "displayName"];
  int32 display_order = 3 [json_name = "displayOrder"];
  bool enabled = 4 [json_name = "enabled"];
  bool show_in_investment = 5 [json_name = "showInInvestment"];
}

message CreateGoldDisplayConfigResponse {
  GoldDisplayConfig config = 1 [json_name = "config"];
}

message UpdateGoldDisplayConfigRequest {
  string display_name = 1 [json_name = "displayName"];
  int32 display_order = 2 [json_name = "displayOrder"];
  bool enabled = 3 [json_name = "enabled"];
  bool show_in_investment = 4 [json_name = "showInInvestment"];
}

message UpdateGoldDisplayConfigResponse {
  GoldDisplayConfig config = 1 [json_name = "config"];
}

message DeleteGoldDisplayConfigResponse {
  bool success = 1 [json_name = "success"];
}
```

**Step 2: Generate code**

```bash
task proto:all
```

**Step 3: Verify generated code compiles**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 2: Database Model + Migration

**Files:**

- Create: `src/go-backend/domain/models/gold_display_config.go`
- Create: `src/go-backend/cmd/migrate-gold-display-config/main.go`
- Modify: `Taskfile.yml` (add migration task)

**Security notes:** Unique constraint on `type_code` prevents duplicates. Soft delete via `gorm.DeletedAt`. No user input reaches raw SQL — all via GORM.

**Step 1: Write the failing test**

Create `src/go-backend/domain/models/gold_display_config_test.go`:

```go
package models_test

import (
    "testing"
    "wealthjourney/domain/models"
)

func TestGoldDisplayConfig_TableName(t *testing.T) {
    m := models.GoldDisplayConfig{}
    if m.TableName() != "gold_display_config" {
        t.Errorf("expected gold_display_config, got %s", m.TableName())
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./domain/models/ -run TestGoldDisplayConfig -short
```

**Step 3: Write the GORM model**

Create `src/go-backend/domain/models/gold_display_config.go`:

```go
package models

import (
    "time"
    "gorm.io/gorm"
)

type GoldDisplayConfig struct {
    ID               int32          `gorm:"primaryKey;autoIncrement" json:"id"`
    TypeCode         string         `gorm:"size:50;not null;uniqueIndex:idx_gold_display_config_type_code" json:"typeCode"`
    DisplayName      string         `gorm:"size:100;not null" json:"displayName"`
    DisplayOrder     int32          `gorm:"not null;default:0" json:"displayOrder"`
    Enabled          bool           `gorm:"not null;default:true" json:"enabled"`
    ShowInInvestment bool           `gorm:"not null;default:true" json:"showInInvestment"`
    CreatedAt        time.Time      `json:"createdAt"`
    UpdatedAt        time.Time      `json:"updatedAt"`
    DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (GoldDisplayConfig) TableName() string {
    return "gold_display_config"
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./domain/models/ -run TestGoldDisplayConfig -short
```

**Step 5: Create migration command with seed data**

Create `src/go-backend/cmd/migrate-gold-display-config/main.go`:

```go
package main

import (
    "fmt"
    "log"

    "wealthjourney/domain/models"
    "wealthjourney/pkg/config"
    "wealthjourney/pkg/database"

    "gorm.io/gorm"
)

func main() {
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    db, err := database.New(cfg)
    if err != nil {
        log.Fatalf("Failed to connect to database: %v", err)
    }
    defer func() { _ = db.Close() }()

    if err := migrate(db.DB); err != nil {
        log.Fatalf("Migration failed: %v", err)
    }

    log.Println("Migration completed successfully!")
}

func migrate(db *gorm.DB) error {
    log.Println("=== Gold Display Config Migration ===")

    log.Println("Creating gold_display_config table...")
    if err := db.AutoMigrate(&models.GoldDisplayConfig{}); err != nil {
        return fmt.Errorf("failed to create table: %w", err)
    }
    log.Println("Table created")

    // Seed data — matches current frontend GOLD_TABLE_FILTER
    seeds := []models.GoldDisplayConfig{
        {TypeCode: "SJC", DisplayName: "SJC", DisplayOrder: 1, Enabled: true, ShowInInvestment: true},
        {TypeCode: "SJC TD", DisplayName: "SJC Tự Do", DisplayOrder: 2, Enabled: true, ShowInInvestment: false},
        {TypeCode: "Vàng nhẫn SJC", DisplayName: "Nhẫn SJC 9999", DisplayOrder: 3, Enabled: true, ShowInInvestment: true},
        {TypeCode: "Doji_24K", DisplayName: "Nhẫn Doji 9999", DisplayOrder: 4, Enabled: true, ShowInInvestment: true},
        {TypeCode: "Mi hồng", DisplayName: "SJC Mi Hồng", DisplayOrder: 5, Enabled: true, ShowInInvestment: true},
        {TypeCode: "Mihong_999", DisplayName: "Nhẫn Mi Hồng 9999", DisplayOrder: 6, Enabled: true, ShowInInvestment: true},
        {TypeCode: "BTMC", DisplayName: "SJC BTMC", DisplayOrder: 7, Enabled: true, ShowInInvestment: true},
        {TypeCode: "BTMC_24K", DisplayName: "Nhẫn BTMC", DisplayOrder: 8, Enabled: true, ShowInInvestment: true},
        {TypeCode: "PNJ HCM", DisplayName: "PNJ", DisplayOrder: 9, Enabled: true, ShowInInvestment: true},
    }

    for _, seed := range seeds {
        result := db.Where("type_code = ?", seed.TypeCode).FirstOrCreate(&seed)
        if result.Error != nil {
            return fmt.Errorf("failed to seed %s: %w", seed.TypeCode, result.Error)
        }
        if result.RowsAffected > 0 {
            log.Printf("  Seeded: %s (%s)", seed.TypeCode, seed.DisplayName)
        } else {
            log.Printf("  Exists: %s", seed.TypeCode)
        }
    }

    log.Println("=== Migration Complete ===")
    return nil
}
```

**Step 6: Add task to Taskfile.yml**

Add after `backend:migrate-asset-prices`:

```yaml
  backend:migrate-gold-display-config:
    desc: "Create gold_display_config table with seed data"
    dir: src/go-backend
    cmds:
      - go run cmd/migrate-gold-display-config/main.go
```

**Step 7: Commit**

---

### Task 3: Repository Layer

**Files:**

- Create: `src/go-backend/domain/repository/gold_display_config_repository.go`
- Modify: `src/go-backend/domain/service/services.go` (add to `Repositories` struct, line ~180)
- Modify: `src/go-backend/internal/app/providers.go` (add to `ProvideRepositories`, line ~118)

**Security notes:** All queries use GORM parameterized queries. No raw SQL. Type code lookup by exact match only.

**Step 1: Write the repository interface and implementation**

Create `src/go-backend/domain/repository/gold_display_config_repository.go`:

```go
package repository

import (
    "context"

    "wealthjourney/domain/models"
    "wealthjourney/pkg/apperrors"
    "wealthjourney/pkg/database"

    "gorm.io/gorm"
)

type GoldDisplayConfigRepository interface {
    ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error)
    ListEnabled(ctx context.Context) ([]*models.GoldDisplayConfig, error)
    GetByID(ctx context.Context, id int32) (*models.GoldDisplayConfig, error)
    GetByTypeCode(ctx context.Context, typeCode string) (*models.GoldDisplayConfig, error)
    Create(ctx context.Context, config *models.GoldDisplayConfig) error
    Update(ctx context.Context, config *models.GoldDisplayConfig) error
    Delete(ctx context.Context, id int32) error
}

type goldDisplayConfigRepository struct {
    *BaseRepository
}

func NewGoldDisplayConfigRepository(db *database.Database) GoldDisplayConfigRepository {
    return &goldDisplayConfigRepository{
        BaseRepository: NewBaseRepository(db),
    }
}

func (r *goldDisplayConfigRepository) ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
    var configs []*models.GoldDisplayConfig
    if err := r.db.DB.WithContext(ctx).Order("display_order ASC").Find(&configs).Error; err != nil {
        return nil, apperrors.NewInternalErrorWithCause("failed to list gold display configs", err)
    }
    return configs, nil
}

func (r *goldDisplayConfigRepository) ListEnabled(ctx context.Context) ([]*models.GoldDisplayConfig, error) {
    var configs []*models.GoldDisplayConfig
    if err := r.db.DB.WithContext(ctx).Where("enabled = ?", true).Order("display_order ASC").Find(&configs).Error; err != nil {
        return nil, apperrors.NewInternalErrorWithCause("failed to list enabled gold display configs", err)
    }
    return configs, nil
}

func (r *goldDisplayConfigRepository) GetByID(ctx context.Context, id int32) (*models.GoldDisplayConfig, error) {
    var config models.GoldDisplayConfig
    if err := r.db.DB.WithContext(ctx).First(&config, id).Error; err != nil {
        if err == gorm.ErrRecordNotFound {
            return nil, apperrors.NewNotFoundError("gold display config")
        }
        return nil, apperrors.NewInternalErrorWithCause("failed to get gold display config", err)
    }
    return &config, nil
}

func (r *goldDisplayConfigRepository) GetByTypeCode(ctx context.Context, typeCode string) (*models.GoldDisplayConfig, error) {
    var config models.GoldDisplayConfig
    if err := r.db.DB.WithContext(ctx).Where("type_code = ?", typeCode).First(&config).Error; err != nil {
        if err == gorm.ErrRecordNotFound {
            return nil, nil
        }
        return nil, apperrors.NewInternalErrorWithCause("failed to get gold display config by type code", err)
    }
    return &config, nil
}

func (r *goldDisplayConfigRepository) Create(ctx context.Context, config *models.GoldDisplayConfig) error {
    if err := r.db.DB.WithContext(ctx).Create(config).Error; err != nil {
        return apperrors.NewInternalErrorWithCause("failed to create gold display config", err)
    }
    return nil
}

func (r *goldDisplayConfigRepository) Update(ctx context.Context, config *models.GoldDisplayConfig) error {
    if err := r.db.DB.WithContext(ctx).Save(config).Error; err != nil {
        return apperrors.NewInternalErrorWithCause("failed to update gold display config", err)
    }
    return nil
}

func (r *goldDisplayConfigRepository) Delete(ctx context.Context, id int32) error {
    if err := r.db.DB.WithContext(ctx).Delete(&models.GoldDisplayConfig{}, id).Error; err != nil {
        return apperrors.NewInternalErrorWithCause("failed to delete gold display config", err)
    }
    return nil
}
```

**Step 2: Add to Repositories struct**

In `src/go-backend/domain/service/services.go`, add to `Repositories` struct (after `AssetPrice` line ~180):

```go
GoldDisplayConfig repository.GoldDisplayConfigRepository
```

**Step 3: Wire in providers.go**

In `src/go-backend/internal/app/providers.go`, add to `ProvideRepositories` (after `AssetPrice` line ~117):

```go
GoldDisplayConfig: repository.NewGoldDisplayConfigRepository(db),
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 4: Service Layer

**Files:**

- Create: `src/go-backend/domain/service/gold_display_config_service.go`
- Create: `src/go-backend/domain/service/gold_display_config_service_test.go`
- Modify: `src/go-backend/domain/service/interfaces.go` (add interface after `AssetPriceService`, line ~365)
- Modify: `src/go-backend/domain/service/services.go` (add to `Services` struct line ~40, and wire in `NewServices` line ~143)

**Security notes:** Validate `type_code` exists in gold type registry or `asset_price` table before create. Validate string lengths. Duplicate `type_code` detection.

**Step 1: Define service interface**

Add to `src/go-backend/domain/service/interfaces.go` after `AssetPriceService`:

```go
// GoldDisplayConfigService manages the admin-configurable gold display config table.
type GoldDisplayConfigService interface {
    // GetDisplayPrices returns enabled gold configs joined with latest prices and admin overrides.
    GetDisplayPrices(ctx context.Context) ([]*GoldDisplayPriceDTO, error)
    // ListAll returns all configs (including disabled) for admin.
    ListAll(ctx context.Context) ([]*models.GoldDisplayConfig, error)
    // Create adds a new gold display config entry.
    Create(ctx context.Context, typeCode, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
    // Update modifies an existing config entry.
    Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.GoldDisplayConfig, error)
    // Delete soft-deletes a config entry.
    Delete(ctx context.Context, id int32) error
}

// GoldDisplayPriceDTO is the combined config + price data returned by the public endpoint.
type GoldDisplayPriceDTO struct {
    TypeCode         string
    DisplayName      string
    Buy              int64
    Sell             int64
    ChangeBuy        int64
    ChangeSell       int64
    Currency         string
    UpdatedAt        int64
    IsStale          bool
    ShowInInvestment bool
    DisplayOrder     int32
}
```

**Step 2: Write failing tests**

Create `src/go-backend/domain/service/gold_display_config_service_test.go` — test service Create validation (empty type_code, empty display_name, duplicate type_code).

**Step 3: Implement service**

Create `src/go-backend/domain/service/gold_display_config_service.go`:

Key behaviors:
- `GetDisplayPrices`: reads enabled configs → reads prices from `AssetPriceService.GetPricesByAssetType(ctx, "gold")` → builds lookup map by `TypeCode` → joins → returns ordered DTOs. Missing prices get `Buy=0, Sell=0, IsStale=true`.
- `Create`: validates `type_code` non-empty, max 50 chars; `display_name` non-empty after trim, max 100 chars; `display_order >= 0`; checks duplicate via `GetByTypeCode` → if exists, return 409. Validates type_code exists in gold types registry (`gold.GetGoldTypeByCode`) or `asset_price` table.
- `Update`: fetches by ID (404 if not found), updates fields, saves.
- `Delete`: fetches by ID (404 if not found), soft-deletes.

Constructor:
```go
func NewGoldDisplayConfigService(
    repo repository.GoldDisplayConfigRepository,
    assetPriceSvc AssetPriceService,
) GoldDisplayConfigService
```

**Step 4: Add to Services struct and wire**

In `services.go`:
- Add `GoldDisplayConfig GoldDisplayConfigService` to `Services` struct
- In `NewServices()`, after assetPriceSvc creation (~line 96):
  ```go
  goldDisplayConfigSvc := NewGoldDisplayConfigService(repos.GoldDisplayConfig, assetPriceSvc)
  ```
- Add `GoldDisplayConfig: goldDisplayConfigSvc` to return struct

**Step 5: Run tests**

```bash
cd src/go-backend && go test ./domain/service/ -run TestGoldDisplayConfig -short
```

**Step 6: Commit**

---

### Task 5: Handler + Routes

**Files:**

- Create: `src/go-backend/handlers/gold_display_config.go`
- Modify: `src/go-backend/handlers/builder.go` (add to `AllHandlers` struct line ~41, wire in `NewHandlers`)
- Modify: `src/go-backend/handlers/routes.go` (add public route ~line 30, add admin routes ~line 94)

**Security notes:** Public endpoint — no auth. Admin endpoints — JWT + admin role via existing middleware stack. Use `handler.BadRequest/Conflict/NotFound/HandleError` for proper error responses. Parse ID from path param with validation.

**Step 1: Write handler**

Create `src/go-backend/handlers/gold_display_config.go`:

```go
package handlers

import (
    "github.com/gin-gonic/gin"

    "wealthjourney/domain/service"
    "wealthjourney/pkg/cache"
    "wealthjourney/pkg/handler"
    investmentv1 "wealthjourney/protobuf/v1"
)

type GoldDisplayConfigHandler struct {
    svc           service.GoldDisplayConfigService
    overrideCache *cache.PriceOverrideCache
}

func NewGoldDisplayConfigHandler(
    svc service.GoldDisplayConfigService,
    overrideCache *cache.PriceOverrideCache,
) *GoldDisplayConfigHandler {
    return &GoldDisplayConfigHandler{svc: svc, overrideCache: overrideCache}
}
```

Handler methods:
- `GetDisplayPrices(c *gin.Context)` — calls `svc.GetDisplayPrices()`, applies overrides from `overrideCache`, converts DTOs to proto `GoldDisplayPrice` items, returns `handler.Success(c, &investmentv1.GetGoldDisplayPricesResponse{Prices: items})`
- `ListAll(c *gin.Context)` — calls `svc.ListAll()`, converts to proto `GoldDisplayConfig` items, returns response
- `Create(c *gin.Context)` — binds JSON `CreateGoldDisplayConfigRequest`, calls `svc.Create()`, returns `handler.Created(c, response)`
- `Update(c *gin.Context)` — parses `id` param, binds JSON, calls `svc.Update()`, returns success
- `Delete(c *gin.Context)` — parses `id` param, calls `svc.Delete()`, returns success

**Step 2: Wire into builder.go**

Add to `AllHandlers` struct:
```go
GoldDisplayConfig *GoldDisplayConfigHandler
```

Wire in `NewHandlers()`:
```go
var goldDisplayConfigHandler *GoldDisplayConfigHandler
if services.GoldDisplayConfig != nil {
    var overrideCache *cache.PriceOverrideCache
    if deps.RDB != nil {
        overrideCache = cache.NewPriceOverrideCache(deps.RDB.GetClient())
    }
    goldDisplayConfigHandler = NewGoldDisplayConfigHandler(services.GoldDisplayConfig, overrideCache)
}
```

**Step 3: Register routes**

In `routes.go`:

Public route (add inside `publicGroup` block, ~line 29):
```go
if h.GoldDisplayConfig != nil {
    publicGroup.GET("/gold-display-prices", h.GoldDisplayConfig.GetDisplayPrices)
}
```

Admin routes (add inside `admin` block, ~line 94):
```go
if h.GoldDisplayConfig != nil {
    admin.GET("/gold-display-config", h.GoldDisplayConfig.ListAll)
    admin.POST("/gold-display-config", h.GoldDisplayConfig.Create)
    admin.PUT("/gold-display-config/:id", h.GoldDisplayConfig.Update)
    admin.DELETE("/gold-display-config/:id", h.GoldDisplayConfig.Delete)
}
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Run lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

---

### Task 6: Frontend — Home Page GoldPriceTable

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`

**Security notes:** No security concerns — read-only display component consuming public API data.

**Step 0: Component inventory check**

- Reusing: `GoldPriceTable` (existing, just switching data source)
- No new components needed

**Step 1: Update GoldPriceTable to use new API**

Changes:
- Remove `import { filterGoldPrices }` from `gold-filter.ts`
- Instead of receiving `prices` prop and calling `filterGoldPrices()`, the component fetches from the new generated hook `useQueryGetGoldDisplayPrices()` (or receives data from parent that calls it)
- Use `displayName` from API response instead of local mapping
- Prices already ordered by `display_order` from backend
- Keep existing table structure, styling, stale indicator (`"--"` when `buy/sell === 0` or `isStale`)

**Step 2: Verify build**

```bash
cd src/wj-client && npm run build
```

**Step 3: Commit**

---

### Task 7: Frontend — Landing Page LandingGoldPriceTable

**Files:**

- Modify: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`

**Security notes:** Public page — no auth data involved. Endpoint is public.

**Step 0: Component inventory check**

- Reusing: `LandingGoldPriceTable` (existing, just switching data source)
- No new components needed

**Step 1: Update LandingGoldPriceTable to use new API**

Changes:
- Remove `import { GOLD_TABLE_FILTER }` from `gold-filter.ts`
- Fetch from public endpoint via generated hook or fetcher
- Display names from API response
- Order from backend `display_order`
- Keep "Login to view prices" behavior in buy/sell columns

**Step 2: Verify build**

```bash
cd src/wj-client && npm run build
```

**Step 3: Commit**

---

### Task 8: Frontend — Investment Gold Type Dropdown

**Files:**

- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- Modify: `src/wj-client/features/investment/utils/gold-calculator.ts` (remove `GOLD_VND_OPTIONS`)

**Security notes:** No security concerns — read-only data for form dropdown.

**Step 0: Component inventory check**

- Reusing: `BasicFormSelect` (existing in form)
- No new components needed

**Step 1: Update gold type dropdown source**

Changes:
- Fetch from new endpoint, filter where `showInInvestment === true`
- Map to dropdown options: `{ value: typeCode, label: displayName }`
- Keep `GOLD_USD_OPTIONS` as-is (out of scope per spec)
- Remove `GOLD_VND_OPTIONS` from `gold-calculator.ts`
- Update `getGoldTypeOptions()` function

**Step 2: Verify build**

```bash
cd src/wj-client && npm run build
```

**Step 3: Commit**

---

### Task 9: Frontend — Admin Gold Display Config Management

**Files:**

- Create: `src/wj-client/features/admin/components/GoldDisplayConfigTable.tsx`
- Create: `src/wj-client/features/admin/components/GoldDisplayConfigForm.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx` (add new tab)

**Security notes:** Admin-only UI. All mutations go through admin-protected endpoints. Client-side validation is a convenience — server validates everything.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `MobileTable` for config list, `BaseModal` for add/edit modal, `ConfirmationDialog` for delete, `FormInput`/`FormNumberInput`/`Button` for form
- Creating: `GoldDisplayConfigTable` (admin-specific CRUD table), `GoldDisplayConfigForm` (create/edit form)

**Step 1: Create GoldDisplayConfigTable component**

Features:
- MobileTable with columns: display_order, type_code, display_name, enabled (toggle), show_in_investment (toggle), actions (edit/delete)
- Inline toggle for enabled/show_in_investment (calls update mutation)
- Edit button opens modal with `GoldDisplayConfigForm`
- Delete button opens `ConfirmationDialog`
- "Add Gold Type" button opens create modal
- Uses generated hooks: `useQueryListGoldDisplayConfig`, `useMutationCreateGoldDisplayConfig`, `useMutationUpdateGoldDisplayConfig`, `useMutationDeleteGoldDisplayConfig`

**Step 2: Create GoldDisplayConfigForm component**

Fields:
- `type_code` (text input, required, only shown on create)
- `display_name` (text input, required)
- `display_order` (number input, required)
- `enabled` (checkbox/toggle)
- `show_in_investment` (checkbox/toggle)

Uses React Hook Form for validation.

**Step 3: Add "Gold Config" tab to admin page**

In `src/wj-client/app/[locale]/dashboard/admin/page.tsx`:
- Add tab: `{ id: "gold-config", label: "Gold Config" }`
- Add conditional render: when `activeTab === "gold-config"`, render `<GoldDisplayConfigTable />`

**Step 4: Responsive check**

- Mobile (375px): verify no horizontal scroll, touch targets >= 44px
- Desktop: verify table layout works

**Step 5: Verify build**

```bash
cd src/wj-client && npm run build
```

**Step 6: Commit**

---

### Task 10: Cleanup — Remove Frontend Constants

**Files:**

- Delete: `src/wj-client/features/market-prices/constants/gold-filter.ts`
- Modify: any remaining imports of `filterGoldPrices` or `GOLD_TABLE_FILTER`

**Security notes:** None — cleanup only.

**Step 1: Search for remaining references**

```bash
grep -r "gold-filter" src/wj-client/ --include="*.ts" --include="*.tsx"
grep -r "filterGoldPrices" src/wj-client/ --include="*.ts" --include="*.tsx"
grep -r "GOLD_TABLE_FILTER" src/wj-client/ --include="*.ts" --include="*.tsx"
```

**Step 2: Remove all references and delete file**

**Step 3: Verify build passes**

```bash
cd src/wj-client && npm run build
```

**Step 4: Commit**

---

### Task 11: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md` (add gold display prices flow)

**Steps:**

1. Read existing `flow-cross-cutting.md` (or create if it doesn't exist)
2. Add **Gold Display Prices Read Flow** sequence diagram:
   ```
   User → GET /api/v1/public/gold-display-prices
     → GoldDisplayConfigHandler.GetDisplayPrices()
       → GoldDisplayConfigService.GetDisplayPrices()
         → GoldDisplayConfigRepository.ListEnabled()  [gold_display_config table]
         → AssetPriceService.GetPricesByAssetType("gold")  [asset_price table]
       ← Join config + prices
     → PriceOverrideCache.GetAll()  [Redis]
     ← Apply overrides → GoldDisplayPricesResponse
   ```
3. Add **Admin Config CRUD Flow** (simple CRUD with AdminMiddleware)
4. Update `docs/architecture/README.md` if new flow file created
5. Commit

---

## Task Dependency Graph

```
Task 0 (C4 diagrams) ─────────────────────────────────────────┐
Task 1 (Proto) ──┐                                            │
                  ├── Task 2 (Model + Migration) ──┐           │
                  │                                 ├── Task 3 (Repository) ──┐
                  │                                 │                          ├── Task 4 (Service) ──┐
                  │                                 │                          │                       ├── Task 5 (Handler + Routes)
                  │                                 │                          │                       │         │
                  │                                 │                          │                       │         ├── Task 6 (Home GoldPriceTable)
                  │                                 │                          │                       │         ├── Task 7 (Landing GoldPriceTable)
                  │                                 │                          │                       │         ├── Task 8 (Investment Dropdown)
                  │                                 │                          │                       │         └── Task 9 (Admin UI)
                  │                                 │                          │                       │                    │
                  │                                 │                          │                       │                    └── Task 10 (Cleanup)
                  │                                 │                          │                       │                              │
                  │                                 │                          │                       │                              └── Task 11 (Flow Diagrams)
```

**Parallel-safe tasks:** Tasks 6, 7, 8, 9 can run in parallel (different files, no conflicts). Task 0 can run in parallel with Task 1.

**Sequential dependencies:** 1 → 2 → 3 → 4 → 5 → {6,7,8,9} → 10 → 11
