# Price Alert Symbol/TypeCode Mismatch — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `UserPriceAlertService` to resolve gold/silver prices via `AssetDisplayConfigService.ResolvePrice` (fetch-code bridge) instead of direct `asset_price.TypeCode` lookup.

**Spec:** `docs/specs/2026-04-07-price-alert-symbol-mismatch-spec.md`

**Architecture:** The fix is entirely in the backend service layer. `UserPriceAlertService` currently validates symbols and evaluates prices against `asset_price.TypeCode` directly, bypassing the fetch-code bridge. We inject `AssetDisplayConfigService` as a new constructor dependency and replace the two buggy code paths with `ResolvePrice` calls. No schema changes, no proto changes, no frontend changes.

**Tech Stack:** Go 1.25, Gin, GORM, testify/mock

---

## Security Implementation Notes

- **Authentication:** No change — all alert CRUD operations already go through `AuthMiddleware`; user_id injected from JWT token.
- **Authorization:** No change — `GetByIDForUser` enforces ownership; `EvaluateAlerts` runs in scheduler with no user input.
- **Input validation:** `symbol` pattern and length validation unchanged. Error message updated per T-4 (no internal type codes exposed).
- **Data sanitization:** `ResolvePrice` is read-only on public price data; no user-controlled input flows into DB writes via this path.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend changes for this fix.

---

## C4 Architecture Diagram Updates

Update `docs/architecture/c4-component-backend.md` to add dependency arrow:
- `UserPriceAlertService` → `AssetDisplayConfigService` (new)

---

## Runtime Flow Diagrams

Update `docs/architecture/flow-investment.md` if it contains a "User Price Alert Evaluation" sequence — replace the `goldByCode` map lookup path with `AssetDisplayConfigService.ResolvePrice`.

**Skip if:** The flow diagram does not yet have an alert evaluation sequence (no regression on non-existent content).

---

## Task 0: Update C4 Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`

**Step 1: Find and update the UserPriceAlertService component entry**

In the C4 L3 backend diagram, add a `Rel` (or equivalent) from `UserPriceAlertService` to `AssetDisplayConfigService`.

Locate the existing `UserPriceAlertService` component and add dependency on `AssetDisplayConfigService`.

**Step 2: Commit**

```
git add docs/architecture/c4-component-backend.md
git commit -m "docs(c4): add UserPriceAlertService → AssetDisplayConfigService dependency"
```

---

## Task 1: Add `AssetDisplayConfigService` to `UserPriceAlertService` struct and constructor

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go` (lines 38–65)
- Modify: `src/go-backend/domain/service/services.go` (lines 133–144)
- Modify: `src/go-backend/domain/service/user_price_alert_service_test.go` (lines 215–240 — `newTestAlertService` helper)

**Security notes:** Constructor injection per ADR-002. No circular dependency: `AssetDisplayConfigService` does not reference `UserPriceAlertService`.

**Step 1: Write the failing test**

In `user_price_alert_service_test.go`, add a new test `TestCreateAlert_GoldWithDisplayConfig_Success` that:
1. Sets up a `mockAssetDisplayConfigSvc` (new mock — see below)
2. Calls `newTestAlertService` with this mock as the new 4th parameter
3. Expects `ResolvePrice` to be called with `("SJL1L10", "gold")` and return `(9500000000, 9600000000, false, nil)`
4. Expects the alert to be created successfully with `currentPriceAtCreation = 9500000000` (buy side)

The test must fail because `userPriceAlertService` struct doesn't have `displayConfigSvc` yet.

```go
// In user_price_alert_service_test.go

// --- Mock: AssetDisplayConfigService (alert-scope) ---

type mockAlertDisplayConfigSvc struct {
    mock.Mock
}

func (m *mockAlertDisplayConfigSvc) GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*AssetDisplayPriceDTO), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, typeCode, displayName, assetType, displayOrder, enabled, showInInvestment)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, id, displayName, displayOrder, enabled, showInInvestment)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) Delete(ctx context.Context, id int32) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func (m *mockAlertDisplayConfigSvc) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
    args := m.Called(ctx, typeCode, assetType)
    return int64(args.Int(0)), int64(args.Int(1)), args.Bool(2), args.Error(3)
}

