# Fix: Migrate Silver & Currency Price Tables to Asset Display Prices API

## Summary

Gold price tables on both the landing page and authenticated home page already use `GET /api/v1/public/asset-display-prices?assetType=gold` (`useQueryGetAssetDisplayPrices`). Silver and currency tables still use the older endpoints: the landing page uses `usePublicMarketTypes` (`/api/v1/public/market-types`) which returns display metadata only — no prices; the home page uses `useQueryGetMarketPrices` which returns raw `asset_price` rows without admin-configured source resolution or stale detection. This inconsistency means silver and currency cannot benefit from admin display configuration, multi-source price resolution, stale marking, or admin overrides.

**Goal:** Make silver and currency price tables on both landing page and home page use `GET /api/v1/public/asset-display-prices?assetType=silver` and `?assetType=currency` — identical to how gold already works.

## Original Feature Reference

- `docs/reports/2026-03-27-multi-source-currency-price-report.md`
- `docs/specs/2026-03-27-multi-source-currency-price-spec.md`

## Functional Requirements

### FR-1: Landing Page — Silver Table Uses Asset Display Prices

`LandingContent.tsx` currently uses `usePublicMarketTypes` to source silver data, passing `MarketTypeItem[]` to `LandingSilverPriceTable`. The component shows names only (no prices — prices are hidden behind a login prompt).

**Change:** Migrate `LandingSilverPriceTable` to receive `AssetDisplayPrice[]` (from `useQueryGetAssetDisplayPrices({ assetType: "silver" })`), making its data source and type consistent with `LandingGoldPriceTable` which already self-fetches via the same hook.

**Approach:** `LandingSilverPriceTable` becomes self-fetching (same as `LandingGoldPriceTable`) — removes prop dependency entirely, simplifying `LandingContent`.

**Acceptance criteria:**
- [ ] `LandingSilverPriceTable` calls `useQueryGetAssetDisplayPrices({ assetType: "silver" })` internally
- [ ] Component shows `item.displayName` (not `item.name || item.code`)
- [ ] Prices still hidden behind login prompt (landing page behavior unchanged)
- [ ] `LandingContent` no longer passes `types` or `isLoading` or `updatedTime` props to silver table
- [ ] Updated time derived from `prices.find(p => p.updatedAt > 0)?.updatedAt`

### FR-2: Landing Page — Currency Table Uses Asset Display Prices

Same migration as FR-1 but for `LandingCurrencyPriceTable`.

**Acceptance criteria:**
- [ ] `LandingCurrencyPriceTable` calls `useQueryGetAssetDisplayPrices({ assetType: "currency" })` internally
- [ ] Component shows `item.displayName`
- [ ] Prices still hidden behind login prompt
- [ ] `LandingContent` no longer passes `types`, `isLoading`, or `updatedTime` to currency table

### FR-3: Landing Page — Remove `usePublicMarketTypes` Dependency

Once FR-1 and FR-2 are complete, `LandingContent` no longer needs `usePublicMarketTypes` for silver or currency.

**Acceptance criteria:**
- [ ] `usePublicMarketTypes` removed from `LandingContent.tsx`
- [ ] `silverTypes`, `currencyTypes`, `silverUpdatedTime`, `currencyUpdatedTime` variables removed from `LandingContent`
- [ ] `PublicMarketTypesResponse` import removed from `LandingContent` (unless still used by SSR landing page)
- [ ] Check if `LandingGoldPriceTable` already self-fetches (it does — confirmed) — no change needed there
- [ ] Landing page `page.tsx` SSR path: check if `initialData` is still needed; remove if silver/currency are gone from `usePublicMarketTypes`

### FR-4: Home Page — Silver Table Uses Asset Display Prices

`home/page.tsx` currently sources silver prices from `useQueryGetMarketPrices({})` → `marketPrices?.silver` and passes `PriceItem[]` to `SilverPriceTable`. This endpoint returns raw `asset_price` rows — no display-config resolution, no admin overrides, no stale isolation per source.

**Change:** `SilverPriceTable` becomes self-fetching via `useQueryGetAssetDisplayPrices({ assetType: "silver" })` (same pattern as `GoldPriceTable`). Accepts no `prices` prop.

