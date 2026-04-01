# Asset Price Source Fixes Specification

## Summary

Five bugs affect the `asset_price` cache populated by the background `PriceCacheJob`, causing three sources to fail with "no valid prices" and two others with data integrity issues.

**Confirmed via live API calls on 2026-04-01:**

1. **PNJ API field rename** — The PNJ API response changed field names from `buy`/`sell` to `gia_mua`/`gia_ban`. The Go client struct still maps `json:"buy"` and `json:"sell"`, causing all prices to parse as zero → empty batch → `gold_pnj=FAIL(pnj: no valid prices)`.

2. **SJC API response restructure** — The SJC API response changed from `{"DataList":{"Data":[...]}}` to `{"data":[...]}` (top-level `data` array, lowercase). The Go client struct maps `DataList.Data`, which now parses as empty → `gold_sjc=FAIL(sjc: no valid prices)`.

3. **VangToday no longer returns currency prices** — The `vang.today/api/prices` endpoint now returns only 12 gold type codes (`XAUUSD`, `VNGSJC`, `BTSJC`, etc.) and no currency codes (`USD`, `EUR`, etc.). The `classifyTypeCode` function finds no matches in `knownCurrencyCodes`, so `CurrencyPrices` is always empty → `currency_vangtoday=FAIL(vangtoday currency: no valid prices)`.

4. **DOJI price multiplier** (previously identified) — `parsePrice` in `pkg/doji/client.go` applies `× 1,000,000` instead of the correct `× 10`.

5. **Mihong SJC TypeCode collision** (previously identified) — `codeToTypeCode["SJC"]` maps to `"SJC"` instead of `"Mihong_SJC"`, colliding with the official SJC source TypeCode.

---

## User Stories

- As an admin, I want PNJ gold prices fetched correctly so that users see live PNJ data in the market prices page.
- As an admin, I want SJC gold prices fetched correctly so that users see live SJC data.
- As a user, I want the currency prices page to show real VangToday data (or gracefully handle the source removal).
- As an admin, I want DOJI gold prices displayed in the correct VND range (~100–200 million VND/tael) so that users see accurate market data.
- As an admin configuring display configs, I want Mihong's SJC entry to appear as `Mihong_SJC` so that I can distinguish it from the official SJC source without ambiguity.

---

## Functional Requirements

### FR-1: Fix PNJ API Field Names

The PNJ gold price API (`https://edge-cf-api.pnj.io/ecom-frontend/v3/get-gold-price`) changed its response format. Actual response (verified 2026-04-01):

```json
{"regions":[{"name":"TPHCM","gold_type":[{"name":"PNJ","gia_ban":"176.700","gia_mua":"173.700","updated_at":"..."}]},...]}
```

The `apiGoldType` struct in `pkg/pnj/types.go` currently maps:
```go
Buy  string `json:"buy"`
Sell string `json:"sell"`
```

These must be updated to:
```go
Buy  string `json:"gia_mua"`   // buy price
Sell string `json:"gia_ban"`   // sell price
```

Note: `gia_mua` = "mua" = buy; `gia_ban` = "bán" = sell in Vietnamese.

Also, `parsePrice` multiplies by `1_000` because the old API returned values like `"173,500"` (nghìn VND = thousands of VND). The new API returns `"176.700"` — dot-separated thousands, values in **nghìn VND** (thousands). So `"176.700"` = 176,700 nghìn VND = 176,700,000 VND. The current `strings.ReplaceAll(s, ",", "")` stripping will not handle dot separators. The fix must also strip dots (or handle `.` as thousand separator) before parsing.

**Acceptance criteria:**

- [ ] `apiGoldType.Buy` maps to `json:"gia_mua"` and `.Sell` maps to `json:"gia_ban"`
- [ ] `parsePrice("176.700")` returns `176_700_000` (strips dot, parses 176700, × 1000)
- [ ] `parsePrice("173.700")` returns `173_700_000`
- [ ] `parsePrice("173,500")` still returns `173_500_000` (backward compatible — strips comma)
- [ ] `go test ./pkg/pnj/...` passes with updated test expectations
- [ ] Next `PriceCacheJob` run reports `gold_pnj=OK(N)` with N > 0