func (m *mockAlertDisplayConfigSvc) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, configID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, configID, typeCode, priority)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, id, priority)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) DeleteFetchCode(ctx context.Context, id int32) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func (m *mockAlertDisplayConfigSvc) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]string), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(map[string]*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockAlertDisplayConfigSvc) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetDisplayConfig), args.Error(1)
}
```

Also add `TestCreateAlert_GoldWithDisplayConfig_Success`:

```go
func TestCreateAlert_GoldWithDisplayConfig_Success(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}
    repo.On("CountActiveByUserID", mock.Anything, int32(1)).Return(0, nil)
    repo.On("Create", mock.Anything, mock.Anything).Return(nil)
    // ResolvePrice returns fresh buy=9_500_000_000, sell=9_600_000_000
    displayConfigSvc.On("ResolvePrice", mock.Anything, "SJL1L10", "gold").
        Return(9500000000, 9600000000, false, nil)

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc)
    resp, err := svc.CreateAlert(context.Background(), 1, validGoldCreateReq())

    require.NoError(t, err)
    require.NotNil(t, resp)
    assert.True(t, resp.Success)
    assert.Equal(t, int64(9500000000), resp.Alert.CurrentPriceAtCreation,
        "should use resolved buy price from ResolvePrice")
    displayConfigSvc.AssertExpectations(t)
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestCreateAlert_GoldWithDisplayConfig_Success ./domain/service/... 2>&1 | head -20
```

Expected: compile error — `displayConfigSvc` field not found or `newTestAlertServiceWithDisplayConfig` not defined.

**Step 3: Write minimal implementation**

In `user_price_alert_service.go`:

```go
// userPriceAlertService implements UserPriceAlertService.
type userPriceAlertService struct {
    alertRepo         repository.UserPriceAlertRepository
    assetPriceSvc     AssetPriceService
    marketDataSvc     MarketDataService
    displayConfigSvc  AssetDisplayConfigService  // NEW
    notifRepo         repository.NotificationRepository
    pushSvc           PushService
    rdb               *pkgredis.RedisClient
}

// NewUserPriceAlertService creates a new UserPriceAlertService.
func NewUserPriceAlertService(
    alertRepo repository.UserPriceAlertRepository,
    assetPriceSvc AssetPriceService,
    marketDataSvc MarketDataService,
    displayConfigSvc AssetDisplayConfigService,  // NEW
    notifRepo repository.NotificationRepository,
    pushSvc PushService,
    rdb *pkgredis.RedisClient,
) UserPriceAlertService {
    return &userPriceAlertService{
        alertRepo:        alertRepo,
        assetPriceSvc:    assetPriceSvc,
        marketDataSvc:    marketDataSvc,
        displayConfigSvc: displayConfigSvc,  // NEW
        notifRepo:        notifRepo,
        pushSvc:          pushSvc,
        rdb:              rdb,
    }
}
```

Update `newTestAlertService` helper in test file to accept the new param and update existing callers:

```go
// newTestAlertServiceWithDisplayConfig creates a UserPriceAlertService backed by the provided mocks.
func newTestAlertServiceWithDisplayConfig(
    alertRepo *mockUserPriceAlertRepo,
    assetPriceSvc AssetPriceService,
    marketSvc MarketDataService,
    displayConfigSvc AssetDisplayConfigService,
) UserPriceAlertService {
    ap := assetPriceSvc
    mkt := marketSvc
    if ap == nil {
        ap = &mockAlertAssetPriceSvc{}
    }
    if mkt == nil {
        mkt = &mockAlertMarketDataSvc{}
    }
    if displayConfigSvc == nil {
        displayConfigSvc = &mockAlertDisplayConfigSvc{}
    }
    return &userPriceAlertService{
        alertRepo:        alertRepo,
        assetPriceSvc:    ap,
        marketDataSvc:    mkt,
        displayConfigSvc: displayConfigSvc,
        notifRepo:        &mockAlertNotifRepo{},
        pushSvc:          &mockAlertPushSvc{},
        rdb:              nil,
    }
}
```

Update existing `newTestAlertService` to delegate:

```go
func newTestAlertService(
    alertRepo *mockUserPriceAlertRepo,
    assetPriceSvc AssetPriceService,
    marketSvc MarketDataService,
) UserPriceAlertService {
    return newTestAlertServiceWithDisplayConfig(alertRepo, assetPriceSvc, marketSvc, nil)
}
```

Update `services.go` to pass `assetDisplayConfigSvc` to `NewUserPriceAlertService` (Task 3 will wire this properly).

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestCreateAlert_GoldWithDisplayConfig_Success ./domain/service/... -v 2>&1 | tail -10
```

