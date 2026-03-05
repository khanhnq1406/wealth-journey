# Frontend Currency Display Implementation Plan

**Date:** 2025-01-29
**Priority:** High
**Status:** Planning
**Parent Feature:** Multi-Currency System (Phase 4 - Frontend Implementation)

---

## Executive Summary

This plan ensures **ALL frontend UI components display monetary values using the user's preferred currency** from the multi-currency system. While Phase 4 of the multi-currency implementation updated some components, many still use hard-coded "VND" references or the legacy `currencyFormatter`. This plan systematically updates all remaining components to use dynamic currency formatting.

**Current State:**
- ✅ Multi-currency backend infrastructure complete (Phase 1-3)
- ✅ `CurrencyContext` and `useCurrency()` hook available
- ✅ `formatCurrency(amount, currency)` utility supports 10 currencies
- ⚠️ Only ~40% of frontend components use dynamic currency
- ⚠️ Many components still use legacy `currencyFormatter` (VND-only)
- ⚠️ Form inputs have hard-coded "VND" suffixes

**Goal:**
- 🎯 Update all display components to use `useCurrency()` hook
- 🎯 Update all form inputs to show dynamic currency unit
- 🎯 Update all charts/graphs to use dynamic currency formatting
- 🎯 Remove all hard-coded "VND" references
- 🎯 Deprecate legacy `currencyFormatter` (VND-only)

---

## Architecture Overview

### Currency System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CurrencyContext                         │
│  - currency: string (from Redux auth state)                │
│  - isConverting: boolean (from backend API)                │
│  - updateCurrency: (newCurrency: string) => Promise<void>  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    useCurrency() Hook                       │
│  - Provides currency to any component                       │
│  - Must be used within CurrencyProvider                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              formatCurrency(amount, currency)               │
│  - Handles 10 currencies (VND, USD, EUR, GBP, etc.)       │
│  - Proper decimal handling (VND/JPY: 0, others: 2)        │
│  - Locale-specific formatting                              │
└─────────────────────────────────────────────────────────────┘
```

### Component Update Pattern

**Before (Hard-coded VND):**
```typescript
import { currencyFormatter } from "@/utils/currency-formatter";

// Display
{currencyFormatter.format(amount)}

// Form input
<FormNumberInput suffix="VND" />

// Chart tooltip
formatter={(value) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value)
}
```

**After (Dynamic Currency):**
```typescript
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";

const { currency } = useCurrency();

// Display
{formatCurrency(amount, currency)}

// Form input
<FormNumberInput suffix={currency} />

// Chart tooltip
formatter={(value) => formatCurrency(value, currency)}
```

---

## Component Inventory

### Phase 1: Display Components (High Priority)

#### 1.1 Wallet Balance Displays
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/home/Walllets.tsx` | 33 | `currencyFormatter.format()` | Replace with `formatCurrency(amount, currency)` |
| `app/dashboard/wallets/WalletCard.tsx` | 59 | ✅ Already uses `formatCurrency` | Verify `displayCurrency` usage |
| `app/dashboard/home/TotalBalance.tsx` | 22 | ✅ Already uses dynamic currency | No change |

#### 1.2 Transaction Amount Displays
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/transaction/TransactionItem.tsx` | 101 | `currencyFormatter.format()` | Replace with `formatCurrency(amount, currency)` |
| `app/dashboard/transaction/TransactionTable.tsx` | 110 | `currencyFormatter.format()` | Replace with `formatCurrency(amount, currency)` |
| `app/dashboard/transaction/TransactionGroup.tsx` | TBD | Unknown | Investigate and update if needed |

#### 1.3 Budget Amount Displays
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/budget/BudgetCard.tsx` | 98, 102 | `currencyFormatter.format()` | Replace with `formatCurrency(amount, currency)` |
| `app/dashboard/budget/BudgetItemCard.tsx` | 96 | `currencyFormatter.format()` | Replace with `formatCurrency(amount, currency)` |

