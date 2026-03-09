# Sidebar Cleanup — Implementation Progress

## Metadata
- **Feature:** Sidebar cleanup (remove Prices, remove CurrencySelector, add logout, fix active highlighting)
- **Plan file:** docs/plans/2026-03-09-sidebar-cleanup-plan.md
- **Spec file:** docs/specs/2026-03-09-sidebar-cleanup-spec.md
- **Started:** 2026-03-09
- **Last updated:** 2026-03-09
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Fix ActiveLink pathname comparison | done | 1a9c088 | Changed usePathname import to next-intl version |
| 2 | Pass isActive prop to NavItems + mobile active styling | done | — | Added isActive to all desktop NavItems + mobile active styling |
| 3 | Remove Prices nav item | done | — | Removed from desktop + mobile, resequenced delays, removed CircleDollarSign import |
| 4 | Remove CurrencySelector | done | — | Removed from desktop + mobile, removed import, kept CurrencyProvider |
| 5 | Add desktop logout button | done | — | Added logout button in user section with tooltip when collapsed |
| 6 | Verify and clean up | done | — | Build passes, imports clean, no issues |

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task

## Notes

Frontend-only changes. No backend/API/proto changes needed.
