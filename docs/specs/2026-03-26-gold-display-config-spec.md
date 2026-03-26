# Gold Display Configuration Specification

## Summary

Move the hardcoded gold type display filter (currently in frontend `gold-filter.ts` and `gold-calculator.ts`) to a backend-managed, admin-configurable database table. A new `gold_display_config` table stores which gold types to show, their display names, ordering, and context visibility (price table vs investment form). A new REST endpoint returns the configured gold types joined with live prices from `asset_price`. Admin CRUD endpoints allow adding/removing/reordering types without code deploys. Home page, landing page, and investment gold type dropdown all consume the new backend endpoint instead of client-side filtering.

## User Stories

- As a **user**, I want to see the most relevant gold prices on the home page and landing page, so that I can quickly check current market prices.
- As a **user**, I want to select gold types when creating an investment, with the same types I see in the price table, so that my portfolio tracks real market prices.
- As an **admin**, I want to add, remove, reorder, and rename gold types in the display list, so that I can respond to market changes (new vendors, discontinued types) without a code deployment.

## Functional Requirements

### FR-1: Gold Display Config Table

A new `gold_display_config` table stores the admin-managed list of gold types to display.

**Schema:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Row ID |
| `type_code` | `string(50)` | NOT NULL, unique | Matches `asset_price.type_code` (e.g., `"SJC"`, `"Doji_24K"`) |
| `display_name` | `string(100)` | NOT NULL | User-facing name (e.g., `"Nhẫn Doji 9999"`) |
| `display_order` | `int32` | NOT NULL, default 0 | Sort order (ascending) |
| `enabled` | `bool` | NOT NULL, default true | Whether to include in responses |
| `show_in_investment` | `bool` | NOT NULL, default true | Whether to show in investment gold type dropdown |
| `created_at` | `timestamp` | auto | Creation time |
| `updated_at` | `timestamp` | auto | Last update time |

**Seed data (migration):** The current 9 types:

| type_code | display_name | display_order | enabled | show_in_investment |
|-----------|-------------|---------------|---------|-------------------|
| `SJC` | SJC | 1 | true | true |
| `SJC TD` | SJC Tự Do | 2 | true | false |
| `Vàng nhẫn SJC` | Nhẫn SJC 9999 | 3 | true | true |
| `Doji_24K` | Nhẫn Doji 9999 | 4 | true | true |
| `Mi hồng` | SJC Mi Hồng | 5 | true | true |
| `Mihong_999` | Nhẫn Mi Hồng 9999 | 6 | true | true |
| `BTMC` | SJC BTMC | 7 | true | true |
| `BTMC_24K` | Nhẫn BTMC | 8 | true | true |
| `PNJ HCM` | PNJ | 9 | true | true |

**Acceptance criteria:**
- [ ] Migration creates `gold_display_config` table with seed data
- [ ] `type_code` has unique constraint
- [ ] Soft deletes via `gorm.DeletedAt`

### FR-2: Public Endpoint — Get Configured Gold Prices

`GET /api/v1/gold-display-prices` — **public** (no auth required, same as landing page market types).

Returns the enabled gold display config entries joined with latest prices from `asset_price`.

**Response shape (proto):**

```protobuf
message GoldDisplayPrice {
  string type_code = 1;
  string display_name = 2;
  int64 buy = 3;
  int64 sell = 4;
  int64 change_buy = 5;
  int64 change_sell = 6;
  string currency = 7;
  int64 updated_at = 8;
  bool is_stale = 9;
  bool show_in_investment = 10;
  int32 display_order = 11;
}

message GetGoldDisplayPricesResponse {
  repeated GoldDisplayPrice prices = 1;
}
```

**Behavior:**
- Reads `gold_display_config` WHERE `enabled = true`, ordered by `display_order`
- For each config entry, LEFT JOIN `asset_price` on `type_code` WHERE `asset_type = 'gold'` (pick best source: prefer non-stale, most recent `fetched_at`)
- If no price row found for a type_code, return the config entry with `buy=0, sell=0, is_stale=true`
- Apply admin price overrides from `PriceOverrideCache` (existing pattern from `market_prices.go`)

**Acceptance criteria:**
- [ ] Returns only enabled types in display_order
- [ ] Prices joined from `asset_price` table (no external API calls)
- [ ] Missing prices return zero values with `is_stale=true`
- [ ] Admin overrides applied
- [ ] Public (no JWT required)

### FR-3: Admin CRUD Endpoints

