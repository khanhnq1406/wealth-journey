# Rebrand to congdongvang.com & UI Improvements Specification

## Summary

This feature covers four related improvements:
1. **Rebrand** from "WealthJourney" to "congdongvang.com" across the entire application
2. **Fix iOS status bar** color mismatch (green → V2 red #B91C1C)
3. **Optimize price tables** on home page to eliminate horizontal scroll and improve mobile UX
4. **Enhance FAB** (Floating Action Button) — add "Add Wallet" action and make visible on all screen sizes

## User Stories

- As a user, I want the app to be branded as "congdongvang.com" so that it matches the domain I access it from
- As an iOS user, I want the status bar to match the app's red theme instead of showing legacy green
- As a mobile user, I want to view gold/silver/currency price tables without horizontal scrolling
- As a user on any device, I want quick access to add wallet, add transaction, and transfer money via a floating action button

---

## Feature 1: Rebrand to congdongvang.com

### FR-1: Replace all user-visible "WealthJourney" references

**Acceptance criteria:**
- [ ] Browser tab title shows "congdongvang.com"
- [ ] PWA manifest `name` = "congdongvang.com - Theo dõi giá vàng & quản lý tài chính"
- [ ] PWA manifest `short_name` = "congdongvang.com"
- [ ] Mobile header shows "congdongvang.com" with "C" logo icon
- [ ] Desktop sidebar (expanded) shows "congdongvang.com" with "C" logo icon
- [ ] Desktop sidebar (collapsed) shows "C" logo icon
- [ ] Mobile menu sidebar shows "congdongvang.com" with "C" logo icon
- [ ] Metadata description updated to reference congdongvang.com
- [ ] Apple web app title = "congdongvang.com"
- [ ] Application name = "congdongvang.com"

**Files to change:**
- `src/wj-client/app/layout.tsx` — metadata (title, description, applicationName, appleWebApp.title)
- `src/wj-client/public/manifest.json` — name, short_name, description
- `src/wj-client/app/[locale]/dashboard/layout.tsx` — 3 locations: desktop sidebar (line 271), mobile header (line 479), mobile menu (line 533), plus logo initials "W" → "C" (lines 267, 277, 475, 529)

**Out of scope:**
- Documentation files (CLAUDE.md, docs/, etc.) — internal reference only
- Design files (.pen, .json) — not user-facing
- Skill files (.claude/skills/) — internal tooling
- Backend code — no "WealthJourney" in user-facing backend responses

---

## Feature 2: Fix iOS Status Bar Color

### FR-2: Update PWA theme_color to match V2 design

**Acceptance criteria:**
- [ ] `manifest.json` `theme_color` updated from `#008148` to `#B91C1C`
- [ ] iOS status bar area shows V2 red (#B91C1C) instead of legacy green (#008148)
- [ ] Meta theme-color tag already correct (verified: `#B91C1C` in layout.tsx line 31)

**Root cause:** `manifest.json` line 8 still uses old green `#008148`. The HTML meta tag in `layout.tsx` was already updated to `#B91C1C`, but iOS PWA prioritizes the manifest `theme_color`.

**Files to change:**
- `src/wj-client/public/manifest.json` — line 8: `"theme_color": "#008148"` → `"theme_color": "#B91C1C"`

---

## Feature 3: Optimize Price Tables (Home Page)

### FR-3: Eliminate horizontal scroll and polish price table UX

**Problem:** On mobile (375px viewport), the three price tables (Gold, Silver, Currency) have `px-5` padding on all cells plus `tracking-[1px]` on header text, causing total content width to exceed viewport → horizontal scroll required.

**Acceptance criteria:**
- [ ] No horizontal scroll on any price table at 375px viewport width
- [ ] Tables remain readable with proper visual hierarchy
- [ ] Professional UI polish: better spacing, typography, alignment
- [ ] Desktop layout unaffected (tables are inside grid columns)
- [ ] Admin inline edit buttons still functional and accessible

**Design approach — responsive padding & font sizes:**

| Property | Current (all sizes) | New mobile (<800px) | New desktop (>=800px) |
|----------|-------------------|-------------------|--------------------|
| Cell padding | `px-5 py-3` | `px-3 py-2.5` | `px-5 py-3` (unchanged) |
| Header padding | `px-5 py-3.5` | `px-3 py-2.5` | `px-5 py-3.5` (unchanged) |
| Type name font | `text-[14px]` | `text-[13px]` | `text-[14px]` (unchanged) |
| Price font | `text-[13px]` | `text-[12px]` | `text-[13px]` (unchanged) |
| Header tracking | `tracking-[1px]` | `tracking-normal` | `tracking-[1px]` (unchanged) |
| Header font | `text-[13px]` | `text-[12px]` | `text-[13px]` (unchanged) |

**Additional optimizations:**
- Remove `overflow-x-auto` wrapper — table should fit without scroll
- Use `table-fixed` layout with percentage column widths: type name 40%, buy 30%, sell 30%
- Truncate long type names with `truncate` class instead of wrapping

**Existing component reuse:**
| Need | Existing Component | Location |
|------|--------------------|----------|
| Card wrapper | BaseCard | `components/BaseCard.tsx` |
| Price formatting | formatPriceValue | `app/[locale]/dashboard/prices/helpers.ts` |
| Admin edit | InlinePriceEdit, OverrideIndicator | `features/market-prices/components/InlinePriceEdit.tsx` |

**No new components needed** — this is a CSS/layout optimization of existing components.

---

## Feature 4: FAB Enhancement — Add Wallet + Desktop Visibility

### FR-4a: Add "Add Wallet" action to FAB

**Acceptance criteria:**
- [ ] FAB shows 3 actions: Add Transaction, Transfer Money, Add Wallet (new)
- [ ] "Add Wallet" action opens the CreateWalletForm modal
- [ ] Existing FAB actions continue to work unchanged

### FR-4b: Make FAB visible on all screen sizes

**Acceptance criteria:**
- [ ] FAB visible on mobile (unchanged behavior)
- [ ] FAB visible on desktop — same style, bottom-right corner
- [ ] Desktop position: fixed bottom-right, clear of any sidebar overlap
- [ ] FAB backdrop covers full screen on both mobile and desktop
- [ ] Desktop bottom offset adjusts (no bottom nav on desktop)

**Current behavior:**
- `FloatingActionButton.tsx` line 48: `className="fixed right-3 sm:hidden"` — hidden on desktop
- `FloatingActionButton.tsx` line 38: backdrop `sm:hidden` — hidden on desktop
- Bottom offset: `calc(env(safe-area-inset-bottom, 0px) + 70px)` — 70px for bottom nav

**Changes needed:**
- Remove `sm:hidden` from FAB container and backdrop
- On desktop (sm+), adjust bottom position (no bottom nav, use a fixed offset like `bottom: 24px`)
- On mobile, keep current bottom offset (70px + safe area for bottom nav)
- Add "Add Wallet" action with wallet icon

**Files to change:**
- `src/wj-client/components/FloatingActionButton.tsx` — remove `sm:hidden`, add responsive bottom positioning
- `src/wj-client/app/[locale]/dashboard/layout.tsx` — add "Add Wallet" action to FAB actions array, add `ModalType.CREATE_WALLET` handling in global modal

**Existing component reuse:**
| Need | Existing Component | Location |
|------|--------------------|----------|
| FAB | FloatingActionButton | `components/FloatingActionButton.tsx` |
| Create wallet form | CreateWalletForm | `features/wallet/forms/CreateWalletForm.tsx` |
| Modal | BaseModal | `components/modals/BaseModal.tsx` |
| Wallet icon | WalletIcon or inline SVG | `components/icons/` |

**Note:** The home page already imports `CreateWalletForm` and has a `"create-wallet"` modal type (line 41, 158). The dashboard layout also needs to handle this modal type since the FAB is rendered there.

---

## Architecture Changes (C4)

### Diagrams to Update
- **None** — These are purely UI/branding changes. No new backend components, services, or repositories.

### New Diagrams
- **None** — No new bounded contexts or complex domains.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update
- **None** — No new multi-step business logic. The "Add Wallet" modal already exists and uses existing CreateWallet API flow.

### New Flow Diagrams
- **None** — Simple CRUD, no branching, no multi-service coordination.

---

## Data Model Changes

None. All changes are frontend-only (branding, CSS, component props).

---

## API Changes

None. All changes are frontend-only.

---

## UI/UX Changes

### Summary of Visual Changes

| Area | Before | After |
|------|--------|-------|
| Brand name | "WealthJourney" | "congdongvang.com" |
| Logo initial | "W" | "C" |
| iOS status bar | Green (#008148) | Red (#B91C1C) |
| Price table padding (mobile) | px-5 | px-3 |
| Price table font (mobile) | 13-14px | 12-13px |
| Price table header tracking (mobile) | 1px | normal |
| FAB visibility | Mobile only | All screen sizes |
| FAB actions | 2 (Transaction, Transfer) | 3 (Transaction, Transfer, Wallet) |
| FAB desktop position | Hidden | Bottom-right, 24px from edge |

---

## Security & Risk Assessment

### Data Flow Diagram

No new data flows. All changes are:
1. Static text replacement (branding)
2. CSS/styling changes (theme color, padding, font sizes)
3. UI component prop changes (FAB visibility, actions)

The "Add Wallet" FAB action reuses the existing `CreateWalletForm` → `useMutationCreateWallet` → `POST /api/v1/wallets` flow, which already has auth + authorization.

### Trust Boundaries

No new trust boundary crossings. The CreateWallet API endpoint already validates:
- JWT authentication (middleware)
- User ownership (wallet belongs to authenticated user)
- Input validation (wallet name, type, currency)

### Threats Identified

| # | Threat | Severity | Assessment |
|---|--------|----------|------------|
| T-1 | XSS via brand name | N/A | Brand name is hardcoded string, not user input |
| T-2 | Unauthorized wallet creation via FAB | N/A | Uses same auth flow as existing create wallet feature |

### Authorization Rules
No changes — existing authorization rules apply.

### Input Validation Rules
No changes — existing validation applies to CreateWallet.

### External Dependency Risks
None — no new external dependencies.

### Sensitive Data Handling
No changes to sensitive data handling.

### Issues & Risks Summary
1. **Low risk:** PWA cache may show old branding until service worker updates — users may need to clear cache or wait for next deploy
2. **Low risk:** iOS may cache old theme_color — requires reinstalling PWA or clearing Safari data

---

## Edge Cases & Error Handling

1. **PWA cached manifest:** Old "WealthJourney" name may persist in installed PWAs until the service worker refreshes the manifest
2. **Desktop FAB z-index:** Must ensure FAB doesn't overlap with modals or toasts on desktop — current z-index (floating: 40) is below modal (50), which is correct
3. **Long price type names on mobile:** With reduced padding, some names could still be tight — use `truncate` class as safety net
4. **FAB + CreateWallet modal:** The modal is currently handled in `layout.tsx` for global FAB actions — ensure `CreateWalletForm`'s `onSuccess` properly invalidates wallet queries

---

## Dependencies & Assumptions

- V2 design system is the current active design (confirmed: all red/crimson theme)
- `CreateWalletForm` component already exists and works in the home page context
- The `sm:` breakpoint at 800px is the dividing line between mobile and desktop
- No backend changes needed

---

## Out of Scope

- Updating documentation files (CLAUDE.md, docs/, skill files) — internal only
- Updating design files (.pen, .json) — not user-facing runtime
- Logo SVG file changes — the "W"/"C" are text elements, not SVG logos
- Landing page rebrand — separate effort if needed
- Backend response messages — no "WealthJourney" in backend responses
