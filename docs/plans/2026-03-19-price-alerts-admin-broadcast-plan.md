# Price Fluctuation Alerts & Admin Broadcast — Implementation Plan

> **On approval**: Save this plan to `docs/plans/2026-03-19-price-alerts-admin-broadcast-plan.md`
> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add price alert notifications (gold/silver), admin broadcast messaging, and Web Push delivery to the existing notification infrastructure.
**Spec:** `docs/specs/2026-03-19-price-alerts-admin-broadcast-spec.md`
**Architecture:** Extends existing community notification system (Notification model, SSE stream, NotificationBell/Panel) with two new types (`price_alert`, `admin_broadcast`) and a new Web Push delivery channel via service worker + VAPID.
**Tech Stack:** Go (webpush-go), Redis (baselines/cooldowns/pub-sub), PostgreSQL (jsonb metadata, push_subscription table), Next.js (service worker, React components)

## Security Implementation Notes
- **Authentication**: All new endpoints use existing `AuthMiddleware` (JWT); admin broadcast uses `AdminMiddleware`
- **Authorization**: Push subscriptions are user-scoped (ownership check); broadcasts require `is_admin=true`
- **Input validation**: Server-side HTML stripping for broadcast messages; HTTPS-only push endpoints; base64 validation for push keys
- **Rate limiting**: Admin broadcast: max 10/hour/admin via Redis; Push subscriptions: max 5/user; Price alerts: 2-hour cooldown per category
- **Secrets**: VAPID private key in env vars only, never logged or returned via API

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Add `PriceAlertJob` to Scheduler section, `PriceAlertService` and `PushService` to Service layer, `PushSubscriptionRepository` to Repository layer in backend diagram
2. Add `PushPermissionBanner`, `AdminBroadcastForm`, and Service Worker to frontend diagram
3. Update `NotificationRepository` description to include batch insert and new types

---

### Task 1: Add Metadata field to Notification model + BatchCreate to repository

**Files:**
- Modify: `src/go-backend/domain/models/notification.go`
- Modify: `src/go-backend/domain/repository/interfaces.go` (~line 381)
- Modify: `src/go-backend/domain/repository/notification_repository.go`

**Security notes:** Metadata is `datatypes.JSON` (jsonb) — GORM handles parameterized queries.

