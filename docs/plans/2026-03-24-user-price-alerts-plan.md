# User Price Alerts — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Allow users to create custom price alerts (gold, silver, stocks/crypto/ETFs) that evaluate every 15 minutes and deliver in-app + push notifications when conditions are met.

**Spec:** `docs/specs/2026-03-24-user-price-alerts-spec.md`

**Architecture:** New `UserPriceAlert` domain following DDD pattern (model → repository → service → handler). Background evaluation job groups alerts by symbol for efficient cached price lookups. Frontend adds a new `features/price-alert/` module with 3-step progressive disclosure form (like AddInvestmentForm), a settings management page at `/dashboard/settings/alerts`, and entry points on Prices + Portfolio pages.

**Tech Stack:** Go 1.23 (Gin, GORM), PostgreSQL, Redis (cooldowns), Protocol Buffers, Next.js 15, React 19, TypeScript, Tailwind CSS, React Query.

## Security Implementation Notes

- **Authentication:** All endpoints behind `AuthMiddleware(authSrv)` — JWT required
- **Authorization:** `user_id` extracted from JWT in handler; all repository queries include `WHERE user_id = ?`; update/delete use `GetByIDForUser()` — return 404 (not 403) on ownership mismatch to avoid leaking existence
- **Input validation:** Server-side validation on all fields (symbol length/chars, price > 0, enum checks, cooldown range 2–168h); max 30 active alerts per user enforced via DB count in transaction
- **Data sanitization:** `note` field HTML-stripped and trimmed server-side; no user strings reflected in push payloads without sanitization
- **Rate limiting:** `appmiddleware.RateLimitByUser(rateLimiter)` on all endpoints

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| BaseModal | `components/modals/BaseModal.tsx` | Wrapping CreatePriceAlertForm |
| Success | `components/modals/Success.tsx` | Post-creation success state |
| ConfirmationDialog | `components/modals/ConfirmationDialog.tsx` | Delete alert confirmation |
| FormNumberInput | `components/forms/FormNumberInput.tsx` | Target price input with thousand separator |
| FormSelect | `components/forms/FormSelect.tsx` | Gold/silver type dropdown, direction, trigger mode |
| FormInput | `components/forms/FormInput.tsx` | Note field |
| Button | `components/Button.tsx` | Submit, delete, toggle actions |
| MobileTable | `components/table/MobileTable.tsx` | Alert list on mobile |
| EmptyState | `components/feedback/EmptyState.tsx` | No alerts state |
| LoadingSpinner | `components/loading/LoadingSpinner.tsx` | Loading states |
| NotificationItem | `components/notifications/NotificationItem.tsx` | Render `user_price_alert` notification type |
| SymbolAutocomplete | `features/investment/components/SymbolAutocomplete.tsx` | Symbol search for "Other Assets" |
| goldTypeOptions (GOLD_VND_OPTIONS) | `features/investment/utils/gold-calculator.ts` | Gold type dropdown options |
| silverTypeOptions (SILVER_VND_OPTIONS) | `features/investment/utils/silver-calculator.ts` | Silver type dropdown options |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| CreatePriceAlertForm | `features/price-alert/forms/CreatePriceAlertForm.tsx` | New feature-specific form with 3-step progressive disclosure, conditional price side selector, current price reference — no existing form provides this |
| PriceAlertList | `features/price-alert/components/PriceAlertList.tsx` | Alert management table with status badges, toggle, delete — feature-specific rendering logic |
| AlertStatusBadge | `features/price-alert/components/AlertStatusBadge.tsx` | Small colored status indicator (active/triggered/paused) — 10 lines, feature-specific styling |

## C4 Architecture Diagram Updates

Per spec section "Architecture Changes (C4)":
1. **c4-component-backend.md** — Add `UserPriceAlertRepository` (Repository layer), `UserPriceAlertService` (Service layer), `UserPriceAlertHandlers` (Handler layer), plus relationships to existing MarketDataService, GoldPriceService, SilverPriceService, NotificationRepository, PushService
2. **c4-component-frontend.md** — Add `features/price-alert/` module, settings sub-page `/dashboard/settings/alerts`, "Set Alert" buttons on Prices + Portfolio pages

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Add `UserPriceAlertRepository`, `UserPriceAlertService`, `UserPriceAlertHandlers` components to backend diagram
2. Add relationships: `UserPriceAlertService → MarketDataService`, `→ GoldPriceService`, `→ SilverPriceService`, `→ NotificationRepository`, `→ PushService`
3. Add `features/price-alert/` module and `/dashboard/settings/alerts` page to frontend diagram
4. Add "Set Alert" entry points on Prices page and Portfolio page
5. Commit diagram changes

