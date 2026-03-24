# User Price Alerts Specification

## Summary

Allow users to create custom price alerts for any searchable asset (stocks, crypto, ETFs, gold types, silver types). Users define a target price and direction (above/below), and the system checks prices every 15 minutes via a dedicated background job. When a condition is met, the user receives an in-app notification and a web push notification. Alerts can be one-shot (auto-deactivate after triggering) or repeating (with a minimum 2-hour cooldown). For gold/silver assets, users can choose whether to monitor the buy or sell price. Users create alerts from the Prices page and Portfolio page, and manage them in a new Settings sub-page.

## User Stories

- As a user, I want to set a price alert on any symbol so that I'm notified when it reaches my target price without constantly checking.
- As a user, I want to set alerts on gold/silver buy or sell prices so that I can monitor the specific price side relevant to my intent (buying vs selling).
- As a user, I want to choose between one-shot and repeating alerts so that I control notification frequency.
- As a user, I want to manage (view, edit, delete) all my alerts in one place so that I have full control.
- As a user, I want to create alerts quickly from the Prices page and Portfolio page so that I don't have to navigate elsewhere.

## Functional Requirements

### FR-1: Create Price Alert

The form uses a **3-step progressive disclosure** pattern (similar to AddInvestmentForm):

**Step 1: Choose asset category** — Toggle buttons: Gold | Silver | Other Assets
- This determines the rest of the form's behavior

**Step 2: Select symbol** — Depends on category:
- **Gold**: Gold type dropdown using `BasicFormSelect` — reuses the same `goldTypeOptions` from `features/investment/utils/gold-calculator.ts` (VND types only: SJC, Nhẫn SJC 9999, Nhẫn Doji 9999, SJC Mi Hồng, Nhẫn Mi Hồng 9999, SJC BTMC, Nhẫn BTMC, PNJ). Currency is always VND. After selection, shows unit & currency info below (same pattern as AddInvestmentForm).
- **Silver**: Silver type dropdown using `BasicFormSelect` — reuses the same `silverTypeOptions` from `features/investment/utils/silver-calculator.ts` (VND types only: Phú Quý thỏi, Ancarat Ngân Long, SBJ, DOJI, etc.). Currency is always VND. After selection, shows unit info below.
- **Other Assets**: SymbolAutocomplete free-text search (stocks, crypto, ETFs, etc.). Currency auto-determined from symbol.

**Step 3: Configure alert** — Same for all categories:
- **Price side** — For gold/silver only: "buy" or "sell" (default: "buy"). Hidden for other assets.
- **Direction** — "above" or "below" the target price
- **Target price** — Manual input (int64, smallest currency unit). Shows current buy and sell prices (for gold/silver) or current market price (for other assets) as reference.
- **Trigger mode** — One-shot or repeating
- **Cooldown hours** — For repeating only: minimum 2 hours, default 4 hours, max 168 hours (7 days)
- **Note** (optional) — Short user note (max 200 chars), e.g., "buy if drops to this level"

The asset type, currency, symbol, and name are auto-determined from the user's category + symbol selection.

**Acceptance criteria:**
- [ ] Asset category toggle (Gold / Silver / Other Assets) is the first form field
- [ ] Gold category: shows gold type dropdown only, currency fixed to VND (reuses gold type options from AddInvestmentForm, VND types only)
- [ ] Silver category: shows silver type dropdown only, currency fixed to VND (reuses silver type options from AddInvestmentForm, VND types only)
- [ ] Other Assets category: shows SymbolAutocomplete input (reuses existing component)
- [ ] Gold/silver alerts show buy/sell price side selector
- [ ] Other asset alerts do not show price side selector
- [ ] Current price(s) shown as reference below target price input (buy + sell for gold/silver, market price for others)
- [ ] User can create an alert from the Prices page (all tabs) — category auto-selected based on active tab
- [ ] User can create an alert from the Portfolio page (per investment) — all fields pre-filled
- [ ] Target price input uses FormNumberInput with thousand separator
- [ ] Currency is auto-filled based on category/symbol selection
- [ ] Form validates: target price > 0, valid symbol, cooldown >= 2h if repeating
- [ ] Maximum 30 active alerts per user (enforced server-side)
- [ ] Success state shown after creation

