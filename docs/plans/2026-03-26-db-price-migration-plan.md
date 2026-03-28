# DB-Backed Price Migration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace all live gold/silver/currency API calls in `PriceAlertService`, `UserPriceAlertService`, and `WatchlistService` with reads from the `asset_price` DB cache.

**Spec:** `docs/specs/2026-03-26-db-price-migration-spec.md`

**Architecture:** Three services currently call `GoldPriceService.FetchAllPrices()`, `SilverPriceService.FetchAllPrices()`, and `CurrencyPriceService.FetchAllPrices()` on every invocation. The `AssetPriceService` already maintains a DB cache of these prices (populated every 15 min by `PriceCacheJob`). Migration replaces the live-API deps with `AssetPriceService` in each consumer. Yahoo Finance calls for stock/crypto remain live (no DB cache for those).

**Tech Stack:** Go 1.25, GORM, PostgreSQL, sqlmock (unit tests)

---

## Security Implementation Notes

- **Authentication:** No change — price data is non-user-specific; no auth changes needed.
- **Authorization:** No change — alert evaluation and watchlist are already guarded by user ownership checks.
- **Input validation:** `typeCode` for DB lookup originates from the `asset_price` table (server-controlled), never from direct user input at lookup time.
- **Data integrity:** All price values remain `int64`. No float arithmetic introduced.
- **Stale data:** `IsStale == true` rows must be treated as missing in alert trigger paths (log, return 0) to prevent incorrect alert firings.
- **SQL injection:** DB access goes through GORM parameterized queries via the repository layer (unchanged).

---

## Component Reuse Inventory

**N/A — Pure backend refactor. No frontend changes.**

---

## C4 Architecture Diagram Updates

Per spec:
- `docs/architecture/c4-component-backend.md`: Update component relationships for `PriceAlertService`, `UserPriceAlertService`, `WatchlistService`

---

## Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`

**Steps:**
1. Find the component entries for `PriceAlertService`, `UserPriceAlertService`, and `WatchlistService` in the diagram
2. Remove arrows from those components to `GoldPriceService`, `SilverPriceService`, `CurrencyPriceService` (where present)
3. Add arrows to `AssetPriceService` for those three components
4. Commit: `docs: update C4 component diagram — alert/watchlist services use AssetPriceService`

---

## Task 1: Extend `AssetPriceService` interface with `GetPriceByTypeCode`

**Why first:** `UserPriceAlertService.fetchCurrentPrice` needs single-item lookup. This method must exist before the service migration tasks.

**Files:**
- Modify: `src/go-backend/domain/service/interfaces.go` (add method to `AssetPriceService` interface)
- Modify: `src/go-backend/domain/service/asset_price_service.go` (implement the method)
- Modify: `src/go-backend/domain/service/asset_price_service_test.go` (add tests)

**Security notes:** No user input in the lookup path; typeCode is internal data from the alert model.

**Step 1: Write the failing tests** (in `asset_price_service_test.go`)

```go
func TestAssetPriceService_GetPriceByTypeCode_Found(t *testing.T) {
    // mock repo.ListAll returns rows containing "SJC_1L"
    // expect returned DTO with TypeCode == "SJC_1L"
}

func TestAssetPriceService_GetPriceByTypeCode_NotFound(t *testing.T) {
    // mock repo.ListAll returns rows NOT containing "NONEXISTENT"
    // expect nil, nil
}

func TestAssetPriceService_GetPriceByTypeCode_RepoError(t *testing.T) {
    // mock repo.ListAll returns error
    // expect nil, error
}
```

**Step 2: Run test (expect compile error until interface + impl added)**

```bash
cd src/go-backend && go test -short ./domain/service/... 2>&1 | head -30
```

**Step 3: Add to `AssetPriceService` interface in `interfaces.go`**

```go
// GetPriceByTypeCode looks up a single cached price row by typeCode.
// Returns nil, nil when not found (cold-start: price not yet in DB).
GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error)
```

**Step 4: Implement in `asset_price_service.go`**

