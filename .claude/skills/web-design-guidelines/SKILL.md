---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
argument-hint: <file-or-pattern>
metadata:
  author: vercel
  version: "1.0.0"
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

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
Guidelines fetch failed: Network error retrieving guidelines

Investigation:
- Checked network connectivity
- Root cause: Source URL temporarily unreachable

Fix: Use cached guidelines or ask user to provide URL
```
</Good>

<Bad>
```
Guidelines fetch failed
Retrying fetch... failed
Retrying fetch... failed
```
</Bad>

**See:** [shared-error-handling.md](../shared-error-handling.md) for complete guidance.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
