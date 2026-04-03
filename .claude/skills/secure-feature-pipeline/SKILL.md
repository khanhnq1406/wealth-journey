---
name: secure-feature-pipeline
description: "Use when implementing a new feature from requirement to production in this financial application. Covers the full lifecycle: brainstorm, plan, implement, review, and fix. Invoked with command steps: brainstorm, plan, implement, review, fix."
---

# Secure Feature Pipeline

## Overview

End-to-end feature delivery pipeline for the WealthJourney financial application. Takes a feature from raw requirement through brainstorming, planning, implementation, review, and hotfix — with security, risk assessment, and financial data integrity checks woven into every step.

**Core principle:** Financial applications demand defense-in-depth. Every step produces artifacts that feed the next step, and every step includes a dedicated security and risk assessment section.

**Announce at start:** "I'm using the secure-feature-pipeline skill — step: `{step}`."

## CRITICAL: Do NOT Use Claude Code Plan Mode

**NEVER call `EnterPlanMode` when this skill is active.** This skill has its own planning process (Step 2: Plan) that saves plans to `docs/plans/YYYY-MM-DD-<feature>-plan.md`. Claude Code's built-in plan mode writes to `.claude/` which is the WRONG location.

**Red flags that you're about to violate this:**

- Thinking "I should enter plan mode to plan this"
- Calling `EnterPlanMode` for any reason during this skill's execution
- Writing plan files to `.claude/` instead of `docs/plans/`
- Following Claude Code's native planning flow instead of this skill's Step 2

**The rule:** When this skill is active, the word "plan" means **this skill's Step 2**, not Claude Code's `EnterPlanMode`. Always save plans to `docs/plans/`.

## Priority Rule #1: Error Handling and Retries

**BEFORE retrying any failed command:**

1. **Investigate Root Cause First** — Read the error, identify WHY it failed
2. **DON'T Retry Immediately** — Same error will recur
3. **Retry Limit** — Max 5 retries, then ask user

## Command Steps

This skill is invoked with one of 5 command steps. The user passes the required input for each step.

| Step | Command      | Input                                   | Output                                                                |
| ---- | ------------ | --------------------------------------- | --------------------------------------------------------------------- |
| 1    | `brainstorm` | Feature requirement (text)              | Spec file (`docs/specs/YYYY-MM-DD-<feature>-spec.md`)                 |
| 2    | `plan`       | Spec file path                          | Plan file (`docs/plans/YYYY-MM-DD-<feature>-plan.md`)                 |
| 3    | `implement`  | Plan file path                          | Implementation report (`docs/reports/YYYY-MM-DD-<feature>-report.md`) |
| 4    | `review`     | Implementation report path              | Review verdict (approve / issues found)                               |
| 5    | `fix`        | Issue description OR report with issues | Loops back to step 1 (brainstorm the fix)                             |

## Kanban Task Integration

**After completing each step, create or update the Obsidian Kanban task for this feature.** This keeps the board in sync with pipeline progress automatically.

### Task note location

`docs/obsidian/YYYY-MM-DD-<feature>.md` — same date and slug as the spec/plan/report files, no suffix.

Example: spec is `docs/specs/2026-04-02-price-alert-bugs-spec.md` → task note is `docs/obsidian/2026-04-02-price-alert-bugs.md`

### Kanban board entry (alias syntax)

```
- [ ] [[YYYY-MM-DD-<feature>|<Human-Readable Title>]]
```

### Kanban columns

The board has **6 columns** in order:

| Column | Meaning |
| ------ | ------- |
| `## Not Started` | Task created, no work begun |
| `## Spec` | Brainstorm/spec step in progress or done |
| `## Plan` | Plan step in progress or done |
| `## Implement` | Implementation in progress or done |
| `## Review` | Implementation done, awaiting review |
| `## Done` | Reviewed and approved |

### Task note template

