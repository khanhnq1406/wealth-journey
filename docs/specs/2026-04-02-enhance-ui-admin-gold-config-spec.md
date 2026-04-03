# Admin Gold Config UI Enhancement — Specification

## Summary

The admin gold config tab has three usability gaps: the tab label is hardcoded in English instead of using i18n, the `AssetDisplayConfigTable` always renders with `MobileTable` regardless of screen size, and neither the display-order table nor the fetch-code priority list support drag-and-drop reordering. This spec covers adding drag-and-drop reordering to both the gold config row order and the fetch code priority list, plus the tab label i18n fix. The desktop table upgrade is explicitly out of scope (the original item from the task file) because the existing `MobileTable` is already readable on desktop and switching to `TanStackTable` would need a separate UI review cycle.

## User Stories

- As an admin, I want to drag gold config rows to reorder them, so that I don't have to manually type display order numbers.
- As an admin, I want to drag fetch code rows to set their priority order, so that priority management is intuitive and visual.
- As an admin, I want the gold config tab label to display in Vietnamese ("Cấu hình giá"), so that the admin panel is fully localized.

## Functional Requirements

### FR-1: Tab Label i18n

The "Gold Config" tab label on the admin page is currently a hardcoded English string (line 395 of `admin/page.tsx`). It must be replaced with a translated key.

**Acceptance criteria:**
- [ ] `admin.page.tabs.goldConfig` key exists in both `vi/admin.json` and `en/admin.json`
- [ ] Vietnamese label reads "Cấu hình giá"
- [ ] English label reads "Price Config"
- [ ] `admin/page.tsx` line 395 uses `t("page.tabs.goldConfig")` instead of the hardcoded string

### FR-2: Drag-and-Drop Display Order for Gold Config Table

The `AssetDisplayConfigTable` currently shows a `displayOrder` column but admins must edit the form to change it. A drag-and-drop mechanism should replace the manual order — dragging a row updates `displayOrder` values for all affected rows in a single batch call or sequential calls.

**Acceptance criteria:**
- [ ] Each row in the gold config table (per asset-type tab) has a drag handle (grip icon, left side of row)
- [ ] Dragging rows reorders them visually (optimistic update)
- [ ] On drag end, the reordered `displayOrder` values are persisted via existing `PUT /api/v1/admin/asset-display-config/:id` with updated `displayOrder`
- [ ] All rows affected by the reorder are updated (sequential calls, one per affected row)
- [ ] A loading indicator covers the table while batch update is in flight
- [ ] On success, toast `t("toast.updated")` is shown
- [ ] On error, toast `t("toast.updateFailed")` is shown and the order reverts to server state
- [ ] Drag works on touch devices (PointerSensor with 5px activation constraint — matching existing `SortableList`)

