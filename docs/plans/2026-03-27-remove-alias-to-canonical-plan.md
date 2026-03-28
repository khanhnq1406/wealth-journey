# Remove AliasToCanonical from DB Write Path — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Remove `AliasToCanonical` normalization from the `PriceCacheJob → asset_price DB` write path so that raw API TypeCodes are stored as-is, enabling admins to map all source codes via `asset_config_fetch_code`.
**Spec:** `docs/specs/2026-03-27-remove-alias-to-canonical-spec.md`
**Architecture:** No schema changes. Only the normalization step inside `asset_price_service.go` (vangsaigon write path) and `price_fetcher.go` (waterfall fetcher) is removed. The `AliasToCanonical` variable stays in `pkg/gold/types.go` as documentation — it is just not called during DB writes.
**Tech Stack:** Go 1.25, GORM, sqlmock (tests)

## Security Implementation Notes

- No auth changes needed — all affected code is internal service layer (no HTTP boundary)
- No new external inputs introduced — TypeCodes come from external APIs and are stored via parameterized GORM queries (unchanged)
- `CreateFetchCode` validation against `ListAvailableTypeCodes` remains intact — raw codes in DB means admins can now pick raw codes, which is the correct behavior

## Component Reuse Inventory (Frontend Tasks)

No frontend changes needed.

## C4 Architecture Diagram Updates

No C4 diagram updates needed — the component relationships are unchanged. Only internal behavior of `AssetPriceService` changes.

---

