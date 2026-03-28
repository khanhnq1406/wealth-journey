# Multi-Source Gold Price Collection Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add 4 new gold price fetcher clients (SJC, DOJI, BTMC-direct, PNJ) that collect prices from official dealer websites and store them independently in the `asset_price` table, differentiated by the `source` column.

**Spec:** `docs/specs/2026-03-26-multi-source-gold-price-spec.md`

**Architecture:** This extends the existing price-cache architecture. The `AssetPriceService.RefreshAllPrices()` method gains 4 new parallel refresh goroutines — one per source. Each source has its own `pkg/<source>/` client that fetches, parses, and returns `[]*GoldPrice`. The DB unique constraint changes from `(type_code, currency)` to `(type_code, currency, source)` so each source stores its own rows independently. No frontend changes — data collection only.

**Tech Stack:** Go 1.25, GORM (PostgreSQL), `net/http` (JSON/HTML fetching), `encoding/json`, `regexp` (HTML scraping — no new dependencies), `golang.org/x/net/html` (if needed for DOM parsing)

## Security Implementation Notes

- **Authentication:** N/A — this is a backend scheduler job with no user-facing endpoints
- **Authorization:** N/A — no user-facing endpoints added
- **Input validation:** All external responses are untrusted. Each client enforces: 5s timeout, 1MB body limit, zero/negative price filtering, type code sanitization (alphanumeric + underscore only, max 50 chars)
- **Data sanitization:** Type codes are sanitized before DB storage via `toTypeCode()` functions. GORM parameterized queries prevent SQL injection. No user input involved.

## Component Reuse Inventory (Frontend Tasks)

N/A — this is a backend-only feature. No frontend changes.

## C4 Architecture Diagram Updates

Per spec section "Architecture Changes (C4)":
- **L3 Backend Component** (`docs/architecture/c4-component-backend.md`): Add 4 new `pkg/` client components (SJC Client, DOJI Client, BTMC Direct Client, PNJ Client) connected to `AssetPriceService`
- **L2 Container** (`docs/architecture/c4-container.md`): Add 4 new external systems (SJC, DOJI, BTMC, PNJ dealer websites)

## Runtime Flow Diagram Updates

