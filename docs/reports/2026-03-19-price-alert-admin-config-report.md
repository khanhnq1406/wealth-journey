# Price Alert Admin Configuration — Implementation Report

## Summary

Implemented an admin-configurable price alert system that allows administrators to tune price alert behavior via a web UI without code changes or server restarts. The system stores configuration in Redis with environment variable fallback defaults. Includes a "Reset to Defaults" feature, a manual trigger endpoint, live template preview with clickable placeholder chips, and rich template placeholders (`{priceUnit}`, `{currency}`, `{currentPrice}`, `{baselinePrice}`).

## Spec Reference

`docs/specs/2026-03-19-price-alert-admin-config-spec.md`

## Plan Reference

`docs/plans/2026-03-19-price-alert-admin-config-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 1 | Add priceDiff field to priceMover | Done | price_alert_service.go | Existing 6 tests pass | N/A (field addition) |
| 2 | Create config model + Redis read/write | Done | price_alert_config.go (new) | 17 tests | Yes |
| 3 | Refactor PriceAlertService for Redis config | Done | price_alert_service.go | Existing 6 tests pass | Yes |
| 4 | Update AdminService broadcast title | Done | admin_service.go | Existing tests pass | N/A |
| 5 | Create PriceAlertConfig handler + routes | Done | price_alert_config.go (handler), builder.go, routes.go | N/A (handler) | N/A |
| 6 | Backend unit tests | Done | price_alert_config_test.go (new) | 17/17 pass | Yes |
| 7 | Update frontend notification interfaces | Done | NotificationItem.tsx | N/A | N/A |
| 8 | Add i18n translations | Done | en/admin.json, vi/admin.json | N/A | N/A |
| 9 | Create PriceAlertConfigForm | Done | PriceAlertConfigForm.tsx (new) | Build passes | N/A |
| 10 | Update admin page tab integration | Done | admin/page.tsx | Build passes | N/A |
| 11 | Update C4 architecture diagrams | Done | c4-component-backend.md, c4-component-frontend.md | N/A | N/A |
| 12 | Update runtime flow diagrams | Done | flow-cross-cutting.md | N/A | N/A |
| 13 | Add admin price alert trigger endpoint | Done | services.go, price_alert_trigger.go (new), builder.go, routes.go, providers.go | Build passes | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Backend Config Model | `price_alert_config_test.go` | 17 | 17/17 | Defaults, validation (cooldown, threshold, topMovers, HTML, broadcastTitle), sanitization, placeholder resolution, formatting, Redis load/save/delete/fallback/merge, priceUnit, categoryCurrency |
| Backend Service | `price_alert_service_test.go` | 6 | 6/6 | Existing tests pass after refactoring (env var seeded via t.Setenv) |
| Frontend | N/A | — | — | Build verification (`npx next build`) |

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/admin/price-alert-config` | Load current config (falls back to defaults) | Admin |
| PUT | `/api/v1/admin/price-alert-config` | Update config (partial merge, validates, sanitizes) | Admin |
| DELETE | `/api/v1/admin/price-alert-config` | Reset config to defaults (deletes Redis key) | Admin |
| POST | `/api/v1/admin/price-alert-trigger` | Manually trigger price alert check | Admin |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Input validation | Server-side: cooldownMinutes 1-1440, topMoversCount 1-20, thresholdPct 0.1-50, non-empty templates | Yes (17 tests) |
| HTML sanitization | `stripHTML` regex removes all HTML tags from string fields before save | Yes (test) |
| Authorization | AdminMiddleware enforces `is_admin` check on GET/PUT/DELETE/POST endpoints | Yes (routes.go) |
| XSS prevention | All user-provided templates stripped of HTML before storage | Yes |
| Partial update safety | `mergeConfig` only applies non-zero/non-empty fields from request | Yes |
| Reset safety | Confirmation dialog required before reset; DELETE endpoint admin-only | Yes |

## Review Results

### Spec Compliance

