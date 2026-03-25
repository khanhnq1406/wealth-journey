# Fix: BUY→SELL Edit Data Corruption + Misleading Error Message — Specification

## Summary

When a user edits a BUY investment transaction to become a SELL, `EditTransaction` currently runs `reverseBuyTransaction` first (which writes to the DB), then calls `processSellTransaction` — which fails because the reversal just removed all available quantity. The result is partial data corruption: `investment.Quantity` drops to 0 (or goes negative for the lot), the old transaction still exists in the DB, and the page shows an inconsistent state on refresh. The error message shown is "Số lượng phải lớn hơn 0." — which is technically correct but completely misleading in this context.

**Fix:** Add a pre-flight viability check before step 7 (reversal). If the requested SELL quantity exceeds what will remain after reversing the BUY, reject with a clear error message and touch zero DB rows.

## Original Feature Reference

- Spec: `docs/specs/2026-03-24-edit-investment-transactions-spec.md`
- Plan: `docs/plans/2026-03-24-edit-investment-transactions-plan.md`
- Report: `docs/reports/2026-03-25-edit-investment-transactions-report.md`

## Issues to Fix

| # | Issue | Source | Severity |
|---|-------|--------|----------|
| 1 | BUY→SELL edit corrupts data: `reverseBuyTransaction` commits to DB, then `processSellTransaction` fails, leaving investment.Quantity = 0 with old tx still present | User report | Critical |
| 2 | Error message "Số lượng phải lớn hơn 0." returned for a type-change scenario where the real problem is "no quantity remains after reversing the buy" | User report | Minor |

## Root Cause Analysis

`EditTransaction` follows a sequential pattern:

1. Guards (step 5) — check `alreadySold > 0` to block BUY→SELL when lot is partially consumed ✓
2. Reversal (step 7) — calls `reverseBuyTransaction`, which **writes investment + lot to DB** ✓
3. Re-fetch (step 8) — gets fresh investment from DB (qty now 0 after reversal)
4. Process (step 10) — calls `processSellTransaction(freshInvestment, qty=N)`
   - `freshInvestment.Quantity(0) < req.Quantity(N)` → returns `INVESTMENT_QUANTITY_POSITIVE` error
5. **Function returns error — but step 2 already committed**

The guard in step 5 only checks whether the lot's existing SELL history blocks the type change. It does NOT check whether the requested sell quantity is satisfiable *after* the BUY is reversed. This is the missing pre-flight check.

**Why the existing test `TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx` doesn't fix the bug:** It only verifies that `Delete` is not called (the fix from commit 99e2ad2). It does not prevent the reversal from corrupting the investment/lot rows.

## Functional Requirements

### FR-1: Pre-flight Viability Check for BUY→SELL Type Change

Before any DB mutation, when `oldType == BUY && newType == SELL`:

1. Compute `quantityAfterReversal = investment.Quantity - oldTx.Quantity`
2. If `quantityAfterReversal < req.Quantity`, return a validation error with code `INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY` and a descriptive message
3. No DB writes occur when this guard fires

**Acceptance criteria:**
- [ ] Guard fires before `reverseBuyTransaction` is called
- [ ] `investment.Quantity` is unchanged after the guard fires (zero DB writes)
- [ ] `lot.RemainingQuantity` is unchanged after the guard fires
- [ ] Old transaction is NOT deleted after the guard fires
- [ ] Error code is `INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY`
- [ ] English error: `"Cannot change to sell: only {X} units remain after reversing the buy, but {Y} were requested"`
- [ ] Vietnamese error: `"Không thể đổi thành bán: chỉ còn {X} đơn vị sau khi đảo ngược giao dịch mua, nhưng yêu cầu bán {Y}"`

### FR-2: Update Existing Test to Assert No DB Mutation

`TestEditTransaction_BuyToSell_SingleLot_ProcessFailDoesNotDeleteOldTx` currently passes because `Delete` is not called — but it sets up mocks for `UpdateLot` and `Update(investment)`, meaning the test allows the reversal to run. After this fix, the guard fires before the reversal, so `UpdateLot` and `Update(investment)` must also NOT be called.

**Acceptance criteria:**
- [ ] Updated test asserts `UpdateLot` is not called
- [ ] Updated test asserts `invRepo.Update` is not called
- [ ] Test name updated to reflect new behavior: `TestEditTransaction_BuyToSell_SingleLot_InsufficientQtyAfterReversal_RejectsPreFlight`

### FR-3: New Test — BUY→SELL Guard with Exact Boundary