### FR-2: List & Manage Alerts

Users can view and manage all their alerts in `/dashboard/settings/alerts`.

**Acceptance criteria:**
- [ ] Alerts displayed in a list/table showing: symbol, direction, target price, current price, trigger mode, status (active/triggered/paused), created date
- [ ] Status indicators: green for active, gray for triggered (one-shot), orange for paused (cooldown)
- [ ] User can delete an alert
- [ ] User can toggle an alert active/inactive
- [ ] User can re-activate a triggered one-shot alert
- [ ] Empty state shown when no alerts exist
- [ ] Mobile-responsive layout (MobileTable on small screens)

### FR-3: Alert Evaluation (Background Job)

A dedicated `UserPriceAlertJob` runs every 15 minutes to check all active alerts.

**Acceptance criteria:**
- [ ] Job groups alerts by asset type for efficient price fetching
- [ ] Gold/silver prices fetched from GoldPriceService/SilverPriceService (cached)
- [ ] Stock/crypto/ETF prices fetched from MarketDataService.GetPrice() (cached)
- [ ] For gold/silver alerts: compares against buy or sell price based on alert's `price_side` field
- [ ] "Above" alert triggers when current price >= target price
- [ ] "Below" alert triggers when current price <= target price
- [ ] One-shot alerts: status set to "triggered" after firing, no further checks
- [ ] Repeating alerts: cooldown set in Redis after firing, skipped until cooldown expires
- [ ] Daily notification cap: max 100 notifications per user per day
- [ ] Job logs summary: alerts checked, triggered, skipped (cooldown), errors

### FR-4: Notification Delivery

When an alert triggers, the user receives both in-app and push notifications.

**Acceptance criteria:**
- [ ] In-app notification created via NotificationRepository with type "user_price_alert"
- [ ] Notification metadata includes: symbol, direction, target price, current price, alert ID, price side (for gold/silver)
- [ ] Push notification sent via PushService.SendToUser()
- [ ] Push title: "{symbol} price alert" (e.g., "SJC 1L-10L price alert")
- [ ] Push body: "{symbol} {direction} {target_price} — now at {current_price}" (e.g., "SJC 1L-10L above 85,000,000 — now at 85,200,000")
- [ ] Push navigates to `/dashboard/settings/alerts`
- [ ] SSE publish to user's notification channel for real-time bell update
- [ ] NotificationItem component renders "user_price_alert" type with appropriate icon and formatting

## Non-Functional Requirements

