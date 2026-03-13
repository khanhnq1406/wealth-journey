# Playwright Testing Integration into Secure Feature Pipeline

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the `secure-feature-pipeline` skill's `implement` step so that, whenever a task includes UI changes, the implementer automatically audits existing Playwright E2E tests and creates or updates tests to cover the changed UI behaviour.

**Architecture:** This is a documentation/skill update — no production code changes. We modify the `implementer-prompt.md` template (used by every implementer agent) to embed a mandatory Playwright audit checklist. We also add a new standing task template to the skill's plan section so every UI-touching plan task includes explicit Playwright steps.

**Tech Stack:** Playwright (already installed), TypeScript, existing patterns in `src/wj-client/tests/e2e/`

---

## Background & Context

### Why this is needed

The `secure-feature-pipeline` skill dispatches implementer subagents to do the actual work. The implementers currently:

1. Write backend unit/integration tests (Go)
2. Write frontend component tests (Jest/RTL)
3. **Do NOT automatically check or update Playwright E2E tests**

Result: UI changes ship without E2E coverage being reviewed or updated.

### How E2E tests work in this project

**Location:** `src/wj-client/tests/e2e/` (5 spec files) and `src/wj-client/tests/integration/` (1 heavier integration test)

**Test runner:** Playwright — config at `src/wj-client/playwright.config.ts`
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12)
- Base URL: `http://localhost:3000`
- Run command: `cd src/wj-client && npx playwright test`
- Run single file: `cd src/wj-client && npx playwright test tests/e2e/view-portfolio-flow.spec.ts`

**Existing spec files and what they cover:**

| File | Coverage area |
|------|--------------|
| `tests/e2e/login-flow.spec.ts` | Auth pages, Google OAuth button, redirects, session persistence |
| `tests/e2e/create-wallet-flow.spec.ts` | Wallet list page, create modal, form fields, type badge |
| `tests/e2e/add-transaction-flow.spec.ts` | Transaction modal, form fields, validation, mobile touch targets |
| `tests/e2e/filter-transactions.spec.ts` | Filter controls, date/category/wallet/search filters, mobile collapsible |
| `tests/e2e/view-portfolio-flow.spec.ts` | Portfolio page, investment list, summary, add investment modal, mobile |
| `tests/integration/portfolio-calculations.test.ts` | PNL calculations, monetary formatting, responsive layout |

**Established test patterns** (every new test MUST follow these):

```typescript
// 1. API mocking in beforeEach — always mock auth/verify + relevant data endpoints
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/verify**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { email: "test@example.com", name: "Test User", picture: "",
                preferredCurrency: "VND", preferredLanguage: "en" },
      }),
    });
  });
  // Mock feature-specific endpoints
  await page.route("**/api/v1/<resource>**", (route) => {
    route.fulfill({ status: 200, contentType: "application/json",
                    body: JSON.stringify({ success: true, data: [...mockData] }) });
  });
  // Set auth token
  await page.goto("/auth/login");
  await page.evaluate(() => { localStorage.setItem("token", "mock-test-token"); });
});

// 2. Flexible selectors — never brittle single-class selectors
const button = page.locator("button").filter({ hasText: /add|new/i });

// 3. Graceful existence checks for optional elements
const cardCount = await cards.count();
if (cardCount > 0) { /* test card behaviour */ }

// 4. Mobile describe block
test.describe("Mobile <Feature> View", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  // ...
});

// 5. waitForLoadState before assertions
await page.waitForLoadState("networkidle");
```

**No page objects / no shared fixtures** — the project uses inline selectors with fallbacks. Keep this convention; don't introduce page objects unless the user explicitly asks.

---

## What the plan changes

### Two files to update in the skill

1. **`implementer-prompt.md`** — Add a mandatory "Playwright E2E Audit" section that every implementer subagent must complete when their task touches UI.

2. **`SKILL.md`** (plan step, Task template) — Add a standing sub-task format for Playwright work inside any UI-touching task.

### What the new implementer instructions say (the mental model)

When an implementer finishes a UI task, they must:

1. **Identify the affected page(s)** (from the plan's file list)
2. **Find the matching E2E spec** using the mapping table below
3. **Run the existing tests** to confirm nothing is broken
4. **Decide: update, add, or no-change**
   - If the UI element existed before and changed → update the relevant test
   - If the UI element is brand new → add a new test block
   - If the change is backend-only or purely styling (no new interactive elements, no new routes) → no E2E change needed; explicitly document why
5. **Run tests again** to confirm green

**Page → spec file mapping:**

| Page / Route | Spec file |
|---|---|
| `/auth/login`, `/auth/register` | `login-flow.spec.ts` |
| `/dashboard/wallets` | `create-wallet-flow.spec.ts` |
| `/dashboard/transaction` | `add-transaction-flow.spec.ts`, `filter-transactions.spec.ts` |
| `/dashboard/portfolio` | `view-portfolio-flow.spec.ts`, `portfolio-calculations.test.ts` |
| New page (no existing spec) | Create `tests/e2e/<feature>-flow.spec.ts` |
| Shared components used across pages | Update all relevant specs |

---

## Task Breakdown

---

### Task 1: Update `implementer-prompt.md` — add Playwright audit section

**Files:**
- Modify: `.claude/skills/secure-feature-pipeline/implementer-prompt.md`

**What to add:**

Read the current `implementer-prompt.md` first. Find the section that describes the "self-review" or "before reporting" checklist. Insert the following Playwright audit block **before** the final "Report format" section.

**Step 1: Read the file**

```bash
cat .claude/skills/secure-feature-pipeline/implementer-prompt.md
```

**Step 2: Locate the insertion point**

Find the line(s) that mention "self-review" or "before reporting" or the test summary requirement. Insert immediately before the report format section.

**Step 3: Insert this exact block**

```markdown
## Playwright E2E Audit (REQUIRED for any UI task)

> **When to run this:** Any task that creates or modifies a page, component, modal, form, or route. Skip only for pure backend tasks with zero frontend changes — and explicitly document why you skipped.

### Step 1 — Identify affected pages

List every route/page changed by this task. Example:
- `/dashboard/portfolio` — added "Set Price" tab to investment detail modal

### Step 2 — Find the matching spec file

Use this mapping:

| Page / Route | Spec file |
|---|---|
| `/auth/login`, `/auth/register` | `tests/e2e/login-flow.spec.ts` |
| `/dashboard/wallets` | `tests/e2e/create-wallet-flow.spec.ts` |
| `/dashboard/transaction` | `tests/e2e/add-transaction-flow.spec.ts`, `tests/e2e/filter-transactions.spec.ts` |
| `/dashboard/portfolio` | `tests/e2e/view-portfolio-flow.spec.ts`, `tests/integration/portfolio-calculations.test.ts` |
| New page (no existing spec) | Create `tests/e2e/<feature>-flow.spec.ts` |
| Shared component used across pages | Update all relevant specs |

All paths are relative to `src/wj-client/`.

### Step 3 — Run existing tests first (verify nothing broken)

```bash
cd src/wj-client
npx playwright test tests/e2e/<relevant-spec>.spec.ts --reporter=list
```

Expected: all tests pass (or skip — skips are OK). Any failure means the existing code is already broken — fix that first.

### Step 4 — Decide: update, add, or no-change

| Situation | Action |
|---|---|
| Changed an existing interactive element (button label, form field, modal title) | Update the test that covers it |
| Added a new interactive element (button, form, tab, modal) | Add a new `test()` block |
| Added a new page/route | Add a new `test.describe()` block (or new spec file) |
| Backend-only change OR pure CSS/style-only (no new elements, no new routes) | No change — document reason in report |

### Step 5 — Write or update the test

Follow the existing patterns:
- Mock `**/api/v1/auth/verify**` in `beforeEach`
- Mock the feature's API endpoint(s) with realistic response shape
- Set `localStorage.setItem("token", "mock-test-token")` in `beforeEach`
- Use flexible selectors: `locator("button").filter({ hasText: /pattern/i })`
- Use graceful existence checks: `if ((await element.count()) > 0) { ... }`
- Add a `Mobile <Feature> View` describe block with `test.use({ viewport: { width: 375, height: 667 } })`
- Call `await page.waitForLoadState("networkidle")` before assertions

**Do NOT:**
- Use `:has-text()` with multiple comma-separated strings (not valid Playwright CSS)
- Create page objects or shared fixtures (project uses inline selectors)
- Write tests that pass even when the feature is broken (weak assertions like `count >= 0`)

### Step 6 — Run tests again (verify green)

```bash
cd src/wj-client
npx playwright test tests/e2e/<relevant-spec>.spec.ts --reporter=list
```

All tests must pass before marking the task complete.

### Step 7 — Include Playwright results in your report

Add to your task report:

```
## Playwright E2E Results
- Spec file(s) updated: [list or "none — backend-only change"]
- Tests added: N
- Tests updated: N
- Run result: N passed, 0 failed
- Mobile coverage: yes / no
```
```

**Step 4: Commit**

```bash
git add .claude/skills/secure-feature-pipeline/implementer-prompt.md
git commit -m "docs(skill): add Playwright E2E audit step to implementer-prompt"
```

---

### Task 2: Update `SKILL.md` — embed Playwright sub-steps in the plan task template

**Files:**
- Modify: `.claude/skills/secure-feature-pipeline/SKILL.md`

**What to add:**

In SKILL.md's Step 2 (Plan) section, the Task template currently shows:

```markdown
**Step 1: Write the failing test**
**Step 2: Run test to verify it fails**
**Step 3: Write minimal implementation**
...
**Step N: Commit**
```

We need to add a Playwright sub-section into this template so that every plan generated from this skill automatically includes E2E steps for UI tasks.

**Step 1: Read the file**

Find the exact lines in SKILL.md that contain the `### Task N: [Component Name]` template block (around line 361–400 based on current content).

**Step 2: Find the insertion point**

Locate `**Step N: Commit**` in the Task template. Insert the following block immediately BEFORE the commit step:

```markdown
**Step N-1: Playwright E2E Audit** *(skip if backend-only task)*

- Identify pages affected by this task
- Run existing spec: `cd src/wj-client && npx playwright test tests/e2e/<spec>.spec.ts --reporter=list`
- Update or add Playwright tests following patterns in `tests/e2e/`
- Run again to confirm green
- Document result in report under `## Playwright E2E Results`

See `./implementer-prompt.md` for the full Playwright audit protocol.
```

**Step 3: Also add Playwright to the "Test requirements per layer" table**

Find the "Test requirements per layer" bullet list (around line 401–407):

```markdown
**Test requirements per layer:**
- **Backend service:** Unit test for business logic, edge cases, error paths
- **Backend handler:** Integration test for HTTP request/response, auth, validation
- **Frontend component:** Component test for rendering, user interaction, error states
- **Proto changes:** Verify generated code compiles (`task proto:all && go build ./...`)
```

Add one more bullet at the end:

```markdown
- **Frontend UI changes:** E2E test updated/added in `tests/e2e/` using Playwright (see `./implementer-prompt.md`)
```

**Step 4: Commit**

```bash
git add .claude/skills/secure-feature-pipeline/SKILL.md
git commit -m "docs(skill): embed Playwright E2E audit sub-steps in SKILL.md plan task template"
```

---

### Task 3: Validate by dry-running against an existing plan task

**Goal:** Confirm the new instructions are clear and complete by tracing through what an implementer would do for a known past UI task — without changing any production code.

**Files:**
- Read: `docs/plans/2026-03-08-v2-design-migration-plan.md` (or any recent plan with UI tasks)
- Read: `src/wj-client/tests/e2e/view-portfolio-flow.spec.ts`

**Step 1: Pick a representative UI task from a recent plan**

Read the v2-design-migration-plan or another recent plan. Find one task that:
- Modifies a page or component
- Has an existing E2E spec that would be affected

**Step 2: Trace through the new Playwright audit steps**

Walk through Steps 1–7 from the new implementer-prompt section for that hypothetical task:
1. Which pages are affected?
2. Which spec file maps to it?
3. What would need to be updated in the spec?
4. Would a new `test()` block be needed?
5. Would the mobile describe block need updating?

**Step 3: Document the dry-run result**

Write a short Markdown file at `docs/plans/2026-03-13-playwright-dry-run-validation.md`:

```markdown
# Playwright Audit Dry-Run Validation

**Task traced:** [task name from the plan]
**Plan file:** [path]

## Step 1 — Pages affected
[list]

## Step 2 — Matching spec files
[list]

## Step 3 — Existing tests to update
[list]

## Step 4 — New tests to add
[list]

## Step 5 — Mobile coverage needed?
[yes/no, reason]

## Conclusion
The new audit protocol is clear and actionable for this task. / Issues found: [describe]
```

**Step 4: Commit**

```bash
git add docs/plans/2026-03-13-playwright-dry-run-validation.md
git commit -m "docs(skill): dry-run validation of Playwright audit protocol"
```

---

## Quick Reference: Playwright Command Cheatsheet

The implementer-prompt update should make these visible. Include in the skills context:

```bash
# Run a single spec file
cd src/wj-client && npx playwright test tests/e2e/view-portfolio-flow.spec.ts --reporter=list

# Run all E2E tests
cd src/wj-client && npx playwright test --reporter=list

# Run in headed mode (see the browser)
cd src/wj-client && npx playwright test tests/e2e/<spec>.spec.ts --headed

# Run on a specific browser
cd src/wj-client && npx playwright test tests/e2e/<spec>.spec.ts --project=chromium

# Run mobile (Pixel 5)
cd src/wj-client && npx playwright test tests/e2e/<spec>.spec.ts --project="Mobile Chrome"

# Show last HTML report
cd src/wj-client && npx playwright show-report
```

---

## Testing This Plan

After implementing all three tasks:

1. Open `implementer-prompt.md` — confirm the Playwright audit section appears before the report format
2. Open `SKILL.md` — confirm the task template includes Playwright sub-step and the test layer bullet
3. Open `docs/plans/2026-03-13-playwright-dry-run-validation.md` — confirm the dry-run analysis is complete

No code changes, no tests to run — this is a documentation/skill update only.

---

## Out of Scope

- **No page objects**: Do not introduce a POM layer — the project deliberately uses inline selectors
- **No shared fixtures file**: Do not create a `fixtures.ts` — each spec is self-contained
- **No visual regression testing**: Screenshot diffing is not part of this plan
- **No new Playwright spec files**: This plan updates the process, not the existing specs themselves
- **No changes to `playwright.config.ts`**: Config is fine as-is

These could be follow-up plans if the user wants them.
