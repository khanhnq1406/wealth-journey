# Terms & Privacy Pages — Implementation Progress

## Metadata

- **Feature:** terms-and-privacy
- **Plan file:** `docs/plans/2026-04-03-terms-and-privacy-plan.md`
- **Spec file:** `docs/specs/2026-04-03-terms-and-privacy-spec.md`
- **Started:** 2026-04-03T00:00:00Z
- **Last updated:** 2026-04-03T03:00:00Z
- **Current state:** in_progress
- **Current task:** 5+6+7

## Task Progress

| #    | Task Name                                       | Status     | Commit | Summary |
| ---- | ----------------------------------------------- | ---------- | ------ | ------- |
| 0+1  | Register i18n namespace + create message files  | done       | 0a6dce06 | Registered legal namespace in i18n/request.ts; created en/legal.json and vi/legal.json with 9 terms + 9 privacy sections |
| 2    | Create shared legal layout                      | done       | bd25ca9e | Created app/[locale]/legal/layout.tsx with SEO metadata (canonical, hreflang, robots) + children passthrough |
| 3    | Create Terms of Service page                    | done       | ab0a8169 | Created terms layout, page, TermsContent (9 sections, disclaimer highlighted), tests + E2E spec |
| 4    | Create Privacy Policy page                      | done       | ab0a8169 | Created privacy layout, page, PrivacyContent (9 sections, uniform styling), tests + E2E spec |
| 5    | Fix auth page broken links                      | pending    | —      | —       |
| 6    | Update LandingFooter — add legal links          | pending    | —      | —       |
| 7    | Update Settings Hub — add Legal section         | pending    | —      | —       |
| 8    | Update C4 frontend diagram                      | pending    | —      | —       |

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

- Pure frontend feature — no backend changes needed
- Tasks 3 and 4 can run in parallel (independent files)
- Tasks 5, 6, 7 can run in parallel after Task 1
- All pages are static read-only — no auth required, no user input
