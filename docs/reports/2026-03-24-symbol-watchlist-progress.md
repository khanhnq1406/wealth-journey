# Symbol Watchlist — Implementation Progress

## Metadata

- **Feature:** Symbol Watchlist
- **Plan file:** docs/plans/2026-03-24-symbol-watchlist-plan.md
- **Spec file:** docs/specs/2026-03-24-symbol-watchlist-spec.md
- **Started:** 2026-03-24T00:00:00Z
- **Last updated:** 2026-03-24T00:00:00Z
- **Current state:** in_progress
- **Current task:** 2

## Task Progress

| #   | Task Name                                              | Status  | Commit | Summary |
| --- | ------------------------------------------------------ | ------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams                        | done    | —      | Added GoldPriceService, SilverPriceService components and watchlist data flow examples to backend C4 diagram |
| 1   | Define Protobuf API — watchlist.proto                  | done    | —      | Created watchlist.proto with 7 messages, 6 RPCs; generated Go+TS types and 8+ React Query hooks |
| 2   | Database Model — watchlist.go                          | pending | —      | —       |
| 3   | Database Migration — migrate-watchlist                 | pending | —      | —       |
| 4   | Repository Layer — watchlist_repository.go             | pending | —      | —       |
| 5   | Service Layer — watchlist_service.go                   | pending | —      | —       |
| 6   | Wire Repository + Service into DI                      | pending | —      | —       |
| 7   | REST Handler — watchlist.go                            | pending | —      | —       |
| 8   | Wire Handler + Routes                                  | pending | —      | —       |
| 9   | Frontend — Watchlist Feature Module + Generated Hooks  | pending | —      | —       |
| 10  | Frontend — WatchlistTab + watchlist-helpers            | pending | —      | —       |
| 11  | Frontend — AssetTypeBadge Component                    | pending | —      | —       |
| 12  | Frontend — DraggableWatchlistTable Component           | pending | —      | —       |
| 13  | Frontend — AddToWatchlistForm                          | pending | —      | —       |
| 14  | Frontend — Integrate Watchlist Tab into Prices Page    | pending | —      | —       |
| 15  | Frontend — Navigation Integration                      | pending | —      | —       |
| 16  | Create Runtime Flow Diagram                            | pending | —      | —       |
| 17  | Final Integration Testing                              | pending | —      | —       |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

## Skill Recovery

**MANDATORY: Re-read these files before continuing work (context compaction drops them):**

1. `.claude/skills/secure-feature-pipeline/step-3-implement.md` — orchestration protocol, three-stage review, checkpoint protocol
2. `.claude/skills/secure-feature-pipeline/implementer-prompt.md` — implementer agent template
3. `.claude/skills/secure-feature-pipeline/spec-reviewer-prompt.md` — spec compliance review template
4. `.claude/skills/secure-feature-pipeline/security-reviewer-prompt.md` — security review template
5. `.claude/skills/secure-feature-pipeline/code-quality-reviewer-prompt.md` — code quality review template

**After re-reading, verify you can answer:**
- What are the three review stages and their order? (spec → security → code quality)
- What are the 4 steps of the commit checkpoint protocol? (1: update progress file, 2: stage and commit, 3: show user summary, 4: auto-proceed)
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

- Task 0 and Task 1 are independent (diagrams vs. proto). Can be done in parallel.
- Tasks 2-8 are sequential backend implementation chain.
- Tasks 9-15 are frontend tasks that depend on Task 1 (proto generation).
- Task 15 (navigation) is independent of Tasks 10-14 (watchlist components).
- Task 16 (flow diagram) can be done after Task 5 (service layer).
