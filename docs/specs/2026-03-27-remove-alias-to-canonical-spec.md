# Remove AliasToCanonical from DB Write Path — Specification

## Summary

The `AliasToCanonical` map in `pkg/gold/types.go` normalizes raw external API TypeCodes into canonical codes **before** writing to the `asset_price` table. This contradicts the intended design of the `asset-price-bridge` feature: all raw fetched data should be stored as-is in the DB, and admins configure the mapping from `type_code` → `asset_display_config` via `asset_config_fetch_code`. The normalization silently hides raw codes from the admin UI picker, making it impossible for admins to map source-specific codes (e.g., `"DOHN"`, `"DOHCM"` for the two DOJI branches). This spec removes `AliasToCanonical` from the `PriceCacheJob → DB write path` while keeping it in the legacy `GoldPriceService` / `WaterfallGoldFetcher` live-API path.

## User Stories

- As an admin, I want the FetchCodeList picker to show ALL type codes that the price sources actually return, so that I can configure fine-grained source mappings.
- As an admin, I want to map both `"DOHN"` (DOJI Hanoi) and `"DOHCM"` (DOJI HCM) independently to display configs, so that I can show branch-specific prices.
- As a developer, I want the DB to be the source of truth for raw prices, with no silent pre-normalization, so that the admin mapping layer has complete visibility.

## Functional Requirements

### FR-1: Remove normalization from `refreshGoldVangSaiGon`

Remove the `AliasToCanonical` lookup from `asset_price_service.go`'s `refreshGoldVangSaiGon` method. Store raw TypeCodes returned by the vangsaigon API directly into `asset_price`.

**Acceptance criteria:**
- [ ] `refreshGoldVangSaiGon` does NOT call `gold.AliasToCanonical`
- [ ] Raw TypeCodes from vangsaigon API are stored in `asset_price.type_code` unchanged
- [ ] Multiple vangsaigon rows that previously collapsed to one canonical code now have distinct rows per raw TypeCode

### FR-2: Remove normalization from `WaterfallGoldFetcher` (price_fetcher.go) for the AllSources path

The `WaterfallGoldFetcher.FetchGoldPricesAllSources` is used by `AssetDisplayConfigService.GetDisplayPrices` (via `MarketDataService` bridging). That path reads from the DB cache (`ResolvePrice`), so the waterfall is only hit on cold start fallback. The alias normalization in the waterfall (`FetchGoldPrices` single-source path and `FetchGoldPricesAllSources`) should also be removed for consistency, since the DB is now the canonical store.

**Acceptance criteria:**
- [ ] `WaterfallGoldFetcher.FetchGoldPrices` does NOT call `gold.AliasToCanonical`
- [ ] `WaterfallGoldFetcher.FetchGoldPricesAllSources` does NOT call `gold.AliasToCanonical`

### FR-3: Update `asset_price_service.go` comment for `refreshGoldVangToday`

The comment "TypeCodes are already canonical from the fetcher" is misleading — it should say "TypeCodes are stored as returned by the API".

**Acceptance criteria:**
- [ ] Comment updated to reflect raw-storage intent

### FR-4: Update/remove `AliasToCanonical` tests that test DB write path normalization

Tests in `price_fetcher_test.go` that assert alias normalization happens in the waterfall fetcher path need to be removed or updated to assert raw codes pass through.

Tests in `pkg/gold/types_test.go` that validate the `AliasToCanonical` map entries remain (the map itself stays for any future use but is no longer called in the write path).

**Acceptance criteria:**
- [ ] Tests in `price_fetcher_test.go` that assert `AliasToCanonical` normalization are removed or updated to assert raw pass-through
- [ ] Tests in `pkg/gold/types_test.go` for `AliasToCanonical` can remain (map is not deleted, just unused in write path)
- [ ] All existing tests pass after changes

### FR-5: `ListAvailableTypeCodes` now returns raw API codes

Since `ListAvailableTypeCodes` queries `asset_price` directly, it will now return raw type codes (e.g., `"DOHN"`, `"DOHCM"`, `"BTSJC"`) instead of canonical ones. The admin FetchCodeList picker will show these raw codes. No code change needed — this is a behavioral consequence of FR-1.

**Acceptance criteria:**
- [ ] `ListAvailableTypeCodes` returns raw TypeCodes as stored in `asset_price` (no code change, behavioral)
- [ ] FetchCodeList admin UI picker shows raw codes (no code change needed in frontend)

## Non-Functional Requirements

- **No DB migration required** — the `asset_price` table schema is unchanged; only the values written to `type_code` column change
- **Backward compatibility** — existing `asset_config_fetch_code` rows that reference old canonical codes (e.g., `"Doji"`) will still work; they simply won't match vangsaigon rows until admin updates mappings (raw codes differ)
- **No API contract change** — no proto changes needed

## Architecture Changes (C4)

### Diagrams to Update

