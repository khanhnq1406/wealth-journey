# Multi-Source Currency Price Fetching — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace the single waterfall-based currency price fetch with 3 parallel per-source goroutines (VangSaiGon, VangToday, Vietcombank) — matching the gold parallel pattern.

**Spec:** `docs/specs/2026-03-27-multi-source-currency-price-spec.md`

**Architecture:** Backend-only change. `AssetPriceService.RefreshAllPrices()` currently runs 8 goroutines (6 gold + 1 silver + 1 currency waterfall). After this feature it runs 10 goroutines (6 gold + 1 silver + 3 currency). Each currency source fetches, stores, and fails independently. The Vietcombank JSON API client is a new `pkg/vietcombank/` package following the `pkg/vnprice/` and `pkg/vangtoday/` patterns.

**Tech Stack:** Go 1.25, `net/http`, `encoding/json`, GORM (via repository), PostgreSQL

## Critical Design Decision: TypeCode Naming for Source Differentiation

**Problem:** `ResolvePrice()` in `asset_display_config_service.go:218-225` builds a lookup map `typeCode → price` and picks the most recently fetched entry. It does NOT differentiate by `Source`. If VangSaiGon and Vietcombank both store `type_code = "USD"`, the map merges them — only the freshest survives. This defeats the goal of showing per-source prices.

**Solution:** The Vietcombank client stores TypeCodes with a `_VCB` suffix (e.g., `"USD_VCB"`, `"EUR_VCB"`). This creates distinct `type_code` values in `asset_price` that the fetch code system can resolve independently.

**Precedent:** VangSaiGon already stores `"USD Internalbank"` for VCB rates (a distinct type_code for the same underlying currency). Our approach is consistent — just using `_VCB` suffix instead of a space-separated name.

**Impact:**
- Display config `"USD Vietcombank"` → fetch code `"USD_VCB"` → resolves to `asset_price` row `(type_code="USD_VCB", source="vietcombank")`
- Display config `"USD Tự Do"` → fetch code `"USD"` → resolves to `asset_price` row `(type_code="USD", source="vangsaigon")` (most recent between vangsaigon/vangtoday)
- Display config `"USD Vietcombank (VSG)"` remains as `"USD Internalbank"` → fetch code `"USD Internalbank"` → resolves to existing VangSaiGon VCB data

## Security Implementation Notes

- **Authentication:** Not applicable — all code is in the background scheduler path (no HTTP endpoint added)
- **Authorization:** Price refresh is system-only (scheduler). Market prices are public read (existing endpoint, no change)
- **Input validation:** Vietcombank API response validated: 1MB size limit (`io.LimitReader`), typed JSON struct unmarshal, currency code validation against known list, reject entries where both Buy and Sell ≤ 0
- **Data sanitization:** No user input involved. External API data stored via GORM parameterized upsert — no SQL injection risk

## Component Reuse Inventory (Frontend Tasks)

No frontend tasks — backend-only feature.

## C4 Architecture Diagram Updates

- **L1 Context (`c4-context.md`):** Add "Vietcombank API" external system
- **L3 Backend Components (`c4-component-backend.md`):** Add `VietcombankClient` in `pkg/vietcombank/`, update `AssetPriceService` description, add dependency arrow

---

### Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-context.md`
- Modify: `docs/architecture/c4-component-backend.md`

**Steps:**
1. Add "Vietcombank API" as external system in L1 context diagram (alongside Yahoo Finance, vang.today, vangsaigon.vn)
2. Add `VietcombankClient` component in L3 backend diagram under `pkg/vietcombank/`
3. Add dependency arrow: `AssetPriceService` → `VietcombankClient`
4. Update `AssetPriceService` description to mention 3 parallel currency sources
5. Commit diagram changes

---

### Task 1: Create Vietcombank API Client (`pkg/vietcombank/`)

