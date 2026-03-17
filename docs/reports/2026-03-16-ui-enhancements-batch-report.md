# UI Enhancements Batch — Implementation Report

## Summary
Implemented 5 independent frontend-only UI enhancements: wallet placeholder examples, NumberSuggestions red brand restyle, sparkline empty/single-point fallback, community donation button, and navbar profile navigation item.

## Spec Reference
`docs/specs/2026-03-16-ui-enhancements-batch-spec.md`

## Plan Reference
`docs/plans/2026-03-16-ui-enhancements-batch-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Wallet Name Placeholder | Done | 2 translation files | fba1a14 |
| 2 | NumberSuggestions Red Restyle | Done | 1 component | 810cd56 |
| 3 | Sparkline Empty/Single Point | Done | 3 components | c2b38a9 |
| 4 | Community Donation Button | Done | 1 component | a8262c2 |
| 5 | Navbar Profile Nav Item | Done | 5 files | 8f8eacd |

## Security Implementation Summary
No security concerns — all changes are frontend display/UX only. No new API calls, no data collection, no trust boundary crossings.

## Files Changed

**Task 1:**
- `src/wj-client/messages/en/wallet.json` — updated namePlaceholder
- `src/wj-client/messages/vi/wallet.json` — updated namePlaceholder

**Task 2:**
- `src/wj-client/components/forms/NumberSuggestions.tsx` — green → red brand classes

**Task 3:**
- `src/wj-client/components/charts/Sparkline.tsx` — added empty/single-point handlers
- `src/wj-client/components/cards/WealthCard.tsx` — sparkline fallback with horizontal line
- `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx` — relaxed length guard

**Task 4:**
- `src/wj-client/features/community/components/PostActions.tsx` — added Star button + toast

**Task 5:**
- `src/wj-client/messages/en/nav.json` — added "profile" key
- `src/wj-client/messages/vi/nav.json` — added "profile" key
- `src/wj-client/app/constants.tsx` — added communityProfile route
- `src/wj-client/app/[locale]/dashboard/layout.tsx` — added profile NavItem to sidebar + mobile menu
- `src/wj-client/app/[locale]/dashboard/community/page.tsx` — added ?view=profile URL param handling

## Fix History

| Date | Fix | Severity | File |
|------|-----|----------|------|
| 2026-03-17 | Replace useEffect setState with useState initializer to fix `react-hooks/set-state-in-effect` lint error | Minor | `community/page.tsx` |
| 2026-03-17 | Fix Profile nav item not highlighting when on profile route — compute `isActive` from pathname + `?view=profile` search param; also prevent Community item from highlighting when profile view is active | Minor | `layout.tsx` |
| 2026-03-17 | Fix sparkline showing increasing diagonal line instead of flat horizontal line when portfolio value is 0 — mock fallback generated linear sequence from -100 to +100; now returns empty array so Sparkline renders flat line. Also updated Sparkline empty/single-point handler to render green solid line with gradient fill (matching normal sparkline style) instead of plain gray dashed line | Minor | `PortfolioSummaryEnhanced.tsx`, `Sparkline.tsx` |
| 2026-03-17 | Fix mobile menu being overlapped by profile avatar and Edit Profile/Edit Cover buttons — add `isolate` to profile card container to scope child z-indices within the card's stacking context, preventing them from competing with the global mobile menu overlay (z-45/z-50) | Minor | `ProfileView.tsx` |
| 2026-03-17 | Fix Community nav item showing ghost shadow in mobile menu when on profile view — `ActiveLink` built-in active style (`shadow-md`) was stacking on top of custom active logic; add `disableBuiltInActive` to all mobile menu `ActiveLink` items so only custom className controls active state | Minor | `layout.tsx` |

## How to Test

1. **Wallet placeholder** — Open Create Wallet modal, verify placeholder shows examples
2. **NumberSuggestions** — Open any form with number suggestions, verify chips are red
3. **Sparkline** — View a WealthCard or PortfolioSummary with 0-1 data points, verify horizontal line appears
4. **Donation button** — Go to Community, find a post, click the star button, verify toast appears
5. **Profile nav** — Check sidebar for "Your Profile" item, click it, verify community page switches to profile view