```markdown
---
type: <bug|feature>
status: <Not Started|Spec|Plan|Implement|Review|Done>
---

## Overview

<1–3 sentences: what the feature/bug is and why it matters>

## Pipeline Artifacts

| Artifact | File |
| -------- | ---- |
| Spec     | `docs/specs/YYYY-MM-DD-<feature>-spec.md` |
| Plan     | `docs/plans/YYYY-MM-DD-<feature>-plan.md` _(added after step 2)_ |
| Progress | `docs/reports/YYYY-MM-DD-<feature>-progress.md` _(added after step 3 starts)_ |
| Report   | `docs/reports/YYYY-MM-DD-<feature>-report.md` _(added after step 3 completes)_ |
```

### When to create/update

| After step | Action | Status to set |
| ---------- | ------ | ------------- |
| 1 — Brainstorm | **Create** task note with spec link. **Add** Kanban entry under `## Not Started`. | `Not Started` |
| 1 — Brainstorm (spec written) | **Move** Kanban entry to `## Spec`. Update task note status. | `Spec` |
| 2 — Plan | **Update** task note: add plan link to Pipeline Artifacts table. **Move** Kanban entry to `## Plan`. | `Plan` |
| 3 — Implement (start) | **Update** task note: add progress file link. **Move** entry to `## Implement`. | `Implement` |
| 3 — Implement (done) | **Update** task note: add report link. **Move** Kanban entry to `## Review`. Update task note status. | `Review` |
| 4 — Review (approved) | No automatic Kanban move — user moves entry to `## Done` manually. | (unchanged) |

**Moving a Kanban entry:** remove the `- [ ] [[...]]` line from the old column and insert it in the new column (newest at top). Update `status` in the task note frontmatter to match the column name (`Not Started` → `Spec` → `Plan` → `Implement` → `Review` → `Done`).

**Do NOT create a duplicate Kanban entry** — if one already exists for this feature slug, update it in place.

---

## Step Routing

**Based on the command step, read the corresponding file for full instructions:**

| Step | File to Read |
| ---- | ------------ |
| 1 — Brainstorm | `./step-1-brainstorm.md` |
| 2 — Plan | `./step-2-plan.md` |
| 3 — Implement | `./step-3-implement.md` |
| 4 — Review | `./step-4-review.md` |
| 5 — Fix | `./step-5-fix.md` |

**STOP GATE — Do NOT proceed until you have read the step file.**

1. Use the `Read` tool to load the step file in full.
2. Before doing ANY work, cite the **Process flowchart** (or first heading) and **the output artifact path** from the file you just read. This proves you read it.
3. If you find yourself starting work without completing steps 1-2 above, STOP immediately and go back.

Skipping the step file is the same as skipping the spec — it leads to wrong output, missed guardrails, and rework.

---

## Context Compaction Guard

**Problem:** Long implementation sessions trigger auto-compaction, which drops skill instructions from context. The orchestrator then stops following the protocol.

**Prevention:** The progress file (created in Step 3) contains a `Skill Recovery` section that lists all skill files to re-read. After compaction, the orchestrator reads the progress file first, which tells it to reload the skill instructions.

**If you notice yourself unsure about the protocol (review stages, checkpoint steps, template paths):**
1. Read the progress file: `docs/reports/YYYY-MM-DD-<feature>-progress.md`
2. Follow its `Skill Recovery` section — re-read all listed skill files
3. Cite the three-stage review order and checkpoint protocol before continuing

**This is NOT optional.** Proceeding without the full protocol leads to skipped reviews, missing commits, and security gaps.

## Red Flags — STOP and Reassess

- Starting work on a step without citing the step file's process and output path (proof of reading)