#### 1.4 Investment Value Displays
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/portfolio/page.tsx` | Various | ✅ Already uses `formatCurrency` | Verify all instances use `currency` |
| `components/modals/InvestmentDetailModal.tsx` | Various | ✅ Already uses `formatCurrency` | Verify all instances use `currency` |
| `app/dashboard/portfolio/helpers.tsx` | 5-7 | ✅ Already uses multi-currency | No change |

#### 1.5 Chart/Graph Tooltips
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/home/Balance.tsx` | 114-120 | Hard-coded VND formatter | Replace with `formatCurrency(value, currency)` |
| `app/dashboard/home/Dominance.tsx` | 92-95 | Hard-coded VND formatter | Replace with `formatCurrency(value, currency)` |
| `app/dashboard/home/MonthlyDominance.tsx` | 104-107 | Hard-coded VND formatter | Replace with `formatCurrency(value, currency)` |
| `app/dashboard/home/AccountBalance.tsx` | 86-90 | ✅ Already uses dynamic currency | No change |

#### 1.6 Report Tables
| File | Line | Current | Action |
|------|------|---------|--------|
| `app/dashboard/report/ExpandableTable.tsx` | 32-39, 167, 186, 211, 250, 255 | Hard-coded `formatCurrency("VND")` | Replace with dynamic `currency` parameter |
| `app/dashboard/report/FinancialTable.tsx` | TBD | Unknown | Investigate and update if needed |

### Phase 2: Form Input Components (High Priority)

#### 2.1 Transaction Forms
| File | Line | Current | Action |
|------|------|---------|--------|
| `components/modals/forms/AddTransactionForm.tsx` | 206, 150 | Hard-coded "VND" | Replace with `currency` from `useCurrency()` |
| `components/modals/forms/EditTransactionForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |

#### 2.2 Wallet Forms
| File | Line | Current | Action |
|------|------|---------|--------|
| `components/modals/forms/CreateWalletForm.tsx` | 117, 71 | Hard-coded "VND" | Replace with `currency` from `useCurrency()` |
| `components/modals/forms/EditWalletForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |
| `components/modals/forms/TransferMoneyForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |

#### 2.3 Budget Forms
| File | Line | Current | Action |
|------|------|---------|--------|
| `components/modals/forms/CreateBudgetForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |
| `components/modals/forms/EditBudgetForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |
| `components/modals/forms/CreateBudgetItemForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |
| `components/modals/forms/EditBudgetItemForm.tsx` | TBD | Hard-coded "VND" (likely) | Replace with dynamic `currency` |

#### 2.4 Investment Forms
| File | Line | Current | Action |
|------|------|---------|--------|
| `components/modals/forms/AddInvestmentForm.tsx` | TBD | May have currency input | Verify and update if needed |
| `components/modals/forms/AddInvestmentTransactionForm.tsx` | TBD | May have currency input | Verify and update if needed |

### Phase 3: Utility & Helper Components (Medium Priority)

#### 3.1 Wallet Selection Dropdowns
| File | Action |
|------|--------|
| `components/select/FormSelect.tsx` | Update wallet balance display to use dynamic currency |
| `components/modals/DeleteWalletModal.tsx` | Replace raw formatting `{(w.balance?.amount ?? 0) / 1000}k {w.currency}` with `formatCurrency()` |

#### 3.2 Table Components
| File | Action |
|------|--------|
| `components/table/MobileTable.tsx` | Verify and update currency formatting if needed |
| `components/table/TanStackTable.tsx` | Verify and update currency formatting if needed |

### Phase 4: CSV Export & Utilities (Low Priority)

| File | Action |
|------|--------|
| `utils/csv-export.ts` | Update to include currency information in exports |

---

## Implementation Tasks

### Task 1: Update Display Components (Phase 1)

**Goal:** Replace all `currencyFormatter` and hard-coded VND formatters with dynamic currency formatting.

**Components to Update:**

1. **Wallet Lists**
   - `app/dashboard/home/Walllets.tsx` - Replace `currencyFormatter` with `formatCurrency(amount, currency)`

