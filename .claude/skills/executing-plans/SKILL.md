---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## Priority Rule #1: Error Handling and Retries

**BEFORE retrying any failed command:**

1. **Investigate Root Cause First**
   - Read the error message completely
   - Check what the command was trying to do
   - Identify WHY it failed (not just THAT it failed)

2. **DON'T Retry Immediately**
   - Immediate retry without understanding = waste of time
   - Same error will likely occur again
   - Fix the root cause, then retry

3. **Retry Limit with Human Escalation**
   - Maximum 5 retry attempts
   - After 5 failed retries: MUST ask user before continuing
   - Explain: what failed, what you tried, what you suspect

**Example:**

<Good>
```
Task step failed: "npm install" - package-lock.json conflict

Investigation:
- Checked for lockfile conflicts
- Root cause: Merge didn't resolve package-lock properly

Fix: Resolve merge conflicts in package-lock.json, then retry
```
</Good>

<Bad>
```
Task step failed: npm install
Retrying... failed
Retrying... failed
```
</Bad>

**See:** [shared-error-handling.md](../shared-error-handling.md) for complete guidance.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create TodoWrite and proceed

### Step 2: Execute Batch
**Default: First 3 tasks**

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
