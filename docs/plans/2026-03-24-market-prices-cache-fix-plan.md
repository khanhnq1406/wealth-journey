# Market Prices Server-Side Aggregate Cache — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add `GetAll`/`SetAll` methods to gold/silver/currency price caches so `FetchAllPrices()` reads from Redis before hitting the external vangsaigon API.

**Spec:** `docs/specs/2026-03-24-market-prices-cache-fix-spec.md`

**Architecture:** No new components, containers, or endpoints. Pure internal caching optimization: `FetchAllPrices()` gains a cache-check path that mirrors the existing per-symbol path. New Redis keys: `gold_price:all`, `silver_price:all`, `currency_price:all` with 5-minute TTL. Handlers and frontend unchanged.

**Tech Stack:** Go 1.23, go-redis/v8, encoding/json (existing), no new packages.

## Security Implementation Notes

- **Authentication:** No change — endpoint remains JWT-authenticated.
- **Authorization:** No change — prices are global market data, not user-scoped.
- **Input validation:** No new inputs. Cache keys are hardcoded constants.
- **Data sanitization:** No user-controlled data enters the cache path.
- **Non-regression:** Individual per-symbol caches (`gold_price:<symbol>`) must remain functional.

## Component Reuse Inventory (Frontend Tasks)

_No frontend changes in this fix._

## C4 Architecture Diagram Updates

Per spec: no structural changes. The `c4-component-backend.md` descriptions for the price services are accurate as-is (they already reference Redis). No diagram update required.

---

### Task 1: Add `GetAll`/`SetAll` to `GoldPriceCache`

**Files:**
- Modify: `src/go-backend/pkg/cache/gold_price_cache.go`

**Security notes:** Cache key `gold_price:all` is a hardcoded constant — no injection risk. Cache write errors are non-fatal (log warning). Existing per-symbol key format `gold_price:<symbol>` is unaffected because "all" does not match any valid gold type code.

**Step 1: Write the failing test**

Add to a test file `src/go-backend/pkg/cache/gold_price_cache_test.go`:

```go
package cache_test

import (
    "context"
    "testing"
    "time"
    "github.com/go-redis/redis/v8"
    "wealthjourney/pkg/cache"
)

func newTestRedis(t *testing.T) *redis.Client {
    t.Helper()
    client := redis.NewClient(&redis.Options{Addr: "localhost:6379", DB: 15})
    if err := client.Ping(context.Background()).Err(); err != nil {
        t.Skip("Redis not available:", err)
    }
    t.Cleanup(func() { client.FlushDB(context.Background()); client.Close() })
    return client
}

func TestGoldPriceCache_SetAllGetAll(t *testing.T) {
    c := cache.NewGoldPriceCache(newTestRedis(t))
    ctx := context.Background()

    prices := []*cache.CachedGoldPrice{
        {TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 85000000, Sell: 86000000, Currency: "VND", UpdateTime: time.Now().Unix()},
        {TypeCode: "XAUUSD",  Name: "XAU/USD",    Buy: 290000,   Sell: 291000,   Currency: "USD", UpdateTime: time.Now().Unix()},
    }

    if err := c.SetAll(ctx, prices, 5*time.Minute); err != nil {
        t.Fatalf("SetAll error: %v", err)
    }

    got, err := c.GetAll(ctx)
    if err != nil {
        t.Fatalf("GetAll error: %v", err)
    }
    if got == nil {
        t.Fatal("expected non-nil result")
    }
    if len(got) != 2 {
        t.Fatalf("expected 2 items, got %d", len(got))
    }
    if got[0].TypeCode != "SJL1L10" {
        t.Errorf("expected SJL1L10, got %s", got[0].TypeCode)
    }
}

func TestGoldPriceCache_GetAll_Miss(t *testing.T) {
    c := cache.NewGoldPriceCache(newTestRedis(t))
    got, err := c.GetAll(context.Background())
    if err != nil {
        t.Fatalf("unexpected error on cache miss: %v", err)
    }
    if got != nil {
        t.Fatalf("expected nil on miss, got %v", got)
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestGoldPriceCache_SetAllGetAll ./pkg/cache/...
# Expected: compilation error (SetAll/GetAll not defined)
```

