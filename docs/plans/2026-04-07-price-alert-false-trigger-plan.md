# Price Alert False Trigger — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `EvaluateAlerts` to normalize `currentPrice` from smallest currency units (cents) to whole units before comparing against `targetPrice` (always whole units).
**Spec:** `docs/specs/2026-04-07-price-alert-false-trigger-spec.md`
**Architecture:** The fix is a single-line change in `EvaluateAlerts` inside `user_price_alert_service.go`: divide `currentPrice` by `fx.GetDecimalMultiplier(alert.Currency)` before the comparison. No new components, no proto changes, no frontend changes.
**Tech Stack:** Go 1.25 · `wealthjourney/pkg/fx` (already in service package imports for other callers) · testify/mock

---

## Security Implementation Notes

- **Authentication**: N/A — fix is in background scheduler, no user request path.
- **Authorization**: N/A — no resource ownership involved.
- **Input validation**: `fx.GetDecimalMultiplier` is a pure in-memory map lookup; no external input. Safe for all known currencies and defaults to 100 for unknowns.
- **Data sanitization**: N/A — internal int64 arithmetic, no user data involved.
- **Risk**: Division by zero is impossible — `GetDecimalMultiplier` always returns ≥ 1.

---

## Component Reuse Inventory (Frontend Tasks)

No frontend work in this feature.

---

## C4 Architecture Diagram Updates

**No structural changes.** The fix is within an existing service method — no new components or dependencies. No C4 diagrams require updating.

---

## Runtime Flow Diagrams

The existing `docs/architecture/flow-investment.md` (or flow-cross-cutting.md if it contains the alert evaluation flow) should have the `EvaluateAlerts` flow updated to note the currency normalization step. This is a minor clarification comment, not a structural change.

**When to skip:** This is a one-line clarification comment in an existing flow — a separate flow update task is not warranted. The clarification can be included as a comment in the implementation commit.

---

### Task 1: Fix `EvaluateAlerts` — normalize `currentPrice` before comparison

**Files:**

- Modify: `src/go-backend/domain/service/user_price_alert_service.go` (lines ~363–378, the trigger condition block)
- Test: `src/go-backend/domain/service/user_price_alert_service_test.go`

**Security notes:** Pure arithmetic change on internal data — no new trust boundaries crossed.

**Step 1: Write the failing tests**

Add to `user_price_alert_service_test.go`:

```go
func TestUserPriceAlertService_EvaluateAlerts_CryptoUSD_NoFalsePositive(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketDataSvc := new(mockAlertMarketDataSvc)
	notifRepo := new(mockAlertNotifRepo)
	pushSvc := new(mockAlertPushSvc)
	svc := &userPriceAlertService{
		alertRepo:        alertRepo,
		assetPriceSvc:    &mockAlertAssetPriceSvc{},
		marketDataSvc:    marketDataSvc,
		displayConfigSvc: &mockAlertDisplayConfigSvc{},
		notifRepo:        notifRepo,
		pushSvc:          pushSvc,
		rdb:              nil,
	}
	ctx := context.Background()

	now := time.Now()
	// BTC-USD alert: fires "above $100,000"
	activeAlerts := []*models.UserPriceAlert{
		{
			ID:          20,
			UserID:      1,
			Symbol:      "BTC-USD",
			Name:        "Bitcoin",
			AssetType:   int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTO),
			Currency:    "USD",
			PriceSide:   "buy",
			Direction:   "above",
			TargetPrice: 100000, // $100,000 whole units
			TriggerMode: "once",
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	alertRepo.On("ListActive", ctx).Return(activeAlerts, nil)
	// currentPrice = 6852028 cents = $68,520.28 — BELOW threshold of $100,000
	marketDataSvc.On("GetPrice", mock.Anything, "BTC-USD", "USD",
		v1.InvestmentType_INVESTMENT_TYPE_CRYPTO, 15*time.Minute).
		Return(&models.MarketData{Price: 6852028}, nil)

	err := svc.EvaluateAlerts(ctx)

	assert.NoError(t, err)
	// Alert must NOT fire — no notification, no status update
	notifRepo.AssertNotCalled(t, "Create")
	alertRepo.AssertNotCalled(t, "UpdateStatus")
}

func TestUserPriceAlertService_EvaluateAlerts_CryptoUSD_CorrectlyFires(t *testing.T) {
	alertRepo := new(mockUserPriceAlertRepo)
	marketDataSvc := new(mockAlertMarketDataSvc)
	notifRepo := new(mockAlertNotifRepo)
	pushSvc := new(mockAlertPushSvc)
	svc := &userPriceAlertService{
		alertRepo:        alertRepo,
		assetPriceSvc:    &mockAlertAssetPriceSvc{},
		marketDataSvc:    marketDataSvc,
		displayConfigSvc: &mockAlertDisplayConfigSvc{},
		notifRepo:        notifRepo,
		pushSvc:          pushSvc,
		rdb:              nil,
	}
	ctx := context.Background()

	now := time.Now()
	// BTC-USD alert: fires "above $100,000"
	activeAlerts := []*models.UserPriceAlert{
		{
			ID:          21,
			UserID:      1,
			Symbol:      "BTC-USD",
			Name:        "Bitcoin",
			AssetType:   int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTO),
			Currency:    "USD",
			PriceSide:   "buy",
			Direction:   "above",
			TargetPrice: 100000, // $100,000 whole units
			TriggerMode: "once",
			Status:      "active",
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}

	alertRepo.On("ListActive", ctx).Return(activeAlerts, nil)
	// currentPrice = 10000001 cents = $100,000.01 — ABOVE threshold of $100,000
	marketDataSvc.On("GetPrice", mock.Anything, "BTC-USD", "USD",
		v1.InvestmentType_INVESTMENT_TYPE_CRYPTO, 15*time.Minute).
		Return(&models.MarketData{Price: 10000001}, nil)
	notifRepo.On("Create", mock.Anything, mock.AnythingOfType("*models.Notification")).Return(nil)
	pushSvc.On("SendToUser", mock.Anything, int32(1), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)
	alertRepo.On("UpdateStatus", mock.Anything, int32(21), "triggered", mock.Anything, int32(1)).Return(nil)

	err := svc.EvaluateAlerts(ctx)

	assert.NoError(t, err)
	// Alert MUST fire
	notifRepo.AssertCalled(t, "Create", mock.Anything, mock.AnythingOfType("*models.Notification"))
	alertRepo.AssertCalled(t, "UpdateStatus", mock.Anything, int32(21), "triggered", mock.Anything, int32(1))
}
```

