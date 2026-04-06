# Fix Asset Display Prices Same-Value Bug — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix the `assetType` query parameter mismatch so silver and currency price queries return correct data instead of gold prices.
**Spec:** `docs/specs/2026-04-06-fix-asset-display-prices-same-value-bug-spec.md`
**Architecture:** Backend-only fix. The generated API client sends `?asset_type=<value>` (snake_case) but the three `AssetDisplayConfigHandler` methods only read `c.Query("assetType")` (camelCase). Adding a snake_case fallback — already the established pattern in `handlers/investment.go` — resolves the bug without any API, proto, or frontend changes.
**Tech Stack:** Go 1.25, Gin HTTP framework, `testify` for handler tests.

## Security Implementation Notes

- **No new attack surface** — the query param is a string passed to `WHERE asset_type = ?` via GORM parameterized query. Unknown values return empty arrays gracefully.
- **No auth changes** — `GetDisplayPrices` is public; `ListAll` and `ListAvailableTypeCodes` remain behind `AdminMiddleware`.
- **No input sanitization needed** — arbitrary `asset_type` values don't cause errors or leaks; they simply return `[]`.

## Component Reuse Inventory (Frontend Tasks)

No frontend changes. Skip.

## C4 Architecture Diagram Updates

No new components, services, or flows. No C4 diagrams need updating.

## Runtime Flow Diagrams

Simple query-param read fix with no branching change. No flow diagram update needed.

---

## Task 1: Fix `GetDisplayPrices` handler — add snake_case fallback

**Files:**
- Modify: `src/go-backend/handlers/asset_display_config.go` lines 115–118
- Test: `src/go-backend/handlers/asset_display_config_test.go` (add tests near line 268)

**Security notes:** None — the existing GORM parameterized query already protects against injection. The fallback adds no new risk.

**Step 1: Write the failing test**

Add these two test cases to `asset_display_config_test.go` in the `GetDisplayPrices tests` section (after the existing tests, ~line 310):

```go
func TestGetDisplayPrices_SnakeCaseAssetTypeParam(t *testing.T) {
	capturedAssetType := ""
	h := NewAssetDisplayConfigHandler(&mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(ctx context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
			capturedAssetType = assetType
			return []*service.AssetDisplayPriceDTO{}, nil
		},
	})

	// Simulate what the generated client sends: snake_case asset_type=silver
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/public/asset-display-prices?asset_type=silver", nil)
	c.Request = req
	h.GetDisplayPrices(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "silver", capturedAssetType, "snake_case asset_type=silver must be passed through as 'silver'")
}

func TestGetDisplayPrices_SnakeCaseAssetTypeCurrency(t *testing.T) {
	capturedAssetType := ""
	h := NewAssetDisplayConfigHandler(&mockAssetDisplayConfigService{
		getDisplayPricesFunc: func(ctx context.Context, assetType string) ([]*service.AssetDisplayPriceDTO, error) {
			capturedAssetType = assetType
			return []*service.AssetDisplayPriceDTO{}, nil
		},
	})

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/public/asset-display-prices?asset_type=currency", nil)
	c.Request = req
	h.GetDisplayPrices(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "currency", capturedAssetType, "snake_case asset_type=currency must be passed through as 'currency'")
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./handlers/ -run TestGetDisplayPrices_SnakeCaseAssetType -v
```

Expected: both tests fail because `capturedAssetType == "gold"` (default) instead of `"silver"`/`"currency"`.

**Step 3: Apply the fix**

In `src/go-backend/handlers/asset_display_config.go`, replace lines 115–118:

```go
// Before:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = "gold"
}

// After:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
}
if assetType == "" {
    assetType = "gold"
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./handlers/ -run TestGetDisplayPrices_SnakeCaseAssetType -v
```

Expected: PASS — both tests green.

**Step 5: Run all handler tests to check for regressions**

```bash
cd src/go-backend && go test ./handlers/ -v 2>&1 | tail -20
```

Expected: all existing tests still pass.

---

## Task 2: Fix `ListAll` handler — add snake_case fallback

**Files:**
- Modify: `src/go-backend/handlers/asset_display_config.go` lines 149–152
- Test: `src/go-backend/handlers/asset_display_config_test.go`

**Security notes:** `ListAll` is protected by `AdminMiddleware`. The snake_case fallback adds no new access vector.

**Step 1: Write the failing test**