**Implementation note:** Use the existing `SortableList` component from `components/table/SortableList.tsx`. The `AssetDisplayConfigTable` must wrap its list with `SortableList` instead of `MobileTable` columns. OR wrap the MobileTable rows — whichever approach is less invasive. Given that `SortableList` renders items via `renderItem` callback, the cleanest approach is to replace the `MobileTable` with a custom card-row layout wrapped in `SortableList` (since `MobileTable` doesn't support drag handles natively).

**Approach decision:** Replace the `MobileTable` rendering for the gold config list with a `SortableList`-based card layout. Each card row renders the same columns (displayOrder number, typeCode, displayName, enabled toggle, edit/delete actions). This is the minimal change — no new shared components needed.

### FR-3: Drag-and-Drop Priority Reordering for Fetch Codes

The `FetchCodeList` component currently shows fetch codes with a static priority number column and a manual priority input in the add form. Add drag-and-drop reordering of existing fetch codes.

**Acceptance criteria:**
- [ ] Each fetch code row has a drag handle
- [ ] Dragging reorders fetch codes visually (optimistic update)
- [ ] On drag end, `PUT /api/v1/admin/asset-display-config/:id/fetch-codes/:fcId` is called for each repositioned fetch code with updated `priority` (sequential, priority = 1-based position)
- [ ] Displayed priority numbers update to reflect new positions after save
- [ ] On success, toast `t("toast.updated")` is shown
- [ ] On error, toast `t("toast.updateFailed")` is shown and order reverts
- [ ] The manual priority number input field in the add form remains (still useful for setting absolute priority when adding)
- [ ] Drag works on touch

**Implementation note:** Replace the static row div-list in `FetchCodeList` with `SortableList`. Each item is an `AssetConfigFetchCode` (already has `id: number`). On `onReorder`, assign sequential priorities (position 0 → priority 1, position 1 → priority 2, …) and call `UpdateFetchCode` for each changed item. Call updates in parallel (Promise.all) to minimize latency.

## Non-Functional Requirements

- **Performance:** Batch priority updates run in parallel (`Promise.all`). UI shows a loading overlay while batch is in flight.
- **Accessibility:** Drag handles have `aria-label="Drag to reorder"` (matches existing `SortableList` pattern). Keyboard drag is supported via pointer sensor.
- **i18n:** All new UI strings use existing translation keys where possible; new keys are added to both locale files.
- **Security:** Only admin users can access these endpoints (`AdminMiddleware` already enforced on backend). No new authorization surface.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Frontend (`c4-component-frontend.md`)**: No structural change — no new feature modules or shared components added. `SortableList` is already documented.
- **L3 Backend (`c4-component-backend.md`)**: No change — no new handlers or services.

### New Diagrams

None required (no new domain, no multi-service coordination).

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — Add a short flowchart for "Drag-to-reorder batch update":

```
sequenceDiagram
  participant Admin
  participant FetchCodeList
  participant Backend

  Admin->>FetchCodeList: Drag item to new position
  FetchCodeList->>FetchCodeList: Optimistic reorder (SortableList)
  FetchCodeList->>Backend: PUT /fetch-codes/:fcId (priority=new) × N (parallel)
  alt All succeed
    Backend-->>FetchCodeList: 200 OK × N
    FetchCodeList->>Admin: toast.success("updated")
    FetchCodeList->>FetchCodeList: invalidateQueries
  else Any fail
    Backend-->>FetchCodeList: error
    FetchCodeList->>Admin: toast.error("updateFailed")
    FetchCodeList->>FetchCodeList: revert to server state
  end
```

## Data Model Changes

None. The `displayOrder` field on `asset_display_config` and `priority` field on `asset_config_fetch_code` already exist.

## API Changes

No new API endpoints. The drag-and-drop uses:
- **Gold config reorder**: `PUT /api/v1/admin/asset-display-config/:id` (existing) — sends updated `displayOrder`
- **Fetch code reorder**: `PUT /api/v1/admin/asset-display-config/:id/fetch-codes/:fcId` (existing, currently unused in UI)

## UI/UX Changes

### Gold Config Table (AssetDisplayConfigTable.tsx)

Replace `MobileTable` with a `SortableList`-based card layout:

```
[ ≡ ] [ 1 ] [ SJC_1L ]  SJC 1 Lượng  [■■ ON ] [Edit] [Delete]
[ ≡ ] [ 2 ] [ SJC_5C ]  SJC 5 Chỉ    [□□ OFF] [Edit] [Delete]
```

- `≡` = `GripVertical` drag handle (44px touch target)
- Cards styled with `bg-v2-bg-dark border border-v2-border-light rounded-md`
- On drag: card goes semi-transparent (opacity 0.4), overlay shows lifted card with `shadow-modal`
- Loading overlay: `animate-pulse opacity-50 pointer-events-none` on the list while batch update in flight

### Fetch Code List (FetchCodeList.tsx)

Replace static div rows with `SortableList`:

```
[ ≡ ] [ 1 ] sjc_1l        [Delete]
[ ≡ ] [ 2 ] doji_999      [Delete]
[ ≡ ] [ 3 ] btmc_main     [Delete]
```

- Same card styling as above
- Priority column shows current computed 1-based position
- After drag: positions renumber immediately (optimistic)

### i18n Keys Added

**`en/admin.json`** and **`vi/admin.json`** — under `admin.page.tabs`:
```json
"goldConfig": "Price Config"    // en
"goldConfig": "Cấu hình giá"   // vi
```

No other new keys needed — `toast.updated` and `toast.updateFailed` already exist in both `assetDisplayConfig` and `assetDisplayConfig.fetchCodes` sections.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Drag-and-drop sortable list | `SortableList` | `components/table/SortableList.tsx` |
| Grip icon | `GripVertical` from `lucide-react` | Already used in `SortableList` |
| Delete confirmation | `ConfirmationDialog` | `components/modals/ConfirmationDialog.tsx` |
| Toggle switch | Inline `<button role="switch">` | Already in `AssetDisplayConfigTable` |
| Toast notifications | `useNotification()` | `contexts/NotificationContext.tsx` |

### New Components

None — all needs are met by existing shared components.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin browser | Drag gesture → new positions array | Yes: Browser → App API | `PUT /admin/asset-display-config/:id` × N | Admin-only endpoint |
| 2 | Admin browser | Drag gesture → new priorities array | Yes: Browser → App API | `PUT /admin/asset-display-config/:id/fetch-codes/:fcId` × N | Admin-only endpoint |
| 3 | Backend | Updated configs / fetch codes | No | Admin browser (React Query cache) | Invalidated after success |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin drag reorder calls | JWT `AuthMiddleware` + `AdminMiddleware` (already enforced on both endpoints) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1, 2 | Internet → App | Tampering | Non-admin user crafts PUT requests with arbitrary priorities | High | `AdminMiddleware` already validates admin role server-side |
| T-2 | 1, 2 | Internet → App | Elevation of Privilege | Admin user sets display order/priority to negative or extreme values | Low | Backend validates integer bounds; no financial impact |
| T-3 | 1, 2 | Browser | Denial of Service | Rapid drag events generate many parallel PUT calls | Low | Rate limiting not added (admin-only surface, low traffic); debounce on drag end is natural |

### Authorization Rules

- Only authenticated admins (`isAdmin = true`) can call `PUT /api/v1/admin/asset-display-config/:id`
- Only authenticated admins can call `PUT /api/v1/admin/asset-display-config/:id/fetch-codes/:fcId`
- Both endpoints already enforce `AdminMiddleware` — no change needed

### Input Validation Rules

- `priority` / `displayOrder`: must be positive integer — backend already validates `fcID > 0`; service layer validates priority bounds
- Frontend sends 1-based sequential priorities (positions 0..N-1 → priorities 1..N) — no NaN risk

### External Dependency Risks

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — already installed and used in `SortableList`. No new packages needed.

### Sensitive Data Handling

No sensitive data involved. Display order and priority are administrative configuration values.

### Issues & Risks Summary

1. **Concurrent admin edits**: Two admins dragging simultaneously can cause order conflicts. Risk is low (single admin expected) and eventual consistency is acceptable — last write wins.
2. **Partial batch failure**: If some PUT calls in the batch succeed and others fail, the server state becomes inconsistent with the optimistic UI. Mitigation: on any error, invalidate queries immediately to force a re-fetch (server wins).
3. **Touch device drag conflicts with scroll**: `PointerSensor` with 5px distance constraint (used by existing `SortableList`) works well on touch but long vertical lists may conflict with page scroll. Acceptable tradeoff — fetch code lists are typically short (< 10 items).

## Edge Cases & Error Handling

- **Empty list**: No drag needed — `SortableList` renders nothing (handled by existing empty state).
- **Single item**: Drag handle visible but no-op — fine.
- **Batch update partial failure**: Any error in `Promise.all` triggers revert + `invalidateQueries`. The component refetches server state.
- **Drag during in-flight toggle** (enabled toggle and drag simultaneously): Toggle mutations use their own loading set; drag reorder mutations use a separate `isReordering` state. No conflict.
- **Tab switch during reorder**: If admin switches asset-type tab mid-drag, the drag event completes for the current list before the tab unmounts (React DnD context cleanup).

## Dependencies & Assumptions

- `@dnd-kit` already installed — no `package.json` changes needed
- `SortableList` component is already production-ready and has been used elsewhere
- Backend `UpdateFetchCode` endpoint is implemented and tested — frontend is the only gap
- The `displayOrder` field is persisted per-row and not derived — safe to update independently

## Out of Scope

- Switching `AssetDisplayConfigTable` from `MobileTable` to `TanStackTable` for desktop — this was item #1 in the original task file but is deferred. The card-row layout introduced for drag-and-drop provides equivalent desktop readability.
- Drag-and-drop for silver or currency asset types — the same `SortableList` wrapper applies to all three tabs automatically (no extra work needed; it's the same component).
- Adding a new backend endpoint for bulk reorder — sequential individual `PUT` calls are sufficient.
