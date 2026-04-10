# Investment Currency Assets — Auto Current Price Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Connect FOREIGN_CURRENCY investments to the existing asset display price system so portfolio shows real-time/cached exchange rates automatically — no more manual price updates required.
**Spec:** `docs/specs/2026-04-09-feat-investment-currency-assets-current-price-spec.md`
**Architecture:** The backend `MarketDataService.UpdatePricesForInvestments()` will gain a fourth routing branch for FOREIGN_CURRENCY type investments, delegating price lookup to `AssetDisplayConfigService.ResolvePrice(ctx, symbol, "currency")` — identical to how gold/silver investments work. The frontend `AddInvestmentForm.tsx` replaces the free-text currency symbol input with a dropdown populated from `useQueryGetAssetDisplayPrices({ assetType: "currency" })`, and removes the `isCustom=true` side-effect for FOREIGN_CURRENCY type.
**Tech Stack:** Go 1.25 (backend service layer), React 19 + Next.js 16.2 + TypeScript 5 (frontend form), Protocol Buffers (no proto changes needed), PostgreSQL via GORM

## Security Implementation Notes

- **Authentication:** Investment creation is JWT-protected; `userID` always comes from token, never from request body — no change needed
- **Authorization:** All investment queries already filter by `user_id` via existing GORM patterns — no change needed
- **Input validation:** Currency symbol (from dropdown) must be validated server-side: `typeCode` must match an enabled entry in `asset_display_config` with `asset_type = "currency"`. Add this check in the service layer for new FOREIGN_CURRENCY investments with `isCustom = false`
- **Data sanitization:** No user-controlled SQL — all queries use GORM parameterized queries. The `symbol` field is already length-validated by the handler
- **Financial data integrity:** `currentPrice` stored as `int64` VND (no float). `currentValue = (quantity / 10000) × currentPrice`. The `divisor=10000` is already applied by `Recalculate()` for FOREIGN_CURRENCY (falls through to default 10000)

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `RHFFormSelect` | `components/forms/RHFFormSelect.tsx` | Currency dropdown in AddInvestmentForm for FOREIGN_CURRENCY |
| `FormSelect` | `components/forms/FormSelect.tsx` | Base select (via RHFFormSelect wrapper) |
| `useQueryGetAssetDisplayPrices` | `utils/generated/hooks.ts` | Fetches enabled currency configs from API |
| Loading/empty state | Inline JSX (existing gold pattern) | Shown while currency options load or when empty |

**New components needed:**

None. All UI needs covered by existing components (same pattern as gold type options).

## C4 Architecture Diagram Updates

Per spec section "Architecture Changes (C4)":
- `docs/architecture/c4-component-backend.md`: Add arrow `InvestmentService → AssetDisplayConfigService: ResolvePrice(typeCode, "currency")`
  *(Note: arrow already exists from MarketDataService → AssetDisplayConfigService; InvestmentService calls MarketDataService, so the new direct dependency is actually MarketDataService using AssetDisplayConfigService for a new type — no new arrow needed at L3 level unless InvestmentService gets direct dep)*
- `docs/architecture/c4-component-frontend.md`: Document `AddInvestmentForm → useQueryGetAssetDisplayPrices({ assetType: "currency" })` data flow

---

## Task 0: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read both files to find the relevant diagram sections
2. In `c4-component-backend.md`: Note that `MarketDataService` already has an arrow to `AssetDisplayConfigService`. Update the label or add a note that it now also resolves currency prices (FOREIGN_CURRENCY type)
3. In `c4-component-frontend.md`: Add `AddInvestmentForm` dependency on `useQueryGetAssetDisplayPrices` with `assetType: "currency"` — mirror how gold/silver already appear
4. Commit: `docs(architecture): update C4 diagrams for currency investment price feature`

---

## Task 1: Backend — Route FOREIGN_CURRENCY in `UpdatePricesForInvestments()`

This is the core backend change. We add a fourth routing branch in `MarketDataService.UpdatePricesForInvestments()` to handle FOREIGN_CURRENCY, grouped by symbol, calling `ResolvePrice` once per unique currency symbol.