**Steps:**
1. Run `cd src/go-backend && go get gorm.io/datatypes` to add the datatypes dependency
2. Add to `Notification` struct in `notification.go`:
   ```go
   Metadata datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`
   ```
   Import `"gorm.io/datatypes"`
3. Add `BatchCreate(ctx context.Context, notifications []*models.Notification) error` to `NotificationRepository` interface in `interfaces.go`
4. Implement `BatchCreate` in `notification_repository.go`:
   ```go
   func (r *notificationRepository) BatchCreate(ctx context.Context, notifications []*models.Notification) error {
       if len(notifications) == 0 {
           return nil
       }
       return r.db.DB.WithContext(ctx).CreateInBatches(notifications, 500).Error
   }
   ```
5. Add `GetAllUserIDs(ctx context.Context) ([]int32, error)` to `UserRepository` interface in `interfaces.go`
6. Implement `GetAllUserIDs` in `user_repository.go`:
   ```go
   func (r *userRepository) GetAllUserIDs(ctx context.Context) ([]int32, error) {
       var ids []int32
       err := r.db.DB.WithContext(ctx).Model(&models.User{}).Pluck("id", &ids).Error
       if err != nil {
           return nil, r.handleDBError(err, "user", "get all user IDs")
       }
       return ids, nil
   }
   ```
7. Verify: `cd src/go-backend && go build ./...`

---

### Task 2: Create PushSubscription model + repository

**Files:**
- Create: `src/go-backend/domain/models/push_subscription.go`
- Create: `src/go-backend/domain/repository/push_subscription_repository.go`
- Modify: `src/go-backend/domain/repository/interfaces.go`

**Security notes:** Endpoint URLs validated as HTTPS on handler level; p256dh/auth are opaque crypto keys stored as-is.

**Steps:**
1. Create `push_subscription.go` model:
   ```go
   package models

   import "time"

   type PushSubscription struct {
       ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
       UserID    int32     `gorm:"not null;index:idx_push_sub_user_id" json:"userId"`
       Endpoint  string    `gorm:"type:text;not null;uniqueIndex:idx_push_sub_endpoint" json:"endpoint"`
       P256dh    string    `gorm:"type:text;not null" json:"p256dh"`
       Auth      string    `gorm:"type:text;not null" json:"auth"`
       CreatedAt time.Time `gorm:"not null" json:"createdAt"`
       UpdatedAt time.Time `gorm:"not null" json:"updatedAt"`
       User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
   }

   func (PushSubscription) TableName() string {
       return "push_subscription"
   }
   ```
2. Add `PushSubscriptionRepository` interface to `interfaces.go`:
   ```go
   type PushSubscriptionRepository interface {
       Create(ctx context.Context, sub *models.PushSubscription) error
       DeleteByEndpoint(ctx context.Context, endpoint string) error
       GetByUserID(ctx context.Context, userID int32) ([]*models.PushSubscription, error)
       GetAll(ctx context.Context) ([]*models.PushSubscription, error)
       CountByUserID(ctx context.Context, userID int32) (int, error)
       DeleteByID(ctx context.Context, id int32) error
   }
   ```
3. Implement repository in `push_subscription_repository.go` following `BaseRepository` pattern
4. Verify: `cd src/go-backend && go build ./...`

---

### Task 3: Database migration

**Files:**
- Create: `src/go-backend/cmd/migrate-price-alerts/main.go`
- Modify: `Taskfile.yml` (add `backend:migrate-price-alerts` task)

**Steps:**
1. Follow pattern from `cmd/migrate-community/main.go`
2. Migration steps:
   a. Add `metadata jsonb` column to notification table: `ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS metadata JSONB`
   b. AutoMigrate `&models.PushSubscription{}` for the new table
3. Add Taskfile entry: `backend:migrate-price-alerts`
4. Verify: `cd src/go-backend && go build ./cmd/migrate-price-alerts/`

---

### Task 4: Add metadata field to NotificationItem proto + generate code

**Files:**
- Modify: `api/protobuf/v1/community.proto` (NotificationItem message + new messages)

**Steps:**
1. Add field 10 to `NotificationItem`: `string metadata = 10 [json_name = "metadata"];`
2. Add new messages after `MarkNotificationsReadResponse`:
   ```protobuf
   // Admin Broadcast
   message AdminBroadcastRequest {
     string message = 1 [json_name = "message"];
   }

   message AdminBroadcastResponse {
     bool success = 1 [json_name = "success"];
     string message = 2 [json_name = "message"];
     int32 recipientCount = 3 [json_name = "recipientCount"];
     string timestamp = 4 [json_name = "timestamp"];
   }

   // Push Subscription
   message PushSubscribeRequest {
     string endpoint = 1 [json_name = "endpoint"];
     string p256dh = 2 [json_name = "p256dh"];
     string auth = 3 [json_name = "auth"];
   }

   message PushSubscribeResponse {
     bool success = 1 [json_name = "success"];
     string message = 2 [json_name = "message"];
     string timestamp = 3 [json_name = "timestamp"];
   }

   message PushUnsubscribeRequest {
     string endpoint = 1 [json_name = "endpoint"];
   }

   message PushUnsubscribeResponse {
     bool success = 1 [json_name = "success"];
     string message = 2 [json_name = "message"];
     string timestamp = 3 [json_name = "timestamp"];
   }

   message GetVAPIDKeyRequest {}

   message GetVAPIDKeyResponse {
     bool success = 1 [json_name = "success"];
     string publicKey = 2 [json_name = "publicKey"];
     string timestamp = 3 [json_name = "timestamp"];
   }
   ```
3. Run `task proto:all` to generate Go + TypeScript code
4. Update `GetNotifications` handler in community handler to serialize `n.Metadata` into the proto `metadata` string field — in the mapping function that converts `models.Notification` to `v1.NotificationItem`, add:
   ```go
   if len(n.Metadata) > 0 {
       item.Metadata = string(n.Metadata)
   }
   ```
5. Verify: `cd src/go-backend && go build ./...`

---

### Task 5: Create PushService

**Files:**
- Create: `src/go-backend/domain/service/push_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`
- Modify: `src/go-backend/go.mod` (add `webpush-go` dependency)

**Security notes:** VAPID private key from env var only; push payloads over HTTPS; 410 (Gone) responses trigger subscription cleanup.

**Steps:**
1. `cd src/go-backend && go get github.com/SherClockHolmes/webpush-go`
2. Add `PushService` interface to `interfaces.go`:
   ```go
   // PushService handles Web Push notification delivery.
   type PushService interface {
       SendToUser(ctx context.Context, userID int32, title, body, url string) error
       SendToAll(ctx context.Context, title, body, url string) error
       GetVAPIDPublicKey() string
   }
   ```
3. Implement in `push_service.go`:
   - Constructor reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` from env
   - `SendToUser`: get subscriptions by userID, send via `webpush.SendNotification()`, delete on 410 (Gone)
   - `SendToAll`: get all subscriptions, send in parallel (20 concurrent workers via `sync.WaitGroup` + semaphore channel), handle 410
   - Push payload JSON: `{"title", "body", "url", "icon": "/icons/icon-192x192.png"}`
   - Return nil-safe `PushService` (noop) if VAPID keys not configured — use a `noopPushService` struct