Per spec section "Runtime Flow Diagrams to Update":
- **`docs/architecture/flow-cross-cutting.md`**: Update the PriceCacheJob sequence diagram to show parallel fetching from 7 sources (waterfall + SJC + DOJI + BTMC + PNJ + silver + currency)

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-container.md`

**Steps:**

1. Read existing `c4-component-backend.md`, add 4 new components under `pkg/`:
   - `SJC Client [Component: Go Package]` — "Fetches gold prices from SJC official API"
   - `DOJI Client [Component: Go Package]` — "Scrapes gold prices from DOJI website"
   - `BTMC Direct Client [Component: Go Package]` — "Scrapes gold prices from BTMC website"
   - `PNJ Client [Component: Go Package]` — "Fetches gold prices from PNJ API"
   - Connect each to `AssetPriceService` with relationship "provides gold prices"
2. Read existing `c4-container.md`, add 4 new external systems:
   - `SJC Website [External System]`
   - `DOJI Website [External System]`
   - `BTMC Website [External System]`
   - `PNJ API [External System]`
   - Connect each to `Go Backend` container
3. Commit diagram changes

---

### Task 1: Database Schema Migration — Add Source to Unique Constraint

**Files:**

- Modify: `src/go-backend/domain/models/asset_price.go`
- Create: `src/go-backend/cmd/migrate-multi-source/main.go`
- Modify: `src/go-backend/domain/repository/asset_price_repository.go` (UpsertBatch conflict columns)
- Modify: `Taskfile.yml` (add new migration task)

**Security notes:** Migration must be wrapped in transaction to prevent partial state. Existing rows must be backfilled with `source = 'waterfall'` before creating the new unique constraint.

**Step 1: Write the failing test**

Create `src/go-backend/domain/repository/asset_price_repository_test.go`:
```go
func TestUpsertBatch_MultiSource(t *testing.T) {
    // Test that two rows with same type_code+currency but different source
    // can coexist without conflict
    price1 := &models.AssetPrice{
        TypeCode: "SJC", Currency: "VND", Source: "waterfall",
        Buy: 17000000, Sell: 17200000, AssetType: "gold",
    }
    price2 := &models.AssetPrice{
        TypeCode: "SJC", Currency: "VND", Source: "sjc",
        Buy: 17050000, Sell: 17250000, AssetType: "gold",
    }
    // Both should upsert successfully without conflict
    err := repo.UpsertBatch(ctx, []*models.AssetPrice{price1})
    assert.NoError(t, err)
    err = repo.UpsertBatch(ctx, []*models.AssetPrice{price2})
    assert.NoError(t, err)
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -tags=integration ./domain/repository/ -run TestUpsertBatch_MultiSource -v
```
Expected: Fails because current unique constraint on `(type_code, currency)` prevents two rows with same type_code+currency.

**Step 3: Update AssetPrice model**

In `src/go-backend/domain/models/asset_price.go`, change the GORM tags:

```go
// Before:
TypeCode string `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"typeCode"`
Currency string `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"currency"`
Source   string `gorm:"size:30" json:"source"`

// After:
TypeCode string `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency_source" json:"typeCode"`
Currency string `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency_source" json:"currency"`
Source   string `gorm:"size:30;not null;default:'waterfall';uniqueIndex:idx_asset_price_type_code_currency_source" json:"source"`
```

**Step 4: Update UpsertBatch conflict columns**

In `src/go-backend/domain/repository/asset_price_repository.go`, change `OnConflict` columns:

```go
// Before:
Columns: []clause.Column{{Name: "type_code"}, {Name: "currency"}},

// After:
Columns: []clause.Column{{Name: "type_code"}, {Name: "currency"}, {Name: "source"}},
```

**Step 5: Create migration command**

Create `src/go-backend/cmd/migrate-multi-source/main.go`:
```go
func migrateMultiSource(db *gorm.DB) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // 1. Backfill existing rows with source='waterfall' where source is empty
        if err := tx.Exec(
            "UPDATE asset_price SET source = 'waterfall' WHERE source IS NULL OR source = ''",
        ).Error; err != nil {
            return fmt.Errorf("backfill source: %w", err)
        }

        // 2. Drop old unique index
        if err := tx.Exec(
            "DROP INDEX IF EXISTS idx_asset_price_type_code_currency",
        ).Error; err != nil {
            return fmt.Errorf("drop old index: %w", err)
        }

        // 3. AutoMigrate to apply new model tags (creates new 3-column unique index)
        if err := tx.AutoMigrate(&models.AssetPrice{}); err != nil {
            return fmt.Errorf("auto migrate: %w", err)
        }

        return nil
    })
}
```

**Step 6: Add Taskfile entry**

In `Taskfile.yml`:
```yaml
backend:migrate-multi-source:
  desc: "Migrate asset_price to multi-source unique constraint (type_code, currency, source)"
  dir: src/go-backend
  cmds:
    - go run cmd/migrate-multi-source/main.go
