# Gold Canonical TypeCode Normalization Specification

## Summary

External gold price APIs (vangsaigon.vn and vang.today) return different TypeCode strings for the same physical gold product. Currently a small `aliasToCanonical` map (4 entries) lives in `price_fetcher.go` (service layer) and is duplicated in `asset_price_service.go`. This map is incomplete — vang.today returns newer codes (`DOHN`, `DOHCM`, `DOJI`, `BTSJC`, `BT9999`, `VIETTINM`, `PQHN`) that are not yet mapped. The fix centralizes the alias registry into `pkg/gold/types.go` (the single source of truth for canonical codes), removes the duplication, and completes the mapping so DB storage is always canonical regardless of which fallback source is active.

---

## User Stories

- As a developer adding a new gold source, I want alias → canonical mappings to live next to the canonical type definitions, so I only have to look in one place.
- As an operator, I want the DB `asset_price` table to always store canonical TypeCodes, so portfolio lookups and price alerts never silently miss a match due to a source-specific alias.
- As a developer, I want normalization applied exactly once (at the fetcher boundary), not twice in different layers.

---

## Functional Requirements

### FR-1: Centralize AliasToCanonical in `pkg/gold/types.go`

Add an exported `var AliasToCanonical map[string]string` to `pkg/gold/types.go` that maps every known vang.today alias TypeCode to its canonical code (defined in the `GoldTypes` registry in the same file).

**Acceptance criteria:**
- [ ] `pkg/gold/types.go` exports `AliasToCanonical` — a `map[string]string` covering all currently known vang.today alias codes
- [ ] All canonical target codes in `AliasToCanonical` exist as `Code` values in `GoldTypes`
- [ ] Unit tests verify each alias resolves to a code present in `GoldTypes`

### FR-2: Complete the Alias Mapping

The existing 4-entry map is incomplete. Extend it to include all known vang.today codes extracted from `goldTypePrefixes` and observed deployment logs.