2. **Transaction Lists**
   - `app/dashboard/transaction/TransactionItem.tsx` - Replace `currencyFormatter` with `formatCurrency(amount, currency)`
   - `app/dashboard/transaction/TransactionTable.tsx` - Replace `currencyFormatter` with `formatCurrency(amount, currency)`

3. **Budget Components**
   - `app/dashboard/budget/BudgetCard.tsx` - Replace `currencyFormatter` with `formatCurrency(amount, currency)`
   - `app/dashboard/budget/BudgetItemCard.tsx` - Replace `currencyFormatter` with `formatCurrency(amount, currency)`

4. **Charts & Graphs**
   - `app/dashboard/home/Balance.tsx` - Replace hard-coded VND formatter in Tooltip
   - `app/dashboard/home/Dominance.tsx` - Replace hard-coded VND formatter in Tooltip
   - `app/dashboard/home/MonthlyDominance.tsx` - Replace hard-coded VND formatter in Tooltip

5. **Report Tables**
   - `app/dashboard/report/ExpandableTable.tsx` - Replace hard-coded "VND" parameter with dynamic `currency`

**Implementation Pattern:**

```typescript
// Step 1: Import useCurrency hook
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";

// Step 2: Get currency in component
const { currency } = useCurrency();

// Step 3: Replace formatting calls
// Before
{currencyFormatter.format(amount)}

// After
{formatCurrency(amount, currency)}
```

**Chart Tooltip Pattern:**

```typescript
// Before
<Tooltip
  formatter={(value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  }}
/>

// After
<Tooltip
  formatter={(value: number) => formatCurrency(value, currency)}
/>
```

**Success Criteria:**
- ✅ All display components use `useCurrency()` hook
- ✅ All monetary values formatted with `formatCurrency(amount, currency)`
- ✅ No usage of legacy `currencyFormatter`
- ✅ No hard-coded currency codes in display logic
- ✅ All charts show dynamic currency in tooltips

---

### Task 2: Update Form Input Components (Phase 2)

**Goal:** Replace all hard-coded "VND" suffixes in form inputs with dynamic currency.

**Components to Update:**

1. **Transaction Forms**
   - `components/modals/forms/AddTransactionForm.tsx` - Line 206 (suffix), Line 150 (currency field)
   - `components/modals/forms/EditTransactionForm.tsx`

2. **Wallet Forms**
   - `components/modals/forms/CreateWalletForm.tsx` - Line 117 (suffix), Line 71 (currency field)
   - `components/modals/forms/EditWalletForm.tsx`
   - `components/modals/forms/TransferMoneyForm.tsx`

3. **Budget Forms**
   - `components/modals/forms/CreateBudgetForm.tsx`
   - `components/modals/forms/EditBudgetForm.tsx`
   - `components/modals/forms/CreateBudgetItemForm.tsx`
   - `components/modals/forms/EditBudgetItemForm.tsx`

**Implementation Pattern:**

```typescript
// Step 1: Import useCurrency hook
import { useCurrency } from "@/contexts/CurrencyContext";

// Step 2: Get currency in component
const { currency } = useCurrency();

// Step 3: Update FormNumberInput suffix
// Before
<FormNumberInput
  name="amount"
  control={control}
  label="Amount"
  suffix="VND"
  required
/>

// After
<FormNumberInput
  name="amount"
  control={control}
  label="Amount"
  suffix={currency}
  required
/>

// Step 4: Update mutation data
// Before
createTransaction.mutate({
  amount: {
    amount: signedAmount,
    currency: "VND",
  },
});

// After
createTransaction.mutate({
  amount: {
    amount: signedAmount,
    currency: currency,
  },
});
```

**Special Considerations:**

1. **Wallet Dropdowns in Forms:**
   - Update wallet balance display in dropdown labels
   ```typescript
   // Before
   label: `${wallet.walletName} (${(wallet.balance?.amount || 0).toLocaleString()} VND)`,

   // After
   label: `${wallet.walletName} (${formatCurrency(wallet.displayBalance?.amount || 0, currency)})`,
   ```