### FR-2: Fix SJC API Response Structure

The SJC gold price API (`https://sjc.com.vn/GoldPrice/Services/PriceService.ashx?method=AllBranch&LocationId=2`) changed its top-level structure. Actual response (verified 2026-04-01):

```json
{
  "success": true,
  "latestDate": "13:29 01/04/2026",
  "data": [
    {"Id":1, "TypeName":"Vàng SJC 1L, 10L, 1KG", "BranchName":"...", "Buy":"173,700", "BuyValue":173700000.0, "Sell":"176,700", "SellValue":176700000.0, "BuyDiffer":null, "BuyDifferValue":0, "SellDiffer":null, "SellDifferValue":0, ...},
    ...
  ]
}
```

The `apiResponse` struct in `pkg/sjc/types.go` currently maps:
```go
type apiResponse struct {
    DataList struct {
        Data []apiRow `json:"Data"`
    } `json:"DataList"`
}
```

This must be updated to:
```go
type apiResponse struct {
    Data []apiRow `json:"data"`
}
```

And `client.go` must update the loop from `apiResp.DataList.Data` to `apiResp.Data`. The `apiRow` fields `TypeName`, `BuyValue`, `SellValue`, `BuyDifferValue`, `SellDifferValue` remain the same.

**Acceptance criteria:**

- [ ] `apiResponse` maps `json:"data"` as a top-level array
- [ ] The loop in `FetchGoldPrices` iterates `apiResp.Data` (not `apiResp.DataList.Data`)
- [ ] `go test ./pkg/sjc/...` passes with updated test data reflecting the new structure
- [ ] Next `PriceCacheJob` run reports `gold_sjc=OK(N)` with N > 0

### FR-3: Handle VangToday Currency Source Removal

The `vang.today/api/prices` endpoint no longer returns any currency codes as of 2026-04-01 (verified). The response contains only 12 gold type codes. Currency data (`USD`, `EUR`, etc.) is no longer provided.

**Decision**: Since VangToday no longer serves currency data, the `currency_vangtoday` source should be **gracefully disabled**. Options:
- **Option A (recommended)**: Remove/skip the VangToday currency fetcher from `RefreshAllPrices` and log a clear notice. The `currency_vangsaigon` and `currency_vietcombank` sources still provide currency data.
- **Option B**: Keep the fetcher wired, accept perpetual FAIL (marks source stale each cycle — functions correctly, just noisy).

**Recommended approach: Option A** — remove `vangTodayCurrencyFetcher` from the active refresh pipeline to eliminate log noise and stale-marking overhead. The `currency_vangsaigon` and `currency_vietcombank` fetchers cover currency needs.

**Acceptance criteria:**

- [ ] `refreshCurrencyVangToday` is either removed from `RefreshAllPrices` goroutine dispatch OR `NewVangTodayCurrencyFetcher` is no longer wired in `providers.go`
- [ ] No `currency_vangtoday=FAIL(...)` appears in `PriceCacheJob` logs after deploy
- [ ] Currency prices (`USD`, `EUR`, etc.) remain available via `currency_vangsaigon` and `currency_vietcombank` sources
- [ ] `go test ./domain/service/...` passes

### FR-4: Fix DOJI Price Multiplier

The `parsePrice` function in `pkg/doji/client.go` currently multiplies raw HTML values by `1,000,000`. The DOJI website (`giavang.doji.vn`) displays prices already in **VND per mace** (e.g., `"16,800"` = 16,800 VND/mace). The correct conversion to VND per tael is `× 10` (since 1 tael = 10 mace).

**Acceptance criteria:**

- [ ] `parsePrice("16800")` returns `168_000_000` (not `16_800_000_000`)
- [ ] `parsePrice("8250")` returns `82_500_000` (not `8_250_000_000`)
- [ ] The inline comment in `parsePrice` and `parseHTML` is updated to correctly describe the unit as "VND/mace → VND/tael via × 10"
- [ ] All existing unit tests in `pkg/doji/client_test.go` are updated to expect the corrected values
- [ ] `go test ./pkg/doji/...` passes with no failures
- [ ] Existing DB rows with inflated values self-correct on the next `PriceCacheJob` run (upsert overwrites) — no migration required

