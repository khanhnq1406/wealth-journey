# Sidebar Cleanup Specification

## Summary

Clean up the dashboard sidebar by removing unused items (Prices page, CurrencySelector), adding a logout button to the desktop sidebar, and ensuring the current active page is visually clear. These changes apply to both desktop sidebar and mobile slide-out menu.

## User Stories

- As a user, I want a logout button on the desktop sidebar so I can sign out without needing the mobile menu
- As a user, I don't need the Prices navigation item cluttering my sidebar since it's not a primary workflow
- As a user, I don't need the currency preference selector in the sidebar since I rarely change it
- As a user, I want to clearly see which page I'm currently on in the sidebar

## Functional Requirements

### FR-1: Remove Prices Navigation Item

Remove the Prices (`/dashboard/prices`) nav item from:
- Desktop sidebar `NavItem` list (layout.tsx lines 272-279)
- Mobile slide-out menu `navigationItems` array (layout.tsx lines 133-137)

The `/dashboard/prices` route and page remain accessible via URL — only the navigation entry is removed.

**Acceptance criteria:**
- [ ] Prices NavItem removed from desktop sidebar
- [ ] Prices entry removed from mobile slide-out menu
- [ ] Animation delays re-sequenced (0, 30, 60, 90, 120, 150 for 6 remaining items + Settings at 180)
- [ ] Prices page still accessible via direct URL
- [ ] No unused imports (`CircleDollarSign` icon can be removed if no longer used)

### FR-2: Add Logout Button to Desktop Sidebar

Add a logout button below the user info section at the bottom of the desktop sidebar, replacing the space where the CurrencySelector was.

**Design:**
- Same visual weight as the user info section
- Uses `LogOut` icon from lucide-react (already imported)
- Text label "Logout" (with i18n via `t("logout")`) — visible when sidebar is expanded
- Tooltip showing "Logout" when sidebar is collapsed
- Hover state: `hover:bg-v2-bg-primary` (consistent with nav items)
- Text color: `text-v2-text-secondary` (matching other items)
- Only visible when sidebar is expanded: show full button with icon + text
- When collapsed: show icon only with tooltip (similar to NavItem collapsed behavior)

**Acceptance criteria:**
- [ ] Logout button visible at bottom of desktop sidebar (below user info)
- [ ] Click triggers `logout()` function (already imported)
- [ ] Shows icon + text when expanded, icon-only when collapsed
- [ ] Tooltip on hover when collapsed
- [ ] Proper hover states and transitions
- [ ] Accessible: `aria-label` attribute present

### FR-3: Ensure Active Page Display in Sidebar

The `ActiveLink` component already compares `pathname === href` and applies `aria-current="page"`. However, the `NavItem` component's `isActive` prop is always `false` by default. The active styling actually works through `ActiveLink`'s internal className logic which applies `bg-white/30` — but this conflicts with the V2 design system colors in `NavItem`.

**Current issue:** `ActiveLink` applies old V1 styles (`bg-white/30 shadow-md border-l-4 border-white`) which get overridden by `NavItem`'s className. Need to verify the active state is visually clear with V2 styling.

**Investigation needed during implementation:**
- Check if `ActiveLink`'s base classes conflict with `NavItem`'s classes
- The `pathname` comparison in `ActiveLink` uses `usePathname()` from `next/navigation` — with locale prefix (`/en/dashboard/home`), the comparison `pathname === "/dashboard/home"` may fail

**Acceptance criteria:**
- [ ] Active page NavItem has distinct visual styling (red text + light red background)
- [ ] Active state works correctly with locale-prefixed paths
- [ ] Only one item highlighted at a time
- [ ] Active state visible in both expanded and collapsed sidebar modes

### FR-4: Remove CurrencySelector from Sidebar

Remove the `CurrencySelector` component from:
- Desktop sidebar user section (layout.tsx lines 360-372)
- Mobile slide-out menu user info section (layout.tsx lines 493-495)

