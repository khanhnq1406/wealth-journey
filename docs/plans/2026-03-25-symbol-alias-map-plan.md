# Symbol Alias Map for Cross-Source Gold Price Lookup — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `FetchPriceForSymbol` to find gold prices using cross-source type-code aliases (e.g., `"SJC"` ↔ `"VNGSJC"`) and ensure Mi Hồng type codes from vang.today are not silently dropped.
**Spec:** `docs/specs/2026-03-25-symbol-alias-map-spec.md`
**Architecture:** The fix adds a compile-time `symbolAliasMap` in the service layer. `FetchGoldPricesAllSources` normalizes alias TypeCodes to canonical codes before returning; `FetchPriceForSymbol` benefits automatically. No new external calls; no data model changes.
**Tech Stack:** Go 1.25, domain/service layer, pkg/vangtoday

## Security Implementation Notes

- **No user input involved** — alias map is a compile-time constant; no injection surface.
- **No authorization changes** — price data is public.
- **Price integrity unchanged** — zero/negative price guards in vangtoday client remain in place; normalization only changes TypeCode string, not Buy/Sell values.
- **Error detail exposure** — existing log warnings are acceptable (no user-visible internal error details).

## Component Reuse Inventory

No frontend changes — backend-only fix.

## C4 Architecture Diagram Updates

No structural changes to C4 diagrams — this is a bug fix within existing components.

---

### Task 1: Add MIHONG prefix to vangtoday goldTypePrefixes

**Files:**
- Modify: `src/go-backend/pkg/vangtoday/client.go` (line 34–39)
- Test: `src/go-backend/pkg/vangtoday/client_test.go`

**Security notes:** Adding a new prefix only affects classification of type codes into "gold" vs. "unknown". A mistakenly classified currency entry would have no security impact — it gets a TypeCode that no caller would look up.

**Step 1: Write the failing test**

Add to `pkg/vangtoday/client_test.go`:

```go
func TestVangTodayClient_MIHONGGoldClassified(t *testing.T) {
	jsonWithMIHONG := `{
		"success": true,
		"timestamp": 1774400000,
		"prices": {
			"MIHONG999": {"name":"Mi Hong 999","buy":172000000,"sell":175000000,"change_buy":0,"change_sell":0,"currency":"VND"},
			"MIHONG_VN": {"name":"Mi Hong VN","buy":170000000,"sell":173000000,"change_buy":0,"change_sell":0,"currency":"VND"}
		}
	}`

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, jsonWithMIHONG)
	}))
	defer srv.Close()

	client := NewClient(5 * time.Second)
	client.baseURL = srv.URL

	result, err := client.FetchPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.GoldPrices) != 2 {
		t.Errorf("expected 2 MIHONG gold prices, got %d", len(result.GoldPrices))
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestVangTodayClient_MIHONGGoldClassified ./pkg/vangtoday/...
# Expected: FAIL — got 0 gold prices (MIHONG not in prefix list)
```

**Step 3: Write minimal implementation**

In `pkg/vangtoday/client.go`, add `"MIHONG"` to `goldTypePrefixes`:

```go
var goldTypePrefixes = []string{
	// New API codes
	"XAUUSD", "DOHN", "DOHCM", "DOJI", "VNGSJC", "PQHN", "BTSJC", "BT9999", "VIETTINM", "SJ",
	"MIHONG",
	// Legacy codes (kept for compatibility if API reverts)
	"SJC", "PNJ", "BTMC", "BAOTINMINH", "XAU", "NHAN", "VSG", "AAA", "AGJ",
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestVangTodayClient_MIHONGGoldClassified ./pkg/vangtoday/...
# Expected: PASS
```

**Step 5: Run full package tests**

```bash
cd src/go-backend && go test ./pkg/vangtoday/...
# Expected: all green
```

**Step 6: Commit**

```
fix(vangtoday): add MIHONG prefix to goldTypePrefixes to prevent silent drop
```

---

### Task 2: Add symbolAliasMap and alias-aware normalization in WaterfallGoldFetcher

**Files:**
- Modify: `src/go-backend/domain/service/price_fetcher.go`
- Test: `src/go-backend/domain/service/price_fetcher_test.go`

**Security notes:** Alias map is a compile-time constant with string keys. Normalization only replaces TypeCode strings; it does not affect Buy/Sell values. No user input.

**Step 1: Write the failing test**

Add to `domain/service/price_fetcher_test.go`:

```go
func TestWaterfallGoldFetcher_AllSources_AliasNormalization(t *testing.T) {
	// vang.today returns "VNGSJC" for SJC gold (a known alias for canonical "SJC")
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "VNGSJC", Name: "VN Gold SJC", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// VNGSJC should be normalized to canonical "SJC"
	var found bool
	for _, p := range prices {
		if p.TypeCode == "SJC" {
			found = true
			if p.Buy != 172_000_000 {
				t.Errorf("SJC Buy: expected 172000000, got %d", p.Buy)
			}
		}
	}
	if !found {
		t.Error("expected canonical TypeCode 'SJC' in merged prices, got none")
	}
}

func TestWaterfallGoldFetcher_AllSources_NonAliasUnchanged(t *testing.T) {
	// DOHNL has no alias — it should pass through unchanged
	vangtodayFetcher := &mockGoldFetcher{
		source: SourceVangToday,
		prices: []*CachedGoldPrice{
			{TypeCode: "DOHNL", Name: "DOJI Hanoi", Buy: 170_000_000, Sell: 172_000_000, Currency: "VND"},
		},
	}

	health := &alwaysHealthy{}
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangtodayFetcher}, health)

	prices, err := wf.FetchGoldPricesAllSources(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(prices) != 1 || prices[0].TypeCode != "DOHNL" {
		t.Errorf("expected DOHNL unchanged, got %+v", prices)
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestWaterfallGoldFetcher_AllSources_Alias ./domain/service/...
# Expected: FAIL — VNGSJC not normalized to SJC
```

**Step 3: Write minimal implementation**

In `domain/service/price_fetcher.go`, add the alias map and update `FetchGoldPricesAllSources`:

```go
// symbolAliasMap maps canonical TypeCodes (as registered in pkg/gold/types.go)
// to the equivalent TypeCodes that may be returned by fallback sources.
// When FetchGoldPricesAllSources merges results, alias TypeCodes are normalized
// to their canonical form so callers always see consistent TypeCodes.
//
// Maintenance: add entries when a source uses a different code for the same
// gold product (e.g. vang.today uses "VNGSJC" for what vangsaigon calls "SJC").
var symbolAliasMap = map[string]string{
	// canonical → alias (i.e., alias → canonical, keyed by alias for O(1) lookup)
	// Restructured as aliasToCanonical for lookup during normalization.
}

// aliasToCanonical maps each known alias TypeCode to its canonical TypeCode.
// This is the reverse of the conceptual "canonical → [aliases]" map.
var aliasToCanonical = map[string]string{
	"VNGSJC": "SJC", // vang.today's code for SJC gold (vangsaigon canonical: "SJC")
}
```

Then update `FetchGoldPricesAllSources` to normalize aliases after merging:

```go
// FetchGoldPricesAllSources queries every configured source regardless of health
// status and merges the results (first-source-wins on TypeCode conflict after
// alias normalization). Sources that fail are skipped with a warning log.
func (w *WaterfallGoldFetcher) FetchGoldPricesAllSources(ctx context.Context) ([]*CachedGoldPrice, error) {
	merged := make(map[string]*CachedGoldPrice)
	var lastErr error

	for _, fetcher := range w.fetchers {
		fetchCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		prices, err := fetcher.FetchGoldPrices(fetchCtx)
		cancel()

		if err != nil {
			log.Printf("[WaterfallGoldFetcher] all-sources: source %q failed after ...: %v", fetcher.Source(), err)
			lastErr = err
			continue
		}

		for _, p := range prices {
			// Normalize alias TypeCode to canonical before merging.
			canonical := p.TypeCode
			if c, ok := aliasToCanonical[p.TypeCode]; ok {
				canonical = c
			}

			// First-source-wins: don't overwrite an entry already set by a
			// higher-priority source.
			if _, exists := merged[canonical]; !exists {
				normalized := *p
				normalized.TypeCode = canonical
				merged[canonical] = &normalized
			}
		}
	}

	if len(merged) == 0 {
		if lastErr != nil {
			return nil, fmt.Errorf("all sources failed: %w", lastErr)
		}
		return nil, fmt.Errorf("all sources returned empty results")
	}

	result := make([]*CachedGoldPrice, 0, len(merged))
	for _, p := range merged {
		result = append(result, p)
	}
	return result, nil
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestWaterfallGoldFetcher_AllSources_Alias ./domain/service/...
# Expected: PASS
```

**Step 5: Run all domain/service tests**

```bash
cd src/go-backend && go test ./domain/service/...
# Expected: all green
```

**Step 6: Commit**

```
fix(price-fallback): add aliasToCanonical map to normalize VNGSJC→SJC in FetchGoldPricesAllSources
```

---

### Task 3: End-to-end test — FetchPriceForSymbol with alias

**Files:**
- Test: `src/go-backend/domain/service/gold_price_service_test.go`

**Security notes:** No security implications — test only.

**Step 1: Write the failing test**