**Acceptance criteria:**
- [ ] New test: qty after reversal == 0, sell qty == 1 → guard fires (0 < 1)
- [ ] New test: qty after reversal == 5000, sell qty == 5000 → guard passes (5000 >= 5000 — exact match is valid)
- [ ] New test: qty after reversal == 3000, sell qty == 5000 → guard fires (3000 < 5000)

### FR-4: New Error Code

Add `InvestmentEditSellInsufficientQty` to `pkg/errors/codes.go`.

**Acceptance criteria:**
- [ ] New field `InvestmentEditSellInsufficientQty string` in the `ErrorCodes` struct
- [ ] Assigned value `"INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY"`

### FR-5: i18n Error Messages

Add the new error code to both locale files.

**Acceptance criteria:**
- [ ] `en/errors.json`: `"INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY": "Cannot change to sell: only {remaining} units remain after reversing the buy, but {requested} were requested."`
- [ ] `vi/errors.json`: `"INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY": "Không thể đổi thành bán: chỉ còn {remaining} đơn vị sau khi đảo ngược giao dịch mua, nhưng yêu cầu bán {requested}."`

Note: The backend error message carries the actual numbers. The frontend maps the error code to the i18n string. Since backend messages are displayed directly via `error.message` in the frontend (not via error code lookup), the backend message should be in Vietnamese (matching app locale) or use a generic message and rely on the code for i18n lookup. Looking at existing patterns (`errors.json` maps code → display string), the frontend uses `error.message` directly. So the backend message should be human-readable in Vietnamese since the app is Vietnamese-first. Use Vietnamese in the backend error message string.

## Non-Functional Requirements

- **No DB writes on failure** — the guard must run before any repository call that mutates data
- **No new dependencies** — pure in-service logic using already-available `investment.Quantity` and `oldTx.Quantity`
- **Backward compatible** — no proto changes, no API changes, no frontend changes (only error message changes)
- **Test coverage** — all new cases covered by unit tests; existing test updated

## Architecture Changes

No C4 diagram changes needed — no new components, services, or repositories.

## Runtime Flow Diagrams

Update `docs/architecture/flow-investment.md` — Section 9 "Edit Transaction (Delete-and-Recreate)" to add the new pre-flight guard step between step 5 (existing type-change guard) and step 7 (reversal).

## Data Model Changes

None.

## API Changes

None (no proto changes). The error response shape is unchanged; only the error code and message differ.

## UI/UX Changes

None. The frontend already displays `error.message` from the API response. The new message is more descriptive, which is the fix.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (JWT-authenticated) | EditTransaction request (transactionID, qty, type=SELL) | Yes: Internet → App | EditTransaction handler | JWT verified by middleware |
| 2 | Handler | Validated request | No | Service layer | Internal |
| 3 | Service | DB read (GetByIDForUser) | No | PostgreSQL | Ownership check via JOIN |
| 4 | Service | Pre-flight check (pure arithmetic) | No | No DB write | **New: runs before any mutation** |
| 5 | Service | Reversal writes | No | PostgreSQL | Only reached if pre-flight passes |

### Threats Identified

| # | STRIDE | Threat | Severity | Mitigation |
|---|--------|--------|----------|------------|
| T-1 | Tampering | Attacker sends large `req.Quantity` to trigger guard and probe investment state | Low | Guard returns only a validation error with no internal state info |
| T-2 | Information Disclosure | Error message reveals `investment.Quantity` | Low | Acceptable — user owns the investment and can see qty in the UI already |

### Authorization Rules

Unchanged — ownership check via `GetByIDForUser` (JOIN-based) still runs before any guard.

### Input Validation Rules

No new input fields. The guard uses server-side values (`investment.Quantity`, `oldTx.Quantity`) — not user-supplied values directly. `req.Quantity` is user-supplied but already validated positive elsewhere.

## Edge Cases & Error Handling

| Case | Expected behavior |
|------|-------------------|
| Only 1 BUY tx, sell qty == buy qty | Guard fires: `0 < buyQty` → error |
| Only 1 BUY tx, sell qty < buy qty | Guard fires: `0 < sellQty` → error (can't sell from a buy you just reversed) |
| 2 BUY txs, editing one to SELL where remaining qty ≥ sell qty | Guard passes → happy path |
| 2 BUY txs, editing one to SELL where remaining qty < sell qty | Guard fires → error |
| BUY→SELL where `alreadySold > 0` | Existing guard in step 5 fires first (before new guard) |
| BUY→BUY (no type change) | New guard does not run |
| SELL→BUY or SELL→SELL | New guard does not run |

## Out of Scope

- Full DB-level atomicity via `SELECT FOR UPDATE` / transaction wrapping (known technical debt, separate cycle)
- Concurrent-replay race condition (known technical debt, separate cycle)
- Any other BUY→SELL paths beyond the `EditTransaction` service method