### FR-5: Fix Mihong SJC TypeCode

The `codeToTypeCode` map in `pkg/mihong/client.go` maps `"SJC"` → `"SJC"`. This must be changed to `"SJC"` → `"Mihong_SJC"` to be consistent with the `Mihong_` prefix applied to all other Mihong codes (`Mihong_999`, `Mihong_985`, etc.).

**Acceptance criteria:**

- [ ] `codeToTypeCode["SJC"]` resolves to `"Mihong_SJC"`
- [ ] The `codeToName["SJC"]` display name remains `"SJC 9999"` (unchanged — the human name is still accurate)
- [ ] Mihong unit tests in `pkg/mihong/` are updated to assert TypeCode `"Mihong_SJC"` for `Code: "SJC"` input
- [ ] `go test ./pkg/mihong/...` passes with no failures
- [ ] The DB unique index `(TypeCode, Currency, Source)` ensures the new `("Mihong_SJC", "VND", "mihong")` row is inserted cleanly on the next upsert — no migration required (old `("SJC", "VND", "mihong")` row, if present, is left as an orphan and will not be queried unless an explicit fetch code references it)

---

## Non-Functional Requirements

- **Performance**: No impact — changes are in CPU-cheap parsing functions and struct field mappings called every 15 minutes by the background job.
- **Data correctness**: After the next `PriceCacheJob` cycle (≤15 minutes), all PNJ/SJC/DOJI rows will have correct values. No manual DB intervention required.
- **Observability**: Removing `currency_vangtoday` from the refresh pipeline eliminates recurring FAIL log noise. PriceCacheJob logs should be clean after fix.
- **Backward compatibility**: The Mihong `"SJC"` TypeCode rename means any `asset_config_fetch_code` row pointing to `type_code = "SJC"` with `source = "mihong"` would need updating. Since this was a bug, such configs should not exist in production — but an admin check is prudent after deploy. Removing VangToday currency fetcher means any display config using `source = "vangtoday"` for currency will get stale data — admin should reassign those fetch codes to `vangsaigon` or `vietcombank`.

---

## Architecture Changes (C4)

### Diagrams to Update

None. These are internal client-library bug fixes within `pkg/doji/` and `pkg/mihong/`. No new components, services, or repositories are added or removed. The `c4-component-backend.md` diagram already shows these as packages under the backend container.

### New Diagrams

None required.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

No flow diagram changes — the execution path (PriceCacheJob → AssetPriceService.RefreshAllPrices → doji/mihong client → UpsertBatch) is unchanged. Only the computed values and one TypeCode string differ.

### New Flow Diagrams

None required.

---

## Data Model Changes

No schema changes. The existing `asset_price` table with composite unique index `(TypeCode, Currency, Source)` handles both fixes automatically via upsert.

**Post-fix DB state (after next PriceCacheJob cycle):**

| TypeCode | Currency | Source | Buy (example) | Notes |
|---|---|---|---|---|
| `PNJ_PNJ` | VND | pnj | ~173,700,000 | Was 0 (field mismatch) — now correctly populated |
| `SJC_VANG_SJC_1L` | VND | sjc | ~173,700,000 | Was 0 (struct mismatch) — now correctly populated |
| `USD` | VND | vangtoday | — | Source removed; row becomes permanently stale (other sources unaffected) |
| `DOJI_SJC_BAN_LE` | VND | doji | ~168,000,000 | Was 16,800,000,000 — corrected by upsert |
| `Mihong_SJC` | VND | mihong | ~168,000,000 | New row; old `SJC/mihong` row becomes orphan |
| `SJC` | VND | sjc | ~168,000,000 | Unchanged — official SJC client unaffected |

---

## API Changes

None. The `GET /api/v1/public/asset-display-prices` and `GET /api/v1/market-prices` endpoints are unaffected in contract — only the values stored in DB change.

---

## UI/UX Changes

