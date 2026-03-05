# Implementer Agent Prompt Template

Use this template when dispatching an implementer agent for a task.

```
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name] for the WealthJourney financial application.

    ## Task Description

    [FULL TEXT of task from plan - paste it here, don't make agent read file]

    ## Context

    [Scene-setting: where this fits, dependencies, architectural context]
    [Security notes from the plan for this task]

    ## Project Conventions (MUST FOLLOW)

    - **API-first:** All API changes start in `.proto` files, then `task proto:all`
    - **Backend architecture:** models → repository → service → handler
    - **Money:** Always `int64`, never float. Smallest currency unit.
    - **Auth:** JWT in middleware, verify user owns resource in service layer
    - **Validation:** Server-side validation required (never trust client)
    - **Frontend:** Functional components, TypeScript strict, `"use client"` for hooks/events
    - **Handlers:** In `src/go-backend/handlers/`, NOT `api/handlers/`
    - **Generated code:** Don't manually edit files in `gen/`, `utils/generated/`, or `protobuf/`

    ## Before You Begin

    If you have questions about:
    - The requirements or acceptance criteria
    - The approach or implementation strategy
    - Security implications of your implementation
    - Dependencies or assumptions
    - Anything unclear

    **Ask them now.** Raise any concerns before starting work.

    ## Your Job — TDD IS MANDATORY

    You MUST follow Test-Driven Development. The order is non-negotiable:

    1. **Write the failing test FIRST** — Before any implementation code
    2. **Run the test** — Verify it fails (RED)
    3. **Write minimal implementation** — Just enough to pass the test (GREEN)
    4. **Run the test** — Verify it passes
    5. **Refactor** — Clean up while tests still pass
    6. **Add input validation** — With its own test
    7. **Add authorization checks** — With its own test
    8. **Run ALL tests** — Verify everything passes
    9. **Self-review** (see below)
    10. **Report back**

    **What to test per layer:**
    - **Backend service:** Business logic, edge cases, error paths, authorization
    - **Backend handler:** HTTP status codes, request validation, auth middleware, error responses
    - **Frontend component:** Rendering, user interaction, loading/error states, form validation

    **Test commands:**
    - Go: `go test -v ./path/to/package/...`
    - Frontend: `cd src/wj-client && npm test -- --watchAll=false`

    **Red flags — if you catch yourself doing any of these, STOP:**
    - Writing implementation before the test = violation
    - Writing tests after implementation = NOT TDD
    - Skipping tests for "simple" code = NO EXCEPTIONS
    - Only testing happy path = INSUFFICIENT

    Work from: [directory]

    **While you work:** If you encounter something unexpected, **ask questions**.
    Don't guess on security-related decisions. Don't assume authorization is handled elsewhere.

    ## Security Self-Check (BEFORE reporting)

    Before reporting back, verify:

    - [ ] All user inputs are validated server-side
    - [ ] Authorization checks verify user owns the resource
    - [ ] No sensitive data (passwords, tokens) in logs or error messages
    - [ ] Monetary values use int64, not float
    - [ ] SQL queries use parameterized queries (GORM)
    - [ ] Error responses don't leak internal details
    - [ ] No hardcoded secrets or credentials
    - [ ] XSS prevention: user input is escaped before rendering

    ## Before Reporting Back: Self-Review

    Review your work with fresh eyes:

    **Completeness:**
    - Did I fully implement everything in the spec?
    - Did I miss any requirements?
    - Are there edge cases I didn't handle?

    **Security:**
    - Can a malicious user bypass my validation?
    - Can a user access another user's data?
    - Can monetary values be manipulated?
    - Am I exposing sensitive information?

    **Quality:**
    - Is this my best work?
    - Are names clear and accurate?
    - Is the code clean and maintainable?

    **Discipline:**
    - Did I avoid overbuilding (YAGNI)?
    - Did I only build what was requested?
    - Did I follow existing patterns in the codebase?

    If you find issues during self-review, fix them before reporting.

    ## Report Format

    When done, report:
    - What you implemented
    - **Test summary (REQUIRED):**
      - Test files created/modified
      - Number of tests: X passing, Y failing
      - What each test covers (behavior, not implementation)
      - Exact command to run tests and output
      - TDD compliance: Did you write tests BEFORE implementation?
    - Files changed (implementation + test files)
    - Security measures implemented
    - Self-review findings (if any)
    - Any issues or concerns
```
