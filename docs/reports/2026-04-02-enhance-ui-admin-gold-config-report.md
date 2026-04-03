# Enhance UI Admin Gold Config — Implementation Report

## Summary

Added drag-and-drop reordering to the Admin Gold Config panel's two main tables (`AssetDisplayConfigTable` and `FetchCodeList`) and fixed a hardcoded tab label by adding the missing `goldConfig` i18n key. A new runtime flow diagram was also added to the architecture documentation. All changes are pure frontend — no backend, no proto, no new API endpoints.

## Spec Reference

`docs/specs/2026-04-02-enhance-ui-admin-gold-config-spec.md`

## Plan Reference

`docs/plans/2026-04-02-enhance-ui-admin-gold-config-plan.md`

## Tasks Completed

| #   | Task                                            | Status | Commit   | Files Changed                                                                                           |
| --- | ----------------------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------- |
| 1   | i18n — Add goldConfig tab key                   | Done   | 5465f11a | `messages/en/admin.json`, `messages/vi/admin.json`, `app/[locale]/dashboard/admin/page.tsx`             |
| 2   | AssetDisplayConfigTable — drag-and-drop reorder | Done   | 4d31841a | `features/admin/components/AssetDisplayConfigTable.tsx`                                                 |
| 3   | FetchCodeList — drag-and-drop priority reorder  | Done   | 34d2b5a2 | `features/admin/components/FetchCodeList.tsx`                                                           |
| 4   | Flow diagram update                             | Done   | de362fb9 | `docs/architecture/flow-cross-cutting.md`                                                               |

## Test Coverage Summary

| Layer             | Test File                                                                     | Tests    | Pass    | Coverage Area                                               |
| ----------------- | ----------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------- |
| Frontend (Task 1) | TypeScript compilation (`npx tsc --noEmit`)                                   | N/A      | 0 errors| i18n key exists and resolves correctly                      |
| Frontend (Task 2) | `features/admin/components/__tests__/AssetDisplayConfigTable.test.tsx`        | 9 total  | 8/8 pass (1 skipped pre-existing) | Render, toggle enabled, delete, query invalidation |
| Frontend (Task 3) | `features/admin/components/__tests__/FetchCodeList.test.tsx`                  | 21 total | 21/21 pass | Render by priority, add/delete, query invalidation, form logic |

## Security Implementation Summary

| Concern              | Implementation                                                                               | Verified |
| -------------------- | -------------------------------------------------------------------------------------------- | -------- |
| Admin authorization  | Backend enforces `AuthMiddleware + AdminMiddleware` — no change needed for frontend          | Yes      |
| Input validation     | No user-typed text submitted — only sequential integers computed from drag position           | Yes      |
| Data sanitization    | PUT body uses server-sourced `displayName`/`typeCode` + computed integer `displayOrder`/`priority` | Yes |
| Error handling       | `catch {}` shows generic `toast.error` — raw error object never forwarded to UI             | Yes      |
| No injection risk    | `Promise.all` map only sends numeric IDs and computed integers                               | Yes      |

## Review Results

### Spec Compliance

All 4 tasks passed Stage 1 (Spec Compliance) on first review pass:
- Task 1: `goldConfig` key added to both locale files; hardcoded label replaced with `t("page.tabs.goldConfig")`
- Task 2: `SortableList` integrated; `handleReorder` with `Promise.all`, 1-based `displayOrder`, both query invalidations; `MobileTable` code removed
- Task 3: `SortableList` integrated; `handleReorder` with `Promise.all`, `priority: index + 1`; `fc.priority` used for display; `ml-11` column header offset; toast keys verified in both locale files
- Task 4: Section 17 added with all required sequenceDiagram steps, key invariants, and error paths table

### Security Review

All 4 tasks passed Stage 2 (Security) on first review pass. No CRITICAL or HIGH severity issues found across any task.

### Code Quality

All 4 tasks passed Stage 3 (Code Quality). Reviewers noted:
- Task 2: Minor O(n²) pattern in `handleReorder` (uses `newOrder.find()` per item) — negligible at expected data scale, not a functional defect
- Task 2: Pre-existing lint warning at line 73 — not introduced by this change
- Task 3: Pre-existing toast key mismatch (`toast.createFailed` used for a fetch error) — pre-existing, out of scope

## Known Issues / Technical Debt

