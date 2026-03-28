# Multi-Source Gold Price Collection Specification

## Summary

Add 4 new gold price fetcher clients (SJC, DOJI, BTMC-direct, PNJ) that scrape/call official dealer websites, and store ALL fetched data into the `asset_price` table differentiated by the `source` column. The unique constraint changes from `(type_code, currency)` to `(type_code, currency, source)` so each source can store its own row for the same gold type. Type visibility/filtering on the frontend is explicitly **out of scope** — this feature only collects and stores.

## User Stories

- As a system operator, I want the backend to fetch gold prices from SJC, DOJI, BTMC, and PNJ official sources, so that we have comprehensive price coverage.
- As a system operator, I want each source's data stored independently (no deduplication), so that a future "source filter" feature can let users compare prices across dealers.

## Functional Requirements

### FR-1: New Gold Price Fetcher Clients

Create 4 new client packages under `pkg/`:

| Package | Source | Endpoint | Format | Auth |
|---------|--------|----------|--------|------|
| `pkg/sjc/` | SJC | `sjc.com.vn/GoldPrice/Services/PriceService.ashx` | JSON | None |
| `pkg/doji/` | DOJI | `giavang.doji.vn/` | HTML scraping | None |
| `pkg/btmcdirect/` | BTMC | `btmc.vn/Home/BGiaVang` | HTML scraping | None |
| `pkg/pnj/` | PNJ | `edge-cf-api.pnj.io/ecom-frontend/v3/get-gold-price` | JSON | None |

Each client implements a `FetchGoldPrices(ctx) ([]*GoldPrice, error)` method returning:
```go
type GoldPrice struct {
    TypeCode   string    // Source-specific type code (e.g., "SJC_1L_10L_1KG")
    Name       string    // Display name from source
    Buy        int64     // Price in smallest VND unit
    Sell       int64     // Price in smallest VND unit
    ChangeBuy  int64     // Change amount (0 if unavailable)
    ChangeSell int64     // Change amount (0 if unavailable)
    Currency   string    // Always "VND" for these sources
    UpdateTime time.Time // Parsed from source
}
```

**Acceptance criteria:**
- [ ] Each client has a 5-second timeout
- [ ] Response body limited to 1 MB
- [ ] Zero/negative prices are filtered out
- [ ] HCM region selected for SJC (13 branches) and PNJ (6 regions)
- [ ] Each client returns `[]*GoldPrice` with source-specific type codes
- [ ] Unit tests with mock HTTP responses for each client

### FR-2: Source-Specific Type Code Mapping

Each source produces its own type codes, prefixed by source name to avoid collisions:

**SJC** (from `PriceService.ashx` JSON):
- `TypeName` field → sanitized type code
- Products: SJC 1L/10L/1KG, SJC 5c, SJC 0.5c/1c/2c, Nhan SJC 99.99% (variants), Nu trang 99.99%/99%/75%/68%/61%/58.3%/41.7%
- Type code prefix: `SJC_` (e.g., `SJC_MIENG_1L_10L_1KG`, `SJC_NHAN_99_99`)
- Price field: `BuyValue` / `SellValue` (decimal, e.g., 170500000.0000)
- Change field: `BuyDifferValue` / `SellDifferValue` (integer)

**DOJI** (from HTML scraping):
- Product names from table rows
- Products: SJC Ban Le, Kim TT/AVPL, Nhan Tron 9999, Nguyen Lieu 99.99, Nguyen Lieu 99.9, Nu Trang 9999/999/99
- Type code prefix: `DOJI_` (e.g., `DOJI_SJC_BAN_LE`, `DOJI_NHAN_TRON_9999`)
- Price format: numbers in "nghìn/chỉ" (thousands per mace) → multiply by 1,000,000 (×1000 for VND, ×1000 for per-lượng)

**BTMC Direct** (from `/Home/BGiaVang` HTML):
- Product names from table rows
- Products: Vang Mieng VRTL, Nhan Tron Tron, Qua Mung Ban Vi Vang, Vang Mieng SJC, Trang Suc RTL 999.9/99.9, Vang Thuong Hieu (Doji/PNJ/Phu Quy), Vang Nguyen Lieu
- Type code prefix: `BTMC_` (e.g., `BTMC_VRTL`, `BTMC_SJC`, `BTMC_NHAN_TRON`)
- Price format: numbers where 1 = 1,000 VND (e.g., 17250 = 17,250,000 VND) → multiply by 1,000,000
- Note: Some sell prices show "Liên hệ" (Contact) → store as 0

**PNJ** (from JSON API):
- `gold_type[].name` field per region
- Products: 999.9, 999, 9920, 99, 916 (22K), 750 (18K), 680, 650, 610, 585 (14K), 416 (10K), 375 (9K), 333 (8K), Nhan Tron PNJ, Vang Kim Bao, Vang Phuc Loc Tai
- Type code prefix: `PNJ_` (e.g., `PNJ_999_9`, `PNJ_NHAN_TRON`)
- Region filter: TPHCM only
- Price format: string numbers (e.g., "173,500") → parse and multiply by 1,000,000

