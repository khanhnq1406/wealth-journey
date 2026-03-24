# Watchlist Star Toggle — Implementation Progress

## Metadata

- **Feature:** Watchlist Star Toggle in Price Tables
- **Plan file:** `docs/plans/2026-03-24-watchlist-star-toggle-plan.md`
- **Spec file:** `docs/specs/2026-03-24-watchlist-star-toggle-spec.md`
- **Started:** 2026-03-24T00:00:00Z
- **Last updated:** 2026-03-24T00:00:00Z
- **Current state:** in_progress
- **Current task:** 3 (final verification)

## Task Progress

| #   | Task Name                                                     | Status      | Commit | Summary |
| --- | ------------------------------------------------------------- | ----------- | ------ | ------- |
| 0   | Add translation keys for star toggle                          | done        | —      | Added starAdd/starRemove/addedToWatchlist/removedFromWatchlist to en+vi |
| 1   | Implement StarToggleButton and watchlist state in PricesPage  | done        | —      | StarToggleButton + watchedSymbolToId Map + star column in gold/silver/currency tables |
| 2   | Update runtime flow diagrams                                  | done        | —      | Added flows 5+6 (quick-add/remove via star) to flow-watchlist.md |
| 3   | Final verification (tsc + build)                              | pending     | —      | —       |

## Skill Recovery

**MANDATORY: Re-read these files before continuing work (context compaction drops them):**

1. `.claude/skills/secure-feature-pipeline/step-3-implement.md` — orchestration protocol, three-stage review, checkpoint protocol
2. `.claude/skills/secure-feature-pipeline/implementer-prompt.md` — implementer agent template
3. `.claude/skills/secure-feature-pipeline/spec-reviewer-prompt.md` — spec compliance review template
4. `.claude/skills/secure-feature-pipeline/security-reviewer-prompt.md` — security review template
5. `.claude/skills/secure-feature-pipeline/code-quality-reviewer-prompt.md` — code quality review template

**After re-reading, verify you can answer:**
- What are the three review stages and their order? (spec → security → code quality)
- What are the 4 steps of the commit checkpoint protocol?
- What is the next pending task?

## Resume Instructions

1. Read this progress file completely
2. Re-read ALL skill files listed in Skill Recovery section above
3. Read `docs/plans/2026-03-24-watchlist-star-toggle-plan.md`
4. Read `docs/specs/2026-03-24-watchlist-star-toggle-spec.md`
5. Check `git log --oneline -10` to verify last commit matches last `done` task
6. Check `git status` for any uncommitted work
7. Continue from the next `pending` task

## Notes

- Pure frontend change — no backend/proto/DB changes
- Task 0 and Task 2 are independent (different files) — can run in parallel
- Task 1 is the main implementation task; must follow Task 0 (needs translation keys)
- React Query deduplicates useQueryListWatchlist between WatchlistTab and PricesPage — no WatchlistTab refactoring needed
- InvestmentType for currency rows = INVESTMENT_TYPE_OTHER (7)
- InvestmentType for gold rows = INVESTMENT_TYPE_GOLD_VND (8)
- InvestmentType for silver rows = INVESTMENT_TYPE_SILVER_VND (10)
