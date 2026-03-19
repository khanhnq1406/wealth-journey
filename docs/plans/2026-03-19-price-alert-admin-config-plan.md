# Price Alert Admin Configuration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add admin UI to configure price alert settings (thresholds, cooldown, enable/disable per category, notification templates, top movers count) and broadcast notification title, stored in Redis with env var defaults.
**Spec:** `docs/specs/2026-03-19-price-alert-admin-config-spec.md`
**Architecture:** Extends existing `PriceAlertService` to read config from Redis on each run instead of at construction time. Adds a new `PriceAlertConfigHandler` in the admin route group. Adds `PriceAlertConfigForm` component to the admin page. Renames "Broadcast" tab to "Notifications" and houses both broadcast form and price alert config.
**Tech Stack:** Go (Gin handlers, Redis JSON), React (form with react-hook-form), TypeScript, Tailwind CSS, next-intl

## Security Implementation Notes

- **Authentication**: Both GET/PUT endpoints use existing `AuthMiddleware` + `AdminMiddleware`
- **Authorization**: Only `is_admin=true` users can read or modify config
- **Input validation**: Server-side validation for all fields (range checks, length limits, HTML stripping)
- **Data sanitization**: HTML tags stripped from all template strings and broadcast title server-side
- **Template safety**: Only predefined placeholders resolved; unknown placeholders left as-is (no injection)

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Add `PriceAlertConfigHandler` to Handlers layer; update `PriceAlertService` description to note it reads config from Redis
- Update `docs/architecture/c4-component-frontend.md`: Add `PriceAlertConfigForm` under admin feature module

---

