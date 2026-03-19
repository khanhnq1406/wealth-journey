# Price Fluctuation Alerts & Admin Broadcast — Implementation Report

## Summary

Implemented price fluctuation alerts (gold/silver), admin broadcast messaging, and Web Push notification delivery channel. The feature extends the existing community notification infrastructure with two new notification types (`price_alert`, `admin_broadcast`) and adds a service worker for push notifications.

## Spec Reference

`docs/specs/2026-03-19-price-alerts-admin-broadcast-spec.md`

## Plan Reference

`docs/plans/2026-03-19-price-alerts-admin-broadcast-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Add Metadata to Notification + BatchCreate + GetAllUserIDs | Done | 5 | `2dfa867` |
| 2 | Create PushSubscription model + repository | Done | 3 | `f628354` |
| 3 | Database migration | Done | 2 | `a1f69aa` |
| 4 | Add metadata to NotificationItem proto + generate code | Done | 6 | `be98971` |
| 5 | Create PushService | Done | 4 | `86f48df` |
| 6 | Create PriceAlertService | Done | 1 | `cdec5d8` |
| 7+10 | Add Broadcast to AdminService + DI wiring | Done | 3 | `c030642` |
| 8 | Handlers + routes for broadcast and push | Done | 4 | `b60b32b` |
| 9 | PriceAlertJob + scheduler registration | Done | 2 | `fd513de` |
| 11-13 | Frontend notification rendering + SSE + service worker | Done | 5 | `3910442` |
| 14-17 | Push subscription hook + banner + broadcast form + integration | Done | 7 | `33ea847` |
| 18 | Update flow diagrams | Done | 2 | `56b1de0` |

**Total: 13 commits, 42 files changed, +5,208 / -760 lines**

## Architecture Overview

### Backend (Go)

```
PriceAlertJob (scheduler, 15min)
  └─► PriceAlertService
       ├─► LoadPriceAlertConfig(Redis) → env var fallback defaults
       ├─► GoldPriceService / SilverPriceService (price fetch)
       ├─► Skip disabled categories (catCfg.Enabled)
       ├─► Redis (baselines, cooldowns with cfg.CooldownMinutes)
       ├─► ResolvePlaceholders(catCfg.TitleTemplate/BodyTemplate)
       ├─► NotificationRepository.BatchCreate (DB persist)
       ├─► Redis PUBLISH user:{id}:notifications (SSE delivery)
       └─► PushService.SendToAll (Web Push delivery)

AdminBroadcastHandler (POST /api/v1/admin/broadcast)
  └─► AdminService.Broadcast
       ├─► LoadPriceAlertConfig(Redis) → cfg.BroadcastTitle
       ├─► Validation (500 char max, HTML strip)
       ├─► Rate limiting (10/hr/admin via Redis INCR)
       ├─► UserRepository.GetAllUserIDs
       ├─► NotificationRepository.BatchCreate
       ├─► Redis PUBLISH (SSE)
       └─► PushService.SendToAll (Web Push)

PriceAlertConfigHandler (GET/PUT /api/v1/admin/price-alert-config)
  ├─► GET: LoadPriceAlertConfig(Redis) → defaults fallback
  └─► PUT: mergeConfig → SanitizePriceAlertConfig → ValidatePriceAlertConfig → SavePriceAlertConfig(Redis)

PushHandler (3 endpoints)
  ├─► GET  /api/v1/push/vapid-key
  ├─► POST /api/v1/push/subscribe
  └─► DELETE /api/v1/push/subscribe
```

### Frontend (Next.js)

```
Dashboard Layout
  └─► PushPermissionBanner (platform detection, iOS PWA awareness, dismissal logic)

NotificationBell → NotificationPanel
  └─► NotificationItem
       ├─► price_alert type (amber background, direction arrows, % change)
       ├─► admin_broadcast type (blue background, system icon)
       └─► default community type (green background, avatar)

useNotificationStream (SSE)
  └─► Handles metadata field + actorId=0 system notifications

usePushSubscription (hook)
  └─► SW registration, VAPID key fetch, subscribe/unsubscribe