**Files:**
- Create: `src/go-backend/pkg/vietcombank/types.go`
- Create: `src/go-backend/pkg/vietcombank/client.go`
- Create: `src/go-backend/pkg/vietcombank/client_test.go`

**Security notes:** Response body limited to 1MB via `io.LimitReader`. HTTPS enforced (hardcoded URL). 5s timeout. Validate currency codes against known list. Filter entries with both Buy and Sell ≤ 0.

**Step 1: Write the failing test**

Test `client_test.go` (using `httptest.NewServer` for mock HTTP):
- Test successful response parsing — verify `Transfer` → `Buy` and `Sell` → `Sell` field mapping
- Test TypeCode suffix: `"USD"` from API → `"USD_VCB"` in output (for source differentiation)
- Test non-200 status code handling → returns error, no panic
- Test malformed JSON handling → returns error
- Test timeout handling (use very short timeout + slow mock server)
- Test filtering of zero-price entries (both Buy and Sell ≤ 0 → skipped)
- Test response size limit (>1MB body → error)
- Test Name mapping: `"US DOLLAR"` → `"USD Vietcombank"`

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./pkg/vietcombank/...
```

**Step 3: Write minimal implementation**

`types.go`:
```go
package vietcombank

// CurrencyPrice represents a single exchange rate from the Vietcombank API.
type CurrencyPrice struct {
    TypeCode string // ISO code with _VCB suffix, e.g., "USD_VCB", "EUR_VCB"
    Name     string // Vietnamese display name, e.g., "USD Vietcombank"
    Buy      int64  // Transfer rate in raw VND (no multiplication)
    Sell     int64  // Sell rate in raw VND
    Currency string // Always "VND"
}

// apiExchangeRate mirrors a single entry in the Vietcombank JSON response.
type apiExchangeRate struct {
    CurrencyCode string `json:"CurrencyCode"` // e.g., "USD", "EUR"
    CurrencyName string `json:"CurrencyName"` // e.g., "US DOLLAR"
    Buy          string `json:"Buy"`           // Cash buy rate (may be empty)
    Transfer     string `json:"Transfer"`      // Transfer buy rate (main "Buy")
    Sell         string `json:"Sell"`           // Sell rate
}
```

`client.go`:
```go
package vietcombank

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strconv"
    "strings"
    "time"
)

const (
    defaultBaseURL = "https://www.vietcombank.com.vn/api/exchangerates"
    maxResponseSize = 1 << 20 // 1MB
    defaultTimeout  = 5 * time.Second
)

// currencyNames maps VCB API CurrencyCode to Vietnamese display name.
var currencyNames = map[string]string{
    "USD": "USD Vietcombank",
    "EUR": "EUR Vietcombank",
    "GBP": "GBP Vietcombank",
    "JPY": "JPY Vietcombank",
    "CHF": "CHF Vietcombank",
    "AUD": "AUD Vietcombank",
    "CAD": "CAD Vietcombank",
    "SGD": "SGD Vietcombank",
    "HKD": "HKD Vietcombank",
    "TWD": "TWD Vietcombank",
    "KRW": "KRW Vietcombank",
    "THB": "THB Vietcombank",
    "CNY": "CNY Vietcombank",
    // Add others as discovered from the API
}

type Client struct {
    httpClient *http.Client
    baseURL    string
}

func NewClient() *Client {
    return &Client{
        httpClient: &http.Client{Timeout: defaultTimeout},
        baseURL:    defaultBaseURL,
    }
}