**Acceptance criteria:**
- [ ] `SilverPriceTable` calls `useQueryGetAssetDisplayPrices({ assetType: "silver" })` internally
- [ ] Displays `item.displayName` (not `item.name || item.typeCode`)
- [ ] Stale prices show `"--"` (same as gold)
- [ ] Admin inline-edit: `InlinePriceEdit` / `OverrideIndicator` use `item.typeCode` from `AssetDisplayPrice` — verify field exists (it does: `typeCode` is present in `AssetDisplayPrice` proto type)
- [ ] `home/page.tsx` no longer passes `prices`, `updatedTime`, `isAdmin`, `isLoading` to `SilverPriceTable`

### FR-5: Home Page — Currency Table Uses Asset Display Prices

Same as FR-4 but for `CurrencyPriceTable`.

**Acceptance criteria:**
- [ ] `CurrencyPriceTable` calls `useQueryGetAssetDisplayPrices({ assetType: "currency" })` internally
- [ ] Displays `item.displayName`
- [ ] Stale prices show `"--"`
- [ ] `home/page.tsx` no longer passes props to `CurrencyPriceTable`

### FR-6: Home Page — Clean Up `useQueryGetMarketPrices` Usage

After FR-4 and FR-5, check if `useQueryGetMarketPrices` is still needed in `home/page.tsx` for any other purpose.

**Acceptance criteria:**
- [ ] If gold is already removed from `useQueryGetMarketPrices` dependency (confirmed — `GoldPriceTable` self-fetches), and silver + currency are removed, then `useQueryGetMarketPrices` import and its variables (`marketPrices`, `marketPricesLoading`, `silverPrices`, `currencyPrices`, `silverUpdatedTime`, `currencyUpdatedTime`) are removed from `home/page.tsx`
- [ ] `isAdmin` prop removed from `SilverPriceTable` and `CurrencyPriceTable` (they'll self-fetch and derive `isAdmin` internally if needed — or remove inline-edit from these tables since gold table also doesn't have it)

## Architecture Changes (C4)

No new backend components, handlers, or services are added. This is a pure frontend data-source migration.

**C4 Frontend (`c4-component-frontend.md`):** Minor update — `LandingSilverPriceTable` and `LandingCurrencyPriceTable` in the `Landing` section now depend on `AssetDisplayPrices Hook` directly (same as `LandingGoldPriceTable`). `LandingContent` no longer depends on `usePublicMarketTypes` for silver/currency.

## Runtime Flow Diagrams

No backend flow changes. No new flow diagrams needed — this is a frontend hook swap. The existing `flow-cross-cutting.md` scheduler section already documents the `asset_price` cache refresh; the `GetPublicAssetDisplayPrices` endpoint is already documented.

## Data Model Changes

None — no backend changes.

## API Changes

No new endpoints. Existing `GET /api/v1/public/asset-display-prices?assetType=silver` and `?assetType=currency` already exist and are already seeded (via `migrate-asset-display-config`). Frontend just needs to call them.

**Response shape** (from `AssetDisplayPrice` proto):
- `typeCode: string`
- `displayName: string`
- `buy: string` (int64 as string)
- `sell: string`
- `currency: string`
- `isStale: bool`
- `updatedAt: string` (int64 Unix timestamp as string)
- `source: string`

## UI/UX Changes

### Landing Page

- `LandingSilverPriceTable`: removes `types`, `isLoading`, `updatedTime` props; self-fetches; shows `item.displayName`; shows loading skeleton while fetching (same pattern as `LandingGoldPriceTable`)
- `LandingCurrencyPriceTable`: same migration
- `LandingContent`: removes `usePublicMarketTypes`, silver/currency state vars, and props passed to tables; simplified

### Home Page

- `SilverPriceTable`: removes `prices`, `updatedTime`, `isAdmin`, `isLoading` props; self-fetches via `useQueryGetAssetDisplayPrices`; shows stale as `"--"`
- `CurrencyPriceTable`: same migration
- `home/page.tsx`: removes `useQueryGetMarketPrices`, silver/currency vars, and props; simplified

### Existing Component Inventory