---

### Task 1: Protobuf API Definition

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** No security-sensitive changes — this is type definitions only.

**Step 1: Add proto enums and messages**

Add after existing investment messages in `investment.proto`:

```protobuf
// ── User Price Alert Enums ──

enum AlertDirection {
  ALERT_DIRECTION_UNSPECIFIED = 0;
  ALERT_DIRECTION_ABOVE = 1;
  ALERT_DIRECTION_BELOW = 2;
}

enum AlertTriggerMode {
  ALERT_TRIGGER_MODE_UNSPECIFIED = 0;
  ALERT_TRIGGER_MODE_ONCE = 1;
  ALERT_TRIGGER_MODE_REPEAT = 2;
}

enum AlertStatus {
  ALERT_STATUS_UNSPECIFIED = 0;
  ALERT_STATUS_ACTIVE = 1;
  ALERT_STATUS_TRIGGERED = 2;
  ALERT_STATUS_PAUSED = 3;
}

// ── User Price Alert Messages ──

message UserPriceAlert {
  int32 id = 1 [json_name = "id"];
  int32 user_id = 2 [json_name = "userId"];
  string symbol = 3 [json_name = "symbol"];
  string name = 4 [json_name = "name"];
  InvestmentType asset_type = 5 [json_name = "assetType"];
  string currency = 6 [json_name = "currency"];
  string price_side = 7 [json_name = "priceSide"];
  AlertDirection direction = 8 [json_name = "direction"];
  int64 target_price = 9 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 10 [json_name = "triggerMode"];
  int32 cooldown_hours = 11 [json_name = "cooldownHours"];
  AlertStatus status = 12 [json_name = "status"];
  string note = 13 [json_name = "note"];
  int64 last_triggered_at = 14 [json_name = "lastTriggeredAt"];
  int32 trigger_count = 15 [json_name = "triggerCount"];
  int64 current_price_at_creation = 16 [json_name = "currentPriceAtCreation"];
  int64 current_price = 17 [json_name = "currentPrice"];
  int64 created_at = 18 [json_name = "createdAt"];
}

message CreateUserPriceAlertRequest {
  string symbol = 1 [json_name = "symbol"];
  string name = 2 [json_name = "name"];
  InvestmentType asset_type = 3 [json_name = "assetType"];
  string currency = 4 [json_name = "currency"];
  string price_side = 5 [json_name = "priceSide"];
  AlertDirection direction = 6 [json_name = "direction"];
  int64 target_price = 7 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 8 [json_name = "triggerMode"];
  int32 cooldown_hours = 9 [json_name = "cooldownHours"];
  string note = 10 [json_name = "note"];
}

message CreateUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  UserPriceAlert alert = 3 [json_name = "alert"];
  string timestamp = 4 [json_name = "timestamp"];
}

message ListUserPriceAlertsRequest {
  string status_filter = 1 [json_name = "statusFilter"];
  Pagination pagination = 2 [json_name = "pagination"];
}

message ListUserPriceAlertsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated UserPriceAlert alerts = 3 [json_name = "alerts"];
  int32 total = 4 [json_name = "total"];
  string timestamp = 5 [json_name = "timestamp"];
}

message UpdateUserPriceAlertRequest {
  int64 target_price = 1 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 2 [json_name = "triggerMode"];
  int32 cooldown_hours = 3 [json_name = "cooldownHours"];
  string note = 4 [json_name = "note"];
  AlertStatus status = 5 [json_name = "status"];
}

message UpdateUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  UserPriceAlert alert = 3 [json_name = "alert"];
  string timestamp = 4 [json_name = "timestamp"];
}

message DeleteUserPriceAlertRequest {}

message DeleteUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}
```

Add RPCs to `InvestmentService`:

```protobuf
rpc CreateUserPriceAlert(CreateUserPriceAlertRequest) returns (CreateUserPriceAlertResponse) {
  option (google.api.http) = { post: "/api/v1/price-alerts" body: "*" };
}
rpc ListUserPriceAlerts(ListUserPriceAlertsRequest) returns (ListUserPriceAlertsResponse) {
  option (google.api.http) = { get: "/api/v1/price-alerts" };
}
rpc UpdateUserPriceAlert(UpdateUserPriceAlertRequest) returns (UpdateUserPriceAlertResponse) {
  option (google.api.http) = { put: "/api/v1/price-alerts/{id}" body: "*" };
}
rpc DeleteUserPriceAlert(DeleteUserPriceAlertRequest) returns (DeleteUserPriceAlertResponse) {
  option (google.api.http) = { delete: "/api/v1/price-alerts/{id}" };
}
```

