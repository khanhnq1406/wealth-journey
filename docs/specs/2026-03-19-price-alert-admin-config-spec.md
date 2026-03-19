# Price Alert Admin Configuration — Specification

## Summary

Add an admin UI to configure price alert settings (thresholds, cooldown, enable/disable per category, notification message templates, and top movers count) and broadcast notification title. The configuration lives in Redis with environment variables as defaults. The existing "Broadcast" tab on the admin page is expanded into a "Notifications" tab that houses both the broadcast form and the new price alert configuration panel. Additionally, a `priceDiff` field (currentBuy - baseline) is added to the price mover data for use in notification templates. The broadcast push notification title (currently hardcoded as "Thông báo từ hệ thống") becomes an admin-configurable setting.

## User Stories

- As an admin, I want to adjust price alert thresholds per category from the admin panel, so that I don't need to redeploy the backend to tune alert sensitivity.
- As an admin, I want to enable/disable price alerts per category, so that I can pause alerts for specific markets without affecting others.
- As an admin, I want to customize the broadcast notification title, so that system notifications can have contextually appropriate titles instead of a hardcoded string.
- As an admin, I want to customize the notification title and body templates with placeholders, so that the alert messages are meaningful and context-rich for users.
- As an admin, I want to control the cooldown duration and top movers count, so that I can balance alert frequency and information density.
- As a user, I want to see the price difference (not just percentage) in notifications, so that I understand the absolute magnitude of price changes.

## Functional Requirements

### FR-1: Price Alert Configuration API

Admin-only endpoints to read and update price alert configuration stored in Redis.

**GET /api/v1/admin/price-alert-config**
Returns the current configuration (from Redis, falling back to env var defaults).

**PUT /api/v1/admin/price-alert-config**
Updates the configuration in Redis. Partial updates supported — only provided fields are updated.

**Acceptance criteria:**
- [ ] Both endpoints require authentication + admin role (AuthMiddleware + AdminMiddleware)
- [ ] GET returns all config fields with current values (Redis or env var defaults)
- [ ] PUT validates all fields server-side before saving
- [ ] PUT returns the updated config in the response
- [ ] Config changes take effect on the next PriceAlertJob run (no restart needed)

### FR-2: Per-Category Configuration

Each of the 4 categories (gold_vnd, gold_usd, silver_vnd, silver_usd) has independent settings.

**Per-category fields:**
| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `enabled` | bool | `true` | — |
| `thresholdPct` | float64 | category-specific (2.0, 1.5, 3.0, 2.0) | 0.1 – 50.0 |
| `titleTemplate` | string | category-specific (see FR-4) | 1–200 chars, no HTML |
| `bodyTemplate` | string | category-specific (see FR-4) | 1–500 chars, no HTML |

**Acceptance criteria:**
- [ ] Disabling a category skips it during CheckAndAlert
- [ ] Each category's threshold is independently configurable
- [ ] Each category has its own title and body templates

### FR-3: Global Configuration

Settings that apply across all categories or across notification types.

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `cooldownMinutes` | int | `120` | 1 – 1440 (1 min to 24 hours) |
| `topMoversCount` | int | `5` | 1 – 20 |
| `broadcastTitle` | string | `Thông báo từ hệ thống` | 1 – 200 chars, no HTML |

**Acceptance criteria:**
- [ ] Cooldown applies per-category (unchanged behavior, just configurable value)
- [ ] Top movers count limits how many movers are included in the notification metadata
- [ ] `broadcastTitle` is used as the push notification title for admin broadcasts (replaces hardcoded "Thông báo từ hệ thống" in `admin_service.go:297`)
- [ ] `broadcastTitle` is also stored in broadcast notification metadata so frontend can display it instead of the hardcoded title in `NotificationItem.tsx:117`

### FR-4: Notification Message Templates

Templates use placeholder syntax `{placeholder}` that are resolved at alert time.

