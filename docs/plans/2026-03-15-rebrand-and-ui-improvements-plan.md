# Rebrand to congdongvang.com & UI Improvements — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Rebrand app from "WealthJourney" to "congdongvang.com", fix iOS status bar color, optimize price tables for mobile, and enhance the FAB with "Add Wallet" + desktop visibility.

**Spec:** `docs/specs/2026-03-15-rebrand-and-ui-improvements-spec.md`

**Architecture:** Frontend-only changes across 3 main files + 3 price table components. No backend, no API, no proto changes. All changes are branding, CSS, and component prop adjustments.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, PWA manifest

## Security Implementation Notes

- No new data flows or trust boundary crossings
- "Add Wallet" FAB action reuses existing `CreateWalletForm` → `useMutationCreateWallet` → `POST /api/v1/wallets` (already auth-protected)
- All changes are hardcoded strings, CSS classes, or component props — no user input involved
- No XSS risk (brand name is a hardcoded constant, not user-provided)

## C4 Architecture Diagram Updates

None — purely UI/branding changes. No new components, services, or repositories.

## Runtime Flow Diagram Updates

None — no new multi-step business logic. "Add Wallet" reuses existing CreateWallet flow documented in `flow-wallet.md`.

---

### Task 1: Rebrand metadata + Fix iOS status bar

**Files:**
- Modify: `src/wj-client/app/layout.tsx` (lines 5, 6-7, 21, 24)
- Modify: `src/wj-client/public/manifest.json` (lines 2, 3, 4, 8)

**Security notes:** None — static text and color hex values only.

**Step 1: Update `layout.tsx` metadata**

Replace all "WealthJourney" references in metadata:

| Line | Field | Current | New |
|------|-------|---------|-----|
| 5 | `title` | `"WealthJourney"` | `"congdongvang.com"` |
| 6-7 | `description` | `"Welcome to WealthJourney - Your Trusted Guide to Financial Freedom"` | `"congdongvang.com - Theo dõi giá vàng & quản lý tài chính"` |
| 21 | `applicationName` | `"WealthJourney"` | `"congdongvang.com"` |
| 24 | `appleWebApp.title` | `"WealthJourney"` | `"congdongvang.com"` |

**Step 2: Update `manifest.json`**

| Line | Field | Current | New |
|------|-------|---------|-----|
| 2 | `name` | `"WealthJourney - Personal Financial Management"` | `"congdongvang.com - Theo dõi giá vàng & quản lý tài chính"` |
| 3 | `short_name` | `"WealthJourney"` | `"congdongvang.com"` |
| 4 | `description` | `"Your Trusted Guide to Financial Freedom..."` | `"Theo dõi giá vàng, bạc, ngoại tệ & quản lý tài chính cá nhân"` |
| 8 | `theme_color` | `"#008148"` (green) | `"#B91C1C"` (red) |

**Step 3: Verify no other "WealthJourney" references in user-facing files**

Run a grep to confirm no other user-facing files reference "WealthJourney" (exclude docs/, .claude/, CLAUDE.md).

**Step 4: Commit**

```
feat(rebrand): update metadata and PWA manifest to congdongvang.com

- Replace all "WealthJourney" references in layout.tsx metadata
- Update manifest.json name, short_name, description
- Fix iOS status bar: theme_color #008148 → #B91C1C
```

---

### Task 2: Rebrand dashboard layout (sidebar, header, mobile menu)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx`

**Security notes:** None — hardcoded text replacement only.

**Step 1: Replace desktop sidebar brand (expanded state)**

- Lines ~265-272: Change logo initial `W` → `C` and brand text `WealthJourney` → `congdongvang.com`
- Reduce brand text font size from `text-[19px]` to `text-[16px]` to accommodate longer name

**Step 2: Replace desktop sidebar logo (collapsed state)**

- Lines ~274-280: Change logo initial `W` → `C`

**Step 3: Replace mobile header brand**

- Lines ~473-480: Change logo initial `W` → `C` and brand text `WealthJourney` → `congdongvang.com`
- Reduce brand text font size from `text-[16px]` to `text-[14px]` to fit mobile header

**Step 4: Replace mobile menu sidebar brand**

- Lines ~527-535: Change logo initial `W` → `C` and brand text `WealthJourney` → `congdongvang.com`