**Files:**
- Modify: `src/go-backend/domain/service/market_data_service.go`
- Test: `src/go-backend/domain/service/market_data_service_test.go` (create if doesn't exist, or add to existing)

**Security notes:** `ResolvePrice` reads from admin-configured `asset_price` table — no user data involved. Error path logs a warning and skips the investment (no crash). Symbol is already validated on creation.

**Step 1: Write the failing test**

Create/add to `src/go-backend/domain/service/market_data_service_test.go`:

```go
// TestUpdatePricesForInvestments_ForeignCurrency tests that FOREIGN_CURRENCY investments
// are grouped by symbol and resolved via AssetDisplayConfigService.ResolvePrice.
func TestUpdatePricesForInvestments_ForeignCurrency(t *testing.T) {
    ctx := context.Background()

    mockAssetSvc := &MockAssetDisplayConfigService{}
    mockMarketDataRepo := &MockMarketDataRepository{}

    svc := &marketDataService{
        marketDataRepo:            mockMarketDataRepo,
        assetDisplayConfigService: mockAssetSvc,
        goldConverter:             gold.NewGoldConverter(nil),
        silverConverter:           silver.NewSilverConverter(nil),
    }

    investments := []*models.Investment{
        {ID: 1, Symbol: "USD", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
        {ID: 2, Symbol: "USD", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
        {ID: 3, Symbol: "EUR", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
    }

    // ResolvePrice should be called ONCE per unique symbol, not once per investment
    mockAssetSvc.On("ResolvePrice", ctx, "USD", "currency").Return(int64(25500000), int64(25600000), false, nil).Once()
    mockAssetSvc.On("ResolvePrice", ctx, "EUR", "currency").Return(int64(27800000), int64(27900000), false, nil).Once()

    updates, err := svc.UpdatePricesForInvestments(ctx, investments, false)

    assert.NoError(t, err)
    assert.Equal(t, int64(25500000), updates[1]) // USD investment 1 → buy price
    assert.Equal(t, int64(25500000), updates[2]) // USD investment 2 → same price (batched)
    assert.Equal(t, int64(27800000), updates[3]) // EUR investment 3 → buy price
    mockAssetSvc.AssertExpectations(t)
}

// TestUpdatePricesForInvestments_ForeignCurrency_ResolveError tests graceful skip on error
func TestUpdatePricesForInvestments_ForeignCurrency_ResolveError(t *testing.T) {
    ctx := context.Background()

    mockAssetSvc := &MockAssetDisplayConfigService{}
    mockMarketDataRepo := &MockMarketDataRepository{}

    svc := &marketDataService{
        marketDataRepo:            mockMarketDataRepo,
        assetDisplayConfigService: mockAssetSvc,
        goldConverter:             gold.NewGoldConverter(nil),
        silverConverter:           silver.NewSilverConverter(nil),
    }

    investments := []*models.Investment{
        {ID: 1, Symbol: "XYZ", Type: int32(investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY), Currency: "VND"},
    }

    // ResolvePrice returns error → investment is skipped, no crash
    mockAssetSvc.On("ResolvePrice", ctx, "XYZ", "currency").Return(int64(0), int64(0), false, errors.New("not configured")).Once()

    updates, err := svc.UpdatePricesForInvestments(ctx, investments, false)

    assert.NoError(t, err)           // outer function must not fail
    assert.Empty(t, updates)          // XYZ skipped
    mockAssetSvc.AssertExpectations(t)
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./domain/service/... -run TestUpdatePricesForInvestments_ForeignCurrency -v
```

Expected: compilation error or test failure (function not yet implemented).

**Step 3: Write minimal implementation**

In `src/go-backend/domain/service/market_data_service.go`, modify `UpdatePricesForInvestments()`:

Add a fourth group variable after line 134:

```go
var currencyInvestments []*models.Investment    // FOREIGN_CURRENCY investments
```

Update the type-routing loop (after the existing `} else {` for regularInvestments):

```go
} else if investmentv1.InvestmentType(inv.Type) == investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY {
    currencyInvestments = append(currencyInvestments, inv)
} else {
    regularInvestments = append(regularInvestments, inv)
}
```

Add currency price resolution block AFTER gold/silver processing (after line 204):

```go
// Process FOREIGN_CURRENCY investments — batch by symbol (one ResolvePrice call per unique symbol)
if len(currencyInvestments) > 0 {
    // Group by symbol
    bySymbol := make(map[string][]*models.Investment)
    for _, inv := range currencyInvestments {
        bySymbol[inv.Symbol] = append(bySymbol[inv.Symbol], inv)
    }
    // Resolve price once per symbol
    for symbol, group := range bySymbol {
        buy, _, isStale, err := s.assetDisplayConfigService.ResolvePrice(ctx, symbol, "currency")
        if err != nil {
            log.Printf("Warning: ResolvePrice failed for currency %s: %v — skipping %d investments", symbol, err, len(group))
            continue
        }
        if isStale {
            log.Printf("Warning: stale price for currency %s — using last known value %d", symbol, buy)
        }
        for _, inv := range group {
            updates[inv.ID] = buy
        }
    }
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./domain/service/... -run TestUpdatePricesForInvestments_ForeignCurrency -v
```

Expected: PASS.

**Step 5: Run full lint + build to verify no depguard violations**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

```
feat(investment): route FOREIGN_CURRENCY investments through AssetDisplayConfigService in UpdatePricesForInvestments

Groups investments by symbol, calls ResolvePrice("currency") once per unique symbol.
Logs warning and skips on error — does not fail the full price update job.
```

---

## Task 2: Backend — Stop Forcing `isCustom = true` for FOREIGN_CURRENCY in `CreateInvestment()`

The investment service currently sets `currentPrice = averageCost` for FOREIGN_CURRENCY regardless of `isCustom`. We need to ensure that when `isCustom = false` is sent from the frontend (new behavior), the investment is eligible for auto-update. No code change needed for the `IsCustom: req.IsCustom` line (line 245) — but we must verify the frontend no longer forces `isCustom=true` for FOREIGN_CURRENCY.

**Important:** The backend currently does NOT force `isCustom = true` for FOREIGN_CURRENCY — it uses `req.IsCustom` directly (line 245). The forcing happens in the **frontend** (`handleUITypeChange` calls `setIsCustomInvestment(true)`). This task is a backend verification + test to document the existing correct behavior.

**Files:**
- Test: `src/go-backend/domain/service/investment_service_test.go`
- Modify: `src/go-backend/domain/service/investment_service.go` — no code change expected, but add a comment clarifying that `isCustom` is now caller-controlled for FOREIGN_CURRENCY

**Security notes:** Validate that the backend does NOT override `isCustom` — it must trust the value from the request (which the frontend will now set to `false` for new investments). Server-side: the `symbol` must match an enabled currency in asset display config when `isCustom=false` — see Task 3 for this validation.

**Step 1: Write the failing test (documents expected behavior)**

In `src/go-backend/domain/service/investment_service_test.go`, add:

```go
// TestCreateInvestment_ForeignCurrency_IsCustomFalse tests that FOREIGN_CURRENCY
// investments are created with isCustom=false when the caller specifies it.
func TestCreateInvestment_ForeignCurrency_IsCustomFalse(t *testing.T) {
    // Setup mocks...
    // Key assertion: investment.IsCustom == false when req.IsCustom == false
    // Key assertion: investment.CurrentPrice == averageCost (line 224-229 always seeds this)
}
```

**Step 2: Run test to verify baseline**

```bash
cd src/go-backend && go test ./domain/service/... -run TestCreateInvestment_ForeignCurrency -v
```

**Step 3: Add clarifying comment** in `investment_service.go` at line 244-245:

```go
IsCustom: req.IsCustom, // For FOREIGN_CURRENCY: false = auto-updated via AssetDisplayConfigService; true = manual override (legacy)
```

**Step 4: Run tests + lint**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 5: Commit**

```
docs(investment): clarify FOREIGN_CURRENCY isCustom behavior in CreateInvestment

The backend never forces isCustom for FOREIGN_CURRENCY — it stores whatever the caller sends.
New investments created with isCustom=false will receive auto price updates via
AssetDisplayConfigService. Existing isCustom=true investments continue using manual path.
```

---

## Task 3: Backend — Add Server-Side Validation for FOREIGN_CURRENCY Symbol

When `isCustom = false` for a FOREIGN_CURRENCY investment, the `symbol` must match an enabled currency in `asset_display_config`. This prevents orphaned investments that `UpdatePrices` would silently skip.

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go`
- Modify: `src/go-backend/domain/service/interfaces.go` — verify `AssetDisplayConfigService` interface has needed method
- Test: `src/go-backend/domain/service/investment_service_test.go`

**Security notes:** Server-side validation only — never trust client dropdown selection alone. Validate after binding, before DB write.

**Step 1: Check available method on AssetDisplayConfigService**

Read `src/go-backend/domain/service/interfaces.go` to find `ListForInvestment(ctx, assetType)` — returns enabled configs where `show_in_investment = true`. We use this to validate the symbol.

**Step 2: Write the failing test**

```go
func TestCreateInvestment_ForeignCurrency_InvalidSymbol(t *testing.T) {
    // req.IsCustom = false, req.Symbol = "XYZ" not in currency config
    // Expected: validation error returned, no DB write
}
```

**Step 3: Add validation in `CreateInvestment()`**

In `investment_service.go`, after the duplicate-check block and before model creation, add for FOREIGN_CURRENCY + `!req.IsCustom`:

```go
// For non-custom FOREIGN_CURRENCY investments, validate symbol is in asset display config
if req.Type == v1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY && !req.IsCustom {
    configs, err := s.assetDisplayConfigService.ListForInvestment(ctx, "currency")
    if err != nil {
        return nil, fmt.Errorf("failed to validate currency symbol: %w", err)
    }
    validSymbol := false
    for _, cfg := range configs {
        if cfg.TypeCode == req.Symbol {
            validSymbol = true
            break
        }
    }
    if !validSymbol {
        return nil, apperrors.NewValidationError(fmt.Sprintf("currency %q is not available for investment", req.Symbol))
    }
}
```

**Note:** This requires `investmentService` to have access to `assetDisplayConfigService`. Check if it's already a dependency — from the service wiring in `services.go`, `investmentSvc` currently depends on `marketDataSvc` but NOT directly on `assetDisplayConfigSvc`. We need to add it.

**Step 4: Add `assetDisplayConfigService` dependency to `investmentService`**

In `src/go-backend/domain/service/investment_service.go`:
- Add `assetDisplayConfigService AssetDisplayConfigService` to the `investmentService` struct
- Add it to `NewInvestmentService()` constructor parameter list

In `src/go-backend/domain/service/services.go`:
- Pass `assetDisplayConfigSvc` to `NewInvestmentService()` call (it's already created in Phase 1, line 60)

In `src/go-backend/internal/app/providers.go` / `services.go`:
- Update wiring to pass `assetDisplayConfigSvc` as new parameter

**Step 5: Run tests + lint**

```bash
cd src/go-backend && task ci:backend-lint && go test ./domain/service/... -v
```

**Step 6: Commit**

```
feat(investment): validate FOREIGN_CURRENCY symbol against asset display config on creation

When isCustom=false, the currency symbol must match an enabled entry in asset_display_config.
Prevents orphaned investments that UpdatePrices would silently skip.
Also wires AssetDisplayConfigService into investmentService constructor.
```

---

## Task 4: Frontend — Replace Free-Text Symbol with Currency Dropdown in `AddInvestmentForm`

Replace the manual text input and `isCustom=true` enforcement for FOREIGN_CURRENCY with a dropdown populated from `useQueryGetAssetDisplayPrices({ assetType: "currency" })`.

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- Test: `src/wj-client/features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx` (create new)

**Security notes:** Dropdown options come from the backend's public endpoint — no sensitive data. The `symbol` value is set from API-returned `typeCode`, not from free-text user input. Server-side validation (Task 3) is the authoritative check.

**Step 0: Component inventory check**

- `RHFFormSelect` — reuse (same as used for gold brand selection)
- `useQueryGetAssetDisplayPrices` — reuse (same hook used for gold/silver)
- Loading state — use inline conditional (same pattern as gold type options loading)
- Empty state — show inline message (same pattern as gold empty state)

**Step 1: Write the failing test**

Create `src/wj-client/features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx`:

```typescript
// Tests:
// 1. When FOREIGN_CURRENCY type is selected, currency dropdown is fetched from API
// 2. useQueryGetAssetDisplayPrices is called with { assetType: "currency" }
// 3. Dropdown shows displayName options from API response
// 4. Selecting a currency sets form symbol to typeCode (e.g. "USD")
// 5. isCustom is sent as false (not forced to true)
// 6. Empty state message shown when no currencies configured
// 7. Loading state shown while fetching

// Mock pattern (from AddInvestmentForm.silver.test.tsx):
const mockCurrencyQueryState = { data: null, isLoading: false, isError: false };
const mockUseQueryGetAssetDisplayPrices = jest.fn((payload) => {
  if (payload.assetType === "currency") return mockCurrencyQueryState;
  // ... gold/silver defaults
});
jest.mock("@/utils/generated/hooks", () => ({
  useQueryGetAssetDisplayPrices: (...args) => mockUseQueryGetAssetDisplayPrices(...args),
  // ... other hooks
}));
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage
```

Expected: tests fail (feature not yet implemented).

**Step 3: Implement the currency dropdown**

In `AddInvestmentForm.tsx`:

**3a. Add currency query (alongside gold/silver queries, ~line 267):**

```typescript
const currencyDisplayPricesQuery = useQueryGetAssetDisplayPrices(
  { assetType: "currency" },
  { enabled: isForeignCurrencyInvestment, staleTime: 5 * 60 * 1000 }
);
```

**3b. Derive `isForeignCurrencyInvestment` boolean:**

```typescript
const isForeignCurrencyInvestment =
  selectedUIType === String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY);
