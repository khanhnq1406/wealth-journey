# Admin CMS — SEO & Footer Content Management Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Allow admin users to edit the landing page's SEO metadata and footer content via a CMS page, stored in PostgreSQL and served via a cached public API.

**Spec:** `docs/specs/2026-03-18-admin-cms-spec.md`

**Architecture:** Simple CRUD domain — one new `site_settings` table, one repository, one service, two handler methods (public GET + admin PUT), and one new frontend page at `/dashboard/admin`. The landing page layout switches from a static `metadata` export to `generateMetadata()` that fetches from the public API with hardcoded fallbacks.

**Tech Stack:** Go/Gin handler, GORM model + repository, Redis cache, Next.js `generateMetadata()`, React Hook Form, Tailwind CSS

## Security Implementation Notes

- **Authentication:** Admin PUT uses existing `AuthMiddleware()` + `AdminMiddleware()` chain (already wired in `routes.go:51-64`)
- **Authorization:** Only `IsAdmin=true` users can call PUT. Public GET requires no auth.
- **Input validation:** Server-side allowlist of 17 valid keys; max 5000 chars per value; JSON validation for `seo.keywords`; enum validation for `seo.twitter_card` and robots booleans
- **XSS prevention:** Strip HTML tags from all values in the service layer before persisting. Next.js `metadata` API and React JSX auto-escape output.
- **Rate limiting:** Uses existing rate limiter infrastructure (IP-based for public, user-based for admin)

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md` — Add `SiteSettingsHandler`, `SiteSettingsService`, `SiteSettingsRepository`
- Update `docs/architecture/c4-component-frontend.md` — Add `AdminCMSPage` under dashboard pages

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Add `SiteSettingsHandler`, `SiteSettingsService`, `SiteSettingsRepository`, `SiteSettingsCache` to backend component diagram
2. Add `AdminCMSPage` to frontend component diagram under dashboard pages
3. Commit

---

### Task 1: Add Proto Messages to admin.proto

**Files:**
- Modify: `api/protobuf/v1/admin.proto`

**Security notes:** Proto definitions are read-only contracts — no security concerns at this layer.

**Step 1: Add SiteSetting messages to admin.proto**

Add the following messages after the existing `DeletePriceOverrideResponse` (after line 94):

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

**Step 2: Generate code**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management && task proto:all
```

**Step 3: Verify generated code compiles**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 2: Create SiteSettings Database Model + Migration

**Files:**
- Create: `src/go-backend/domain/models/site_settings.go`
- Create: `src/go-backend/cmd/migrate-site-settings/main.go`

**Security notes:** Seed data must exactly match current hardcoded values to prevent SEO disruption during cutover.

**Step 1: Create the SiteSettings model**

Create `src/go-backend/domain/models/site_settings.go`:

```go
package models

import "time"

// SiteSetting stores editable CMS content as key-value pairs.
type SiteSetting struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedBy *int32    `gorm:"index" json:"updatedBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func (SiteSetting) TableName() string {
	return "site_settings"
}
```

**Step 2: Create the migration with seed data**

Create `src/go-backend/cmd/migrate-site-settings/main.go`:

- Use `db.DB.AutoMigrate(&models.SiteSetting{})` to create the table
- Seed 17 initial rows matching the spec's seed data table
- Use `FirstOrCreate` to make seeding idempotent (safe to re-run)

**Step 3: Add Taskfile entry**

Add to `Taskfile.yml`:
```yaml
  backend:migrate-site-settings:
    desc: "Create site_settings table and seed initial data"
    dir: "{{.BACKEND_DIR}}"
    cmds:
      - go run ./cmd/migrate-site-settings
