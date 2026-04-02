# FAB Loading State Specification

## Summary

When site settings data has not finished fetching, the FAB popup shows only the "Add Investment" action button without the intro card, making the popup look incomplete. This fix adds a loading indicator to the FAB's intro section while settings are loading, while always keeping the action buttons visible and functional.

## User Stories

- As a user, I want the FAB popup to show a loading indicator while settings load, so I understand content is coming rather than seeing an empty/broken popup.
- As a user, I want the "Add Investment" button to always be available in the FAB popup regardless of settings loading state, so I can take action immediately.

## Functional Requirements

### FR-1: Loading prop on FloatingActionButton

Add an `isLoading` prop to `FloatingActionButton`. When `true` and the popup is open, display a skeleton placeholder in the intro content area. Action buttons always render regardless of loading state.

**Acceptance criteria:**

- [ ] `FloatingActionButton` accepts an optional `isLoading?: boolean` prop
- [ ] When `isLoading=true` and popup is open, a skeleton placeholder renders in the intro area
- [ ] Action buttons render and are clickable regardless of `isLoading` value
- [ ] When `isLoading` transitions from `true` to `false`, skeleton is replaced by actual intro content (or hidden if no content)
- [ ] When `isLoading=false` and `introContent` is `undefined` (e.g., `fab.enabled=false`), no intro section renders (same as current behavior)

### FR-2: Pass loading state from DashboardLayout

`DashboardLayout.tsx` passes `fabSettings.isLoading` (or `fabSettings.isPending`) to the FAB component.

**Acceptance criteria:**

- [ ] `DashboardLayout` passes `isLoading={fabSettings.isPending}` to `FloatingActionButton`
- [ ] No change to existing `fabIntroContent` logic — it still resolves to `undefined` when settings say `fab.enabled=false`

### FR-3: Auto-open behavior with loading

When `autoOpen=true` (home page), the FAB should still auto-open after 500ms even if settings are loading. The user sees the skeleton briefly, then the content appears.

**Acceptance criteria:**

- [ ] Auto-open timing unchanged (500ms)
- [ ] If settings are still loading when auto-open fires, skeleton is visible in the intro area
- [ ] Action buttons are visible immediately on auto-open

## Non-Functional Requirements

- Performance: No additional API calls. The existing `fab-settings` query is reused; only the loading state is forwarded.
- Security: No new endpoints, no new data flows. Frontend-only change.
- Accessibility: Skeleton area should have `aria-busy="true"` while loading.

## Architecture Changes (C4)

### Diagrams to Update

None. This is a minor UI behavior change within the existing `FloatingActionButton` component. No new components, services, or data flows.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None. No new API endpoints or business logic.

### New Flow Diagrams

None.

## Data Model Changes

None.

## API Changes

None. Existing `GET /api/v1/public/site-settings` is unchanged.

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Skeleton placeholder | Skeleton variants | `components/loading/` |
| FAB component | FloatingActionButton | `components/FloatingActionButton.tsx` |
| Dashboard layout | DashboardLayout | `app/[locale]/dashboard/DashboardLayout.tsx` |

### New Components (if any)

None. All changes are modifications to existing components.

### Visual Behavior

**Before (current):**
- FAB opens → empty card border visible → action buttons only → settings load → intro appears (jarring)

**After (fixed):**
- FAB opens → skeleton in intro area + action buttons visible → settings load → skeleton replaced by intro content (smooth)

**Skeleton design:**
- 3 lines: one short (title width), one full-width (text), one half-width (contact info)
- Use existing skeleton animation classes from the design system
- Contained within the same `bg-v2-maroon-800 border-2 border-v2-gold-primary` card

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Browser | FAB click event | No (client-side) | FloatingActionButton state | Local UI state only |
| 2 | React Query cache | Site settings (cached) | No (client-side) | DashboardLayout → FAB prop | Already fetched, just forwarding loading state |

### Trust Boundaries

No new trust boundaries. This change is entirely within the browser's client-side rendering.

### Threats Identified (STRIDE per boundary crossing)

No new boundary crossings. The data flow is purely client-side state management (React Query `isPending` → component prop → conditional render).

### Authorization Rules

No change. No server-side operations affected.

### Input Validation Rules

No user input involved. The `isLoading` prop is a boolean derived from React Query internal state.

### External Dependency Risks

No new dependencies. Uses existing Skeleton components from the design system.

### Sensitive Data Handling

No sensitive data involved. Site settings (FAB title, intro text, contact info) are public data served from an unauthenticated endpoint.

### Issues & Risks Summary

1. **Minimal risk** — Frontend-only, no new API calls, no data model changes
2. **Edge case** — If settings API permanently fails, skeleton shows indefinitely; mitigated by React Query's `retry: 1` default which will resolve to error state quickly, causing `fabIntroContent` to be `undefined` and hiding the intro section

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Settings API fails after retries | `isPending` becomes `false`, `data` is `undefined`, `fabIntroContent` is `undefined` → no intro section shown, action buttons still visible |
| Settings API very slow (>5s) | Skeleton shows while loading, action buttons remain functional |
| `fab.enabled=false` returned | Skeleton disappears, `fabIntroContent` resolves to `undefined`, no intro section — action buttons only |
| User clicks action button while loading | Works immediately — action buttons have no dependency on settings |
| Settings cached from previous visit | `isPending` is `false` immediately (stale-while-revalidate), no skeleton shown |

## Dependencies & Assumptions

- Existing Skeleton component is available in `components/loading/`
- React Query's `isPending` correctly reflects the initial loading state
- `fabSettings.isPending` is `false` when data is served from cache (staleTime: 5min)

## Out of Scope

- Changing the FAB's action button list based on settings
- Adding new site settings keys
- Modifying the auto-open timing logic
- Backend changes
