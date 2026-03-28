# Asset Price Bridge — Investment Price Resolution via Config-Driven Fetch Codes

## Summary

When all gold/silver price APIs are down, investment portfolio valuations become silently stale — the `PriceUpdateJob` calls `GoldPriceService`/`SilverPriceService` (waterfall, 4 sources), which fails and leaves `investment.current_price` at its old value with no staleness indicator. Meanwhile, the `asset_price` table (populated by `PriceCacheJob` from 8 parallel sources) may still have fresh data from sources the investment updater never checks.

This feature **bridges** the `asset_price` DB cache into the investment price update path. It generalizes `gold_display_config` into `asset_display_config` (supporting gold + silver), adds a `asset_config_fetch_code` join table mapping each display entry to multiple `asset_price.type_code` values with admin-configurable priority, and replaces live API calls in `MarketDataService` for gold/silver with a DB-only price resolution from the multi-source `asset_price` cache.

## User Stories

- As a user holding SJC gold, I want my portfolio PNL to stay fresh even when VangSaiGon and VangToday APIs are down, because SJC direct or DOJI direct may still have fresh prices in the cache.
- As an admin, I want to configure which `asset_price` type codes map to each display entry (e.g., SJC display maps to fetch codes `["SJC", "SJC_1L10"]`), so the system can fall back across sources automatically.
- As a user holding silver, I want the same resilient price resolution that gold users get.

## Functional Requirements

### FR-1: Generalize gold_display_config → asset_display_config

Rename and extend the existing `gold_display_config` table to support both gold and silver asset types.

**Acceptance criteria:**
- [ ] Table renamed to `asset_display_config` with new `asset_type` column (`"gold"` or `"silver"`)
- [ ] Unique constraint changes from `(type_code)` to `(type_code, asset_type)`
- [ ] Existing gold rows migrated with `asset_type="gold"`
- [ ] Silver display entries seeded (matching current silver types)
- [ ] All backend code (model, repository, service, handler) renamed from `GoldDisplayConfig*` to `AssetDisplayConfig*`
- [ ] Proto messages renamed: `AssetDisplayConfig`, `AssetDisplayPrice`, etc.
- [ ] Admin UI generalized with asset type filter/tabs
- [ ] Public endpoint updated: `GET /api/v1/public/asset-display-prices?assetType=gold`
- [ ] Existing frontend consumers (`GoldPriceTable`, `LandingGoldPriceTable`, `AddInvestmentForm`) updated to pass `assetType=gold`

### FR-2: New asset_config_fetch_code join table

Create a join table that maps each `asset_display_config` entry to one or more `asset_price.type_code` values with priority ordering.

**Acceptance criteria:**
- [ ] Table `asset_config_fetch_code` with columns: `id`, `config_id` (FK), `type_code` (string), `priority` (int), timestamps
- [ ] Unique constraint on `(config_id, type_code)` — no duplicate fetch codes per config
- [ ] Admin UI allows add/remove/reorder fetch codes per config entry
- [ ] Admin UI shows available `asset_price` type codes as suggestions (from DB)
- [ ] Seed data: map existing display entries to their known fetch codes (e.g., SJC display → `["SJC", "SJC_1L10"]`)

### FR-3: Price resolution from asset_price via fetch codes

New service method that resolves the best available price for a given display type code by querying `asset_price` through the fetch code mapping.

**Acceptance criteria:**
- [ ] Method: `AssetDisplayConfigService.ResolvePrice(ctx, typeCode, assetType) → (price int64, isStale bool, err error)`
- [ ] Queries `asset_config_fetch_code` for the config entry, ordered by `priority ASC`
- [ ] For each fetch code in priority order, queries `asset_price` for non-stale rows
- [ ] Returns the first non-stale price found (priority-based selection)
- [ ] If ALL fetch codes are stale, returns the freshest stale price (by `fetched_at`) as fallback
- [ ] If no `asset_price` rows exist at all, returns error (cold start scenario)

### FR-4: Bridge MarketDataService for gold/silver investments

Replace live API calls (`GoldPriceService`, `SilverPriceService`) in `MarketDataService` with DB reads from `asset_price` via the fetch code resolution.

**Acceptance criteria:**
- [ ] `MarketDataService.fetchGoldPriceFromAPI()` replaced: reads from `AssetDisplayConfigService.ResolvePrice()` instead of calling `GoldPriceService.FetchPriceForSymbol()`
- [ ] `MarketDataService.fetchSilverPriceFromAPI()` replaced: same pattern
- [ ] `PriceUpdateJob` for gold/silver investments makes ZERO live API calls — DB reads only
- [ ] Stocks/crypto path via Yahoo Finance remains unchanged
- [ ] Gold/silver price normalization (tael→gram, unit conversions) still applied correctly after DB read
- [ ] `GoldPriceService` dependency removed from `MarketDataService` constructor
- [ ] `SilverPriceService` dependency removed from `MarketDataService` constructor