```

**Step 7: Run test to verify it passes**
```bash
cd src/go-backend && go test -tags=integration ./domain/repository/ -run TestUpsertBatch_MultiSource -v
```

**Step 8: Commit**
```
feat(asset-price): migrate unique constraint to (type_code, currency, source)
```

---

### Task 2: Extend MarkStaleByAssetType with Optional Source Filter

**Files:**

- Modify: `src/go-backend/domain/repository/asset_price_repository.go` — add `MarkStaleByAssetTypeAndSource` method
- Modify: `src/go-backend/domain/service/asset_price_service.go` — use source-aware stale marking in new refresh methods
- Test: `src/go-backend/domain/repository/asset_price_repository_test.go`

**Security notes:** Source parameter must be validated (non-empty string from a known set) before use in queries. GORM parameterized queries handle injection.

**Step 1: Write the failing test**

```go
func TestMarkStaleByAssetTypeAndSource(t *testing.T) {
    // Insert two gold rows with different sources
    // Mark only source="sjc" stale
    // Verify waterfall row is NOT stale, sjc row IS stale
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -tags=integration ./domain/repository/ -run TestMarkStaleByAssetTypeAndSource -v
```

**Step 3: Add repository method**

In `asset_price_repository.go`, add to interface:
```go
MarkStaleByAssetTypeAndSource(ctx context.Context, assetType string, source string) error
```

Implementation:
```go
func (r *assetPriceRepository) MarkStaleByAssetTypeAndSource(ctx context.Context, assetType string, source string) error {
    return r.db.WithContext(ctx).
        Model(&models.AssetPrice{}).
        Where("asset_type = ? AND source = ?", assetType, source).
        Updates(map[string]interface{}{
            "is_stale":   true,
            "updated_at": time.Now(),
        }).Error
}
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(asset-price): add MarkStaleByAssetTypeAndSource for per-source stale marking
```

---

### Task 3: Set Source Field in Existing Refresh Methods

**Files:**

- Modify: `src/go-backend/domain/service/asset_price_service.go` — set `Source: "waterfall"` in refreshGold, refreshSilver, refreshCurrency

**Security notes:** None — trivial field assignment.

**Step 1: Write the failing test**

```go
func TestRefreshGold_SetsSourceWaterfall(t *testing.T) {
    // Mock goldSvc to return prices
    // Call refreshGold
    // Verify all AssetPrice objects passed to repo.UpsertBatch have Source="waterfall"
}
```

**Step 2: Run test to verify it fails**

**Step 3: Add Source field in each refresh method**

In `refreshGold()`, `refreshSilver()`, `refreshCurrency()`, set `Source: "waterfall"` when building `AssetPrice` structs:
```go
batch = append(batch, &models.AssetPrice{
    TypeCode:  p.TypeCode,
    // ... existing fields ...
    Source:    "waterfall",  // NEW
})
```

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(asset-price): set source="waterfall" on existing refresh methods
```

---

### Task 4: SJC Client Package

**Files:**

- Create: `src/go-backend/pkg/sjc/client.go`
- Create: `src/go-backend/pkg/sjc/types.go`
- Create: `src/go-backend/pkg/sjc/client_test.go`

**Security notes:** Untrusted external JSON response. Enforce 5s timeout, 1MB body limit. Sanitize type codes (alphanumeric + underscore only). Filter zero/negative prices.

**Step 1: Write the failing test**

In `pkg/sjc/client_test.go`:
```go
func TestFetchGoldPrices_ParsesJSON(t *testing.T) {
    // Create httptest server returning mock SJC JSON response
    // Call FetchGoldPrices
    // Verify returns correct GoldPrice structs with SJC_ prefix
    // Verify zero prices are filtered
    // Verify type codes are sanitized
}

func TestFetchGoldPrices_Timeout(t *testing.T) {
    // Create slow httptest server
    // Verify returns error within ~5s
}

func TestToTypeCode(t *testing.T) {
    // "SJC 1L - 10L - 1KG" → "SJC_MIENG_1L_10L_1KG"
    // "Nhan SJC 99.99% 0.3 chi, 0.5 chi" → "SJC_NHAN_99_99_0_3CHI_0_5CHI"
    // "Nữ trang 99.99%" → "SJC_NU_TRANG_99_99"
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./pkg/sjc/ -v
```

**Step 3: Implement SJC client**

`pkg/sjc/types.go`:
```go
package sjc

import "time"

type GoldPrice struct {
    TypeCode   string
    Name       string
    Buy        int64
    Sell       int64
    ChangeBuy  int64
    ChangeSell int64
    Currency   string
    UpdateTime time.Time
}

// SJC API response structures
type apiResponse struct {
    DataList struct {
        Data []apiRow `json:"Data"`
    } `json:"DataList"`
}

type apiRow struct {
    TypeName       string  `json:"TypeName"`
    BuyValue       float64 `json:"BuyValue"`
    SellValue      float64 `json:"SellValue"`
    BuyDifferValue int64   `json:"BuyDifferValue"`
    SellDifferValue int64  `json:"SellDifferValue"`
}
```

`pkg/sjc/client.go`:
```go
package sjc

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "regexp"
    "strings"
    "time"
    "unicode"

    "golang.org/x/text/unicode/norm"
)

const (
    defaultURL     = "https://sjc.com.vn/GoldPrice/Services/PriceService.ashx"
    maxBodySize    = 1 << 20 // 1 MB
    requestTimeout = 5 * time.Second
)

var sanitizeRe = regexp.MustCompile(`[^A-Z0-9_]`)

type Client struct {
    httpClient *http.Client
    url        string
}

func NewClient() *Client {
    return &Client{
        httpClient: &http.Client{Timeout: requestTimeout},
        url:        defaultURL,
    }
}

func (c *Client) FetchGoldPrices(ctx context.Context) ([]*GoldPrice, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
    if err != nil {
        return nil, fmt.Errorf("sjc: create request: %w", err)
    }
    // SJC requires branch selection — use HCM branch IDs
    q := req.URL.Query()
    q.Set("method", "AllBranch")
    q.Set("LocationId", "2") // Ho Chi Minh
    req.URL.RawQuery = q.Encode()

    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("sjc: fetch: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("sjc: status %d", resp.StatusCode)
    }

    body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
    if err != nil {
        return nil, fmt.Errorf("sjc: read body: %w", err)
    }

    var apiResp apiResponse
    if err := json.Unmarshal(body, &apiResp); err != nil {
        return nil, fmt.Errorf("sjc: parse JSON: %w", err)
    }

    var results []*GoldPrice
    seen := make(map[string]bool)
    for _, row := range apiResp.DataList.Data {
        buy := int64(row.BuyValue)
        sell := int64(row.SellValue)
        if buy <= 0 && sell <= 0 {
            continue
        }
        tc := toTypeCode(row.TypeName)
        if seen[tc] {
            continue
        }
        seen[tc] = true
        results = append(results, &GoldPrice{
            TypeCode:   tc,
            Name:       row.TypeName,
            Buy:        buy,
            Sell:       sell,
            ChangeBuy:  row.BuyDifferValue,
            ChangeSell: row.SellDifferValue,
            Currency:   "VND",
            UpdateTime: time.Now(),
        })
    }
    return results, nil
}

func toTypeCode(name string) string {
    // Remove Vietnamese diacritics, uppercase, replace non-alnum with underscore
    s := removeDiacritics(name)
    s = strings.ToUpper(s)
    s = sanitizeRe.ReplaceAllString(s, "_")
    // Collapse multiple underscores
    for strings.Contains(s, "__") {
        s = strings.ReplaceAll(s, "__", "_")
    }
    s = strings.Trim(s, "_")
    if len(s) > 45 { // leave room for "SJC_" prefix
        s = s[:45]
    }
    return "SJC_" + s
}

func removeDiacritics(s string) string {
    // NFD decomposition then strip combining marks
    var b strings.Builder
    for _, r := range norm.NFD.String(s) {
        if !unicode.Is(unicode.Mn, r) {
            b.WriteRune(r)
        }
    }
    return b.String()
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -short ./pkg/sjc/ -v
```

**Step 5: Commit**
```
feat(sjc): add SJC gold price fetcher client
```

---

### Task 5: DOJI Client Package

**Files:**

- Create: `src/go-backend/pkg/doji/client.go`
- Create: `src/go-backend/pkg/doji/types.go`
- Create: `src/go-backend/pkg/doji/client_test.go`

**Security notes:** HTML scraping from untrusted source. Use regex-based extraction (consistent with existing `silverprice/phuquy_client.go` pattern). Enforce 5s timeout, 1MB body limit. Sanitize all extracted strings before use as type codes.

**Step 1: Write the failing test**

```go
func TestFetchGoldPrices_ParsesHTML(t *testing.T) {
    // Mock HTML table response from DOJI
    // Verify parses product names and prices correctly
    // Verify price conversion: "nghìn/chỉ" → multiply by 1,000,000
    // Verify type codes prefixed with DOJI_
}

func TestToTypeCode(t *testing.T) {
    // "SJC Bán Lẻ" → "DOJI_SJC_BAN_LE"
    // "Nhẫn Tròn 9999" → "DOJI_NHAN_TRON_9999"
    // "Nguyên Liệu 99.99" → "DOJI_NGUYEN_LIEU_99_99"
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./pkg/doji/ -v
```

**Step 3: Implement DOJI client**

- Fetch HTML from `giavang.doji.vn/`
- Use regex to extract `<tr>` rows from the price table (same pattern as `phuquy_client.go`)
- Parse product name from first `<td>`, buy/sell prices from subsequent `<td>`s
- Price conversion: numbers are in "nghìn/chỉ" (thousands per mace) → multiply by 1,000,000 to get VND per lượng (×1000 for VND unit, ×1000 for per-lượng conversion)
- Type code: `removeDiacritics(name) → uppercase → sanitize → "DOJI_" prefix`

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(doji): add DOJI gold price scraper client
```

---

### Task 6: BTMC Direct Client Package

**Files:**

- Create: `src/go-backend/pkg/btmcdirect/client.go`
- Create: `src/go-backend/pkg/btmcdirect/types.go`
- Create: `src/go-backend/pkg/btmcdirect/client_test.go`

**Security notes:** HTML scraping from untrusted source. "Liên hệ" (Contact) sell prices must be stored as 0, not parsed as number. Same safety controls as DOJI.

**Step 1: Write the failing test**

```go
func TestFetchGoldPrices_ParsesHTML(t *testing.T) {
    // Mock BTMC HTML table
    // Verify price format: 17250 → 17,250,000 VND (multiply by 1,000,000)
    // Verify "Liên hệ" → sell=0
    // Verify type codes prefixed with BTMC_
}

func TestToTypeCode(t *testing.T) {
    // "Vàng miếng VRTL" → "BTMC_VRTL"
    // "Nhẫn tròn Trơn" → "BTMC_NHAN_TRON"
    // "Vàng miếng SJC" → "BTMC_SJC"
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./pkg/btmcdirect/ -v
```

**Step 3: Implement BTMC Direct client**

- Fetch HTML from `btmc.vn/Home/BGiaVang`
- Parse HTML table rows with regex
- Price format: numbers where 1 = 1,000 VND → multiply by 1,000,000
- Handle "Liên hệ" as sell=0
- Type code: `"BTMC_" + sanitized product name`

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(btmcdirect): add BTMC direct gold price scraper client
```

---

### Task 7: PNJ Client Package

**Files:**

- Create: `src/go-backend/pkg/pnj/client.go`
- Create: `src/go-backend/pkg/pnj/types.go`
- Create: `src/go-backend/pkg/pnj/client_test.go`

**Security notes:** JSON API response from untrusted source. Enforce 5s timeout, 1MB body limit. Parse string numbers carefully (handle commas). Filter TPHCM region only.

**Step 1: Write the failing test**

```go
func TestFetchGoldPrices_ParsesJSON(t *testing.T) {
    // Mock PNJ JSON response with region data
    // Verify TPHCM region selected
    // Verify price format: "173,500" → parse + multiply by 1,000,000
    // Verify type codes prefixed with PNJ_
}

func TestToTypeCode(t *testing.T) {
    // "999.9" → "PNJ_999_9"
    // "Nhẫn Tròn PNJ" → "PNJ_NHAN_TRON"
    // "Vàng Kim Bảo" → "PNJ_VANG_KIM_BAO"
    // "916 (22K)" → "PNJ_916_22K"
}

func TestFetchGoldPrices_FallbackFirstRegion(t *testing.T) {
    // Mock response without TPHCM region
    // Verify falls back to first region
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -short ./pkg/pnj/ -v
```

**Step 3: Implement PNJ client**

- Fetch JSON from `edge-cf-api.pnj.io/ecom-frontend/v3/get-gold-price`
- Response structure: `{ regions: [{ name: "TPHCM", gold_type: [...] }] }`
- Filter for TPHCM region; fallback to first region if not found
- Price format: string numbers with commas → parse and multiply by 1,000,000
- Type code: `"PNJ_" + sanitized product name`

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(pnj): add PNJ gold price fetcher client
```

---

### Task 8: Shared Type Code Sanitizer Utility

**Files:**

- Create: `src/go-backend/pkg/gold/sanitize.go`
- Create: `src/go-backend/pkg/gold/sanitize_test.go`

**Security notes:** Type code sanitization is a security boundary — prevents injection of arbitrary strings into DB. Must enforce: uppercase, alphanumeric + underscore only, max 50 chars.

**Step 1: Write the failing test**

```go
func TestSanitizeTypeCode(t *testing.T) {
    tests := []struct{ input, prefix, want string }{
        {"SJC 1L - 10L - 1KG", "SJC", "SJC_SJC_1L_10L_1KG"},
        {"Nhẫn Tròn 9999", "DOJI", "DOJI_NHAN_TRON_9999"},
        {"Nữ trang 99.99%", "SJC", "SJC_NU_TRANG_99_99"},
        {"999.9", "PNJ", "PNJ_999_9"},
        {"Vàng miếng VRTL", "BTMC", "BTMC_VANG_MIENG_VRTL"},
        {"<script>alert(1)</script>", "SJC", "SJC_SCRIPT_ALERT_1_SCRIPT"},
    }
    for _, tt := range tests {
        got := SanitizeTypeCode(tt.prefix, tt.input)
        assert.Equal(t, tt.want, got)
        assert.LessOrEqual(t, len(got), 50)
    }
}
```

**Step 2: Run test to verify it fails**

**Step 3: Implement shared sanitizer**

```go
package gold

func SanitizeTypeCode(prefix, name string) string {
    s := removeDiacritics(name)
    s = strings.ToUpper(s)
    s = sanitizeRe.ReplaceAllString(s, "_")
    // Collapse multiple underscores, trim
    for strings.Contains(s, "__") {
        s = strings.ReplaceAll(s, "__", "_")
    }
    s = strings.Trim(s, "_")
    result := prefix + "_" + s
    if len(result) > 50 {
        result = result[:50]
    }
    return result
}
```

Then refactor all 4 clients (Tasks 4-7) to use `gold.SanitizeTypeCode(prefix, name)` instead of their own `toTypeCode()`.

**Step 4: Run test to verify it passes**

**Step 5: Commit**
```
feat(gold): add shared SanitizeTypeCode utility for multi-source type codes
```

---

### Task 9: Integrate New Sources into AssetPriceService

**Files:**

- Modify: `src/go-backend/domain/service/asset_price_service.go` — add refreshGoldSJC, refreshGoldDOJI, refreshGoldBTMC, refreshGoldPNJ methods; update RefreshAllPrices
- Modify: `src/go-backend/domain/service/services.go` — pass new clients to AssetPriceService
- Modify: `src/go-backend/domain/service/interfaces.go` — no interface change needed (RefreshAllPrices stays same)
- Test: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** Each source runs independently — one failure must not block others. Use per-source stale marking (Task 2's `MarkStaleByAssetTypeAndSource`). Log summary must include all sources.

**Step 1: Write the failing test**

```go
func TestRefreshAllPrices_IncludesNewSources(t *testing.T) {
    // Mock all price services + 4 new clients
    // Call RefreshAllPrices
    // Verify repo.UpsertBatch called 7 times (waterfall gold, silver, currency, sjc, doji, btmc, pnj)
    // Verify each new source batch has correct Source field
}

func TestRefreshAllPrices_SourceFailureIndependent(t *testing.T) {
    // Mock SJC client to fail, others succeed
    // Verify only SJC rows marked stale
    // Verify other sources' data upserted successfully
}
```

**Step 2: Run test to verify it fails**

**Step 3: Extend assetPriceService struct**

Add new client fields:
```go
type assetPriceService struct {
    repo        repository.AssetPriceRepository
    goldSvc     GoldPriceService
    silverSvc   SilverPriceService
    currencySvc CurrencyPriceService
    sjcClient   *sjc.Client      // NEW
    dojiClient  *doji.Client     // NEW
    btmcClient  *btmcdirect.Client // NEW
    pnjClient   *pnj.Client      // NEW
}
```

Update constructor to accept new clients (with nil-safe checks so existing code works without them).

**Step 4: Add refresh methods for each source**

Each method follows the same pattern:
```go
func (s *assetPriceService) refreshGoldSJC(ctx context.Context) refreshResult {
    if s.sjcClient == nil {
        return refreshResult{source: "gold_sjc", count: 0, err: fmt.Errorf("sjc client not configured")}
    }
    prices, err := s.sjcClient.FetchGoldPrices(ctx)
    if err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
        return refreshResult{source: "gold_sjc", count: 0, err: err}
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
            Source:     "sjc",
            IsStale:    false,
            FetchedAt:  time.Now(),
        })
    }
    if len(batch) == 0 {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
        return refreshResult{source: "gold_sjc", count: 0, err: fmt.Errorf("sjc: no valid prices")}
    }
    if err := s.repo.UpsertBatch(ctx, batch); err != nil {
        _ = s.repo.MarkStaleByAssetTypeAndSource(ctx, "gold", "sjc")
        return refreshResult{source: "gold_sjc", count: 0, err: err}
    }
    return refreshResult{source: "gold_sjc", count: len(batch), err: nil}
}
```

Repeat for `refreshGoldDOJI`, `refreshGoldBTMC`, `refreshGoldPNJ` with appropriate source names.

**Step 5: Update RefreshAllPrices to run 7 goroutines in parallel**

```go
func (s *assetPriceService) RefreshAllPrices(ctx context.Context) error {
    results := make(chan refreshResult, 7)
    var wg sync.WaitGroup

    // Existing 3 sources
    wg.Add(3)
    go func() { defer wg.Done(); results <- s.refreshGold(ctx) }()
    go func() { defer wg.Done(); results <- s.refreshSilver(ctx) }()
    go func() { defer wg.Done(); results <- s.refreshCurrency(ctx) }()

    // 4 new gold sources
    wg.Add(4)
    go func() { defer wg.Done(); results <- s.refreshGoldSJC(ctx) }()
    go func() { defer wg.Done(); results <- s.refreshGoldDOJI(ctx) }()
    go func() { defer wg.Done(); results <- s.refreshGoldBTMC(ctx) }()
    go func() { defer wg.Done(); results <- s.refreshGoldPNJ(ctx) }()

    go func() { wg.Wait(); close(results) }()

    // Collect results and build log summary
    var summaryParts []string
    failCount := 0
    for r := range results {
        if r.err != nil {
            summaryParts = append(summaryParts, fmt.Sprintf("%s=FAIL(%v)", r.source, r.err))
            failCount++
        } else {
            summaryParts = append(summaryParts, fmt.Sprintf("%s=OK(%d)", r.source, r.count))
        }
    }
    log.Printf("Price cache refresh: %s", strings.Join(summaryParts, ", "))

    if failCount == 7 {
        return fmt.Errorf("all price sources failed")
    }
    return nil
}
```

**Step 6: Run test to verify it passes**

**Step 7: Commit**
```
feat(asset-price): integrate SJC/DOJI/BTMC/PNJ sources into RefreshAllPrices
```

---

### Task 10: Wire New Clients in DI Providers

**Files:**

- Modify: `src/go-backend/domain/service/services.go` — instantiate 4 new clients in `NewServices`, pass to `NewAssetPriceService`
- Modify: `src/go-backend/domain/service/asset_price_service.go` — update `NewAssetPriceService` constructor to accept new clients

**Security notes:** None — wiring only.

**Step 1: Write the failing test**

```go
func TestNewServices_CreatesAssetPriceServiceWithClients(t *testing.T) {
    // Verify NewServices returns non-nil AssetPrice service
    // (Existing test coverage may already handle this)
}
```

**Step 2: Update constructor signature**

```go
func NewAssetPriceService(
    repo repository.AssetPriceRepository,
    goldSvc GoldPriceService,
    silverSvc SilverPriceService,
    currencySvc CurrencyPriceService,
    sjcClient *sjc.Client,
    dojiClient *doji.Client,
    btmcClient *btmcdirect.Client,
    pnjClient *pnj.Client,
) AssetPriceService
```

**Step 3: Instantiate clients in NewServices**

In `services.go`:
```go
sjcClient := sjc.NewClient()
dojiClient := doji.NewClient()
btmcClient := btmcdirect.NewClient()
pnjClient := pnj.NewClient()

assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice, goldPriceSvc, silverPriceSvc, currencyPriceSvc,
    sjcClient, dojiClient, btmcClient, pnjClient,
)
```

**Step 4: Verify build compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
feat(service): wire SJC/DOJI/BTMC/PNJ clients into AssetPriceService DI
```

---

### Task 11: Update Downstream GetPriceByTypeCode (No Regression)

**Files:**

- Modify: `src/go-backend/domain/service/asset_price_service.go` — ensure `GetPriceByTypeCode` returns waterfall row preferentially
- Test: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** Existing consumers must not break. Waterfall type codes (e.g., "SJC") won't collide with source-prefixed codes (e.g., "SJC_MIENG_1L_10L_1KG") so no actual conflict, but add a defensive sort.

**Step 1: Write the failing test**

```go
func TestGetPriceByTypeCode_PrefersWaterfall(t *testing.T) {
    // Insert two rows: typeCode="SJC" source="waterfall" and typeCode="SJC" source="sjc"
    // Call GetPriceByTypeCode("SJC")
    // Verify returns waterfall row (buy/sell from waterfall source)
}
```

**Step 2: Verify existing behavior**

Since waterfall type codes (e.g., "SJC") and source-prefixed codes (e.g., "SJC_MIENG_1L_10L_1KG") are different strings, `GetPriceByTypeCode("SJC")` will only match the waterfall row. No code change needed unless there's a collision scenario.

