# Admin Price Override Specification

## Summary

Enable admin users to manually override gold, silver, currency, and stock/crypto prices displayed on the market prices table. Overrides are stored in Redis with a dedicated key pattern, take priority over API-fetched prices, and fall back to API prices when removed. Overrides affect the **display price table only** — investment PNL calculations continue using API-fetched prices. Admin users are designated via an `is_admin` boolean flag on the User model.

## User Stories

- As an **admin**, I want to override buy/sell prices for any item on the price table, so that I can correct inaccurate API prices or set prices when APIs are unavailable.
- As an **admin**, I want to remove a price override, so that the system falls back to the API-fetched price automatically.
- As an **admin**, I want to see which prices have been overridden at a glance, so that I can track what's been manually set.
- As a **regular user**, I want to see the most accurate prices available (whether API or admin-overridden), without knowing which source was used.

## Functional Requirements

### FR-1: Admin User Designation

Add an `is_admin` boolean field to the User model. Default `false`. Admin status is set via direct database update or a migration command.

**Acceptance criteria:**
- [ ] User model has `is_admin` boolean field (default `false`)
- [ ] DB migration adds the column to the `user` table
- [ ] Auth middleware exposes `is_admin` in the gin context after token verification
- [ ] Auth proto `User` message includes `is_admin` field
- [ ] Frontend auth state includes `isAdmin` flag
- [ ] Non-admin users cannot access admin-only endpoints (HTTP 403)

### FR-2: Price Override Storage (Redis)

Store price overrides in Redis using a dedicated key pattern. No database table — Redis is the sole storage.

**Key pattern:** `price_override:{category}:{type_code}:{currency}`
- Examples: `price_override:gold:SJC:VND`, `price_override:stock:AAPL:USD`, `price_override:currency:USDJPY:JPY`

**Stored value (JSON):**
```json
{
  "buy": 85000000,
  "sell": 85500000,
  "updated_by": 1,
  "updated_at": 1710345600,
  "type_code": "SJC",
  "name": "SJC 1L-10L",
  "currency": "VND",
  "category": "gold"
}
```

**No TTL** — overrides persist until explicitly deleted.

**Acceptance criteria:**
- [ ] Redis cache module for price overrides (`PriceOverrideCache`)
- [ ] `Get(category, typeCode, currency)` — returns override or nil
- [ ] `Set(category, typeCode, currency, override)` — stores override with no TTL
- [ ] `Delete(category, typeCode, currency)` — removes override
- [ ] `GetAllByCategory(category)` — lists all overrides for a category (for merging with API prices)
- [ ] `GetAll()` — lists all overrides across all categories

### FR-3: Admin Override API Endpoints

Three new admin-only endpoints for managing price overrides.

**POST /api/v1/admin/price-overrides** — Create/update an override
```json
Request: {
  "category": "gold",
  "typeCode": "SJC",
  "currency": "VND",
  "buy": 85000000,
  "sell": 85500000,
  "name": "SJC 1L-10L"
}
Response: {
  "success": true,
  "message": "Price override saved",
  "override": { ... }
}
```

**GET /api/v1/admin/price-overrides** — List all overrides
```json
Query params: ?category=gold (optional filter)
Response: {
  "success": true,
  "overrides": [...]
}
```

**DELETE /api/v1/admin/price-overrides** — Remove an override
```json
Request: {
  "category": "gold",
  "typeCode": "SJC",
  "currency": "VND"
}
Response: {
  "success": true,
  "message": "Price override removed"
}
```

**Acceptance criteria:**
- [ ] All three endpoints require authentication + admin check
- [ ] POST validates: category is one of [gold, silver, currency, stock], typeCode non-empty, currency is valid ISO 4217, buy/sell are positive int64
- [ ] DELETE removes the Redis key and returns success even if key didn't exist
- [ ] GET supports optional `category` query parameter filter
- [ ] Non-admin users receive HTTP 403 Forbidden

### FR-4: Market Prices Merge Logic

Modify the `GetMarketPrices` handler to merge admin overrides with API-fetched prices.

