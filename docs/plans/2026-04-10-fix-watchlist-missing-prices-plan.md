# Fix Watchlist Missing Prices — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the TypeCode-keyed lookup maps for gold/silver/currency items in `watchlistService.ListItems()` with `marketDataSvc.GetPrice()` calls (same path used by market items), so that all asset types resolve prices through `AssetDisplayConfigService.ResolvePrice()`.

**Spec:** `docs/specs/2026-04-10-fix-watchlist-missing-prices-spec.md`

**Architecture:** `WatchlistService` already holds a `marketDataSvc MarketDataService` dependency. `MarketDataService.GetPrice()` already correctly routes gold/silver/currency to `AssetDisplayConfigService.ResolvePrice()`, which bridges symbol → vendor TypeCode → cached price. The fix removes the broken direct-map lookup and routes all non-market items through the same `GetPrice()` goroutine fan-out as market items.

**Tech Stack:** Go 1.25, `sync.WaitGroup`, proto-generated `InvestmentType`, `wealthjourney/pkg/gold` / `silver` helpers.

---

## Security Implementation Notes

- **Authentication:** Unchanged — JWT auth middleware enforced at handler level; `userID` always from token, never request params.
- **Authorization:** Unchanged — `ListByUserID(userID)` scopes all DB reads to the authenticated user.
- **Input validation:** No new user input introduced. The `symbol` and `assetType` values passed to `GetPrice()` originate from the `watchlist` DB table (written at add-time with existing validation), not from the current request.
- **Data sanitization:** GORM parameterized queries; no user input reaches DB in this fix.
- **Error propagation:** `GetPrice()` errors must be logged and the item skipped (zero prices), never returned to the client as error messages.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend changes. This is a backend-only fix.

---

## C4 Architecture Diagram Updates

No structural C4 changes — `WatchlistService` already depends on `MarketDataService`. The dependency graph is unchanged; only the internal behavior changes. Per the spec, no diagram update needed.

---

## Task 0: Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-watchlist.md` — Section 2: List Watchlist with Price Enrichment

**Security notes:** No security concerns — diagram-only update.

**Steps:**