### Task 1: Backend — Add `priceDiff` field to `priceMover` struct

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go`

**Security notes:** No user input involved. Pure computation from internal data.

**Steps:**

1. Add `PriceDiff` field to `priceMover` struct:
   ```go
   type priceMover struct {
       TypeCode  string  `json:"typeCode"`
       Name      string  `json:"name"`
       Direction string  `json:"direction"`
       ChangePct float64 `json:"changePct"`
       Current   int64   `json:"current"`
       Baseline  int64   `json:"baseline"`
       PriceDiff int64   `json:"priceDiff"` // currentBuy - baseline
   }
   ```

2. In `checkPrice` method (~line 266), set `PriceDiff` in the returned struct:
   ```go
   return &priceMover{
       TypeCode:  typeCode,
       Direction: direction,
       ChangePct: math.Round(changePct*100) / 100,
       Current:   currentBuy,
       Baseline:  baseline,
       PriceDiff: currentBuy - baseline,
   }
   ```

3. Verify: `cd src/go-backend && go build ./...`

---

### Task 2: Backend — Create price alert config model and Redis read/write

**Files:**
- Create: `src/go-backend/domain/service/price_alert_config.go`

**Security notes:** Config is internal operational data; no user PII. HTML stripping applied to all string fields.

**Steps:**

1. Create `price_alert_config.go` with config structs, defaults, and Redis read/write functions:

   ```go
   package service

   import (
       "context"
       "encoding/json"
       "fmt"
       "log"
       "regexp"
       "strings"

       pkgredis "wealthjourney/pkg/redis"
   )

   const priceAlertConfigKey = "price_alert:config"

   // PriceAlertCategoryConfig holds per-category settings.
   type PriceAlertCategoryConfig struct {
       Enabled       bool    `json:"enabled"`
       ThresholdPct  float64 `json:"thresholdPct"`
       TitleTemplate string  `json:"titleTemplate"`
       BodyTemplate  string  `json:"bodyTemplate"`
   }

   // PriceAlertConfig holds the full configuration.
   type PriceAlertConfig struct {
       CooldownMinutes int                                `json:"cooldownMinutes"`
       TopMoversCount  int                                `json:"topMoversCount"`
       BroadcastTitle  string                             `json:"broadcastTitle"`
       Categories      map[string]PriceAlertCategoryConfig `json:"categories"`
   }

   // DefaultPriceAlertConfig returns the default config built from env vars.
   func DefaultPriceAlertConfig() PriceAlertConfig {
       return PriceAlertConfig{
           CooldownMinutes: envInt("PRICE_ALERT_COOLDOWN_MINUTES", 120),
           TopMoversCount:  5,
           BroadcastTitle:  "Thông báo từ hệ thống",
           Categories: map[string]PriceAlertCategoryConfig{
               "gold_vnd": {
                   Enabled:       true,
                   ThresholdPct:  envFloat("PRICE_ALERT_GOLD_VND_PCT", 2.0),
                   TitleTemplate: "Giá vàng trong nước biến động mạnh",
                   BodyTemplate:  "{moverName} {direction} {changePct}%",
               },
               "gold_usd": {
                   Enabled:       true,
                   ThresholdPct:  envFloat("PRICE_ALERT_GOLD_USD_PCT", 1.5),
                   TitleTemplate: "Giá vàng thế giới biến động mạnh",
                   BodyTemplate:  "{moverName} {direction} {changePct}%",
               },
               "silver_vnd": {
                   Enabled:       true,
                   ThresholdPct:  envFloat("PRICE_ALERT_SILVER_VND_PCT", 3.0),
                   TitleTemplate: "Giá bạc trong nước biến động mạnh",
                   BodyTemplate:  "{moverName} {direction} {changePct}%",
               },
               "silver_usd": {
                   Enabled:       true,
                   ThresholdPct:  envFloat("PRICE_ALERT_SILVER_USD_PCT", 2.0),
                   TitleTemplate: "Giá bạc thế giới biến động mạnh",
                   BodyTemplate:  "{moverName} {direction} {changePct}%",
               },
           },
       }
   }

   // LoadPriceAlertConfig reads config from Redis, falling back to defaults.
   func LoadPriceAlertConfig(ctx context.Context, rdb *pkgredis.RedisClient) PriceAlertConfig {
       defaults := DefaultPriceAlertConfig()
       if rdb == nil {
           return defaults
       }

       val, err := rdb.GetClient().Get(ctx, priceAlertConfigKey).Result()
       if err != nil {
           // Key doesn't exist or Redis unavailable — use defaults
           return defaults
       }

       var cfg PriceAlertConfig
       if err := json.Unmarshal([]byte(val), &cfg); err != nil {
           log.Printf("Price alert config: failed to unmarshal from Redis: %v", err)
           return defaults
       }

       // Ensure all 4 categories exist (merge defaults for missing categories)
       for cat, def := range defaults.Categories {
           if _, ok := cfg.Categories[cat]; !ok {
               if cfg.Categories == nil {
                   cfg.Categories = make(map[string]PriceAlertCategoryConfig)
               }
               cfg.Categories[cat] = def
           }
       }

       return cfg
   }

   // SavePriceAlertConfig saves config to Redis (no TTL — persistent).
   func SavePriceAlertConfig(ctx context.Context, rdb *pkgredis.RedisClient, cfg PriceAlertConfig) error {
       data, err := json.Marshal(cfg)
       if err != nil {
           return fmt.Errorf("failed to marshal price alert config: %w", err)
       }
       return rdb.GetClient().Set(ctx, priceAlertConfigKey, string(data), 0).Err()
   }

   var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

   // stripHTML removes HTML tags from a string.
   func stripHTML(s string) string {
       return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, ""))
   }

   // ValidatePriceAlertConfig validates config fields. Returns field-specific error or nil.
   func ValidatePriceAlertConfig(cfg PriceAlertConfig) map[string]string {
       errors := make(map[string]string)

       if cfg.CooldownMinutes < 1 || cfg.CooldownMinutes > 1440 {
           errors["cooldownMinutes"] = "must be between 1 and 1440"
       }
       if cfg.TopMoversCount < 1 || cfg.TopMoversCount > 20 {
           errors["topMoversCount"] = "must be between 1 and 20"
       }

       bt := stripHTML(cfg.BroadcastTitle)
       if len(bt) == 0 || len(bt) > 200 {
           errors["broadcastTitle"] = "must be 1-200 characters (no HTML)"
       }

       validCategories := map[string]bool{
           "gold_vnd": true, "gold_usd": true,
           "silver_vnd": true, "silver_usd": true,
       }

       for cat, catCfg := range cfg.Categories {
           if !validCategories[cat] {
               errors[fmt.Sprintf("categories.%s", cat)] = "unknown category"
               continue
           }
           if catCfg.ThresholdPct < 0.1 || catCfg.ThresholdPct > 50.0 {
               errors[fmt.Sprintf("categories.%s.thresholdPct", cat)] = "must be between 0.1 and 50.0"
           }
           tt := stripHTML(catCfg.TitleTemplate)
           if len(tt) == 0 || len(tt) > 200 {
               errors[fmt.Sprintf("categories.%s.titleTemplate", cat)] = "must be 1-200 characters (no HTML)"
           }
           bt := stripHTML(catCfg.BodyTemplate)
           if len(bt) == 0 || len(bt) > 500 {
               errors[fmt.Sprintf("categories.%s.bodyTemplate", cat)] = "must be 1-500 characters (no HTML)"
           }
       }

       if len(errors) > 0 {
           return errors
       }
       return nil
   }

   // SanitizePriceAlertConfig strips HTML from all string fields in-place.
   func SanitizePriceAlertConfig(cfg *PriceAlertConfig) {
       cfg.BroadcastTitle = stripHTML(cfg.BroadcastTitle)
       for cat, catCfg := range cfg.Categories {
           catCfg.TitleTemplate = stripHTML(catCfg.TitleTemplate)
           catCfg.BodyTemplate = stripHTML(catCfg.BodyTemplate)
           cfg.Categories[cat] = catCfg
       }
   }

   // ResolvePlaceholders replaces {placeholder} tokens in a template string.
   func ResolvePlaceholders(template string, values map[string]string) string {
       result := template
       for key, val := range values {
           result = strings.ReplaceAll(result, "{"+key+"}", val)
       }
       return result
   }

   // FormatWithThousandSeparators formats an int64 with comma separators.
   func FormatWithThousandSeparators(n int64) string {
       negative := n < 0
       if negative {
           n = -n
       }
       s := fmt.Sprintf("%d", n)
       // Insert commas from right
       var result []byte
       for i, c := range s {
           if i > 0 && (len(s)-i)%3 == 0 {
               result = append(result, ',')
           }
           result = append(result, byte(c))
       }
       if negative {
           return "-" + string(result)
       }
       return string(result)
   }
   ```

2. Verify: `cd src/go-backend && go build ./...`

---

### Task 3: Backend — Refactor PriceAlertService to read config from Redis

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go`