2. **Investment Forms:**
   - Investment transactions may have different currencies than user preference
   - Verify that form respects the investment's native currency
   - Show both investment currency and converted value if different

**Success Criteria:**
- ✅ All form inputs show dynamic currency suffix
- ✅ All mutations send correct currency code
- ✅ Wallet dropdowns show balances in user's preferred currency
- ✅ No hard-coded "VND" strings in form components
- ✅ Investment forms handle multi-currency correctly

---

### Task 3: Update Utility & Helper Components (Phase 3)

**Goal:** Update remaining components that display or manipulate monetary values.

**Components to Update:**

1. **DeleteWalletModal**
   - `components/modals/DeleteWalletModal.tsx` - Line 159
   - Replace raw formatting with `formatCurrency()`

2. **Wallet Selection Components**
   - `components/select/FormSelect.tsx` - Update any wallet balance displays

3. **Table Components**
   - `components/table/MobileTable.tsx` - Verify currency formatting
   - `components/table/TanStackTable.tsx` - Verify currency formatting

**Implementation Pattern:**

```typescript
// DeleteWalletModal - Before
{(w.balance?.amount ?? 0) / 1000}k {w.currency}

// DeleteWalletModal - After
{formatCurrency(w.displayBalance?.amount ?? 0, currency)}
```

**Success Criteria:**
- ✅ All utility components use `formatCurrency()`
- ✅ No raw number formatting for monetary values
- ✅ Consistent currency display across all components

---

### Task 4: CSV Export & Data Export (Phase 4)

**Goal:** Ensure exported data includes currency information.

**Components to Update:**
- `utils/csv-export.ts` - Add currency column to exports

**Implementation Pattern:**

```typescript
// Add currency information to CSV headers
const headers = [
  'Date',
  'Category',
  'Amount',
  'Currency', // New column
  'Note',
];

// Include currency in data rows
const row = [
  transaction.date,
  transaction.category,
  transaction.amount,
  transaction.currency || currency, // Use transaction currency or default
  transaction.note,
];
```

**Success Criteria:**
- ✅ CSV exports include currency information
- ✅ Exported amounts are labeled with correct currency
- ✅ Multi-currency transactions clearly identified

---

### Task 5: Deprecate Legacy Formatter

**Goal:** Remove or deprecate the legacy `currencyFormatter` to prevent future misuse.

**Changes:**

1. **Update `utils/currency-formatter.tsx`:**
   ```typescript
   /**
    * Legacy formatter for backward compatibility (VND only)
    * @deprecated Use formatCurrency(amount, currency) instead
    * This will be removed in a future version
    */
   export const currencyFormatter = new Intl.NumberFormat("vi-VN", {
     style: "currency",
     currency: "VND",
     trailingZeroDisplay: "stripIfInteger",
   });
   ```

2. **Add ESLint Rule (Optional):**
   - Create custom rule to warn on `currencyFormatter` usage
   - Suggest `formatCurrency()` as replacement

3. **Documentation:**
   - Update `CLAUDE.md` to emphasize `formatCurrency()` usage
   - Add migration guide for developers

**Success Criteria:**
- ✅ Legacy formatter marked as deprecated
- ✅ All existing usages replaced with `formatCurrency()`
- ✅ Documentation updated
- ✅ Future developers guided to correct API

---

## Testing Strategy

### Manual Testing Checklist

**Test Scenario 1: Currency Change**
- [ ] Open dashboard with default currency (VND)
- [ ] Verify all monetary values show VND symbol (₫)
- [ ] Change currency to USD via CurrencySelector
- [ ] Wait for conversion to complete
- [ ] Verify all monetary values update to USD symbol ($)
- [ ] Verify correct decimal places (VND: 0, USD: 2)

**Test Scenario 2: Forms & Input**
- [ ] Open "Add Transaction" form
- [ ] Verify amount input shows current currency suffix
- [ ] Change user currency
- [ ] Reopen form
- [ ] Verify suffix updated to new currency

**Test Scenario 3: Charts & Graphs**
- [ ] View Balance chart
- [ ] Hover over data points
- [ ] Verify tooltips show correct currency symbol
- [ ] Change user currency
- [ ] Verify chart tooltips update

