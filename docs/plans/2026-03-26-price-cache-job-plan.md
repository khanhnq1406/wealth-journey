# Price Cache Background Job Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Decouple market price handlers from live external APIs by introducing a background job that caches all prices to a PostgreSQL table, and switching handlers to read from DB exclusively.

**Spec:** `docs/specs/2026-03-26-price-cache-job-spec.md`

**Architecture:** A new `PriceCacheJob` (scheduler job) periodically fetches gold/silver/currency prices from the existing three price services and upserts them into a new `asset_price` table. The `GetMarketPrices` and `GetPublicMarketTypes` handlers switch from calling live services to reading from `AssetPriceService`, which queries the DB. Admin price overrides continue to apply on top.

**Tech Stack:** Go (GORM, Gin), PostgreSQL, existing scheduler infrastructure

## Security Implementation Notes

- **Authentication**: `GetMarketPrices` remains behind `AuthMiddleware`. `GetPublicMarketTypes` remains public.
- **Authorization**: No per-user data — all prices are shared. No ownership checks needed.
- **Input validation**: No user input touches the new service/repository. External API data is validated by existing price services before reaching the job.
- **Data sanitization**: All DB writes use GORM parameterized queries. No raw SQL with external data.

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `formatPriceValue` | `app/[locale]/dashboard/prices/helpers.ts` | Modify to return `"--"` for zero/stale |
| `formatChangeValue` | `app/[locale]/dashboard/prices/helpers.ts` | Modify to return `"--"` for stale items |
| `ChangeCell` | `app/[locale]/dashboard/prices/page.tsx` | Already handles null/falsy → `"—"` display |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| None | — | Only formatting logic changes; no new UI components |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Add `AssetPriceRepository`, `AssetPriceService`, `PriceCacheJob`; update `MarketPricesHandler` and `PublicHandler` dependencies
- No new L4 diagram needed (simple model/repo/service/job — not complex enough)

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`

**Steps:**

1. Add `AssetPriceRepository` to repository layer in the Mermaid diagram
2. Add `AssetPriceService` to service layer
3. Add `PriceCacheJob` to scheduler layer with dependency on `AssetPriceService`
4. Update `MarketPricesHandler` dependency: `AssetPriceService` instead of `GoldPriceService`/`SilverPriceService`/`CurrencyPriceService`
5. Update `PublicHandler` dependency: `AssetPriceService` instead of individual price services
6. Commit diagram changes

---

### Task 1: AssetPrice GORM Model + Migration

**Files:**

- Create: `src/go-backend/domain/models/asset_price.go`
- Create: `src/go-backend/cmd/migrate-asset-prices/main.go`
- Modify: `Taskfile.yml` (add `backend:migrate-asset-prices` task)

**Security notes:** No user input. Model uses GORM tags for constraints. Soft deletes enabled.

**Step 1: Create the GORM model**

```go
// src/go-backend/domain/models/asset_price.go
package models

import (
	"time"
	"gorm.io/gorm"
)