func (c *Client) FetchCurrencyPrices(ctx context.Context) ([]*CurrencyPrice, error) {
    // 1. Build URL with today's date
    url := fmt.Sprintf("%s?date=%s", c.baseURL, time.Now().Format("2006-01-02"))

    // 2. Create request with context
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return nil, fmt.Errorf("create request: %w", err) }

    // 3. Execute
    resp, err := c.httpClient.Do(req)
    if err != nil { return nil, fmt.Errorf("http request: %w", err) }
    defer resp.Body.Close()

    // 4. Check status
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status %d", resp.StatusCode)
    }

    // 5. Read with size limit
    limitedReader := io.LimitReader(resp.Body, maxResponseSize+1)
    body, err := io.ReadAll(limitedReader)
    if err != nil { return nil, fmt.Errorf("read body: %w", err) }
    if int64(len(body)) > maxResponseSize {
        return nil, fmt.Errorf("response exceeds %d bytes", maxResponseSize)
    }

    // 6. Parse JSON
    var rates []apiExchangeRate
    if err := json.Unmarshal(body, &rates); err != nil {
        return nil, fmt.Errorf("parse json: %w", err)
    }

    // 7. Convert to CurrencyPrice
    result := make([]*CurrencyPrice, 0, len(rates))
    for _, rate := range rates {
        buy := parseVND(rate.Transfer)
        sell := parseVND(rate.Sell)
        if buy <= 0 && sell <= 0 { continue } // Filter zero entries

        code := strings.TrimSpace(rate.CurrencyCode)
        name, ok := currencyNames[code]
        if !ok { name = code + " Vietcombank" }

        result = append(result, &CurrencyPrice{
            TypeCode: code + "_VCB", // Suffix for source differentiation
            Name:     name,
            Buy:      buy,
            Sell:     sell,
            Currency: "VND",
        })
    }

    return result, nil
}

