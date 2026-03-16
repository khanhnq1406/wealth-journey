# Decouple Investment from Wallet Selection — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Simplify the investment experience by removing wallet selection, balance validation, and wallet type concepts from the investment flow.
**Spec:** `docs/specs/2026-03-16-decouple-investment-wallet-spec.md`
**Architecture:** Remove wallet-investment coupling at 3 layers: (1) backend service removes wallet type checks, balance validation, and investment enrichment on wallets; (2) frontend removes wallet selection UI, cash balance display, and wallet type selector; (3) database migration converts INVESTMENT wallets to BASIC.
**Tech Stack:** Go 1.23 (Gin, GORM), Next.js 15 (React 19, TypeScript), PostgreSQL 16, Protocol Buffers

## Security Implementation Notes

- **Authentication:** No changes — JWT middleware remains on all endpoints
- **Authorization:** Auto-wallet selection MUST use `walletRepo.ListByUserID()` scoped to authenticated `userID` — no user can access another user's wallets
- **Input validation:** Backend ignores client-provided `walletId` when 0 (auto-assigns); ignores `type` field in CreateWallet (always BASIC). Server-side enforcement only.
- **Data integrity:** No monetary value changes. Wallet balances are untouched. Investment `walletId` FK remains valid after migration.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md` — Remove "Wallet Type Validation" dependency from Investment Service
- Update `docs/architecture/c4-component-frontend.md` — Remove wallet filter and cash balance card from Portfolio Page; remove wallet selection from AddInvestmentForm

## Runtime Flow Diagram Updates

- Update `docs/architecture/flow-investment.md` — Simplify "Create Investment" flow (remove wallet type validation, balance check/deduction, add auto-wallet-selection)
- Update `docs/architecture/flow-wallet.md` — Simplify "Create Wallet" flow (remove wallet type selection, always BASIC)

---

### Task 1: Backend — Remove wallet type validation and balance checks from CreateInvestment

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (lines 96-291)
- Modify: `src/go-backend/domain/service/investment_service_test.go`

**Security notes:** Auto-wallet selection must be scoped to `userID`. If `req.WalletId` is 0, pick the oldest active wallet for that user. If non-zero, verify ownership (existing behavior).

**Step 1: Update existing tests for CreateInvestment**

Update tests to reflect new behavior:
- Remove test that expects "investments can only be created in investment wallets" error
- Add test: `TestCreateInvestment_AutoSelectsOldestWallet` — when `walletId=0`, auto-selects oldest wallet
- Add test: `TestCreateInvestment_NoWallets_ReturnsError` — when user has no wallets, returns error
- Update existing success tests to use `WalletType_BASIC` wallets (since INVESTMENT type is no longer required)
- Remove assertions about balance deduction from wallet

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run TestCreateInvestment ./domain/service/ -v -count=1
```

**Step 3: Modify CreateInvestment in investment_service.go**

Remove these sections:
1. **Line 142-144:** Remove wallet type check (`WalletType_INVESTMENT` validation)
2. **Lines 146-162:** Remove FX conversion for balance check and balance sufficiency check
3. **Line 260:** Remove `walletRepo.UpdateBalance(ctx, req.WalletId, -initialCostInWalletCurrency)` and its rollback block (lines 260-268)

Add auto-wallet selection:
- After input validation, check if `req.WalletId` is 0
- If 0: call `s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{Limit: 1, OrderBy: "created_at", Order: "asc"})` to get oldest wallet
- If no wallets found: return `apperrors.NewValidationError("please create a wallet first")`
- Set `req.WalletId` to the selected wallet's ID
- If non-zero: keep existing `GetByIDForUser` ownership check

Remove `initialCostInWalletCurrency` variable entirely since it's only used for balance check/deduction.

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -run TestCreateInvestment ./domain/service/ -v -count=1
```

**Step 5: Commit**

```
feat(investment): remove wallet type validation and balance checks from CreateInvestment
```

---

### Task 2: Backend — Remove wallet type check from AddTransaction

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (lines 568-570)
- Modify: `src/go-backend/domain/service/investment_service_test.go`
- Modify: `src/go-backend/domain/service/investment_service_sell_test.go`

**Security notes:** Wallet ownership check via `GetByIDForUser` remains. Only the type check is removed.

**Step 1: Update tests**

- Remove/update any test that expects "transactions can only be added to investments in investment wallets" error
- Update mock wallet objects in sell tests to use `Type: int32(v1.WalletType_BASIC)` instead of `WalletType_INVESTMENT`

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test -run "TestAddTransaction|TestSell" ./domain/service/ -v -count=1
```

