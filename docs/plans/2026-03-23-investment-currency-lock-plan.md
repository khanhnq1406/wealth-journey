# Investment Currency Lock Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Lock the currency selector when asset type has a deterministic currency, and add backend validation to reject currency mismatches on duplicate-symbol investments.

**Spec:** `docs/specs/2026-03-23-investment-currency-lock-spec.md`

**Architecture:** Frontend-only UI state change (disable CurrencyBadge when a symbol is selected via autocomplete) + one string comparison in the backend CreateInvestment service to reject currency mismatches on duplicate detection. No new components, services, or data model changes.

**Tech Stack:** React 19 (AddInvestmentForm), Go 1.23 (investment_service.go), existing CurrencyBadge component

## Security Implementation Notes

- **Authentication:** No change — existing JWT auth applies
- **Authorization:** No change — existing user ownership check via `GetByUserAndSymbol(ctx, userID, symbol)`
- **Input validation:** New server-side currency mismatch check in CreateInvestment (defense-in-depth — frontend lock alone is insufficient, API callers can bypass)
- **Data sanitization:** Currency is already validated via `validator.Currency()` — this feature adds a business rule check, not a format check

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| CurrencyBadge | `components/forms/CurrencyBadge.tsx` | Already used — just needs `disabled` prop set based on symbol selection state |
| FormSelect | `components/forms/FormSelect.tsx` | Already used for custom investment currency — no change needed |
| SymbolAutocomplete | `features/investment/components/SymbolAutocomplete.tsx` | Already provides `currency` in SearchResult — no change needed |

**New components needed (with justification):**

None — this is a behavior change to existing form logic only.

## C4 Architecture Diagram Updates

None — per spec, no new components, services, or relationships are being added.

## Runtime Flow Diagram Updates

Update `docs/architecture/flow-investment.md` — add currency validation decision node in the "Create Investment (duplicate detection)" flow.

---

### Task 0: Backend — Currency Mismatch Validation in CreateInvestment

**Files:**

- Modify: `src/go-backend/domain/service/investment_service.go` (around line 152-189, the duplicate detection block)
- Test: `src/go-backend/domain/service/investment_service_test.go` (create if needed, or add to existing)

**Security notes:** This is the critical server-side validation. The frontend lock is a UX convenience; this backend check prevents data corruption from API callers bypassing the frontend.

**Step 1: Write the failing test**

Create a test that calls `CreateInvestment` with a duplicate symbol but mismatched currency. Expect a validation error (HTTP 400).

Test cases:
1. Duplicate symbol + same currency → success (existing behavior, regression test)
2. Duplicate symbol + different currency → validation error with message "Investment {symbol} already exists with currency {existingCurrency}"
3. New symbol + any currency → success (existing behavior, regression test)

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test -run TestCreateInvestment_CurrencyMismatch ./domain/service/...
```

Expected: test fails because no currency check exists yet.

**Step 3: Write minimal implementation**

In `investment_service.go`, inside the duplicate detection block (after `GetByUserAndSymbol` returns an existing investment), add:

```go
// After line ~152: existing, err := s.investmentRepo.GetByUserAndSymbol(ctx, userID, req.Symbol)
if err == nil && existing != nil {
    // Validate currency matches existing investment
    if req.Currency != existing.Currency {
        return nil, apperrors.NewValidationError(
            fmt.Sprintf("Investment %s already exists with currency %s", req.Symbol, existing.Currency),
        )
    }
    // ... existing auto-transaction logic continues
}
```

**Step 4: Run test to verify it passes**

```bash
cd src/go-backend && go test -run TestCreateInvestment_CurrencyMismatch ./domain/service/...
```

**Step 5: Verify Go build**

```bash
cd src/go-backend && go build ./...
```

**Step 6: Commit**

```
feat(investment): reject currency mismatch on duplicate symbol detection
```

---

### Task 1: Frontend — Lock CurrencyBadge When Symbol Selected via Autocomplete

**Files:**

- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx` (lines ~452-463 handleSymbolChange, lines ~926-969 currency UI section)

**Security notes:** This is a UX-only change. The backend validation (Task 0) is the actual security control.

**Step 0: Component inventory check**

- Reusing: `CurrencyBadge` (`@/components/forms/CurrencyBadge.tsx`) — already has `disabled` prop
- Reusing: `SymbolAutocomplete` — already returns `currency` in SearchResult
- No new components needed

**Step 1: Add state tracking for symbol-selected lock**

Add a boolean state to track whether a symbol was selected from autocomplete results (not just typed):

```typescript
const [isSymbolSelected, setIsSymbolSelected] = useState(false);
```

**Step 2: Update handleSymbolChange to set lock state**