Expected: `PASS`

**Step 5: Commit**

```bash
git add src/go-backend/domain/service/user_price_alert_service.go \
        src/go-backend/domain/service/user_price_alert_service_test.go
git commit -m "feat(price-alert): add AssetDisplayConfigService dependency to UserPriceAlertService"
```

---

## Task 2: Fix Bug 1 — `CreateAlert` uses `ResolvePrice` instead of `GetPriceByTypeCode`

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go` (lines 149–173, `CreateAlert`)

**Security notes:** Error message updated to not expose internal type codes (T-4 mitigation). If `displayConfigSvc` is nil (Redis disabled), fall back to existing `assetPriceSvc.GetPriceByTypeCode` for backward compatibility.

**Step 1: Write the failing tests**

Add three tests in `user_price_alert_service_test.go`:

```go
// TestCreateAlert_GoldWithDisplayConfig_StalePrice verifies alert is created even with stale price.
func TestCreateAlert_GoldWithDisplayConfig_StalePrice(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}
    repo.On("CountActiveByUserID", mock.Anything, int32(1)).Return(0, nil)
    repo.On("Create", mock.Anything, mock.Anything).Return(nil)
    // ResolvePrice returns stale price
    displayConfigSvc.On("ResolvePrice", mock.Anything, "SJL1L10", "gold").
        Return(9500000000, 9600000000, true, nil)

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc)
    resp, err := svc.CreateAlert(context.Background(), 1, validGoldCreateReq())

    require.NoError(t, err, "stale price should not block alert creation")
    require.NotNil(t, resp)
    assert.True(t, resp.Success)
    // With stale price, currentPrice stored is 0 (existing spec: non-stale only)
    // OR store stale price — spec says: "alert is still created with the stale price"
    // So currentPriceAtCreation should be the stale buy price.
    assert.Equal(t, int64(9500000000), resp.Alert.CurrentPriceAtCreation)
}

// TestCreateAlert_GoldWithDisplayConfig_UnknownSymbol verifies unknown symbol returns clear error.
func TestCreateAlert_GoldWithDisplayConfig_UnknownSymbol(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}
    repo.On("CountActiveByUserID", mock.Anything, int32(1)).Return(0, nil)
    // ResolvePrice returns NotFoundError
    displayConfigSvc.On("ResolvePrice", mock.Anything, "UNKNOWN_SYMBOL", "gold").
        Return(0, 0, false, apperrors.NewNotFoundError("asset display config for type_code=UNKNOWN_SYMBOL"))

    req := validGoldCreateReq()
    req.Symbol = "UNKNOWN_SYMBOL"

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc)
    _, err := svc.CreateAlert(context.Background(), 1, req)

    require.Error(t, err)
    var valErr *apperrors.ValidationError
    assert.ErrorAs(t, err, &valErr)
    // Error message should NOT expose internal type codes
    assert.NotContains(t, err.Error(), "SJ9999", "must not expose internal codes")
    assert.NotContains(t, err.Error(), "DOHCML", "must not expose internal codes")
}