None. Frontend displays prices from the DB via existing handlers — correct values will appear automatically after the next cache refresh.

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|---|---|---|---|---|
| 1 | edge-cf-api.pnj.io | JSON (regions/gold_type) | Yes: Internet → Backend | `FetchGoldPrices()` | External untrusted JSON; 1 MB limit, 5s timeout |
| 2 | sjc.com.vn | JSON (`data` array) | Yes: Internet → Backend | `FetchGoldPrices()` | External untrusted JSON; 1 MB limit, 15s timeout |
| 3 | www.vang.today/api/prices | JSON (prices map) | Yes: Internet → Backend | `FetchPrices()` | External untrusted JSON; 1 MB limit, 5s timeout |
| 4 | giavang.doji.vn | HTML page | Yes: Internet → Backend | `parseHTML()` | External untrusted HTML; already limited to 1 MB, 5s timeout |
| 5 | api.mihong.vn | JSON array | Yes: Internet → Backend | `FetchGoldPrices()` | External untrusted JSON; already limited to 1 MB, context deadline |
| 6 | `parsePrice()` | int64 price | No | `asset_price` table | Internal transformation; field mapping + multiplier fixes |
| 7 | `codeToTypeCode` | string TypeCode | No | `asset_price` table | Static map lookup; rename only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|---|---|---|
| Internet → Backend | PNJ JSON fetch | 1 MB body limit, 5s timeout, comma/dot-stripped numeric parsing, existing controls |
| Internet → Backend | SJC JSON fetch | 1 MB body limit, 15s timeout, entry validation, existing controls |
| Internet → Backend | VangToday JSON fetch | 1 MB body limit, 5s timeout, `success` field check, existing controls |
| Internet → Backend | DOJI HTML fetch | 1 MB body limit, 5s timeout, HTML tag stripping, existing controls |
| Internet → Backend | Mihong JSON fetch | 1 MB body limit, context deadline, entry validation, existing controls |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|---|---|---|---|---|---|
| T-1 | 1 | Internet → Backend | Tampering | PNJ returns crafted price strings with unexpected separators | Low | `parsePrice` strips dots and commas, only reads numeric values, rejects ≤ 0 |
| T-2 | 2 | Internet → Backend | Tampering | SJC injects unexpected structure / extra fields | Low | `json.Unmarshal` into typed struct; unknown fields ignored; existing controls |
| T-3 | 3 | Internet → Backend | Info Disclosure | VangToday stops returning data entirely or changes meaning of fields | Low | Source is being removed from currency pipeline; graceful degradation via other sources |
| T-4 | 4 | Internet → Backend | Tampering | DOJI injects malicious HTML with crafted price strings | Low | `parsePrice` only reads numeric values; `SanitizeTypeCode` strips HTML; no eval |
| T-5 | 5 | Internet → Backend | Tampering | Mihong returns `"SJC"` code for a non-SJC product | Low | TypeCode is now `"Mihong_SJC"` — clearly source-scoped; display config controls what users see |
| T-6 | 1,2,4,5 | Internet → Backend | DoS | Large response bodies exhaust memory | Low | Already mitigated by existing 1 MB `io.LimitReader` |

### Authorization Rules

No authorization changes. Both clients are called exclusively from the internal scheduler (`PriceCacheJob`) with no external API exposure.

### Input Validation Rules

- `parsePrice`: strips commas, trims whitespace, rejects empty/`"-"`/`"N/A"`, rejects `≤ 0` floats — **no change required**
- `codeToTypeCode` lookup: unknown codes fall back to `"Mihong_" + item.Code` — **no change required**

### External Dependency Risks

| Dependency | Risk | Mitigation |
|---|---|---|
| `edge-cf-api.pnj.io` | API field names changed again → parse yields 0 | Source marked stale; other gold sources unaffected |
| `sjc.com.vn` | API structure reverts or changes again | Source marked stale independently; other sources unaffected |
| `www.vang.today/api/prices` | Already removed currency data; gold data could also change | Gold fetcher monitors `classifyTypeCode` via tests; currency source removed from pipeline |
| `giavang.doji.vn` | HTML structure changes → parse yields 0 results | Source marked stale; other gold sources unaffected |
| `api.mihong.vn` | API gone / auth required | Source marked stale independently; other sources unaffected |