**Step 5: Commit**

```
feat(rebrand): update dashboard layout branding to congdongvang.com

- Desktop sidebar: "W" → "C", "WealthJourney" → "congdongvang.com"
- Mobile header: "W" → "C", "WealthJourney" → "congdongvang.com"
- Mobile menu: "W" → "C", "WealthJourney" → "congdongvang.com"
- Adjusted font sizes for longer brand name
```

---

### Task 3: Optimize price tables for mobile (eliminate horizontal scroll)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx`

**Security notes:** None — CSS-only changes.

**Step 1: Update GoldPriceTable.tsx**

Apply responsive padding, font sizes, and table layout:

**Table wrapper:**
- Remove `overflow-x-auto` wrapper div (table should fit without scroll)
- Add `table-fixed` to `<table>` element

**Column widths** (add to `<colgroup>` or `<th>` elements):
- Type name: `w-[40%]`
- Buy: `w-[30%]`
- Sell: `w-[30%]`
- Admin column (if present): `w-10` (unchanged)

**Header cells (`<th>`):**
- Type name: `px-5 py-3.5` → `px-3 py-2.5 sm:px-5 sm:py-3.5`
- Buy/Sell: `px-5 py-3.5 font-jetbrains font-bold text-[13px] uppercase tracking-[1px]` → `px-3 py-2.5 sm:px-5 sm:py-3.5 font-jetbrains font-bold text-[12px] sm:text-[13px] uppercase tracking-normal sm:tracking-[1px]`

**Body cells (`<td>`):**
- Type name: `px-5 py-3 font-vietnam font-bold text-[14px]` → `px-3 py-2.5 sm:px-5 sm:py-3 font-vietnam font-bold text-[13px] sm:text-[14px] truncate`
- Buy/Sell: `px-5 py-3 text-right font-jetbrains font-medium text-[13px]` → `px-3 py-2.5 sm:px-5 sm:py-3 text-right font-jetbrains font-medium text-[12px] sm:text-[13px]`

**Header title section:**
- `px-5 py-3` → `px-3 py-2.5 sm:px-5 sm:py-3` (card header area above the table)

**Step 2: Update SilverPriceTable.tsx**

Apply identical responsive changes as GoldPriceTable (same CSS pattern, different color classes):
- Same padding reductions: `px-3 py-2.5 sm:px-5 sm:py-3`
- Same font size reductions: `text-[12px] sm:text-[13px]` for headers/prices, `text-[13px] sm:text-[14px]` for type names
- Same tracking: `tracking-normal sm:tracking-[1px]`
- Add `table-fixed` layout and column widths
- Add `truncate` to type name cells
- Remove `overflow-x-auto`

**Step 3: Update CurrencyPriceTable.tsx**

Apply identical responsive changes as GoldPriceTable (same CSS pattern, different color classes):
- Same responsive padding, font sizes, tracking, table layout changes
- Add `truncate` to type name cells
- Remove `overflow-x-auto`

**Step 4: Verify at 375px viewport**

Visually verify (mental check or browser dev tools):
- No horizontal scroll on any of the 3 tables
- Text remains readable
- Admin inline edit buttons still accessible
- Desktop layout unchanged (sm: breakpoint restores original styling)

**Step 5: Commit**

```
fix(ui): optimize home page price tables for mobile viewport

- Reduce cell padding on mobile: px-5 → px-3
- Reduce font sizes on mobile: 14px → 13px (names), 13px → 12px (prices)
- Remove tracking-[1px] on mobile headers
- Add table-fixed layout with percentage column widths
- Add truncate for long type names
- Remove overflow-x-auto (table now fits without scroll)
- Desktop layout unchanged via sm: breakpoint
```

---

### Task 4: Enhance FAB — Add "Add Wallet" action + Desktop visibility

**Files:**
- Modify: `src/wj-client/components/FloatingActionButton.tsx` (remove `sm:hidden`, add responsive bottom positioning)
- Modify: `src/wj-client/app/[locale]/dashboard/layout.tsx` (add wallet action to FAB, add CreateWallet modal handling)

**Security notes:** "Add Wallet" uses existing `CreateWalletForm` → `useMutationCreateWallet` which already has JWT auth + input validation. No new security surface.

