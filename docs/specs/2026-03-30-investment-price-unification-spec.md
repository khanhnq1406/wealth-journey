# Investment Price Unification Specification

## Summary

Unify the investment type system for Gold VND and Silver VND so that investment creation, price resolution, and type selection are all driven by the existing admin `asset_display_config` system — replacing the static registries in `pkg/gold/types.go` and `pkg/silver/types.go`. Admin controls which gold/silver types users can invest in via the `showInInvestment` flag. A DB seed migration replaces the hardcoded arrays, and the static registries are removed. Gold USD (`XAUUSD`) and Silver USD (`XAGUSD`) remain hardcoded as they are single-symbol world prices with no Vietnamese brand variants.

## User Stories

- As an **admin**, I want to add/remove/reorder gold and silver investment types from the admin panel, so that users see only the types I've configured — without requiring a code deployment.
- As a **user**, I want to see the same gold/silver type names and prices in my investment form as I see on the market prices page, so the experience is consistent.
- As a **developer**, I want a single source of truth (the DB) for gold/silver VND types, so I don't maintain parallel static arrays that drift out of sync.

## Functional Requirements

### FR-1: DB Seed Migration for Silver VND Display Configs

Seed `asset_display_config` + `asset_config_fetch_code` rows for all known Silver VND types currently hardcoded in `pkg/silver/types.go`. Gold VND configs already exist in the DB from prior migrations.