```

**3c. Build currency options:**

```typescript
const currencyOptions = useMemo(() => {
  if (!isForeignCurrencyInvestment) return [];
  return (currencyDisplayPricesQuery.data?.prices ?? [])
    .filter((p) => p.showInInvestment)
    .map((p) => ({ value: p.typeCode, label: p.displayName }));
}, [isForeignCurrencyInvestment, currencyDisplayPricesQuery.data]);
```

**3d. Update `handleUITypeChange`** — remove `setIsCustomInvestment(true)` for FOREIGN_CURRENCY (keep it for CASH):

```typescript
} else if (value === String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY)) {
  setValue("type", InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY);
  setIsCustomInvestment(false); // ← changed from true
  setValue("symbol", "");
  setValue("name", "");
} else if (value === String(InvestmentType.INVESTMENT_TYPE_CASH)) {
  setValue("type", InvestmentType.INVESTMENT_TYPE_CASH);
  setIsCustomInvestment(true); // ← keep for CASH
  setValue("symbol", "");
  setValue("name", "");
}
```

**3e. Update `isCashOrForeignCurrency` references** — since FOREIGN_CURRENCY is no longer custom, update the condition that was used to show custom fields. Derive separately:

```typescript
const isCashInvestment =
  selectedUIType === String(InvestmentType.INVESTMENT_TYPE_CASH);
