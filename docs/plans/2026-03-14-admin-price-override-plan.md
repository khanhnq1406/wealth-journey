# Admin Price Override Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Enable admin users to manually override market prices (gold, silver, currency, stock) via inline editing on the price table, with Redis-only storage and API fallback.

**Spec:** `docs/specs/2026-03-13-admin-price-override-spec.md`

**Architecture:** Admin-only endpoints protected by new AdminMiddleware. Price overrides stored in Redis with no TTL. MarketPricesHandler merges overrides with API prices at response time. Frontend conditionally renders inline edit UI based on `isAdmin` auth state.

**Tech Stack:** Go/Gin (backend), Redis (override storage), Protocol Buffers (API contract), Next.js/React (frontend), Tailwind CSS (styling)

## Security Implementation Notes

- **Authentication:** All admin endpoints require JWT auth via existing `AuthMiddleware`
- **Authorization:** New `AdminMiddleware` checks `is_admin` context value set by `AuthMiddleware`; returns 403 for non-admin users
- **Input validation:** Server-side validation for category enum, typeCode format, currency ISO 4217, positive int64 buy/sell values
- **Data sanitization:** typeCode and name sanitized for length; no HTML/script content possible in int64 price fields

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md` — Add `PriceOverrideCache`, `PriceOverrideHandler`, `AdminMiddleware`
- Update `docs/architecture/c4-component-frontend.md` — Add inline edit components in Market Prices module

---

### Task 1: Proto Changes — Add `is_admin` to User & `is_overridden` to PriceItem

**Files:**
- Modify: `api/protobuf/v1/auth.proto:52-62` — Add `is_admin` field to User message
- Modify: `api/protobuf/v1/investment.proto:226-235` — Add `is_overridden` field to PriceItem message
- Create: `api/protobuf/v1/admin.proto` — New admin service with price override messages

**Security notes:** Proto changes are type-safe; `is_admin` is a read-only field from the server's perspective (never accepted from client input).

**Step 1: Add `is_admin` to auth.proto User message**
Add after line 61 in `auth.proto`:
```protobuf
bool isAdmin = 10 [json_name = "isAdmin"];
```

**Step 2: Add `is_overridden` to investment.proto PriceItem message**
Add after line 234 (after `name = 8`):
```protobuf
bool isOverridden = 9 [json_name = "isOverridden"];
```

**Step 3: Create `api/protobuf/v1/admin.proto`**
New file with `AdminService`, `PriceCategory` enum, and request/response messages per spec.

**Step 4: Generate code**
```bash
task proto:all
```

**Step 5: Verify generated code compiles**
```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 6: Commit**
```
feat(proto): add is_admin to User, is_overridden to PriceItem, and admin.proto
```

---

### Task 2: User Model & DB Migration — Add `is_admin` field

**Files:**
- Modify: `src/go-backend/domain/models/user.go:10-25` — Add `IsAdmin` field to User struct
- Create: `src/go-backend/cmd/migrate-admin/main.go` — Migration command
- Modify: `Taskfile.yml` — Add `backend:migrate-admin` task

**Security notes:** `is_admin` defaults to `false`. Only settable via direct DB update. Never accepted from user input.

**Step 1: Add `IsAdmin` field to User model**
Add after line 24 in `user.go`:
```go
IsAdmin       bool           `gorm:"default:false;not null" json:"isAdmin"`
```

**Step 2: Create migration command**
Create `src/go-backend/cmd/migrate-admin/main.go` following the pattern in `cmd/migrate-gold-sentiment/main.go`:
- Load config, connect to DB
- Run `db.AutoMigrate(&models.User{})` to add the column
- Log success

**Step 3: Add Taskfile entry**
Add to `Taskfile.yml`:
```yaml
backend:migrate-admin:
  dir: src/go-backend
  cmds:
    - go run ./cmd/migrate-admin/main.go
```

**Step 4: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
feat(db): add is_admin field to User model with migration command
```

---

### Task 3: Auth Flow — Expose `is_admin` in auth middleware & responses

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go:59-69` — Add `IsAdmin` to `UserData` struct
- Modify: `src/go-backend/domain/auth/auth.go:71-86` — Add `IsAdmin` to `userDataToProto`
- Modify: `src/go-backend/domain/auth/auth.go:355-364` — Map `user.IsAdmin` to `UserData`
- Modify: `src/go-backend/handlers/middleware.go:34-37` — Add `is_admin` to gin context