**Security notes:** Config read from trusted Redis store. Unknown placeholders left as-is (no code injection path).

**Steps:**

1. Remove the per-field config from `priceAlertService` struct. Keep only the Redis client:
   ```go
   type priceAlertService struct {
       goldPriceSvc   GoldPriceService
       silverPriceSvc SilverPriceService
       notifRepo      repository.NotificationRepository
       userRepo       repository.UserRepository
       redisClient    *pkgredis.RedisClient
       pushSvc        PushService
   }
   ```

2. Simplify constructor — remove env var reads:
   ```go
   func NewPriceAlertService(
       goldPriceSvc GoldPriceService,
       silverPriceSvc SilverPriceService,
       notifRepo repository.NotificationRepository,
       userRepo repository.UserRepository,
       rdb *pkgredis.RedisClient,
       pushSvc PushService,
   ) PriceAlertService {
       return &priceAlertService{
           goldPriceSvc:   goldPriceSvc,
           silverPriceSvc: silverPriceSvc,
           notifRepo:      notifRepo,
           userRepo:       userRepo,
           redisClient:    rdb,
           pushSvc:        pushSvc,
       }
   }
   ```

3. In `CheckAndAlert`, read config at the start:
   ```go
   func (s *priceAlertService) CheckAndAlert(ctx context.Context) error {
       cfg := LoadPriceAlertConfig(ctx, s.redisClient)
       // ... rest of logic uses cfg
   ```

4. Replace hardcoded category setup with config-driven logic:
   - For each of the 4 categories, check `cfg.Categories[cat].Enabled` — skip disabled categories
   - Use `cfg.Categories[cat].ThresholdPct` instead of `s.goldVNDPct`, etc.
   - Use `cfg.TopMoversCount` instead of hardcoded `5`
   - Use `cfg.CooldownMinutes` instead of `s.cooldownMins`

5. Replace hardcoded push notification title/body with template resolution:
   ```go
   // Build placeholder values from top mover
   topMover := significant[0]
   placeholders := map[string]string{
       "moverName":     topMover.Name,
       "moverCode":     topMover.TypeCode,
       "direction":     directionSymbol(topMover.Direction),
       "directionText": directionText(topMover.Direction),
       "changePct":     fmt.Sprintf("%.1f", topMover.ChangePct),
       "priceDiff":     FormatWithThousandSeparators(topMover.PriceDiff),
       "category":      categoryDisplayName(cat.category),
       "moverCount":    fmt.Sprintf("%d", len(significant)),
   }

   catCfg := cfg.Categories[cat.category]
   title := ResolvePlaceholders(catCfg.TitleTemplate, placeholders)
   body := ResolvePlaceholders(catCfg.BodyTemplate, placeholders)
   ```

