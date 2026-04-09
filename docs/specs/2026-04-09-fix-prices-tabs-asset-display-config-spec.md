# Fix Prices Page Tabs & Asset Display Config Alignment Specification

## Summary

The prices page (`/dashboard/prices`) has two related bugs caused by the same architectural mismatch. First, the gold/silver/currency tabs are always visible even when the admin has no enabled items for those asset types. Second, the price items shown in those tabs do not match the admin asset display config: wrong display names, wrong type_codes, wrong sort order, and currency always empty. Both bugs share the same root cause: `GetMarketPrices` reads from `asset_price` directly (by config `type_code`, not fetch `type_code`), bypassing the `AssetDisplayConfigService.GetDisplayPrices()` method that already correctly resolves prices via the fetch-code priority chain and applies `display_name` and `display_order`. The fix switches the handler to use `GetDisplayPrices()` and adds frontend tab-hiding when a tab's data array is empty after a successful fetch.

## User Stories

- As a user, I want the prices page to only show gold/silver/currency tabs when that asset type has at least one enabled item in admin config, so I don't see empty tabs.
- As a user, I want the prices shown to match the admin display config (correct names, correct order), so the data is trustworthy.
- As an admin, I want disabling all currency configs to hide the currency tab from users, so the UI reflects my configuration.

## Functional Requirements

### FR-1: Switch `GetMarketPrices` to use `AssetDisplayConfigService.GetDisplayPrices()`

Replace `assetPriceSvc.GetAllPrices()` in `MarketPricesHandler` with three calls to `assetDisplayConfigSvc.GetDisplayPrices(ctx, assetType)` for `"gold"`, `"silver"`, `"currency"`. Map the resulting `AssetDisplayPriceDTO` slices to the existing `PriceItem` proto message.

**Acceptance criteria:**
- [ ] `MarketPricesHandler` no longer depends on `AssetPriceService`
- [ ] `MarketPricesHandler` accepts `AssetDisplayConfigService` as a dependency
- [ ] `GET /api/v1/investments/market-prices` returns prices resolved via fetch-code priority chain
- [ ] Response `name` field uses `display_name` from `asset_display_config`, not raw name from `asset_price`
- [ ] Response `typeCode` field uses config `type_code` (e.g. `"USD"`), not fetch type_code (e.g. `"USD_VCB"`)
- [ ] Items within each asset type are ordered by `display_order ASC`
- [ ] Only items with `enabled=true` are returned
- [ ] Currency items are returned correctly (not empty array)
- [ ] `isStale` flag is preserved from `AssetDisplayPriceDTO`

### FR-2: Wire `AssetDisplayConfigService` into `MarketPricesHandler`

Update `handlers/builder.go` to pass `services.AssetDisplayConfig` when constructing `MarketPricesHandler`. Update `NewMarketPricesHandler` constructor signature.

**Acceptance criteria:**
- [ ] `NewMarketPricesHandler` accepts `AssetDisplayConfigService` as a parameter
- [ ] Builder wires the service correctly
- [ ] No nil pointer panics at startup

### FR-3: Map `AssetDisplayPriceDTO` to `PriceItem` proto response

`AssetDisplayPriceDTO` has: `TypeCode`, `DisplayName`, `Buy`, `Sell`, `ChangeBuy`, `ChangeSell`, `Currency`, `UpdatedAt`, `IsStale`, `Enabled`, `DisplayOrder`. The existing `PriceItem` proto has: `typeCode`, `buy`, `sell`, `changeBuy`, `changeSell`, `currency`, `updatedAt`, `name`, `isOverridden`, `isStale`.

Map:
- `TypeCode` → `typeCode`
- `DisplayName` → `name`
- `Buy` → `buy`
- `Sell` → `sell`
- `ChangeBuy` → `changeBuy`
- `ChangeSell` → `changeSell`
- `Currency` → `currency`
- `UpdatedAt.Unix()` → `updatedAt`
- `IsStale` → `isStale`
- `isOverridden` → keep existing override cache logic (price override check still applies)

**Acceptance criteria:**
- [ ] All `PriceItem` fields correctly populated from `AssetDisplayPriceDTO`
- [ ] Price override cache check still applied (existing `overrideCache` logic retained)
- [ ] No regression on `isOverridden` field

### FR-4: Frontend — hide gold/silver/currency tabs when array is empty after successful load

In the prices page, dynamically filter the `TABS` array: remove `"gold"`, `"silver"`, `"currency"` from the tab list when `isSuccess` (query succeeded) and the corresponding array is empty. The tabs are always shown during loading or error states to avoid flicker.

