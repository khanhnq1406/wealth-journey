# Sidebar Cleanup Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Clean up the dashboard sidebar by removing Prices nav item and CurrencySelector, adding desktop logout button, and fixing active page highlighting.
**Spec:** `docs/specs/2026-03-09-sidebar-cleanup-spec.md`
**Architecture:** Frontend-only changes to `layout.tsx`, `ActiveLink.tsx`, and `NavItem.tsx`. No API, proto, or backend changes.
**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, next-intl

## Security Implementation Notes

- **Authentication:** No changes — logout uses existing `logout()` function
- **Authorization:** No changes — no new data access
- **Input validation:** No user input involved
- **Data sanitization:** No data rendering changes

---

### Task 1: Fix ActiveLink pathname comparison for locale-prefixed routes (FR-3)

**Problem:** `ActiveLink.tsx` imports `usePathname` from `next/navigation` (returns `/en/dashboard/home`), but compares against `href` which is `/dashboard/home`. This means the active state **never matches**.

**Fix:** Import `usePathname` from `@/lib/navigation` (next-intl's version) which strips the locale prefix, making `pathname === href` work correctly.

**Files:**
- Modify: `src/wj-client/components/ActiveLink.tsx`

**Security notes:** None — routing only.

**Steps:**

1. In `ActiveLink.tsx`, change the import from:
   ```typescript
   import { usePathname, useRouter } from "next/navigation";
   ```
   to:
   ```typescript
   import { usePathname, useRouter } from "@/lib/navigation";
   ```
   This is a drop-in replacement — `@/lib/navigation` exports the same `usePathname` and `useRouter` APIs via `createNavigation()` from `next-intl/navigation`.

2. Verify that `ActiveLink` already sets `aria-current="page"` when `pathname === href` (it does, line 39).

3. The V1 active styles (`bg-white/30 shadow-md border-l-4 border-white`) in `ActiveLink` are overridden by `NavItem`'s `className` prop — this is fine because `NavItem` controls styling. The `pathname === href` match is what matters for `aria-current`.

**Commit:** `fix(nav): use next-intl usePathname in ActiveLink for locale-aware path matching`

---

### Task 2: Pass `isActive` prop from layout to NavItem (FR-3)

**Problem:** `NavItem` accepts an `isActive` prop but it's never set — always defaults to `false`. The active styling (`text-v2-red-primary bg-v2-red-light`) never applies.

**Fix:** Compute `isActive` in layout by comparing `path` (from `usePathname` which already uses next-intl) with each NavItem's `href`. Pass the boolean to `NavItem`.

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx` (lines 240-309, NavItem list)

**Security notes:** None — display logic only.

**Steps:**

1. For each desktop sidebar `NavItem`, add `isActive={path === routes.xxx}` or `isActive={path === "/dashboard/settings"}`. Example:
   ```tsx
   <NavItem
     href={routes.home}
     label={t("home")}
     isExpanded={isExpanded}
     showTooltip={!isExpanded}
     animationDelay={0}
     icon={<House size={20} />}
     isActive={path === routes.home}
   />
   ```

2. Apply to all 7 nav items (Home, Transactions, Wallets, Portfolio, Reports, Budget, Settings). Do NOT add to Prices — it will be removed in Task 3.

3. For the mobile slide-out menu `ActiveLink` items, add active styling via className conditional:
   ```tsx
   className={cn(
     "flex items-center gap-3 px-3 py-2.5 rounded-xl font-vietnam text-[14px] font-medium transition-colors duration-200 touch-target animate-stagger-fade-in",
     path === item.href
       ? "text-v2-red-primary bg-v2-red-light"
       : "text-v2-text-secondary hover:bg-v2-bg-primary"
   )}
   ```
   Do the same for the Settings `ActiveLink` in mobile menu.

**Commit:** `feat(nav): pass isActive prop to NavItems for active page highlighting`

---

### Task 3: Remove Prices nav item from sidebar and mobile menu (FR-1)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** None — removal only.

**Steps:**

1. **Desktop sidebar:** Remove the Prices `NavItem` block (lines 272-279):
   ```tsx
   // REMOVE THIS:
   <NavItem
     href={routes.prices}
     label={t("prices")}
     isExpanded={isExpanded}
     showTooltip={!isExpanded}
     animationDelay={120}
     icon={<CircleDollarSign size={20} />}
   />
   ```

2. **Re-sequence animation delays** for remaining items:
   | Item | Old Delay | New Delay |
   |------|-----------|-----------|
   | Home | 0 | 0 |
   | Transactions | 30 | 30 |
   | Wallets | 60 | 60 |
   | Portfolio | 90 | 90 |
   | Reports | 150 → | 120 |
   | Budget | 180 → | 150 |
   | Settings | 210 → | 180 |

3. **Mobile slide-out menu:** Remove the Prices entry from the `items` array (lines 133-137):
   ```tsx
   // REMOVE THIS:
   {
     href: routes.prices,
     label: t("prices"),
     icon: <CircleDollarSign size={20} />,
   },
   ```

4. **Clean up unused import:** Remove `CircleDollarSign` from the lucide-react import (line 34) since it's no longer used anywhere in layout.

**Commit:** `refactor(nav): remove Prices navigation item from sidebar and mobile menu`

---

### Task 4: Remove CurrencySelector from sidebar and mobile menu (FR-4)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** None — removal only. `CurrencyProvider` wrapper stays.

**Steps:**

1. **Desktop sidebar:** Remove the CurrencySelector wrapper div (lines 360-372):
   ```tsx
   // REMOVE THIS ENTIRE BLOCK:
   <div
     className={cn(
       "mt-3 px-3 space-y-2 transition-all duration-300 ease-in-out",
       isExpanded
         ? "opacity-100 max-h-20 translate-y-0"
         : "opacity-0 max-h-0 overflow-hidden -translate-y-2",
     )}
     style={{
       transitionDelay: isExpanded ? "150ms" : "0ms",
     }}
   >
     <CurrencySelector />
   </div>
   ```

2. **Mobile slide-out menu:** Remove the CurrencySelector section (lines 493-495):
   ```tsx
   // REMOVE THIS:
   <div className="mt-3">
     <CurrencySelector />
   </div>
   ```

3. **Clean up imports:** Remove the `CurrencySelector` import (line 13):
   ```tsx
   // REMOVE: import { CurrencySelector } from "@/components/CurrencySelector";
   ```
   Keep the `CurrencyProvider` import — it's still used as a wrapper.

**Commit:** `refactor(nav): remove CurrencySelector from sidebar and mobile menu`

---

### Task 5: Add logout button to desktop sidebar (FR-2)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** Uses existing `logout()` function. No new security surface.

**Steps:**

1. Add a logout button in the User Section of the desktop sidebar (after the user info div, replacing where CurrencySelector was). Place it inside the `<div className="p-4 border-t ...">` block, after the user info flex container:

   ```tsx
   {/* Logout Button */}
   <NavTooltip content={t("logout")} disabled={isExpanded}>
     <button
       onClick={logout}
       className={cn(
         "flex items-center w-full py-2.5 rounded-xl font-vietnam text-[14px] font-medium text-v2-text-secondary hover:bg-v2-bg-primary transition-all duration-300 ease-in-out mt-2",
         isExpanded ? "gap-3 px-3" : "justify-center px-0"
       )}
       aria-label={t("logout")}
     >
       <LogOut size={20} className="shrink-0" />
       <span
         className={cn(
           "whitespace-nowrap transition-all duration-300 ease-in-out",
           isExpanded
             ? "opacity-100 w-auto translate-x-0"
             : "opacity-0 w-0 overflow-hidden -translate-x-2"
         )}
       >
         {t("logout")}
       </span>
     </button>
   </NavTooltip>
   ```

2. This uses the same visual pattern as `NavItem` (same classes, same expanded/collapsed behavior), but is a `<button>` instead of `<ActiveLink>` since it triggers an action, not navigation.

3. The `NavTooltip` wraps it when collapsed (`disabled={isExpanded}` means tooltip only shows when sidebar is collapsed).

4. `LogOut` icon is already imported (line 38). `logout` function is already imported (line 3). `NavTooltip` is already imported (line 24). No new imports needed.

**Commit:** `feat(nav): add logout button to desktop sidebar`

---

### Task 6: Verify and clean up (final pass)

**Files:**
- Verify: `src/wj-client/app/[locale]/dashboard/layout.tsx`
- Verify: `src/wj-client/components/ActiveLink.tsx`

**Steps:**

1. Verify no unused imports remain in layout.tsx:
   - `CircleDollarSign` — should be removed (Task 3)
   - `CurrencySelector` — should be removed (Task 4)
   - All other imports still used

2. Verify `routes.prices` is still defined in `constants.tsx` (it should be — the route still works, just not in nav).

3. Verify `CurrencyProvider` still wraps the layout (it does — other components use `useCurrency()`).

4. Build check: `cd src/wj-client && npx next build` to verify no TypeScript errors.

**Commit:** `chore(nav): clean up unused imports after sidebar cleanup`

---

## Summary of All Changes

| File | Changes |
|------|---------|
| `src/wj-client/components/ActiveLink.tsx` | Fix `usePathname` import for locale-aware matching |
| `src/wj-client/app/[locale]/dashboard/layout.tsx` | Remove Prices NavItem + mobile entry, remove CurrencySelector (desktop + mobile), add `isActive` props to all NavItems, add active styling to mobile nav, add desktop logout button, remove unused imports |

## Task Dependencies

```
Task 1 (fix ActiveLink) ──→ Task 2 (isActive props) ──→ Task 3 (remove Prices)
                                                      ──→ Task 4 (remove CurrencySelector)
                                                      ──→ Task 5 (add logout button)
                                                           ──→ Task 6 (verify + clean up)
```

Tasks 3, 4, 5 can be done in any order after Task 2. Task 6 must be last.
