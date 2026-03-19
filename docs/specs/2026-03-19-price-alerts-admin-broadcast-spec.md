# Price Fluctuation Alerts & Admin Broadcast Notifications

## Summary

Add a notification system that alerts users when gold or silver prices experience significant fluctuations, and allow admins to broadcast messages to all users. This extends the existing community notification infrastructure (model, SSE stream, NotificationBell/Panel) with two new notification types: `PRICE_ALERT` and `ADMIN_BROADCAST`. Delivery channels include in-app notifications (existing SSE + polling) and Web Push (new service worker integration).

## User Stories

- As a **user**, I want to be notified when gold or silver prices change significantly, so that I can make timely investment decisions.
- As a **user**, I want to receive push notifications even when the app is closed, so that I don't miss important price movements.
- As an **admin**, I want to broadcast messages to all users, so that I can communicate important announcements (maintenance, new features, market alerts).
- As a **user**, I want to see price alerts and admin messages in the same notification bell I already use, so that I have one place for all notifications.

## Functional Requirements

### FR-1: Price Fluctuation Detection

The system monitors gold and silver prices every 15 minutes (aligned with existing price update scheduler) and detects significant movements.

**Detection logic:**
- Compare current price vs. the last-alerted price (NOT the previous check — avoids repeated alerts for gradual drift)
- "Last-alerted price" is stored per asset type in Redis
- On first run (no baseline), store current prices as baseline without alerting

**Threshold configuration (environment variables):**

| Asset Type | Env Variable | Default | Rationale |
|-----------|-------------|---------|-----------|
| Gold VND (SJC) | `PRICE_ALERT_GOLD_VND_PCT` | `2.0` | SJC has 3.75% weekly swings; 2% captures intra-day significance |
| Gold USD (XAU) | `PRICE_ALERT_GOLD_USD_PCT` | `1.5` | World gold moves less than SJC in absolute terms |
| Silver VND | `PRICE_ALERT_SILVER_VND_PCT` | `3.0` | Silver is ~1.5-2x more volatile than gold |
| Silver USD | `PRICE_ALERT_SILVER_USD_PCT` | `2.0` | Same logic, tighter for world prices |

**Anti-spam controls:**
- **Cooldown**: `PRICE_ALERT_COOLDOWN_MINUTES` (default: `120`) — max 1 alert per asset category (gold/silver) per cooldown period
- **Aggregation**: If multiple types within a category (e.g., SJC 1L, SJC 5C, DOJI) all cross threshold, send ONE aggregated alert listing the top movers
- Cooldown timestamps stored in Redis: `price_alert:cooldown:{category}` with TTL

**Acceptance criteria:**
- [ ] Price alert job runs on the existing scheduler interval (15 min)
- [ ] Alerts trigger only when threshold is exceeded vs. last-alerted baseline
- [ ] Cooldown prevents more than 1 alert per category per 2 hours
- [ ] Multiple movers are aggregated into a single notification
- [ ] Baseline prices are initialized on first run without generating alerts
- [ ] All thresholds are configurable via environment variables

### FR-2: Admin Broadcast Notifications

Admins can send a text message to all users.

**API:**
- `POST /api/v1/admin/broadcast` — requires admin auth
- Request: `{ "message": "string (max 500 chars)" }`
- Response: `{ "success": true, "recipientCount": N }`

**Behavior:**
- Creates one `Notification` row per user (batch insert)
- Triggers SSE event to all connected users
- Triggers Web Push to all users with push subscriptions
- Uses a system actor ID (0 or dedicated system user) for `ActorID`

**Acceptance criteria:**
- [ ] Only admins (IsAdmin=true) can send broadcasts
- [ ] Message is validated: non-empty, max 500 characters, sanitized (no HTML/scripts)
- [ ] Notifications are batch-inserted efficiently (not N individual inserts)
- [ ] SSE stream delivers broadcast to all connected users
- [ ] Web Push is sent to all subscribed users
- [ ] Broadcast is visible in NotificationBell/Panel

