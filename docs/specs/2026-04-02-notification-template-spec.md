# User Price Alert Notification Template Configuration

## Summary

Replace hardcoded user price alert notification messages with admin-configurable templates by extending the existing `PriceAlertConfig` Redis-based configuration system. Reuses the existing `ResolvePlaceholders()`, `FormatPriceForDisplay()`, and `stripHTML()` infrastructure from system price alerts. Admins configure templates from a new sub-section in the existing `PriceAlertConfigForm.tsx` — same UI pattern with clickable placeholder chips and live preview.

**Current state:** Push notification messages are hardcoded in `user_price_alert_service.go`:
```
Title: "Price Alert: {name}"
Body:  "{name} has gone above/below {targetPrice}"
```

**After:** Messages read from `PriceAlertConfig` in Redis:
```
Title: "Cảnh báo giá SJC 9999"
Body:  "SJC 9999 tăng vượt mức 50,000 VND"
```

## User Stories

- As an **admin**, I want to configure notification title and body templates for user price alerts, so that the messages match our brand voice and language.
- As a **user**, I want to receive price alert notifications with properly formatted messages (Vietnamese, with currency), so that I can quickly understand what happened.

## Functional Requirements

### FR-1: Extend PriceAlertConfig Struct

Add 3 new fields to the existing `PriceAlertConfig` struct in `price_alert_config.go`:

```go
type PriceAlertConfig struct {
    // ... existing fields ...
    CooldownMinutes              int
    TopMoversCount               int
    Categories                   map[string]PriceAlertCategoryConfig

    // NEW: User price alert templates
    UserAlertTitleTemplate       string  // Default: "Cảnh báo giá {name}"
    UserAlertAboveBodyTemplate   string  // Default: "{name} tăng vượt mức {price}"
    UserAlertBelowBodyTemplate   string  // Default: "{name} giảm dưới mức {price}"
}
```

**Acceptance criteria:**
- [ ] New fields added to `PriceAlertConfig` struct
- [ ] Default values provided via env vars or hardcoded defaults
- [ ] Existing config loading/saving backwards-compatible (old configs without new fields get defaults)
- [ ] Validation: title 1-200 chars, body 1-500 chars, HTML stripped

### FR-2: Default Templates

| Field | Default Value | Env Var (fallback) |
|-------|--------------|-------------------|
| `UserAlertTitleTemplate` | `Cảnh báo giá {name}` | `USER_ALERT_TITLE_TEMPLATE` |
| `UserAlertAboveBodyTemplate` | `{name} tăng vượt mức {price}` | `USER_ALERT_ABOVE_BODY_TEMPLATE` |
| `UserAlertBelowBodyTemplate` | `{name} giảm dưới mức {price}` | `USER_ALERT_BELOW_BODY_TEMPLATE` |

**Acceptance criteria:**
- [ ] Defaults applied when config is first loaded (no Redis key yet)
- [ ] Defaults applied when field is empty string in Redis
- [ ] Env var overrides hardcoded defaults

### FR-3: Template Placeholder Substitution

Reuse existing `ResolvePlaceholders(template, placeholders)` from `price_alert_config.go`.

When a user alert triggers, build the placeholder map and resolve:

```go
placeholders := map[string]string{
    "name":         alert.Name,                                    // "SJC 9999"
    "symbol":       alert.Symbol,                                  // "SJC"
    "price":        FormatUserAlertPrice(alert.TargetPrice, alert.Currency),  // "50,000 VND"
    "currentPrice": FormatUserAlertPrice(currentPrice, alert.Currency),       // "51,200 VND"
    "currency":     alert.Currency,                                // "VND"
    "priceSide":    priceSideDisplayName(alert.PriceSide),         // "mua" / "bán"
}
```

**Supported placeholders:**

| Placeholder | Value | Example |
|-------------|-------|---------|
| `{name}` | Asset display name | `SJC 9999` |
| `{symbol}` | Symbol code | `SJC` |
| `{price}` | Target price formatted with currency | `50,000 VND` |
| `{currentPrice}` | Current market price formatted with currency | `51,200 VND` |
| `{currency}` | Currency code | `VND` |
| `{priceSide}` | Buy/sell side in Vietnamese | `mua` / `bán` |

**Price formatting rules** (reuse `FormatPriceForDisplay` pattern):
- VND: no decimals, comma thousands separator → `1,234,567 VND`
- USD: 2 decimals, comma thousands separator → `50,000.00 USD`

**Acceptance criteria:**
- [ ] Reuses existing `ResolvePlaceholders()` — no new template engine
- [ ] All 6 placeholders replaced correctly
- [ ] Unknown placeholders left as-is
- [ ] Price includes currency automatically

