# Sidebar V2 Redesign Specification

**Date:** 2026-03-09
**Branch:** `feat/v2-design-migration`
**Design source:** `design/pencil/design-v2/sidebar.pen`
**Status:** Draft

---

## Summary

Redesign the desktop sidebar and mobile navigation to match the four-screen layout defined in `sidebar.pen`: Expanded Sidebar, Collapsed Sidebar, Mobile Bottom Nav, and Mobile Slide-out Menu.

The primary structural change is **nav item grouping**: Home and Portfolio are elevated into a "Premium Card" — a gradient-bordered container that visually separates them from the flat "Standard" group (Transactions, Wallets, Reports, Budget). All other visual changes are refinements to colors, spacing, and icon container sizing to match V2 design tokens precisely.

The redesign is purely a frontend UI change. No new API endpoints, no data model changes, no authentication changes.

---

## User Stories

- **US-1:** As a user, I want the sidebar to visually distinguish high-level views (Home, Portfolio) from operational views (Transactions, Wallets, Reports, Budget) so that the navigation hierarchy feels intentional.
- **US-2:** As a user, I want the collapsed sidebar to show clearly which item is active via a bordered icon container, so I know where I am without expanding the sidebar.
- **US-3:** As a user on mobile, I want the bottom nav active dot indicator to match the refined V2 design.
- **US-4:** As a user on mobile, I want the slide-out menu to use the same Premium Card grouping as the desktop sidebar for a consistent experience.

---

## Functional Requirements

### FR-1: Premium Card Grouping in Expanded Sidebar

The nav section of the desktop expanded sidebar must be split into two visually distinct groups.

**Premium Card group** (Home + Portfolio):
- Wrapped in a container `div` with:
  - Background: linear gradient `180deg`, `#FFFFFF` 0%, `#FEF2F233` 50%, `#FEE2E240` 100%
  - Border: 1px solid `#EDE8E1` (matches `v2-border-light`)
  - Border radius: 16px (`rounded-2xl`)
  - Box shadow: `0 2px 8px rgba(0,0,0,0.04)` (approximately `shadow-sm`, or inline style)
  - Padding: 6px (`p-1.5`)
  - Gap between items: 2px (`gap-0.5`)
- Home and Portfolio `NavItem` instances are rendered inside this container

**Standard group** (Transactions, Wallets, Reports, Budget):
- No wrapping card — plain vertical flex with `gap-0.5` (2px)
- Sits below the Premium Card with a `mt-3` gap (12px)
- Each item uses existing `NavItem` styling for inactive state

**Gap between groups:** 12px (`gap-3` or `mt-3`).

**Acceptance criteria:**
- [ ] Home and Portfolio appear inside a visually distinct gradient card
- [ ] Card has border, border-radius 16px, and soft shadow
- [ ] Transactions, Wallets, Reports, Budget appear as a flat list below
- [ ] 12px vertical gap separates the two groups
- [ ] Grouping persists in both expanded and collapsed sidebar states

---

### FR-2: NavItem Active / Inactive State Tokens

Verify and apply exact V2 token values from the design file to `NavItem.tsx`.

**Active item (Home/Portfolio when active, or any Standard item when active):**
- Background: `bg-v2-red-light` (`#FEF2F2`)
- Text: `text-v2-red-primary` (`#B91C1C`)
- Icon fill: `#B91C1C` (passed via `currentColor` — icon inherits text color)
- Font weight: 600 (`font-semibold`)
- Border radius: 10px (`rounded-xl` = 12px in Tailwind; use `rounded-[10px]` for exactness)
- Padding: 10px vertical, 12px horizontal (`py-2.5 px-3`)
- Gap icon-to-label: 12px (`gap-3`)

**Inactive item:**
- Background: none (transparent)
- Text: `text-v2-text-secondary` (`#57534E`)
- Icon fill: `#57534E`
- Font weight: 500 (`font-medium`)
- Same padding and gap as active
- Hover: `hover:bg-v2-bg-primary` (`#FAF9F7`)

