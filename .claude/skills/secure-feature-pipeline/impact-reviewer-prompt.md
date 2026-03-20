# Dependency Impact Reviewer Prompt Template

Use this template when dispatching a dependency impact reviewer agent during Step 4.

**Purpose:** Verify that all code dependencies affected by the implementation are accounted for — no missed callers, no untested affected flows, no unexpected blast radius.

**Only dispatch when GitNexus index is available.** If GitNexus is not indexed, skip this review and mark the Dependency Impact verdict as "SKIPPED — no GitNexus index."

```
Task tool (general-purpose):
  description: "Dependency impact review for [feature name]"
  prompt: |
    You are a dependency impact reviewer for the WealthJourney personal finance application.
    Your job is to verify that the blast radius of the implementation is fully understood
    and covered by tests.

    ## What Was Implemented

    [From implementer's report — summary of changes]

    ## Files Changed

    [List of all changed files — implementation + test files]

    ## Your Job

    Use GitNexus tools to map the full blast radius and verify coverage.

    ### Phase 1: Map Changed Symbols

    1. Read ALL changed files to identify every function, method, type, or interface
       that was added, modified, or removed.
    2. Run `gitnexus_detect_changes({scope: "staged"})` to get the automated change map.
    3. Compare your manual list with the automated list — flag any discrepancies.

    ### Phase 2: Blast Radius Analysis

    For each changed symbol identified in Phase 1:

    1. Run `gitnexus_impact({target: "<symbol>", direction: "upstream"})` to find:
       - **d=1 dependents** (WILL BREAK if the symbol's contract changes)
       - **d=2 dependents** (LIKELY AFFECTED — transitive callers)
    2. Run `gitnexus_context({name: "<symbol>"})` to see the full caller/callee graph.
    3. Record the results in the analysis table (see report format below).

    ### Phase 3: Test Coverage Cross-Reference

    For each d=1 dependent identified in Phase 2:

    1. Check if there is a test that exercises the dependent's interaction with the
       changed symbol.
    2. If the dependent is a handler → check for handler/E2E tests.
    3. If the dependent is a service → check for service unit tests.
    4. If the dependent is a frontend component → check for component/E2E tests.
    5. Flag any d=1 dependents that have NO test coverage for the changed interaction.

    ### Phase 4: Risk Assessment

    Classify each finding:

    - **CRITICAL** — d=1 dependent with no test coverage AND the change modified
      the symbol's contract (signature, return type, behavior)
    - **HIGH** — d=1 dependent with no test coverage but the change is
      backwards-compatible
    - **MEDIUM** — d=2 dependent with no test coverage on a non-trivial flow
    - **LOW** — d=2 dependent that is unlikely to be affected (e.g., only uses
      an unmodified field)

    ## Report Format

    ```markdown
    ## Dependency Impact Review

    ### Changed Symbols

    | Symbol | File | Change Type | d=1 Dependents | d=2 Dependents |
    |---|---|---|---|---|
    | [function/type name] | [file path] | added/modified/removed | [count] | [count] |

    ### Blast Radius Detail

    | Changed Symbol | Dependent | Distance | Has Test? | Risk | Notes |
    |---|---|---|---|---|---|
    | [symbol] | [caller/consumer] | d=1 / d=2 | Yes/No | CRIT/HIGH/MED/LOW | [explanation] |

    ### Untested Affected Flows

    [List of execution flows that are affected by the changes but have no
    corresponding test coverage. For each, explain what could break and
    suggest what test to add.]

    ### Missed Callers Check

    [Were any d=1 callers of changed symbols NOT updated by the implementation?
    If yes, list them with file:line references and explain the risk.]

    ### Verdict: [PASS / FAIL]

    **PASS criteria (ALL must be true):**
    - No CRITICAL findings
    - No HIGH findings (or all HIGH findings have documented justification)
    - All d=1 dependents of contract-breaking changes have test coverage
    - No missed callers that need updating

    **If FAIL:** List specific issues with severity and recommended fixes.
    ```

    ## Important Notes

    - This review is additive — it does NOT replace spec compliance, security,
      or code quality reviews.
    - Focus on dependencies and blast radius, not code style or security.
    - If a d=1 dependent is in generated code (protobuf, hooks), note it but
      don't flag it as untested — generated code is validated by the generation
      process.
    - If GitNexus returns no results for a symbol, note "symbol not indexed"
      and fall back to manual grep-based analysis for that symbol.
```
