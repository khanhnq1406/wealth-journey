# Investment User Ownership — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add direct `UserID` ownership to investments and investment transactions, making `WalletID` nullable so users can create investments without wallets.

**Spec:** `docs/specs/2026-03-17-investment-user-ownership-spec.md`

**Architecture:** Investment model gains a `UserID` FK directly to the user table. All repository queries switch from wallet-JOIN-based authorization to direct `user_id` WHERE clauses. `WalletID` becomes optional (`*int32`). The service layer removes wallet auto-selection from `CreateInvestment`. A migration backfills `user_id` from the wallet relationship.

**Tech Stack:** Go 1.23, GORM, PostgreSQL, Protocol Buffers, React Query (frontend — no changes needed)

## Security Implementation Notes

- **Authentication**: Unchanged — JWT middleware extracts `userID` from token
- **Authorization**: `user_id` column on investment/transaction replaces wallet-JOIN-based ownership checks. Every repository query MUST include `user_id` filter.
- **Input validation**: `walletId` if > 0 must belong to authenticated user (server-side check). `userId` never accepted from request body.
- **Data integrity**: Migration backfills `user_id` with verification COUNT query before making `wallet_id` nullable.

---

### Task 0: Protobuf — Add `userId` Field to Investment Message

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** `userId` is read-only in responses — never accepted from request body.

**Steps:**

1. Add `int32 userId = 28 [json_name = "userId"]` to the `Investment` message (after field 27 `isCustom`)
2. Add comment on `CreateInvestmentRequest.walletId` (field 1): `// Optional: 0 or omitted = no wallet association`
3. Run `task proto:all` to regenerate Go + TypeScript types
4. Verify generated code compiles: `cd src/go-backend && go build ./...`

---

### Task 1: Database Migration — Add `user_id`, Make `wallet_id` Nullable

**Files:**
- Create: `src/go-backend/cmd/migrate-investment-user-ownership/main.go`
- Modify: `Taskfile.yml` (add migration task)

**Security notes:** Migration must be idempotent. Backfill uses wallet FK to derive user ownership. Verify no orphaned rows (user_id=0) before making wallet_id nullable.

**Steps:**

1. Create migration file following existing pattern (see `cmd/migrate-wallet-type/`):
   - Accept `--dry-run` flag (default: true)
   - **Phase 1**: `ALTER TABLE investment ADD COLUMN IF NOT EXISTS user_id INT NOT NULL DEFAULT 0`
   - **Phase 2**: Backfill: `UPDATE investment SET user_id = w.user_id FROM wallet w WHERE w.id = investment.wallet_id AND investment.user_id = 0`
   - **Phase 3**: Verify: `SELECT COUNT(*) FROM investment WHERE user_id = 0 AND deleted_at IS NULL` (must be 0)
   - **Phase 4**: `ALTER TABLE investment ALTER COLUMN wallet_id DROP NOT NULL`
   - **Phase 5**: `CREATE INDEX IF NOT EXISTS idx_investment_user ON investment(user_id)`
   - **Phase 6**: `CREATE INDEX IF NOT EXISTS idx_investment_user_type ON investment(user_id, type)`
   - Repeat phases 1-5 for `investment_transaction` table (add `user_id`, backfill from wallet, make `wallet_id` nullable, add index)
   - Log counts at each phase
2. Add `backend:migrate-investment-user-ownership` task to `Taskfile.yml`
3. Test with `--dry-run=true` first, then `--dry-run=false`

---

### Task 2: Model Changes — Investment and InvestmentTransaction

**Files:**
- Modify: `src/go-backend/domain/models/investment.go`
- Modify: `src/go-backend/domain/models/investment_transaction.go`
- Modify: `src/go-backend/domain/service/mapper.go`

**Security notes:** `UserID` must be non-null. `WalletID` becomes `*int32` (nullable).

**Steps:**

