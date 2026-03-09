# Sidebar V2 Redesign — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Redesign desktop sidebar and mobile navigation to match V2 design — Premium Card grouping for Home + Portfolio, updated icon containers, repositioned toggle, and unified token usage.
**Spec:** `docs/specs/2026-03-09-sidebar-v2-spec.md`
**Architecture:** Pure frontend visual change touching 4 components. No API, no data model, no auth changes. Changes are additive CSS/class modifications with one new `isPremium` prop on `NavItem`.
**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 3.4, lucide-react ^0.577.0

---

## Security Implementation Notes

- No auth, API, or data access changes. Risk level: Low.
- The Premium Card gradient uses a hardcoded inline `style` prop — never interpolated from user data, so no XSS risk.
- Sidebar is rendered only inside `AuthCheck` wrapper — unchanged.

---

## C4 Architecture Diagram Updates

No updates required. The spec explicitly marks the C4 diagram update as "optional follow-up" (out of scope). This is an intra-component visual redesign with no new component boundaries.

---

## Task Overview

| # | Task | Files | Notes |
|---|------|-------|-------|
| 0 | Verify PanelLeft icons | read-only check | Already confirmed in plan step — icons exist in lucide-react 0.577.0 |
| 1 | Update `NavItem` — add `isPremium` prop + collapsed state | `NavItem.tsx` | Core change; all other tasks depend on this |
| 2 | Update `SidebarToggle` — lucide icons + h-11 + rounded-xl | `SidebarToggle.tsx` | Independent of Task 1 |
| 3 | Update `layout.tsx` — desktop sidebar restructure | `layout.tsx` | Depends on Task 1 |
| 4 | Update `layout.tsx` — mobile slide-out restructure | `layout.tsx` | Depends on Task 1; same file as Task 3, do after Task 3 |
| 5 | Update `BottomNav` — inactive color token | `BottomNav.tsx` | Fully independent |

**Parallelism:** Tasks 1, 2, and 5 are independent of each other and can proceed in parallel. Tasks 3 and 4 both modify `layout.tsx` and must be sequential (Task 3 then Task 4). Tasks 3 and 4 both depend on Task 1 completing first.

---

## Task 1: Update `NavItem` — `isPremium` prop + collapsed container

**Files:**
- Modify: `src/wj-client/components/navigation/NavItem.tsx`

**Security notes:** No user-facing input. Pure visual change.

**Context (from reading the file):**
- Current collapsed state uses `scale-110` on a `w-5 h-5` div — no explicit container size.
- Active state uses `text-v2-red-primary bg-v2-red-light` — already correct tokens.
- Missing `font-semibold` on active (currently only `font-medium` from base).

**Step 1: Understand the change needed**

The `NavItem` interface needs:
```
isPremium?: boolean  // true for Home and Portfolio items
```

Collapsed state needs to render a `44×44` container (`w-11 h-11`) instead of a scaled icon. When collapsed:
- **All items**: outer link is `justify-center px-0`, but the icon is now wrapped in an explicit `w-11 h-11 rounded-xl flex items-center justify-center` container
- **Premium + active**: container gets `bg-v2-red-light border-[1.5px] border-[#FECACA]`
- **Premium + inactive**: container gets `bg-v2-red-light/5` (no border)
- **Standard** (non-premium, regardless of active): container gets no background, no border; active standard items in collapsed state just show no container styling (the active item background on the link itself is also hidden in collapsed state — only the icon container matters)

Expanded state changes:
- Active items: add `font-semibold` (currently `font-medium` for all)
- Inactive items: add `font-medium` explicitly (no change from current behavior, but make it explicit)
- Icon size stays `w-5 h-5` in expanded state

**Step 2: Write the updated component**