```

**Step 4: Verify migration compiles**

```bash
cd src/go-backend && go build ./cmd/migrate-site-settings/...
```

**Step 5: Commit**

---

### Task 3: Create SiteSettings Repository

**Files:**
- Create: `src/go-backend/domain/repository/site_settings_repository.go`

**Security notes:** Use GORM parameterized queries only. No raw SQL.

**Step 1: Define the repository interface and implementation**

Follow the `BaseRepository` embedding pattern used by other repos (`wallet_repository.go`, `category_repository.go`).

Interface methods:
- `GetAll(ctx context.Context) ([]*models.SiteSetting, error)` — fetch all settings
- `GetByKey(ctx context.Context, key string) (*models.SiteSetting, error)` — fetch single setting
- `BulkUpsert(ctx context.Context, settings []*models.SiteSetting) error` — upsert multiple settings (use GORM `Save` in a transaction for each, or use `Clauses(clause.OnConflict{...})`)

Constructor: `NewSiteSettingsRepository(db *database.Database) SiteSettingsRepository`

**Step 2: Wire into Repositories struct**

Add `SiteSettings repository.SiteSettingsRepository` to `service.Repositories` struct in `src/go-backend/domain/service/services.go`.

Add `SiteSettings: repository.NewSiteSettingsRepository(db)` to `ProvideRepositories()` in `src/go-backend/internal/app/providers.go`.

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 4: Create SiteSettings Cache

**Files:**
- Create: `src/go-backend/pkg/cache/site_settings_cache.go`

**Security notes:** Cache stores public content only. No auth tokens or sensitive data in cache.

**Step 1: Implement cache**

Follow `GoldPriceCache` pattern in `pkg/cache/gold_price_cache.go`:

```go
type SiteSettingsCache struct {
	client *redis.Client
}

func NewSiteSettingsCache(client *redis.Client) *SiteSettingsCache { ... }

// Get returns cached settings or nil on miss
func (c *SiteSettingsCache) Get(ctx context.Context) ([]*models.SiteSetting, error) { ... }

// Set caches settings with 5-minute TTL
func (c *SiteSettingsCache) Set(ctx context.Context, settings []*models.SiteSetting) error { ... }

// Invalidate deletes the cache key
func (c *SiteSettingsCache) Invalidate(ctx context.Context) error { ... }
```

Cache key: `"site_settings:all"` (single key for all settings).
TTL: 5 minutes.

**Step 2: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**

---

### Task 5: Create SiteSettings Service

**Files:**
- Create: `src/go-backend/domain/service/site_settings_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go`
- Modify: `src/go-backend/domain/service/services.go`

**Security notes:**
- Validate keys against an allowlist of exactly 17 valid keys
- Validate value length (max 5000 chars)
- Validate `seo.keywords` is valid JSON array
- Validate `seo.robots_index`, `seo.robots_follow` are "true" or "false"
- Validate `seo.twitter_card` is "summary" or "summary_large_image"
- Strip HTML tags from all values before persisting (XSS prevention)

**Step 1: Define the SiteSettingsService interface in interfaces.go**

```go
// SiteSettingsService manages CMS site settings.
type SiteSettingsService interface {
	// GetAll returns all site settings (cache-first, DB fallback).
	GetAll(ctx context.Context) ([]*models.SiteSetting, error)

	// UpdateSettings bulk-updates settings. Validates keys and values. Invalidates cache.
	UpdateSettings(ctx context.Context, adminUserID int32, settings []*models.SiteSetting) ([]*models.SiteSetting, error)
}
```

**Step 2: Implement the service**

Create `site_settings_service.go` with:
- Constructor: `NewSiteSettingsService(repo repository.SiteSettingsRepository, cache *cache.SiteSettingsCache) SiteSettingsService`
- `GetAll`: Check cache first → on miss, query DB via repo → set cache → return
- `UpdateSettings`:
  1. Validate each key is in the allowlist
  2. Validate each value is non-empty, max 5000 chars
  3. Apply key-specific validations (keywords JSON, robots booleans, twitter_card enum)
  4. Strip HTML tags from all values using `regexp.MustCompile("<[^>]*>").ReplaceAllString(value, "")`
  5. Set `UpdatedBy` to admin user ID and `UpdatedAt` to `time.Now()`
  6. Call `repo.BulkUpsert()`
  7. Invalidate cache
  8. Return updated settings

**Allowlist constant:**
```go
var validSettingKeys = map[string]bool{
	"seo.title": true, "seo.description": true, "seo.keywords": true,
	"seo.og_title": true, "seo.og_description": true, "seo.og_image": true, "seo.og_url": true,
	"seo.twitter_card": true, "seo.twitter_title": true, "seo.twitter_description": true, "seo.twitter_creator": true,
	"seo.robots_index": true, "seo.robots_follow": true, "seo.canonical": true,
	"footer.brand_name": true, "footer.tagline": true, "footer.contact_info": true,
}
```

**Step 3: Wire into Services struct**

Add `SiteSettings SiteSettingsService` to `Services` struct. Instantiate in `NewServices()`.

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 6: Create SiteSettings Handler + Wire Routes

**Files:**
- Create: `src/go-backend/handlers/site_settings.go`
- Modify: `src/go-backend/handlers/builder.go`
- Modify: `src/go-backend/handlers/routes.go`

**Security notes:**
- Public GET handler: no auth, returns all settings
- Admin PUT handler: requires auth + admin middleware (already configured on the admin route group)
- Use `c.GetInt("user_id")` to get the admin's user ID for `updated_by`
- Return generic error messages to client, log details server-side

**Step 1: Create the handler**

```go
type SiteSettingsHandler struct {
	service service.SiteSettingsService
}

