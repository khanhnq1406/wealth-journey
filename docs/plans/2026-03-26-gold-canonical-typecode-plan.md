# Gold Canonical TypeCode Normalization — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Move `aliasToCanonical` gold TypeCode mapping to `pkg/gold/types.go`, complete the alias table, and apply normalization exactly once (at the waterfall fetcher level), removing the duplicate in `asset_price_service.go`.

**Spec:** `docs/specs/2026-03-26-gold-canonical-typecode-spec.md`

**Architecture:** No new components or DB schema changes. The change is entirely within the gold price normalization path: `pkg/gold/types.go` → `domain/service/price_fetcher.go` → `domain/service/asset_price_service.go`. The `pkg/gold` package is a utility layer with no imports from `domain/`, so adding `AliasToCanonical` there introduces no circular dependency.

**Tech Stack:** Go 1.25, GORM (no changes), no proto changes, no frontend changes.

---

## Security Implementation Notes

- **No user input in this path** — All TypeCodes come from external APIs, not user-controlled input. No injection surface.
- **No authorization changes** — Background job; no user context.
- **TypeCode string validation** — TypeCodes are stored as-is after normalization. GORM parameterized queries protect against SQL injection regardless of TypeCode content.
- **Alias correctness** — Every canonical target in `AliasToCanonical` must exist as a `Code` in `GoldTypes`. Verified by unit test (Task 1).

---

## Component Reuse Inventory

**Backend-only change — no frontend components involved.**

---

## C4 Architecture Diagram Updates

Per spec: no structural changes to C4 components. No diagram updates required.

---

## Runtime Flow Diagrams

Per spec: update annotation in `flow-cross-cutting.md` Section 13 to note normalization now happens at fetcher level (Task 3).

---

## Task Overview

| # | Task | Files | TDD? |
|---|------|-------|------|
| 1 | Add `AliasToCanonical` to `pkg/gold/types.go` | `pkg/gold/types.go`, `pkg/gold/types_test.go` | Yes |
| 2 | Apply `gold.AliasToCanonical` in `price_fetcher.go`; delete private map | `domain/service/price_fetcher.go`, `domain/service/price_fetcher_test.go` | Yes |
| 3 | Remove normalization from `asset_price_service.go:refreshGold` | `domain/service/asset_price_service.go`, `domain/service/asset_price_service_test.go` | Yes |
| 4 | Update `flow-cross-cutting.md` annotation | `docs/architecture/flow-cross-cutting.md` | N/A |

---

### Task 1: Add `AliasToCanonical` to `pkg/gold/types.go`

**Files:**
- Modify: `src/go-backend/pkg/gold/types.go`
- Modify: `src/go-backend/pkg/gold/types_test.go`

**Security notes:** Pure data map — no execution, no injection surface. All canonical values must be validated against `GoldTypes` by test.

**Step 1: Write the failing test**

Add to `src/go-backend/pkg/gold/types_test.go`:

```go
// TestAliasToCanonical_AllTargetsExistInGoldTypes verifies that every canonical
// code referenced by AliasToCanonical is present in the GoldTypes registry.
// This prevents phantom aliases that point to non-existent codes.
func TestAliasToCanonical_AllTargetsExistInGoldTypes(t *testing.T) {
    canonicalCodes := make(map[string]struct{}, len(GoldTypes))
    for _, gt := range GoldTypes {
        canonicalCodes[gt.Code] = struct{}{}
    }
    for alias, canonical := range AliasToCanonical {
        _, exists := canonicalCodes[canonical]
        assert.True(t, exists,
            "AliasToCanonical[%q] = %q but %q is not in GoldTypes", alias, canonical, canonical)
    }
}

// TestAliasToCanonical_KnownMappings verifies specific known mappings.
func TestAliasToCanonical_KnownMappings(t *testing.T) {
    cases := []struct {
        alias     string
        canonical string
    }{
        {"VNGSJC", "SJC"},
        {"MIHONG_999", "Mihong_999"},
        {"SJ9999", "Vàng nhẫn SJC"},
        {"SJL1L10", "SJC"},
        {"DOHN", "Doji"},
        {"DOHCM", "Doji"},
        {"BTSJC", "BTMC"},
        {"BT9999", "BTMC_24K"},
        {"VIETTINM", "VietinGold"},
    }
    for _, tc := range cases {
        t.Run(tc.alias, func(t *testing.T) {
            got, ok := AliasToCanonical[tc.alias]
            assert.True(t, ok, "missing alias %q", tc.alias)
            assert.Equal(t, tc.canonical, got)
        })
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run 'TestAliasToCanonical' ./pkg/gold/... -v
```
Expected: compile error (AliasToCanonical undefined) or test failures.

