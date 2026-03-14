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

    ## Frontend/UI Tasks — Required Sub-Skills

    If this task involves any frontend or UI work, you MUST follow these skills FIRST before writing any code:

    1. **`ui-ux-pro-max` skill** — Design system, color palette, typography, accessibility rules, component patterns.
       Run the design system generator:
       ```bash
       python3 .claude/skills/ui-ux-pro-max/scripts/search.py "fintech dashboard [feature keywords]" --design-system --stack nextjs
       ```

    2. **`responsive-design` skill** — Mobile-first layout with Tailwind CSS.
       - Always start with mobile (unprefixed) styles, enhance at breakpoints
       - This app uses a **custom `sm:` breakpoint at 800px** (not the default 640px) — defined in `src/wj-client/tailwind.config.ts`
       - Use 2-3 breakpoints per property max
       - Touch targets must be ≥ 44×44px
       - No horizontal scroll on mobile

    3. **`react-best-practices` skill** — Performance optimization from Vercel Engineering.
       - Eliminate async waterfalls — use `Promise.all()` for independent fetches
       - Direct imports only — `import { Button } from "@/components/Button"` NOT from barrel files
       - Dynamic imports for heavy components — `next/dynamic` for charts, modals with heavy deps
       - Minimize re-renders — use `React.memo()`, primitive deps, derived state
       - Functional `setState` — `setState(prev => ({...prev, field: value}))`
       - `"use client"` only where needed — keep server components where possible

    ### Component Reuse (MANDATORY — Check Before Creating)

    **Before creating ANY new component, search the existing codebase:**

    1. **Shared components** (`components/`) — 29 subdirectories of reusable UI:
       - Cards: `BaseCard` | Buttons: `Button`, `FloatingActionButton` | Forms: `FormInput`, `FormSelect`, `FormNumberInput`, `FormDatePicker`, `FormToggle`, `FormTextarea`, `FormCreatableSelect`, `FormWizard` | Modals: `BaseModal`, `ConfirmationDialog`, `Success` | Tables: `MobileTable`, `TanStackTable`, `VirtualizedTransactionList` | Charts: `BarChart`, `LineChart`, `DonutChart`, `Sparkline` | Feedback: `EmptyState`, `ErrorState`, `Toast` | Loading: `LoadingSpinner`, `FullPageLoading`, `Skeleton` | Navigation: `BottomNav`, `ActiveLink`, `SidebarToggle`
    2. **Feature components** (`features/<domain>/components/`) — Feature-specific components
    3. **Icons** (`components/icons/`) — Comprehensive SVG library (actions, finance, navigation, ui)

    **Decision flow:**
    - Need a form field? → Use `components/forms/Form*` components
    - Need a modal? → Use `BaseModal` + component-level state pattern
    - Need an icon? → Use SVG from `components/icons/` (NEVER emojis)
    - Need a card layout? → Use `BaseCard`
    - Need loading/empty/error states? → Use `components/loading/` or `components/feedback/`
    - None of the above fit? → Create in `features/<domain>/components/` (feature-specific) or `components/<category>/` (shared across features)

    ### Image Handling (MANDATORY)

    **Use Next.js `<Image>` component via the project's wrappers:**

    | Use Case | Component | Import |
    |----------|-----------|--------|
    | **Static images** (logos, icons, hero) | `Image` from `next/image` | `import Image from "next/image"` |
    | **User avatars/profile photos** | `Avatar` from `OptimizedImage` | `import { Avatar } from "@/components/OptimizedImage"` |
    | **Any image needing blur/fallback** | `OptimizedImage` | `import { OptimizedImage } from "@/components/OptimizedImage"` |
    | **User-uploaded content** (unpredictable dims) | Plain `<img>` with `loading="lazy"` | Only when dimensions truly unknown |

    **`OptimizedImage` features:** blur placeholder, error fallback, responsive fill mode, quality control (default: 75).

    **`Avatar` pre-built sizes:** `xs` (24px), `sm` (32px), `md` (40px), `lg` (48px), `xl` (64px), `full` (100px).

    **Rules:**
    - Always set `width` + `height` OR use `fill` with a sized parent + `sizes` attribute
    - Use `priority` for above-the-fold hero images only
    - Use `alt` text for all meaningful images (empty `alt=""` for decorative only)
    - Landing page hero pattern: `width={0} sizes="100vw" className="w-full h-auto"`

    **Non-negotiable UI checklist before reporting back:**
    - [ ] Mobile layout works at 375px (no horizontal scroll, touch targets ≥ 44px)
    - [ ] Desktop layout works at 1024px+ (using `sm:` breakpoint at 800px)
    - [ ] Color contrast ≥ 4.5:1 for normal text
    - [ ] All interactive elements have `cursor-pointer`
    - [ ] No emojis used as icons (use SVG from `components/icons/`)
    - [ ] Hover/focus states visible
    - [ ] Images use `next/image` or `OptimizedImage`/`Avatar` (not plain `<img>` unless justified)
    - [ ] Direct imports used (not barrel file imports)
    - [ ] Existing shared components reused (not recreated)
    - [ ] No async waterfalls in data fetching

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

    ## Progress File — NOT Your Responsibility

    The orchestrator (not you) manages the progress file (`docs/reports/YYYY-MM-DD-<feature>-progress.md`).
    After you report back and all three reviews pass, the orchestrator will:
    1. Update the progress file with your task's status and commit hash
    2. Commit your changes + the progress file
    3. Show a summary to the user and wait for approval

    You do NOT need to read, write, or commit the progress file. Just do your task and report back.
```