**Step 2: Generate code**

```bash
task proto:all
```

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

```
feat(proto): add user price alert messages and RPCs to investment.proto
```

---

### Task 2: Database Model + Migration

**Files:**
- Create: `src/go-backend/domain/models/user_price_alert.go`
- Create: `src/go-backend/cmd/migrate-user-price-alerts/main.go`

**Security notes:** All string fields have size constraints. Soft delete enabled. Composite indexes for ownership queries.

**Step 1: Create GORM model**

```go
// src/go-backend/domain/models/user_price_alert.go
package models

import (
	"time"

	v1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
)

type UserPriceAlert struct {
	ID                    int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                int32          `gorm:"not null;index:idx_user_price_alert_user_status" json:"userId"`
	Symbol                string         `gorm:"size:50;not null;index:idx_user_price_alert_symbol" json:"symbol"`
	Name                  string         `gorm:"size:200;not null" json:"name"`
	AssetType             int32          `gorm:"not null" json:"assetType"`
	Currency              string         `gorm:"size:3;not null" json:"currency"`
	PriceSide             string         `gorm:"size:4;not null;default:'buy'" json:"priceSide"`
	Direction             string         `gorm:"size:5;not null" json:"direction"`
	TargetPrice           int64          `gorm:"type:bigint;not null" json:"targetPrice"`
	TriggerMode           string         `gorm:"size:10;not null;default:'once'" json:"triggerMode"`
	CooldownHours         int32          `gorm:"default:4" json:"cooldownHours"`
	Status                string         `gorm:"size:10;not null;default:'active';index:idx_user_price_alert_user_status;index:idx_user_price_alert_status" json:"status"`
	Note                  string         `gorm:"size:200" json:"note"`
	LastTriggeredAt       *time.Time     `json:"lastTriggeredAt"`
	TriggerCount          int32          `gorm:"default:0" json:"triggerCount"`
	CurrentPriceAtCreation int64         `gorm:"type:bigint;not null" json:"currentPriceAtCreation"`
	CreatedAt             time.Time      `json:"createdAt"`
	UpdatedAt             time.Time      `json:"updatedAt"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`
	User                  *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (UserPriceAlert) TableName() string {
	return "user_price_alert"
}

// ToProto converts the model to protobuf response message.
func (a *UserPriceAlert) ToProto() *v1.UserPriceAlert {
	proto := &v1.UserPriceAlert{
		Id:                    a.ID,
		UserId:                a.UserID,
		Symbol:                a.Symbol,
		Name:                  a.Name,
		AssetType:             v1.InvestmentType(a.AssetType),
		Currency:              a.Currency,
		PriceSide:             a.PriceSide,
		Direction:             directionToProto(a.Direction),
		TargetPrice:           a.TargetPrice,
		TriggerMode:           triggerModeToProto(a.TriggerMode),
		CooldownHours:         a.CooldownHours,
		Status:                statusToProto(a.Status),
		Note:                  a.Note,
		TriggerCount:          a.TriggerCount,
		CurrentPriceAtCreation: a.CurrentPriceAtCreation,
		CreatedAt:             a.CreatedAt.Unix(),
	}
	if a.LastTriggeredAt != nil {
		proto.LastTriggeredAt = a.LastTriggeredAt.Unix()
	}
	return proto
}

func directionToProto(d string) v1.AlertDirection {
	switch d {
	case "above":
		return v1.AlertDirection_ALERT_DIRECTION_ABOVE
	case "below":
		return v1.AlertDirection_ALERT_DIRECTION_BELOW
	default:
		return v1.AlertDirection_ALERT_DIRECTION_UNSPECIFIED
	}
}

func triggerModeToProto(m string) v1.AlertTriggerMode {
	switch m {
	case "once":
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE
	case "repeat":
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT
	default:
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED
	}
}

func statusToProto(s string) v1.AlertStatus {
	switch s {
	case "active":
		return v1.AlertStatus_ALERT_STATUS_ACTIVE
	case "triggered":
		return v1.AlertStatus_ALERT_STATUS_TRIGGERED
	case "paused":
		return v1.AlertStatus_ALERT_STATUS_PAUSED
	default:
		return v1.AlertStatus_ALERT_STATUS_UNSPECIFIED
	}
}
```

