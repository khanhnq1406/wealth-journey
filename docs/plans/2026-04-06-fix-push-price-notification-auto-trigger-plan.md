# Fix Push Price Notification Auto-Trigger Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `buildEnabledSet` in `price_alert_service.go` to match `asset_price.type_code` via fetch codes instead of display config type codes, so automated push price notifications fire correctly.
**Spec:** `docs/specs/2026-04-06-fix-push-price-notification-auto-trigger-spec.md`
**Architecture:** Backend-only fix. `PriceAlertService` already depends on `AssetDisplayConfigService`. A new method `GetFetchCodesByAssetType` is added to `AssetDisplayConfigService` that returns a map of `fetchCode → config`, allowing `buildEnabledSet` to build the correct lookup without changing the calling contract. No schema, proto, or frontend changes.
**Tech Stack:** Go 1.25, GORM, Redis (miniredis for tests), testify/mock

## Security Implementation Notes

- Authentication: No new endpoints — scheduler job only.
- Authorization: No user input in this flow — all data from DB tables maintained by admin only.
- Input validation: No user input. DB queries use GORM parameterized queries (no injection risk).
- Data sanitization: Push payloads contain only public market price data (no PII, no financial user data).

## Component Reuse Inventory (Frontend Tasks)

No frontend changes. N/A.

---

## C4 Architecture Diagram Updates

No structural changes. `PriceAlertService` already depends on `AssetDisplayConfigService` in the L3 diagram. No diagram updates needed (spec §Architecture Changes confirms this).

---

### Task 0: Add `GetFetchCodesByAssetType` to `AssetDisplayConfigService`

**Files:**

- Modify: `src/go-backend/domain/service/interfaces.go` — add method to `AssetDisplayConfigService` interface
- Modify: `src/go-backend/domain/service/asset_display_config_service.go` — implement the method
- Modify: `src/go-backend/domain/service/price_alert_service_test.go` — add mock method to `mockPAConfigSvc`

**Security notes:** Read-only DB access through existing GORM parameterized queries. No user input.

**Step 1: Write the failing test**