- Calling `EnterPlanMode` at any point during this skill's execution (use this skill's Step 2 instead)
- Starting to code a fix without classifying severity first (minor vs major)
- Implementing a fix without TDD (even for "trivial" fixes)
- Skipping the security reviewer dispatch during fix step ("it's just a small change")
- Implementing a major fix directly instead of running Steps 1-4 of this skill
- Skipping the security analysis in brainstorm
- Skipping the DFD — applying STRIDE without data flow mapping
- Implementing without a spec file
- Planning without reading the codebase
- Dispatching parallel agents on conflicting files
- Skipping any of the three review stages
- Marking a task complete with failing tests
- Accepting "close enough" on security review
- Leaking internal error details to the frontend
- Storing monetary values as floats
- Missing authorization checks on any endpoint
- Trusting client-side validation alone
- Adding external dependencies without assessing trust level and failure modes
- Storing API keys or secrets in code instead of environment variables
- Missing audit logging for financial operations
- No graceful degradation when external services fail
- Skipping dependency impact analysis when GitNexus index is available ("I already know what my changes affect")
- Claiming "tests cover everything" without running `gitnexus_detect_changes` to verify blast radius (when index is available)
- Implementing multi-step business logic without creating/updating runtime flow diagrams
- Using plain `<img>` tags instead of `next/image` / `OptimizedImage` / `Avatar` without justification
- Creating new components without checking if `components/` already has a suitable one
- Barrel file imports instead of direct imports (bundle size impact)
- Using the full fix pipeline for a one-line typo fix (use minor fix path)
- Proceeding to the next task without committing the current task and updating the progress file
- Proceeding to the next task without showing the user a summary
- Not initializing the progress file before starting the first task
- Leaving the progress file out of task commits
- Continuing implementation after context compaction without re-reading the skill files (progress file has the list)
- Being unsure about the task-cycle agent model or checkpoint protocol but proceeding anyway
- Dispatching an implementer agent + separate reviewer agents instead of one task-cycle agent (old pattern — causes context accumulation)
- Filling task-cycle agent prompt with "read the plan file for task details" instead of pasting the full task text inline

## Prompt Templates

**Step 3 — Implementation (two agents per task):**
- `./implementer-agent-prompt.md` — Implementer: TDD + self-check + E2E + structured report. Does NOT commit.
- `./reviewer-agent-prompt.md` — Reviewer: fresh context, reads actual code, 3 review stages, verdict. Does NOT commit.

**Other steps:**
- `./security-checklist.md` — Security analysis checklist for brainstorm step
- `./security-audit-prompt.md` — Full security audit template for review step
- `./impact-reviewer-prompt.md` — Dependency impact reviewer template (GitNexus-powered)

## Integration

**This skill orchestrates:**

- brainstorming patterns (from brainstorming skill)
- writing-plans patterns (from writing-plans skill)
- subagent-driven-development patterns (from subagent-driven-development skill)

**Required sub-skills by context:**

- **Any UI/frontend work** → `ui-ux-pro-max` skill (design system, color, typography, accessibility, component patterns) + `responsive-design` skill (mobile-first Tailwind breakpoints, container queries) + `react-best-practices` skill (performance: waterfalls, bundle size, re-renders, next/image)
- **C4 or architecture diagrams** → `c4-architecture` skill (Mermaid C4 syntax, element types, best practices)
- **Codebase exploration & dependency analysis** → `gitnexus-exploring` skill (execution flow tracing, cluster analysis, symbol context) + `gitnexus-impact-analysis` skill (blast radius, dependency mapping, pre-commit change detection)
- **Debugging & refactoring during implementation** → `gitnexus-debugging` skill (error tracing, call chain analysis) + `gitnexus-refactoring` skill (safe rename, extract, split with impact verification)
- **PR/implementation review** → `gitnexus-pr-review` skill (automated blast radius check, missing caller detection, process flow verification)

**Subagents should follow:**

- Existing codebase patterns (CLAUDE.md)
- Protocol Buffer first API design
- DDD architecture (models → repository → service → handler)
- Financial data integrity rules (int64 for money, never float)
- **Mobile-first design** for all frontend work (custom `sm:` breakpoint at 800px in `tailwind.config.ts`)