### FR-3: Web Push Notifications (with iOS-Aware Flow)

Users can opt in to browser push notifications on both mobile and desktop.

**Backend:**
- VAPID key pair generated and stored as environment variables
- `POST /api/v1/push/subscribe` — store push subscription (endpoint, keys)
- `DELETE /api/v1/push/subscribe` — unsubscribe
- `GET /api/v1/push/vapid-key` — return VAPID public key (needed by frontend for subscription)
- New model: `PushSubscription` (user_id, endpoint, p256dh, auth, created_at)
- Push delivery: Use Go `web-push` library to send notifications

**Frontend:**
- Service worker registration (`public/sw.js`)
- Permission prompt (after user interaction, not on page load)
- Subscription management: subscribe on grant, unsubscribe on revoke
- Push event handler in service worker: show notification with title, body, icon, click action

**Mobile Push Support Matrix:**

| Platform | Push Support | Requirement | Notes |
|----------|-------------|-------------|-------|
| Android Chrome/Firefox | Full | None (works in browser and PWA) | `beforeinstallprompt` available |
| iOS Safari 16.4+ | Supported | **Must be installed as PWA** (added to home screen) | `Notification` API only available in standalone mode |
| iOS Safari (not installed) | Not supported | N/A | Apple requires PWA installation for push |
| Desktop Chrome/Edge/Firefox | Full | None | Works in all modern browsers |

**iOS-Aware Push Flow:**

The `PushPermissionBanner` component must detect the user's platform and PWA installation status using the existing `usePWAInstall` hook:

1. **Android / Desktop**: Show push permission banner directly → request `Notification.permission` → subscribe
2. **iOS + PWA installed** (`navigator.standalone === true`): Show push permission banner directly → request `Notification.permission` → subscribe
3. **iOS + NOT installed**: Show a different banner: *"Cài đặt ứng dụng để nhận thông báo giá vàng"* (Install app to receive price notifications) → link to existing `PWAInstallPrompt` flow → after installation, show push permission banner on next visit

**PushPermissionBanner state logic:**
```
if (platform === "ios" && !isInstalled) → show "Install PWA first" banner
else if (Notification.permission === "default") → show "Enable push" banner
else if (Notification.permission === "granted" && !subscribed) → auto-subscribe silently
else if (Notification.permission === "denied") → don't show banner (respect user choice)
else (already subscribed) → don't show banner
```