**Step 3: Remove wallet type check in AddTransaction**

Remove lines 568-570 in `investment_service.go`:
```go
if v1.WalletType(wallet.Type) != v1.WalletType_INVESTMENT {
    return nil, apperrors.NewValidationError("transactions can only be added to investments in investment wallets")
}
```

Keep the `wallet` variable usage for ownership verification (line 567: `_ = wallet`).

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test -run "TestAddTransaction|TestSell" ./domain/service/ -v -count=1
```

**Step 5: Commit**

```
feat(investment): remove wallet type check from AddTransaction
```

---

### Task 3: Backend — Remove investment value enrichment from wallet service

**Files:**
- Modify: `src/go-backend/domain/service/wallet_service.go` (lines 175-208 in GetWallet, lines 245-296 in ListWallets)

**Security notes:** No authorization changes. Wallet enrichment logic is purely internal.

**Step 1: Modify GetWallet (lines 159-216)**

Remove the investment value calculation block (lines 175-189):
- Remove the `if v1.WalletType(wallet.Type) == v1.WalletType_INVESTMENT` block
- Set `investmentValue` to always be `0`
- Remove `getInvestmentValueInWalletCurrency` call
- Keep the enrichment structure but set investment/total values to 0:
  - `walletProto.InvestmentValue = &v1.Money{Amount: 0, Currency: wallet.Currency}`
  - `walletProto.DisplayInvestmentValue = &v1.Money{Amount: 0, Currency: userCurrency}`
  - `walletProto.TotalValue = &v1.Money{Amount: wallet.Balance, Currency: wallet.Currency}`
  - `walletProto.DisplayTotalValue = displayBalance` (same as display balance)

**Step 2: Modify ListWallets (lines 218-307)**

Remove investment value enrichment loop (lines 245-296):
- Remove `investmentWalletIDs` collection loop (lines 246-251)
- Remove `investmentValueMap` calculation loop (lines 253-275)
- In the proto building loop, set investment values to 0 for all wallets:
  - Remove `investmentValue := investmentValueMap[wallet.ID]` and related calculations
  - Set `InvestmentValue`, `DisplayInvestmentValue` to 0
  - Set `TotalValue` = `Balance` (no investment component)

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Run all wallet and investment tests**

```bash
cd src/go-backend && go test ./domain/service/... -v -count=1 -short
```

**Step 5: Commit**

```
feat(wallet): remove investment value enrichment from wallet responses
```

---

### Task 4: Backend — Update ListInvestmentWallets and portfolio snapshot job

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (lines 2190-2213: `ListInvestmentWallets`)
- Modify: `src/go-backend/internal/scheduler/portfolio_snapshot_job.go` (lines 62-71)
- Modify: `src/go-backend/domain/service/user_service.go` (lines 470-477: investment cache invalidation)

**Security notes:** No authorization changes. These are internal operations scoped to userID.

**Step 1: Update ListInvestmentWallets**

Change `ListInvestmentWallets` to return ALL active wallets (not filtered by type):
```go
func (s *investmentService) ListInvestmentWallets(ctx context.Context, userID int32) ([]*models.Wallet, error) {
    if err := validator.ID(userID); err != nil {
        return nil, err
    }
    wallets, _, err := s.walletRepo.ListByUserID(ctx, userID, repository.ListOptions{
        Limit: 1000,
    })
    if err != nil {
        return nil, err
    }
    return wallets, nil
}
```

**Step 2: Update portfolio_snapshot_job.go**

Remove the `hasInvestmentWallets` check (lines 62-71). Instead, check if user has ANY wallets with investments by calling `portfolioSvc.CreateAggregatedSnapshot` directly (it already handles empty cases gracefully). Or simply remove the wallet type filter — create snapshots for all users who have wallets.

Simplified approach: Remove lines 57-71 (wallet listing and type check). Call `j.portfolioSvc.CreateAggregatedSnapshot(ctx, user.ID)` directly for each user.

**Step 3: Update user_service.go cache invalidation**

Remove the `WalletType_INVESTMENT` filter in cache invalidation (lines 470-477). Clear cache for ALL wallets:
```go
for _, wallet := range wallets {
    cacheKey := cache.GetInvestmentValueCacheKey(wallet.ID)
    s.redisCache.Del(ctx, cacheKey)
}
```

**Step 4: Verify compilation and tests**

```bash
cd src/go-backend && go build ./... && go test ./domain/service/... ./internal/scheduler/... -v -count=1 -short
```

**Step 5: Commit**

```
feat(investment): update ListInvestmentWallets to return all wallets, simplify portfolio snapshot job
```

---

### Task 5: Backend — Force wallet type to BASIC in CreateWallet

**Files:**
- Modify: `src/go-backend/domain/service/wallet_service.go` (line 97)

**Security notes:** Server-side enforcement. Client-provided `type` field is ignored.

**Step 1: Modify CreateWallet**

Change line 97 from:
```go
Type: int32(req.Type),
```
to:
```go
Type: int32(v1.WalletType_BASIC),
```

**Step 2: Verify compilation and tests**

```bash
cd src/go-backend && go build ./... && go test ./domain/service/... -v -count=1 -short
```

**Step 3: Commit**

```
feat(wallet): force wallet type to BASIC in CreateWallet, ignore client type field
```

---

### Task 6: Backend — Database migration to convert INVESTMENT wallets to BASIC

**Files:**
- Create: `src/go-backend/cmd/migrate-wallet-type/main.go`

**Security notes:** Migration operates on database directly. Uses parameterized queries via GORM. Should be run before deploying code changes.

**Step 1: Create migration file**

Follow existing migration pattern from `migrate-investment-wallet-balance/main.go`:
- Accept `--dry-run` flag
- Query wallets where `type = 1` (INVESTMENT) and `deleted_at IS NULL`
- Log affected wallet IDs before migration
- Update `type = 0` (BASIC) for all matched wallets
- Report count of affected wallets

```go
package main