**Current implementation in `NavItem.tsx` (lines 35–41):** Already uses `text-v2-red-primary bg-v2-red-light` for active and `text-v2-text-secondary hover:bg-v2-bg-primary` for inactive. Font weight difference (600 active vs 500 inactive) should be verified and applied if missing.

**Acceptance criteria:**
- [ ] Active item: `font-semibold` (weight 600), red text, red-light background
- [ ] Inactive item: `font-medium` (weight 500), secondary text, transparent background
- [ ] Hover state on inactive items shows `bg-v2-bg-primary`
- [ ] Icon inherits text color (no separate icon color prop needed)

---

### FR-3: Collapsed Sidebar Icon Container Styling

When the sidebar is collapsed (`isExpanded === false`), each nav item renders as a 44×44 icon container. The container styling must differ between Premium items and Standard items, and between active and inactive states.

**Premium active icon container** (Home or Portfolio, when that route is active):
- Size: 44×44 (`w-11 h-11`)
- Background: `#FEF2F2` (`bg-v2-red-light`)
- Border: 1.5px solid `#FECACA` (Tailwind: `border-[1.5px] border-[#FECACA]` or `border-[1.5px] border-primary-200`)
- Border radius: 12px (`rounded-xl`)
- Icon: 22×22, color `#B91C1C`

**Premium inactive icon container** (Home or Portfolio, when the other is active):
- Size: 44×44
- Background: `#FEF2F210` (nearly transparent red; Tailwind: `bg-v2-red-light/5` or inline)
- No border
- Border radius: 12px (`rounded-xl`)
- Icon: 22×22, color `#57534E`

**Standard icon containers** (Transactions, Wallets, Reports, Budget — always no background):
- Size: 44×44
- No background, no border
- Border radius: 12px (`rounded-xl`)
- Icon: 22×22, color `#78716C` (`text-v2-text-tertiary`)
- Hover: `hover:bg-v2-bg-primary`

**Gap between Premium containers:** 4px (`gap-1`)
**Gap between Premium group and Standard group (collapsed):** 16px (`mt-4` or `gap-4`)
**Gap between Standard containers:** 4px (`gap-1`)

**Implementation note:** The current `NavItem.tsx` uses `scale-110` on the icon wrapper when collapsed, which is a 20×20 icon scaled up. The redesign replaces this with explicit 22×22 sizing and a 44×44 container `div`. The `NavItem` component needs a new `isPremium?: boolean` prop so `layout.tsx` can signal which items get the Premium active/inactive container treatment.

**Acceptance criteria:**
- [ ] All collapsed icons appear in 44×44 containers with `rounded-xl`
- [ ] Active Premium item has red-light background + 1.5px `#FECACA` border
- [ ] Inactive Premium item has near-transparent red background, no border
- [ ] Standard items have no background in collapsed state
- [ ] Correct gap values between groups in collapsed state
- [ ] Tooltips still appear on hover for all collapsed items (existing `NavTooltip` behavior preserved)

---

### FR-4: Sidebar Toggle Button Positioning and Icon

The toggle button (`SidebarToggle`) must be repositioned to sit **between** the nav section and the user section, separated by dividers.

**Target layout (bottom of sidebar, expanded):**
```
[nav items]
[flex spacer — pushes everything below down]
[1px divider — border-v2-border-light]
[8px gap]
[Settings nav item]
[SidebarToggle — panel-left-close icon]
[8px gap]
[1px divider — border-v2-border-light]
[8px gap]
[User section]
```

**Current layout (layout.tsx lines 315–385):** Toggle is in its own `div` with `p-5` padding, user section is in a separate `border-t` div below. These two sections need to be reorganized to match the target layout above.

**Toggle button design:**
- Width: full when expanded, 44×44 when collapsed
- Background: `bg-v2-bg-primary`
- Hover: `hover:bg-v2-border-light`
- Border radius: 10px (`rounded-xl`)
- Height: 44px (`h-11`) — increase from current `h-8` to match icon wrap size
- Icon: `PanelLeftClose` from lucide-react when expanded, `PanelLeftOpen` when collapsed (currently uses a double-chevron SVG — replace with lucide icons)
- Icon color: `#78716C` (`text-v2-text-tertiary`)
- Label text when expanded: use `t("collapse")` / `t("expand")` (already in i18n)

