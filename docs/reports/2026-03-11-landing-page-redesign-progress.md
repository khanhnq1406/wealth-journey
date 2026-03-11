# Landing Page Redesign — Implementation Progress

## Metadata
- **Feature:** Landing Page Redesign (Gold/Silver Price Teaser)
- **Plan file:** `docs/plans/2026-03-11-landing-page-redesign-plan.md`
- **Spec file:** `docs/specs/2026-03-11-landing-page-redesign-spec.md`
- **Started:** 2026-03-11T00:00:00+07:00
- **Last updated:** 2026-03-11T00:00:00+07:00
- **Current state:** in_progress
- **Current task:** 0

## Task Progress

| # | Task Name | Status | Commit | Summary |
|---|-----------|--------|--------|---------|
| 0 | Add Proto Messages & Generate Code | pending | — | — |
| 1 | Create Public Backend Handler | pending | — | — |
| 2 | Add i18n Translation Keys | pending | — | — |
| 3 | Create usePublicMarketTypes Hook | pending | — | — |
| 4 | Create LandingGoldPriceTable | pending | — | — |
| 5 | Create LandingSilverPriceTable | pending | — | — |
| 6 | Create LandingGoldPriceChart | pending | — | — |
| 7 | Create LandingSilverPriceChart | pending | — | — |
| 8 | Rewrite Landing Page | pending | — | — |
| 9 | Update SEO Meta Tags | pending | — | — |
| 10 | Update C4 Architecture Diagrams | pending | — | — |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Resume Instructions

To resume this implementation in a new session:
1. Read this progress file
2. Read the plan file referenced above
3. Check `git log --oneline -10` to verify last commit matches the last `done` task
4. Check `git status` for any uncommitted work
5. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Gold package: `src/go-backend/pkg/gold/types.go` — GoldTypes slice with 18 entries (Code, Name, Currency fields)
- Silver package: `src/go-backend/pkg/silver/types.go` — SilverTypes slice with 11 entries (Code, Name, Currency fields)
- Landing page at: `src/wj-client/app/[locale]/landing/page.tsx`
- v2 color tokens: v2-gold-light, v2-gold-dark, v2-silver-light, v2-silver-dark, v2-red-primary all in tailwind.config.ts
- market-prices feature hooks dir: `src/wj-client/features/market-prices/hooks/` (empty, needs to be created)
