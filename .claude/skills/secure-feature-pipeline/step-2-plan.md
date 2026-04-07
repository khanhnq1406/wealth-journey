# Step 2: Plan

**REMINDER: Do NOT call `EnterPlanMode`. Write the plan directly to `docs/plans/` using this skill's process below.**

**Input:** Spec file path from brainstorm step.

**Goal:** Create a detailed, bite-sized implementation plan with exact file paths, code, commands, and security considerations per task.

### Process

1. **Read the spec file completely**
2. **Explore codebase** — Identify exact files to create/modify
3. **Audit existing components (for frontend tasks)** — Run `Glob("src/wj-client/components/**/*.tsx")` and `Grep` for UI keywords matching the feature. Fill the "Component Reuse Inventory" table in the plan. Justify any new components.
4. **Break into tasks** — Each task is 2-5 minutes of work
5. **Order tasks** — Dependencies first, then parallel-safe tasks
6. **Write security notes per task** — What validation, authorization, or sanitization is needed
7. **Include C4 diagram updates** — Add a task for updating/creating architecture diagrams per the spec
8. **Include runtime flow diagram updates** — Add a task for creating/updating flow diagrams per the spec
9. **Write the plan file**

### GitNexus-Informed Task Ordering (if index available)

After breaking the feature into tasks, use GitNexus to validate ordering:

1. For each task's target files/symbols: `gitnexus_impact({target: "<symbol>", direction: "upstream"})` — identify d=1 dependents
2. Tasks that modify symbols with many upstream dependents should come AFTER tasks that modify leaf symbols
3. Add "Affected flows" to each task's notes in the plan — helps reviewers know what to regression-test

> This is additive — don't skip the existing task breakdown process. GitNexus refines ordering, it doesn't replace planning. If GitNexus is not indexed, skip this subsection.

### Plan File Structure

Save to: `docs/plans/YYYY-MM-DD-<feature>-plan.md`

```markdown
# [Feature Name] Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** [One sentence]
**Spec:** [Path to spec file]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]

## Security Implementation Notes

[Cross-cutting security concerns for the entire feature]

- Authentication: [how auth is handled]
- Authorization: [resource ownership checks]
- Input validation: [server-side validation strategy]
- Data sanitization: [XSS, injection prevention]

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| [e.g. BaseCard] | [e.g. components/cards/] | [e.g. Wrapping dashboard summary cards] |
| [e.g. FormNumberInput] | [e.g. components/forms/] | [e.g. Amount input in transfer form] |
| ... | ... | ... |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| [e.g. PriceChart] | [e.g. features/market-prices/components/] | Feature-specific; no existing chart fits XY price-over-time with tooltip |
| ... | ... | ... |

> **How to fill this table:** During Step 2 (Plan), run `Glob("src/wj-client/components/**/*.tsx")` and `Grep` for keywords matching the feature's UI needs. Read candidate component source to verify props/behavior. Only list a new component if no existing one fits — and explain why.

## C4 Architecture Diagram Updates

[Which diagrams to update/create, referencing spec's Architecture Changes section]

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md` (if backend changes)
- Modify: `docs/architecture/c4-component-frontend.md` (if frontend changes)
- Create: `docs/architecture/c4-code-<domain>.md` (if new complex domain)

**Steps:**

1. Update existing Mermaid diagrams with new components
2. Create L4 code diagram if needed (classDiagram with interfaces)
3. Commit diagram changes

---

### Task N-1: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-<domain>.md` (if updating existing flows)
- Create: `docs/architecture/flow-<domain>.md` (if new domain)

**Steps:**

1. Read the implemented service code to trace the actual runtime flow
2. Identify diagram type: `sequenceDiagram` for multi-participant flows, `flowchart TD` for branching logic, `stateDiagram-v2` for lifecycle flows
3. Write diagram with: trigger, endpoint, source file reference, error/alternative paths
4. Add "Key Invariants" section listing business rules maintained during the flow
5. Add "Error Paths" table (Condition | Response | Rollback)
6. Update `docs/architecture/README.md` if a new flow file was created (add to Dynamic Behavior Diagrams table)
7. Commit diagram changes

**When to skip:** Simple CRUD with no branching, no multi-service coordination, and no complex error handling.

---

### Task 1: [Component Name]

**Files:**

- Create: `exact/path/to/file`
- Modify: `exact/path/to/existing:line-range`
- Test: `exact/path/to/test`