1. **`investment.go`** — Update `Investment` struct:
   - Add field after `WalletID`: `UserID int32 \`gorm:"not null;index:idx_investment_user" json:"userId"\``
   - Change `WalletID` from `int32` to `*int32` and update gorm tag to remove `not null`: `WalletID *int32 \`gorm:"index:idx_investment_wallet" json:"walletId"\``
   - Update `Wallet` relationship to use `constraint:OnDelete:SET NULL`: `Wallet *Wallet \`gorm:"foreignKey:WalletID;constraint:OnDelete:SET NULL" json:"wallet,omitempty"\``
   - Add `User` relationship: `User *User \`gorm:"foreignKey:UserID" json:"user,omitempty"\``
   - Update `ToProto()`:
     - Add `UserId: i.UserID`
     - Handle nullable WalletID: `WalletId: derefInt32(i.WalletID)` (add helper function)

2. **`investment_transaction.go`** — Update `InvestmentTransaction` struct:
   - Add field after `WalletID`: `UserID int32 \`gorm:"not null;index:idx_investment_tx_user" json:"userId"\``
   - Change `WalletID` from `int32` to `*int32` and remove `not null`
   - Update `ToProto()`:
     - Handle nullable WalletID: `WalletId: derefInt32(tx.WalletID)`

3. **`mapper.go`** — Update `InvestmentMapper`:
   - `ModelToProto()` (line 223): Add `UserId: investment.UserID`, change `WalletId: derefInt32(investment.WalletID)`
   - `TransactionToProto()` (line 265): Change `WalletId: derefInt32(tx.WalletID)`

4. Add helper function `derefInt32(p *int32) int32` in `investment.go` or a shared utils file

5. Verify build: `cd src/go-backend && go build ./...`

---

### Task 3: Repository Interface — Update Signatures

**Files:**
- Modify: `src/go-backend/domain/repository/investment_repository.go`

**Security notes:** `GetByWalletAndSymbol` → `GetByUserAndSymbol` changes uniqueness scope from per-wallet to per-user.

**Steps:**

1. Rename method: `GetByWalletAndSymbol(ctx, walletID, symbol)` → `GetByUserAndSymbol(ctx, userID int32, symbol string)`
2. Update comment for `GetByIDForUser`: "ensuring it belongs to the user" (remove "user's wallet" reference)
3. Update comment for `ListByUserID`: "directly via user_id" (remove "via their wallets" reference)
4. Verify build: `cd src/go-backend && go build ./...` (expect compile errors — these are fixed in Task 4)

---

### Task 4: Repository Implementation — Update Queries

**Files:**
- Modify: `src/go-backend/domain/repository/investment_repository_impl.go`
- Modify: `src/go-backend/domain/repository/investment_transaction_repository_impl.go`

**Security notes:** Every query that previously used wallet JOIN must now use direct `user_id` filter. Missing `user_id` filter = authorization bypass vulnerability.

**Steps:**

1. **`GetByIDForUser`** (line 48-58): Remove JOIN, use direct `user_id`:
   ```go
   result := r.db.DB.WithContext(ctx).
       Where("id = ? AND user_id = ?", investmentID, userID).
       First(&investment)
   ```

2. **`GetByWalletAndSymbol`** → **`GetByUserAndSymbol`** (line 60-74): Rename method, change query:
   ```go
   func (r *investmentRepository) GetByUserAndSymbol(ctx context.Context, userID int32, symbol string) (*models.Investment, error) {
       // ...
       Where("user_id = ? AND symbol = ?", userID, symbol)
   ```

3. **`ListByUserID`** (line 76-120): Remove wallet subquery, query directly:
   ```go
   query := r.db.DB.WithContext(ctx).Model(&models.Investment{}).Where("user_id = ?", userID)
   ```
   Remove the wallet ID pluck logic (lines 79-91).

4. **`GetPortfolioSummary`** (line 228): No signature change needed — it already takes `walletID` and uses `ListByWalletID`. Keep as-is (used by wallet-specific portfolio summary).