**Step 2: Run tests to verify they fail (RED)**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestUserPriceAlertService_EvaluateAlerts_CryptoUSD -v
```

Expected output: both tests fail — `NoFalsePositive` fires unexpectedly (unit mismatch causes false trigger), `CorrectlyFires` also fails (false trigger happens but comparison logic is reversed).

**Step 3: Write minimal implementation**

In `user_price_alert_service.go`, add import `"wealthjourney/pkg/fx"` (if not already present), then in `EvaluateAlerts`, before the trigger condition:

```go
// Normalize currentPrice from smallest currency units (cents) to whole units
// to match targetPrice which is stored in whole units (user input).
// For VND: multiplier=1, no change. For USD/EUR/etc: divides by 100.
multiplier := fx.GetDecimalMultiplier(alert.Currency)
normalizedPrice := currentPrice / multiplier

// Check trigger condition
var fired bool
switch alert.Direction {
case "above":
    fired = normalizedPrice >= alert.TargetPrice
case "below":
    fired = normalizedPrice <= alert.TargetPrice
}
```

The `currentPrice` variable (used for metadata/notification body placeholders) must remain in its **raw cents form** so `FormatUserAlertPrice` displays it correctly. Only the comparison uses `normalizedPrice`.

> **Critical:** Do NOT replace `currentPrice` with `normalizedPrice` in the `placeholders` map or `metadata` map — `FormatUserAlertPrice` already handles the formatting for display.

Full diff region in `EvaluateAlerts` (around line 363–382):

```go
// Before fix:
// Check trigger condition
var fired bool
switch alert.Direction {
case "above":
    fired = currentPrice >= alert.TargetPrice
case "below":
    fired = currentPrice <= alert.TargetPrice
}

// After fix:
// Normalize currentPrice from smallest currency units to whole units
// (targetPrice is always stored in whole units — user input convention).
// GetDecimalMultiplier("VND") = 1 (no-op). GetDecimalMultiplier("USD") = 100.
multiplier := fx.GetDecimalMultiplier(alert.Currency)
normalizedPrice := currentPrice / multiplier

// Check trigger condition
var fired bool
switch alert.Direction {
case "above":
    fired = normalizedPrice >= alert.TargetPrice
case "below":
    fired = normalizedPrice <= alert.TargetPrice
}
```

**Step 4: Run tests to verify they pass (GREEN)**

```bash
cd src/go-backend && go test -short ./domain/service/... -run TestUserPriceAlertService_EvaluateAlerts_CryptoUSD -v
```

Expected: both new tests pass.

**Step 5: Run full service test suite (no regressions)**

```bash
cd src/go-backend && go test -short ./domain/service/... -v 2>&1 | tail -30
```

Expected: all existing tests pass, including `GoldAlert_TriggeredFromDB` (VND multiplier=1, no behavioral change) and `GoldAlert_StalePrice_NotTriggered`.

**Step 6: Run lint check**

```bash
cd src/go-backend && task ci:backend-lint
```

Expected: no errors. `pkg/fx` is already a depguard-approved import in the service layer (used in `interfaces.go` and `fx_rate_service.go`).

**Step 7: Commit**

```
fix(price-alert): normalize currentPrice to whole units before comparison in EvaluateAlerts

USD-denominated prices (stocks, crypto, gold USD) are stored in smallest
currency units (cents: ×100) while targetPrice is stored in whole units
(user input). Dividing by fx.GetDecimalMultiplier(currency) before the
comparison fixes false triggers for USD alerts.

VND is unaffected: multiplier=1, division is a no-op.
```