type AssetPrice struct {
	ID         int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	TypeCode   string         `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"typeCode"`
	AssetType  string         `gorm:"size:10;not null;index:idx_asset_price_asset_type" json:"assetType"`
	Name       string         `gorm:"size:100;not null" json:"name"`
	Buy        int64          `gorm:"type:bigint;not null;default:0" json:"buy"`
	Sell       int64          `gorm:"type:bigint;not null;default:0" json:"sell"`
	ChangeBuy  int64          `gorm:"type:bigint;not null;default:0" json:"changeBuy"`
	ChangeSell int64          `gorm:"type:bigint;not null;default:0" json:"changeSell"`
	Currency   string         `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"currency"`
	Source     string         `gorm:"size:30" json:"source"`
	IsStale    bool           `gorm:"not null;default:false" json:"isStale"`
	FetchedAt  time.Time      `gorm:"not null" json:"fetchedAt"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AssetPrice) TableName() string {
	return "asset_price"
}
```

**Step 2: Create migration command**

```go
// src/go-backend/cmd/migrate-asset-prices/main.go
package main

import (
	"log"
	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
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

	log.Println("=== Asset Price Migration ===")
	if err := db.DB.AutoMigrate(&models.AssetPrice{}); err != nil {
		log.Fatalf("Failed to migrate asset_price table: %v", err)
	}
	log.Println("✓ asset_price table created/updated")
	log.Println("=== Migration Complete ===")
}
```

**Step 3: Add Taskfile entry**

Add to `Taskfile.yml`:
```yaml
backend:migrate-asset-prices:
  desc: Create asset_price table for price caching
  dir: src/go-backend
  cmd: go run ./cmd/migrate-asset-prices
```

**Step 4: Run migration locally to verify**

```bash
task backend:migrate-asset-prices
```

**Step 5: Commit**

---

### Task 2: AssetPrice Repository

**Files:**

- Create: `src/go-backend/domain/repository/asset_price_repository.go`
- Create: `src/go-backend/domain/repository/asset_price_repository_impl.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` (add interface)

**Security notes:** All queries use GORM parameterized queries. `UpsertBatch` uses `clause.OnConflict` — no raw SQL.

**Step 1: Write unit test for repository**

Test `UpsertBatch` with ON CONFLICT behavior, `ListByAssetType`, `ListAll`, `MarkStaleByAssetType`. Integration test requiring DB — use `go test -tags=integration`.

```go
// src/go-backend/domain/repository/asset_price_repository_test.go
// Test cases:
// - UpsertBatch inserts new records
// - UpsertBatch updates existing records (same type_code + currency)
// - ListByAssetType("gold") returns only gold records
// - ListAll returns all records
// - MarkStaleByAssetType sets is_stale = true for all of a type
// - GetByTypeCodeAndCurrency returns single record
```

**Step 2: Define interface in `interfaces.go`**

Add to `src/go-backend/domain/repository/interfaces.go`:

```go
type AssetPriceRepository interface {
	UpsertBatch(ctx context.Context, prices []*models.AssetPrice) error
	ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetPrice, error)
	ListAll(ctx context.Context) ([]*models.AssetPrice, error)
	GetByTypeCodeAndCurrency(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error)
	MarkStaleByAssetType(ctx context.Context, assetType string) error
}
```

**Step 3: Implement repository**

```go
// src/go-backend/domain/repository/asset_price_repository_impl.go
package repository

type assetPriceRepository struct {
	*BaseRepository
}

func NewAssetPriceRepository(db *database.Database) AssetPriceRepository {
	return &assetPriceRepository{BaseRepository: NewBaseRepository(db)}
}
```

Key implementation details:
- `UpsertBatch`: Loop through prices, use `clause.OnConflict{Columns: [{Name: "type_code"}, {Name: "currency"}], DoUpdates: clause.AssignmentColumns([]string{"name", "buy", "sell", "change_buy", "change_sell", "asset_type", "source", "is_stale", "fetched_at", "updated_at"})}` with `.Create()`
- `ListByAssetType`: `WHERE asset_type = ? AND deleted_at IS NULL`
- `ListAll`: `WHERE deleted_at IS NULL`
- `GetByTypeCodeAndCurrency`: `WHERE type_code = ? AND currency = ?`
- `MarkStaleByAssetType`: `UPDATE asset_price SET is_stale = true, updated_at = NOW() WHERE asset_type = ? AND deleted_at IS NULL`

**Step 4: Wire repository in DI**

- Add `AssetPrice` field to `Repositories` struct in `src/go-backend/domain/service/services.go`
- Add `AssetPrice: repository.NewAssetPriceRepository(db)` to `ProvideRepositories()` in `src/go-backend/internal/app/providers.go`

**Step 5: Verify build**

```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**

---

### Task 3: AssetPrice Service

**Files:**

- Create: `src/go-backend/domain/service/asset_price_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` (add interface)
- Modify: `src/go-backend/domain/service/services.go` (add to Services struct + NewServices)

**Security notes:** The service does NOT import `gorm.io/gorm` — depguard compliance. It uses the repository interface only.

**Step 1: Write unit test**

```go
// src/go-backend/domain/service/asset_price_service_test.go
// Test cases:
// - RefreshAllPrices: gold succeeds, silver succeeds, currency succeeds → all upserted with is_stale=false
// - RefreshAllPrices: gold fails, silver/currency succeed → gold marked stale, silver/currency upserted
// - RefreshAllPrices: all fail → all three types marked stale
// - GetAllPrices: reads from repo, groups by asset_type
// - GetPricesByAssetType: delegates to repo
// - GetMarketTypes: extracts type_code + name + currency from repo results
```

**Step 2: Define interface in `interfaces.go`**

Add to `src/go-backend/domain/service/interfaces.go`:

```go
type AssetPriceService interface {
	RefreshAllPrices(ctx context.Context) error
	GetAllPrices(ctx context.Context) (*AllAssetPrices, error)
	GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error)
	GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error)
}

