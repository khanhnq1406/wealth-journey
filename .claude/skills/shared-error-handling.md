# Shared Error Handling and Retry Policy

## Priority Rule #1

**Re-check the root cause first if the command run error. DON'T retry immediately. If retry error more than 5 times, ask first before continue retry.**

---

## Why This Is Priority #1

Random retries waste time and mask underlying problems. When a command fails, retrying without understanding **why** it failed leads to:

- **Thrashing**: Same error repeated multiple times
- **Masked issues**: The real problem never gets fixed
- **Wasted resources**: CPU, network, and API quotas consumed on doomed retries
- **User frustration**: No progress, just "trying again"

**Root cause analysis first** means:
- You understand what went wrong
- You can fix the actual problem
- Your retry has a chance of success
- You learn something about the system

---

## The Three Commandments

### 1. Investigate Root Cause First

**BEFORE retrying any failed command:**

1. **Read the error message completely**
   - Don't skim past errors
   - Error messages often contain the solution
   - Note error codes, line numbers, file paths

2. **Understand what the command was trying to do**
   - What operation was it performing?
   - What resources does it need?
   - What are its dependencies?

3. **Identify WHY it failed (not just THAT it failed)**
   - Missing file? Wrong permissions? Network timeout? Invalid input?
   - Environmental issue? Code bug? Dependency problem?
   - State mismatch? Race condition? Resource exhaustion?

### 2. DON'T Retry Immediately

**Immediate retry without understanding = waste of time**

- Same error will likely occur again
- You haven't changed anything that would make it succeed
- You're just hoping luck will be different (it won't)
- Each retry consumes resources without progress

**Only retry AFTER:**
- You've identified the root cause
- You've taken action to fix it
- You have reason to believe the retry will succeed

### 3. Retry Limit with Human Escalation

**Maximum 5 retry attempts**

After 5 failed retries:
- **STOP retrying**
- **MUST ask user before continuing**
- **Explain clearly:**
  - What failed
  - What you tried
  - What you suspect the issue is
  - What you propose to do next

**Why 5?**
- 1-2 retries: Reasonable for transient issues (network blip, temporary lock)
- 3-5 retries: Getting into thrashing territory, but acceptable for debugging
- 5+ retries: Definitely stuck, need human intervention

---

## Examples

### Good: Root Cause Analysis

```bash
Command failed: npm install
Error: ENOENT: no such file or directory, open '/project/package.json'

Investigation:
- Current directory: /home/user
- Expected directory: /project
- Root cause: Wrong working directory

Fix: cd /project, then retry
Result: Success on retry (because we fixed the root cause)
```

### Bad: Mindless Retry

```bash
Command failed: npm install
Error: ENOENT: no such file or directory, open '/project/package.json'

Retrying...
[FAIL] Same error

Retrying...
[FAIL] Same error

Retrying...
[FAIL] Same error

Result: Wasted time, no progress, user annoyed
```

---

## Error Investigation Checklist

When a command fails, run through this checklist:

- [ ] **Read the full error message**
  - What does it say?
  - Is there an error code?
  - Are there file paths or line numbers?

- [ ] **Check the environment**
  - Current directory correct?
  - Environment variables set?
  - Required files exist?
  - Permissions correct?

- [ ] **Check dependencies**
  - Required services running?
  - Network accessible?
  - APIs available?
  - Resources sufficient (disk, memory)?

- [ ] **Check recent changes**
  - Did something change that could cause this?
  - New code, config, or environment?
  - Git diff, recent commits

- [ ] **Identify the pattern**
  - Is this intermittent or consistent?
  - Does it happen at a specific step?
  - Are there similar working examples?

---

## Retry Strategy

### Before First Retry

1. Complete the Error Investigation Checklist
2. Identify the root cause
3. Fix the root cause if possible
4. **THEN** retry once

### After First Retry Failure

1. Was the root cause correct?
   - No → Re-investigate (you might have been wrong)
   - Yes → Why didn't the fix work?

2. Is there additional context needed?
   - Look at logs, debug output
   - Check system state
   - Verify assumptions

3. Try a different approach
   - Alternative solution?
   - Workaround available?
   - Different tool or method?

### After Multiple Retries (2-5)

1. **Count your retries**
   - Keep track of how many times you've tried
   - If you've lost count, that's bad → assume you're at 5

2. **Assess progress**
   - Is the error changing? (might be making progress)
   - Same error every time? (stuck, need new approach)
   - Getting worse? (stop immediately)

3. **At retry #5: STOP**
   - Don't attempt retry #6
   - Ask the user for guidance
   - Provide clear summary of what happened

---

## What to Tell the User After 5 Failed Retries

**Template:**

```
I've attempted [operation] 5 times and it continues to fail.

**What I'm trying to do:**
[Clear description of the goal]

**Error encountered:**
[Exact error message]

**What I've tried:**
1. [Attempt 1: what you did and why]
2. [Attempt 2: what you did and why]
3. [Attempt 3: what you did and why]
4. [Attempt 4: what you did and why]
5. [Attempt 5: what you did and why]

**My assessment:**
[What you think the root cause is]

**Options I can see:**
- [Option A: what it is and pros/cons]
- [Option B: what it is and pros/cons]

What would you like me to do?
```

---

## Special Cases

### Network/API Timeouts

- Root cause: Network issue, API down, rate limit
- Investigation: Check network status, API status page, rate limit headers
- Retry strategy: Exponential backoff (wait longer between retries)
- Still fails after 5: Ask user (API might be actually down, credentials wrong, etc.)

### File Not Found Errors

- Root cause: Wrong path, file not created, deleted, wrong directory
- Investigation: List directory contents, verify path, check if file exists elsewhere
- Retry strategy: Don't retry until you've fixed the path issue
- Still fails after 5: Ask user (file might not exist yet, wrong project, etc.)

### Permission Errors

- Root cause: Wrong user, missing permissions, read-only filesystem
- Investigation: Check user, permissions, filesystem status
- Retry strategy: Don't retry until permissions are fixed
- Still fails after 5: Ask user (needs sudo, file is owned by someone else, etc.)

### Test Failures

- Root cause: Code bug, test bug, environment issue, dependency problem
- Investigation: Read test output, check test code, check recent changes
- Retry strategy: Don't retry until you understand the failure
- Still fails after 5: Ask user (test might be flaky, requirements unclear, etc.)

---

## Red Flags - You're Doing It Wrong

If you catch yourself:
- Retrying without reading the error message
- "Let me just try again" (no investigation)
- Losing count of retries
- Same error 5+ times but still trying
- Hoping it will work "this time" (nothing changed)
- Not telling the user about repeated failures

**ALL of these mean: STOP. Follow this process.**

---

## Integration with Skills

This policy should be referenced as **Priority Rule #1** in all skills.

Each skill should:
1. Include this policy in full or by reference
2. Add skill-specific context for how the policy applies
3. Include examples relevant to the skill's domain

**For skills with existing error handling:**
- `systematic-debugging`: Already embodies the "investigate first" principle
- Just needs the 5-retry limit added
- Reference this policy for the retry limit

---

## Summary

```
1. Error occurs → STOP
2. Read error message → Understand what it says
3. Investigate root cause → WHY did it fail?
4. Fix root cause → Make retry worthwhile
5. Retry → Once, with confidence
6. Still fails? → Re-investigate, new approach
7. 5 failures? → ASK USER
```

**This is Priority Rule #1 for a reason:**
- It saves time
- It produces better results
- It prevents thrashing
- It communicates problems clearly
- It respects the user's time and resources

**Follow it. Always.**
