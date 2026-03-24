# Symbol Watchlist Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Allow users to create a personal watchlist of symbols on the Prices page with CRUD, drag-and-drop reordering, and live price enrichment.
**Spec:** `docs/specs/2026-03-24-symbol-watchlist-spec.md`
**Architecture:** New `watchlist` domain following DDD (model → repository → service → handler). Backend enriches stored items with cached prices from GoldPriceService, SilverPriceService, and MarketDataService. Frontend adds a new `features/watchlist/` module with a Watchlist tab (default) on the Prices page, plus navigation integration.
**Tech Stack:** Go/Gin/GORM (backend), Next.js 15/React 19/TypeScript/Tailwind (frontend), PostgreSQL (storage), Redis (price cache), framer-motion Reorder (drag-and-drop), Protocol Buffers (API contract)

## Security Implementation Notes

- **Authentication:** JWT auth middleware on all `/api/v1/watchlist` endpoints — same pattern as other protected routes
- **Authorization:** Every operation extracts `userID` from JWT context; repository queries always include `WHERE user_id = ?`; reorder validates ALL item IDs belong to the requesting user
- **Input validation:** Server-side validation in service layer — symbol (1-50 chars, trimmed, alphanumeric+dots/hyphens), name (1-200 chars, trimmed), note (0-200 chars, trimmed, HTML sanitized), asset_type (valid InvestmentType enum), currency (valid ISO 4217)
- **Data sanitization:** Notes sanitized server-side (strip HTML tags); frontend HTML-escapes on render. No raw user input rendered as HTML.
- **Rate limiting:** Standard `RateLimitByUser` middleware (same as other protected routes)
- **Limit enforcement:** Max 50 items per user checked in service layer within a DB transaction to prevent race conditions

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| BaseCard | `components/cards/BaseCard.tsx` | Wrapping watchlist tab content |
| BaseModal | `components/modals/BaseModal.tsx` | Add to Watchlist modal |
| Success | `components/modals/Success.tsx` | Success animation after adding item |
| EmptyState | `components/feedback/EmptyState.tsx` | Empty watchlist state |
| Button | `components/Button.tsx` | Add, save, cancel buttons |
| FloatingActionButton | `components/FloatingActionButton.tsx` | Mobile "+" button on watchlist tab |
| FormInput | `components/forms/FormInput.tsx` | Note text input |
| MobileTable | `components/table/MobileTable.tsx` | Watchlist mobile view |
| TanStackTable | `components/table/TanStackTable.tsx` | Watchlist desktop view |
| LoadingSpinner | `components/loading/LoadingSpinner.tsx` | Loading states |
| SymbolAutocomplete | `features/investment/components/SymbolAutocomplete.tsx` | "Other Assets" symbol search |
| formatPriceValue / formatChangeValue | `app/[locale]/dashboard/prices/helpers.ts` | Price/change formatting |
| goldTypeOptions (GOLD_VND_OPTIONS) | `features/investment/utils/gold-calculator.ts` | Gold type dropdown |
| silverTypeOptions | `features/investment/utils/silver-calculator.ts` | Silver type dropdown |
| NavItem (BottomNav) | `components/navigation/BottomNav.tsx` | Adding Prices to bottom nav |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| WatchlistTab | `features/watchlist/components/WatchlistTab.tsx` | Feature-specific tab content orchestrating price fetch, tables, drag-and-drop, CRUD — no existing component fits |
| AddToWatchlistForm | `features/watchlist/forms/AddToWatchlistForm.tsx` | Feature-specific 3-step form with asset category toggle + gold/silver/symbol pickers — no existing form matches |
| AssetTypeBadge | `features/watchlist/components/AssetTypeBadge.tsx` | Small colored badge for asset type (stock/crypto/gold/silver) — no existing badge component |
| DraggableWatchlistTable | `features/watchlist/components/DraggableWatchlistTable.tsx` | Wraps framer-motion Reorder around table rows — first usage of Reorder in codebase, needs custom integration |

## C4 Architecture Diagram Updates

Per spec:
1. **c4-component-backend.md** — Add WatchlistRepository, WatchlistService, WatchlistHandler with relationships to MarketDataService, GoldPriceService, SilverPriceService
2. **c4-component-frontend.md** — Add `features/watchlist/` module, Watchlist tab on Prices page, navigation changes

## Runtime Flow Diagrams