4. Verify: `cd src/go-backend && go build ./...`

---

### Task 6: Create PriceAlertService

**Files:**
- Create: `src/go-backend/domain/service/price_alert_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`

**Security notes:** No user input; all data from trusted internal price services.

**Steps:**
1. Add `PriceAlertService` interface to `interfaces.go`:
   ```go
   // PriceAlertService detects significant price fluctuations and sends alerts.
   type PriceAlertService interface {
       CheckAndAlert(ctx context.Context) error
   }
   ```
2. Implement in `price_alert_service.go`:
   - Constructor reads thresholds from env: `PRICE_ALERT_GOLD_VND_PCT` (2.0), `PRICE_ALERT_GOLD_USD_PCT` (1.5), `PRICE_ALERT_SILVER_VND_PCT` (3.0), `PRICE_ALERT_SILVER_USD_PCT` (2.0), `PRICE_ALERT_COOLDOWN_MINUTES` (120)
   - Dependencies: `GoldPriceService`, `SilverPriceService`, `NotificationRepository`, `UserRepository`, `*pkgredis.RedisClient`, `PushService` (nullable)
   - `CheckAndAlert` logic:
     a. Fetch all gold prices via `goldPriceSvc.FetchAllPrices()` + silver via `silverPriceSvc.FetchAllPrices()` — skip category on fetch failure (log warning)
     b. Get baselines from Redis keys `price_alert:baseline:{typeCode}` — on first run (key missing), store current price and return early (no alert)
     c. Calculate `abs(currentBuy - baselineBuy) / baselineBuy * 100` — skip if baseline <= 0
     d. Collect movers exceeding threshold per category (gold_vnd, gold_usd, silver_vnd, silver_usd)
     e. Check cooldown via Redis key `price_alert:cooldown:{category}` (EXISTS) — skip if active
     f. Aggregate movers into single notification per category (top 5 by change %)
     g. Build metadata JSON with movers, category, checkTime
     h. Get all user IDs via `userRepo.GetAllUserIDs(ctx)`, build notification batch (Type=`"price_alert"`, ActorID=0, Metadata=JSON)
     i. Batch create via `notificationRepo.BatchCreate(ctx, notifications)`
     j. Publish SSE events to each user's Redis channel: `user:{id}:notifications`
     k. Push notifications via PushService if available: `pushSvc.SendToAll(ctx, title, body, "/dashboard/prices")`
     l. Update baselines in Redis (SET) + set cooldown TTL (SET + EXPIRE cooldownMinutes*60)
3. Verify: `cd src/go-backend && go build ./...`

---

### Task 7: Add Broadcast method to AdminService

**Files:**
- Modify: `src/go-backend/domain/service/interfaces.go` (AdminService)
- Modify: `src/go-backend/domain/service/admin_service.go`

**Security notes:** HTML stripping via regex; rate limit 10/hour/admin via Redis; max 500 chars.