Add a unit test in `src/go-backend/domain/service/asset_display_config_service_test.go` (or a new file if one doesn't exist) that tests `GetFetchCodesByAssetType`. But since this method will be on the interface and used by `buildEnabledSet`, the primary test coverage comes in Task 1 tests. For this step, just add a simple compile-verified test:

Actually — the cleanest TDD approach here is to add the method to the interface first (making compilations fail), then test it through the `buildEnabledSet` replacement in Task 1 tests. The interface addition is a prerequisite step. Proceed as follows:

**Step 1: Add method signature to interface**

In `src/go-backend/domain/service/interfaces.go`, add to `AssetDisplayConfigService` interface (after `ListAvailableTypeCodes`):

```go
// GetFetchCodesByAssetType returns a map from fetch code (asset_price.type_code) to the
// AssetDisplayConfig that owns it, for all enabled configs of the given assetType.
// Configs with no fetch codes are excluded.
// Returns empty map (not error) if no configs are found (cold-start / unconfigured).
GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error)
```

**Step 2: Run compile to verify it fails** (interface not implemented yet)

```bash
cd src/go-backend && go build ./... 2>&1 | grep "does not implement"
# Expected: asset_display_config_service missing GetFetchCodesByAssetType
```

**Step 3: Implement in `asset_display_config_service.go`**

```go
// GetFetchCodesByAssetType returns a map from fetch code (asset_price.type_code) to the
// AssetDisplayConfig that owns it, for all enabled configs of the given assetType.
// Configs with no fetch codes are excluded (they cannot resolve a price).
// Returns empty map on cold-start (no configs found).
func (s *assetDisplayConfigService) GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error) {
	configs, err := s.configRepo.ListAll(ctx, assetType)
	if err != nil {
		return nil, err
	}

	result := make(map[string]*models.AssetDisplayConfig)
	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}
		fetchCodes, err := s.fetchCodeRepo.ListByConfigID(ctx, cfg.ID)
		if err != nil {
			return nil, err
		}
		cfgCopy := cfg // capture loop variable
		for _, fc := range fetchCodes {
			result[fc.TypeCode] = cfgCopy
		}
	}

	return result, nil
}
```

**Step 4: Add mock method to `mockPAConfigSvc` in test file**

In `src/go-backend/domain/service/price_alert_service_test.go`, add after the existing `ListAvailableTypeCodes` mock:

```go
func (m *mockPAConfigSvc) GetFetchCodesByAssetType(ctx context.Context, assetType string) (map[string]*models.AssetDisplayConfig, error) {
	args := m.Called(ctx, assetType)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]*models.AssetDisplayConfig), args.Error(1)
}
```

**Step 5: Run compile to verify it passes**

```bash
cd src/go-backend && go build ./...
# Expected: clean build
```

**Step 6: Commit**

```
fix(price-alert): add GetFetchCodesByAssetType to AssetDisplayConfigService interface
```

---

### Task 1: Fix `buildEnabledSet` in `price_alert_service.go`

This is the core bug fix. Replace the broken `buildEnabledSet` closure with the new fetch-code-based approach implementing FR-1, FR-2, and FR-3.

**Files:**

- Modify: `src/go-backend/domain/service/price_alert_service.go`
- Modify: `src/go-backend/domain/service/price_alert_service_test.go`

**Security notes:** No user input. Logic change only — read path from DB through existing parameterized queries. No new external dependencies.

**Step 1: Write failing tests**

The existing tests use `configSvc.On("ListAll", ...)` which will no longer be called after the fix. Update existing tests to use `GetFetchCodesByAssetType` instead and add new coverage for FR-2 (name from DisplayName), FR-3 (deduplication), and edge cases.

**Test scenarios to cover:**

1. **Namespace mismatch fixed** — fetch code `"DOJI_AVPL_BAN_LE"` from config with DisplayName `"Doji 24K"` matches correctly.
2. **FR-2: mover name from DisplayName** — `mover.Name` is `"Doji 24K"` not `"DOJI_AVPL_BAN_LE"`.
3. **FR-3: deduplication** — two fetch codes for same config → only one mover emitted.
4. **Cold-start: empty map** — `GetFetchCodesByAssetType` returns empty map → no movers → no alerts.
5. **DB error** — `GetFetchCodesByAssetType` returns error → asset type skipped.
6. **Disabled config** — fetch code from a disabled config is not included (method already filters).
7. **All prices stale for a fetch-code match** — stale prices skipped (existing `p.IsStale` check preserved).
8. **Existing tests** — update `TestPriceAlertService_FirstRun_SetsBaselines` and `TestPriceAlertService_SignificantChange_TriggersAlert` to mock `GetFetchCodesByAssetType` instead of `ListAll`.

Add these tests to `price_alert_service_test.go`:

```go
// TestPriceAlertService_FetchCodeMatching verifies the fixed buildEnabledSet
// correctly maps fetch codes (asset_price.type_code) to display configs.
func TestPriceAlertService_FetchCodeMatching(t *testing.T) {
    t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "2.0")
    t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

    assetPriceSvc := new(mockPAAssetPriceSvc)
    notifRepo := new(mockPANotifRepo)
    userRepo := new(mockPAUserRepo)
    pushSvc := new(mockPAPushSvc)
    configSvc := new(mockPAConfigSvc)

    svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc, configSvc)
    ctx := context.Background()

    baselinePrice := int64(8_500_000_000)
    newPrice := int64(8_755_000_000) // ~3% increase
    setBaseline(mr, "DOJI_AVPL_BAN_LE", baselinePrice) // fetch code, not display code

    // asset_price has internal fetch code "DOJI_AVPL_BAN_LE"
    goldPrices := []*AssetPriceDTO{
        {TypeCode: "DOJI_AVPL_BAN_LE", Name: "DOJI AVPL", Buy: newPrice, Sell: newPrice + 10_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
    }
    silverPrices := []*AssetPriceDTO{}

    // GetFetchCodesByAssetType returns fetch code → config map
    dojiConfig := &models.AssetDisplayConfig{ID: 1, TypeCode: "Doji_24K", AssetType: "gold", DisplayName: "Doji 24K", Enabled: true}
    configSvc.On("GetFetchCodesByAssetType", ctx, "gold").Return(map[string]*models.AssetDisplayConfig{
        "DOJI_AVPL_BAN_LE": dojiConfig,
    }, nil)
    configSvc.On("GetFetchCodesByAssetType", ctx, "silver").Return(map[string]*models.AssetDisplayConfig{}, nil)

    assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
    assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
    userRepo.On("GetAllUserIDs", ctx).Return([]int32{1}, nil)
    notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
    pushSvc.On("SendToAll", ctx, mock.Anything, mock.Anything, "/dashboard/home").Return(nil)

    err := svc.CheckAndAlert(ctx)

    assert.NoError(t, err)
    // Verify notification body contains display name (not internal code)
    capturedNotifs := notifRepo.Calls[0].Arguments[1].([]*models.Notification)
    var meta map[string]interface{}
    _ = json.Unmarshal(capturedNotifs[0].Metadata, &meta)
    movers := meta["movers"].([]interface{})
    firstMover := movers[0].(map[string]interface{})
    assert.Equal(t, "Doji 24K", firstMover["name"], "mover name must be DisplayName, not raw fetch code")
}

// TestPriceAlertService_FetchCodeDeduplication verifies FR-3: multiple fetch codes
// for the same display config produce only one mover.
func TestPriceAlertService_FetchCodeDeduplication(t *testing.T) {
    t.Setenv("PRICE_ALERT_GOLD_VND_PCT", "0.5") // low threshold
    t.Setenv("PRICE_ALERT_COOLDOWN_MINUTES", "120")

    assetPriceSvc := new(mockPAAssetPriceSvc)
    notifRepo := new(mockPANotifRepo)
    userRepo := new(mockPAUserRepo)
    pushSvc := new(mockPAPushSvc)
    configSvc := new(mockPAConfigSvc)

    svc, mr := newPriceAlertServiceWithMiniredis(t, assetPriceSvc, notifRepo, userRepo, pushSvc, configSvc)
    ctx := context.Background()

    baselinePrice := int64(8_500_000_000)
    newPrice := int64(8_755_000_000) // ~3% increase
    setBaseline(mr, "SJC_CODE_A", baselinePrice)
    setBaseline(mr, "SJC_CODE_B", baselinePrice)

    sjcConfig := &models.AssetDisplayConfig{ID: 2, TypeCode: "SJC TD", AssetType: "gold", DisplayName: "Vàng SJC", Enabled: true}
    goldPrices := []*AssetPriceDTO{
        {TypeCode: "SJC_CODE_A", Name: "SJC A", Buy: newPrice, Sell: newPrice + 5_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
        {TypeCode: "SJC_CODE_B", Name: "SJC B", Buy: newPrice + 1_000_000, Sell: newPrice + 6_000_000, Currency: "VND", IsStale: false, FetchedAt: time.Now()},
    }
    silverPrices := []*AssetPriceDTO{}

    // Both fetch codes map to the SAME display config → should deduplicate
    configSvc.On("GetFetchCodesByAssetType", ctx, "gold").Return(map[string]*models.AssetDisplayConfig{
        "SJC_CODE_A": sjcConfig,
        "SJC_CODE_B": sjcConfig,
    }, nil)
    configSvc.On("GetFetchCodesByAssetType", ctx, "silver").Return(map[string]*models.AssetDisplayConfig{}, nil)

    assetPriceSvc.On("GetPricesByAssetType", ctx, "gold").Return(goldPrices, nil)
    assetPriceSvc.On("GetPricesByAssetType", ctx, "silver").Return(silverPrices, nil)
    userRepo.On("GetAllUserIDs", ctx).Return([]int32{1}, nil)
    notifRepo.On("BatchCreate", ctx, mock.AnythingOfType("[]*models.Notification")).Return(nil)
    pushSvc.On("SendToAll", ctx, mock.Anything, mock.Anything, "/dashboard/home").Return(nil)

    err := svc.CheckAndAlert(ctx)
    assert.NoError(t, err)

    // Verify only 1 mover (deduplication by config ID)
    capturedNotifs := notifRepo.Calls[0].Arguments[1].([]*models.Notification)
    var meta map[string]interface{}
    _ = json.Unmarshal(capturedNotifs[0].Metadata, &meta)
    movers := meta["movers"].([]interface{})
    assert.Len(t, movers, 1, "expected exactly 1 mover (deduplicated by display config ID)")
    firstMover := movers[0].(map[string]interface{})
    assert.Equal(t, "Vàng SJC", firstMover["name"])
}
```

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestPriceAlertService_FetchCode" ./domain/service/... 2>&1
# Expected: compile failure (GetFetchCodesByAssetType not yet used in service) or test failure
```

**Step 3: Implement the fix in `price_alert_service.go`**

Replace `buildEnabledSet` closure and gold/silver price loops with the fetch-code-based approach. The new `buildEnabledSet` returns `(map[string]*models.AssetDisplayConfig, bool)` where map key = fetch code (asset_price.type_code) and value = display config.

The deduplication (FR-3) tracks which config ID has already emitted a mover: `seenConfigIDs map[int32]bool`.

**New `buildEnabledSet` signature (internal closure):**

```go
buildEnabledSet := func(assetType string) (map[string]*models.AssetDisplayConfig, bool) {
    fcMap, err := s.configSvc.GetFetchCodesByAssetType(ctx, assetType)
    if err != nil {
        log.Printf("Price alert: failed to fetch %s fetch codes: %v — skipping asset type", assetType, err)
        return nil, false
    }
    if len(fcMap) == 0 {
        log.Printf("Price alert: no enabled configs with fetch codes for %s — skipping (cold-start or unconfigured)", assetType)
        return map[string]*models.AssetDisplayConfig{}, true
    }
    return fcMap, true
}
```

**New gold price loop (replaces lines 118–152 in current service):**

```go
enabledGold, ok := buildEnabledSet("gold")
if !ok {
    goto silverSection
}
var goldVND, goldUSD []priceMover
seenGoldConfigIDs := make(map[int32]bool)
for _, p := range goldPrices {
    cfg, matched := enabledGold[p.TypeCode]
    if !matched {
        continue // not in any enabled display config's fetch codes
    }
    if seenGoldConfigIDs[cfg.ID] {
        continue // FR-3: already emitted a mover for this display config
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
    // FR-2: use DisplayName for user-facing name
    mover.Name = cfg.DisplayName
    seenGoldConfigIDs[cfg.ID] = true
    if p.Currency == "VND" {
        goldVND = append(goldVND, *mover)
    } else {
        goldUSD = append(goldUSD, *mover)
    }
}
```

Apply the same pattern for the silver loop.

**Full replacement of `doCheckAndAlert` gold and silver sections** (keep everything else — cooldown, threshold, sort, notifications, push — unchanged):

```go
// Fetch gold prices from DB cache
goldPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")
if err != nil {
    log.Printf("Price alert: failed to fetch gold prices: %v", err)
} else {
    enabledGold, ok := buildEnabledSet("gold")
    if !ok {
        goto silverSection
    }
    var goldVND, goldUSD []priceMover
    seenGoldConfigIDs := make(map[int32]bool)
    for _, p := range goldPrices {
        cfg, matched := enabledGold[p.TypeCode]
        if !matched {
            continue
        }
        if seenGoldConfigIDs[cfg.ID] {
            continue // dedup: one mover per display config
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
        mover.Name = cfg.DisplayName
        seenGoldConfigIDs[cfg.ID] = true
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

silverSection:
silverPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "silver")
if err != nil {
    log.Printf("Price alert: failed to fetch silver prices: %v", err)
} else {
    enabledSilver, ok := buildEnabledSet("silver")
    if !ok {
        goto processCategories
    }
    var silverVND, silverUSD []priceMover
    seenSilverConfigIDs := make(map[int32]bool)
    for _, p := range silverPrices {
        cfg, matched := enabledSilver[p.TypeCode]
        if !matched {
            continue
        }
        if seenSilverConfigIDs[cfg.ID] {
            continue
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
        mover.Name = cfg.DisplayName
        seenSilverConfigIDs[cfg.ID] = true
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
```

**Step 4: Update existing tests that mock `ListAll` to mock `GetFetchCodesByAssetType` instead**

All existing test cases in `price_alert_service_test.go` that call:
```go
configSvc.On("ListAll", ctx, "gold").Return(...)
configSvc.On("ListAll", ctx, "silver").Return(...)
```
must be replaced with:
```go
configSvc.On("GetFetchCodesByAssetType", ctx, "gold").Return(...)
configSvc.On("GetFetchCodesByAssetType", ctx, "silver").Return(...)
```

For each existing test, translate the `AssetDisplayConfig` list (with TypeCode = asset_price type code) to the new `map[string]*models.AssetDisplayConfig` format:

Example — `TestPriceAlertService_FirstRun_SetsBaselines` was:
```go
configSvc.On("ListAll", ctx, "gold").Return([]*models.AssetDisplayConfig{
    {TypeCode: "SJL1L10", AssetType: "gold", Enabled: true},
    {TypeCode: "XAU", AssetType: "gold", Enabled: true},
}, nil)
```
Becomes:
```go
configSvc.On("GetFetchCodesByAssetType", ctx, "gold").Return(map[string]*models.AssetDisplayConfig{
    "SJL1L10": {ID: 1, TypeCode: "SJC-display", AssetType: "gold", DisplayName: "SJC 1L-10L", Enabled: true},
    "XAU":     {ID: 2, TypeCode: "XAU-display", AssetType: "gold", DisplayName: "Gold World", Enabled: true},
}, nil)
```

**Step 5: Run all price alert tests**

```bash
cd src/go-backend && go test -v -run "TestPriceAlertService" ./domain/service/...
# Expected: all tests PASS
```

**Step 6: Run full backend test suite**

```bash
cd src/go-backend && go test -short ./...
# Expected: clean
```

**Step 7: Run lint**

```bash
cd src/go-backend && task ci:backend-lint
# Expected: no depguard violations, no lint errors
```

**Step 8: Commit**

```
fix(price-alert): fix buildEnabledSet to use fetch codes for type_code matching

The enabled set was keyed by asset_display_config.type_code (display names like
"Doji_24K") but compared against asset_price.type_code (fetch codes like
"DOJI_AVPL_BAN_LE") — always false, silencing all scheduled alerts.

Fix: use GetFetchCodesByAssetType to build a fetchCode→config map.
Mover names now come from AssetDisplayConfig.DisplayName (FR-2).
Deduplication by config ID prevents one mover per fetch code (FR-3).
```

---

### Task 2: Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md`

**Steps:**

1. Read the current `flow-cross-cutting.md` price alert section.
2. Update the `buildEnabledSet` step to show:
   - **Before (broken):** `buildEnabledSet` reads `asset_display_config.type_code` → compares against `asset_price.type_code` (always false)
   - **After (fixed):** `buildEnabledSet` calls `GetFetchCodesByAssetType` → reads `asset_config_fetch_code.type_code` → matches `asset_price.type_code` correctly
3. Add notation for FR-2 (DisplayName for mover name) and FR-3 (dedup by config ID).
4. Commit:

```
docs(flow): update price alert flow diagram to reflect fetch-code-based filtering fix
```

---

## Execution Order

```
Task 0 (interface + mock) → Task 1 (core fix + tests) → Task 2 (docs)
```

Task 0 must complete before Task 1 (interface change needed for compile). Task 2 can be done in parallel with Task 1 but is blocked only by the implementation being done (to document the actual flow).

## Test Coverage Summary

| Scenario | Test Name |
|---------|-----------|
| First run sets baselines (updated) | `TestPriceAlertService_FirstRun_SetsBaselines` |
| Significant change triggers alert (updated) | `TestPriceAlertService_SignificantChange_TriggersAlert` |
| Fetch code namespace mismatch fixed | `TestPriceAlertService_FetchCodeMatching` (NEW) |
| FR-3: deduplication by config ID | `TestPriceAlertService_FetchCodeDeduplication` (NEW) |
| Cold-start empty map | Covered in updated first-run test |
| DB error skips asset type | Existing error path tests (update mock method name) |

## Verification Before Completion

- [ ] `go build ./...` clean
- [ ] `go test -short ./...` all pass
- [ ] `task ci:backend-lint` clean (no depguard violations)
- [ ] New tests cover FR-1, FR-2, FR-3 scenarios
- [ ] All existing price alert tests updated to use `GetFetchCodesByAssetType`
- [ ] Flow diagram updated