**Step 3: Write minimal implementation**

Add to `src/go-backend/pkg/gold/types.go` (after `GoldTypes` var):

```go
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
    // vang.today SJC aliases
    "VNGSJC":  "SJC",   // vang.today's main SJC bar code
    "SJL1L10": "SJC",   // vang.today SJC 1L/10L bar variant

    // vang.today SJC ring
    "SJ9999": "Vàng nhẫn SJC", // vang.today SJC ring 9999

    // vang.today Mihong
    "MIHONG_999": "Mihong_999", // vang.today uppercases the underscore variant

    // vang.today DOJI — HN and HCM branches both map to canonical "Doji"
    "DOHN":  "Doji",
    "DOHCM": "Doji",

    // vang.today Bảo Tín Minh Châu
    "BTSJC": "BTMC",     // Bảo Tín SJC bar
    "BT9999": "BTMC_24K", // Bảo Tín 24K bar

    // vang.today VietinBank gold
    "VIETTINM": "VietinGold",
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run 'TestAliasToCanonical' ./pkg/gold/... -v
```
Expected: all assertions pass.

**Step 5: Run full gold package tests**
```bash
cd src/go-backend && go test ./pkg/gold/... -v
```

**Step 6: Commit**
```
feat(gold): add AliasToCanonical map to pkg/gold/types.go

Maps vang.today alias TypeCodes to canonical codes defined in GoldTypes.
Completes the 4-entry private map with DOHN, DOHCM, BTSJC, BT9999, VIETTINM.
Unit tests verify all canonical targets exist in GoldTypes registry.
```

---

### Task 2: Apply `gold.AliasToCanonical` in `price_fetcher.go`; delete private map

**Files:**
- Modify: `src/go-backend/domain/service/price_fetcher.go`
- Modify: `src/go-backend/domain/service/price_fetcher_test.go`

