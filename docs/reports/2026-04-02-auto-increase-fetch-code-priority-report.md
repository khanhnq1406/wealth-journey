# Auto-Increment Priority & Display Order — Implementation Report

## Summary

Added auto-increment UX to two admin forms: `FetchCodeList` now pre-fills the priority input with `max(existing priorities) + 1`, and `AssetDisplayConfigForm` now pre-fills the displayOrder input with `max(existing displayOrders) + 1` (passed via a new optional `nextDisplayOrder` prop from the table). In both cases the admin can still manually override the suggested value. Frontend-only changes — no API, backend, database, or protobuf modifications.

## Spec Reference

`docs/specs/2026-04-02-auto-increase-fetch-code-priority-spec.md`

## Plan Reference

`docs/plans/2026-04-02-auto-increase-fetch-code-priority-plan.md`

## Tasks Completed

| #   | Task                                                | Status | Files Changed                                                                                     | Tests        | TDD |
| --- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- | ------------ | --- |
| 1   | Auto-increment fetch code priority in FetchCodeList | Done   | `FetchCodeList.tsx`, `__tests__/FetchCodeList.test.tsx`                                           | 21/21 pass   | Yes |
| 2   | Pass nextDisplayOrder from Table to Form            | Done   | `AssetDisplayConfigForm.tsx`, `AssetDisplayConfigTable.tsx`, `__tests__/AssetDisplayConfigForm.test.tsx` | 14/14 pass | Yes |
| 3   | Update Kanban and write report                      | Done   | `docs/obsidian/2026-04-02-auto-increase-fetch-code-priority.md`, `docs/obsidian/Kanban Board.md`, this file | N/A | N/A |

## Test Coverage Summary

| Layer              | Test File                                            | Tests | Pass  | Coverage Area                                                              |
| ------------------ | ---------------------------------------------------- | ----- | ----- | -------------------------------------------------------------------------- |
| Frontend Component | `__tests__/FetchCodeList.test.tsx`                   | 21    | 21/21 | Priority auto-fill from max+1, empty-list fallback, manual override, post-refetch reset |
| Frontend Component | `__tests__/AssetDisplayConfigForm.test.tsx`          | 14    | 14/14 | DisplayOrder pre-fill from prop, no-prop fallback, edit-mode isolation, prop-change sync |

## Security Implementation Summary

| Concern          | Implementation                                  | Verified |
| ---------------- | ----------------------------------------------- | -------- |
| Input validation | Backend still validates priority/displayOrder ≥ 0; unchanged | Yes |
| Authorization    | Admin endpoints unchanged; no new data exposure | Yes |
| Data integrity   | Integer arithmetic only; `Math.max()` safe for integer fields | Yes |
| XSS              | Numeric controlled inputs; React escapes by default | Yes |

## Review Results

### Spec Compliance

Both tasks passed Stage 1. All four test scenarios specified in the plan were implemented and verified in actual code (not just the report). Edit-mode isolation correctly verified via test and code inspection.

### Security Review

Both tasks passed Stage 2 (APPROVED). All changes are local integer computations on already-fetched admin data. No new API calls, no new data exposure, no security surface introduced.

### Code Quality

Both tasks passed Stage 3 (APPROVED). Key strengths noted by reviewers:
- `useMemo`/`useEffect` separation is correct (pure derived value vs. state sync side-effect)
- Correct `Math.max()` guard for empty arrays (return `1` before calling `Math.max`)
- `useEffect` uses `setValue` (not `reset`) to avoid wiping other user-typed form fields
- `defaultValues` + `useEffect` pattern prevents a one-tick delay on initial render
- Dependency arrays on both `useMemo` and `useEffect` are minimal and correct

## Known Issues / Technical Debt

None. The pre-existing `console.error` about `act()` in `AssetDisplayConfigForm` tests is caused by `FormNumberInput`'s `queueMicrotask` pattern (introduced before this feature) and does not affect test correctness.

## Fix History

| Date       | Fix                                                       | Severity | Tests        |
| ---------- | --------------------------------------------------------- | -------- | ------------ |
| 2026-04-03 | Add "Currency" to asset type selector in create form; fix displayOrder not updating when switching asset type inside the form | Minor | 19/19 pass |

### Fix 2026-04-03 — Details