**Step 2: Create migration command**

```go
// src/go-backend/cmd/migrate-user-price-alerts/main.go
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

	log.Println("=== User Price Alerts Migration ===")

	if err := db.DB.AutoMigrate(&models.UserPriceAlert{}); err != nil {
		log.Fatalf("Failed to create user_price_alert table: %v", err)
	}

	log.Println("user_price_alert table created with indexes")
	log.Println("=== User Price Alerts Migration Complete ===")
}
```

**Step 3: Add Taskfile entry**

Add to `Taskfile.yml`:
```yaml
backend:migrate-user-price-alerts:
  desc: Create user_price_alert table
  dir: src/go-backend
  cmd: go run cmd/migrate-user-price-alerts/main.go
```

**Step 4: Run migration**

```bash
task backend:migrate-user-price-alerts
```

**Step 5: Commit**

```
feat(db): add user_price_alert model and migration
```

---

### Task 3: Repository Layer

**Files:**
- Create: `src/go-backend/domain/repository/user_price_alert_repository.go`

**Security notes:** All queries include `user_id` filter for ownership. Use GORM parameterized queries only.

**Step 1: Create repository interface + implementation**

Interface methods:
- `Create(ctx, alert) error`
- `GetByIDForUser(ctx, id, userID) (*UserPriceAlert, error)` — ownership-scoped
- `ListByUserID(ctx, userID, statusFilter, pagination) ([]*UserPriceAlert, int64, error)`
- `Update(ctx, alert) error`
- `Delete(ctx, id, userID) error` — soft delete, ownership-scoped
- `CountActiveByUserID(ctx, userID) (int64, error)` — for 30-alert limit
- `ListActive(ctx) ([]*UserPriceAlert, error)` — for evaluation job
- `UpdateStatus(ctx, id, status, lastTriggeredAt, triggerCount) error` — for evaluation job

Follow existing patterns from `notification_repository.go`:
- Struct extends `*BaseRepository`
- Constructor: `NewUserPriceAlertRepository(db *database.Database) UserPriceAlertRepository`
- Use `r.db.DB.WithContext(ctx)` on all queries
- Use `r.handleDBError(err, "user_price_alert", "operation")` for error wrapping

**Step 2: Wire in providers**

Add to `service.Repositories` struct in `services.go`:
```go
UserPriceAlert repository.UserPriceAlertRepository
```

Add to `ProvideRepositories()` in `internal/app/providers.go`:
```go
UserPriceAlert: repository.NewUserPriceAlertRepository(db),
```

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

```
feat(repo): add UserPriceAlertRepository with CRUD and evaluation queries
```

---

### Task 4: Service Layer — CRUD Operations

**Files:**
- Modify: `src/go-backend/domain/service/interfaces.go` — add `UserPriceAlertService` interface
- Create: `src/go-backend/domain/service/user_price_alert_service.go` — implementation
- Modify: `src/go-backend/domain/service/services.go` — add to `Services` struct + wire in `NewServices()`

**Security notes:**
- `CreateAlert`: Validate all inputs server-side; enforce max 30 alerts via `CountActiveByUserID` inside transaction; sanitize `note` (strip HTML, trim, max 200 chars); fetch current price for `current_price_at_creation`
- `UpdateAlert`/`DeleteAlert`: Ownership check via `GetByIDForUser()` — return `NotFoundError` (not `ForbiddenError`) to avoid leaking existence
- Never trust `user_id` from request body — always extract from JWT context

**Step 1: Add interface to interfaces.go**

```go
// UserPriceAlertService handles user price alert CRUD and evaluation.
type UserPriceAlertService interface {
	CreateAlert(ctx context.Context, userID int32, req *v1.CreateUserPriceAlertRequest) (*v1.CreateUserPriceAlertResponse, error)
	ListAlerts(ctx context.Context, userID int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error)
	UpdateAlert(ctx context.Context, alertID int32, userID int32, req *v1.UpdateUserPriceAlertRequest) (*v1.UpdateUserPriceAlertResponse, error)
	DeleteAlert(ctx context.Context, alertID int32, userID int32) (*v1.DeleteUserPriceAlertResponse, error)
	EvaluateAlerts(ctx context.Context) error
}
```

