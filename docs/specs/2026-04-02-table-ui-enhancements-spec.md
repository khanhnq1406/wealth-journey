# Table UI Enhancements Specification

## Summary

Two related UI improvements targeting the shared table infrastructure:

1. **TanStackTable desktop design refresh** — Align `TanStackTable`'s desktop styling with the established v2 design system as demonstrated by `PriceAlertList`. The current component uses a darker header background, heavier borders, larger/bolder header text, and hardcoded `neutral-*` colors that break the v2 theme.

2. **Generic SortableList drag-and-drop component** — Extract the drag-and-drop reorder pattern from `DraggableWatchlistTable` into a generic, reusable `SortableList` component that lives in `components/table/`. This eliminates code duplication when new features need ordered lists (e.g., budget category ordering, import column mapping, future admin ordering UIs).

Neither task touches the backend. Both are pure frontend changes. No new dependencies are needed — `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are already installed.

---

## User Stories

- As a user, I want all desktop data tables to look visually consistent, so that the app feels polished and professional.
- As a developer, I want a single generic drag-and-drop reorder component, so that I can add reorderable lists to new features without duplicating the dnd-kit setup logic.
- As a mobile user, I want expanded row content in TanStackTable to match the app theme, so that my reading experience is not broken by jarring white backgrounds.

---

## Functional Requirements

### FR-1: TanStackTable Desktop Styling Alignment

Update `TanStackTable` to use the same header, border, hover, and typography tokens as `PriceAlertList`.

**Acceptance criteria:**

- [ ] Table header row uses `bg-v2-bg-surface-tint` (not `bg-v2-maroon-800`)
- [ ] Header border uses `border-b border-v2-border-light` (not `border-b-2 border-v2-maroon-600`)
- [ ] Header cells use `text-xs font-semibold text-v2-text-secondary uppercase tracking-wider` (not `text-base font-bold text-v2-gold-accent`)
- [ ] Row hover uses `hover:bg-v2-bg-surface-tint transition-colors` (not `hover:bg-neutral-50`)
- [ ] Row dividers use `border-b border-v2-border-light` (not `border-v2-maroon-600`)
- [ ] Table container wrapped in `rounded-lg border border-v2-border-light overflow-x-auto`
- [ ] Loading skeleton header also updated to match (currently uses same stale classes)
- [ ] `MobileExpandedRow` expanded content uses v2 tokens — no `bg-neutral-50`, `text-neutral-500`, `text-neutral-900`
- [ ] `MobileExpandedRow` header labels: `text-xs font-semibold text-v2-text-tertiary uppercase tracking-wide`
- [ ] `MobileExpandedRow` values: `text-sm text-v2-text-secondary font-medium`
- [ ] `MobileExpandedRow` container: `bg-v2-bg-dark` with `border-t border-v2-border-light`
- [ ] All existing consumers of `TanStackTable` pass a visual regression check (no layout breakage)
- [ ] `TablePagination` border uses `border-v2-border-light` (currently `border-v2-maroon-600`)

### FR-2: Generic `SortableList` Component

Create `components/table/SortableList.tsx` — a generic drag-and-drop reorder component using `@dnd-kit`.

**Interface:**

```typescript
export interface SortableListProps<T extends { id: string | number }> {
  /** The ordered list of items */
  items: T[];
  /** Called after a successful drop with the new order */
  onReorder: (newOrder: T[]) => void;
  /** Renders the content of each sortable row */
  renderItem: (item: T, isDragging: boolean) => React.ReactNode;
  /** Renders the drag overlay (optional — defaults to renderItem with isDragging=true) */
  renderOverlay?: (item: T) => React.ReactNode;
  /** Extra className for the container */
  className?: string;
  /** Hide drag handles (useful when dragging the whole row area) */
  hideDragHandle?: boolean;
}
```

**Acceptance criteria:**

- [ ] Component lives at `components/table/SortableList.tsx`
- [ ] Generic over `T extends { id: string | number }` — no domain knowledge baked in
- [ ] Internally manages local `items` state for optimistic reorder; syncs from props when not dragging
- [ ] Uses `PointerSensor` with `activationConstraint: { distance: 5 }` (matches existing pattern)
- [ ] Renders a drag handle (`GripVertical` icon) on the left of each item unless `hideDragHandle` is set
- [ ] Drag handle has `min-h-[44px] min-w-[44px]` touch target and `touchAction: "none"` style
- [ ] Drag overlay shows while dragging (via `DragOverlay` portal)
- [ ] During drag, dragged item shows at `opacity: 0.4`
- [ ] `onReorder` called exactly once at drag end with new order
- [ ] Does not call `onReorder` if item is dropped in same position
- [ ] Works on both desktop (mouse) and mobile (touch) via PointerSensor
- [ ] `DraggableWatchlistTable` refactored to use `SortableList` (proof that the abstraction works)

---

## Non-Functional Requirements

- **Performance**: `SortableList` must be memoized with `React.memo`. No unnecessary re-renders during drag.
- **Accessibility**: Drag handles must have `aria-label="Drag to reorder"`. Focus management is handled by dnd-kit internally.
- **Bundle size**: Use direct imports (`@dnd-kit/core`, `@dnd-kit/sortable`) — no barrel imports.
- **Mobile**: Touch drag must work on iOS and Android via `PointerSensor`.
- **Theme compliance**: Zero hardcoded colors. All tokens from v2 design system.

---

## Architecture Changes (C4)

### Diagrams to Update

**`c4-component-frontend.md` (L3 Frontend):**
- Add `SortableList` to the shared components section under `components/table/`
- Note: This is a minor addition to an existing shared component category, not a structural change

### New Diagrams

No new L4 code diagrams needed — this is a UI component, not a complex domain with business logic.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

No flow diagram updates required. The drag-and-drop reorder is a local UI interaction with no backend involvement for Task 1. Task 2 (SortableList) involves a local optimistic reorder that calls `onReorder` — callers decide whether to persist. No new sequence diagrams needed.

### New Flow Diagrams

None required.

---

## Data Model Changes

None. Both tasks are purely frontend styling and component extraction.

---

## API Changes

None.

---

## UI/UX Changes

### Task 1: TanStackTable Styling Delta

| Property | Before (current) | After (target) | Source of truth |
|----------|-----------------|----------------|-----------------|
| Header background | `bg-v2-maroon-800` | `bg-v2-bg-surface-tint` | PriceAlertList |
| Header border | `border-b-2 border-v2-maroon-600` | `border-b border-v2-border-light` | PriceAlertList |
| Header text size | `text-base` | `text-xs` | PriceAlertList |
| Header text weight | `font-bold` | `font-semibold` | PriceAlertList |
| Header text color | `text-v2-gold-accent` | `text-v2-text-secondary` | PriceAlertList |
| Header text transform | (none) | `uppercase tracking-wider` | PriceAlertList |
| Row hover | `hover:bg-neutral-50` | `hover:bg-v2-bg-surface-tint` | PriceAlertList |
| Row border | `border-v2-maroon-600` | `border-v2-border-light` | PriceAlertList |
| Table container | `overflow-x-auto` only | `rounded-lg border border-v2-border-light overflow-x-auto` | PriceAlertList |
| MobileExpandedRow bg | `bg-neutral-50` | `bg-v2-bg-dark` | v2 design system |
| MobileExpandedRow label color | `text-neutral-500` | `text-v2-text-tertiary` | v2 design system |
| MobileExpandedRow value color | `text-neutral-900` | `text-v2-text-secondary` | v2 design system |
| MobileExpandedRow border | `border-v2-gold-primary/20` | `border-v2-border-light` | v2 design system |
| Pagination border | `border-v2-maroon-600` | `border-v2-border-light` | v2 design system |

### Task 2: New SortableList Component

**Location:** `components/table/SortableList.tsx`

**Visual behavior:**
- Drag handle column (32px wide) on left edge of each row
- `GripVertical` icon, muted color, changes to brighter on hover
- Dragging row: `opacity: 0.4`
- Drag overlay: `shadow-modal` + `border border-v2-border-light` + `bg-v2-bg-surface-tint`, `cursor-grabbing`
- Container: `w-full` — no fixed height constraints

**DraggableWatchlistTable refactor:**
- Remove all dnd-kit imports and local state management from `DraggableWatchlistTable`
- Delegate to `<SortableList>` passing `items`, `onReorder`, `renderItem`
- Result: `DraggableWatchlistTable` becomes a thin wrapper providing the domain-specific row rendering

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Draggable list | `DraggableWatchlistTable` (domain-specific) | `features/watchlist/components/` |
| Generic sortable list | NEW — create `SortableList` | `components/table/SortableList.tsx` |
| Table with sorting | `TanStackTable` (being updated) | `components/table/TanStackTable.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `SortableList` | `components/table/SortableList.tsx` | Reusable across features — watchlist already uses it, future features will need it; lives in shared `components/` layer |

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (pointer/touch) | Drag gesture (pixel delta) | No | Browser DOM / dnd-kit | Purely local UI interaction |
| 2 | dnd-kit | New item order (array of T) | No | `onReorder` callback → parent state | No server call from SortableList itself |
| 3 | Parent (caller of SortableList) | Serialized order (e.g. array of IDs) | Yes: Internet → App | Backend API (if caller persists order) | Caller's responsibility; SortableList is not involved |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Order persistence API call | Handled by caller (JWT auth, existing middleware) |
| Browser → dnd-kit | Pointer events | dnd-kit is a well-maintained OSS library; no remote calls |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 3 | Internet → App | Tampering | Caller sends manipulated item IDs to persist fake order | Low | Caller's API must validate ownership (existing auth middleware covers this — no new risk) |
| T-2 | 1 | Local DOM | DoS | Rapid continuous drag events | Low | dnd-kit throttles pointer events internally |