```go
func TestListAll_SnakeCaseAssetTypeParam(t *testing.T) {
	capturedAssetType := ""
	h := NewAssetDisplayConfigHandler(&mockAssetDisplayConfigService{
		listAllFunc: func(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
			capturedAssetType = assetType
			return []*models.AssetDisplayConfig{}, nil
		},
	})

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/asset-display-config?asset_type=silver", nil)
	c.Request = req
	h.ListAll(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "silver", capturedAssetType)
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./handlers/ -run TestListAll_SnakeCaseAssetTypeParam -v
```

**Step 3: Apply the fix**

Replace lines 149–152 in `asset_display_config.go`:

```go
// Before:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = "gold"
}

// After:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
}
if assetType == "" {
    assetType = "gold"
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./handlers/ -run TestListAll_SnakeCaseAssetTypeParam -v
```

---

## Task 3: Fix `ListAvailableTypeCodes` handler — add snake_case fallback

**Files:**
- Modify: `src/go-backend/handlers/asset_display_config.go` lines 354–357
- Test: `src/go-backend/handlers/asset_display_config_test.go`

**Security notes:** Protected by `AdminMiddleware`. Same risk profile as Task 2.

**Step 1: Write the failing test**

```go
func TestListAvailableTypeCodes_SnakeCaseAssetTypeParam(t *testing.T) {
	capturedAssetType := ""
	h := NewAssetDisplayConfigHandler(&mockAssetDisplayConfigService{
		listAvailableTypeCodes: func(ctx context.Context, assetType string) ([]string, error) {
			capturedAssetType = assetType
			return []string{}, nil
		},
	})

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/admin/asset-price-type-codes?asset_type=silver", nil)
	c.Request = req
	h.ListAvailableTypeCodes(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "silver", capturedAssetType)
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./handlers/ -run TestListAvailableTypeCodes_SnakeCaseAssetTypeParam -v
```

**Step 3: Apply the fix**

Replace lines 354–357 in `asset_display_config.go`:

```go
// Before:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = "gold"
}

// After:
assetType := c.Query("assetType")
if assetType == "" {
    assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
}
if assetType == "" {
    assetType = "gold"
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./handlers/ -run TestListAvailableTypeCodes_SnakeCaseAssetTypeParam -v
```

---

## Task 4: Full verification

**Step 1: Run all handler tests**

```bash
cd src/go-backend && go test ./handlers/ -v 2>&1 | grep -E "PASS|FAIL|ok"
```

Expected: all PASS.

**Step 2: Run backend lint**

```bash
cd src/go-backend && task ci:backend-lint
```

Expected: no lint errors.

**Step 3: Live API smoke test**

```bash
# All three should return different asset types:
curl -s "http://localhost:5000/api/v1/public/asset-display-prices?asset_type=gold" | python3 -c "import sys,json; d=json.load(sys.stdin); print('GOLD:', len(d['prices']), 'items:', d['prices'][0]['typeCode'] if d['prices'] else 'none')"
curl -s "http://localhost:5000/api/v1/public/asset-display-prices?asset_type=silver" | python3 -c "import sys,json; d=json.load(sys.stdin); print('SILVER:', len(d['prices']), 'items:', d['prices'][0]['typeCode'] if d['prices'] else 'none')"
curl -s "http://localhost:5000/api/v1/public/asset-display-prices?asset_type=currency" | python3 -c "import sys,json; d=json.load(sys.stdin); print('CURRENCY:', len(d['prices']), 'items:', d['prices'][0]['typeCode'] if d['prices'] else 'none')"
```

Expected:
```
GOLD: 9 items: SJC
SILVER: 9 items: PH_QU_THI_1L
CURRENCY: 13 items: USD
```

**Step 4: Commit**

```
fix(handlers): accept snake_case asset_type query param in asset display config handlers

The generated API client converts camelCase query params to snake_case via
toQueryParams(), sending ?asset_type=silver instead of ?assetType=silver.
The three AssetDisplayConfigHandler methods only read c.Query("assetType"),
so the param was always empty and defaulted to "gold" — causing silver and
currency price tables to display gold prices.

Apply the same camelCase+snake_case dual-read pattern already used in
handlers/investment.go (walletId/wallet_id, typeFilter/type_filter).

Fixes: GetDisplayPrices, ListAll, ListAvailableTypeCodes handlers.
```
