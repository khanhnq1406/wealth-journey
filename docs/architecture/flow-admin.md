# Admin CMS Domain — Runtime Flows

Admin content management flows covering site settings retrieval (public, cached) and updates (admin-only, validated). The public GET endpoint powers the landing page's dynamic SEO metadata and footer content. The admin PUT endpoint allows admin users to edit settings through the CMS page.

## Table of Contents

- [Public Site Settings Fetch](#1-public-site-settings-fetch)
- [Admin Update Site Settings](#2-admin-update-site-settings)

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