1. Read current Section 2 diagram in `flow-watchlist.md` (lines 72–141).
2. Remove `GPS` (GoldPriceService) and `SPS` (SilverPriceService) participants.
3. Remove the separate gold/silver/currency enrichment blocks inside the `par` section.
4. Show all items (gold + silver + currency + market) as a single parallel goroutine fan-out through `MDS.GetPrice()`.
5. Add a note: `MDS → AssetDisplayConfigService.ResolvePrice() for gold/silver/currency`.
6. Remove the `AssetPriceService.GetAllPrices()` call from the diagram (it's no longer called in ListItems).
7. Update grouping note — all items grouped into a single goroutine loop, not split by type.
8. Commit with message: `docs: update flow-watchlist to reflect GetPrice-based price enrichment`.

**Expected new diagram structure:**

```
SPA → H: GET /api/v1/watchlist
H → WS: ListItems(userID)
WS → WR: ListByUserID(userID)
loop Each item (gold + silver + currency + market) [parallel goroutine]
    WS → MDS: GetPrice(ctx, symbol, currency, assetType, 15m)
    alt gold/silver/currency (GOLD_VND | GOLD_USD | SILVER_VND | FOREIGN_CURRENCY)
        MDS → ADCS: ResolvePrice(ctx, symbol, assetType)
        ADCS → DB: SELECT asset_price WHERE fetch_code matches (parameterized)
        DB → ADCS: buy, sell int64
        ADCS → MDS: buy, sell, isStale
    else market/stock
        MDS → YahooFinance: fetch live price
    end
    MDS → WS: MarketData {Price, Change24h} or error
    alt error
        WS: log warning, skip (zero prices)
    end
end
WS: build proto items, merge priceMap
H → SPA: 200 OK {items}
```

---

## Task 1: Rewrite `ListItems()` Price Enrichment Logic

**Files:**

- Modify: `src/go-backend/domain/service/watchlist_service.go` — lines 139–233 (price enrichment section)

**Security notes:**
- Errors from `GetPrice()` must be logged with warning, not returned to client.
- `item` loop variable must be captured per goroutine (`item := item`).
- No new external API calls — `GetPrice()` reads from `asset_price` DB cache for gold/silver/currency.

**Step 1: Write the failing tests**

Add these tests to `src/go-backend/domain/service/watchlist_service_test.go`:

```go
// TestWatchlistService_ListItems_GoldViaGetPrice verifies that a gold watchlist item
// with a symbol that does NOT match a TypeCode directly (e.g. "Eximbank") still
// resolves prices through MarketDataService.GetPrice() rather than a direct TypeCode map.
func TestWatchlistService_ListItems_GoldViaGetPrice(t *testing.T) {
    const symbol = "Eximbank"
    const wantBuy int64 = 9_200_000_000
    const wantSell int64 = 9_300_000_000

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
    // Old path: assetSvc returns no entry for "Eximbank" TypeCode — this was the bug.
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    // New path: marketDataSvc.GetPrice resolves via ResolvePrice.
    mktSvc := &mockWatchlistMarketDataSvc{
        prices: map[string]*models.MarketData{
            symbol: {Symbol: symbol, Price: wantBuy, Change24h: 0},
        },
    }

    svc := newWatchlistSvc(repo, assetSvc, mktSvc)

    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems returned unexpected error: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    item := resp.Items[0]
    if item.BuyPrice != wantBuy {
        t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantBuy)
    }
}

// TestWatchlistService_ListItems_CurrencyViaGetPrice verifies that a currency item
// ("USD") resolves prices through MarketDataService.GetPrice() not a direct TypeCode map.
func TestWatchlistService_ListItems_CurrencyViaGetPrice(t *testing.T) {
    const symbol = "USD"
    const wantBuy int64 = 25_800_000

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{currencyWatchlistItem(symbol)}}
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    mktSvc := &mockWatchlistMarketDataSvc{
        prices: map[string]*models.MarketData{
            symbol: {Symbol: symbol, Price: wantBuy, Change24h: 0},
        },
    }

    svc := newWatchlistSvc(repo, assetSvc, mktSvc)

    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems returned unexpected error: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    item := resp.Items[0]
    if item.BuyPrice != wantBuy {
        t.Errorf("BuyPrice: got %d, want %d", item.BuyPrice, wantBuy)
    }
}

// TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices verifies that a
// GetPrice() failure for one item does NOT return an error — it logs and returns zero prices.
func TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices(t *testing.T) {
    const symbol = "Eximbank"

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    mktSvc := &mockWatchlistMarketDataSvc{err: errors.New("price service unavailable")}

    svc := newWatchlistSvc(repo, assetSvc, mktSvc)

    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems must not return error when GetPrice fails: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    item := resp.Items[0]
    if item.BuyPrice != 0 {
        t.Errorf("BuyPrice: got %d, want 0 (GetPrice failed → zero)", item.BuyPrice)
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems_GoldViaGetPrice|TestWatchlistService_ListItems_CurrencyViaGetPrice|TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices" ./domain/service/ -v
```

Expected: Tests fail because current implementation uses `assetSvc.GetAllPrices()` (and `emptyAllPrices()` has no entry), instead of `mktSvc.GetPrice()`.

**Step 3: Write the implementation**

In `watchlist_service.go`, replace lines 139–233 with:

```go
	// Price maps keyed by symbol
	type priceInfo struct {
		currentPrice       int64
		buyPrice           int64
		sellPrice          int64
		priceChange        int64
		priceChangePercent float64
	}
	priceMap := make(map[string]*priceInfo, len(items))
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Fetch all item prices via MarketDataService.GetPrice(), which routes:
	//   - gold/silver/currency → AssetDisplayConfigService.ResolvePrice() (DB cache)
	//   - market/crypto        → Yahoo Finance (live, cached 15m in Redis)
	// One goroutine per item for bounded parallelism (50-item cap).
	for _, item := range items {
		item := item // capture loop variable
		wg.Add(1)
		go func() {
			defer wg.Done()
			md, err := s.marketDataSvc.GetPrice(ctx, item.Symbol, item.Currency, v1.InvestmentType(item.AssetType), 15*time.Minute)
			if err != nil {
				log.Printf("Warning: failed to fetch price for watchlist item %s (type %d): %v", item.Symbol, item.AssetType, err)
				return
			}
			mu.Lock()
			defer mu.Unlock()
			priceMap[item.Symbol] = &priceInfo{
				currentPrice:       md.Price,
				buyPrice:           md.BuyPrice,
				sellPrice:          md.SellPrice,
				priceChangePercent: md.Change24h,
			}
		}()
	}

	wg.Wait()
```

Also remove the now-unused imports: `"wealthjourney/pkg/gold"`, `"wealthjourney/pkg/silver"`, and the `assetPriceSvc` field usage (the field can stay in the struct for now since `assetPriceSvc` may be used in future methods — verify there are no other call sites in `ListItems`).

> **Critical:** Check `models.MarketData` struct for the `BuyPrice` and `SellPrice` field names before writing. If the struct only has `Price`, use `md.Price` for both `buyPrice` and `sellPrice` (same as current market item code at line 225–228).

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems" ./domain/service/ -v
```

Expected: All 8 tests pass (3 new + 5 existing).

**Step 5: Remove unused imports / verify lint**

```bash
cd src/go-backend && task ci:backend-lint
```

Fix any import errors (remove `"wealthjourney/pkg/gold"`, `"wealthjourney/pkg/silver"` from `watchlist_service.go` imports if no longer needed by any other method in the file).

**Step 6: Verify full build and tests**

```bash
cd src/go-backend && go build ./... && go test -short ./domain/service/ -v
```

**Step 7: Commit**

```
fix(watchlist): route gold/silver/currency prices through MarketDataService.GetPrice()

Fixes N/A prices for gold/silver/currency watchlist items. Replaces the
TypeCode-keyed lookup maps (which assumed item.Symbol == TypeCode) with
the same MarketDataService.GetPrice() goroutine fan-out used by market items.
GetPrice() routes via AssetDisplayConfigService.ResolvePrice() which correctly
bridges symbol → vendor TypeCode → cached price in asset_price table.
```

---

## Task 2: Update Existing Tests to Match New Architecture

**Files:**

- Modify: `src/go-backend/domain/service/watchlist_service_test.go`

**Context:** The existing tests (`TestWatchlistService_ListItems_GoldFromDB`, `TestWatchlistService_ListItems_SilverFromDB`, `TestWatchlistService_ListItems_CurrencyFromDB`, `TestWatchlistService_ListItems_DBEmptyReturnsZeroPrices`, `TestWatchlistService_ListItems_MixedAssetTypes`) currently pass mock prices via `mockAssetPriceSvc`. After the fix, gold/silver/currency prices come from `mockWatchlistMarketDataSvc.GetPrice()` instead. Those tests must be updated to pass data via `mktSvc`, not `assetSvc`.

**Security notes:** Test-only change — no security concerns.

**Step 1: Update each existing gold/silver/currency test**

For `TestWatchlistService_ListItems_GoldFromDB`:
- Change: `assetSvc := &mockAssetPriceSvc{allPrices: allPricesWithGold(symbol, wantBuy, wantSell)}`
- To: `mktSvc := &mockWatchlistMarketDataSvc{prices: map[string]*models.MarketData{symbol: {Symbol: symbol, Price: wantBuy, Change24h: 0}}}`
- Update assertions to match MarketData field names (`md.Price` → `currentPrice`, `buyPrice`, `sellPrice`)

For `TestWatchlistService_ListItems_SilverFromDB` — same pattern.

For `TestWatchlistService_ListItems_CurrencyFromDB` — same pattern.

For `TestWatchlistService_ListItems_DBEmptyReturnsZeroPrices`:
- This test verifies zero prices when no price available.
- Change: pass `mktSvc` with `err: errors.New("not found")` (simulates no config) instead of empty `assetSvc`.
- `assetSvc` can remain as `emptyAllPrices()` — it's just unused now.

For `TestWatchlistService_ListItems_MixedAssetTypes`:
- Move gold/silver/currency price data from `assetSvc.allPrices` into `mktSvc.prices` map.
- Stock item stays in `mktSvc.prices` as before.

**Step 2: Run all tests**

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems" ./domain/service/ -v
```

Expected: All 8 tests pass.

**Step 3: Commit**

```
test(watchlist): update ListItems tests to use MarketDataService mock for all asset types

Reflects new price enrichment path: gold/silver/currency now routed through
MarketDataService.GetPrice() instead of AssetPriceService lookup maps.
```

---

## Note on `models.MarketData` Fields

Before Task 1 Step 3, verify the `MarketData` struct fields:

```bash
grep -n "BuyPrice\|SellPrice\|Price " src/go-backend/domain/models/market_data.go
```

If `MarketData` has only `Price` (no `BuyPrice`/`SellPrice`), use:
```go
priceMap[item.Symbol] = &priceInfo{
    currentPrice:       md.Price,
    buyPrice:           md.Price,
    sellPrice:          md.Price,
    priceChangePercent: md.Change24h,
}
```

This matches the current market-item code at lines 225–228. For gold/silver, `buyPrice == sellPrice == Price` is acceptable since `AssetDisplayConfigService.ResolvePrice()` returns the buy price in `md.Price`.

> **Alternative:** If `MarketData` already has `BuyPrice`/`SellPrice` fields (populated by the gold/silver DB fetch path in `market_data_service.go`), use them directly. Check the struct definition before writing.

---

## Task Execution Order

```
Task 0 (flow diagram update) — independent, can be done first or last
Task 1 (implementation + new tests) — must come first
Task 2 (update existing tests) — must come after Task 1 (tests will fail with old mock setup)
```

**Recommended order:** Task 1 → Task 2 → Task 0
