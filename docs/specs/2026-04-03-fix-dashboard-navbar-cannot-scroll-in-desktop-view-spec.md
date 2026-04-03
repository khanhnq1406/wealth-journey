# Fix Dashboard Navbar Cannot Scroll in Desktop View — Specification

## Summary

The desktop sidebar navbar does not scroll when navigation items overflow the visible viewport height. Users on smaller screens (or with many nav items including the admin item) cannot reach Settings, Guide, and Admin links. The root cause is a CSS layout conflict: the inner flex container inside `<nav>` uses `h-full`, which constrains its height to exactly the nav's computed height so no overflow is generated and `overflow-y-auto` never activates. The fix removes `h-full` and the `flex-1` spacer from the inner wrapper, moves all nav items into the natural scroll flow, and keeps only the User Info + Logout button (already rendered outside `<nav>`) pinned to the sidebar bottom.

## User Stories

- As a user on a small laptop, I want to scroll the sidebar nav to reach Settings and Guide links, so that I can access all navigation items regardless of viewport height.
- As an admin user, I want to be able to scroll to the Admin nav item when the sidebar is taller than the viewport, so that admin features remain accessible.

## Functional Requirements

### FR-1: All nav items scroll together

Settings, Guide, and Admin items are removed from the sticky-bottom position inside the `<nav>` inner wrapper and join the normal scroll flow along with Home, Portfolio, Community, Profile, Finance, Wallets, Prices, and Feedback.

**Acceptance criteria:**
- [ ] When the sidebar nav items overflow the viewport height, a scrollbar appears on the `<nav>` element.
- [ ] All 10–11 nav items (including Settings, Guide, Admin) are reachable by scrolling.
- [ ] No nav item is clipped or inaccessible at any standard viewport height (768px and above).

### FR-2: User Info + Logout remain pinned to sidebar bottom

The User Info block (avatar + name + email) and Logout button are already rendered outside `<nav>` in a dedicated `<div className="px-3 pt-2 pb-3 ...">` block. They must remain outside `<nav>` and continue to be pinned to the bottom of the sidebar at all times.

**Acceptance criteria:**
- [ ] User avatar, name/email, and Logout button are always visible at the bottom of the sidebar without scrolling.
- [ ] The SidebarToggle button (between nav and user section) also remains outside `<nav>` and stays at the bottom.

### FR-3: No visual regression in expanded and collapsed states

The sidebar must look correct in both expanded (`sm:w-64 lg:w-72`) and collapsed (`sm:w-20`) states. The premium card group and standard group spacing must be preserved.

**Acceptance criteria:**
- [ ] Expanded sidebar: nav item labels are visible, groups are properly spaced.
- [ ] Collapsed sidebar: icon-only mode, tooltips still function.
- [ ] Section divider (`border-t`) between standard items and Settings/Guide is removed (it was part of the spacer+divider pattern). Items may optionally have a top margin for visual separation.

## Non-Functional Requirements