**Issues fixed:**
1. Asset type toggle in create form only showed Gold and Silver — Currency was missing. Fixed by adding `"currency"` to the `["gold", "silver", "currency"]` array in `AssetDisplayConfigForm.tsx`.
2. `displayOrder` did not update when switching from Gold → Silver → Currency inside the create form. Root cause: `nextDisplayOrder` was computed by the parent (`AssetDisplayConfigTable`) based on its `activeTab`, which doesn't change when the user switches types inside the form. Fixed by adding an internal `useQuery` inside `AssetDisplayConfigForm` (create mode only) that fetches configs for the currently `selectedAssetType` and computes `max(displayOrders) + 1` via `useMemo`. The query uses the same React Query cache key as the table, so no redundant network calls when that type was already loaded.

**Files changed:**
- `src/wj-client/features/admin/components/AssetDisplayConfigForm.tsx` — add `"currency"` to type array; add `useQuery` + `useMemo` for per-type `computedNextDisplayOrder`; replace prop-driven `useEffect` with computed-value-driven one
- `src/wj-client/features/admin/components/__tests__/AssetDisplayConfigForm.test.tsx` — update existing `nextDisplayOrder` prop tests to use `mockGet`; add 4 new tests (currency pill, currency submission, displayOrder updates on type switch, empty-list fallback)

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/features/admin/components/FetchCodeList.tsx` | Added `useMemo` for `nextPriority` + `useEffect` to sync `priorityInput`; removed redundant `setPriorityInput(1)` from `onSuccess` |
| `src/wj-client/features/admin/components/__tests__/FetchCodeList.test.tsx` | Added 4 new tests for priority auto-increment behavior |
| `src/wj-client/features/admin/components/AssetDisplayConfigForm.tsx` | Added `nextDisplayOrder?: number` prop; updated `defaultValues`; added `useEffect` for create-mode sync |
| `src/wj-client/features/admin/components/AssetDisplayConfigTable.tsx` | Added `useMemo` for `nextDisplayOrder`; passed to create-mode form |
| `src/wj-client/features/admin/components/__tests__/AssetDisplayConfigForm.test.tsx` | Added 4 new tests for displayOrder auto-fill behavior |
| `docs/obsidian/2026-04-02-auto-increase-fetch-code-priority.md` | Updated status to Done; added progress + report artifact links |
| `docs/obsidian/Kanban Board.md` | Moved entry from Plan to Done column |
| `docs/reports/2026-04-02-auto-increase-fetch-code-priority-progress.md` | Progress tracking file |

## How to Test

### Unit & Integration Tests

```bash
# FetchCodeList tests (21 tests)
cd src/wj-client && npx jest --testPathPattern="FetchCodeList" --no-coverage

# AssetDisplayConfigForm tests (14 tests)
cd src/wj-client && npx jest --testPathPattern="AssetDisplayConfigForm" --no-coverage

# All frontend tests
cd src/wj-client && npm test -- --watchAll=false
```

### Dependency Impact Verification

GitNexus not available — manual blast radius review performed. Both tasks modify leaf-level admin components with no downstream consumers outside the admin feature module.

### Manual Testing Steps

**Preconditions:** Logged in as admin user. Navigate to `/dashboard/admin`.

#### Scenario: Fetch code priority auto-increment (Gold tab)

1. Click the Gold tab → open any display config's fetch code list
2. Expected: the "Add Fetch Code" form's priority input shows `max(existing priorities) + 1`
3. Add a new fetch code without changing priority → Expected: fetch code created with auto-suggested priority
4. Open the form again → Expected: priority input shows the new max+1 (updated after refetch)

#### Scenario: Fetch code priority — empty list

1. Open a display config that has no fetch codes
2. Expected: priority input defaults to `1`

#### Scenario: Manual priority override

1. Open a display config with fetch codes (e.g., max priority = 3)
2. Auto-suggested value: `4`
3. Change priority input to `10`
4. Submit
5. Expected: fetch code created with priority `10` (backend validates ≥ 0; accepted)

#### Scenario: Display config displayOrder auto-increment

1. Navigate to Admin → Gold tab
2. Click "Add Config" to open the create form
3. Expected: displayOrder input pre-fills with `max(existing displayOrders) + 1`
4. Save → Expected: config created with that order value

#### Scenario: Display config displayOrder — edit mode

1. Click edit on any existing display config
2. Expected: displayOrder shows the existing value, NOT the auto-incremented suggestion

#### Scenario: Display config displayOrder — switch asset type

1. Be on the Gold tab with the create form open, displayOrder pre-filled as `max_gold + 1`
2. Switch to Silver tab
3. Expected: displayOrder updates to `max_silver + 1`

#### Scenario: Empty configs list

1. Be on a tab with no existing display configs
2. Open the create form
3. Expected: displayOrder defaults to `1`
