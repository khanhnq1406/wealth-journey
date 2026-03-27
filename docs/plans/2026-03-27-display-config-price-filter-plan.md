# Display Config Price Filter — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Make `GetAllPrices` and `GetMarketTypes` only return prices that have a matching enabled, non-deleted `asset_display_config` row — so deleting/disabling a config entry immediately removes it from all display-facing price endpoints.
**Spec:** `docs/specs/2026-03-27-display-config-price-filter-spec.md`
**Architecture:** `AssetPriceService` gains a new constructor dependency on `AssetDisplayConfigRepository`. For display methods (`GetAllPrices`, `GetMarketTypes`), the service first calls a new repo method `ListEnabledTypeCodesByAssetType` to get the allowed type codes per asset type, then calls a new repo method `ListByAssetTypeFiltered` on `AssetPriceRepository` to fetch only matching rows. `PriceCacheJob`, `ResolvePrice`, and `GetPriceByTypeCode` are completely unaffected.
**Tech Stack:** Go 1.25, GORM, PostgreSQL, no new external dependencies.

---

## Security Implementation Notes

- **Authentication/Authorization:** Endpoints are public read-only. No new auth needed. Filter is entirely server-side — no client input influences which rows are included.
- **Input validation:** `enabledTypeCodes` slice comes from the DB (trusted source), never from user input. `assetType` is internally supplied by the service, not from the request body in the affected paths.
- **SQL injection:** `WHERE type_code IN (?)` uses GORM parameterized binding — no string interpolation.
- **Cold-start safety:** When `enabledTypeCodes` is empty, `ListByAssetTypeFiltered` returns `[]` immediately without a DB call. Existing static-registry fallback in `GetPublicMarketTypes` handler remains intact.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend changes. Backend-only fix.

---

## C4 Architecture Diagram Updates

Per spec §Architecture Changes:
- `docs/architecture/c4-component-backend.md`: Add arrow `AssetPriceService → AssetDisplayConfigRepository` (new dependency).

---