**Acceptance criteria:**
- [ ] Each source has a deterministic `toTypeCode()` function that sanitizes product names into stable type codes
- [ ] Type codes are uppercase, alphanumeric + underscore only
- [ ] Prefixed by source name to guarantee uniqueness across sources

### FR-3: Database Schema Change

Change the `asset_price` unique constraint from `(type_code, currency)` to `(type_code, currency, source)`.

**Migration steps:**
1. Drop existing unique index `idx_asset_price_type_code_currency`
2. Create new unique index `idx_asset_price_type_code_currency_source` on `(type_code, currency, source)`
3. Backfill `source` column for existing rows:
   - Rows from current waterfall fetcher → `source = "waterfall"` (default)

**Model change:**
```go
TypeCode string `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency_source"`
Currency string `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency_source"`
Source   string `gorm:"size:30;not null;default:'waterfall';uniqueIndex:idx_asset_price_type_code_currency_source"`
```

**Acceptance criteria:**
- [ ] Migration runs without data loss
- [ ] Existing rows get `source = "waterfall"`
- [ ] New source rows can coexist with waterfall rows
- [ ] `UpsertBatch` conflict columns updated to `(type_code, currency, source)`

### FR-4: Integrate New Sources into PriceCacheJob

Modify `AssetPriceService.RefreshAllPrices()` to call the 4 new sources **in parallel alongside** the existing waterfall:

```
RefreshAllPrices()
  ├─ refreshGold()        (existing waterfall → source="waterfall")
  ├─ refreshGoldSJC()     (new → source="sjc")
  ├─ refreshGoldDOJI()    (new → source="doji")
  ├─ refreshGoldBTMC()    (new → source="btmc")
  ├─ refreshGoldPNJ()     (new → source="pnj")
  ├─ refreshSilver()      (existing)
  └─ refreshCurrency()    (existing)
```

Each new source refresh:
1. Calls its client's `FetchGoldPrices(ctx)`
2. Converts to `[]*models.AssetPrice` with `Source` set
3. Calls `repo.UpsertBatch(ctx, batch)` (upsert on new 3-column unique key)
4. On failure: marks stale by `(asset_type, source)` — only that source's rows, not all gold

**Acceptance criteria:**
- [ ] New sources run in parallel with existing waterfall
- [ ] Each source failure is independent — doesn't affect others
- [ ] Log summary includes new sources: `gold=OK(25), gold_sjc=OK(12), gold_doji=OK(8), ...`
- [ ] `MarkStaleByAssetType` extended to support optional source filter

### FR-5: Update Downstream Consumers

`GetPriceByTypeCode` currently returns the first match by type_code. With multiple sources, it needs adjustment:

- **Default behavior**: Return the row with the earliest `source` priority (waterfall > sjc > doji > btmc > pnj)
- **Or**: Add optional `source` filter parameter
- **For now**: Keep returning first match (waterfall rows preferred since they're fetched first). This is acceptable because downstream consumers (watchlist, alerts) use waterfall type codes which won't collide with source-prefixed codes.

**Acceptance criteria:**
- [ ] Existing consumers continue working without changes
- [ ] No regression in watchlist, price alerts, or market prices page

## Non-Functional Requirements

- **Performance**: New fetchers run in parallel; total refresh time should not exceed existing 15-minute cycle significantly. Target: all 4 new sources complete within 15 seconds.
- **Reliability**: Each source is independent; one failure doesn't block others. Stale marking is per-source.
- **Observability**: Log summary extended to include all sources.
- **Data volume**: ~50 additional rows in `asset_price` (12 SJC + 8 DOJI + 9 BTMC + ~19 PNJ). Negligible DB impact.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend Component** (`c4-component-backend.md`): Add 4 new `pkg/` client components (SJC, DOJI, BTMC Direct, PNJ) connected to `AssetPriceService`
- **L2 Container** (`c4-container.md`): Add 4 new external systems (SJC, DOJI, BTMC, PNJ websites)

### New Diagrams

None needed — this extends existing price-cache architecture.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-cross-cutting.md`**: Update the PriceCacheJob sequence diagram to show parallel fetching from 7 sources (waterfall + SJC + DOJI + BTMC + PNJ + silver + currency)

### New Flow Diagrams

None needed.

## Data Model Changes

### Modified: `asset_price` table

| Change | Before | After |
|--------|--------|-------|
| Unique index | `(type_code, currency)` | `(type_code, currency, source)` |
| `source` column | Optional, nullable | NOT NULL, default `'waterfall'` |

No new tables.

## API Changes

No new API endpoints. Existing `GetMarketPrices` will return more rows (all sources). Frontend visibility filtering is out of scope.

## UI/UX Changes

None — this is backend-only data collection. Frontend display changes are a separate feature.