**Step 2: Implement CRUD service**

Constructor dependencies:
- `alertRepo repository.UserPriceAlertRepository`
- `goldPriceSvc GoldPriceService` — for current price reference on creation + evaluation
- `silverPriceSvc SilverPriceService` — same
- `marketDataSvc MarketDataService` — for stock/crypto current price
- `notifRepo repository.NotificationRepository` — for creating notifications on trigger
- `pushSvc PushService` — for web push on trigger
- `rdb *pkgredis.RedisClient` — for cooldown tracking + daily cap + SSE publish

Key logic in `CreateAlert`:
1. Validate inputs (symbol non-empty, direction enum, price > 0, cooldown range)
2. Sanitize note (trim, strip HTML, max 200 chars)
3. Count active alerts for user — fail if >= 30
4. Determine current price based on asset type:
   - Gold (type 8): `goldPriceSvc.FetchAllPrices()` → find by symbol → use buy/sell based on `price_side`
   - Silver (type 10): `silverPriceSvc.FetchAllPrices()` → find by symbol → use buy/sell
   - Other: `marketDataSvc.GetPrice()` with symbol + currency
5. Create model, persist, return response

**Step 3: Wire in services.go**

Add to `Services` struct:
```go
UserPriceAlert UserPriceAlertService
```

In `NewServices()`, create after Phase 1 services (gold/silver/market data already exist):
```go
var userPriceAlertSvc UserPriceAlertService
if rdb != nil {
    userPriceAlertSvc = NewUserPriceAlertService(
        repos.UserPriceAlert,
        goldPriceSvc,
        silverPriceSvc,
        marketDataSvc,
        repos.Notification,
        pushSvc,
        rdb,
    )
}
```

Add to return struct:
```go
UserPriceAlert: userPriceAlertSvc,
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

```
feat(service): add UserPriceAlertService with CRUD operations
```

---

### Task 5: REST Handler + Routes

**Files:**
- Create: `src/go-backend/handlers/user_price_alert.go`
- Modify: `src/go-backend/handlers/builder.go` — add to `AllHandlers` + `NewHandlers()`
- Modify: `src/go-backend/handlers/routes.go` — register routes

**Security notes:** All routes behind `AuthMiddleware`. Extract `userID` via `handler.GetUserID(c)`. Parse `:id` param as int32. Rate limiting per user.

**Step 1: Create handler**

```go
type UserPriceAlertHandlers struct {
    alertService service.UserPriceAlertService
}

func NewUserPriceAlertHandlers(alertService service.UserPriceAlertService) *UserPriceAlertHandlers {
    return &UserPriceAlertHandlers{alertService: alertService}
}
```

Methods: `CreateAlert`, `ListAlerts`, `UpdateAlert`, `DeleteAlert` — follow investment handler pattern with `gin.H{}` responses.

**Step 2: Wire in builder.go**

Add to `AllHandlers`:
```go
UserPriceAlert *UserPriceAlertHandlers
```

In `NewHandlers()`:
```go
UserPriceAlert: func() *UserPriceAlertHandlers {
    if services.UserPriceAlert != nil {
        return NewUserPriceAlertHandlers(services.UserPriceAlert)
    }
    return nil
}(),
```

**Step 3: Register routes in routes.go**

Add after investments section:
```go
// User price alerts (protected)
priceAlerts := v1.Group("/price-alerts")
if rateLimiter != nil {
    priceAlerts.Use(appmiddleware.RateLimitByUser(rateLimiter))
}
priceAlerts.Use(AuthMiddleware(authSrv))
{
    if h.UserPriceAlert != nil {
        priceAlerts.POST("", h.UserPriceAlert.CreateAlert)
        priceAlerts.GET("", h.UserPriceAlert.ListAlerts)
        priceAlerts.PUT("/:id", h.UserPriceAlert.UpdateAlert)
        priceAlerts.DELETE("/:id", h.UserPriceAlert.DeleteAlert)
    }
}
```

**Step 4: Verify compilation + test endpoint manually**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

```
feat(handler): add user price alert REST endpoints with auth + rate limiting
```

---

### Task 6: Background Evaluation Job

**Files:**
- Create: `src/go-backend/internal/scheduler/user_price_alert_job.go`
- Modify: `src/go-backend/internal/app/providers.go` — register job in `ProvideScheduler()`
- Implement: `EvaluateAlerts()` method in `user_price_alert_service.go`

**Security notes:** Job runs as system — no user context needed. Daily notification cap (100/user/day) tracked in Redis. Cooldown per alert in Redis. Never deactivate alerts on price fetch failure — just skip + log.

**Step 1: Create scheduler job**

Follow `price_alert_job.go` pattern:
```go
type UserPriceAlertJob struct {
    alertService service.UserPriceAlertService
}

