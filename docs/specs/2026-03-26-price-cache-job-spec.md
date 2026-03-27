# Price Cache Background Job Specification

## Summary

Currently, the `GetMarketPrices` handler fetches gold, silver, and currency prices **live** from external APIs on every request (with Redis caching). When all external APIs are down, the page breaks — users see empty data or errors. This feature introduces a **background job** that periodically fetches all prices and persists them to a new `asset_price` database table. The `GetMarketPrices` and `GetPublicMarketTypes` handlers switch to reading from the database exclusively, fully decoupling user requests from external API health.

## User Stories

- As a user, I want to see gold/silver/currency prices even when external price APIs are completely down, so that the market prices page always shows data.
- As a user, I want prices that couldn't be fetched to show as `--` (unavailable) rather than crashing the page, so that I understand the data is temporarily missing.
- As a user, I want the landing page to load fast regardless of upstream API health, so that my first impression of the app is always responsive.

## Functional Requirements

### FR-1: New `asset_price` Database Table

A new table to store the latest known prices for all asset types (gold, silver, currency).

**Schema:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `int32` | PK, auto-increment | Row ID |
| `type_code` | `varchar(50)` | NOT NULL, unique index with `currency` | Asset identifier (e.g., `SJL1L10`, `XAGUSD`, `USD`) |
| `asset_type` | `varchar(10)` | NOT NULL, index | `gold`, `silver`, or `currency` |
| `name` | `varchar(100)` | NOT NULL | Human-readable name |
| `buy` | `bigint` | NOT NULL, default 0 | Buy price (smallest currency unit) |
| `sell` | `bigint` | NOT NULL, default 0 | Sell price (smallest currency unit) |
| `change_buy` | `bigint` | NOT NULL, default 0 | Change in buy price |
| `change_sell` | `bigint` | NOT NULL, default 0 | Change in sell price |
| `currency` | `varchar(3)` | NOT NULL, unique index with `type_code` | ISO 4217 code (VND, USD) |
| `source` | `varchar(30)` | | Which API source provided this price |
| `is_stale` | `boolean` | NOT NULL, default false | True if last fetch failed (price is old/zero) |
| `fetched_at` | `timestamp` | NOT NULL | When this price was last successfully fetched from API |
| `created_at` | `timestamp` | NOT NULL | Row creation time |
| `updated_at` | `timestamp` | NOT NULL | Row last update time |
| `deleted_at` | `timestamp` | index, nullable | Soft delete (GORM convention) |

**Indexes:**
- `idx_asset_price_type_code_currency` — UNIQUE on `(type_code, currency)` for upsert
- `idx_asset_price_asset_type` — for filtering by gold/silver/currency

**Acceptance criteria:**
- [ ] Migration creates the `asset_price` table with all columns and indexes
- [ ] GORM model matches the schema above
- [ ] Upsert on `(type_code, currency)` — insert if new, update if exists

### FR-2: Background Price Fetch Job

A new scheduler job (`price_cache_job`) that runs every **15 minutes** and fetches all prices from the existing services, persisting results to `asset_price`.

**Flow:**
1. Call `GoldPriceService.FetchAllPrices(ctx)` — get all gold prices
2. Call `SilverPriceService.FetchAllPrices(ctx)` — get all silver prices
3. Call `CurrencyPriceService.FetchAllPrices(ctx)` — get all currency prices
4. For each successful result: **upsert** into `asset_price` (update existing or insert new)
5. For each failed asset type:
   - For assets that **already exist** in DB: **keep the old values** unchanged, set `is_stale = true`
   - For assets that **don't exist** in DB yet: **insert with buy=0, sell=0**, set `is_stale = true`

**Error handling per asset type (gold/silver/currency):**
- Each asset type is fetched independently — if gold fetch fails, silver and currency still proceed
- The job logs which asset types succeeded/failed with error details
- The job never panics — all errors are caught and logged