5. **`GetAggregatedPortfolioSummary`** (line 282-338): Already delegates to `ListByUserID` — after step 3, this automatically becomes efficient.

6. **`investment_transaction_repository_impl.go` — `GetByIDForUser`** (line 44-55): Remove wallet subquery:
   ```go
   result := r.db.DB.WithContext(ctx).
       Joins("JOIN investment ON investment_transaction.investment_id = investment.id").
       Where("investment_transaction.id = ? AND investment.user_id = ?", txID, userID).
       First(&tx)
   ```

7. Verify build: `cd src/go-backend && go build ./...`

---

### Task 5: Service Layer — Remove Wallet Dependency from CreateInvestment

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go`

**Security notes:** If `walletId > 0` is provided, MUST verify it belongs to the user before associating.

**Steps:**

1. **`CreateInvestment`** (lines 111-125): Replace wallet auto-selection block with:
   ```go
   // walletId is now optional — 0 means no wallet association
   var walletIDPtr *int32
   if req.WalletId > 0 {
       // Verify wallet belongs to user
       _, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
       if err != nil {
           return nil, err
       }
       walletIDPtr = &req.WalletId
   }
   ```

2. Remove the second wallet verification (line 148-152) — already handled above or not needed when `walletId == 0`.

3. **Symbol uniqueness** (line 163): Change `GetByWalletAndSymbol` to `GetByUserAndSymbol`:
   ```go
   existing, err := s.investmentRepo.GetByUserAndSymbol(ctx, userID, req.Symbol)
   ```

4. **Create investment model** (line 234-247): Set `UserID` and use nullable `WalletID`:
   ```go
   investment := &models.Investment{
       UserID:       userID,
       WalletID:     walletIDPtr,
       // ... rest unchanged
   }
   ```

5. **Create initial transaction** (line 261-271): Set `UserID` and nullable `WalletID`:
   ```go
   tx := &models.InvestmentTransaction{
       InvestmentID:    investment.ID,
       UserID:          userID,
       WalletID:        walletIDPtr,
       // ... rest unchanged
   }
   ```

6. **Wallet cache invalidation** (line 312-314): Only invalidate if wallet is associated:
   ```go
   if walletIDPtr != nil {
       if ws, ok := s.walletService.(*walletService); ok {
           ws.invalidateInvestmentValueCache(ctx, *walletIDPtr)
       }
   }
   ```

7. **Portfolio history snapshot** (line 319-335): Skip backfill when no wallet:
   ```go
   if req.PurchaseDate > 0 && walletIDPtr != nil {
       summary, err := s.GetPortfolioSummary(ctx, *walletIDPtr, userID, 0)
       // ...
       snapshot := &models.PortfolioHistory{
           UserID:     userID,
           WalletID:   *walletIDPtr,
           // ...
       }
   }
   ```

8. Verify build: `cd src/go-backend && go build ./...`

---

### Task 6: Service Layer — Update AddTransaction and Other Wallet References

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go`

**Security notes:** Transaction authorization now uses investment's `user_id` directly, no wallet JOIN needed.

**Steps:**

1. **`AddTransaction`** (line 585-588): Remove wallet ownership verification (investment ownership already verified via `GetByIDForUser`):
   ```go
   // Remove this block:
   // _, err = s.walletRepo.GetByIDForUser(ctx, investment.WalletID, userID)
   ```

2. **`processBuyTransaction`** (line 739-741): Use investment's UserID and WalletID for transaction:
   ```go
   tx := &models.InvestmentTransaction{
       InvestmentID:      investment.ID,
       UserID:            investment.UserID,
       WalletID:          investment.WalletID, // Already *int32 after Task 2
       // ... rest unchanged
   }
   ```

3. **`processSellTransaction`** (line 843-845): Same as buy:
   ```go
   tx := &models.InvestmentTransaction{
       InvestmentID:    investment.ID,
       UserID:          investment.UserID,
       WalletID:        investment.WalletID,
       // ... rest unchanged
   }
   ```

