# Admin CMS — SEO & Footer Content Management Specification

## Summary

Build an admin page at `/dashboard/admin` where admin users can edit the landing page's SEO metadata (title, description, keywords, OG tags, Twitter card, robots directives, canonical URL) and footer content (brand name, tagline, contact info). Content is stored in PostgreSQL, served via a public API endpoint, and rendered server-side for SEO. Changes publish immediately on save.

## User Stories

- As an admin, I want to edit the landing page SEO metadata (title, description, keywords, OG tags) so that I can optimize search engine visibility without code changes.
- As an admin, I want to edit the landing page footer text (brand name, tagline, contact info) so that I can update business information instantly.
- As a search engine crawler, I want to see the correct meta tags in the HTML `<head>` so that pages are indexed properly.

## Functional Requirements

### FR-1: Site Settings Database Model

Store all editable content in a single `site_settings` key-value table. Each row is a setting with a unique key.

**Acceptance criteria:**
- [ ] `site_settings` table exists with columns: `id`, `key` (unique), `value` (text/JSON), `updated_by` (int32, FK to user), `updated_at`, `created_at`
- [ ] Initial seed data matches current hardcoded values
- [ ] Keys are namespaced: `seo.title`, `seo.description`, `seo.keywords`, `seo.og_title`, `seo.og_description`, `seo.og_image`, `seo.og_url`, `seo.twitter_card`, `seo.twitter_title`, `seo.twitter_description`, `seo.twitter_creator`, `seo.robots_index`, `seo.robots_follow`, `seo.canonical`, `footer.brand_name`, `footer.tagline`, `footer.contact_info`

### FR-2: Public API — Get Site Settings

A public (no auth) endpoint to fetch all site settings for rendering.

**Acceptance criteria:**
- [ ] `GET /api/v1/public/site-settings` returns all settings as a key-value map
- [ ] Response is cached (Redis, 5-minute TTL) to avoid DB hits on every page load
- [ ] Cache is invalidated when admin updates any setting
- [ ] No authentication required (public content)

### FR-3: Admin API — Update Site Settings

Admin-only endpoint to bulk-update site settings.

**Acceptance criteria:**
- [ ] `PUT /api/v1/admin/site-settings` accepts a JSON body with key-value pairs to update
- [ ] Only admin users can call this endpoint (AdminMiddleware)
- [ ] `updated_by` is set to the admin's user ID
- [ ] Redis cache is invalidated after successful update
- [ ] Returns the updated settings
- [ ] Input validation: keys must be from the allowed list, values must be non-empty strings, `seo.keywords` must be valid JSON array

### FR-4: Admin Page — CMS Editor

A frontend page at `/dashboard/admin` for editing SEO and footer content.

**Acceptance criteria:**
- [ ] Page only accessible to admin users (redirect non-admins)
- [ ] Two sections: "SEO Metadata" and "Footer Content"
- [ ] SEO section: form fields for title, description, keywords (tag input), OG title, OG description, OG image URL, OG URL, Twitter card type, Twitter title, Twitter description, Twitter creator, robots index (toggle), robots follow (toggle), canonical URL
- [ ] Footer section: form fields for brand name, tagline, contact info
- [ ] Save button that bulk-updates all changed fields
- [ ] Loading states and error handling
- [ ] Success toast on save

### FR-5: Dynamic Landing Page Rendering

Landing page reads SEO metadata and footer content from the API instead of hardcoded values.

**Acceptance criteria:**
- [ ] Landing layout fetches SEO settings server-side via `generateMetadata()` (Next.js dynamic metadata)
- [ ] `LandingFooter` component fetches footer content and renders dynamically
- [ ] Fallback to current hardcoded values if API is unavailable
- [ ] No visible change to end users when content matches current hardcoded values

## Non-Functional Requirements

- **Performance**: Public settings API must respond < 50ms (Redis cached). Landing page TTFB should not increase by more than 100ms.
- **Security**: Only admin users can modify settings. Public endpoint is read-only. Input validation prevents XSS via stored content.
- **Reliability**: If the settings API is down, landing page falls back to hardcoded defaults — no blank page.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Add `SiteSettingsHandler`, `SiteSettingsService`, `SiteSettingsRepository` components to the backend component diagram.
2. **`docs/architecture/c4-component-frontend.md`** — Add `AdminCMSPage` component under dashboard pages.

### New Diagrams

No new L4 code diagram needed — this is a simple CRUD domain (1 model, 1 service, 1 handler).

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no existing flows are modified.

### New Flow Diagrams

**File:** `docs/architecture/flow-admin.md` (new file)

1. **Admin Update Settings Flow** — `sequenceDiagram` showing: Admin Page → PUT /admin/site-settings → AdminMiddleware → SiteSettingsHandler → SiteSettingsService → SiteSettingsRepository (DB) → Redis cache invalidation → Response
2. **Landing Page Settings Fetch Flow** — `sequenceDiagram` showing: Browser → Landing Layout (SSR) → GET /public/site-settings → PublicHandler → Redis cache check → (miss) → SiteSettingsRepository (DB) → Cache set → Response → generateMetadata() + LandingFooter render