**Security notes:** `is_admin` comes from DB lookup in `VerifyAuth`, not from JWT claims. This prevents token forgery.

**Step 1: Add `IsAdmin` to `UserData` struct**
Add after line 68 in `auth.go`:
```go
IsAdmin              bool      `json:"isAdmin"`
```

**Step 2: Add `IsAdmin` to `userDataToProto` conversion**
Add to the proto conversion at line 76-85:
```go
IsAdmin:              data.IsAdmin,
```

**Step 3: Map `user.IsAdmin` in `VerifyAuth`**
At line 355-364, add to userData creation:
```go
IsAdmin:              user.IsAdmin,
```

**Step 4: Also map in `GetAuth` function** (around line 392+)
Same change — add `IsAdmin: user.IsAdmin` to the userData struct.

**Step 5: Add `is_admin` to gin context in AuthMiddleware**
Modify `middleware.go` line 37, add after `c.Set("user_name", ...)`:
```go
c.Set("is_admin", result.Data.IsAdmin)
```

**Step 6: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**
```
feat(auth): expose is_admin flag in auth middleware and verify/getAuth responses
```

---

### Task 4: Admin Middleware — New middleware for admin-only routes

**Files:**
- Modify: `src/go-backend/handlers/middleware.go` — Add `AdminMiddleware()` function

**Security notes:** Must run after `AuthMiddleware` in the chain. Checks `is_admin` from gin context. Returns 403 (not 401) since user is authenticated but lacks permission.

**Step 1: Add `AdminMiddleware` function**
Add after `AuthMiddleware` function in `middleware.go`:
```go
// AdminMiddleware checks that the authenticated user is an admin.
// Must be used after AuthMiddleware in the middleware chain.
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isAdmin, exists := c.Get("is_admin")
		if !exists || !isAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "Admin access required",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
```

**Step 2: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(middleware): add AdminMiddleware for admin-only route protection
```

---

### Task 5: PriceOverrideCache — Redis cache module

**Files:**
- Create: `src/go-backend/pkg/cache/price_override_cache.go` — Cache module following `gold_price_cache.go` pattern

**Security notes:** No TTL on overrides (persistent). Key pattern prevents collision with existing cache keys.

**Step 1: Create PriceOverrideCache**
Create `src/go-backend/pkg/cache/price_override_cache.go`:

```go
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/go-redis/redis/v8"
)

const (
	PriceOverrideKeyPrefix = "price_override"
)

type PriceOverride struct {
	TypeCode  string `json:"type_code"`
	Name      string `json:"name"`
	Buy       int64  `json:"buy"`
	Sell      int64  `json:"sell"`
	Currency  string `json:"currency"`
	Category  string `json:"category"`
	UpdatedBy int32  `json:"updated_by"`
	UpdatedAt int64  `json:"updated_at"`
}

type PriceOverrideCache struct {
	client *redis.Client
}

func NewPriceOverrideCache(client *redis.Client) *PriceOverrideCache {
	return &PriceOverrideCache{client: client}
}

func (c *PriceOverrideCache) buildKey(category, typeCode, currency string) string {
	return fmt.Sprintf("%s:%s:%s:%s", PriceOverrideKeyPrefix, category, typeCode, currency)
}

func (c *PriceOverrideCache) Set(ctx context.Context, override *PriceOverride) error {
	key := c.buildKey(override.Category, override.TypeCode, override.Currency)
	data, err := json.Marshal(override)
	if err != nil {
		return fmt.Errorf("marshal price override: %w", err)
	}
	return c.client.Set(ctx, key, data, 0).Err() // No TTL
}

func (c *PriceOverrideCache) Get(ctx context.Context, category, typeCode, currency string) (*PriceOverride, error) {
	key := c.buildKey(category, typeCode, currency)
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("get price override: %w", err)
	}
	var override PriceOverride
	if err := json.Unmarshal(data, &override); err != nil {
		return nil, fmt.Errorf("unmarshal price override: %w", err)
	}
	return &override, nil
}

