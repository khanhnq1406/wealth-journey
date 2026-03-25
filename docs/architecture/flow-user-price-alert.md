# User Price Alert Domain — Runtime Flows

Price alert lifecycle flows: create an alert, background evaluation against live market prices, notification delivery over SSE, and alert management from the settings page. All endpoints require JWT authentication and scope data to `user_id` extracted from the token.

## Table of Contents

- [Create Alert (User → API → DB)](#1-create-alert-user--api--db)
- [Background Evaluation (Scheduler → Notifications)](#2-background-evaluation-scheduler--notifications)
- [Alert Triggered → User Sees Notification](#3-alert-triggered--user-sees-notification)
- [Alert Management (Settings Page)](#4-alert-management-settings-page)

---

## 1. Create Alert (User → API → DB)

**Trigger:** User fills CreatePriceAlertForm and submits
**Endpoint:** `POST /api/v1/price-alerts`
**Source:** `domain/service/user_price_alert_service.go`, `handlers/user_price_alert.go`

```mermaid
sequenceDiagram
    participant Browser as User (Browser)
    participant SPA as Next.js SPA
    participant H as PriceAlertHandler
    participant AS as UserPriceAlertService
    participant AR as PriceAlertRepository

    Browser->>SPA: Fill CreatePriceAlertForm<br/>{symbol, direction, targetPrice, currency,<br/>mode: once|repeat, cooldownHours?}
    SPA->>H: POST /api/v1/price-alerts<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx) [from JWT]
    alt No/invalid JWT
        H-->>SPA: 401 Unauthorized
    end
    H->>H: BindAndValidate(req)
    alt Validation error (missing symbol, invalid direction/price)
        H-->>SPA: 400 Bad Request
    end
    H->>AS: CreateAlert(userID, req)

    activate AS
    AS->>AS: Validate symbol (non-empty, trimmed)
    AS->>AS: Validate direction (above|below)
    AS->>AS: Validate targetPrice > 0
    AS->>AS: Validate currency (ISO 4217)

    AS->>AR: CountActiveByUserID(userID)
    AR-->>AS: count
    alt count >= 30
        AS-->>H: 400 Validation Error<br/>"maximum of 30 alerts per user reached"
        H-->>SPA: {success: false, message: "..."}
    end

    AS->>AR: Create(PriceAlert{userID, symbol, direction,<br/>targetPrice, currency, mode,<br/>cooldownHours, status: active})
    AR-->>AS: Alert created
    deactivate AS

    AS-->>H: CreateAlertResponse{alert}
    H-->>SPA: 201 Created<br/>{success: true, alert: {...}, timestamp}
    Note over SPA: useMutationCreateUserPriceAlert<br/>→ invalidates ListPriceAlerts cache<br/>→ shows Success component
```

### Validation Rules

| Field | Rule | Error |
|-------|------|-------|
| `symbol` | Non-empty, trimmed, ≤ 50 chars | 400 |
| `direction` | `above` or `below` | 400 |
| `targetPrice` | > 0, stored as int64 smallest unit | 400 |
| `currency` | Valid ISO 4217 code | 400 |
| `mode` | `once` or `repeat` | 400 |
| `cooldownHours` | > 0 when mode=`repeat` | 400 |
| Alert count | ≤ 30 active alerts per user | 400 |

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Invalid/missing JWT | 401 Unauthorized | None |
| Validation failure | 400 Bad Request | None |
| Alert limit reached (≥ 30) | 400 Validation Error | None |
| DB insert fails | 500 Internal Error | None |

---

## 2. Background Evaluation (Scheduler → Notifications)

**Trigger:** Scheduled job every 15 minutes (45-second startup delay)
**Source:** `internal/scheduler/user_price_alert_job.go`, `domain/service/user_price_alert_service.go`

```mermaid
sequenceDiagram
    participant SCH as Scheduler
    participant JOB as UserPriceAlertJob
    participant AS as UserPriceAlertService
    participant AR as PriceAlertRepository
    participant GPS as GoldPriceService
    participant SPS as SilverPriceService
    participant US as UserService
    participant R as Redis
    participant NR as NotificationRepository
    participant PS as PushService
    participant SSE as SSE Channel

    Note over SCH: Every 15 min (startup delay: 45s)
    SCH->>JOB: Run()
    JOB->>AS: EvaluateAlerts(ctx)

    activate AS
    AS->>AR: ListActive()
    AR-->>AS: []PriceAlert (status=active)

    Note over AS: Group alerts by symbol for batched price fetch
    AS->>AS: Group into goldAlerts, silverAlerts, marketAlerts

    par Parallel price fetch (sync.WaitGroup)
        alt len(goldAlerts) > 0
            AS->>GPS: FetchAllPrices(ctx)
            GPS->>R: GET gold_prices
            alt Cache hit
                R-->>GPS: []CachedGoldPrice
            else Cache miss
                GPS->>GPS: Fetch from vang.today API
                GPS->>R: SET gold_prices (15m TTL)
            end
            GPS-->>AS: []CachedGoldPrice {TypeCode, Buy, Sell}
            AS->>AS: Build priceMap[symbol] = buyPrice
        end
        alt len(silverAlerts) > 0
            AS->>SPS: FetchAllPrices(ctx)
            SPS->>R: GET silver_prices
            alt Cache hit
                R-->>SPS: []CachedSilverPrice
            else Cache miss
                SPS->>SPS: Fetch from vang.today API
                SPS->>R: SET silver_prices (15m TTL)
            end
            SPS-->>AS: []CachedSilverPrice {TypeCode, Buy, Sell}
            AS->>AS: Build priceMap[symbol] = buyPrice
        end
        loop Each unique symbol in marketAlerts
            AS->>US: GetMarketPrice(ctx, symbol, currency)
            US->>R: GET market_data:{symbol}
            alt Cache hit
                R-->>US: MarketData
            else Cache miss
                US->>US: Yahoo Finance API
                US->>R: SET market_data:{symbol} (15m TTL)
            end
            US-->>AS: currentPrice (int64, smallest unit)
            AS->>AS: priceMap[symbol] = currentPrice
        end
    end

    loop For each alert
        AS->>AS: currentPrice = priceMap[alert.Symbol]
        alt Price not available
            AS->>AS: skip alert (log warning)
        end

        Note over AS: Check trigger condition
        alt direction = "above"
            AS->>AS: triggered = currentPrice >= targetPrice
        else direction = "below"
            AS->>AS: triggered = currentPrice <= targetPrice
        end

        alt Not triggered
            AS->>AS: skip alert
        end

        Note over AS: Check Redis cooldown (repeat-mode only)
        AS->>R: GET user_price_alert:cooldown:{alertID}
        alt Cooldown key exists
            R-->>AS: TTL remaining
            AS->>AS: skip alert (in cooldown)
        end

        Note over AS: Check daily notification cap
        AS->>R: GET user_price_alert:daily:{userID}
        alt dailyCount >= 100
            R-->>AS: count >= 100
            AS->>AS: skip alert (daily cap reached)
        end

        Note over AS: All checks passed — fire notification
        AS->>NR: Create(Notification{userID, type: user_price_alert,<br/>symbol, direction, targetPrice,<br/>currentPrice, currency})
        NR-->>AS: Notification created

        AS->>SSE: Publish event to user:{userID}:notifications<br/>{notificationID, type, payload}
        Note over SSE: Any open browser tab receives event immediately

        AS->>PS: SendToUser(userID, title, body)<br/>Note: symbol name truncated to 30 chars
        Note over PS: Sends web push notification<br/>if user has push subscription

        alt alert.Mode = "once"
            AS->>AR: UpdateStatus(alertID, status: triggered)
            Note over AR: Alert will not be evaluated again
        else alert.Mode = "repeat"
            AS->>AR: UpdateStatus(alertID, status: active)
            Note over AS: Status stays active
            AS->>R: SET user_price_alert:cooldown:{alertID} ""<br/>TTL = alert.CooldownHours × 3600s
        end

        Note over AS: Increment daily counter
        AS->>R: INCR user_price_alert:daily:{userID}
        AS->>R: EXPIRE user_price_alert:daily:{userID} 86400
        Note over R: Key expires after 24h rolling window
    end

    deactivate AS
    JOB-->>SCH: Job complete
```

### Redis Key Reference

| Key | Value | TTL | Purpose |
|-----|-------|-----|---------|
| `user_price_alert:cooldown:{alertID}` | `""` (empty) | `cooldownHours × 3600s` | Prevent repeat-mode re-fire during cooldown |
| `user_price_alert:daily:{userID}` | integer count | 24 hours | Daily notification cap per user |

### Price Sources by Alert Type

| Symbol / Type | Price Source | Cache |
|---------------|-------------|-------|
| Gold type codes (GOLD_VND) | GoldPriceService → vang.today | Redis `gold_prices`, 15m TTL |
| Silver type codes (SILVER_VND) | SilverPriceService → vang.today | Redis `silver_prices`, 15m TTL |
| All other symbols (stocks, ETFs, crypto) | UserService.GetMarketPrice → Yahoo Finance | Redis `market_data:{symbol}`, 15m TTL |

### Alert Mode Behavior

| Mode | After Trigger | Redis Effect |
|------|--------------|--------------|
| `once` | `status = triggered` — never evaluated again | None |
| `repeat` | `status = active` — re-evaluated after cooldown | Cooldown key set with TTL |

### Key Invariants

- Startup delay of 45 seconds prevents evaluation before all services are ready
- Prices are fetched once per symbol per job run, shared across all alerts for that symbol
- Daily cap of 100 notifications per user per 24-hour rolling window
- Once-mode alerts are permanently deactivated after their first trigger
- Repeat-mode alerts reuse the same cooldown TTL from `alert.CooldownHours` (set at creation)
- A missing price (API failure, no cache) causes the alert to be skipped silently — no notification, no status change

---

## 3. Alert Triggered → User Sees Notification

**Trigger:** SSE event received in browser after background evaluation fires an alert
**Source:** `contexts/NotificationContext.tsx`, `components/feedback/NotificationPanel.tsx`

```mermaid
sequenceDiagram
    participant SSE as SSE Connection<br/>(EventSource)
    participant NC as NotificationContext
    participant Bell as Notification Bell (header)
    participant NP as NotificationPanel
    participant NI as NotificationItem
    participant Router as Next.js Router

    Note over SSE: Background job fired alert (Flow 2)
    SSE->>NC: message event on channel<br/>user:{userID}:notifications
    Note over NC: Payload: {notificationID, type: user_price_alert,<br/>symbol, direction, targetPrice,<br/>currentPrice, currency, timestamp}

    NC->>NC: unreadCount += 1
    NC->>Bell: Re-render — badge shows new count

    Note over Bell: User sees notification badge
    Bell->>NP: User clicks bell icon
    NP->>NP: Open panel (isOpen = true)
    NP->>NP: Fetch notifications via<br/>useQueryListNotifications({unread: false})

    Note over NP: Panel renders notification list
    NP->>NI: Render user_price_alert notification
    Note over NI: Display:<br/>• Symbol (e.g. "VCB")<br/>• Direction badge ("above" / "below")<br/>• Target price formatted with currency<br/>• Current price at trigger time<br/>• Relative timestamp

    NP->>NC: markAsRead(notificationID)
    NC->>NC: unreadCount -= 1
    Bell->>Bell: Badge updates (or disappears if 0)

    alt User clicks notification row
        NI->>Router: push("/dashboard/settings/alerts")
        Note over Router: Navigate to Alert Management page<br/>(Flow 4)
    end
```

### NotificationItem Fields for user_price_alert

| Field | Source | Display Example |
|-------|--------|----------------|
| `symbol` | Alert record | `VCB` |
| `direction` | Alert record | `above` → "rose above" |
| `targetPrice` | Alert record (int64) | `₫95,000` |
| `currentPrice` | Price at trigger time | `₫95,200` |
| `currency` | Alert record | `VND` |
| `timestamp` | Notification created_at | "2 minutes ago" |

### Key Invariants

- SSE connection is per-user, scoped to `user:{userID}:notifications` channel
- NotificationContext maintains a global unread count — no page reload needed
- Clicking a notification navigates to `/dashboard/settings/alerts` where the triggered alert can be reviewed or deleted
- Push notification (via PushService) arrives independently of SSE — both paths lead to the same notification record in DB

---

## 4. Alert Management (Settings Page)

**Trigger:** User navigates to `/dashboard/settings/alerts`
**Endpoint:** `GET /api/v1/price-alerts`, `PUT /api/v1/price-alerts/{id}`, `DELETE /api/v1/price-alerts/{id}`
**Source:** `domain/service/user_price_alert_service.go`, `handlers/user_price_alert.go`

```mermaid
sequenceDiagram
    participant Browser as User (Browser)
    participant Page as Settings/Alerts Page
    participant PAL as PriceAlertList
    participant H as PriceAlertHandler
    participant AS as UserPriceAlertService
    participant AR as PriceAlertRepository
    participant CD as ConfirmationDialog

    Browser->>Page: Navigate to /dashboard/settings/alerts
    Page->>PAL: Render PriceAlertList

    PAL->>H: GET /api/v1/price-alerts<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>AS: ListAlerts(userID)
    activate AS
    AS->>AR: ListByUserID(userID)
    AR-->>AS: []PriceAlert (all statuses)
    deactivate AS
    H-->>PAL: 200 OK {success: true, alerts: [...], timestamp}
    Note over PAL: Renders table:<br/>symbol · direction · target · status · mode · actions

    Note over PAL,H: Toggle active ↔ paused
    Browser->>PAL: User clicks toggle on alert row
    PAL->>H: PUT /api/v1/price-alerts/{id}<br/>{status: "paused"}<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>H: parseIDParam("id")
    H->>AS: UpdateAlert(userID, alertID, req)
    activate AS
    AS->>AR: GetByIDForUser(alertID, userID)
    alt Alert not found or wrong owner
        AR-->>AS: NotFoundError
        AS-->>H: 404 Not Found
        H-->>PAL: {success: false, message: "..."}
    end
    AS->>AR: Update(PriceAlert{status: "paused"})
    AR-->>AS: nil
    deactivate AS
    H-->>PAL: 200 OK {success: true, alert: {...}, timestamp}
    Note over PAL: useMutationUpdateUserPriceAlert<br/>→ invalidates ListPriceAlerts cache<br/>→ row re-renders with new status

    Note over PAL,H: Delete alert
    Browser->>PAL: User clicks delete icon on alert row
    PAL->>CD: Open ConfirmationDialog<br/>"Delete this alert?"
    Browser->>CD: User confirms
    CD->>PAL: onConfirm callback
    PAL->>H: DELETE /api/v1/price-alerts/{id}<br/>Headers: Authorization: Bearer {jwt}
    H->>H: GetUserID(ctx)
    H->>H: parseIDParam("id")
    H->>AS: DeleteAlert(userID, alertID)
    activate AS
    AS->>AR: GetByIDForUser(alertID, userID)
    alt Alert not found or wrong owner
        AR-->>AS: NotFoundError
        AS-->>H: 404 Not Found
        H-->>PAL: {success: false, message: "..."}
    end
    AS->>AR: Delete(alertID)
    Note over AR: Soft delete: UPDATE SET deleted_at = NOW()
    AR-->>AS: nil
    deactivate AS
    H-->>PAL: 200 OK {success: true, timestamp}
    Note over PAL: useMutationDeleteUserPriceAlert<br/>→ invalidates ListPriceAlerts cache<br/>→ alert row removed from list
```

### Alert Status Transitions

```
active ──[triggered, mode=once]──► triggered  (terminal, not evaluated)
active ──[user toggle]────────────► paused     (excluded from evaluation)
active ──[evaluation fired, mode=repeat]──► active  (stays active, cooldown set)
paused ──[user toggle]────────────► active     (re-enters evaluation)
triggered ──[user deletes]────────► (soft deleted)
```

### Key Invariants

- `GetByIDForUser` ownership check is enforced on every write (update, delete) — a user cannot mutate another user's alerts
- Soft deletes preserve audit history — alerts are not physically removed from DB
- Paused alerts are excluded from background evaluation in `ListActive()` which filters `status = active`
- Toggling `active → paused` immediately prevents the next scheduler run from evaluating that alert
- React Query cache invalidation (`ListPriceAlerts` query key) after every mutation ensures the list reflects the latest server state without a page reload

### Error Paths

| Condition | Response | User Feedback |
|-----------|----------|---------------|
| 401 Unauthorized | 401 | Redirect to login |
| Alert not found or wrong owner | 404 | Inline error message |
| Toggle update DB failure | 500 | Error state on row |
| Delete DB failure | 500 | Error state on row |
| Dismiss ConfirmationDialog | No request sent | Dialog closes, alert unchanged |