## Data Model Changes

### New Table: `site_settings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Primary key |
| `key` | `varchar(100)` | UNIQUE, NOT NULL | Setting key (e.g., `seo.title`) |
| `value` | `text` | NOT NULL | Setting value (plain text or JSON) |
| `updated_by` | `int32` | FK → user(id), NULL | Last admin who updated |
| `updated_at` | `timestamp` | NOT NULL | Last update time |
| `created_at` | `timestamp` | NOT NULL | Creation time |

**Seed data** (matches current hardcoded values):

| Key | Value |
|-----|-------|
| `seo.title` | `congdongvang.com - Track Gold & Silver Prices \| Personal Finance Dashboard` |
| `seo.description` | `Monitor live gold and silver prices including SJC, DOJI, and world gold (XAU/USD). Track investments, manage wallets, and build wealth with congdongvang.com's all-in-one personal finance platform.` |
| `seo.keywords` | `["gold price tracker","silver price tracker","SJC gold price","vàng SJC","giá vàng hôm nay","giá bạc hôm nay","Vietnamese gold investment","gold investment tracking","silver investment","XAU USD price","personal finance dashboard","investment portfolio tracker","multi-currency portfolio","FIFO accounting","precious metals investment","stock portfolio management","cryptocurrency portfolio","wealth management app","financial freedom tools","congdongvang.com"]` |
| `seo.og_title` | `congdongvang.com - Track Gold & Silver Prices \| Personal Finance Dashboard` |
| `seo.og_description` | `Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with congdongvang.com.` |
| `seo.og_image` | `/og-image.svg` |
| `seo.og_url` | `https://congdongvang.com` |
| `seo.twitter_card` | `summary_large_image` |
| `seo.twitter_title` | `congdongvang.com - Track Gold & Silver Prices \| Personal Finance Dashboard` |
| `seo.twitter_description` | `Monitor live gold and silver prices including SJC, DOJI, and world gold. Track investments, manage wallets, and build wealth with congdongvang.com.` |
| `seo.twitter_creator` | `@congdongvang` |
| `seo.robots_index` | `true` |
| `seo.robots_follow` | `true` |
| `seo.canonical` | `https://congdongvang.com` |
| `footer.brand_name` | `congdongvang.com` |
| `footer.tagline` | `Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính` |
| `footer.contact_info` | `Liên hệ quảng cáo : 076.897.2512` |

## API Changes

### New Proto Definitions (in `admin.proto`)

