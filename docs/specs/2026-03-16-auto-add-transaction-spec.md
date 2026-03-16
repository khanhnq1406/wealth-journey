# Auto-Add Transaction for Existing Investments — Specification

## Summary

When a user submits the Add Investment form with a symbol that already exists in their wallet, instead of returning a conflict error, the backend should automatically add the submission as a new BUY transaction to the existing investment. The user sees a success message indicating the purchase was added to their existing holding. No frontend changes required.

## User Stories

- As an investor, I want to buy more of an asset I already own by using the same Add Investment form, so that I don't have to navigate to the existing investment's detail modal to add a transaction.

## Functional Requirements

### FR-1: Auto-detect and route to AddTransaction

When `CreateInvestment` detects a duplicate symbol in the wallet (via `GetByWalletAndSymbol`), instead of returning `ConflictError`:

1. Retrieve the existing investment
2. Convert the incoming `CreateInvestmentRequest` fields to `AddTransactionRequest` fields:
   - `investmentId` = existing investment's ID
   - `type` = BUY
   - `quantity` = converted `initialQuantity` (already in storage units)
   - `price` = `averageCost` (per-unit price in smallest currency unit)
   - `fees` = 0
   - `transactionDate` = `purchaseDate` (or current time if 0)
   - `notes` = "Additional purchase" (or similar)
3. Call the existing `AddTransaction` method with the constructed request
4. Return success with a message indicating it was added to an existing holding

**Acceptance criteria:**
- [ ] Submitting a duplicate symbol adds a BUY transaction to the existing investment
- [ ] Investment quantity, total cost, and average cost are updated correctly
- [ ] FIFO lot is created (or merged if same-day purchase)
- [ ] Response indicates success (not a conflict error)
- [ ] Response message distinguishes "added to existing" from "created new"
- [ ] Purchase date is respected in the new transaction

### FR-2: Response differentiation

The response should indicate whether a new investment was created or a transaction was added to an existing one, so the frontend can show an appropriate success message.

**Acceptance criteria:**
- [ ] Response message says "Transaction added to existing investment" (or similar) when auto-adding
- [ ] Response message says "Investment created successfully" when creating new
- [ ] Frontend's existing success flow works unchanged (it shows the success message from the response)

## Non-Functional Requirements

- **Performance**: No additional database queries beyond the existing duplicate check (which already fetches the investment)
- **Security**: Same authorization checks — wallet ownership already validated before the duplicate check

## Architecture Changes (C4)

### Diagrams to Update

- `docs/architecture/flow-investment.md` — Update the "Create Investment" sequence diagram to show the new branching logic when a duplicate is found.

### New Diagrams

None.

## Data Model Changes

None — all existing models support this flow.

## API Changes

### Modified: `CreateInvestment` behavior

**Before:** Returns `409 Conflict` when symbol exists in wallet.
**After:** Returns `201 Created` with the new transaction added to the existing investment.

The response proto (`CreateInvestmentResponse`) already has `success`, `message`, and `data` (Investment) fields — no proto changes needed. The `data` field will contain the updated existing investment instead of a new one.

## UI/UX Changes

### Frontend behavior (no code changes needed)

The frontend already:
1. Calls `useMutationCreateInvestment` on form submit
2. Shows `Success` component on success with `onDone` callback
3. Refreshes portfolio data via `onSuccess` prop

The only visible difference: the success message will say "Transaction added to existing investment" instead of "Investment created successfully". The frontend displays whatever message the backend returns.

### i18n changes

Add one new key for the "added to existing" success message:
- `errors.addedToExisting` — "Purchase added to your existing {symbol} holding"

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Success display | Success | `components/modals/Success.tsx` |
| Form submission | AddInvestmentForm | `features/investment/forms/AddInvestmentForm.tsx` |

### New Components

None.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Frontend form | CreateInvestmentRequest | Yes: Internet → App | Backend CreateInvestment handler | Same as existing flow |
| 2 | Backend service | GetByWalletAndSymbol query | No: internal | Database | Already exists |
| 3 | Backend service | AddTransactionRequest (constructed) | No: internal | Backend AddTransaction | New internal routing |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | User request | JWT + wallet ownership validation |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | User sends crafted request to add transaction to another user's investment | Low | Wallet ownership already validated before duplicate check (line 155) |

### Authorization Rules

No changes — existing wallet ownership check in CreateInvestment (line 155: `GetByIDForUser`) already validates the user owns the wallet before the duplicate check.

### Input Validation Rules

No changes — all input validation happens before the duplicate check. The `AddTransaction` method has its own validation as a second layer.

### Sensitive Data Handling

No new sensitive data. Monetary values continue using `int64` in smallest currency units.

### Issues & Risks Summary

1. **Unit conversion correctness** — The `averageCost` computed in CreateInvestment must match what AddTransaction expects as `price`. Both use `units.CalculateAverageCost()` so this is consistent.
2. **Same-day lot merging** — If user creates an investment and then "creates" again same day, the second one merges into the same lot. This is correct behavior.

## Edge Cases & Error Handling

| Case | Handling |
|------|---------|
| Different currency than existing investment | Should not happen — same symbol implies same currency. If somehow different, AddTransaction inherits the existing investment's currency |
| Different investment type than existing | The existing investment type takes precedence — the submitted type is ignored for the auto-add path |
| Zero quantity or cost | Already caught by validation before the duplicate check |
| Future purchase date | Already caught by validation before the duplicate check |

## Dependencies & Assumptions

- Existing `AddTransaction` method works correctly for BUY transactions (well-tested)
- Frontend success flow is message-agnostic (shows whatever the backend returns)

## Out of Scope

- Changing the frontend form to show "this will add to existing" preview
- Cross-wallet duplicate detection (only same wallet)
- SELL transactions via the Add Investment form (only BUY)