// parseVND parses a VND string like "25,415" or "25415.00" to int64.
func parseVND(s string) int64 {
    s = strings.TrimSpace(s)
    if s == "" || s == "-" { return 0 }
    s = strings.ReplaceAll(s, ",", "")
    f, err := strconv.ParseFloat(s, 64)
    if err != nil { return 0 }
    return int64(f)
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -short ./pkg/vietcombank/...
```

**Step 5: Commit**

---

### Task 2: Create Vietcombank Currency Fetcher Adapter

**Files:**
- Create: `src/go-backend/domain/service/currency_fetcher_vietcombank.go`
- Create: `src/go-backend/domain/service/currency_fetcher_vietcombank_test.go`
- Modify: `src/go-backend/domain/service/price_fetcher.go` — add `SourceVietcombank` constant

**Security notes:** Adapter only normalizes data from the client — no additional trust boundary concerns. VCB API does not provide change data, so `ChangeBuy/ChangeSell = 0`.

**Step 1: Write the failing test**

Test `currency_fetcher_vietcombank_test.go`:
- Test successful fetch maps VCB `CurrencyPrice` → `CachedCurrencyPrice` correctly
- Test `Source()` returns `SourceVietcombank`
- Test `ChangeBuy/ChangeSell` are always 0
- Test `Currency` is preserved from client output
- Test empty result from client → returns empty slice (not error)

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./domain/service/ -run TestVietcombank
```

**Step 3: Write minimal implementation**

Add to `price_fetcher.go`:
```go
SourceVietcombank PriceSource = "vietcombank"
```

`currency_fetcher_vietcombank.go`:
```go
package service

import (
    "context"
    "fmt"
    "time"

    "wealthjourney/pkg/vietcombank"
)

// fetchVietcombankFn is the function signature for calling the vietcombank client.
type fetchVietcombankFn func(ctx context.Context) ([]*vietcombank.CurrencyPrice, error)

type vietcombankCurrencyFetcher struct {
    fetchPrices fetchVietcombankFn
}

func NewVietcombankCurrencyFetcher(client *vietcombank.Client) CurrencyPriceFetcher {
    return &vietcombankCurrencyFetcher{
        fetchPrices: client.FetchCurrencyPrices,
    }
}

func newVietcombankCurrencyFetcherWithStub(fn fetchVietcombankFn) *vietcombankCurrencyFetcher {
    return &vietcombankCurrencyFetcher{fetchPrices: fn}
}

func (f *vietcombankCurrencyFetcher) Source() PriceSource {
    return SourceVietcombank
}

func (f *vietcombankCurrencyFetcher) FetchCurrencyPrices(ctx context.Context) ([]*CachedCurrencyPrice, error) {
    prices, err := f.fetchPrices(ctx)
    if err != nil {
        return nil, fmt.Errorf("fetch from vietcombank: %w", err)
    }
    result := make([]*CachedCurrencyPrice, 0, len(prices))
    for _, p := range prices {
        result = append(result, &CachedCurrencyPrice{
            TypeCode:   p.TypeCode,  // Already suffixed with _VCB by client
            Name:       p.Name,
            Buy:        p.Buy,
            Sell:       p.Sell,
            ChangeBuy:  0,
            ChangeSell: 0,
            Currency:   p.Currency,
            UpdateTime: time.Now(),
        })
    }
    return result, nil
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -short ./domain/service/ -run TestVietcombank
```

**Step 5: Commit**

---

### Task 3: Replace Currency Waterfall with 3 Parallel Refresh Methods

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`
  - Struct: add `vangSaiGonCurrencyFetcher`, `vangTodayCurrencyFetcher`, `vietcombankFetcher` fields; remove `currencySvc` field
  - Constructor: add 3 `CurrencyPriceFetcher` params, remove `currencySvc CurrencyPriceService` param
  - Remove: `refreshCurrency()` method (lines 274-311)
  - Add: `refreshCurrencyVangSaiGon()`, `refreshCurrencyVangToday()`, `refreshCurrencyVietcombank()` methods
  - Update: `RefreshAllPrices()` — channel buffer 10, wg.Add(10), 3 currency goroutines, failCount threshold 10
- Modify: `src/go-backend/domain/service/interfaces.go` — update `AssetPriceService` comment (10 sources)

**Security notes:** Each currency source marks stale independently via `MarkStaleByAssetTypeAndSource(ctx, "currency", "<source>")`. The old waterfall's blanket `MarkStaleByAssetType(ctx, "currency")` is removed — no more all-or-nothing stale marking for currency.

**Step 1: Write the failing test**

Create `src/go-backend/domain/service/asset_price_service_currency_test.go`:
- Test `refreshCurrencyVangSaiGon` with stubbed fetcher:
  - Success: upserts batch with `AssetType: "currency"`, `Source: "vangsaigon"`
  - Failure: marks stale `("currency", "vangsaigon")` — NOT all currency
  - Nil fetcher: marks stale, returns error
- Test `refreshCurrencyVietcombank` with stubbed fetcher:
  - Success: upserts batch with `Source: "vietcombank"`, TypeCodes have `_VCB` suffix
  - Failure: marks stale `("currency", "vietcombank")` only
- Test `RefreshAllPrices` with all 10 sources:
  - When VCB fails + others succeed → only vietcombank currency is stale
  - When all 10 fail → returns error
  - When 9 fail + 1 succeeds → returns nil

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./domain/service/ -run TestRefreshCurrency
```

**Step 3: Write minimal implementation**

Update struct (remove `currencySvc`, add 3 currency fetchers):
```go
type assetPriceService struct {
    repo                      repository.AssetPriceRepository
    configRepo                repository.AssetDisplayConfigRepository
    silverSvc                 SilverPriceService
    vangSaiGonFetcher         GoldPriceFetcher         // gold
    vangTodayFetcher          GoldPriceFetcher          // gold
    vangSaiGonCurrencyFetcher CurrencyPriceFetcher      // NEW
    vangTodayCurrencyFetcher  CurrencyPriceFetcher      // NEW
    vietcombankFetcher        CurrencyPriceFetcher      // NEW
    sjcClient                 *sjc.Client
    dojiClient                *doji.Client
    btmcClient                *btmcdirect.Client
    pnjClient                 *pnj.Client
}
```

Update constructor:
```go
func NewAssetPriceService(
    repo repository.AssetPriceRepository,
    configRepo repository.AssetDisplayConfigRepository,
    silverSvc SilverPriceService,
    vangSaiGonGoldFetcher GoldPriceFetcher,
    vangTodayGoldFetcher GoldPriceFetcher,
    vangSaiGonCurrencyFetcher CurrencyPriceFetcher,
    vangTodayCurrencyFetcher CurrencyPriceFetcher,
    vietcombankFetcher CurrencyPriceFetcher,
    sjcClient *sjc.Client,
    dojiClient *doji.Client,
    btmcClient *btmcdirect.Client,
    pnjClient *pnj.Client,
) AssetPriceService
```

Add 3 `refreshCurrencyXxx()` methods following the exact `refreshGoldVangSaiGon` pattern:
```go
func (s *assetPriceService) refreshCurrencyVangSaiGon(ctx context.Context) refreshResult {
    if s.vangSaiGonCurrencyFetcher == nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
        return refreshResult{source: "currency_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon currency fetcher not configured")}
    }
    prices, err := s.vangSaiGonCurrencyFetcher.FetchCurrencyPrices(ctx)
    if err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
        return refreshResult{source: "currency_vangsaigon", count: 0, err: err}
    }
    batch := make([]*models.AssetPrice, 0, len(prices))
    for _, p := range prices {
        if p.Buy <= 0 && p.Sell <= 0 { continue }
        batch = append(batch, &models.AssetPrice{
            TypeCode: p.TypeCode, AssetType: "currency", Name: p.Name,
            Buy: p.Buy, Sell: p.Sell, ChangeBuy: p.ChangeBuy, ChangeSell: p.ChangeSell,
            Currency: p.Currency, Source: "vangsaigon", IsStale: false, FetchedAt: time.Now(),
        })
    }
    if len(batch) == 0 {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
        return refreshResult{source: "currency_vangsaigon", count: 0, err: fmt.Errorf("vangsaigon currency: no valid prices")}
    }
    if err := s.repo.UpsertBatch(ctx, batch); err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "currency", "vangsaigon")
        return refreshResult{source: "currency_vangsaigon", count: 0, err: err}
    }
    return refreshResult{source: "currency_vangsaigon", count: len(batch), err: nil}
}
// Same pattern for refreshCurrencyVangToday and refreshCurrencyVietcombank
```

Update `RefreshAllPrices()`:
```go
results := make(chan refreshResult, 10) // was 8
// ... 6 gold goroutines (unchanged) ...
// 1 silver goroutine (unchanged) ...
// 3 currency goroutines (replacing single waterfall):
wg.Add(3)
go func() { defer wg.Done(); results <- s.refreshCurrencyVangSaiGon(ctx) }()
go func() { defer wg.Done(); results <- s.refreshCurrencyVangToday(ctx) }()
go func() { defer wg.Done(); results <- s.refreshCurrencyVietcombank(ctx) }()
// Total: wg.Add(6 + 1 + 3) = wg.Add(10 total, split across 3 blocks)
// Update: if failCount == 10
```

Remove `refreshCurrency()` method entirely.

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -short ./domain/service/ -run TestRefreshCurrency
```

**Step 5: Commit**

---

### Task 4: Wire Vietcombank Client + Currency Fetchers in DI

**Files:**
- Modify: `src/go-backend/domain/service/services.go` — update `NewServices()` to:
  - Create Vietcombank client (behind feature flag)
  - Create 3 currency fetcher instances
  - Pass to `NewAssetPriceService()` (new signature, no `currencySvc`)
  - Keep `currencyPriceSvc` if other services depend on it (check first)

**Security notes:** Feature flag `VIETCOMBANK_FX_ENABLED` (env var, default `true`) controls client instantiation. When `"false"`, `nil` is passed → fetcher nil-check marks source stale gracefully.

**Step 1: Check if CurrencyPriceService is used elsewhere**

Before removing `currencySvc` from the constructor, verify no other code depends on it:
```bash
cd src/go-backend && grep -rn "currencyPriceSvc\|CurrencyPriceService" --include="*.go" | grep -v _test.go | grep -v currency_price_service.go
```

If only `services.go` and `asset_price_service.go` reference it, it can be fully removed from `NewAssetPriceService`. Keep `NewCurrencyPriceService(redisClient)` creation in `NewServices()` only if MarketDataService or other services use it.

**Step 2: Write the wiring**

In `services.go`, `NewServices()`:
```go
// Currency fetchers — parallel per-source (replacing waterfall for AssetPriceService)
vangSaiGonCurrencyFetcher := NewVangSaiGonCurrencyFetcher(waterfallSourceTimeout)
vangTodayCurrencyFetcher := NewVangTodayCurrencyFetcher(waterfallSourceTimeout)

var vcbFetcher CurrencyPriceFetcher
if os.Getenv("VIETCOMBANK_FX_ENABLED") != "false" {
    vcbClient := vietcombank.NewClient()
    vcbFetcher = NewVietcombankCurrencyFetcher(vcbClient)
}

assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice,
    repos.AssetDisplayConfig,
    silverPriceSvc,
    NewVangSaiGonGoldFetcher(waterfallSourceTimeout),
    NewVangTodayGoldFetcher(waterfallSourceTimeout),
    vangSaiGonCurrencyFetcher,  // NEW
    vangTodayCurrencyFetcher,   // NEW
    vcbFetcher,                 // NEW (nil when disabled)
    sjcClient,
    dojiClient,
    btmcClient,
    pnjClient,
)
```

Add import: `"wealthjourney/pkg/vietcombank"`

**Step 3: Verify build + tests**
```bash
cd src/go-backend && go build ./... && go test -short ./...
```

**Step 4: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 5: Commit**

---

### Task 5: Seed Vietcombank Currency Display Config + Fetch Codes

**Files:**
- Create: `src/go-backend/cmd/migrate-vietcombank-currency/main.go`
- Modify: `Taskfile.yml` — add `backend:migrate-vietcombank-currency` task

**Security notes:** Migration uses parameterized GORM queries. Idempotent via existence checks before insert.

**Step 1: Write the migration**

The migration seeds:
1. `asset_display_config` rows for Vietcombank currency entries
2. `asset_config_fetch_code` rows mapping each VCB display config to its `_VCB` fetch code

**Display config entries to seed:**

| TypeCode | AssetType | DisplayName | DisplayOrder | Enabled | ShowInInvestment |
|----------|-----------|-------------|--------------|---------|------------------|
| USD_VCB | currency | USD Vietcombank (Official) | 2 | true | false |
| EUR_VCB | currency | EUR Vietcombank | 20 | true | false |
| GBP_VCB | currency | GBP Vietcombank | 21 | true | false |
| JPY_VCB | currency | JPY Vietcombank | 22 | true | false |
| CHF_VCB | currency | CHF Vietcombank | 23 | true | false |
| AUD_VCB | currency | AUD Vietcombank | 24 | true | false |
| CAD_VCB | currency | CAD Vietcombank | 25 | true | false |
| SGD_VCB | currency | SGD Vietcombank | 26 | true | false |
| HKD_VCB | currency | HKD Vietcombank | 27 | true | false |
| TWD_VCB | currency | TWD Vietcombank | 28 | true | false |
| KRW_VCB | currency | KRW Vietcombank | 29 | true | false |
| THB_VCB | currency | THB Vietcombank | 30 | true | false |
| CNY_VCB | currency | CNY Vietcombank | 31 | true | false |

**Fetch code entries:**
Each display config gets a single fetch code at priority 1 where `fetch_code = type_code` (e.g., display config `"USD_VCB"` → fetch code `"USD_VCB"` at priority 1).

**Notes:**
- `TypeCode` in `asset_display_config` uses `_VCB` suffix to avoid conflict with existing `(type_code, asset_type)` unique index (e.g., `"USD"` + `"currency"` is already taken by "USD Tự Do")
- The fetch code `"USD_VCB"` maps to `asset_price.type_code = "USD_VCB"` which is stored by the Vietcombank client
- Existing VangSaiGon "USD Vietcombank" entry (type_code `"USD Internalbank"`) remains unchanged — it provides VCB rates from VangSaiGon's aggregation
- Consider renaming existing "USD Vietcombank" display_name to "USD Vietcombank (VSG)" to distinguish from the direct API source — include in migration as an UPDATE

**Step 2: Write migration following existing pattern** (from `cmd/migrate-asset-display-config/main.go`):
```go
// Check existence before insert (same pattern as existing migration)
for _, seed := range vcbSeeds {
    var count int64
    db.Raw("SELECT COUNT(*) FROM asset_display_config WHERE type_code = ? AND asset_type = ? AND deleted_at IS NULL",
        seed.TypeCode, seed.AssetType).Scan(&count)
    if count == 0 {
        // INSERT
    }
}
```

**Step 3: Add Taskfile entry**
```yaml
backend:migrate-vietcombank-currency:
  dir: src/go-backend
  cmds:
    - go run cmd/migrate-vietcombank-currency/main.go
