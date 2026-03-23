# Investment Currency Lock Specification

## Summary

Lock the currency selector in the Add Investment form when the asset type has a deterministic currency (market symbols, gold, silver). This prevents users from submitting investments with a mismatched currency, which currently causes silent data corruption when the backend's duplicate-symbol logic auto-creates a transaction on an existing investment using the wrong currency. Custom investments retain manual currency selection.

## User Stories

- As a user adding a market investment (e.g., AAPL), I want the currency to be auto-locked to the exchange currency (USD), so that my cost basis and PnL are calculated correctly.
- As a user adding to an existing investment, I want to be prevented from accidentally submitting a different currency, so that my financial data remains consistent.
- As a user adding a custom investment, I want to choose any currency, so that I can track non-market assets in my preferred currency.

## Functional Requirements

### FR-1: Lock Currency for Market-Based Assets

When the user selects a symbol via `SymbolAutocomplete`, the currency field must be:
1. Auto-filled from the search result's `currency` field
2. **Disabled** — the user cannot change it
3. Visually indicated as locked (e.g., grayed-out badge or disabled dropdown)

**Acceptance criteria:**
- [ ] Selecting a symbol via autocomplete sets currency and disables the selector
- [ ] Clearing the symbol re-enables currency selection
- [ ] Currency badge/dropdown shows the locked currency clearly
- [ ] Gold/silver types continue to lock currency as they already do (no regression)

### FR-2: Lock Currency for Gold/Silver Assets

No change needed — gold/silver types already lock the currency based on the selected type (VND or USD). This requirement exists to document the existing behavior and ensure no regression.

**Acceptance criteria:**
- [ ] Gold VND types (SJC variants) lock currency to VND
- [ ] Gold USD type (XAU) locks currency to USD
- [ ] Silver types lock currency based on type selection
- [ ] No regression in gold/silver currency behavior

### FR-3: Keep Currency Editable for Custom Investments

When "Custom Investment" is toggled on, currency remains a manual selection from the available currencies (USD, VND, EUR, GBP, JPY, CNY, KRW, SGD).

**Acceptance criteria:**
- [ ] Toggling "Custom Investment" on enables currency selection
- [ ] Toggling "Custom Investment" off re-locks currency if a symbol is selected
- [ ] Custom investments submit with the user-selected currency

### FR-4: Backend Currency Mismatch Validation

When `CreateInvestment` detects a duplicate symbol (existing investment for the same user+symbol), the backend must validate that the submitted currency matches the existing investment's currency.

If currencies don't match → reject with a validation error.

**Acceptance criteria:**
- [ ] Submitting a duplicate symbol with matching currency → creates transaction (existing behavior)
- [ ] Submitting a duplicate symbol with mismatched currency → returns validation error
- [ ] Error message: "Investment {symbol} already exists with currency {existingCurrency}"
- [ ] HTTP 400 status code for currency mismatch

## Non-Functional Requirements

- **Performance**: No impact — this is a UI state change + one string comparison on backend
- **Security**: Closes a data integrity vulnerability (currency mismatch on duplicate detection)
- **Backwards compatibility**: API consumers sending mismatched currencies will now receive an error instead of silent corruption

## Architecture Changes (C4)

### Diagrams to Update

None — no new components, services, or relationships are being added. This is a validation enhancement within existing components.

### New Diagrams

None required.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-investment.md`** — Update the "Create Investment (duplicate detection)" flow to include the currency validation step before auto-creating a transaction.

Change: Add a decision node after duplicate detection: "Currency matches?" → Yes: create transaction (existing flow) → No: return validation error.

### New Flow Diagrams

None required.

## Data Model Changes

None — no schema changes. The `currency` field already exists on the `Investment` model.

## API Changes

### Modified: `CreateInvestment` RPC

No proto changes needed. The request already includes a `currency` field.

**Behavior change only:**

| Scenario | Before | After |
|----------|--------|-------|
| Duplicate symbol, same currency | Creates transaction | Creates transaction (unchanged) |
| Duplicate symbol, different currency | Creates transaction (silent mismatch) | Returns 400 error |
| New symbol, any currency | Creates investment | Creates investment (unchanged) |

**Error response for currency mismatch:**
```json
{
  "success": false,
  "message": "Investment AAPL already exists with currency USD",
  "timestamp": "..."
}
```

## UI/UX Changes

### Frontend Changes

**File: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`**