**Acceptance criteria:**
- [ ] CurrencySelector removed from desktop sidebar
- [ ] CurrencySelector removed from mobile slide-out menu
- [ ] `CurrencySelector` import can be removed if no longer used anywhere in layout
- [ ] `CurrencyProvider` wrapper remains (other components may use currency context)
- [ ] User section layout adjusts cleanly without CurrencySelector

## Non-Functional Requirements

- **Performance:** No impact — removing items reduces DOM nodes
- **Accessibility:** Logout button must have proper `aria-label`; active page must have `aria-current="page"`
- **Responsive:** Changes apply to both desktop sidebar (>800px) and mobile slide-out menu

## Architecture Changes (C4)

### Diagrams to Update

- `docs/architecture/c4-component-frontend.md` — Minor update: note that Prices is no longer in primary navigation, logout added to sidebar. Not critical.

### New Diagrams

None needed — this is a UI-only change within existing components.

## Runtime Flow Diagrams

No new flow diagrams needed. The logout flow already exists in `flow-auth.md`.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

### Desktop Sidebar (Before → After)

**Before:**
```
[W] WealthJourney
├── Home
├── Transactions
├── Wallets
├── Portfolio
├── Prices          ← REMOVE
├── Reports
├── Budget
├── ─────────
├── Settings
├── [Toggle ↔]
├── ─────────
├── [Avatar] Name
│            Email
└── [CurrencySelector]  ← REMOVE
```

**After:**
```
[W] WealthJourney
├── Home
├── Transactions
├── Wallets
├── Portfolio
├── Reports
├── Budget
├── ─────────
├── Settings
├── [Toggle ↔]
├── ─────────
├── [Avatar] Name
│            Email
└── [LogOut] Logout     ← ADD
```

### Mobile Slide-out Menu (Before → After)

**Before:**
```
[W] WealthJourney  [X]
├── Home
├── Transactions
├── Wallets
├── Portfolio
├── Prices          ← REMOVE
├── Reports
├── Budget
├── ─────────
├── Settings
├── Logout
├── ─────────
├── [Avatar] Name / Email
└── [CurrencySelector]  ← REMOVE
```

**After:**
```
[W] WealthJourney  [X]
├── Home
├── Transactions
├── Wallets
├── Portfolio
├── Reports
├── Budget
├── ─────────
├── Settings
├── Logout
├── ─────────
└── [Avatar] Name / Email
```

## Security & Risk Assessment

### Risk Level: Low

This is a UI-only change. No API changes, no data model changes, no authorization changes.

### Threats

| # | Threat | Severity | Mitigation |
|---|--------|----------|------------|
| T-1 | Logout button could be spoofed/hidden by CSS injection | Low | CSP headers already in place; no user-controlled CSS |
| T-2 | Removing Prices from nav doesn't remove the route — users can still access it | Low | Intentional; the page remains functional |

### Authorization Rules

No changes. Logout uses existing `logout()` function which already handles token cleanup and redirect.

### Input Validation Rules

No user input involved.

## Edge Cases & Error Handling

1. **Logout fails (network error):** Already handled by `logout()` — uses `finally` block to clear local state regardless
2. **Locale prefix in pathname:** Need to verify `ActiveLink`'s `pathname === href` works with `/en/dashboard/home` vs `/dashboard/home`
3. **Sidebar collapsed state:** Logout button must degrade gracefully to icon-only with tooltip

## Dependencies & Assumptions

- `logout()` function already imported and working in layout.tsx
- `LogOut` icon already imported from lucide-react
- `NavTooltip` component available for collapsed tooltip behavior
- Translation keys `nav.logout` already exists (used in mobile menu)

## Out of Scope

- Removing the `/dashboard/prices` page itself (only removing navigation entry)
- Changing the `CurrencyProvider` or currency context (only removing the UI selector)
- Redesigning the sidebar layout or adding new features
- Changing the mobile bottom navigation (6 items remain unchanged)