## Task 0: Update C4 Backend Diagram

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`

**Steps:**

1. Read the current `c4-component-backend.md` to find the `AssetPriceService` component block.
2. Add a dependency arrow from `AssetPriceService` to `AssetDisplayConfigRepository`:
   - In the Mermaid C4 diagram, add: `Rel(assetPriceSvc, assetDisplayConfigRepo, "reads enabled type codes", "in-process")`
3. Commit: `docs(c4): AssetPriceService → AssetDisplayConfigRepository dependency`

---

## Task 1: Add `ListEnabledTypeCodesByAssetType` to `AssetDisplayConfigRepository`

**Files:**
- Modify: `src/go-backend/domain/repository/asset_display_config_repository.go`
- Modify: `src/go-backend/domain/repository/asset_display_config_repository_test.go` (or create if absent)

**Security notes:** Pure DB read; `assetType` is an internal value from the service layer, never user-supplied in this code path. GORM parameterized WHERE prevents injection.

**Step 1: Write the failing test**

Add to `asset_display_config_repository_test.go` (or the relevant test file):

```go
// TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType verifies
// that only enabled, non-deleted configs for the given asset type are returned
// as a []string of type codes.
func TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType(t *testing.T) {
    // Test uses mockAssetDisplayConfigRepo or DB integration test pattern.
    // For unit test, add to mock & interface; integration test exercises real query.

    // Unit test via mock (interface contract):
    // Given: configs with enabled=true and enabled=false for assetType="silver"
    // When: ListEnabledTypeCodesByAssetType(ctx, "silver")
    // Then: only enabled type codes returned; soft-deleted rows absent

    // Behavior contract tests:
    // 1. Returns only enabled type codes for matching assetType
    // 2. Excludes disabled configs (enabled=false)
    // 3. GORM auto-excludes soft-deleted rows (deleted_at IS NOT NULL)
    // 4. Returns empty slice (not error) when no enabled configs exist
}
```

**Step 2: Add to interface** in `asset_display_config_repository.go`:

```go
// ListEnabledTypeCodesByAssetType returns the type_code values of all
// enabled, non-deleted configs for the given asset type.
// Returns an empty slice (not an error) when no matching configs exist.
// Used by AssetPriceService to filter the price read path.
ListEnabledTypeCodesByAssetType(ctx context.Context, assetType string) ([]string, error)
```

**Step 3: Write minimal implementation** in `asset_display_config_repository.go`:

```go
// ListEnabledTypeCodesByAssetType returns type_code strings for all
// enabled, non-deleted configs of the given asset type.
// GORM auto-adds WHERE deleted_at IS NULL via soft-delete.
func (r *assetDisplayConfigRepository) ListEnabledTypeCodesByAssetType(ctx context.Context, assetType string) ([]string, error) {
    var typeCodes []string
    result := r.db.DB.WithContext(ctx).
        Model(&models.AssetDisplayConfig{}).
        Where("asset_type = ? AND enabled = true", assetType).
        Pluck("type_code", &typeCodes)
    if result.Error != nil {
        return nil, apperrors.NewInternalErrorWithCause("failed to list enabled type codes by asset type", result.Error)
    }
    return typeCodes, nil
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -short ./domain/repository/... -run TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType -v
```

**Step 5: Commit**
```
feat(repo): add ListEnabledTypeCodesByAssetType to AssetDisplayConfigRepository
```

---

## Task 2: Add `ListByAssetTypeFiltered` to `AssetPriceRepository`

**Files:**
- Modify: `src/go-backend/domain/repository/asset_price_repository.go`
- Modify: `src/go-backend/domain/repository/asset_price_repository_test.go` (or create if absent)

**Security notes:** `enabledTypeCodes` slice comes from the DB via `ListEnabledTypeCodesByAssetType` — never from user input. GORM `Where("type_code IN ?", typeCodes)` uses parameterized binding.

**Step 1: Write the failing test**

```go
func TestAssetPriceRepository_ListByAssetTypeFiltered_ReturnsMatchingRows(t *testing.T) {
    // Given: asset prices for SJC_1L, DOJI, XAG_USD in silver
    // When: ListByAssetTypeFiltered(ctx, "silver", []string{"SJC_1L"})
    // Then: only SJC_1L row returned
}

func TestAssetPriceRepository_ListByAssetTypeFiltered_EmptyAllowlist(t *testing.T) {
    // When: enabledTypeCodes is []string{}
    // Then: returns empty slice without DB query (early return)
}
```

**Step 2: Add to interface** in `asset_price_repository.go`:

```go
// ListByAssetTypeFiltered retrieves all non-deleted prices for the given asset type
// whose type_code is in enabledTypeCodes. Uses parameterized WHERE type_code IN (?).
// Returns an empty slice immediately when enabledTypeCodes is empty (no DB query).
ListByAssetTypeFiltered(ctx context.Context, assetType string, enabledTypeCodes []string) ([]*models.AssetPrice, error)
```

**Step 3: Write minimal implementation**:

```go
// ListByAssetTypeFiltered retrieves non-deleted asset prices for assetType
// whose type_code is in enabledTypeCodes. Early-returns empty slice when
// enabledTypeCodes is empty to avoid a DB round-trip with an empty IN clause.
func (r *assetPriceRepository) ListByAssetTypeFiltered(ctx context.Context, assetType string, enabledTypeCodes []string) ([]*models.AssetPrice, error) {
    if len(enabledTypeCodes) == 0 {
        return []*models.AssetPrice{}, nil
    }
    var prices []*models.AssetPrice
    result := r.db.DB.WithContext(ctx).
        Where("asset_type = ? AND type_code IN ?", assetType, enabledTypeCodes).
        Find(&prices)
    if result.Error != nil {
        return nil, apperrors.NewInternalErrorWithCause("failed to list asset prices filtered by type codes", result.Error)
    }
    return prices, nil
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -short ./domain/repository/... -run TestAssetPriceRepository_ListByAssetTypeFiltered -v
```

**Step 5: Commit**
```
feat(repo): add ListByAssetTypeFiltered to AssetPriceRepository
```

---

## Task 3: Inject `AssetDisplayConfigRepository` into `AssetPriceService` and update `GetAllPrices`

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`
- Modify: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** No new user-trust boundaries. New dependency is an internal DB repository. `assetType` values in `GetAllPrices` are sourced from DB rows (via `ListAll` initially to group — see impl note below).

**Implementation note on `GetAllPrices` approach:**

Current `GetAllPrices` calls `repo.ListAll(ctx)` to get ALL rows, then groups by `AssetType`. After the fix it needs to filter per asset type. Two approaches:

**Chosen approach (simpler, less DB traffic):**
1. Call `repo.ListAll(ctx)` once to enumerate distinct asset types present in DB.
2. For each asset type, call `configRepo.ListEnabledTypeCodesByAssetType(ctx, assetType)` + `priceRepo.ListByAssetTypeFiltered(ctx, assetType, codes)`.

**Better approach (more correct, fewer queries):**
Call `configRepo.ListEnabledTypeCodesByAssetType` for each known asset type (gold, silver, currency — hardcoded list, not derived from DB), then call `ListByAssetTypeFiltered` per type. This is simpler and avoids needing `ListAll` at all.

**Final chosen approach:** Call filters for each known asset type directly:
```go
const knownTypes = []string{"gold", "silver", "currency"}
for each type: get enabled codes, then filtered prices
```

**Step 1: Write the failing test**

Add to `asset_price_service_test.go`:

```go
// TestAssetPriceService_GetAllPrices_FiltersDisabledConfigs verifies that
// GetAllPrices only returns prices for type codes present in asset_display_config
// with enabled=true and deleted_at IS NULL.
func TestAssetPriceService_GetAllPrices_FiltersDisabledConfigs(t *testing.T) {
    // Given: asset_price has SJC_1L + DOJI for gold; asset_display_config only enables SJC_1L
    // When: GetAllPrices()
    // Then: result.Gold has only SJC_1L; DOJI is absent
}

// TestAssetPriceService_GetAllPrices_EmptyDisplayConfig verifies cold-start safety:
// when no display configs are enabled, returns empty arrays (not error).
func TestAssetPriceService_GetAllPrices_EmptyDisplayConfig(t *testing.T) {
    // Given: asset_display_config returns [] for all asset types
    // When: GetAllPrices()
    // Then: Gold=[], Silver=[], Currency=[]
}

// TestAssetPriceService_GetAllPrices_RepoError propagates configRepo error.
func TestAssetPriceService_GetAllPrices_ConfigRepoError(t *testing.T) {
    // Given: configRepo.ListEnabledTypeCodesByAssetType returns error
    // When: GetAllPrices()
    // Then: error is returned
}
```

**Step 2: Add `configRepo` field to `assetPriceService` struct:**

```go
type assetPriceService struct {
    repo              repository.AssetPriceRepository
    configRepo        repository.AssetDisplayConfigRepository  // NEW
    silverSvc         SilverPriceService
    // ... rest unchanged
}
```

**Step 3: Update constructor `NewAssetPriceService`:**

```go
func NewAssetPriceService(
    repo repository.AssetPriceRepository,
    configRepo repository.AssetDisplayConfigRepository,  // NEW (second arg)
    silverSvc SilverPriceService,
    // ... rest unchanged
) AssetPriceService {
    return &assetPriceService{
        repo:       repo,
        configRepo: configRepo,
        // ... rest unchanged
    }
}
```

**IMPORTANT:** All existing test call-sites pass `nil` for `configRepo`. Update all `NewAssetPriceService(repo, ...)` calls in `asset_price_service_test.go` to `NewAssetPriceService(repo, nil_or_mockConfigRepo, ...)`.

**Step 4: Update `GetAllPrices` to use the filter chain:**

```go
// knownAssetTypes is the fixed set of asset types served by GetAllPrices / GetMarketTypes.
var knownAssetTypes = []string{"gold", "silver", "currency"}

func (s *assetPriceService) GetAllPrices(ctx context.Context) (*AllAssetPrices, error) {
    result := &AllAssetPrices{
        Gold:     make([]*AssetPriceDTO, 0),
        Silver:   make([]*AssetPriceDTO, 0),
        Currency: make([]*AssetPriceDTO, 0),
    }

    for _, assetType := range knownAssetTypes {
        enabledCodes, err := s.configRepo.ListEnabledTypeCodesByAssetType(ctx, assetType)
        if err != nil {
            return nil, err
        }
        rows, err := s.repo.ListByAssetTypeFiltered(ctx, assetType, enabledCodes)
        if err != nil {
            return nil, err
        }
        for _, row := range rows {
            dto := modelToDTO(row)
            switch assetType {
            case "gold":
                result.Gold = append(result.Gold, dto)
            case "silver":
                result.Silver = append(result.Silver, dto)
            case "currency":
                result.Currency = append(result.Currency, dto)
            }
        }
    }
    return result, nil
}
```

**Step 5: Run tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestAssetPriceService_GetAllPrices -v
```

**Step 6: Commit**
```
feat(service): GetAllPrices filters by enabled asset_display_config
```

---

## Task 4: Update `GetMarketTypes` to use the filter chain

**Files:**
- Modify: `src/go-backend/domain/service/asset_price_service.go`
- Modify: `src/go-backend/domain/service/asset_price_service_test.go`

**Security notes:** Same as Task 3. No new trust boundaries.

**Step 1: Write the failing test**

```go
func TestAssetPriceService_GetMarketTypes_FiltersDisabledConfigs(t *testing.T) {
    // Given: asset_price has SJC_1L + DOJI for gold; display config only enables SJC_1L
    // When: GetMarketTypes()
    // Then: result.Gold has only SJC_1L type item
}

func TestAssetPriceService_GetMarketTypes_EmptyDisplayConfig(t *testing.T) {
    // Given: all display configs disabled/absent
    // When: GetMarketTypes()
    // Then: Gold=[], Silver=[], Currency=[], all timestamps=0
}
```

**Step 2: Update `GetMarketTypes` implementation:**

```go
func (s *assetPriceService) GetMarketTypes(ctx context.Context) (*MarketTypesDTO, error) {
    result := &MarketTypesDTO{
        Gold:     make([]MarketTypeItem, 0),
        Silver:   make([]MarketTypeItem, 0),
        Currency: make([]MarketTypeItem, 0),
    }
    var goldMax, silverMax, currencyMax time.Time

    for _, assetType := range knownAssetTypes {
        enabledCodes, err := s.configRepo.ListEnabledTypeCodesByAssetType(ctx, assetType)
        if err != nil {
            return nil, err
        }
        rows, err := s.repo.ListByAssetTypeFiltered(ctx, assetType, enabledCodes)
        if err != nil {
            return nil, err
        }
        for _, row := range rows {
            item := MarketTypeItem{
                Code:     row.TypeCode,
                Name:     row.Name,
                Currency: row.Currency,
            }
            switch assetType {
            case "gold":
                result.Gold = append(result.Gold, item)
                if row.FetchedAt.After(goldMax) {
                    goldMax = row.FetchedAt
                }
            case "silver":
                result.Silver = append(result.Silver, item)
                if row.FetchedAt.After(silverMax) {
                    silverMax = row.FetchedAt
                }
            case "currency":
                result.Currency = append(result.Currency, item)
                if row.FetchedAt.After(currencyMax) {
                    currencyMax = row.FetchedAt
                }
            }
        }
    }

    if !goldMax.IsZero() {
        result.GoldUpdatedAt = goldMax.Unix()
    }
    if !silverMax.IsZero() {
        result.SilverUpdatedAt = silverMax.Unix()
    }
    if !currencyMax.IsZero() {
        result.CurrencyUpdatedAt = currencyMax.Unix()
    }

    return result, nil
}
```

**Step 3: Run tests**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestAssetPriceService_GetMarketTypes -v
```

**Step 4: Commit**
```
feat(service): GetMarketTypes filters by enabled asset_display_config
```

---

## Task 5: Wire `AssetDisplayConfigRepository` into `NewAssetPriceService` in `services.go`

**Files:**
- Modify: `src/go-backend/domain/service/services.go`

**Security notes:** Pure DI wiring; no logic change.

**Step 1: Verify the current `NewAssetPriceService` call site in `services.go`:**

Current (line ~97):
```go
assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice,
    silverPriceSvc,
    // ... 7 more args
)
```

**Step 2: Add `repos.AssetDisplayConfig` as the second argument:**

```go
assetPriceSvc := NewAssetPriceService(
    repos.AssetPrice,
    repos.AssetDisplayConfig,  // NEW — second arg
    silverPriceSvc,
    currencyPriceSvc,
    NewVangSaiGonGoldFetcher(waterfallSourceTimeout),
    NewVangTodayGoldFetcher(waterfallSourceTimeout),
    sjcClient,
    dojiClient,
    btmcClient,
    pnjClient,
)
```

**Step 3: Build to verify no compile errors:**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Run full test suite:**

```bash
cd src/go-backend && go test -short ./...
```

**Step 5: Commit**
```
feat(providers): wire AssetDisplayConfigRepository into AssetPriceService
```

---

## Task 6: Run CI and Lint

**Files:** None (CI verification only)

**Steps:**

1. Run backend lint:
```bash
cd src/go-backend && task ci:backend-lint
```

2. Run backend tests:
```bash
cd src/go-backend && go test -short ./...
```

3. Fix any lint issues (depguard, errcheck, staticcheck).

4. Commit any lint fixes if needed.

---

## Task 7: Update Runtime Flow Diagram (`flow-cross-cutting.md`)

**Files:**
- Modify: `docs/architecture/flow-cross-cutting.md`

Per spec §Flow Diagrams to Update — update §3 (Price Cache WRITER/READER pattern):

**Add to READER sequence:**
```
AssetPriceService->>AssetDisplayConfigRepo: ListEnabledTypeCodesByAssetType(assetType)
AssetDisplayConfigRepo-->>AssetPriceService: []enabledTypeCodes
AssetPriceService->>AssetPriceRepo: ListByAssetTypeFiltered(assetType, enabledTypeCodes)
```

Add note: "READER now filters: only prices with an enabled, non-deleted display_config row are returned."

**Steps:**

1. Read `docs/architecture/flow-cross-cutting.md`.
2. Locate the §3 READER section sequence diagram.
3. Replace `AssetPriceService->>AssetPriceRepo: ListAll(ctx)` with the three-step filter chain shown above.
4. Commit: `docs(flow): update cross-cutting READER flow — add display_config filter`

---

## Task 8: Update Implementation Report

**Files:**
- Modify: `docs/reports/2026-03-27-asset-price-bridge-report.md`

**Steps:**

1. Read the existing report.
2. Add a new entry to the fix history section:
   - **Fix:** Display config price filter — backend service layer
   - **Root cause:** `GetAllPrices` and `GetMarketTypes` called `repo.ListAll()` with no filter against `asset_display_config`, returning ALL `asset_price` rows regardless of admin config.
   - **Fix:** Added `configRepo.ListEnabledTypeCodesByAssetType` + `priceRepo.ListByAssetTypeFiltered` per asset type in both methods. `NewAssetPriceService` now accepts `AssetDisplayConfigRepository` as the second constructor argument.
   - **Tests added:** `TestAssetPriceService_GetAllPrices_FiltersDisabledConfigs`, `TestAssetPriceService_GetMarketTypes_FiltersDisabledConfigs`, `TestAssetPriceRepository_ListByAssetTypeFiltered_*`, `TestAssetDisplayConfigRepository_ListEnabledTypeCodesByAssetType`
   - **Out of scope:** `ResolvePrice`, `GetPriceByTypeCode`, `PriceCacheJob` — unmodified.
3. Commit: `docs(report): add display-config-price-filter fix to asset-price-bridge report`

---

## Implementation Order

```
Task 0 (C4 diagram)              — independent
Task 1 (configRepo method)       — dependency of Task 3/4/5
Task 2 (priceRepo method)        — dependency of Task 3/4/5
Task 3 (GetAllPrices filter)     — depends on Task 1 + 2
Task 4 (GetMarketTypes filter)   — depends on Task 1 + 2 (parallel with Task 3)
Task 5 (DI wiring in services.go)— depends on Task 3 + 4
Task 6 (CI)                      — depends on Task 5
Task 7 (flow diagram)            — depends on Task 3 + 4
Task 8 (report update)           — depends on Task 6
```

---

## Mock Additions Needed for Tests

The test mocks need two new methods. Add to `mockAssetDisplayConfigRepo` in `asset_price_service_test.go`:

```go
type mockAssetDisplayConfigRepo struct {
    listEnabledTypeCodesResult map[string][]string  // key = assetType
    listEnabledTypeCodesErr    error
}

func (m *mockAssetDisplayConfigRepo) ListEnabledTypeCodesByAssetType(ctx context.Context, assetType string) ([]string, error) {
    if m.listEnabledTypeCodesErr != nil {
        return nil, m.listEnabledTypeCodesErr
    }
    if m.listEnabledTypeCodesResult != nil {
        return m.listEnabledTypeCodesResult[assetType], nil
    }
    return []string{}, nil
}
// Must also implement all other AssetDisplayConfigRepository interface methods (stub them out)
```

Add `listByAssetTypeFilteredResult` to `mockAssetPriceRepo`:

```go
type mockAssetPriceRepo struct {
    // ... existing fields
    listByAssetTypeFilteredResult map[string][]*models.AssetPrice // key = assetType
    listByAssetTypeFilteredErr    error
}

func (m *mockAssetPriceRepo) ListByAssetTypeFiltered(ctx context.Context, assetType string, enabledTypeCodes []string) ([]*models.AssetPrice, error) {
    if m.listByAssetTypeFilteredErr != nil {
        return nil, m.listByAssetTypeFilteredErr
    }
    if m.listByAssetTypeFilteredResult != nil {
        // Filter by enabledTypeCodes for realism
        all := m.listByAssetTypeFilteredResult[assetType]
        if len(enabledTypeCodes) == 0 {
            return []*models.AssetPrice{}, nil
        }
        codeSet := make(map[string]bool, len(enabledTypeCodes))
        for _, c := range enabledTypeCodes {
            codeSet[c] = true
        }
        filtered := make([]*models.AssetPrice, 0)
        for _, p := range all {
            if codeSet[p.TypeCode] {
                filtered = append(filtered, p)
            }
        }
        return filtered, nil
    }
    return []*models.AssetPrice{}, nil
}
```

---

## Existing Test Call-site Updates

Every existing test that calls `NewAssetPriceService(repo, silverSvc, currencySvc, ...)` must be updated to:
```go
NewAssetPriceService(repo, nil, silverSvc, currencySvc, ...)
```
where `nil` is passed for `configRepo` (the new second argument). These tests don't exercise `GetAllPrices`/`GetMarketTypes` filtering so passing `nil` is safe for those tests. The new filter tests will pass a real `mockAssetDisplayConfigRepo`.

**Note:** If `configRepo` is nil and `GetAllPrices`/`GetMarketTypes` is called, it will panic. The new filter tests always pass a non-nil mock. Existing tests that call `GetAllPrices` without filtering (e.g., `TestAssetPriceService_GetAllPrices_IsStaleField`) must be updated to pass a mock configRepo that returns all type codes.