// TestCreateAlert_SJCTuDo_WithDisplayConfig_Success verifies "SJC Tự Do" works via fetch code bridge.
func TestCreateAlert_SJCTuDo_WithDisplayConfig_Success(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}
    repo.On("CountActiveByUserID", mock.Anything, int32(1)).Return(0, nil)
    repo.On("Create", mock.Anything, mock.Anything).Return(nil)
    // "SJC Tự Do" display config resolves to asset_price via fetch codes
    displayConfigSvc.On("ResolvePrice", mock.Anything, "SJC Tự Do", "gold").
        Return(int64(8800000000), int64(8900000000), false, nil)

    req := validGoldCreateReq()
    req.Symbol = "SJC Tự Do"

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc)
    resp, err := svc.CreateAlert(context.Background(), 1, req)

    require.NoError(t, err)
    assert.True(t, resp.Success)
    assert.Equal(t, int64(8800000000), resp.Alert.CurrentPriceAtCreation)
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestCreateAlert_Gold|TestCreateAlert_SJC" ./domain/service/... 2>&1 | head -30
```

Expected: compilation errors or `ResolvePrice` not called (wrong path still uses `GetPriceByTypeCode`).

**Step 3: Write minimal implementation**

Replace the buggy block in `CreateAlert` (lines ~149–173):

```go
// For gold/silver, validate that symbol matches a known display config TypeCode
// and resolve current price via fetch-code bridge (AssetDisplayConfigService.ResolvePrice).
var currentPrice int64
if gold.IsGoldType(req.AssetType) || silver.IsSilverType(req.AssetType) {
    assetTypeName := assetTypeToString(req.AssetType)
    validateCtx, validateCancel := context.WithTimeout(ctx, alertPriceFetchTimeout)
    buy, sell, isStale, resolveErr := s.displayConfigSvc.ResolvePrice(validateCtx, symbol, assetTypeName)
    validateCancel()
    if resolveErr != nil {
        return nil, apperrors.NewValidationError(
            fmt.Sprintf("asset type '%s' is not available or has no current price data", symbol),
        )
    }
    // Store current price even if stale (non-fatal; alert creation proceeds).
    if priceSide == "sell" {
        currentPrice = sell
    } else {
        currentPrice = buy
    }
    _ = isStale // stale is non-fatal for creation
} else {
    // Market assets (stocks, crypto): fetch best-effort; failure does not block creation
    currentPrice = s.fetchCurrentPrice(ctx, symbol, currency, req.AssetType, priceSide)
}
```

Add the `assetTypeToString` helper (or use existing logic):

```go
// assetTypeToString returns the asset type name string for use with AssetDisplayConfigService.
// Returns "gold" for gold types, "silver" for silver types.
func assetTypeToString(t v1.InvestmentType) string {
    if gold.IsGoldType(t) {
        return "gold"
    }
    if silver.IsSilverType(t) {
        return "silver"
    }
    return ""
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -run "TestCreateAlert_Gold|TestCreateAlert_SJC" ./domain/service/... -v 2>&1 | tail -20
```

Expected: all three new tests `PASS`.

**Step 5: Run full suite to check no regression**

```bash
cd src/go-backend && go test ./domain/service/... -v 2>&1 | grep -E "PASS|FAIL|---"
```

**Step 6: Commit**

```bash
git add src/go-backend/domain/service/user_price_alert_service.go \
        src/go-backend/domain/service/user_price_alert_service_test.go
git commit -m "fix(price-alert): use ResolvePrice for gold/silver alert creation validation"
```

---

## Task 3: Fix Bug 2 — `fetchPricesForAlerts` uses `ResolvePrice` for gold/silver lookup

**Files:**
- Modify: `src/go-backend/domain/service/user_price_alert_service.go` (lines 557–658, `fetchPricesForAlerts`)

**Non-functional requirement:** Pre-load `asset_price` rows once per asset type per evaluation cycle; pass a pre-loaded price slice to a resolution helper to avoid N individual DB calls.

**Security notes:** Individual alert failures are isolated (log + skip) — no error propagates to abort the batch.

**Step 1: Write the failing tests**

Add two tests:

```go
// TestFetchPricesForAlerts_GoldByDisplayConfig_Success verifies gold alerts with display TypeCode
// get their price resolved via AssetDisplayConfigService.ResolvePrice.
func TestFetchPricesForAlerts_GoldByDisplayConfig_Success(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}

    // Alert with display config TypeCode (not raw asset_price.TypeCode)
    alert := &models.UserPriceAlert{
        ID:        1,
        UserID:    1,
        Symbol:    "SJC Tự Do",
        AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
        PriceSide: "buy",
        Status:    "active",
    }

    // ResolvePrice should be called for "SJC Tự Do"
    displayConfigSvc.On("ResolvePrice", mock.Anything, "SJC Tự Do", "gold").
        Return(int64(8800000000), int64(8900000000), false, nil)

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc).(*userPriceAlertService)
    priceMap := svc.fetchPricesForAlerts(context.Background(), []*models.UserPriceAlert{alert})

    key := "SJC Tự Do|buy"
    price, ok := priceMap[key]
    assert.True(t, ok, "price map should contain the alert symbol")
    assert.Equal(t, int64(8800000000), price)
    displayConfigSvc.AssertExpectations(t)
}

