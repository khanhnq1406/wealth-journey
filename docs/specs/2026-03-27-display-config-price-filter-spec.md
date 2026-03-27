# Display Config Price Filter — Specification

## Summary

All price-display endpoints currently return every row in the `asset_price` table, ignoring the `asset_display_config` table entirely. When an admin deletes or disables a display config entry (e.g. Silver World XAG/USD), that item continues to appear on the landing page and home dashboard because the two tables are fully independent. This fix makes `asset_price` read-paths respect `asset_display_config`: only items that have a matching **enabled, non-deleted** `asset_display_config` row are returned to any display-facing consumer. The `PriceCacheJob` (write-path) is unaffected — it continues to upsert all prices it fetches regardless of display config.

---

## User Stories

- As an admin, I want to delete or disable a silver display config entry, so that the item disappears from all public and authenticated price tables immediately on next page load.
- As an admin, I want to disable a gold type temporarily, so that it is hidden from users without permanently removing its price data from the cache.
- As a user, I want the landing page silver table and the home dashboard silver table to only show items the admin has configured, so I am not confused by entries the admin has removed.

---

## Functional Requirements

### FR-1: GetAllPrices filters by enabled asset_display_config

`AssetPriceService.GetAllPrices()` must only return `AssetPriceDTO` rows whose `type_code + asset_type` pair has a matching `asset_display_config` row with `enabled = true` AND `deleted_at IS NULL`.

**Acceptance criteria:**
- [ ] Deleting a display config → corresponding price row absent from `GetAllPrices` response
- [ ] Disabling (enabled=false) a display config → corresponding price row absent from `GetAllPrices` response
- [ ] Re-enabling a display config → row reappears in next `GetAllPrices` call
- [ ] Items with no matching display config row are excluded (default-deny)
- [ ] `asset_price` rows are NOT deleted; only the read filter changes

### FR-2: GetMarketTypes filters by enabled asset_display_config

`AssetPriceService.GetMarketTypes()` must only return type items whose `type_code + asset_type` pair has a matching enabled, non-deleted display config row. This fixes `GET /api/v1/public/market-types` (landing page `LandingSilverPriceTable`).

**Acceptance criteria:**
- [ ] Same filter criteria as FR-1
- [ ] Fallback to static registries still triggers when DB returns zero filtered results on cold start

### FR-3: GetPricesByAssetType filters by enabled asset_display_config

`AssetPriceService.GetPricesByAssetType()` must apply the same filter. This method is used by `ResolvePrice` internally — it must NOT be filtered (see Out of Scope).

**Note:** `GetPricesByAssetType` feeds `AssetDisplayConfigService.ResolvePrice`, which already gates results on fetch codes. Filtering here would break the fetch-code price resolution chain. This method is **excluded from filtering** (see Out of Scope).

### FR-4: GetPriceByTypeCode is not a display endpoint — excluded

`GetPriceByTypeCode` is an internal lookup used by investment pricing; it must not be filtered.

### FR-5: AssetPriceRepository gains a filtered list method

A new repository method `ListByAssetTypeFiltered(ctx, assetType, enabledTypeCodes []string)` accepts a pre-computed allowlist of type codes and returns only matching rows. The service layer fetches the enabled display config type codes and passes them in.

**Acceptance criteria:**
- [ ] Returns empty slice (not error) when `enabledTypeCodes` is empty
- [ ] SQL uses `WHERE type_code IN (?)` — GORM parameterized, no string interpolation

---

## Non-Functional Requirements

- **Performance:** The `asset_display_config` lookup adds one extra DB query per `GetAllPrices` / `GetMarketTypes` call. Both methods are called per HTTP request; the extra query is a simple indexed read (~1ms at expected scale). Acceptable.
- **Security:** No new trust boundary crossings. Filtering is server-side only; no client input influences which rows are included.
- **Backward compatibility:** `asset_price` rows are never deleted; re-enabling a display config immediately restores visibility.
- **Cold-start safety:** If `asset_display_config` has zero enabled rows for an asset type, the filtered result is empty. `GetPublicMarketTypes` already falls back to static registries when all arrays are empty — this fallback remains intact.

---

## Architecture Changes (C4)

### Diagrams to Update

**`c4-component-backend.md` (L3 Backend):** `AssetPriceService` now depends on `AssetDisplayConfigRepository` (new arrow). Add dependency: `AssetPriceService` → `AssetDisplayConfigRepository`.

