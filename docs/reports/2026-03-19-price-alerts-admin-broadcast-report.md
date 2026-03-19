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
       ├─► GoldPriceService / SilverPriceService (price fetch)
       ├─► Redis (baselines, cooldowns)
       ├─► NotificationRepository.BatchCreate (DB persist)
       ├─► Redis PUBLISH user:{id}:notifications (SSE delivery)
       └─► PushService.SendToAll (Web Push delivery)

AdminBroadcastHandler (POST /api/v1/admin/broadcast)
  └─► AdminService.Broadcast
       ├─► Validation (500 char max, HTML strip)
       ├─► Rate limiting (10/hr/admin via Redis INCR)
       ├─► UserRepository.GetAllUserIDs
       ├─► NotificationRepository.BatchCreate
       ├─► Redis PUBLISH (SSE)
       └─► PushService.SendToAll (Web Push)

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

Admin Page → Broadcast Tab
  └─► AdminBroadcastForm (textarea, char counter, API call)
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
| XSS prevention | HTML tags stripped from broadcast messages | Yes — regex in admin_service |

## New Backend Files

| File | Purpose |
|------|---------|
| `domain/models/push_subscription.go` | PushSubscription model (user_id, endpoint, p256dh, auth) |
| `domain/repository/push_subscription_repository.go` | Full CRUD for push subscriptions |
| `domain/service/push_service.go` | Web Push delivery with webpush-go (20-worker semaphore) |
| `domain/service/price_alert_service.go` | Price fluctuation detection (4 categories, Redis baselines) |
| `handlers/admin_broadcast.go` | POST /api/v1/admin/broadcast handler |
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

## Modified Backend Files

| File | Changes |
|------|---------|
| `domain/models/notification.go` | Added `Metadata datatypes.JSON` field |
| `domain/repository/interfaces.go` | Added `BatchCreate`, `GetAllUserIDs`, `PushSubscriptionRepository` |
| `domain/repository/notification_repository.go` | Implemented `BatchCreate` |
| `domain/repository/user_repository.go` | Implemented `GetAllUserIDs` |
| `domain/service/interfaces.go` | Added `PushService`, `PriceAlertService` interfaces, `Broadcast` to `AdminService` |
| `domain/service/admin_service.go` | Added broadcast implementation with rate limiting + HTML stripping |
| `domain/service/community_service.go` | Added metadata serialization for notifications |
| `domain/service/services.go` | Added `Push` to Services, `PushSubscription` to Repositories |
| `handlers/builder.go` | Wired `AdminBroadcast` and `Push` handlers |
| `handlers/routes.go` | Added admin broadcast and push routes |
| `internal/app/providers.go` | Added `PushSubscription` repo, `PriceAlertJob` to scheduler |
| `api/protobuf/v1/community.proto` | Added `metadata` field + broadcast/push messages |

## Modified Frontend Files

| File | Changes |
|------|---------|
| `components/notifications/NotificationItem.tsx` | Added price_alert + admin_broadcast rendering branches |
| `components/notifications/NotificationPanel.tsx` | Updated click routing for new notification types |
| `features/community/hooks/useNotificationStream.ts` | Added metadata + actorId=0 handling in SSE |
| `app/[locale]/dashboard/admin/page.tsx` | Added broadcast tab |
| `app/[locale]/dashboard/layout.tsx` | Added PushPermissionBanner |
| `messages/en/admin.json` | Added broadcast translations |
| `messages/vi/admin.json` | Added broadcast translations |

## Documentation Updated

| File | Changes |
|------|---------|
| `docs/architecture/flow-cross-cutting.md` | Added Price Alert Detection + Admin Broadcast sequence diagrams, updated scheduler job table |
| `Taskfile.yml` | Added `backend:migrate-price-alerts` task |

## Build Verification

| Check | Result |
|-------|--------|
| `go build ./...` | Pass |
| `npx tsc --noEmit` | Pass |
| Working tree | Clean |

## Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | — | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | — | VAPID private key (secret) |
| `VAPID_CONTACT` | — | Contact email for VAPID |
| `PRICE_ALERT_THRESHOLD_GOLD_VND` | `2.0` | Gold VND % threshold |
| `PRICE_ALERT_THRESHOLD_GOLD_USD` | `1.5` | Gold USD % threshold |
| `PRICE_ALERT_THRESHOLD_SILVER_VND` | `3.0` | Silver VND % threshold |
| `PRICE_ALERT_THRESHOLD_SILVER_USD` | `2.0` | Silver USD % threshold |
| `PRICE_ALERT_COOLDOWN_MINUTES` | `120` | Cooldown between alerts per category |
| `PRICE_ALERT_TOP_MOVERS` | `3` | Max movers shown in alert |

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
2. Navigate to `/dashboard/admin?tab=broadcast`
3. Type a message (max 500 chars), click "Gửi thông báo"
4. All users should see a blue notification in their notification panel
5. Verify rate limit: after 10 broadcasts in 1 hour, the 11th should fail

### Web Push
1. Visit any dashboard page — PushPermissionBanner should appear (if not dismissed)
2. Click "Bật" to enable push notifications
3. Browser permission dialog should appear
4. After granting, service worker registers and subscription is sent to server
5. When offline or in background, push notifications should appear for new alerts/broadcasts

## Known Issues / Technical Debt

1. **C4 architecture diagrams** (Task 0) deferred — should update `c4-component-backend.md` and `c4-component-frontend.md` with new services and components
2. **Unit tests** not written for new services (PriceAlertService, PushService, AdminService.Broadcast) — should be added as follow-up
3. **E2E tests** not updated for new admin broadcast tab — should extend `admin-flow.spec.ts`
4. **VAPID key rotation** not implemented — keys are static once set
5. **Push subscription cleanup** for expired/invalid subscriptions happens only on 410 responses during send — no periodic cleanup job