6. Add helper functions for direction and category display:
   ```go
   func directionSymbol(dir string) string {
       if dir == "up" {
           return "↑"
       }
       return "↓"
   }

   func directionText(dir string) string {
       if dir == "up" {
           return "tăng"
       }
       return "giảm"
   }

   func categoryDisplayName(cat string) string {
       names := map[string]string{
           "gold_vnd":   "Vàng trong nước",
           "gold_usd":   "Vàng thế giới",
           "silver_vnd": "Bạc trong nước",
           "silver_usd": "Bạc thế giới",
       }
       if name, ok := names[cat]; ok {
           return name
       }
       return cat
   }
   ```

7. Remove `envFloat` and `envInt` helper functions (now in `price_alert_config.go`). Wait — they're still used by `DefaultPriceAlertConfig()` in the config file. Move them to `price_alert_config.go` instead.

8. Verify: `cd src/go-backend && go build ./...`
9. Run existing tests: `cd src/go-backend && go test ./domain/service/ -run TestPriceAlert -v`

---

### Task 4: Backend — Update AdminService broadcast to use configurable title

**Files:**
- Modify: `src/go-backend/domain/service/admin_service.go`

**Security notes:** The broadcast title comes from admin-configured Redis, not from the current request. HTML already stripped during config save.

**Steps:**

1. In `Broadcast` method (~line 297), replace the hardcoded title:
   ```go
   // Before:
   // _ = s.pushSvc.SendToAll(ctx, "Thông báo từ hệ thống", message, "")

   // After:
   cfg := LoadPriceAlertConfig(ctx, s.redisClient)
   _ = s.pushSvc.SendToAll(ctx, cfg.BroadcastTitle, message, "")
   ```

2. Also add the `broadcastTitle` to the notification metadata so the frontend can display it:
   ```go
   metadata := map[string]interface{}{
       "message":        message,
       "adminId":        adminUserID,
       "adminName":      admin.Name,
       "broadcastTitle": cfg.BroadcastTitle,
   }
   ```

3. Verify: `cd src/go-backend && go build ./...`

---

### Task 5: Backend — Create PriceAlertConfig handler and register routes

**Files:**
- Create: `src/go-backend/handlers/price_alert_config.go`
- Modify: `src/go-backend/handlers/builder.go`
- Modify: `src/go-backend/handlers/routes.go`

**Security notes:** Both endpoints behind AuthMiddleware + AdminMiddleware. Server-side validation and HTML stripping on PUT.

**Steps:**

1. Create `price_alert_config.go`:
   ```go
   package handlers

   import (
       "net/http"
       "time"

       "wealthjourney/domain/service"
       pkgredis "wealthjourney/pkg/redis"

       "github.com/gin-gonic/gin"
   )

   type PriceAlertConfigHandler struct {
       redisClient *pkgredis.RedisClient
   }

   func NewPriceAlertConfigHandler(rdb *pkgredis.RedisClient) *PriceAlertConfigHandler {
       return &PriceAlertConfigHandler{redisClient: rdb}
   }

   // GetConfig handles GET /api/v1/admin/price-alert-config
   func (h *PriceAlertConfigHandler) GetConfig(c *gin.Context) {
       cfg := service.LoadPriceAlertConfig(c.Request.Context(), h.redisClient)

       c.JSON(http.StatusOK, gin.H{
           "success":   true,
           "config":    cfg,
           "timestamp": time.Now().Format(time.RFC3339),
       })
   }

   // UpdateConfig handles PUT /api/v1/admin/price-alert-config
   func (h *PriceAlertConfigHandler) UpdateConfig(c *gin.Context) {
       var req service.PriceAlertConfig
       if err := c.ShouldBindJSON(&req); err != nil {
           c.JSON(http.StatusBadRequest, gin.H{
               "success": false,
               "message": "Invalid request body",
               "errors":  map[string]string{"body": err.Error()},
           })
           return
       }

       // Load current config for merging (partial updates)
       current := service.LoadPriceAlertConfig(c.Request.Context(), h.redisClient)

       // Merge: only update provided fields
       merged := mergeConfig(current, req)

       // Sanitize HTML from all string fields
       service.SanitizePriceAlertConfig(&merged)

       // Validate
       if errs := service.ValidatePriceAlertConfig(merged); errs != nil {
           c.JSON(http.StatusBadRequest, gin.H{
               "success": false,
               "message": "Validation failed",
               "errors":  errs,
           })
           return
       }

       // Save to Redis
       if err := service.SavePriceAlertConfig(c.Request.Context(), h.redisClient, merged); err != nil {
           c.JSON(http.StatusServiceUnavailable, gin.H{
               "success": false,
               "message": "Failed to save configuration",
           })
           return
       }

       c.JSON(http.StatusOK, gin.H{
           "success":   true,
           "message":   "Price alert configuration updated",
           "config":    merged,
           "timestamp": time.Now().Format(time.RFC3339),
       })
   }

   // mergeConfig merges a partial update into the current config.
   func mergeConfig(current, update service.PriceAlertConfig) service.PriceAlertConfig {
       result := current

       if update.CooldownMinutes > 0 {
           result.CooldownMinutes = update.CooldownMinutes
       }
       if update.TopMoversCount > 0 {
           result.TopMoversCount = update.TopMoversCount
       }
       if update.BroadcastTitle != "" {
           result.BroadcastTitle = update.BroadcastTitle
       }

       // Merge per-category settings
       for cat, catUpdate := range update.Categories {
           if existing, ok := result.Categories[cat]; ok {
               // Merge individual fields
               existing.Enabled = catUpdate.Enabled
               if catUpdate.ThresholdPct > 0 {
                   existing.ThresholdPct = catUpdate.ThresholdPct
               }
               if catUpdate.TitleTemplate != "" {
                   existing.TitleTemplate = catUpdate.TitleTemplate
               }
               if catUpdate.BodyTemplate != "" {
                   existing.BodyTemplate = catUpdate.BodyTemplate
               }
               result.Categories[cat] = existing
           }
       }

       return result
   }
   ```