**Acceptance criteria:**
- [ ] Job runs every 15 minutes with 10-second startup delay
- [ ] Fetches gold, silver, currency independently (one failure doesn't block others)
- [ ] On fetch success: upserts all prices with current data, `is_stale = false`
- [ ] On fetch failure + asset exists in DB: keeps old values, sets `is_stale = true`
- [ ] On fetch failure + asset not in DB: inserts with `buy=0, sell=0`, sets `is_stale = true`
- [ ] Job logs summary: "Price cache job completed: gold=OK(25 items), silver=FAIL(error: timeout), currency=OK(12 items)"
- [ ] Job implements the existing `scheduler.Job` interface (`Run`, `Name`, `Interval`, `StartupDelay`)

### FR-3: Asset Price Repository

New repository for `asset_price` CRUD operations.

**Interface:**
```go
type AssetPriceRepository interface {
    UpsertBatch(ctx context.Context, prices []*models.AssetPrice) error
    ListByAssetType(ctx context.Context, assetType string) ([]*models.AssetPrice, error)
    ListAll(ctx context.Context) ([]*models.AssetPrice, error)
    GetByTypeCodeAndCurrency(ctx context.Context, typeCode, currency string) (*models.AssetPrice, error)
    MarkStaleByAssetType(ctx context.Context, assetType string) error
}
```

**Acceptance criteria:**
- [ ] `UpsertBatch` uses `ON CONFLICT (type_code, currency) DO UPDATE` for efficient bulk upsert
- [ ] `ListByAssetType` returns all prices for a given type (gold/silver/currency)
- [ ] `ListAll` returns all asset prices (for the combined endpoint)
- [ ] `MarkStaleByAssetType` sets `is_stale = true` for all rows of a given asset type

### FR-4: Asset Price Service

New service layer that the background job and handlers use.

**Interface:**
```go
type AssetPriceService interface {
    // Called by the background job
    RefreshAllPrices(ctx context.Context) error

    // Called by handlers
    GetAllPrices(ctx context.Context) (*AllAssetPrices, error)
    GetPricesByAssetType(ctx context.Context, assetType string) ([]*AssetPriceDTO, error)
    GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error)
}
```

**`AllAssetPrices` struct:**
```go
type AllAssetPrices struct {
    Gold     []*AssetPriceDTO
    Silver   []*AssetPriceDTO
    Currency []*AssetPriceDTO
}

type AssetPriceDTO struct {
    TypeCode   string
    Name       string
    Buy        int64
    Sell       int64
    ChangeBuy  int64
    ChangeSell int64
    Currency   string
    IsStale    bool
    FetchedAt  time.Time
}
```

**Acceptance criteria:**
- [ ] `RefreshAllPrices` calls gold/silver/currency services, handles errors per FR-2
- [ ] `GetAllPrices` reads from DB via repository, returns grouped by asset type
- [ ] `GetMarketTypes` reads from DB and returns type names + timestamps (for public endpoint)
- [ ] No live API calls are made during handler requests

### FR-5: Switch `GetMarketPrices` Handler to DB

The existing `GetMarketPrices` handler (`GET /api/v1/investments/market-prices`) switches from calling live price services to reading from `AssetPriceService.GetAllPrices()`.

**Response format remains identical:**
```json
{
  "success": true,
  "message": "Market prices retrieved successfully",
  "gold": [{ "typeCode", "buy", "sell", "changeBuy", "changeSell", "currency", "updatedAt", "name", "isOverridden", "isStale" }],
  "silver": [...],
  "currency": [...],
  "timestamp": "..."
}
```

**New field:** `isStale` (boolean) — `true` when the price couldn't be fetched (stale or zero).

**Admin price overrides** continue to work — applied on top of DB-sourced prices.

**Acceptance criteria:**
- [ ] Handler reads from `AssetPriceService`, not from `GoldPriceService`/`SilverPriceService`/`CurrencyPriceService` directly
- [ ] Response format is backward compatible (all existing fields present)
- [ ] New `isStale` field added to `PriceItem` proto message
- [ ] Admin price overrides still applied via `PriceOverrideCache`
- [ ] Handler never calls external APIs — DB only

### FR-6: Switch `GetPublicMarketTypes` Handler to DB

The public endpoint (`GET /api/v1/public/market-types`) switches from calling live services to reading from `AssetPriceService.GetMarketTypes()`.

**Acceptance criteria:**
- [ ] Handler reads from DB, not live services
- [ ] Response format unchanged: type names + `updatedAt` timestamps
- [ ] No authentication required (stays public)
- [ ] Landing page SSR + client-side hooks continue to work unchanged

### FR-7: Frontend — Display `--` for Zero/Stale Prices

When `buy === 0` or `sell === 0` or `isStale === true`, display `--` instead of `0` or a formatted zero.

**Acceptance criteria:**
- [ ] `formatPriceValue` in `helpers.ts` returns `"--"` when value is 0 or null/undefined
- [ ] Stale prices show `--` in both the dashboard prices page and the landing page
- [ ] No change to the price table layout or columns
- [ ] Change values (`changeBuy`/`changeSell`) also show `--` when stale

## Non-Functional Requirements

- **Latency**: Handler response time improves (DB read vs external API call). Expected < 50ms for `GetMarketPrices`.
- **Availability**: Prices always available from DB. Even during total API outage, last-known prices are served (or zeros with `--` display for truly new assets).
- **Backward compatible**: API response format is identical + one new optional field (`isStale`). Frontend shows `--` for zero prices.
- **No new external dependencies**: Uses existing `GoldPriceService`, `SilverPriceService`, `CurrencyPriceService` for fetching. Only adds a new DB table + repository + service.
- **Observability**: Job logs success/failure count per asset type on every run.

## Architecture Changes (C4)

### Diagrams to Update

**L3 Backend Components (`c4-component-backend.md`):**
- Add `AssetPriceRepository` in repository layer
- Add `AssetPriceService` in service layer
- Update `MarketPricesHandler` dependency: now depends on `AssetPriceService` instead of `GoldPriceService`/`SilverPriceService`/`CurrencyPriceService` directly
- Update `PublicHandler` dependency: now depends on `AssetPriceService`
- Add `PriceCacheJob` in scheduler layer, depends on `AssetPriceService`

**L2 Container (`c4-container.md`):**
- No changes — still same containers (Go backend, PostgreSQL, Redis)

### New Diagrams

No new L4 code diagram needed — the feature adds one model, one repository, one service, and one job. Not complex enough for L4.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — Add "Price Cache Background Job" sequence diagram:
- Scheduler → PriceCacheJob → GoldPriceService (external APIs)
- Scheduler → PriceCacheJob → SilverPriceService (external APIs)
- Scheduler → PriceCacheJob → CurrencyPriceService (external APIs)
- PriceCacheJob → AssetPriceRepository (DB upsert)
- Include error path: fetch failure → mark stale / insert zeros

**`flow-investment.md`** — Update "GetMarketPrices" sequence diagram:
- Old: Handler → GoldPriceService → External API → Redis cache
- New: Handler → AssetPriceService → AssetPriceRepository → PostgreSQL

### New Flow Diagrams

None — fits in existing files.

## Data Model Changes

### New Table: `asset_price`

```sql
CREATE TABLE asset_price (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) NOT NULL,
    asset_type VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    buy BIGINT NOT NULL DEFAULT 0,
    sell BIGINT NOT NULL DEFAULT 0,
    change_buy BIGINT NOT NULL DEFAULT 0,
    change_sell BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL,
    source VARCHAR(30),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT idx_asset_price_type_code_currency UNIQUE (type_code, currency)
);

CREATE INDEX idx_asset_price_asset_type ON asset_price (asset_type);
CREATE INDEX idx_asset_price_deleted_at ON asset_price (deleted_at);
```

### New GORM Model: `AssetPrice`

```go
type AssetPrice struct {
    ID         int32          `gorm:"primaryKey;autoIncrement"`
    TypeCode   string         `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency"`
    AssetType  string         `gorm:"size:10;not null;index:idx_asset_price_asset_type"`
    Name       string         `gorm:"size:100;not null"`
    Buy        int64          `gorm:"type:bigint;not null;default:0"`
    Sell       int64          `gorm:"type:bigint;not null;default:0"`
    ChangeBuy  int64          `gorm:"type:bigint;not null;default:0"`
    ChangeSell int64          `gorm:"type:bigint;not null;default:0"`
    Currency   string         `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency"`
    Source     string         `gorm:"size:30"`
    IsStale    bool           `gorm:"not null;default:false"`
    FetchedAt  time.Time      `gorm:"not null"`
    CreatedAt  time.Time
    UpdatedAt  time.Time
    DeletedAt  gorm.DeletedAt `gorm:"index"`
}

