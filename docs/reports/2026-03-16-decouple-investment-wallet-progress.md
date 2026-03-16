# Decouple Investment from Wallet Selection — Implementation Progress

## Metadata
- **Feature:** Decouple Investment from Wallet Selection
- **Plan file:** docs/plans/2026-03-16-decouple-investment-wallet-plan.md
- **Spec file:** docs/specs/2026-03-16-decouple-investment-wallet-spec.md
- **Started:** 2026-03-16T00:00:00Z
- **Last updated:** 2026-03-16T12:00:00Z
- **Current state:** in_progress
- **Current task:** 11

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Backend — Remove wallet type validation and balance checks from CreateInvestment | done | pending-commit | Removed wallet type check, balance validation, balance deduction. Added auto-wallet selection when walletId=0. |
| 2 | Backend — Remove wallet type check from AddTransaction | done | pending-commit | Removed wallet type check from AddTransaction. Updated all tests to use BASIC wallet type. |
| 3 | Backend — Remove investment value enrichment from wallet service | done | pending-commit | Removed investment value calculation from GetWallet and ListWallets. Set investment values to 0. |
| 4 | Backend — Update ListInvestmentWallets and portfolio snapshot job | done | pending-commit | Removed type filter from ListInvestmentWallets, UpdatePrices, ListInvestments. Simplified snapshot job. Updated user cache invalidation. |
| 5 | Backend — Force wallet type to BASIC in CreateWallet | done | pending-commit | Force WalletType_BASIC in CreateWallet, ignore request type field. |
| 6 | Backend — Database migration to convert INVESTMENT wallets to BASIC | done | pending-commit | Created migrate-wallet-type command with dry-run support. Added Taskfile entry. |
| 7 | Frontend — Remove wallet selector and balance display from AddInvestmentForm | done | pending-commit | Removed wallet props, selector UI, balance preview, insufficient balance check. Set walletId=0 for auto-assign. Removed unused imports. |
| 8 | Frontend — Remove wallet type selector from CreateWalletForm | done | pending-commit | Removed defaultType prop, wallet type selector dropdown, walletTypeOptions. Hardcoded WalletType.BASIC. |
| 9 | Frontend — Remove wallet filter and cash balance from portfolio page | done | pending-commit | Removed wallet selector, cash balance card, empty wallets state. Replaced wallet-gated queries with walletId=0. Cleaned up unused imports. |
| 10 | Frontend — Clean up unused translation keys and wallet type references | done | pending-commit | Removed 12 unused i18n keys (walletType*, selectWallet*, investmentWalletLabel, allInvestmentWallets) from en/vi wallet.json and investment.json. |
| 11 | Update C4 Architecture Diagrams | pending | — | — |
| 12 | Update Runtime Flow Diagrams | pending | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Tasks 1-5 are backend tasks that can be parallelized (different sections of different files)
- Tasks 7-9 are frontend tasks that can be parallelized (different components)
- Task 10 depends on Tasks 7-9
- Tasks 11-12 depend on all code changes