Add to `domain/service/gold_price_service_test.go`:

```go
func TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday(t *testing.T) {
	// Simulates: vangsaigon is down, vang.today returns "VNGSJC" for SJC gold.
	// FetchPriceForSymbol("SJC") should find it via the alias map.
	rdb, _ := miniredis.Run()
	defer rdb.Close()
	client := redis.NewClient(&redis.Options{Addr: rdb.Addr()})

	// vangsaigon fails
	vangsaigonFetcher := newVangSaiGonGoldFetcherWithStub(func(ctx context.Context) (*vnprice.PricesResponse, error) {
		return nil, fmt.Errorf("vangsaigon: connection refused")
	})
	// vang.today returns VNGSJC
	vangtodayFetcher := newVangTodayGoldFetcherWithStub(func(ctx context.Context) (*vangtoday.PricesResponse, error) {
		return &vangtoday.PricesResponse{
			GoldPrices: []*vangtoday.GoldPrice{
				{TypeCode: "VNGSJC", Name: "VN Gold SJC", Buy: 172_000_000, Sell: 175_000_000, Currency: "VND"},
			},
		}, nil
	})

	healthTracker := NewSourceHealthCacheAdapter(cache.NewSourceHealthCache(client))
	wf := NewWaterfallGoldFetcher([]GoldPriceFetcher{vangsaigonFetcher, vangtodayFetcher}, healthTracker)
	svc := &goldPriceService{waterfall: wf, cache: cache.NewGoldPriceCache(client)}

	got, err := svc.FetchPriceForSymbol(context.Background(), "SJC")
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if got.TypeCode != "SJC" {
		t.Errorf("expected TypeCode 'SJC', got %q", got.TypeCode)
	}
	if got.Buy != 172_000_000 {
		t.Errorf("expected Buy 172000000, got %d", got.Buy)
	}
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday ./domain/service/...
# Expected: FAIL — "SJC" not found in live price data
```

**Step 3: Verify test passes after Task 2 implementation**

The alias normalization in `FetchGoldPricesAllSources` (Task 2) means the merged result will contain TypeCode `"SJC"` from the `"VNGSJC"` alias. `FetchPriceForSymbol`'s existing loop at `gold_price_service.go:144` finds `p.TypeCode == "SJC"` and returns it.

**No code change needed in `gold_price_service.go`** — the fix lives entirely in the waterfall layer.

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestGoldPriceService_FetchPriceForSymbol_AliasFromVangToday ./domain/service/...
# Expected: PASS
```

**Step 5: Run all tests**

```bash
cd src/go-backend && go test -short ./...
# Expected: all green
```

**Step 6: Commit**

```
test(price-fallback): add FetchPriceForSymbol alias end-to-end test
```

---

### Task 4: Lint and build verification

**Files:**
- No code changes; verification only.

**Steps:**

```bash
cd src/go-backend && task ci:backend-lint
# Expected: 0 issues

cd src/go-backend && go build ./...
# Expected: clean

cd src/go-backend && go test -short ./...
# Expected: all green
```

**Step 2: Commit** (if any lint fixes needed)

```
fix(price-fallback): lint cleanup
```

---

### Task 5: Update flow-cross-cutting.md §12

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read the current §12 flowchart for `FetchPriceForSymbol`
2. Add an "Alias lookup" step after the "direct TypeCode match?" diamond:
   - If direct match: return (unchanged)
   - If no direct match: check `aliasToCanonical` — if alias exists in results, return with canonical TypeCode
   - If no alias match: fall through to emergency cache
3. Update the "Key Invariants" section to note that canonical TypeCodes are always returned

**Step 2: Commit**

```
docs(price-fallback): update FetchPriceForSymbol flow diagram to show alias-map step
```

---

### Task 6: Update implementation report

**Files:**
- Modify: `docs/reports/2026-03-25-price-fallback-report.md`

**Steps:**

1. Append to Fix History table:

```markdown
| 2026-03-25 | FetchGoldPricesAllSources: normalize alias TypeCodes (VNGSJC→SJC); add MIHONG prefix to vangtoday classifier | Minor | pending |
```

2. Add "Fix 3" section with root cause, changes made, security review result

---

## Task Order Summary

| Order | Task | Depends On |
|-------|------|------------|
| 1 | Add MIHONG prefix (vangtoday) | — |
| 2 | Add aliasToCanonical + normalize in FetchGoldPricesAllSources | — |
| 3 | E2E test FetchPriceForSymbol with alias | Task 2 |
| 4 | Lint + build verification | Tasks 1–3 |
| 5 | Update flow diagram | Tasks 1–3 |
| 6 | Update implementation report | Task 4 |

Tasks 1 and 2 are independent and can be done in parallel.