```tsx
"use client";

import { memo } from "react";
import ActiveLink from "@/components/ActiveLink";
import { NavTooltip } from "./NavTooltip";
import { cn } from "@/lib/utils/cn";

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isExpanded?: boolean;
  isPremium?: boolean;
  showTooltip?: boolean;
  animationDelay?: number;
}

export const NavItem = memo(function NavItem({
  href,
  label,
  icon,
  isActive = false,
  isExpanded = true,
  isPremium = false,
  showTooltip = false,
  animationDelay = 0,
}: NavItemProps) {
  const linkContent = (
    <div className="relative">
      <ActiveLink
        href={href}
        className={cn(
          "flex items-center py-2.5 rounded-[10px] font-vietnam text-[14px] transition-all duration-300 ease-in-out touch-target",
          isActive
            ? "text-v2-red-primary bg-v2-red-light font-semibold"
            : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
          isExpanded ? "gap-3 px-3" : "justify-center px-0 gap-0",
        )}
      >
        {isExpanded ? (
          // Expanded state: simple 20×20 icon
          <div className="w-5 h-5 flex-shrink-0">
            {icon}
          </div>
        ) : (
          // Collapsed state: 44×44 container with conditional Premium styling
          <div
            className={cn(
              "w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0",
              isPremium && isActive && "bg-v2-red-light border-[1.5px] border-[#FECACA]",
              isPremium && !isActive && "bg-v2-red-light/5",
              // Standard items (not premium): no bg, no border — hover handled by parent link
            )}
          >
            <div className="w-[22px] h-[22px] flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-300 ease-in-out",
            isExpanded
              ? "opacity-100 w-auto translate-x-0"
              : "opacity-0 w-0 overflow-hidden -translate-x-2",
          )}
          style={{
            transitionDelay: isExpanded ? `${animationDelay}ms` : "0ms",
          }}
        >
          {label}
        </span>
      </ActiveLink>
    </div>
  );

  if (!isExpanded && showTooltip) {
    return <NavTooltip content={label}>{linkContent}</NavTooltip>;
  }

  return linkContent;
});
```

**Key decisions:**
- In collapsed state, the outer `ActiveLink` in collapsed mode no longer applies `bg-v2-red-light` since the container div handles Premium active styling. The link's `bg-v2-red-light` is driven by `isActive` — this is fine for expanded state, but in collapsed state the link has `justify-center px-0 gap-0` which makes it a thin wrapper around the container. The container div handles its own background, so the link background from `bg-v2-red-light` will still be applied to the outer link (full row). For collapsed state, the link itself should NOT apply a background — only the container div should.
- **Correction:** The collapsed link needs to suppress the active background at the link level so the container handles it. Adjust: when not expanded, don't apply `bg-v2-red-light` on the link — instead rely solely on the container div.

**Revised collapsed logic for the link className:**
```tsx
className={cn(
  "flex items-center py-2.5 rounded-[10px] font-vietnam text-[14px] transition-all duration-300 ease-in-out touch-target",
  isExpanded
    ? isActive
      ? "text-v2-red-primary bg-v2-red-light font-semibold gap-3 px-3"
      : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium gap-3 px-3"
    : cn(
        "justify-center px-0 gap-0",
        isActive ? "text-v2-red-primary font-semibold" : "text-v2-text-secondary font-medium",
      ),
)}
```
This way in collapsed state the link has text color (for icon inherit) but NO background — the container div handles background.

**Step 3: Validate by checking NavTooltip integration**
`NavTooltip` wraps the entire `linkContent` (the outer `div.relative`) — no change needed there.

---

## Task 2: Update `SidebarToggle` — Lucide icons, `h-11`, `rounded-xl`

**Files:**
- Modify: `src/wj-client/components/navigation/SidebarToggle.tsx`

**Security notes:** None — purely visual.

**Context (from reading the file):**
- Current: double-chevron SVG, `h-8`, `rounded-lg`, `w-full` or `w-8`
- Target: `PanelLeftClose` (expanded) / `PanelLeftOpen` (collapsed), `h-11`, `rounded-xl`, `w-full` or `w-11` (44px)
- `hover:scale-105 active:scale-95` — keep or remove? Spec doesn't mention it. Keep for UX.
- Icon color: `text-v2-text-tertiary` (currently `text-v2-text-secondary`) — update to tertiary.
- Remove `hover:scale-105` per spec (spec says only `hover:bg-v2-border-light`, no scale).

**Step 1: Write the updated component**

```tsx
"use client";

import { cn } from "@/lib/utils/cn";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface SidebarToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export const SidebarToggle = memo(function SidebarToggle({
  isExpanded,
  onToggle,
}: SidebarToggleProps) {
  const t = useTranslations("sidebarToggle");
  return (
    <button
      onClick={onToggle}
      className={cn(
        "hidden sm:flex items-center justify-center h-11 rounded-xl bg-v2-bg-primary hover:bg-v2-border-light active:scale-95 transition-all touch-target duration-300 ease-in-out",
        isExpanded ? "w-full" : "w-11",
      )}
      aria-label={isExpanded ? t("collapse") : t("expand")}
      aria-expanded={isExpanded}
      title={isExpanded ? t("collapse") : t("expand")}
    >
      {isExpanded ? (
        <PanelLeftClose className="w-5 h-5 text-v2-text-tertiary" />
      ) : (
        <PanelLeftOpen className="w-5 h-5 text-v2-text-tertiary" />
      )}
    </button>
  );
});
```