```go
// GetPriceByTypeCode scans ListAll results for a matching typeCode.
// Returns nil, nil when not found.
func (s *assetPriceService) GetPriceByTypeCode(ctx context.Context, typeCode string) (*AssetPriceDTO, error) {
    rows, err := s.repo.ListAll(ctx)
    if err != nil {
        return nil, err
    }
    for _, row := range rows {
        if row.TypeCode == typeCode {
            return modelToDTO(row), nil
        }
    }
    return nil, nil
}
```

**Step 5: Run tests and verify green**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestAssetPriceService
```

**Step 6: Commit**
```
feat(asset-price): add GetPriceByTypeCode to AssetPriceService interface and impl
```

---

## Task 2: Migrate `PriceAlertService` to use `AssetPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go`
- Modify: `src/go-backend/domain/service/price_alert_service_test.go`
- Modify: `src/go-backend/domain/service/services.go` (constructor call)

**Security notes:** Stale prices (`IsStale == true`) must NOT trigger alerts — treat as missing (skip the price mover). This prevents phantom alerts from stale cache entries.

**Step 1: Update the struct and constructor**

In `price_alert_service.go`, replace:
```go
type priceAlertService struct {
    goldPriceSvc   GoldPriceService
    silverPriceSvc SilverPriceService
    // ...
}
```
with:
```go
type priceAlertService struct {
    assetPriceSvc  AssetPriceService
    // ...
}
```

Update `NewPriceAlertService`:
```go
func NewPriceAlertService(
    assetPriceSvc AssetPriceService,
    notifRepo repository.NotificationRepository,
    userRepo repository.UserRepository,
    rdb *pkgredis.RedisClient,
    pushSvc PushService,
) PriceAlertService {
```

**Step 2: Update `doCheckAndAlert` — gold section**

Replace:
```go
goldPrices, err := s.goldPriceSvc.FetchAllPrices(ctx)
```
with:
```go
goldPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")
```

And adapt the loop. `AssetPriceDTO` has the same fields (`TypeCode`, `Name`, `Buy`, `Currency`).
Skip rows where `dto.IsStale == true` (log warning, don't include in movers).

**Step 3: Update `doCheckAndAlert` — silver section**

Replace:
```go
silverPrices, err := s.silverPriceSvc.FetchAllPrices(ctx)
```
with:
```go
silverPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "silver")
```

Same adaptation — skip stale rows.

**Step 4: Update `services.go`**

```go
// Phase 1 (cont.): PriceAlertService
var priceAlertSvc PriceAlertService
if rdb != nil {
    priceAlertSvc = NewPriceAlertService(assetPriceSvc, repos.Notification, repos.User, rdb, pushSvc)
}
```

**Step 5: Update tests in `price_alert_service_test.go`**

Replace mock `GoldPriceService`/`SilverPriceService` with mock `AssetPriceService`. Add test cases:
- Alert fires when gold price moved (non-stale DB data)
- Alert skipped when all gold prices stale
- Alert fires for silver (non-stale), skipped for gold (stale)
- Force mode still works with DB-backed prices

**Step 6: Run all tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestPriceAlert
```

**Step 7: Commit**
```
feat(price-alert): migrate PriceAlertService to use AssetPriceService (DB cache)
```

---

## Task 3: Migrate `UserPriceAlertService` to use `AssetPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go`
- Modify: `src/go-backend/domain/service/user_price_alert_service_test.go`
- Modify: `src/go-backend/domain/service/services.go` (constructor call)

**Security notes:** `fetchCurrentPrice` is called at alert creation time (best-effort, non-blocking). Returning 0 on stale/missing is correct behavior — no financial integrity risk since it's only used for displaying the price at alert creation, not for triggering.

**Step 1: Update the struct and constructor**

Replace `goldPriceSvc GoldPriceService` and `silverPriceSvc SilverPriceService` with `assetPriceSvc AssetPriceService` in the struct and constructor.

**Step 2: Update `fetchCurrentPrice`**