None — the `PriceCacheJob → AssetPriceService → asset_price` component relationship is unchanged. Only the normalization step inside the service is removed.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-investment.md` §10** (fetch-code sequence / ResolvePrice algorithm): Update the comment about TypeCode normalization. The step "normalize alias TypeCode" should be removed from the diagram. The raw TypeCode from the fetcher is what gets stored and what the admin maps.

### New Flow Diagrams

None.

## Data Model Changes

No schema changes. Behavioral change: `asset_price.type_code` will now contain raw API values (e.g., `"DOHN"`, `"DOHCM"`, `"BTSJC"`, `"BT9999"`) instead of normalized canonical values for the vangsaigon source.

**Migration note:** Existing rows in `asset_price` written with canonical codes will remain until the next `PriceCacheJob` run overwrites them with raw codes (same `source`, so upsert conflict replaces).

## API Changes

None — no proto changes, no endpoint changes.

## UI/UX Changes

None — the FetchCodeList picker already reads from `ListAvailableTypeCodes`. After the fix, it will show raw API codes. No component change needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | vangsaigon.vn API | Raw TypeCode strings | No (internal service call) | `asset_price` table | TypeCodes are ASCII strings max 50 chars; stored via parameterized GORM query |
| 2 | `asset_price` table | TypeCode strings | No | `ListAvailableTypeCodes` → admin UI | Admin-only route; XSS-safe via React JSX text rendering |
| 3 | Admin UI | Chosen TypeCode | Yes (browser → backend) | `asset_config_fetch_code.type_code` | Validated by `CreateFetchCode` against DB; only accepted if it exists in `asset_price` |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| External API → Backend | vangsaigon/vangtoday raw TypeCodes | TypeCode is stored, not executed; GORM parameterized insert; `size:50` DB constraint |
| Browser → Backend (admin) | FetchCode creation with TypeCode | `AuthMiddleware` + `AdminMiddleware`; `ListAvailableTypeCodes` validation on create |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | DF-3 | Browser → Backend | Tampering | Admin submits arbitrary TypeCode not in DB | Low | `CreateFetchCode` validates TypeCode exists in `ListAvailableTypeCodes` before accepting |
| T-2 | DF-1 | External API → Backend | Tampering | External API returns malicious TypeCode (e.g., SQL injection string) | Low | GORM parameterized queries; `size:50` column constraint truncates oversized values |
| T-3 | DF-2 | DB → Admin UI | Information Disclosure | Raw API codes exposed to admin | Acceptable | Admin-only route; raw codes are not sensitive |

### Authorization Rules

- `ListAvailableTypeCodes`: admin-only (`AuthMiddleware` + `AdminMiddleware`) — unchanged
- `CreateFetchCode`: admin-only — unchanged

### Input Validation Rules

- TypeCode max 50 chars enforced by DB schema — unchanged
- `CreateFetchCode` validates TypeCode exists in `asset_price` before insert — unchanged; now validates against raw codes

### External Dependency Risks

- vangsaigon.vn may return new/changed TypeCodes at any time — this is now by design; new codes appear in DB and admin can map them
- No new external dependencies introduced

### Sensitive Data Handling

TypeCodes are product codes (e.g., `"DOHN"`, `"SJC"`) — not sensitive. No PII involved.

### Issues & Risks Summary

1. **Existing `asset_config_fetch_code` rows with old canonical codes break** — After this change, vangsaigon rows in `asset_price` will have raw codes. Any existing fetch code mapping that used canonical codes (e.g., `"Doji"`) will no longer find a match in `ResolvePrice` until the admin updates the mapping. This is expected and intentional — the admin must re-map to raw codes.
2. **Test churn** — 7 tests in `price_fetcher_test.go` that assert normalization happens must be removed/updated. This is acceptable.
3. **Cold start fallback inconsistency** — `WaterfallGoldFetcher` (used as live-API fallback by `MarketDataService`) currently normalizes codes. If we also remove normalization there (FR-2), its output TypeCodes change. `MarketDataService` uses `ResolvePrice` (DB-first) and only falls back to the waterfall on cold start — so the fallback path would return raw codes to the portfolio valuation. This is acceptable since the fallback is temporary and DB is the stable path.

## Edge Cases & Error Handling

- **vangsaigon returns TypeCode longer than 50 chars** — GORM will fail with a constraint violation; `refreshGoldVangSaiGon` will mark that source stale (existing error handling). No code change needed.
- **Two vangsaigon TypeCodes that previously collapsed to one canonical now create two rows** — Correct behavior. The unique index is `(type_code, currency, source)` so they are distinct rows.
- **Existing DB rows with canonical codes** — The next `PriceCacheJob` run will upsert new raw-code rows. Old canonical-code rows remain orphaned (same source, different type_code) until they expire naturally or are manually cleaned. No migration needed since the DB has no FK on `asset_price` from `asset_config_fetch_code` — the mapping is by matching string.

## Dependencies & Assumptions

- The `asset_price` table unique index is `(type_code, currency, source)` — confirmed
- `ListAvailableTypeCodes` queries `asset_price` directly — confirmed
- `ResolvePrice` looks up `priceMap[fc.TypeCode]` where `fc.TypeCode` is admin-configured — confirmed
- `WaterfallGoldFetcher` is NOT called from `AssetPriceService` — confirmed (legacy path only)
- Admin will need to update existing `asset_config_fetch_code` rows after deployment to use raw codes

## Out of Scope

- Deleting the `AliasToCanonical` variable itself — keep it; it may be useful as documentation of known aliases even if no longer used in the write path
- Migrating existing `asset_config_fetch_code` rows to new raw codes — admin responsibility
- Changing the `GoldPriceService` live-API path (used by non-bridge endpoints) — out of scope for now; FR-2 covers only the waterfall normalization cleanup for the `FetchGoldPricesAllSources` path
- Adding a DB-managed alias table (Option C from analysis) — out of scope; may revisit if admin feedback indicates it's needed