All functional requirements from the spec are implemented:
- FR-1: Redis-backed config with env var defaults ✓
- FR-2: Admin GET/PUT/DELETE endpoints with validation ✓
- FR-3: PriceAlertService reads config at runtime ✓
- FR-4: AdminService uses configurable broadcastTitle ✓
- FR-5: Frontend config form with accordion per-category UI ✓
- FR-6: Admin page tab renamed broadcast→notifications ✓
- FR-7: Reset to defaults with confirmation dialog ✓
- FR-8: Manual trigger endpoint for on-demand price alert checks ✓

### Security Review

- All string inputs are HTML-stripped before persistence
- Validation runs server-side (never trust client)
- Admin-only access enforced by middleware chain on all endpoints
- No sensitive data exposed in config responses
- Reset operation requires explicit confirmation dialog (danger variant)

### Code Quality

- Follows existing codebase patterns (handler → service → Redis)
- Config model co-located with price alert service in `domain/service/`
- Frontend form follows same patterns as AdminBroadcastForm
- Reset reuses existing `ConfirmationDialog` component (no new shared components created)
- i18n translations complete for both Vietnamese and English
- PriceAlertService promoted to `Services` struct for shared access (scheduler + trigger handler)

## Known Issues / Technical Debt

- No E2E tests for the admin config form (Playwright)
- Handler-level integration tests not added (matching existing pattern — most admin handlers lack handler tests)
- The `stripHTML` function uses regex which could miss edge cases — adequate for admin-only input but consider a proper HTML parser for user-facing input

## Files Changed

### Created
- `src/go-backend/domain/service/price_alert_config.go` — Config types, defaults, validation, sanitization, Redis load/save/delete, template resolution, formatting helpers (`priceUnitForMover`, `categoryCurrency`)
- `src/go-backend/domain/service/price_alert_config_test.go` — 17 unit tests
- `src/go-backend/handlers/price_alert_config.go` — GET/PUT/DELETE admin handlers
- `src/go-backend/handlers/price_alert_trigger.go` — POST admin trigger handler (calls `CheckAndAlert()` on demand)
- `src/wj-client/features/admin/components/PriceAlertConfigForm.tsx` — Admin config form with reset button, live preview, clickable placeholder chips
- `src/wj-client/features/admin/components/PriceAlertTriggerCard.tsx` — Standalone trigger card with button, loading state, success/error feedback

### Modified
- `src/go-backend/domain/service/price_alert_service.go` — Reads config from Redis at runtime, uses templates, respects enable/disable
- `src/go-backend/domain/service/admin_service.go` — Uses configurable broadcastTitle
- `src/go-backend/domain/service/services.go` — Added `PriceAlert PriceAlertService` to `Services` struct, created in `NewServices()`
- `src/go-backend/handlers/builder.go` — Wired PriceAlertConfigHandler + PriceAlertTriggerHandler
- `src/go-backend/handlers/routes.go` — Registered admin config routes (GET, PUT, DELETE) + `POST /admin/price-alert-trigger`
- `src/go-backend/internal/app/providers.go` — Simplified scheduler to reuse `services.PriceAlert` instead of creating duplicate instance
- `src/wj-client/components/notifications/NotificationItem.tsx` — Added priceDiff and broadcastTitle to metadata interfaces
- `src/wj-client/messages/en/admin.json` — English translations (including reset, placeholder descriptions, trigger card)
- `src/wj-client/messages/vi/admin.json` — Vietnamese translations (including reset, placeholder descriptions, trigger card)
- `src/wj-client/app/[locale]/dashboard/admin/page.tsx` — Renamed tab, integrated config form + trigger card
- `docs/architecture/c4-component-backend.md` — Added handler, updated service description
- `docs/architecture/c4-component-frontend.md` — Updated admin page and feature descriptions
- `docs/architecture/flow-cross-cutting.md` — Updated sections 7, 8; added section 9

## How to Test

