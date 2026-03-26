# Multi-Source Gold Price Collection — Implementation Progress

## Metadata

- **Feature:** Multi-Source Gold Price Collection
- **Plan file:** `docs/plans/2026-03-26-multi-source-gold-price-plan.md`
- **Spec file:** `docs/specs/2026-03-26-multi-source-gold-price-spec.md`
- **Started:** 2026-03-26T00:00:00Z
- **Last updated:** 2026-03-26T00:00:00Z
- **Current state:** in_progress
- **Current task:** 0 (C4 diagrams) + 8 (shared sanitizer) — parallel first batch

## Task Progress

| #   | Task Name                                     | Status      | Commit | Summary |
| --- | --------------------------------------------- | ----------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams               | pending     | —      | —       |
| 1   | DB Schema Migration — Add source constraint   | pending     | —      | —       |
| 2   | MarkStaleByAssetTypeAndSource                 | pending     | —      | —       |
| 3   | Set source="waterfall" in existing methods    | pending     | —      | —       |
| 4   | SJC Client Package                            | pending     | —      | —       |
| 5   | DOJI Client Package                           | pending     | —      | —       |
| 6   | BTMC Direct Client Package                    | pending     | —      | —       |
| 7   | PNJ Client Package                            | pending     | —      | —       |
| 8   | Shared SanitizeTypeCode utility               | pending     | —      | —       |
| 9   | Integrate sources into AssetPriceService      | pending     | —      | —       |
| 10  | Wire DI providers                             | pending     | —      | —       |
| 11  | No-regression check                           | pending     | —      | —       |
| 12  | Log format (included in Task 9)               | skipped     | —      | Handled in Task 9 |
| 13  | Backend lint & build verification             | pending     | —      | —       |
| 14  | Update runtime flow diagram                   | pending     | —      | —       |

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

- Task 12 (Log format) is folded into Task 9 — handled in RefreshAllPrices implementation
- Task 11 (no-regression) is folded into Task 10 (DI wiring) — simple verification step
- Parallel first batch: Task 0 (C4 diagrams) + Task 8 (shared sanitizer) — no file conflicts
- After Task 8 done: Tasks 4, 5, 6, 7 can run in parallel
- After Tasks 2+3 done (both depend on Task 1): proceed to Task 9