func (c *PriceOverrideCache) Delete(ctx context.Context, category, typeCode, currency string) error {
	key := c.buildKey(category, typeCode, currency)
	return c.client.Del(ctx, key).Err()
}

func (c *PriceOverrideCache) GetAllByCategory(ctx context.Context, category string) ([]*PriceOverride, error) {
	pattern := fmt.Sprintf("%s:%s:*", PriceOverrideKeyPrefix, category)
	return c.scanAndGet(ctx, pattern)
}

func (c *PriceOverrideCache) GetAll(ctx context.Context) ([]*PriceOverride, error) {
	pattern := fmt.Sprintf("%s:*", PriceOverrideKeyPrefix)
	return c.scanAndGet(ctx, pattern)
}

func (c *PriceOverrideCache) scanAndGet(ctx context.Context, pattern string) ([]*PriceOverride, error) {
	var overrides []*PriceOverride
	var cursor uint64
	for {
		keys, nextCursor, err := c.client.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return nil, fmt.Errorf("scan price overrides: %w", err)
		}
		for _, key := range keys {
			data, err := c.client.Get(ctx, key).Bytes()
			if err != nil {
				if err == redis.Nil {
					continue
				}
				return nil, fmt.Errorf("get price override %s: %w", key, err)
			}
			var override PriceOverride
			if err := json.Unmarshal(data, &override); err != nil {
				continue // Skip corrupted entries
			}
			overrides = append(overrides, &override)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return overrides, nil
}
```

**Step 2: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(cache): add PriceOverrideCache for admin price overrides in Redis
```

---

### Task 6: PriceOverrideHandler — Admin API endpoints

**Files:**
- Create: `src/go-backend/handlers/price_override.go` — Handler with Set/List/Delete methods
- Modify: `src/go-backend/handlers/builder.go:12-30` — Add `PriceOverride` to AllHandlers
- Modify: `src/go-backend/handlers/builder.go:91-129` — Wire PriceOverrideHandler in NewHandlers
- Modify: `src/go-backend/handlers/routes.go` — Add admin route group

**Security notes:** All endpoints validate input server-side. Category must be enum value. TypeCode max 50 chars. Currency must be 3 uppercase letters. Buy/sell must be positive.

**Step 1: Create PriceOverrideHandler**
Create `src/go-backend/handlers/price_override.go`:

```go
package handlers

import (
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/pkg/cache"
)

var validCategories = map[string]bool{
	"gold": true, "silver": true, "currency": true, "stock": true,
}

var currencyRegex = regexp.MustCompile(`^[A-Z]{3}$`)

type PriceOverrideHandler struct {
	cache *cache.PriceOverrideCache
}

func NewPriceOverrideHandler(c *cache.PriceOverrideCache) *PriceOverrideHandler {
	return &PriceOverrideHandler{cache: c}
}

type setPriceOverrideRequest struct {
	Category string `json:"category" binding:"required"`
	TypeCode string `json:"typeCode" binding:"required"`
	Currency string `json:"currency" binding:"required"`
	Buy      int64  `json:"buy" binding:"required"`
	Sell     int64  `json:"sell" binding:"required"`
	Name     string `json:"name" binding:"required"`
}

func (h *PriceOverrideHandler) SetPriceOverride(c *gin.Context) {
	var req setPriceOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request: " + err.Error()})
		return
	}

	// Validate category
	if !validCategories[req.Category] {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid category. Must be one of: gold, silver, currency, stock"})
		return
	}

	// Validate typeCode length
	if len(req.TypeCode) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "TypeCode must be 50 characters or less"})
		return
	}

	// Validate currency format
	if !currencyRegex.MatchString(req.Currency) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Currency must be a valid 3-letter ISO 4217 code"})
		return
	}

	// Validate buy/sell positive
	if req.Buy <= 0 || req.Sell <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Buy and sell must be positive values"})
		return
	}

	// Validate name length
	if len(req.Name) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Name must be 100 characters or less"})
		return
	}

	userID := c.GetInt32("user_id")

	override := &cache.PriceOverride{
		TypeCode:  req.TypeCode,
		Name:      req.Name,
		Buy:       req.Buy,
		Sell:      req.Sell,
		Currency:  req.Currency,
		Category:  req.Category,
		UpdatedBy: userID,
		UpdatedAt: time.Now().Unix(),
	}

	if err := h.cache.Set(c.Request.Context(), override); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to save price override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Price override saved",
		"override": override,
	})
}

func (h *PriceOverrideHandler) ListPriceOverrides(c *gin.Context) {
	ctx := c.Request.Context()
	category := c.Query("category")

	var overrides []*cache.PriceOverride
	var err error

	if category != "" {
		if !validCategories[category] {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid category filter"})
			return
		}
		overrides, err = h.cache.GetAllByCategory(ctx, category)
	} else {
		overrides, err = h.cache.GetAll(ctx)
	}

	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to list price overrides"})
		return
	}

	if overrides == nil {
		overrides = []*cache.PriceOverride{}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"overrides": overrides,
	})
}

type deletePriceOverrideRequest struct {
	Category string `json:"category" binding:"required"`
	TypeCode string `json:"typeCode" binding:"required"`
	Currency string `json:"currency" binding:"required"`
}

func (h *PriceOverrideHandler) DeletePriceOverride(c *gin.Context) {
	var req deletePriceOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request: " + err.Error()})
		return
	}

	if err := h.cache.Delete(c.Request.Context(), req.Category, req.TypeCode, req.Currency); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "Failed to delete price override"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Price override removed",
	})
}
```

**Step 2: Add `PriceOverride` to `AllHandlers` struct**
In `builder.go` line 29, add:
```go
PriceOverride *PriceOverrideHandler
```

**Step 3: Wire PriceOverrideHandler in `NewHandlers`**
In `builder.go`, after marketPricesHandler creation (line 63), add:
```go
var priceOverrideHandler *PriceOverrideHandler
if deps.RDB != nil {
    priceOverrideHandler = NewPriceOverrideHandler(
        cache.NewPriceOverrideCache(deps.RDB.GetClient()),
    )
}
```
And in the return struct, add:
```go
PriceOverride: priceOverrideHandler,
```

**Step 4: Add admin routes to `routes.go`**
Add after the gold sentiment protected routes (after line 49):
```go
// Admin routes (auth + admin required)
admin := v1.Group("/admin")
if rateLimiter != nil {
    admin.Use(appmiddleware.RateLimitByUser(rateLimiter))
}
admin.Use(AuthMiddleware(authSrv))
admin.Use(AdminMiddleware())
{
    if h.PriceOverride != nil {
        admin.POST("/price-overrides", h.PriceOverride.SetPriceOverride)
        admin.GET("/price-overrides", h.PriceOverride.ListPriceOverrides)
        admin.DELETE("/price-overrides", h.PriceOverride.DeletePriceOverride)
    }
}
```

**Step 5: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**
```
feat(api): add admin price override handler with set/list/delete endpoints
```

---

### Task 7: Market Prices Merge Logic — Apply overrides to API prices

**Files:**
- Modify: `src/go-backend/handlers/market_prices.go:14-19` — Add `overrideCache` to struct
- Modify: `src/go-backend/handlers/market_prices.go:21-28` — Update constructor
- Modify: `src/go-backend/handlers/market_prices.go:113-143` — Add merge logic after `wg.Wait()`
- Modify: `src/go-backend/handlers/builder.go` — Pass `PriceOverrideCache` to MarketPricesHandler

**Security notes:** Override merge is read-only. Redis failure is gracefully handled (skip overrides, return API-only prices).

**Step 1: Add `overrideCache` to MarketPricesHandler**
Update struct at line 14-19:
```go
type MarketPricesHandler struct {
	goldSvc       service.GoldPriceService
	silverSvc     service.SilverPriceService
	currencySvc   service.CurrencyPriceService
	overrideCache *cache.PriceOverrideCache
}
```

**Step 2: Update constructor**
Update `NewMarketPricesHandler` to accept and store `overrideCache`:
```go
func NewMarketPricesHandler(goldSvc service.GoldPriceService, silverSvc service.SilverPriceService, currencySvc service.CurrencyPriceService, overrideCache *cache.PriceOverrideCache) *MarketPricesHandler {
	return &MarketPricesHandler{
		goldSvc:       goldSvc,
		silverSvc:     silverSvc,
		currencySvc:   currencySvc,
		overrideCache: overrideCache,
	}
}
```

**Step 3: Add merge helper function**
Add a helper to merge overrides into price items:
```go
func (h *MarketPricesHandler) applyOverrides(items []*investmentv1.PriceItem, overrides map[string]*cache.PriceOverride) {
	for _, item := range items {
		key := item.TypeCode + ":" + item.Currency
		if override, ok := overrides[key]; ok {
			item.Buy = override.Buy
			item.Sell = override.Sell
			item.IsOverridden = true
		}
	}
}
```

**Step 4: Add override merge after `wg.Wait()` (line 113)**
After line 113 (`wg.Wait()`), before the error check:
```go
// Apply admin price overrides (graceful — skip if Redis fails)
if h.overrideCache != nil {
    allOverrides, overrideErr := h.overrideCache.GetAll(ctx)
    if overrideErr == nil && len(allOverrides) > 0 {
        // Build lookup map: "typeCode:currency" -> override
        overrideMap := make(map[string]*cache.PriceOverride, len(allOverrides))
        for _, o := range allOverrides {
            overrideMap[o.TypeCode+":"+o.Currency] = o
        }
        h.applyOverrides(goldItems, overrideMap)
        h.applyOverrides(silverItems, overrideMap)
        h.applyOverrides(currencyItems, overrideMap)
    }
}
```

**Step 5: Update builder.go**
Pass the override cache to `NewMarketPricesHandler`:
```go
marketPricesHandler = NewMarketPricesHandler(
    service.NewGoldPriceService(deps.RDB.GetClient()),
    service.NewSilverPriceService(deps.RDB.GetClient()),
    service.NewCurrencyPriceService(deps.RDB.GetClient()),
    cache.NewPriceOverrideCache(deps.RDB.GetClient()),
)
```

**Step 6: Verify compilation**
```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**
```
feat(prices): merge admin price overrides into market prices response
```

---

### Task 8: Frontend Auth State — Add `isAdmin` to auth payload

**Files:**
- Modify: `src/wj-client/features/auth/store/interface.tsx:6-13` — Add `isAdmin` to AuthPayload
- Modify: `src/wj-client/features/auth/hooks/useAuth.ts` — Map `isAdmin` from API response
- Modify: `src/wj-client/features/auth/store/` — Update reducer to handle `isAdmin`

**Security notes:** `isAdmin` is derived from the server response, never from client-side storage manipulation. Used only for UI rendering decisions.

**Step 1: Add `isAdmin` to AuthPayload interface**
In `interface.tsx`, add after line 12:
```typescript
isAdmin?: boolean;
```

**Step 2: Map `isAdmin` from verify/login responses in `useAuth.ts`**
Update the `extractAuthFromResponse` function and the verify/login handlers to pass `isAdmin` from the server response into the auth state.

**Step 3: Update Redux reducer**
Ensure the auth reducer stores and exposes `isAdmin` in the payload.

**Step 4: Verify TypeScript compilation**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 5: Commit**
```
feat(auth): add isAdmin flag to frontend auth state from server response
```

---

### Task 9: Frontend API Hooks — Add price override mutation hooks

**Files:**
- Modify: `src/wj-client/utils/generated/hooks.ts` — Add manual hooks for admin endpoints (or create a separate admin hooks file)
- Create: `src/wj-client/features/market-prices/hooks/usePriceOverride.ts` — Custom hooks for price override CRUD

**Security notes:** Frontend hooks are convenience wrappers; authorization is enforced server-side.

**Step 1: Create price override hooks**
Create `src/wj-client/features/market-prices/hooks/usePriceOverride.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EVENT_InvestmentGetMarketPrices } from "@/utils/generated/hooks";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export function useMutationSetPriceOverride(options?: { onSuccess?: () => void; onError?: (error: Error) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      category: string;
      typeCode: string;
      currency: string;
      buy: number;
      sell: number;
      name: string;
    }) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/v1/admin/price-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to set price override");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}