**Step 3: Add defensive comment and verify**

If `GetByTypeCodeAndCurrency` already returns first match, add `ORDER BY source ASC` to ensure deterministic ordering (waterfall < sjc alphabetically). Or add a `WHERE source = 'waterfall'` default filter.

**Step 4: Run existing tests**
```bash
cd src/go-backend && go test -short ./domain/service/ -run TestAssetPrice -v
```

**Step 5: Commit**
```
test(asset-price): verify GetPriceByTypeCode no regression with multi-source
```

---

### Task 12: Update Log Summary Format

**Files:**

- Modify: `src/go-backend/domain/service/asset_price_service.go` — already handled in Task 9's RefreshAllPrices

**Security notes:** Log messages must not leak internal error details. Use generic messages.

This task is handled as part of Task 9. The log format will be:
```
Price cache refresh: gold=OK(25), gold_sjc=OK(12), gold_doji=OK(8), gold_btmc=OK(9), gold_pnj=OK(19), silver=OK(6), currency=OK(12)
```

No separate commit needed.

---

### Task 13: Backend Lint & Build Verification

**Files:** None — verification only.

**Steps:**

1. Run linter:
```bash
cd src/go-backend && task ci:backend-lint
```

2. Run all unit tests:
```bash
cd src/go-backend && go test -short ./...
```

