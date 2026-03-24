# Edit Investment Transactions Specification

## Summary

Allow users to fully edit investment transactions (buy, sell, dividend) including quantity, price, fees, date, and notes. The implementation uses a **delete-and-recreate** strategy to safely handle FIFO lot recalculation — reversing the old transaction and creating a new one atomically within a database transaction. This reuses the battle-tested delete reversal and create logic already in the codebase. The UI reuses the existing `AddInvestmentTransactionForm` in edit mode with pre-filled values.

## User Stories

- As an investor, I want to correct a wrong price on a buy transaction, so that my cost basis and PNL calculations are accurate.
- As an investor, I want to fix the quantity on a transaction I entered incorrectly, so that my portfolio reflects my actual holdings.
- As an investor, I want to change the date of a transaction I logged late, so that my transaction history is chronologically correct.
- As an investor, I want to update fees and notes on past transactions, so that my records are complete and accurate.

## Functional Requirements

### FR-1: Edit Any Investment Transaction

Users can edit all fields of any investment transaction they own: type, quantity, price, fees, date, and notes.

**Acceptance criteria:**

- [ ] Edit button (pencil icon) visible on each transaction row in the InvestmentDetailModal transactions tab
- [ ] Clicking edit opens the AddInvestmentTransactionForm pre-filled with the transaction's current values
- [ ] All fields are editable: type, quantity, price, fees, transactionDate, notes
- [ ] Form shows "Edit Transaction" title (not "Add Transaction")
- [ ] Submit button shows "Save Changes" (not "Add Transaction")
- [ ] On success, shows success animation and refreshes transaction list + investment data

### FR-2: Delete-and-Recreate Backend Strategy

Backend implements edit as an atomic delete + create operation within a single database transaction.

**Acceptance criteria:**

- [ ] `EditTransaction` service method performs: (1) reverse old transaction, (2) create new transaction — in a single DB transaction
- [ ] If create fails after delete, the entire operation rolls back (old transaction restored)
- [ ] FIFO lots are correctly recalculated after edit
- [ ] Investment totals (quantity, totalCost, averageCost, realizedPNL, totalDividends) are consistent after edit
- [ ] Cache invalidation fires after successful edit

### FR-3: Validation — Buy Quantity Reduction Guard

When editing a buy transaction, the new quantity cannot be less than the quantity already sold from that lot.

**Acceptance criteria:**

- [ ] Before reversing, check if this is a buy transaction with a consumed lot
- [ ] If `original_quantity - lot_remaining_quantity > new_quantity`, reject with clear error message
- [ ] Error message: "Cannot reduce quantity below X units (Y already sold from this lot)"
- [ ] Sell and dividend transactions have no quantity reduction guard (delete-recreate handles FIFO naturally)

### FR-4: Transaction Type Change

Users can change a transaction's type (e.g., buy → sell) during edit.

**Acceptance criteria:**

- [ ] Type dropdown is editable in edit mode
- [ ] Changing type triggers appropriate reversal of old type and creation of new type
- [ ] Validation applies to the new type (e.g., changing to sell validates sufficient quantity)
- [ ] Edge case: changing buy → sell when that buy's lot has been consumed — blocked by FR-3 validation

### FR-5: Gold/Silver Unit Conversion in Edit Mode

Edit form correctly handles gold/silver storage format conversions.

**Acceptance criteria:**

- [ ] Pre-filled quantity converts from storage format (grams × 10000) back to display unit (mace/tael/ounce)
- [ ] Pre-filled price converts from storage format to display unit price
- [ ] On submit, converts back to storage format (same as create flow)
- [ ] Unit labels match the investment type (mace for VND gold, ounce for USD gold, etc.)

## Non-Functional Requirements

- **Performance**: Edit operation completes in < 500ms (single DB transaction with existing lot queries)
- **Atomicity**: Edit must be all-or-nothing — no partial state if create fails after delete
- **Audit trail**: Both the soft-deleted original and the new transaction exist in the database, preserving full history
- **Consistency**: After edit, running portfolio summary produces correct totals matching individual transaction math

