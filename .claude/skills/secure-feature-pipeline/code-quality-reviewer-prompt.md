# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer agent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable).

**Only dispatch after BOTH spec compliance AND security review pass.**

```
Task tool (general-purpose):
  description: "Code quality review for Task N"
  prompt: |
    You are reviewing code quality for the WealthJourney financial application.

    ## What Was Implemented

    [From implementer's report — summary of changes]

    ## Files Changed

    [List of all changed files]

    ## Your Job

    Read ALL changed files and evaluate code quality.

    ### Code Structure
    - [ ] Follows existing codebase patterns (DDD: model → repo → service → handler)
    - [ ] Proper separation of concerns
    - [ ] No business logic in handlers (belongs in service layer)
    - [ ] No direct DB access in handlers (goes through repository)

    ### Code Clarity
    - [ ] Variable and function names are clear and accurate
    - [ ] No dead code or commented-out code
    - [ ] Complex logic has clear comments explaining WHY (not what)
    - [ ] Functions are focused and not too long

    ### TypeScript/React Quality (Frontend)
    - [ ] Proper TypeScript types (minimal `any` usage)
    - [ ] "use client" directive where needed
    - [ ] React hooks follow rules of hooks
    - [ ] No unnecessary re-renders (proper memoization if needed)
    - [ ] Proper error/loading state handling

    ### Frontend Best Practices (react-best-practices + responsive-design)
    - [ ] **Images**: Uses `next/image`, `OptimizedImage`, or `Avatar` — NOT plain `<img>` (unless user-uploaded content with unpredictable dimensions)
    - [ ] **Imports**: Direct imports (`import { Button } from "@/components/Button"`) — NOT barrel file imports
    - [ ] **Component reuse**: Shared components from `components/` reused (not recreated) — BaseCard, Button, Form*, Modal, etc.
    - [ ] **Icons**: SVG from `components/icons/` — NOT emojis
    - [ ] **Responsive**: Mobile-first styles (unprefixed = mobile), `sm:` breakpoint at 800px, 2-3 breakpoints max per property
    - [ ] **Touch targets**: >= 44x44px on mobile, `cursor-pointer` on interactive elements
    - [ ] **No async waterfalls**: Independent fetches use `Promise.all()`, not sequential await
    - [ ] **Dynamic imports**: Heavy components (charts, large modals) use `next/dynamic`
    - [ ] **Feature modules**: Feature-specific code in `features/<domain>/` — no cross-feature imports
    - [ ] **Contrast**: Text contrast >= 4.5:1, hover/focus states visible

    ### Go Quality (Backend)
    - [ ] Error handling first (early returns)
    - [ ] Context propagation
    - [ ] Proper use of GORM (no raw SQL without reason)
    - [ ] Resource cleanup (defer for close operations)

    ### Testing
    - [ ] Tests actually verify behavior (not just coverage)
    - [ ] Edge cases covered
    - [ ] Test names describe the behavior being tested
    - [ ] No flaky test patterns

    ### Performance
    - [ ] No N+1 queries (use GORM Preload)
    - [ ] Pagination for list operations
    - [ ] Appropriate caching usage
    - [ ] No unnecessary API calls from frontend

    ### Maintainability
    - [ ] DRY (no copy-paste duplication)
    - [ ] YAGNI (nothing over-engineered)
    - [ ] Changes are backwards compatible (or migration provided)

    ## Report Format

    **Strengths:**
    [What was done well]

    **Issues:**
    - Critical: [must fix — bugs, data integrity risks]
    - Important: [should fix — code quality, patterns]
    - Minor: [nice to fix — style, naming]

    **Verdict: [APPROVED / NEEDS CHANGES]**
```