2. Add `PriceAlertConfig *PriceAlertConfigHandler` to `AllHandlers` struct in `builder.go`

3. Wire in `NewHandlers`:
   ```go
   PriceAlertConfig: func() *PriceAlertConfigHandler {
       if deps.RDB != nil {
           return NewPriceAlertConfigHandler(deps.RDB)
       }
       return nil
   }(),
   ```

4. Register routes in `routes.go` inside the admin group:
   ```go
   // Price alert configuration
   if h.PriceAlertConfig != nil {
       admin.GET("/price-alert-config", h.PriceAlertConfig.GetConfig)
       admin.PUT("/price-alert-config", h.PriceAlertConfig.UpdateConfig)
   }
   ```

5. Verify: `cd src/go-backend && go build ./...`

---

### Task 6: Backend — Unit tests for config and refactored service

**Files:**
- Create: `src/go-backend/domain/service/price_alert_config_test.go`
- Modify: `src/go-backend/domain/service/price_alert_service_test.go` (update existing tests for new config pattern)

**Steps:**

1. Create `price_alert_config_test.go` with tests:
   - `TestDefaultPriceAlertConfig` — verify default values
   - `TestValidatePriceAlertConfig_Valid` — valid config passes
   - `TestValidatePriceAlertConfig_InvalidCooldown` — out of range
   - `TestValidatePriceAlertConfig_InvalidThreshold` — out of range
   - `TestValidatePriceAlertConfig_HTMLStripping` — templates with HTML rejected after strip makes them empty
   - `TestSanitizePriceAlertConfig` — HTML tags removed
   - `TestResolvePlaceholders` — basic substitution
   - `TestResolvePlaceholders_UnknownLeft` — unknown placeholders left as-is
   - `TestFormatWithThousandSeparators` — formatting correctness
   - `TestLoadPriceAlertConfig_FromRedis` — miniredis with stored config
   - `TestLoadPriceAlertConfig_Fallback` — no Redis key returns defaults
   - `TestSavePriceAlertConfig` — round-trip save + load

2. Update existing `price_alert_service_test.go` tests to work with the refactored service (no longer stores thresholds in struct — uses Redis config). Seed the miniredis with a config JSON before tests.

3. Verify: `cd src/go-backend && go test ./domain/service/ -run "TestPriceAlert|TestDefault|TestValidate|TestSanitize|TestResolve|TestFormat|TestLoad|TestSave" -v`

---

### Task 7: Frontend — Update `PriceAlertMetadata` and `BroadcastMetadata` interfaces

**Files:**
- Modify: `src/wj-client/components/notifications/NotificationItem.tsx`

**Security notes:** `priceDiff` is display-only. `broadcastTitle` replaces hardcoded string.

**Steps:**

1. Update `PriceAlertMetadata` interface to include `priceDiff`:
   ```typescript
   interface PriceAlertMetadata {
     category: string;
     movers: Array<{
       typeCode: string;
       name: string;
       direction: string;
       changePct: number;
       priceDiff: number; // NEW: currentBuy - baseline
     }>;
   }
   ```