// TestFetchPricesForAlerts_GoldResolveFails_AlertSkipped verifies that when ResolvePrice fails,
// the alert is absent from the price map (skipped) without aborting.
func TestFetchPricesForAlerts_GoldResolveFails_AlertSkipped(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}

    alert := &models.UserPriceAlert{
        ID:        2,
        UserID:    1,
        Symbol:    "OLD_INTERNAL_CODE",
        AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
        PriceSide: "sell",
        Status:    "active",
    }

    // ResolvePrice fails (old symbol, no display config)
    displayConfigSvc.On("ResolvePrice", mock.Anything, "OLD_INTERNAL_CODE", "gold").
        Return(int64(0), int64(0), false, apperrors.NewNotFoundError("no display config"))

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc).(*userPriceAlertService)

    var logBuf bytes.Buffer
    log.SetOutput(&logBuf)
    defer log.SetOutput(os.Stderr)

    priceMap := svc.fetchPricesForAlerts(context.Background(), []*models.UserPriceAlert{alert})

    _, ok := priceMap["OLD_INTERNAL_CODE|sell"]
    assert.False(t, ok, "failed resolution should result in absent entry (alert skipped)")
    assert.Contains(t, logBuf.String(), "OLD_INTERNAL_CODE", "should log the skipped symbol")
}

