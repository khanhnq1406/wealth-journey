# i18n Error Code Mapping — Implementation Progress

## Metadata

- **Feature:** i18n Error Code Mapping
- **Plan file:** docs/plans/2026-03-23-i18n-error-codes-plan.md
- **Spec file:** docs/specs/2026-03-23-i18n-error-codes-spec.md
- **Started:** 2026-03-23T10:00:00Z
- **Last updated:** 2026-03-23T10:00:00Z
- **Current state:** in_progress
- **Current task:** 1

## Task Progress

| #   | Task Name                                    | Status  | Commit | Summary |
| --- | -------------------------------------------- | ------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams              | pending | —      | —       |
| 1   | Create Granular Error Code Registry           | done    | TBD    | Created codes.go with ~150 error codes + codes_test.go |
| 2   | Add WithCode Constructors to errors.go       | done    | TBD    | Added 9 WithCode constructors + tests |
| 13  | Add WithCode Variants to handler/response.go | done    | TBD    | Added 5 WithCode handler funcs + updated HandleError |
| 3   | Migrate Wallet Domain Errors                 | pending | —      | —       |
| 4   | Migrate Transaction Domain Errors            | pending | —      | —       |
| 5   | Migrate Category Domain Errors               | pending | —      | —       |
| 6   | Migrate Budget Domain Errors                 | pending | —      | —       |
| 7   | Migrate Investment Domain Errors             | pending | —      | —       |
| 8   | Migrate Import Domain Errors                 | pending | —      | —       |
| 9   | Migrate Session/User/FX/Analysis Errors      | pending | —      | —       |
| 10  | Migrate Auth Domain Errors                   | pending | —      | —       |
| 11  | Migrate Community & Sentiment Errors         | pending | —      | —       |
| 12  | Normalize Inconsistent gin.H{} Responses     | pending | —      | —       |
| 14  | Create Frontend Error Translation Utility    | pending | —      | —       |
| 15  | Create Error Translation Files (en + vi)     | pending | —      | —       |
| 16  | Integrate Error Translation in Forms         | pending | —      | —       |
| 17  | Create Runtime Flow Diagrams                 | pending | —      | —       |
| 18  | Backend Build Verification                   | pending | —      | —       |
| 19  | Frontend Build Verification                  | pending | —      | —       |

## Skill Recovery

**MANDATORY: Re-read these files before continuing work (context compaction drops them):**

1. `.claude/skills/secure-feature-pipeline/step-3-implement.md` — orchestration protocol, three-stage review, checkpoint protocol
2. `.claude/skills/secure-feature-pipeline/implementer-prompt.md` — implementer agent template
3. `.claude/skills/secure-feature-pipeline/spec-reviewer-prompt.md` — spec compliance review template
4. `.claude/skills/secure-feature-pipeline/security-reviewer-prompt.md` — security review template
5. `.claude/skills/secure-feature-pipeline/code-quality-reviewer-prompt.md` — code quality review template

**After re-reading, verify you can answer:**
- What are the three review stages and their order?
- What are the 4 steps of the commit checkpoint protocol?
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

- This is a cross-cutting feature affecting all backend handlers/services and frontend error display
- No new endpoints or data model changes
- Existing error response format preserved, only `code` field values change