**Test Scenario 4: Multi-Currency Wallets**
- [ ] Create wallets in different currencies (if supported)
- [ ] Verify each wallet shows its native currency
- [ ] Verify totals show in user's preferred currency

**Test Scenario 5: Investment Portfolio**
- [ ] View portfolio with investments in different currencies
- [ ] Verify investment native currency preserved
- [ ] Verify summary totals show in user's preferred currency

### Component Testing

**Unit Tests to Add:**

1. **Currency Formatter Tests:**
   ```typescript
   describe('formatCurrency', () => {
     it('formats VND with no decimals', () => {
       expect(formatCurrency(250000000, 'VND')).toBe('₫250,000,000');
     });

     it('formats USD with 2 decimals', () => {
       expect(formatCurrency(10000, 'USD')).toBe('$100.00');
     });

     it('handles negative amounts', () => {
       expect(formatCurrency(-10000, 'USD')).toBe('-$100.00');
     });
   });
   ```

2. **Component Render Tests:**
   ```typescript
   describe('TransactionItem', () => {
     it('displays amount in user preferred currency', () => {
       // Mock CurrencyContext
       const { getByText } = render(
         <CurrencyProvider value={{ currency: 'USD' }}>
           <TransactionItem transaction={mockTransaction} />
         </CurrencyProvider>
       );
       expect(getByText(/\$/)).toBeInTheDocument();
     });
   });
   ```

### Integration Testing

**Test Scenarios:**

1. **Full Currency Change Flow:**
   - User changes currency → Backend converts data → Frontend polls → UI updates
   - Verify no stale data displayed
   - Verify loading states shown appropriately

2. **Form Submission with Dynamic Currency:**
   - User creates transaction with current currency
   - Verify backend receives correct currency code
   - Verify data saved with correct currency

3. **Multi-Tab Scenario:**
   - Open application in two browser tabs
   - Change currency in one tab
   - Verify other tab eventually updates (via polling)

---

## Migration Strategy

### Rollout Plan

**Week 1: Core Display Components**
- Day 1-2: Update wallet & transaction displays
- Day 3-4: Update budget components
- Day 5: Update charts & graphs
- Testing: Manual verification of all updates

**Week 2: Form Components & Utilities**
- Day 1-2: Update all form inputs
- Day 3: Update utility components
- Day 4: Update CSV export
- Day 5: Testing & bug fixes

**Week 3: Polish & Deprecation**
- Day 1-2: Code review & cleanup
- Day 3: Deprecate legacy formatter
- Day 4-5: Documentation updates

### Rollback Plan

**If issues arise:**

1. **Display Issues:**
   - Revert component changes via git
   - Re-deploy previous version
   - No data loss (backend unchanged)

2. **Form Submission Issues:**
   - Revert form component changes
   - Verify backend accepts both old and new formats
   - Fix validation issues

3. **Performance Issues:**
   - Check for excessive re-renders
   - Optimize `useCurrency()` hook with memoization
   - Add React.memo() to expensive components

---

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Components using dynamic currency | 100% | ~40% | 🔴 In Progress |
| Hard-coded "VND" references | 0 | ~35 files | 🔴 Not Started |
| Legacy `currencyFormatter` usage | 0% | ~10 files | 🔴 Not Started |
| Form inputs with dynamic suffix | 100% | 0% | 🔴 Not Started |
| Chart tooltips with dynamic currency | 100% | 25% | 🟡 Partial |
| User satisfaction (manual testing) | >95% | TBD | ⚪ Not Started |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Breaking existing UI** | High | Thorough manual testing, gradual rollout |
| **Currency symbol confusion** | Medium | Clear labeling, consistent formatting |
| **Performance degradation** | Medium | Use React.memo(), optimize re-renders |
| **Investment multi-currency conflicts** | High | Preserve native currency, show converted values separately |
| **Form validation issues** | High | Test all form submissions with different currencies |
| **User confusion during conversion** | Medium | Clear loading states, progress indicators |
| **Legacy code dependencies** | Low | Deprecate gradually, provide migration guide |

