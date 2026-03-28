# Remove AliasToCanonical from DB Write Path — Implementation Progress

## Metadata

- **Feature:** Remove AliasToCanonical from DB write path
- **Plan file:** `docs/plans/2026-03-27-remove-alias-to-canonical-plan.md`
- **Spec file:** `docs/specs/2026-03-27-remove-alias-to-canonical-spec.md`
- **Started:** 2026-03-27T00:00:00Z
- **Last updated:** 2026-03-27T12:00:00Z
- **Current state:** completed
- **Current task:** done

## Task Progress

| #   | Task Name                                                  | Status | Commit     | Summary |
| --- | ---------------------------------------------------------- | ------ | ---------- | ------- |
| 0   | Remove normalization from `refreshGoldVangSaiGon`          | done   | `c1e5663b` | Removed AliasToCanonical lookup from vangsaigon refresh; raw TypeCodes stored as-is |
| 1   | Remove normalization from WaterfallGoldFetcher + fix tests | done   | `e1dd1dfb` | Removed normalization from FetchGoldPrices + FetchGoldPricesAllSources; updated 7 tests to assert raw pass-through |
| 2   | Update AliasToCanonical comment + flow-investment.md       | done   | `9535a5a2` | Marked AliasToCanonical as reference-only in types.go; no flow-investment.md changes needed |
| 3   | Backend CI verification                                    | done   | —          | task ci:backend-lint PASS; go test -short ./... all pass |

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

- Tasks 0 and 1 are independent (different files) — dispatched in parallel
- Task 2 depends on Tasks 0 and 1 completing
- Task 3 is final CI check
- No frontend changes needed
- No DB migration needed
