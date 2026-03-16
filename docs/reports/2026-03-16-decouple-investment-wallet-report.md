# Decouple Investment from Wallet Selection — Implementation Report

## Summary

Removed the tight coupling between investments and the INVESTMENT wallet type. Investments are no longer gated behind a specific wallet type — any wallet can hold investments. The frontend no longer shows wallet selectors, wallet type selectors, cash balance cards, or balance-insufficient warnings for investments. The backend auto-selects the user's oldest active wallet when `walletId=0` is sent. All existing INVESTMENT wallets can be migrated to BASIC via a new CLI command.

## Spec Reference

`docs/specs/2026-03-16-decouple-investment-wallet-spec.md`

## Plan Reference

`docs/plans/2026-03-16-decouple-investment-wallet-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Backend — Remove wallet type validation and balance checks from CreateInvestment | Done | `499291c` | investment_service.go, investment_service_test.go |
| 2 | Backend — Remove wallet type check from AddTransaction | Done | `cc2b031` | investment_service.go, investment_service_test.go |
| 3 | Backend — Remove investment value enrichment from wallet service | Done | `77fe3a4` | wallet_service.go |
| 4 | Backend — Update ListInvestmentWallets and portfolio snapshot job | Done | `77fe3a4` | investment_service.go, investment_repository.go, portfolio_snapshot_job.go |
| 5 | Backend — Force wallet type to BASIC in CreateWallet | Done | `c1d7cbc` | wallet_service.go |
| 6 | Backend — Database migration to convert INVESTMENT wallets to BASIC | Done | `c1d7cbc` | cmd/migrate-wallet-type/, Taskfile.yml |
| 7 | Frontend — Remove wallet selector and balance display from AddInvestmentForm | Done | `f7d81ec` | AddInvestmentForm.tsx, portfolio/page.tsx |
| 8 | Frontend — Remove wallet type selector from CreateWalletForm | Done | `f7d81ec` | CreateWalletForm.tsx |
| 9 | Frontend — Remove wallet filter and cash balance from portfolio page | Done | `9fe808e` | portfolio/page.tsx |
| 10 | Frontend — Clean up unused translation keys | Done | `fe26484` | en/wallet.json, vi/wallet.json, en/investment.json, vi/investment.json |
| 11 | Update C4 Architecture Diagrams | Done | `7e96897` | c4-component-backend.md, c4-component-frontend.md |
| 12 | Update Runtime Flow Diagrams | Done | `7e96897` | flow-investment.md, flow-wallet.md |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authorization | Wallet ownership verified via GetByIDForUser before any operation | Yes |
| Auto-wallet selection | Only selects wallets owned by the authenticated user | Yes |
| Input validation | walletId=0 triggers auto-selection; non-zero walletId validated for ownership | Yes |
| No balance exposure | Removed balance display from investment forms (no financial data leak risk) | Yes |

## Architecture Changes

### Backend
- `CreateInvestment`: Removed wallet type validation (`WalletType_INVESTMENT` check), balance validation, and balance deduction. Added auto-wallet selection when `walletId=0`.
- `AddTransaction` (Buy/Sell/Dividend): Removed wallet type check. Removed wallet balance deduction (Buy) and credit (Sell/Dividend).
- `GetWallet`/`ListWallets`: Removed investment value enrichment — `investmentValue` and `totalValue` now return 0.
- `ListInvestmentWallets`/`UpdatePrices`/`ListInvestments`: Removed `WalletType_INVESTMENT` filter — queries across all wallets.
- `CreateWallet`: Forces `WalletType_BASIC` regardless of request `type` field.
- Portfolio snapshot job: Simplified to iterate all wallets without type filter.
- New CLI command: `migrate-wallet-type` converts INVESTMENT wallets to BASIC with dry-run support.

### Frontend
- `AddInvestmentForm`: Removed wallet selector, balance preview, exchange rate logic, insufficient balance check. Sends `walletId: 0`.
- `CreateWalletForm`: Removed wallet type selector dropdown. Always sends `WalletType.BASIC`.
- Portfolio page: Removed wallet selector dropdown, cash balance card, empty wallets state. All queries use `walletId: 0`.
- i18n: Removed 12+ unused translation keys related to wallet types and wallet selection from en/vi wallet.json and investment.json.

### Documentation
- C4 backend diagram: Updated invest_svc (auto-wallet), wallet_svc (BASIC-only), Create Investment data flow
- C4 frontend diagram: Updated portfolio_page, invest_feat, wallet_feat descriptions
- flow-investment.md: Updated Create/Buy/Sell/Dividend flows — removed wallet balance operations, added auto-wallet selection
- flow-wallet.md: Updated Create Wallet flow — type forced to BASIC

## Known Issues / Technical Debt

- The `WalletType` enum still exists in proto definitions — INVESTMENT type value (1) is preserved for backward compatibility but is no longer used
- `wallet.filterTypes.investment` translation key still exists (used by wallets page filter UI) — could be removed in a future cleanup if the wallets page filter is simplified
- The `emptyWallets` section in investment.json still exists — it's referenced by other components not in scope

## Files Changed

### Backend
- `src/go-backend/domain/service/investment_service.go`
- `src/go-backend/domain/service/investment_service_test.go`
- `src/go-backend/domain/service/wallet_service.go`
- `src/go-backend/domain/repository/investment_repository.go`
- `src/go-backend/internal/scheduler/portfolio_snapshot_job.go`
- `src/go-backend/cmd/migrate-wallet-type/main.go`
- `Taskfile.yml`

### Frontend
- `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- `src/wj-client/features/wallet/forms/CreateWalletForm.tsx`
- `src/wj-client/app/[locale]/dashboard/portfolio/page.tsx`
- `src/wj-client/messages/en/wallet.json`
- `src/wj-client/messages/vi/wallet.json`
- `src/wj-client/messages/en/investment.json`
- `src/wj-client/messages/vi/investment.json`