**Acceptance criteria:**
- [ ] Toggle appears between Settings nav item and User section
- [ ] Two 1px dividers with 8px gaps frame the toggle area
- [ ] `PanelLeftClose` icon shown when expanded, `PanelLeftOpen` when collapsed
- [ ] Toggle button is 44px tall in both states
- [ ] Existing `useSidebarState` hook and `localStorage` persistence unchanged

---

### FR-5: Mobile Slide-out Menu Premium Card Grouping

The mobile slide-out menu (`navigationItems` in `layout.tsx`, lines 117–186) must apply the same Premium Card grouping as the desktop expanded sidebar.

**Premium Card (mobile):**
- Same gradient background, border, border-radius 16px, and shadow as desktop (FR-1)
- Padding: 6px
- Font size: 15px (`text-[15px]`) per design — slightly larger than desktop 14px
- Icon size: 22×22 (`size={22}`)
- Item padding: 12px vertical, 14px horizontal (`py-3 px-3.5`)
- Home active: red-light background, red text, red icon
- Portfolio inactive: secondary text, secondary icon

**Standard group (mobile):**
- Same flat list structure, no card wrapper
- Font size: 15px, icon 22×22, same padding as Premium items

**Active dot badge:** Do NOT add a badge dot to mobile menu nav items. (User decision confirmed: skip active dot badge in mobile slide-out.)

**Logout button:** Keep existing styling — `text-v2-text-secondary hover:bg-v2-bg-primary`. Do NOT apply red color to logout.

**Acceptance criteria:**
- [ ] Mobile slide-out Premium Card matches desktop card styling
- [ ] Home and Portfolio are inside the card; other items are below as a flat list
- [ ] No red dot badge on any mobile slide-out item
- [ ] Logout button retains neutral secondary text color
- [ ] Settings link uses same neutral styling

---

## Non-Functional Requirements

- **Performance:** No new dependencies. Changes are additive CSS/class changes. DOM node count increases minimally (one extra `div` wrapper per section).
- **Accessibility:**
  - The Premium Card wrapper `div` must be presentational only — no `role` attribute needed
  - `NavItem` `aria-current="page"` behavior is preserved via `ActiveLink`
  - `SidebarToggle` `aria-expanded` and `aria-label` must be updated if the icon changes
  - All 44×44 icon containers in collapsed mode meet the 44px minimum touch target requirement
- **Responsive:** Desktop changes apply at `sm:` breakpoint (640px). Mobile slide-out and bottom nav changes apply below `sm:`.
- **Animation:** Existing `transition-all duration-300 ease-in-out` on sidebar width must be preserved. No new animation keyframes needed.
- **No hardcoded pixel widths:** Sidebar widths use Tailwind classes only: `sm:w-64 lg:w-72` (expanded) and `sm:w-20` (collapsed, 80px). Pixel values in this spec are design reference values, not inline style values.
- **i18n:** All new strings (none expected) must go through `next-intl`. Existing translation keys are reused.

---

## Architecture Changes (C4)

### Diagrams to Update

- `docs/architecture/c4-component-frontend.md` (L3 Frontend Components): Add a note that the Sidebar Navigation component now has a "Premium Card" sub-group for Home and Portfolio items. No structural change to bounded contexts or component boundaries — this is a styling update within the existing `DashboardLayout` component.

### New Diagrams

None. This is a within-component visual redesign. No new component boundaries, no new data flows.

---

## Runtime Flow Diagrams

None required. No new user actions, no new API calls, no new state machines.

The sidebar toggle flow (`useSidebarState` → `localStorage` → `isExpanded` → class changes) is unchanged.

---

## Data Model Changes

None.

---

## API Changes

None.

---

## UI/UX Changes

### 1. Expanded Sidebar (desktop, `sm:` and above)

**Before (current `layout.tsx` nav section):**
```
[nav — flat list, gap-1]
  Home
  Transactions
  Wallets
  Portfolio
  Reports
  Budget
  [divider]
  Settings
[p-5 wrapper]
  SidebarToggle (double-chevron, bg-v2-bg-primary, h-8)
[p-4 border-t wrapper]
  [Avatar] Name / Email
  Logout
```