### FR-5: Add PriceUpdatedAt to Investment model

Track when an investment's price was last successfully updated from market data (distinct from `UpdatedAt` which changes on any edit).

**Acceptance criteria:**
- [ ] New field `PriceUpdatedAt` (nullable `time.Time`) on `Investment` model
- [ ] Updated only when `UpdatePrices()` successfully applies a new price value
- [ ] NOT updated on manual edits, name changes, or other non-price modifications
- [ ] Proto field added to investment responses
- [ ] Frontend portfolio page uses `PriceUpdatedAt` (not `UpdatedAt`) for staleness indicator
- [ ] Staleness thresholds: green (<15min), yellow (15-60min), orange (1-24h), red (>24h)

## Non-Functional Requirements

- **Performance**: Price resolution query must complete in <10ms (small table JOINs on indexed columns). No live API calls per investment price update for gold/silver.
- **Availability**: If `asset_price` table is empty (cold start), fall back to existing `GoldPriceService` waterfall as emergency path.
- **Consistency**: Single source of truth for gold/silver prices — `PriceCacheJob` writes to `asset_price`, `PriceUpdateJob` reads from `asset_price` via config.
- **Security**: Admin-only CRUD for fetch code configuration. Public endpoint returns prices only, no internal IDs.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend (`c4-component-backend.md`)**: Rename `GoldDisplayConfigHandler/Service/Repository` → `AssetDisplayConfig*`. Add `AssetConfigFetchCode` repository. Update `MarketDataService` to show dependency on `AssetDisplayConfigService` instead of `GoldPriceService`/`SilverPriceService`.
- **L3 Frontend (`c4-component-frontend.md`)**: Update admin components from `GoldDisplayConfig*` → `AssetDisplayConfig*`.

### New Diagrams

None — no new bounded context. Changes fit within existing investment domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-investment.md`**: Update "Market Price Update" sequence diagram — replace `GoldPriceService` waterfall with `AssetDisplayConfigService.ResolvePrice()` → `asset_price` DB read.
- **`flow-cross-cutting.md`**: Update "Background Scheduler" section to clarify `PriceCacheJob` is the sole writer to `asset_price`, and `PriceUpdateJob` is now a reader (not a separate API caller for gold/silver).

### New Flow Diagrams

**Add to `flow-investment.md`**: "Gold/Silver Price Resolution via Fetch Codes"
- Sequence diagram: `PriceUpdateJob` → `MarketDataService` → `AssetDisplayConfigService.ResolvePrice()` → `asset_config_fetch_code` → `asset_price` → pick best by priority → return price
- Include fallback path: all stale → pick freshest stale → return with isStale flag

## Data Model Changes

### Renamed table: `gold_display_config` → `asset_display_config`

```sql
ALTER TABLE gold_display_config RENAME TO asset_display_config;

ALTER TABLE asset_display_config
  ADD COLUMN asset_type VARCHAR(20) NOT NULL DEFAULT 'gold';

-- Drop old unique constraint and create new composite one
ALTER TABLE asset_display_config
  DROP CONSTRAINT idx_gold_display_config_type_code;
ALTER TABLE asset_display_config
  ADD CONSTRAINT idx_asset_display_config_type_code_asset_type UNIQUE (type_code, asset_type);
```

### New table: `asset_config_fetch_code`

```sql
CREATE TABLE asset_config_fetch_code (
  id          SERIAL PRIMARY KEY,
  config_id   INTEGER NOT NULL REFERENCES asset_display_config(id) ON DELETE CASCADE,
  type_code   VARCHAR(50) NOT NULL,   -- matches asset_price.type_code
  priority    INTEGER NOT NULL DEFAULT 0,  -- lower = higher priority
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,  -- GORM soft delete
  CONSTRAINT idx_asset_config_fetch_code_unique UNIQUE (config_id, type_code)
);

CREATE INDEX idx_asset_config_fetch_code_config_id ON asset_config_fetch_code(config_id);
```

### Modified table: `investment`

```sql
ALTER TABLE investment
  ADD COLUMN price_updated_at TIMESTAMPTZ;