---

## Dependencies

**Required:**
- ✅ CurrencyContext and useCurrency() hook (completed in Phase 4)
- ✅ formatCurrency() utility function (completed in Phase 4)
- ✅ Backend API returns displayCurrency fields (completed in Phase 3)
- ✅ User preferences stored in Redux auth state (completed in Phase 4)

**Optional:**
- ⚪ ESLint custom rules for enforcing dynamic currency
- ⚪ Storybook examples for currency formatting
- ⚪ E2E tests with Playwright/Cypress

---

## File Structure

### Files to Modify (35+ files)

**Display Components (12 files):**
- `app/dashboard/home/Walllets.tsx`
- `app/dashboard/transaction/TransactionItem.tsx`
- `app/dashboard/transaction/TransactionTable.tsx`
- `app/dashboard/budget/BudgetCard.tsx`
- `app/dashboard/budget/BudgetItemCard.tsx`
- `app/dashboard/home/Balance.tsx`
- `app/dashboard/home/Dominance.tsx`
- `app/dashboard/home/MonthlyDominance.tsx`
- `app/dashboard/report/ExpandableTable.tsx`
- `app/dashboard/report/FinancialTable.tsx`
- `components/modals/DeleteWalletModal.tsx`
- `components/select/FormSelect.tsx`

**Form Components (12+ files):**
- `components/modals/forms/AddTransactionForm.tsx`
- `components/modals/forms/EditTransactionForm.tsx`
- `components/modals/forms/CreateWalletForm.tsx`
- `components/modals/forms/EditWalletForm.tsx`
- `components/modals/forms/TransferMoneyForm.tsx`
- `components/modals/forms/CreateBudgetForm.tsx`
- `components/modals/forms/EditBudgetForm.tsx`
- `components/modals/forms/CreateBudgetItemForm.tsx`
- `components/modals/forms/EditBudgetItemForm.tsx`
- `components/modals/forms/AddInvestmentForm.tsx`
- `components/modals/forms/AddInvestmentTransactionForm.tsx`
- `components/modals/forms/EditInvestmentForm.tsx` (if exists)

**Utility Components (3 files):**
- `components/table/MobileTable.tsx`
- `components/table/TanStackTable.tsx`
- `utils/csv-export.ts`

**Documentation (2 files):**
- `utils/currency-formatter.tsx` (add deprecation warning)
- `.claude/CLAUDE.md` (update with new patterns)

---

## Code Examples

### Example 1: Update TransactionItem Component

**Before:**
```typescript
// app/dashboard/transaction/TransactionItem.tsx
import { currencyFormatter } from "@/utils/currency-formatter";

export const TransactionItem = ({ transaction }: Props) => {
  const amount = transaction.amount?.amount || 0;

  return (
    <div>
      {currencyFormatter.format(Math.abs(amount))}
    </div>
  );
};
```

**After:**
```typescript
// app/dashboard/transaction/TransactionItem.tsx
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";

export const TransactionItem = ({ transaction }: Props) => {
  const { currency } = useCurrency();
  const amount = transaction.displayAmount?.amount || 0;

  return (
    <div>
      {formatCurrency(Math.abs(amount), currency)}
    </div>
  );
};
```

### Example 2: Update AddTransactionForm Component

**Before:**
```typescript
// components/modals/forms/AddTransactionForm.tsx
<FormNumberInput
  name="amount"
  control={control}
  label="Amount"
  suffix="VND"
  required
/>

createTransaction.mutate({
  amount: {
    amount: signedAmount,
    currency: "VND",
  },
});
```

**After:**
```typescript
// components/modals/forms/AddTransactionForm.tsx
import { useCurrency } from "@/contexts/CurrencyContext";

export function AddTransactionForm({ onSuccess }: Props) {
  const { currency } = useCurrency();

  return (
    <FormNumberInput
      name="amount"
      control={control}
      label="Amount"
      suffix={currency}
      required
    />
  );

  createTransaction.mutate({
    amount: {
      amount: signedAmount,
      currency: currency,
    },
  });
}
```