**Available placeholders:**
| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{moverName}` | Name of the top mover | `SJC 1L-10L` |
| `{moverCode}` | Type code of the top mover | `SJL1L10` |
| `{direction}` | Arrow direction symbol | `↑` or `↓` |
| `{directionText}` | Text direction | `tăng` or `giảm` |
| `{changePct}` | Percentage change (1 decimal) | `2.1` |
| `{priceDiff}` | Absolute price difference (currentBuy - baseline) | `1,500,000` |
| `{category}` | Human-readable category name | `Vàng trong nước` |
| `{moverCount}` | Number of significant movers | `3` |

**Default templates per category:**
| Category | Default Title | Default Body |
|----------|--------------|-------------|
| `gold_vnd` | `Giá vàng trong nước biến động mạnh` | `{moverName} {direction} {changePct}%` |
| `gold_usd` | `Giá vàng thế giới biến động mạnh` | `{moverName} {direction} {changePct}%` |
| `silver_vnd` | `Giá bạc trong nước biến động mạnh` | `{moverName} {direction} {changePct}%` |
| `silver_usd` | `Giá bạc thế giới biến động mạnh` | `{moverName} {direction} {changePct}%` |

**Acceptance criteria:**
- [ ] Unknown placeholders are left as-is (not stripped, not errored)
- [ ] Templates are validated for length and HTML stripped server-side
- [ ] Admin UI shows a placeholder reference guide
- [ ] Title template is used for push notification title and notification panel title
- [ ] Body template is used for push notification body and notification panel subtitle

### FR-5: Add `priceDiff` to Price Mover Data

Add `priceDiff` (int64, `currentBuy - baseline`) to the `priceMover` struct and metadata JSON.

**Acceptance criteria:**
- [ ] `priceDiff` field added to `priceMover` struct with JSON tag `"priceDiff"`
- [ ] Computed as `currentBuy - baseline` (can be negative for price drops)
- [ ] Available in notification metadata for frontend rendering
- [ ] Available as `{priceDiff}` placeholder in templates (formatted with thousand separators)
- [ ] Frontend `PriceAlertMetadata` interface updated to include `priceDiff: number`

### FR-6: Admin UI — Notifications Tab

Rename "Broadcast" tab to "Notifications". The tab contains two sections:
1. **Broadcast** — existing AdminBroadcastForm (unchanged)
2. **Price Alert Settings** — new configuration form

**Price Alert Settings form:**
- Global settings section: cooldown (number input, minutes), top movers count (number input)
- Per-category accordion/cards: enabled toggle, threshold input, title template textarea, body template textarea
- Placeholder reference displayed as a helper text or collapsible guide
- Save button that calls PUT endpoint
- Loading state while fetching current config
- Success/error toast on save

**Acceptance criteria:**
- [ ] Tab renamed from "Broadcast" to "Notifications" (update translations)
- [ ] Both sections visually separated with headers
- [ ] Form pre-populated with current config on load
- [ ] Validation matches server-side rules (threshold 0.1–50.0, cooldown 1–1440, etc.)
- [ ] Mobile-responsive layout

## Non-Functional Requirements

- **Performance**: Config read from Redis (sub-ms). No DB queries needed.
- **Availability**: If Redis is unavailable, fall back to env var defaults (existing behavior preserved).
- **Consistency**: Config changes are atomic per PUT request (all fields saved together).

## Architecture Changes (C4)

### Diagrams to Update

1. **`c4-component-backend.md`** — Add `PriceAlertConfigHandler` to the Handlers layer; update `PriceAlertService` description to note it reads config from Redis.
2. **`c4-component-frontend.md`** — Add `PriceAlertConfigForm` component under admin feature module.

### New Diagrams

None needed — this extends existing components, no new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`flow-cross-cutting.md`** — Update the "Price Alert Detection" sequence diagram to show the config read from Redis before threshold checking. Add a note about the config fallback to env var defaults.

### New Flow Diagrams

None needed — the admin config GET/PUT is simple CRUD with no multi-step business logic.

## Data Model Changes

**No database changes.** All configuration stored in Redis.

### Redis Key Structure

Single key: `price_alert:config`
Value: JSON object with the full configuration.

```json
{
  "cooldownMinutes": 120,
  "topMoversCount": 5,
  "broadcastTitle": "Thông báo từ hệ thống",
  "categories": {
    "gold_vnd": {
      "enabled": true,
      "thresholdPct": 2.0,
      "titleTemplate": "Giá vàng trong nước biến động mạnh",
      "bodyTemplate": "{moverName} {direction} {changePct}%"
    },
    "gold_usd": {
      "enabled": true,
      "thresholdPct": 1.5,
      "titleTemplate": "Giá vàng thế giới biến động mạnh",
      "bodyTemplate": "{moverName} {direction} {changePct}%"
    },
    "silver_vnd": {
      "enabled": true,
      "thresholdPct": 3.0,
      "titleTemplate": "Giá bạc trong nước biến động mạnh",
      "bodyTemplate": "{moverName} {direction} {changePct}%"
    },
    "silver_usd": {
      "enabled": true,
      "thresholdPct": 2.0,
      "titleTemplate": "Giá bạc thế giới biến động mạnh",
      "bodyTemplate": "{moverName} {direction} {changePct}%"
    }
  }
}
```

**TTL**: No expiration (persistent until explicitly updated or Redis flushed).
**Fallback**: If key doesn't exist, construct config from env vars (current behavior).

## API Changes

### GET /api/v1/admin/price-alert-config

**Auth**: AuthMiddleware + AdminMiddleware

**Response (200):**
```json
{
  "success": true,
  "config": {
    "cooldownMinutes": 120,
    "topMoversCount": 5,
    "broadcastTitle": "Thông báo từ hệ thống",
    "categories": {
      "gold_vnd": {
        "enabled": true,
        "thresholdPct": 2.0,
        "titleTemplate": "Giá vàng trong nước biến động mạnh",
        "bodyTemplate": "{moverName} {direction} {changePct}%"
      }
    }
  },
  "timestamp": "2026-03-19T12:00:00Z"
}
```

### PUT /api/v1/admin/price-alert-config

**Auth**: AuthMiddleware + AdminMiddleware

**Request body:**
```json
{
  "cooldownMinutes": 90,
  "topMoversCount": 3,
  "broadcastTitle": "Thông báo quan trọng",
  "categories": {
    "gold_vnd": {
      "enabled": true,
      "thresholdPct": 2.5,
      "titleTemplate": "Vàng trong nước {directionText} mạnh!",
      "bodyTemplate": "{moverName} {direction} {changePct}% ({priceDiff})"
    }
  }
}
```

**Validation rules:**
- `cooldownMinutes`: int, 1–1440
- `topMoversCount`: int, 1–20
- `broadcastTitle`: string, 1–200 chars, HTML stripped
- Per category `thresholdPct`: float, 0.1–50.0
- Per category `titleTemplate`: string, 1–200 chars, HTML stripped
- Per category `bodyTemplate`: string, 1–500 chars, HTML stripped
- Per category `enabled`: bool

**Response (200):**
```json
{
  "success": true,
  "message": "Price alert configuration updated",
  "config": { ... },
  "timestamp": "2026-03-19T12:00:00Z"
}
```

**Response (400):** Validation error with field-specific messages.

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Number input for thresholds/cooldown | `FormNumberInput` | `components/forms/FormNumberInput.tsx` |
| Toggle for enable/disable | `FormToggle` | `components/forms/FormToggle.tsx` |
| Textarea for templates | `FormTextarea` | `components/forms/FormTextarea.tsx` |
| Toast for success/error | `Toast` (via NotificationContext) | `contexts/NotificationContext.tsx` |
| Loading spinner | `LoadingSpinner` | `components/loading/LoadingSpinner.tsx` |
| Section headers | Existing Tailwind patterns | — |
| Tab component | Existing tab pattern in admin page | `app/[locale]/dashboard/admin/page.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `PriceAlertConfigForm` | `features/admin/components/PriceAlertConfigForm.tsx` | Feature-specific admin config form, not reusable elsewhere |