2. Update `BroadcastMetadata` interface to include `broadcastTitle`:
   ```typescript
   interface BroadcastMetadata {
     message: string;
     adminName?: string;
     broadcastTitle?: string; // NEW: configurable title
   }
   ```

3. In the admin_broadcast rendering section (~line 117), use `broadcastTitle` from metadata:
   ```typescript
   <p className="font-vietnam text-sm text-v2-text-primary leading-snug font-medium">
     {meta?.broadcastTitle || "Thông báo từ hệ thống"}
   </p>
   ```

4. Verify: `cd src/wj-client && npm run build`

---

### Task 8: Frontend — Add i18n translations for Notifications tab and price alert config

**Files:**
- Modify: `src/wj-client/messages/vi/admin.json`
- Modify: `src/wj-client/messages/en/admin.json`

**Steps:**

1. Add translations for price alert config section. In `vi/admin.json`, add under `"admin"`:
   ```json
   "notifications": {
     "tab": "Thông báo"
   },
   "priceAlertConfig": {
     "title": "Cấu hình cảnh báo giá",
     "globalSettings": "Cài đặt chung",
     "cooldownMinutes": "Thời gian chờ (phút)",
     "cooldownHelp": "Thời gian tối thiểu giữa các cảnh báo cùng loại",
     "topMoversCount": "Số lượng biến động hiển thị",
     "topMoversHelp": "Số lượng sản phẩm biến động mạnh nhất trong thông báo",
     "broadcastTitle": "Tiêu đề thông báo hệ thống",
     "broadcastTitleHelp": "Tiêu đề cho thông báo broadcast từ admin",
     "categorySettings": "Cài đặt theo loại",
     "enabled": "Bật cảnh báo",
     "thresholdPct": "Ngưỡng biến động (%)",
     "titleTemplate": "Mẫu tiêu đề",
     "bodyTemplate": "Mẫu nội dung",
     "placeholderGuide": "Biến có thể sử dụng",
     "placeholders": {
       "moverName": "Tên sản phẩm (VD: SJC 1L-10L)",
       "moverCode": "Mã sản phẩm (VD: SJL1L10)",
       "direction": "Mũi tên (↑ hoặc ↓)",
       "directionText": "Hướng (tăng hoặc giảm)",
       "changePct": "% biến động (VD: 2.1)",
       "priceDiff": "Chênh lệch giá (VD: 1,500,000)",
       "category": "Tên loại (VD: Vàng trong nước)",
       "moverCount": "Số sản phẩm biến động"
     },
     "save": "Lưu cài đặt",
     "saving": "Đang lưu...",
     "toast": {
       "success": "Đã cập nhật cấu hình cảnh báo giá",
       "error": "Không thể cập nhật cấu hình"
     },
     "categories": {
       "gold_vnd": "Vàng trong nước (VND)",
       "gold_usd": "Vàng thế giới (USD)",
       "silver_vnd": "Bạc trong nước (VND)",
       "silver_usd": "Bạc thế giới (USD)"
     }
   }
   ```

2. Add corresponding English translations in `en/admin.json`:
   ```json
   "notifications": {
     "tab": "Notifications"
   },
   "priceAlertConfig": {
     "title": "Price Alert Settings",
     "globalSettings": "Global Settings",
     "cooldownMinutes": "Cooldown (minutes)",
     "cooldownHelp": "Minimum time between alerts of the same category",
     "topMoversCount": "Top movers count",
     "topMoversHelp": "Number of top movers included in notification",
     "broadcastTitle": "System notification title",
     "broadcastTitleHelp": "Title for admin broadcast notifications",
     "categorySettings": "Per-Category Settings",
     "enabled": "Enable alerts",
     "thresholdPct": "Threshold (%)",
     "titleTemplate": "Title template",
     "bodyTemplate": "Body template",
     "placeholderGuide": "Available placeholders",
     "placeholders": {
       "moverName": "Product name (e.g. SJC 1L-10L)",
       "moverCode": "Product code (e.g. SJL1L10)",
       "direction": "Arrow (↑ or ↓)",
       "directionText": "Direction text (tăng or giảm)",
       "changePct": "Change % (e.g. 2.1)",
       "priceDiff": "Price difference (e.g. 1,500,000)",
       "category": "Category name (e.g. Vàng trong nước)",
       "moverCount": "Number of movers"
     },
     "save": "Save Settings",
     "saving": "Saving...",
     "toast": {
       "success": "Price alert configuration updated",
       "error": "Failed to update configuration"
     },
     "categories": {
       "gold_vnd": "Domestic Gold (VND)",
       "gold_usd": "World Gold (USD)",
       "silver_vnd": "Domestic Silver (VND)",
       "silver_usd": "World Silver (USD)"
     }
   }
   ```