**Acceptance criteria:**
- [ ] Gold tab hidden when `isSuccess && (data?.gold ?? []).length === 0`
- [ ] Silver tab hidden when `isSuccess && (data?.silver ?? []).length === 0`
- [ ] Currency tab hidden when `isSuccess && (data?.currency ?? []).length === 0`
- [ ] `priceAlerts`, `watchlist`, `symbol` tabs always visible (unaffected)
- [ ] During `isLoading` or `isError`, all tabs remain visible (no flicker)
- [ ] If active tab gets hidden, switch to first visible tab

## Non-Functional Requirements

- **Performance:** `GetDisplayPrices()` makes 3 DB calls (one per asset type) instead of 2. All results are served from the `asset_price` table which is already populated by the scheduler; no external API calls at request time. Acceptable.
- **Security:** No new endpoints, no auth changes. Public endpoint behavior unchanged.
- **Correctness:** Price resolution must use the same fetch-code priority logic as the scheduler and investment price update path — ensuring consistency across all price surfaces.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md`** (L3 Backend): Update `MarketPricesHandler` component to show dependency on `AssetDisplayConfigService` instead of `AssetPriceService`. Update relationship arrow.
- **`c4-code-investment.md`** (L4 Code): Update `MarketPricesHandler` class to reflect new constructor signature.

### New Diagrams

None needed — no new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-investment.md`**: Update the "Market Price Update" sequence diagram to reflect that `GetMarketPrices` endpoint now calls `AssetDisplayConfigService.GetDisplayPrices()` instead of `AssetPriceService.GetAllPrices()`. The flow becomes:

```
Browser → GET /market-prices → MarketPricesHandler
  → AssetDisplayConfigService.GetDisplayPrices("gold")
      → configRepo.ListByAssetType("gold") [enabled=true, order by display_order]
      → for each config: ResolvePrice(typeCode, "gold") [fetch code priority]
  → AssetDisplayConfigService.GetDisplayPrices("silver") [same]
  → AssetDisplayConfigService.GetDisplayPrices("currency") [same]
  → apply price overrides (overrideCache)
  → return {gold, silver, currency}
```

### New Flow Diagrams

None.

## Data Model Changes

No schema changes. The fix is purely in the service layer and handler wiring. `asset_display_config` and `asset_config_fetch_code` tables are unchanged.

## API Changes

**`GET /api/v1/investments/market-prices`** — response shape unchanged, values corrected:

| Field | Before (broken) | After (fixed) |
|-------|----------------|---------------|
| `gold[].typeCode` | Raw fetch type_code (e.g. `"BTSJC"`) | Config type_code (e.g. `"BTMC"`) |
| `gold[].name` | Raw `asset_price.name` (e.g. `"Bao Tin SJC"`) | Config `display_name` (e.g. `"SJC BTMC"`) |
| `gold[]` ordering | Arbitrary DB insertion order | `display_order ASC` |
| `currency[]` | Always `[]` | Correct currency prices |
| `silver[].typeCode` | Raw fetch type_code | Config type_code |

No proto changes needed — `PriceItem` message already has all required fields.

## UI/UX Changes

### Prices Page Tab Filtering

The `TABS` constant in `prices/page.tsx` becomes dynamic: filter out gold/silver/currency tabs when their data is empty after successful load.

```typescript
// Before (static):
const TABS = [priceAlerts, watchlist, gold, silver, currency, symbol]

// After (dynamic):
const visibleTabs = useMemo(() => {
  const dynamicTabs = [priceAlerts, watchlist];
  if (!isSuccess || (data?.gold ?? []).length > 0) dynamicTabs.push(goldTab);
  if (!isSuccess || (data?.silver ?? []).length > 0) dynamicTabs.push(silverTab);
  if (!isSuccess || (data?.currency ?? []).length > 0) dynamicTabs.push(currencyTab);
  dynamicTabs.push(symbolTab);
  return dynamicTabs;
}, [isSuccess, data?.gold, data?.silver, data?.currency]);
```

If `activeTab` is no longer in `visibleTabs`, reset to `"priceAlerts"` (first tab).

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Tab bar | `TabBar` | `components/navigation/TabBar` |
| Price tables | `TanStackTable`, `MobileTable` | `components/table/` |
| Loading skeletons | Built into table components | — |

### New Components

None needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | `GET /api/v1/investments/market-prices` (no body) | Yes: Internet → App | `MarketPricesHandler` | No user input, no auth required |
| 2 | `MarketPricesHandler` | `assetType` string literal (`"gold"/"silver"/"currency"`) | No | `AssetDisplayConfigService` | Internal constant, not user-supplied |
| 3 | `AssetDisplayConfigService` | DB query by asset_type | Yes: App → DB | PostgreSQL `asset_display_config` | GORM parameterized |
| 4 | `AssetDisplayConfigService` | DB query by type_codes | Yes: App → DB | PostgreSQL `asset_price` | GORM parameterized |
| 5 | PostgreSQL | Config rows + price rows | Yes: DB → App | `AssetDisplayConfigService` | Trusted internal data store |
| 6 | `MarketPricesHandler` | `{gold, silver, currency}` price arrays | Yes: App → Internet | Browser | Public read-only data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | GET request (no body, no auth) | Rate limiting (existing), no input to validate |
| App → DB | GORM queries | Parameterized queries, no user input in query |
| App → Internet | JSON response | Read-only public price data, no PII |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | DoS | Endpoint hammered, DB overloaded by repeated price lookups | Low | Existing rate limiting; prices are read-only, DB queries are indexed by asset_type |
| T-2 | 1 | Internet → App | Info Disclosure | Error response leaks internal DB structure | Low | `handler.HandleError` already abstracts errors; no change introduced |
| T-3 | 3–4 | App → DB | Tampering | SQL injection via asset_type | None | `assetType` is a hardcoded constant (`"gold"/"silver"/"currency"`), never user-supplied |
| T-4 | 5 | DB → App | Tampering | Corrupted price data in DB affects display | Low | Admin-only write path (existing auth); prices sourced from trusted scheduler |
| T-5 | 6 | App → Internet | Info Disclosure | Currency configs reveal admin configuration | Low | Data is already public (prices endpoint is unauthenticated); no PII exposed |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Read market prices | Allowed | Allowed | Allowed (public) |
| Modify asset display config | Admin only | Denied | Denied |

No authorization changes in this fix.

### Input Validation Rules

No user input is accepted by `GetMarketPrices`. The `assetType` values (`"gold"`, `"silver"`, `"currency"`) are hardcoded constants in the handler, not query params. No new validation needed.

### External Dependency Risks

`GetDisplayPrices()` reads from `asset_price` table (already cached by the scheduler). No new external API calls introduced. Same failure modes as before: if the scheduler hasn't populated prices, `ResolvePrice()` returns an error or stale flag — existing behavior unchanged.

### Sensitive Data Handling

Market prices are public data. No PII, no financial user data, no authentication tokens involved in this endpoint.

### Issues & Risks Summary

1. **Price override cache**: The existing `overrideCache` logic in `MarketPricesHandler` checks Redis for admin price overrides. The fix must preserve this — apply override check after mapping `AssetDisplayPriceDTO` to `PriceItem`, same as before.
2. **`isSuccess` dependency for tab hiding**: React Query's `isSuccess` is `true` only on the first successful fetch. On refetch, `isSuccess` remains `true` and `data` is the previous result. This is correct behavior — tabs should not flicker during background refetches.
3. **Active tab reset**: If admin disables all gold items between page loads, and the user had `activeTab = "gold"`, the gold tab disappears. Must reset `activeTab` to first visible tab to avoid rendering an empty/invisible tab.

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| All gold configs disabled | `gold: []` returned; gold tab hidden |
| All configs disabled (all 3 types) | All three data tabs hidden; only priceAlerts, watchlist, symbol visible |
| `GetDisplayPrices()` returns error for one asset type | Handler returns error for full request (existing `HandleError` behavior) |
| Price is stale (`isStale: true`) | Item still shown with `isStale: true` flag (existing frontend stale indicator) |
| Price override exists in Redis | Override applied to `buy`/`sell` after DTO mapping, `isOverridden: true` set |
| Active tab hidden after data loads | Reset to `"priceAlerts"` |
| Network error on prices fetch | `isSuccess = false`, all tabs remain visible, error state shown |

## Dependencies & Assumptions

- `AssetDisplayConfigService.GetDisplayPrices()` is already implemented and correct — verified by DB query trace.
- `AssetDisplayConfigService` is already instantiated in `services.go` and available in the `Services` struct.
- The `PriceItem` proto message already has all fields needed (`name`, `isStale`, `isOverridden`); no proto changes required.
- `overrideCache` logic in handler must be preserved as-is.
- No migration needed — no schema changes.

## Out of Scope

- Adding a dedicated "show asset type tab" toggle in admin config (separate from per-item `enabled`).
- Changing the `priceAlerts`, `watchlist`, or `symbol` tab visibility logic.
- Modifying the `GetAssetDisplayPrices` public endpoint (separate endpoint, not used by prices page).
- Changing the admin `AssetDisplayConfigTable` UI.
- Adding pagination or filtering to the prices tables.
