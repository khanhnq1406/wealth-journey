# Fix: System Price Alert Fires for All Asset Codes — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Filter `priceAlertService.doCheckAndAlert` so only type codes enabled in `asset_display_config` are evaluated — preventing alerts for codes the admin has excluded.

**Spec:** `docs/specs/2026-04-03-fix-system-price-alert-shows-alert-for-all-codes-spec.md`

**Architecture:** `priceAlertService` gains a new dependency on `AssetDisplayConfigService`. Before evaluating gold/silver prices, it calls `ListAll(ctx, assetType)` to build an enabled-type-codes set, then filters the prices list. The fix is entirely in the service layer — no schema changes, no API changes, no frontend changes.

**Tech Stack:** Go 1.25, GORM (PostgreSQL), Redis, testify/mock, miniredis

---

## Security Implementation Notes

- **Authentication:** N/A — `PriceAlertJob` is a scheduler job (no HTTP request).
- **Authorization:** N/A — internal service-to-service call only.
- **Input validation:** The only new values processed are hardcoded `"gold"`/`"silver"` literals and `AssetDisplayConfig.TypeCode` strings from the DB (already validated at write time).
- **Data sanitization:** No user input reaches this code path. No new SQL — uses existing GORM-parameterized repository calls.
- **Injection risk:** None. `ListAll` uses GORM parameterized WHERE clause on `assetType` which is a hardcoded literal.

---

## Component Reuse Inventory (Frontend Tasks)

Not applicable — this fix is backend-only with no frontend changes.

---

## C4 Architecture Diagram Updates

Per spec §Architecture Changes (C4):

- **`docs/architecture/c4-component-backend.md`**: Add a dependency arrow from `PriceAlertService` → `AssetDisplayConfigService`.

---

## Runtime Flow Diagram Updates

Per spec §Flow Diagrams to Update:

- **`docs/architecture/flow-cross-cutting.md`**: Update the price alert section to note that enabled type codes are fetched from `asset_display_config` before price evaluation.

---

## Tasks

### Task 0: Update C4 Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`

**Steps:**

1. Read the current L3 backend component diagram.
2. Add a dependency arrow: `PriceAlertService` → `AssetDisplayConfigService` (label: `ListAll(assetType)`).
3. Commit.

---

### Task 1: Add `configSvc` dependency to `priceAlertService` + update constructor + `NewServices` wiring

This is the core structural change. Test first to lock the interface before modifying the implementation.

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go`
- Modify: `src/go-backend/domain/service/services.go` (line 127 — `NewPriceAlertService` call)
- Test: `src/go-backend/domain/service/price_alert_service_test.go`

**Security notes:** `configSvc` uses parameterized queries internally. The new field is an interface — safe for mocking in tests.

**Step 1: Write the failing test**

Add a mock for `AssetDisplayConfigService` in the test file. Verify that the new `NewPriceAlertService` signature compiles and that an existing test (e.g., `TestCheckAndAlert_GoldBelowThreshold`) still wires correctly.

```go
// In price_alert_service_test.go — add mock struct:
type mockPAConfigSvc struct {
    mock.Mock
}

func (m *mockPAConfigSvc) GetDisplayPrices(ctx context.Context, assetType string) ([]*AssetDisplayPriceDTO, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*AssetDisplayPriceDTO), args.Error(1)
}

func (m *mockPAConfigSvc) ListAll(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockPAConfigSvc) Create(ctx context.Context, typeCode, displayName, assetType string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, typeCode, displayName, assetType, displayOrder, enabled, showInInvestment)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockPAConfigSvc) Update(ctx context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, id, displayName, displayOrder, enabled, showInInvestment)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockPAConfigSvc) Delete(ctx context.Context, id int32) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func (m *mockPAConfigSvc) ResolvePrice(ctx context.Context, typeCode, assetType string) (int64, int64, bool, error) {
    args := m.Called(ctx, typeCode, assetType)
    return args.Get(0).(int64), args.Get(1).(int64), args.Bool(2), args.Error(3)
}

func (m *mockPAConfigSvc) ListFetchCodes(ctx context.Context, configID int32) ([]*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, configID)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockPAConfigSvc) CreateFetchCode(ctx context.Context, configID int32, typeCode string, priority int32) (*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, configID, typeCode, priority)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockPAConfigSvc) UpdateFetchCode(ctx context.Context, id int32, priority int32) (*models.AssetConfigFetchCode, error) {
    args := m.Called(ctx, id, priority)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*models.AssetConfigFetchCode), args.Error(1)
}

