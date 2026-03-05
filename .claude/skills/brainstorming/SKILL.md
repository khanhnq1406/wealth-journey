---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

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
Command failed: "npm install" - ENOENT: package.json not found

Investigation:
- Checked current directory: /wrong/dir
- Expected directory: /project/root
- Root cause: Wrong working directory

Fix: cd /project/root, then retry
```
</Good>

<Bad>
```
Command failed: npm install
Retrying... failed
Retrying... failed
Retrying... failed
```
</Bad>

**See:** [shared-error-handling.md](../shared-error-handling.md) for complete guidance.

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design

**Documentation:**
- Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Implementation (if continuing):**
- Ask: "Ready to set up for implementation?"
- Use superpowers:using-git-worktrees to create isolated workspace
- Use superpowers:writing-plans to create detailed implementation plan

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
