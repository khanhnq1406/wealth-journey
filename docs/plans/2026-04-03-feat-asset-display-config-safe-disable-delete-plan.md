# Asset Display Config Safe Disable/Delete Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Guard `AssetDisplayConfigService.Update` (when `enabled` flips true→false) and `Delete` against disabling or deleting a config that active investments depend on.

**Spec:** `docs/specs/2026-04-03-feat-asset-display-config-safe-disable-delete-spec.md`

**Architecture:** Pure service-layer guard — no new handlers, routes, or protobuf changes. Adds `CountBySymbol` to `InvestmentRepository` (interface + impl), then injects `InvestmentRepository` into `AssetDisplayConfigService` which calls the guard before executing disable/delete. All existing callers and response shapes are unchanged.

**Tech Stack:** Go 1.25, GORM, Gin, sqlmock (tests), testify

---

## Security Implementation Notes

- **Authentication/Authorization:** Both `PUT` and `DELETE` endpoints already require `AuthMiddleware` + `AdminMiddleware`. No changes needed.
- **Input validation:** `id` path param is parsed to `int32` by the handler; `GetByID` returns 404 if not found. No new inputs introduced.
- **Data sanitization:** `CountBySymbol` uses a GORM parameterized query (`WHERE symbol = ?`) — no SQL injection risk.
- **Error messages:** Error reveals only count + TypeCode (market symbol) — appropriate for admin context, not sensitive to users.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend changes required for this feature.

---

## C4 Architecture Diagram Updates

Per spec: no structural changes — no new component is added. No diagram update needed.

---

## Runtime Flow Diagram Updates

Per spec: create `docs/architecture/flow-admin.md` with a flowchart for the disable/delete guard decision logic.

---

### Task 0: Create Runtime Flow Diagram

**Files:**

- Create: `docs/architecture/flow-admin.md`
- Modify: `docs/architecture/README.md` (add new file to Dynamic Behavior Diagrams table)

**Steps:**

1. Create `flow-admin.md` with a `flowchart TD` showing:
   - Admin calls Disable (PUT enabled=false) or Delete
   - Fetch config by ID → 404 if not found
   - Count active investments by TypeCode
   - If count > 0 → return 400 with "Cannot disable/delete: N active investment(s) use <TypeCode>"
   - If count = 0 → proceed with update/soft-delete
2. Update `docs/architecture/README.md` to add `flow-admin.md` row in the Dynamic Behavior Diagrams table.
3. Commit.

**No test required** — documentation-only task.

---

### Task 1: Add `CountBySymbol` to `InvestmentRepository` Interface

**Files:**

- Modify: `src/go-backend/domain/repository/investment_repository.go` (interface + `ListOptions` if needed)

**Security notes:** New interface method only — no DB access here.

**Step 1: Add method to interface**

Add to `InvestmentRepository` interface (after `Delete`):

```go
// CountBySymbol returns the count of non-deleted investments where symbol = the given value.
// Uses a SQL COUNT(*) query with the GORM soft-delete scope applied automatically.
CountBySymbol(ctx context.Context, symbol string) (int64, error)
```

**Step 2: Verify compilation (no test needed for interface change)**

```bash
cd src/go-backend && go build ./domain/repository/...
```

