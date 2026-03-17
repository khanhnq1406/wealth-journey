# Admin CMS — SEO & Footer Content Management — Implementation Report

## Summary

Implemented an admin CMS feature allowing admin users to edit the landing page's SEO metadata and footer content through a dedicated dashboard page. Settings are stored in a `site_settings` PostgreSQL table (key-value schema with 17 settings), served via a Redis-cached public API, and consumed by the landing page's dynamic `generateMetadata()` and `LandingFooter` components.

## Spec Reference

`docs/specs/2026-03-18-admin-cms-spec.md`

## Plan Reference

`docs/plans/2026-03-18-admin-cms-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 0 | Update C4 Architecture Diagrams | Done | c4-component-backend.md, c4-component-frontend.md | N/A | N/A |
| 1 | Add Proto Messages to admin.proto | Done | admin.proto, generated Go/TS files | Build pass | N/A |
| 2 | Create SiteSettings Database Model + Migration | Done | site_settings.go, migrate-site-settings/main.go, Taskfile.yml | Build pass | N/A |
| 3 | Create SiteSettings Repository | Done | site_settings_repository.go | Build pass | N/A |
| 4 | Create SiteSettings Cache | Done | site_settings_cache.go | Build pass | N/A |
| 5 | Create SiteSettings Service | Done | site_settings_service.go, interfaces.go, services.go | Build pass | N/A |
| 6 | Create SiteSettings Handler + Wire Routes | Done | site_settings.go handler, builder.go, routes.go, providers.go | Build pass | N/A |
| 7 | Backend Unit Tests | Done | site_settings_service_test.go, site_settings_test.go | 14/14 pass | Yes |
| 8 | Fix Auth Reducer + Frontend Hooks + Constants | Done | reducer.tsx, constants.tsx, 6 auth call sites | N/A | N/A |
| 9 | Create AdminGuard Component | Done | AdminGuard.tsx | N/A | N/A |
| 10 | Create TagInput Component | Done | TagInput.tsx | N/A | N/A |
| 11 | Create Admin CMS Page | Done | admin/page.tsx | N/A | N/A |
| 12 | Add Admin Link to Dashboard Sidebar | Done | dashboard/layout.tsx | N/A | N/A |
| 13 | Dynamic Landing Page Metadata | Done | landing/layout.tsx | N/A | N/A |
| 14 | Dynamic Landing Footer | Done | LandingFooter.tsx | N/A | N/A |
| 15 | Create Runtime Flow Diagrams | Done | flow-admin.md, README.md | N/A | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Backend Service | `site_settings_service_test.go` | 11 | 11/11 | GetAll, UpdateSettings (valid, invalid key, empty value, value too long, invalid JSON, valid JSON, invalid robots, invalid twitter_card, HTML stripping, empty list) |
| Backend Handler | `site_settings_test.go` | 3 | 3/3 | GET success 200, PUT success 200 with admin context, PUT empty body 400 |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | JWT via AuthMiddleware on PUT endpoint | Yes (middleware chain) |
| Authorization | AdminMiddleware checks IsAdmin flag | Yes (403 for non-admins) |
| Input validation | Server-side 17-key allowlist, max 5000 chars, JSON/enum/boolean validators | Yes (unit tests) |
| XSS prevention | HTML tag stripping via regex `<[^>]*>` in service layer | Yes (unit test) |
| Frontend guard | AdminGuard component with Redux isAdmin check | Yes (UI-only, not security boundary) |
| Data integrity | ON CONFLICT upsert prevents duplicates, audit via updated_by | Yes |
| Cache invalidation | Redis cache invalidated on every successful update | Yes |
| Fallback safety | Hardcoded FALLBACK_METADATA and DEFAULTS for API failures | Yes |

## Architecture Documentation

| Document | Action | Description |
|----------|--------|-------------|
| `c4-component-backend.md` | Updated | Added SiteSettingsHandler, Service, Repository, Cache |
| `c4-component-frontend.md` | Updated | Added AdminCMSPage, AdminFeature, TagInput |
| `flow-admin.md` | Created | 2 sequence diagrams: public fetch + admin update |
| `README.md` | Updated | Added flow-admin.md to dynamic behavior table |

## Known Issues / Technical Debt

1. **No generated hooks for SiteSettings** — The admin.proto has messages but no RPC service definition for SiteSettings. The CMS page uses `apiClient` directly with React Query instead of auto-generated hooks. Consider adding RPCs to admin.proto and regenerating.
2. **Frontend tests missing** — No component tests for AdminGuard, TagInput, or Admin CMS page. These should be added.
3. **No Playwright E2E tests** — The admin CMS flow is not covered by E2E tests.

## Files Changed

### Created
- `api/protobuf/v1/admin.proto` (modified — added SiteSetting messages)
- `src/go-backend/domain/models/site_settings.go`
- `src/go-backend/cmd/migrate-site-settings/main.go`
- `src/go-backend/domain/repository/site_settings_repository.go`
- `src/go-backend/pkg/cache/site_settings_cache.go`
- `src/go-backend/domain/service/site_settings_service.go`
- `src/go-backend/handlers/site_settings.go`
- `src/go-backend/domain/service/site_settings_service_test.go`
- `src/go-backend/handlers/site_settings_test.go`
- `src/wj-client/features/admin/components/AdminGuard.tsx`
- `src/wj-client/components/forms/TagInput.tsx`
- `src/wj-client/app/[locale]/dashboard/admin/page.tsx`
- `docs/architecture/flow-admin.md`
- `docs/reports/2026-03-18-admin-cms-progress.md`

### Modified
- `src/go-backend/domain/service/interfaces.go` (added SiteSettingsService)
- `src/go-backend/domain/service/services.go` (wired SiteSettings)
- `src/go-backend/internal/app/providers.go` (added SiteSettings repo)
- `src/go-backend/handlers/builder.go` (wired SiteSettings handler)
- `src/go-backend/handlers/routes.go` (added public GET + admin PUT routes)
- `src/wj-client/features/auth/store/reducer.tsx` (added isAdmin)
- `src/wj-client/app/constants.tsx` (added admin route)
- `src/wj-client/app/[locale]/auth/login/page.tsx` (isAdmin in setAuth)
- `src/wj-client/app/[locale]/auth/register/page.tsx` (isAdmin in setAuth)
- `src/wj-client/app/[locale]/auth/utils/AuthCheck.tsx` (isAdmin in setAuth)
- `src/wj-client/contexts/CurrencyContext.tsx` (isAdmin in setAuth)
- `src/wj-client/features/auth/forms/LoginPasswordForm.tsx` (isAdmin in setAuth)
- `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx` (isAdmin in setAuth)
- `src/wj-client/app/[locale]/dashboard/layout.tsx` (admin nav link)
- `src/wj-client/app/[locale]/landing/layout.tsx` (dynamic generateMetadata)
- `src/wj-client/components/landing/LandingFooter.tsx` (dynamic footer)
- `docs/architecture/c4-component-backend.md` (C4 updates)
- `docs/architecture/c4-component-frontend.md` (C4 updates)
- `docs/architecture/README.md` (added flow-admin.md entry)
- `Taskfile.yml` (added migrate-site-settings task)

## Commits

| Commit | Message |
|--------|---------|
| `78d7047` | feat(admin-cms): add proto messages, C4 diagrams, model and migration |
| `417ae6b` | feat(admin-cms): add repository, cache, service, handler and routes |
| `4e00885` | test(admin-cms): add service and handler unit tests |
| `29b0f07` | feat(admin-cms): add frontend auth, AdminGuard, and TagInput components |
| `144e71e` | feat(admin-cms): add CMS page, sidebar link, dynamic metadata and footer |
| `9032d7d` | docs(admin-cms): add runtime flow diagrams and update progress |

## How to Test

### Backend
1. Run migration: `cd src/go-backend && go run ./cmd/migrate-site-settings`
2. Start backend: `task backend:dev`
3. Test public endpoint: `curl http://localhost:8080/api/v1/public/site-settings`
4. Test admin endpoint (requires admin JWT): `curl -X PUT http://localhost:8080/api/v1/admin/site-settings -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"settings":[{"key":"seo.title","value":"New Title"}]}'`
5. Run unit tests: `go test ./domain/service/ -run TestSiteSettings -v && go test ./handlers/ -run SiteSettings -v`

