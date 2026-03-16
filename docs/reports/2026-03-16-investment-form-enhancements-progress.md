# Investment Form Enhancements — Implementation Progress

## Metadata
- **Feature:** Investment form enhancements (reordered types, merged gold/silver, purchase date, price-per-unit)
- **Plan file:** docs/plans/2026-03-16-investment-form-enhancements-plan.md
- **Spec file:** docs/specs/2026-03-16-investment-form-enhancements-spec.md
- **Started:** 2026-03-16
- **Last updated:** 2026-03-16
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Proto — Add CASH/FOREIGN_CURRENCY enums and purchase_date | done | 04124d9 | Added CASH=12, FOREIGN_CURRENCY=13 enums + purchase_date field |
| 2 | Backend — Use purchase_date for initial transaction and lot | done | 23d6ad8 | Validate & use purchase_date for tx/lot dates |
| 3 | Frontend — Update i18n messages (en + vi) | done | 4549ea8 | Added 13 new keys to en + vi |
| 4 | Frontend — Update gold-calculator labels to match price table | done | 1ef65b8 | Updated 6 labels + added Vàng nhẫn SJC |
| 5 | Frontend — Update investment-schema for new types | done | d670054 | FLEXIBLE_SYMBOL_TYPES with CASH/FOREIGN_CURRENCY |
| 6 | Frontend — Rewrite AddInvestmentForm with all enhancements | done | d53bb5e | Major form rewrite with all 4 FRs |
| 7 | Frontend — Update portfolio page type labels for new types | done | e99d08f | Added CASH/FOREIGN_CURRENCY to type labels & filters |
| 8 | Update Architecture Diagrams | done | — | Updated C4 frontend + flow-investment.md |

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Task 1 must complete first (proto generation needed by all other tasks)
- Tasks 2, 3, 4, 5 can run in parallel after Task 1
- Task 6 depends on Tasks 1, 3, 4, 5
- Task 7 depends on Task 1
- Task 8 runs last