### FR-4: Wire Templates into User Alert Evaluation

Modify `EvaluateAlerts()` in `user_price_alert_service.go`:

1. Load `PriceAlertConfig` from Redis (already done for system alerts — reuse the same config load)
2. On alert trigger, select template based on direction:
   - `direction == "above"` → `config.UserAlertAboveBodyTemplate`
   - `direction == "below"` → `config.UserAlertBelowBodyTemplate`
   - Title always uses `config.UserAlertTitleTemplate`
3. Resolve placeholders using alert metadata
4. Use resolved title/body for push notification, SSE, and in-app notification metadata

**Acceptance criteria:**
- [ ] Templates loaded once per evaluation cycle (not per alert)
- [ ] Fallback to hardcoded defaults if config load fails
- [ ] Resolved title/body used in all 3 notification channels (push, SSE, in-app metadata)

### FR-5: Extend Admin Config Validation

Add validation for new fields in existing `ValidatePriceAlertConfig()`:

- `UserAlertTitleTemplate`: 1-200 chars, non-empty, HTML stripped
- `UserAlertAboveBodyTemplate`: 1-500 chars, non-empty, HTML stripped
- `UserAlertBelowBodyTemplate`: 1-500 chars, non-empty, HTML stripped

**Acceptance criteria:**
- [ ] Validation runs on PUT `/api/v1/admin/price-alert-config`
- [ ] Empty strings fall back to defaults (not rejected)
- [ ] HTML tags stripped via existing `stripHTML()`

### FR-6: Admin UI — User Alert Templates Section

New section in `PriceAlertConfigForm.tsx`, below existing per-category config and above the placeholder guide.

**Layout** — follows same pattern as existing category template config:

```
┌─────────────────────────────────────────────────┐
│  User Price Alert Templates                      │
│  Configure notification messages for individual  │
│  user price alerts                               │
│                                                  │
│  Title Template:                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ Cảnh báo giá {name}                        │ │
│  └─────────────────────────────────────────────┘ │
│  Chips: [name] [symbol] [price] [currentPrice]   │
│         [currency] [priceSide]                   │
│  Preview: Cảnh báo giá SJC 9999                  │
│                                                  │
│  Body Template (Above):                          │
│  ┌─────────────────────────────────────────────┐ │
│  │ {name} tăng vượt mức {price}               │ │
│  └─────────────────────────────────────────────┘ │
│  Chips: [name] [symbol] [price] [currentPrice]   │
│         [currency] [priceSide]                   │
│  Preview: SJC 9999 tăng vượt mức 50,000 VND     │
│                                                  │
│  Body Template (Below):                          │
│  ┌─────────────────────────────────────────────┐ │
│  │ {name} giảm dưới mức {price}               │ │
│  └─────────────────────────────────────────────┘ │
│  Chips: [name] [symbol] [price] [currentPrice]   │
│         [currency] [priceSide]                   │
│  Preview: SJC 9999 giảm dưới mức 50,000 VND     │
│                                                  │
│  ┌─ Placeholder Guide (collapsible) ──────────┐ │
│  │ {name} - Asset name (e.g., SJC 9999)       │ │
│  │ {symbol} - Symbol (e.g., SJC)              │ │
│  │ {price} - Target price with currency        │ │
│  │ {currentPrice} - Current price with currency│ │
│  │ {currency} - Currency code (e.g., VND)      │ │
│  │ {priceSide} - Buy/Sell side (mua/bán)       │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Sample values for preview:**
```typescript
const USER_ALERT_SAMPLE_VALUES: Record<string, string> = {
  name: "SJC 9999",
  symbol: "SJC",
  price: "50,000 VND",
  currentPrice: "51,200 VND",
  currency: "VND",
  priceSide: "mua",
};
```

**Acceptance criteria:**
- [ ] Section appears in existing `PriceAlertConfigForm.tsx`
- [ ] Clickable placeholder chips insert at cursor position (reuse existing chip pattern)
- [ ] Live preview updates as admin types
- [ ] Saves as part of existing config PUT (single save button)
- [ ] Reset button resets user alert templates to defaults too

## Non-Functional Requirements

- **Performance:** No additional overhead — config already loaded from Redis per evaluation cycle
- **Security:** Reuses existing admin auth + validation + HTML stripping
- **Reliability:** Hardcoded fallback if config not found or fields empty
- **Backwards compatibility:** Old configs without new fields auto-get defaults

## Architecture Changes (C4)

### Diagrams to Update

None — no new services/components. This extends existing `PriceAlertConfig` service and `PriceAlertConfigForm` component.

### New Diagrams

None needed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — the template resolution is a small inline change in the existing alert evaluation flow (replace hardcoded strings with config lookup + `ResolvePlaceholders`).

## Data Model Changes

**No new tables or migrations.** Templates stored in existing Redis key `price_alert:config` alongside system alert config.

## API Changes

**No new endpoints or proto messages.** The existing endpoints are reused:

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/v1/admin/price-alert-config` | Response now includes `userAlertTitleTemplate`, `userAlertAboveBodyTemplate`, `userAlertBelowBodyTemplate` |
| `PUT` | `/api/v1/admin/price-alert-config` | Request can include the 3 new fields (partial update) |
| `DELETE` | `/api/v1/admin/price-alert-config` | Reset also clears user alert templates back to defaults |