import (
    "context"
    "flag"
    "fmt"
    "log"
    "wealthjourney/domain/models"
    "wealthjourney/pkg/config"
    "wealthjourney/pkg/database"
)

func main() {
    dryRun := flag.Bool("dry-run", false, "Preview changes without applying")
    flag.Parse()

    cfg := config.Load()
    db := database.New(cfg)
    ctx := context.Background()

    var wallets []models.Wallet
    if err := db.DB.WithContext(ctx).Where("type = ? AND deleted_at IS NULL", 1).Find(&wallets).Error; err != nil {
        log.Fatalf("Failed to query investment wallets: %v", err)
    }

    fmt.Printf("Found %d INVESTMENT wallets to convert to BASIC\n", len(wallets))
    for _, w := range wallets {
        fmt.Printf("  Wallet ID=%d, UserID=%d, Name=%s\n", w.ID, w.UserID, w.WalletName)
    }

    if *dryRun {
        fmt.Println("DRY RUN — no changes applied")
        return
    }

    result := db.DB.WithContext(ctx).Model(&models.Wallet{}).
        Where("type = ? AND deleted_at IS NULL", 1).
        Update("type", 0)
    if result.Error != nil {
        log.Fatalf("Migration failed: %v", result.Error)
    }
    fmt.Printf("Successfully converted %d wallets from INVESTMENT to BASIC\n", result.RowsAffected)
}
```

**Step 2: Add task to Taskfile.yml**

Add migration command:
```yaml
backend:migrate-wallet-type:
  desc: Convert INVESTMENT wallets to BASIC
  dir: src/go-backend
  cmd: go run ./cmd/migrate-wallet-type/main.go {{.CLI_ARGS}}
```

**Step 3: Verify migration compiles**

```bash
cd src/go-backend && go build ./cmd/migrate-wallet-type/...
```

**Step 4: Commit**

```
feat(migration): add migrate-wallet-type to convert INVESTMENT wallets to BASIC
```

---

### Task 7: Frontend — Remove wallet selector and balance display from AddInvestmentForm

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`