3. Fix any lint/build/test failures.

4. Commit fixes if any.

---

### Task 14: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read existing `flow-cross-cutting.md` to find the PriceCacheJob sequence diagram
2. Update the diagram to show 7 parallel fetches:
   ```
   PriceCacheJob ->> AssetPriceService: RefreshAllPrices()
   par Gold Waterfall
       AssetPriceService ->> GoldPriceService: FetchAllPrices()
   and Gold SJC
       AssetPriceService ->> SJC Client: FetchGoldPrices()
   and Gold DOJI
       AssetPriceService ->> DOJI Client: FetchGoldPrices()
   and Gold BTMC
       AssetPriceService ->> BTMC Direct Client: FetchGoldPrices()
   and Gold PNJ
       AssetPriceService ->> PNJ Client: FetchGoldPrices()
   and Silver
       AssetPriceService ->> SilverPriceService: FetchAllPrices()
   and Currency
       AssetPriceService ->> CurrencyPriceService: FetchAllPrices()
   end
   ```
3. Add error path annotations: each source marks stale independently on failure
4. Commit diagram changes

---

## Task Dependency Order

```
Task 0  (C4 diagrams)           — independent, can run first or in parallel
Task 1  (DB migration)          — MUST be first implementation task
Task 2  (MarkStale source)      — depends on Task 1
Task 3  (Set source=waterfall)  — depends on Task 1
Task 8  (Shared sanitizer)      — independent of DB tasks
Task 4  (SJC client)            — depends on Task 8
Task 5  (DOJI client)           — depends on Task 8
Task 6  (BTMC Direct client)    — depends on Task 8
Task 7  (PNJ client)            — depends on Task 8
Task 9  (Service integration)   — depends on Tasks 2, 3, 4, 5, 6, 7
Task 10 (DI wiring)             — depends on Task 9
Task 11 (No regression)         — depends on Task 10
Task 12 (Log format)            — included in Task 9
Task 13 (Lint & build)          — depends on Task 10
Task 14 (Flow diagrams)         — depends on Task 9 (needs to read implemented code)
```

**Parallel-safe groups:**
- Group A: Tasks 0, 8 (independent)
- Group B: Tasks 4, 5, 6, 7 (all depend only on Task 8, no file conflicts)
- Group C: Tasks 2, 3 (both depend on Task 1, modify different sections of asset_price_service.go — sequential within group)
- Sequential: Tasks 9 → 10 → 11 → 13 → 14

## Estimated Data Volume

| Source | Expected Rows | TypeCode Examples |
|--------|--------------|-------------------|
| Waterfall (existing) | ~25 | SJC, BTMC, Doji, Mihong_999, XAUUSD, ... |
| SJC | ~12 | SJC_MIENG_1L_10L_1KG, SJC_5CHI, SJC_NHAN_99_99, ... |
| DOJI | ~8 | DOJI_SJC_BAN_LE, DOJI_NHAN_TRON_9999, ... |
| BTMC | ~9 | BTMC_VRTL, BTMC_SJC, BTMC_NHAN_TRON, ... |
| PNJ | ~19 | PNJ_999_9, PNJ_NHAN_TRON, PNJ_VANG_KIM_BAO, ... |
| **Total new** | **~48** | |

Negligible DB impact — ~48 additional rows in `asset_price`.