**Merge strategy:**
1. Fetch API prices (gold, silver, currency) in parallel (existing behavior)
2. Fetch all price overrides from Redis
3. For each API price item, check if an override exists (match on `typeCode` + `currency`)
4. If override exists: replace `buy` and `sell` with override values, add `isOverridden: true` flag
5. If no override: use API price as-is, `isOverridden: false`
6. Return merged result

**Acceptance criteria:**
- [ ] Overridden prices show the admin-set buy/sell values
- [ ] Non-overridden prices show API values (no regression)
- [ ] `isOverridden` boolean flag present on each PriceItem
- [ ] Override merge does not block API fetching (parallel execution maintained)
- [ ] If Redis is unavailable, gracefully fall back to API-only prices (no error)

### FR-5: Inline Price Editing (Frontend)

Admin users see an edit icon on each row of the price table. Clicking enters inline edit mode for that row's buy/sell prices.

**UI behavior:**
- Admin users: each price row shows a pencil icon (edit button) on hover/touch
- Clicking the pencil icon: buy/sell cells become editable input fields, pencil icon becomes save/cancel icons
- Save: calls POST override API, updates the row, shows success toast
- Cancel: reverts to original values
- Overridden rows: subtle visual indicator (e.g., colored dot or badge) showing the price is manually set
- Non-admin users: no edit icons, no visual difference

**Acceptance criteria:**
- [ ] Edit icon only visible to admin users
- [ ] Inline edit mode for buy/sell fields
- [ ] Save calls the override API and updates local state
- [ ] Cancel reverts without API call
- [ ] Overridden rows have a visual indicator
- [ ] Admin can click the override indicator to remove the override (with confirmation)
- [ ] Loading state during save/delete
- [ ] Error handling with toast notifications
- [ ] Works on both desktop (TanStackTable) and mobile (MobileTable)

### FR-6: Admin Middleware

New middleware that checks `is_admin` from the gin context (set by auth middleware). Applied to admin-only route groups.

**Acceptance criteria:**
- [ ] `AdminMiddleware()` function that returns 403 if `is_admin` is false
- [ ] Applied to `/api/v1/admin/*` route group
- [ ] Works after `AuthMiddleware` in the middleware chain

## Non-Functional Requirements

- **Performance:** Override check adds < 5ms to market prices response (Redis MGET for batch)
- **Availability:** Redis failure does not break market prices — graceful fallback to API-only
- **Security:** Admin endpoints protected by auth + admin middleware
- **Data loss risk:** Redis flush loses all overrides (accepted trade-off per user choice)

## Architecture Changes (C4)

### Diagrams to Update

1. **`c4-component-backend.md`** — Add:
   - `PriceOverrideCache` component in the Cache layer
   - `PriceOverrideHandler` component in the Handlers layer
   - `AdminMiddleware` component in the Middleware layer
   - Relationship: `PriceOverrideHandler` → `PriceOverrideCache`
   - Relationship: `MarketPricesHandler` → `PriceOverrideCache` (for merge logic)

2. **`c4-component-frontend.md`** — Add:
   - Inline edit components in the Market Prices feature module
   - Admin context/state for role-based UI rendering

### New Diagrams

No new L4 code diagram needed — this feature adds a cache module and a handler, not a complex domain with multiple interacting models.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`flow-cross-cutting.md`** — Add a sequence diagram for "Admin Price Override Flow" showing: Admin → Frontend → POST /admin/price-overrides → AdminMiddleware → PriceOverrideHandler → PriceOverrideCache (Redis)

### New Flow Diagrams

No new flow file needed — the admin override flow fits in `flow-cross-cutting.md` as a cross-cutting admin concern.

## Data Model Changes

### User Model (Modify)

```go
// Add to existing User struct
IsAdmin bool `gorm:"default:false;not null" json:"isAdmin"`
```

**Migration:** `ALTER TABLE "user" ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;`

### Redis Structure (New)

```
Key:    price_override:{category}:{type_code}:{currency}
Value:  JSON-serialized PriceOverride struct
TTL:    None (persistent until deleted)
```

No database table for overrides.

## API Changes

### Proto Changes

**`api/protobuf/v1/auth.proto`** — Add to User message:
```protobuf
bool is_admin = 10;
```