1. **Backend config tests**: `cd src/go-backend && go test ./domain/service/ -run "TestDefault|TestLoad|TestSave|TestDelete|TestValidate|TestSanitize|TestResolve|TestFormat|TestPriceUnit|TestCategory" -v`
2. **Backend service tests**: `cd src/go-backend && go test ./domain/service/ -run TestPriceAlert -v`
3. **Frontend build**: `cd src/wj-client && npx next build`
4. **Manual testing**:
   - Log in as admin user
   - Navigate to `/dashboard/admin?tab=notifications`
   - Verify broadcast form appears at top
   - Verify trigger card appears between broadcast and config sections
   - Click "Run Price Alert Check" → verify loading state, then success/error message
   - Verify price alert config form appears below with accordion categories
   - Modify settings (cooldown, thresholds, enable/disable categories)
   - Save and verify success toast
   - Reload page and verify settings persisted
   - Type in title/body template fields and verify live preview appears below each field
   - Verify preview resolves placeholders with sample values matching the category
   - Click placeholder chips below template inputs → verify placeholder is inserted at cursor position
   - Click "Reset to Defaults" → verify confirmation dialog appears
   - Confirm reset → verify all fields revert to default values and success toast shows
   - Reload page → verify defaults are loaded (no custom config in Redis)
5. **Manual trigger endpoint**:
   ```bash
   curl -X POST http://localhost:8080/api/v1/admin/price-alert-trigger \
     -H "Authorization: Bearer {JWT}"
   ```
   - Should return `{"success": true, "message": "Price alert check completed"}` on success

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-19 | Add per-broadcast title input: AdminBroadcastForm now has a title field (optional, max 200 chars). Backend `Broadcast()` accepts title param — falls back to Redis config `broadcastTitle` when empty. Handler, service, interface, tests, i18n all updated. | Minor | (pending) |
| 2026-03-19 | Add live preview for title/body templates in config form | Minor | pending |
| 2026-03-19 | Add `{currentPrice}` and `{baselinePrice}` template placeholders for formatted current and baseline prices | Minor | pending |
| 2026-03-19 | Fix test mock URL mismatch (`/dashboard/prices` → `/dashboard/home`) in price_alert_service_test.go | Minor | pending |
| 2026-03-19 | Add `{priceUnit}` and `{currency}` template placeholders so admins can include gold/silver unit (lượng, oz, kg) and currency (VND, USD) in alert templates. Backend: `priceUnitForMover()` + `categoryCurrency()` helpers with 2 new tests (16 total). Frontend: updated PLACEHOLDERS, SAMPLE_VALUES, i18n (en+vi). | Minor | pending |
| 2026-03-19 | Add "Reset to Defaults" button for price alert config. Backend: `DeletePriceAlertConfig()` + `ResetConfig` handler + `DELETE` route (admin-only). Frontend: reset button with `ConfirmationDialog` (danger variant). i18n: en+vi translations. 1 new test (17 total). | Minor | pending |
| 2026-03-19 | Add admin price alert trigger endpoint (`POST /admin/price-alert-trigger`). Promotes `PriceAlertService` into `Services` struct for shared access. Handler calls `CheckAndAlert()` on demand. Scheduler simplified to reuse `services.PriceAlert` (removes duplicate service creation). | Minor | pending |
| 2026-03-19 | Add clickable placeholder chips below template inputs. Clicking a chip inserts the placeholder at cursor position. Uses `useRef` per input + `insertAtCursor` helper with `requestAnimationFrame` for cursor restore. Chips show tooltip with placeholder description on hover. | Minor | pending |
| 2026-03-19 | Add `PriceAlertTriggerCard` frontend component — standalone card with button, loading state, inline success/error feedback. Placed between broadcast form and config form on notifications tab. i18n: en+vi translations. | Minor | pending |
| 2026-03-19 | Fix in-app notification displaying hardcoded format instead of admin-configured templates. Backend: resolved `title` and `body` now included in notification metadata JSON (template resolution moved earlier, push reuses same values). Frontend: `NotificationItem` reads `meta.title`/`meta.body` with fallback for older notifications. Test added to verify metadata contains resolved fields. | Minor | pending |
| 2026-03-19 | Add `ForceCheckAndAlert()` method — manual trigger bypasses threshold, cooldown, and missing baselines. Refactored `CheckAndAlert` into shared `doCheckAndAlert(ctx, force)` with `checkPriceForce` helper. Trigger handler now calls `ForceCheckAndAlert`. Added 30-second rate limit on force trigger to prevent notification spam. Removed raw error details from 500 response. 3 new tests (9 service tests total). | Minor | pending |