---

## Task 3: Update `layout.tsx` — Desktop Sidebar Restructure

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Specifically: the `<nav>` section (lines 239–313) and the toggle/user sections (lines 316–386)

**Dependencies:** Task 1 (NavItem now accepts `isPremium`)

**Security notes:** None — layout restructure, no data changes.

**Context:**

Current desktop sidebar structure (simplified):
```
<nav class="flex-1 overflow-y-auto px-3">
  <div class="flex flex-col gap-1">
    NavItem(home) NavItem(transactions) NavItem(wallets) NavItem(portfolio) NavItem(reports) NavItem(budget)
    [spacer div] [divider] NavItem(settings)
  </div>
</nav>
<div class="p-5">   ← toggle wrapper
  SidebarToggle
</div>
<div class="p-4 border-t">   ← user section
  avatar + name/email
  logout button
</div>
```

Target structure:
```
<nav class="flex-1 overflow-y-auto px-3">
  <div class="flex flex-col">
    [Premium Card wrapper — gradient, border, rounded-2xl, p-1.5, gap-0.5]
      NavItem(home, isPremium)
      NavItem(portfolio, isPremium)
    [mt-3]
    [Standard group — flex-col gap-0.5]
      NavItem(transactions) NavItem(wallets) NavItem(reports) NavItem(budget)
    [flex-1 spacer]
    [1px divider border-v2-border-light]
    [8px gap]
    NavItem(settings)
  </div>
</nav>
<div class="px-3 py-2 flex flex-col gap-2">   ← toggle area between nav and user
  SidebarToggle (full width)
</div>
<div class="px-3 pb-3 pt-0 flex flex-col gap-0">
  [1px divider] [8px gap]
  [user section]
</div>
```

Wait — spec says the target layout (bottom, expanded) is:
```
[flex spacer]
[1px divider]
[8px gap]
Settings nav item     ← this is INSIDE nav
SidebarToggle
[8px gap]
[1px divider]
[8px gap]
User section
```

So Settings, Toggle, and the dividers/user section should all be part of a reorganized bottom area. The most natural structure:

**Step 1: Plan the exact JSX restructure**

The nav `<div class="flex flex-col">` contains everything. Move the spacer, divider, and Settings into the nav, then the toggle and user section come AFTER the nav (outside `<nav>`).

New structure for `<aside>`:
```
<aside ...>
  {/* Logo Section - unchanged */}

  {/* Navigation */}
  <nav class="flex-1 overflow-y-auto px-3 overflow-x-hidden">
    <div class="flex flex-col h-full">

      {/* Premium Card */}
      <div class="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
           style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%)" }}>
        <NavItem href={routes.home} label={t("home")} isPremium isExpanded isActive={...} ... animationDelay={0} />
        <NavItem href={routes.portfolio} label={t("portfolio")} isPremium isExpanded isActive={...} ... animationDelay={30} />
      </div>

      {/* Standard group */}
      <div class="mt-3 flex flex-col gap-0.5">
        <NavItem href={routes.transaction} ... animationDelay={60} />
        <NavItem href={routes.wallets} ... animationDelay={90} />
        <NavItem href={routes.report} ... animationDelay={120} />
        <NavItem href={routes.budget} ... animationDelay={150} />
      </div>

      {/* Spacer + divider + settings */}
      <div class="flex-1" />
      <div class="border-t border-v2-border-light" />
      <div class="h-2" />   {/* 8px gap */}
      <NavItem href="/dashboard/settings" label={t("settings")} isExpanded isActive={...} animationDelay={180} ... />
    </div>
  </nav>

  {/* Toggle + divider area */}
  <div class="px-3 pt-2 pb-0">
    <SidebarToggle isExpanded={isExpanded} onToggle={toggle} />
  </div>

  {/* Dividers + User Section */}
  <div class="px-3 pt-2 pb-3">
    <div class="border-t border-v2-border-light mb-2" />   {/* 1px divider + 8px gap */}
    {/* User info */}
    <div class="flex items-center py-2 rounded-xl gap-3 px-2 ...">
      avatar + name/email
    </div>
    {/* Logout */}
    <NavTooltip ...>
      <button ...>Logout</button>
    </NavTooltip>
  </div>
</aside>
```

Wait — the spec says the bottom layout is:
```
[1px divider]
[8px gap]
Settings nav item
SidebarToggle
[8px gap]
[1px divider]
[8px gap]
User section
```