**Security notes:** Importing `pkg/gold` from `domain/service` is allowed (pkg → domain is one-way; domain/service currently doesn't import pkg/gold but this is a utility import, not a GORM/Redis import — no depguard violation).

> **Depguard check:** The depguard rule blocks `gorm.io/gorm`, `go-redis`, and `gin-gonic/gin` in domain/service. Importing `wealthjourney/pkg/gold` is explicitly allowed — it's our own utility package.

**Step 1: Write the failing test**

Add to `src/go-backend/domain/service/price_fetcher_test.go`:

```go
// TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias verifies that
// the primary waterfall FetchGoldPrices path normalizes vang.today alias codes
// to canonical codes via gold.AliasToCanonical.
func TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias(t *testing.T) {
    aliasPrices := []*CachedGoldPrice{
        {TypeCode: "VNGSJC", Name: "vng sjc", Buy: 85_000_000, Sell: 86_000_000, Currency: "VND"},
        {TypeCode: "DOHN", Name: "doji hn", Buy: 84_000_000, Sell: 85_000_000, Currency: "VND"},
        {TypeCode: "XAUUSD", Name: "xau", Buy: 290000, Sell: 290100, Currency: "USD"}, // no alias — passthrough
    }

    f := newStubFetcher(SourceVangToday, aliasPrices, nil)
    healthy := &alwaysHealthyTracker{}
    w := NewWaterfallGoldFetcher([]GoldPriceFetcher{f}, healthy)

    prices, err := w.FetchGoldPrices(context.Background())
    require.NoError(t, err)
    require.Len(t, prices, 3)

    byCode := make(map[string]*CachedGoldPrice)
    for _, p := range prices {
        byCode[p.TypeCode] = p
    }
    assert.Contains(t, byCode, "SJC", "VNGSJC should normalize to SJC")
    assert.Contains(t, byCode, "Doji", "DOHN should normalize to Doji")
    assert.Contains(t, byCode, "XAUUSD", "XAUUSD should pass through unchanged")
    assert.NotContains(t, byCode, "VNGSJC")
    assert.NotContains(t, byCode, "DOHN")
}
```

> If `newStubFetcher` and `alwaysHealthyTracker` don't exist in `price_fetcher_test.go`, add them. Check if they already exist for the `FetchGoldPricesAllSources` tests first.

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run 'TestWaterfallGoldFetcher_FetchGoldPrices_NormalizesAlias' ./domain/service/... -v
```

**Step 3: Write minimal implementation**

In `price_fetcher.go`:

1. Add import: `"wealthjourney/pkg/gold"`
2. Delete the `var aliasToCanonical` private map (lines ~38-43)
3. In `FetchGoldPrices` (single-source waterfall), after `prices, err := f.FetchGoldPrices(...)`, add normalization before `return prices, nil`:

```go
// Normalize alias TypeCodes to canonical before returning.
for i, p := range prices {
    if canonical, ok := gold.AliasToCanonical[p.TypeCode]; ok {
        normalized := *p
        normalized.TypeCode = canonical
        prices[i] = &normalized
    }
}
return prices, nil
```

4. In `FetchGoldPricesAllSources`, replace `aliasToCanonical` with `gold.AliasToCanonical`:
```go
// Before (line ~151):
if canonical, ok := aliasToCanonical[typeCode]; ok {
// After:
if canonical, ok := gold.AliasToCanonical[typeCode]; ok {
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run 'TestWaterfallGoldFetcher' ./domain/service/... -v
```

**Step 5: Run full service tests**
```bash
cd src/go-backend && go test ./domain/service/... -v
```

**Step 6: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 7: Commit**
```
refactor(price-fetcher): use gold.AliasToCanonical; normalize in FetchGoldPrices

- Replace private aliasToCanonical map with gold.AliasToCanonical (pkg/gold)
- Apply normalization in both FetchGoldPrices (single-source waterfall) and
  FetchGoldPricesAllSources (all-sources merge) — both paths now canonical
- Delete private map from price_fetcher.go (single source of truth in pkg/gold)
```

---

### Task 3: Remove normalization from `asset_price_service.go:refreshGold`

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`
- Modify: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** After Task 2, `GoldPriceService.FetchAllPrices` always returns canonical codes. Removing the normalization in `refreshGold` does not regress correctness — it removes redundancy.

**Step 1: Update the existing normalization test to assert the service relies on pre-normalized input**

The existing test `TestAssetPriceService_RefreshGold_NormalizesAliasCodes` in `asset_price_service_test.go` tests that `refreshGold` normalizes aliases. After this task, that test should be **replaced** with a test that verifies `refreshGold` stores whatever TypeCode `FetchAllPrices` returns (i.e., trusts the service layer to provide canonical codes).

Update `asset_price_service_test.go`:

```go
// TestAssetPriceService_RefreshGold_StoresTypeCodes verifies that refreshGold
// upserts AssetPrice rows with the TypeCodes returned by GoldPriceService as-is.
// TypeCode normalization is the responsibility of GoldPriceService (price_fetcher.go),
// not of AssetPriceService.
func TestAssetPriceService_RefreshGold_StoresTypeCodes(t *testing.T) {
    repo := &mockAssetPriceRepo{}
    goldSvc := &mockGoldPriceSvc{
        prices: []*CachedGoldPrice{
            {TypeCode: "SJC", Name: "SJC", Buy: 85_000_000, Sell: 86_000_000, Currency: "VND"},
            {TypeCode: "Doji", Name: "DOJI", Buy: 84_000_000, Sell: 85_000_000, Currency: "VND"},
        },
    }
    svc := NewAssetPriceService(repo, goldSvc, &mockSilverPriceSvc{}, &mockCurrencyPriceSvc{})

    err := svc.(*assetPriceService).refreshGold(context.Background(), time.Now()).err
    require.NoError(t, err)
    require.Len(t, repo.upsertedBatches, 1)

    typeCodes := make(map[string]struct{})
    for _, p := range repo.upsertedBatches[0] {
        typeCodes[p.TypeCode] = struct{}{}
    }
    assert.Contains(t, typeCodes, "SJC")
    assert.Contains(t, typeCodes, "Doji")
}
```

**Step 2: Run test to verify it fails (or verify the old test name no longer compiles)**
```bash
cd src/go-backend && go test -run 'TestAssetPriceService_RefreshGold' ./domain/service/... -v
```

**Step 3: Write minimal implementation — remove normalization block from `refreshGold`**

In `asset_price_service.go`, replace the normalization loop in `refreshGold` (lines ~115–143):

Before:
```go
// Normalize alias TypeCodes to canonical before upserting.
seen := make(map[string]struct{}, len(prices))
batch := make([]*models.AssetPrice, 0, len(prices))
for _, p := range prices {
    typeCode := p.TypeCode
    if canonical, ok := aliasToCanonical[typeCode]; ok {
        typeCode = canonical
    }
    if _, exists := seen[typeCode]; exists {
        continue // deduplicate: first-wins
    }
    seen[typeCode] = struct{}{}
    batch = append(batch, &models.AssetPrice{
        TypeCode:   typeCode,
        ...
    })
}
```

After (simplified — normalization removed, deduplication kept for safety):
```go
// GoldPriceService.FetchAllPrices already returns canonical TypeCodes
// (normalization applied at WaterfallGoldFetcher level via gold.AliasToCanonical).
// Deduplication retained as a defensive measure in case two sources return
// the same canonical code.
seen := make(map[string]struct{}, len(prices))
batch := make([]*models.AssetPrice, 0, len(prices))
for _, p := range prices {
    if _, exists := seen[p.TypeCode]; exists {
        continue // deduplicate: first-wins
    }
    seen[p.TypeCode] = struct{}{}
    batch = append(batch, &models.AssetPrice{
        TypeCode:   p.TypeCode,
        AssetType:  "gold",
        Name:       p.Name,
        Buy:        p.Buy,
        Sell:       p.Sell,
        ChangeBuy:  p.ChangeBuy,
        ChangeSell: p.ChangeSell,
        Currency:   p.Currency,
        IsStale:    false,
        FetchedAt:  now,
    })
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run 'TestAssetPriceService_RefreshGold' ./domain/service/... -v
```

**Step 5: Run full test suite**
```bash
cd src/go-backend && go test ./... -v 2>&1 | tail -30
```

**Step 6: Build check**
```bash
cd src/go-backend && go build ./...
```

**Step 7: Lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 8: Commit**
```
refactor(asset-price-service): remove normalization from refreshGold

TypeCode normalization is now applied exclusively at WaterfallGoldFetcher
(via gold.AliasToCanonical). refreshGold trusts FetchAllPrices to return
canonical codes. Deduplication (first-wins) retained as defensive measure.
```

---

### Task 4: Update `flow-cross-cutting.md` annotation

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Open Section 13 (Price Cache Job) in `flow-cross-cutting.md`
2. Find the annotation for the gold normalization step
3. Update the note from "normalization in refreshGold" to "normalization in WaterfallGoldFetcher (FetchGoldPrices/FetchGoldPricesAllSources) via gold.AliasToCanonical"
4. Commit:
```
docs: update flow-cross-cutting.md Section 13 normalization note
```

---

## Verification Checklist

After all tasks:

- [ ] `go test ./pkg/gold/... -v` — all pass
- [ ] `go test ./domain/service/... -v` — all pass
- [ ] `go build ./...` — clean
- [ ] `task ci:backend-lint` — clean
- [ ] `aliasToCanonical` private var in `price_fetcher.go` is deleted
- [ ] `gold.AliasToCanonical` imported and used in `price_fetcher.go`
- [ ] `refreshGold` in `asset_price_service.go` has no `aliasToCanonical` reference
- [ ] All canonical values in `AliasToCanonical` exist in `GoldTypes`