func NewSiteSettingsHandler(svc service.SiteSettingsService) *SiteSettingsHandler {
	return &SiteSettingsHandler{service: svc}
}

// GetSiteSettings handles GET /api/v1/public/site-settings (no auth)
func (h *SiteSettingsHandler) GetSiteSettings(c *gin.Context) {
	settings, err := h.service.GetAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch settings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "settings": settings})
}

// UpdateSiteSettings handles PUT /api/v1/admin/site-settings (admin only)
func (h *SiteSettingsHandler) UpdateSiteSettings(c *gin.Context) {
	// Parse request
	// Get admin user ID from context
	// Call service.UpdateSettings()
	// Return updated settings or validation error
}
```

**Step 2: Wire into AllHandlers**

In `builder.go`:
- Add `SiteSettings *SiteSettingsHandler` to `AllHandlers` struct
- In `NewHandlers()`, instantiate: `SiteSettings: NewSiteSettingsHandler(services.SiteSettings)`

**Step 3: Register routes**

In `routes.go`:
- Add to the existing public group (after line 27): `publicGroup.GET("/site-settings", h.SiteSettings.GetSiteSettings)`
- Add to the existing admin group (inside the `{}` block, after line 63): `admin.PUT("/site-settings", h.SiteSettings.UpdateSiteSettings)`

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**

---

### Task 7: Backend Unit Tests

**Files:**
- Create: `src/go-backend/domain/service/site_settings_service_test.go`
- Create: `src/go-backend/handlers/site_settings_test.go`

**Security notes:** Test authorization, validation, and XSS sanitization specifically.

**Step 1: Write service tests**

Test cases:
- `GetAll` with cache hit → returns cached data
- `GetAll` with cache miss → queries DB, sets cache
- `UpdateSettings` with valid input → updates DB, invalidates cache
- `UpdateSettings` with invalid key → returns error
- `UpdateSettings` with empty value → returns error
- `UpdateSettings` with value > 5000 chars → returns error
- `UpdateSettings` with invalid `seo.keywords` JSON → returns error
- `UpdateSettings` with invalid `seo.robots_index` → returns error
- `UpdateSettings` with invalid `seo.twitter_card` → returns error
- `UpdateSettings` strips HTML tags from values

**Step 2: Write handler tests**

Test cases:
- GET `/api/v1/public/site-settings` returns 200 with settings
- PUT `/api/v1/admin/site-settings` with valid data returns 200
- PUT `/api/v1/admin/site-settings` with invalid key returns 400

**Step 3: Run tests**

```bash
cd src/go-backend && go test ./domain/service/... ./handlers/... -count=1 -v
```

**Step 4: Commit**

---

### Task 8: Generate Frontend Hooks + Fix Auth Reducer

**Files:**
- Modify: `src/wj-client/utils/generated/hooks.ts` (auto-generated)
- Modify: `src/wj-client/features/auth/store/reducer.tsx`
- Modify: `src/wj-client/app/constants.tsx`

**Security notes:** The `isAdmin` flag must be read from the auth response and stored in Redux so the frontend can gate admin access.

**Step 1: Regenerate hooks from updated proto**

```bash
cd /Users/admin/Desktop/khanh/workspace/Personal_Financial_Management && task proto:all
```

This should auto-generate:
- `useQueryGetSiteSettings()`
- `useMutationUpdateSiteSettings()`

If these are NOT generated (because the proto `service` block doesn't include these RPCs), then manually add them to the hooks file OR add the RPCs to the proto `AdminService`.

**Step 2: Fix auth reducer to include isAdmin**

In `src/wj-client/features/auth/store/reducer.tsx`, the `SET_AUTH` case currently drops `isAdmin`. Fix:

```typescript
case REDUX_TYPE.SET_AUTH: {
  return {
    isAuthenticated: action.payload.isAuthenticated,
    email: action.payload.email,
    fullname: action.payload.fullname,
    picture: action.payload.picture,
    username: action.payload.username || null,
    preferredCurrency: action.payload.preferredCurrency || "VND",
    isAdmin: action.payload.isAdmin || false,  // ADD THIS
  };
}
```

Also update `REMOVE_AUTH` to reset `isAdmin: false`.

Also update the default state to include `isAdmin: false`.

**Step 3: Update setAuth calls to pass isAdmin**

Update all `setAuth()` call sites to include `isAdmin: data.data.isAdmin || false`:
- `src/wj-client/app/[locale]/auth/login/page.tsx`
- `src/wj-client/features/auth/forms/LoginPasswordForm.tsx`
- `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx`
- Any other `setAuth()` calls (check with grep)

**Step 4: Add admin route to constants**

In `src/wj-client/app/constants.tsx`, add to the `routes` object:
```typescript
admin: `/dashboard/admin`,
```

**Step 5: Commit**

---

### Task 9: Create AdminGuard Component

**Files:**
- Create: `src/wj-client/features/admin/components/AdminGuard.tsx`

**Security notes:** This is a UI-only guard. The real security is the backend `AdminMiddleware`. This prevents non-admin users from seeing the admin page but does NOT protect the API.

**Step 1: Create AdminGuard**

```tsx
"use client";

