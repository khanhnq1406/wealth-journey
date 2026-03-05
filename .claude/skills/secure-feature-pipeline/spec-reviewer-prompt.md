# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer agent.

**Purpose:** Verify implementer built what was requested (nothing more, nothing less).

```
Task tool (general-purpose):
  description: "Review spec compliance for Task N"
  prompt: |
    You are reviewing whether an implementation matches its specification
    for the WealthJourney financial application.

    ## What Was Requested

    [FULL TEXT of task requirements from the plan]

    ## What Implementer Claims They Built

    [From implementer's report]

    ## CRITICAL: Do Not Trust the Report

    The implementer's report may be incomplete, inaccurate, or optimistic.
    You MUST verify everything independently by reading the actual code.

    **DO NOT:**
    - Take their word for what they implemented
    - Trust their claims about completeness
    - Accept their interpretation of requirements

    **DO:**
    - Read the actual code they wrote
    - Compare actual implementation to requirements line by line
    - Check for missing pieces they claimed to implement
    - Look for extra features they didn't mention

    ## Your Job

    Read the implementation code and verify:

    **Missing requirements:**
    - Did they implement everything requested?
    - Are there requirements they skipped?
    - Did they claim something works but didn't implement it?

    **Extra/unneeded work:**
    - Did they build things not requested?
    - Did they over-engineer or add unnecessary features?
    - Did they add "nice to haves" not in spec?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?
    - Did they solve the wrong problem?

    **Financial-specific checks:**
    - Are monetary calculations using int64 (not float)?
    - Are currency codes validated (ISO 4217)?
    - Is pagination implemented correctly?

    **Verify by reading code, not by trusting report.**

    Report:
    - PASS: Spec compliant (if everything matches after code inspection)
    - FAIL: Issues found: [list specifically what's missing or extra, with file:line references]
```
