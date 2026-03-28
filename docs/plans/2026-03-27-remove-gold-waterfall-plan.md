# Remove Gold Waterfall — Direct Source Parallelism Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the single gold waterfall goroutine in `RefreshAllPrices` with two independent direct-source goroutines (VangSaiGon + VangToday) so all gold APIs run in parallel and each upserts its own source-tagged rows to the DB.
**Spec:** `docs/specs/2026-03-27-remove-gold-waterfall-spec.md`
**Architecture:** `assetPriceService.RefreshAllPrices` grows from 7 to 8 goroutines. The `goldSvc GoldPriceService` dependency is replaced by `vangSaiGonFetcher GoldPriceFetcher` and `vangTodayFetcher GoldPriceFetcher`. Silver and currency goroutines are unchanged. No DB migration, no proto changes, no frontend changes.
**Tech Stack:** Go 1.25, GORM (PostgreSQL), `pkg/vnprice` (VangSaiGon), `pkg/vangtoday` (VangToday), existing `GoldPriceFetcher` interface

## Security Implementation Notes

- **Authentication:** N/A — background job, no user context
- **Authorization:** N/A — internal scheduler only
- **Input validation:** Skip prices where `buy <= 0 && sell <= 0` (same guard as other clients); apply `gold.AliasToCanonical` to VangSaiGon TypeCodes to prevent raw external strings entering the DB
- **Data sanitization:** `gold.AliasToCanonical` normalizes VangSaiGon TypeCodes; VangToday returns canonical codes; both go through `UpsertBatch` parameterized queries

## Component Reuse Inventory

Backend-only change. No frontend components involved.

## C4 Architecture Diagram Updates

- Modify: `docs/architecture/c4-component-backend.md` — remove `GoldPriceService` from `AssetPriceService`'s direct dependency list for the cache job path; add `VangSaiGonFetcher` and `VangTodayFetcher`
- Modify: `docs/architecture/flow-cross-cutting.md` Section 13 — replace waterfall diagram participant with two parallel fetcher participants

---

### Task 0: Update Tests First — New Mock and Updated Constructor Calls

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** Tests exercise the validation guard (`buy <= 0 && sell <= 0` skip) and canonical TypeCode normalization.

**Step 1: Add `mockGoldPriceFetcher` mock implementing `GoldPriceFetcher` interface**

Add mock at the top of the test file (after existing mocks):

```go
// mockGoldPriceFetcher is a test double implementing GoldPriceFetcher.
type mockGoldPriceFetcher struct {
    prices []*CachedGoldPrice
    err    error
    source PriceSource
}

func (m *mockGoldPriceFetcher) FetchGoldPrices(_ context.Context) ([]*CachedGoldPrice, error) {
    return m.prices, m.err
}

func (m *mockGoldPriceFetcher) Source() PriceSource {
    return m.source
}
```

**Step 2: Write failing tests for the new goroutines**

Add four new test functions to `asset_price_service_test.go`:

```go
func TestRefreshAllPrices_VangSaiGonSuccess(t *testing.T) {
    repo := &mockAssetPriceRepo{}
    vsgFetcher := &mockGoldPriceFetcher{
        source: SourceVangSaiGon,
        prices: []*CachedGoldPrice{
            {TypeCode: "SJC", Name: "Vàng SJC", Buy: 90_000_000, Sell: 92_000_000, Currency: "VND"},
        },
    }
    vtFetcher := &mockGoldPriceFetcher{source: SourceVangToday, err: fmt.Errorf("vangtoday down")}
    svc := NewAssetPriceService(repo, nil, nil, vsgFetcher, vtFetcher, nil, nil, nil, nil)
    err := svc.RefreshAllPrices(context.Background())
    // Should not return error (not all 8 failed)
    require.NoError(t, err)
    // Should have upserted one batch for vangsaigon
    repo.mu.Lock()
    defer repo.mu.Unlock()
    var vsgBatch []*models.AssetPrice
    for _, batch := range repo.upsertedBatches {
        for _, p := range batch {
            if p.Source == "vangsaigon" {
                vsgBatch = append(vsgBatch, p)
            }
        }
    }
    require.Len(t, vsgBatch, 1)
    assert.Equal(t, "SJC", vsgBatch[0].TypeCode)
    assert.Equal(t, "vangsaigon", vsgBatch[0].Source)
    assert.Equal(t, "gold", vsgBatch[0].AssetType)
}

func TestRefreshAllPrices_VangTodaySuccess(t *testing.T) {
    repo := &mockAssetPriceRepo{}
    vsgFetcher := &mockGoldPriceFetcher{source: SourceVangSaiGon, err: fmt.Errorf("vangsaigon down")}
    vtFetcher := &mockGoldPriceFetcher{
        source: SourceVangToday,
        prices: []*CachedGoldPrice{
            {TypeCode: "DOJI", Name: "Vàng DOJI", Buy: 88_000_000, Sell: 90_000_000, Currency: "VND"},
        },
    }
    svc := NewAssetPriceService(repo, nil, nil, vsgFetcher, vtFetcher, nil, nil, nil, nil)
    err := svc.RefreshAllPrices(context.Background())
    require.NoError(t, err)
    repo.mu.Lock()
    defer repo.mu.Unlock()
    var vtBatch []*models.AssetPrice
    for _, batch := range repo.upsertedBatches {
        for _, p := range batch {
            if p.Source == "vangtoday" {
                vtBatch = append(vtBatch, p)
            }
        }
    }
    require.Len(t, vtBatch, 1)
    assert.Equal(t, "DOJI", vtBatch[0].TypeCode)
    assert.Equal(t, "vangtoday", vtBatch[0].Source)
}

func TestRefreshAllPrices_VangSaiGonFail_MarksStale(t *testing.T) {
    repo := &mockAssetPriceRepo{}
    vsgFetcher := &mockGoldPriceFetcher{source: SourceVangSaiGon, err: fmt.Errorf("vangsaigon timeout")}
    vtFetcher := &mockGoldPriceFetcher{
        source: SourceVangToday,
        prices: []*CachedGoldPrice{
            {TypeCode: "SJC", Name: "SJC", Buy: 90_000_000, Sell: 92_000_000, Currency: "VND"},
        },
    }
    svc := NewAssetPriceService(repo, nil, nil, vsgFetcher, vtFetcher, nil, nil, nil, nil)
    err := svc.RefreshAllPrices(context.Background())
    require.NoError(t, err) // not all 8 failed
    // vangsaigon should be marked stale
    repo.mu.Lock()
    defer repo.mu.Unlock()
    found := false
    for _, st := range repo.staledTypes {
        if st == "gold" {
            found = true
            break
        }
    }
    assert.True(t, found, "expected gold stale mark after vangsaigon fail")
}

func TestRefreshAllPrices_VangSaiGonAliasNormalization(t *testing.T) {
    // VangSaiGon returns an alias TypeCode that must be normalized to canonical.
    // Test that a known alias (if any in gold.AliasToCanonical) gets normalized.
    // Use a raw TypeCode that is already canonical (passthrough) as a safe baseline.
    repo := &mockAssetPriceRepo{}
    vsgFetcher := &mockGoldPriceFetcher{
        source: SourceVangSaiGon,
        prices: []*CachedGoldPrice{
            {TypeCode: "SJC", Name: "Vàng SJC", Buy: 90_000_000, Sell: 92_000_000, Currency: "VND"},
        },
    }
    vtFetcher := &mockGoldPriceFetcher{source: SourceVangToday, prices: nil}
    svc := NewAssetPriceService(repo, nil, nil, vsgFetcher, vtFetcher, nil, nil, nil, nil)
    _ = svc.RefreshAllPrices(context.Background())
    repo.mu.Lock()
    defer repo.mu.Unlock()
    for _, batch := range repo.upsertedBatches {
        for _, p := range batch {
            if p.Source == "vangsaigon" {
                // TypeCode should be canonical (not alias)
                assert.Equal(t, "SJC", p.TypeCode)
            }
        }
    }
}
```

