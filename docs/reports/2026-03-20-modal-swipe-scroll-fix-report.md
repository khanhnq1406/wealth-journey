# Modal Swipe-to-Close Scroll Conflict Fix — Implementation Report

## Summary

Fixed accidental modal dismissal on mobile by restricting the swipe-to-close gesture to the drag handle area only. Previously, touch events for swipe-to-close were attached to the entire modal content div, causing scrolling inside modals (forms, lists, investment details) to accidentally trigger modal dismissal. The fix moves touch event handlers to the drag handle element at the top of the modal, making content scrolling completely independent of the close gesture.

## Spec Reference

`docs/specs/2026-03-20-modal-swipe-scroll-fix-spec.md`

## Plan Reference

`docs/plans/2026-03-20-modal-swipe-scroll-fix-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 1 | Fix BaseModal swipe-to-close to drag handle only | Done | BaseModal.tsx, BaseModal.test.tsx | 3/3 pass | Yes |
| 2 | Fix BottomSheet swipe-to-close to drag handle only | Done | BottomSheet.tsx, BottomSheet.test.tsx | 2/2 pass | Yes |
| 3 | Run all tests and verify no regressions | Done | — | 258/258 pass | — |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| BaseModal Component | `components/modals/__tests__/BaseModal.test.tsx` | 3 | 3/3 | Swipe on handle closes, swipe on content blocked, content-to-handle cross blocked |
| BottomSheet Component | `components/__tests__/BottomSheet.test.tsx` | 2 | 2/2 | Swipe on handle closes, swipe on content blocked |

## Security Implementation Summary

No security concerns — this is a pure client-side UI gesture fix with no data flow, API, authorization, or validation changes.

## Review Results

### Spec Compliance

All functional requirements from the spec are met:

- **FR-1** (Drag Handle Only Swipe Zone): Touch handlers moved from content div to drag handle div in both BaseModal and BottomSheet. Content body touches no longer trigger swipe-to-close.
- **FR-2** (Drag Handle Touch Target Size): Drag handle has `min-h-[44px]` meeting iOS HIG minimum touch target size.
- **FR-3** (BottomSheet Alignment): Same fix pattern applied to BottomSheet component.

### Code Quality

- Simplified `handleTouchStart` — removed scroll-position detection logic (no longer needed since handler is scoped to drag handle)
- Simplified `handleTouchMove` — removed `contentDiv.scrollTop` checks
- Removed `isDragging && "touch-none"` from modal content div (only needed on drag handle now)
- Added `touch-none` class to drag handle div to prevent browser default touch behaviors
- Added `cursor-grab`/`active:cursor-grabbing` for visual affordance on drag handle

## Known Issues / Technical Debt

None introduced. The change is a net simplification — removed ~20 lines of scroll-position detection logic that was previously needed to determine when to allow swipe vs scroll.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/wj-client/components/modals/BaseModal.tsx` | Modified | Moved touch handlers to drag handle, simplified touch logic, added `data-testid`, `min-h-[44px]` |
| `src/wj-client/components/BottomSheet.tsx` | Modified | Moved touch handlers to drag handle, added `data-testid`, `min-h-[44px]` |
| `src/wj-client/components/modals/__tests__/BaseModal.test.tsx` | Created | 3 tests for BaseModal swipe behavior |
| `src/wj-client/components/__tests__/BottomSheet.test.tsx` | Created | 2 tests for BottomSheet swipe behavior |
| `docs/specs/2026-03-20-modal-swipe-scroll-fix-spec.md` | Created | Feature specification |
| `docs/plans/2026-03-20-modal-swipe-scroll-fix-plan.md` | Created | Implementation plan |
| `docs/reports/2026-03-20-modal-swipe-scroll-fix-progress.md` | Created | Progress tracking |

**Commit:** `044001b` — `fix(modal): restrict swipe-to-close to drag handle only`

## Behavior Change

| Interaction | Before (broken) | After (fixed) |
|---|---|---|
| Swipe down on drag handle | Closes modal | Closes modal (unchanged) |
| Swipe down on content body | Closes modal (BUG) | Scrolls content normally |
| Scroll up to top, continue pulling | Closes modal (BUG) | Stops at top, no close |
| Scroll content down | Sometimes triggers close (BUG) | Scrolls normally |
| Desktop behavior | No swipe gestures | No swipe gestures (unchanged) |

## How to Test

1. Open the app on a mobile device (or Chrome DevTools mobile emulator at < 800px)
2. Open any modal with scrollable content (e.g., Add Transaction, Investment Detail, Import Transactions)
3. **Scroll content**: Verify scrolling up/down in the content area works freely without triggering modal close
4. **Swipe drag handle**: Touch the drag handle bar at the top of the modal and swipe down — modal should close
5. **Edge case**: Scroll to the very top of content, then continue pulling down — modal should NOT close
6. **Edge case**: Touch starts on content, finger moves to drag handle area — modal should NOT close
7. **Desktop**: Verify no swipe behavior on desktop (>= 800px) — close via X button, ESC, or backdrop click only
