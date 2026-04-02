# Auto-Increment Priority & Display Order Specification

## Summary

When an admin adds a new fetch code to an asset display config, or creates a new asset display config, the priority/display-order field should auto-populate with the next available value (current max + 1). This reduces friction and prevents accidental duplicate or conflicting values. The admin can still manually override the suggested value.

## User Stories

- As an admin, I want the fetch code priority to auto-increment when I add a new fetch code, so that I don't have to manually count existing priorities each time.
- As an admin, I want the display order to auto-increment when I create a new asset display config, so that new configs are appended at the end by default.
- As an admin, I want to override the auto-suggested value when I need a specific ordering.

## Functional Requirements

### FR-1: Auto-Increment Fetch Code Priority

When the admin opens the "Add Fetch Code" form within `FetchCodeList`, the priority input should auto-populate with `max(existing priorities) + 1`. If no fetch codes exist yet, default to `1`.

**Acceptance criteria:**

- [ ] Priority input pre-fills with `max(priority) + 1` from currently loaded fetch codes
- [ ] If no fetch codes exist, defaults to `1`
- [ ] Admin can manually change the value before submitting
- [ ] Auto-suggested value updates when fetch codes list changes (e.g., after adding/deleting)

### FR-2: Auto-Increment Display Config Display Order

When the admin opens the "Create" form for a new asset display config, the display order input should auto-populate with `max(existing displayOrder for that asset type) + 1`. If no configs exist for that asset type, default to `1`.

**Acceptance criteria:**

- [ ] Display order input pre-fills with `max(displayOrder) + 1` from existing configs of the same asset type
- [ ] If no configs exist for the selected asset type, defaults to `1`
- [ ] Admin can manually change the value before submitting
- [ ] When switching asset type in create mode (gold/silver/currency toggle), the auto-suggested value recalculates based on the newly selected asset type's existing configs
- [ ] Edit mode is unaffected — keeps the existing value

## Non-Functional Requirements

- Performance: No additional API calls needed — uses already-fetched data from existing queries
- Security: No new attack surface — frontend-only default value calculation

## Architecture Changes (C4)

### Diagrams to Update

None — no new components, services, or data flows introduced.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — simple CRUD with no branching or multi-service coordination.

### New Flow Diagrams

None.

## Data Model Changes

None — no database, model, or API changes required.

## API Changes

None — uses existing data already returned by:
- `GET /api/v1/admin/asset-display-config?assetType={type}` (configs with `displayOrder`)
- `GET /api/v1/admin/asset-display-config/{id}/fetch-codes` (fetch codes with `priority`)

## UI/UX Changes

### Affected Components

| Component | File | Change |
|-----------|------|--------|
| `FetchCodeList` | `features/admin/components/FetchCodeList.tsx` | Compute `nextPriority` from loaded fetch codes, use as default for `priorityInput` state, update on data change |
| `AssetDisplayConfigForm` | `features/admin/components/AssetDisplayConfigForm.tsx` | Accept `nextDisplayOrder` prop, use as default for `displayOrder` field in create mode |
| `AssetDisplayConfigTable` | `features/admin/components/AssetDisplayConfigTable.tsx` | Compute `nextDisplayOrder` from loaded configs, pass to form in create mode |

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Number input with auto-default | `FormNumberInput` | `components/forms/FormNumberInput.tsx` |
| Form state management | `react-hook-form` | Already used in both components |

### New Components

None — all changes are within existing components.

### Implementation Details

**FetchCodeList (priority auto-increment):**
- After `data?.fetchCodes` loads, compute `nextPriority = max(fetchCodes.map(fc => fc.priority)) + 1` (or `1` if empty)
- Use `useEffect` to update `priorityInput` state when `data` changes (only if the input hasn't been manually touched, or after a successful add — reset to next value)
- After successful `createMutation`, the query invalidates and `data` refreshes, which triggers recalculation

**AssetDisplayConfigForm (displayOrder auto-increment):**
- Add optional prop `nextDisplayOrder?: number`
- In create mode, use `nextDisplayOrder` as default for `displayOrder` field (fallback to `0` if not provided)
- The parent `AssetDisplayConfigTable` computes this from `configs.reduce((max, c) => Math.max(max, c.displayOrder), 0) + 1`
- When admin switches asset type toggle, parent should recompute (currently the query is scoped by `activeTab`, so the table needs to pass the computed value per the active tab's data)

**Asset type switching in create mode:**
- The asset type selector is inside the form, but the configs query is in the table (scoped by `activeTab`)
- Simplest approach: compute `nextDisplayOrder` in the table based on the `activeTab` configs data, pass it to the form. The form already receives `assetType={activeTab}`, and switching asset type in the form doesn't change the table's query. Since the create modal is opened from the table (which knows the active tab), this naturally aligns.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Server (existing query) | Config list / fetch code list | No | Frontend (local computation) | Data already fetched, no new requests |
| 2 | Frontend (computed default) | Integer value | No | Form input field | Local state only |

### Trust Boundaries

No new trust boundaries crossed. All computation is frontend-local using already-authenticated, already-fetched data.

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| — | N/A | N/A | N/A | No new threats | N/A | Frontend-only default value; backend validation unchanged |

### Authorization Rules

Unchanged — admin-only endpoints remain admin-only.

### Input Validation Rules

Unchanged — backend still validates `priority >= 0` and `displayOrder >= 0`.

### External Dependency Risks

None — no new dependencies.

### Sensitive Data Handling

N/A — no sensitive data involved.

### Issues & Risks Summary

1. **Low risk**: If the configs query hasn't loaded yet when form opens, the default will be `1` (safe fallback)
2. **Low risk**: Race condition if two admins create simultaneously — both get same suggested value, but backend allows duplicate priorities/orders (no unique constraint on these fields)

## Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|----------|
| No existing fetch codes | Default to `1` |
| No existing configs for asset type | Default to `1` |
| Configs query still loading | Default to `1` until data arrives, then update |
| Admin manually overrides value | Respect manual value — no auto-correction |
| Fetch code deleted, then new one added | Recalculates from remaining codes (may reuse deleted priority number — acceptable) |
| Priority gaps (e.g., 1, 3, 5) | Next = `max + 1` = 6 (does not fill gaps — acceptable, keeps it simple) |

## Dependencies & Assumptions

- Existing admin config/fetch code queries return the full list with priority/displayOrder fields (confirmed)
- `FetchCodeList` already has `data?.fetchCodes` with `priority` field
- `AssetDisplayConfigTable` already has `configs` array with `displayOrder` field

## Out of Scope

- Drag-and-drop reordering of priorities/display orders
- Gap-filling logic (e.g., inserting between existing values)
- Backend auto-increment (not needed — frontend handles defaults)
- Batch priority reassignment