const isCashOrForeignCurrency = isCashInvestment || isForeignCurrencyInvestment;
```

Any places that used `isCashOrForeignCurrency` to enforce custom-only UI — split them. CASH keeps `isCustomInvestment=true` behavior; FOREIGN_CURRENCY gets new dropdown path.

**3f. Replace FOREIGN_CURRENCY symbol input with currency dropdown** (find the section that shows symbol/name inputs for `isCashOrForeignCurrency`):

```tsx
{/* FOREIGN_CURRENCY — currency selection from API */}
{isForeignCurrencyInvestment && (
  <div>
    {currencyDisplayPricesQuery.isLoading && (
      <p className="text-sm text-v2-gold-accent">{t("form.loadingCurrencies")}</p>
    )}
    {!currencyDisplayPricesQuery.isLoading && currencyOptions.length === 0 && (
      <p className="text-sm text-v2-error">{t("form.noCurrenciesConfigured")}</p>
    )}
    {currencyOptions.length > 0 && (
      <RHFFormSelect
        name="symbol"
        control={control}
        label={t("form.currencyLabel")}
        options={currencyOptions}
        required
        disabled={isSubmitting || currencyDisplayPricesQuery.isLoading}
        portal
        onChange={(value) => {
          // Set name to displayName for the selected currency
          const selected = currencyDisplayPricesQuery.data?.prices?.find(
            (p) => p.typeCode === value
          );
          if (selected) setValue("name", selected.displayName);
        }}
      />
    )}
  </div>
)}
```

**3g. Update `investment-schema.ts`** — `FOREIGN_CURRENCY` is already in `FLEXIBLE_SYMBOL_TYPES` (allows any symbol format). No change needed for schema — symbol validation already allows typeCode format like "USD", "EUR".

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage
```