func (m *mockPAConfigSvc) DeleteFetchCode(ctx context.Context, id int32) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func (m *mockPAConfigSvc) ListForInvestment(ctx context.Context, assetType string) ([]*models.AssetDisplayConfig, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]*models.AssetDisplayConfig), args.Error(1)
}

func (m *mockPAConfigSvc) ListAvailableTypeCodes(ctx context.Context, assetType string) ([]string, error) {
    args := m.Called(ctx, assetType)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).([]string), args.Error(1)
}
```

Update existing `NewPriceAlertService` call in test (line 209 area) to add `configSvc`:

```go
// existing test helper — update signature:
svc := NewPriceAlertService(assetPriceSvc, notifRepo, userRepo, rdb, pushSvc, configSvc)
```

**Step 2: Run test to verify it fails (compilation error)**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestCheckAndAlert 2>&1 | head -20
```

Expected: compilation error — `NewPriceAlertService` still takes 5 args.

**Step 3: Write minimal implementation — add field + update constructor**

In `price_alert_service.go`:

```go
type priceAlertService struct {
    assetPriceSvc AssetPriceService
    configSvc     AssetDisplayConfigService   // NEW
    notifRepo     repository.NotificationRepository
    userRepo      repository.UserRepository
    redisClient   *pkgredis.RedisClient
    pushSvc       PushService
}

func NewPriceAlertService(
    assetPriceSvc AssetPriceService,
    notifRepo repository.NotificationRepository,
    userRepo repository.UserRepository,
    rdb *pkgredis.RedisClient,
    pushSvc PushService,
    configSvc AssetDisplayConfigService,   // NEW parameter
) PriceAlertService {
    return &priceAlertService{
        assetPriceSvc: assetPriceSvc,
        configSvc:     configSvc,
        notifRepo:     notifRepo,
        userRepo:      userRepo,
        redisClient:   rdb,
        pushSvc:       pushSvc,
    }
}
```

Update `services.go` line 127:

```go
priceAlertSvc = NewPriceAlertService(assetPriceSvc, repos.Notification, repos.User, rdb, pushSvc, assetDisplayConfigSvc)
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestCheckAndAlert 2>&1
```

Expected: all existing tests pass.

**Step 5: Build to verify no broken callers**

```bash
cd src/go-backend && go build ./... 2>&1
```

**Step 6: Commit**

```
fix(price-alert): inject AssetDisplayConfigService into priceAlertService constructor
```

---

### Task 2: Implement enabled-code filter in `doCheckAndAlert`

The core filtering logic — called once per asset type before the price evaluation loop.

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service.go` (method `doCheckAndAlert`)
- Test: `src/go-backend/domain/service/price_alert_service_test.go`

**Security notes:** Filter is applied client-side using in-memory `map[string]bool` built from DB data. No user input flows in. Cold-start behavior (empty config → no alerts) is safer than current behavior.

**Step 1: Write the failing tests**

Add two new test cases to the existing test file:

```go
// TestCheckAndAlert_DisabledCodeExcluded verifies that a type code absent or disabled
// in AssetDisplayConfig is NOT evaluated for alerts.
func TestCheckAndAlert_DisabledCodeExcluded(t *testing.T) {
    mr, _ := miniredis.Run()
    defer mr.Close()
    rdb := pkgredis.NewTestClient(mr.Addr())

    assetPriceSvc := &mockPAAssetPriceSvc{}
    notifRepo := &mockPANotifRepo{}
    userRepo := &mockPAUserRepo{}
    configSvc := &mockPAConfigSvc{}
    pushSvc := &mockPAPushSvc{}

    // Gold prices include SJC_1L and SJC_RING — only SJC_1L is enabled in config
    goldPrices := []*AssetPriceDTO{
        {TypeCode: "SJC_1L", Name: "SJC 1 lượng", Buy: 8500000, Sell: 8520000, Currency: "VND", IsStale: false},
        {TypeCode: "SJC_RING", Name: "SJC nhẫn", Buy: 8300000, Sell: 8320000, Currency: "VND", IsStale: false},
    }
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").Return(goldPrices, nil)
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "silver").Return([]*AssetPriceDTO{}, nil)

    // Config: only SJC_1L is enabled
    goldConfigs := []*models.AssetDisplayConfig{
        {TypeCode: "SJC_1L", AssetType: "gold", Enabled: true},
        // SJC_RING is absent from config entirely
    }
    configSvc.On("ListAll", mock.Anything, "gold").Return(goldConfigs, nil)
    configSvc.On("ListAll", mock.Anything, "silver").Return([]*models.AssetDisplayConfig{}, nil)

    svc := NewPriceAlertService(assetPriceSvc, notifRepo, userRepo, rdb, pushSvc, configSvc)

    // Set baselines so checkPrice returns a mover for SJC_1L
    mr.Set("price_alert:baseline:SJC_1L", "8000000")
    // Do NOT set baseline for SJC_RING — it should never be evaluated

    err := svc.CheckAndAlert(context.Background())
    assert.NoError(t, err)

    // SJC_RING should never have its baseline set (it was filtered before evaluation)
    _, err2 := mr.Get("price_alert:baseline:SJC_RING")
    assert.Error(t, err2, "SJC_RING baseline should not be set — code was excluded by config filter")

    assetPriceSvc.AssertExpectations(t)
    configSvc.AssertExpectations(t)
}