- **Performance:** Alert evaluation job should complete within 60 seconds for up to 10,000 active alerts across all users. Price fetches are cached (15-min TTL), so most checks hit cache.
- **Scalability:** Max 30 alerts per user. With 1,000 users × 30 alerts = 30,000 max alerts. Grouped by symbol to minimize unique price fetches.
- **Reliability:** If price fetch fails for a symbol, skip that alert (don't deactivate). Log the error. Retry on next cycle.
- **Security:** Users can only CRUD their own alerts. Server-side ownership validation on all operations.

## Architecture Changes (C4)

### Diagrams to Update

1. **c4-component-backend.md** — Add:
   - `UserPriceAlertRepository` component in Repository layer
   - `UserPriceAlertService` component in Service layer
   - `UserPriceAlertHandlers` component in Handler layer
   - Relationships: UserPriceAlertService → MarketDataService, GoldPriceService, SilverPriceService, NotificationRepository, PushService

2. **c4-component-frontend.md** — Add:
   - New settings sub-page: `/dashboard/settings/alerts`
   - "Set Alert" button on Prices page and Portfolio page

### New Diagrams

No new L4 code diagram needed — the domain is simple (one model with CRUD + evaluation logic).

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — this is a new domain.

### New Flow Diagrams

1. **New file: `flow-user-price-alert.md`** — sequenceDiagram for:
   - **Create Alert flow**: User → REST Handler → Service (validate, check limits) → Repository (save) → Response
   - **Alert Evaluation flow**: Scheduler → UserPriceAlertJob → UserPriceAlertService.EvaluateAlerts() → [group by type] → Price fetch (cache-first) → Compare → Trigger notification → Update alert status
   - **Notification flow**: Service → NotificationRepository.Create() → PushService.SendToUser() → Redis SSE publish

## Data Model Changes

### New Table: `user_price_alert`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | int32 | PK, auto-increment | Alert ID |
| user_id | int32 | NOT NULL, INDEX | Owner |
| symbol | varchar(50) | NOT NULL | Symbol code (e.g., "AAPL", "SJL1L10", "XAU") |
| name | varchar(200) | NOT NULL | Display name (e.g., "Apple Inc.", "SJC 1L-10L") |
| asset_type | int32 | NOT NULL | InvestmentType enum value (1=crypto, 2=stock, 8=gold_vnd, 10=silver_vnd, etc.) — gold/silver alerts are VND only |
| currency | varchar(3) | NOT NULL | ISO 4217 (VND, USD) |
| price_side | varchar(4) | NOT NULL, DEFAULT 'buy' | "buy" or "sell" — relevant for gold/silver; "buy" for stocks/crypto |
| direction | varchar(5) | NOT NULL | "above" or "below" |
| target_price | int64 | NOT NULL | Target price in smallest currency unit |
| trigger_mode | varchar(10) | NOT NULL, DEFAULT 'once' | "once" or "repeat" |
| cooldown_hours | int32 | DEFAULT 4 | Cooldown between repeating triggers (min 2, max 168) |
| status | varchar(10) | NOT NULL, DEFAULT 'active', INDEX | "active", "triggered", "paused" |
| note | varchar(200) | | Optional user note |
| last_triggered_at | timestamp | | Last trigger time (for cooldown calculation) |
| trigger_count | int32 | DEFAULT 0 | Total times this alert has fired |
| current_price_at_creation | int64 | NOT NULL | Price when alert was created (for context) |
| created_at | timestamp | NOT NULL | Creation time |
| updated_at | timestamp | NOT NULL | Last update |
| deleted_at | timestamp | INDEX | Soft delete |

**Indexes:**
- `idx_user_price_alert_user_status` on `(user_id, status)` — for listing active alerts per user
- `idx_user_price_alert_status` on `(status)` — for batch evaluation job querying all active alerts
- `idx_user_price_alert_symbol` on `(symbol)` — for grouping alerts by symbol during evaluation

## API Changes

### New Proto: Add to `investment.proto` (since alerts are investment/price related)

```protobuf
// ── User Price Alert Messages ──

enum AlertDirection {
  ALERT_DIRECTION_UNSPECIFIED = 0;
  ALERT_DIRECTION_ABOVE = 1;
  ALERT_DIRECTION_BELOW = 2;
}

enum AlertTriggerMode {
  ALERT_TRIGGER_MODE_UNSPECIFIED = 0;
  ALERT_TRIGGER_MODE_ONCE = 1;
  ALERT_TRIGGER_MODE_REPEAT = 2;
}

enum AlertStatus {
  ALERT_STATUS_UNSPECIFIED = 0;
  ALERT_STATUS_ACTIVE = 1;
  ALERT_STATUS_TRIGGERED = 2;
  ALERT_STATUS_PAUSED = 3;
}

message UserPriceAlert {
  int32 id = 1 [json_name = "id"];
  int32 user_id = 2 [json_name = "userId"];
  string symbol = 3 [json_name = "symbol"];
  string name = 4 [json_name = "name"];
  InvestmentType asset_type = 5 [json_name = "assetType"];
  string currency = 6 [json_name = "currency"];
  string price_side = 7 [json_name = "priceSide"];
  AlertDirection direction = 8 [json_name = "direction"];
  int64 target_price = 9 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 10 [json_name = "triggerMode"];
  int32 cooldown_hours = 11 [json_name = "cooldownHours"];
  AlertStatus status = 12 [json_name = "status"];
  string note = 13 [json_name = "note"];
  int64 last_triggered_at = 14 [json_name = "lastTriggeredAt"];
  int32 trigger_count = 15 [json_name = "triggerCount"];
  int64 current_price_at_creation = 16 [json_name = "currentPriceAtCreation"];
  int64 current_price = 17 [json_name = "currentPrice"];
  int64 created_at = 18 [json_name = "createdAt"];
}

// ── RPC Requests/Responses ──

message CreateUserPriceAlertRequest {
  string symbol = 1 [json_name = "symbol"];
  string name = 2 [json_name = "name"];
  InvestmentType asset_type = 3 [json_name = "assetType"];
  string currency = 4 [json_name = "currency"];
  string price_side = 5 [json_name = "priceSide"];
  AlertDirection direction = 6 [json_name = "direction"];
  int64 target_price = 7 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 8 [json_name = "triggerMode"];
  int32 cooldown_hours = 9 [json_name = "cooldownHours"];
  string note = 10 [json_name = "note"];
}

message CreateUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  UserPriceAlert alert = 3 [json_name = "alert"];
  string timestamp = 4 [json_name = "timestamp"];
}

message ListUserPriceAlertsRequest {
  string status_filter = 1 [json_name = "statusFilter"];
  Pagination pagination = 2 [json_name = "pagination"];
}

message ListUserPriceAlertsResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  repeated UserPriceAlert alerts = 3 [json_name = "alerts"];
  int32 total = 4 [json_name = "total"];
  string timestamp = 5 [json_name = "timestamp"];
}

message UpdateUserPriceAlertRequest {
  int64 target_price = 1 [json_name = "targetPrice"];
  AlertTriggerMode trigger_mode = 2 [json_name = "triggerMode"];
  int32 cooldown_hours = 3 [json_name = "cooldownHours"];
  string note = 4 [json_name = "note"];
  AlertStatus status = 5 [json_name = "status"];
}

message UpdateUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  UserPriceAlert alert = 3 [json_name = "alert"];
  string timestamp = 4 [json_name = "timestamp"];
}

message DeleteUserPriceAlertRequest {}

message DeleteUserPriceAlertResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}

// ── RPC Definitions (add to InvestmentService or new AlertService) ──

// rpc CreateUserPriceAlert(CreateUserPriceAlertRequest) returns (CreateUserPriceAlertResponse) {
//   option (google.api.http) = { post: "/api/v1/price-alerts" body: "*" };
// }
// rpc ListUserPriceAlerts(ListUserPriceAlertsRequest) returns (ListUserPriceAlertsResponse) {
//   option (google.api.http) = { get: "/api/v1/price-alerts" };
// }
// rpc UpdateUserPriceAlert(UpdateUserPriceAlertRequest) returns (UpdateUserPriceAlertResponse) {
//   option (google.api.http) = { put: "/api/v1/price-alerts/{id}" body: "*" };
// }
// rpc DeleteUserPriceAlert(DeleteUserPriceAlertRequest) returns (DeleteUserPriceAlertResponse) {
//   option (google.api.http) = { delete: "/api/v1/price-alerts/{id}" };
// }
```

### REST Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/price-alerts` | Required | Create alert |
| GET | `/api/v1/price-alerts` | Required | List user's alerts (with optional status filter) |
| PUT | `/api/v1/price-alerts/:id` | Required | Update alert (target price, mode, status, note) |
| DELETE | `/api/v1/price-alerts/:id` | Required | Delete alert (soft delete) |

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Symbol search input | SymbolAutocomplete | `features/investment/components/SymbolAutocomplete.tsx` |
| Number input with formatting | FormNumberInput | `components/forms/FormNumberInput.tsx` |
| Select dropdown | FormSelect | `components/forms/FormSelect.tsx` |
| Text input | FormInput | `components/forms/FormInput.tsx` |
| Toggle switch | FormToggle | `components/forms/FormToggle.tsx` |
| Modal wrapper | BaseModal | `components/modals/BaseModal.tsx` |
| Success animation | Success | `components/modals/Success.tsx` |
| Confirm delete | ConfirmationDialog | `components/modals/ConfirmationDialog.tsx` |
| Empty state | EmptyState | `components/feedback/EmptyState.tsx` |
| Table (desktop) | TanStackTable | `components/table/TanStackTable.tsx` |
| Table (mobile) | MobileTable | `components/table/MobileTable.tsx` |
| Loading spinner | LoadingSpinner | `components/loading/LoadingSpinner.tsx` |
| Button | Button | `components/Button.tsx` |
| Card wrapper | BaseCard | `components/cards/BaseCard.tsx` |
| Notification item | NotificationItem | `components/notifications/NotificationItem.tsx` |
| Gold type options | `goldTypeOptions` array (VND types) | `features/investment/utils/gold-calculator.ts` |
| Silver type options | `silverTypeOptions` array (VND types) | `features/investment/utils/silver-calculator.ts` |
| Dropdown select | BasicFormSelect | `components/forms/FormSelect.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| CreatePriceAlertForm | `features/price-alert/forms/CreatePriceAlertForm.tsx` | New feature-specific form with conditional price side selector |
| PriceAlertList | `features/price-alert/components/PriceAlertList.tsx` | Alert management table with status badges and actions |
| AlertStatusBadge | `features/price-alert/components/AlertStatusBadge.tsx` | Colored status indicator (active/triggered/paused) |

### UI Entry Points

**1. Prices Page — "Set Alert" button**
- Add a bell/alert icon button next to each gold/silver row in the table
- Add a "Set Alert" button in the Symbol Lookup tab after a price is displayed
- Opens CreatePriceAlertForm modal with:
  - Gold tab → asset category pre-set to "Gold", gold type pre-selected
  - Silver tab → asset category pre-set to "Silver", silver type pre-selected
  - Currency tab → not applicable (no alerts for FX rates)
  - Symbol Lookup tab → asset category pre-set to "Other Assets", symbol pre-filled

**2. Portfolio Page — "Set Alert" action**
- Add "Set Alert" option in the investment card's quick actions (alongside Buy More, Sell, Edit)
- Opens CreatePriceAlertForm modal with all fields pre-filled based on the investment:
  - Gold/silver investments → category, type pre-set (currency always VND)
  - Stock/crypto/ETF investments → category set to "Other Assets", symbol pre-filled

**3. Settings — Alerts sub-page (`/dashboard/settings/alerts`)**
- Full CRUD management page
- Table with all alerts (active, triggered, paused)
- Status filter tabs or dropdown
- Delete and toggle actions per row
- "Create Alert" button at top

### CreatePriceAlertForm Layout (mobile-first)

**Gold/Silver flow:**
```
┌─────────────────────────────────┐
│ Create Price Alert              │
│                                 │
│ Asset Type                      │
│ [Gold] [Silver] [Other Assets]  │
│                                 │
│ Gold Type*   [SJC 1L-10L    ▼] │
│                                 │
│ Price Side   [Buy] [Sell]       │
│                                 │
│ Direction    [Above] [Below]    │
│                                 │
│ Target Price*  [________] VND  │
│ Buy: 85,000,000 | Sell: 85,500  │
│                                 │
│ Trigger Mode   [Once] [Repeat] │
│                                 │
│ ┌─ Repeat only ───────────────┐ │
│ │ Cooldown      [4] hours     │ │
│ └─────────────────────────────┘ │
│                                 │
│ Note (optional) [____________] │
│                                 │
```

**Other Assets flow:**
```
┌─────────────────────────────────┐
│ Create Price Alert              │
│                                 │
│ Asset Type                      │
│ [Gold] [Silver] [Other Assets]  │
│                                 │
│ Symbol*          [Autocomplete] │
│ (e.g., AAPL, BTC-USD, VCB.VN)  │
│                                 │
│ Direction    [Above] [Below]    │
│                                 │
│ Target Price*  [________] USD  │
│ Current: $185.50                │
│                                 │
│ Trigger Mode   [Once] [Repeat] │
│                                 │
│ ┌─ Repeat only ───────────────┐ │
│ │ Cooldown      [4] hours     │ │
│ └─────────────────────────────┘ │
│                                 │
│ Note (optional) [____________] │
│                                 │
│        [Create Alert]           │
└─────────────────────────────────┘
```

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Alert form data (symbol, price, direction) | Yes: Internet → App | REST Handler | Untrusted input |
| 2 | REST Handler | Validated alert request | No (same tier) | UserPriceAlertService | Handler validates & extracts userID from JWT |
| 3 | UserPriceAlertService | Alert model | Yes: App → DB | PostgreSQL | GORM parameterized queries |
| 4 | Scheduler | Alert evaluation trigger | No (internal) | UserPriceAlertService | Trusted internal call |
| 5 | UserPriceAlertService | Price fetch request | Yes: App → External API | Yahoo Finance / vang.today / ancarat | Via MarketDataService/GoldPriceService/SilverPriceService (cached) |
| 6 | External API | Price response | Yes: External → App | MarketDataService cache | Untrusted — validated by existing services |
| 7 | UserPriceAlertService | Notification data | Yes: App → DB | NotificationRepository | Trusted internal |
| 8 | PushService | Push payload | Yes: App → External | Web Push service (VAPID) | User's push subscription endpoint |
| 9 | UserPriceAlertService | SSE event | Yes: App → Redis → Client | Redis Pub/Sub → Browser | Real-time notification |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Alert CRUD requests | JWT auth + input validation + rate limiting |
| App → DB | Alert storage/retrieval | GORM parameterized queries + user_id ownership check |
| App → External API | Price fetches | Existing cache/throttle/timeout controls (unchanged) |
| External → App | Price responses | Existing validation in MarketDataService (unchanged) |
| App → Push Service | Push notifications | VAPID authentication (existing) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Unauthenticated user creates alerts | High | JWT auth middleware on all endpoints |
| T-2 | 1 | Internet → App | Tampering | User modifies another user's alert | High | Server extracts userID from JWT; ownership check on update/delete |
| T-3 | 1 | Internet → App | Tampering | User sends invalid target price (negative, overflow) | Medium | Server-side validation: price > 0, fits int64 |
| T-4 | 1 | Internet → App | DoS | User creates excessive alerts to overload evaluation job | Medium | Max 30 alerts per user (server-enforced) |
| T-5 | 1 | Internet → App | DoS | Rapid API calls to create/delete alerts | Low | Rate limiting per user on route group |
| T-6 | 3 | App → DB | Info Disclosure | User lists another user's alerts | High | WHERE user_id = ? on all queries |
| T-7 | 4 | Internal | DoS | Evaluation job overwhelmed by total alert count | Medium | Batch processing, symbol grouping, 60s timeout, cached prices |
| T-8 | 7 | App → DB | Repudiation | Alert triggered but notification not created | Low | Transactional: update alert status + create notification in same operation |
| T-9 | 8 | App → Push | Info Disclosure | Push payload leaks financial data | Low | Only include symbol name and price (public market data, not portfolio details) |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Create | Allowed (max 30) | Denied | Denied |
| Read/List | Own alerts only | Denied | Denied |
| Update | Own alerts only | Denied | Denied |
| Delete | Own alerts only | Denied | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| symbol | string | 1-50 chars, alphanumeric + dots/underscores | Required, sanitize |
| name | string | 1-200 chars | Required, trim |
| asset_type | int32 | Valid InvestmentType enum | Required, enum check |
| currency | string | 3 chars, ISO 4217 | Required, allowed list |
| price_side | string | "buy" or "sell" | Required, enum check |
| direction | string | "above" or "below" | Required, enum check |
| target_price | int64 | > 0, <= max int64 | Required, range check |
| trigger_mode | string | "once" or "repeat" | Required, enum check |
| cooldown_hours | int32 | 2-168 (if repeat) | Conditional, range check |
| note | string | 0-200 chars | Optional, trim, sanitize |

### External Dependency Risks

| External Service | Data Exchanged | Trust Level | Failure Impact | Mitigation |
|-----------------|----------------|-------------|----------------|------------|
| Yahoo Finance | Market prices (via cache) | Low (public) | Alerts for stocks/crypto not evaluated this cycle | Skip, log, retry next cycle |
| vang.today | Gold prices (via cache) | Low (public) | Gold alerts not evaluated this cycle | Skip, log, retry next cycle |
| ancarat | Silver prices (via cache) | Low (public) | Silver alerts not evaluated this cycle | Skip, log, retry next cycle |
| Web Push service | Notification payload | Medium | Push not delivered | In-app notification still created; push is best-effort |

No new external dependencies introduced — all price fetching reuses existing services with their caching and fallback behavior.

### Sensitive Data Handling

| Data Field | Sensitivity | Protection Required |
|-----------|------------|-------------------|
| target_price | Internal (user's price target) | User-scoped access only; not exposed in push to others |
| note | Internal (user's note) | User-scoped access only; sanitized input |
| symbol/direction | Public (market data) | No special protection needed |

### Issues & Risks Summary

1. **Alert evaluation latency** — With many unique symbols across all users, evaluation may take longer. Mitigated by symbol grouping and cache-first fetching.
2. **Stale prices** — 15-min cache means alerts could trigger up to 15 minutes late. Acceptable for this use case.
3. **Notification spam** — Repeating alerts on volatile assets near target price. Mitigated by min 2h cooldown and 100/day cap.
4. **Gold/silver price side confusion** — User might not understand buy vs sell. Mitigated by showing current buy and sell prices in the form.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| Target price already met at creation time | Allow creation — alert will trigger on next evaluation cycle. Show info message: "Current price already meets your condition" |
| Symbol delisted or unavailable | Alert evaluation skips this symbol, logs warning. Alert stays active for future checks. |
| User deletes account | Soft-deleted alerts via cascade. Evaluation job filters by active users. |
| Price fetch returns 0 or negative | Skip evaluation for that symbol (existing service behavior) |
| Max 30 alerts reached | Return 400 with clear message: "Maximum of 30 alerts reached. Delete an existing alert to create a new one." |
| Daily notification cap (100) reached | Skip notification, log. Alert status NOT changed — will try again next cycle. |
| Concurrent alert creation (race condition on count) | Use DB-level count query within transaction to prevent exceeding limit |
| Gold/silver type not found in price data | Skip evaluation, log warning. Common if vang.today doesn't list that type temporarily. |

## Dependencies & Assumptions

- Existing `GoldPriceService`, `SilverPriceService`, `MarketDataService` continue to cache prices with 15-min TTL
- Existing `NotificationRepository` and `PushService` are available for notification delivery
- Existing `SymbolAutocomplete` component works for all asset types
- Scheduler infrastructure supports adding new jobs
- Redis is available for per-alert cooldown tracking
- Gold/silver price APIs return both buy and sell prices (confirmed: `CachedGoldPrice` has `Buy` and `Sell` fields)

## Out of Scope

- Percentage-based alerts ("alert me when price moves ±X%") — future enhancement
- Portfolio-level alerts ("alert me when total PNL drops below X") — future enhancement
- Email notifications — no email service exists currently
- Alert sharing or social features
- Historical alert trigger log (beyond trigger_count and last_triggered_at)
- Webhook/API callback notifications
- Custom evaluation intervals per alert (all alerts checked every 15 min)