**Step 5: Check i18n — add missing keys**

Add to translation files (`messages/en.json`, `messages/vi.json`):
- `"form.loadingCurrencies"` → "Loading currencies..." / "Đang tải tiền tệ..."
- `"form.noCurrenciesConfigured"` → "No currencies available for investment" / "Chưa có tiền tệ nào được cấu hình"

**Step 6: Responsive & accessibility check**

- Dropdown uses `portal={true}` — consistent with gold/silver selects
- Mobile: dropdown renders in portal, avoids viewport clip issues
- `sm:` breakpoint (800px): layout follows existing form column pattern
- No `<img>` tags added — not applicable

**Step 7: Playwright E2E Audit — write/update tests only, do NOT run**

Check `tests/e2e/` for existing investment creation tests. Update to cover:
- FOREIGN_CURRENCY dropdown populated from API
- Selecting a currency fills symbol field
- Form submits with `isCustom: false` for FOREIGN_CURRENCY

**Step 8: Commit**

```
feat(investment-form): replace free-text FOREIGN_CURRENCY symbol with API-driven currency dropdown

Fetches enabled currencies from asset display config (assetType="currency").
Sets isCustom=false for FOREIGN_CURRENCY investments — enables auto price updates.
CASH type retains isCustom=true (manual price path unchanged).
```