**After (V2 target):**
```
[nav — flex-col]
  [Premium Card — gradient bg, border, rounded-2xl, p-1.5, gap-0.5]
    Home       (active: red-light bg, red text, semibold)
    Portfolio  (inactive: transparent, secondary text, medium)
  [gap: 12px]
  [Standard flat list — gap-0.5]
    Transactions
    Wallets
    Reports
    Budget
  [flex-1 spacer]
  [1px divider border-v2-border-light]
  [8px gap]
  Settings    (tertiary text #78716C, secondary icon)
  SidebarToggle (PanelLeftClose icon, tertiary text, h-11, full-width)
  [8px gap]
  [1px divider border-v2-border-light]
  [8px gap]
  [User Section — p-2, rounded-xl, gap-3, items-center]
    [Avatar 36×36, bg-v2-red-primary, rounded-full, initial "K"]
    [User info — gap-0.5]
      Name  (13px, medium, text-primary)
      Email (11px, JetBrains Mono, tertiary)
    [EllipsisVertical icon 16×16, tertiary]
```

**Design token reference for Premium Card wrapper:**
```css
background: linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%);
border: 1px solid #EDE8E1;
border-radius: 16px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
padding: 6px;
gap: 2px;
```

**Tailwind implementation sketch:**
```tsx
{/* Premium Card */}
<div
  className="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
  style={{
    background: "linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%)"
  }}
>
  <NavItem href={routes.home} isPremium ... />
  <NavItem href={routes.portfolio} isPremium ... />
</div>

{/* Gap */}
<div className="mt-3" />

{/* Standard group */}
<div className="flex flex-col gap-0.5">
  <NavItem href={routes.transaction} ... />
  <NavItem href={routes.wallets} ... />
  <NavItem href={routes.report} ... />
  <NavItem href={routes.budget} ... />
</div>
```

---

### 2. Collapsed Sidebar (desktop, `sm:w-20` = 80px)

**Before:** All items are centered icon-only using `scale-110` on the icon wrapper inside `NavItem`. No explicit container sizing.

**After (V2 target):**
```
[sidebar — w-20, center-aligned, py-6, px-0]
  [Logo — 40×40, bg-v2-red-primary, rounded-xl, "W" 20px bold]
  [24px spacer]
  [Premium group — flex-col gap-1]
    [Active item: 44×44, bg-v2-red-light, border-[1.5px] border-[#FECACA], rounded-xl]
      House icon 22×22, color #B91C1C
    [Inactive item: 44×44, bg-v2-red-light/5, rounded-xl]
      ChartNoAxesCombined icon 22×22, color #57534E
  [16px gap]
  [Standard group — flex-col gap-1]
    [44×44 icon container, rounded-xl, no bg] ArrowLeftRight 22×22 #78716C
    [44×44 icon container, rounded-xl, no bg] Wallet 22×22 #78716C
    [44×44 icon container, rounded-xl, no bg] ChartPie 22×22 #78716C
    [44×44 icon container, rounded-xl, no bg] Calculator 22×22 #78716C
  [flex-1 spacer]
  [44×1px divider]
  [8px gap]
  [44×44 Settings icon container, rounded-xl, icon #78716C]
  [4px gap]
  [44×44 Toggle icon container, rounded-xl, PanelLeftOpen icon #78716C]
  [8px gap]
  [44×1px divider]
  [8px gap]
  [Avatar — 36×36, bg-v2-red-primary, rounded-full, "K" white 14px 600]
```

**Key implementation notes for `NavItem` in collapsed state:**
- Replace `scale-110` approach with explicit `w-11 h-11 flex items-center justify-center rounded-xl` container
- `isPremium` prop controls whether active state uses the bordered container vs plain transparent
- Standard items always use plain transparent container in collapsed state

---

### 3. Mobile Bottom Nav

**Current implementation (`BottomNav.tsx`):** Already close to spec. Verify the following:

- Active dot: `w-1 h-1 rounded-full bg-v2-red-primary` at `-bottom-1` (5×5 dot — 4px = `w-1`, close enough; design says 5×5 but `w-1.5 h-1.5` = 6px is also acceptable)
- Active icon: scaled `scale-110`, color `text-v2-red-primary`
- Active label: `text-v2-red-primary font-medium`
- Inactive: `text-v2-text-tertiary` (`#78716C`) for icon and label — current code uses `text-neutral-600` for the `<a>` wrapper

**Required change:** Update inactive item color from `text-neutral-600` to `text-v2-text-tertiary` to match design exactly (`#78716C` vs `#4B5563`).

**No structural changes needed to `BottomNav.tsx`.**

**Acceptance criteria:**
- [ ] Inactive icon/label color is `text-v2-text-tertiary` (`#78716C`)
- [ ] Active dot is 5×5 (`w-1.5 h-1.5` rounds to 6px, acceptable) below icon
- [ ] Active text/icon is `text-v2-red-primary`
- [ ] Border top is `border-v2-border-light` (already correct)
- [ ] Background is `bg-white` (already correct)

---

### 4. Mobile Slide-out Menu

**Before (current `navigationItems` in `layout.tsx`):**
```
[flex-col gap-1 px-3]
  Home        (flat list item)
  Transactions
  Wallets
  Portfolio
  Reports
  Budget
  [divider]
  Settings
  Logout
```

**After (V2 target):**
```
[flex-col gap-3 px-3]  (outer container)
  [Premium Card — same gradient, border-2xl, p-1.5, gap-0.5]
    Home        (active: red-light, red text, semibold, py-3 px-3.5, icon 22×22)
    Portfolio   (inactive: transparent, secondary text, medium, py-3 px-3.5, icon 22×22)
  [Standard flat list — gap-0.5]
    Transactions  (py-3 px-3.5, icon 22×22, 15px text)
    Wallets
    Reports
    Budget
  [divider]
  Settings      (neutral, py-3 px-3.5)
  Logout        (neutral — keep as-is, NOT red)
```

**Mobile-specific sizing (from design):**
- Label font: 15px (`text-[15px]`)
- Icon size: 22×22 (`size={22}`)
- Item vertical padding: 12px (`py-3`)
- Item horizontal padding: 14px (`px-3.5`)

No active dot badge in slide-out menu items. The badge dot is a bottom-nav-only indicator.

---

## Component Changes Summary

| Component | File | Change Type | Description |
|-----------|------|-------------|-------------|
| `NavItem` | `components/navigation/NavItem.tsx` | Modify | Add `isPremium?: boolean` prop; update collapsed state to use 44×44 container with conditional border for active Premium items; fix font-weight (semibold active vs medium inactive) |
| `SidebarToggle` | `components/navigation/SidebarToggle.tsx` | Modify | Replace double-chevron SVG with `PanelLeftClose` / `PanelLeftOpen` lucide icons; increase height to `h-11`; adjust border-radius to `rounded-xl` |
| `DashboardLayout` | `app/[locale]/dashboard/layout.tsx` | Modify | Wrap Home + Portfolio in Premium Card container; restructure bottom of sidebar (dividers + toggle + user section); update `navigationItems` for mobile with Premium Card grouping and 15px/22px sizing |
| `BottomNav` | `components/navigation/BottomNav.tsx` | Modify | Change inactive color from `text-neutral-600` to `text-v2-text-tertiary` |

---

## Security & Risk Assessment

### Risk Level: Low

This is a pure frontend visual redesign. No authentication changes, no API surface changes, no data access pattern changes.

### Threats

| # | Threat | Severity | Mitigation |
|---|--------|----------|------------|
| T-1 | Gradient background using inline `style` prop — potential XSS if value is ever user-controlled | Low | Value is a hardcoded string literal, never interpolated from user input |
| T-2 | Restructuring sidebar layout could accidentally hide the logout button | Low | Covered by acceptance criteria; manual QA on both expanded and collapsed states |
| T-3 | Z-index conflicts during sidebar toggle animation | Low | Existing `ZIndex.sidebar` constants unchanged; no new stacking contexts introduced |

### Authorization Rules

No changes. Sidebar is only rendered inside `AuthCheck` wrapper — unchanged.

### Input Validation Rules

