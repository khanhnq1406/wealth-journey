# Report Wallet Analytics Charts — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Move four dead-code wallet analytics charts from `home/` to `report/` and render them as a new "Wallet Analytics" section at the bottom of the report page.

**Spec:** `docs/specs/2026-03-09-report-wallet-charts-spec.md`

**Architecture:** This is a pure file-move + composition change. No new APIs, no new hooks, no backend changes. The four components (`Balance`, `AccountBalance`, `Dominance`, `MonthlyDominance`) already exist with their own data-fetching and internal year selectors via `ChartWrapper`. The report page gains `useQueryGetAvailableYears` at page level (React Query deduplicates the call already made in `ReportControls`).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS, Framer Motion, React Query

---

## Security Implementation Notes

- **Read-only feature:** No mutations, no user input beyond year selection (constrained to `availableYears` array from API).
- **Authorization:** All existing query hooks are JWT-scoped at the backend — no changes needed.
- **No new attack surface:** This is a display-only composition change on an already-authenticated page.

---

## C4 Architecture Diagram Updates

Per the spec, `docs/architecture/c4-component-frontend.md` needs a minor update: the `report` feature module gains 4 chart components. No new diagrams required.

---

## Tasks

---

### Task 1: Move Balance.tsx to report directory

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/report/Balance.tsx`
- Delete: `src/wj-client/app/[locale]/dashboard/home/Balance.tsx`

**Steps:**

1. Copy the exact content of `src/wj-client/app/[locale]/dashboard/home/Balance.tsx` to `src/wj-client/app/[locale]/dashboard/report/Balance.tsx`. No content changes needed — all imports use `@/` aliases which remain valid.

2. Delete `src/wj-client/app/[locale]/dashboard/home/Balance.tsx`.

3. Verify no other files import from the old path:
   ```bash
   grep -r "dashboard/home/Balance" src/wj-client/
   ```
   Expected: no results.

4. Commit:
   ```
   feat(report): move Balance chart component from home to report
   ```

---

### Task 2: Move AccountBalance.tsx to report directory

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/report/AccountBalance.tsx`
- Delete: `src/wj-client/app/[locale]/dashboard/home/AccountBalance.tsx`

**Steps:**

1. Copy the exact content of `src/wj-client/app/[locale]/dashboard/home/AccountBalance.tsx` to `src/wj-client/app/[locale]/dashboard/report/AccountBalance.tsx`. No content changes needed.

2. Delete `src/wj-client/app/[locale]/dashboard/home/AccountBalance.tsx`.

3. Verify no other files import from the old path:
   ```bash
   grep -r "dashboard/home/AccountBalance" src/wj-client/
   ```
   Expected: no results.

4. Commit:
   ```
   feat(report): move AccountBalance chart component from home to report
   ```

---

### Task 3: Move Dominance.tsx to report directory

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/report/Dominance.tsx`
- Delete: `src/wj-client/app/[locale]/dashboard/home/Dominance.tsx`

**Steps:**

1. Copy the exact content of `src/wj-client/app/[locale]/dashboard/home/Dominance.tsx` to `src/wj-client/app/[locale]/dashboard/report/Dominance.tsx`. No content changes needed.

2. Delete `src/wj-client/app/[locale]/dashboard/home/Dominance.tsx`.

3. Verify no other files import from the old path:
   ```bash
   grep -r "dashboard/home/Dominance" src/wj-client/
   ```
   Expected: no results.

4. Commit:
   ```
   feat(report): move Dominance chart component from home to report
   ```

---

### Task 4: Move MonthlyDominance.tsx to report directory

**Files:**
- Create: `src/wj-client/app/[locale]/dashboard/report/MonthlyDominance.tsx`
- Delete: `src/wj-client/app/[locale]/dashboard/home/MonthlyDominance.tsx`

**Steps:**

1. Copy the exact content of `src/wj-client/app/[locale]/dashboard/home/MonthlyDominance.tsx` to `src/wj-client/app/[locale]/dashboard/report/MonthlyDominance.tsx`. No content changes needed.

2. Delete `src/wj-client/app/[locale]/dashboard/home/MonthlyDominance.tsx`.

3. Verify no other files import from the old path:
   ```bash
   grep -r "dashboard/home/MonthlyDominance" src/wj-client/
   ```
   Expected: no results.

4. Commit:
   ```
   feat(report): move MonthlyDominance chart component from home to report
   ```

---

### Task 5: Add Wallet Analytics section to report page

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx`