4. **`processDividendTransaction`** (line 899-901): Same pattern:
   ```go
   tx := &models.InvestmentTransaction{
       InvestmentID:    investment.ID,
       UserID:          investment.UserID,
       WalletID:        investment.WalletID,
       // ... rest unchanged
   }
   ```

5. **`AddTransaction` wallet cache invalidation** (line 645-648): Guard with nil check:
   ```go
   if investment.WalletID != nil {
       if ws, ok := s.walletService.(*walletService); ok {
           ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
       }
   }
   ```

6. **`DeleteInvestment` wallet cache invalidation** (line 547-549): Same guard:
   ```go
   if investment.WalletID != nil {
       if ws, ok := s.walletService.(*walletService); ok {
           ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
       }
   }
   ```

7. Verify build: `cd src/go-backend && go build ./...`

---

### Task 7: Service Layer — Update UpdatePrices and ListUserInvestments

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go`

**Security notes:** `UpdatePrices` currently iterates wallets to find investments — should use `ListByUserID` directly.

**Steps:**

1. **`UpdatePrices`** (lines 1392-1408): Replace wallet iteration with direct user query:
   ```go
   // OLD: iterate wallets, query investments per wallet
   // NEW: query all user investments directly
   allInvestments, _, err := s.investmentRepo.ListByUserID(ctx, userID, repository.ListOptions{
       Limit: 10000,
   }, v1.InvestmentType_INVESTMENT_TYPE_UNSPECIFIED)
   if err != nil {
       return nil, err
   }
   ```
   Remove the wallet loop entirely (lines 1392-1408).

2. **`UpdatePrices` wallet cache invalidation** (around line 1496): Update to handle nullable WalletID:
   ```go
   // Collect unique wallet IDs for cache invalidation
   walletIDMap := make(map[int32]bool)
   for _, inv := range investmentsToUpdate {
       if inv.WalletID != nil {
           walletIDMap[*inv.WalletID] = true
       }
   }
   ```

3. **`ListUserInvestments`** (line 1821): Handle nullable WalletID when fetching wallet name:
   ```go
   if inv.WalletID != nil {
       wallet, _ := s.walletRepo.GetByID(ctx, *inv.WalletID)
       if wallet != nil {
           proto.WalletName = wallet.WalletName
       }
   }
   ```

4. Verify build: `cd src/go-backend && go build ./...`

---

### Task 8: Service Layer — Update GetPortfolioSummary Wallet References

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go`

**Security notes:** Wallet-scoped portfolio summary still requires wallet ownership verification.

**Steps:**

1. **`GetPortfolioSummary`** (line 1207): This method is wallet-scoped and should remain so — no changes to the signature or primary logic. It already verifies wallet ownership (line 1226).

2. **`GetAggregatedPortfolioSummary`** (line 1843): No changes needed — already delegates to `ListByUserID` (which was fixed in Task 4) or `GetPortfolioSummary` for wallet-specific queries.

3. **`EditTransaction`** (line 985): Check if it references wallet — find and update any `investment.WalletID` usage for cache invalidation:
   ```go
   if investment.WalletID != nil {
       if ws, ok := s.walletService.(*walletService); ok {
           ws.invalidateInvestmentValueCache(ctx, *investment.WalletID)
       }
   }
   ```

4. **`DeleteTransaction`** (line 1027): Same pattern for wallet cache invalidation.

5. Verify build: `cd src/go-backend && go build ./...`

---

### Task 9: Handler Adjustments

**Files:**
- Modify: `src/go-backend/handlers/investment.go`

**Security notes:** Handler comment updates only. No logic changes — the handler already passes `userID` from JWT to the service.

**Steps:**

