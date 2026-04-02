# User Price Alert Notification Template Configuration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace hardcoded user price alert notification messages with admin-configurable templates, reusing existing `PriceAlertConfig` infrastructure.

**Spec:** `docs/specs/2026-04-02-notification-template-spec.md`

**Architecture:** Extends the existing `PriceAlertConfig` Redis-based system (no new services/tables). Adds 3 string fields to the struct, a new `FormatUserAlertPrice()` helper + `priceSideDisplayName()`, wires templates into `EvaluateAlerts()`, extends validation/sanitization/merge, and adds a new UI section in `PriceAlertConfigForm.tsx`.

**Tech Stack:** Go 1.25, Redis (existing key), React 19 / TypeScript / Tailwind (existing admin form), next-intl i18n

## Security Implementation Notes

- **Authentication:** Existing `AuthMiddleware` + `AdminMiddleware` on all admin config endpoints — no change needed
- **Authorization:** Only admins can read/write config. Users receive notifications but never see template text
- **Input validation:** Server-side `ValidatePriceAlertConfig()` extended with title 1-200 chars, body 1-500 chars
- **Data sanitization:** `stripHTML()` applied to all 3 new template fields via `SanitizePriceAlertConfig()`; push notifications don't render HTML

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| PriceAlertConfigForm (existing sections) | `features/admin/components/PriceAlertConfigForm.tsx` | Container for new "User Alert Templates" section — same layout/styling patterns |
| Placeholder chips pattern | Same file, lines 416-436 | Reuse `insertAtCursor()` + chip button styling for 6 new placeholders |
| Live preview pattern | Same file, lines 437-449 | Reuse `resolvePlaceholders()` + preview box for new templates |
| Collapsible guide pattern | Same file, lines 511-544 | Reuse pattern for user alert placeholder guide |
| ConfirmationDialog | `components/modals/ConfirmationDialog.tsx` | Already used for reset confirmation |

**New components needed:**

| Component | Location | Justification |
|-----------|----------|---------------|
| None | — | All UI added as a new section within existing form component |

## C4 Architecture Diagram Updates

**Per spec:** None — no new services/components. This extends existing `PriceAlertConfig` service and `PriceAlertConfigForm` component.

## Runtime Flow Diagram Updates

**Per spec:** None — the template resolution is a small inline change in the existing alert evaluation flow. Skipping per the plan step instructions: "Simple CRUD with no branching, no multi-service coordination, and no complex error handling."

---

### Task 0: Update C4 Architecture Diagrams

**Skip.** Spec explicitly states no architecture changes or new diagrams needed.

---

### Task 1: Extend PriceAlertConfig Struct + Defaults + Validation

**Files:**

- Modify: `src/go-backend/domain/service/price_alert_config.go`
- Test: `src/go-backend/domain/service/price_alert_config_test.go`

**Security notes:** New template fields must be validated for length and HTML-stripped. Empty strings fall back to defaults (not rejected).

**Step 1: Write the failing tests**

Add tests to `price_alert_config_test.go`:

```go
func TestDefaultPriceAlertConfig_HasUserAlertTemplates(t *testing.T) {
    cfg := DefaultPriceAlertConfig()
    assert.NotEmpty(t, cfg.UserAlertTitleTemplate)
    assert.NotEmpty(t, cfg.UserAlertAboveBodyTemplate)
    assert.NotEmpty(t, cfg.UserAlertBelowBodyTemplate)
}

func TestValidatePriceAlertConfig_UserAlertTemplates(t *testing.T) {
    cfg := DefaultPriceAlertConfig()

    // Valid defaults pass
    errs := ValidatePriceAlertConfig(cfg)
    assert.Nil(t, errs)

    // Title too long (>200 chars)
    cfg.UserAlertTitleTemplate = strings.Repeat("a", 201)
    errs = ValidatePriceAlertConfig(cfg)
    assert.NotNil(t, errs)
    assert.Contains(t, errs, "userAlertTitleTemplate")

    // Body too long (>500 chars)
    cfg2 := DefaultPriceAlertConfig()
    cfg2.UserAlertAboveBodyTemplate = strings.Repeat("b", 501)
    errs = ValidatePriceAlertConfig(cfg2)
    assert.NotNil(t, errs)
    assert.Contains(t, errs, "userAlertAboveBodyTemplate")

    // Below body too long
    cfg3 := DefaultPriceAlertConfig()
    cfg3.UserAlertBelowBodyTemplate = strings.Repeat("c", 501)
    errs = ValidatePriceAlertConfig(cfg3)
    assert.NotNil(t, errs)
    assert.Contains(t, errs, "userAlertBelowBodyTemplate")

    // HTML stripped before validation — "<b>x</b>" → "x" (1 char, valid)
    cfg4 := DefaultPriceAlertConfig()
    cfg4.UserAlertTitleTemplate = "<b>test</b>"
    SanitizePriceAlertConfig(&cfg4)
    errs = ValidatePriceAlertConfig(cfg4)
    assert.Nil(t, errs)
    assert.Equal(t, "test", cfg4.UserAlertTitleTemplate)
}

func TestSanitizePriceAlertConfig_UserAlertTemplates(t *testing.T) {
    cfg := DefaultPriceAlertConfig()
    cfg.UserAlertTitleTemplate = "<script>alert('xss')</script>Price: {name}"
    cfg.UserAlertAboveBodyTemplate = "<b>{name}</b> above <i>{price}</i>"
    cfg.UserAlertBelowBodyTemplate = "{name} below {price}"
    SanitizePriceAlertConfig(&cfg)
    assert.Equal(t, "alert('xss')Price: {name}", cfg.UserAlertTitleTemplate)
    assert.Equal(t, "{name} above {price}", cfg.UserAlertAboveBodyTemplate)
    assert.Equal(t, "{name} below {price}", cfg.UserAlertBelowBodyTemplate)
}

func TestLoadPriceAlertConfig_BackwardsCompatible(t *testing.T) {
    // JSON without user alert fields should get defaults
    oldJSON := `{"cooldownMinutes":60,"topMoversCount":3,"categories":{}}`
    var cfg PriceAlertConfig
    json.Unmarshal([]byte(oldJSON), &cfg)
    // Simulate what LoadPriceAlertConfig does post-unmarshal
    defaults := DefaultPriceAlertConfig()
    if cfg.UserAlertTitleTemplate == "" {
        cfg.UserAlertTitleTemplate = defaults.UserAlertTitleTemplate
    }
    if cfg.UserAlertAboveBodyTemplate == "" {
        cfg.UserAlertAboveBodyTemplate = defaults.UserAlertAboveBodyTemplate
    }
    if cfg.UserAlertBelowBodyTemplate == "" {
        cfg.UserAlertBelowBodyTemplate = defaults.UserAlertBelowBodyTemplate
    }
    assert.NotEmpty(t, cfg.UserAlertTitleTemplate)
    assert.NotEmpty(t, cfg.UserAlertAboveBodyTemplate)
    assert.NotEmpty(t, cfg.UserAlertBelowBodyTemplate)
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -short -run "TestDefaultPriceAlertConfig_HasUserAlertTemplates|TestValidatePriceAlertConfig_UserAlertTemplates|TestSanitizePriceAlertConfig_UserAlertTemplates|TestLoadPriceAlertConfig_BackwardsCompatible" ./domain/service/...
```

**Step 3: Implement**

1. Add 3 new fields to `PriceAlertConfig` struct:

```go
type PriceAlertConfig struct {
    CooldownMinutes              int                                 `json:"cooldownMinutes"`
    TopMoversCount               int                                 `json:"topMoversCount"`
    Categories                   map[string]PriceAlertCategoryConfig `json:"categories"`
    UserAlertTitleTemplate       string                              `json:"userAlertTitleTemplate"`
    UserAlertAboveBodyTemplate   string                              `json:"userAlertAboveBodyTemplate"`
    UserAlertBelowBodyTemplate   string                              `json:"userAlertBelowBodyTemplate"`
}
```

2. Add defaults to `DefaultPriceAlertConfig()`:

```go
func DefaultPriceAlertConfig() PriceAlertConfig {
    return PriceAlertConfig{
        // ... existing fields ...
        UserAlertTitleTemplate:     envString("USER_ALERT_TITLE_TEMPLATE", "Cảnh báo giá {name}"),
        UserAlertAboveBodyTemplate: envString("USER_ALERT_ABOVE_BODY_TEMPLATE", "{name} tăng vượt mức {price}"),
        UserAlertBelowBodyTemplate: envString("USER_ALERT_BELOW_BODY_TEMPLATE", "{name} giảm dưới mức {price}"),
    }
}
```

