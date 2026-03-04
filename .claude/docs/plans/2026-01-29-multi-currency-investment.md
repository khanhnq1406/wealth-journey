# Multi-Currency Investment Support Implementation Plan

**Created:** 2026-01-29
**Status:** Draft
**Approach:** Hybrid - Auto-detect from symbol, allow override, display in both native and preferred currencies

## Overview

Enable multi-currency support for investments where:
1. Currency is auto-detected from Yahoo Finance when selecting a symbol
2. User can override the detected currency if needed
3. Investment transactions inherit currency from parent investment
4. Display shows values in both native currency and user's preferred currency

## Current State Analysis

### What Already Exists
- `FXRate` model for storing exchange rates
- `Investment.Currency` field (defaults to USD)
- Backend conversion methods: `convertInvestmentValues()`, `enrichInvestmentProto()`
- Protobuf `display*` fields for converted values
- `CurrencyContext` for user's preferred currency
- Yahoo Finance Quote API returns `Currency` field

### What's Hardcoded
- `AddInvestmentForm.tsx:121` - `currency: "USD"`
- `AddInvestmentTransactionForm.tsx:170,183` - Labels say "(USD)"
- `InvestmentDetailModal.tsx` - Uses `formatCurrency()` without currency param

## Implementation Tasks

### Phase 1: Backend - Expose Currency from Symbol Search

#### Task 1.1: Add Currency Field to Search Result
**Files:** `api/protobuf/v1/investment.proto`, `src/go-backend/pkg/yahoo/search.go`

**Changes:**
1. Update `SearchResult` message in protobuf:
```protobuf
message SearchResult {
  string symbol = 1;
  string name = 2;
  string type = 3;
  string exchange = 4;
  string exchDisp = 5;
  string currency = 6;  // NEW: Trading currency (ISO 4217)
}
```

2. Update `SearchResult` struct in `search.go`:
```go
type SearchResult struct {
    Symbol   string `json:"symbol"`
    Name     string `json:"name"`
    Type     string `json:"type"`
    Exchange string `json:"exchange"`
    ExchDisp string `json:"exchDisp"`
    Currency string `json:"currency"`  // NEW
}
```

3. After search, fetch currency via quote API for top results (or use exchange-to-currency mapping)

**Alternative Approach (Simpler):** Create exchange-to-currency mapping:
```go
var exchangeToCurrency = map[string]string{
    "NMS": "USD",  // NASDAQ
    "NYQ": "USD",  // NYSE
    "NGM": "USD",  // NASDAQ Global Market
    "VNM": "VND",  // Vietnam
    "HKG": "HKD",  // Hong Kong
    "LSE": "GBP",  // London
    "TYO": "JPY",  // Tokyo
    "CCC": "USD",  // Cryptocurrency (traded in USD by default)
    // Add more as needed
}
```

**Estimated Effort:** 2-3 hours

---

#### Task 1.2: Create Currency Lookup Endpoint (Optional Enhancement)
**Files:** `api/protobuf/v1/investment.proto`, `src/go-backend/api/handlers/investment.go`

If exchange mapping is insufficient, create a dedicated endpoint to get currency for a symbol:
```protobuf
rpc GetSymbolCurrency(GetSymbolCurrencyRequest) returns (GetSymbolCurrencyResponse) {
  option (google.api.http) = {
    get: "/api/v1/investments/symbols/{symbol}/currency"
  };
}

message GetSymbolCurrencyRequest {
  string symbol = 1;
}

message GetSymbolCurrencyResponse {
  string symbol = 1;
  string currency = 2;
  string exchange = 3;
}
```

**Estimated Effort:** 1-2 hours (if needed)

---

### Phase 2: Frontend - Symbol Autocomplete Currency Detection

#### Task 2.1: Update SymbolAutocomplete to Pass Currency
**File:** `src/wj-client/components/forms/SymbolAutocomplete.tsx`

**Current:** Only passes `symbol` string to parent
**Required:** Pass full result object including currency

```typescript
// Change interface
interface SymbolAutocompleteProps {
  value: string;
  onChange: (symbol: string, result?: SearchResult) => void;  // Enhanced callback
  // ... other props
}

// Update handleSelect
const handleSelect = (result: SearchResult) => {
  onChange(result.symbol, result);  // Pass full result
  setOpen(false);
};
```

**Estimated Effort:** 30 minutes

---