---

## Task 5: Backend — Ensure `priceUpdatedAt` is Set for FOREIGN_CURRENCY in Price Refresh

When `UpdatePricesForInvestments` returns price updates for FOREIGN_CURRENCY investments, the existing `UpdatePrices()` in `investment_service.go` passes them to `s.investmentRepo.UpdatePrices()` via `repository.PriceUpdate`. Verify that `priceUpdatedAt` is set in this path.

**Files:**
- Read: `src/go-backend/domain/repository/investment_repository.go` — check `UpdatePrices()` sets `price_updated_at`
- Read: `src/go-backend/domain/service/investment_service.go` lines 1620-1669 — check how `priceUpdates` map is used to build `PriceUpdate` structs

**Security notes:** None (internal DB write path, no user input).

**Step 1: Read repository UpdatePrices implementation**

```bash
grep -n "price_updated_at\|PriceUpdatedAt\|UpdatePrices" src/go-backend/domain/repository/investment_repository.go | head -30
```

**Step 2: If `priceUpdatedAt` is already set by the existing path — no code change needed. Document this finding.**

If NOT set, add `PriceUpdatedAt: time.Now()` to the `PriceUpdate` struct construction in `investment_service.go`.

**Step 3: Write a unit test verifying `priceUpdatedAt` is set after FOREIGN_CURRENCY price refresh**

```go
// TestUpdatePrices_ForeignCurrency_SetsPriceUpdatedAt
// Verifies that after UpdatePricesForInvestments returns FOREIGN_CURRENCY prices,
// the investment repository receives PriceUpdate structs with non-zero PriceUpdatedAt.
```

**Step 4: Run test**

```bash
cd src/go-backend && go test ./domain/service/... -run TestUpdatePrices_ForeignCurrency -v
```

**Step 5: Commit** (if any code changes made)

```
fix(investment): set priceUpdatedAt for FOREIGN_CURRENCY investments in auto price refresh
```

---

## Task 6: Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Read `docs/architecture/flow-investment.md` to understand existing sequence diagrams
2. Add new sequence: "Currency Investment Price Refresh"

```
sequenceDiagram
    participant Scheduler as Background Scheduler (15m)
    participant InvSvc as InvestmentService
    participant MktSvc as MarketDataService
    participant AssetSvc as AssetDisplayConfigService
    participant DB as PostgreSQL

    Scheduler->>InvSvc: UpdatePrices(ctx, userID)
    InvSvc->>DB: ListByUserID (filter isCustom=false)
    DB-->>InvSvc: [investments incl. FOREIGN_CURRENCY]
    InvSvc->>MktSvc: UpdatePricesForInvestments(investments)

    Note over MktSvc: Group by type

    loop per unique currency symbol
        MktSvc->>AssetSvc: ResolvePrice(symbol, "currency")
        AssetSvc->>DB: SELECT asset_price WHERE type_code=symbol AND asset_type="currency"
        DB-->>AssetSvc: price rows ordered by priority
        AssetSvc-->>MktSvc: (buy, sell, isStale, err)
    end

    MktSvc-->>InvSvc: map[investmentID]→buy price
    InvSvc->>InvSvc: investment.Recalculate() per updated investment
    InvSvc->>DB: UpdatePrices(PriceUpdate{CurrentPrice, priceUpdatedAt})
```