Settings is BEFORE toggle. So the nav section ends with Settings, then toggle comes after, then divider+user. This is the correct structure above.

**Animation delays update:**
- Home: 0ms (Premium group, item 1)
- Portfolio: 30ms (Premium group, item 2)
- Transactions: 60ms (Standard group, item 1)
- Wallets: 90ms (Standard group, item 2)
- Reports: 120ms (Standard group, item 3)
- Budget: 150ms (Standard group, item 4)
- Settings: 180ms (same as before)
These are unchanged from current.

**Collapsed sidebar in nav:**
When `!isExpanded`, the sidebar is `w-20` (80px). The nav has `px-3` so inner width is 80-24 = 56px. The Premium Card wrapper will still render (gradient bg + border + rounded corners), but items inside are just centered 44×44 icon containers. The Premium Card `p-1.5` (6px) adds 12px total to inner width = 56-12 = 44px for each item — perfect, exactly 44px for the icon containers.

However, in collapsed state the nav `px-3` gives 56px inner. The Premium Card wrapper with `p-1.5` means items have 56-12=44px. This is fine.

The `mt-3` between Premium and Standard groups remains in both expanded and collapsed states — spec says `gap-4` (16px) in collapsed but `mt-3` (12px) in expanded. We can use a different margin for collapsed state: `isExpanded ? "mt-3" : "mt-4"`.

**Step 2: Remove the old `p-5` toggle wrapper and `p-4 border-t` user section, replace with new structure**

The current logout button is in the user section. Keep it there — no change to logout functionality.

**Note on user section avatar size:** Spec shows `36×36` avatar. Current implementation uses `w-8 h-8` (32×32). Update to `w-9 h-9` (36px). The avatar background: current is `bg-v2-bg-primary` for the wrapper. Spec shows `bg-v2-red-primary` for initials. Update avatar background to `bg-v2-red-primary` when showing initials.

---

## Task 4: Update `layout.tsx` — Mobile Slide-out Restructure

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Specifically: the `navigationItems` useMemo (lines 117–187)

**Dependencies:** Task 3 (same file; do after Task 3 commits)

**Context:**
Current `navigationItems` renders a flat `flex-col gap-1 px-3` list with all 6 routes in order: Home, Transactions, Wallets, Portfolio, Reports, Budget.

**Target structure:**
```tsx
<div className="flex flex-col gap-3 px-3">
  {/* Premium Card */}
  <div
    className="rounded-2xl border border-v2-border-light p-1.5 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #FEF2F233 50%, #FEE2E240 100%)" }}
  >
    <ActiveLink href={routes.home} className={cn(
      "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target animate-stagger-fade-in",
      path === routes.home
        ? "text-v2-red-primary bg-v2-red-light font-semibold"
        : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
    )}>
      <House size={22} />
      <span>{t("home")}</span>
    </ActiveLink>
    <ActiveLink href={routes.portfolio} className={cn(
      "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] transition-colors duration-200 touch-target",
      path === routes.portfolio
        ? "text-v2-red-primary bg-v2-red-light font-semibold"
        : "text-v2-text-secondary hover:bg-v2-bg-primary font-medium",
    )}>
      <ChartNoAxesCombined size={22} />
      <span>{t("portfolio")}</span>
    </ActiveLink>
  </div>

  {/* Standard group */}
  <div className="flex flex-col gap-0.5">
    {[
      { href: routes.transaction, label: t("transactions"), icon: <ArrowLeftRight size={22} /> },
      { href: routes.wallets, label: t("wallets"), icon: <Wallet size={22} /> },
      { href: routes.report, label: t("reports"), icon: <ChartPie size={22} /> },
      { href: routes.budget, label: t("budget"), icon: <Calculator size={22} /> },
    ].map((item) => (
      <ActiveLink
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] font-medium transition-colors duration-200 touch-target",
          path === item.href
            ? "text-v2-red-primary bg-v2-red-light font-semibold"
            : "text-v2-text-secondary hover:bg-v2-bg-primary",
        )}
      >
        {item.icon}
        <span>{item.label}</span>
      </ActiveLink>
    ))}
  </div>

  {/* Divider + Settings + Logout */}
  <div>
    <div className="border-t border-v2-border-light mb-1" />
    <ActiveLink
      href="/dashboard/settings"
      className={cn(
        "flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] font-medium transition-colors duration-200 touch-target",
        path.startsWith("/dashboard/settings")
          ? "text-v2-red-primary bg-v2-red-light font-semibold"
          : "text-v2-text-secondary hover:bg-v2-bg-primary",
      )}
    >
      <Settings size={22} />
      <span>{t("settings")}</span>
    </ActiveLink>
    <button
      onClick={logout}
      className="flex items-center gap-3 py-3 px-3.5 rounded-xl font-vietnam text-[15px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-colors duration-200 touch-target w-full text-left"
      aria-label={t("logout")}
    >
      <LogOut size={22} />
      <span>{t("logout")}</span>
    </button>
  </div>
</div>
```