3. Add `envString()` helper (if not existing):

```go
func envString(key, fallback string) string {
    if v := os.Getenv(key); v != "" {
        return v
    }
    return fallback
}
```

4. Extend `LoadPriceAlertConfig()` — add default-filling for empty user alert templates after unmarshal:

```go
// After existing category merge logic:
if cfg.UserAlertTitleTemplate == "" {
    cfg.UserAlertTitleTemplate = defaults.UserAlertTitleTemplate
}
if cfg.UserAlertAboveBodyTemplate == "" {
    cfg.UserAlertAboveBodyTemplate = defaults.UserAlertAboveBodyTemplate
}
if cfg.UserAlertBelowBodyTemplate == "" {
    cfg.UserAlertBelowBodyTemplate = defaults.UserAlertBelowBodyTemplate
}
```

5. Extend `ValidatePriceAlertConfig()` — add validation for new fields:

```go
// After existing category validation:
titleText := stripHTML(cfg.UserAlertTitleTemplate)
if len(titleText) == 0 || len(titleText) > 200 {
    errors["userAlertTitleTemplate"] = "must be 1-200 characters (no HTML)"
}
aboveText := stripHTML(cfg.UserAlertAboveBodyTemplate)
if len(aboveText) == 0 || len(aboveText) > 500 {
    errors["userAlertAboveBodyTemplate"] = "must be 1-500 characters (no HTML)"
}
belowText := stripHTML(cfg.UserAlertBelowBodyTemplate)
if len(belowText) == 0 || len(belowText) > 500 {
    errors["userAlertBelowBodyTemplate"] = "must be 1-500 characters (no HTML)"
}
```

6. Extend `SanitizePriceAlertConfig()`:

```go
func SanitizePriceAlertConfig(cfg *PriceAlertConfig) {
    // ... existing category sanitization ...
    cfg.UserAlertTitleTemplate = stripHTML(cfg.UserAlertTitleTemplate)
    cfg.UserAlertAboveBodyTemplate = stripHTML(cfg.UserAlertAboveBodyTemplate)
    cfg.UserAlertBelowBodyTemplate = stripHTML(cfg.UserAlertBelowBodyTemplate)
}
```

7. Add `FormatUserAlertPrice()` and `priceSideDisplayName()`:

```go
// FormatUserAlertPrice formats a price (int64) with currency suffix for user alerts.
// VND: no decimals, comma thousands → "1,234,567 VND"
// USD: 2 decimals, comma thousands → "50,000.00 USD"
func FormatUserAlertPrice(price int64, currency string) string {
    switch strings.ToUpper(currency) {
    case "USD":
        dollars := price / 100
        cents := price % 100
        return fmt.Sprintf("%s.%02d %s", FormatWithThousandSeparators(dollars), cents, currency)
    default:
        return fmt.Sprintf("%s %s", FormatWithThousandSeparators(price), currency)
    }
}

// priceSideDisplayName returns Vietnamese display name for buy/sell side.
func priceSideDisplayName(side string) string {
    switch side {
    case "buy":
        return "mua"
    case "sell":
        return "bán"
    default:
        return side
    }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -short -run "TestDefaultPriceAlertConfig_HasUserAlertTemplates|TestValidatePriceAlertConfig_UserAlertTemplates|TestSanitizePriceAlertConfig_UserAlertTemplates|TestLoadPriceAlertConfig_BackwardsCompatible" ./domain/service/...
```

**Step 5: Add tests for `FormatUserAlertPrice` and `priceSideDisplayName`**

