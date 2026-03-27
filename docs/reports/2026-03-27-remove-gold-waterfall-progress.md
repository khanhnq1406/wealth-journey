# Remove Gold Waterfall — Implementation Progress

## Metadata

- **Feature:** Remove Gold Waterfall — Direct Source Parallelism
- **Plan file:** `docs/plans/2026-03-27-remove-gold-waterfall-plan.md`
- **Spec file:** `docs/specs/2026-03-27-remove-gold-waterfall-spec.md`
- **Started:** 2026-03-27T00:00:00Z
- **Last updated:** 2026-03-27T10:15:00Z
- **Current state:** in_progress
- **Current task:** 6

## Task Progress

| #   | Task Name                                                        | Status      | Commit | Summary |
| --- | ---------------------------------------------------------------- | ----------- | ------ | ------- |
| 0   | Add mockSimpleGoldPriceFetcher + failing tests                   | done        | —      | Added mock + 4 TDD failing tests for VangSaiGon/VangToday goroutines |
| 1   | Update assetPriceService struct + constructor                    | done        | —      | Replaced goldSvc with vangSaiGonFetcher+vangTodayFetcher in struct + constructor |
| 2   | Remove refreshGold; add refreshGoldVangSaiGon + refreshGoldVangToday | done   | —      | Removed waterfall method; added two direct-source methods with AliasToCanonical |
| 3   | Update RefreshAllPrices 7→8 goroutines                           | done        | —      | Channel buffer 7→8, failCount 7→8, wired new goroutines |
| 4   | Update services.go DI wiring                                     | done        | —      | Replaced goldPriceSvc with NewVangSaiGonGoldFetcher+NewVangTodayGoldFetcher |
| 5   | Update flow-cross-cutting.md Section 13                          | done        | —      | Section 13 rewritten: GPS participant removed, VSG+VT participants added, 8 goroutines, waterfall par block replaced with two direct-source blocks |
| 6   | Final CI verification + implementation report                    | in_progress | —      | —       |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Skill Recovery

**MANDATORY: Re-read these files before continuing work (context compaction drops them):**

1. `.claude/skills/secure-feature-pipeline/step-3-implement.md` — coordinator protocol, two-agent model, commit checkpoint
2. `.claude/skills/secure-feature-pipeline/implementer-agent-prompt.md` — implementer template (placeholders to fill)
3. `.claude/skills/secure-feature-pipeline/reviewer-agent-prompt.md` — reviewer template (placeholders to fill)

**After re-reading, verify you can answer:**
- What are the two agents per task and what does each one do?
- Which agent commits — the implementer, the reviewer, or the coordinator?
- What is the next pending task?

## Resume Instructions

To resume this implementation after context compaction or in a new session:

1. Read this progress file completely (including the Skill Recovery section above)
2. **Re-read ALL skill files listed in Skill Recovery section above** — this is NON-NEGOTIABLE
3. Read the plan file referenced in Metadata
4. Read the spec file referenced in Metadata
5. Check `git log --oneline -10` to verify last commit matches the last `done` task
6. Check `git status` for any uncommitted work
7. Cite the three-stage review order and checkpoint protocol (proves context is recovered)
8. Continue from the next `pending` task using the same checkpoint protocol

## Notes

- Tasks 0→1→2→3→4 are sequential (each modifies `asset_price_service.go` or its test file)
- Task 5 (docs) can run after Task 4 is committed
- Task 6 (CI + report) runs after all code tasks complete
- `goldSvc GoldPriceService` remains in codebase (used by `MarketDataService`) — only removed from `assetPriceService`
- Old `source="waterfall"` rows in DB will persist but never be updated — acceptable per spec (follow-up migration out of scope)