**Acceptance criteria:**
- [ ] Migration task `task backend:migrate-seed-silver-display-config` creates configs for all 10 Silver VND types (GOLDENFUND_1L, GOLDENFUND_5L, GOLDENFUND_10L, PHUQUY_1L, PHUQUY_5L, ANCARAT_1L, ANCARAT_5L, GOLDENFUND_1KG, PHUQUY_1KG, ANCARAT_1KG)
- [ ] Each config has `asset_type = "silver"`, `enabled = true`, `show_in_investment = true`
- [ ] Each config has at least one fetch code pointing to the matching `type_code` in `asset_price`
- [ ] Migration is idempotent (re-running doesn't create duplicates)

### FR-2: Backend — Replace Gold/Silver Type Endpoints with Display Config

Replace `GET /api/v1/investments/gold-types` and `GET /api/v1/investments/silver-types` to read from `asset_display_config` where `show_in_investment = true`, instead of static registries.

**Acceptance criteria:**
- [ ] `GET /api/v1/investments/gold-types?currency=VND` returns configs from DB where `asset_type = "gold"` AND `show_in_investment = true`, ordered by `display_order`
- [ ] `GET /api/v1/investments/silver-types?currency=VND` returns configs from DB where `asset_type = "silver"` AND `show_in_investment = true`, ordered by `display_order`
- [ ] USD variants (`currency=USD`) still return hardcoded `XAUUSD` / `XAGUSD` (unchanged)
- [ ] Response shape is backward-compatible: includes `code`, `name`, `currency`, `unit`, `unitWeight`, `type` fields
- [ ] Empty query param (`currency=`) returns both VND (from DB) + USD (hardcoded) merged

### FR-3: Backend — Remove Static Gold/Silver VND Type Registries

Remove the VND entries from `pkg/gold/types.go` (`GoldTypes` array) and `pkg/silver/types.go` (`SilverTypes` array). Keep only USD entries and utility functions that operate on `InvestmentType` enum (converters).

**Acceptance criteria:**
- [ ] `GoldTypes` array contains only USD gold entry (`XAUUSD` / `XAU`)
- [ ] `SilverTypes` array contains only USD silver entry (`XAGUSD`)
- [ ] `GetGoldTypeByCode` and `GetSilverTypeByCode` still work for USD types
- [ ] `GetGoldTypesByCurrency("VND")` returns empty slice (VND types now in DB)
- [ ] `GetNativeStorageInfo`, `IsGoldType`, `IsSilverType`, `ProcessMarketPrice` — unchanged (they switch on enum, not registry)
- [ ] `handlers/public.go` static fallback updated to read from DB or return empty for VND types
- [ ] `AliasToCanonical` map removed (already deprecated per code comments)
- [ ] No compilation errors across the codebase

### FR-4: Frontend — Silver VND Investment Form Reads from Admin Config API

Update `AddInvestmentForm` silver type dropdown to fetch from `useQueryGetAssetDisplayPrices({ assetType: "silver" })` (filtered by `showInInvestment`), matching the existing pattern for gold VND.

**Acceptance criteria:**
- [ ] Silver VND type dropdown fetches from asset-display-prices API, not hardcoded `SILVER_VND_OPTIONS`
- [ ] Silver USD (`XAGUSD`) remains hardcoded in `SILVER_USD_OPTIONS`
- [ ] Dropdown shows `displayName` from admin config, ordered by `displayOrder`
- [ ] When a silver type is selected, the correct `type` enum (10 = SILVER_VND), `symbol` (typeCode), and `currency` ("VND") are set
- [ ] Unit information (tael, kg) is derived from the typeCode pattern (same logic as `GetPriceUnitForMarketData`)

### FR-5: Frontend — Remove Hardcoded VND Gold/Silver Option Arrays

Remove `GOLD_VND_OPTIONS` from `gold-calculator.ts` and `SILVER_VND_OPTIONS` from `silver-calculator.ts`. Keep only USD options and utility functions.

**Acceptance criteria:**
- [ ] `GOLD_VND_OPTIONS` array removed from `features/investment/utils/gold-calculator.ts`
- [ ] `SILVER_VND_OPTIONS` array removed from `features/investment/utils/silver-calculator.ts`
- [ ] `GOLD_USD_OPTIONS` and `SILVER_USD_OPTIONS` remain unchanged
- [ ] `getGoldTypeOptions()` returns USD-only when called without API data
- [ ] `getSilverTypeOptions()` returns USD-only when called without API data
- [ ] All consumers updated: `AddInvestmentForm`, `AddToWatchlistForm`, price-alert validation
- [ ] No TypeScript compilation errors

### FR-6: Frontend — Watchlist and Price Alert Forms Use Admin Config

Update `AddToWatchlistForm` and price-alert validation to read from the admin config API instead of hardcoded VND arrays.

**Acceptance criteria:**
- [ ] `AddToWatchlistForm` gold/silver VND options come from `useQueryGetAssetDisplayPrices`
- [ ] Price alert validation references dynamic config, not static arrays
- [ ] Fallback to empty list if API unavailable (not broken UI)

## Non-Functional Requirements

- **Performance**: DB queries for display configs are lightweight (small table, indexed). No regression vs static arrays.
- **Backward compatibility**: Existing investments with symbols matching old static codes continue to work — `ResolvePrice` already handles this.
- **Migration safety**: Seed migration is additive (INSERT ... ON CONFLICT DO NOTHING). Existing admin-configured gold configs are not overwritten.
- **Cold start**: On first deploy before `PriceCacheJob` runs, investment type dropdowns show configs from DB (seeded), but prices may show as stale until first cache refresh.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend (`c4-component-backend.md`)**: Update `GoldHandler` and `SilverHandler` descriptions to note they now read from `AssetDisplayConfigService` instead of static registries.
- **L3 Frontend (`c4-component-frontend.md`)**: Update investment feature module description — silver type dropdown now API-driven like gold.

### New Diagrams

None needed — this is a data source change, not a new domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-investment.md`**: Update the "Create Investment" sequence to show gold/silver type resolution from `AssetDisplayConfigService` instead of static registry lookup.

### New Flow Diagrams

None — the flow structure doesn't change, only the data source.

## Data Model Changes

No new tables. Changes to existing data:

**`asset_display_config` table** — seed 10 Silver VND rows:

| type_code | asset_type | display_name | display_order | enabled | show_in_investment |
|-----------|-----------|-------------|--------------|---------|-------------------|
| GOLDENFUND_1L | silver | Golden Fund 1 Luong | 1 | true | true |
| GOLDENFUND_5L | silver | Golden Fund 5 Luong | 2 | true | true |
| GOLDENFUND_10L | silver | Golden Fund 10 Luong | 3 | true | true |
| PHUQUY_1L | silver | Phu Quy 1 Luong | 4 | true | true |
| PHUQUY_5L | silver | Phu Quy 5 Luong | 5 | true | true |
| ANCARAT_1L | silver | Ancarat 1 Luong | 6 | true | true |
| ANCARAT_5L | silver | Ancarat 5 Luong | 7 | true | true |
| GOLDENFUND_1KG | silver | Golden Fund 1 Kg | 8 | true | true |
| PHUQUY_1KG | silver | Phu Quy 1 Kg | 9 | true | true |
| ANCARAT_1KG | silver | Ancarat 1 Kg | 10 | true | true |

**`asset_config_fetch_code` table** — one fetch code per silver config, pointing to matching `type_code` in `asset_price`.

## API Changes

### Modified Endpoints

**`GET /api/v1/investments/gold-types`**
- Before: Returns static `pkg/gold/GoldTypes` array
- After: VND types from `AssetDisplayConfigService.ListForInvestment(ctx, "gold")`, USD types hardcoded
- Response shape unchanged: `[{code, name, currency, unit, unitWeight, type}]`

**`GET /api/v1/investments/silver-types`**
- Before: Returns static `pkg/silver/SilverTypes` array
- After: VND types from `AssetDisplayConfigService.ListForInvestment(ctx, "silver")`, USD types hardcoded
- Response shape unchanged: `[{code, name, currency, unit, unitWeight, type}]`

### New Service Method

**`AssetDisplayConfigService.ListForInvestment(ctx, assetType) → []AssetDisplayConfig`**
- Returns enabled configs where `show_in_investment = true`, ordered by `display_order`
- Used by gold/silver type handlers

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Silver type dropdown in investment form | AddInvestmentForm (already has gold API pattern) | `features/investment/forms/AddInvestmentForm.tsx` |
| Watchlist gold/silver type selection | AddToWatchlistForm | `features/watchlist/forms/AddToWatchlistForm.tsx` |
| Price alert type validation | price-alert-validation.ts | `features/price-alert/utils/price-alert-validation.ts` |

### New Components (if any)

None — all changes are to existing components, replacing data sources.

### Visual Changes

- Silver VND dropdown in `AddInvestmentForm`: options now come from admin config. Display names may differ slightly from hardcoded labels (admin-controlled). Order is `displayOrder` instead of array order.
- No layout or styling changes.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin (browser) | Display config CRUD | Yes: Internet -> App | Admin handler | Requires admin JWT |
| 2 | Admin handler | Config data | Yes: App -> DB | PostgreSQL | Parameterized GORM queries |
| 3 | User (browser) | Investment type selection | Yes: Internet -> App | Gold/Silver handler | Requires user JWT |
| 4 | Gold/Silver handler | Config query | Yes: App -> DB | PostgreSQL | Read-only query |
| 5 | AssetPriceService | Fetched prices | Yes: External -> App | asset_price table | From 11 price source APIs |
| 6 | PriceCacheJob | DB write | No (internal) | asset_price table | Background job |
| 7 | AssetDisplayConfigService | ResolvePrice | No (internal) | MarketDataService | Priority-based lookup |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|------------------|
| Internet -> App (Admin) | Admin config CRUD | JWT + AdminMiddleware |
| Internet -> App (User) | Type list queries, investment creation | JWT + AuthMiddleware |
| App -> DB | Config queries | GORM parameterized queries, ownership checks |
| External APIs -> App | Price data | Validation, stale marking, timeout |

### Threats Identified (STRIDE per boundary crossing)

| # | Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet -> App | Elevation | Non-admin modifies display configs | High | AdminMiddleware enforces admin role check |
| T-2 | 1 | Internet -> App | Tampering | Admin injects malicious displayName | Low | displayName is text-only, rendered as text in React (no dangerouslySetInnerHTML) |
| T-3 | 3 | Internet -> App | Tampering | User sends invalid symbol/typeCode in CreateInvestment | Medium | Backend validates symbol exists; price resolution fails gracefully for unknown symbols |
| T-4 | 4 | App -> DB | Info Disclosure | Type list query leaks disabled configs | Low | Handler filters by `enabled=true` AND `show_in_investment=true` |
| T-5 | 5 | External -> App | Tampering | Manipulated price from source | Medium | Existing mitigation: multi-source fallback, stale marking, admin overrides |

### Authorization Rules

| Operation | Admin | Authenticated User | Unauthenticated |
|-----------|-------|-------------------|-----------------|
| List investment types (gold/silver) | Allowed | Allowed | Denied |
| Create/update/delete display config | Allowed | Denied | Denied |
| Create investment with type | Allowed | Allowed | Denied |
| View display prices (public) | Allowed | Allowed | Allowed |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| assetType (query) | string | "gold", "silver", "currency" | Whitelist check in handler |
| currency (query) | string | ISO 4217, 3 chars | `validator.Currency()` |
| symbol (CreateInvestment) | string | Non-empty, max 50 chars | Validated in service layer |
| displayName (admin) | string | Non-empty, max 100 chars | Validated in service |

### External Dependency Risks

No new external dependencies. This feature only changes the internal data source from static arrays to existing DB tables.

### Sensitive Data Handling

No sensitive data involved. Display configs and type codes are non-sensitive public metadata.

### Issues & Risks Summary

1. **Data consistency risk**: If seed migration runs before `PriceCacheJob` populates `asset_price` for silver, fetch codes will reference type_codes that don't have price rows yet. Mitigation: `ResolvePrice` already handles this gracefully (returns error, frontend shows stale/empty).
2. **Breaking existing investments**: Investments already created with old typeCode symbols (e.g., `"SJC"`) must still resolve prices. Mitigation: Admin configs already exist for gold VND with matching typeCodes; silver seed will use the same codes as the static registry.
3. **Unit metadata loss**: Static registries carry `unit` and `unitWeight` fields. `AssetDisplayConfig` does not. Mitigation: Unit information is derived from `InvestmentType` enum and symbol suffix pattern (existing converter logic), not from the registry.
4. **Frontend/backend version skew during deployment**: If backend deploys before frontend, the type list API response shape changes. Mitigation: Response shape is kept backward-compatible.

## Edge Cases & Error Handling

- **Empty display configs**: If admin disables all gold/silver VND configs, the investment form shows only USD options. This is intentional admin control.
- **Unknown symbol in existing investment**: If an investment has a symbol that no longer matches any display config, `ResolvePrice` returns an error and the investment keeps its last known price (`PriceUpdatedAt` stops advancing, staleness indicator turns red).
- **Concurrent migration**: Seed migration uses `ON CONFLICT DO NOTHING` to be idempotent.
- **Silver price cache not populated**: On fresh deploy, silver configs exist in DB but `asset_price` may be empty for silver. Investment form shows types but price auto-fill won't work until first `PriceCacheJob` run (~15 min).

## Dependencies & Assumptions

- Gold VND display configs and fetch codes already exist in DB (from prior `task backend:migrate-asset-display-config` and related migrations)
- Silver prices are already being fetched by `PriceCacheJob` and stored in `asset_price` table with `asset_type = "silver"`
- `AssetDisplayConfigService.ResolvePrice` already works for silver (same algorithm as gold)
- Frontend `useQueryGetAssetDisplayPrices` hook already exists and is used for gold VND

## Out of Scope

- **Gold USD (XAUUSD)** and **Silver USD (XAGUSD)** — remain hardcoded, single world-price symbols
- **New admin UI for unit/weight metadata** — units are derived from enum + symbol pattern, not stored in display config
- **Currency type unification** — currency display configs are a separate concern
- **Removing `market_data` table** — Yahoo Finance cache for stocks/crypto is unrelated
- **Changing the `AssetDisplayConfig` model schema** — no new columns needed
