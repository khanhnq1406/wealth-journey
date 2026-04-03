# Cancel Google Connection — Implementation Progress

## Metadata

- **Feature:** Cancel Google Connection (UnlinkGoogle)
- **Plan file:** `docs/plans/2026-04-03-cancel-google-connection-plan.md`
- **Spec file:** `docs/specs/2026-04-03-cancel-google-connection-spec.md`
- **Started:** 2026-04-03T00:00:00+07:00
- **Last updated:** 2026-04-03T12:00:00+07:00
- **Current state:** in_progress
- **Current task:** 8

## Task Progress

| #     | Task Name                                   | Status      | Commit | Summary |
| ----- | ------------------------------------------- | ----------- | ------ | ------- |
| 0     | Update C4 Architecture Diagrams             | done        | ddf4b4a8 | Added UnlinkGoogle to AuthHandler (backend C4) and DisconnectGoogleDialog note to AuthMethodsCard (frontend C4) |
| 1     | Proto — Add UnlinkGoogle RPC and Messages   | done        | d52ea534 | Added UnlinkGoogle RPC + messages to auth.proto; restored missing GetAssetDisplayPrices RPC to investment.proto; both builds pass |
| 2     | Backend — UnlinkGoogle Service Method       | done        | 80b2a85d | UnlinkGoogle method in auth.go with guards, provider strip, session revocation; 5 passing unit tests |
| 3     | Backend — UnlinkGoogle Handler and Route    | done        | 0d9b4777 | UnlinkGoogle handler in auth.go + POST /unlink-google route; 3 passing handler tests |
| 4+5   | Frontend — i18n Keys + Error Mapper         | done        | 9371d23f | 9 i18n keys (en+vi); mapUnlinkGoogleError with 13-test suite; TS compiles clean |
| 6+7   | Frontend — DisconnectGoogleDialog + Card    | done        | —      | DisconnectGoogleDialog + Disconnect button in AuthMethodsCard; 8 tests passing; TS clean; fixed color token violations |
| 8     | Update Runtime Flow Diagram (flow-auth.md)  | pending     | —      | —       |

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

- Task 0 and Task 8 are docs-only (no code/tests needed)
- Tasks 1→2→3 must be sequential (proto first, then service, then handler)
- Tasks 4+5 can run independently after Task 1 (proto confirms field names)
- Tasks 6+7 depend on Tasks 4+5 (error mapper) and proto:all generated hook
- Tasks 4+5 and 6+7 are grouped for efficiency (no shared file conflicts within groups)