**Step 3: Write minimal implementation**

Add to `src/go-backend/pkg/cache/gold_price_cache.go`:

```go
const (
    GoldPriceKeyPrefix  = "gold_price"
    GoldPriceCacheTTL   = 15 * time.Minute
    AllGoldPricesCacheTTL = 5 * time.Minute  // aggregate cache TTL
    goldAllKey          = "gold_price:all"   // unexported constant
)

// SetAll stores the full list of gold prices in the aggregate cache key.
func (c *GoldPriceCache) SetAll(ctx context.Context, prices []*CachedGoldPrice, ttl time.Duration) error {
    data, err := json.Marshal(prices)
    if err != nil {
        return fmt.Errorf("marshal gold prices: %w", err)
    }
    return c.client.Set(ctx, goldAllKey, data, ttl).Err()
}

// GetAll retrieves the full list of gold prices from the aggregate cache key.
// Returns nil, nil on cache miss.
func (c *GoldPriceCache) GetAll(ctx context.Context) ([]*CachedGoldPrice, error) {
    data, err := c.client.Get(ctx, goldAllKey).Bytes()
    if err != nil {
        if err == redis.Nil {
            return nil, nil
        }
        return nil, fmt.Errorf("get all gold prices from cache: %w", err)
    }
    var prices []*CachedGoldPrice
    if err := json.Unmarshal(data, &prices); err != nil {
        return nil, fmt.Errorf("unmarshal gold prices: %w", err)
    }
    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestGoldPriceCache ./pkg/cache/...
# Expected: PASS
```

**Step 5: Commit**
```
feat(cache): add SetAll/GetAll to GoldPriceCache for aggregate key gold_price:all
```

---

### Task 2: Add `GetAll`/`SetAll` to `SilverPriceCache`

**Files:**
- Modify: `src/go-backend/pkg/cache/silver_price_cache.go`

**Security notes:** Same as Task 1. Silver cache uses `silver_price:<symbol>:<currency>` for per-symbol keys — `silver_price:all` has no currency suffix and cannot collide.

**Step 1: Write the failing test**

Add to `src/go-backend/pkg/cache/silver_price_cache_test.go`:

```go
package cache_test

import (
    "context"
    "testing"
    "time"
    "wealthjourney/pkg/cache"
)

func TestSilverPriceCache_SetAllGetAll(t *testing.T) {
    c := cache.NewSilverPriceCache(newTestRedis(t))
    ctx := context.Background()

    prices := []*cache.CachedSilverPrice{
        {TypeCode: "PHU_QUY_THOI_1L", Name: "Phú Quý thỏi 1L", Buy: 900000, Sell: 950000, Currency: "VND", UpdateTime: time.Now().Unix()},
    }

    if err := c.SetAll(ctx, prices, 5*time.Minute); err != nil {
        t.Fatalf("SetAll error: %v", err)
    }

    got, err := c.GetAll(ctx)
    if err != nil {
        t.Fatalf("GetAll error: %v", err)
    }
    if len(got) != 1 || got[0].TypeCode != "PHU_QUY_THOI_1L" {
        t.Fatalf("unexpected result: %v", got)
    }
}

func TestSilverPriceCache_GetAll_Miss(t *testing.T) {
    c := cache.NewSilverPriceCache(newTestRedis(t))
    got, err := c.GetAll(context.Background())
    if err != nil {
        t.Fatalf("unexpected error on cache miss: %v", err)
    }
    if got != nil {
        t.Fatalf("expected nil on miss, got %v", got)
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestSilverPriceCache_SetAllGetAll ./pkg/cache/...
# Expected: compilation error
```