// TestFetchPricesForAlerts_SJCDirectMatch_NoRegression verifies existing alerts with symbol="SJC"
// (which matches both display config TypeCode and asset_price.TypeCode) still work.
func TestFetchPricesForAlerts_SJCDirectMatch_NoRegression(t *testing.T) {
    repo := &mockUserPriceAlertRepo{}
    displayConfigSvc := &mockAlertDisplayConfigSvc{}

    alert := &models.UserPriceAlert{
        ID:        3,
        UserID:    1,
        Symbol:    "SJC",
        AssetType: int32(v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND),
        PriceSide: "buy",
        Status:    "active",
    }

    displayConfigSvc.On("ResolvePrice", mock.Anything, "SJC", "gold").
        Return(int64(9200000000), int64(9300000000), false, nil)

    svc := newTestAlertServiceWithDisplayConfig(repo, nil, nil, displayConfigSvc).(*userPriceAlertService)
    priceMap := svc.fetchPricesForAlerts(context.Background(), []*models.UserPriceAlert{alert})

    price, ok := priceMap["SJC|buy"]
    assert.True(t, ok)
    assert.Equal(t, int64(9200000000), price)
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestFetchPricesForAlerts" ./domain/service/... 2>&1 | head -30
```

Expected: `FAIL` — `fetchPricesForAlerts` still uses `goldByCode[a.Symbol]` (direct lookup).

**Step 3: Write minimal implementation**

Replace the gold/silver sections of `fetchPricesForAlerts`. The key insight: instead of building a `goldByCode` map keyed by `asset_price.TypeCode` and doing direct lookup, we call `displayConfigSvc.ResolvePrice(symbol, assetType)` per gold/silver alert.

Performance note per spec NFR: `ResolvePrice` internally does `assetPriceRepo.ListByAssetType` which is a single DB scan. To avoid N scans for N gold alerts, we refactor to call `ResolvePrice` directly (it already does a single `ListByAssetType` internally — but if there are 10 gold alerts, that's 10 DB calls). A better approach: for each gold alert, call `ResolvePrice` but allow the implementation to be cached within the same `fetchPricesForAlerts` call.

Given the spec NFR says "a single batch fetch per asset type is preferable", the implementation should:
1. Still call `GetPricesByAssetType` once (for the pre-loaded slice)
2. Call `ResolvePrice` per alert (which will re-use the in-memory batch internally if we can pass it)

Since `ResolvePrice` does its own `ListByAssetType` DB call, the most practical approach without refactoring `ResolvePrice`'s signature is:
- Accept the small overhead of per-alert `ResolvePrice` calls (each is a single indexed DB scan)
- The evaluation runs every 15 min with at most 30 active alerts per user × N users

Replace the gold population loop with:

```go
// Populate price map for each gold/silver alert via ResolvePrice (fetch-code bridge)
for _, a := range alerts {
    key := a.Symbol + "|" + a.PriceSide
    at := v1.InvestmentType(a.AssetType)

    var assetTypeName string
    switch {
    case gold.IsGoldType(at):
        assetTypeName = "gold"
    case silver.IsSilverType(at):
        assetTypeName = "silver"
    default:
        continue // market assets handled separately below
    }

    if s.displayConfigSvc == nil {
        continue
    }

    buy, sell, isStale, resolveErr := s.displayConfigSvc.ResolvePrice(ctx, a.Symbol, assetTypeName)
    if resolveErr != nil {
        log.Printf("Warning: fetchPricesForAlerts: ResolvePrice failed for alert %d symbol=%s: %v", a.ID, a.Symbol, resolveErr)
        continue
    }
    if isStale {
        log.Printf("Warning: fetchPricesForAlerts: stale price for alert %d symbol=%s — skipping evaluation", a.ID, a.Symbol)
        continue
    }

    if a.PriceSide == "sell" {
        priceMap[key] = sell
    } else {
        priceMap[key] = buy
    }
}
```

Remove the old `hasGold`, `hasSilver`, `goldByCode`, `silverByCode` section for the alert population loop (keep it only if `displayConfigSvc == nil` as a fallback). Actually, clean approach: remove the old `goldByCode`/`silverByCode` map building entirely; the new loop handles all gold/silver alerts.

The new `fetchPricesForAlerts` structure:
1. Separate alerts by type (gold/silver vs market) — still needed for market alerts
2. For gold/silver: call `ResolvePrice` per alert
3. For market: call `marketDataSvc.GetPrice` per alert (unchanged)

Remove `hasGold`, `hasSilver`, `goldByCode`, `silverByCode` variables as they are no longer used.

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -run "TestFetchPricesForAlerts" ./domain/service/... -v 2>&1 | tail -20
```

Expected: all three tests `PASS`.

**Step 5: Run full service test suite**

```bash
cd src/go-backend && go test ./domain/service/... -v 2>&1 | grep -E "PASS|FAIL|---" | head -40
```

**Step 6: Commit**

```bash
git add src/go-backend/domain/service/user_price_alert_service.go \
        src/go-backend/domain/service/user_price_alert_service_test.go
git commit -m "fix(price-alert): use ResolvePrice for gold/silver alert evaluation (fixes silent skip)"
```

---

## Task 4: Wire `AssetDisplayConfigService` into `NewUserPriceAlertService` in DI

**Files:**
- Modify: `src/go-backend/domain/service/services.go` (lines 133–144)

**Step 1: Write the failing test (build check)**

There is no unit test for `NewServices` directly. The "test" here is that the code compiles — verify the existing build passes before the change, then verify it still compiles after.

```bash
cd src/go-backend && go build ./... 2>&1
```

Expected before: `PASS` (current code compiles but `assetDisplayConfigSvc` not passed yet from Task 1).

Actually Task 1 already changed the constructor signature, so the code won't compile until this task wires it. **Task 4 must follow Task 1 sequentially.**

**Step 2: Current state**

After Task 1, `NewUserPriceAlertService` requires `displayConfigSvc` as parameter. `services.go` is calling it without this parameter → build fails.

**Step 3: Write minimal implementation**

In `services.go`, update the `NewUserPriceAlertService` call to pass `assetDisplayConfigSvc`:

```go
// Phase 1 (cont.): UserPriceAlertService — depends on alert repo, asset price DB cache,
// market data, display config service (for fetch-code price resolution), notification repo,
// push service, Redis.
var userPriceAlertSvc UserPriceAlertService
if rdb != nil {
    userPriceAlertSvc = NewUserPriceAlertService(
        repos.UserPriceAlert,
        assetPriceSvc,
        marketDataSvc,
        assetDisplayConfigSvc,  // NEW: inject display config service
        repos.Notification,
        pushSvc,
        rdb,
    )
}
```

Note: `assetDisplayConfigSvc` is created earlier in `NewServices` (line ~170 in current file). Verify it is initialized before this call.

**Step 4: Verify build passes**

```bash
cd src/go-backend && go build ./... 2>&1
```

Expected: no errors.

**Step 5: Run full backend tests**

```bash
cd src/go-backend && go test -short ./... 2>&1 | grep -E "ok|FAIL"
```

**Step 6: Run CI lint**

```bash
cd src/go-backend && task ci:backend-lint 2>&1 | tail -20
```

**Step 7: Commit**

```bash
git add src/go-backend/domain/service/services.go
git commit -m "fix(price-alert): wire AssetDisplayConfigService into UserPriceAlertService DI"
```

---

## Task 5: Update runtime flow diagram

**Files:**
- Modify: `docs/architecture/flow-investment.md` (if alert evaluation sequence exists)

**Step 1: Read the flow diagram**

```bash
# Check if flow-investment.md has alert evaluation section
grep -n "price_alert\|EvaluateAlerts\|UserPriceAlert" docs/architecture/flow-investment.md
```

**Step 2: If section exists, update**

Replace `goldByCode[alert.Symbol]` lookup path in the sequence diagram with:

```
UserPriceAlertService ->> AssetDisplayConfigService: ResolvePrice(symbol, assetType)
AssetDisplayConfigService ->> AssetConfigFetchCodeRepository: ListByConfigID(configID)
AssetDisplayConfigService ->> AssetPriceRepository: ListByAssetType(assetType)
AssetDisplayConfigService -->> UserPriceAlertService: buy, sell, isStale
```

**Step 3: Commit (only if changed)**

```bash
git add docs/architecture/flow-investment.md
git commit -m "docs(flow): update alert evaluation to show ResolvePrice path"
```

---

## Task 6: Run full CI + E2E verification

**Step 1: Run backend CI**

```bash
cd src/go-backend && task ci:backend-lint 2>&1 | tail -10
cd src/go-backend && go test -short ./... 2>&1 | grep -E "ok|FAIL"
```

**Step 2: Run E2E tests**

```bash
cd src/wj-client && npx playwright test tests/e2e/price-alerts-settings-flow.spec.ts --reporter=list 2>&1
```

Expected: all existing tests pass (no frontend changes, this confirms no regression).

**Step 3: Final summary**

Both bugs fixed:
- Bug 1: `CreateAlert` now calls `ResolvePrice` → `"SJC Tự Do"` creates successfully
- Bug 2: `fetchPricesForAlerts` now calls `ResolvePrice` → alerts with display TypeCode are evaluated

---

## Implementation Order

| Task | Dependency | Parallel-safe? |
|------|------------|----------------|
| 0 — C4 diagram | none | yes |
| 1 — Add `displayConfigSvc` to struct/constructor | none | no (required by 2, 3, 4) |
| 2 — Fix `CreateAlert` | Task 1 done | yes with 3 |
| 3 — Fix `fetchPricesForAlerts` | Task 1 done | yes with 2 |
| 4 — Wire DI in `services.go` | Task 1 done | must be after 1, before 6 |
| 5 — Flow diagram | none | yes |
| 6 — CI + E2E | Tasks 1–5 done | last |

**Recommended execution order:** 0 + 5 in parallel → 1 → 2 + 3 in parallel → 4 → 6