**Key changes from current:**
- Outer gap: `gap-1` → `gap-3`
- Font size: `text-[14px]` → `text-[15px]`
- Icon size: `size={20}` → `size={22}`
- Padding: `py-2.5 px-3` → `py-3 px-3.5`
- Structure: flat list → Premium Card + Standard group
- Active font: add `font-semibold` (currently all items just `font-medium`)
- No active dot badge (already absent — confirmed)
- Logout color: keep `text-v2-text-secondary` (already correct)

---

## Task 5: Update `BottomNav` — Inactive Color Token

**Files:**
- Modify: `src/wj-client/components/navigation/BottomNav.tsx`

**Dependencies:** None (fully independent)

**Context (from reading the file):**
- Line 87: `"text-neutral-600"` on the `<a>` wrapper
- Lines 89–90: Active state uses `"text-v2-red-primary"`, inactive hover uses `"hover:text-neutral-800 active:text-v2-red-dark"`
- Target: Replace `text-neutral-600` with `text-v2-text-tertiary` and `hover:text-neutral-800` with `hover:text-v2-text-secondary`

**Step 1: Make the change**

In `BottomNav.tsx` line 87, change:
```tsx
"text-neutral-600",
isActive
  ? "text-v2-red-primary"
  : "hover:text-neutral-800 active:text-v2-red-dark",
```
to:
```tsx
"text-v2-text-tertiary",
isActive
  ? "text-v2-red-primary"
  : "hover:text-v2-text-secondary active:text-v2-red-dark",
```

This is a targeted 2-line change. No structural changes.

---

## Commit Strategy

Each task gets its own commit:

| Task | Commit message |
|------|----------------|
| 1 | `feat(sidebar-v2): add isPremium prop to NavItem with 44×44 collapsed container` |
| 2 | `feat(sidebar-v2): update SidebarToggle to PanelLeft icons, h-11, rounded-xl` |
| 3 | `feat(sidebar-v2): restructure desktop sidebar with Premium Card grouping` |
| 4 | `feat(sidebar-v2): update mobile slide-out with Premium Card grouping` |
| 5 | `fix(sidebar-v2): update BottomNav inactive color to v2-text-tertiary` |

Tasks 1, 2, and 5 can be committed independently in any order. Task 3 must come after Task 1. Task 4 must come after Task 3.

---

## Acceptance Criteria Checklist

From the spec:

**FR-1 (Premium Card grouping):**
- [ ] Home and Portfolio inside gradient card (desktop expanded)
- [ ] Card has `border-v2-border-light`, `rounded-2xl`, `shadow-[0_2px_8px_rgba(0,0,0,0.04)]`
- [ ] Standard items (Transactions, Wallets, Reports, Budget) below as flat list
- [ ] 12px gap between groups (expanded), 16px (collapsed)

**FR-2 (NavItem tokens):**
- [ ] Active: `font-semibold`, `text-v2-red-primary`, `bg-v2-red-light`
- [ ] Inactive: `font-medium`, `text-v2-text-secondary`, transparent bg
- [ ] Hover: `bg-v2-bg-primary` on inactive

**FR-3 (Collapsed icon containers):**
- [ ] 44×44 containers (`w-11 h-11`) for all collapsed items
- [ ] Premium active: `bg-v2-red-light border-[1.5px] border-[#FECACA]`
- [ ] Premium inactive: `bg-v2-red-light/5`, no border
- [ ] Standard: no background
- [ ] Tooltips preserved via `NavTooltip`

**FR-4 (SidebarToggle):**
- [ ] `PanelLeftClose` when expanded, `PanelLeftOpen` when collapsed
- [ ] `h-11` (44px height)
- [ ] `rounded-xl`
- [ ] Between Settings and User section with dividers

**FR-5 (Mobile slide-out):**
- [ ] Same Premium Card grouping as desktop
- [ ] Font 15px, icon 22×22, padding `py-3 px-3.5`
- [ ] No active dot badge
- [ ] Logout keeps neutral secondary color

**Bottom Nav:**
- [ ] Inactive color updated to `text-v2-text-tertiary`