type AllAssetPrices struct {
	Gold     []*AssetPriceDTO
	Silver   []*AssetPriceDTO
	Currency []*AssetPriceDTO
}

type AssetPriceDTO struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	ChangeBuy  int64
	ChangeSell int64
	Currency   string
	IsStale    bool
	FetchedAt  time.Time
}

type MarketTypeItem struct {
	Code      string
	Name      string
	Currency  string
}

type MarketTypesDTO struct {
	Gold               []MarketTypeItem
	Silver             []MarketTypeItem
	Currency           []MarketTypeItem
	GoldUpdatedAt      int64
	SilverUpdatedAt    int64
	CurrencyUpdatedAt  int64
}
```

**Step 3: Implement service**

```go
// src/go-backend/domain/service/asset_price_service.go
package service

type assetPriceService struct {
	repo        repository.AssetPriceRepository
	goldSvc     GoldPriceService
	silverSvc   SilverPriceService
	currencySvc CurrencyPriceService
}

func NewAssetPriceService(
	repo repository.AssetPriceRepository,
	goldSvc GoldPriceService,
	silverSvc SilverPriceService,
	currencySvc CurrencyPriceService,
) AssetPriceService {
	return &assetPriceService{
		repo: repo, goldSvc: goldSvc,
		silverSvc: silverSvc, currencySvc: currencySvc,
	}
}
```

Key `RefreshAllPrices` logic:
1. Fetch gold/silver/currency independently (each in its own error scope)
2. For each successful fetch: convert `CachedGoldPrice`/`CachedSilverPrice`/`CachedCurrencyPrice` → `[]models.AssetPrice` with `AssetType = "gold"/"silver"/"currency"`, `IsStale = false`, `FetchedAt = now`
3. Call `repo.UpsertBatch()` for the batch
4. For each failed fetch: call `repo.MarkStaleByAssetType()` for that type
5. Log summary: `"Price cache job completed: gold=OK(25 items), silver=FAIL(error: timeout), currency=OK(12 items)"`

Key `GetAllPrices` logic:
1. Call `repo.ListAll()`
2. Group results by `AssetType` into `AllAssetPrices` struct
3. Convert `models.AssetPrice` → `AssetPriceDTO`

Key `GetMarketTypes` logic:
1. Call `repo.ListAll()`
2. Extract `TypeCode`, `Name`, `Currency` per asset type
3. Find max `FetchedAt` per type → convert to Unix timestamp

**Step 4: Register in Services struct and NewServices**

Add `AssetPrice AssetPriceService` to `Services` struct.

In `NewServices`, after Phase 1 price service creation (line ~50):
```go
assetPriceSvc := NewAssetPriceService(repos.AssetPrice, goldPriceSvc, silverPriceSvc, currencyPriceSvc)
```

Add `AssetPrice: assetPriceSvc` to the return struct.

**Step 5: Verify lint + build**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

---

### Task 4: PriceCacheJob (Background Scheduler Job)

**Files:**

- Create: `src/go-backend/internal/scheduler/price_cache_job.go`
- Modify: `src/go-backend/internal/app/providers.go` (register job in `ProvideScheduler`)

**Security notes:** Job runs in its own goroutine. No user input. Errors are logged, not propagated to users.

**Step 1: Write unit test**

```go
// src/go-backend/internal/scheduler/price_cache_job_test.go
// Test cases:
// - Job implements scheduler.Job interface (Name, Interval, StartupDelay)
// - Run delegates to AssetPriceService.RefreshAllPrices
// - Name returns "price-cache"
// - Interval returns 15 * time.Minute
// - StartupDelay returns 10 * time.Second
```

**Step 2: Implement job**

```go
// src/go-backend/internal/scheduler/price_cache_job.go
package scheduler