No user input involved in this change.

---

## Edge Cases

1. **Both Home and Portfolio are active simultaneously:** Not possible — only one route can match at a time. No special handling needed.

2. **Neither Home nor Portfolio is the active route:** Both Premium Card items render in their inactive state. The Premium Card itself has no active/inactive state — its gradient background is always visible.

3. **Sidebar collapses while user is on Portfolio:** The Portfolio icon container must immediately show the active Premium style (red-light background, `#FECACA` border). No transition delay issue since `isActive` is derived from `path` which is always up-to-date.

4. **Long user name in user section:** Already handled by `truncate` class on name and email elements. No change needed.

5. **User has a profile picture (Google OAuth):** The user section renders `NextImage` instead of the initial letter. In this case the avatar background (`bg-v2-red-primary`) is hidden behind the image. Design shows initials-only version, but the image fallback is correct behavior.

6. **Mobile slide-out open during sidebar collapse/expand:** Mobile slide-out and desktop sidebar are mutually exclusive (mobile slide-out only renders on `< sm:` breakpoint, desktop sidebar only on `sm:` and above via `hidden sm:flex`). No conflict.

7. **`PanelLeftClose` / `PanelLeftOpen` not available in installed lucide-react version:** Verify the icons exist in the project's installed version before using them. If unavailable, use `ChevronLeft` / `ChevronRight` as fallback (current behavior). Confirm with `grep -r "PanelLeft" node_modules/lucide-react/dist/` or check lucide-react changelog.

8. **Gradient background not supported (very old browsers):** CSS linear-gradient is supported in all modern browsers including Safari 6.1+. No fallback needed for the target audience.

---

## Dependencies & Assumptions

- **`lucide-react`** is already installed. `PanelLeftClose` and `PanelLeftOpen` icons must be verified to exist in the installed version before use.
- **Tailwind `border-[1.5px]`** — arbitrary border width. Tailwind v3 supports arbitrary values. Verify the project's Tailwind version (currently `tailwindcss: ^3.4` per `tailwind.config.ts`). This is supported.
- **`cn` utility** from `@/lib/utils/cn` — already used in all navigation components. No change.
- **`v2-text-tertiary` token** (`#78716C`) is already defined in `tailwind.config.ts`. Settings nav item and collapsed Standard icons should use this token.
- **`v2-border-light` token** (`#EDE8E1`) is already defined. Used for Premium Card border and dividers.
- **`v2-red-light` token** (`#FEF2F2`) is already defined. Used for active item background.
- **`v2-bg-primary` token** (`#FAF9F7`) is already defined. Used for hover states.
- **`useSidebarState` hook** persists `isExpanded` to `localStorage` — unchanged. The hook's API (`isExpanded`, `toggle`) is unchanged.
- **`NavTooltip`** component is unchanged and continues to wrap collapsed `NavItem` instances for hover tooltips.
- **Translation keys:** No new keys needed. Existing `nav.*` keys cover all labels. `sidebarToggle.collapse` / `sidebarToggle.expand` keys are already in use by `SidebarToggle.tsx`.
- **`animationDelay` prop on `NavItem`:** The staggered text-reveal animation delay is preserved as-is. Delays: Home 0ms, Portfolio 30ms, Transactions 60ms, Wallets 90ms, Reports 120ms, Budget 150ms, Settings 180ms.

---

## Out of Scope

- Adding new navigation destinations (no new routes added)
- Changing the 6-item limit in mobile `BottomNav` (structure unchanged)
- Redesigning the desktop top bar (greeting + search + bell) — unchanged
- Changing the `FloatingActionButton` — unchanged
- Adding a "notification" dot or badge to any nav item
- Active dot badge in the mobile slide-out menu (explicitly excluded per user decision)
- Making the logout button red in mobile slide-out (explicitly excluded per user decision)
- Dark mode variants for the Premium Card gradient (out of scope for this iteration)
- Animating the Premium Card gradient on hover
- Changes to the `GlobalSearch` component or keyboard shortcut
- Changes to the `NavTooltip` positioning or delay timing
- Updating `docs/architecture/c4-component-frontend.md` (low priority, optional follow-up)
