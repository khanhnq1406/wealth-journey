# Investment Price Unification — Implementation Progress

## Metadata

- **Feature:** investment-price-unification
- **Plan file:** docs/plans/2026-03-30-investment-price-unification-plan.md
- **Spec file:** docs/specs/2026-03-30-investment-price-unification-spec.md
- **Started:** 2026-03-30T00:00:00Z
- **Last updated:** 2026-03-30T12:00:00Z
- **Current state:** done
- **Current task:** —

## Task Progress

| #   | Task Name                                              | Status      | Commit | Summary |
| --- | ------------------------------------------------------ | ----------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams                        | done        | —      | c4-component-backend + c4-component-frontend updated |
| 1   | Add ListForInvestment Method to Service + Repository   | done        | —      | ListForInvestment in repo + service interface + implementation |
| 2   | Refactor Gold Handler to Read VND Types from DB        | done        | —      | GoldHandler reads VND from DB via ListForInvestment, 5 tests |
| 3   | Refactor Silver Handler to Read VND Types from DB      | done        | —      | SilverHandler reads VND from DB via ListForInvestment, 9 tests |
| 4   | Remove VND Entries from Static Registries              | done        | —      | GoldTypes/SilverTypes USD-only; AliasToCanonical removed |
| 5   | Seed Migration — Update Silver Configs show_in_investment = true | done | — | Migration cmd + Taskfile entry, idempotent UPDATE |
| 6   | Frontend — Silver Investment Form Reads from Admin Config API | done    | — | silverDisplayPricesQuery + inferSilverUnits, 12 tests |
| 7   | Frontend — Remove Hardcoded VND Option Arrays          | done        | —      | GOLD/SILVER_VND_OPTIONS de-exported, getXTypeOptions returns [] for VND |
| 8   | Frontend — Watchlist and Price Alert Forms Use Admin Config | done    | —      | useQueryGetAssetDisplayPrices in watchlist+price-alert forms, 14 tests |
| 9   | Backend Lint + Frontend Lint + Full Build Verification | done        | —      | golangci-lint 0 issues, go build clean, all Go tests pass; frontend 1 pre-existing lint error (FilterableAutocomplete, not from this feature) |
| 10  | Create/Update Runtime Flow Diagrams                    | done        | —      | flow-investment.md section 11 added: VND type selection via admin config |

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

- Task 0 (diagrams) + Task 1 (ListForInvestment) + Task 5 (silver migration) are independent and can run first
- Task 2 + Task 3 depend on Task 1 and are parallel-safe with each other
- Task 4 depends on Tasks 2 + 3
- Task 6 depends on Task 3; Task 7 depends on Task 6; Task 8 depends on Task 7
- Task 9 (verification) depends on all above
- Task 10 (flow diagrams) depends on Task 4
- Spec deviation: The spec says seed silver display configs — but DB already has them with different TypeCodes. The plan instead does a migration to set show_in_investment=true on existing silver configs.