import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageLoading } from "@/components/loading/FullPageLoading";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const auth = useSelector((state: any) => state.auth);
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated && !auth.isAdmin) {
      router.replace("/dashboard/home");
    }
  }, [auth.isAuthenticated, auth.isAdmin, router]);

  if (!auth.isAuthenticated || !auth.isAdmin) {
    return <FullPageLoading />;
  }

  return <>{children}</>;
}
```

**Step 2: Commit**

---

### Task 10: Create TagInput Component

**Files:**
- Create: `src/wj-client/components/forms/TagInput.tsx`

**Security notes:** Tags are plain text strings. React JSX auto-escapes. No XSS concern on the frontend side (backend strips HTML).

**Step 1: Create TagInput component**

A controlled form component compatible with React Hook Form that:
- Accepts comma-separated input
- Displays existing tags as removable chips
- Supports adding tags on Enter or comma press
- Supports removing tags by clicking the X icon
- Uses the standard form component styling pattern (Label, error message)

Props interface:
```typescript
interface TagInputProps {
  name: string;
  control: any;
  label: string;
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}
```

The value stored in the form is a `string[]` (array of strings). The component manages internal input state for the text field.

**Step 2: Commit**

---

### Task 11: Create Admin CMS Page

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/admin/page.tsx`