**`api/protobuf/v1/investment.proto`** — Add to PriceItem message:
```protobuf
bool is_overridden = 9;
```

**New `api/protobuf/v1/admin.proto`** — Admin service:
```protobuf
service AdminService {
  rpc SetPriceOverride(SetPriceOverrideRequest) returns (SetPriceOverrideResponse) {
    option (google.api.http) = {
      post: "/api/v1/admin/price-overrides"
      body: "*"
    };
  }

  rpc ListPriceOverrides(ListPriceOverridesRequest) returns (ListPriceOverridesResponse) {
    option (google.api.http) = {
      get: "/api/v1/admin/price-overrides"
    };
  }

  rpc DeletePriceOverride(DeletePriceOverrideRequest) returns (DeletePriceOverrideResponse) {
    option (google.api.http) = {
      delete: "/api/v1/admin/price-overrides"
    };
  }
}

enum PriceCategory {
  PRICE_CATEGORY_UNSPECIFIED = 0;
  PRICE_CATEGORY_GOLD = 1;
  PRICE_CATEGORY_SILVER = 2;
  PRICE_CATEGORY_CURRENCY = 3;
  PRICE_CATEGORY_STOCK = 4;
}

message PriceOverride {
  string type_code = 1;
  string name = 2;
  int64 buy = 3;
  int64 sell = 4;
  string currency = 5;
  PriceCategory category = 6;
  int32 updated_by = 7;
  int64 updated_at = 8;
}

message SetPriceOverrideRequest {
  PriceCategory category = 1;
  string type_code = 2;
  string currency = 3;
  int64 buy = 4;
  int64 sell = 5;
  string name = 6;
}

message SetPriceOverrideResponse {
  bool success = 1;
  string message = 2;
  PriceOverride override = 3;
}

message ListPriceOverridesRequest {
  PriceCategory category = 1; // optional filter
}

message ListPriceOverridesResponse {
  bool success = 1;
  repeated PriceOverride overrides = 2;
}

message DeletePriceOverrideRequest {
  PriceCategory category = 1;
  string type_code = 2;
  string currency = 3;
}

message DeletePriceOverrideResponse {
  bool success = 1;
  string message = 2;
}
```

## UI/UX Changes

### Market Prices Page (Modify)

**Admin view additions:**
- Pencil icon on each row (visible only to admin users)
- Inline edit mode: buy/sell inputs replace text, with save/cancel buttons
- Override indicator: small colored badge (e.g., blue dot) on overridden rows
- Remove override: click badge → confirmation → DELETE API call
- Toast notifications for success/error states

**Mobile considerations:**
- On mobile (MobileTable): edit button in the expanded row view
- Touch-friendly input fields with number keyboards
- Swipe-to-reveal edit action (optional, pencil icon in expanded view is sufficient)

**Design:**
- Follow **mobile-first** approach (`sm:` breakpoint at 800px)
- Use existing `components/forms/FormNumberInput` for price inputs
- Use existing `components/feedback/Toast` for notifications
- Use existing icon patterns from `components/icons/`

### Auth State Changes

- `AuthPayload` adds `isAdmin: boolean`
- Auth middleware returns `is_admin` in user data
- Components use `isAdmin` to conditionally render admin UI

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin browser | Override request (buy/sell/category/typeCode) | Yes: Internet → App | Backend API | JWT auth + admin check |
| 2 | Backend API | Validated override data | No (internal) | Redis | Write override to cache |
| 3 | Any user browser | Market prices request | Yes: Internet → App | Backend API | JWT auth |
| 4 | Backend API | Price override check | No (internal) | Redis | Read override cache |
| 5 | Backend API | API price fetch | Yes: App → External API | vang247/Yahoo | Existing flow unchanged |
| 6 | Backend API | Merged prices (override + API) | Yes: App → Internet | User browser | Response with isOverridden flag |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin override requests | JWT + `is_admin` check + input validation |
| Internet → App | Regular price requests | JWT auth (existing) |
| App → Redis | Override read/write | Internal network, no auth (standard Redis) |
| App → External APIs | Price fetch | HTTPS, API keys, rate limiting (existing) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin user forges admin request | High | `is_admin` DB flag verified server-side; not derived from JWT claims alone |
| T-2 | 1 | Internet → App | Tampering | Admin sends negative/overflow prices | Medium | Server-side validation: buy/sell must be positive int64, within reasonable bounds |
| T-3 | 1 | Internet → App | Elevation of Privilege | Regular user accesses admin endpoints | High | AdminMiddleware applied to route group; 403 response for non-admin |
| T-4 | 6 | App → Internet | Information Disclosure | `isOverridden` flag leaks admin activity | Low | Acceptable — flag is informational, no sensitive data exposed |
| T-5 | 2 | Internal | Denial of Service | Attacker with admin creates millions of override keys | Low | Admin is trusted; rate limit admin endpoints as defense-in-depth |
| T-6 | 4 | Internal | Tampering | Redis compromise modifies overrides | Low | Redis internal network only; same risk as existing price cache |