func NewUserPriceAlertJob(alertService service.UserPriceAlertService) *UserPriceAlertJob {
    return &UserPriceAlertJob{alertService: alertService}
}

func (j *UserPriceAlertJob) Name() string              { return "user-price-alert" }
func (j *UserPriceAlertJob) Interval() time.Duration    { return 15 * time.Minute }
func (j *UserPriceAlertJob) StartupDelay() time.Duration { return 45 * time.Second }
```

**Step 2: Implement `EvaluateAlerts()` in service**

Algorithm:
1. Fetch all active alerts via `alertRepo.ListActive(ctx)`
2. Group alerts by asset type + symbol for batched price fetching
3. Fetch prices:
   - Gold alerts: `goldPriceSvc.FetchAllPrices()` → map by TypeCode
   - Silver alerts: `silverPriceSvc.FetchAllPrices()` → map by TypeCode
   - Other assets: `marketDataSvc.GetPrice()` per unique symbol (already cached 15m)
4. For each alert:
   - Determine current price (buy/sell based on `price_side` for gold/silver)
   - Compare: "above" triggers when `currentPrice >= targetPrice`; "below" triggers when `currentPrice <= targetPrice`
   - If triggered:
     - Check Redis cooldown key `user_price_alert:cooldown:{alertID}` — skip if exists
     - Check Redis daily cap `user_price_alert:daily:{userID}` — skip if >= 100
     - Create notification via `notifRepo.Create()` with type `"user_price_alert"` and metadata JSON
     - Send push via `pushSvc.SendToUser()`
     - Publish SSE via Redis `PUBLISH user:{userID}:notifications`
     - Update alert status: one-shot → "triggered"; repeating → set cooldown key with TTL
     - Increment daily counter (TTL = 24h)
     - Increment `trigger_count`, set `last_triggered_at`
5. Log summary: total checked, triggered, skipped (cooldown), skipped (daily cap), errors

**Step 3: Register in scheduler**

In `ProvideScheduler()` in `providers.go`:
```go
if services.UserPriceAlert != nil {
    backgroundJobs = append(backgroundJobs, scheduler.NewUserPriceAlertJob(services.UserPriceAlert))
}
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

```
feat(scheduler): add UserPriceAlertJob for 15-minute evaluation cycle
```

---

### Task 7: Notification Delivery Integration

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go` — notification creation within EvaluateAlerts
- Modify (frontend): `src/wj-client/components/notifications/NotificationItem.tsx` — render `user_price_alert` type

**Security notes:** Push payload only includes symbol name and price (public market data). No portfolio details, no user notes in push. In-app notification metadata includes alert ID for navigation.

**Step 1: Define notification metadata shape**

```go
// In-app notification metadata
metadata := map[string]interface{}{
    "alertId":     alert.ID,
    "symbol":      alert.Symbol,
    "direction":   alert.Direction,
    "targetPrice": alert.TargetPrice,
    "currentPrice": currentPrice,
    "priceSide":   alert.PriceSide,
    "currency":    alert.Currency,
}
```

**Step 2: Push notification format**

- Title: `"{name} price alert"` (e.g., "SJC 1L-10L price alert")
- Body: `"{name} {direction} {formattedTarget} — now at {formattedCurrent}"` (e.g., "SJC 1L-10L above 85,000,000 — now at 85,200,000")
- URL: `/dashboard/settings/alerts`

**Step 3: Update NotificationItem.tsx**

Add `user_price_alert` type handling alongside existing `price_alert` type:
- Icon: bell icon with direction arrow (↑ above, ↓ below)
- Color: amber/gold accent (similar to existing `price_alert`)
- Title: `"{symbol} price alert triggered"`
- Body: `"{direction} {targetPrice} — now at {currentPrice}"`
- Click: navigate to `/dashboard/settings/alerts`

**Step 4: Commit**

```
feat(notifications): add user_price_alert notification rendering
```

---

### Task 8: Frontend — CreatePriceAlertForm Component

**Files:**
- Create: `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx`
- Create: `src/wj-client/features/price-alert/utils/price-alert-validation.ts`

**Security notes:** Client-side Zod validation mirrors server-side rules. All values re-validated server-side.

**Step 0: Component inventory check (MANDATORY)**
- Reusing: `BaseModal`, `FormSelect`, `FormNumberInput`, `FormInput`, `Button`, `Success`, `SymbolAutocomplete`
- Reusing: `GOLD_VND_OPTIONS` from `features/investment/utils/gold-calculator.ts`
- Reusing: `SILVER_VND_OPTIONS` from `features/investment/utils/silver-calculator.ts`
- Creating new: `CreatePriceAlertForm` — 3-step progressive disclosure, conditional price side, current price reference — unique form logic

**Step 1: Create validation schema**

```typescript
// features/price-alert/utils/price-alert-validation.ts
import { z } from "zod";