**Step 3: Write minimal implementation**

Add to `src/go-backend/pkg/cache/silver_price_cache.go`:

```go
const (
    SilverPriceKeyPrefix    = "silver_price"
    SilverPriceCacheTTL     = 15 * time.Minute
    AllSilverPricesCacheTTL = 5 * time.Minute
    silverAllKey            = "silver_price:all"
)

// SetAll stores the full list of silver prices in the aggregate cache key.
func (c *SilverPriceCache) SetAll(ctx context.Context, prices []*CachedSilverPrice, ttl time.Duration) error {
    data, err := json.Marshal(prices)
    if err != nil {
        return fmt.Errorf("marshal silver prices: %w", err)
    }
    return c.client.Set(ctx, silverAllKey, data, ttl).Err()
}

// GetAll retrieves the full list of silver prices from the aggregate cache key.
// Returns nil, nil on cache miss.
func (c *SilverPriceCache) GetAll(ctx context.Context) ([]*CachedSilverPrice, error) {
    data, err := c.client.Get(ctx, silverAllKey).Bytes()
    if err != nil {
        if err == redis.Nil {
            return nil, nil
        }
        return nil, fmt.Errorf("get all silver prices from cache: %w", err)
    }
    var prices []*CachedSilverPrice
    if err := json.Unmarshal(data, &prices); err != nil {
        return nil, fmt.Errorf("unmarshal silver prices: %w", err)
    }
    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestSilverPriceCache ./pkg/cache/...
```

**Step 5: Commit**
```
feat(cache): add SetAll/GetAll to SilverPriceCache for aggregate key silver_price:all
```

---

### Task 3: Add `GetAll`/`SetAll` to `CurrencyPriceCache`

**Files:**
- Modify: `src/go-backend/pkg/cache/currency_price_cache.go`

**Security notes:** Same as Task 1. `currency_price:all` cannot collide with `currency_price:<code>`.

**Step 1: Write the failing test**

Add to `src/go-backend/pkg/cache/currency_price_cache_test.go`:

```go
package cache_test

import (
    "context"
    "testing"
    "time"
    "wealthjourney/pkg/cache"
)

func TestCurrencyPriceCache_SetAllGetAll(t *testing.T) {
    c := cache.NewCurrencyPriceCache(newTestRedis(t))
    ctx := context.Background()

    prices := []*cache.CachedCurrencyPrice{
        {TypeCode: "USD", Name: "USD Tự Do", Buy: 25400, Sell: 25470, Currency: "VND", UpdateTime: time.Now().Unix()},
    }

    if err := c.SetAll(ctx, prices, 5*time.Minute); err != nil {
        t.Fatalf("SetAll error: %v", err)
    }

    got, err := c.GetAll(ctx)
    if err != nil {
        t.Fatalf("GetAll error: %v", err)
    }
    if len(got) != 1 || got[0].TypeCode != "USD" {
        t.Fatalf("unexpected result: %v", got)
    }
}

func TestCurrencyPriceCache_GetAll_Miss(t *testing.T) {
    c := cache.NewCurrencyPriceCache(newTestRedis(t))
    got, err := c.GetAll(context.Background())
    if err != nil {
        t.Fatalf("unexpected error on cache miss: %v", err)
    }
    if got != nil {
        t.Fatalf("expected nil on miss, got %v", got)
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestCurrencyPriceCache_SetAllGetAll ./pkg/cache/...
```

**Step 3: Write minimal implementation**

Add to `src/go-backend/pkg/cache/currency_price_cache.go`:

```go
const (
    CurrencyPriceKeyPrefix    = "currency_price"
    CurrencyPriceCacheTTL     = 15 * time.Minute
    AllCurrencyPricesCacheTTL = 5 * time.Minute
    currencyAllKey            = "currency_price:all"
)

// SetAll stores the full list of currency prices in the aggregate cache key.
func (c *CurrencyPriceCache) SetAll(ctx context.Context, prices []*CachedCurrencyPrice, ttl time.Duration) error {
    data, err := json.Marshal(prices)
    if err != nil {
        return fmt.Errorf("marshal currency prices: %w", err)
    }
    return c.client.Set(ctx, currencyAllKey, data, ttl).Err()
}

// GetAll retrieves the full list of currency prices from the aggregate cache key.
// Returns nil, nil on cache miss.
func (c *CurrencyPriceCache) GetAll(ctx context.Context) ([]*CachedCurrencyPrice, error) {
    data, err := c.client.Get(ctx, currencyAllKey).Bytes()
    if err != nil {
        if err == redis.Nil {
            return nil, nil
        }
        return nil, fmt.Errorf("get all currency prices from cache: %w", err)
    }
    var prices []*CachedCurrencyPrice
    if err := json.Unmarshal(data, &prices); err != nil {
        return nil, fmt.Errorf("unmarshal currency prices: %w", err)
    }
    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestCurrencyPriceCache ./pkg/cache/...
```

**Step 5: Commit**
```
feat(cache): add SetAll/GetAll to CurrencyPriceCache for aggregate key currency_price:all
```

---

### Task 4: Cache-first `FetchAllPrices` in `GoldPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/gold_price_service.go`

**Security notes:** No new inputs. Aggregate cache stores `[]*cache.CachedGoldPrice` (same type as individual cache). Cache hit path returns data without touching the external API. Non-fatal cache write error — log and return data from API.

**Step 1: Write the failing test**

Add to `src/go-backend/domain/service/gold_price_service_test.go` (new file):

```go
package service_test

import (
    "context"
    "testing"
    "time"

    "github.com/go-redis/redis/v8"
    "wealthjourney/domain/service"
    "wealthjourney/pkg/cache"
)

func newTestRedisForService(t *testing.T) *redis.Client {
    t.Helper()
    client := redis.NewClient(&redis.Options{Addr: "localhost:6379", DB: 15})
    if err := client.Ping(context.Background()).Err(); err != nil {
        t.Skip("Redis not available:", err)
    }
    t.Cleanup(func() { client.FlushDB(context.Background()); client.Close() })
    return client
}

// TestGoldPriceService_FetchAllPrices_CacheHit verifies that a warm aggregate cache
// is served without hitting the external API.
func TestGoldPriceService_FetchAllPrices_CacheHit(t *testing.T) {
    rdb := newTestRedisForService(t)
    goldCache := cache.NewGoldPriceCache(rdb)

    // Pre-populate aggregate cache
    seeded := []*cache.CachedGoldPrice{
        {TypeCode: "SJL1L10", Name: "SJC 1L-10L", Buy: 85000000, Sell: 86000000, Currency: "VND", UpdateTime: time.Now().Unix()},
    }
    if err := goldCache.SetAll(context.Background(), seeded, 5*time.Minute); err != nil {
        t.Fatalf("seed cache: %v", err)
    }

    svc := service.NewGoldPriceServiceWithCache(rdb, goldCache)
    prices, err := svc.FetchAllPrices(context.Background())
    if err != nil {
        t.Fatalf("FetchAllPrices error: %v", err)
    }
    if len(prices) != 1 {
        t.Fatalf("expected 1 cached price, got %d", len(prices))
    }
    if prices[0].TypeCode != "SJL1L10" {
        t.Errorf("expected SJL1L10, got %s", prices[0].TypeCode)
    }
}
```