**Security notes:** Wrap in AdminGuard. All data mutations go through the admin API which re-validates server-side.

**Step 1: Create the admin page**

Layout:
- Wrapped in `AdminGuard`
- Title: "Content Management"
- Two `BaseCard` sections stacked vertically:
  1. **SEO Metadata** — FormInput for title, FormTextarea for description, TagInput for keywords, FormInput fields for OG (title, description, image URL, URL), FormSelect for twitter_card type + FormInput for twitter title/description/creator, FormToggle (toggle with "true"/"false" options) for robots index/follow, FormInput for canonical URL
  2. **Footer Content** — FormInput for brand name, tagline, contact info
- Save button at the bottom (full-width on mobile `w-full`, right-aligned on desktop `sm:w-auto sm:ml-auto`)

**Data flow:**
1. On mount, call the public GET endpoint to load current settings
2. Transform the flat key-value list into form default values
3. On save, transform form values back to key-value array, call admin PUT
4. Show success toast on save (`toast.success("Settings saved successfully!")`)
5. Show error state on failure

**Form setup:**
- Use `useForm()` with default values populated from the API response
- Use `useEffect` + `reset()` to populate form once data loads
- Dirty tracking: only send changed fields (compare form values to loaded values)

**Step 2: Commit**

---

### Task 12: Add Admin Link to Dashboard Sidebar (Conditional)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** Only show the admin nav link when `isAdmin` is true in the auth state.

**Step 1: Add conditional admin nav item**

In the sidebar navigation section:
- Import the `Shield` (or similar) icon from lucide-react
- After the Settings NavItem, add a conditional admin NavItem:

```tsx
{auth.isAdmin && (
  <NavItem
    href={routes.admin}
    label={t("admin")}
    isExpanded={isExpanded}
    showTooltip={!isExpanded}
    animationDelay={210}
    icon={<Shield size={20} />}
    isActive={path === routes.admin}
  />
)}
```

- Also add to the mobile slide-out menu with the same condition
- Add the translation key for "admin" (or just use the string "Admin" since this is admin-only)

**Step 2: Commit**

---

### Task 13: Dynamic Landing Page Metadata (generateMetadata)

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/layout.tsx`

**Security notes:** Fetch from internal API. Fall back to hardcoded values if API fails. Next.js `metadata` API auto-escapes all values.

**Step 1: Convert static metadata to generateMetadata()**

Replace the static `export const metadata: Metadata` with an async `generateMetadata()` function:

```typescript
import { Metadata } from "next";

// Hardcoded fallback values (current content)
const FALLBACK_METADATA = { /* current static metadata object */ };

