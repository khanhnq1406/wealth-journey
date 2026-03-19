# Price Alert Admin Configuration — Implementation Report

## Summary

Implemented an admin-configurable price alert system that allows administrators to tune price alert behavior via a web UI without code changes or server restarts. The system stores configuration in Redis with environment variable fallback defaults.

## Spec Reference

`docs/specs/2026-03-19-price-alert-admin-config-spec.md`

## Plan Reference

`docs/plans/2026-03-19-price-alert-admin-config-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 1 | Add priceDiff field to priceMover | Done | price_alert_service.go | Existing 6 tests pass | N/A (field addition) |
| 2 | Create config model + Redis read/write | Done | price_alert_config.go (new) | 14 tests | Yes |
| 3 | Refactor PriceAlertService for Redis config | Done | price_alert_service.go | Existing 6 tests pass | Yes |
| 4 | Update AdminService broadcast title | Done | admin_service.go | Existing tests pass | N/A |
| 5 | Create PriceAlertConfig handler + routes | Done | price_alert_config.go (handler), builder.go, routes.go | N/A (handler) | N/A |
| 6 | Backend unit tests | Done | price_alert_config_test.go (new) | 14/14 pass | Yes |
| 7 | Update frontend notification interfaces | Done | NotificationItem.tsx | N/A | N/A |
| 8 | Add i18n translations | Done | en/admin.json, vi/admin.json | N/A | N/A |
| 9 | Create PriceAlertConfigForm | Done | PriceAlertConfigForm.tsx (new) | Build passes | N/A |
| 10 | Update admin page tab integration | Done | admin/page.tsx | Build passes | N/A |
| 11 | Update C4 architecture diagrams | Done | c4-component-backend.md, c4-component-frontend.md | N/A | N/A |
| 12 | Update runtime flow diagrams | Done | flow-cross-cutting.md | N/A | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Backend Config Model | `price_alert_config_test.go` | 14 | 14/14 | Defaults, validation (cooldown, threshold, topMovers, HTML, broadcastTitle), sanitization, placeholder resolution, formatting, Redis load/save/fallback/merge |
| Backend Service | `price_alert_service_test.go` | 6 | 6/6 | Existing tests pass after refactoring (env var seeded via t.Setenv) |
| Frontend | N/A | — | — | Build verification (`npx next build`) |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation | Server-side: cooldownMinutes 1-1440, topMoversCount 1-20, thresholdPct 0.1-50, non-empty templates | Yes (14 tests) |
| HTML sanitization | `stripHTML` regex removes all HTML tags from string fields before save | Yes (test) |
| Authorization | AdminMiddleware enforces `is_admin` check on GET/PUT endpoints | Yes (routes.go) |
| XSS prevention | All user-provided templates stripped of HTML before storage | Yes |
| Partial update safety | `mergeConfig` only applies non-zero/non-empty fields from request | Yes |

## Review Results

### Spec Compliance

All functional requirements from the spec are implemented:
- FR-1: Redis-backed config with env var defaults ✓
- FR-2: Admin GET/PUT endpoints with validation ✓
- FR-3: PriceAlertService reads config at runtime ✓
- FR-4: AdminService uses configurable broadcastTitle ✓
- FR-5: Frontend config form with accordion per-category UI ✓
- FR-6: Admin page tab renamed broadcast→notifications ✓

### Security Review

- All string inputs are HTML-stripped before persistence
- Validation runs server-side (never trust client)
- Admin-only access enforced by middleware chain
- No sensitive data exposed in config responses

### Code Quality

- Follows existing codebase patterns (handler → service → Redis)
- Config model co-located with price alert service in `domain/service/`
- Frontend form follows same patterns as AdminBroadcastForm
- i18n translations complete for both Vietnamese and English

## Known Issues / Technical Debt

- No E2E tests for the admin config form (Playwright)
- Handler-level integration tests not added (matching existing pattern — most admin handlers lack handler tests)
- The `stripHTML` function uses regex which could miss edge cases — adequate for admin-only input but consider a proper HTML parser for user-facing input

## Files Changed

### Created
- `src/go-backend/domain/service/price_alert_config.go` — Config types, defaults, validation, sanitization, Redis load/save, template resolution
- `src/go-backend/domain/service/price_alert_config_test.go` — 14 unit tests
- `src/go-backend/handlers/price_alert_config.go` — GET/PUT admin handler
- `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx` — Admin config form component

### Modified
- `src/go-backend/domain/service/price_alert_service.go` — Reads config from Redis at runtime, uses templates, respects enable/disable
- `src/go-backend/domain/service/admin_service.go` — Uses configurable broadcastTitle
- `src/go-backend/handlers/builder.go` — Wired PriceAlertConfigHandler
- `src/go-backend/handlers/routes.go` — Registered admin config routes
- `src/wj-client/components/notifications/NotificationItem.tsx` — Added priceDiff and broadcastTitle to metadata interfaces
- `src/wj-client/messages/en/admin.json` — English translations
- `src/wj-client/messages/vi/admin.json` — Vietnamese translations
- `src/wj-client/app/[locale]/dashboard/admin/page.tsx` — Renamed tab, integrated config form
- `docs/architecture/c4-component-backend.md` — Added handler, updated service description
- `docs/architecture/c4-component-frontend.md` — Updated admin page and feature descriptions
- `docs/architecture/flow-cross-cutting.md` — Updated sections 7, 8; added section 9

## How to Test

1. **Backend config tests**: `cd src/go-backend && go test ./domain/service/ -run TestPriceAlertConfig -v`
2. **Backend service tests**: `cd src/go-backend && go test ./domain/service/ -run TestPriceAlert -v`
3. **Frontend build**: `cd src/wj-client && npx next build`
4. **Manual testing**:
   - Log in as admin user
   - Navigate to `/dashboard/admin?tab=notifications`
   - Verify broadcast form appears at top
   - Verify price alert config form appears below with accordion categories
   - Modify settings (cooldown, thresholds, enable/disable categories)
   - Save and verify success toast
   - Reload page and verify settings persisted