### Authorization Rules

| Action | Required Role | Check Location |
|--------|--------------|----------------|
| View market prices | Any authenticated user | AuthMiddleware |
| Create/update price override | Admin | AuthMiddleware + AdminMiddleware |
| Delete price override | Admin | AuthMiddleware + AdminMiddleware |
| List price overrides | Admin | AuthMiddleware + AdminMiddleware |

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| `category` | Must be one of: gold, silver, currency, stock | Backend handler |
| `typeCode` | Non-empty string, max 50 chars, alphanumeric + underscore | Backend handler |
| `currency` | Valid ISO 4217 code (3 uppercase letters) | Backend handler |
| `buy` | Positive int64, > 0 | Backend handler |
| `sell` | Positive int64, > 0 | Backend handler |
| `name` | Non-empty string, max 100 chars | Backend handler |

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|-----------|
| Redis | Flush/restart loses all overrides | Accepted trade-off (user's explicit choice). Document in admin UI. |
| Redis | Unavailable during price request | Graceful fallback — return API prices without overrides |

### Sensitive Data Handling

- `is_admin` flag: stored in DB, exposed in auth token response, stored in frontend state
- Override `updated_by` (user ID): internal tracking only, not exposed to regular users
- No PII involved in price overrides

### Issues & Risks Summary

1. **Redis data loss**: Overrides lost on Redis flush/restart. Mitigated by user acceptance; could add periodic DB backup in future.
2. **Admin privilege escalation**: If someone gains DB access, they could set `is_admin=true`. Standard DB security applies.
3. **Price manipulation**: Admin could set unrealistic prices for display. Display-only impact (PNL unaffected), plus audit trail via `updated_by`.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| Admin overrides a price, then API updates | Override takes priority; API price is fetched but not displayed |
| Admin removes override while API is down | System tries API, gets error, returns last cached API price (existing fallback) |
| Two admins override same price simultaneously | Last write wins (Redis SET is atomic) |
| Invalid currency in override request | 400 Bad Request with validation error |
| Redis unavailable during override save | 503 Service Unavailable with error message |
| Redis unavailable during price merge | Gracefully skip overrides, return API-only prices |
| Admin sets buy > sell | Allowed — some markets have inverted spreads; no business rule violation |
| Override for a typeCode that doesn't exist in API | Override stored but won't match any API price; harmless orphan |

## Dependencies & Assumptions

- **Existing auth system**: JWT auth and middleware already functional
- **Redis availability**: Redis is already a core dependency for price caching
- **Admin designation**: Initial admin users set via direct DB update (`UPDATE "user" SET is_admin = true WHERE email = 'admin@example.com'`)
- **Frontend auth state**: `AuthPayload` can be extended with `isAdmin`

## Out of Scope

- **PNL impact**: Overrides do NOT affect investment portfolio calculations
- **Price override history/audit log**: No historical tracking of override changes (could be added later)
- **Role-based access control (RBAC)**: No role system beyond `is_admin` boolean
- **Override expiration**: No auto-expiry of overrides
- **Bulk import of overrides**: No CSV/bulk upload for price overrides
- **Override for individual users**: This is global override only, not per-user price customization
- **Database backup of overrides**: Redis is sole storage (accepted trade-off)