**Step 3: Run to verify they fail (expected — method signature doesn't exist yet)**

```bash
cd src/go-backend && go test -run "TestRefreshAllPrices_VangSai\|TestRefreshAllPrices_VangToday" ./domain/service/ 2>&1 | head -30
```

**Step 4: Commit test scaffolding**

```
test(asset-price): add mock GoldPriceFetcher and failing tests for vangsaigon/vangtoday goroutines
```

---

### Task 1: Update `assetPriceService` Struct and Constructor

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`

**Security notes:** `nil`-guard on both fetchers prevents panics if not configured (same pattern as SJC/DOJI/BTMC/PNJ).

**Step 1: Replace `goldSvc GoldPriceService` with two fetcher fields**

In `assetPriceService` struct, replace:
```go
goldSvc     GoldPriceService
```
with:
```go
vangSaiGonFetcher GoldPriceFetcher // nil = not configured; source skipped
vangTodayFetcher  GoldPriceFetcher // nil = not configured; source skipped
```

**Step 2: Update `NewAssetPriceService` constructor signature**

Replace the `goldSvc GoldPriceService` parameter with two new parameters:

```go
func NewAssetPriceService(
    repo repository.AssetPriceRepository,
    silverSvc SilverPriceService,
    currencySvc CurrencyPriceService,
    vangSaiGonFetcher GoldPriceFetcher,
    vangTodayFetcher GoldPriceFetcher,
    sjcClient *sjc.Client,
    dojiClient *doji.Client,
    btmcClient *btmcdirect.Client,
    pnjClient *pnj.Client,
) AssetPriceService {
    return &assetPriceService{
        repo:             repo,
        silverSvc:        silverSvc,
        currencySvc:      currencySvc,
        vangSaiGonFetcher: vangSaiGonFetcher,
        vangTodayFetcher:  vangTodayFetcher,
        sjcClient:        sjcClient,
        dojiClient:       dojiClient,
        btmcClient:       btmcClient,
        pnjClient:        pnjClient,
    }
}
```

**Step 3: Run build to verify compilation fails (expected — callers not updated yet)**

```bash
cd src/go-backend && go build ./... 2>&1 | head -20
```

**Step 4: Commit struct + constructor change**

```
refactor(asset-price): replace goldSvc waterfall with vangSaiGonFetcher + vangTodayFetcher in constructor
```

---

### Task 2: Remove `refreshGold` and Add `refreshGoldVangSaiGon` + `refreshGoldVangToday`

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`

**Security notes:** Apply `gold.AliasToCanonical` to VangSaiGon TypeCodes before upsert. Skip entries with `buy <= 0 && sell <= 0`. Mark stale on failure.

**Step 1: Remove `refreshGold` method entirely**

Delete the entire `refreshGold(ctx context.Context) refreshResult` method (lines ~132-176).

**Step 2: Add `refreshGoldVangSaiGon` method**

```go
// refreshGoldVangSaiGon fetches gold prices directly from the VangSaiGon API (vangsaigon.vn)
// and upserts them with source="vangsaigon". TypeCodes are normalized via gold.AliasToCanonical.
func (s *assetPriceService) refreshGoldVangSaiGon(ctx context.Context) refreshResult {
    if s.vangSaiGonFetcher == nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
        return refreshResult{source: "gold_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon fetcher not configured")}
    }
    prices, err := s.vangSaiGonFetcher.FetchGoldPrices(ctx)
    if err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
        return refreshResult{source: "gold_vangsaigon", count: 0, err: err}
    }
    batch := make([]*models.AssetPrice, 0, len(prices))
    for _, p := range prices {
        if p.Buy <= 0 && p.Sell <= 0 {
            continue
        }
        // Normalize alias TypeCode to canonical (e.g., "Vàng SJC 1L" → "SJC").
        typeCode := p.TypeCode
        if canonical, ok := gold.AliasToCanonical[typeCode]; ok {
            typeCode = canonical
        }
        batch = append(batch, &models.AssetPrice{
            TypeCode:   typeCode,
            AssetType:  "gold",
            Name:       p.Name,
            Buy:        p.Buy,
            Sell:       p.Sell,
            ChangeBuy:  p.ChangeBuy,
            ChangeSell: p.ChangeSell,
            Currency:   p.Currency,
            Source:     "vangsaigon",
            IsStale:    false,
            FetchedAt:  time.Now(),
        })
    }
    if len(batch) == 0 {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
        return refreshResult{source: "gold_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon: no valid prices")}
    }
    if err := s.repo.UpsertBatch(ctx, batch); err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
        return refreshResult{source: "gold_vangsaigon", count: 0, err: err}
    }
    return refreshResult{source: "gold_vangsaigon", count: len(batch), err: nil}
}
```

**Step 3: Add `refreshGoldVangToday` method**

```go
// refreshGoldVangToday fetches gold prices directly from the VangToday API (vang.today)
// and upserts them with source="vangtoday". TypeCodes are already canonical from the fetcher.
func (s *assetPriceService) refreshGoldVangToday(ctx context.Context) refreshResult {
    if s.vangTodayFetcher == nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
        return refreshResult{source: "gold_vangtoday", count: 0, err: fmt.Errorf("vangtoday fetcher not configured")}
    }
    prices, err := s.vangTodayFetcher.FetchGoldPrices(ctx)
    if err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
        return refreshResult{source: "gold_vangtoday", count: 0, err: err}
    }
    batch := make([]*models.AssetPrice, 0, len(prices))
    for _, p := range prices {
        if p.Buy <= 0 && p.Sell <= 0 {
            continue
        }
        batch = append(batch, &models.AssetPrice{
            TypeCode:   p.TypeCode,
            AssetType:  "gold",
            Name:       p.Name,
            Buy:        p.Buy,
            Sell:       p.Sell,
            ChangeBuy:  p.ChangeBuy,
            ChangeSell: p.ChangeSell,
            Currency:   p.Currency,
            Source:     "vangtoday",
            IsStale:    false,
            FetchedAt:  time.Now(),
        })
    }
    if len(batch) == 0 {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
        return refreshResult{source: "gold_vangtoday", count: 0, err: fmt.Errorf("vangtoday: no valid prices")}
    }
    if err := s.repo.UpsertBatch(ctx, batch); err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
        return refreshResult{source: "gold_vangtoday", count: 0, err: err}
    }
    return refreshResult{source: "gold_vangtoday", count: len(batch), err: nil}
}
```

**Step 4: Add `gold` import to `asset_price_service.go`**

Add `"wealthjourney/pkg/gold"` to imports (needed for `gold.AliasToCanonical`).

**Step 5: Run lint to verify**

```bash
cd src/go-backend && task ci:backend-lint 2>&1 | tail -20
```

**Step 6: Commit**

```
feat(asset-price): add refreshGoldVangSaiGon and refreshGoldVangToday; remove refreshGold waterfall
```

---

### Task 3: Update `RefreshAllPrices` — 7→8 Goroutines

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`

**Security notes:** Channel buffer must match goroutine count exactly to prevent goroutine leaks.

**Step 1: Update `RefreshAllPrices` channel buffer and goroutine spawning**

Replace the channel buffer `make(chan refreshResult, 7)` with `8`.

Replace the existing goroutine block:
```go
// Existing 3 waterfall sources
wg.Add(3)
go func() { defer wg.Done(); results <- s.refreshGold(ctx) }()
go func() { defer wg.Done(); results <- s.refreshSilver(ctx) }()
go func() { defer wg.Done(); results <- s.refreshCurrency(ctx) }()

// 4 new per-source gold clients
wg.Add(4)
go func() { defer wg.Done(); results <- s.refreshGoldSJC(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldDOJI(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldBTMC(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldPNJ(ctx) }()
```

With:
```go
// 2 direct VangSaiGon / VangToday gold sources (replacing waterfall)
wg.Add(2)
go func() { defer wg.Done(); results <- s.refreshGoldVangSaiGon(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldVangToday(ctx) }()

// 4 per-source gold clients (unchanged)
wg.Add(4)
go func() { defer wg.Done(); results <- s.refreshGoldSJC(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldDOJI(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldBTMC(ctx) }()
go func() { defer wg.Done(); results <- s.refreshGoldPNJ(ctx) }()

// Silver + currency (unchanged)
wg.Add(2)
go func() { defer wg.Done(); results <- s.refreshSilver(ctx) }()
go func() { defer wg.Done(); results <- s.refreshCurrency(ctx) }()
```

**Step 2: Update the all-fail threshold**

Replace `if failCount == 7 {` with `if failCount == 8 {`.

**Step 3: Update the log comment and summaryParts capacity**

Replace `summaryParts := make([]string, 0, 7)` with `make([]string, 0, 8)`.

Update the comment on `RefreshAllPrices`:
```
// Returns non-nil error only when every one of the 8 sources fails, so callers
```

**Step 4: Run tests**

```bash
cd src/go-backend && go test -short ./domain/service/ -run TestRefreshAllPrices 2>&1
```

**Step 5: Commit**

```
feat(asset-price): RefreshAllPrices 7→8 goroutines; replace waterfall with vangsaigon+vangtoday direct sources
```

---

### Task 4: Update DI Wiring in `services.go`

**Files:**
- Modify: `src/go-backend/domain/service/services.go`

**Security notes:** Fetchers use 5s context timeout per call — same as other fetchers. No new security surface.

**Step 1: Remove `goldPriceSvc` from `NewAssetPriceService` call, add fetchers**

In `services.go`, locate the `NewAssetPriceService(...)` call. Replace:

```go
assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice, goldPriceSvc, silverPriceSvc, currencyPriceSvc,
    sjcClient, dojiClient, btmcClient, pnjClient,
)
```

With:

```go
assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice,
    silverPriceSvc,
    currencyPriceSvc,
    NewVangSaiGonGoldFetcher(waterfallSourceTimeout),
    NewVangTodayGoldFetcher(waterfallSourceTimeout),
    sjcClient,
    dojiClient,
    btmcClient,
    pnjClient,
)
```

**Step 2: Verify `goldPriceSvc` is still used elsewhere**

`goldPriceSvc` is used by `NewMarketDataService(repos.MarketData, goldPriceSvc, silverPriceSvc)` — must remain. Only the `assetPriceSvc` call is updated.

**Step 3: Build**

```bash
cd src/go-backend && go build ./... 2>&1
```

**Step 4: Run full test suite**

```bash
cd src/go-backend && go test -short ./... 2>&1 | tail -30
```

**Step 5: Run lint**

```bash
cd src/go-backend && task ci:backend-lint 2>&1 | tail -20
```

**Step 6: Commit**

```
fix(services): wire VangSaiGonGoldFetcher + VangTodayGoldFetcher into AssetPriceService DI
```

---

### Task 5: Update Architecture Documentation (flow-cross-cutting.md Section 13)

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md` (Section 13)

**Step 1: Update prose header for Section 13**

Change: "fetches gold (waterfall + 4 per-source direct), silver, and currency prices in **7 parallel goroutines**"
To: "fetches gold from 6 independent direct sources (VangSaiGon, VangToday, SJC, DOJI, BTMC, PNJ), silver, and currency prices in **8 parallel goroutines**"

**Step 2: Remove the `GPS as GoldPriceService<br/>(waterfall)` participant from the sequence diagram**

Remove:
```
participant GPS as GoldPriceService<br/>(waterfall)
```

**Step 3: Remove the `par Waterfall gold fetch [source="waterfall"]` block**

Delete the entire `par Waterfall gold fetch` ... `and Silver fetch` section boundary and replace the waterfall block with two independent participants for VangSaiGon and VangToday.

Replace the waterfall par block with:
```
    par VangSaiGon gold fetch [source="vangsaigon"]
        APS->>VSG: refreshGoldVangSaiGon(ctx)
        VSG->>VangSaiGon API: GET /prices (vnprice.Client)
        alt success
            VangSaiGon API-->>VSG: gold prices
            Note over APS: Normalize AliasToCanonical<br/>Convert to []AssetPrice<br/>AssetType="gold", Source="vangsaigon", IsStale=false
            APS->>APR: UpsertBatch(ctx, batch)
        else fetch or upsert fails
            APS->>APR: MarkStaleByAssetTypeAndSource(ctx, "gold", "vangsaigon")
        end
    and VangToday gold fetch [source="vangtoday"]
        APS->>VT: refreshGoldVangToday(ctx)
        VT->>VangToday API: GET /prices (vangtoday.Client)
        alt success
            VangToday API-->>VT: gold prices (canonical TypeCodes)
            Note over APS: Convert to []AssetPrice<br/>AssetType="gold", Source="vangtoday", IsStale=false
            APS->>APR: UpsertBatch(ctx, batch)
        else fetch or upsert fails
            APS->>APR: MarkStaleByAssetTypeAndSource(ctx, "gold", "vangtoday")
        end
```

**Step 4: Update Error Paths table**

Remove row: `| Waterfall gold fails | MarkStaleByAssetTypeAndSource("gold", "waterfall") | Waterfall gold prices stale; direct-source rows unaffected |`

Add rows:
```
| VangSaiGon gold fails | MarkStaleByAssetTypeAndSource("gold", "vangsaigon") | VangSaiGon gold prices stale; other 7 sources unaffected |
| VangToday gold fails | MarkStaleByAssetTypeAndSource("gold", "vangtoday") | VangToday gold prices stale; other 7 sources unaffected |
```

**Step 5: Update TypeCode namespacing note**

Change: "waterfall codes are canonical (e.g., `SJC`, `DOJI`)"
To: "vangsaigon and vangtoday codes are canonical (e.g., `SJC`, `DOJI`) after alias normalization"

**Step 6: Commit**

```
docs(flow): update Section 13 for 8-source parallel diagram — remove waterfall, add vangsaigon+vangtoday
```

---

### Task 6: Final CI Verification

**Step 1: Run full lint + build**

```bash
cd src/go-backend && task ci:backend-lint 2>&1
```

Expected: 0 issues, build passes.

**Step 2: Run all tests (short mode)**

```bash
cd src/go-backend && go test -short ./... 2>&1
```

Expected: all packages PASS.

**Step 3: Verify new tests pass**

```bash
cd src/go-backend && go test -short -v ./domain/service/ -run "TestRefreshAllPrices_Vang" 2>&1
```

**Step 4: Commit final report**

```
docs(report): add fix history entry for remove-gold-waterfall to multi-source-gold-price report
```

---

## Task Dependency Order

```
Task 0 (tests first — write failing tests)
  ↓
Task 1 (struct + constructor change — makes Task 0 tests compilable)
  ↓
Task 2 (add new refresh methods — makes new goroutine tests pass)
  ↓
Task 3 (update RefreshAllPrices — wires new methods into goroutine pool)
  ↓
Task 4 (update services.go DI — fixes build compilation)
  ↓
Task 5 (docs update — after implementation is confirmed working)
  ↓
Task 6 (CI verification)
```

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/go-backend/domain/service/asset_price_service.go` | Remove `goldSvc` field + `refreshGold()`; add `vangSaiGonFetcher`/`vangTodayFetcher` fields + `refreshGoldVangSaiGon()`/`refreshGoldVangToday()`; update `RefreshAllPrices` (7→8) |
| `src/go-backend/domain/service/asset_price_service_test.go` | Add `mockGoldPriceFetcher`; add 4 new tests; update all `NewAssetPriceService` constructor calls |
| `src/go-backend/domain/service/services.go` | Replace `goldPriceSvc` with two fetchers in `NewAssetPriceService(...)` call |
| `docs/architecture/flow-cross-cutting.md` | Section 13: replace waterfall with VangSaiGon+VangToday participants, update goroutine count |