## Architecture Changes (C4)

### Diagrams to Update

**c4-code-investment.md (L4):**
- No structural changes needed — `EditTransaction` method already exists in `InvestmentService` interface
- The method signature stays the same; only the implementation changes

**c4-component-backend.md (L3):**
- No changes — handler and service already exist

**c4-component-frontend.md (L3):**
- No structural changes — reusing existing `AddInvestmentTransactionForm` component with edit mode flag

### New Diagrams

None required — no new bounded contexts or components.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**flow-investment.md:**
- Add new sequence diagram: "Edit Transaction (Delete-and-Recreate)" showing the atomic flow
- The diagram should show: validation → begin DB tx → reverse old → create new → commit → cache invalidation

### New Flow Diagrams

None — the edit flow belongs in the existing `flow-investment.md` file.

**Flow description:**

```
User → Handler: PUT /api/v1/investment-transactions/{id} with updated fields
Handler → Service: EditTransaction(userID, txID, request)
Service → Repository: GetByIDForUser(txID, userID) — verify ownership
Service → Service: Validate (buy qty reduction guard if applicable)
Service → DB: BEGIN TRANSACTION
Service → Service: reverseXxxTransaction(oldTx) — undo old impact on lots + investment
Service → Service: processXxxTransaction(newReq) — apply new transaction
Service → DB: COMMIT (or ROLLBACK on error)
Service → Cache: Invalidate currency + wallet investment value
Handler → User: Updated transaction + updated investment
```

## Data Model Changes

**No new tables or fields required.**

The existing models support this feature:
- `InvestmentTransaction` — soft delete (DeletedAt) preserves the original; new record created
- `InvestmentLot` — existing lot update/create logic handles recalculation
- `Investment` — existing total recalculation logic handles consistency

The only change is that `EditTransaction` in the service layer will use the full delete-and-recreate logic instead of only updating notes.

## API Changes

### Modified Endpoint

**`PUT /api/v1/investment-transactions/{id}`**

Request (unchanged proto — already defined):
```json
{
  "id": 123,
  "type": 1,
  "quantity": 1000000,
  "price": 8500000,
  "fees": 0,
  "transactionDate": 1711234567,
  "notes": "Updated note"
}
```