import (
	"context"
	"log"
	"time"
	"wealthjourney/domain/service"
)

type PriceCacheJob struct {
	assetPriceSvc service.AssetPriceService
}

func NewPriceCacheJob(assetPriceSvc service.AssetPriceService) *PriceCacheJob {
	return &PriceCacheJob{assetPriceSvc: assetPriceSvc}
}

func (j *PriceCacheJob) Name() string              { return "price-cache" }
func (j *PriceCacheJob) Interval() time.Duration    { return 15 * time.Minute }
func (j *PriceCacheJob) StartupDelay() time.Duration { return 10 * time.Second }

func (j *PriceCacheJob) Run(ctx context.Context) error {
	log.Println("Running price cache job...")
	if err := j.assetPriceSvc.RefreshAllPrices(ctx); err != nil {
		return err
	}
	log.Println("Price cache job completed successfully")
	return nil
}
```

**Step 3: Register job in ProvideScheduler**

In `src/go-backend/internal/app/providers.go`, inside `ProvideScheduler()`, add after core jobs:

```go
// Price cache job — persists all prices to DB for fast handler reads
if services.AssetPrice != nil {
	backgroundJobs = append(backgroundJobs, scheduler.NewPriceCacheJob(services.AssetPrice))
}
```

**Step 4: Verify build**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 5: Add `isStale` to PriceItem Proto + Regenerate

**Files:**

- Modify: `api/protobuf/v1/investment.proto` (add `isStale` field to `PriceItem`)
- Regenerate: `src/go-backend/protobuf/v1/` and `src/wj-client/gen/protobuf/v1/`

**Security notes:** Additive proto change — backward compatible. Field 10 is unused.

**Step 1: Add field to PriceItem**

In `api/protobuf/v1/investment.proto`, after line 240 (`isOverridden`):

```protobuf
bool isStale = 10 [json_name = "isStale"];  // True when price fetch failed
```

**Step 2: Regenerate code**

```bash
task proto:all
```

**Step 3: Verify generated code compiles**

```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

---

### Task 6: Switch GetMarketPrices Handler to DB

**Files:**

- Modify: `src/go-backend/handlers/market_prices.go`
- Modify: `src/go-backend/handlers/builder.go`

**Security notes:** Handler no longer calls external APIs. No new auth requirements. Admin price overrides still applied via `PriceOverrideCache`.

**Step 1: Write integration test for handler**

```go
// Test cases:
// - Handler returns 200 with gold/silver/currency arrays from DB
// - Response includes isStale field
// - Admin overrides still applied on top of DB data
// - Handler does NOT call GoldPriceService/SilverPriceService/CurrencyPriceService
```

**Step 2: Refactor MarketPricesHandler to depend on AssetPriceService**

Change `MarketPricesHandler` struct:

```go
type MarketPricesHandler struct {
	assetPriceSvc service.AssetPriceService
	overrideCache *cache.PriceOverrideCache
}

func NewMarketPricesHandler(
	assetPriceSvc service.AssetPriceService,
	overrideCache *cache.PriceOverrideCache,
) *MarketPricesHandler {
	return &MarketPricesHandler{
		assetPriceSvc: assetPriceSvc,
		overrideCache: overrideCache,
	}
}
```

**Step 3: Rewrite GetMarketPrices to read from DB**

