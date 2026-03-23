# i18n Error Code Mapping — Implementation Progress

## Metadata

- **Feature:** i18n Error Code Mapping
- **Plan file:** docs/plans/2026-03-23-i18n-error-codes-plan.md
- **Spec file:** docs/specs/2026-03-23-i18n-error-codes-spec.md
- **Started:** 2026-03-23T10:00:00Z
- **Last updated:** 2026-03-23T10:00:00Z
- **Current state:** completed
- **Current task:** done

## Task Progress

| #   | Task Name                                    | Status  | Commit | Summary |
| --- | -------------------------------------------- | ------- | ------ | ------- |
| 0   | Update C4 Architecture Diagrams              | done    | TBD    | Updated backend/frontend L3 + cross-cutting flow diagram |
| 1   | Create Granular Error Code Registry           | done    | TBD    | Created codes.go with ~150 error codes + codes_test.go |
| 2   | Add WithCode Constructors to errors.go       | done    | TBD    | Added 9 WithCode constructors + tests |
| 13  | Add WithCode Variants to handler/response.go | done    | TBD    | Added 5 WithCode handler funcs + updated HandleError |
| 3   | Migrate Wallet Domain Errors                 | done    | TBD    | 27 error calls migrated in wallet_v2.go + wallet_service.go |
| 4   | Migrate Transaction Domain Errors            | done    | TBD    | 21 error calls migrated in transaction.go + transaction_service.go |
| 5   | Migrate Category Domain Errors               | done    | TBD    | 8 error calls migrated in category.go + category_service.go |
| 6   | Migrate Budget Domain Errors                 | done    | TBD    | 12 error calls migrated in budget.go + budget_service.go |
| 7   | Migrate Investment Domain Errors             | done    | TBD    | 32 error calls migrated in investment.go + investment_service.go |
| 8   | Migrate Import Domain Errors                 | done    | TBD    | 43 error calls migrated in import.go + import_service.go |
| 9   | Migrate Session/User/FX/Analysis Errors      | done    | TBD    | 17 error calls migrated across 4 files |
| 10  | Migrate Auth Domain Errors                   | done    | TBD    | 9 error calls migrated in auth.go + errors.go auth constructors |
| 11  | Migrate Community & Sentiment Errors         | done    | TBD    | 14 error calls migrated in community + sentiment services |
| 12  | Normalize Inconsistent gin.H{} Responses     | done    | TBD    | 28 gin.H{} responses replaced in 7 files + middleware |
| 14  | Create Frontend Error Translation Utility    | done    | TBD    | Created error-translator.ts with getTranslatedError() |
| 15  | Create Error Translation Files (en + vi)     | done    | TBD    | Created en/errors.json + vi/errors.json (~150 codes each) |
| 16  | Integrate Error Translation in Forms         | done    | TBD    | Updated 29 form files with getTranslatedError() |
| 17  | Create Runtime Flow Diagrams                 | done    | TBD    | Added error translation sequence diagram |
| 18  | Backend Build Verification                   | done    | TBD    | go build + go test all pass |
| 19  | Frontend Build Verification                  | done    | TBD    | npm run build passes cleanly |

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