### Frontend
1. Log in as an admin user
2. Verify Shield icon appears in sidebar (desktop) and hamburger menu (mobile)
3. Navigate to `/dashboard/admin`
4. Edit SEO fields and footer fields
5. Click "Save Settings" and verify success toast
6. Visit the landing page and verify metadata in view-source matches updated values
7. Verify footer text matches updated values

## Fix History

| Date | Fix | Severity | Files Changed | Commit |
|------|-----|----------|---------------|--------|
| 2026-03-18 | Fix runtime bug: backend responses now wrapped in `data` field to match `ApiResponse<T>` type contract; frontend data access pattern corrected | Critical | site_settings.go, site_settings_test.go, admin/page.tsx, landing/layout.tsx, LandingFooter.tsx | (see below) |
| 2026-03-18 | Fix information disclosure: added SiteSettingDTO to strip `updatedBy` admin user ID from public API responses | Medium | site_settings.go, site_settings_test.go | (same commit) |
| 2026-03-18 | Fix error message leakage: handler now distinguishes validation errors (400, safe to return) from internal errors (500, generic message) | Medium | site_settings.go | (same commit) |
| 2026-03-18 | Fix user_id extraction: use `c.GetInt("user_id")` consistent with other handlers | Minor | site_settings.go, site_settings_test.go | (same commit) |
| 2026-03-18 | Remove unused code: removed `initialValues` state and unused `errors` from formState | Minor | admin/page.tsx | (same commit) |