async function fetchSiteSettings(): Promise<Record<string, string> | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    const res = await fetch(`${apiUrl}/api/v1/public/site-settings`, {
      next: { revalidate: 300 }, // 5-minute ISR cache
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    // Convert array to map: { "seo.title": "...", ... }
    const map: Record<string, string> = {};
    for (const s of data.settings) {
      map[s.key] = s.value;
    }
    return map;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettings();
  if (!settings) return FALLBACK_METADATA;

  return {
    title: settings["seo.title"] || FALLBACK_METADATA.title,
    description: settings["seo.description"] || FALLBACK_METADATA.description,
    keywords: settings["seo.keywords"] ? JSON.parse(settings["seo.keywords"]) : FALLBACK_METADATA.keywords,
    // ... map all fields with fallbacks
  };
}
```

**Step 2: Commit**

---

### Task 14: Dynamic Landing Footer

**Files:**
- Modify: `src/wj-client/components/landing/LandingFooter.tsx`

**Security notes:** Footer content is rendered via React JSX which auto-escapes. No dangerouslySetInnerHTML.

**Step 1: Make LandingFooter fetch from API**

Convert to an async server component that fetches footer settings:

```tsx
async function fetchFooterSettings(): Promise<{ brandName: string; tagline: string; contactInfo: string } | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
    const res = await fetch(`${apiUrl}/api/v1/public/site-settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    const map: Record<string, string> = {};
    for (const s of data.settings) map[s.key] = s.value;
    return {
      brandName: map["footer.brand_name"] || "congdongvang.com",
      tagline: map["footer.tagline"] || "Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính",
      contactInfo: map["footer.contact_info"] || "Liên hệ quảng cáo : 076.897.2512",
    };
  } catch {
    return null;
  }
}

export default async function LandingFooter() {
  const footer = await fetchFooterSettings();
  const brandName = footer?.brandName || "congdongvang.com";
  const tagline = footer?.tagline || "Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính";
  const contactInfo = footer?.contactInfo || "Liên hệ quảng cáo : 076.897.2512";

  return (
    <footer className="bg-v2-red-primary py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-amber-200 text-lg sm:text-xl font-semibold mb-2">{brandName}</p>
        <p className="text-white text-sm sm:text-base mb-2">{tagline}</p>
        <p className="text-white text-sm whitespace-nowrap">{contactInfo}</p>
      </div>
    </footer>
  );
}
```

**Step 2: Commit**

---

### Task 15: Create/Update Runtime Flow Diagrams

**Files:**
- Create: `docs/architecture/flow-admin.md`
- Modify: `docs/architecture/README.md`

**Steps:**
1. Create `flow-admin.md` with two sequence diagrams per the spec:
   - **Admin Update Settings Flow**: Admin Page → PUT /admin/site-settings → AdminMiddleware → SiteSettingsHandler → SiteSettingsService (validate + strip HTML) → SiteSettingsRepository (DB upsert) → SiteSettingsCache.Invalidate() → Response
   - **Landing Page Settings Fetch Flow**: Browser → Landing Layout (SSR) → GET /public/site-settings → SiteSettingsHandler → SiteSettingsCache.Get() → (miss) → SiteSettingsRepository.GetAll() → SiteSettingsCache.Set(5m) → Response → generateMetadata() + LandingFooter render
2. Add "Key Invariants" and "Error Paths" sections after each diagram
3. Update `docs/architecture/README.md` to add `flow-admin.md` to the Dynamic Behavior Diagrams table
4. Commit

---

### Task 16: Run Migration + Manual Verification

**Steps:**
1. Run the site settings migration: `cd src/go-backend && go run ./cmd/migrate-site-settings`
2. Start the backend: `task backend:dev`
3. Test public endpoint: `curl http://localhost:8080/api/v1/public/site-settings`
4. Verify 17 settings are returned
5. Start the frontend: `task frontend:dev`
6. Navigate to `/dashboard/admin` as an admin user
7. Verify the form loads with current values
8. Edit a value and save
9. Verify the public endpoint returns the updated value
10. Verify the landing page shows the updated footer/SEO
11. Commit any fixes

---

## Task Dependency Summary

```
Task 1 (proto) → Task 2 (model) → Task 3 (repo) → Task 4 (cache) → Task 5 (service) → Task 6 (handler)
                                                                                           ↓
Task 7 (backend tests) ← depends on Tasks 1-6 being complete
                                                                                           ↓
Task 8 (frontend hooks + auth fix) → Task 9 (AdminGuard) → Task 11 (admin page)
                                   → Task 10 (TagInput)   ↗
                                                                                           ↓
Task 12 (sidebar link) — independent of 11, depends on 8 (routes.admin)
Task 13 (generateMetadata) — independent, depends on Task 6 (API exists)
Task 14 (dynamic footer) — independent, depends on Task 6 (API exists)
Task 0 (C4 diagrams) — can run in parallel with any task
Task 15 (flow diagrams) — should run after Tasks 5-6 (need actual code to trace)
Task 16 (verification) — last, depends on all other tasks
```

**Parallelizable groups:**
- Tasks 0, 1 can run in parallel
- Tasks 9, 10 can run in parallel (after Task 8)
- Tasks 12, 13, 14 can run in parallel (after Task 8)
- Task 15 can run in parallel with Tasks 9-14