> **Note:** The existing `NewGoldPriceService(redisClient)` creates its own cache internally. For testability, add `NewGoldPriceServiceWithCache(redisClient, cache)` constructor that accepts an injected cache. This is a constructor injection following ADR-002. The existing public constructor remains unchanged.

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestGoldPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
# Expected: compilation error (NewGoldPriceServiceWithCache not defined)
```

**Step 3: Write minimal implementation**

In `src/go-backend/domain/service/gold_price_service.go`:

1. Add `NewGoldPriceServiceWithCache` constructor:

```go
// NewGoldPriceServiceWithCache creates a gold price service with an injected cache (for testing).
func NewGoldPriceServiceWithCache(redisClient *redis.Client, goldCache *cache.GoldPriceCache) GoldPriceService {
    return &goldPriceService{
        client: vnprice.NewClient(10 * time.Second),
        cache:  goldCache,
    }
}
```

2. Modify `FetchAllPrices` to check aggregate cache first:

```go
func (s *goldPriceService) FetchAllPrices(ctx context.Context) ([]*CachedGoldPrice, error) {
    // Check aggregate cache first
    cached, err := s.cache.GetAll(ctx)
    if err == nil && cached != nil {
        result := make([]*CachedGoldPrice, len(cached))
        for i, c := range cached {
            result[i] = &CachedGoldPrice{
                TypeCode:   c.TypeCode,
                Name:       c.Name,
                Buy:        c.Buy,
                Sell:       c.Sell,
                ChangeBuy:  c.ChangeBuy,
                ChangeSell: c.ChangeSell,
                Currency:   c.Currency,
                UpdateTime: time.Unix(c.UpdateTime, 0),
            }
        }
        return result, nil
    }

    // Cache miss — fetch from external API
    pricesResp, err := s.client.FetchPrices(ctx)
    if err != nil {
        return nil, fmt.Errorf("fetch prices from vang247 API: %w", err)
    }

    prices := make([]*CachedGoldPrice, 0, len(pricesResp.GoldPrices))
    cacheList := make([]*cache.CachedGoldPrice, 0, len(pricesResp.GoldPrices))

    for _, apiPrice := range pricesResp.GoldPrices {
        var buy, sell, changeBuy, changeSell int64

        if apiPrice.Currency == "USD" {
            buy = int64(apiPrice.Buy * 100)
            sell = int64(apiPrice.Sell * 100)
            changeBuy = int64(apiPrice.BuyChange * 100)
            changeSell = int64(apiPrice.SellChange * 100)
        } else {
            buy = int64(apiPrice.Buy * 1000)
            sell = int64(apiPrice.Sell * 1000)
            changeBuy = int64(apiPrice.BuyChange * 1000)
            changeSell = int64(apiPrice.SellChange * 1000)
        }

        price := &CachedGoldPrice{
            TypeCode:   apiPrice.Name,
            Name:       apiPrice.Name,
            Buy:        buy,
            Sell:       sell,
            ChangeBuy:  changeBuy,
            ChangeSell: changeSell,
            Currency:   apiPrice.Currency,
            UpdateTime: apiPrice.UpdateAt,
        }
        prices = append(prices, price)

        cacheList = append(cacheList, &cache.CachedGoldPrice{
            TypeCode:   price.TypeCode,
            Name:       price.Name,
            Buy:        price.Buy,
            Sell:       price.Sell,
            ChangeBuy:  price.ChangeBuy,
            ChangeSell: price.ChangeSell,
            Currency:   price.Currency,
            UpdateTime: price.UpdateTime.Unix(),
        })

        // Also write per-symbol cache (non-blocking, keep existing behavior)
        go func(p *CachedGoldPrice) {
            cp := &cache.CachedGoldPrice{
                TypeCode: p.TypeCode, Name: p.Name, Buy: p.Buy, Sell: p.Sell,
                ChangeBuy: p.ChangeBuy, ChangeSell: p.ChangeSell,
                Currency: p.Currency, UpdateTime: p.UpdateTime.Unix(),
            }
            if err := s.cache.Set(context.Background(), p.TypeCode, cp, cache.GoldPriceCacheTTL); err != nil {
                log.Printf("Warning: failed to cache gold price for %s: %v", p.TypeCode, err)
            }
        }(price)
    }

    // Write aggregate cache (non-blocking)
    go func() {
        if err := s.cache.SetAll(context.Background(), cacheList, cache.AllGoldPricesCacheTTL); err != nil {
            log.Printf("Warning: failed to set aggregate gold price cache: %v", err)
        }
    }()

    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestGoldPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
fix(gold-service): FetchAllPrices reads aggregate cache before hitting vangsaigon API
```

---

### Task 5: Cache-first `FetchAllPrices` in `SilverPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/silver_price_service.go`

**Security notes:** Same as Task 4. Silver aggregate cache stores the fully assembled result including SBJ static rows.

**Step 1: Write the failing test**

Add to `src/go-backend/domain/service/silver_price_service_test.go`:

```go
func TestSilverPriceService_FetchAllPrices_CacheHit(t *testing.T) {
    rdb := newTestRedisForService(t)
    silverCache := cache.NewSilverPriceCache(rdb)

    seeded := []*cache.CachedSilverPrice{
        {TypeCode: "PHU_QUY_THOI_1L", Name: "Phú Quý thỏi 1L", Buy: 900000, Sell: 950000, Currency: "VND", UpdateTime: time.Now().Unix()},
    }
    if err := silverCache.SetAll(context.Background(), seeded, 5*time.Minute); err != nil {
        t.Fatalf("seed cache: %v", err)
    }

    svc := service.NewSilverPriceServiceWithCache(rdb, silverCache)
    prices, err := svc.FetchAllPrices(context.Background())
    if err != nil {
        t.Fatalf("FetchAllPrices error: %v", err)
    }
    if len(prices) != 1 || prices[0].TypeCode != "PHU_QUY_THOI_1L" {
        t.Fatalf("unexpected result: %v", prices)
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestSilverPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
```

**Step 3: Write minimal implementation**

In `src/go-backend/domain/service/silver_price_service.go`:

1. Add `NewSilverPriceServiceWithCache` constructor (accepts injected `*cache.SilverPriceCache`).

2. At the top of `FetchAllPrices`:

```go
func (s *silverPriceService) FetchAllPrices(ctx context.Context) ([]*CachedSilverPrice, error) {
    // Check aggregate cache first
    cached, err := s.cache.GetAll(ctx)
    if err == nil && cached != nil {
        result := make([]*CachedSilverPrice, len(cached))
        for i, c := range cached {
            result[i] = &CachedSilverPrice{
                TypeCode: c.TypeCode, Name: c.Name, Buy: c.Buy, Sell: c.Sell,
                ChangeBuy: c.ChangeBuy, ChangeSell: c.ChangeSell,
                Currency: c.Currency, UpdateTime: time.Unix(c.UpdateTime, 0),
            }
        }
        return result, nil
    }

    // ... existing multi-source fetch logic ...

    // After building `prices` slice, write aggregate cache (non-blocking):
    go func(snapshot []*CachedSilverPrice) {
        cacheList := make([]*cache.CachedSilverPrice, len(snapshot))
        for i, p := range snapshot {
            cacheList[i] = &cache.CachedSilverPrice{
                TypeCode: p.TypeCode, Name: p.Name, Buy: p.Buy, Sell: p.Sell,
                ChangeBuy: p.ChangeBuy, ChangeSell: p.ChangeSell,
                Currency: p.Currency, UpdateTime: p.UpdateTime.Unix(),
            }
        }
        if err := s.cache.SetAll(context.Background(), cacheList, cache.AllSilverPricesCacheTTL); err != nil {
            log.Printf("Warning: failed to set aggregate silver price cache: %v", err)
        }
    }(prices)

    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestSilverPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
fix(silver-service): FetchAllPrices reads aggregate cache before hitting external sources
```

---

### Task 6: Cache-first `FetchAllPrices` in `CurrencyPriceService`

**Files:**
- Modify: `src/go-backend/domain/service/currency_price_service.go`

**Security notes:** Same as Tasks 4-5.

**Step 1: Write the failing test**

Add to `src/go-backend/domain/service/currency_price_service_test.go`:

```go
func TestCurrencyPriceService_FetchAllPrices_CacheHit(t *testing.T) {
    rdb := newTestRedisForService(t)
    currCache := cache.NewCurrencyPriceCache(rdb)

    seeded := []*cache.CachedCurrencyPrice{
        {TypeCode: "USD", Name: "USD Tự Do", Buy: 25400, Sell: 25470, Currency: "VND", UpdateTime: time.Now().Unix()},
    }
    if err := currCache.SetAll(context.Background(), seeded, 5*time.Minute); err != nil {
        t.Fatalf("seed cache: %v", err)
    }

    svc := service.NewCurrencyPriceServiceWithCache(rdb, currCache)
    prices, err := svc.FetchAllPrices(context.Background())
    if err != nil {
        t.Fatalf("FetchAllPrices error: %v", err)
    }
    if len(prices) != 1 || prices[0].TypeCode != "USD" {
        t.Fatalf("unexpected result: %v", prices)
    }
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestCurrencyPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
```

**Step 3: Write minimal implementation**

In `src/go-backend/domain/service/currency_price_service.go`:

1. Add `NewCurrencyPriceServiceWithCache` constructor.

2. At the top of `FetchAllPrices`:

```go
func (s *currencyPriceService) FetchAllPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
    // Check aggregate cache first
    cached, err := s.cache.GetAll(ctx)
    if err == nil && cached != nil {
        result := make([]*CachedCurrencyPrice, len(cached))
        for i, c := range cached {
            result[i] = &CachedCurrencyPrice{
                TypeCode: c.TypeCode, Name: c.Name, Buy: c.Buy, Sell: c.Sell,
                ChangeBuy: c.ChangeBuy, ChangeSell: c.ChangeSell,
                Currency: c.Currency, UpdateTime: time.Unix(c.UpdateTime, 0),
            }
        }
        return result, nil
    }

    // ... existing API fetch logic ...

    // After building `prices` slice, write aggregate cache (non-blocking):
    go func(snapshot []*CachedCurrencyPrice) {
        cacheList := make([]*cache.CachedCurrencyPrice, len(snapshot))
        for i, p := range snapshot {
            cacheList[i] = &cache.CachedCurrencyPrice{
                TypeCode: p.TypeCode, Name: p.Name, Buy: p.Buy, Sell: p.Sell,
                ChangeBuy: p.ChangeBuy, ChangeSell: p.ChangeSell,
                Currency: p.Currency, UpdateTime: p.UpdateTime.Unix(),
            }
        }
        if err := s.cache.SetAll(context.Background(), cacheList, cache.AllCurrencyPricesCacheTTL); err != nil {
            log.Printf("Warning: failed to set aggregate currency price cache: %v", err)
        }
    }(prices)

    return prices, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestCurrencyPriceService_FetchAllPrices_CacheHit -short ./domain/service/...
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
fix(currency-service): FetchAllPrices reads aggregate cache before hitting vangsaigon API
```

---

### Task 7: Full Build + Test Verification

**Files:** No new files.

**Steps:**

1. Run all short tests:
```bash
cd src/go-backend && go test -short ./...
```

2. Full build:
```bash
cd src/go-backend && go build ./...
```

3. Verify no regressions in existing cache tests:
```bash
cd src/go-backend && go test -short ./pkg/cache/... ./domain/service/...
```

**Step N: Commit**
```
test: verify full build and all short tests pass after aggregate cache fix
```

---

### Task 8: Update Runtime Flow Diagram

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Add a new `FetchAllPrices Cache Flow` sequence diagram to `flow-cross-cutting.md` showing:
   - Redis cache check → hit path (return cached)
   - Redis cache check → miss path → external API → cache write → return
   - Error path (external API down, no cache)

2. Add "Key Invariants" and "Error Paths" table.

**Step N: Commit**
```
docs: add FetchAllPrices aggregate cache flow diagram to flow-cross-cutting.md
```