**Verdict:** This feature introduces no new trust boundaries or security surfaces. The `SortableList` component is a pure local UI primitive. Any API calls to persist order are the caller's responsibility and already covered by existing auth patterns.

### Authorization Rules

Not applicable — no new API endpoints. Callers use existing authenticated endpoints.

### Input Validation Rules

Not applicable — no user-provided text or numerical input.

### External Dependency Risks

| Library | Version | Risk | Mitigation |
|---------|---------|------|-----------|
| `@dnd-kit/core` | `^6.3.1` | Low — already installed and used | No new dependency; pinned in package.json |
| `@dnd-kit/sortable` | `^10.0.0` | Low — already installed and used | No new dependency |
| `@dnd-kit/utilities` | `^3.2.2` | Low — already installed and used | No new dependency |

### Sensitive Data Handling

No sensitive data involved. Component works with generic `T[]` arrays; cell rendering is the caller's responsibility.

### Issues & Risks Summary

1. **Visual regression risk** — TanStackTable is used in multiple places in the codebase. Changing header/row styling could affect existing tables that were designed around the old styling. Must audit all consumers before and after.
2. **Mobile touch drag** — `PointerSensor` covers touch on most modern browsers, but iOS Safari requires `touchAction: "none"` on the drag handle element. Already handled in the existing pattern.
3. **DraggableWatchlistTable refactor** — Refactoring to use `SortableList` while keeping identical visual output requires careful renderItem implementation. Risk is low since we keep the overlay/row rendering in the watchlist feature.