3. Update "Market price update" note in existing flow to include FOREIGN_CURRENCY type
4. Add "Key Invariants" section:
   - FOREIGN_CURRENCY grouped by symbol — O(currencies), not O(investments)
   - Error per symbol is non-fatal — logged and skipped
   - `isStale=true` prices are still stored (stale > 0)
   - `priceUpdatedAt` always updated on successful resolution
5. Commit: `docs(flow): add FOREIGN_CURRENCY price refresh sequence to flow-investment.md`

---

## Task 7: Database Migration — Enable `ShowInInvestment` for Currency Configs

Per spec and memory note: `ShowInInvestment=false` for all currency display configs currently. Need to create a migration that sets `show_in_investment=true` for currency configs (or at least USD, EUR, GBP, JPY, CNY, KRW, SGD).

**Files:**
- Create: `src/go-backend/cmd/migrate-currency-investment/main.go`
- Modify: `Taskfile.yml` — add `backend:migrate-currency-investment` task

**Security notes:** Admin-only data — no user input involved. Migration is idempotent (only updates if currently false).

**Step 1: Check existing migration pattern**

```bash
ls src/go-backend/cmd/ | grep migrate
```

Read one existing migration file (e.g., `cmd/migrate-vietcombank-currency/main.go`) to understand the pattern.

**Step 2: Create migration**

```go
// cmd/migrate-currency-investment/main.go
// Sets show_in_investment=true for all enabled currency asset display configs
// Run: task backend:migrate-currency-investment
```

Key SQL:
```sql
UPDATE asset_display_configs
SET show_in_investment = true
WHERE asset_type = 'currency' AND enabled = true AND deleted_at IS NULL;
```

**Step 3: Add to Taskfile.yml**

```yaml
backend:migrate-currency-investment:
  desc: Enable show_in_investment for currency asset display configs
  dir: src/go-backend
  cmds:
    - go run cmd/migrate-currency-investment/main.go
```

**Step 4: Run migration locally to verify**

```bash
task backend:migrate-currency-investment
```

**Step 5: Commit**

```
feat(migration): enable show_in_investment for currency asset display configs

Allows FOREIGN_CURRENCY investment form to show currency options from asset display config.
Idempotent — safe to re-run.
```

---

## Task 8: Verify Full Integration + CI

**Files:** No new files — just running CI.

**Steps:**

1. Run backend CI:
```bash
task ci:backend-lint && task ci:backend
```

2. Run frontend CI:
```bash
task ci:frontend
```

3. Verify all tests pass:
   - Backend service tests for Task 1 and Task 3
   - Frontend component tests for Task 4
   - No lint violations

4. **Manual sanity check (local):**
   - Create a new FOREIGN_CURRENCY investment with USD (via form)
   - Verify `is_custom = false` in DB
   - Trigger price update manually
   - Verify `current_price` is populated from VCB rates
   - Verify portfolio shows auto-calculated current value

5. Commit any final fixup:
```
chore(ci): verify full integration for currency investment feature
```

---

## Summary: Task Order & Dependencies

```
Task 0 (C4 diagrams) — independent, can be done anytime
Task 1 (Backend routing) — core, do first
Task 2 (isCustom comment/test) — can be done alongside Task 1
Task 3 (server-side validation) — depends on Task 1 (needs investmentService dep on assetDisplayConfigSvc)
Task 4 (Frontend form) — independent of backend tasks (can run in parallel with Tasks 1-3)
Task 5 (priceUpdatedAt check) — depends on Task 1
Task 6 (Flow diagrams) — depends on Tasks 1-3 being understood
Task 7 (Migration) — independent, do before deploy
Task 8 (CI verification) — last, after all tasks
```

**Parallel-safe pairs for subagent dispatch:**
- Tasks 1+2 together (same file, same agent)
- Task 4 alone (frontend only)
- Task 0+6 together (docs only)
- Task 7 alone (migration only)
- Task 3 after Task 1 (needs new dependency wiring)
- Task 5 after Task 1
- Task 8 last