**Security notes:** Frontend-only change. Backend enforces auto-wallet-selection server-side.

**Step 1: Remove wallet-related props and state**

Remove from props interface (lines 67-72):
- Remove `walletId?: number`
- Remove `walletBalance?: number`
- Remove `walletCurrency?: string`
- Keep only `onSuccess?: () => void`

Remove state and queries:
- Remove `selectedWalletId` state (line 103-105)
- Remove `getListWallets` query (lines 125-138)
- Remove `investmentWallets` memo (lines 141-146)
- Remove `walletId` computed (line 149)
- Remove `walletBalance` memo (lines 152-157)
- Remove `walletCurrency` memo (lines 159-164)
- Remove `insufficientBalance` state (line 101)
- Remove `walletSelectOptions` memo (lines 537-547)

**Step 2: Remove wallet selector UI**

Remove the wallet selector dropdown block (lines 557-574).

**Step 3: Remove balance preview UI**

Remove the entire balance preview section (lines 1001-1117).

**Step 4: Update form submission**

In the mutation call, set `walletId: 0` (auto-assign) instead of using the selected wallet:
```typescript
createMutation.mutate({
    walletId: 0, // Auto-assigned by backend
    // ... rest of fields unchanged
});
```

**Step 5: Verify frontend compiles**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 6: Commit**

```
feat(investment): remove wallet selector and balance display from AddInvestmentForm
```

---

### Task 8: Frontend — Remove wallet type selector from CreateWalletForm

**Files:**
- Modify: `src/wj-client/features/wallet/forms/CreateWalletForm.tsx`

**Security notes:** Frontend-only. Backend ignores type field.

**Step 1: Remove wallet type UI and props**

Remove from props interface:
- Remove `defaultType?: WalletType` prop (line 29)

Remove from component:
- Remove `walletTypeOptions` array (lines 68-71)
- Remove wallet type `FormSelect` UI (lines 131-138)
- Remove default form value for `type` (line 63 — remove `type: String(defaultType ?? WalletType.BASIC)`)

In form submission, either omit `type` or hardcode to `0`:
```typescript
createWalletMutation.mutate({
    walletName: data.name,
    initialBalance: { amount: ..., currency: ... },
    type: 0, // Always BASIC
});
```

**Step 2: Update callers of CreateWalletForm**

Search for `CreateWalletForm` usage and remove any `defaultType` prop being passed.

**Step 3: Verify frontend compiles**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

```
feat(wallet): remove wallet type selector from CreateWalletForm
```

---

### Task 9: Frontend — Remove wallet filter and cash balance from portfolio page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`
- May remove: `src/wj-client/app/[locale]/dashboard/portfolio/components/WalletCashBalanceCard.tsx`

**Security notes:** Frontend-only. All data queries will use `walletId: 0` (aggregated).

**Step 1: Remove wallet-related state and queries**

Remove from page component:
- Remove `selectedWallet` state (line 95-96)
- Remove `investmentWallets` filtering memo (lines 123-128) — the query can stay for wallet count but no INVESTMENT type filter
- Remove `walletOptions` memo (lines 130-141)
- Remove `walletIdForApi` memo (lines 143-146) — replace with constant `0`
- Remove `isAllWalletsView` (line 155) — always aggregated now
- Remove `selectedWalletBalance` (lines 214-219)
- Remove `selectedWalletCurrency` (lines 221-226)

**Step 2: Remove wallet selector dropdown UI**

Remove the wallet selector FormSelect (lines 417-428). Keep the type filter and sort filter.

**Step 3: Remove WalletCashBalanceCard rendering**

Remove the conditional render block (lines 475-483).

**Step 4: Update AddInvestmentForm props**

Change the modal rendering (lines 542-555) to remove wallet props:
```tsx
<AddInvestmentForm onSuccess={handleModalSuccess} />
```

**Step 5: Simplify API calls**

All investment queries should use `walletId: 0` (meaning all user investments):
- `useQueryListUserInvestments` — `walletId: 0`
- `useQueryGetAggregatedPortfolioSummary` — `walletId: 0`
- `useQueryGetHistoricalPortfolioValues` — `walletId: 0`

**Step 6: Remove WalletCashBalanceCard component file**