## UI/UX Changes

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Config form | `PriceAlertConfigForm` | `features/admin/components/PriceAlertConfigForm.tsx` |
| Placeholder chips | Already built in `PriceAlertConfigForm` | Same file |
| Live preview | Already built in `PriceAlertConfigForm` | Same file |
| Save/Reset buttons | Already built in `PriceAlertConfigForm` | Same file |
| Collapsible guide | Already built in `PriceAlertConfigForm` | Same file |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| None | — | All UI is added as a new section within existing `PriceAlertConfigForm.tsx` |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin (browser) | Template title/body text | Yes: Internet → App | REST Handler | Untrusted input |
| 2 | REST Handler | Validated config | No (same tier) | Redis | Existing config save path |
| 3 | Alert Job | Config from Redis | No (same tier) | Push Service | Template substitution |
| 4 | Push Service | Formatted notification | Yes: App → Browser | Web Push API | Push payload |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin config update | JWT + AdminMiddleware + input validation + HTML stripping |
| App → Browser | Push notification | Web Push encryption (VAPID) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin sends config update | Medium | Existing AdminMiddleware |
| T-2 | 1 | Internet → App | Tampering | XSS in template text | Low | `stripHTML()` + push notifications don't render HTML |
| T-3 | 1 | Internet → App | DoS | Rapid config updates | Low | Existing `RateLimitByUser` on admin routes |

### Authorization Rules

| Operation | Admin | Regular User | Unauthenticated |
|-----------|-------|-------------|-----------------|
| Read config | Allowed | Denied | Denied |
| Update config | Allowed | Denied | Denied |
| Reset config | Allowed | Denied | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| `userAlertTitleTemplate` | string | 1-200 chars, no HTML | `stripHTML()` + length check |
| `userAlertAboveBodyTemplate` | string | 1-500 chars, no HTML | `stripHTML()` + length check |
| `userAlertBelowBodyTemplate` | string | 1-500 chars, no HTML | `stripHTML()` + length check |

### External Dependency Risks

No new external dependencies. Reuses existing Redis, push notification infrastructure.

### Sensitive Data Handling

Templates contain no sensitive data.

### Issues & Risks Summary

1. **Low risk:** Template injection — mitigated by `stripHTML()` and push not rendering HTML
2. **Low risk:** Redis unavailability — mitigated by env var / hardcoded defaults
3. **Backwards compatible:** Old configs missing new fields auto-get defaults via `mergeDefaults()`

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Config has no user alert template fields (old config) | `mergeDefaults()` fills in default templates |
| Admin saves empty template string | Treated as "use default" — fallback applied |
| Redis unavailable during alert evaluation | Use hardcoded default templates |
| Admin resets config (DELETE) | All fields including user alert templates reset to defaults |
| Placeholder not in map | Left as literal text (e.g., `{unknownField}` in notification) |
| Very long asset name | OS/browser handles push notification truncation |

## Dependencies & Assumptions

- Existing `PriceAlertConfig` system is working (`price_alert_config.go`)
- Existing `ResolvePlaceholders()` function works correctly
- Existing `PriceAlertConfigForm.tsx` admin UI is functional
- `user_price_alert_service.go` can access `PriceAlertConfig` from Redis

## Out of Scope

- Per-language/locale templates
- Per-asset-type templates (same template for gold, silver, stocks)
- Template versioning or history
- User-facing template customization
- Email notification channel
- New DB table or proto messages (using existing Redis config)

## Files to Modify

| File | Change |
|------|--------|
| `src/go-backend/domain/service/price_alert_config.go` | Add 3 fields to struct, defaults, validation, merge logic |
| `src/go-backend/domain/service/user_price_alert_service.go` | Load config, resolve templates, use in push/SSE/in-app |
| `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx` | Add user alert template section with inputs, chips, preview |

**Estimated: ~3 files modified, 0 new files.**