```go
func TestFormatUserAlertPrice(t *testing.T) {
    tests := []struct {
        price    int64
        currency string
        expected string
    }{
        {50000, "VND", "50,000 VND"},
        {1234567, "VND", "1,234,567 VND"},
        {5000000, "USD", "50,000.00 USD"},
        {5050, "USD", "50.50 USD"},
        {0, "VND", "0 VND"},
    }
    for _, tt := range tests {
        result := FormatUserAlertPrice(tt.price, tt.currency)
        assert.Equal(t, tt.expected, result, "price=%d currency=%s", tt.price, tt.currency)
    }
}

func TestPriceSideDisplayName(t *testing.T) {
    assert.Equal(t, "mua", priceSideDisplayName("buy"))
    assert.Equal(t, "bán", priceSideDisplayName("sell"))
    assert.Equal(t, "unknown", priceSideDisplayName("unknown"))
}
```

**Step 6: Run all tests**

```bash
cd src/go-backend && go test -short ./domain/service/...
```

**Step 7: Commit**

```
feat(config): add user alert template fields to PriceAlertConfig
```

---

### Task 2: Extend mergeConfig for User Alert Templates

**Files:**

- Modify: `src/go-backend/handlers/price_alert_config.go`
- Test: `src/go-backend/handlers/price_alert_config_test.go` (create if needed)

**Security notes:** Merge logic must not overwrite templates with empty strings (empty = "keep current").

**Step 1: Write the failing test**

```go
func TestMergeConfig_UserAlertTemplates(t *testing.T) {
    current := service.PriceAlertConfig{
        CooldownMinutes:            120,
        TopMoversCount:             5,
        Categories:                 map[string]service.PriceAlertCategoryConfig{},
        UserAlertTitleTemplate:     "Current title {name}",
        UserAlertAboveBodyTemplate: "Current above {price}",
        UserAlertBelowBodyTemplate: "Current below {price}",
    }

    // Partial update: only title changed
    update := service.PriceAlertConfig{
        UserAlertTitleTemplate: "New title {name}",
    }

    merged := mergeConfig(current, update)
    assert.Equal(t, "New title {name}", merged.UserAlertTitleTemplate)
    assert.Equal(t, "Current above {price}", merged.UserAlertAboveBodyTemplate) // unchanged
    assert.Equal(t, "Current below {price}", merged.UserAlertBelowBodyTemplate) // unchanged
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -short -run "TestMergeConfig_UserAlertTemplates" ./handlers/...
```

**Step 3: Implement — extend `mergeConfig()`**

Add to `mergeConfig()` in `handlers/price_alert_config.go`, after the category merge block:

```go
// Merge user alert templates (empty string = keep current)
if update.UserAlertTitleTemplate != "" {
    result.UserAlertTitleTemplate = update.UserAlertTitleTemplate
}
if update.UserAlertAboveBodyTemplate != "" {
    result.UserAlertAboveBodyTemplate = update.UserAlertAboveBodyTemplate
}
if update.UserAlertBelowBodyTemplate != "" {
    result.UserAlertBelowBodyTemplate = update.UserAlertBelowBodyTemplate
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -short -run "TestMergeConfig_UserAlertTemplates" ./handlers/...
```

**Step 5: Run lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

```
feat(config): extend mergeConfig for user alert template fields
```

---

### Task 3: Wire Templates into EvaluateAlerts

**Files:**

- Modify: `src/go-backend/domain/service/user_price_alert_service.go`
- Test: `src/go-backend/domain/service/user_price_alert_service_test.go`

**Security notes:** Template resolution must not leak internal error details. If config load fails, fall back to hardcoded defaults. `stripHTML()` already applied at save time. Templates loaded once per evaluation cycle (not per alert).

**Step 1: Write the failing tests**

```go
func TestEvaluateAlerts_UsesTemplateFromConfig(t *testing.T) {
    // Test that resolved title/body from config templates appear in push notification
    // Mock dependencies: alertRepo returns 1 active alert, priceMap matches trigger condition
    // Assert: pushSvc.SendToUser called with resolved template, NOT hardcoded "Price Alert: ..."
}

func TestEvaluateAlerts_FallsBackToDefaults_WhenConfigLoadFails(t *testing.T) {
    // Test: rdb is nil → hardcoded defaults used
    // Assert: push notification uses default Vietnamese templates
}
```

*(Full test implementation depends on existing mock patterns in the test file)*

**Step 2: Run tests to verify they fail**

**Step 3: Implement**

In `EvaluateAlerts()`, add config load at the top (before the alert loop):

