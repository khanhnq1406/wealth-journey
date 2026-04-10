# Fix Watchlist Gold/Silver Price Unit — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Route gold/silver/currency watchlist price enrichment through `AssetDisplayConfigService.ResolvePrice()` directly, bypassing the `ProcessMarketPrice` unit conversion that was returning per-gram prices instead of per-lượng market prices.

**Spec:** `docs/specs/2026-04-10-fix-watchlist-gold-price-unit-spec.md`

**Architecture:** `WatchlistService.ListItems()` currently calls `MarketDataService.GetPrice()` for ALL asset types. For gold/silver, `GetPrice()` applies `goldConverter.ProcessMarketPrice()` converting per-lượng → per-gram (÷37.5), which is correct for investment portfolio value but wrong for watchlist market price display. The fix adds `AssetDisplayConfigService` as a direct dependency of `WatchlistService` and splits the price enrichment loop: gold/silver/currency items use `ResolvePrice()` (raw DB price), market items keep `GetPrice()`.

**Tech Stack:** Go 1.25, GORM, PostgreSQL

## Security Implementation Notes

- **Authentication:** Unchanged — JWT middleware at handler level
- **Authorization:** Unchanged — `ListByUserID(userID)` scopes all DB reads to authenticated user
- **Input validation:** No new inputs. `symbol` and `assetType` come from DB rows written at item-creation time, not from the request
- **Data sanitization:** No user-controlled data flows through the new price path

## Component Reuse Inventory

Backend-only change. No frontend components involved.

## C4 Architecture Diagram Updates

No C4 diagram changes — this is a wiring detail within an existing service dependency.

---

### Task 1: Wire `AssetDisplayConfigService` into `WatchlistService` and Fix Price Enrichment

**Files:**

- Modify: `src/go-backend/domain/service/watchlist_service.go` (constructor + `ListItems()`)
- Modify: `src/go-backend/domain/service/services.go` (line 131 — pass `assetDisplayConfigSvc`)
- Modify: `src/go-backend/domain/service/watchlist_service_test.go` (add mock + 3 new tests, update 2 existing)

**Security notes:** No new inputs, no auth changes. `ResolvePrice()` reads only from `asset_price` table via parameterized queries — no injection risk.

**Step 1: Write the failing tests**

In `watchlist_service_test.go`, add:

```go
// mockAssetDisplayConfigSvc is a test double for AssetDisplayConfigService.ResolvePrice().
type mockAssetDisplayConfigSvc struct {
    prices map[string]struct {
        buy, sell int64
        isStale   bool
        err       error
    }
}

func (m *mockAssetDisplayConfigSvc) ResolvePrice(_ context.Context, typeCode, _ string) (int64, int64, bool, error) {
    if p, ok := m.prices[typeCode]; ok {
        return p.buy, p.sell, p.isStale, p.err
    }
    return 0, 0, false, apperrors.NewNotFoundError("no price for " + typeCode)
}

// Add all other AssetDisplayConfigService interface methods as no-ops:
func (m *mockAssetDisplayConfigSvc) GetDisplayPrices(_ context.Context, _ string) ([]*AssetDisplayPriceDTO, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) ListAll(_ context.Context, _ string) ([]*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) Create(_ context.Context, _, _, _ string, _ int32, _, _ bool) (*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) Update(_ context.Context, _ int32, _ string, _ int32, _, _ bool) (*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) Delete(_ context.Context, _ int32) error { return nil }
func (m *mockAssetDisplayConfigSvc) ListFetchCodes(_ context.Context, _ int32) ([]*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) CreateFetchCode(_ context.Context, _ int32, _ string, _ int32) (*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) UpdateFetchCode(_ context.Context, _ int32, _ int32) (*models.AssetConfigFetchCode, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) DeleteFetchCode(_ context.Context, _ int32) error { return nil }
func (m *mockAssetDisplayConfigSvc) ListForInvestment(_ context.Context, _ string) ([]*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) GetFetchCodesByAssetType(_ context.Context, _ string) (map[string]*models.AssetDisplayConfig, error) {
    return nil, nil
}
func (m *mockAssetDisplayConfigSvc) ListAvailableTypeCodes(_ context.Context, _ string) ([]string, error) {
    return nil, nil
}
```

Update `newWatchlistSvc` helper to accept `AssetDisplayConfigService`:
```go
func newWatchlistSvc(repo repository.WatchlistRepository, assetSvc AssetPriceService, mktSvc MarketDataService, adcSvc AssetDisplayConfigService) WatchlistService {
    return NewWatchlistService(repo, assetSvc, mktSvc, adcSvc)
}
```

Add 3 new tests:

```go
// TestWatchlistService_ListItems_GoldViaResolvePrice_RawMarketPrice verifies that a
// GOLD_VND watchlist item gets the raw per-lượng price from ResolvePrice (not ProcessMarketPrice).
func TestWatchlistService_ListItems_GoldViaResolvePrice_RawMarketPrice(t *testing.T) {
    const symbol = "Mihong_999"
    const wantBuy int64 = 171_000_000 // raw per-lượng price from asset_price table

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    mktSvc := &mockWatchlistMarketDataSvc{}
    adcSvc := &mockAssetDisplayConfigSvc{
        prices: map[string]struct {
            buy, sell int64; isStale bool; err error
        }{
            symbol: {buy: wantBuy, sell: 172_700_000},
        },
    }

    svc := newWatchlistSvc(repo, assetSvc, mktSvc, adcSvc)
    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems returned unexpected error: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    got := resp.Items[0]
    if got.BuyPrice != wantBuy {
        t.Errorf("BuyPrice: got %d, want %d", got.BuyPrice, wantBuy)
    }
}

// TestWatchlistService_ListItems_GoldResolvePriceError_ZeroPrices verifies that a
// ResolvePrice failure results in zero prices and no error returned to caller.
func TestWatchlistService_ListItems_GoldResolvePriceError_ZeroPrices(t *testing.T) {
    const symbol = "Mihong_999"

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{goldWatchlistItem(symbol)}}
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    mktSvc := &mockWatchlistMarketDataSvc{}
    adcSvc := &mockAssetDisplayConfigSvc{} // empty — ResolvePrice returns not-found

    svc := newWatchlistSvc(repo, assetSvc, mktSvc, adcSvc)
    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems should not return error on ResolvePrice failure: %v", err)
    }
    if len(resp.Items) != 1 {
        t.Fatalf("expected 1 item, got %d", len(resp.Items))
    }
    got := resp.Items[0]
    if got.BuyPrice != 0 {
        t.Errorf("BuyPrice: got %d, want 0 on price error", got.BuyPrice)
    }
}

// TestWatchlistService_ListItems_MixedTypes_GoldFromResolve_StockFromGetPrice verifies
// that in a mixed watchlist, gold uses ResolvePrice and stock uses GetPrice.
func TestWatchlistService_ListItems_MixedTypes_GoldFromResolve_StockFromGetPrice(t *testing.T) {
    const goldSymbol = "Mihong_999"
    const stockSymbol = "AAPL"
    const wantGoldBuy int64 = 171_000_000
    const wantStockPrice int64 = 21_500_000

    repo := &mockWatchlistRepo{items: []*models.WatchlistItem{
        goldWatchlistItem(goldSymbol),
        stockWatchlistItem(stockSymbol),
    }}
    assetSvc := &mockAssetPriceSvc{allPrices: emptyAllPrices()}
    mktSvc := &mockWatchlistMarketDataSvc{
        prices: map[string]*models.MarketData{
            stockSymbol: {Symbol: stockSymbol, Price: wantStockPrice},
        },
    }
    adcSvc := &mockAssetDisplayConfigSvc{
        prices: map[string]struct {
            buy, sell int64; isStale bool; err error
        }{
            goldSymbol: {buy: wantGoldBuy, sell: 172_700_000},
        },
    }

    svc := newWatchlistSvc(repo, assetSvc, mktSvc, adcSvc)
    resp, err := svc.ListItems(context.Background(), 42)
    if err != nil {
        t.Fatalf("ListItems error: %v", err)
    }

    priceBySymbol := map[string]*v1.WatchlistItem{}
    for _, item := range resp.Items {
        priceBySymbol[item.Symbol] = item
    }

    if priceBySymbol[goldSymbol].BuyPrice != wantGoldBuy {
        t.Errorf("gold BuyPrice: got %d, want %d", priceBySymbol[goldSymbol].BuyPrice, wantGoldBuy)
    }
    if priceBySymbol[stockSymbol].CurrentPrice != wantStockPrice {
        t.Errorf("stock CurrentPrice: got %d, want %d", priceBySymbol[stockSymbol].CurrentPrice, wantStockPrice)
    }
}
```

Also need `stockWatchlistItem` helper (add alongside existing `goldWatchlistItem`):
```go
func stockWatchlistItem(symbol string) *models.WatchlistItem {
    return &models.WatchlistItem{
        ID: 2, UserID: 42, Symbol: symbol, Name: symbol,
        AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
        Currency: "USD", SortOrder: 2,
    }
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestWatchlistService_ListItems_GoldViaResolvePrice_RawMarketPrice|TestWatchlistService_ListItems_GoldResolvePriceError_ZeroPrices|TestWatchlistService_ListItems_MixedTypes" ./domain/service/ -v
# Expected: compile error (NewWatchlistService takes 3 args, not 4) OR test failure
```

**Step 3: Update `watchlist_service.go`**

Add field and update constructor:
```go
type watchlistService struct {
    watchlistRepo    repository.WatchlistRepository
    assetPriceSvc   AssetPriceService
    marketDataSvc   MarketDataService
    assetDisplaySvc AssetDisplayConfigService // NEW
}

func NewWatchlistService(
    watchlistRepo repository.WatchlistRepository,
    assetPriceSvc AssetPriceService,
    marketDataSvc MarketDataService,
    assetDisplaySvc AssetDisplayConfigService, // NEW
) WatchlistService {
    return &watchlistService{
        watchlistRepo:    watchlistRepo,
        assetPriceSvc:   assetPriceSvc,
        marketDataSvc:   marketDataSvc,
        assetDisplaySvc: assetDisplaySvc, // NEW
    }
}
```