export const createPriceAlertSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(50),
  name: z.string().min(1, "Name is required").max(200),
  assetType: z.number().min(1, "Asset type is required"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  priceSide: z.enum(["buy", "sell"]),
  direction: z.enum(["above", "below"]),
  targetPrice: z.number().positive("Target price must be positive"),
  triggerMode: z.enum(["once", "repeat"]),
  cooldownHours: z.number().min(2).max(168).optional(),
  note: z.string().max(200).optional(),
});
```

**Step 2: Build form component**

Props:
```typescript
interface CreatePriceAlertFormProps {
  onSuccess?: () => void;
  // Pre-fill props (from Prices page or Portfolio page)
  defaultCategory?: "gold" | "silver" | "other";
  defaultSymbol?: string;
  defaultName?: string;
  defaultAssetType?: number;
  defaultCurrency?: string;
}
```

3-step progressive disclosure:
1. **Asset category**: Toggle buttons (Gold | Silver | Other Assets)
2. **Symbol selection**: Gold → `FormSelect` with `GOLD_VND_OPTIONS`; Silver → `FormSelect` with `SILVER_VND_OPTIONS`; Other → `SymbolAutocomplete`
3. **Alert config**: Price side (gold/silver only), direction, target price (FormNumberInput), trigger mode, cooldown (repeat only), note

Show current price reference below target price input.

Use `useMutationCreateUserPriceAlert` (auto-generated after proto step).

**Step 3: Responsive & accessibility check**
- Mobile (375px): Full-width form, stacked fields, touch targets >= 44px
- Desktop (800px+): Same layout (form is already narrow)
- All interactive elements have labels and proper ARIA attributes

**Step 4: Commit**

```
feat(frontend): add CreatePriceAlertForm with 3-step progressive disclosure
```

---

### Task 9: Frontend — Settings Alerts Page

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/settings/alerts/page.tsx`
- Create: `src/wj-client/features/price-alert/components/PriceAlertList.tsx`
- Create: `src/wj-client/features/price-alert/components/AlertStatusBadge.tsx`

**Security notes:** No sensitive data displayed. Alert list is user-scoped by JWT.

**Step 0: Component inventory check (MANDATORY)**
- Reusing: `MobileTable`, `EmptyState`, `Button`, `BaseModal`, `ConfirmationDialog`, `LoadingSpinner`
- Creating new: `PriceAlertList` (feature-specific table with status badges + toggle/delete actions), `AlertStatusBadge` (10-line badge)

**Step 1: Create AlertStatusBadge**

Small component: green dot for "active", gray for "triggered", orange for "paused".

**Step 2: Create PriceAlertList**

Uses `MobileTable` on mobile, desktop table on `sm:` breakpoint.
Columns: Symbol/Name, Direction + Target, Current Price, Trigger Mode, Status, Actions (toggle active/inactive, delete).
`renderActions` provides toggle + delete buttons.
Uses `useQueryListUserPriceAlerts` for data fetching.
Uses `useMutationUpdateUserPriceAlert` for status toggle.
Uses `useMutationDeleteUserPriceAlert` for deletion (with ConfirmationDialog).

**Step 3: Create settings page**

Page at `/dashboard/settings/alerts`:
- Title: "Price Alerts"
- "Create Alert" button (opens CreatePriceAlertForm in BaseModal)
- PriceAlertList component
- EmptyState when no alerts
- Status filter tabs/dropdown (All | Active | Triggered)

**Step 4: Add link on main settings page**

Modify `src/wj-client/app/[locale]/dashboard/settings/page.tsx` — add "Price Alerts" card/link with bell icon.

**Step 5: Responsive check**
- Mobile: Single-column layout, MobileTable for alerts
- Desktop: Wider layout with full table