---

## Edge Cases & Error Handling

### TanStackTable

- **Empty state**: Not changed — existing SVG icon uses `text-v2-cream-100` which is fine.
- **Loading skeleton**: Must update header classes in the memoized skeleton (currently duplicated from the main render path).
- **Zero columns**: No change needed.
- **Consumer with custom className**: `className` is applied to the outer `overflow-x-auto` wrapper; the new container `rounded-lg border` must be on a new inner wrapper or the `className` prop must not override the border (use `cn()` carefully).

### SortableList

- **Empty list**: Render nothing or an empty container — no crash.
- **Single item**: Drag handle shows but dragging a single item does nothing meaningful — `onReorder` not called (same position).
- **Items with duplicate IDs**: dnd-kit behavior undefined — document that `id` must be unique.
- **Unmount during drag**: dnd-kit handles cleanup internally.
- **External items update during drag**: `isDraggingRef` prevents prop sync during active drag, same as existing `DraggableWatchlistTable` pattern.

---

## Dependencies & Assumptions

- `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2` are already installed
- `GripVertical` from `lucide-react` is available (already used in `DraggableWatchlistTable`)
- `cn()` utility is available from `@/lib/utils/cn`
- All consumers of `TanStackTable` will receive the updated styling without API changes
- Tailwind v2 tokens (`bg-v2-bg-surface-tint`, `border-v2-border-light`, etc.) are confirmed in `tailwind.config.ts`
- `sm:` breakpoint is `640px` (standard Tailwind — confirmed the old custom `sm:800px` was removed per CLAUDE.md)

---

## Out of Scope

- Adding drag-and-drop to `TanStackTable` itself (column reorder or row reorder) — separate feature
- Persisting drag-and-drop order for any specific feature — callers handle persistence
- Server-side sorting changes for any table
- Adding new columns or data to existing tables
- Storybook stories for the new component
- Dark/light theme toggle (app has no theme toggle — permanent dark)
- Changes to `MobileTable` component
- `VirtualizedTransactionList` styling updates
