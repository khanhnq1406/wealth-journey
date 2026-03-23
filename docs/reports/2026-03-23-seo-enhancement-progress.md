# SEO Enhancement — Implementation Progress

## Metadata

- **Feature:** SEO Enhancement
- **Plan file:** docs/plans/2026-03-23-seo-enhancement-plan.md
- **Spec file:** docs/specs/2026-03-23-seo-enhancement-spec.md
- **Started:** 2026-03-23
- **Last updated:** 2026-03-23
- **Current state:** completed
- **Current task:** done

## Task Progress

| #   | Task Name                                        | Status  | Commit | Summary |
| --- | ------------------------------------------------ | ------- | ------ | ------- |
| 1   | Create robots.ts                                 | done    | TBD    | Created app/robots.ts with locale-aware disallow rules |
| 2   | Create sitemap.ts                                | done    | TBD    | Created app/sitemap.ts with 3 public URLs |
| 3   | Fix title, description, canonical URL to Vietnamese | done    | TBD    | Vietnamese metadata, www canonical, Vietnamese keywords |
| 4   | Add hreflang tags                                | done    | TBD    | vi/en/x-default hreflang in fallback and dynamic metadata |
| 5   | Create JSON-LD structured data component         | done    | TBD    | JsonLd component + 5 schema types in landing layout |
| 6   | Create OG image                                  | done    | TBD    | Branded SVG OG image with gold/red colors and Vietnamese text |
| 7   | Add noindex to dashboard and auth pages          | done    | TBD    | noindex on auth layout, split dashboard layout for server metadata |
| 8   | Convert landing page to SSR with ISR             | done    | TBD    | Server page with ISR fetch, LandingContent client component |
| 9   | Update H1 text in i18n messages                  | done    | TBD    | SEO-optimized Vietnamese/English H1 titles |
| 10  | Improve image alt texts                          | done    | TBD    | Descriptive Vietnamese alt texts for navbar, hero, auth images |
| 11  | Add preconnect to API domain                     | done    | TBD    | Preconnect link in locale layout head |
| 12  | Phase 4 documentation verification               | done    | —      | Verified P4-1 through P4-6 in spec, no code changes |

**Status values:** `pending` | `in_progress` | `done` | `skipped`

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

- Plan specifies Task 0 (C4 diagrams) is skipped — no architectural changes
- Tasks 1-2 are independent and can be parallelized
- Tasks 3-4 modify the same file (landing/layout.tsx) — sequential
- Task 8 is the riskiest (SSR refactor)
- This is frontend-only — no backend changes