Admin Page → Notifications Tab
  ├─► AdminBroadcastForm (textarea, char counter, API call)
  └─► PriceAlertConfigForm (accordion per-category settings, GET/PUT /admin/price-alert-config)
```

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | All new endpoints use existing `AuthMiddleware` (JWT) | Yes — reuses existing middleware |
| Authorization (admin) | Broadcast requires `AdminMiddleware` (is_admin=true) | Yes — double middleware chain |
| Authorization (push) | Push subscriptions are user-scoped via JWT userID | Yes — handler extracts userID |
| Input validation (broadcast) | Server-side: max 500 chars, HTML tag stripping via regex | Yes — `admin_service.go` |
| Input validation (push) | HTTPS-only endpoints, base64 key validation, length limits | Yes — `push.go` handler |
| Rate limiting (broadcast) | Max 10/hour/admin via Redis INCR with 1h TTL | Yes — `admin_service.go` |
| Rate limiting (push) | Max 5 subscriptions per user via DB count | Yes — `push.go` handler |
| Rate limiting (price alerts) | 2-hour cooldown per category via Redis TTL | Yes — `price_alert_service.go` |
| Secrets | VAPID private key in env vars only, never logged or returned | Yes — only public key exposed |
| XSS prevention | HTML tags stripped from broadcast messages and all config string fields | Yes — regex in admin_service + price_alert_config |
| Input validation (config) | Server-side: cooldownMinutes 1-1440, topMoversCount 1-20, thresholdPct 0.1-50, non-empty templates | Yes — 14 unit tests |
| Authorization (config) | GET/PUT config requires `AdminMiddleware` (is_admin=true) | Yes — routes.go admin group |

## New Backend Files

| File | Purpose |
|------|---------|
| `domain/models/push_subscription.go` | PushSubscription model (user_id, endpoint, p256dh, auth) |
| `domain/repository/push_subscription_repository.go` | Full CRUD for push subscriptions |
| `domain/service/push_service.go` | Web Push delivery with webpush-go (20-worker semaphore) |
| `domain/service/price_alert_service.go` | Price fluctuation detection (4 categories, Redis baselines, runtime config) |
| `domain/service/price_alert_config.go` | Config model, defaults, validation, sanitization, Redis load/save, template resolution |
| `domain/service/price_alert_config_test.go` | 14 unit tests for config model and helpers |
| `handlers/admin_broadcast.go` | POST /api/v1/admin/broadcast handler |
| `handlers/price_alert_config.go` | GET/PUT /api/v1/admin/price-alert-config handler |
| `handlers/push.go` | GET/POST/DELETE push subscription handlers |
| `internal/scheduler/price_alert_job.go` | 15-min scheduler job |
| `cmd/migrate-price-alerts/main.go` | DB migration (metadata column + push_subscription table) |

## New Frontend Files

| File | Purpose |
|------|---------|
| `public/sw.js` | Minimal push-only service worker |
| `features/community/hooks/usePushSubscription.ts` | SW registration, VAPID key, subscribe/unsubscribe |
| `components/notifications/PushPermissionBanner.tsx` | Push opt-in banner with platform detection |
| `features/admin/components/AdminBroadcastForm.tsx` | Admin broadcast form with char counter |
| `features/admin/components/PriceAlertConfigForm.tsx` | Admin config form with accordion per-category settings |

## Modified Backend Files

| File | Changes |
|------|---------|
| `domain/models/notification.go` | Added `Metadata datatypes.JSON` field |
| `domain/repository/interfaces.go` | Added `BatchCreate`, `GetAllUserIDs`, `PushSubscriptionRepository` |
| `domain/repository/notification_repository.go` | Implemented `BatchCreate` |
| `domain/repository/user_repository.go` | Implemented `GetAllUserIDs` |
| `domain/service/interfaces.go` | Added `PushService`, `PriceAlertService` interfaces, `Broadcast` to `AdminService` |
| `domain/service/admin_service.go` | Added broadcast implementation with rate limiting + HTML stripping; uses configurable `broadcastTitle` from Redis config |
| `domain/service/community_service.go` | Added metadata serialization for notifications |
| `domain/service/services.go` | Added `Push` to Services, `PushSubscription` to Repositories |
| `handlers/builder.go` | Wired `AdminBroadcast`, `Push`, and `PriceAlertConfig` handlers |
| `handlers/routes.go` | Added admin broadcast, push, and price-alert-config routes |
| `internal/app/providers.go` | Added `PushSubscription` repo, `PriceAlertJob` to scheduler |
| `api/protobuf/v1/community.proto` | Added `metadata` field + broadcast/push messages |

## Modified Frontend Files

| File | Changes |
|------|---------|
| `components/notifications/NotificationItem.tsx` | Added price_alert + admin_broadcast rendering branches; added `priceDiff` to metadata, `broadcastTitle` to broadcast metadata |
| `components/notifications/NotificationPanel.tsx` | Updated click routing for new notification types |
| `features/community/hooks/useNotificationStream.ts` | Added metadata + actorId=0 handling in SSE |
| `app/[locale]/dashboard/admin/page.tsx` | Renamed "Broadcast" tab to "Notifications"; integrated PriceAlertConfigForm below AdminBroadcastForm |
| `app/[locale]/dashboard/layout.tsx` | Added PushPermissionBanner |
| `messages/en/admin.json` | Added broadcast + price alert config translations |
| `messages/vi/admin.json` | Added broadcast + price alert config translations |

## Documentation Updated

| File | Changes |
|------|---------|
| `docs/architecture/flow-cross-cutting.md` | Added Price Alert Detection + Admin Broadcast + Admin Price Alert Config sequence diagrams, updated scheduler job table |
| `docs/architecture/c4-component-backend.md` | Added PriceAlertConfigHandler, updated PriceAlertService description for runtime Redis config |
| `docs/architecture/c4-component-frontend.md` | Updated admin page and admin feature descriptions for Notifications tab + PriceAlertConfigForm |
| `Taskfile.yml` | Added `backend:migrate-price-alerts` task |

## Build Verification

| Check | Result |
|-------|--------|
| `go build ./...` | Pass |
| `golangci-lint run ./...` | Pass |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass (0 errors, warnings only) |
| `npx jest --ci` | Pass |
| `npm run build` | Pass |
| `govulncheck ./...` | Pass |
| `npm audit --audit-level=critical` | Pass |

## Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | — | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | — | VAPID private key (secret) |
| `VAPID_CONTACT` | — | Contact email for VAPID |
| `PRICE_ALERT_THRESHOLD_GOLD_VND` | `2.0` | Gold VND % threshold (fallback default; overridable via admin UI) |
| `PRICE_ALERT_THRESHOLD_GOLD_USD` | `1.5` | Gold USD % threshold (fallback default; overridable via admin UI) |
| `PRICE_ALERT_THRESHOLD_SILVER_VND` | `3.0` | Silver VND % threshold (fallback default; overridable via admin UI) |
| `PRICE_ALERT_THRESHOLD_SILVER_USD` | `2.0` | Silver USD % threshold (fallback default; overridable via admin UI) |
| `PRICE_ALERT_COOLDOWN_MINUTES` | `120` | Cooldown between alerts per category (fallback default; overridable via admin UI) |
| `PRICE_ALERT_TOP_MOVERS` | `3` | Max movers shown in alert (fallback default; overridable via admin UI) |

## Deployment Steps

1. **Set environment variables** for VAPID keys and alert thresholds in Railway
2. **Run migration**: `task backend:migrate-price-alerts`
3. **Deploy backend** — PriceAlertJob starts automatically after 30s delay
4. **Deploy frontend** — Service worker and new components are included
5. **Generate VAPID keys** (if not already done): `npx web-push generate-vapid-keys`

## How to Test

### Price Alerts
1. Ensure Redis is running and gold/silver price services are fetching data
2. The PriceAlertJob runs every 15 minutes — first run sets baselines
3. If prices shift beyond thresholds between runs, alerts are generated
4. Check notification panel for amber-colored price alert cards
5. Click a price alert — navigates to `/dashboard/prices`

### Admin Broadcast
1. Log in as an admin user
2. Navigate to `/dashboard/admin?tab=notifications`
3. Type a message (max 500 chars), click "Gửi thông báo"
4. All users should see a blue notification in their notification panel
5. Verify rate limit: after 10 broadcasts in 1 hour, the 11th should fail

### Admin Price Alert Config
1. Log in as an admin user
2. Navigate to `/dashboard/admin?tab=notifications` — scroll below the broadcast form
3. Config form should load with current settings (or defaults)
4. Modify settings (cooldown, thresholds, enable/disable categories, templates)
5. Save and verify success toast
6. Reload page and verify settings persisted
7. Backend unit tests: `cd src/go-backend && go test ./domain/service/ -run TestPriceAlertConfig -v`

### Web Push
1. Visit any dashboard page — PushPermissionBanner should appear (if not dismissed)
2. Click "Bật" to enable push notifications
3. Browser permission dialog should appear
4. After granting, service worker registers and subscription is sent to server
5. When offline or in background, push notifications should appear for new alerts/broadcasts

## Known Issues / Technical Debt

1. ~~**C4 architecture diagrams** (Task 0) deferred~~ — **FIXED**: Updated `c4-component-backend.md` and `c4-component-frontend.md` with new services, handlers, repos, and relationships
2. ~~**Unit tests** not written for new services~~ — **FIXED**: Added 22 unit tests (6 AdminService.Broadcast + 10 PushService + 6 PriceAlertService)
3. ~~**E2E tests** not updated for new admin broadcast tab~~ — **FIXED**: Added 3 Playwright tests for broadcast tab (textarea, char counter, submit button)
4. **VAPID key rotation** not implemented — keys are static once set (operational concern, deferred)
5. **Push subscription cleanup** for expired/invalid subscriptions happens only on 410 responses during send — no periodic cleanup job (reactive cleanup is sufficient for now)
6. **Config `stripHTML`** uses regex (`<[^>]*>`) which is adequate for admin-only input but could miss edge cases — consider a proper HTML parser for user-facing input
7. **No E2E tests** for the admin price alert config form (Playwright)

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-19 | Fix broken test compilation (admin_service_test.go 2→5 args, investment mock missing GetAllUserIDs) + add 6 Broadcast unit tests | Major | 451b405 |
| 2026-03-19 | Add push_service_test.go (10 tests) + price_alert_service_test.go (6 tests) with miniredis | Major | 8995079 |
| 2026-03-19 | Update C4 backend/frontend diagrams + README + E2E broadcast tests | Major | 8498440 |
| 2026-03-19 | Fix VAPID key fetch infinite loop: add error state to usePushSubscription hook, guard auto-subscribe effect in PushPermissionBanner against error state | Minor | (this commit) |
| 2026-03-19 | Add VAPID + Price Alert env vars to `.env.example` with generation instructions and documentation | Minor | (this commit) |
| 2026-03-19 | Fix FK violation on `actor_id=0`: make `ActorID` nullable (`*int32`) for system notifications (price_alert, admin_broadcast), add migration to drop NOT NULL + re-add FK with ON DELETE SET NULL | Minor | (this commit) |
| 2026-03-19 | Fix push notifications not showing as system popups: (1) remove `error` from subscribe() guard that permanently blocked retries after first failure, (2) add retry limit (3 attempts) to auto-subscribe in PushPermissionBanner, (3) add HTTP status logging for failed push deliveries, (4) add endpoint dedup (upsert) to prevent duplicate subscriptions | Minor | (this commit) |
| 2026-03-19 | Fix Apple Web Push 403 errors: (1) add `Urgency: normal` header to all webpush requests (Apple requires it), (2) auto-remove Apple subscriptions returning 403 (invalid/expired), (3) read+log response body on 403 for diagnostics, (4) extract shared `handlePushResponse` method | Minor | (this commit) |
| 2026-03-19 | Fix push notifications not showing as system notifications on iPhone PWA, Safari macOS, Chrome: (1) change `UrgencyNormal` → `UrgencyHigh` so Apple APNs delivers immediately instead of deferring (priority 10 vs 5), (2) always show fallback notification in SW even when payload is null/unparseable — Safari suppresses future pushes if SW `push` event doesn't call `showNotification`, (3) add `tag` + `renotify:true` to prevent OS notification suppression from stacking, (4) remove `vibrate` (unsupported on Safari/iOS) | Minor | (this commit) |
| 2026-03-19 | Fix CI workflow failures: (1) `admin_test.go` — add missing `Broadcast()` to `mockAdminService` interface, (2) `push_service.go` — fix unchecked `resp.Body.Close()` + use tagged switch (errcheck/staticcheck), (3) `push_service_test.go` — replace `os.Setenv` with `t.Setenv` (errcheck), (4) `price_alert_service_test.go` — suppress `mr.Set` errcheck, (5) `PushPermissionBanner.tsx` — replace `setState`-in-effect with `useState` lazy initializer (react-hooks/set-state-in-effect), (6) `npm audit fix` — resolve critical jspdf vulnerability | Minor | (this commit) |
| 2026-03-19 | Fix Apple `BadJwtToken` — the real root cause of push failures on Safari/iPhone: (1) strip `mailto:` prefix from VAPID_CONTACT before passing to webpush-go, which auto-prepends `mailto:` — double prefix `mailto:mailto:...` caused Apple to reject the VAPID JWT, (2) don't delete Apple subscriptions on 403 when body contains `BadJwtToken` (subscription is valid, JWT was broken), (3) update `.env.example` to use plain email without `mailto:` prefix | Minor | (this commit) |
| 2026-03-19 | Fix push banner never showing on iOS: (1) the `permissionState === "unsupported"` hide check ran before the iOS install check, so on iOS Safari (where push APIs don't exist) the banner returned `null` before reaching the "install as PWA" prompt — moved the iOS install check before the unsupported guard, (2) added "Cài đặt" button to the iOS banner that opens a `BaseModal` with `InstallSteps` showing step-by-step PWA installation instructions (Share → Add to Home Screen), (3) on Android the button triggers `promptInstall()` for native install prompt | Minor | (this commit) |
| 2026-03-19 | Fix price_alert notification click routing: changed `router.push` from `/dashboard/prices` to `/dashboard/home` in NotificationPanel | Minor | (this commit) |
| 2026-03-19 | Add per-broadcast title input to AdminBroadcastForm: (1) backend `Broadcast()` signature updated to accept `title` param — empty title falls back to Redis config `broadcastTitle` default, (2) handler accepts optional `title` field in JSON body, (3) title is HTML-stripped and validated (max 200 chars), (4) frontend form adds title input with placeholder and help text, (5) i18n translations added (en+vi), (6) all 6 existing broadcast tests updated and passing | Minor | (this commit) |
| 2026-03-19 | **Admin Price Alert Config UI** — Redis-backed admin configuration for price alerts. Backend: `price_alert_config.go` (config model with defaults/validation/sanitization/Redis load-save), refactored `PriceAlertService` to read config at runtime (thresholds, cooldown, topMoversCount, templates, per-category enable/disable), `AdminService.Broadcast` uses configurable `broadcastTitle`, new `PriceAlertConfigHandler` (GET/PUT `/admin/price-alert-config` with partial merge), 14 unit tests. Frontend: `PriceAlertConfigForm.tsx` (accordion per-category settings), renamed admin "Broadcast" tab to "Notifications" housing both broadcast form and config panel, added `priceDiff` to notification metadata, i18n translations (vi+en). Docs: updated C4 backend/frontend diagrams, added section 9 to flow-cross-cutting.md. | Enhancement | 804287a → a0823de (9 commits) |
| 2026-03-19 | Fix `admin_test.go` mock `Broadcast()` signature: add missing `title` parameter to match updated `AdminService` interface after per-broadcast title feature | Minor | (this commit) |