Delete `src/wj-client/app/[locale]/dashboard/portfolio/components/WalletCashBalanceCard.tsx` and remove its export from `index.ts`.

**Step 7: Verify frontend compiles**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 8: Commit**

```
feat(portfolio): remove wallet filter, cash balance card, and wallet selection from portfolio page
```

---

### Task 10: Frontend — Clean up unused translation keys and wallet type references

**Files:**
- Modify: `src/wj-client/messages/en/investment.json`
- Modify: `src/wj-client/messages/vi/investment.json`
- Modify: `src/wj-client/messages/en/wallet.json`
- Modify: `src/wj-client/messages/vi/wallet.json`

**Security notes:** None — translation cleanup only.

**Step 1: Remove unused investment translation keys**

Remove from both `en/investment.json` and `vi/investment.json`:
- `"allInvestmentWallets"` (no longer displayed)
- `"selectWalletPlaceholder"` (portfolio page level)
- `"form.investmentWalletLabel"` (form level)
- `"form.selectWalletPlaceholder"` (form level)
- `"form.selectWalletError"` (form level)
- `"cashBalance.availableCash"` (WalletCashBalanceCard removed)
- `"cashBalance.readyToInvest"`
- `"cashBalance.totalWalletValue"`
- `"cashBalance.cashAndInvestments"`

**Step 2: Review wallet translation keys**

In `en/wallet.json` and `vi/wallet.json`:
- Keep `"walletTypeBasic"` and `"walletTypeInvestment"` for now (may be displayed elsewhere in wallet listings)
- Or remove `"walletTypeInvestment"` if it's only used in CreateWalletForm

**Step 3: Verify no missing translations**

```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

```
chore(i18n): remove unused wallet-related translation keys
```

---

### Task 11: Update C4 Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Update `c4-component-backend.md`:
   - Update Investment Service description: "Wallet selection is automatic (oldest active wallet), not user-driven"
   - Remove dependency from Investment Service to "Wallet Type Validation"
   - Note that investment enrichment on wallets is removed

2. Update `c4-component-frontend.md`:
   - Update Portfolio Page: "Shows aggregated portfolio view, no wallet filter"
   - Update AddInvestmentForm: "No wallet selection, auto-assigned by backend"
   - Remove WalletCashBalanceCard reference
   - Update CreateWalletForm: "No wallet type selection, always BASIC"

3. Commit

```
docs(architecture): update C4 diagrams for investment-wallet decoupling
```

---

### Task 12: Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-investment.md`
- Modify: `docs/architecture/flow-wallet.md`

**Steps:**
1. Read the actual updated service code to trace the simplified flows

2. Update `flow-investment.md` — "Create Investment" sequence diagram:
   - Remove "Validate wallet type == INVESTMENT" step
   - Remove "Check wallet balance" and "Deduct from wallet" steps
   - Add "Auto-select oldest wallet (if walletId=0)" step after input validation
   - Update Key Invariants table
   - Update Error Paths table

3. Update `flow-wallet.md` — "Create Wallet" flow:
   - Remove "Select wallet type" step
   - Note that type is always BASIC
   - Simplify the sequence

4. Commit

```
docs(architecture): update flow diagrams for simplified investment and wallet creation
```

---

## Task Dependency Graph

```
Task 1 (CreateInvestment) ──┐
Task 2 (AddTransaction)  ──┤
Task 3 (Wallet enrichment)──┼── Task 6 (DB migration) ── independent
Task 4 (ListInvestment)  ──┤
Task 5 (CreateWallet)    ──┘
                            │
                            ▼
Task 7 (AddInvestmentForm) ──┐
Task 8 (CreateWalletForm)  ──┼── Task 10 (i18n cleanup)
Task 9 (Portfolio page)    ──┘
                               │
                               ▼
                    Task 11 (C4 diagrams)
                    Task 12 (Flow diagrams)
```

**Parallelizable groups:**
- **Group A (backend, parallel):** Tasks 1, 2, 3, 4, 5 — touch different sections of different files
- **Group B (frontend, parallel):** Tasks 7, 8, 9 — touch different components
- **Sequential:** Task 10 after Group B; Tasks 11-12 after all code changes
- **Independent:** Task 6 (migration) — can run anytime
