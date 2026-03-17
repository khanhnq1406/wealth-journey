# Price Table Dividers & VND Price Formatting — Implementation Progress

## Metadata
- **Feature:** Price Table Dividers & VND Price Formatting
- **Plan file:** docs/plans/2026-03-17-price-table-dividers-and-formatting-plan.md
- **Spec file:** docs/specs/2026-03-17-price-table-dividers-and-formatting-spec.md
- **Started:** 2026-03-17
- **Last updated:** 2026-03-17
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Update formatPriceValue to divide VND by 100 | done | 1a878e2 | Added VND_DIVISOR=100, removed ₫ symbol from VND formatting |
| 2 | Add i18n keys for buyUnit/sellUnit labels | done | 1a878e2 | Added buyUnit/sellUnit "(x100₫)" to 6 i18n files |
| 3 | Add dividers and unit labels to Home dashboard price tables | done | 186696e | border-collapse, column/row dividers, unit labels on Gold/Silver/Currency |
| 4 | Add dividers and unit labels to Landing page price tables | done | fcce2f7 | Same divider pattern for landing tables, fixed !p-0 on silver table |
| 5 | Add unit labels to Prices page column headers | done | ae4ba73 | Unit labels on TanStack and Mobile column headers |
| 6 | Build verification | done | — | npm run build passes with no errors |

## Notes

All 6 tasks completed successfully. Build verification passed.