### UI Layout

The "Notifications" tab contains:

```
┌─────────────────────────────────────────────┐
│ 📢 Broadcast                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Title: [__Thông báo từ hệ thống______] │ │
│ │ [Existing AdminBroadcastForm]           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ⚙️ Price Alert Settings                     │
│ ┌─────────────────────────────────────────┐ │
│ │ Global Settings                         │ │
│ │ Cooldown: [___120___] minutes           │ │
│ │ Top movers: [___5___]                   │ │
│ ├─────────────────────────────────────────┤ │
│ │ ▼ Gold VND                    [toggle]  │ │
│ │   Threshold: [___2.0___] %              │ │
│ │   Title: [________________________]     │ │
│ │   Body:  [________________________]     │ │
│ ├─────────────────────────────────────────┤ │
│ │ ▼ Gold USD                    [toggle]  │ │
│ │   Threshold: [___1.5___] %              │ │
│ │   Title: [________________________]     │ │
│ │   Body:  [________________________]     │ │
│ ├─────────────────────────────────────────┤ │
│ │ ▼ Silver VND                  [toggle]  │ │
│ │   ...                                   │ │
│ ├─────────────────────────────────────────┤ │
│ │ ▼ Silver USD                  [toggle]  │ │
│ │   ...                                   │ │
│ ├─────────────────────────────────────────┤ │
│ │ Placeholders: {moverName}, {direction}, │ │
│ │ {changePct}, {priceDiff}, {category},   │ │
│ │ {directionText}, {moverCode},           │ │
│ │ {moverCount}                            │ │
│ ├─────────────────────────────────────────┤ │
│ │              [Save Settings]            │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Admin browser | Config JSON | Yes: Internet → App | Backend handler | PUT request |
| 2 | Backend handler | Validated config | No (internal) | Redis | SET command |
| 3 | Redis | Config JSON | No (internal) | PriceAlertService | GET command |
| 4 | PriceAlertService | Rendered notification | No (internal) | NotificationRepo / PushService | DB + push |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|------------------|
| Internet → App | Admin PUT request | JWT auth + admin role middleware |
| App → Redis | Config read/write | Internal network, no auth (standard) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin sends PUT | Medium | AuthMiddleware + AdminMiddleware (existing) |
| T-2 | 1 | Internet → App | Tampering | Malicious template with XSS payload | Medium | HTML tag stripping server-side (same as broadcast) |
| T-3 | 1 | Internet → App | Tampering | Extreme threshold values to suppress/flood alerts | Low | Validation range: 0.1–50.0% threshold, 1–1440 cooldown |
| T-4 | 4 | Internal | Information Disclosure | Template placeholders could leak internal data | Low | Only predefined placeholders resolved; unknown ones left as-is |

### Authorization Rules

- Only admin users (is_admin=true) can read or modify price alert config
- Regular users have no access to these endpoints

### Input Validation Rules

| Field | Validation | Server-side |
|-------|-----------|-------------|
| `cooldownMinutes` | int, 1–1440 | Yes — reject out of range |
| `topMoversCount` | int, 1–20 | Yes — reject out of range |
| `broadcastTitle` | string, 1–200 chars | Yes — strip HTML, trim whitespace |
| `thresholdPct` | float, 0.1–50.0 | Yes — reject out of range |
| `titleTemplate` | string, 1–200 chars | Yes — strip HTML, trim whitespace |
| `bodyTemplate` | string, 1–500 chars | Yes — strip HTML, trim whitespace |
| `enabled` | bool | Yes — type check |

### External Dependency Risks

None new — uses existing Redis connection.

### Sensitive Data Handling

No sensitive data. Config values are operational parameters only.

### Issues & Risks Summary

1. **Redis flush resets config** — Mitigated by env var fallback (config reconstructed from defaults)
2. **Template injection** — Mitigated by HTML stripping and predefined placeholder whitelist
3. **Concurrent admin edits** — Low risk; last write wins (acceptable for config)

## Edge Cases & Error Handling

1. **Redis unavailable on GET**: Return env var defaults with a warning field
2. **Redis unavailable on PUT**: Return 503 with error message
3. **Partial category update**: Merge with existing config (don't overwrite omitted categories)
4. **Empty template after HTML strip**: Reject with validation error
5. **PriceAlertService reads config on each run**: No caching of config in service struct — always reads fresh from Redis, falls back to env vars

## Dependencies & Assumptions

- Existing AdminMiddleware and AuthMiddleware work correctly (verified)
- Redis is the primary config store; env vars are fallback defaults
- PriceAlertService currently reads env vars at construction time — will be refactored to read from Redis on each `CheckAndAlert` call
- The `priceDiff` formatting in templates uses thousand separators appropriate to the category currency (VND uses dot separator, USD uses comma)

## Out of Scope

- Config versioning/history (who changed what when)
- Config export/import
- Per-user alert preferences (enable/disable per user)
- Real-time config preview (showing what a notification would look like)
- Database storage for config (Redis only)