Expected: no errors (the impl doesn't satisfy the interface yet — will be red until Task 2).

**Step 3: Commit**

```
feat(repository): add CountBySymbol to InvestmentRepository interface
```

---

### Task 2: Implement `CountBySymbol` in `investmentRepository`

**Files:**

- Modify: `src/go-backend/domain/repository/investment_repository_impl.go` (add method)
- Modify: `src/go-backend/domain/repository/investment_repository_impl_test.go` (add test)

**Security notes:** GORM parameterized query prevents SQL injection. Soft-delete scope applied automatically by GORM.

**Step 1: Write the failing test**

Add to `investment_repository_impl_test.go`:

```go
func TestInvestmentRepository_CountBySymbol(t *testing.T) {
    db, mock, database := setupMockDB(t)
    defer func() {
        sqlDB, _ := db.DB()
        _ = sqlDB.Close()
    }()

    repo := NewInvestmentRepository(database)
    ctx := context.Background()

    // Expect COUNT query with soft-delete scope
    mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE symbol = ? AND `investment`.`deleted_at` IS NULL")).
        WithArgs("SJL1L10").
        WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(3))

    count, err := repo.CountBySymbol(ctx, "SJL1L10")

    require.NoError(t, err)
    assert.Equal(t, int64(3), count)
    assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_CountBySymbol_Zero(t *testing.T) {
    db, mock, database := setupMockDB(t)
    defer func() {
        sqlDB, _ := db.DB()
        _ = sqlDB.Close()
    }()

    repo := NewInvestmentRepository(database)
    ctx := context.Background()

    mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE symbol = ? AND `investment`.`deleted_at` IS NULL")).
        WithArgs("UNKNOWN").
        WillReturnRows(sqlmock.NewRows([]string{"count(*)"}).AddRow(0))

    count, err := repo.CountBySymbol(ctx, "UNKNOWN")

    require.NoError(t, err)
    assert.Equal(t, int64(0), count)
    assert.NoError(t, mock.ExpectationsWereMet())
}

func TestInvestmentRepository_CountBySymbol_DBError(t *testing.T) {
    db, mock, database := setupMockDB(t)
    defer func() {
        sqlDB, _ := db.DB()
        _ = sqlDB.Close()
    }()

    repo := NewInvestmentRepository(database)
    ctx := context.Background()

    mock.ExpectQuery(regexp.QuoteMeta("SELECT count(*) FROM `investment` WHERE symbol = ? AND `investment`.`deleted_at` IS NULL")).
        WithArgs("SJL1L10").
        WillReturnError(errors.New("db error"))

    count, err := repo.CountBySymbol(ctx, "SJL1L10")

    require.Error(t, err)
    assert.Equal(t, int64(0), count)
    assert.NoError(t, mock.ExpectationsWereMet())
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./domain/repository/... -run TestInvestmentRepository_CountBySymbol -v
```

Expected: compile error (method not defined on `investmentRepository`).

**Step 3: Write minimal implementation**

Add to `investment_repository_impl.go`:

```go
// CountBySymbol returns the count of non-deleted investments where symbol = the given value.
// Uses SQL COUNT(*) with GORM soft-delete scope applied automatically (deleted_at IS NULL).
func (r *investmentRepository) CountBySymbol(ctx context.Context, symbol string) (int64, error) {
    var count int64
    result := r.db.DB.WithContext(ctx).
        Model(&models.Investment{}).
        Where("symbol = ?", symbol).
        Count(&count)
    if result.Error != nil {
        return 0, apperrors.NewInternalErrorWithCause("failed to count investments by symbol", result.Error)
    }
    return count, nil
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./domain/repository/... -run TestInvestmentRepository_CountBySymbol -v
```

Expected: 3 tests PASS.

**Step 5: Build to verify interface satisfaction**

```bash
cd src/go-backend && go build ./...
```

Expected: no errors.

**Step 6: Commit**

```
feat(repository): implement CountBySymbol on investmentRepository
```

---

### Task 3: Inject `InvestmentRepository` into `AssetDisplayConfigService`

**Files:**

- Modify: `src/go-backend/domain/service/asset_display_config_service.go` (add field + constructor param)
- Modify: `src/go-backend/internal/app/providers.go` (update `NewAssetDisplayConfigService` call)

**Security notes:** No new security surface — just DI wiring.

**Step 1: No test needed** — this is wiring-only; compilation failure is the test.

**Step 2: Update service struct and constructor**

In `asset_display_config_service.go`, add `investmentRepo` field and update constructor:

```go
type assetDisplayConfigService struct {
    configRepo     repository.AssetDisplayConfigRepository
    fetchCodeRepo  repository.AssetConfigFetchCodeRepository
    assetPriceRepo repository.AssetPriceRepository
    investmentRepo repository.InvestmentRepository   // NEW
}

func NewAssetDisplayConfigService(
    configRepo repository.AssetDisplayConfigRepository,
    fetchCodeRepo repository.AssetConfigFetchCodeRepository,
    assetPriceRepo repository.AssetPriceRepository,
    investmentRepo repository.InvestmentRepository,  // NEW
) AssetDisplayConfigService {
    return &assetDisplayConfigService{
        configRepo:     configRepo,
        fetchCodeRepo:  fetchCodeRepo,
        assetPriceRepo: assetPriceRepo,
        investmentRepo: investmentRepo,              // NEW
    }
}
```

**Step 3: Update `providers.go`**

Find the call to `NewAssetDisplayConfigService` in `src/go-backend/internal/app/providers.go` and add the `investmentRepo` argument. The investment repository is already constructed in providers — pass it in.

> **Note:** Check `providers.go` for the exact variable name of the investment repository to use as the 4th argument.

**Step 4: Build to verify**

```bash
cd src/go-backend && go build ./...
```

Expected: no errors.

**Step 5: Commit**

```
refactor(service): inject InvestmentRepository into AssetDisplayConfigService for guard logic
```

---

### Task 4: Implement Guard in `Update` (disable protection)

**Files:**

- Modify: `src/go-backend/domain/service/asset_display_config_service.go` (`Update` method)
- Modify: `src/go-backend/domain/service/asset_display_config_service_test.go` (add guard tests)

**Security notes:** Guard runs only when `enabled` flips true→false. Already-disabled configs (current `enabled=false`) pass through without a count check — avoids re-checking on every update.

**Step 1: Write the failing tests**

Add tests in `asset_display_config_service_test.go`. The existing `adcConfigRepo` mock and `adcAssetPriceRepo` mock are already defined. Add an `adcInvestmentRepo` mock:

```go
// adcInvestmentRepo is a stub for repository.InvestmentRepository (minimal surface).
type adcInvestmentRepo struct {
    countBySymbolFn func(ctx context.Context, symbol string) (int64, error)
}

func (m *adcInvestmentRepo) CountBySymbol(ctx context.Context, symbol string) (int64, error) {
    if m.countBySymbolFn != nil {
        return m.countBySymbolFn(ctx, symbol)
    }
    return 0, nil
}

// Stub all other methods to satisfy the interface (return zero values).
func (m *adcInvestmentRepo) Create(_ context.Context, _ *models.Investment) error { return nil }
func (m *adcInvestmentRepo) GetByID(_ context.Context, _ int32) (*models.Investment, error) { return nil, nil }
func (m *adcInvestmentRepo) GetByIDForUser(_ context.Context, _, _ int32) (*models.Investment, error) { return nil, nil }
func (m *adcInvestmentRepo) GetByUserAndSymbol(_ context.Context, _ int32, _ string) (*models.Investment, error) { return nil, nil }
func (m *adcInvestmentRepo) ListByUserID(_ context.Context, _ int32, _ repository.ListOptions, _ v1.InvestmentType) ([]*models.Investment, int, error) { return nil, 0, nil }
func (m *adcInvestmentRepo) ListByWalletID(_ context.Context, _ int32, _ repository.ListOptions, _ v1.InvestmentType) ([]*models.Investment, int, error) { return nil, 0, nil }
func (m *adcInvestmentRepo) Update(_ context.Context, _ *models.Investment) error { return nil }
func (m *adcInvestmentRepo) Delete(_ context.Context, _ int32) error { return nil }
func (m *adcInvestmentRepo) UpdatePrices(_ context.Context, _ []repository.PriceUpdate) error { return nil }
func (m *adcInvestmentRepo) GetPortfolioSummary(_ context.Context, _ int32) (*repository.PortfolioSummary, error) { return nil, nil }
func (m *adcInvestmentRepo) GetAggregatedPortfolioSummary(_ context.Context, _ int32, _ v1.InvestmentType) (*repository.PortfolioSummary, error) { return nil, nil }
func (m *adcInvestmentRepo) GetInvestmentValue(_ context.Context, _ int32) (int64, error) { return 0, nil }
func (m *adcInvestmentRepo) GetInvestmentValuesByWalletIDs(_ context.Context, _ []int32) (map[int32]int64, error) { return nil, nil }

var _ repository.InvestmentRepository = (*adcInvestmentRepo)(nil)
```

Update `newTestAssetDisplayConfigService` helper:

```go
func newTestAssetDisplayConfigService(
    cfgRepo repository.AssetDisplayConfigRepository,
    fcRepo repository.AssetConfigFetchCodeRepository,
    apRepo repository.AssetPriceRepository,
) AssetDisplayConfigService {
    return NewAssetDisplayConfigService(cfgRepo, fcRepo, apRepo, &adcInvestmentRepo{})
}
```

Add a separate helper for guard tests that need a custom investment repo:

```go
func newTestADCServiceWithInvestmentRepo(
    cfgRepo repository.AssetDisplayConfigRepository,
    fcRepo repository.AssetConfigFetchCodeRepository,
    apRepo repository.AssetPriceRepository,
    invRepo repository.InvestmentRepository,
) AssetDisplayConfigService {
    return NewAssetDisplayConfigService(cfgRepo, fcRepo, apRepo, invRepo)
}
```

Add guard tests:

```go
func TestUpdate_DisableBlocked_WhenActiveInvestmentsExist(t *testing.T) {
    ctx := context.Background()

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{
                ID:       id,
                TypeCode: "SJL1L10",
                Enabled:  true, // currently enabled
            }, nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, symbol string) (int64, error) {
            assert.Equal(t, "SJL1L10", symbol)
            return 3, nil // 3 active investments
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    _, err := svc.Update(ctx, 1, "SJC 1L 10L", 0, false, true)

    require.Error(t, err)
    assert.Contains(t, err.Error(), "Cannot disable")
    assert.Contains(t, err.Error(), "3")
    assert.Contains(t, err.Error(), "SJL1L10")
}

func TestUpdate_DisableAllowed_WhenNoActiveInvestments(t *testing.T) {
    ctx := context.Background()

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{
                ID:       id,
                TypeCode: "SJL1L10",
                Enabled:  true,
            }, nil
        },
        updateFn: func(_ context.Context, config *models.AssetDisplayConfig) error {
            return nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            return 0, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    result, err := svc.Update(ctx, 1, "SJC 1L 10L", 0, false, true)

    require.NoError(t, err)
    assert.NotNil(t, result)
    assert.False(t, result.Enabled)
}

func TestUpdate_NoGuard_WhenEnabledStaysTrue(t *testing.T) {
    ctx := context.Background()
    countCalled := false

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{
                ID:       id,
                TypeCode: "SJL1L10",
                Enabled:  true,
            }, nil
        },
        updateFn: func(_ context.Context, _ *models.AssetDisplayConfig) error {
            return nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            countCalled = true
            return 5, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    result, err := svc.Update(ctx, 1, "SJC 1L 10L", 0, true, true) // enabled stays true

    require.NoError(t, err)
    assert.NotNil(t, result)
    assert.False(t, countCalled, "CountBySymbol should NOT be called when enabled stays true")
}

func TestUpdate_NoGuard_WhenAlreadyDisabled(t *testing.T) {
    ctx := context.Background()
    countCalled := false

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{
                ID:       id,
                TypeCode: "SJL1L10",
                Enabled:  false, // already disabled
            }, nil
        },
        updateFn: func(_ context.Context, _ *models.AssetDisplayConfig) error {
            return nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            countCalled = true
            return 5, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    _, err := svc.Update(ctx, 1, "SJC 1L 10L", 0, false, true)

    require.NoError(t, err)
    assert.False(t, countCalled, "CountBySymbol should NOT be called when config is already disabled")
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestUpdate_Disable" -v
```

Expected: compile error or FAIL (guard logic not implemented yet).

**Step 3: Write minimal implementation**

In `asset_display_config_service.go`, update the `Update` method. After fetching the config and before modifying it, add the guard:

```go
// Guard: if this update disables a currently-enabled config, check for active investments.
if config.Enabled && !enabled {
    count, countErr := s.investmentRepo.CountBySymbol(ctx, config.TypeCode)
    if countErr != nil {
        return nil, countErr
    }
    if count > 0 {
        return nil, apperrors.NewValidationError(
            fmt.Sprintf("Cannot disable: %d active investment(s) use asset type %s", count, config.TypeCode),
        )
    }
}
```

Insert this block **after** `config, err := s.configRepo.GetByID(ctx, id)` and **before** `config.DisplayName = displayName`.

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestUpdate_Disable\|TestUpdate_NoGuard" -v
```

Expected: 4 tests PASS.

**Step 5: Run the full service test suite to ensure no regression**

```bash
cd src/go-backend && go test ./domain/service/... -v
```

Expected: all tests PASS.

**Step 6: Commit**

```
feat(service): block disable of asset display config when active investments exist
```

---

### Task 5: Implement Guard in `Delete`

**Files:**

- Modify: `src/go-backend/domain/service/asset_display_config_service.go` (`Delete` method)
- Modify: `src/go-backend/domain/service/asset_display_config_service_test.go` (add guard tests)

**Security notes:** Same as Task 4 — parameterized query, no new trust boundary.

**Step 1: Write the failing tests**

```go
func TestDelete_BlockedWhenActiveInvestmentsExist(t *testing.T) {
    ctx := context.Background()

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{ID: id, TypeCode: "SJL1L10"}, nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, symbol string) (int64, error) {
            assert.Equal(t, "SJL1L10", symbol)
            return 2, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    err := svc.Delete(ctx, 1)

    require.Error(t, err)
    assert.Contains(t, err.Error(), "Cannot delete")
    assert.Contains(t, err.Error(), "2")
    assert.Contains(t, err.Error(), "SJL1L10")
}

func TestDelete_AllowedWhenNoActiveInvestments(t *testing.T) {
    ctx := context.Background()
    deleteCalled := false

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{ID: id, TypeCode: "SJL1L10"}, nil
        },
        deleteFn: func(_ context.Context, _ int32) error {
            deleteCalled = true
            return nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            return 0, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    err := svc.Delete(ctx, 1)

    require.NoError(t, err)
    assert.True(t, deleteCalled, "repo.Delete should be called when count=0")
}

func TestDelete_ConfigNotFound_ReturnsNotFoundBeforeCountCheck(t *testing.T) {
    ctx := context.Background()
    countCalled := false

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, _ int32) (*models.AssetDisplayConfig, error) {
            return nil, apperrors.NewNotFoundError("asset display config")
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            countCalled = true
            return 0, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    err := svc.Delete(ctx, 99)

    require.Error(t, err)
    assert.False(t, countCalled, "CountBySymbol should NOT be called when config not found")
}

func TestDelete_ErrorMessageDistinguishesDeleteFromDisable(t *testing.T) {
    ctx := context.Background()

    cfgRepo := &adcConfigRepo{
        getByIDFn: func(_ context.Context, id int32) (*models.AssetDisplayConfig, error) {
            return &models.AssetDisplayConfig{ID: id, TypeCode: "XAU"}, nil
        },
    }
    invRepo := &adcInvestmentRepo{
        countBySymbolFn: func(_ context.Context, _ string) (int64, error) {
            return 1, nil
        },
    }

    svc := newTestADCServiceWithInvestmentRepo(cfgRepo, &adcFetchCodeRepo{}, &adcAssetPriceRepo{}, invRepo)
    err := svc.Delete(ctx, 1)

    require.Error(t, err)
    // Must say "Cannot delete", NOT "Cannot disable"
    assert.Contains(t, err.Error(), "Cannot delete")
    assert.NotContains(t, err.Error(), "Cannot disable")
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestDelete_" -v
```

Expected: FAIL (guard not implemented; existing `TestDelete_DelegatesToRepo` still passes).

**Step 3: Write minimal implementation**

Replace the `Delete` method with a guarded version:

```go
// Delete soft-deletes a config entry by id.
// Blocks deletion if any non-deleted investments reference this config's TypeCode.
func (s *assetDisplayConfigService) Delete(ctx context.Context, id int32) error {
    config, err := s.configRepo.GetByID(ctx, id)
    if err != nil {
        return err
    }
    if config == nil {
        return apperrors.NewNotFoundError("asset display config")
    }

    count, err := s.investmentRepo.CountBySymbol(ctx, config.TypeCode)
    if err != nil {
        return err
    }
    if count > 0 {
        return apperrors.NewValidationError(
            fmt.Sprintf("Cannot delete: %d active investment(s) use asset type %s", count, config.TypeCode),
        )
    }

    return s.configRepo.Delete(ctx, id)
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestDelete_" -v
```

Expected: 5 tests PASS (4 new + existing `TestDelete_DelegatesToRepo`).

**Step 5: Run the full service test suite**

```bash
cd src/go-backend && go test ./domain/service/... -v
```

Expected: all tests PASS.

**Step 6: Commit**

```
feat(service): block delete of asset display config when active investments exist
```

---

### Task 6: Handler Tests for Guard Error Propagation

The handler already delegates to the service and uses `handler.HandleError` for error responses. The `400` from `apperrors.ValidationError` surfaces correctly. Verify this with handler-level tests.

**Files:**

- Modify: `src/go-backend/handlers/asset_display_config_test.go` (add guard error tests)

**Security notes:** No new handler logic — verifies existing error propagation.

**Step 1: Write the failing tests**

```go
func TestAssetDisplayConfig_Update_Returns400_WhenDisableGuardBlocks(t *testing.T) {
    mockSvc := &mockAssetDisplayConfigService{
        updateFunc: func(_ context.Context, id int32, displayName string, displayOrder int32, enabled, showInInvestment bool) (*models.AssetDisplayConfig, error) {
            return nil, apperrors.NewValidationError("Cannot disable: 3 active investment(s) use asset type SJL1L10")
        },
    }

    h := newTestAssetDisplayConfigHandler(mockSvc)
    w := runUpdateAsset(h, "1", `{"displayName":"SJC 1L","displayOrder":0,"enabled":false,"showInInvestment":true}`)

    assert.Equal(t, http.StatusBadRequest, w.Code)
    var resp map[string]interface{}
    require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
    assert.False(t, resp["success"].(bool))
    errObj := resp["error"].(map[string]interface{})
    assert.Contains(t, errObj["message"].(string), "Cannot disable")
}

func TestAssetDisplayConfig_Delete_Returns400_WhenDeleteGuardBlocks(t *testing.T) {
    mockSvc := &mockAssetDisplayConfigService{
        deleteFunc: func(_ context.Context, id int32) error {
            return apperrors.NewValidationError("Cannot delete: 2 active investment(s) use asset type XAU")
        },
    }

    h := newTestAssetDisplayConfigHandler(mockSvc)
    w := runDeleteAsset(h, "1")

    assert.Equal(t, http.StatusBadRequest, w.Code)
    var resp map[string]interface{}
    require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
    assert.False(t, resp["success"].(bool))
    errObj := resp["error"].(map[string]interface{})
    assert.Contains(t, errObj["message"].(string), "Cannot delete")
}
```

**Step 2: Run tests to verify they pass** (handler uses `HandleError` which maps `ValidationError` → 400)

```bash
cd src/go-backend && go test ./handlers/... -run "TestAssetDisplayConfig_Update_Returns400\|TestAssetDisplayConfig_Delete_Returns400" -v
```

Expected: PASS (handler error propagation already works — these tests confirm it).

**Step 3: Run full handler test suite**

```bash
cd src/go-backend && go test ./handlers/... -v
```

Expected: all tests PASS.

**Step 4: Commit**

```
test(handlers): verify 400 response when disable/delete guard blocks asset display config
```

---

### Task 7: Full CI Check

**Files:** None (validation only)

**Steps:**

1. Run backend lint:
   ```bash
   cd src/go-backend && task ci:backend-lint
   ```
   Expected: no lint errors (depguard passes — service imports `repository`, not `gorm`).

2. Run all backend tests:
   ```bash
   cd src/go-backend && go test ./...
   ```
   Expected: all tests PASS.

3. If either fails, investigate root cause before retrying.

---

## Summary of Files Modified

| File | Change |
|------|--------|
| `src/go-backend/domain/repository/investment_repository.go` | Add `CountBySymbol` to interface |
| `src/go-backend/domain/repository/investment_repository_impl.go` | Implement `CountBySymbol` |
| `src/go-backend/domain/repository/investment_repository_impl_test.go` | Add 3 tests for `CountBySymbol` |
| `src/go-backend/domain/service/asset_display_config_service.go` | Add `investmentRepo` field, update constructor, add guards in `Update` and `Delete` |
| `src/go-backend/domain/service/asset_display_config_service_test.go` | Add `adcInvestmentRepo` mock + 8 guard tests |
| `src/go-backend/handlers/asset_display_config_test.go` | Add 2 handler-level guard error tests |
| `src/go-backend/internal/app/providers.go` | Pass `investmentRepo` to `NewAssetDisplayConfigService` |
| `docs/architecture/flow-admin.md` | New file: flowchart for disable/delete guard |
| `docs/architecture/README.md` | Add `flow-admin.md` to Dynamic Behavior Diagrams table |

## Estimated Task Order

```
Task 0 (docs) → Task 1 (interface) → Task 2 (impl+test) → Task 3 (DI wiring)
→ Task 4 (Update guard) → Task 5 (Delete guard) → Task 6 (handler tests) → Task 7 (CI)
```

Tasks 4, 5, and 6 depend on Task 3. Tasks 4 and 5 can be implemented sequentially in the same session. Task 6 is independent of Task 5 (uses mocks).