No other C4 diagrams require changes — no new handlers, no new containers, no new external integrations.

### New Diagrams

None. The change is an internal service-layer dependency addition, not a new bounded context.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md` — §3 (Price Cache WRITER/READER pattern):** The READER section currently shows `GetAllPrices → asset_price table`. Add a note that the read path now joins against `asset_display_config` (enabled, non-deleted) before returning results.

Update the sequence diagram to add:
```
AssetPriceService->>AssetDisplayConfigRepo: ListEnabledTypeCodesByAssetType(assetType)
AssetDisplayConfigRepo-->>AssetPriceService: []enabledTypeCodes
AssetPriceService->>AssetPriceRepo: ListByAssetTypeFiltered(assetType, enabledTypeCodes)
```

---

## Data Model Changes

No schema changes. No new tables, no new columns, no migrations.

---

## API Changes

No API contract changes. Endpoint signatures, request shapes, and response shapes are unchanged. The only difference is that the response arrays may be shorter when display configs have been deleted or disabled.

---

## UI/UX Changes

No frontend changes required. The fix is entirely on the backend. The existing `SilverPriceTable`, `LandingSilverPriceTable`, `GoldPriceTable`, and `LandingGoldPriceTable` components will automatically reflect the filtered data.

**Note:** The frontend `staleTime: 30 * 60 * 1000` on `usePublicMarketTypes` and `staleTime: 5 * 60 * 1000` on `useQueryGetMarketPrices` mean that after an admin deletes a display config, users with warm caches may see stale data for up to 30 minutes (landing) / 5 minutes (home). This is acceptable — it is a pre-existing caching characteristic, not a regression introduced by this fix. A hard refresh (Cmd+Shift+R) will always show fresh data after this fix.

---

## Implementation Plan (Backend Only)

### Affected files

| File | Change |
|------|--------|
| `domain/repository/asset_display_config_repository.go` | Add `ListEnabledTypeCodesByAssetType(ctx, assetType)` method |
| `domain/repository/asset_price_repository.go` | Add `ListByAssetTypeFiltered(ctx, assetType, typeCodes []string)` method |
| `domain/service/interfaces.go` | Add both new method signatures to their respective repository interfaces + update `AssetPriceService` interface if needed |
| `domain/service/asset_price_service.go` | Inject `AssetDisplayConfigRepository`; update `GetAllPrices` and `GetMarketTypes` to call the filter chain |
| `internal/app/providers.go` | Pass `AssetDisplayConfigRepository` to `NewAssetPriceService` |
| `domain/service/asset_price_service_test.go` | New tests for filtered GetAllPrices + GetMarketTypes |
| `domain/repository/asset_display_config_repository_test.go` | New test for `ListEnabledTypeCodesByAssetType` |
| `domain/repository/asset_price_repository_test.go` | New test for `ListByAssetTypeFiltered` |

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | GET /market-prices or /public/market-types | Yes: Internet → App | MarketPricesHandler / PublicHandler | Public endpoints, no auth needed |
| 2 | Handler | Context | No | AssetPriceService | Same process |
| 3 | AssetPriceService | assetType string | No | AssetDisplayConfigRepository | Internal DB read |
| 4 | AssetDisplayConfigRepo | []enabledTypeCodes | No | AssetPriceService | Trusted DB result |
| 5 | AssetPriceService | assetType + []enabledTypeCodes | No | AssetPriceRepository | Internal DB read |
| 6 | AssetPriceRepository | []AssetPrice rows | No | AssetPriceService | Trusted DB result |
| 7 | AssetPriceService | filtered DTOs | No | Handler | Trusted internal |
| 8 | Handler | JSON response | Yes: App → Internet | Browser | No sensitive data |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | GET requests (flows 1) | Rate limiting (existing RateLimitByIP); no auth required (public data) |
| App → DB | Queries (flows 3, 5) | GORM parameterized queries; no user input reaches these queries |

### Threats Identified (STRIDE)

| Flow # | Boundary | STRIDE | Threat | Applies? | Mitigation |
|--------|----------|--------|--------|----------|------------|
| 1 | Internet → App | DoS | High-frequency requests to public endpoints flood DB | Low | Existing `RateLimitByIP` middleware |
| 1 | Internet → App | Tampering | User manipulates query params to bypass filter | No | `assetType` not user-supplied in this context; filter is server-side join |
| 5 | App → DB | Injection | `enabledTypeCodes` slice injected into SQL | No | GORM `WHERE type_code IN (?)` uses parameterized binding |
| 8 | App → Internet | Info Disclosure | Response leaks internal type codes or DB structure | Low | Only public price names/codes returned; no IDs, no deleted rows |

### Authorization Rules

| Operation | Unauthenticated | Authenticated User | Admin |
|-----------|----------------|-------------------|-------|
| GetAllPrices (market-prices) | Allowed (public) | Allowed | Allowed |
| GetMarketTypes (public/market-types) | Allowed (public) | Allowed | Allowed |
| Read asset_display_config (internal) | N/A | N/A | N/A (server-side only) |

No authorization changes needed. The filter is entirely server-side; no client can opt out of it.

### Input Validation Rules

No new user input is introduced. `assetType` string used in the filter is internally sourced (from the service method's parameter, not user request in the affected code paths).

### External Dependency Risks

No new external dependencies. The change only adds a DB join within the existing PostgreSQL connection.

### Sensitive Data Handling

No sensitive data involved. Price type codes and display names are public information.

### Issues & Risks Summary

1. **Cold-start risk**: If `asset_display_config` is empty (e.g. fresh DB, migration not yet run), `GetAllPrices` returns empty arrays. `GetPublicMarketTypes` already has a static fallback for this case. `GetMarketPrices` would return empty arrays — this is acceptable (same as cold-start before `PriceCacheJob` runs), but must be verified in tests.
2. **`ResolvePrice` must not be affected**: `AssetDisplayConfigService.ResolvePrice` calls `assetPriceRepo.ListByAssetType` directly (not via `GetAllPrices`). The fix must NOT alter that code path — it would break the fetch-code priority algorithm.
3. **Display config vs asset_price type_code alignment**: The filter matches on `type_code + asset_type`. Silver's `display_config.type_code` equals `asset_price.type_code` by design. Gold's configs may have multiple fetch codes — but `GetAllPrices` is not the path that uses fetch codes, so gold items are filtered by their `display_config.type_code`. Gold type codes in `asset_price` that have no direct `display_config` row (e.g. raw VangSaiGon codes with no display entry) will be excluded. This is the intended behavior — if it's not configured, it's not shown.

---

## Edge Cases & Error Handling

| Case | Behavior |
|------|----------|
| `asset_display_config` empty for an asset type | `ListEnabledTypeCodesByAssetType` returns `[]`; filtered price list is empty; handler returns empty array for that asset type |
| `asset_display_config` has rows but all disabled | Same as above — empty filtered result |
| `asset_price` has rows for a type code not in display config | Excluded from response — default-deny |
| `asset_price` has no rows for a configured type code | Not a problem — the join simply returns nothing for that code |
| `ListEnabledTypeCodesByAssetType` DB error | Propagated to caller; handler returns 500 via `HandleError` |
| `ListByAssetTypeFiltered` called with empty slice | Returns empty slice immediately (no DB query needed) |

---

## Dependencies & Assumptions

- `asset_display_config` rows for silver use `type_code` values that directly match `asset_price.type_code` (verified in the silver seed migration fix).
- `PriceCacheJob` continues writing all prices regardless of display config — the filter is read-only.
- `ResolvePrice` code path (`AssetDisplayConfigService`) is explicitly out of scope and must remain unmodified.

---

## Out of Scope

- `AssetPriceRepository.ListByAssetType` — used by `ResolvePrice`; must NOT be filtered.
- `AssetPriceRepository.GetPriceByTypeCode` — internal investment pricing lookup; must NOT be filtered.
- `AssetPriceRepository.ListAll` — internal; if it's used only by non-display paths (investment pricing), leave unfiltered. Check: currently used by `GetAllPrices` and `GetMarketTypes` (both in scope) and `GetPriceByTypeCode` (out of scope). After this fix, `GetAllPrices` and `GetMarketTypes` will call the new filtered method instead of `ListAll`.
- Frontend changes — not needed.
- Proto changes — not needed.
- `asset_display_config` CRUD behavior — unchanged.
- The `staleTime` caching on the frontend — acceptable pre-existing behavior.
