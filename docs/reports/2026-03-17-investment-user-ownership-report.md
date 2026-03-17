# Investment User Ownership — Implementation Report

## Summary

Added direct `user_id` ownership to investments and investment transactions, decoupling them from wallet dependency. Investments are now owned by users directly (`user_id NOT NULL`), with wallet association being optional (`wallet_id` nullable). This simplifies the authorization model and allows users to create investments without requiring a wallet.

## Spec Reference

`docs/specs/2026-03-17-investment-user-ownership-spec.md`

## Plan Reference

`docs/plans/2026-03-17-investment-user-ownership-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 0 | Protobuf — Add userId field | Done | `api/protobuf/v1/investment.proto`, generated code | b21574f |
| 1 | Database Migration | Done | `cmd/migrate-investment-user-ownership/main.go`, `Taskfile.yml` | d5cf420 |
| 2 | Model Changes | Done | `domain/models/investment.go`, `domain/models/investment_transaction.go` | a08d842 |
| 3 | Repository Interface | Done | `domain/repository/investment_repository.go` | bb7afd7 |
| 4 | Repository Implementation | Done | `domain/repository/investment_repository_impl.go`, `investment_transaction_repository_impl.go` | b0b4832 |
| 5-8 | Service Layer Changes | Done | `domain/service/investment_service.go` | 20dc72a |
| 9 | Handler Comment Update | Done | `handlers/investment.go` | 8c85922 |
| 10 | Build Verification & Test Fixes | Done | 6 test files | db44f95 |
| 11-12 | Architecture & Flow Diagrams | Done | 3 architecture files | 79cfdf6 |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Models | `domain/models/investment_test.go` | 3 | 3/3 | WalletID *int32, ToProto() |
| Models | `domain/models/investment_transaction_test.go` | 2 | 2/2 | WalletID *int32, ToProto() |
| Repository | `domain/repository/investment_repository_impl_test.go` | 6 | 6/6 | GetByUserAndSymbol, ListByUserID (direct) |
| Repository | `domain/repository/investment_repository_test.go` | 3 | 3/3 | WalletID pointer in test fixtures |
| Service | `domain/service/investment_service_test.go` | 12 | 12/12 | Create, AddTransaction, UpdatePrices, Delete |
| Service | `domain/service/investment_service_sell_test.go` | 6 | 6/6 | FIFO sell, lot consumption |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authorization | `GetByIDForUser(id, userID)` — direct user_id check | Yes |
| Ownership | `user_id NOT NULL` column with index | Yes |
| Wallet isolation | `GetByIDForUser` for optional wallet verification | Yes |
| Data integrity | 10-phase migration with backfill + orphan check | Yes |

## Architecture Diagram Updates

| Diagram | Changes |
|---------|---------|
| `c4-code-investment.md` | WalletID marked `*int32 ⟨optional⟩`, repo interface updated |
| `c4-component-backend.md` | invest_svc and invest_repo descriptions updated |
| `flow-investment.md` | Create Investment: removed wallet auto-select, added user_id direct; UpdatePrices: ListByUserID directly |

## Key Changes

### Model Layer
- `Investment.WalletID`: `int32` → `*int32` (nullable)
- `InvestmentTransaction.WalletID`: `int32` → `*int32` (nullable)
- Added `UserID int32` with `NOT NULL` constraint and index on both models
- Added `DerefInt32(*int32) int32` helper for safe proto mapping

### Repository Layer
- Renamed `GetByWalletAndSymbol` → `GetByUserAndSymbol` (queries by `user_id`)
- `GetByIDForUser` uses direct `WHERE user_id = ?` (no wallet JOIN)
- `ListByUserID` queries `WHERE user_id = ?` directly (was 2-step wallet pluck)
- Transaction `GetByIDForUser` JOINs on `investment.user_id` instead of wallet

### Service Layer
- `CreateInvestment`: walletId=0 → nil WalletID (was auto-select oldest wallet)
- `AddTransaction`: Removed `walletRepo.GetByIDForUser` call
- All wallet cache invalidation nil-guarded for walletless investments
- `UpdatePrices`: Uses `investmentRepo.ListByUserID` (was wallet iteration)

### Migration
- 10-phase migration: add user_id columns → backfill from wallet FK → verify no orphans → make wallet_id nullable → create indexes
- Supports `--dry-run` flag (default true)

## Known Issues / Technical Debt

None — all tests pass, build is clean.

## Files Changed

### Created
- `src/go-backend/cmd/migrate-investment-user-ownership/main.go`

### Modified
- `api/protobuf/v1/investment.proto`
- `src/go-backend/domain/models/investment.go`
- `src/go-backend/domain/models/investment_transaction.go`
- `src/go-backend/domain/repository/investment_repository.go`
- `src/go-backend/domain/repository/investment_repository_impl.go`
- `src/go-backend/domain/repository/investment_transaction_repository_impl.go`
- `src/go-backend/domain/service/investment_service.go`
- `src/go-backend/handlers/investment.go`
- `Taskfile.yml`
- `docs/architecture/c4-code-investment.md`
- `docs/architecture/c4-component-backend.md`
- `docs/architecture/flow-investment.md`

### Test Files Modified
- `src/go-backend/domain/models/investment_test.go`
- `src/go-backend/domain/models/investment_transaction_test.go`
- `src/go-backend/domain/repository/investment_repository_impl_test.go`
- `src/go-backend/domain/repository/investment_repository_test.go`
- `src/go-backend/domain/service/investment_service_test.go`
- `src/go-backend/domain/service/investment_service_sell_test.go`

## How to Test

1. Run migration: `task backend:migrate-investment-user-ownership -- --dry-run=false`
2. Build: `go build ./...`
3. Run tests: `go test -short ./domain/...`
4. Verify via API: `POST /api/v1/investments` with `walletId: 0` — should succeed with nil WalletID
5. Verify via API: `POST /api/v1/investments` with `walletId: N` — should verify wallet ownership