**Steps:**
1. Add `Broadcast(ctx context.Context, adminUserID int32, message string) (int32, error)` to `AdminService` interface in `interfaces.go`
2. Update `adminService` struct to accept additional dependencies: `notificationRepo repository.NotificationRepository`, `redisClient *pkgredis.RedisClient`, `pushSvc PushService`, `userRepo repository.UserRepository` — Note: `userRepo` is already present, add the others
3. Update `NewAdminService` constructor signature: `NewAdminService(userRepo repository.UserRepository, feedbackRepo repository.FeedbackRepository, notificationRepo repository.NotificationRepository, rdb *pkgredis.RedisClient, pushSvc PushService) AdminService`
4. Implement `Broadcast`:
   a. Validate: `strings.TrimSpace(message)`, non-empty, max 500 chars
   b. Strip HTML tags: reuse `htmlTagRegex` (already in `admin_service.go` package or from `site_settings_service.go`)
   c. Rate limit: Redis key `admin:broadcast:rate:{adminID}` — INCR + EXPIRE 1h; reject if > 10
   d. Get admin user info for metadata
   e. Get all user IDs via `s.userRepo.GetAllUserIDs(ctx)`
   f. Build notifications: Type=`"admin_broadcast"`, ActorID=0, Metadata=`{"message": sanitized, "adminId": id, "adminName": name}`
   g. Batch insert via `s.notificationRepo.BatchCreate(ctx, notifications)`
   h. SSE publish per user: loop user IDs, publish to `user:{id}:notifications`
   i. Push delivery: `s.pushSvc.SendToAll(ctx, "Thông báo từ hệ thống", message, "")`
   j. Return recipient count
5. Update `NewAdminService` call site in `services.go`: pass `repos.Notification`, `rdb`, and push service (nil initially — wired in Task 10)
6. Verify: `cd src/go-backend && go build ./...`

---

### Task 8: Handlers + routes for broadcast and push

**Files:**
- Create: `src/go-backend/handlers/admin_broadcast.go`
- Create: `src/go-backend/handlers/push.go`
- Modify: `src/go-backend/handlers/builder.go`
- Modify: `src/go-backend/handlers/routes.go`

**Security notes:** Broadcast requires admin auth; push validates HTTPS endpoint, max 2048 chars, base64 keys, max 5 subs/user.

**Steps:**
1. Create `admin_broadcast.go` — `AdminBroadcastHandler`:
   - Constructor: `NewAdminBroadcastHandler(adminSvc service.AdminService) *AdminBroadcastHandler`
   - `SendBroadcast(c *gin.Context)`:
     a. Get userID from context
     b. Bind `AdminBroadcastRequest` (`{"message": "..."}`)
     c. Call `adminSvc.Broadcast(ctx, userID, req.Message)`
     d. Return `gin.H{"success": true, "message": "Broadcast sent", "recipientCount": count, "timestamp": time.Now()}`

2. Create `push.go` — `PushHandler`:
   - Constructor: `NewPushHandler(pushSvc service.PushService, pushSubRepo repository.PushSubscriptionRepository) *PushHandler`
   - `Subscribe(c *gin.Context)`:
     a. Get userID from context
     b. Bind `PushSubscribeRequest`
     c. Validate endpoint: must start with `https://`, max 2048 chars
     d. Validate p256dh/auth: non-empty, max 256 chars, base64 regex check
     e. Count check: `pushSubRepo.CountByUserID(ctx, userID)` — reject if >= 5
     f. Create subscription
     g. Return success
   - `Unsubscribe(c *gin.Context)`:
     a. Get userID from context
     b. Bind `PushUnsubscribeRequest`
     c. Delete by endpoint (only if belongs to user — query first)
     d. Return success
   - `GetVAPIDKey(c *gin.Context)`:
     a. Return `gin.H{"success": true, "publicKey": pushSvc.GetVAPIDPublicKey(), "timestamp": time.Now()}`

3. Update `builder.go`:
   - Add `AdminBroadcast *AdminBroadcastHandler` and `Push *PushHandler` to `AllHandlers`
   - Wire in `NewHandlers`:
     ```go
     AdminBroadcast: NewAdminBroadcastHandler(services.Admin),
     Push: func() *PushHandler {
         if services.Push != nil {
             return NewPushHandler(services.Push, repos.PushSubscription)
         }
         return nil
     }(),
     ```

4. Update `routes.go`:
   - In admin group, add:
     ```go
     if h.AdminBroadcast != nil {
         admin.POST("/broadcast", h.AdminBroadcast.SendBroadcast)
     }
     ```
   - Add new push group (user auth required):
     ```go
     push := v1.Group("/push")
     push.Use(AuthMiddleware(authSrv))
     if rateLimiter != nil {
         push.Use(appmiddleware.RateLimitByUser(rateLimiter))
     }
     {
         if h.Push != nil {
             push.GET("/vapid-key", h.Push.GetVAPIDKey)
             push.POST("/subscribe", h.Push.Subscribe)
             push.DELETE("/subscribe", h.Push.Unsubscribe)
         }
     }
     ```

