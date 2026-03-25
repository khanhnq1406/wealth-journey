# Mihong Gold Source — Implementation Progress

## Metadata

- **Feature:** mihong-gold-source
- **Plan file:** `docs/plans/2026-03-25-mihong-gold-source-plan.md`
- **Spec file:** `docs/specs/2026-03-25-mihong-gold-source-spec.md`
- **Started:** 2026-03-25T00:00:00Z
- **Last updated:** 2026-03-25T01:00:00Z
- **Current state:** in_progress
- **Current task:** 2

## Task Progress

| #   | Task Name                                    | Status      | Commit | Summary |
| --- | -------------------------------------------- | ----------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams              | done        | TBD    | Added Mi Hồng Price API to c4-context.md and pkg/mihong to c4-component-backend.md |
| 1   | Fix aliasToCanonical — SJ9999 + SJL1L10      | done        | TBD    | Added SJ9999→Vàng nhẫn SJC and SJL1L10→SJC to aliasToCanonical |
| 2   | Create pkg/mihong — Types                    | pending     | —      | —       |
| 3   | Create pkg/mihong — HTTP Client              | pending     | —      | —       |
| 4   | Create gold_fetcher_mihong.go Adapter        | pending     | —      | —       |
| 5   | Wire Mihong into NewGoldPriceService + E2E   | pending     | —      | —       |
| 6   | Update flow-cross-cutting.md                 | pending     | —      | —       |
| 7   | Append Fix 5 to Implementation Report        | pending     | —      | —       |

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

- Tasks 0 and 1 modify different files and can run in parallel.
- Tasks 2 and 3 must be sequential (types.go before client.go).
- Task 4 depends on Task 3 (pkg/mihong must exist).
- Task 5 depends on Task 4 (adapter must exist to wire).
- Tasks 6 and 7 are documentation and can run after Task 5.
- TDD tests for Task 1 are already written (red) in price_fetcher_test.go.