| Need | Existing Component | Location |
|------|---|---|
| Silver price data | `useQueryGetAssetDisplayPrices({ assetType: "silver" })` | `utils/generated/hooks.ts` — already exists |
| Currency price data | `useQueryGetAssetDisplayPrices({ assetType: "currency" })` | same hook — already exists |
| Stale indicator | Render `"--"` if `item.isStale` | Pattern from `GoldPriceTable` |

No new components needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|---|---|---|---|---|
| 1 | Frontend (Browser) | `GET /api/v1/public/asset-display-prices?assetType=silver` | Yes: Internet → App | Go Backend `GetPublicAssetDisplayPrices` handler | No auth required — public endpoint |
| 2 | Go Backend | Silver/currency `AssetDisplayPrice[]` | Yes: App → Browser | Frontend components | Display-only data, no PII, no financials |
| 3 | Frontend (Browser) | `GET /api/v1/public/asset-display-prices?assetType=currency` | Yes: Internet → App | Go Backend | Same as #1 |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|---|---|---|
| Internet → App | Public GET requests | No auth; rate limiting at infra level |
| App → Browser | Price display data | No sensitive data; display-only |

### Threats Identified

| # | Data Flow | STRIDE | Threat | Severity | Mitigation |
|---|---|---|---|---|---|
| T-1 | 1, 3 | DoS | Excessive polling | Low | Same mitigation as existing gold endpoint; React Query `staleTime: 5*60*1000` prevents stampede |
| T-2 | 2 | Info Disclosure | None — prices are public data; no PII | None | N/A |
| T-3 | 1, 3 | Tampering | `assetType` param could be tampered | Low | Backend validates against known enum values; unknown returns empty `[]` |

### Authorization Rules

None required — `GetPublicAssetDisplayPrices` is a public endpoint (no `AuthMiddleware`), same as the existing gold call.

### Input Validation Rules

`assetType` is hardcoded as `"silver"` and `"currency"` in the frontend hooks — no user input involved.

### External Dependency Risks

No new external dependencies. Uses the same `useQueryGetAssetDisplayPrices` hook already used by gold.

### Sensitive Data Handling

Price data is public market data. No PII, no monetary account data, no secrets.

### Issues & Risks Summary

1. **`isAdmin` removal from SilverPriceTable / CurrencyPriceTable**: The home page currently passes `isAdmin` to enable `InlinePriceEdit`. After migration to self-fetching, these tables need to source `isAdmin` internally. Use `useAuth()` hook (same pattern). Low risk — gold table does not have inline edit, but the silver/currency tables do. Options: keep inline edit (use `useAuth` internally) or remove it. Recommendation: keep inline edit, use `useAuth()` internally.
2. **Landing page SSR (`page.tsx`)**: Currently calls `getPublicMarketTypes()` server-side and passes `initialData` for SSR hydration. After migration, `initialData` for silver/currency is unused. The gold section is already self-fetching (no SSR hydration). Recommendation: verify and clean up the landing `page.tsx` SSR call if `usePublicMarketTypes` is fully removed.
3. **`usePublicMarketTypes` used for gold SSR in landing page**: Need to verify `initialData.gold` usage in `LandingContent`. If only silver/currency were used from `initialData`, it can be removed safely.

## Edge Cases & Error Handling

- Empty prices array → show "Không có dữ liệu" (existing `noData` translation key)
- Loading state → show spinner (consistent with `LandingGoldPriceTable` pattern)
- Network error → React Query error state → silent (no prices shown; `noData` falls back)
- All silver/currency stale → show `"--"` for prices (same as gold stale behavior)

## Dependencies & Assumptions

- `asset_display_config` table is seeded for silver and currency (via `task backend:migrate-asset-display-config`)
- `asset_price` cache is populated for silver and currency (price cache job runs)
- `useQueryGetAssetDisplayPrices` hook exists in generated hooks (confirmed)
- `AssetDisplayPrice` type has `typeCode`, `displayName`, `buy`, `sell`, `currency`, `isStale`, `updatedAt` fields

## Out of Scope

- Backend changes — none needed
- Protobuf changes — none needed
- Removing `usePublicMarketTypes` hook from the codebase entirely (it may still be used elsewhere — only remove from the affected files)
- Migrating the `/dashboard/prices` full market prices page (separate feature; handled differently)
- Adding silver/currency inline-edit to the landing page (not in scope; landing is view-only)