5. Verify: `cd src/go-backend && go build ./...`

---

### Task 9: PriceAlertJob + scheduler registration

**Files:**
- Create: `src/go-backend/internal/scheduler/price_alert_job.go`
- Modify: `src/go-backend/internal/app/providers.go`

**Steps:**
1. Create `price_alert_job.go`:
   ```go
   package scheduler

   import (
       "context"
       "log"
       "time"
       "wealthjourney/domain/service"
   )

   type PriceAlertJob struct {
       priceAlertSvc service.PriceAlertService
   }

   func NewPriceAlertJob(priceAlertSvc service.PriceAlertService) *PriceAlertJob {
       return &PriceAlertJob{priceAlertSvc: priceAlertSvc}
   }

   func (j *PriceAlertJob) Name() string              { return "price-alert" }
   func (j *PriceAlertJob) Interval() time.Duration    { return 15 * time.Minute }
   func (j *PriceAlertJob) StartupDelay() time.Duration { return 30 * time.Second }

   func (j *PriceAlertJob) Run(ctx context.Context) error {
       log.Println("Running price alert check...")
       if err := j.priceAlertSvc.CheckAndAlert(ctx); err != nil {
           log.Printf("Price alert check failed: %v", err)
           return err
       }
       log.Println("Price alert check completed")
       return nil
   }
   ```
2. Update `ProvideScheduler` in `providers.go`:
   - Accept `rdb *redis.RedisClient` (already present)
   - After existing jobs, conditionally add PriceAlertJob:
     ```go
     if rdb != nil {
         goldPriceSvc := service.NewGoldPriceService(rdb.GetClient())
         silverPriceSvc := service.NewSilverPriceService(rdb.GetClient())
         priceAlertSvc := service.NewPriceAlertService(
             goldPriceSvc, silverPriceSvc,
             repos.Notification, repos.User, rdb,
             services.Push, // may be nil
         )
         backgroundJobs = append(backgroundJobs, scheduler.NewPriceAlertJob(priceAlertSvc))
     }
     ```
3. Verify: `cd src/go-backend && go build ./...`

---

### Task 10: DI wiring integration

**Files:**
- Modify: `src/go-backend/domain/service/services.go`
- Modify: `src/go-backend/internal/app/providers.go`

**Steps:**
1. Add to `Repositories` struct in `services.go`:
   ```go
   PushSubscription repository.PushSubscriptionRepository
   ```
2. Add to `Services` struct in `services.go`:
   ```go
   PriceAlert PriceAlertService
   Push       PushService
   ```
3. In `NewServices`, create PushService and wire it:
   ```go
   // Phase 1 (cont.): PushService — depends on push subscription repo
   var pushSvc PushService
   pushSvc = NewPushService(repos.PushSubscription)
   ```
4. Update `NewAdminService` call to pass additional deps:
   ```go
   Admin: NewAdminService(repos.User, repos.Feedback, repos.Notification, rdb, pushSvc),
   ```
5. Add `Push: pushSvc` to returned `Services` struct
6. In `ProvideRepositories` in `providers.go`, add:
   ```go
   PushSubscription: repository.NewPushSubscriptionRepository(db),
   ```
7. Verify full compilation: `cd src/go-backend && go build ./...`

---

### Task 11: Frontend — Update NotificationItem for new types

**Files:**
- Modify: `src/wj-client/components/notifications/NotificationItem.tsx`
- Modify: `src/wj-client/components/notifications/NotificationPanel.tsx`

**Steps:**
1. In `NotificationItem.tsx`:
   - Add rendering branch for `price_alert` type:
     - Parse `metadata` JSON string
     - Show chart/trending icon (use existing icon or lucide-react `TrendingUp`/`TrendingDown`)
     - Display: "Giá vàng biến động mạnh" or "Giá bạc biến động mạnh" based on `metadata.category`
     - Show top mover: name, direction arrow (↑/↓), percentage change, colored green/red
     - Click → navigate to `/dashboard/prices`
   - Add rendering branch for `admin_broadcast` type:
     - Show megaphone/bell icon
     - Display: "Thông báo từ hệ thống"
     - Show `metadata.message` text
     - Click → no navigation (stay on current page)
   - For both new types: when `actorId === 0`, show a system icon instead of actor avatar (colored circle with icon)