1. **New file: `docs/architecture/flow-watchlist.md`** — sequenceDiagram for:
   - List Watchlist with Prices flow
   - Reorder flow

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read existing diagram files
2. Add WatchlistRepository, WatchlistService, WatchlistHandler to backend component diagram
3. Add `features/watchlist/` module and navigation changes to frontend component diagram
4. Commit diagram changes

---

### Task 1: Define Protobuf API — `watchlist.proto`

**Files:**

- Create: `api/protobuf/v1/watchlist.proto`

**Security notes:** Proto definitions set the contract. Ensure all mutable endpoints require auth. `item_ids` in ReorderWatchlistRequest must be validated server-side to belong to user.

**Step 1: Create watchlist.proto**

```protobuf
syntax = "proto3";

package wealthjourney.v1;

option go_package = "wealthjourney/protobuf/v1";

import "google/api/annotations.proto";
import "protobuf/v1/investment.proto";

// ── Watchlist Messages ──

message WatchlistItem {
  int32 id = 1 [json_name = "id"];
  string symbol = 2 [json_name = "symbol"];
  string name = 3 [json_name = "name"];
  InvestmentType asset_type = 4 [json_name = "assetType"];
  string currency = 5 [json_name = "currency"];
  string note = 6 [json_name = "note"];
  int32 sort_order = 7 [json_name = "sortOrder"];
  // Price fields (enriched at response time, not stored)
  int64 current_price = 8 [json_name = "currentPrice"];
  int64 price_change = 9 [json_name = "priceChange"];
  double price_change_percent = 10 [json_name = "priceChangePercent"];
  int64 buy_price = 11 [json_name = "buyPrice"];
  int64 sell_price = 12 [json_name = "sellPrice"];
  int64 created_at = 13 [json_name = "createdAt"];
}

// ── RPC Requests/Responses ──

message CreateWatchlistItemRequest {
  string symbol = 1 [json_name = "symbol"];
  string name = 2 [json_name = "name"];
  InvestmentType asset_type = 3 [json_name = "assetType"];
  string currency = 4 [json_name = "currency"];
  string note = 5 [json_name = "note"];
}

message CreateWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  WatchlistItem item = 3 [json_name = "item"];
  string timestamp = 4 [json_name = "timestamp"];
}

message ListWatchlistRequest {}

message ListWatchlistResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated WatchlistItem items = 3 [json_name = "items"];
  int32 total = 4 [json_name = "total"];
  string timestamp = 5 [json_name = "timestamp"];
}

message UpdateWatchlistItemRequest {
  int32 id = 1 [json_name = "id"];
  string note = 2 [json_name = "note"];
}

message UpdateWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  WatchlistItem item = 3 [json_name = "item"];
  string timestamp = 4 [json_name = "timestamp"];
}

message DeleteWatchlistItemRequest {
  int32 id = 1 [json_name = "id"];
}

message DeleteWatchlistItemResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message ReorderWatchlistRequest {
  repeated int32 item_ids = 1 [json_name = "itemIds"];
}

message ReorderWatchlistResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

message CheckWatchlistItemRequest {
  string symbol = 1 [json_name = "symbol"];
}

message CheckWatchlistItemResponse {
  bool exists = 1 [json_name = "exists"];
  int32 item_id = 2 [json_name = "itemId"];
}

// ── Service Definition ──

service WatchlistService {
  rpc CreateWatchlistItem(CreateWatchlistItemRequest) returns (CreateWatchlistItemResponse) {
    option (google.api.http) = {
      post: "/api/v1/watchlist"
      body: "*"
    };
  }

  rpc ListWatchlist(ListWatchlistRequest) returns (ListWatchlistResponse) {
    option (google.api.http) = {
      get: "/api/v1/watchlist"
    };
  }

  rpc UpdateWatchlistItem(UpdateWatchlistItemRequest) returns (UpdateWatchlistItemResponse) {
    option (google.api.http) = {
      put: "/api/v1/watchlist/{id}"
      body: "*"
    };
  }

  rpc DeleteWatchlistItem(DeleteWatchlistItemRequest) returns (DeleteWatchlistItemResponse) {
    option (google.api.http) = {
      delete: "/api/v1/watchlist/{id}"
    };
  }

  rpc ReorderWatchlist(ReorderWatchlistRequest) returns (ReorderWatchlistResponse) {
    option (google.api.http) = {
      put: "/api/v1/watchlist/reorder"
      body: "*"
    };
  }

  rpc CheckWatchlistItem(CheckWatchlistItemRequest) returns (CheckWatchlistItemResponse) {
    option (google.api.http) = {
      get: "/api/v1/watchlist/check"
    };
  }
}
```