3. Rename the broadcast tab label in existing translations:
   - In `vi/admin.json`, change `"broadcast": "Broadcast"` to `"broadcast": "Thông báo"` under `page.tabs` (or check existing value)
   - In `en/admin.json`, change tab label to `"Notifications"`

4. Verify: `cd src/wj-client && npm run build`

---

### Task 9: Frontend — Create `PriceAlertConfigForm` component

**Files:**
- Create: `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx`

**Security notes:** Client-side validation mirrors server-side rules. All data submitted via authenticated admin API.

**Component inventory check:**
- Reusing: `Button` (shared), `LoadingSpinner` (shared), `apiClient` (utils)
- Creating: `PriceAlertConfigForm` (feature-specific, not reusable elsewhere)
- NOT using: `FormNumberInput`/`FormTextarea` with react-hook-form (this form uses simple controlled inputs like `AdminBroadcastForm` pattern for consistency with existing admin forms)

**Steps:**

1. Create `PriceAlertConfigForm.tsx`:

   ```typescript
   "use client";

   import { useState, useEffect, useCallback } from "react";
   import { useTranslations } from "next-intl";
   import { apiClient } from "@/utils/api-client";
   import { Button } from "@/components/Button";
   import { ButtonType } from "@/app/constants";
   import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

   interface CategoryConfig {
     enabled: boolean;
     thresholdPct: number;
     titleTemplate: string;
     bodyTemplate: string;
   }

   interface PriceAlertConfig {
     cooldownMinutes: number;
     topMoversCount: number;
     broadcastTitle: string;
     categories: Record<string, CategoryConfig>;
   }

   interface ConfigResponse {
     success: boolean;
     config: PriceAlertConfig;
   }

   const CATEGORIES = ["gold_vnd", "gold_usd", "silver_vnd", "silver_usd"] as const;

   const PLACEHOLDERS = [
     "moverName", "moverCode", "direction", "directionText",
     "changePct", "priceDiff", "category", "moverCount",
   ] as const;

   export function PriceAlertConfigForm() {
     const t = useTranslations("admin.priceAlertConfig");
     const [config, setConfig] = useState<PriceAlertConfig | null>(null);
     const [isLoading, setIsLoading] = useState(true);
     const [isSaving, setIsSaving] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [success, setSuccess] = useState<string | null>(null);
     const [expandedCategory, setExpandedCategory] = useState<string | null>("gold_vnd");

     const fetchConfig = useCallback(async () => {
       try {
         setIsLoading(true);
         const res = await apiClient.get<ConfigResponse>("/api/v1/admin/price-alert-config");
         const data = res as unknown as ConfigResponse;
         if (data.success) {
           setConfig(data.config);
         }
       } catch {
         setError(t("toast.error"));
       } finally {
         setIsLoading(false);
       }
     }, [t]);

     useEffect(() => {
       fetchConfig();
     }, [fetchConfig]);

     const handleSave = async () => {
       if (!config || isSaving) return;
       setIsSaving(true);
       setError(null);
       setSuccess(null);

       try {
         const res = await apiClient.put<ConfigResponse>(
           "/api/v1/admin/price-alert-config",
           config,
         );
         const data = res as unknown as ConfigResponse;
         if (data.success) {
           setSuccess(t("toast.success"));
           setConfig(data.config);
         } else {
           setError((data as any).message || t("toast.error"));
         }
       } catch (err: unknown) {
         setError(err instanceof Error ? err.message : t("toast.error"));
       } finally {
         setIsSaving(false);
       }
     };

     // ... update handlers for global fields, category fields, toggle
     // ... render: loading spinner, global settings section, per-category
     //     accordion cards, placeholder guide, save button, success/error alerts
   }
   ```

2. The component renders:
   - **Loading state**: `LoadingSpinner` while fetching
   - **Global settings section**: cooldown (number input), top movers (number input), broadcast title (text input)
   - **Per-category accordion cards** (4 cards): each with enabled toggle (checkbox), threshold input, title template textarea, body template textarea. Clicking header expands/collapses.
   - **Placeholder reference guide**: collapsible section listing all available placeholders with descriptions
   - **Save button**: calls PUT endpoint
   - **Success/error alerts**: same pattern as `AdminBroadcastForm`
   - **Styling**: matches existing admin page patterns (v2 design tokens, font-vietnam, etc.)