**Security notes:** [Task-specific security concerns]

**Step 1: Write the failing test**
[Exact test code — test MUST be written BEFORE implementation]

**Step 2: Run test to verify it fails**
[Exact command with expected failure output]

**Step 3: Write minimal implementation**
[Exact implementation code to make the test pass]

**Step 4: Run test to verify it passes**
[Exact command with expected pass output]

**Step 5: [Additional steps if needed — validation, auth checks, etc.]**
[Exact code]

**Step N-1: Playwright E2E Audit** _(skip if backend-only task)_

- Identify pages affected by this task
- Update or add Playwright tests following patterns in `tests/e2e/`
- Do NOT run the tests
- Document new/updated spec files in report under `## Playwright E2E Results`

See `./implementer-prompt.md` for the full Playwright audit protocol.

**Step N: Commit**
```

### Frontend Task Template (For UI Tasks)

For tasks involving frontend/UI work, include these additional steps:

```markdown
### Task N: [Frontend Component/Page Name]

**Files:**

- Create: `exact/path/to/file`
- Modify: `exact/path/to/existing`

**Security notes:** [Task-specific security concerns]

**Step 0: Component inventory check (MANDATORY — run these commands)**

```bash
# 1. Scan all shared components
Glob("src/wj-client/components/**/*.tsx")

# 2. Search for keywords matching this task's UI needs
Grep("<keyword>") in src/wj-client/components/  # e.g. "card", "modal", "table", "spinner"

# 3. Check feature-level components
Glob("src/wj-client/features/<domain>/components/**/*.tsx")

# 4. Read source of any candidate match to verify props/behavior
```

- [ ] Ran Glob on `components/` and `features/<domain>/components/`
- [ ] Searched for keywords matching UI elements needed
- [ ] Read source of candidate components to verify fit
- [ ] Checked `components/icons/` and `lucide-react` for icons (not emojis)
- [ ] Checked `components/OptimizedImage.tsx` for image needs (OptimizedImage, Avatar)
- Reusing: [list components to reuse, with import path]
- Creating new: [list with justification — why no existing component fits]

**Step 1: Write the failing test**
[Component test with React Testing Library]

**Step 2-4: [Standard TDD steps]**

**Step 5: Responsive & accessibility check**

- Mobile (375px): [verify no horizontal scroll, touch targets >= 44px]
- Desktop (800px+): [verify sm: breakpoint layout]
- Images: Use `next/image` / `OptimizedImage` / `Avatar` (not plain `<img>`)
- Imports: Direct imports only (not barrel files)
- Performance: No async waterfalls, dynamic import for heavy components

**Step N-1: Playwright E2E Audit — write/update tests only, do NOT run** [per implementer-prompt.md]
**Step N: Commit**
```

**Required sub-skills for frontend tasks:**

- `ui-ux-pro-max` — Design system, accessibility, component patterns
- `responsive-design` — Mobile-first Tailwind, custom `sm:` breakpoint at 800px
- `react-best-practices` — Performance (waterfalls, bundle size, re-renders)

### Task Granularity (TDD Enforced)

**Every implementation task MUST follow TDD: test first, then implementation.**

Each step is one action (2-5 minutes):

1. "Write the failing test" — step (ALWAYS FIRST)
2. "Run it to make sure it fails" — step (VERIFY RED)
3. "Implement the minimal code to pass" — step (GREEN)
4. "Run the tests and verify they pass" — step (VERIFY GREEN)
5. "Add input validation" — step (with test)
6. "Add authorization check" — step (with test)
7. "Commit" — step

**Test requirements per layer:**

- **Backend service:** Unit test for business logic, edge cases, error paths
- **Backend handler:** Integration test for HTTP request/response, auth, validation
- **Frontend component:** Component test for rendering, user interaction, error states
- **Proto changes:** Verify generated code compiles (`task proto:all && go build ./...`)
- **Frontend UI changes:** E2E test written/updated in `tests/e2e/` using Playwright — do NOT run (see `./implementer-prompt.md`)

**Red flags:**

- Implementation step before test step = plan violation
- "Add tests" as a separate task at the end = NOT TDD
- Test that only checks happy path = insufficient coverage

### Security-Specific Tasks

**Always include dedicated tasks for:**

- Input validation (server-side, never trust client)
- Authorization checks (user owns resource)
- Rate limiting (if applicable)
- Error message sanitization (no internal details leaked)
- Audit logging (for financial operations)