### Sensitive Data Handling

No sensitive data involved. Gold prices are public market data.

### Issues & Risks Summary

1. **PNJ field rename bug**: `buy`/`sell` → `gia_mua`/`gia_ban` in API response + dot as thousand separator. All prices parse as 0 → empty batch → FAIL. Fix: update struct JSON tags + extend `parsePrice` to strip dots.
2. **SJC structure change bug**: `DataList.Data` → top-level `data` array. All prices are unreachable → empty batch → FAIL. Fix: update `apiResponse` struct.
3. **VangToday currency removal**: API no longer provides currency data. Fix: remove `currency_vangtoday` from active refresh to eliminate log noise; `vangsaigon` + `vietcombank` cover currency.
4. **DOJI multiplier bug**: Raw value is VND/mace, not thousands/mace. Fix: `× 10` replaces `× 1,000,000`. After next upsert cycle all DB rows correct automatically.
5. **Mihong SJC TypeCode collision**: `"SJC"` → `"Mihong_SJC"` rename eliminates ambiguity. Any admin `asset_config_fetch_code` pointing to `type_code = "SJC"` with `source = "mihong"` needs manual review after deploy (low likelihood — this was a bug).
6. **Orphan DB rows**: Old `("SJC", "VND", "mihong")` row may persist. Old stale currency_vangtoday rows may persist. Neither will be served unless explicitly referenced by a fetch code.

---

## Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| PNJ returns mixed separators (some comma, some dot) | `parsePrice` strips both `,` and `.`, so `"176.700"` and `"173,500"` both work correctly |
| PNJ API returns `gia_mua: "0"` for a product | `parsePrice` returns 0; row filtered by `buy <= 0 && sell <= 0` check (existing) |
| SJC `BuyValue`/`SellValue` is 0.0 | Row filtered by `buy <= 0 && sell <= 0` (existing) |
| VangToday resumes providing currency data in future | `classifyTypeCode` will pick it up, but `currency_vangtoday` fetcher is no longer wired — not a problem since other sources cover currency |
| DOJI HTML shows `0` or `-` for a price | `parsePrice` returns 0; row filtered out (existing behavior, unchanged) |
| DOJI HTML value is already in different unit on a future change | Tests will catch regression via expected numeric values |
| Mihong returns `code: "SJC"` with price 0 | Entry dropped by `item.BuyingPrice <= 0` check (existing behavior, unchanged) |
| Old `("SJC", "VND", "mihong")` row exists in DB | New upsert inserts `("Mihong_SJC", "VND", "mihong")` as a new row; old row stays but won't be refreshed and will appear stale after next cycle |

---

## Dependencies & Assumptions

- `PriceCacheJob` runs every 15 minutes — PNJ/SJC/DOJI values will self-correct without any migration.
- No `asset_config_fetch_code` rows in production reference TypeCode `"SJC"` with source `"mihong"` (assumption — confirm post-deploy).
- No `asset_display_config` rows reference `currency_vangtoday` as the sole source for any currency — if they do, those fetch codes should be updated to `vangsaigon` or `vietcombank` post-deploy.
- The `gold.SanitizeTypeCode` utility is not modified.
- All affected packages (`pkg/pnj/`, `pkg/sjc/`, `pkg/doji/`, `pkg/mihong/`) have existing unit tests that cover the changed code paths.
- The `www.vang.today/api/prices` API will not restore currency entries without notice — removing the fetcher is the right long-term call.

---

## Out of Scope

- BTMC, VangToday gold, VangSaiGon gold — unaffected.
- Mihong non-SJC type codes (`Mihong_999`, etc.) — already correctly prefixed.
- Any frontend display logic — values fix automatically via the cache upsert.
- DB migration to clean up old inflated/stale rows — not needed; cache upsert + TTL handles it.
- Adding a new currency data source to replace VangToday — out of scope for this fix; existing `vangsaigon` + `vietcombank` sources are sufficient.