1. **CurrencyBadge** — When a symbol is selected from search results, disable the currency dropdown/badge. Show it as a static, non-interactive element.
2. **Symbol clear** — When the user clears the symbol field, re-enable currency selection.
3. **Custom toggle** — When "Custom Investment" is toggled on, enable currency selection regardless of symbol state.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Currency display (locked state) | CurrencyBadge (already used) | Inside AddInvestmentForm |
| Form select (editable state) | FormSelect | `components/forms/FormSelect` |
| Symbol search | SymbolAutocomplete | `components/forms/SymbolAutocomplete` |

### New Components

None — this change modifies existing form logic only.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Investment form data (symbol, currency, quantity, price) | Yes: Internet → App | Investment Handler | Untrusted input |
| 2 | Investment Handler | Parsed CreateInvestmentRequest | No (same tier) | Investment Service | Validated by handler |
| 3 | Investment Service | Symbol lookup query | Yes: App → DB | PostgreSQL | Check for existing investment |
| 4 | PostgreSQL | Existing investment record (or nil) | Yes: DB → App | Investment Service | Trusted data |
| 5 | Investment Service | New transaction or error | No (same tier) | Investment Handler | Business logic result |
| 6 | Investment Handler | JSON response | Yes: App → Internet | User (browser) | Error or success |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User form submission | JWT auth + input validation + currency mismatch check |
| App → DB | Duplicate symbol query | GORM parameterized queries, user ownership check |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | User submits crafted currency to corrupt existing investment data | Medium | Backend currency mismatch validation (this feature) |
| T-2 | 1 | Internet → App | Tampering | API caller bypasses frontend lock, sends mismatched currency | Medium | Server-side validation rejects mismatch (this feature) |
| T-3 | 3 | App → DB | Info Disclosure | Duplicate check could reveal other users' investments | Low | Already scoped by userID in `GetByUserAndSymbol` |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|-----------|-----------------|
| Create investment / add transaction | Allowed | Denied | Denied |

No changes to authorization — existing JWT + user ownership checks apply.

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| currency | string | ISO 4217, 3 chars | Required — existing `validator.Currency()` |
| currency match | string | Must match existing investment if duplicate symbol | **New** — compare against existing record |

### External Dependency Risks

None — no new external dependencies. This feature only adds an internal validation check.

### Sensitive Data Handling

No change — no new sensitive data introduced.

### Issues & Risks Summary

1. **Risk: API consumers relying on silent currency mismatch** — Any external tool calling `CreateInvestment` with mismatched currencies will now get an error. This is intentional (data integrity > backwards compat for a bug).
2. **Risk: Race condition on duplicate check** — Two concurrent requests could both pass the duplicate check. Existing risk, not introduced by this feature. Mitigated by database unique constraints if needed in future.

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|---------|
| User selects symbol, then toggles "Custom Investment" | Currency becomes editable; symbol may differ from search result |
| User toggles "Custom Investment" off after changing currency | Currency re-locks to the symbol's exchange currency |
| Symbol search returns no currency field | Currency defaults to wallet currency or USD; remains editable |
| Backend receives empty currency on duplicate | Existing default-to-USD logic applies, then mismatch check runs |

## Dependencies & Assumptions

- `SymbolAutocomplete` search results include a `currency` field (already true)
- `GetByUserAndSymbol` returns the full investment record including currency (already true)
- Frontend `CurrencyBadge` component supports a disabled/locked state (needs verification — may need minor prop addition)

## Out of Scope

- Multi-currency investment support (e.g., buying AAPL in VND with automatic FX conversion)
- Migrating existing investments with mismatched currencies (data cleanup)
- Changing the duplicate detection logic to match by symbol+currency (which would allow same symbol in different currencies as separate investments)