1. **`showInInvestment` toggle removed from AssetDisplayConfigTable rows** — the new `SortableList` renderItem does not include the `showInInvestment` toggle column that was present in the old `MobileTable`. This is per-spec (spec's renderItem template only includes the `enabled` toggle). The `handleToggleShowInInvestment` handler was retained for future use.

2. **No dedicated DnD unit tests** — DnD interaction is not unit-testable without a full PointerSensor/DnD environment (not available in jsdom). Existing tests confirm component renders correctly within `SortableList`. Manual E2E verification required per plan (no existing admin E2E spec).

3. **Pre-existing lint warnings** — 105 pre-existing warnings in auto-generated `gen/protobuf/v1/*.ts` files; `npm run lint -- --max-warnings=0` exits non-zero. Not introduced by this feature.

## Files Changed

### Modified
- `src/wj-client/messages/en/admin.json` — added `goldConfig: "Price Config"` to `admin.page.tabs`
- `src/wj-client/messages/vi/admin.json` — added `goldConfig: "Cấu hình giá"` to `admin.page.tabs`
- `src/wj-client/app/[locale]/dashboard/admin/page.tsx` — replaced hardcoded `"Gold Config"` with `t("page.tabs.goldConfig")`
- `src/wj-client/features/admin/components/AssetDisplayConfigTable.tsx` — added `SortableList` import, `isReordering` state, `handleReorder` callback, replaced `MobileTable` rendering with `SortableList`, removed unused `MobileTable`/`MobileColumnDef` imports and `columns` constant
- `src/wj-client/features/admin/components/FetchCodeList.tsx` — added `SortableList` import, `useCallback` import, `isReordering` state, `handleReorder` callback, replaced static rows with `SortableList` + `ml-11` column headers
- `docs/architecture/flow-cross-cutting.md` — added section 17 (Admin Drag-to-Reorder Batch Update) + ToC entry

## How to Test

### Unit & Integration Tests

```bash
# Frontend unit tests (Task 2)
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns=AssetDisplayConfigTable
# Expected: 8 passed, 1 skipped, 0 failed

# Frontend unit tests (Task 3)
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns=FetchCode
# Expected: 21 passed, 0 failed

# TypeScript compilation check
cd src/wj-client && npx tsc --noEmit
# Expected: 0 errors
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

Changed files and their dependents:
- `AssetDisplayConfigTable.tsx` — used by `AssetDisplayConfigForm.tsx` (rendered as a sub-component)
- `FetchCodeList.tsx` — used by `AssetDisplayConfigForm.tsx` (rendered in the edit modal)
- `admin/page.tsx` — page-level component, no upstream consumers
- `messages/en/admin.json`, `messages/vi/admin.json` — consumed by next-intl at runtime

### Manual Testing Steps

#### Scenario: Drag-to-reorder display configs (AssetDisplayConfigTable)
**Preconditions:** Logged in as admin user; at least 2 asset display configs exist
1. Navigate to `/dashboard/admin?tab=gold-config`
2. Verify: Each row shows a drag handle (≡) on the left
3. Drag a row to a new position → Expected: row moves to new position optimistically
4. Expected: loading overlay (pulse animation) appears on the list briefly
5. Expected: `toast.success("updated")` appears
6. Refresh page → Expected: new display order persists (server confirmed)

#### Scenario: Reorder failure (AssetDisplayConfigTable)
**Preconditions:** Admin logged in; network throttled or backend down
1. Navigate to `/dashboard/admin?tab=gold-config`
2. Drag a row to a new position
3. Expected: `toast.error("updateFailed")` appears
4. Expected: list reverts to original order (invalidateQueries re-fetches server state)

#### Scenario: Drag-to-reorder fetch codes (FetchCodeList)
**Preconditions:** Admin logged in; open edit modal for a display config with ≥ 2 fetch codes
1. Navigate to `/dashboard/admin?tab=gold-config` → click Edit on a config
2. Verify: Each fetch code row shows a drag handle (≡); column headers (Priority / Type Code / Actions) are aligned under content (not under handle)
3. Drag a fetch code to a new position → Expected: priority numbers update after save
4. Expected: `toast.success("updated")` appears

#### Scenario: Tab label i18n
**Preconditions:** Logged in as admin
1. Navigate to `/dashboard/admin`
2. Expected: Tab label shows "Price Config" (English) or "Cấu hình giá" (Vietnamese) — NOT "Gold Config"

#### Scenario: Mobile viewport
**Preconditions:** Mobile viewport (375px width)
1. Navigate to `/dashboard/admin?tab=gold-config`
2. Expected: No horizontal scroll; drag handles present; edit/delete buttons accessible (≥ 44px touch targets)
3. Verify: `flex-wrap` on rows prevents overflow on narrow screens

## Playwright E2E Results

No existing admin E2E spec — manual verification required. Per plan: "No existing E2E spec for admin page. Verify manually."

Playwright E2E test creation is deferred (no existing admin spec to base new tests on, and DnD automation is non-trivial). This is documented as known technical debt.

## Fix History

| Date       | Fix                                                                                                          | Severity | Commit |
| ---------- | ------------------------------------------------------------------------------------------------------------ | -------- | ------ |
| 2026-04-03 | FetchCodeList drag item jumps far on click — added `MeasuringStrategy.Always` to `SortableList` `DndContext` to fix coordinate offset inside modal with CSS `transform` | Minor    | TBD    |