Response (unchanged proto — already defined):
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "transaction": { ... },
  "updatedInvestment": { ... },
  "timestamp": "2026-03-24T..."
}
```

**Change**: The `EditInvestmentTransactionResponse` proto currently only returns `success`, `message`, `timestamp`. It needs to also return the updated transaction and updated investment (same as `AddTransactionResponse`).

### Proto Change Required

In `investment.proto`, update `EditInvestmentTransactionResponse`:
```protobuf
message EditInvestmentTransactionResponse {
  bool success = 1;
  string message = 2;
  string timestamp = 3;
  InvestmentTransaction transaction = 4;      // NEW
  Investment updated_investment = 5;           // NEW
}
```

And add `type` field to `EditInvestmentTransactionRequest`:
```protobuf
message EditInvestmentTransactionRequest {
  int32 id = 1;
  InvestmentTransactionType type = 2;          // NEW — allow type change
  int64 quantity = 3;
  int64 price = 4;
  int64 fees = 5;
  int64 transaction_date = 6;
  string notes = 7;
}
```

## UI/UX Changes

### Modified Components

**InvestmentDetailModal (transactions tab):**
- Add edit icon (pencil) button on each transaction row (beside existing delete button)
- Clicking edit sets state: `editingTransaction: InvestmentTransaction | null`
- Switches to Add Transaction tab with form in edit mode

**AddInvestmentTransactionForm:**
- Accept optional `editTransaction` prop with pre-filled values
- When in edit mode:
  - Title: "Edit Transaction"
  - Submit button: "Save Changes"
  - Pre-fill all fields from existing transaction (with proper unit conversions for gold/silver)
  - Call `useMutationEditInvestmentTransaction` instead of `useMutationAddInvestmentTransaction`
- Success message: "Transaction Updated!"

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|-------------------|----------|
| Edit form | AddInvestmentTransactionForm (reuse with edit mode) | `features/investment/forms/AddInvestmentTransactionForm.tsx` |
| Modal container | InvestmentDetailModal (existing tabs) | `features/investment/components/InvestmentDetailModal.tsx` |
| Edit icon | Lucide `Pencil` or existing icon set | `components/icons/` or `lucide-react` |
| Success animation | SuccessAnimation (already used) | `components/modals/Success.tsx` |
| Confirmation dialog | ConfirmationDialog (not needed — direct edit) | `components/modals/ConfirmationDialog.tsx` |
| Form inputs | FormNumberInput, FormSelect, FormInput (already used) | `components/forms/` |

### New Components (if any)

None — all existing components are sufficient.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Edit form data (type, qty, price, fees, date, notes) | Yes: Internet → App | REST Handler (PUT /api/v1/investment-transactions/{id}) | Untrusted input |
| 2 | REST Handler | Parsed + validated request | No (same tier) | InvestmentService.EditTransaction() | Handler validates types, ranges |
| 3 | InvestmentService | Transaction ID + userID | Yes: App → DB | PostgreSQL (GetByIDForUser) | Ownership verification |
| 4 | InvestmentService | Reverse old transaction | Yes: App → DB | PostgreSQL (UPDATE lots, investment) | Within DB transaction |
| 5 | InvestmentService | Create new transaction | Yes: App → DB | PostgreSQL (INSERT tx, UPDATE lots, investment) | Within DB transaction |
| 6 | InvestmentService | Cache keys | Yes: App → Redis | Redis (DELETE keys) | Cache invalidation |
| 7 | REST Handler | Response (transaction + investment) | Yes: App → Internet | User (browser) | Filtered response |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Edit request | JWT authentication + input validation |
| App → DB (read) | Ownership check | JOIN-based user verification (GetByIDForUser) |
| App → DB (write) | Lot/investment updates | DB transaction (atomic), parameterized queries |
| App → Redis | Cache invalidation | Internal network only, no user data in operation |
| App → Internet | Response | Filtered fields, no internal error details |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker edits another user's transaction | High | JWT auth + GetByIDForUser ownership check (existing) |
| T-2 | 1 | Internet → App | Tampering | Negative quantity/price to manipulate PNL | High | Server-side validation: quantity > 0, price >= 0, fees >= 0 (existing) |
| T-3 | 1 | Internet → App | Tampering | Overflow int64 quantity to corrupt lot math | High | Range validation on quantity/price (existing handler checks) |
| T-4 | 1 | Internet → App | Repudiation | User denies editing a transaction | Low | Soft delete preserves original + new record created (audit trail) |
| T-5 | 4-5 | App → DB | Tampering | Race condition: concurrent edit + sell on same transaction | Medium | DB transaction isolation + lot remaining_quantity check |
| T-6 | 1 | Internet → App | DoS | Rapid edit requests to overwhelm DB | Low | Existing rate limiting middleware |
| T-7 | 1 | Internet → App | Elevation | Edit transaction belonging to different investment/wallet | High | Ownership verified via JOIN query (existing pattern) |
| T-8 | 7 | App → Internet | Info Disclosure | Internal error details leaked in response | Medium | Wrap DB errors before returning (existing pattern) |
| T-9 | 4-5 | App → DB | Data Integrity | Partial update if create fails after delete | Critical | Single DB transaction with ROLLBACK on error |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Edit own transaction | Allowed | Denied (403) | Denied (401) |
| Edit other's transaction | N/A | Denied (403) | Denied (401) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| id | int32 | > 0, must exist, must belong to user | Required — GetByIDForUser |
| type | enum | 1-3 (BUY, SELL, DIVIDEND) | Required — enum validation |
| quantity | int64 | > 0 | Required — positive check |
| price | int64 | >= 0 | Required — non-negative check |
| fees | int64 | >= 0 | Required — non-negative check |
| transactionDate | int64 | > 0, not in future | Required — timestamp validation |
| notes | string | max 500 chars | Optional — length check |

### External Dependency Risks

No new external dependencies. This feature only uses existing internal services (PostgreSQL, Redis).

### Sensitive Data Handling

| Data Field | Sensitivity | Protection Required |
|------------|------------|-------------------|
| Transaction amounts (quantity, price, fees) | Confidential | Ownership verification, no cross-user access |
| Transaction history | Confidential | Soft delete preserves audit trail |
| Investment totals | Confidential | Recalculated atomically, never exposed to wrong user |

### Financial-Specific Concerns

| Concern | Assessment |
|---------|-----------|
| Money manipulation | Validated: quantity > 0, price >= 0, fees >= 0. Int64 storage prevents float rounding. Range checks prevent overflow. |
| Race conditions | Mitigated: Single DB transaction for delete+create. Lot remaining_quantity has GORM BeforeUpdate hook preventing negative values. |
| Rounding errors | N/A — all values stored as int64 in smallest currency unit |
| Balance consistency | Guaranteed: delete-and-recreate reuses proven reversal + creation logic that maintains investment totals |
| Audit trail | Preserved: soft-deleted original transaction remains in DB; new transaction has new ID and timestamps |
| Idempotency | Edit is not idempotent by nature, but atomic transaction prevents partial state |
| FIFO integrity | Guaranteed: reversal restores lots, then new transaction creates/consumes lots via standard FIFO logic |

### Issues & Risks Summary

1. **T-5 (Medium): Race condition** — Concurrent edit + sell on same investment could cause inconsistent lot state. Mitigation: DB transaction isolation level (PostgreSQL default READ COMMITTED is sufficient since lot updates use row-level locks).
2. **T-9 (Critical): Atomicity** — Must ensure the delete+create happens in a single DB transaction. If the application crashes between delete and create, data is lost. Mitigation: Explicit `db.Transaction()` wrapper with rollback.
3. **Lot consumption change on date edit** — Editing a sell transaction's date won't change which lots are consumed (FIFO is by lot's `purchased_at`, not by sell date). This is correct behavior but may surprise users. Consider a UI note.

## Edge Cases & Error Handling

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Edit buy: reduce quantity below sold amount | Reject with error: "Cannot reduce below X units (Y already sold)" |
| Edit buy: increase quantity | Allowed — lot quantity increases |
| Edit sell: increase quantity beyond holdings | Reject with error: "Insufficient holdings" (standard sell validation) |
| Edit sell: change date | Allowed — FIFO lots consumed may differ from original sell |
| Change buy → sell | Reverses buy (removes lot), then creates sell (consumes from remaining lots) |
| Change sell → buy | Reverses sell (restores lot qty), then creates buy (adds to lots) |
| Edit transaction on investment with 0 remaining quantity | Allowed if edit doesn't violate constraints |
| Edit dividend | Simple: reverse old dividend amount, apply new amount |
| Concurrent edit of same transaction | Second request gets stale data, DB transaction prevents corruption |
| Edit transaction with deleted investment | Rejected — GetByIDForUser fails (soft-deleted investment) |
| Gold/silver quantity precision | Storage format preserved through display → storage → display round-trip |

## Dependencies & Assumptions

- **Existing delete reversal logic is correct** — This feature depends on `reverseBuyTransaction`, `reverseSellTransaction`, `reverseDividendTransaction` being accurate. These are already battle-tested via the delete feature.
- **Existing create logic is correct** — `processBuyTransaction`, `processSellTransaction`, `processDividendTransaction` are reused.
- **Proto changes are backward compatible** — Adding fields to response messages is backward compatible in protobuf.
- **No wallet balance impact** — Investment transactions don't affect wallet balances (existing design).

## Out of Scope

- **Batch edit** — Editing multiple transactions at once
- **Edit history UI** — Showing the history of edits to a transaction (soft-deleted originals exist in DB but no UI to view them)
- **Undo/redo** — No undo for edits (user can edit again)
- **Split transaction edit** — SPLIT type (type=4) is not addressed (not currently used in the app)
- **Wallet balance adjustment** — If a user wants to also adjust wallet balance when editing an investment transaction, that's a separate feature
