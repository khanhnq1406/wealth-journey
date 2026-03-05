# Skills Changelog

## 2026-01-31 - Priority Rule #1: Error Handling and Retries

### Summary

Added **Priority Rule #1** to all skills: Error handling and retry policy.

### What Changed

- **Created:** `/Users/admin/.claude/skills/shared-error-handling.md`
  - Single source of truth for error handling and retry guidance
  - Defines the 3 commandments: Investigate first, Don't retry immediately, 5-retry limit

- **Updated:** All 17 skills with "Priority Rule #1" section:
  1. `brainstorming/SKILL.md`
  2. `dispatching-parallel-agents/SKILL.md`
  3. `executing-plans/SKILL.md`
  4. `finishing-a-development-branch/SKILL.md`
  5. `react-best-practices/SKILL.md`
  6. `receiving-code-review/SKILL.md`
  7. `requesting-code-review/SKILL.md`
  8. `responsive-design/` (no SKILL.md exists)
  9. `subagent-driven-development/SKILL.md`
  10. `systematic-debugging/SKILL.md` (already had investigation principles, added retry limit)
  11. `test-driven-development/SKILL.md`
  12. `using-git-worktrees/SKILL.md`
  13. `using-superpowers/SKILL.md`
  14. `verification-before-completion/SKILL.md`
  15. `web-design-guidelines/SKILL.md`
  16. `writing-plans/SKILL.md`
  17. `writing-skills/SKILL.md`

### Why

The new #1 priority rule establishes:
1. **Root cause investigation before retrying** - prevents mindless retry loops
2. **No immediate retries** - same error will occur without understanding
3. **5-retry limit with human escalation** - prevents thrashing, ensures user gets notified

This addresses the problem where commands would be retried without understanding the root cause, leading to wasted time and resources.

### Breaking Changes

None - this is an additive change only.

### Impact

All skills now follow a unified error handling and retry policy:
- Commands failing will be investigated first
- Retries will only happen after root cause is understood
- After 5 failed retries, the user will be consulted
- Examples provided in each skill show good vs bad error handling

### Verification

All 17 skills verified to contain "Priority Rule #1" section.
