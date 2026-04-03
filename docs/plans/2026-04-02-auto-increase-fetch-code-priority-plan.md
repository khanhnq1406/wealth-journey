# Auto-Increment Priority & Display Order Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Auto-populate priority (fetch codes) and displayOrder (asset display configs) with `max + 1` when creating new entries, reducing admin friction.

**Spec:** `docs/specs/2026-04-02-auto-increase-fetch-code-priority-spec.md`

**Architecture:** Frontend-only changes to 3 existing components. No API, backend, database, or protobuf changes. Computed defaults use already-fetched React Query data.

**Tech Stack:** React 19, TypeScript 5, React Hook Form, React Query v5

## Security Implementation Notes

- Authentication: Unchanged — admin endpoints remain behind `AuthMiddleware` + `AdminMiddleware`
- Authorization: Unchanged — no new endpoints or data exposure
- Input validation: Unchanged — backend still validates `priority >= 0` and `displayOrder >= 0`
- Data sanitization: N/A — numeric values only, no user-generated text

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `FormNumberInput` | `components/forms/FormNumberInput.tsx` | Already used for both priority and displayOrder inputs |

**New components needed (with justification):**

None — all changes are inline logic within existing components.

## C4 Architecture Diagram Updates

None — no new components, services, or data flows per spec.

## Runtime Flow Diagram Updates

None — simple CRUD with no branching or multi-service coordination per spec.

---

### Task 1: Auto-increment fetch code priority in FetchCodeList

**Files:**

- Modify: `src/wj-client/features/admin/components/FetchCodeList.tsx`
- Test: `src/wj-client/features/admin/components/__tests__/FetchCodeList.test.tsx`

**Security notes:** No security concerns — local computation on already-fetched data.

**Step 1: Write the failing test**

Create test file that verifies:
- Priority input defaults to `max(existing priorities) + 1` when fetch codes exist
- Priority input defaults to `1` when no fetch codes exist
- Priority input resets to new `max + 1` after successful create (simulated via query data change)
- Admin can manually change the value

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="FetchCodeList" --no-coverage
```

**Step 3: Write minimal implementation**

In `FetchCodeList.tsx`:

1. Compute `nextPriority` from loaded fetch codes:
```typescript
const nextPriority = useMemo(() => {
  const codes = data?.fetchCodes ?? [];
  if (codes.length === 0) return 1;
  return Math.max(...codes.map((fc) => fc.priority)) + 1;
}, [data?.fetchCodes]);
```

2. Replace initial state `useState<number>(1)` with `useState<number>(1)` (keep as is — will sync via useEffect).

3. Add `useEffect` to sync `priorityInput` with `nextPriority` when data changes:
```typescript
useEffect(() => {
  setPriorityInput(nextPriority);
}, [nextPriority]);
```

4. Update the success callback to NOT reset to `1` — the `useEffect` handles it when query invalidates and refetches.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="FetchCodeList" --no-coverage
```

**Step 5: Commit**

```
feat(admin): auto-increment fetch code priority to max+1
```

---

### Task 2: Pass nextDisplayOrder from AssetDisplayConfigTable to form

**Files:**

- Modify: `src/wj-client/features/admin/components/AssetDisplayConfigTable.tsx`
- Modify: `src/wj-client/features/admin/components/AssetDisplayConfigForm.tsx`
- Test: `src/wj-client/features/admin/components/__tests__/AssetDisplayConfigForm.test.tsx`

**Security notes:** No security concerns — local computation on already-fetched data.

**Step 1: Write the failing test**

Create test that verifies:
- In create mode with `nextDisplayOrder` prop, displayOrder input pre-fills with that value
- In create mode without `nextDisplayOrder`, displayOrder defaults to `1`
- In edit mode, `nextDisplayOrder` is ignored — keeps `initialValues.displayOrder`
- Value recalculates when `nextDisplayOrder` prop changes (simulating asset type switch)

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="AssetDisplayConfigForm" --no-coverage
```

**Step 3: Write minimal implementation**

**AssetDisplayConfigForm.tsx:**

1. Add optional prop `nextDisplayOrder?: number` to `AssetDisplayConfigFormProps`:
```typescript
interface AssetDisplayConfigFormProps {
  // ... existing props
  nextDisplayOrder?: number;
}
```

2. In create mode default, use `nextDisplayOrder` instead of `0`:
```typescript
displayOrder: initialValues?.displayOrder ?? nextDisplayOrder ?? 1,
```

3. Add `useEffect` to update displayOrder when `nextDisplayOrder` changes (create mode only):
```typescript
useEffect(() => {
  if (mode === "create" && nextDisplayOrder !== undefined) {
    setValue("displayOrder", nextDisplayOrder);
  }
}, [nextDisplayOrder, mode, setValue]);
```

**AssetDisplayConfigTable.tsx:**

1. Compute `nextDisplayOrder` from configs:
```typescript
const nextDisplayOrder = useMemo(() => {
  if (!configs || configs.length === 0) return 1;
  return Math.max(...configs.map((c) => c.displayOrder)) + 1;
}, [configs]);
```

2. Pass to form in create mode:
```typescript
<AssetDisplayConfigForm
  mode="create"
  assetType={activeTab}
  existingCodes={configs.map((c) => c.typeCode)}
  nextDisplayOrder={nextDisplayOrder}
  onSuccess={handleModalSuccess}
/>
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="AssetDisplayConfigForm" --no-coverage
```

**Step 5: Commit**

```
feat(admin): auto-increment display config displayOrder to max+1
```

---

### Task 3: Update Kanban and write report

**Files:**

- Modify: `docs/obsidian/2026-04-02-auto-increase-fetch-code-priority.md`
- Modify: `docs/obsidian/Kanban Board.md`
- Create: `docs/reports/2026-04-02-auto-increase-fetch-code-priority-report.md`

**Steps:**

1. Update task note: add plan + report artifact links, set status to `Done`
2. Move Kanban entry to `## Done` column, mark `[x]`
3. Write implementation report with test results

**Step N: Commit**

```
docs(kanban): mark auto-increase-fetch-code-priority as Done
```