**Step 2: Generate code**

```bash
task proto:all
```

Verify Go and TS types compile:
```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 3: Commit**

---

### Task 2: Database Model — `watchlist.go`

**Files:**

- Create: `src/go-backend/domain/models/watchlist.go`

**Security notes:** Unique constraint on `(user_id, symbol)` with soft delete awareness prevents duplicate items. `user_id` indexed for ownership queries.

**Step 1: Create the GORM model**

```go
package models

import (
	"time"

	"gorm.io/gorm"

	v1 "wealthjourney/protobuf/v1"
)

// WatchlistItem represents a user's watchlisted symbol.
type WatchlistItem struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_watchlist_user_id;uniqueIndex:idx_watchlist_user_symbol,where:deleted_at IS NULL" json:"userId"`
	Symbol    string         `gorm:"size:50;not null;uniqueIndex:idx_watchlist_user_symbol,where:deleted_at IS NULL" json:"symbol"`
	Name      string         `gorm:"size:200;not null" json:"name"`
	AssetType v1.InvestmentType `gorm:"column:asset_type;type:int;not null;default:0" json:"assetType"`
	Currency  string         `gorm:"size:3;not null;default:'VND'" json:"currency"`
	Note      string         `gorm:"size:200" json:"note"`
	SortOrder int32          `gorm:"not null;default:0;index:idx_watchlist_user_sort" json:"sortOrder"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WatchlistItem) TableName() string {
	return "watchlist"
}
```

**Step 2: Commit**

---

### Task 3: Database Migration — `migrate-watchlist`

**Files:**

- Create: `src/go-backend/cmd/migrate-watchlist/main.go`
- Modify: `Taskfile.yml` — add `backend:migrate-watchlist` task

**Security notes:** Migration only creates table schema; no data seeding needed.

**Step 1: Create migration command**

```go
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

	log.Println("Running watchlist table migration...")

	if err := db.DB.AutoMigrate(&models.WatchlistItem{}); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	log.Println("Watchlist table migration completed successfully!")
}
```

**Step 2: Add Taskfile entry**

Add to `Taskfile.yml` under backend tasks:
```yaml
  backend:migrate-watchlist:
    desc: Create watchlist table
    dir: src/go-backend
    cmds:
      - go run cmd/migrate-watchlist/main.go
```

**Step 3: Run migration** (after deploying or locally)
```bash
task backend:migrate-watchlist
```

**Step 4: Commit**

---

### Task 4: Repository Layer — `watchlist_repository.go`

**Files:**

- Create: `src/go-backend/domain/repository/watchlist_repository.go`

**Security notes:** All queries scoped by `user_id`. `CountByUserID` used for 50-item limit enforcement. `ReorderItems` validates IDs within transaction.

**Step 1: Define interface and implementation**