**Depends on:** Tasks 1–4 (components must exist in report directory first)

**Steps:**

**Step 1:** Add imports at the top of `page.tsx`.

Add to the existing imports block:
```tsx
import { useQueryGetAvailableYears } from "@/utils/generated/hooks";
import { Balance } from "./Balance";
import { AccountBalance } from "./AccountBalance";
import { Dominance } from "./Dominance";
import { MonthlyDominance } from "./MonthlyDominance";
```

**Step 2:** Add `useQueryGetAvailableYears` call inside `ReportPageEnhanced` component, after the existing hooks (around line 141, after `useQueryListCategories`):

```tsx
// Fetch available years for wallet analytics charts
const { data: availableYearsData } = useQueryGetAvailableYears(
  {},
  { refetchOnMount: "always" },
);

const availableYears = availableYearsData?.years?.length
  ? availableYearsData.years
  : [new Date().getFullYear()];
```

**Step 3:** Add the Wallet Analytics section at the bottom of the returned JSX, after the Monthly Summary `motion.div` block (after line 682). Insert before the closing `</div>` of the root container:

```tsx
{/* Wallet Analytics Section */}
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: 0.5 }}
>
  <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
    Wallet Analytics
  </h2>
</motion.div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.6 }}
  >
    <BaseCard className="p-3 sm:p-4">
      <Balance availableYears={availableYears} />
    </BaseCard>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.7 }}
  >
    <BaseCard className="p-3 sm:p-4">
      <AccountBalance availableYears={availableYears} />
    </BaseCard>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.8 }}
  >
    <BaseCard className="p-3 sm:p-4">
      <Dominance availableYears={availableYears} />
    </BaseCard>
  </motion.div>

  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.9 }}
  >
    <BaseCard className="p-3 sm:p-4">
      <MonthlyDominance availableYears={availableYears} />
    </BaseCard>
  </motion.div>
</div>
```

**Step 4:** TypeScript check — run:
```bash
cd src/wj-client && npx tsc --noEmit
```
Fix any type errors before committing.

**Step 5:** Commit:
```
feat(report): add Wallet Analytics section with four charts
```

---

### Task 6: Update C4 frontend architecture diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Open `docs/architecture/c4-component-frontend.md`.
2. Find the entry for the report feature module or report page.
3. Add a note that the report page now includes 4 wallet analytics chart components: `Balance`, `AccountBalance`, `Dominance`, `MonthlyDominance` (moved from home directory).
4. Commit:
   ```
   docs(architecture): update C4 frontend diagram for wallet analytics charts in report
   ```

---

### Task 7: Write implementation report and progress file

**Files:**
- Create: `docs/reports/2026-03-09-report-wallet-charts-report.md`

**Steps:**

1. Verify all acceptance criteria from the spec are met:
   - [ ] All four files exist in `app/[locale]/dashboard/report/`
   - [ ] All four files are deleted from `app/[locale]/dashboard/home/`
   - [ ] No imports reference old home paths
   - [ ] "Wallet Analytics" heading is visible on report page
   - [ ] All four charts render
   - [ ] Each chart has its own independent year selector
   - [ ] `useQueryGetAvailableYears({})` called once at page level
   - [ ] `availableYears` derived with `[currentYear]` fallback
   - [ ] Passed as prop to all four components
   - [ ] Charts appear in order: Balance → AccountBalance → Dominance → MonthlyDominance
   - [ ] Responsive: 1-col mobile, 2-col desktop (lg:grid-cols-2 gap-4)
   - [ ] `motion.div` wrappers with delays 0.5 → 0.9
   - [ ] `BaseCard` with `p-3 sm:p-4`

2. Write the report file summarizing what was implemented.

---

## Task Execution Order

Tasks 1–4 are independent of each other and can be executed in parallel.
Task 5 depends on Tasks 1–4 (imports the moved components).
Task 6 is independent of all code tasks.
Task 7 is last (verifies everything).

```
[Task 1] ──┐
[Task 2] ──┤
[Task 3] ──┼──→ [Task 5] ──→ [Task 7]
[Task 4] ──┘
[Task 6] ─────────────────────────────→ (any time)
```