```

**Step 4: Run migration locally**
```bash
task backend:migrate-vietcombank-currency
```

**Step 5: Commit**

---

### Task 6: Update Flow Diagram (Background Scheduler)

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**
1. Read the current "Background Scheduler — Price Cache Refresh" sequence diagram
2. Update to show 10 parallel goroutines (was 8)
3. Replace the single `currency_waterfall` participant with 3: `currency_vangsaigon`, `currency_vangtoday`, `currency_vietcombank`
4. Show per-source stale marking for currency (matching gold pattern)
5. Update summary log line example to include 3 currency sources
6. Commit diagram changes

---

### Task 7: Full Backend Verification (Lint + Test + Build)

**Files:**
- Potentially modify: any files with lint errors

**Steps:**

1. Run full backend lint:
```bash
cd src/go-backend && task ci:backend-lint
```

2. Run full backend unit tests:
```bash
cd src/go-backend && go test -short ./...
```

3. Verify build:
```bash
cd src/go-backend && go build ./...
```

4. Fix any issues found:
   - **Depguard violations:** service layer must NOT import `wealthjourney/pkg/vietcombank` directly. The fetcher adapter wraps the client, so only the fetcher (in `domain/service/`) needs the import. But wait — `currency_fetcher_vietcombank.go` IS in `domain/service/` and it imports `wealthjourney/pkg/vietcombank`. Check if depguard allows `pkg/*` imports in the service layer. If not, the fetcher needs to use a function type instead (like `fetchVietcombankFn`).

   Actually, looking at existing code: `currency_fetcher_vangsaigon.go` imports `wealthjourney/pkg/vnprice` and it's in `domain/service/`. So `pkg/*` imports ARE allowed in service layer fetchers — only `gorm.io/gorm`, `go-redis`, and `gin-gonic/gin` are blocked by depguard.

5. Commit any fixes

---

### Task 8: Update CLAUDE.md Documentation

**Files:**
- Modify: `.claude/CLAUDE.md`

**Steps:**
1. Update "Asset Price Cache" section: mention 10 goroutines (was 8), 3 currency sources (vangsaigon, vangtoday, vietcombank)
2. Add `VIETCOMBANK_FX_ENABLED` env var to configuration tables (default: `true`)
3. Add `task backend:migrate-vietcombank-currency` to migration task list
4. Add "Vietcombank API" to external dependency list in relevant section
5. Update scheduler job list if mentioned (price_cache_job now runs 10 goroutines)
6. Commit