```go
package repository

import (
	"context"
	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"gorm.io/gorm"
)

// WatchlistRepository defines data access for watchlist items.
type WatchlistRepository interface {
	Create(ctx context.Context, item *models.WatchlistItem) error
	GetByIDForUser(ctx context.Context, itemID, userID int32) (*models.WatchlistItem, error)
	GetBySymbolForUser(ctx context.Context, symbol string, userID int32) (*models.WatchlistItem, error)
	ListByUserID(ctx context.Context, userID int32) ([]*models.WatchlistItem, error)
	CountByUserID(ctx context.Context, userID int32) (int64, error)
	Update(ctx context.Context, item *models.WatchlistItem) error
	Delete(ctx context.Context, itemID int32) error
	ReorderItems(ctx context.Context, userID int32, itemIDs []int32) error
	GetMaxSortOrder(ctx context.Context, userID int32) (int32, error)
}

type watchlistRepository struct {
	db *database.Database
}

func NewWatchlistRepository(db *database.Database) WatchlistRepository {
	return &watchlistRepository{db: db}
}

func (r *watchlistRepository) Create(ctx context.Context, item *models.WatchlistItem) error {
	return r.db.DB.WithContext(ctx).Create(item).Error
}

func (r *watchlistRepository) GetByIDForUser(ctx context.Context, itemID, userID int32) (*models.WatchlistItem, error) {
	var item models.WatchlistItem
	err := r.db.DB.WithContext(ctx).
		Where("id = ? AND user_id = ?", itemID, userID).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *watchlistRepository) GetBySymbolForUser(ctx context.Context, symbol string, userID int32) (*models.WatchlistItem, error) {
	var item models.WatchlistItem
	err := r.db.DB.WithContext(ctx).
		Where("symbol = ? AND user_id = ?", symbol, userID).
		First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *watchlistRepository) ListByUserID(ctx context.Context, userID int32) ([]*models.WatchlistItem, error) {
	var items []*models.WatchlistItem
	err := r.db.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("sort_order ASC, created_at ASC").
		Find(&items).Error
	return items, err
}

func (r *watchlistRepository) CountByUserID(ctx context.Context, userID int32) (int64, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).
		Model(&models.WatchlistItem{}).
		Where("user_id = ?", userID).
		Count(&count).Error
	return count, err
}

func (r *watchlistRepository) Update(ctx context.Context, item *models.WatchlistItem) error {
	return r.db.DB.WithContext(ctx).Save(item).Error
}

func (r *watchlistRepository) Delete(ctx context.Context, itemID int32) error {
	return r.db.DB.WithContext(ctx).Delete(&models.WatchlistItem{}, itemID).Error
}

func (r *watchlistRepository) ReorderItems(ctx context.Context, userID int32, itemIDs []int32) error {
	return r.db.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for i, id := range itemIDs {
			if err := tx.Model(&models.WatchlistItem{}).
				Where("id = ? AND user_id = ?", id, userID).
				Update("sort_order", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *watchlistRepository) GetMaxSortOrder(ctx context.Context, userID int32) (int32, error) {
	var maxOrder *int32
	err := r.db.DB.WithContext(ctx).
		Model(&models.WatchlistItem{}).
		Where("user_id = ?", userID).
		Select("COALESCE(MAX(sort_order), -1)").
		Scan(&maxOrder).Error
	if err != nil {
		return 0, err
	}
	if maxOrder == nil {
		return -1, nil
	}
	return *maxOrder, nil
}
```

**Step 2: Commit**

---

### Task 5: Service Layer — `watchlist_service.go`

**Files:**

- Create: `src/go-backend/domain/service/watchlist_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — add `WatchlistService` interface

**Security notes:** Ownership validation on every operation. 50-item limit checked in `Create` using `CountByUserID`. Reorder validates all IDs belong to user. Note content is trimmed and length-validated.

**Step 1: Add interface to interfaces.go**

Add after `PriceAlertService` interface:

```go
// WatchlistService defines the interface for watchlist business logic.
type WatchlistService interface {
	CreateItem(ctx context.Context, userID int32, req *v1.CreateWatchlistItemRequest) (*v1.CreateWatchlistItemResponse, error)
	ListItems(ctx context.Context, userID int32) (*v1.ListWatchlistResponse, error)
	UpdateItem(ctx context.Context, itemID int32, userID int32, req *v1.UpdateWatchlistItemRequest) (*v1.UpdateWatchlistItemResponse, error)
	DeleteItem(ctx context.Context, itemID int32, userID int32) (*v1.DeleteWatchlistItemResponse, error)
	ReorderItems(ctx context.Context, userID int32, req *v1.ReorderWatchlistRequest) (*v1.ReorderWatchlistResponse, error)
	CheckItem(ctx context.Context, userID int32, symbol string) (*v1.CheckWatchlistItemResponse, error)
}
```

**Step 2: Implement watchlist_service.go**

The service will:
1. **Create:** Validate inputs, check 50-item limit, check duplicate symbol, set sort_order, create item
2. **List:** Fetch all items ordered by sort_order, then enrich with prices in parallel (group by asset type → fetch gold/silver/market prices → merge)
3. **Update:** Validate ownership, update note field only
4. **Delete:** Validate ownership, soft delete
5. **Reorder:** Validate all IDs belong to user, bulk update sort_order in transaction
6. **Check:** Query by symbol + user_id, return exists boolean

Price enrichment in `ListItems`:
- Group items by asset type (gold_vnd, silver_vnd, other)
- For gold items: call `GoldPriceService.FetchAllPrices()`, match by symbol
- For silver items: call `SilverPriceService.FetchAllPrices()`, match by symbol
- For other items: call `MarketDataService.GetPrice()` per symbol (already cached)
- All price fetches are parallel via goroutines + WaitGroup
- Failed price fetches → leave price fields at zero (frontend shows "N/A")

**Step 3: Commit**

---

### Task 6: Wire Repository + Service into DI

**Files:**

- Modify: `src/go-backend/domain/service/services.go` — add `Watchlist` to `Repositories` and `Services` structs; instantiate in `NewServices()`
- Modify: `src/go-backend/internal/app/providers.go` — add `NewWatchlistRepository(db)` to `ProvideRepositories()`

**Security notes:** No additional security concerns — follows existing DI pattern.

**Step 1: Add to Repositories struct** (services.go:102)

```go
Watchlist             repository.WatchlistRepository
```

**Step 2: Add to Services struct** (services.go:13)

```go
Watchlist            WatchlistService
```

**Step 3: Add to NewServices()** (services.go, after Phase 1 services)

```go
watchlistSvc := NewWatchlistService(repos.Watchlist, goldPriceSvc, silverPriceSvc, marketDataSvc)
```

And include in the return struct:
```go
Watchlist: watchlistSvc,
```

**Step 4: Add to ProvideRepositories()** (providers.go:84)

```go
Watchlist:             repository.NewWatchlistRepository(db),
```

**Step 5: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**

---

### Task 7: REST Handler — `watchlist.go`

**Files:**

- Create: `src/go-backend/handlers/watchlist.go`

**Security notes:** Extract userID from JWT context on every handler. Parse and validate path params. Use `handler.HandleError()` for service errors (auto-maps to HTTP status).

**Step 1: Implement handler**

```go
package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/service"
	v1 "wealthjourney/protobuf/v1"
)