#### Task 2.2: Update AddInvestmentForm with Currency Field
**File:** `src/wj-client/components/modals/forms/AddInvestmentForm.tsx`

**Changes:**
1. Add `currency` field to form state with default "USD"
2. Auto-populate currency when symbol is selected from autocomplete
3. Add currency dropdown for manual override
4. Update form labels to show selected currency

```typescript
// Add to form default values
defaultValues: {
  symbol: "",
  name: "",
  type: InvestmentType.INVESTMENT_TYPE_STOCK,
  initialQuantity: 0,
  initialCost: 0,
  currency: "USD",  // NEW
},

// Handle symbol selection
const handleSymbolChange = (symbol: string, result?: SearchResult) => {
  setValue("symbol", symbol);
  if (result?.name) {
    setValue("name", result.name);
  }
  if (result?.currency) {
    setValue("currency", result.currency);  // Auto-set currency
  }
};

// Update submit
createInvestmentMutation.mutate({
  ...data,
  currency: data.currency,  // Use form value instead of hardcoded "USD"
});
```

**UI Changes:**
- Add currency indicator next to cost input: "Total Initial Cost (USD)" → "Total Initial Cost ({currency})"
- Add small dropdown to override currency (collapsed by default)

**Estimated Effort:** 1-2 hours

---

#### Task 2.3: Update AddInvestmentTransactionForm
**File:** `src/wj-client/components/modals/forms/AddInvestmentTransactionForm.tsx`

**Changes:**
1. Accept `investmentCurrency` as prop
2. Update labels dynamically

```typescript
interface AddInvestmentTransactionFormProps {
  investmentId: number;
  investmentType: InvestmentType;
  investmentCurrency: string;  // NEW
  onSuccess?: () => void;
}

// Update labels
<FormNumberInput
  label={`Price per Unit (${investmentCurrency})`}
  // ...
/>
<FormNumberInput
  label={`Fees (${investmentCurrency})`}
  // ...
/>
```

**Estimated Effort:** 30 minutes

---

#### Task 2.4: Update InvestmentDetailModal
**File:** `src/wj-client/components/modals/InvestmentDetailModal.tsx`

**Changes:**
1. Pass `investmentCurrency` to `AddInvestmentTransactionForm`
2. Update display to show both native and converted values

```typescript
// Pass currency to transaction form
<AddInvestmentTransactionForm
  investmentId={investmentId}
  investmentType={investment.type}
  investmentCurrency={investment.currency || "USD"}  // NEW
  onSuccess={handleTransactionSuccess}
/>

// In Overview tab, show dual currencies
<div className="flex justify-between items-center">
  <span className="text-gray-600">Total Cost</span>
  <div className="text-right">
    <span>{formatCurrency(investment.totalCost, investment.currency)}</span>
    {investment.displayTotalCost && (
      <span className="text-xs text-gray-500 block">
        ≈ {formatCurrency(investment.displayTotalCost.amount, investment.displayCurrency)}
      </span>
    )}
  </div>
</div>
```

**Estimated Effort:** 1 hour

---

### Phase 3: Frontend - Portfolio Display with Dual Currencies

#### Task 3.1: Update Portfolio Page to Use Display Fields
**File:** `src/wj-client/app/dashboard/portfolio/page.tsx`

**Changes:**
1. Update `PortfolioSummaryCards` to use `display*` fields when available
2. Update `HoldingsTable` columns to show dual currencies

```typescript
// Portfolio summary - prefer display values
<BaseCard className="p-4">
  <div className="text-sm text-gray-600">Total Value</div>
  <div className="text-2xl font-bold text-gray-900 mt-1">
    {portfolioSummary.displayTotalValue
      ? formatCurrency(portfolioSummary.displayTotalValue.amount, portfolioSummary.displayCurrency)
      : formatCurrency(portfolioSummary.totalValue, portfolioSummary.currency)}
  </div>
</BaseCard>

// Holdings table - show native currency with conversion hint
{
  accessorKey: "currentValue",
  header: "Current Value",
  cell: (info) => {
    const row = info.row.original;
    const nativeCurrency = row.currency || "USD";
    return (
      <div>
        <span className="font-medium">
          {formatCurrency(row.currentValue, nativeCurrency)}
        </span>
        {row.displayCurrentValue && (
          <span className="text-xs text-gray-500 block">
            ≈ {formatCurrency(row.displayCurrentValue.amount, row.displayCurrency)}
          </span>
        )}
      </div>
    );
  },
}
```