2. In `NotificationPanel.tsx`:
   - Ensure `metadata` field is passed through from query data to `NotificationItem`
   - Update click handler: for `price_alert`, navigate to `/dashboard/prices`; for `admin_broadcast`, just mark as read (no navigation)
3. Verify: `cd src/wj-client && npm run build`

---

### Task 12: Frontend — Update SSE stream for new types

**Files:**
- Modify: `src/wj-client/features/community/hooks/useNotificationStream.ts`

**Steps:**
1. In the SSE `notification` event handler, add `metadata` to the notification object built from SSE data:
   ```typescript
   const notification = {
       ...data,
       metadata: data.metadata || "",
   };
   ```
2. Handle `actorId === 0` notifications (system notifications): don't fetch actor data, use empty actor fields
3. Optionally show toast for price_alert and admin_broadcast types using existing `useNotification` context:
   - price_alert: "📈 Giá vàng/bạc biến động mạnh"
   - admin_broadcast: "📢 Thông báo mới từ hệ thống"
4. Verify: `cd src/wj-client && npm run build`

---

### Task 13: Frontend — Create service worker

**Files:**
- Create: `src/wj-client/public/sw.js`

**Steps:**
1. Create minimal push-only service worker:
   ```javascript
   // Minimal push-only service worker — no caching (must not interfere with Next.js)
   self.addEventListener("install", (event) => {
     self.skipWaiting();
   });

   self.addEventListener("activate", (event) => {
     event.waitUntil(self.clients.claim());
   });

   self.addEventListener("push", (event) => {
     if (!event.data) return;
     const data = event.data.json();
     const options = {
       body: data.body || "",
       icon: data.icon || "/icons/icon-192x192.png",
       badge: "/icons/icon-72x72.png",
       data: { url: data.url || "/dashboard/home" },
       vibrate: [200, 100, 200],
     };
     event.waitUntil(
       self.registration.showNotification(data.title || "congdongvang.com", options)
     );
   });

   self.addEventListener("notificationclick", (event) => {
     event.notification.close();
     const url = event.notification.data?.url || "/dashboard/home";
     event.waitUntil(
       self.clients.matchAll({ type: "window" }).then((clients) => {
         for (const client of clients) {
           if (client.url.includes(url) && "focus" in client) {
             return client.focus();
           }
         }
         return self.clients.openWindow(url);
       })
     );
   });
   ```
2. Verify the file is accessible: it should be served at `/sw.js` from `public/`

---

### Task 14: Frontend — Create usePushSubscription hook

**Files:**
- Create: `src/wj-client/features/community/hooks/usePushSubscription.ts`

**Steps:**
1. Implement the hook:
   - Register service worker on mount: `navigator.serviceWorker.register("/sw.js")`
   - Fetch VAPID key from `/api/v1/push/vapid-key` (cache in state)
   - `subscribe()`:
     a. Call `Notification.requestPermission()` — only after user interaction
     b. Get `PushManager.subscribe()` with `applicationServerKey` (VAPID public key converted via `urlBase64ToUint8Array`)
     c. Extract `endpoint`, `p256dh`, `auth` from subscription
     d. POST to `/api/v1/push/subscribe`
   - `unsubscribe()`:
     a. Get current subscription via `registration.pushManager.getSubscription()`
     b. Call `subscription.unsubscribe()`
     c. DELETE to `/api/v1/push/subscribe` with endpoint
   - `urlBase64ToUint8Array(base64String)` utility for VAPID key conversion
   - Returns: `{ isSubscribed, subscribe, unsubscribe, isLoading, permissionState }`
2. Verify: `cd src/wj-client && npm run build`

---

### Task 15: Frontend — Create PushPermissionBanner

**Files:**
- Create: `src/wj-client/components/notifications/PushPermissionBanner.tsx`

**Steps:**
1. Use `usePWAInstall` for platform + isInstalled detection
2. Use `usePushSubscription` for subscription state
3. State machine logic:
   - iOS not installed → "Install PWA" banner: "Cài đặt ứng dụng để nhận thông báo giá vàng và bạc ngay trên iPhone" → link to existing `PWAInstallPrompt` flow
   - permission "default" → "Enable push" banner: "Bật thông báo để nhận cảnh báo giá vàng và bạc ngay trên điện thoại" → [Bật] [Để sau]
   - permission "granted" + not subscribed → auto-subscribe silently
   - permission "denied" / already subscribed → hide banner