### Task 0: Remove normalization from `refreshGoldVangSaiGon` in `asset_price_service.go`

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go` (lines ~138–183)

**Security notes:** TypeCodes are stored via GORM parameterized queries — no injection risk from removing normalization. Raw TypeCode from vangsaigon API is already a bounded string (size:50 DB constraint).

**Step 1: Write failing test**

In `src/go-backend/domain/service/asset_price_service_test.go`, add a test that verifies raw TypeCodes from vangsaigon are written to the DB without normalization:

```go
// TestRefreshGoldVangSaiGon_StoresRawTypeCode verifies that raw TypeCodes returned
// by the vangsaigon fetcher are written as-is to the asset_price table —
// NOT normalized through AliasToCanonical.
func TestRefreshGoldVangSaiGon_StoresRawTypeCode(t *testing.T) {
    // "Vàng SJC 1L" is a raw alias that AliasToCanonical would have mapped to "SJC"
    rawTypeCode := "Vàng SJC 1L"
    mockFetcher := &mockGoldPriceFetcher{
        prices: []*CachedGoldPrice{
            {TypeCode: rawTypeCode, Name: "SJC Bar 1 Lượng", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
        },
    }
    repo := &mockAssetPriceRepo{}
    svc := &assetPriceService{repo: repo, vangSaiGonFetcher: mockFetcher}

    result := svc.refreshGoldVangSaiGon(context.Background())

    if result.err != nil {
        t.Fatalf("unexpected error: %v", result.err)
    }
    if len(repo.upsertedBatch) != 1 {
        t.Fatalf("expected 1 row upserted, got %d", len(repo.upsertedBatch))
    }
    if got := repo.upsertedBatch[0].TypeCode; got != rawTypeCode {
        t.Errorf("TypeCode: expected raw %q, got %q (normalization should be removed)", rawTypeCode, got)
    }
}
```

**Step 2: Run test — expect FAIL** (currently normalization maps `"Vàng SJC 1L"` to `"SJC"`)

```bash
cd src/go-backend && go test -run TestRefreshGoldVangSaiGon_StoresRawTypeCode ./domain/service/... -v
```

**Step 3: Remove normalization from `refreshGoldVangSaiGon`**

In `asset_price_service.go`, change the typeCode assignment block:

```go
// BEFORE (lines ~155-159):
typeCode := p.TypeCode
if canonical, ok := gold.AliasToCanonical[typeCode]; ok {
    typeCode = canonical
}

// AFTER:
typeCode := p.TypeCode
// No alias normalization — raw TypeCode is stored as-is.
// Admins configure mappings via asset_config_fetch_code.
```

Also update the method comment (line ~139):
```go
// BEFORE:
// and upserts them with source="vangsaigon". TypeCodes are normalized via gold.AliasToCanonical.

// AFTER:
// and upserts them with source="vangsaigon". TypeCodes are stored as returned by the API.
```

Remove the `"wealthjourney/pkg/gold"` import if it becomes unused after this change (check whether other methods in the file still use it).

**Step 4: Run test — expect PASS**

```bash
cd src/go-backend && go test -run TestRefreshGoldVangSaiGon_StoresRawTypeCode ./domain/service/... -v
```

**Step 5: Run full service tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -v
```

**Step 6: Check if `gold` import is still needed**

```bash
cd src/go-backend && grep -n "gold\." domain/service/asset_price_service.go
```

If no other call sites use `gold.*`, remove the import. Then:

```bash
cd src/go-backend && go build ./...
```

**Step 7: Commit**
```
fix(asset-price): store raw TypeCodes from vangsaigon without AliasToCanonical normalization
```

---

### Task 1: Remove normalization from `WaterfallGoldFetcher` in `price_fetcher.go`

**Files:**
- Modify: `src/go-backend/domain/service/price_fetcher.go` (lines ~99–106 for `FetchGoldPrices`, lines ~138–143 for `FetchGoldPricesAllSources`)
- Modify: `src/go-backend/domain/service/price_fetcher_test.go` — remove/update 7 alias normalization tests

**Security notes:** The waterfall fetcher is used only by the legacy `GoldPriceService` (live-API fallback) — no HTTP boundary change. Removing normalization here means the fallback path returns raw codes, consistent with what's in the DB.

**Step 1: Update normalization tests in `price_fetcher_test.go` to assert raw pass-through**

The 7 tests that assert alias normalization (lines ~301–534) must be updated to assert that raw codes pass through unchanged. Example for `TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias`:

```go
// RENAME to: TestWaterfallGoldFetcher_FetchGoldPrices_PassesRawTypeCodesThrough
func TestWaterfallGoldFetcher_FetchGoldPrices_PassesRawTypeCodesThrough(t *testing.T) {
    aliasPrices := []*CachedGoldPrice{
        {TypeCode: "VNGSJC", Name: "vng sjc", Buy: 85_000_000, Sell: 86_000_000, Currency: "VND"},
        {TypeCode: "DOHN", Name: "doji hn", Buy: 84_000_000, Sell: 85_000_000, Currency: "VND"},
        {TypeCode: "XAUUSD", Name: "xau", Buy: 290000, Sell: 290100, Currency: "USD"},
    }

    f := &mockGoldFetcher{source: SourceVangToday, prices: aliasPrices}
    healthy := &alwaysHealthy{}
    w := NewWaterfallGoldFetcher([]GoldPriceFetcher{f}, healthy)

    prices, err := w.FetchGoldPrices(context.Background())
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    byCode := make(map[string]*CachedGoldPrice)
    for _, p := range prices {
        byCode[p.TypeCode] = p
    }
    // Raw codes should pass through unchanged.
    if _, ok := byCode["VNGSJC"]; !ok {
        t.Error("VNGSJC should pass through unchanged (no alias normalization)")
    }
    if _, ok := byCode["DOHN"]; !ok {
        t.Error("DOHN should pass through unchanged (no alias normalization)")
    }
    if _, ok := byCode["XAUUSD"]; !ok {
        t.Error("XAUUSD should pass through unchanged")
    }
    // Canonical codes should NOT appear (normalization is removed).
    if _, ok := byCode["SJC"]; ok {
        t.Error("SJC should not appear — VNGSJC alias normalization has been removed")
    }
    if _, ok := byCode["Doji"]; ok {
        t.Error("Doji should not appear — DOHN alias normalization has been removed")
    }
}
```

Apply the same pattern to the 6 remaining alias normalization tests in `price_fetcher_test.go`:
- `TestWaterfallGoldFetcher_AllSources_AliasNormalization` → `TestWaterfallGoldFetcher_AllSources_RawTypeCodePassThrough`
- `TestWaterfallGoldFetcher_AllSources_NonAliasUnchanged` → keep (already tests raw pass-through, just rename for consistency)
- `TestWaterfallGoldFetcher_AllSources_SJ9999AliasNormalization` → `TestWaterfallGoldFetcher_AllSources_SJ9999RawPassThrough`
- `TestWaterfallGoldFetcher_AllSources_SJL1L10AliasNormalization` → `TestWaterfallGoldFetcher_AllSources_SJL1L10RawPassThrough`
- `TestWaterfallGoldFetcher_AllSources_MihongFallback` → review and update
- `TestWaterfallGoldFetcher_AllSources_MIHONG999AliasNormalization` → `TestWaterfallGoldFetcher_AllSources_MIHONG999RawPassThrough`

**Step 2: Run updated tests — expect FAIL** (normalization still in code)

```bash
cd src/go-backend && go test -run "TestWaterfallGoldFetcher_FetchGoldPrices_PassesRaw|TestWaterfallGoldFetcher_AllSources_Raw|TestWaterfallGoldFetcher_AllSources_SJ9999Raw|TestWaterfallGoldFetcher_AllSources_SJL1L10Raw|TestWaterfallGoldFetcher_AllSources_MIHONG999Raw" ./domain/service/... -v
```

**Step 3: Remove normalization from `FetchGoldPrices` in `price_fetcher.go`**

```go
// BEFORE (lines ~99–106):
// Normalize alias TypeCodes to canonical before returning.
for i, p := range prices {
    if canonical, ok := gold.AliasToCanonical[p.TypeCode]; ok {
        normalized := *p
        normalized.TypeCode = canonical
        prices[i] = &normalized
    }
}
return prices, nil

// AFTER:
// Raw TypeCodes are returned as-is. No alias normalization.
// Admins configure mappings in asset_config_fetch_code.
return prices, nil
```

**Step 4: Remove normalization from `FetchGoldPricesAllSources` in `price_fetcher.go`**

```go
// BEFORE (lines ~138–143):
for _, p := range prices {
    // Normalize alias TypeCode to canonical before merging.
    typeCode := p.TypeCode
    if canonical, ok := gold.AliasToCanonical[typeCode]; ok {
        typeCode = canonical
    }

    // First-source-wins: don't overwrite an entry already set by a higher-priority source.
    if _, exists := seen[typeCode]; !exists {
        seen[typeCode] = struct{}{}
        normalized := *p
        normalized.TypeCode = typeCode
        merged = append(merged, &normalized)
    }
}

// AFTER:
for _, p := range prices {
    // First-source-wins: don't overwrite an entry already set by a higher-priority source.
    // TypeCodes are stored raw — no alias normalization.
    if _, exists := seen[p.TypeCode]; !exists {
        seen[p.TypeCode] = struct{}{}
        merged = append(merged, p)
    }
}
```

Update method comment: remove "Normalize alias TypeCode to canonical before merging."

Check if `gold` import is still needed in `price_fetcher.go`:
```bash
cd src/go-backend && grep -n "gold\." domain/service/price_fetcher.go
```
If unused, remove the import.

**Step 5: Run tests — expect PASS**

```bash
cd src/go-backend && go test -short ./domain/service/... -v
```

**Step 6: Run full backend CI**

```bash
cd src/go-backend && task ci:backend-lint && go test -short ./...
```

**Step 7: Commit**
```
fix(price-fetcher): remove AliasToCanonical normalization from waterfall fetcher — raw TypeCodes pass through
```

---

### Task 2: Update `pkg/gold/types.go` comment and `flow-investment.md`

**Files:**
- Modify: `src/go-backend/pkg/gold/types.go` (lines ~207–238)
- Modify: `docs/architecture/flow-investment.md` (§10 fetch-code sequence)

**Security notes:** Documentation-only changes. No security impact.

**Step 1: Update `AliasToCanonical` comment in `types.go`**

```go
// BEFORE (lines ~207–216):
// AliasToCanonical maps external API alias TypeCodes to their canonical Code
// as defined in GoldTypes above.
//
// Maintenance: when a price source introduces a new TypeCode for an existing
// gold product, add the mapping here. The canonical code is what callers
// (portfolio valuation, price alerts, filterGoldPrices on the frontend) use.
//
// Current sources:
//   - vangsaigon.vn: uses canonical codes directly (entry.Name matches GoldTypes.Code)
//   - vang.today:    returns uppercase API keys that differ from canonical codes
var AliasToCanonical = map[string]string{

// AFTER:
// AliasToCanonical documents known mappings between external API alias TypeCodes
// and their previously-used canonical codes. This map is retained for reference only.
//
// IMPORTANT: As of 2026-03-27 this map is NO LONGER applied during DB writes.
// Raw TypeCodes from all sources are stored in the asset_price table as-is.
// Admins configure source→display mappings via asset_config_fetch_code.
//
// Historical note: vang.today returns uppercase keys (e.g. "DOHN", "DOHCM") that
// previously collapsed to a single canonical code ("Doji"). They are now stored
// as separate rows, allowing admins to map each branch independently.
var AliasToCanonical = map[string]string{
```

**Step 2: Update `flow-investment.md` §10**

Read the current §10 content, then remove any mention of "normalize alias TypeCode" from the ResolvePrice algorithm description and the sequence diagram.

```bash
cd src/go-backend && grep -n "AliasToCanonical\|normalize alias" ../../docs/architecture/flow-investment.md
```

Update the step that previously described normalization to say raw TypeCodes are stored and the admin mapping handles the translation.

**Step 3: Run types_test.go to confirm map tests still pass** (map is still defined, just unused in write path)

```bash
cd src/go-backend && go test -run "TestAliasToCanonical" ./pkg/gold/... -v
```

Expect: PASS (map still defined, tests still valid as documentation of known aliases)

**Step 4: Commit**
```
docs(gold): mark AliasToCanonical as reference-only; update flow-investment §10 ResolvePrice algorithm
```

---

### Task 3: Backend CI verification

**Files:** None (CI check only)

**Step 1: Run full backend CI**

```bash
cd src/go-backend && task ci:backend-lint
```
Expect: 0 issues (no unused import warnings from removed `gold` import)

**Step 2: Run all backend tests**

```bash
cd src/go-backend && go test -short ./...
```
Expect: all packages pass

**Step 3: Commit** (only if any CI-fix changes are needed)

---

## Task Order Summary

| Task | Description | Files | Dependencies |
|------|-------------|-------|-------------|
| 0 | Remove normalization from `refreshGoldVangSaiGon` | `asset_price_service.go` | None |
| 1 | Remove normalization from `WaterfallGoldFetcher` + update tests | `price_fetcher.go`, `price_fetcher_test.go` | None (parallel with Task 0) |
| 2 | Update comment in `types.go` + `flow-investment.md` | `types.go`, `flow-investment.md` | After Tasks 0 & 1 |
| 3 | Backend CI verification | — | After Task 2 |

Tasks 0 and 1 are independent and can be done in parallel.