1. **`CreateInvestment`** handler (line 61-65): Update comment from "0 means auto-select" to "0 means no wallet association":
   ```go
   // Validate wallet ID: 0 means no wallet association, positive means explicit
   ```

2. No other handler changes needed — all handlers already extract `userID` from JWT context and pass it to the service layer.

3. Verify build: `cd src/go-backend && go build ./...`

---

### Task 10: Verify Build and Run Tests

**Files:**
- No new files

**Steps:**

1. Full build verification:
   ```bash
   cd src/go-backend && go build ./...
   ```

2. Run existing tests:
   ```bash
   cd src/go-backend && go test -short ./...
   ```

3. Fix any remaining compile errors from nullable WalletID changes (there may be places in the codebase that access `investment.WalletID` directly without nil checks).

4. Search for all remaining `investment.WalletID` usages and add nil guards:
   ```bash
   grep -rn "investment\.WalletID\b" --include="*.go" src/go-backend/
   grep -rn "\.WalletID\b" --include="*.go" src/go-backend/domain/service/investment_service.go
   ```

---

### Task 11: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-code-investment.md`

**Steps:**

1. **`c4-component-backend.md`**: Update `invest_repo` description — queries by `user_id` directly instead of wallet JOIN. Update `invest_svc` description — no wallet dependency for investment CRUD.

2. **`c4-code-investment.md`**: Update Investment class diagram — add `UserID int32`, mark `WalletID *int32` as optional, add `User` relationship.

---

### Task 12: Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-investment.md`

**Steps:**

1. Update "Create Investment" flow: remove wallet auto-selection step, add direct `user_id` assignment from JWT.
2. Update "Buy Transaction" flow: remove wallet lookup step.
3. Ensure error paths reflect new behavior (no "please create a wallet first" error).

---

## Task Dependencies

```
Task 0 (Proto) ─────────────────────────────┐
Task 1 (Migration) ─────────┐               │
                             ├─→ Task 2 (Models) ─→ Task 3 (Repo Interface) ─→ Task 4 (Repo Impl)
                             │                                                         │
                             │                     ┌───────────────────────────────────┘
                             │                     │
                             │                     ├─→ Task 5 (Service: CreateInvestment)
                             │                     ├─→ Task 6 (Service: AddTransaction etc.)
                             │                     ├─→ Task 7 (Service: UpdatePrices etc.)
                             │                     └─→ Task 8 (Service: PortfolioSummary etc.)
                             │                                    │
                             │                     ┌──────────────┘
                             │                     │
                             │                     └─→ Task 9 (Handler adjustments)
                             │                                    │
                             │                                    └─→ Task 10 (Build + Test)
                             │
Task 11 (C4 Diagrams) ──────┤ (can run in parallel with implementation)
Task 12 (Flow Diagrams) ────┘ (can run in parallel with implementation)
```

**Parallelizable:** Tasks 5, 6, 7, 8 can be done sequentially in one pass since they all modify the same file (`investment_service.go`). Tasks 11 and 12 can run in parallel with code changes.

**Critical path:** Task 0 → Task 1 → Task 2 → Task 3 → Task 4 → Tasks 5-8 → Task 9 → Task 10

## Estimated Impact

| File | Lines Changed (est.) | Risk |
|------|---------------------|------|
| `api/protobuf/v1/investment.proto` | ~5 | Low |
| `cmd/migrate-investment-user-ownership/main.go` | ~120 (new) | High |
| `domain/models/investment.go` | ~15 | Medium |
| `domain/models/investment_transaction.go` | ~10 | Medium |
| `domain/repository/investment_repository.go` | ~5 | Medium |
| `domain/repository/investment_repository_impl.go` | ~40 | High |
| `domain/repository/investment_transaction_repository_impl.go` | ~10 | Medium |
| `domain/service/investment_service.go` | ~80 | High |
| `domain/service/mapper.go` | ~10 | Low |
| `handlers/investment.go` | ~3 | Low |
| `docs/architecture/*.md` | ~30 | Low |