```go
func (h *MarketPricesHandler) GetMarketPrices(c *gin.Context) {
	ctx := c.Request.Context()

	allPrices, err := h.assetPriceSvc.GetAllPrices(ctx)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	// Convert DTOs to proto PriceItems
	goldItems := convertToPriceItems(allPrices.Gold)
	silverItems := convertToPriceItems(allPrices.Silver)
	currencyItems := convertToPriceItems(allPrices.Currency)

	// Apply admin overrides (same as before)
	h.applyOverrides(goldItems)
	h.applyOverrides(silverItems)
	h.applyOverrides(currencyItems)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"message":   "Market prices retrieved successfully",
		"gold":      goldItems,
		"silver":    silverItems,
		"currency":  currencyItems,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func convertToPriceItems(dtos []*service.AssetPriceDTO) []*investmentv1.PriceItem {
	items := make([]*investmentv1.PriceItem, len(dtos))
	for i, d := range dtos {
		items[i] = &investmentv1.PriceItem{
			TypeCode:   d.TypeCode,
			Buy:        d.Buy,
			Sell:       d.Sell,
			ChangeBuy:  d.ChangeBuy,
			ChangeSell: d.ChangeSell,
			Currency:   d.Currency,
			UpdatedAt:  d.FetchedAt.Unix(),
			Name:       d.Name,
			IsStale:    d.IsStale,
		}
	}
	return items
}
```

**Step 4: Update builder.go DI wiring**

In `handlers/builder.go`, change `NewMarketPricesHandler` call:

```go
// Old:
// marketPricesHandler = NewMarketPricesHandler(
//     service.NewGoldPriceService(deps.RDB.GetClient(), os.Getenv("BTMC_API_KEY")),
//     service.NewSilverPriceService(deps.RDB.GetClient()),
//     service.NewCurrencyPriceService(deps.RDB.GetClient()),
//     cache.NewPriceOverrideCache(deps.RDB.GetClient()),
// )

// New:
marketPricesHandler = NewMarketPricesHandler(
    services.AssetPrice,
    cache.NewPriceOverrideCache(deps.RDB.GetClient()),
)
```

**Step 5: Verify build + lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

---

### Task 7: Switch GetPublicMarketTypes Handler to DB

**Files:**

- Modify: `src/go-backend/handlers/public.go`
- Modify: `src/go-backend/handlers/builder.go`

**Security notes:** Public endpoint — no auth required. Only returns type names + timestamps, no prices. No new data exposure.

**Step 1: Write test for handler**

```go
// Test cases:
// - Returns 200 with gold/silver/currency type arrays
// - Includes updatedAt timestamps per type
// - Falls back to static registries if DB is empty (cold start)
// - Does NOT call external APIs
```

**Step 2: Refactor PublicHandler to depend on AssetPriceService**

```go
type PublicHandler struct {
	assetPriceSvc service.AssetPriceService
	// Keep static registries for cold-start fallback
}

func NewPublicHandler(assetPriceSvc service.AssetPriceService) *PublicHandler {
	return &PublicHandler{assetPriceSvc: assetPriceSvc}
}
```

**Step 3: Rewrite GetPublicMarketTypes**

```go
func (h *PublicHandler) GetPublicMarketTypes(c *gin.Context) {
	ctx := c.Request.Context()

	marketTypes, err := h.assetPriceSvc.GetMarketTypes(ctx)
	if err != nil || marketTypes == nil {
		// Fallback to static registries (cold start)
		h.fallbackStaticTypes(c)
		return
	}

	// Convert to gin.H arrays
	goldTypes := convertMarketTypeItems(marketTypes.Gold)
	silverTypes := convertMarketTypeItems(marketTypes.Silver)
	currencyTypes := convertMarketTypeItems(marketTypes.Currency)

	// If all empty, fallback to static
	if len(goldTypes) == 0 && len(silverTypes) == 0 && len(currencyTypes) == 0 {
		h.fallbackStaticTypes(c)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"message":           "Market types retrieved successfully",
		"gold":              goldTypes,
		"silver":            silverTypes,
		"currency":          currencyTypes,
		"goldUpdatedAt":     marketTypes.GoldUpdatedAt,
		"silverUpdatedAt":   marketTypes.SilverUpdatedAt,
		"currencyUpdatedAt": marketTypes.CurrencyUpdatedAt,
		"timestamp":         time.Now().Format(time.RFC3339),
	})
}
```

Keep static registry fallback method `fallbackStaticTypes()` from existing `gold.GoldTypes`, `silver.SilverTypes`, `currency.CurrencyTypes`.

**Step 4: Update builder.go DI wiring**

