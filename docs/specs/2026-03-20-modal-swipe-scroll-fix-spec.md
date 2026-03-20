# Modal Swipe-to-Close Scroll Conflict Fix — Specification

## Summary

Fix accidental modal dismissal caused by the swipe-to-close gesture conflicting with content scrolling inside modals on mobile devices. The solution restricts swipe-to-close to only work when the user touches the **drag handle bar** at the top of the modal, making content scrolling completely independent of the close gesture.

## User Stories

- As a mobile user, I want to scroll through long modal content (forms, lists, investment details) without accidentally closing the modal
- As a mobile user, I want to swipe the drag handle bar to close the modal when I'm done

## Functional Requirements

### FR-1: Drag Handle Only Swipe Zone

The swipe-to-close gesture must **only** activate when the user touches and drags the drag handle area (the bar + padding area at the top of the modal). Touching and dragging anywhere in the modal content body must NOT trigger swipe-to-close.

**Acceptance criteria:**
- [ ] Swiping down on the drag handle bar closes the modal (threshold: 100px or velocity-based)
- [ ] Swiping down on modal content body does NOT close the modal
- [ ] Scrolling content inside the modal works without any interference
- [ ] Scrolling up to the top of content and continuing to scroll does NOT trigger swipe-to-close
- [ ] The drag handle visual feedback (color changes) still works during a handle drag
- [ ] The backdrop opacity fade still works during a handle drag
- [ ] The modal spring-back animation works when the drag doesn't meet the threshold
- [ ] Desktop behavior is unchanged (no swipe gestures on desktop)

### FR-2: Drag Handle Touch Target Size

The drag handle touch target must be large enough for comfortable mobile use.

**Acceptance criteria:**
- [ ] Drag handle touch target is at least 44px tall (iOS HIG minimum)
- [ ] The entire area from the top of the modal to just below the drag handle bar acts as the swipe zone
- [ ] The drag handle bar visual indicator remains the same (12px wide, 6px tall, rounded)

### FR-3: BottomSheet Component Alignment

The standalone `BottomSheet.tsx` component must receive the same fix.

**Acceptance criteria:**
- [ ] BottomSheet swipe-to-close only activates from the drag handle area
- [ ] BottomSheet content scrolling is unaffected by swipe gestures

## Non-Functional Requirements

- **Performance**: No change — requestAnimationFrame-based animation at 60fps (already implemented)
- **Accessibility**: Drag handle must remain accessible (already has no ARIA requirements as a gesture enhancement)
- **Backward compatibility**: The `closeOnSwipe` prop continues to work (enables/disables the feature entirely)

## Architecture Changes (C4)

### Diagrams to Update

None — this is a bugfix to existing component behavior. No new components, services, or data flows are introduced.

### New Diagrams

None.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — this is a UI gesture bugfix with no backend or API changes.

### New Flow Diagrams

None.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

### Behavior Change

| Interaction | Before (broken) | After (fixed) |
|---|---|---|
| Swipe down on drag handle | Closes modal | Closes modal (unchanged) |
| Swipe down on content body | Closes modal (BUG) | Scrolls content normally |
| Scroll up to top, continue | Closes modal (BUG) | Stops at top, no close |
| Scroll content down | Sometimes triggers close (BUG) | Scrolls normally |

### Visual Change

None — the drag handle bar appearance is unchanged. The only change is behavioral.

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|---|---|---|
| Modal container with swipe | BaseModal (modify) | `components/modals/BaseModal.tsx` |
| Bottom sheet with swipe | BottomSheet (modify) | `components/BottomSheet.tsx` |

### New Components (if any)

None — this is a modification to existing components only.

## Security & Risk Assessment

### Data Flow Diagram

No new data flows. This change only affects UI gesture handling (touch events → state → CSS transform). No data crosses trust boundaries.

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|---|---|---|---|---|
| 1 | User touch | Touch coordinates | No | Component state | Client-side only |

### Trust Boundaries

No trust boundaries are crossed by this change.

### Threats Identified (STRIDE per boundary crossing)

None — pure client-side UI gesture change with no security implications.

### Authorization Rules

No changes.

### Input Validation Rules

No changes — touch coordinates are already handled by browser APIs.

### External Dependency Risks

None — no new dependencies.

### Sensitive Data Handling

No sensitive data involved.

### Issues & Risks Summary

1. **Regression risk**: Swipe-to-close must still work on the drag handle — verify with manual testing
2. **Touch target too small**: If the drag handle area is too small, users may struggle to close the modal — ensure 44px minimum height
3. **BottomSheet divergence**: BottomSheet has a simpler implementation — ensure the fix approach is consistent

## Edge Cases & Error Handling

1. **Very fast swipe on content**: Must NOT close the modal regardless of velocity
2. **Swipe starting on handle, moving to content**: Should still work (the touch started in the handle zone)
3. **Swipe starting on content, moving to handle**: Should NOT trigger close (touch started outside handle zone)
4. **Pinch/zoom gestures**: Must not interfere (already handled by existing code)
5. **Modal with no scrollable content**: Swipe still only works on handle — consistent behavior
6. **Modals that don't show drag handle** (desktop, full variant): No swipe behavior (already correct)

## Dependencies & Assumptions

- The drag handle bar is already rendered in BaseModal when `bottomSheetOnMobile && !fullScreenOnMobile && variant !== "full"`
- The drag handle bar already has visual feedback during drag
- Touch events on the drag handle area can be distinguished from content via a ref

## Out of Scope

- Adding new gesture libraries (framer-motion drag, react-use-gesture, etc.)
- Changing the drag handle visual design
- Adding swipe-to-close to ConfirmationDialog (it doesn't have swipe)
- Desktop swipe behavior (already disabled)
- Changing the swipe threshold or velocity values