### Example 3: Update Balance Chart Component

**Before:**
```typescript
// app/dashboard/home/Balance.tsx
<Tooltip
  formatter={(value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  }}
/>
```

**After:**
```typescript
// app/dashboard/home/Balance.tsx
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency } from "@/utils/currency-formatter";

export const Balance = ({ availableYears }: Props) => {
  const { currency } = useCurrency();

  return (
    <Tooltip
      formatter={(value: number) => formatCurrency(value, currency)}
    />
  );
};
```

---

## Next Steps

1. **Review Plan** - Get stakeholder approval
2. **Prioritize Components** - Identify critical path components
3. **Start Phase 1** - Update display components (highest visibility)
4. **Iterate & Test** - Manual testing after each phase
5. **Deploy Gradually** - Consider feature flags for staged rollout
6. **Monitor Feedback** - Track user reports and bug submissions

---

**Document Version:** 1.0
**Last Updated:** 2025-01-29
**Author:** Claude (with user input)
**Related Documents:**
- `docs/plans/2025-01-28-multi-currency-system-design.md` (Parent feature)
- `.claude/CLAUDE.md` (Development guidelines)

---

## Appendix: Complete Component Checklist

### ✅ Already Using Dynamic Currency (11 components)
- `app/dashboard/home/TotalBalance.tsx`
- `app/dashboard/home/AccountBalance.tsx`
- `app/dashboard/wallets/WalletCard.tsx`
- `app/dashboard/portfolio/page.tsx`
- `app/dashboard/portfolio/helpers.tsx`
- `components/modals/InvestmentDetailModal.tsx`
- `components/CurrencySelector.tsx`
- `components/CurrencyConversionProgress.tsx`
- `contexts/CurrencyContext.tsx`
- `redux/reducer.tsx`
- `redux/interface.tsx`

### 🔴 Needs Update - Display Components (12 components)
- [ ] `app/dashboard/home/Walllets.tsx`
- [ ] `app/dashboard/transaction/TransactionItem.tsx`
- [ ] `app/dashboard/transaction/TransactionTable.tsx`
- [ ] `app/dashboard/transaction/TransactionGroup.tsx`
- [ ] `app/dashboard/budget/BudgetCard.tsx`
- [ ] `app/dashboard/budget/BudgetItemCard.tsx`
- [ ] `app/dashboard/home/Balance.tsx`
- [ ] `app/dashboard/home/Dominance.tsx`
- [ ] `app/dashboard/home/MonthlyDominance.tsx`
- [ ] `app/dashboard/report/ExpandableTable.tsx`
- [ ] `app/dashboard/report/FinancialTable.tsx`
- [ ] `components/modals/DeleteWalletModal.tsx`

### 🔴 Needs Update - Form Components (12+ components)
- [ ] `components/modals/forms/AddTransactionForm.tsx`
- [ ] `components/modals/forms/EditTransactionForm.tsx`
- [ ] `components/modals/forms/CreateWalletForm.tsx`
- [ ] `components/modals/forms/EditWalletForm.tsx`
- [ ] `components/modals/forms/TransferMoneyForm.tsx`
- [ ] `components/modals/forms/CreateBudgetForm.tsx`
- [ ] `components/modals/forms/EditBudgetForm.tsx`
- [ ] `components/modals/forms/CreateBudgetItemForm.tsx`
- [ ] `components/modals/forms/EditBudgetItemForm.tsx`
- [ ] `components/modals/forms/AddInvestmentForm.tsx`
- [ ] `components/modals/forms/AddInvestmentTransactionForm.tsx`
- [ ] `components/modals/forms/EditInvestmentForm.tsx` (if exists)

### 🟡 Needs Verification (3 components)
- [ ] `components/table/MobileTable.tsx`
- [ ] `components/table/TanStackTable.tsx`
- [ ] `components/select/FormSelect.tsx`

### 🔵 Enhancement (1 component)
- [ ] `utils/csv-export.ts`

**Total Components to Update: 28+ files**