```

### Seed data: fetch codes

| Display TypeCode | Asset Type | Fetch Codes (priority order) |
|-----------------|------------|------------------------------|
| SJC | gold | `SJC` (1), `SJC_1L10` (2) |
| SJC TD | gold | `SJC TD` (1) |
| Nhẫn SJC 9999 | gold | `Nhẫn SJC 9999` (1), `SJC_NHAN_999` (2) |
| Nhẫn Doji 9999 | gold | `Nhẫn Doji 9999` (1), `DOJI_NHAN_999` (2) |
| SJC Mi Hồng | gold | `SJC Mi Hồng` (1) |
| Nhẫn Mi Hồng 9999 | gold | `Nhẫn Mi Hồng 9999` (1) |
| SJC BTMC | gold | `SJC BTMC` (1), `BTMC_VANG_MIENG` (2) |
| Nhẫn BTMC | gold | `Nhẫn BTMC` (1), `BTMC_NHAN_999` (2) |
| PNJ | gold | `PNJ` (1), `PNJ_SJC` (2) |

> **Note:** Exact fetch code values for direct sources (SJC_, DOJI_, BTMC_, PNJ_) must be verified against actual `asset_price` table data at implementation time. Run `SELECT DISTINCT type_code, source FROM asset_price WHERE asset_type='gold' ORDER BY source, type_code` to confirm.

## API Changes

### Modified endpoints (rename from gold → asset)

| Old Path | New Path | Change |
|----------|----------|--------|
| `GET /api/v1/public/gold-display-prices` | `GET /api/v1/public/asset-display-prices?assetType=gold` | Add `assetType` query param |
| `GET /api/v1/admin/gold-display-config` | `GET /api/v1/admin/asset-display-config?assetType=gold` | Add `assetType` filter |
| `POST /api/v1/admin/gold-display-config` | `POST /api/v1/admin/asset-display-config` | Body includes `assetType` |
| `PUT /api/v1/admin/gold-display-config/:id` | `PUT /api/v1/admin/asset-display-config/:id` | Unchanged body |
| `DELETE /api/v1/admin/gold-display-config/:id` | `DELETE /api/v1/admin/asset-display-config/:id` | Unchanged |

### New endpoints (fetch code management)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/admin/asset-display-config/:id/fetch-codes` | Admin | List fetch codes for a config entry |
| `POST` | `/api/v1/admin/asset-display-config/:id/fetch-codes` | Admin | Add fetch code with priority |
| `PUT` | `/api/v1/admin/asset-display-config/:id/fetch-codes/:fcId` | Admin | Update priority |
| `DELETE` | `/api/v1/admin/asset-display-config/:id/fetch-codes/:fcId` | Admin | Remove fetch code |
| `GET` | `/api/v1/admin/asset-price-type-codes?assetType=gold` | Admin | List distinct type_codes from `asset_price` for suggestions |

### New proto field on Investment

```protobuf
message Investment {
  // ... existing fields ...
  int64 price_updated_at = XX;  // Unix timestamp, when price was last updated from market data
}
```

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|-------------------|----------|
| Config list table | GoldDisplayConfigTable (rename) | `features/admin/components/` |
| Config create/edit form | GoldDisplayConfigForm (rename) | `features/admin/components/` |
| Toggle switches | FormToggle | `components/forms/` |
| Number input (priority) | FormNumberInput | `components/forms/` |
| Confirmation dialog | ConfirmationDialog | `components/modals/` |
| Base modal | BaseModal | `components/modals/` |
| Staleness indicator | Existing pulsing dot in InvestmentCardEnhanced | `app/[locale]/dashboard/portfolio/components/` |
| Mobile table | MobileTable | `components/table/` |
| Empty state | EmptyState | `components/feedback/` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| FetchCodeList | `features/admin/components/FetchCodeList.tsx` | Sub-component within config form to manage ordered fetch codes. No existing component handles priority-ordered tag lists with add/remove/reorder. |

### Admin UI changes

- Rename "Gold Display Config" tab → "Asset Display Config" with sub-tabs for Gold / Silver
- Each config entry's edit form gains a "Fetch Codes" section:
  - Ordered list showing current fetch codes with priority numbers
  - "Add" button with autocomplete from `asset_price` distinct type_codes
  - Drag-to-reorder or up/down arrows to change priority
  - Delete button per fetch code
- New "Available Type Codes" reference panel showing all `asset_price.type_code` values grouped by source

### Portfolio page changes

