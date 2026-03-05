# Transaction Domain — Runtime Flows

Transaction management flows covering CRUD operations and bank statement import. All amounts use the signed convention: positive = income, negative = expense. Balance updates are applied as deltas to the wallet's current balance.

## Table of Contents

- [Create Transaction](#1-create-transaction)
- [Update Transaction](#2-update-transaction)
- [Delete Transaction](#3-delete-transaction)
- [Bank Statement Import Pipeline](#4-bank-statement-import-pipeline)

---

## 1. Create Transaction

**Trigger:** User submits "Add Transaction" form
**Endpoint:** `POST /api/v1/transactions`
**Source:** `domain/service/transaction_service.go:48-135`, `handlers/transaction.go:38-72`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as TransactionHandler
    participant TS as TransactionService
    participant WR as WalletRepository
    participant CR as CategoryRepository
    participant TR as TransactionRepository
    participant Cache as CurrencyCache

    SPA->>H: POST /api/v1/transactions<br/>{walletId, amount, categoryId, date, note}
    H->>H: Validate walletId != 0, amount != 0
    H->>TS: CreateTransaction(userID, req)

    activate TS
    TS->>WR: GetByIDForUser(walletId, userID)
    alt Wallet not found / not owned
        WR-->>TS: nil
        TS-->>H: 404 Not Found
    end
    WR-->>TS: Wallet

    opt categoryId provided
        TS->>CR: GetByIDForUser(categoryId, userID)
        alt Category not found / not owned
            CR-->>TS: nil
            TS-->>H: 404 Not Found
        end
    end

    TS->>TS: balanceDelta = amount<br/>(positive for income, negative for expense)
    TS->>TS: newBalance = wallet.Balance + balanceDelta

    alt newBalance < 0
        TS-->>H: 400 Insufficient balance
    end

    TS->>TR: Create(Transaction{walletId, amount, categoryId, date, note})
    TR-->>TS: Transaction created

    TS->>WR: UpdateBalance(walletId, balanceDelta)
    WR-->>TS: Updated wallet

    opt Cache enrichment
        TS->>Cache: populateWalletCache()
        TS->>TS: enrichProto() with display currency
    end
    deactivate TS

    TS-->>H: {transaction, newBalance}
    H-->>SPA: 201 Created
```

### Key Invariants

- Amount sign determines direction: positive = adds to balance (income), negative = subtracts (expense)
- Balance is checked **before** the transaction is created — negative balances are rejected
- Transaction and balance update are separate DB calls (not within a DB transaction)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Wallet not found / not owned | 404 | None |
| Category not found / not owned | 404 | None |
| Insufficient balance (would go negative) | 400 | None |
| Transaction creation fails | 500 | None (balance unchanged) |
| Balance update fails | 500 | Transaction exists with stale balance |

---

## 2. Update Transaction

**Trigger:** User edits an existing transaction (amount, category, date, or wallet)
**Endpoint:** `PUT /api/v1/transactions/:id`
**Source:** `domain/service/transaction_service.go:219-355`, `handlers/transaction.go:172-208`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as TransactionHandler
    participant TS as TransactionService
    participant TR as TransactionRepository
    participant WR as WalletRepository
    participant Cache as CurrencyCache

    SPA->>H: PUT /api/v1/transactions/:id<br/>{amount, categoryId, walletId, date, note}
    H->>TS: UpdateTransaction(userID, txID, req)

    activate TS
    TS->>TR: GetByIDForUser(txID, userID)
    TR-->>TS: Existing transaction (oldTx)

    alt Wallet change requested
        TS->>WR: GetByIDForUser(newWalletId, userID)
        WR-->>TS: New wallet
    end

    TS->>TS: Calculate balance deltas

    alt Same Wallet
        Note over TS: oldDelta = calculateBalanceDelta(oldTx.Amount)<br/>newDelta = calculateBalanceDelta(req.Amount)<br/>totalDelta = newDelta - oldDelta
        TS->>TS: Verify wallet.Balance + totalDelta >= 0

        TS->>WR: UpdateBalance(walletID, totalDelta)
        WR-->>TS: Updated wallet
    else Different Wallet
        Note over TS: oldDelta = calculateBalanceDelta(oldTx.Amount)<br/>newDelta = calculateBalanceDelta(req.Amount)
        TS->>TS: Verify newWallet.Balance + newDelta >= 0

        TS->>WR: UpdateBalance(oldWalletId, -oldDelta)
        Note over TS,WR: Step 1: Revert old wallet

        TS->>WR: UpdateBalance(newWalletId, +newDelta)
        Note over TS,WR: Step 2: Apply to new wallet<br/>⚠ If fails: old wallet already reverted
    end

    TS->>TR: Update(transaction{amount, category, wallet, date, note})
    TR-->>TS: Updated transaction

    opt Cache operations
        TS->>Cache: invalidate + populate wallet cache
    end
    deactivate TS

    TS-->>H: {transaction, newBalance}
    H-->>SPA: 200 OK
```

### Key Invariants

- **Same wallet:** A single delta is applied: `newDelta - oldDelta`. Example: changing expense from -100 to -150 applies delta of -50
- **Wallet change:** Two-step process — revert old wallet's balance, then apply to new wallet. These are **not** within a DB transaction
- Balance check happens against the new wallet's balance (including the new amount's effect)

### Balance Delta Examples

| Change | Old Amount | New Amount | Delta | Effect |
|--------|-----------|-----------|-------|--------|
| Increase expense | -100 | -150 | -50 | Balance decreases by 50 |
| Decrease expense | -100 | -50 | +50 | Balance increases by 50 |
| Increase income | +200 | +300 | +100 | Balance increases by 100 |
| Change type | -100 | +100 | +200 | Reversal: balance increases by 200 |

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Transaction not found / not owned | 404 | None |
| New wallet not found / not owned | 404 | None |
| Insufficient balance after update | 400 | None |
| Wallet change step 2 fails | 500 | Old wallet already reverted (inconsistency risk) |
| Transaction update fails | 500 | Wallet balances already modified (inconsistency risk) |

---

## 3. Delete Transaction

**Trigger:** User confirms transaction deletion
**Endpoint:** `DELETE /api/v1/transactions/:id`
**Source:** `domain/service/transaction_service.go:358-403`, `handlers/transaction.go:222-245`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as TransactionHandler
    participant TS as TransactionService
    participant TR as TransactionRepository
    participant CR as CategoryRepository
    participant WR as WalletRepository
    participant Cache as CurrencyCache

    SPA->>H: DELETE /api/v1/transactions/:id
    H->>TS: DeleteTransaction(userID, txID)

    activate TS
    TS->>TR: GetByIDForUser(txID, userID)
    TR-->>TS: Transaction

    opt Category exists
        TS->>CR: GetByID(tx.CategoryID)
        Note over TS,CR: Needed for balance delta calculation
    end

    TS->>TS: balanceDelta = calculateBalanceDelta(tx.Amount)<br/>restoreDelta = -balanceDelta
    Note over TS: Example: expense -100 → restore +100

    TS->>TR: Delete(txID)
    Note over TS,TR: Soft delete (sets gorm.DeletedAt)

    TS->>WR: UpdateBalance(walletID, restoreDelta)
    Note over TS,WR: Restore the wallet balance

    opt Cache invalidation
        TS->>Cache: invalidateWalletCache()
    end
    deactivate TS

    TS-->>H: {restoredBalance}
    H-->>SPA: 200 OK
```

### Key Invariants

- Balance is **restored** by applying the negative of the original delta (expense deletion adds money back)
- Deletion is always a soft delete via `gorm.DeletedAt` — data remains in the database
- Delete and balance restore are separate DB calls (not atomic)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Transaction not found / not owned | 404 | None |
| Soft delete fails | 500 | Balance unchanged |
| Balance restore fails | 500 | Transaction deleted but balance stale |

---

## 4. Bank Statement Import Pipeline

**Trigger:** User uploads a CSV file and confirms import
**Endpoint:** `POST /api/v1/import/execute`
**Source:** `domain/service/import_service.go:262-790`, `handlers/import.go:673-740`

```mermaid
flowchart TD
    A["POST /api/v1/import/execute\n{walletId, transactions, duplicateStrategy, excludedRows}"] --> B["Validate request\n- Max 10,000 rows\n- Date range check"]

    B --> C{"> 500 transactions?"}
    C -- Yes --> D["Enqueue background job\nReturn jobID immediately"]
    C -- No --> E["Filter valid transactions\nExclude rows by number"]

    E --> F{Any valid\ntransactions?}
    F -- No --> G["Error: no valid transactions"]:::error
    F -- Yes --> H{"Duplicate strategy?"}

    H -- "KEEP_ALL" --> K["Skip detection\nCreate all as new"]
    H -- "SKIP_ALL" --> I["Detect duplicates\nSkip all matches"]
    H -- "AUTO_MERGE" --> I
    H -- "REVIEW_EACH" --> I

    I --> J["duplicateDetector.DetectDuplicates()\nMatch by: amount ± tolerance,\ndate ± 2 days, description similarity"]

    J --> L["Process each transaction"]

    K --> L

    L --> M{"For each tx:\nisDuplicate?"}

    M -- "Yes + SKIP_ALL" --> N["Skip\nduplicatesSkipped++"]
    M -- "Yes + AUTO_MERGE" --> O["Update existing tx\nduplicatesMerged++"]
    M -- "Yes + REVIEW_EACH" --> P{"User decision?"}
    P -- MERGE --> O
    P -- SKIP --> N
    P -- "KEEP_BOTH" --> Q["Create new tx"]
    M -- "No / KEEP_ALL" --> Q

    Q --> R["Get/create category\n(suggested or auto-categorized)"]
    R --> S["Convert amount\n(parser ×10000 → currency unit)"]
    S --> T{Amount == 0?}
    T -- Yes --> U["Log + skip"]
    T -- No --> V["Append to\ntransactionsToCreate"]

    O --> W["Append to\ntransactionsToUpdate"]

    V --> X["Create ImportBatch record\n{batchID, stats, canUndo: true, undoExpires: +24h}"]
    W --> X
    N --> X
    U --> X

    X --> Y["Bulk update merged txs"]
    Y --> Z["Bulk create new txs\n+ wallet balance update"]
    Z --> AA["Link txs to import batch"]

    AA --> AB["Balance verification\nactualChange == expectedChange?"]
    AB --> AC{Verified?}
    AC -- No --> AD["Log critical integrity error\nReturn error"]:::error
    AC -- Yes --> AE["Return ImportResponse\n{batchId, summary, newBalance}"]

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Imports exceeding 500 transactions are automatically queued for background processing
- Duplicate detection uses multi-criteria matching: amount (within tolerance), date (±2 days), description similarity
- Amount conversion: parser stores at ×10,000 precision; conversion to currency units divides by 10,000
- Balance verification post-import catches any discrepancies between expected and actual balance changes
- Import batches support undo within a 24-hour window via `POST /api/v1/import/:id/undo`

### Duplicate Strategies

| Strategy | Duplicates Found | Behavior |
|----------|-----------------|----------|
| **KEEP_ALL** | Not detected | All transactions created as new |
| **SKIP_ALL** | Auto-skipped | Duplicates silently excluded |
| **AUTO_MERGE** | Auto-merged | Existing transactions updated in place |
| **REVIEW_EACH** | User decides per match | MERGE, SKIP, or KEEP_BOTH per duplicate |

### Undo Import Flow

The undo operation runs within a **database transaction** (unlike most other operations):

1. Validate: batch exists, owned by user, `canUndo: true`, within 24h window
2. Calculate reversal deltas per wallet (negate all transaction amounts)
3. **BEGIN DB TRANSACTION**
4. Soft-delete all imported transactions
5. Restore wallet balances with reversal deltas
6. Mark batch as undone (`undoneAt`, `canUndo: false`)
7. **COMMIT** (all-or-nothing)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Max rows exceeded (> 10,000) | 400 Validation | None |
| Future dates / dates > 10 years old | 400 Validation | None |
| No valid transactions after filtering | 400 | None |
| Duplicate detection fails | 500 | None (no changes made yet) |
| Bulk create fails | 500 | Batch created but no txs |
| Balance verification mismatch | 500 Critical | Transactions created, logged for manual review |
| Undo: expired (> 24h) | 400 | None |
| Undo: any DB step fails | 500 | Full DB transaction rollback |