**Estimated Effort:** 2 hours

---

#### Task 3.2: Update Helpers for Multi-Currency Formatting
**File:** `src/wj-client/app/dashboard/portfolio/helpers.tsx`

**Changes:**
1. Update `formatPrice` to use currency-specific decimal handling

```typescript
export const formatPrice = (
  price: number,
  type: InvestmentType,
  currency: string = "USD"
): string => {
  // Currency-specific formatting is handled by formatCurrencyUtil
  return formatCurrencyUtil(price, currency);
};
```

**Estimated Effort:** 30 minutes

---

### Phase 4: Backend - Ensure Display Fields Are Populated

#### Task 4.1: Verify enrichInvestmentProto Coverage
**File:** `src/go-backend/domain/service/investment_service.go`

**Verify these methods populate display fields:**
- `ListInvestments` - calls `enrichInvestmentProto` ✓
- `GetInvestment` - calls `enrichInvestmentProto` ✓
- `GetPortfolioSummary` - needs to populate display fields

**Changes for GetPortfolioSummary:**
```go
// In GetPortfolioSummary, after calculating totals
if user.PreferredCurrency != summary.Currency {
    // Convert totals
    displayTotalValue, _ := s.fxRateSvc.ConvertAmount(ctx, summary.TotalValue, summary.Currency, user.PreferredCurrency)
    displayTotalCost, _ := s.fxRateSvc.ConvertAmount(ctx, summary.TotalCost, summary.Currency, user.PreferredCurrency)
    displayTotalPnl, _ := s.fxRateSvc.ConvertAmount(ctx, summary.TotalPnl, summary.Currency, user.PreferredCurrency)

    summary.DisplayTotalValue = &Money{Amount: displayTotalValue, Currency: user.PreferredCurrency}
    summary.DisplayTotalCost = &Money{Amount: displayTotalCost, Currency: user.PreferredCurrency}
    summary.DisplayTotalPnl = &Money{Amount: displayTotalPnl, Currency: user.PreferredCurrency}
    summary.DisplayCurrency = user.PreferredCurrency
}
```

**Estimated Effort:** 1-2 hours

---

#### Task 4.2: Handle Mixed-Currency Portfolio Summary
**File:** `src/go-backend/domain/service/investment_service.go`

When a portfolio contains investments in multiple currencies (e.g., USD stocks + VND stocks), the summary needs special handling:

**Option A: Convert all to user's preferred currency before summing**
```go
func (s *investmentService) GetPortfolioSummary(ctx context.Context, userID int32, walletID int32) (*PortfolioSummary, error) {
    user, _ := s.userRepo.GetByID(ctx, userID)
    investments, _ := s.investmentRepo.ListByWalletID(ctx, walletID, nil)

    var totalValueInPreferred int64 = 0
    var totalCostInPreferred int64 = 0

    for _, inv := range investments {
        // Convert each investment's values to user's preferred currency
        if inv.Currency == user.PreferredCurrency {
            totalValueInPreferred += inv.CurrentValue
            totalCostInPreferred += inv.TotalCost
        } else {
            convertedValue, _ := s.fxRateSvc.ConvertAmount(ctx, inv.CurrentValue, inv.Currency, user.PreferredCurrency)
            convertedCost, _ := s.fxRateSvc.ConvertAmount(ctx, inv.TotalCost, inv.Currency, user.PreferredCurrency)
            totalValueInPreferred += convertedValue
            totalCostInPreferred += convertedCost
        }
    }

    return &PortfolioSummary{
        TotalValue: totalValueInPreferred,
        TotalCost: totalCostInPreferred,
        TotalPnl: totalValueInPreferred - totalCostInPreferred,
        Currency: user.PreferredCurrency,  // Summary is in user's preferred currency
    }, nil
}
```

**Estimated Effort:** 2-3 hours

---

### Phase 5: Generate Code & Testing

#### Task 5.1: Regenerate Protobuf Code
```bash
task proto:all
```

#### Task 5.2: Test Currency Detection
- Test symbol search returns correct currency
- Test US stocks (USD), Vietnamese stocks (VND), crypto (USD)
- Test manual currency override

#### Task 5.3: Test Display Conversion
- Create investment in USD, verify display in VND (if user pref is VND)
- Verify portfolio summary aggregates correctly across currencies