**Step 6: Commit**

```
feat(frontend): add price alerts settings page with list and management
```

---

### Task 10: Frontend — Prices Page Entry Point

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**Security notes:** No new security concerns — just UI entry point to existing modal.

**Step 1: Add "Set Alert" button/icon to price tables**

For Gold/Silver tabs: Add a bell icon button in each row's action column. On click, open CreatePriceAlertForm modal pre-filled:
- Gold tab → `defaultCategory="gold"`, `defaultSymbol` = row's typeCode, `defaultName` = row's name, `defaultAssetType` = 8, `defaultCurrency` = "VND"
- Silver tab → same pattern with `defaultCategory="silver"`, `defaultAssetType` = 10

For Symbol Lookup tab: After price is displayed, add "Set Alert" button:
- `defaultCategory="other"`, `defaultSymbol` = searched symbol, pre-fill from search result

**Step 2: Add modal state**

Add `SET_PRICE_ALERT` modal type to prices page state.
Track `selectedPriceItem` for pre-filling the form.

**Step 3: Commit**

```
feat(frontend): add "Set Alert" entry points on Prices page tabs
```

---

### Task 11: Frontend — Portfolio Page Entry Point

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`

**Security notes:** No new security concerns — just UI entry point.

**Step 1: Add "Set Alert" action to investment cards**

Add "Set Alert" option alongside existing quick actions (Buy More, Sell, Edit).
On click, open CreatePriceAlertForm modal pre-filled based on the investment:
- Gold/silver investments → `defaultCategory` auto-set, type pre-selected
- Stock/crypto/ETF investments → `defaultCategory="other"`, symbol pre-filled

**Step 2: Add modal state**

Add `SET_PRICE_ALERT` to portfolio page modal types.

**Step 3: Commit**

```
feat(frontend): add "Set Alert" action on Portfolio page investment cards
```

---

### Task 12: Frontend — Constants + ModalType Updates

**Files:**
- Modify: `src/wj-client/app/constants.tsx`

**Step 1: Add new ModalType entries**

```typescript
CREATE_PRICE_ALERT: "Create Price Alert",
```

**Step 2: Commit**

```
feat(frontend): add CREATE_PRICE_ALERT modal type constant
```

---

### Task 13: Create Runtime Flow Diagrams

**Files:**
- Create: `docs/architecture/flow-user-price-alert.md`
- Modify: `docs/architecture/README.md` — add to Dynamic Behavior Diagrams table

**Steps:**

1. Create flow diagrams for:
   - **Create Alert flow**: User → REST Handler → Service (validate, check limits, fetch current price) → Repository (save) → Response
   - **Alert Evaluation flow**: Scheduler → UserPriceAlertJob → UserPriceAlertService.EvaluateAlerts() → [group by type] → Price fetch (cache-first) → Compare → Trigger notification → Update alert status
   - **Notification flow**: Service → NotificationRepository.Create() → PushService.SendToUser() → Redis PUBLISH (SSE)

2. Include Key Invariants:
   - Max 30 active alerts per user
   - One-shot alerts auto-deactivate after firing
   - Repeating alerts respect cooldown (min 2h)
   - Daily notification cap: 100 per user
   - Price fetch failure → skip, don't deactivate
   - Ownership enforced on all CRUD operations

3. Include Error Paths table

4. Update README.md to list the new flow file

**Step 5: Commit**

```
docs(architecture): add user price alert flow diagrams
```

---

## Task Dependency Order

```
Task 0 (C4 diagrams) ─────────────────────────────────────────── can start immediately
Task 1 (Proto) ────── Task 2 (Model+Migration) ── Task 3 (Repo) ── Task 4 (Service) ── Task 5 (Handler) ── Task 6 (Eval Job)
                                                                                                             └── Task 7 (Notifications)
Task 1 (Proto) ────── Task 8 (CreateForm) ── Task 9 (Settings page) ── Task 10 (Prices entry) ── Task 11 (Portfolio entry)
Task 12 (Constants) ─── can be done with Task 8
Task 13 (Flow diagrams) ─── after Task 6 (needs to trace actual implementation)
```

**Parallel-safe groups:**
- Tasks 0, 1, 12 can run in parallel (no file conflicts)
- Tasks 8–11 (frontend) can run in parallel with Tasks 3–7 (backend) after Task 1 completes
- Task 13 should run after Task 6 to trace actual runtime flows