- **Performance:** Pure CSS/Tailwind change — zero runtime cost.
- **Accessibility:** Scrollable `<nav>` must have native browser scrollbar (no custom scroll that loses keyboard accessibility). Arrow-key navigation within the nav must still work.
- **Security:** No backend changes. No new data flows. No security impact.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md`** — No structural change. The DashboardLayout component still exists with the same responsibilities. No update needed.

### New Diagrams

None required — this is a single-file CSS fix with no new components or data flows.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no new API endpoints, no business logic changes, no new branching.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

**File:** `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx`

### Change 1 — Remove `h-full` from inner nav wrapper (line 361)

**Before:**
```tsx
<div className="flex flex-col h-full">
```
**After:**
```tsx
<div className="flex flex-col">
```

**Why:** `h-full` forces the inner div to exactly equal the `<nav>`'s computed height. This prevents any overflow, so `overflow-y-auto` on `<nav>` never triggers. Removing it lets content grow naturally past the nav's bounds.

### Change 2 — Remove `flex-1` spacer and `border-t` divider (lines 458–460)

**Before:**
```tsx
{/* Spacer + Divider + Settings */}
<div className="flex-1" />
<div className="border-t border-v2-border-light" />
<div className="h-2" />
<NavItem href="/dashboard/settings" ... />
```
**After:**
```tsx
{/* Settings */}
<div className="mt-3" />
<NavItem href="/dashboard/settings" ... />
```

**Why:** The `flex-1` spacer only works inside a bounded-height flex container. Since we're removing `h-full`, the spacer would just push settings to the very end of potentially infinite content. Instead, use a simple top margin to visually separate settings from the main group. The `border-t` divider is also removed — the margin provides adequate visual separation; a border can be added back as a `mt-3 border-t border-v2-border-light pt-2` if desired for stronger separation.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Sidebar nav container | `DashboardLayout.tsx` `<nav>` + inner `<div>` | `app/[locale]/dashboard/DashboardLayout.tsx:357–491` |
| Nav items | `NavItem` | `components/navigation/NavItem.tsx` |
| Sidebar toggle | `SidebarToggle` | `components/navigation/SidebarToggle.tsx` |
| User section (pinned bottom) | Inline JSX in `DashboardLayout` | Lines 498–564 |

### New Components

None — change is entirely within existing `DashboardLayout.tsx`.

## Security & Risk Assessment

This is a pure CSS/Tailwind layout fix with no data flows crossing trust boundaries.

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| — | — | — | No | — | No new data flows introduced |

### Trust Boundaries

None crossed by this change.

### Threats Identified (STRIDE)

| Threat | Applies? | Notes |
|--------|----------|-------|
| Spoofing | No | No auth or identity logic changed |
| Tampering | No | No data or state mutation |
| Repudiation | No | No operations to log |
| Info Disclosure | No | No data exposed |
| DoS | No | CSS-only change |
| Elevation of Privilege | No | Admin NavItem visibility is still gated by `user?.isAdmin` — unchanged |

### Authorization Rules

Unchanged. The Admin nav item is still conditionally rendered only when `user?.isAdmin === true`.

### Input Validation Rules

None. No user input involved.

### External Dependency Risks

None. No new packages. No external API calls.

### Sensitive Data Handling

None. This change does not touch user data rendering (name/email/avatar remain in the pinned User Section outside `<nav>`).

### Issues & Risks Summary

1. **Visual regression risk (Low):** Removing the spacer+divider pattern changes the bottom spacing of the nav. Mitigation: use `mt-3` (or `mt-4` when collapsed) before Settings, matching the existing gap between premium and standard groups. Optionally retain the `border-t` as a prefix on the Settings group.
2. **Scroll UX on macOS (Low):** macOS hides scrollbars by default. The sidebar nav may not show a visible scrollbar even when scrollable. This is expected OS behavior and not a regression; keyboard and touch scroll still work.
3. **No regression on mobile (None):** The `<aside>` is `hidden sm:flex` — this fix only applies to `sm:` and above. The mobile slide-out nav is a separate code path (lines 640+) and is unaffected.

## Edge Cases & Error Handling

- **Admin item present:** With 11 items at ~44px each, total nav height ≈ 484px plus group padding. On a 768px viewport with the logo (~80px) + SidebarToggle (~50px) + User Section (~80px), available nav height ≈ 558px — items fit without scroll. On a 600px viewport (e.g., browser dev tools), scroll activates.
- **Collapsed state:** In collapsed mode, nav items shrink to icon-only but maintain `min-h-[44px]`. Same scroll behavior applies.
- **Zero nav items (impossible):** Home is always present; not a real edge case.

## Dependencies & Assumptions

- No changes to `NavItem`, `SidebarToggle`, or any other component.
- The User Section and SidebarToggle are already correctly placed outside `<nav>` (lines 493–564) and require no movement.
- The `<aside>` uses `min-h-screen fixed` positioning — the sidebar does not scroll; only the inner `<nav>` scrolls.

## Out of Scope

- Mobile navigation (BottomNav, slide-out menu) — separate code path, not affected.
- Reordering nav items.
- Adding or removing nav items.
- Custom scrollbar styling.
- Animated scroll or scroll-snap behavior.
