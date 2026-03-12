# Gold & Silver Price Display — Implementation Progress

## Metadata
- **Feature:** Gold & Silver Price Display Improvements
- **Plan file:** docs/plans/2026-03-12-gold-silver-price-display-plan.md
- **Spec file:** docs/specs/2026-03-12-gold-silver-price-display-spec.md
- **Started:** 2026-03-12
- **Last updated:** 2026-03-12
- **Current state:** completed
- **Current task:** done

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 1 | Parse vsg_gold_table in vnprice client | done | d4f35ad | Added VSGGoldTable parsing loop in FetchPrices() |
| 2 | Add timestamps to public endpoint | done | d4f35ad | Wired GoldPriceService/SilverPriceService into PublicHandler, added goldUpdatedAt/silverUpdatedAt |
| 3 | Create gold filter constant (frontend) | done | d4f35ad | Created GOLD_TABLE_FILTER with 9 types and filterGoldPrices function |
| 4 | Create timestamp formatting utility | done | d4f35ad | Created formatUpdateTimestamp and getLatestTimestamp |
| 5 | Update GoldPriceTable + page.tsx | done | 801f00d | Applied filterGoldPrices, replaced browser-time with API timestamps |
| 7 | Update landing tables + hook + page | done | 9dfa3f9 | Added goldUpdatedAt/silverUpdatedAt to hook, filtered landing gold table, added timestamps |
| 8-10 | Replace Select dropdowns with toggles | done | 657ab87 | Replaced Select with toggle buttons in GoldPriceChart, SilverPriceChart, LandingGoldPriceChart |
| 11 | Update i18n translations | done | f1dcb08 | Added updatedTime key to vi/en nav.json priceTeaser |
| 12 | Build verification | done | — | Backend and frontend build successfully |

## Notes

- Pre-existing build errors in test-files/ and cmd/migrate-import/ are unrelated to this feature
- Task 6 (SilverPriceTable) was handled in Task 5 as planned (silver table only needed timestamp, no filtering)