```go
func (s *userPriceAlertService) EvaluateAlerts(ctx context.Context) error {
    alerts, err := s.alertRepo.ListActive(ctx)
    if err != nil { ... }
    if len(alerts) == 0 { return nil }

    // Load templates once per evaluation cycle
    cfg := LoadPriceAlertConfig(ctx, s.rdb)

    // ... existing price fetch code ...

    for _, alert := range alerts {
        // ... existing trigger check code ...

        // Build placeholder map for template resolution
        placeholders := map[string]string{
            "name":         alert.Name,
            "symbol":       alert.Symbol,
            "price":        FormatUserAlertPrice(alert.TargetPrice, alert.Currency),
            "currentPrice": FormatUserAlertPrice(currentPrice, alert.Currency),
            "currency":     alert.Currency,
            "priceSide":    priceSideDisplayName(alert.PriceSide),
        }

        // Resolve templates
        resolvedTitle := ResolvePlaceholders(cfg.UserAlertTitleTemplate, placeholders)

        var resolvedBody string
        switch alert.Direction {
        case "above":
            resolvedBody = ResolvePlaceholders(cfg.UserAlertAboveBodyTemplate, placeholders)
        case "below":
            resolvedBody = ResolvePlaceholders(cfg.UserAlertBelowBodyTemplate, placeholders)
        }

        // Truncate title for push notification limits
        if len(resolvedTitle) > 65 {
            resolvedTitle = resolvedTitle[:62] + "…"
        }

        // Use resolved title/body in all 3 channels:
        // 1. In-app notification metadata — add resolvedTitle and resolvedBody to metadata map
        // 2. SSE — already uses metadata
        // 3. Push notification — replace hardcoded title/body:
        if s.pushSvc != nil {
            _ = s.pushSvc.SendToUser(ctx, alert.UserID, resolvedTitle, resolvedBody, "/dashboard/settings/alerts")
        }

        // ... rest of existing code (status update, cooldown, daily cap) ...
    }
}
```

Replace the existing hardcoded push notification block (lines 412-419):
```go
// REMOVE:
// title := fmt.Sprintf("Price Alert: %s", shortName)
// body := fmt.Sprintf("%s has gone %s %d", shortName, alert.Direction, alert.TargetPrice)
```

Also update the metadata map to include resolved title/body:
```go
metadata["resolvedTitle"] = resolvedTitle
metadata["resolvedBody"] = resolvedBody
```

**Step 4: Run tests**

```bash
cd src/go-backend && go test -short ./domain/service/...
```

**Step 5: Run lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

```
feat(alerts): wire configurable templates into user alert evaluation
```

---

### Task 4: Admin UI — User Alert Templates Section

**Files:**

- Modify: `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx`
- Modify: `src/wj-client/messages/vi/admin.json`
- Modify: `src/wj-client/messages/en/admin.json`
- Test: `src/wj-client/features/admin/components/__tests__/PriceAlertConfigForm.test.tsx` (add or extend)

**Security notes:** Template inputs are plain text (no rich editor). All sanitization happens server-side. Admin-only page behind auth.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `insertAtCursor()` from same file, chip button pattern, preview box pattern, collapsible guide pattern
- Reusing: Same `apiClient.put()` save flow — new fields sent as part of existing config PUT
- Reusing: Same reset flow — DELETE endpoint already resets all fields to defaults
- Creating new: Nothing — all UI added as a new section within existing component

**Step 1: Add i18n translations**

Add to `messages/vi/admin.json` under `priceAlertConfig`:

```json
{
  "userAlertTemplates": "Mẫu thông báo cảnh báo giá cá nhân",
  "userAlertTemplatesDesc": "Cấu hình tin nhắn thông báo cho cảnh báo giá của người dùng",
  "userAlertTitleTemplate": "Mẫu tiêu đề",
  "userAlertAboveBodyTemplate": "Mẫu nội dung (Tăng vượt mức)",
  "userAlertBelowBodyTemplate": "Mẫu nội dung (Giảm dưới mức)",
  "userAlertPlaceholderGuide": "Hướng dẫn placeholder cảnh báo giá cá nhân",
  "userAlertPlaceholders": {
    "name": "Tên tài sản (vd: SJC 9999)",
    "symbol": "Mã tài sản (vd: SJC)",
    "price": "Giá mục tiêu kèm tiền tệ",
    "currentPrice": "Giá thị trường hiện tại kèm tiền tệ",
    "currency": "Mã tiền tệ (vd: VND)",
    "priceSide": "Mua/Bán (mua/bán)"
  }
}
```