```go
// Old:
// publicHandler = NewPublicHandler(goldSvc, silverSvc, currencySvc)

// New:
publicHandler = NewPublicHandler(services.AssetPrice)
```

**Step 5: Verify build + lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

---

### Task 8: Frontend — Display `--` for Zero/Stale Prices

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/prices/helpers.ts`
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx` (if needed for isStale handling)

**Security notes:** Display-only change. No user input. No API changes.

**Step 0: Component inventory check**

- Reusing: `formatPriceValue`, `formatChangeValue` from `helpers.ts`
- Reusing: `ChangeCell` component (already returns `"—"` for null/falsy)
- No new components needed

**Step 1: Write test for formatPriceValue**

```typescript
// src/wj-client/app/[locale]/dashboard/prices/__tests__/helpers.test.ts
// Test cases:
// - formatPriceValue(0, "VND") returns "--"
// - formatPriceValue(null, "VND") returns "--"
// - formatPriceValue(undefined, "VND") returns "--"
// - formatPriceValue(8500000, "VND") returns formatted number (existing behavior)
// - formatChangeValue(0, "VND") returns "--" (changed from "")
// - formatChangeValue on stale item returns "--"
```

**Step 2: Update formatPriceValue**

In `helpers.ts`, at the top of `formatPriceValue`:

```typescript
export function formatPriceValue(
  value: number | null | undefined,
  currency: string,
  options?: { divide?: boolean }
): string {
  // Return "--" for zero, null, or undefined values
  if (value === null || value === undefined || value === 0) {
    return "--";
  }
  // ... existing logic
}
```

**Step 3: Update formatChangeValue**

```typescript
export function formatChangeValue(
  value: number | null | undefined,
  currency: string,
  options?: { divide?: boolean }
): string {
  // Return "--" for zero, null, or undefined values
  if (value === null || value === undefined || value === 0) {
    return "--";
  }
  // ... existing logic (return formatted absolute value)
}
```

**Step 4: Run tests**

```bash
cd src/wj-client && npm test -- --testPathPattern=helpers
```

**Step 5: Verify frontend build**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 6: Commit**

---

### Task 9: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md` (add Price Cache Job flow)
- Modify: `docs/architecture/flow-investment.md` (update GetMarketPrices flow)

**Steps:**

1. Read existing flow files to understand diagram patterns
2. Add "Price Cache Background Job" sequence diagram to `flow-cross-cutting.md`:
   - `Scheduler → PriceCacheJob → GoldPriceService → External APIs`
   - `Scheduler → PriceCacheJob → SilverPriceService → External APIs`
   - `Scheduler → PriceCacheJob → CurrencyPriceService → External APIs`
   - `PriceCacheJob → AssetPriceRepository → PostgreSQL`
   - Error path: fetch failure → `MarkStaleByAssetType`
3. Update "GetMarketPrices" sequence in `flow-investment.md`:
   - Old: `Handler → GoldPriceService → External API → Redis`
   - New: `Handler → AssetPriceService → AssetPriceRepository → PostgreSQL`
4. Update `docs/architecture/README.md` if needed
5. Commit diagram changes

---

## Task Dependency Order

```
Task 0: C4 diagrams (independent — can run first or in parallel)
Task 1: Model + Migration (foundation — must be first)
Task 2: Repository (depends on Task 1)
Task 3: Service (depends on Task 2)
Task 4: Scheduler Job (depends on Task 3)
Task 5: Proto isStale field (independent of Tasks 1-4)
Task 6: Handler switch — GetMarketPrices (depends on Tasks 3 + 5)
Task 7: Handler switch — GetPublicMarketTypes (depends on Tasks 3 + 5)
Task 8: Frontend formatting (depends on Task 5)
Task 9: Flow diagrams (depends on Tasks 3-7 being designed — run after implementation)
```

**Parallelizable groups:**
- Group A: Tasks 0, 1, 5 (all independent)
- Group B: Task 2 (after Task 1)
- Group C: Task 3 (after Task 2)
- Group D: Tasks 4, 6, 7 (all depend on Task 3; 6 and 7 also depend on Task 5)
- Group E: Task 8 (after Task 5)
- Group F: Task 9 (after all implementation)

**Recommended serial order:** 0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9
