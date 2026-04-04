# Admin CMS Domain — Runtime Flows

Admin content management flows covering site settings retrieval (public, cached), updates (admin-only, validated), and asset display config disable/delete with active-investment guard.

## Table of Contents

- [Public Site Settings Fetch](#1-public-site-settings-fetch)
- [Admin Update Site Settings](#2-admin-update-site-settings)
- [Asset Display Config Disable/Delete Guard](#3-asset-display-config-disabledelete-guard)

---

## 1. Public Site Settings Fetch

**Trigger:** Landing page server render (SSR/ISR) or client-side mount
**Endpoint:** `GET /api/v1/public/site-settings`
**Source:** `handlers/site_settings.go`, `domain/service/site_settings_service.go`

```mermaid
sequenceDiagram
    participant Browser
    participant NextJS as Next.js (SSR/Client)
    participant Handler as SiteSettingsHandler
    participant Service as SiteSettingsService
    participant Cache as SiteSettingsCache (Redis)
    participant Repo as SiteSettingsRepository
    participant DB as PostgreSQL

    Browser->>NextJS: Request landing page

    alt SSR: generateMetadata()
        NextJS->>Handler: GET /api/v1/public/site-settings<br/>(fetch with next.revalidate=300)
    else Client: LandingFooter useEffect
        NextJS->>Handler: GET /api/v1/public/site-settings
    end

    Handler->>Service: GetAll(ctx)

    Service->>Cache: Get(ctx)

    alt Cache hit
        Cache-->>Service: []*SiteSetting
        Service-->>Handler: settings
    else Cache miss
        Cache-->>Service: nil
        Service->>Repo: GetAll(ctx)
        Repo->>DB: SELECT * FROM site_settings
        DB-->>Repo: rows
        Repo-->>Service: []*SiteSetting
        Service->>Cache: Set(ctx, settings, 5min TTL)
        Service-->>Handler: settings
    end

    Handler-->>NextJS: 200 {success: true, settings: [...]}

    alt SSR: generateMetadata
        NextJS->>NextJS: Map settings to Metadata object<br/>(fallback to hardcoded on missing keys)
    else Client: LandingFooter
        NextJS->>NextJS: Map footer.brand_name, footer.tagline,<br/>footer.contact_info to state
    end

    NextJS-->>Browser: Rendered HTML with dynamic metadata + footer
```

### Key Invariants

- **Cache-first reads:** Redis cache is always checked before querying PostgreSQL
- **5-minute TTL:** Cache entries expire after 5 minutes, keeping content reasonably fresh
- **No authentication required:** This is a public endpoint — no JWT needed
- **Hardcoded fallbacks:** Both `generateMetadata()` and `LandingFooter` have full hardcoded fallback values if the API fails or returns incomplete data
- **ISR revalidation:** Next.js `generateMetadata()` uses `next: { revalidate: 300 }` for 5-minute ISR caching

### Error Paths

| Condition | Response | Fallback |
|-----------|----------|----------|
| Redis unavailable | Service queries DB directly | Transparent to caller |
| DB query fails | 500 Internal Server Error | Next.js uses hardcoded FALLBACK_METADATA |
| API unreachable from SSR | `fetchSiteSettings()` returns null | Uses FALLBACK_METADATA constant |
| API unreachable from client | `fetch` catch block fires | LandingFooter uses DEFAULTS constant |

---

## 2. Admin Update Site Settings

**Trigger:** Admin user clicks "Save Settings" on `/dashboard/admin` CMS page
**Endpoint:** `PUT /api/v1/admin/site-settings`
**Source:** `handlers/site_settings.go`, `domain/service/site_settings_service.go`

```mermaid
sequenceDiagram
    participant Admin as Admin Browser
    participant SPA as Next.js SPA
    participant AuthMW as AuthMiddleware
    participant AdminMW as AdminMiddleware
    participant Handler as SiteSettingsHandler
    participant Service as SiteSettingsService
    participant Repo as SiteSettingsRepository
    participant Cache as SiteSettingsCache (Redis)
    participant DB as PostgreSQL

    Admin->>SPA: Fill form, click "Save Settings"
    SPA->>AuthMW: PUT /api/v1/admin/site-settings<br/>{settings: [{key, value}, ...]}

    AuthMW->>AuthMW: Validate JWT token
    alt Invalid/expired token
        AuthMW-->>SPA: 401 Unauthorized
        SPA-->>Admin: Redirect to login
    end

    AuthMW->>AdminMW: Request with user context
    AdminMW->>AdminMW: Check user.IsAdmin == true
    alt Not admin
        AdminMW-->>SPA: 403 Forbidden
        SPA-->>Admin: Show error toast
    end

    AdminMW->>Handler: Authenticated admin request
    Handler->>Handler: Parse request body
    Handler->>Handler: Extract user_id from context

    alt Empty or invalid body
        Handler-->>SPA: 400 Bad Request
    end

    Handler->>Service: UpdateSettings(ctx, adminUserID, settings)

    Service->>Service: Validate each setting key against allowlist (17 keys)
    alt Invalid key found
        Service-->>Handler: "invalid setting key: xxx"
        Handler-->>SPA: 400 Bad Request
    end

    Service->>Service: Validate value constraints:<br/>non-empty, max 5000 chars
    alt Value validation fails
        Service-->>Handler: validation error
        Handler-->>SPA: 400 Bad Request
    end

    Service->>Service: Key-specific validations:<br/>seo.keywords → valid JSON array<br/>seo.robots_index/follow → "true"/"false"<br/>seo.twitter_card → "summary"/"summary_large_image"
    alt Key-specific validation fails
        Service-->>Handler: validation error
        Handler-->>SPA: 400 Bad Request
    end

    Service->>Service: Strip HTML tags from all values<br/>regexp: <[^>]*>

    Service->>Service: Set UpdatedBy = adminUserID<br/>Set UpdatedAt = time.Now()

    Service->>Repo: BulkUpsert(ctx, settings)
    Repo->>DB: INSERT INTO site_settings ... ON CONFLICT(key)<br/>DO UPDATE SET value, updated_by, updated_at
    DB-->>Repo: OK

    Service->>Cache: Invalidate(ctx)
    Cache->>Cache: DEL "site_settings:all"

    Repo->>Repo: GetAll(ctx) (fresh read)
    Repo->>DB: SELECT * FROM site_settings
    DB-->>Repo: all settings
    Repo-->>Service: []*SiteSetting

    Service-->>Handler: updated settings
    Handler-->>SPA: 200 {success: true, message: "...", settings: [...]}

    SPA-->>Admin: Show success toast<br/>Invalidate React Query cache
```

### Key Invariants

- **Allowlist validation:** Only the 17 predefined keys are accepted — no arbitrary key injection
- **HTML stripping:** All values are sanitized with regex `<[^>]*>` before persistence (XSS prevention at storage layer)
- **Cache invalidation:** Redis cache is always invalidated after successful update, ensuring the next public GET serves fresh data
- **Upsert semantics:** `ON CONFLICT(key) DO UPDATE` ensures idempotent writes — repeated saves are safe
- **Admin-only access:** Two middleware layers (AuthMiddleware + AdminMiddleware) protect the endpoint
- **Audit trail:** `updated_by` records which admin made the change

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| JWT invalid/expired | 401 Unauthorized | None (request never reaches handler) |
| User not admin | 403 Forbidden | None (request never reaches handler) |
| Empty request body | 400 Bad Request | None |
| Invalid setting key | 400 "invalid setting key: {key}" | None (no DB write attempted) |
| Empty or oversized value | 400 validation error | None (no DB write attempted) |
| Invalid JSON in seo.keywords | 400 validation error | None (no DB write attempted) |
| DB upsert fails | 500 Internal Server Error | Cache not invalidated (stale cache acceptable) |
| Cache invalidation fails | Logged as warning | Stale cache expires in 5min via TTL |

---

## 3. Asset Display Config Disable/Delete Guard

**Trigger:** Admin calls PUT (with `enabled: false`) or DELETE on `/api/v1/admin/asset-display-config/:id`
**Endpoints:**
- `PUT /api/v1/admin/asset-display-config/:id` — Update (disable guard fires when `enabled` flips true→false)
- `DELETE /api/v1/admin/asset-display-config/:id` — Delete (guard always fires)
**Source:** `domain/service/asset_display_config_service.go`, `domain/repository/investment_repository_impl.go`

```mermaid
flowchart TD
    A([Admin: PUT enabled=false\nor DELETE /asset-display-config/:id]) --> B[AuthMiddleware + AdminMiddleware\nvalidate JWT and admin role]
    B -->|401/403| Z1([Return 401 Unauthorized\nor 403 Forbidden])
    B -->|Authenticated Admin| C[Handler parses :id path param\nand request body]
    C --> D[Service: GetByID\nconfigRepo.GetByID ctx, id]
    D -->|Not found| Z2([Return 404 Not Found])
    D -->|Found: config with TypeCode| E{Operation type?}

    E -->|PUT: check if enabled\nflips true → false| F{config.Enabled == true\nAND new enabled == false?}
    E -->|DELETE| G[investmentRepo.CountBySymbol\nctx, config.TypeCode]

    F -->|No: enabled stays true\nor config already disabled| H[Skip guard\nProceed with update]
    F -->|Yes: disabling an enabled config| G

    G -->|DB error| Z3([Return 500 Internal Server Error])
    G -->|count returned| I{count > 0?}

    I -->|count > 0| Z4([Return 400 Bad Request\n'Cannot disable/delete: N active investment s\nuse asset type TypeCode'])
    I -->|count == 0| J{Operation type?}

    H --> K[configRepo.Update ctx, config\nApply new displayName, displayOrder,\nenabled, showInInvestment]
    J -->|PUT: disable| K
    J -->|DELETE| L[configRepo.Delete ctx, id\nSoft-delete: UPDATE SET deleted_at=NOW ]

    K -->|DB error| Z5([Return 500 Internal Server Error])
    K -->|OK| M([Return 200 OK\nUpdated config payload])

    L -->|DB error| Z6([Return 500 Internal Server Error])
    L -->|OK| N([Return 200 OK\nsuccess: true])
```

### Key Invariants

- **Guard fires only on true→false flip:** `CountBySymbol` is skipped when `enabled` stays `true` or the config is already disabled — avoids unnecessary DB round-trips on non-disabling updates
- **Delete always guarded:** Every `DELETE` triggers `CountBySymbol` regardless of the current `enabled` state
- **404 before count check:** `GetByID` runs first; a missing config returns 404 without querying investments
- **Parameterized query:** `CountBySymbol` uses `WHERE symbol = ?` — GORM parameterized query, no SQL injection risk
- **GORM soft-delete scope:** Count query automatically includes `AND deleted_at IS NULL`, excluding soft-deleted investments
- **Error message reveals only count and TypeCode:** Safe for admin context — TypeCode is a market symbol (e.g., `SJL1L10`), not sensitive data
- **Admin-only:** Both endpoints require `AuthMiddleware` + `AdminMiddleware` — no auth changes needed

### Error Paths

| Condition | Response | Details |
|-----------|----------|---------|
| JWT invalid/expired | 401 Unauthorized | AuthMiddleware rejects before handler |
| User not admin | 403 Forbidden | AdminMiddleware rejects before handler |
| Config not found | 404 Not Found | GetByID returns NotFoundError |
| count > 0 (disable) | 400 Bad Request | "Cannot disable: N active investment(s) use asset type TypeCode" |
| count > 0 (delete) | 400 Bad Request | "Cannot delete: N active investment(s) use asset type TypeCode" |
| CountBySymbol DB error | 500 Internal Server Error | Wrapped internal error, details not exposed |
| configRepo.Update fails | 500 Internal Server Error | Standard handler error propagation |
| configRepo.Delete fails | 500 Internal Server Error | Standard handler error propagation |