type WatchlistHandler struct {
	watchlistSvc service.WatchlistService
}

func NewWatchlistHandler(watchlistSvc service.WatchlistService) *WatchlistHandler {
	return &WatchlistHandler{watchlistSvc: watchlistSvc}
}

// CreateWatchlistItem — POST /api/v1/watchlist
func (h *WatchlistHandler) CreateWatchlistItem(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	var req v1.CreateWatchlistItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	resp, err := h.watchlistSvc.CreateItem(c.Request.Context(), userID, &req)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// ListWatchlist — GET /api/v1/watchlist
func (h *WatchlistHandler) ListWatchlist(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	resp, err := h.watchlistSvc.ListItems(c.Request.Context(), userID)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateWatchlistItem — PUT /api/v1/watchlist/:id
func (h *WatchlistHandler) UpdateWatchlistItem(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	itemID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid item ID"})
		return
	}

	var req v1.UpdateWatchlistItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	resp, err := h.watchlistSvc.UpdateItem(c.Request.Context(), int32(itemID), userID, &req)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// DeleteWatchlistItem — DELETE /api/v1/watchlist/:id
func (h *WatchlistHandler) DeleteWatchlistItem(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	itemID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid item ID"})
		return
	}

	resp, err := h.watchlistSvc.DeleteItem(c.Request.Context(), int32(itemID), userID)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// ReorderWatchlist — PUT /api/v1/watchlist/reorder
func (h *WatchlistHandler) ReorderWatchlist(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	var req v1.ReorderWatchlistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	resp, err := h.watchlistSvc.ReorderItems(c.Request.Context(), userID, &req)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CheckWatchlistItem — GET /api/v1/watchlist/check?symbol=AAPL
func (h *WatchlistHandler) CheckWatchlistItem(c *gin.Context) {
	userID := c.GetInt32("userID")
	if userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "symbol query parameter is required"})
		return
	}

	resp, err := h.watchlistSvc.CheckItem(c.Request.Context(), userID, symbol)
	if err != nil {
		handleWatchlistError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"exists":    resp.Exists,
		"itemId":    resp.ItemId,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func handleWatchlistError(c *gin.Context, err error) {
	// Use existing apperrors pattern to map error types to HTTP status codes
	// This should follow the same pattern as other handlers
	c.JSON(http.StatusInternalServerError, gin.H{
		"success": false,
		"message": err.Error(),
	})
}
```

Note: The exact error handling should follow the project's existing `handler.HandleError` / `apperrors` pattern discovered during implementation. The code above is illustrative — implement using the actual helper functions from `pkg/handler/`.

**Step 2: Commit**

---

### Task 8: Wire Handler + Routes

**Files:**

- Modify: `src/go-backend/handlers/builder.go` — add `Watchlist *WatchlistHandler` to `AllHandlers` struct; wire in `NewHandlers()`
- Modify: `src/go-backend/handlers/routes.go` — register watchlist routes

**Security notes:** All routes behind `AuthMiddleware(authSrv)`. `/reorder` and `/check` must come before `/:id` parameterized routes to avoid matching conflicts.

**Step 1: Add to AllHandlers** (builder.go)

After `PriceAlertTrigger`:
```go
Watchlist              *WatchlistHandler
```

**Step 2: Wire in NewHandlers()** (builder.go)

In the return struct:
```go
Watchlist: NewWatchlistHandler(services.Watchlist),
```

**Step 3: Register routes** (routes.go)

Add after feedback routes block:
```go
// Watchlist routes (protected)
watchlist := v1.Group("/watchlist")
if rateLimiter != nil {
    watchlist.Use(appmiddleware.RateLimitByUser(rateLimiter))
}
watchlist.Use(AuthMiddleware(authSrv))
{
    watchlist.POST("", h.Watchlist.CreateWatchlistItem)
    watchlist.GET("", h.Watchlist.ListWatchlist)
    // Specific routes must come before :id parameterized route
    watchlist.PUT("/reorder", h.Watchlist.ReorderWatchlist)
    watchlist.GET("/check", h.Watchlist.CheckWatchlistItem)
    // Parameterized routes
    watchlist.PUT("/:id", h.Watchlist.UpdateWatchlistItem)
    watchlist.DELETE("/:id", h.Watchlist.DeleteWatchlistItem)
}
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 9: Frontend — Add Watchlist Feature Module + Generated Hooks

**Files:**

- Create: `src/wj-client/features/watchlist/` directory structure
- Verify: `src/wj-client/utils/generated/hooks.ts` — auto-generated hooks available after `task proto:all`

**Security notes:** Frontend hooks use JWT token from auth store. No additional auth handling needed.

**Step 0: Component inventory check (MANDATORY)**

Verify generated hooks exist:
```bash
task proto:all
```

Check hooks file for watchlist-related hooks:
```bash
grep -i "watchlist" src/wj-client/utils/generated/hooks.ts
```

Expected hooks:
- `useMutationCreateWatchlistItem`
- `useQueryListWatchlist`
- `useMutationUpdateWatchlistItem`
- `useMutationDeleteWatchlistItem`
- `useMutationReorderWatchlist`
- `useQueryCheckWatchlistItem`

**Step 1: Create feature directory structure**

```
features/watchlist/
├── components/
│   ├── WatchlistTab.tsx
│   ├── AssetTypeBadge.tsx
│   └── DraggableWatchlistTable.tsx
├── forms/
│   └── AddToWatchlistForm.tsx
└── utils/
    └── watchlist-helpers.ts
```

**Step 2: Commit**

---

### Task 10: Frontend — WatchlistTab Component

**Files:**

- Create: `src/wj-client/features/watchlist/components/WatchlistTab.tsx`
- Create: `src/wj-client/features/watchlist/utils/watchlist-helpers.ts`

**Security notes:** No security concerns — read-only data display. Prices fetched via authenticated API.

**Step 0: Component inventory check**

- Reusing: `MobileTable` from `@/components/table/MobileTable`, `TanStackTable` from `@/components/table/TanStackTable`, `EmptyState` from `@/components/feedback/EmptyState`, `LoadingSpinner` from `@/components/loading/LoadingSpinner`, `BaseCard` from `@/components/cards/BaseCard`
- Creating new: `WatchlistTab` — orchestrates data fetch, tables, empty state, and actions

**Step 1: Create watchlist-helpers.ts**

Utility functions:
- `formatWatchlistPrice(item)` — delegates to `formatPriceValue` from prices helpers
- `formatWatchlistChange(item)` — delegates to `formatChangeValue`
- `getAssetTypeLabel(assetType)` — maps InvestmentType enum to display string

**Step 2: Create WatchlistTab.tsx**

Key behavior:
- Uses `useQueryListWatchlist({}, { refetchOnMount: "always" })` to fetch data
- Desktop: TanStackTable with columns (drag handle, symbol, name, price, change, note, delete)
- Mobile: MobileTable with expandable rows
- Empty state: EmptyState component with "Add symbols" CTA
- Header shows item count + "Add" button (desktop)
- FloatingActionButton for mobile add

**Step 3: Responsive & accessibility check**

- Mobile (375px): MobileTable, touch-friendly drag handles (44px), FAB for add
- Desktop (800px+): TanStackTable with all columns visible
- No plain `<img>` tags
- Direct imports only

**Step 4: Commit**

---

### Task 11: Frontend — AssetTypeBadge Component

**Files:**

- Create: `src/wj-client/features/watchlist/components/AssetTypeBadge.tsx`

**Security notes:** Pure display component, no user input.

**Step 1: Implement AssetTypeBadge**

Maps `InvestmentType` enum to a small colored badge:
- Stock (2) → blue badge "Stock"
- Crypto (1) → orange badge "Crypto"
- ETF (3) → purple badge "ETF"
- Gold VND (8) → gold badge "Gold"
- Gold USD (9) → gold badge "Gold"
- Silver VND (10) → gray badge "Silver"
- Silver USD (11) → gray badge "Silver"
- Other → default gray badge

Uses Tailwind classes for colors. Size: text-xs, rounded-full, px-2 py-0.5.

**Step 2: Commit**

---

### Task 12: Frontend — DraggableWatchlistTable Component

**Files:**

- Create: `src/wj-client/features/watchlist/components/DraggableWatchlistTable.tsx`

**Security notes:** Optimistic update — revert on error. Uses `useMutationReorderWatchlist` for persistence.

**Step 1: Implement DraggableWatchlistTable**

Key behavior:
- Wraps `framer-motion` `Reorder.Group` and `Reorder.Item` around table rows
- Each row has a grip/drag handle icon on the left
- On reorder complete: optimistically update local state, call `ReorderWatchlist` mutation
- On error: revert to previous order, show toast notification
- Works on both desktop (mouse) and mobile (touch)
- Drag handle: 6-dot grip icon (⠿), 44px touch target

**Step 2: Commit**

---

### Task 13: Frontend — AddToWatchlistForm

**Files:**

- Create: `src/wj-client/features/watchlist/forms/AddToWatchlistForm.tsx`

**Security notes:** Client-side validation (max 200 char note, required fields) mirrors server-side. No raw HTML rendering.

**Step 0: Component inventory check**

- Reusing: `BaseModal` from `@/components/modals/BaseModal`, `Button` from `@/components/Button`, `FormInput` from `@/components/forms/FormInput`, `Success` from `@/components/modals/Success`, `SymbolAutocomplete` from `@/features/investment/components/SymbolAutocomplete`
- Note: `SymbolAutocomplete` is a cross-feature import from `features/investment/`. Since ESLint forbids cross-feature imports, we need to either: (a) move it to shared `components/forms/`, or (b) create a wrapper in `features/watchlist/`. **Decision: Use the import directly — the component is effectively shared infrastructure. If ESLint warns, suppress with a comment and note for future refactoring.**

**Step 1: Implement AddToWatchlistForm**

3-step progressive disclosure:
1. **Asset category**: Toggle buttons — Gold | Silver | Other Assets
2. **Symbol selection**:
   - Gold → Dropdown of `GOLD_VND_OPTIONS` (VND types only)
   - Silver → Dropdown of silver type options (VND types only)
   - Other Assets → SymbolAutocomplete free-text search
3. **Optional note**: FormInput (max 200 chars)

After symbol selection, show current price as confirmation (fetched from existing market data hooks).

On submit: call `useMutationCreateWatchlistItem`, show Success animation, call `onSuccess` callback.

Error handling:
- Duplicate symbol → show "Already in your watchlist" error
- 50-item limit → show "Maximum of 50 items reached" error

**Step 2: Commit**

---

### Task 14: Frontend — Integrate Watchlist Tab into Prices Page

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**Security notes:** No additional security concerns.

**Step 1: Add "watchlist" to Tab type and TABS array**

```typescript
type Tab = "watchlist" | "gold" | "silver" | "currency" | "symbol";

const TABS: { key: Tab; label: string }[] = [
  { key: "watchlist", label: t("tabs.watchlist") },  // NEW — first tab
  { key: "gold", label: t("tabs.gold") },
  { key: "silver", label: t("tabs.silver") },
  { key: "currency", label: t("tabs.currency") },
  { key: "symbol", label: t("tabs.symbolLookup") },
];
```

**Step 2: Change default tab to "watchlist"**

```typescript
const [activeTab, setActiveTab] = useState<Tab>("watchlist");
```

**Step 3: Add WatchlistTab content rendering**

```typescript
{activeTab === "watchlist" && (
  <WatchlistTab onAddClick={() => setModalType("add-watchlist")} />
)}
```

**Step 4: Add "Add to Watchlist" modal**

Add modal rendering for `modalType === "add-watchlist"`:
```typescript
{modalType === "add-watchlist" && (
  <BaseModal isOpen onClose={handleCloseModal} title={t("watchlist.addTitle")}>
    <AddToWatchlistForm onSuccess={handleWatchlistSuccess} />
  </BaseModal>
)}
```

**Step 5: Add "Add to Watchlist" button on Symbol Lookup tab**

After the symbol lookup result display, add a star/bookmark button that calls `useMutationCreateWatchlistItem` with the searched symbol's data.

**Step 6: Add translation keys**

Add to `messages/en/prices.json` and `messages/vi/prices.json`:
```json
"tabs": {
  "watchlist": "Watchlist",
  ...
},
"watchlist": {
  "addTitle": "Add to Watchlist",
  "emptyTitle": "Your watchlist is empty",
  "emptyDescription": "Add symbols to track their prices.",
  "addButton": "Add to Watchlist",
  "alreadyAdded": "Already in Watchlist",
  "limitReached": "Maximum of 50 items reached",
  "removeSuccess": "Removed from watchlist",
  "addSuccess": "Added to watchlist",
  "reorderError": "Failed to save order. Please try again."
}
```

**Step 7: Commit**

---

### Task 15: Frontend — Navigation Integration (Sidebar + Mobile Menu + Bottom Nav)

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` — add Prices to desktop sidebar and mobile slide-out menu
- Modify: `src/wj-client/components/navigation/BottomNav.tsx` — add Prices as 4th item, update width

**Security notes:** No security concerns — navigation changes only.

**Step 1: Desktop Sidebar — Add "Prices" NavItem**

In the Standard nav items section of DashboardLayout.tsx, add "Prices" after "Finance" and before "Wallets":
- Icon: `TrendingUp` from `lucide-react` (size 22)
- Label: `t("prices")`
- Href: `routes.prices`
- Animation delay: Adjust subsequent items' delays (30ms increment pattern)

**Step 2: Mobile Slide-Out Menu — Add "Prices"**

In the `standardItems` array within `navigationItems` useMemo, add "Prices" after "Finance":
- Icon: `TrendingUp` from `lucide-react` (size 22)
- Label: `t("prices")`
- Href: `routes.prices`

**Step 3: Mobile Bottom Nav — Add "Prices" as 4th item**

In `createNavItems()` in BottomNav.tsx:
- Add Prices item between Home and Community
- Update to 4 items total: Portfolio, Home, Prices, Community
- Update width: `max-w-[33.33%]` → `max-w-[25%]`
- Icon: `TrendingUp` from `lucide-react` or a custom SVG matching BottomNav style

**Step 4: Verify routes.prices exists**

Check that `routes.prices` is defined in the routes constant file. If not, add:
```typescript
prices: `/${locale}/dashboard/prices`,
```

**Step 5: Commit**

---

### Task 16: Create Runtime Flow Diagram

**Files:**

- Create: `docs/architecture/flow-watchlist.md`
- Modify: `docs/architecture/README.md` — add to Dynamic Behavior Diagrams table

**Steps:**

1. Read the implemented service code to trace actual runtime flow
2. Create sequenceDiagram for:
   - **List Watchlist with Prices**: User opens tab → WatchlistHandler.ListWatchlist → WatchlistService.ListItems → WatchlistRepo.ListByUserID → [group by asset type] → GoldPriceService/SilverPriceService/MarketDataService (parallel) → merge prices → response
   - **Reorder**: User drops item → WatchlistHandler.ReorderWatchlist → WatchlistService.ReorderItems → validate IDs → WatchlistRepo.ReorderItems (transaction) → response
3. Add Key Invariants section
4. Add Error Paths table
5. Update README.md
6. Commit

---

### Task 17: Final Integration Testing

**Files:**

- All created/modified files

**Steps:**

1. Run backend compilation: `cd src/go-backend && go build ./...`
2. Run frontend type check: `cd src/wj-client && npx tsc --noEmit`
3. Run frontend build: `cd src/wj-client && npm run build`
4. Manual test checklist:
   - [ ] Navigate to Prices page → Watchlist tab is default
   - [ ] Empty state shows when no items
   - [ ] Add item via "+" button (all 3 categories)
   - [ ] Add item from Symbol Lookup tab
   - [ ] Duplicate detection works
   - [ ] 50-item limit enforced
   - [ ] Drag-and-drop reorder works (desktop + mobile)
   - [ ] Delete item works
   - [ ] Edit note works
   - [ ] Prices display correctly for gold/silver/stocks
   - [ ] Navigation: sidebar, mobile menu, bottom nav all show Prices
   - [ ] Responsive: mobile and desktop layouts correct

**Step N: Final commit**