Add equivalent entries in `messages/en/admin.json`:

```json
{
  "userAlertTemplates": "User Price Alert Templates",
  "userAlertTemplatesDesc": "Configure notification messages for individual user price alerts",
  "userAlertTitleTemplate": "Title Template",
  "userAlertAboveBodyTemplate": "Body Template (Above Target)",
  "userAlertBelowBodyTemplate": "Body Template (Below Target)",
  "userAlertPlaceholderGuide": "User Alert Placeholder Guide",
  "userAlertPlaceholders": {
    "name": "Asset name (e.g., SJC 9999)",
    "symbol": "Symbol code (e.g., SJC)",
    "price": "Target price with currency",
    "currentPrice": "Current market price with currency",
    "currency": "Currency code (e.g., VND)",
    "priceSide": "Buy/Sell side (mua/bán)"
  }
}
```

**Step 2: Add UI section to PriceAlertConfigForm.tsx**

Constants to add:

```typescript
const USER_ALERT_PLACEHOLDERS = ["name", "symbol", "price", "currentPrice", "currency", "priceSide"];

const USER_ALERT_SAMPLE_VALUES: Record<string, string> = {
  name: "SJC 9999",
  symbol: "SJC",
  price: "50,000 VND",
  currentPrice: "51,200 VND",
  currency: "VND",
  priceSide: "mua",
};
```

State additions:

```typescript
const [showUserAlertPlaceholders, setShowUserAlertPlaceholders] = useState(false);
const userTitleRef = useRef<HTMLInputElement>(null);
const userAboveBodyRef = useRef<HTMLTextAreaElement>(null);
const userBelowBodyRef = useRef<HTMLTextAreaElement>(null);
```

New section — add between the per-category section and the existing placeholder guide section. Follows the **exact same patterns** as the existing category template UI:

1. Section header: `text-v2-gold-accent font-medium` with description in `text-v2-text-tertiary`
2. Three template inputs (1 text input for title, 2 textareas for above/below bodies)
3. Each with: placeholder chip row below, live preview below that
4. Collapsible user-alert-specific placeholder guide at the bottom
5. Chips use `insertAtCursor()` with the appropriate ref
6. Preview uses `resolvePlaceholders()` with `USER_ALERT_SAMPLE_VALUES`

Update functions:

```typescript
const updateUserAlertField = (field: string, value: string) => {
  if (!config) return;
  setConfig({ ...config, [field]: value });
};
```

**Step 3: Write component test**

Test that:
- User alert template section renders with 3 input fields
- Placeholder chips are present (6 chips × 3 fields)
- Clicking a chip inserts the placeholder text
- Live preview renders sample values
- Form save includes new fields in the PUT request body

**Step 4: Run tests**

```bash
cd src/wj-client && npm test -- --testPathPattern="PriceAlertConfigForm"
```

**Step 5: Responsive & accessibility check**

- Mobile (375px): Inputs stack vertically, chips wrap, preview box is full-width
- Desktop: Same layout as existing category templates (full-width within the form card)
- Touch targets: Chip buttons ≥ 44px height (reuse existing chip pattern that already meets this)
- Focus ring: `focus-visible:ring-2 focus-visible:ring-v2-gold-primary` on inputs (same as existing)

**Step 6: Commit**

```
feat(admin): add user alert template configuration UI section
```

---

### Task 5: End-to-End Verification & Lint

**Files:**

- All modified files from Tasks 1-4

**Step 1: Run backend lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 2: Run backend tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 3: Run frontend lint**

```bash
cd src/wj-client && npm run lint
```

**Step 4: Run frontend tests**

```bash
cd src/wj-client && npm test
```

**Step 5: Verify backwards compatibility**

- Start backend with `task backend:dev`
- With no existing user alert templates in Redis, GET config should return defaults
- PUT with only category changes should not clear user alert template fields
- DELETE should reset ALL fields including user alert templates to defaults

**Step 6: Commit (if any fixes needed)**

```
fix: address lint/test issues from notification template feature
```