// TestCheckAndAlert_ConfigSvcError_SkipsAssetType verifies that if ListAll returns an error,
// the asset type is skipped gracefully (no panic, no partial evaluation).
func TestCheckAndAlert_ConfigSvcError_SkipsAssetType(t *testing.T) {
    mr, _ := miniredis.Run()
    defer mr.Close()
    rdb := pkgredis.NewTestClient(mr.Addr())

    assetPriceSvc := &mockPAAssetPriceSvc{}
    notifRepo := &mockPANotifRepo{}
    userRepo := &mockPAUserRepo{}
    configSvc := &mockPAConfigSvc{}
    pushSvc := &mockPAPushSvc{}

    goldPrices := []*AssetPriceDTO{
        {TypeCode: "SJC_1L", Name: "SJC 1 lượng", Buy: 8500000, Sell: 8520000, Currency: "VND", IsStale: false},
    }
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").Return(goldPrices, nil)
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "silver").Return([]*AssetPriceDTO{}, nil)

    // ListAll returns error for gold
    configSvc.On("ListAll", mock.Anything, "gold").Return(nil, fmt.Errorf("db timeout"))
    configSvc.On("ListAll", mock.Anything, "silver").Return([]*models.AssetDisplayConfig{}, nil)

    svc := NewPriceAlertService(assetPriceSvc, notifRepo, userRepo, rdb, pushSvc, configSvc)

    // Should not panic, should not create any notifications
    err := svc.CheckAndAlert(context.Background())
    assert.NoError(t, err)

    notifRepo.AssertNotCalled(t, "BatchCreate")
    assetPriceSvc.AssertExpectations(t)
    configSvc.AssertExpectations(t)
}