**Banner dismissal:**
- Dismissible with "Để sau" (Later) — reappears after 7 days (stored in localStorage)
- "Không hiển thị lại" (Don't show again) — permanent dismiss
- Reuse existing `PWA_PROMPT_DISMISSED_KEY` pattern from `PWAInstallPrompt.tsx`

**Acceptance criteria:**
- [ ] Service worker is registered and handles push events
- [ ] Push permission is requested after user interaction (not auto-prompt)
- [ ] Subscription is stored server-side per user
- [ ] Price alerts trigger push notifications
- [ ] Admin broadcasts trigger push notifications
- [ ] Clicking a push notification opens the app to the relevant page
- [ ] Users can unsubscribe (removes server-side subscription)
- [ ] iOS users who haven't installed PWA see "install first" guidance instead of push prompt
- [ ] iOS users who have installed PWA see the standard push permission banner
- [ ] VAPID public key is served via API endpoint (not hardcoded in frontend)

### FR-4: Extend Notification Model & UI

**Backend model changes:**
- Add new `Type` values: `"price_alert"`, `"admin_broadcast"`
- Add nullable `Metadata` field (`jsonb`) for structured data (price change details, broadcast message)
- `PostID` remains nullable (NULL for these new types)
- `ActorID` = 0 for system-generated notifications

**Frontend UI changes:**
- `NotificationItem.tsx` — add rendering for new types:
  - `price_alert`: Show price icon, asset name, change direction (up/down arrow), percentage change
  - `admin_broadcast`: Show megaphone/announcement icon, admin message text
- Both types clickable: price_alert → `/dashboard/prices`, admin_broadcast → no navigation (or optional link in metadata)

**Acceptance criteria:**
- [ ] New notification types render correctly in NotificationPanel
- [ ] Price alert shows asset info, direction, and percentage
- [ ] Admin broadcast shows the admin's message
- [ ] Unread count includes all notification types
- [ ] SSE stream delivers new types to connected clients

## Non-Functional Requirements

- **Performance**: Broadcast to 10,000 users should complete in <30 seconds (batch insert + async push delivery)
- **Reliability**: Push notification delivery is best-effort (no guaranteed delivery — browser may not be reachable)
- **Scalability**: Price alert job processes all price types in <5 seconds per check
- **Security**: Admin broadcast requires admin authentication; push subscriptions are user-scoped
- **Availability**: If push delivery fails, in-app notifications still work (push is supplementary)

## Architecture Changes (C4)

### Diagrams to Update

1. **`c4-component-backend.md`** — Add:
   - `PriceAlertJob` component in Scheduler section
   - `PushService` component in Service layer
   - `PushSubscriptionRepository` in Repository layer
   - Update `NotificationRepository` description to include new types

2. **`c4-component-frontend.md`** — Add:
   - Service Worker component
   - Push subscription management in Settings or NotificationBell area
   - Update NotificationItem description for new types

### New Diagrams

No new L4 code diagram needed — the notification model extension is straightforward and doesn't warrant a separate class diagram.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`flow-cross-cutting.md`** — Add:
   - "Price Alert Detection" sequence diagram showing: Scheduler → GoldPriceService/SilverPriceService → threshold comparison → notification creation → SSE publish → push delivery
   - "Admin Broadcast" sequence diagram showing: Admin → AdminHandler → batch notification insert → SSE publish to all → push delivery

### New Flow Diagrams

No new flow files needed — both flows belong in `flow-cross-cutting.md` as they are cross-cutting concerns (scheduler job + admin action).

## Data Model Changes

### Modified: `notification` table

| Column | Type | Change | Description |
|--------|------|--------|-------------|
| `metadata` | `jsonb` | **NEW** | Structured data for price alerts and broadcasts |

**Note:** `Type` column is already `varchar(20)` — no schema change needed, just new values.

### New: `push_subscription` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `serial` | PK | Auto-increment ID |
| `user_id` | `int32` | FK → user, NOT NULL, indexed | Subscription owner |
| `endpoint` | `text` | NOT NULL, unique | Push service endpoint URL |
| `p256dh` | `text` | NOT NULL | Client public key |
| `auth` | `text` | NOT NULL | Client auth secret |
| `created_at` | `timestamp` | NOT NULL | Subscription creation time |
| `updated_at` | `timestamp` | NOT NULL | Last update |

**Indices:**
- `idx_push_sub_user_id` on `user_id`
- `idx_push_sub_endpoint` unique on `endpoint`

### Metadata JSON Schemas

**Price Alert:**
```json
{
  "category": "gold",
  "movers": [
    { "typeCode": "SJL1L10", "name": "SJC 1L-10L", "changePct": 2.5, "direction": "up", "price": 85000000, "currency": "VND" }
  ],
  "checkTime": 1710800000
}
```

**Admin Broadcast:**
```json
{
  "message": "System maintenance scheduled for tonight at 11 PM",
  "adminId": 1,
  "adminName": "Admin"
}
```

## API Changes

### New Proto Definitions (in `community.proto` or new `notification.proto`)

Since we're extending the existing notification system, add to `community.proto`:

```protobuf
// New message for admin broadcast
message AdminBroadcastRequest {
  string message = 1; // Max 500 chars
}

message AdminBroadcastResponse {
  bool success = 1;
  int32 recipient_count = 2;
}
```

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/admin/broadcast` | Admin | Send broadcast to all users |
| `GET` | `/api/v1/push/vapid-key` | User | Get VAPID public key for push subscription |
| `POST` | `/api/v1/push/subscribe` | User | Register push subscription |
| `DELETE` | `/api/v1/push/subscribe` | User | Remove push subscription |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/v1/community/notifications` | Returns new types (price_alert, admin_broadcast) with metadata |
| `GET` | `/api/v1/community/notifications/stream` | SSE stream includes new event types |

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Notification bell with badge | `NotificationBell` | `components/notifications/NotificationBell.tsx` |
| Notification dropdown list | `NotificationPanel` | `components/notifications/NotificationPanel.tsx` |
| Individual notification row | `NotificationItem` | `components/notifications/NotificationItem.tsx` |
| Toast for real-time alerts | `Toast` via `useNotification()` | `contexts/NotificationContext.tsx` |
| SSE hook | `useNotificationStream` | `features/community/hooks/useNotificationStream.ts` |
| Unread count hook | `useNotificationCount` | `features/community/hooks/` |
| Admin layout/routes | Admin routes under `/api/v1/admin/` | `handlers/routes.go` |
| SVG icons | Icon library | `components/icons/` |
| Form input | `FormInput` | `components/forms/FormInput.tsx` |
| Button | `Button` | `components/Button.tsx` |
| Modal | `BaseModal` | `components/modals/BaseModal.tsx` |
| Loading spinner | `LoadingSpinner` | `components/loading/` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `PriceAlertNotification` | Inline in `NotificationItem.tsx` (conditional render) | Not a separate component — just a new branch in the notification type switch |
| `AdminBroadcastNotification` | Inline in `NotificationItem.tsx` (conditional render) | Same as above |
| `AdminBroadcastForm` | `features/admin/components/AdminBroadcastForm.tsx` | New admin feature, belongs in admin feature module |
| `PushPermissionBanner` | `components/notifications/PushPermissionBanner.tsx` | Shared component — shown across dashboard pages; iOS-aware (detects PWA install status via `usePWAInstall` hook) |
| `usePushSubscription` | `features/community/hooks/usePushSubscription.ts` | Hook for push subscription management (subscribe, unsubscribe, check status) |
| Service Worker (`sw.js`) | `public/sw.js` | Required for Web Push API |

### UI Mockups

**Price Alert in NotificationPanel:**
```
┌─────────────────────────────────────────────┐
│ 📈 Giá vàng biến động mạnh                  │
│ SJC 1L-10L tăng 2.5% (85,000,000₫/lượng)  │
│ 5 phút trước                        ● (dot) │
├─────────────────────────────────────────────┤
│ 📢 Thông báo từ hệ thống                    │
│ Bảo trì hệ thống lúc 23:00 tối nay         │
│ 2 giờ trước                                  │
└─────────────────────────────────────────────┘
```

**Push Permission Banner — Android/Desktop/iOS-installed (shown once after login, dismissible):**
```
┌─────────────────────────────────────────────┐
│ 🔔 Bật thông báo để nhận cảnh báo giá vàng │
│ và bạc ngay trên điện thoại                  │
│                           [Bật] [Để sau]     │
└─────────────────────────────────────────────┘
```

**Push Install-First Banner — iOS NOT installed (shown instead of push prompt):**
```
┌─────────────────────────────────────────────┐
│ 📲 Cài đặt ứng dụng để nhận thông báo      │
│ giá vàng và bạc ngay trên iPhone             │
│                    [Cài đặt ngay] [Để sau]   │
└─────────────────────────────────────────────┘
```
*Tapping "Cài đặt ngay" opens the existing PWAInstallPrompt with iOS installation steps.*

**Admin Broadcast Form (admin panel):**
```
┌─────────────────────────────────────────────┐
│ Gửi thông báo đến tất cả người dùng        │
│                                               │
│ ┌─────────────────────────────────────────┐ │
│ │ Nhập nội dung thông báo...              │ │
│ │                                          │ │
│ │                                          │ │
│ └─────────────────────────────────────────┘ │
│ 0/500 ký tự                                  │
│                                [Gửi thông báo]│
└─────────────────────────────────────────────┘
```

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Scheduler (PriceAlertJob) | Gold/silver prices | No (same process) | PriceAlertService | Internal — prices from cached service |
| 2 | PriceAlertService | Notification records | Yes: App → DB | PostgreSQL | Batch insert, parameterized |
| 3 | PriceAlertService | SSE event payload | Yes: App → Client | User browser via SSE | Contains price data |
| 4 | PriceAlertService | Push payload | Yes: App → Push Service | Browser push service (FCM/APNS) | Contains notification body |
| 5 | Admin (browser) | Broadcast message | Yes: Internet → App | AdminHandler | Untrusted input from admin |
| 6 | AdminHandler | Sanitized message | Yes: App → DB | PostgreSQL | After validation |
| 7 | AdminHandler | SSE event + push payload | Yes: App → Client | All user browsers | Broadcast delivery |
| 8 | User (browser) | Push subscription keys | Yes: Internet → App | PushHandler | Contains endpoint + crypto keys |
| 9 | PushHandler | Subscription data | Yes: App → DB | PostgreSQL | Store subscription |
| 10 | Service Worker | Push event | Yes: Push Service → Client | Browser notification | Handled by browser |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin broadcast request (#5) | JWT + AdminMiddleware + input validation |
| Internet → App | Push subscription (#8) | JWT + input validation |
| App → DB | Notification inserts (#2, #6, #9) | Parameterized queries (GORM), ownership check |
| App → Push Service | Push delivery (#4, #7) | VAPID authentication, HTTPS |
| App → Client (SSE) | Event payloads (#3, #7) | JWT auth on SSE connection |
| Push Service → Client | Push events (#10) | Encrypted by browser (Web Push protocol) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 5 | Internet → App | Spoofing | Non-admin sends broadcast | High | AdminMiddleware enforces `is_admin=true` |
| T-2 | 5 | Internet → App | Tampering | XSS in broadcast message | High | Server-side sanitize: strip HTML, escape special chars |
| T-3 | 5 | Internet → App | DoS | Rapid broadcast spam | Medium | Rate limit: max 10 broadcasts per hour per admin |
| T-4 | 8 | Internet → App | Tampering | Malicious push endpoint URL | Medium | Validate URL scheme (https only), max length |
| T-5 | 8 | Internet → App | DoS | Registering many subscriptions | Low | Limit 5 subscriptions per user (multi-device) |
| T-6 | 3, 7 | App → Client | Info Disclosure | Price data in SSE/push | Low | Price data is public; no sensitive info in payload |
| T-7 | 4, 7 | App → Push Service | Spoofing | Forged VAPID | Low | Use proper VAPID key management |
| T-8 | 2 | App → DB | DoS | Mass notification insert for 10K+ users | Medium | Batch insert with transaction, async processing |
| T-9 | 9 | App → DB | Info Disclosure | Subscription endpoint URLs leaked | Low | Don't expose subscription data in any API response |

### Authorization Rules

| Operation | Owner | Other User | Admin | Unauthenticated |
|-----------|-------|------------|-------|-----------------|
| Subscribe to push | Yes | No | Yes (as user) | No |
| Unsubscribe from push | Yes | No | No | No |
| Receive price alerts | All authenticated users | — | — | No |
| Receive admin broadcasts | All authenticated users | — | — | No |
| Send admin broadcast | No | No | Yes | No |
| View notifications | Own only | No | Own only | No |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| Broadcast message | string | Non-empty, max 500 chars, no HTML | Required — strip tags, escape, length check |
| Push endpoint | string | Valid HTTPS URL, max 2048 chars | Required — URL parse, scheme check |
| Push p256dh | string | Base64-encoded, max 256 chars | Required — base64 validation |
| Push auth | string | Base64-encoded, max 256 chars | Required — base64 validation |

### External Dependency Risks

| Service | Risk | Impact | Mitigation |
|---------|------|--------|------------|
| Browser Push Services (FCM/APNS) | Delivery failure, rate limits | Push not received | In-app notifications as primary; push is supplementary |
| Go `web-push` library | New dependency | Supply chain | Use well-maintained `github.com/SherClockHolmes/webpush-go` (3K+ stars, active) |
| vang.today / Yahoo Finance | Price API failure | No price data to compare | Skip alert check if prices unavailable; use stale cache |

### Sensitive Data Handling

| Data | Sensitivity | Protection |
|------|------------|------------|
| Push subscription endpoint | Internal | Store in DB, never expose via API |
| Push p256dh / auth keys | Confidential | Store encrypted at rest (DB encryption), transmit over TLS |
| VAPID private key | Restricted | Environment variable only, never in code |
| Admin broadcast content | Internal | Sanitized before storage and display |

### Issues & Risks Summary

1. **Push subscription endpoint URLs could be used for fingerprinting** — mitigate by not exposing in any API response
2. **Mass notification insert for large user bases** — use batch insert with configurable batch size
3. **Admin broadcast abuse** — rate limit broadcasts per admin per hour
4. **Price alert false positives** — use last-alerted baseline (not last-checked) to avoid drift alerts
5. **Service worker caching conflicts** — service worker must be minimal (push only), not interfere with Next.js routing

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| No gold/silver prices available (API down) | Skip price alert check for that cycle; log warning |
| All users have push disabled | Still create in-app notifications; skip push delivery |
| Push endpoint returns 410 (Gone) | Remove subscription from DB (user unsubscribed via browser) |
| Push endpoint returns 429 (Rate Limited) | Retry with exponential backoff (max 3 retries) |
| Admin sends empty/whitespace message | Reject with 400 validation error |
| Admin sends message with HTML/script tags | Strip all HTML tags server-side before storage |
| User has multiple push subscriptions (multi-device) | Send push to all active subscriptions (max 5) |
| Scheduler runs while broadcast is in progress | No conflict — different notification types, no shared state |
| First price alert job run (no baseline) | Store current prices as baseline, do not alert |
| Price drops to 0 or negative (API error) | Ignore price if <= 0; log error |
| iOS user not installed PWA requests push | Show "Install app first" banner linking to PWAInstallPrompt; do not call Notification API (not available) |
| iOS user installs PWA then opens app | Show push permission banner on first visit after installation (detect `navigator.standalone === true`) |
| User revokes push permission in browser settings | `Notification.permission === "denied"`; don't show banner, don't attempt re-subscribe |
| Service worker update conflicts with Next.js | Service worker is minimal (push-only, no caching); uses `skipWaiting()` + `clients.claim()` to avoid stale SW |

## Dependencies & Assumptions

**Dependencies:**
- Existing community notification system (model, repository, SSE, UI components)
- Existing gold/silver price services
- Existing admin middleware and auth system
- Existing scheduler framework

**Assumptions:**
- User base is <100K users (batch insert + push delivery can be synchronous within the scheduler job)
- Browser push notification support is available in target browsers (Chrome, Edge, Safari 16.4+, Firefox)
- iOS push requires PWA to be installed to home screen (Apple restriction since Safari 16.4) — the app already has PWA install flow
- VAPID keys are generated once and stored as environment variables
- No email notifications (future enhancement if needed)

**New Dependencies:**
- `github.com/SherClockHolmes/webpush-go` — Go Web Push library (MIT license, actively maintained)

## Out of Scope

- User-defined custom alert thresholds (users set their own %)
- Per-user notification preferences (enable/disable categories)
- Email notification delivery
- Targeted admin broadcasts (send to specific user groups)
- Scheduled broadcasts (send at a future time)
- Notification history page (separate from the dropdown panel)
- Rich push notifications with images
- In-app notification sound effects