4. Dismissal logic:
   - "Để sau" → localStorage `push_banner_dismissed_at` = Date.now(), reappear after 7 days
   - "Không hiển thị lại" → localStorage `push_banner_permanent_dismiss` = true
   - Check on mount: if permanent dismiss or (temp dismiss + <7 days), don't show
5. Vietnamese text per spec mockups
6. Styling: fixed banner at top of dashboard content area, Tailwind: `bg-amber-50 border border-amber-200 rounded-lg p-4` — mobile-first responsive
7. Verify: `cd src/wj-client && npm run build`

---

### Task 16: Frontend — AdminBroadcastForm

**Files:**
- Create: `src/wj-client/features/admin/components/AdminBroadcastForm.tsx`

**Steps:**
1. Create component:
   - Textarea with `react-hook-form`, max 500 chars
   - Character counter: `{charCount}/500 ký tự`
   - Submit button: "Gửi thông báo" using existing `Button` component
   - POST to `/api/v1/admin/broadcast` via `apiClient` (manual fetch since this is a new endpoint not yet in generated hooks)
   - Success toast: "Đã gửi thông báo đến {recipientCount} người dùng"
   - Error display using existing error patterns
   - Reuse: `BaseCard`, `Button` from shared components
2. Verify: `cd src/wj-client && npm run build`

---

### Task 17: Frontend — Integrate into layout + admin page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx`

**Steps:**
1. In dashboard `layout.tsx`:
   - Import and add `<PushPermissionBanner />` inside the main content area, after the header section (near where `CurrencyConversionProgress` is rendered)
   - Ensure component only renders client-side (it uses browser APIs)
2. In admin `page.tsx`:
   - Add `"broadcast"` to the `TABS` array / AdminTab type
   - Add tab label: "Thông báo" or "Broadcast"
   - Add conditional render: `{activeTab === "broadcast" && <AdminBroadcastForm />}`
   - Import `AdminBroadcastForm` from `@/features/admin/components/AdminBroadcastForm`
3. Verify: `cd src/wj-client && npm run build`

---

### Task 18: Update flow diagrams

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**
1. Add "Price Alert Detection" sequence diagram:
   - Trigger: Scheduler (every 15 min)
   - Flow: PriceAlertJob → GoldPriceService/SilverPriceService → Redis baseline check → threshold comparison → notification batch insert → SSE publish to all users → push delivery
   - Error paths: price fetch failure (skip category), Redis unavailable (skip alert), push failure (non-fatal)
2. Add "Admin Broadcast" sequence diagram:
   - Trigger: Admin POST /api/v1/admin/broadcast
   - Flow: AdminBroadcastHandler → AdminService.Broadcast → validate + rate limit → batch notification insert → SSE publish to all → push delivery
   - Error paths: rate limit exceeded, validation failure
3. Include key invariants for each flow

---

## Task Dependencies & Parallelization

```
Independent foundations (parallel): Tasks 0, 1, 2, 13
After models ready: Task 3 (migration), Task 4 (proto)
After repos + proto: Tasks 5, 6 (parallel — push service + price alert service)
After services: Tasks 7, 8 (broadcast service + handlers)
After handlers: Task 9 (scheduler job)
DI integration: Task 10 (after all backend)
Frontend (after proto gen): Tasks 11, 12, 13 (parallel)
Frontend push: Tasks 14 → 15 (sequential)
Frontend admin: Task 16 → 17 (sequential)
Docs: Task 18 (last)
```

## Verification

### Backend
- `go build ./...` after each backend task
- Run migration: `task backend:migrate-price-alerts`
- Test broadcast: `curl -X POST /api/v1/admin/broadcast -H "Authorization: Bearer <admin-token>" -d '{"message": "Test"}'`
- Check scheduler logs for "price-alert" job

### Frontend
- `npm run build` in `src/wj-client/`
- Verify notification panel renders new types
- Test push banner in Chrome DevTools device emulation
- Test service worker: `navigator.serviceWorker.ready`
- Test admin broadcast form on `/dashboard/admin`

### E2E
- `cd src/wj-client && npx playwright test tests/e2e/admin-flow.spec.ts`