// TestCheckAndAlert_EmptyConfig_NoAlerts verifies that if asset_display_config is empty,
// no alerts fire (safer than the current bug of alerting for everything).
func TestCheckAndAlert_EmptyConfig_NoAlerts(t *testing.T) {
    mr, _ := miniredis.Run()
    defer mr.Close()
    rdb := pkgredis.NewTestClient(mr.Addr())

    assetPriceSvc := &mockPAAssetPriceSvc{}
    notifRepo := &mockPANotifRepo{}
    userRepo := &mockPAUserRepo{}
    configSvc := &mockPAConfigSvc{}
    pushSvc := &mockPAPushSvc{}

    goldPrices := []*AssetPriceDTO{
        {TypeCode: "SJC_1L", Name: "SJC 1 lượng", Buy: 8500000, Sell: 8520000, Currency: "VND", IsStale: false},
    }
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "gold").Return(goldPrices, nil)
    assetPriceSvc.On("GetPricesByAssetType", mock.Anything, "silver").Return([]*AssetPriceDTO{}, nil)

    // Config is empty for both asset types
    configSvc.On("ListAll", mock.Anything, "gold").Return([]*models.AssetDisplayConfig{}, nil)
    configSvc.On("ListAll", mock.Anything, "silver").Return([]*models.AssetDisplayConfig{}, nil)

    svc := NewPriceAlertService(assetPriceSvc, notifRepo, userRepo, rdb, pushSvc, configSvc)
    mr.Set("price_alert:baseline:SJC_1L", "8000000")

    err := svc.CheckAndAlert(context.Background())
    assert.NoError(t, err)

    notifRepo.AssertNotCalled(t, "BatchCreate")
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -short ./domain/service/... -run "TestCheckAndAlert_DisabledCodeExcluded|TestCheckAndAlert_ConfigSvcError|TestCheckAndAlert_EmptyConfig" 2>&1
```

Expected: tests fail (filter not yet implemented).

**Step 3: Write minimal implementation — filter logic in `doCheckAndAlert`**

In `price_alert_service.go`, update `doCheckAndAlert`:

```go
func (s *priceAlertService) doCheckAndAlert(ctx context.Context, force bool) error {
    cfg := LoadPriceAlertConfig(ctx, s.redisClient)

    type categoryMovers struct {
        category string
        movers   []priceMover
    }

    var allCategories []categoryMovers

    // --- Helper: build enabled type codes set from config ---
    buildEnabledSet := func(assetType string) (map[string]bool, bool) {
        configs, err := s.configSvc.ListAll(ctx, assetType)
        if err != nil {
            log.Printf("Price alert: failed to fetch %s display configs: %v — skipping asset type", assetType, err)
            return nil, false
        }
        if len(configs) == 0 {
            log.Printf("Price alert: no enabled configs for %s — skipping (cold-start or unconfigured)", assetType)
            return map[string]bool{}, true
        }
        enabled := make(map[string]bool, len(configs))
        for _, c := range configs {
            if c.Enabled {
                enabled[c.TypeCode] = true
            }
        }
        return enabled, true
    }

    // Fetch gold prices from DB cache
    goldPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")
    if err != nil {
        log.Printf("Price alert: failed to fetch gold prices: %v", err)
    } else {
        enabledGold, ok := buildEnabledSet("gold")
        if ok {
            var goldVND, goldUSD []priceMover
            for _, p := range goldPrices {
                if !enabledGold[p.TypeCode] {
                    continue // filtered: not in admin config or disabled
                }
                if p.IsStale {
                    log.Printf("Price alert: skipping stale gold price for %s", p.TypeCode)
                    continue
                }
                var mover *priceMover
                if force {
                    mover = s.checkPriceForce(ctx, p.TypeCode, p.Buy)
                } else {
                    mover = s.checkPrice(ctx, p.TypeCode, p.Buy)
                }
                if mover == nil {
                    continue
                }
                mover.Name = p.Name
                if p.Currency == "VND" {
                    goldVND = append(goldVND, *mover)
                } else {
                    goldUSD = append(goldUSD, *mover)
                }
            }
            if len(goldVND) > 0 {
                allCategories = append(allCategories, categoryMovers{category: "gold_vnd", movers: goldVND})
            }
            if len(goldUSD) > 0 {
                allCategories = append(allCategories, categoryMovers{category: "gold_usd", movers: goldUSD})
            }
        }
    }

    // Fetch silver prices from DB cache
    silverPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "silver")
    if err != nil {
        log.Printf("Price alert: failed to fetch silver prices: %v", err)
    } else {
        enabledSilver, ok := buildEnabledSet("silver")
        if ok {
            var silverVND, silverUSD []priceMover
            for _, p := range silverPrices {
                if !enabledSilver[p.TypeCode] {
                    continue // filtered: not in admin config or disabled
                }
                if p.IsStale {
                    log.Printf("Price alert: skipping stale silver price for %s", p.TypeCode)
                    continue
                }
                var mover *priceMover
                if force {
                    mover = s.checkPriceForce(ctx, p.TypeCode, p.Buy)
                } else {
                    mover = s.checkPrice(ctx, p.TypeCode, p.Buy)
                }
                if mover == nil {
                    continue
                }
                mover.Name = p.Name
                if p.Currency == "VND" {
                    silverVND = append(silverVND, *mover)
                } else {
                    silverUSD = append(silverUSD, *mover)
                }
            }
            if len(silverVND) > 0 {
                allCategories = append(allCategories, categoryMovers{category: "silver_vnd", movers: silverVND})
            }
            if len(silverUSD) > 0 {
                allCategories = append(allCategories, categoryMovers{category: "silver_usd", movers: silverUSD})
            }
        }
    }

    // Process each category — UNCHANGED from here
    for _, cat := range allCategories {
        // ... (existing logic unchanged)
    }

    return nil
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -short ./domain/service/... -run "TestCheckAndAlert" 2>&1
```

Expected: all `TestCheckAndAlert_*` tests pass.

**Step 5: Run the full backend test suite to verify no regressions**

```bash
cd src/go-backend && go test -short ./... 2>&1
```

**Step 6: Run lint**

```bash
cd src/go-backend && task ci:backend-lint 2>&1
```

Expected: no lint errors.

**Step 7: Commit**

```
fix(price-alert): filter alert evaluation to admin-enabled type codes only
```

---

### Task 3: Update C4 component diagram + runtime flow diagram

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read `docs/architecture/c4-component-backend.md` — add dependency arrow from `PriceAlertService` → `AssetDisplayConfigService` with label `ListAll(assetType)`.
2. Read `docs/architecture/flow-cross-cutting.md` — update the price alert flow section to include the config lookup step before price evaluation.
3. Commit.

**Commit:**
```
docs(architecture): update C4 + flow diagrams for price alert config filter
```

---

### Task 4: Update existing tests to include `configSvc` in all test helpers

Any existing test that calls `NewPriceAlertService` with 5 args must be updated to pass `configSvc` as the 6th arg. Use `mock.Anything` returns that allow all codes (so existing behavior is preserved in these tests).

**Files:**
- Modify: `src/go-backend/domain/service/price_alert_service_test.go`

**Steps:**

1. Search for all `NewPriceAlertService(` calls in the test file.
2. For each: add a `configSvc` mock that returns `ListAll` → all codes enabled (so existing tests are unaffected).
3. Run full test suite:

```bash
cd src/go-backend && go test -short ./domain/service/... 2>&1
```

4. Commit.

**Commit:**
```
test(price-alert): wire configSvc mock into existing test helpers
```

> **Note:** Task 4 is sequenced after Task 2 because Task 2 defines the `mockPAConfigSvc` type. However, the new mock struct from Task 1/2 should be added to the test file in that task — Task 4 just wires it into the pre-existing test constructors.

---

## Task Ordering

| Order | Task | Reason |
|-------|------|--------|
| 1 | Task 1: Inject `configSvc` dependency | Establishes new constructor signature — everything depends on this |
| 2 | Task 2: Implement filter logic + new tests | Core bug fix + verification |
| 3 | Task 4: Update existing tests | Wire mock into pre-existing test helpers (after mock type is defined) |
| 4 | Task 3: Update diagrams | Documentation — can run in parallel with Task 4 but after Task 2 completes |

---

## Edge Cases Verified by Tests

| Edge Case | Test | Expected Behavior |
|-----------|------|-------------------|
| TypeCode in `asset_price` but absent from config | `TestCheckAndAlert_DisabledCodeExcluded` | Excluded from evaluation; baseline never set |
| `ListAll` returns error | `TestCheckAndAlert_ConfigSvcError_SkipsAssetType` | Asset type skipped; no panic; no partial alerts |
| Config table empty | `TestCheckAndAlert_EmptyConfig_NoAlerts` | No alerts fire; warning logged |
| TypeCode enabled in config | Covered by existing tests (after mock wired to return all enabled) | Evaluated as before |
| Force mode | Covered by existing `ForceCheckAndAlert` tests (after mock wired) | Same filter applied; force mode behavior unchanged |

---

## Success Criteria

- [ ] All existing `TestCheckAndAlert_*` tests pass
- [ ] `TestCheckAndAlert_DisabledCodeExcluded` passes — disabled codes excluded before baseline is set
- [ ] `TestCheckAndAlert_ConfigSvcError_SkipsAssetType` passes — error case handled gracefully
- [ ] `TestCheckAndAlert_EmptyConfig_NoAlerts` passes — cold-start behavior correct
- [ ] `go build ./...` succeeds — no compilation errors
- [ ] `task ci:backend-lint` passes — no depguard violations
- [ ] C4 diagram updated with new dependency arrow
- [ ] Runtime flow diagram updated