#### Task 5.4: Test Transaction Currency Inheritance
- Add transaction to USD investment → should use USD
- Add transaction to VND investment → should use VND

**Estimated Effort:** 2-3 hours

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Symbol Selection                             │
├─────────────────────────────────────────────────────────────────────┤
│  User types "AAPL"                                                   │
│       ↓                                                              │
│  SymbolAutocomplete → SearchSymbols API                             │
│       ↓                                                              │
│  Backend returns: { symbol: "AAPL", exchange: "NMS", currency: "USD"}│
│       ↓                                                              │
│  Form auto-fills: symbol="AAPL", currency="USD"                      │
│       ↓                                                              │
│  User can override currency if needed                                │
│       ↓                                                              │
│  Submit: CreateInvestment(symbol, currency, initialCost)             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Adding Transaction                           │
├─────────────────────────────────────────────────────────────────────┤
│  User opens Investment Detail (currency: USD)                        │
│       ↓                                                              │
│  AddInvestmentTransactionForm receives investmentCurrency="USD"      │
│       ↓                                                              │
│  Form displays: "Price per Unit (USD)", "Fees (USD)"                 │
│       ↓                                                              │
│  Submit: AddTransaction(investmentId, price, fees)                   │
│       ↓                                                              │
│  Backend uses investment.Currency for all calculations               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Display Values                               │
├─────────────────────────────────────────────────────────────────────┤
│  User's preferred currency: VND                                      │
│  Investment currency: USD                                            │
│       ↓                                                              │
│  Backend enrichInvestmentProto():                                    │
│    - totalCost: 15000 (USD cents = $150)                            │
│    - displayTotalCost: { amount: 3877500, currency: "VND" }         │
│       ↓                                                              │
│  Frontend displays:                                                  │
│    "$150.00" (native)                                                │
│    "≈ 3,877,500 VND" (converted)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `api/protobuf/v1/investment.proto` | Modify | Add `currency` to `SearchResult` |
| `src/go-backend/pkg/yahoo/search.go` | Modify | Add currency to search results |
| `src/go-backend/domain/service/investment_service.go` | Modify | Enhance portfolio summary for mixed currencies |
| `src/wj-client/components/forms/SymbolAutocomplete.tsx` | Modify | Pass full result to parent |
| `src/wj-client/components/modals/forms/AddInvestmentForm.tsx` | Modify | Add currency field, auto-detect |
| `src/wj-client/components/modals/forms/AddInvestmentTransactionForm.tsx` | Modify | Accept currency prop, update labels |
| `src/wj-client/components/modals/InvestmentDetailModal.tsx` | Modify | Pass currency, show dual values |
| `src/wj-client/app/dashboard/portfolio/page.tsx` | Modify | Use display fields, show dual currencies |
| `src/wj-client/app/dashboard/portfolio/helpers.tsx` | Modify | Minor updates for currency handling |

---

## Success Criteria

1. **Symbol Search**: When user selects "AAPL", currency auto-fills as "USD"
2. **Currency Override**: User can manually change currency before creating investment
3. **Transaction Currency**: Transaction form shows correct currency from parent investment
4. **Display Values**: Portfolio shows both native currency and user's preferred currency
5. **Portfolio Summary**: Correctly aggregates investments in different currencies
6. **No Breaking Changes**: Existing USD investments continue to work

---

## Estimated Total Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Backend - Search Currency | 2-4 hours |
| Phase 2 | Frontend - Forms | 3-4 hours |
| Phase 3 | Frontend - Display | 2.5 hours |
| Phase 4 | Backend - Display Fields | 3-5 hours |
| Phase 5 | Testing | 2-3 hours |
| **Total** | | **12-19 hours** |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Yahoo Finance doesn't return currency for some symbols | Medium | Use exchange-to-currency mapping as fallback |
| FX rate API unavailable | Low | Already handled - uses stale cache on failure |
| Mixed-currency portfolio calculation errors | High | Extensive testing with edge cases |
| Performance impact from FX conversions | Medium | Leverage existing cache infrastructure |

---

## Future Enhancements

1. **Historical FX Rates**: Store historical rates for accurate cost basis at transaction time
2. **Currency Selector in Wallets**: Allow wallet-level default currency
3. **FX Gain/Loss Tracking**: Track gains/losses from currency fluctuations separately from investment PNL
4. **Multi-Currency Reports**: Export reports with currency breakdown