Update `ListItems()` goroutine loop — split into direct `ResolvePrice` for gold/silver/currency and `GetPrice` for everything else:

```go
for _, item := range items {
    wg.Add(1)
    go func(it *models.WatchlistItem) {
        defer wg.Done()
        invType := v1.InvestmentType(it.AssetType)

        var buyPrice, sellPrice int64

        if gold.IsGoldType(invType) {
            // Gold: call ResolvePrice directly to get raw per-lượng market price.
            // GetPrice() would apply ProcessMarketPrice (per-lượng → per-gram) which is
            // correct for investment calculations but wrong for watchlist display.
            buy, sell, _, resolveErr := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "gold")
            if resolveErr != nil {
                log.Printf("Warning: failed to resolve gold price for watchlist item %s: %v", it.Symbol, resolveErr)
                return
            }
            buyPrice, sellPrice = buy, sell
        } else if silver.IsSilverType(invType) {
            buy, sell, _, resolveErr := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "silver")
            if resolveErr != nil {
                log.Printf("Warning: failed to resolve silver price for watchlist item %s: %v", it.Symbol, resolveErr)
                return
            }
            buyPrice, sellPrice = buy, sell
        } else if invType == v1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY {
            buy, sell, _, resolveErr := s.assetDisplaySvc.ResolvePrice(ctx, it.Symbol, "currency")
            if resolveErr != nil {
                log.Printf("Warning: failed to resolve currency price for watchlist item %s: %v", it.Symbol, resolveErr)
                return
            }
            buyPrice, sellPrice = buy, sell
        } else {
            md, err := s.marketDataSvc.GetPrice(ctx, it.Symbol, it.Currency, invType, 15*time.Minute)
            if err != nil {
                log.Printf("Warning: failed to fetch price for watchlist item %s (type %d): %v", it.Symbol, it.AssetType, err)
                return
            }
            buyPrice = md.Price
            sellPrice = md.Price
        }

        mu.Lock()
        defer mu.Unlock()
        priceMap[it.Symbol] = &priceInfo{
            currentPrice: buyPrice,
            buyPrice:     buyPrice,
            sellPrice:    sellPrice,
        }
    }(item)
}
```

Also add imports at top of file: `"wealthjourney/pkg/gold"` and `"wealthjourney/pkg/silver"`.

**Step 4: Update `services.go` line 131**

```go
watchlistSvc := NewWatchlistService(repos.Watchlist, assetPriceSvc, marketDataSvc, assetDisplayConfigSvc)
```

**Step 5: Update existing tests that call `newWatchlistSvc` with 3 args**

All existing calls to `newWatchlistSvc(repo, assetSvc, mktSvc)` must pass a 4th `adcSvc` arg. For tests that don't exercise gold/silver, pass `&mockAssetDisplayConfigSvc{}` (empty mock — ResolvePrice not called for non-gold types).

For `TestWatchlistService_ListItems_GoldViaGetPrice` and `TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices` — these previously tested gold via the `GetPrice` mock. They must be **updated** to use the new gold path:
- `TestWatchlistService_ListItems_GoldViaGetPrice` → migrate to use `adcSvc.prices` instead of `mktSvc.prices` for gold
- `TestWatchlistService_ListItems_GetPriceFailureReturnsZeroPrices` → use `adcSvc` with empty prices map to trigger ResolvePrice error

**Step 6: Run all watchlist tests**

```bash
cd src/go-backend && go test -run "TestWatchlistService" ./domain/service/ -v
# Expected: all pass
```

**Step 7: Run full CI**

```bash
cd src/go-backend && go build ./... && go test -short ./...
# Expected: no compile errors, all tests pass
```

**Step 8: Update `flow-watchlist.md` Section 2**

Update the price enrichment loop diagram to show the split path:
- Gold/silver/currency → `WS → ADCS: ResolvePrice(ctx, symbol, assetType_string)` directly
- Market/stock/crypto → `WS → MDS: GetPrice(ctx, symbol, currency, assetType, 15m)` (unchanged)
- Add note: gold/silver bypass `ProcessMarketPrice` to return raw per-lượng/per-kg market price

**Step 9: Commit**

```
fix(watchlist): use ResolvePrice() for gold/silver to return per-lượng market price

GetPrice() applies ProcessMarketPrice (per-lượng → per-gram conversion) which is correct
for investment portfolio calculations but returns the wrong unit for watchlist display.
Gold VND items now call AssetDisplayConfigService.ResolvePrice() directly to get the raw
asset_price.Buy value (e.g., 171,000,000 VND/lượng instead of 4,560,000 VND/gram).
```

---

### Task 0 (Post-Implementation): Update Runtime Flow Diagram

**Files:**
- Modify: `docs/architecture/flow-watchlist.md` (Section 2 — List Watchlist with Price Enrichment)

Update the sequence diagram loop to show the split path between gold/silver/currency (→ ADCS) and market (→ MDS). Already covered in Task 1 Step 8.

**Skip C4 diagram updates** — no new components, no new public interfaces.