Known aliases to add (based on `goldTypePrefixes` in `pkg/vangtoday/client.go` and the API's actual type code patterns):

| Alias (vang.today uppercase) | Canonical (pkg/gold/types.go `Code`) | Notes |
|------------------------------|--------------------------------------|-------|
| `VNGSJC` | `SJC` | Already in map |
| `MIHONG_999` | `Mihong_999` | Already in map |
| `SJ9999` | `Vàng nhẫn SJC` | Already in map |
| `SJL1L10` | `SJC` | Already in map |
| `DOHN` | `Doji` | DOJI Hanoi — maps to DOJI canonical |
| `DOHCM` | `Doji` | DOJI HCM — maps to DOJI canonical |
| `BTSJC` | `BTMC` | Bảo Tín SJC — maps to BTMC canonical |
| `BT9999` | `BTMC_24K` | Bảo Tín 24K |
| `PQHN` | (TBD — Phú Quý HN, may not be in GoldTypes) | Add to GoldTypes if missing |
| `VIETTINM` | `VietinGold` | VietinBank gold |
| `XAUUSD` | `XAUUSD` | Already canonical — no mapping needed |

> **Note:** If `PQHN` (Phú Quý Hà Nội) has no canonical code in `GoldTypes`, add it as a new `GoldType` entry first, then add the alias. Verify against deployment logs before adding.

**Acceptance criteria:**
- [ ] `AliasToCanonical` covers all entries from the `goldTypePrefixes` list that produce alias codes
- [ ] No phantom entries (aliases that point to non-existent canonical codes)

### FR-3: Remove Duplication — Single Normalization Point

Normalization currently happens in two places:
1. `price_fetcher.go:FetchGoldPricesAllSources` (line ~151)
2. `asset_price_service.go:refreshGold` (line ~124)

After this fix, normalization must happen **only at the fetcher level** — both `FetchGoldPrices` (waterfall single-source) and `FetchGoldPricesAllSources` apply `gold.AliasToCanonical`. The `refreshGold` method in `asset_price_service.go` removes its normalization block and trusts that `GoldPriceService.FetchAllPrices` always returns canonical codes.

**Acceptance criteria:**
- [ ] `asset_price_service.go:refreshGold` no longer has a normalization loop
- [ ] `price_fetcher.go:FetchGoldPricesAllSources` uses `gold.AliasToCanonical` (imported from `pkg/gold`)
- [ ] `price_fetcher.go:FetchGoldPrices` (waterfall single-source) also applies normalization so that the primary waterfall path is also canonical
- [ ] `aliasToCanonical` private var in `price_fetcher.go` is deleted

### FR-4: Apply Normalization in Single-Source Waterfall Path

`FetchGoldPrices` (the primary waterfall — one source at a time) currently does NOT normalize aliases. If vangsaigon is down and vang.today is the sole active source, `FetchAllPrices` → `FetchGoldPrices` returns alias codes. `refreshGold` removed its normalization (FR-3), so normalization must also be added to `FetchGoldPrices`.

**Acceptance criteria:**
- [ ] `WaterfallGoldFetcher.FetchGoldPrices` normalizes each result entry's TypeCode via `gold.AliasToCanonical` before returning
- [ ] Existing waterfall test still passes

---

## Non-Functional Requirements

- **No DB migration required** — existing canonical rows stay correct; rows with old alias codes (if any exist) will be overwritten on the next job run with canonical codes via `UpsertBatch`'s `ON CONFLICT DO UPDATE`
- **No proto/API changes** — this is purely a backend normalization fix
- **No frontend changes** — frontend already uses canonical codes for filtering
- **Performance** — map lookup is O(1); no performance impact
- **Backward compat** — `aliasToCanonical` was private; making `AliasToCanonical` exported is a new addition, not a breaking change

---

## Architecture Changes (C4)

### Diagrams to Update

**`docs/architecture/c4-component-backend.md`** — No structural change to components or dependencies. The `AssetPriceService` and `WaterfallGoldFetcher` relationship is unchanged. No update needed.

### New Diagrams

None — this is an internal normalization fix with no new components.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-cross-cutting.md` — Section 13 (Price Cache Job)**

Update the normalization step in the gold refresh flow to note that normalization now happens at the fetcher level (inside `WaterfallGoldFetcher`) rather than in `AssetPriceService.refreshGold`. The sequence stays the same; only the annotation of *where* normalization occurs changes.

---

## Data Model Changes

None — `asset_price` table schema is unchanged. TypeCodes stored will be the same canonical values; any existing rows with alias codes will be corrected on next job run.

---

## API Changes

None.

---

## UI/UX Changes

None.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | vang.today external API | Raw TypeCode strings | Yes: Internet → Backend | `WaterfallGoldFetcher` | Normalization happens here — aliases mapped before data enters service layer |
| 2 | `WaterfallGoldFetcher` | Canonical TypeCodes + int64 prices | No | `AssetPriceService.refreshGold` | Trust boundary not crossed; same process |
| 3 | `AssetPriceService` | Canonical `AssetPrice` models | No | `AssetPriceRepository.UpsertBatch` | Parameterized GORM queries |
| 4 | DB `asset_price` table | Price rows | No | `GetMarketPrices` handler | Read path unchanged |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Backend | vang.today HTTP response (TypeCodes) | Response body size limit (1MB), positive price validation, no user input in the flow |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → Backend | Tampering | vang.today returns a malicious TypeCode string (e.g., SQL metacharacters or very long string) | Low | GORM parameterized queries prevent SQL injection; TypeCode is stored as a string and only displayed — no eval/exec |
| T-2 | 1 | Internet → Backend | Spoofing | vang.today returns a fake canonical code matching one of our system codes (e.g., `"SJC"` with wrong price) | Low | This is the same risk as the current behavior; `AliasToCanonical` reduces it by keeping the mapping in one auditable place |
| T-3 | 1 | Internet → Backend | Denial | vang.today returns 10,000 entries, exploding the batch | Low | Existing 1MB body size limit in `vangtoday.Client` bounds the response size |

### Authorization Rules

Not applicable — this is a background job normalization fix. No user input, no authorization boundaries crossed.

### Input Validation Rules

- TypeCode strings from external APIs are never executed or evaluated — they are stored and displayed only
- `AliasToCanonical` lookup is a pure map read — no injection surface
- No new user input introduced

### External Dependency Risks

- **vang.today API** — if it changes its type code format again, new aliases will accumulate in `AliasToCanonical`. The fix makes this maintenance visible and localized.
- **vangsaigon.vn API** — uses its `entry.Name` as TypeCode which already matches canonical codes; no alias needed

### Sensitive Data Handling

Gold prices are market data (not personal/financial user data). No PII, no secrets. TypeCodes are non-sensitive identifiers.

### Issues & Risks Summary

1. **Incomplete alias mapping** — the `PQHN` (Phú Quý Hà Nội) code may not have a canonical entry in `GoldTypes`; needs verification before adding alias
2. **Alias drift** — vang.today may introduce new type codes at any time; `AliasToCanonical` requires manual maintenance when that happens. Mitigated by centralizing in `pkg/gold/types.go` where it's visible alongside canonical definitions
3. **Existing stale DB rows** — if the DB currently has rows with alias TypeCodes (e.g., `VNGSJC`), they will remain until the next `PriceCacheJob` run overwrites them. No migration needed; `ON CONFLICT DO UPDATE` handles it

---

## Edge Cases & Error Handling

- **Unknown alias** — if vang.today returns a TypeCode not in `AliasToCanonical`, it passes through as-is (same behavior as today). It will be stored in DB as the raw alias code until someone adds it to the map. Log at DEBUG level when an unmapped code is encountered (optional improvement, out of scope for this fix).
- **Two aliases resolve to the same canonical** — first-wins deduplication (already in place in both `FetchGoldPricesAllSources` and `refreshGold`) handles this correctly after normalization.
- **Canonical code that looks like an alias** — e.g., if vangsaigon returns `"DOJI"` and vang.today also returns `"DOJI"` (both canonical), the map lookup returns empty (not found), code passes through as-is. Correct behavior.

---

## Dependencies & Assumptions

- `pkg/gold/types.go` is importable from `domain/service/price_fetcher.go` (same module — no circular import since `pkg/` is a utility layer with no imports from `domain/`)
- The `aliasToCanonical` private variable in `price_fetcher.go` is not exported or tested directly — safe to replace with `gold.AliasToCanonical`
- `refreshGold` in `asset_price_service.go` currently relies on the normalization loop it contains; removing it requires the normalization to already be done by `GoldPriceService.FetchAllPrices` (waterfall path)

---

## Out of Scope

- Silver TypeCode normalization — silver TypeCodes are already canonical (fetched from sources that use our naming: `GOLDENFUND_1L`, `PHUQUY_1L`, etc.)
- Currency TypeCode normalization — currency uses ISO 4217 codes, already canonical
- Automatic detection of new unmapped aliases (logging improvement)
- Renaming the `Code` field in `GoldType` struct (would be a breaking refactor)
- Any frontend changes
