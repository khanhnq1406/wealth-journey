# Wallet Domain — Runtime Flows

Wallet management flows covering creation with initial balance, inter-wallet fund transfers, and multi-option deletion. All monetary operations use signed transactions where positive = income and negative = expense.

## Table of Contents

- [Create Wallet (with Initial Balance)](#1-create-wallet-with-initial-balance)
- [Transfer Funds Between Wallets](#2-transfer-funds-between-wallets)
- [Delete Wallet (3 Options)](#3-delete-wallet-3-options)

---

## 1. Create Wallet (with Initial Balance)

**Trigger:** User submits "Create Wallet" form with optional initial balance
**Endpoint:** `POST /api/v1/wallets`
**Source:** `domain/service/wallet_service.go:64-159`, `handlers/wallet_v2.go:39-76`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as WalletHandler
    participant WS as WalletService
    participant UR as UserRepository
    participant WR as WalletRepository
    participant CS as CategoryService
    participant TR as TransactionRepository
    participant Cache as CurrencyCache

    SPA->>H: POST /api/v1/wallets<br/>{walletName, initialBalance, currency, type}
    H->>H: Validate walletName, currency
    H->>WS: CreateWallet(userID, req)

    activate WS
    WS->>UR: GetByID(userID)
    alt User not found
        UR-->>WS: nil
        WS-->>H: 404 Not Found
    end
    UR-->>WS: User

    WS->>WS: Validate initialBalance >= 0<br/>Default currency to USD if empty

    WS->>WR: Create(Wallet{balance: 0, currency, type})
    WR-->>WS: Created wallet (balance = 0)

    alt initialBalance > 0
        WS->>CS: GetOrCreateInitialBalanceCategory(userID)
        alt Category creation fails
            CS-->>WS: Error
            WS->>WR: Delete(walletID)
            Note over WS,WR: ROLLBACK: delete wallet
            WS-->>H: Error
        end
        CS-->>WS: Category (Initial Balance)

        WS->>TR: Create(Transaction{walletID, amount: +initialBalance, note: "Initial balance"})
        alt Transaction creation fails
            TR-->>WS: Error
            WS->>WR: Delete(walletID)
            Note over WS,WR: ROLLBACK: delete wallet
            WS-->>H: Error
        end
        TR-->>WS: Transaction created

        WS->>WR: UpdateBalance(walletID, +initialBalance)
        alt Balance update fails
            WR-->>WS: Error
            WS->>TR: Delete(transactionID)
            WS->>WR: Delete(walletID)
            Note over WS,TR: ROLLBACK: delete tx + wallet
            WS-->>H: Error
        end
        WR-->>WS: Updated wallet
    end

    opt FX cache population
        WS->>Cache: populateWalletCache()
        Note over WS,Cache: Non-critical: log on failure
    end

    WS->>WS: enrichWalletProto()<br/>Add displayBalance in preferred currency
    deactivate WS

    WS-->>H: CreateWalletResponse
    H-->>SPA: 201 Created + wallet data
```

### Key Invariants

- Wallet is always created with `balance: 0` first; initial balance is applied via a transaction
- The "Initial Balance" category is auto-created if it doesn't exist (income type)
- Rollback is manual (delete operations), not database-transaction-based
- `enrichWalletProto()` adds `displayBalance` converted to the user's preferred currency via FX rates

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| User not found | 404 | None (wallet not created) |
| Negative initial balance | 400 Validation | None |
| Category creation fails | 500 | Delete wallet |
| Transaction creation fails | 500 | Delete wallet |
| Balance update fails | 500 | Delete transaction + wallet |
| Cache population fails | Warning logged | None (non-critical) |

---

## 2. Transfer Funds Between Wallets

**Trigger:** User submits transfer form with source, destination, and amount
**Endpoint:** `POST /api/v1/wallets/transfer`
**Source:** `domain/service/wallet_service.go:572-681`, `handlers/wallet_v2.go:342-378`

```mermaid
sequenceDiagram
    participant SPA as Next.js SPA
    participant H as WalletHandler
    participant WS as WalletService
    participant WR as WalletRepository
    participant CS as CategoryService
    participant TR as TransactionRepository
    participant Cache as CurrencyCache

    SPA->>H: POST /api/v1/wallets/transfer<br/>{fromWalletId, toWalletId, amount}
    H->>WS: TransferFunds(userID, req)

    activate WS
    WS->>WS: Validate fromWalletId != toWalletId
    WS->>WR: GetByIDForUser(fromWalletId, userID)
    WS->>WR: GetByIDForUser(toWalletId, userID)

    WS->>WS: Validate amount > 0
    WS->>WS: Validate same currency<br/>(both wallets must match)
    WS->>WS: Check fromWallet.Balance >= amount

    WS->>CS: GetOrCreate("Outgoing Transfer", EXPENSE)
    WS->>CS: GetOrCreate("Incoming Transfer", INCOME)

    Note over WS: Create linked transaction pair

    WS->>TR: Create(Tx{fromWallet, -amount, "Transfer to {name}"})
    TR-->>WS: Outgoing tx created

    WS->>TR: Create(Tx{toWallet, +amount, "Transfer from {name}"})
    alt Incoming tx fails
        TR-->>WS: Error
        WS->>TR: Delete(outgoingTxID)
        Note over WS,TR: ROLLBACK: delete outgoing tx
        WS-->>H: Error
    end
    TR-->>WS: Incoming tx created

    WS->>WR: UpdateBalance(fromWalletId, -amount)
    alt Source balance update fails
        WR-->>WS: Error
        WS->>TR: Delete(outgoingTxID)
        WS->>TR: Delete(incomingTxID)
        Note over WS,TR: ROLLBACK: delete both txs
        WS-->>H: Error
    end

    WS->>WR: UpdateBalance(toWalletId, +amount)
    alt Dest balance update fails
        WR-->>WS: Error
        WS->>WR: RefundBalance(fromWalletId, +amount)
        WS->>TR: Delete(outgoingTxID)
        WS->>TR: Delete(incomingTxID)
        Note over WS,WR: ROLLBACK: refund + delete both txs
        WS-->>H: Error
    end

    par Cache invalidation
        WS->>Cache: invalidate + populate(fromWallet)
        WS->>Cache: invalidate + populate(toWallet)
    end

    deactivate WS

    WS-->>H: TransferFundsResponse
    H-->>SPA: 200 OK
```

### Key Invariants

- Both wallets **must have the same currency** — cross-currency transfers are not supported
- Two linked transactions are created: one expense (negative) on source, one income (positive) on destination
- Transaction notes reference the other wallet's name for traceability
- Balance updates are sequential, not within a DB transaction — partial failure can leave inconsistent state

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Same source and destination | 400 Validation | None |
| Wallet not found or not owned | 404 | None |
| Different currencies | 400 Validation | None |
| Insufficient balance | 400 Validation | None |
| Incoming tx creation fails | 500 | Delete outgoing tx |
| Source balance update fails | 500 | Delete both txs |
| Dest balance update fails | 500 | Refund source + delete both txs |

---

## 3. Delete Wallet (3 Options)

**Trigger:** User selects a deletion strategy for a wallet
**Endpoint:** `DELETE /api/v1/wallets/:id`
**Source:** `domain/service/wallet_service.go:356-467`, `handlers/wallet_v2.go:209-248`

```mermaid
flowchart TD
    A["DELETE /api/v1/wallets/:id\n{option: ARCHIVE | TRANSFER | DELETE_ONLY}"] --> B["Validate wallet ownership"]
    B --> C["Count transactions in wallet"]
    C --> D{Deletion option?}

    D -- "ARCHIVE\n(default)" --> E["Set wallet.Status = ARCHIVED"]
    E --> F["WalletRepository.Update()"]
    F --> G["Invalidate cache"]
    G --> H["200 OK\n'Wallet archived'"]

    D -- "TRANSFER" --> I{Target wallet\nprovided?}
    I -- No --> J["400 Validation Error"]:::error
    I -- Yes --> K["Validate target wallet\nownership + same currency"]
    K --> L["Calculate txSum =\nSUM(all transaction amounts)"]
    L --> M["TransactionRepo.TransferToWallet\n(sourceID → targetID)"]
    M --> N["UpdateBalance(targetID, +txSum)"]
    N --> O{Balance update\nsucceeded?}
    O -- No --> P["ROLLBACK:\nTransferToWallet(targetID → sourceID)"]:::error
    O -- Yes --> Q["WalletRepository.Delete()\n(soft delete source)"]
    Q --> R["Invalidate cache for both wallets"]
    R --> S["200 OK\n'Wallet deleted, txs transferred'"]

    D -- "DELETE_ONLY" --> T["WalletRepository.Delete()\n(soft delete)"]
    T --> U["Invalidate cache"]
    U --> V["200 OK\n'Wallet deleted.\nN transactions preserved but inaccessible'"]

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Default option is `ARCHIVE` if no option or empty body is provided
- `ARCHIVE` only changes status — no data is lost and the wallet can potentially be restored
- `TRANSFER` moves all transactions and adjusts the target wallet's balance by the net sum of transferred transactions
- `DELETE_ONLY` soft-deletes the wallet; transactions remain in the database but are orphaned
- All deletions are soft deletes (`gorm.DeletedAt`) — data is never physically removed

### Deletion Options

| Option | Wallet | Transactions | Balance | Use Case |
|--------|--------|--------------|---------|----------|
| **ARCHIVE** | Status → ARCHIVED | Preserved, still linked | No change | Temporary hiding |
| **TRANSFER** | Soft deleted | Moved to target wallet | Target += txSum | Consolidation |
| **DELETE_ONLY** | Soft deleted | Orphaned (preserved in DB) | No change | Clean removal |

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Wallet not found / not owned | 404 | None |
| TRANSFER: no target wallet ID | 400 Validation | None |
| TRANSFER: target not found / not owned | 404 | None |
| TRANSFER: currency mismatch | 400 Validation | None |
| TRANSFER: balance update fails | 500 | Reverse transaction transfer |