Replace gold branch:
```go
case gold.IsGoldType(assetType):
    prices, err := s.goldPriceSvc.FetchAllPrices(fetchCtx)
    // ...
    for _, p := range prices {
        if p.TypeCode == symbol { ... }
    }
```
with:
```go
case gold.IsGoldType(assetType):
    dto, err := s.assetPriceSvc.GetPriceByTypeCode(fetchCtx, symbol)
    if err != nil || dto == nil || dto.IsStale {
        if err != nil {
            log.Printf("Warning: DB price lookup failed for %s: %v", symbol, err)
        }
        return 0
    }
    if priceSide == "sell" {
        return dto.Sell
    }
    return dto.Buy
```

Replace silver branch similarly.

**Step 3: Update `fetchPricesForAlerts`**

Gold batch:
```go
if hasGold {
    prices, err := s.assetPriceSvc.GetPricesByAssetType(fetchCtx, "gold")
    if err != nil {
        log.Printf("Warning: DB gold prices unavailable for alerts: %v", err)
    } else {
        goldByCode = make(map[string]*AssetPriceDTO, len(prices))
        for _, p := range prices {
            if !p.IsStale {
                goldByCode[p.TypeCode] = p
            }
        }
    }
}
```

Silver batch similarly.

Then update the price-map population loop to use `*AssetPriceDTO` (same `Buy`/`Sell` fields).

**Step 4: Update `services.go`**

```go
var userPriceAlertSvc UserPriceAlertService
if rdb != nil {
    userPriceAlertSvc = NewUserPriceAlertService(
        repos.UserPriceAlert,
        assetPriceSvc,   // replaces goldPriceSvc + silverPriceSvc
        marketDataSvc,
        repos.Notification,
        pushSvc,
        rdb,
    )
}
```

**Step 5: Update tests in `user_price_alert_service_test.go`**

Replace gold/silver mock services with mock `AssetPriceService`. Ensure tests cover:
- `fetchCurrentPrice` with non-stale DB data → returns correct buy/sell
- `fetchCurrentPrice` with stale data → returns 0
- `fetchCurrentPrice` with not-found → returns 0
- `fetchPricesForAlerts` batch: gold from DB, silver from DB, market from Yahoo
- `EvaluateAlerts` end-to-end with DB-backed prices

**Step 6: Run tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestUserPriceAlert
```

**Step 7: Commit**
```
feat(user-alert): migrate UserPriceAlertService to use AssetPriceService (DB cache)
```

---

## Task 4: Migrate `WatchlistService` to use `AssetPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/watchlist_service.go`
- Create: `src/go-backend/domain/service/watchlist_service_test.go` (NEW — currently no tests)
- Modify: `src/go-backend/domain/service/services.go` (constructor call)

**Security notes:** Watchlist prices are for display only; no financial operations are triggered. Stale cache entries are acceptable to serve (frontend can display `--` if buy/sell == 0).

**Step 1: Write tests FIRST** (in new `watchlist_service_test.go`)

Tests needed:
```go
func TestWatchlistService_ListItems_GoldFromDB(t *testing.T) { ... }
func TestWatchlistService_ListItems_SilverFromDB(t *testing.T) { ... }
func TestWatchlistService_ListItems_CurrencyFromDB(t *testing.T) { ... }
func TestWatchlistService_ListItems_MarketFromYahoo(t *testing.T) { ... }
func TestWatchlistService_ListItems_DBEmptyReturnsZeroPrices(t *testing.T) { ... }
func TestWatchlistService_ListItems_MixedAssetTypes(t *testing.T) { ... }
```

Use mock implementations of `WatchlistRepository`, `AssetPriceService`, and `MarketDataService`.

**Step 2: Run tests (expect failures — implementation not migrated yet)**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestWatchlistService
```

**Step 3: Update struct and constructor**

Replace:
```go
type watchlistService struct {
    watchlistRepo    repository.WatchlistRepository
    goldPriceSvc     GoldPriceService
    silverPriceSvc   SilverPriceService
    currencyPriceSvc CurrencyPriceService
    marketDataSvc    MarketDataService
}
```
with:
```go
type watchlistService struct {
    watchlistRepo repository.WatchlistRepository
    assetPriceSvc AssetPriceService
    marketDataSvc MarketDataService
}
```