export function useMutationDeletePriceOverride(options?: { onSuccess?: () => void; onError?: (error: Error) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { category: string; typeCode: string; currency: string }) => {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/v1/admin/price-overrides`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete price override");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_InvestmentGetMarketPrices] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
```

**Step 2: Verify TypeScript compilation**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 3: Commit**
```
feat(hooks): add price override mutation hooks for admin API
```

---

### Task 10: Frontend Inline Edit — Admin price editing on market prices page

**Files:**
- Create: `src/wj-client/features/market-prices/components/InlinePriceEdit.tsx` — Inline edit component
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx` — Integrate inline edit into price tables
- Modify: `src/wj-client/app/[locale]/dashboard/prices/helpers.ts` — Add override-related helpers
- Modify: `src/wj-client/messages/en/ui.json` — Add i18n keys
- Modify: `src/wj-client/messages/vi/ui.json` — Add Vietnamese i18n keys

**Security notes:** `isAdmin` check is UI-only (convenience). Server enforces authorization.

**Step 1: Create InlinePriceEdit component**
Create `src/wj-client/features/market-prices/components/InlinePriceEdit.tsx`:
- Edit mode toggle (pencil icon → input fields + save/cancel)
- Uses `useMutationSetPriceOverride` and `useMutationDeletePriceOverride`
- Loading state during save/delete
- Toast notifications for success/error
- Override indicator badge (blue dot) when `isOverridden` is true
- Click badge to remove override (with confirmation)

**Step 2: Integrate into price table columns**
Modify `page.tsx` to:
- Read `isAdmin` from auth state
- Pass `isAdmin` as prop to table column definitions
- Add edit column (pencil icon) visible only to admin
- Add override indicator to rows where `isOverridden === true`
- Handle both desktop (TanStackTable) and mobile (MobileTable)

**Step 3: Add i18n keys**
Add to both `en/ui.json` and `vi/ui.json`:
```json
"priceOverride": "Override",
"priceOverrideSaved": "Price override saved",
"priceOverrideRemoved": "Price override removed",
"priceOverrideConfirmRemove": "Remove this price override?",
"priceOverrideEdit": "Edit Price",
"priceOverrideSave": "Save",
"priceOverrideCancel": "Cancel"
```

**Step 4: Verify TypeScript compilation and visual check**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 5: Commit**
```
feat(ui): add inline price editing for admin users on market prices page
```

---

### Task 11: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Add `PriceOverrideCache` component to backend Cache layer
2. Add `PriceOverrideHandler` component to backend Handlers layer
3. Add `AdminMiddleware` component to backend Middleware layer
4. Add relationships: `PriceOverrideHandler → PriceOverrideCache`, `MarketPricesHandler → PriceOverrideCache`
5. Add inline edit component reference to frontend Market Prices module

**Commit:**
```
docs(architecture): update C4 diagrams for admin price override feature
```

---

### Task 12: Create/Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md` — Add admin price override sequence diagram

**Steps:**
1. Add sequence diagram: Admin → Frontend → POST /admin/price-overrides → AuthMiddleware → AdminMiddleware → PriceOverrideHandler → PriceOverrideCache (Redis)
2. Add sequence diagram: User → GET /market-prices → MarketPricesHandler → [parallel: API fetch + override fetch] → merge → response
3. Include error/alt paths (Redis unavailable, non-admin attempt)
4. Add "Key Invariants" and "Error Paths" table

**Commit:**
```
docs(architecture): add admin price override flow diagrams
```

---

## Task Dependencies

```
Task 1 (Proto) ──────────────────────────────────┐
Task 2 (User Model) ────────────────────┐        │
Task 3 (Auth Flow) ← depends on 1,2     │        │
Task 4 (Admin Middleware) ← depends on 3 │        │
Task 5 (Cache Module) ───────────────────┤        │
Task 6 (Handler) ← depends on 4,5       │        │
Task 7 (Merge Logic) ← depends on 5,6   │        │
Task 8 (Frontend Auth) ← depends on 1,3 │        │
Task 9 (Frontend Hooks) ← depends on 6  │        │
Task 10 (Frontend UI) ← depends on 8,9  │        │
Task 11 (C4 Diagrams) ← depends on 7    │        │
Task 12 (Flow Diagrams) ← depends on 7  │        │
```

**Parallel opportunities:**
- Tasks 1 + 2 can run in parallel (no shared files)
- Tasks 4 + 5 can run in parallel after Task 3 (no shared files)
- Tasks 8 + 9 can partially overlap
- Tasks 11 + 12 can run in parallel (different docs files)