- Replace `UpdatedAt`-based staleness indicator with `PriceUpdatedAt`-based
- Staleness thresholds unchanged: green (<15min), yellow (15-60min), orange (1-24h), red (>24h)
- Tooltip on staleness dot: "Price last updated X ago"

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin (browser) | Fetch code config (type_code, priority) | Yes: Internet → App | AssetDisplayConfig Handler | Untrusted input, admin-only |
| 2 | Handler | Validated config | No (same tier) | AssetDisplayConfig Service | Input validated |
| 3 | Service | Domain model | Yes: App → DB | PostgreSQL (asset_config_fetch_code) | GORM parameterized |
| 4 | PriceCacheJob | Price data from 8 sources | Yes: External → App | PostgreSQL (asset_price) | Existing flow, unchanged |
| 5 | PriceUpdateJob | Read investment list | Yes: App → DB | PostgreSQL (investment) | Existing flow |
| 6 | MarketDataService | Read config + fetch codes | Yes: App → DB | PostgreSQL (asset_display_config, asset_config_fetch_code) | New DB read |
| 7 | MarketDataService | Read cached prices | Yes: App → DB | PostgreSQL (asset_price) | Replaces live API call |
| 8 | MarketDataService | Updated price | Yes: App → DB | PostgreSQL (investment.current_price, price_updated_at) | Existing write |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin fetch code CRUD | JWT + AdminMiddleware + input validation |
| App → DB | Config reads/writes | GORM parameterized queries |
| External → App (unchanged) | Price data from gold/silver APIs | PriceCacheJob validation (existing) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | Admin sets fetch code to invalid type_code → empty price lookups | Low | Validate type_code exists in asset_price before saving |
| T-2 | 1 | Internet → App | Elevation | Non-admin user accesses fetch code CRUD | Medium | AdminMiddleware on all CRUD routes (existing pattern) |
| T-3 | 6,7 | App → DB | Info Disclosure | Price resolution query leaks cross-user data | Low | No user-specific data in asset_price/config tables — prices are global |
| T-4 | 4 | External → App | Tampering | Manipulated price from one source poisons investment valuations | Medium | Priority-based selection means admin controls which source is preferred; stale marking prevents poisoned stale data from being used |
| T-5 | 7 | App → DB | DoS | Large number of fetch codes per config causes slow JOINs | Low | Cap fetch codes per config at 10 (validation) |

### Authorization Rules

| Operation | Admin | Regular User | Unauthenticated |
|-----------|-------|-------------|-----------------|
| CRUD asset_display_config | Yes | No | No |
| CRUD fetch codes | Yes | No | No |
| Read display prices | Yes | Yes | Yes (public endpoint) |
| Investment price update (background) | N/A (system) | N/A | N/A |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| fetch_code.type_code | string | 1-50 chars, must exist in asset_price | Required, trim, max length, DB existence check |
| fetch_code.priority | int | >= 0 | Required, non-negative |
| config.asset_type | string | "gold" or "silver" | Required, enum validation |
| fetch codes per config | array | max 10 | Count validation on add |

### External Dependency Risks

| Service | Change | Risk |
|---------|--------|------|
| Gold/Silver price APIs | No longer called by PriceUpdateJob | Lower risk — fewer direct API dependencies in the hot path |
| asset_price table | Now critical for both market prices page AND portfolio valuation | If PriceCacheJob fails completely AND DB has no cached data → investment prices cannot update. Mitigated by emergency fallback to GoldPriceService |

### Sensitive Data Handling

No new sensitive data. Fetch code configuration is admin-internal. Prices are public market data.

### Issues & Risks Summary

1. **Seed data accuracy** — Fetch code mappings depend on actual `asset_price.type_code` values from each source. Must verify against live DB before seeding.
2. **Cold start** — If `asset_price` is empty, price resolution returns error. Emergency fallback to `GoldPriceService` waterfall needed.
3. **Migration risk** — Renaming `gold_display_config` → `asset_display_config` affects existing data and all consumers. Must be atomic migration with backward-compatible API (old routes redirect or kept temporarily).
4. **Silver seed data** — Need to identify correct silver type codes and fetch code mappings. Verify against `asset_price WHERE asset_type='silver'`.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| Config entry has no fetch codes configured | Price resolution returns error → investment keeps old price |
| All fetch codes are stale in asset_price | Return freshest stale price (by `fetched_at`) → investment updates with best available |
| asset_price table empty (cold start) | Fall back to GoldPriceService/SilverPriceService waterfall (emergency path) |
| Fetch code type_code doesn't exist in asset_price | Skipped during resolution → try next priority |
| Admin deletes a config entry that investments reference | Investment symbol no longer matches any config → price resolution fails gracefully → old price kept |
| Multiple asset_price rows for same type_code (different sources) | Pick the non-stale one with latest `fetched_at` |
| PriceCacheJob hasn't run yet but PriceUpdateJob runs | asset_price empty → cold start fallback |

## Dependencies & Assumptions

- `PriceCacheJob` continues to run every 15 minutes, populating `asset_price` with 8 parallel sources
- `asset_price` unique constraint is `(type_code, currency, source)` — multiple rows per type_code expected
- Existing `gold_display_config` seed data (9 entries) is correct and complete
- Admin will configure fetch codes after migration (seed provides reasonable defaults)
- Silver type codes in `asset_price` follow similar patterns to gold

## Out of Scope

- Stock/crypto/currency investment price resolution — stays on Yahoo Finance
- Changes to `PriceCacheJob` or its 8 source fetchers
- Admin price override mechanism (already exists, unchanged)
- Frontend market prices page changes (already reads from `asset_price`)
- Historical price tracking or price history graphs
- Automated fetch code discovery (admin configures manually)