### Documentation
- `docs/architecture/c4-component-backend.md`
- `docs/architecture/c4-component-frontend.md`
- `docs/architecture/flow-investment.md`
- `docs/architecture/flow-wallet.md`
- `docs/reports/2026-03-16-decouple-investment-wallet-progress.md`

## How to Test

1. **Create investment without wallet selector**: Navigate to Portfolio → Add Investment. Verify no wallet dropdown appears. Submit — backend should auto-assign wallet.
2. **Create wallet without type selector**: Navigate to Wallets → Create Wallet. Verify no wallet type dropdown appears. Created wallet should be BASIC type.
3. **Portfolio page without wallet filter**: Navigate to Portfolio. Verify no wallet selector dropdown in the filter controls. All investments across all wallets should display.
4. **Buy/Sell/Dividend transactions**: Add transactions to existing investments. Verify wallet balance is NOT affected.
5. **Migration (if needed)**: Run `task backend:migrate-wallet-type -- --dry-run` to preview, then `task backend:migrate-wallet-type` to execute.

## Fix History

| Date | Fix | Severity | Commit | Files Changed |
|------|-----|----------|--------|---------------|
| 2026-03-16 | Handler-level `validator.ID(req.WalletId)` rejected `walletId=0` before service auto-wallet selection logic could execute. Changed to allow `walletId=0` (auto-select) while still rejecting negative IDs. | Minor | pending | `handlers/investment.go` |
| 2026-03-16 | `ListByUserID` in investment repo still filtered wallets by `WalletType_INVESTMENT` — after migration all wallets are BASIC, so query returned 0 wallets → 0 investments. Removed the wallet type filter. | Minor | pending | `domain/repository/investment_repository_impl.go` |
| 2026-03-16 | `AddInvestmentTransactionForm` still showed wallet balance preview, transaction cost, remaining balance, and insufficient balance check for BUY transactions. Removed all balance verification UI and the submit-disabling logic — consistent with decoupled investment-wallet design where buy/sell/dividend no longer affect wallet balance. | Minor | pending | `features/investment/forms/AddInvestmentTransactionForm.tsx`, `features/investment/components/InvestmentDetailModal.tsx` |
| 2026-03-16 | Backend `processBuyTransaction` still fetched wallet, checked balance, and deducted balance. `processSellTransaction` still credited wallet. `processDividendTransaction` still credited wallet. All three reverse functions (`reverseBuy/Sell/Dividend`) also still modified wallet balance. `DeleteInvestment` still refunded wallet. Removed all wallet balance operations from all 7 functions. Updated 9 failing tests. | Major | pending | `domain/service/investment_service.go`, `domain/service/investment_service_test.go`, `domain/service/investment_service_sell_test.go` |