**Step 1: Update FloatingActionButton.tsx — Remove `sm:hidden` and add responsive positioning**

In `FloatingActionButton.tsx`:

1. **Backdrop** (line ~38): Change `"fixed inset-0 bg-neutral-900/20 sm:hidden"` → `"fixed inset-0 bg-neutral-900/20"`
   - Remove `sm:hidden` so backdrop shows on desktop too

2. **FAB container** (line ~47): Change `"fixed right-3 sm:hidden flex items-end"` → `"fixed right-3 flex items-end"`
   - Remove `sm:hidden` so FAB is visible on desktop

3. **Bottom positioning** (line ~49): Change inline style from:
   ```
   bottom: `calc(env(safe-area-inset-bottom, 0px) + 70px)`
   ```
   to a responsive approach — the component doesn't know about breakpoints in inline styles, so we'll use a CSS variable or conditional class approach. The simplest way:
   - Add a `className` prop to FAB container for bottom positioning
   - Use `bottom-[calc(env(safe-area-inset-bottom,0px)+70px)] sm:bottom-6` on the container

   **Note:** Tailwind doesn't support `calc()` with `env()` in arbitrary values well. Instead, keep the inline style for mobile and override with a sm: class:
   - Keep `style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}`
   - Add `sm:!bottom-6` class to override the inline style on desktop (important needed to override inline style)

4. **Desktop right positioning**: Change `right-3` → `right-3 sm:right-6` for more breathing room on desktop

**Step 2: Update dashboard layout — Add "Add Wallet" FAB action**

In `app/[locale]/dashboard/layout.tsx`:

1. **Add import** for `CreateWalletForm`:
   ```typescript
   import { CreateWalletForm } from "@/features/wallet/forms/CreateWalletForm";
   ```

2. **Add third action** to the FAB `actions` array (after Transfer Money, ~line 675):
   ```typescript
   {
     label: tQuickActions("createNewWallet"),
     icon: (
       <Wallet className="w-6 h-6" />
     ),
     onClick: () => {
       setModalType(ModalType.CREATE_WALLET);
     },
   },
   ```

   Note: `Wallet` is already imported from `lucide-react` (line 30). The translation key `createNewWallet` already exists in both EN/VI.

3. **Add `CREATE_WALLET` modal handler** in the BaseModal section (~line 699, after TRANSFER_MONEY):
   ```typescript
   {modalType === ModalType.CREATE_WALLET && (
     <CreateWalletForm
       onSuccess={() => {
         setModalType(null);
       }}
     />
   )}
   ```

**Step 3: Commit**

```
feat(ui): enhance FAB with "Add Wallet" action and desktop visibility

- Remove sm:hidden from FAB container and backdrop
- Add responsive bottom positioning (70px+safe-area on mobile, 24px on desktop)
- Add "Add Wallet" as third FAB action using existing CreateWalletForm
- Add CREATE_WALLET modal handling in dashboard layout
- Wallet icon from lucide-react, translations already in place (EN/VI)
```

---

## Task Dependency Graph

```
Task 1 (metadata + status bar) ──┐
                                  ├── Independent, can run in parallel
Task 2 (dashboard branding)   ──┤
                                  │
Task 3 (price tables)          ──┤
                                  │
Task 4 (FAB enhancement)      ──┘  (modifies layout.tsx, so sequential with Task 2)
```

**Parallel-safe:** Tasks 1 and 3 are fully independent (different files).
**Sequential:** Tasks 2 and 4 both modify `dashboard/layout.tsx` — run Task 2 first, then Task 4.

## Files Changed Summary

| File | Tasks | Type of Change |
|------|-------|----------------|
| `src/wj-client/app/layout.tsx` | 1 | Metadata text + description |
| `src/wj-client/public/manifest.json` | 1 | PWA name, description, theme_color |
| `src/wj-client/app/[locale]/dashboard/layout.tsx` | 2, 4 | Branding text + FAB actions + modal |
| `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx` | 3 | Responsive CSS classes |
| `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx` | 3 | Responsive CSS classes |
| `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx` | 3 | Responsive CSS classes |
| `src/wj-client/components/FloatingActionButton.tsx` | 4 | Remove sm:hidden, responsive positioning |

**Total: 7 files modified, 0 files created**