3. Verify: `cd src/wj-client && npm run build`

---

### Task 10: Frontend — Update admin page: rename tab, integrate PriceAlertConfigForm

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/admin/page.tsx`

**Steps:**

1. Rename the `"broadcast"` tab to `"notifications"` in the `AdminTab` type and `TABS` array:
   ```typescript
   type AdminTab = "seo" | "users" | "feedback" | "notifications";

   const TABS: { id: AdminTab; label: string }[] = [
     { id: "seo", label: t("page.tabs.seo") },
     { id: "users", label: t("page.tabs.users") },
     { id: "feedback", label: t("page.tabs.feedback") },
     { id: "notifications", label: t("page.tabs.notifications") || "Notifications" },
   ];
   ```

   Note: Update the tab translation key to point to `"notifications"` instead of `"broadcast"`.

2. Update the conditional render for the notifications tab:
   ```typescript
   {activeTab === "notifications" && (
     <div className="space-y-8">
       {/* Section 1: Broadcast */}
       <AdminBroadcastForm />

       {/* Divider */}
       <hr className="border-v2-border-light" />

       {/* Section 2: Price Alert Settings */}
       <PriceAlertConfigForm />
     </div>
   )}
   ```

3. Import `PriceAlertConfigForm`:
   ```typescript
   import { PriceAlertConfigForm } from "@/features/admin/components/PriceAlertConfigForm";
   ```

4. Update the default tab URL parameter handling if needed (the old `?tab=broadcast` URLs should redirect to `?tab=notifications`).

5. Verify: `cd src/wj-client && npm run build`

---

### Task 11: Update C4 architecture diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. In `c4-component-backend.md`:
   - Add `PriceAlertConfigHandler` to the Handlers layer
   - Update `PriceAlertService` description: "Reads config from Redis (with env var fallback), detects price fluctuations, resolves notification templates, sends alerts"

2. In `c4-component-frontend.md`:
   - Add `PriceAlertConfigForm` component under the admin feature module
   - Note the tab rename from "Broadcast" to "Notifications"

3. Commit diagram changes

---

### Task 12: Update runtime flow diagrams

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Update the "Price Alert Detection" sequence diagram to show:
   - Config read from Redis at the start of CheckAndAlert
   - Per-category enabled check (skip disabled categories)
   - Template resolution step for title/body
   - Note about config fallback to env var defaults

2. Add "Admin Config Update" flow (simple — just CRUD, but worth a note):
   - Admin PUT → validate → sanitize → save to Redis → return updated config
   - No restart needed — next PriceAlertJob run picks up new config

---

## Task Dependencies & Parallelization

```
Independent foundations (parallel): Tasks 1, 2
After config model: Task 3 (refactor service, depends on 1+2)
After refactor: Task 4 (broadcast title, depends on 3)
After config model: Task 5 (handler, depends on 2)
After refactored service: Task 6 (tests, depends on 3)
Frontend (independent of backend): Tasks 7, 8 (parallel)
After translations: Task 9 (form component, depends on 8)
After form: Task 10 (admin page integration, depends on 9)
Docs (last): Tasks 11, 12 (parallel)
```

```
Batch 1 (parallel): Tasks 1, 2
Batch 2 (parallel): Tasks 3, 5
Batch 3: Task 4 (sequential after 3)
Batch 4: Task 6 (sequential after 3)
Batch 5 (parallel): Tasks 7, 8
Batch 6: Task 9 (after 8)
Batch 7: Task 10 (after 9)
Batch 8 (parallel): Tasks 11, 12
```

## Verification

### Backend
- `cd src/go-backend && go build ./...` after each backend task
- `cd src/go-backend && go test ./domain/service/ -run "TestPriceAlert|TestDefault|TestValidate|TestSanitize|TestResolve|TestFormat|TestLoad|TestSave" -v`
- Test GET config: `curl -H "Authorization: Bearer <admin-token>" http://localhost:8080/api/v1/admin/price-alert-config`
- Test PUT config: `curl -X PUT -H "Authorization: Bearer <admin-token>" -H "Content-Type: application/json" -d '{"cooldownMinutes":90}' http://localhost:8080/api/v1/admin/price-alert-config`

### Frontend
- `cd src/wj-client && npm run build`
- Verify admin page shows "Notifications" tab
- Verify PriceAlertConfigForm loads and displays current config
- Verify save works with toast feedback
- Verify broadcast title field appears in form
