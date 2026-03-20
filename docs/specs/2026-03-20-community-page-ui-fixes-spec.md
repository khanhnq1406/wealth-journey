# Community Page UI Fixes Specification

## Summary

Fix three visual issues on the community page: (1) mobile sub-navigation overlapping with the global mobile header, (2) desktop content overlapping with the global desktop top bar, and (3) mismatched border-radius between the ProfileCard container and its cover photo banner.

## User Stories

- As a mobile user, I want the community sub-navigation (Bảng tin, Đã lưu, Hồ sơ, Thông báo) to appear below the global mobile header without overlap, so I can access both navigation systems clearly.
- As a desktop user, I want the community page content to start below the global top bar (greeting + search), so the profile card and sidebar are fully visible.
- As a user viewing the profile card, I want the cover photo banner corners to match the card container corners, so the design looks polished.

## Functional Requirements

### FR-1: Mobile Sub-Navigation Positioning

The `MobileSubNav` component must be sticky and positioned below the global mobile header, so it remains visible when scrolling without overlapping the global header.

**Acceptance criteria:**
- [ ] MobileSubNav appears directly below the global mobile header (no overlap)
- [ ] MobileSubNav stays visible when scrolling (sticky behavior)
- [ ] No content is hidden behind either header
- [ ] Touch targets on both headers remain accessible

### FR-2: Desktop Content Positioning

The community page content on desktop must not overlap with the global desktop top bar (68px height).

**Acceptance criteria:**
- [ ] Profile card and left sidebar start below the desktop top bar
- [ ] The full-bleed horizontal layout is preserved (negative side margins still work)
- [ ] No visual gap or double-spacing between header and content

### FR-3: ProfileCard Border-Radius Consistency

The cover photo mini banner in ProfileCard must have the same visible corner radius as the card container.

**Acceptance criteria:**
- [ ] Cover banner top corners match the card container's `rounded-2xl` (16px)
- [ ] No visible "double-rounding" effect between container and banner

## Non-Functional Requirements

- Performance: No additional DOM elements or JavaScript; CSS-only fixes preferred
- Compatibility: Works on iOS Safari, Android Chrome, and desktop browsers

## Architecture Changes (C4)

No architecture changes needed. This is a CSS-only fix.

## Runtime Flow Diagrams

No flow diagram changes needed. No business logic affected.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

### Root Cause Analysis

**Issues 1 & 2 — Header overlap:**

The community page (`page.tsx:137`) uses negative margins to achieve full-bleed layout:

```tsx
<div className="flex flex-col sm:h-full -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
```

The content area in the dashboard layout (`layout.tsx:675`) has:

```tsx
<div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-safe-mobile sm:pb-8 ... pt-0 sm:pt-0 lg:pt-0">
```

Key issue: `pt-0` removes top padding, and the community page's `-mt-4` / `sm:-mt-6` / `lg:-mt-8` pulls content upward, causing it to slip under:
- Mobile: the `sticky top-0` global header
- Desktop: the `h-[68px]` desktop top bar

**Issue 3 — Border-radius mismatch:**

In `ProfileCard.tsx`:
- Container: `rounded-2xl` (16px) with `overflow-hidden`
- Cover banner: `rounded-t-xl` (12px)

The `overflow-hidden` already clips the banner to the container's shape. The extra `rounded-t-xl` on the banner creates a visible 12px inner rounding that doesn't match the 16px container rounding.

### Fix Approach

**Issue 1 — Mobile sub-nav:** Make the `MobileSubNav` wrapper `sticky top-0 z-sticky` so it sticks below the global header. Since the community page content is inside the scrollable `overflow-y-auto` content area, making the sub-nav sticky within that scroll container will keep it at the top of the scrollable area (which is below the global header).

**Issue 2 — Desktop overlap:** Remove the negative top margin (`-mt-4 sm:-mt-6 lg:-mt-8`) from the community page container. Keep the negative side margins (`-mx-4 sm:-mx-6 lg:-mx-8`) for full-bleed width. The content area already has `pt-0`, so removing the negative top margin means content will start at the top of the content area (right below the desktop header) with no gap.

**Issue 3 — Border-radius:** Remove `rounded-t-xl` from the cover banner div. The parent's `overflow-hidden` + `rounded-2xl` already clips it correctly.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Mobile sub-nav | MobileSubNav | `features/community/components/MobileSubNav.tsx` |
| Profile card | ProfileCard | `features/community/components/ProfileCard.tsx` |
| Community page | CommunityPage | `app/[locale]/dashboard/community/page.tsx` |

### New Components

None needed.

## Security & Risk Assessment

### Threats Identified

None. This is a CSS-only visual fix with no data flow, API, or business logic changes.

### Issues & Risks Summary

1. **Low risk:** Negative margin removal might affect other pages if they share the same pattern — verify community page is the only page using this full-bleed technique that causes overlap
2. **Low risk:** Sticky positioning within a scroll container behaves differently across browsers — test on iOS Safari and Android Chrome

## Edge Cases & Error Handling

- MobileSubNav with long tab labels: Already handled (fixed 4-tab layout with `min-w-[56px]`)
- Very small screen widths (<320px): Verify no horizontal overflow with sticky sub-nav
- Landscape mode on mobile: Verify headers don't consume too much vertical space

## Dependencies & Assumptions

- The global mobile header remains `sticky top-0 z-sticky`
- The content area remains `overflow-y-auto` (required for sticky within scroll container to work)
- No other pages use the same `-mt-*` full-bleed pattern that would need the same fix

## Out of Scope

- Redesigning the community page layout
- Changing the global header behavior
- Modifying other pages' layouts
- Adding new features to the community page