**Step 4: Update `ListItems`**

Replace the three parallel goroutines with a single `GetAllPrices` call before the goroutines:

```go
// Fetch gold/silver/currency from DB cache (single query)
allPrices, err := s.assetPriceSvc.GetAllPrices(ctx)
if err != nil {
    log.Printf("Warning: failed to fetch asset prices from DB for watchlist: %v", err)
    allPrices = &AllAssetPrices{
        Gold: []*AssetPriceDTO{}, Silver: []*AssetPriceDTO{}, Currency: []*AssetPriceDTO{},
    }
}

// Build lookup maps
goldByCode := make(map[string]*AssetPriceDTO, len(allPrices.Gold))
for _, p := range allPrices.Gold { goldByCode[p.TypeCode] = p }

silverByCode := make(map[string]*AssetPriceDTO, len(allPrices.Silver))
for _, p := range allPrices.Silver { silverByCode[p.TypeCode] = p }

currencyByCode := make(map[string]*AssetPriceDTO, len(allPrices.Currency))
for _, p := range allPrices.Currency { currencyByCode[p.TypeCode] = p }
```

Then replace the three goroutines (gold, silver, currency) with synchronous map lookups in the
price enrichment loop. Keep Yahoo Finance goroutines for market items.

**Step 5: Update `services.go`**

```go
watchlistSvc := NewWatchlistService(repos.Watchlist, assetPriceSvc, marketDataSvc)
```

**Step 6: Run all tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestWatchlistService
```

**Step 7: Commit**
```
feat(watchlist): migrate WatchlistService to use AssetPriceService (DB cache) + add unit tests
```

---

## Task 5: Full build + test verification

**Files:** None (verification only)

**Steps:**

1. Full backend build:
```bash
cd src/go-backend && go build ./...
```

2. Full backend lint:
```bash
cd src/go-backend && task ci:backend-lint
```

3. All unit tests:
```bash
cd src/go-backend && go test -short ./...
```

4. Verify test count increased (new WatchlistService tests + updated alert tests).

5. If all pass: **no commit needed** (just verification).

---

## Task 6: Update runtime flow diagrams

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**
1. Find Section 13 (Price Cache Job) in `flow-cross-cutting.md`
2. Update the consumer list: add `PriceAlertJob`, `UserPriceAlertJob`, `WatchlistService` as
   DB-backed consumers of `AssetPriceService`
3. Note that these three no longer call live APIs directly for gold/silver/currency
4. Commit: `docs: update flow-cross-cutting.md — alert/watchlist use asset_price DB`

---

## Task 7: Update the fix report

**Files:**
- Modify: `docs/reports/2026-03-26-price-cache-job-report.md`

**Steps:**
1. Append a new `## Fix History` entry (or extend existing one) documenting this migration:
   - Date, description, severity (Major), files changed
2. Commit: `docs: append DB price migration to price-cache-job report`

---

## Execution Order Summary

| # | Task | Dependencies | Parallel-safe? |
|---|------|-------------|----------------|
| 0 | C4 diagram update | None | Yes |
| 1 | Add `GetPriceByTypeCode` to interface + impl | None | Must come before Tasks 2-4 |
| 2 | Migrate PriceAlertService | Task 1 | Yes (with 3, 4) |
| 3 | Migrate UserPriceAlertService | Task 1 | Yes (with 2, 4) |
| 4 | Migrate WatchlistService | Task 1 | Yes (with 2, 3) |
| 5 | Build + test verification | Tasks 2, 3, 4 | No |
| 6 | Update flow diagrams | Tasks 2-4 done | Yes |
| 7 | Update report | All tasks done | Yes |

Tasks 2, 3, 4 can be dispatched in parallel after Task 1 completes. Tasks 0, 6, 7 are documentation-only and can be done any time.