### Existing Component Inventory (REQUIRED)

N/A — no frontend changes.

### New Components (if any)

N/A.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | SJC API | Gold prices JSON | Yes: External → App | SJC Client | Untrusted response |
| 2 | DOJI website | Gold prices HTML | Yes: External → App | DOJI Client | HTML scraping, untrusted |
| 3 | BTMC website | Gold prices HTML | Yes: External → App | BTMC Client | HTML scraping, untrusted |
| 4 | PNJ API | Gold prices JSON | Yes: External → App | PNJ Client | Untrusted response |
| 5 | All clients | Parsed prices | No (same tier) | AssetPriceService | Validated by client |
| 6 | AssetPriceService | AssetPrice models | Yes: App → DB | PostgreSQL | GORM parameterized |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| External API → App | Price data from 4 sources | Response size limit (1MB), timeout (5s), price range validation, type code sanitization |
| App → DB | Upsert operations | GORM parameterized queries, type validation |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1-4 | External → App | Tampering | Malicious price data from compromised source | Medium | Price range validation (reject prices outside reasonable bounds), stale marking on anomaly |
| T-2 | 1-4 | External → App | DoS | Slow/large responses exhausting resources | Low | 5s timeout, 1MB body limit, parallel fetching with individual timeouts |
| T-3 | 2-3 | External → App | Tampering | HTML structure change breaking scraper | Medium | Graceful error handling, mark stale on parse failure, log warnings |
| T-4 | 1-4 | External → App | Info Disclosure | Error messages leaking internal details | Low | Generic error messages to log, no internal details in API responses |
| T-5 | 6 | App → DB | Tampering | SQL injection via type codes | Low | GORM parameterized queries, type code sanitization (alphanumeric + underscore only) |

### Authorization Rules

N/A — this feature is backend-only (scheduler job). No user-facing endpoints added.

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| Price values (Buy/Sell) | int64 | > 0, < MAX_GOLD_PRICE_VND | Filter zero/negative; log anomalies for extreme values |
| TypeCode | string | Alphanumeric + underscore, max 50 chars | Sanitize product names before storage |
| HTML responses | string | Max 1 MB | Body size limit on HTTP client |
| JSON responses | string | Max 1 MB | Body size limit on HTTP client |

### External Dependency Risks

| External Service | Data Exchanged | Trust Level | Failure Impact | Compromise Impact | Mitigations |
|-----------------|----------------|-------------|----------------|-------------------|-------------|
| sjc.com.vn | Gold prices | Low (public) | SJC prices stale | Wrong SJC prices | Stale marking, price range checks |
| giavang.doji.vn | Gold prices | Low (public) | DOJI prices stale | Wrong DOJI prices | Stale marking, price range checks |
| btmc.vn | Gold prices | Low (public) | BTMC prices stale | Wrong BTMC prices | Stale marking, price range checks |
| edge-cf-api.pnj.io | Gold prices | Low (public) | PNJ prices stale | Wrong PNJ prices | Stale marking, price range checks |

### Sensitive Data Handling

No sensitive data involved. All price data is public information from dealer websites.

### Issues & Risks Summary

1. **HTML scraping fragility** — DOJI and BTMC use HTML scraping which breaks on layout changes. Mitigation: graceful error handling + stale marking + logging.
2. **PNJ Cloudflare protection** — The JSON API endpoint may be rate-limited or require specific headers in the future. Mitigation: configurable headers, rate limiting.
3. **SJC API stability** — The `.ashx` endpoint is undocumented/internal. May change without notice. Mitigation: robust error handling.
4. **Price unit confusion** — Each source uses different price units (per lượng, per chỉ, ×1000 VND). Must normalize carefully to smallest VND unit. Mitigation: unit tests for each converter.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| Source returns empty data | Mark that source's rows stale, log warning |
| Source returns "Liên hệ" instead of price | Store as sell=0, mark as-is (frontend shows "--") |
| Source timeout (>5s) | Cancel, mark stale, continue other sources |
| HTML structure changed (DOJI/BTMC) | Parse error → mark stale, log error |
| PNJ region "TPHCM" not found | Try first region as fallback |
| SJC "Ho Chi Minh" branch not found | Try first branch as fallback |
| Duplicate type codes within same source | First-wins dedup within source |
| DB migration fails mid-way | Migration is wrapped in transaction; rolls back |

## Dependencies & Assumptions

- SJC JSON API (`PriceService.ashx`) remains available and stable
- PNJ JSON API (`edge-cf-api.pnj.io`) remains available without auth
- DOJI and BTMC HTML structure remains parseable
- Existing waterfall behavior unchanged
- All 4 sources return VND prices only (no USD gold)

## Out of Scope

- Frontend display of new source data (separate "type visibility" feature)
- Source preference/priority selection by users
- Historical price tracking (only current prices cached)
- Price comparison across sources
- New gold type registry entries
- Silver or currency source expansion
- Admin UI for managing sources
