# Fix: Currency Investment Price Auto-Fill — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix two bugs in the Add Investment form for FOREIGN_CURRENCY: (1) price per unit is never auto-filled after currency selection, (2) the currency badge is interactive allowing the user to change currency away from VND.

**Spec:** `docs/specs/2026-04-09-fix-currency-investment-price-autofill-spec.md`

**Architecture:** Three-layer fix: backend routes FOREIGN_CURRENCY in `GetPrice` to VCB DB cache; frontend calls `setSelectedSymbol` on currency selection to enable the price query; frontend locks the currency badge to read-only VND for FOREIGN_CURRENCY. No new components, no proto changes.

**Tech Stack:** Go (market data service), React/TypeScript (AddInvestmentForm)

## Security Implementation Notes

- Authentication: `GetMarketPrice` endpoint already JWT-protected — no change
- Authorization: Price fetch is read-only public-ish data — no ownership concern
- Input validation: Symbol from API dropdown (not free-text); `ResolvePrice` returns error for unknown symbols — handler converts to `success: false` gracefully
- Data sanitization: No user-typed data goes into price resolution

## Component Reuse Inventory

**Existing components to reuse:**

| Component       | Location                             | Usage                                   |
| --------------- | ------------------------------------ | --------------------------------------- |
| `CurrencyBadge` | `components/forms/CurrencyBadge.tsx` | Keep for non-FOREIGN_CURRENCY; replace with static span for FOREIGN_CURRENCY |
| Static badge span | Already in AddInvestmentForm.tsx line 1071–1075 | Reuse same pattern for FOREIGN_CURRENCY VND lock |

**New components needed:** None.

## C4 Architecture Diagram Updates

`c4-component-backend.md` — minor update to `MarketDataService` description to note FOREIGN_CURRENCY routing to `AssetDisplayConfigService`.

---

### Task 1: Backend — Route FOREIGN_CURRENCY in `GetPrice` to VCB DB Cache

**Files:**

- Modify: `src/go-backend/domain/service/market_data_service.go` (lines 84–91, the type routing block in `GetPrice`)
- Modify: `src/go-backend/domain/service/market_data_service_test.go` (add test)

**Security notes:** ResolvePrice returns error for unknown symbols — no data leakage. Return `success: false` (not 500) for unknown symbols. This matches existing gold/silver error handling pattern.

**Step 1: Write the failing test**

Add to `market_data_service_test.go`:

```go
func TestGetPrice_ForeignCurrency_UsesResolvePrice(t *testing.T) {
    // Arrange
    mockDisplaySvc := &mockAssetDisplayConfigService{}
    mockDisplaySvc.On("ResolvePrice", mock.Anything, "USD_VCB", "currency").
        Return(int64(2600000), int64(2620000), false, nil)
    svc := newTestMarketDataService(mockDisplaySvc)

    // Act
    result, err := svc.GetPrice(context.Background(), "USD_VCB", "VND",
        investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

    // Assert
    assert.NoError(t, err)
    assert.Equal(t, int64(2600000), result.Price)
    assert.Equal(t, "USD_VCB", result.Symbol)
    assert.Equal(t, "VND", result.Currency)
    mockDisplaySvc.AssertExpectations(t)
}

func TestGetPrice_ForeignCurrency_StalePrice_ReturnedWithWarning(t *testing.T) {
    mockDisplaySvc := &mockAssetDisplayConfigService{}
    mockDisplaySvc.On("ResolvePrice", mock.Anything, "EUR_VCB", "currency").
        Return(int64(2900000), int64(2930000), true, nil) // isStale=true
    svc := newTestMarketDataService(mockDisplaySvc)

    result, err := svc.GetPrice(context.Background(), "EUR_VCB", "VND",
        investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

    assert.NoError(t, err) // stale price is still returned, not error
    assert.Equal(t, int64(2900000), result.Price)
}

func TestGetPrice_ForeignCurrency_UnknownSymbol_ReturnsError(t *testing.T) {
    mockDisplaySvc := &mockAssetDisplayConfigService{}
    mockDisplaySvc.On("ResolvePrice", mock.Anything, "FAKE", "currency").
        Return(int64(0), int64(0), false, errors.New("not found"))
    svc := newTestMarketDataService(mockDisplaySvc)

    result, err := svc.GetPrice(context.Background(), "FAKE", "VND",
        investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY, 15*time.Minute)

    assert.Error(t, err)
    assert.Nil(t, result)
}
```

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestGetPrice_ForeignCurrency" -v
```

Expected: compilation or assertion failure (branch doesn't exist yet).

**Step 3: Write minimal implementation**

In `market_data_service.go`, in the `GetPrice` method, add a branch for FOREIGN_CURRENCY before the final `else`:

```go
} else if investmentType == investmentv1.InvestmentType_INVESTMENT_TYPE_FOREIGN_CURRENCY {
    priceData, err = s.fetchCurrencyPriceFromDB(ctx, symbol, currency)
} else {
    priceData, err = s.fetchPriceFromAPI(ctx, symbol, currency)
}
```

Add the new private method below `fetchSilverPriceFromDB`:

```go
// fetchCurrencyPriceFromDB fetches the FOREIGN_CURRENCY buy rate from the
// AssetDisplayConfigService DB cache (populated by the Vietcombank fetcher every 15m).
// Returns the buy price in VND (int64, no decimal scaling needed — stored as-is).
func (s *marketDataService) fetchCurrencyPriceFromDB(ctx context.Context, symbol, currency string) (*models.MarketData, error) {
    buy, _, isStale, err := s.assetDisplayConfigService.ResolvePrice(ctx, symbol, "currency")
    if err != nil {
        return nil, fmt.Errorf("currency price unavailable for %s: %w", symbol, err)
    }
    if isStale {
        log.Printf("[marketDataService] stale VCB price for %s — using last known value %d", symbol, buy)
    }
    return &models.MarketData{
        Symbol:    symbol,
        Currency:  currency,
        Price:     buy,
        Change24h: 0,
        Volume24h: 0,
        Timestamp: time.Now(),
    }, nil
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test ./domain/service/... -run "TestGetPrice_ForeignCurrency" -v
```

**Step 5: Run lint check**

```bash
cd src/go-backend && task ci:backend-lint
```

**Step 6: Commit**

```
fix(market-data): route FOREIGN_CURRENCY in GetPrice to VCB DB cache
```

---

### Task 2: Frontend — Fix Currency Selection to Enable Price Query + Lock Currency Badge to VND

**Files:**

- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- Modify: `src/wj-client/features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx`

**Security notes:** Symbol comes from API dropdown only — no free-text input. No user input reaches the price query directly; `setValue("symbol", value)` + `setSelectedSymbol(value)` both use the API-provided typeCode.

**Step 0: Component inventory check**

- Reusing: static badge span (already in file at line 1071–1075) — same pattern for FOREIGN_CURRENCY VND lock
- No new components needed

**Step 1: Write failing tests**

Add to `AddInvestmentForm.forex.test.tsx`:

```typescript
it('calls setSelectedSymbol equivalent: enables price query after currency selection', async () => {
  // Arrange
  const user = userEvent.setup();
  renderForexForm();
  // Select a currency from the dropdown
  const select = screen.getByRole('combobox', { name: /currency/i });
  await user.selectOptions(select, 'USD_VCB');
  // Assert: useQueryGetMarketPrice should have been called with symbol='USD_VCB'
  expect(mockUseQueryGetMarketPrice).toHaveBeenCalledWith(
    expect.objectContaining({ symbol: 'USD_VCB' }),
    expect.objectContaining({ enabled: true }),
  );
});

it('shows VND as read-only badge (not interactive CurrencyBadge) for FOREIGN_CURRENCY', () => {
  renderForexForm();
  // The CurrencyBadge interactive dropdown should NOT be present
  expect(screen.queryByRole('button', { name: /currency/i })).not.toBeInTheDocument();
  // A static "VND" text badge should be present
  expect(screen.getByText('VND')).toBeInTheDocument();
});

it('auto-fills pricePerUnit when currency price is fetched', async () => {
  mockUseQueryGetMarketPrice.mockReturnValue({
    data: { data: { priceDecimal: 26000 } },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  });
  const user = userEvent.setup();
  renderForexForm();
  const select = screen.getByRole('combobox', { name: /currency/i });
  await user.selectOptions(select, 'USD_VCB');
  // pricePerUnit field should show the fetched value
  const priceInput = screen.getByLabelText(/price per unit/i);
  expect(priceInput).toHaveValue(26000);
});
```

**Step 2: Run tests to verify they fail**

```bash
cd src/wj-client && npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage --watchAll=false
```

**Step 3: Implement the fixes in AddInvestmentForm.tsx**

**Fix A** — In currency dropdown `onChange` (around line 684), add `setSelectedSymbol(value)`:

```typescript
onChange={(value) => {
  setValue("symbol", value);
  setSelectedSymbol(value);  // ← ADD THIS LINE
  const selected = currencyDisplayPricesQuery.data?.prices?.find(
    (p) => p.typeCode === value,
  );
  if (selected) {
    setValue("name", selected.displayName);
    setValue("currency", "VND");
  }
}}
```

**Fix B** — Lock currency badge to VND for FOREIGN_CURRENCY. Replace the `CurrencyBadge` block (lines 1063–1075):

```typescript
{/* CurrencyBadge - hidden for custom investments and FOREIGN_CURRENCY */}
{!isCustomInvestment && !isForeignCurrencyInvestment && (
  <CurrencyBadge
    value={currency}
    onChange={(newCurrency) => setValue("currency", newCurrency)}
    disabled={isSubmitting || isGoldInvestment || isSilverInvestment || isSymbolSelected}
  />
)}
{/* Display only badge for custom investments and FOREIGN_CURRENCY (always VND) */}
{(isCustomInvestment || isForeignCurrencyInvestment) && (
  <span className="px-2 py-1 text-xs font-medium bg-v2-maroon-900 text-v2-gold-accent rounded">
    {isForeignCurrencyInvestment ? "VND" : (currency || "USD")}
  </span>
)}
```

**Fix C** — Add FOREIGN_CURRENCY to the `isStandardWithSymbol` exclusion and add a dedicated currency price query. Replace `isStandardWithSymbol` definition (around line 249):

```typescript
const isStandardWithSymbol =
  !isGoldInvestment &&
  !isSilverInvestment &&
  !isForeignCurrencyInvestment &&  // ← ADD THIS
  !isCustomInvestment &&
  !!selectedSymbol &&
  selectedSymbol.length >= 2;

// Currency price query — for FOREIGN_CURRENCY, use same GetMarketPrice endpoint
// but route through the VCB DB cache (backend handles the routing by investmentType)
const currencyPriceQuery = useQueryGetMarketPrice(
  {
    symbol: selectedSymbol,
    currency: "VND",
    type: Number(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY) as InvestmentType,
  },
  {
    enabled: isForeignCurrencyInvestment && !!selectedSymbol,
    refetchOnMount: "always",
    staleTime: 5 * 60 * 1000,
  },
);
```

**Fix D** — Add auto-fill useEffect for currency price:

```typescript
// Auto-fill price per unit from currency market price (VCB buy rate in VND)
useEffect(() => {
  if (isForeignCurrencyInvestment && currencyPriceQuery.data?.data?.priceDecimal) {
    setValue("pricePerUnit", currencyPriceQuery.data.data.priceDecimal);
  }
}, [isForeignCurrencyInvestment, currencyPriceQuery.data, setValue]);
```

**Fix E** — Add loading/error state display + refresh button for FOREIGN_CURRENCY.

Add below the currency options dropdown block (after `</BasicFormSelect>` around line 698):

```typescript
{/* Currency price loading/error state */}
{selectedSymbol && currencyPriceQuery.isLoading && (
  <p className="text-xs text-v2-text-tertiary mt-2 ml-1">
    {t("form.loadingPrice")}
  </p>
)}
{selectedSymbol && currencyPriceQuery.isError && (
  <p className="text-xs text-red-500 mt-2 ml-1">
    {t("form.unableToFetchPrice")}
  </p>
)}
```

Update the `isRefreshing` flag (around line 517):

```typescript
const isRefreshing =
  (isGoldInvestment && goldPriceQuery.isFetching) ||
  (isSilverInvestment && silverPriceQuery.isFetching) ||
  (isStandardWithSymbol && standardPriceQuery.isFetching) ||
  (isForeignCurrencyInvestment && currencyPriceQuery.isFetching);  // ← ADD
```

Update the refresh button condition (around line 1092):

```typescript
{(isGoldInvestment || isSilverInvestment || isStandardWithSymbol ||
  (isForeignCurrencyInvestment && !!selectedSymbol)) && (
  <button
    type="button"
    onClick={() => {
      if (isGoldInvestment) goldPriceQuery.refetch();
      else if (isSilverInvestment) silverPriceQuery.refetch();
      else if (isForeignCurrencyInvestment) currencyPriceQuery.refetch();
      else if (isStandardWithSymbol) standardPriceQuery.refetch();
    }}
    ...
  >
```

**Fix F** — Reset `selectedSymbol` when navigating away from FOREIGN_CURRENCY. In `handleUITypeChange`, the existing line `setSelectedSymbol("")` already handles this (line 461). Verify it's called for all type changes. ✓

**Step 4: Run tests to verify they pass**

```bash
cd src/wj-client && npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage --watchAll=false
```

**Step 5: Run full frontend CI**

```bash
cd src/wj-client && task ci:frontend
```

**Step 6: Playwright E2E Audit**

Update `src/wj-client/tests/e2e/add-foreign-currency-investment-flow.spec.ts` to add:
- Test that price per unit auto-fills after currency selection
- Test that the currency badge shows "VND" and is not interactive (no dropdown)

Do NOT run the tests.

**Step 7: Commit**

```
fix(investment): auto-fill currency price on symbol select; lock price currency to VND
```

---

### Task 3: Update C4 Architecture Diagram

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`

**Step 1:** Update `MarketDataService` component description to mention FOREIGN_CURRENCY routing to AssetDisplayConfigService.

**Step 2:** Commit

```
docs(c4): update MarketDataService to document FOREIGN_CURRENCY price routing
```

---

### Task 4: Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-investment.md`

**Step 1:** In section 12 "Currency Price Refresh", add or update a note/sub-diagram showing the frontend `GetMarketPrice` call path (distinct from the scheduler path). Show the `GetMarketPrice` → `GetPrice` → `fetchCurrencyPriceFromDB` → `ResolvePrice` → `asset_price` DB flow.

**Step 2:** Commit

```
docs(flow): document GetMarketPrice frontend call path for FOREIGN_CURRENCY
```

## Task Ordering

1. **Task 1** (Backend) — implement first so the endpoint works correctly
2. **Task 2** (Frontend) — depends on backend being correct; can be done in parallel with Task 1 if mocking
3. **Task 3** (C4 diagram) — after Task 1
4. **Task 4** (Flow diagram) — after Tasks 1+2

## Test Commands Summary

```bash
# Backend
cd src/go-backend
go test ./domain/service/... -run "TestGetPrice_ForeignCurrency" -v
task ci:backend-lint

# Frontend
cd src/wj-client
npx jest features/investment/forms/__tests__/AddInvestmentForm.forex.test.tsx --no-coverage --watchAll=false
task ci:frontend
```