func (AssetPrice) TableName() string {
    return "asset_price"
}
```

## API Changes

### Modified: `PriceItem` Proto Message

Add `isStale` field to the existing `PriceItem` message in `investment.proto`:

```protobuf
message PriceItem {
  string typeCode = 1;
  int64 buy = 2;
  int64 sell = 3;
  int64 changeBuy = 4;
  int64 changeSell = 5;
  string currency = 6;
  int64 updatedAt = 7;
  string name = 8;
  bool isOverridden = 9;
  bool isStale = 10;       // NEW — true when price fetch failed
}
```

### No New Endpoints

Both `GetMarketPrices` and `GetPublicMarketTypes` keep their existing routes. Only the internal data source changes (live APIs → DB).

## UI/UX Changes

### Frontend Changes

Minimal — only price formatting logic changes.

**`helpers.ts`** — Update `formatPriceValue` to return `"--"` for zero/null/undefined values.

**`helpers.ts`** — Update `formatChangeValue` to return `"--"` for stale items.

**Landing page** — Same change: display `--` for zero prices.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price tables (dashboard) | Already built | `app/[locale]/dashboard/prices/page.tsx` |
| Price tables (landing) | Already built | `app/[locale]/landing/LandingContent.tsx` |
| Market prices hook | Already generated | `useQueryGetMarketPrices` in `utils/generated/hooks.ts` |
| Public market types hook | Custom hook | `features/market-prices/hooks/usePublicMarketTypes.ts` |
| Price formatting | Already built | `app/[locale]/dashboard/prices/helpers.ts` |

### New Components

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | External APIs (vangsaigon, vang.today, BTMC, Yahoo, etc.) | Gold/silver/currency JSON/XML | Yes: External API → App | PriceCacheJob (background) | Untrusted external data, validated by existing services |
| 2 | PriceCacheJob | Normalized prices | Yes: App → DB | PostgreSQL (`asset_price`) | Trusted after validation in service layer |
| 3 | PostgreSQL (`asset_price`) | Stored prices | Yes: DB → App | AssetPriceService | Trusted (we wrote it) |
| 4 | AssetPriceService | Price response | Yes: App → Internet | Frontend (user) | Public price data, non-sensitive |
| 5 | AssetPriceService | Market types | Yes: App → Internet | Frontend (unauthenticated) | Public types + timestamps only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| External API → App | Price data from multiple sources | Response validation (existing services), price range checks, timeout enforcement |
| App → PostgreSQL | Upsert price data | GORM parameterized queries, no user input in query |
| DB → App | Read price data | Trusted internal data |
| App → Internet (authenticated) | Price response | JWT auth middleware |
| App → Internet (public) | Market types | No auth required, no sensitive data |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | External → App | Tampering | Compromised API returns manipulated prices, job writes bad data to DB | **High** | Existing price validation in GoldPriceService/SilverPriceService (range checks, format validation). Job trusts the existing service layer's validation. |
| T-2 | 2 | App → DB | Tampering | SQL injection via type_code or name fields from external API | Low | GORM parameterized queries. No raw SQL. Fields are validated strings from known source registries. |
| T-3 | 4 | App → Internet | DoS | Spam `GetMarketPrices` to overload DB reads | Low | DB reads are fast (single table scan with index). Existing rate limiting on API. No external API fan-out. |
| T-4 | 1 | External → App | DoS | External API hangs, background job goroutine stuck | Medium | Existing per-source timeouts (5s). Job has overall context timeout. Job runs in its own goroutine, doesn't block user requests. |
| T-5 | 3 | DB → App | Info Disclosure | Stale prices served without indication | Low | `isStale` flag + frontend shows `--`. `fetchedAt` timestamp visible in response. |
| T-6 | 5 | App → Internet | Info Disclosure | Public endpoint leaks price data | Low | Public endpoint only returns type names + timestamps (no buy/sell prices). Same as current behavior. |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated | Notes |
|-----------|-------|------------|-----------------|-------|
| Read prices (dashboard) | Yes | Yes | No | JWT auth required, same prices for all users |
| Read market types (public) | Yes | Yes | Yes | Public endpoint, type names only |
| Write prices | N/A | N/A | N/A | Background job only — no user-facing write endpoint |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| External API gold response | JSON | Must have type_code, buy, sell | Existing GoldPriceService validation |
| External API silver response | JSON/HTML | Must have type_code, buy, sell | Existing SilverPriceService validation |
| External API currency response | JSON | Must have type_code, buy, sell | Existing CurrencyPriceService validation |
| type_code from API | string | max 50 chars, alphanumeric + underscore | Validated by existing client parsers |
| name from API | string | max 100 chars | Truncated if too long |

### External Dependency Risks

No NEW external dependencies. The background job calls the same existing services (`GoldPriceService`, `SilverPriceService`, `CurrencyPriceService`) that already handle external API calls with timeouts, retries, and validation.

**New Go dependencies:** None.
**New npm packages:** None.

### Sensitive Data Handling

No sensitive data. All price data is public market information. No user-specific data is stored in `asset_price`.

### Issues & Risks Summary

1. **T-1: Manipulated prices persisted to DB** — Mitigated by existing service-layer validation (price range checks, format validation). The background job trusts the existing services' output, which is already hardened by the price-fallback feature.
2. **Cold start** — On first deployment, the DB is empty. Users see `--` for all prices until the first job run completes (up to 15 minutes + 10s startup delay). Acceptable trade-off for simplicity.
3. **Job failure** — If the job crashes, prices freeze at their last-known values. The `is_stale` flag is only set when the job explicitly detects a fetch failure, not when the job itself crashes. This means stale data may show as fresh. Acceptable — the `fetched_at` timestamp still reveals true freshness.
4. **Table growth** — The table has a fixed number of rows (one per unique type_code + currency). Gold has ~25 types, silver ~15, currency ~12. Total ~52 rows. No growth concern.

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| First deployment — empty table | All prices show `--` until first job run |
| Gold API fails, silver/currency succeed | Gold shows `--` (or old values), silver/currency update normally |
| All three APIs fail | Existing rows keep old values with `is_stale = true`, new rows get zeros |
| Job crashes mid-execution | Partially written data is fine (each upsert is atomic). Next run completes fully. |
| Redis is down | Job still works — it calls the existing services which may fail their Redis cache reads but still attempt live API calls. DB writes are independent of Redis. |
| PostgreSQL is down | Job fails entirely, logs error. Next run retries. |
| Duplicate type_code from different sources | `(type_code, currency)` unique constraint prevents duplicates. Last writer wins. |
| External API returns price = 0 | Existing service validation rejects zero prices. Job treats as fetch failure → stale path. |
| External API returns extremely high/low price | Existing service range checks handle this. If it passes validation, it's stored. |
| Admin price override set on a stale item | Override is applied on top of DB data at handler level. Override takes precedence over stale flag. |

## Dependencies & Assumptions

**Dependencies:**
- Existing `GoldPriceService`, `SilverPriceService`, `CurrencyPriceService` continue to work as data sources
- PostgreSQL available for the new table
- Existing scheduler infrastructure (`internal/scheduler/`)

**Assumptions:**
- ~52 total asset prices (25 gold + 15 silver + 12 currency) — fixed set, not growing
- 15-minute refresh interval is acceptable for price freshness
- Users accept seeing `--` for up to 15 minutes on cold start
- The existing price services' validation is sufficient — no additional validation needed in the job

## Out of Scope

- **Replacing Redis caching** — The existing Redis caches (aggregate, per-symbol, emergency) remain for the price services' internal use. The DB is the new source of truth for handlers only.
- **Historical price storage** — The `asset_price` table stores only the LATEST price per asset. Historical price tracking is a separate feature.
- **Price change notifications** — Not triggering alerts when prices change. User price alerts are a separate feature.
- **Admin UI for job monitoring** — Job status is logged, not exposed via UI.
- **Configurable refresh interval** — Hardcoded to 15 minutes. Environment variable override is a future enhancement.
- **Removing live-fetch from handlers entirely** — The `GetMarketPrice` (single symbol lookup) endpoint still uses live services for on-demand price checks. Only `GetMarketPrices` (all prices) and `GetPublicMarketTypes` switch to DB.