All admin endpoints require JWT + admin role check (existing `AdminMiddleware`).

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/gold-display-config` | List all configs (including disabled) |
| `POST` | `/api/v1/admin/gold-display-config` | Add new gold type to display list |
| `PUT` | `/api/v1/admin/gold-display-config/{id}` | Update display name, order, enabled, show_in_investment |
| `DELETE` | `/api/v1/admin/gold-display-config/{id}` | Soft-delete a config entry |

**Create request:**
```protobuf
message CreateGoldDisplayConfigRequest {
  string type_code = 1;       // Must match existing asset_price type_code
  string display_name = 2;
  int32 display_order = 3;
  bool enabled = 4;
  bool show_in_investment = 5;
}
```

**Update request:**
```protobuf
message UpdateGoldDisplayConfigRequest {
  string display_name = 1;
  int32 display_order = 2;
  bool enabled = 3;
  bool show_in_investment = 4;
}
```

**Validation:**
- `type_code`: required, max 50 chars, must exist in `asset_price` table (or in `gold.GoldTypes` registry)
- `display_name`: required, max 100 chars, non-empty after trim
- `display_order`: >= 0
- Duplicate `type_code` on create → 409 Conflict

**Acceptance criteria:**
- [ ] All CRUD operations work with proper validation
- [ ] Admin-only access enforced
- [ ] Duplicate type_code rejected
- [ ] Soft delete (recoverable)

### FR-4: Frontend — Home Page Gold Table

Replace client-side `filterGoldPrices()` with the new backend endpoint.

**Changes:**
- `GoldPriceTable` component calls new hook (e.g., `useQueryGetGoldDisplayPrices`)
- Remove import of `filterGoldPrices` from `gold-filter.ts`
- Display `display_name` from API response instead of local mapping
- Keep existing table structure, styling, stale indicator behavior

**Acceptance criteria:**
- [ ] Home page gold table uses backend endpoint
- [ ] Display names come from backend
- [ ] Order matches `display_order` from backend
- [ ] Stale prices show "--" (existing behavior preserved)

### FR-5: Frontend — Landing Page Gold Table

Same change as FR-4 but for the landing page.

**Changes:**
- `LandingGoldPriceTable` calls new hook or the public endpoint
- Remove dependency on `GOLD_TABLE_FILTER` constant
- Since landing page is public (no auth), the endpoint must be public too (already is per FR-2)

**Acceptance criteria:**
- [ ] Landing page gold table uses backend endpoint
- [ ] Works without authentication
- [ ] Display names and order from backend

### FR-6: Frontend — Investment Gold Type Dropdown

Replace `GOLD_VND_OPTIONS` constant with data from the same endpoint, filtered by `show_in_investment=true`.

**Changes:**
- `AddInvestmentForm` / gold type selector fetches from the new endpoint
- Filter response where `show_in_investment === true`
- Map to dropdown options: `{ value: type_code, label: display_name }`
- Keep `GOLD_USD_OPTIONS` (`XAUUSD`) as-is (or add to config table as USD type)

**Acceptance criteria:**
- [ ] Investment form gold type dropdown populated from backend
- [ ] Only types with `show_in_investment=true` shown
- [ ] Dropdown order matches `display_order`

### FR-7: Admin UI — Gold Display Config Management

New section in the Admin page (`/dashboard/admin`) for managing the gold display config.

**UI:**
- Table showing all config entries (enabled + disabled)
- Columns: display_order, type_code, display_name, enabled toggle, show_in_investment toggle, actions (edit/delete)
- "Add Gold Type" button — modal with type_code input (autocomplete from known gold types), display_name, display_order, enabled, show_in_investment
- Edit inline or via modal
- Delete with confirmation dialog
- Drag-to-reorder (nice-to-have, can use display_order input for MVP)

**Acceptance criteria:**
- [ ] Admin can view all gold display config entries
- [ ] Admin can add new entries
- [ ] Admin can edit display_name, display_order, enabled, show_in_investment
- [ ] Admin can delete entries (with confirmation)
- [ ] Changes reflected immediately on home/landing pages

## Non-Functional Requirements

- **Performance:** The public endpoint reads from DB only (no external API calls). Response time < 50ms. Consider Redis cache with short TTL (1-2 min) if needed.
- **Security:** Admin endpoints protected by JWT + admin role. Public endpoint returns only price data (no internal IDs beyond config ID).
- **Availability:** If `gold_display_config` table is empty, return empty array (not error). Frontend handles empty state gracefully.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend (`c4-component-backend.md`):** Add `GoldDisplayConfigHandler` to handlers section, `GoldDisplayConfigService` to services, `GoldDisplayConfigRepository` to repositories.
- **L3 Frontend (`c4-component-frontend.md`):** Note removal of `gold-filter.ts` constant and move to API-driven data in market-prices feature module.

### New Diagrams

No new L4 diagram needed — this is simple CRUD with a join, not a complex domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-investment.md`:** Update the "Gold Type Selection" section to show API call instead of static constant.

### New Flow Diagrams

**New sequence: Gold Display Prices Read Flow** — add to `flow-cross-cutting.md`:

```
User → GET /api/v1/gold-display-prices
  → GoldDisplayConfigHandler
    → GoldDisplayConfigService.GetDisplayPrices()
      → GoldDisplayConfigRepository.ListEnabled()  [gold_display_config table]
      → AssetPriceRepository.GetBestPricesByTypeCodes()  [asset_price table]
      → PriceOverrideCache.GetOverrides()  [Redis]
    ← Join config + prices + overrides
  ← GoldDisplayPricesResponse
```

**Admin CRUD Flow** — add to `flow-cross-cutting.md`:

```
Admin → POST/PUT/DELETE /api/v1/admin/gold-display-config
  → AdminMiddleware (JWT + admin check)
    → GoldDisplayConfigHandler
      → GoldDisplayConfigService
        → GoldDisplayConfigRepository
      ← Response
```

## Data Model Changes

### New Table: `gold_display_config`

```sql
CREATE TABLE gold_display_config (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    show_in_investment BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_gold_display_config_enabled ON gold_display_config(enabled) WHERE deleted_at IS NULL;
CREATE INDEX idx_gold_display_config_deleted ON gold_display_config(deleted_at);
```

### No Changes to Existing Tables

`asset_price` table is unchanged — the join is read-only.

## API Changes

### New Proto Definitions (in `investment.proto`)