```protobuf
// CMS — Site Settings Management

message SiteSetting {
  string key = 1 [json_name = "key"];
  string value = 2 [json_name = "value"];
  int32 updatedBy = 3 [json_name = "updatedBy"];
  int64 updatedAt = 4 [json_name = "updatedAt"];
}

message GetSiteSettingsRequest {}

message GetSiteSettingsResponse {
  bool success = 1 [json_name = "success"];
  repeated SiteSetting settings = 2 [json_name = "settings"];
}

message UpdateSiteSettingsRequest {
  repeated SiteSetting settings = 1 [json_name = "settings"];
}

message UpdateSiteSettingsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated SiteSetting settings = 3 [json_name = "settings"];
}
```

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/public/site-settings` | None | Fetch all site settings (cached) |
| `PUT` | `/api/v1/admin/site-settings` | Admin | Bulk update site settings |

## UI/UX Changes

### Admin Page (`/dashboard/admin`)

**Layout:** Single page with two card sections stacked vertically. Mobile-first design.

**Section 1: SEO Metadata**
- Title (text input)
- Description (textarea)
- Keywords (tag input — comma-separated, displayed as removable chips)
- Open Graph: title, description, image URL, URL (4 text inputs)
- Twitter Card: type (select: summary, summary_large_image), title, description, creator (4 inputs)
- Robots: index (toggle switch), follow (toggle switch)
- Canonical URL (text input)

**Section 2: Footer Content**
- Brand Name (text input)
- Tagline (text input)
- Contact Info (text input)

**Bottom:** Save button (full-width on mobile, right-aligned on desktop). Shows loading state during save. Success toast on completion.

**Access Control:** If `isAdmin` is false in Redux auth state, redirect to `/dashboard/home`.

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Page card wrapper | BaseCard | `components/cards/BaseCard.tsx` |
| Text input fields | FormInput | `components/forms/FormInput.tsx` |
| Textarea field | FormTextarea | `components/forms/FormTextarea.tsx` |
| Toggle switches | FormToggle | `components/forms/FormToggle.tsx` |
| Select dropdown | FormSelect | `components/forms/FormSelect.tsx` |
| Save button | Button | `components/Button.tsx` |
| Success toast | NotificationContext | `contexts/NotificationContext.tsx` |
| Loading spinner | LoadingSpinner | `components/loading/LoadingSpinner.tsx` |
| Full page loading | FullPageLoading | `components/loading/FullPageLoading.tsx` |
| Error state | ErrorState | `components/feedback/ErrorState.tsx` |
| Admin auth check | useSelector (auth) | `features/auth/store/` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `TagInput` | `components/forms/TagInput.tsx` | No existing tag/chip input component for keywords editing. Shared because tag input is a general-purpose form element. |
| `AdminGuard` | `features/admin/components/AdminGuard.tsx` | Wrapper component that checks admin status and redirects. Reusable for future admin pages. |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin browser | SEO/footer settings (text) | Yes: Internet → App | PUT /admin/site-settings | User-submitted HTML/text content |
| 2 | App server | Validated settings | No | PostgreSQL | Parameterized queries (GORM) |
| 3 | App server | Settings JSON | No | Redis cache | Internal network |
| 4 | Search engine crawler | HTTP request | Yes: Internet → App | GET /public/site-settings | Public read-only endpoint |
| 5 | Redis cache / DB | Settings data | No | App server | Internal |
| 6 | App server (SSR) | Settings data | No | HTML `<head>` meta tags | Content rendered into HTML |
| 7 | App server (SSR) | Footer text | No | HTML `<footer>` | Content rendered into HTML |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App (Admin write) | Admin PUT request | JWT + AdminMiddleware + input validation |
| Internet → App (Public read) | Crawler GET request | Rate limiting, read-only |
| App → DB | Settings CRUD | GORM parameterized queries |
| App → Redis | Cache read/write | Internal network, no auth needed |
| App → HTML output | SSR rendering | XSS sanitization of stored content |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin impersonates admin | High | JWT verification + AdminMiddleware (existing) |
| T-2 | 1 | Internet → App | Tampering | Inject malicious HTML/JS in setting values | High | Server-side sanitization: strip HTML tags from all values. Allowlist of valid keys. |
| T-3 | 6,7 | App → HTML | Elevation | Stored XSS via meta tags or footer content | High | Escape all values when rendering to HTML. Next.js `metadata` API auto-escapes. React auto-escapes JSX. |
| T-4 | 4 | Internet → App | DoS | Flood public settings endpoint | Low | Rate limiting by IP (existing infra) |
| T-5 | 1 | Internet → App | Tampering | Set arbitrary keys outside allowed list | Medium | Allowlist validation of keys server-side |
| T-6 | 2 | App → DB | Information Disclosure | Leak internal DB errors to client | Low | Generic error messages, log details server-side |

### Authorization Rules

- Only users with `IsAdmin = true` can call `PUT /api/v1/admin/site-settings`
- Anyone (no auth) can call `GET /api/v1/public/site-settings`
- Frontend redirects non-admin users away from `/dashboard/admin`

### Input Validation Rules

| Field | Validation | Where |
|-------|-----------|-------|
| `key` | Must be in allowlist of 17 keys | Backend handler |
| `value` | Non-empty string, max 5000 chars | Backend handler |
| `seo.keywords` | Valid JSON array of strings | Backend handler |
| `seo.robots_index` | Must be "true" or "false" | Backend handler |
| `seo.robots_follow` | Must be "true" or "false" | Backend handler |
| `seo.twitter_card` | Must be "summary" or "summary_large_image" | Backend handler |
| All text values | Strip HTML tags (prevent stored XSS) | Backend service |

### External Dependency Risks

None — this feature uses only PostgreSQL (existing) and Redis (existing). No new external APIs or packages.

### Sensitive Data Handling

No PII or financial data involved. Settings are public content by nature. The `updated_by` field links to user ID but is not exposed in the public endpoint response.

### Issues & Risks Summary

1. **Stored XSS** — Admin-submitted content rendered in HTML. Mitigated by: (a) stripping HTML tags server-side, (b) Next.js metadata API auto-escapes, (c) React JSX auto-escapes.
2. **Cache staleness** — After admin update, stale cache could serve old content for up to 5 minutes if invalidation fails. Mitigated by: explicit cache delete on update; if Redis is down, bypass cache and query DB directly.
3. **SEO impact during migration** — If the public API is slow or fails during the transition, meta tags could be missing. Mitigated by: hardcoded fallback values in the frontend.

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| API unavailable during SSR | Use hardcoded fallback values (current content) |
| Redis cache miss | Query DB, then populate cache |
| Redis down entirely | Query DB directly, skip caching |
| Admin submits unknown key | Reject with 400 Bad Request |
| Admin submits empty value | Reject with 400 Bad Request |
| Admin submits oversized value (>5000 chars) | Reject with 400 Bad Request |
| Concurrent admin edits | Last write wins (acceptable for low-frequency edits) |
| `seo.keywords` with invalid JSON | Reject with 400 Bad Request |
| DB migration fails midway | GORM auto-migration is idempotent; retry safe |

## Dependencies & Assumptions

- PostgreSQL and Redis are available (existing infrastructure)
- Admin users already exist (provisioned via `set-admin` CLI tool)
- The admin middleware and auth system are working correctly (existing)
- Next.js `generateMetadata()` supports async data fetching for dynamic SEO

## Out of Scope

- Multi-language CMS content (single language only for now)
- Draft/publish workflow (immediate publish only)
- Content versioning/history
- Rich text editing (plain text fields only)
- Editing other landing page sections (hero, features, CTA, etc.)
- Admin user management (use existing CLI tool)
- Image upload for OG image (URL input only)
