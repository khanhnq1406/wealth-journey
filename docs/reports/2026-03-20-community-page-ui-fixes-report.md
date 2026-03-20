# Community Page UI Fixes Implementation Report

## Summary

Fixed three CSS-only visual bugs on the community page: (1) desktop content overlapping the global top bar, (2) mobile sub-navigation overlapping the global mobile header, and (3) ProfileCard cover banner border-radius mismatch.

## Spec Reference

`docs/specs/2026-03-20-community-page-ui-fixes-spec.md`

## Plan Reference

`docs/plans/2026-03-20-community-page-ui-fixes-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 1 | Fix desktop content overlap — remove negative top margins | Done | page.tsx | N/A (CSS class change) | N/A |
| 2 | Fix mobile sub-nav overlap — make MobileSubNav sticky | Done | MobileSubNav.tsx, MobileSubNav.test.tsx | 2/2 pass | Yes |
| 3 | Fix ProfileCard border-radius mismatch | Done | ProfileCard.tsx, ProfileCard.test.tsx | 2/2 pass | Yes |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Frontend Component | `features/community/__tests__/MobileSubNav.test.tsx` | 2 | 2/2 | Tab rendering, sticky positioning classes |
| Frontend Component | `features/community/__tests__/ProfileCard.test.tsx` | 2 | 2/2 | Banner border-radius removal, container overflow-hidden |

## Security Implementation Summary

No security concerns — CSS-only visual fixes with no data flow, API, or business logic changes.

## Review Results

### Spec Compliance

All three functional requirements addressed:
- **FR-1 (Mobile sub-nav):** MobileSubNav wrapper now has `sticky top-0 z-[5]` — sticks below global header within the `overflow-y-auto` scroll container, low enough to not overlap the sidebar menu overlay (`z-45`)
- **FR-2 (Desktop overlap):** Removed `-mt-4 sm:-mt-6 lg:-mt-8` from community page container — content no longer slides under the 68px desktop top bar. Negative side margins preserved for full-bleed width
- **FR-3 (Border-radius):** Removed `rounded-t-xl` from ProfileCard cover banner — parent's `rounded-2xl` + `overflow-hidden` handles clipping correctly

### Code Quality

- Minimal, targeted changes (1 line per file)
- No new dependencies or components
- Tests added for verifiable CSS class assertions
- Follows existing project patterns

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/app/[locale]/dashboard/community/page.tsx` | Removed `-mt-4 sm:-mt-6 lg:-mt-8` |
| `src/wj-client/features/community/components/MobileSubNav.tsx` | Changed `z-20` → `z-[5]` (sticky sub-nav below sidebar overlay) |
| `src/wj-client/features/community/components/ProfileCard.tsx` | Removed `rounded-t-xl` |
| `src/wj-client/features/community/__tests__/MobileSubNav.test.tsx` | New test file |
| `src/wj-client/features/community/__tests__/ProfileCard.test.tsx` | New test file |

## How to Test

1. Start dev server: `cd src/wj-client && npm run dev`
2. Navigate to `/dashboard/community` (requires login)
3. **Desktop (1280px+):** Verify content starts below the 68px top bar, no overlap
4. **Mobile (375px):** Verify MobileSubNav appears below global header, stays sticky on scroll
5. **ProfileCard:** Verify cover banner corners match card container corners (no double-rounding)
6. **Sidebar overlap:** Open mobile sidebar menu → MobileSubNav should NOT appear on top of the dark overlay
7. **Run tests:** `cd src/wj-client && npx jest --testPathPatterns="features/community/__tests__" --no-coverage`

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-20 | MobileSubNav z-index lowered from `z-20` to `z-[5]` to prevent overlap with mobile sidebar menu overlay (`z-45`) — matches `FinanceTabBar` convention for sticky in-page navigation | Minor | pending |