```protobuf
// Gold Display Config messages
message GoldDisplayPrice {
  string type_code = 1;
  string display_name = 2;
  int64 buy = 3;
  int64 sell = 4;
  int64 change_buy = 5;
  int64 change_sell = 6;
  string currency = 7;
  int64 updated_at = 8;
  bool is_stale = 9;
  bool show_in_investment = 10;
  int32 display_order = 11;
}

message GetGoldDisplayPricesRequest {}

message GetGoldDisplayPricesResponse {
  repeated GoldDisplayPrice prices = 1;
}

message GoldDisplayConfig {
  int32 id = 1;
  string type_code = 2;
  string display_name = 3;
  int32 display_order = 4;
  bool enabled = 5;
  bool show_in_investment = 6;
}

message ListGoldDisplayConfigResponse {
  repeated GoldDisplayConfig configs = 1;
}

message CreateGoldDisplayConfigRequest {
  string type_code = 1;
  string display_name = 2;
  int32 display_order = 3;
  bool enabled = 4;
  bool show_in_investment = 5;
}

message UpdateGoldDisplayConfigRequest {
  string display_name = 1;
  int32 display_order = 2;
  bool enabled = 3;
  bool show_in_investment = 4;
}
```

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/gold-display-prices` | Public | Get configured gold types with live prices |
| `GET` | `/api/v1/admin/gold-display-config` | Admin | List all config entries |
| `POST` | `/api/v1/admin/gold-display-config` | Admin | Create config entry |
| `PUT` | `/api/v1/admin/gold-display-config/:id` | Admin | Update config entry |
| `DELETE` | `/api/v1/admin/gold-display-config/:id` | Admin | Delete config entry |

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Gold price table (home) | `GoldPriceTable` — **MODIFY** | `app/[locale]/dashboard/home/GoldPriceTable.tsx` |
| Gold price table (landing) | `LandingGoldPriceTable` — **MODIFY** | `components/landing/LandingGoldPriceTable.tsx` |
| Gold type dropdown (investment) | `AddInvestmentForm` — **MODIFY** | `features/investment/forms/AddInvestmentForm.tsx` |
| Admin config table | MobileTable — **REUSE** | `components/table/MobileTable.tsx` |
| Admin add/edit modal | BaseModal — **REUSE** | `components/modals/BaseModal.tsx` |
| Admin delete confirm | ConfirmationDialog — **REUSE** | `components/modals/ConfirmationDialog.tsx` |
| Toggle switches | FormToggle or inline toggle — **REUSE** | `components/forms/` |
| Form inputs | FormInput, FormSelect — **REUSE** | `components/forms/` |
| Admin page | Existing admin page — **ADD TAB/SECTION** | `app/[locale]/dashboard/admin/page.tsx` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `GoldDisplayConfigTable` | `features/admin/components/` | Admin-specific config management table — no existing component covers this exact CRUD pattern |
| `GoldDisplayConfigForm` | `features/admin/components/` | Form for create/edit gold display config — feature-specific |

### Frontend Files to Delete/Deprecate

| File | Action | Reason |
|------|--------|--------|
| `features/market-prices/constants/gold-filter.ts` | Delete (after migration) | Logic moved to backend |
| `GOLD_VND_OPTIONS` in `features/investment/utils/gold-calculator.ts` | Remove constant | Replaced by API data |
| `filterGoldPrices` usage in `GoldPriceTable` | Remove | No longer needed |
| `filterGoldPrices` usage in `LandingGoldPriceTable` | Remove | No longer needed |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | User (browser) | GET request (no body) | Yes: Internet → App | GoldDisplayConfigHandler | Public endpoint, no auth |
| 2 | Handler | Config query | Yes: App → DB | PostgreSQL `gold_display_config` | Read-only, parameterized |
| 3 | Handler | Price query | Yes: App → DB | PostgreSQL `asset_price` | Read-only, parameterized, type_codes from DB not user |
| 4 | Handler | Override lookup | No (same tier) | Redis `PriceOverrideCache` | Read-only |
| 5 | Admin (browser) | CRUD payload (JSON) | Yes: Internet → App | Admin handler | JWT + admin role required |
| 6 | Admin handler | Write query | Yes: App → DB | PostgreSQL `gold_display_config` | Parameterized, validated |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App (public) | Price read requests | Rate limiting (existing), no auth needed |
| Internet → App (admin) | Config CRUD requests | JWT auth + admin role middleware |
| App → DB | All queries | GORM parameterized queries, no raw SQL |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | DoS | Public endpoint hammered | Low | Existing rate limiter; response is small (9 rows), cheap to serve |
| T-2 | 5 | Internet → App | Spoofing | Non-admin calls admin endpoints | Medium | JWT + AdminMiddleware (existing pattern) |
| T-3 | 5 | Internet → App | Tampering | Admin sends malicious type_code | Low | Validate type_code exists in gold registry or asset_price; max 50 chars; sanitized by GORM |
| T-4 | 5 | Internet → App | Elevation | Regular user accesses admin endpoints | Medium | AdminMiddleware checks user role (existing pattern) |
| T-5 | 6 | App → DB | Injection | SQL injection via type_code/display_name | Low | GORM parameterized queries; string length validated |
| T-6 | 5 | Internet → App | Tampering | Admin sets misleading display_name | Low | Operational risk (admin is trusted); audit log recommended |

### Authorization Rules

| Operation | Admin | Regular User | Unauthenticated |
|-----------|-------|-------------|-----------------|
| Read display prices | Yes | Yes | Yes (public) |
| List all configs | Yes | No (403) | No (401) |
| Create config | Yes | No (403) | No (401) |
| Update config | Yes | No (403) | No (401) |
| Delete config | Yes | No (403) | No (401) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| `type_code` | string | max 50 chars, non-empty, must exist in gold registry or asset_price | Required |
| `display_name` | string | max 100 chars, non-empty after trim | Required |
| `display_order` | int32 | >= 0 | Required |
| `enabled` | bool | - | Default true |
| `show_in_investment` | bool | - | Default true |
| `id` (path param) | int32 | > 0 | Required |

### External Dependency Risks

No new external dependencies. This feature reads from existing `asset_price` table (already populated by PriceCacheJob) and Redis (existing PriceOverrideCache).

### Sensitive Data Handling

No sensitive data involved. Gold prices and config are public/internal data. No PII, no financial account data.

### Issues & Risks Summary

1. **Type code mismatch risk:** If admin adds a `type_code` that doesn't match any `asset_price` row, prices will show as stale/zero. Mitigate by validating against known types on create.
2. **Cache coherence:** If admin changes config, users see updates on next page load (React Query refetch). No real-time push needed.
3. **Migration safety:** Seed data must match current frontend constants exactly to avoid display regression.
4. **Empty config:** If all entries disabled/deleted, home/landing show empty gold table. Frontend should handle gracefully with EmptyState.

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Config table empty (all disabled) | Return empty array; frontend shows EmptyState |
| Config entry with no matching price in asset_price | Return config with buy=0, sell=0, is_stale=true |
| Admin deletes type that users have in investment portfolio | No impact — investment records reference type_code directly, not config table |
| Concurrent admin edits | GORM optimistic update; last write wins (acceptable for config) |
| Duplicate type_code on create | Return 409 Conflict with clear error message |
| type_code not found in gold registry | Return 400 Bad Request with "unknown gold type" message |

## Dependencies & Assumptions

- `asset_price` table is populated by existing PriceCacheJob (every 15 min)
- Admin role check uses existing `AdminMiddleware` from `handlers/middleware.go`
- Price overrides use existing `PriceOverrideCache` from Redis
- GOLD_USD_OPTIONS (XAUUSD) can be added to config table as a separate entry if needed, or kept as frontend constant for now (out of scope for MVP)

## Out of Scope

- USD gold types (XAUUSD) — keep frontend constant for now; can be added to config table later
- Silver display config — can follow same pattern later if needed
- Drag-to-reorder UI — use display_order number input for MVP
- Real-time push updates on config change — React Query polling/refetch is sufficient
- Config versioning/history — simple CRUD is sufficient for MVP