In the `handleSymbolChange` callback (~line 452):
- When a search result is selected (result has currency): set `isSymbolSelected = true`
- When symbol is cleared or manually typed (no result): set `isSymbolSelected = false`

```typescript
const handleSymbolChange = (symbol: string, result?: SearchResult) => {
  setValue("symbol", symbol);
  setSelectedSymbol(symbol);

  if (result?.name) {
    setValue("name", result.name);
  }
  if (result?.currency) {
    setValue("currency", result.currency);
    setSelectedCurrency(result.currency);
    setIsSymbolSelected(true);  // ← Lock currency
  } else {
    setIsSymbolSelected(false); // ← Unlock currency (cleared/manual)
  }
};
```

**Step 3: Disable CurrencyBadge when symbol is selected**

Update the CurrencyBadge disabled prop (~line 960):

```diff
- disabled={isSubmitting || isGoldInvestment || isSilverInvestment}
+ disabled={isSubmitting || isGoldInvestment || isSilverInvestment || isSymbolSelected}
```

**Step 4: Handle custom investment toggle interaction**

When "Custom Investment" is toggled ON: currency should become editable regardless of symbol state.
When "Custom Investment" is toggled OFF: currency should re-lock if a symbol was selected.

The existing logic already handles this because:
- Custom ON → shows FormSelect (not CurrencyBadge)
- Custom OFF → shows CurrencyBadge with `disabled` prop

But we need to reset `isSymbolSelected` when custom is toggled ON:

```typescript
// In the custom toggle onChange handler (~line 595):
if (e.target.checked) {
  setIsSymbolSelected(false); // ← Allow currency change for custom
  // ... existing logic
}
```

When toggling custom OFF, if a symbol was previously selected, we should re-lock. But since the symbol field is cleared when toggling custom ON (existing behavior at line 598), `isSymbolSelected` will stay false, which is correct — no symbol = no lock.

**Step 5: Handle symbol clear/reset**

When the user clears the symbol field in SymbolAutocomplete, the `handleSymbolChange` callback fires with an empty string and no result, which already sets `isSymbolSelected = false` (from Step 2).

**Step 6: Verify no regression on gold/silver**

Gold/silver currency locking already works via the `isGoldInvestment || isSilverInvestment` condition on the CurrencyBadge disabled prop. The new `isSymbolSelected` condition is additive (OR'd), so no regression.

**Step 7: Commit**

```
feat(investment): lock currency selector when symbol selected from autocomplete
```

---

### Task 2: Frontend — Add i18n Keys for Currency Lock Error

**Files:**

- Modify: `src/wj-client/messages/en/investment.json`
- Modify: `src/wj-client/messages/vi/investment.json`

**Security notes:** Error messages should be user-friendly, not expose internal details. The backend error message format is already safe: "Investment {symbol} already exists with currency {existingCurrency}".

**Step 1: Add translation keys**

No new i18n keys needed. The backend error message "Investment {symbol} already exists with currency {existingCurrency}" will be displayed via the existing `onError` handler in AddInvestmentForm, which shows `error.message` directly. This is a backend-originated message and doesn't need frontend i18n.

**Skip this task** — no i18n changes required.

---

### Task 3: Update Runtime Flow Diagram

**Files:**

- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Read the current "Create Investment" section of the flow diagram
2. Add a decision node after the duplicate detection step: `Currency matches?`
   - Yes → continue to auto-create transaction (existing flow)
   - No → return HTTP 400 validation error
3. Update the error paths table with the new currency mismatch error
4. Commit

```
docs(architecture): add currency validation to investment creation flow
```

---

## Task Execution Order

| Order | Task | Dependencies | Parallel-safe? |
|-------|------|-------------|----------------|
| 1 | Task 0: Backend currency mismatch validation | None | Yes (backend-only) |
| 2 | Task 1: Frontend currency lock | None (independent of backend) | Yes (frontend-only) |
| 3 | Task 3: Flow diagram update | Tasks 0+1 (needs to reflect final implementation) | N/A |

**Tasks 0 and 1 are parallel-safe** — they modify completely different files (Go service vs React form).

## Success Criteria

- [ ] Selecting a symbol via autocomplete disables the CurrencyBadge
- [ ] Clearing the symbol re-enables CurrencyBadge
- [ ] Custom Investment toggle ON enables currency selection
- [ ] Gold/silver types continue to lock currency (no regression)
- [ ] Backend rejects duplicate symbol with mismatched currency (HTTP 400)
- [ ] Backend accepts duplicate symbol with matching currency (existing behavior)
- [ ] Error message: "Investment {symbol} already exists with currency {existingCurrency}"
- [ ] Flow diagram updated with currency validation decision node
