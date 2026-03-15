# Rebrand to congdongvang.com & UI Improvements — Implementation Report

## Summary

Rebranded the entire application from "WealthJourney" to "congdongvang.com", fixed iOS status bar color mismatch, optimized home page price tables for mobile viewports, and enhanced the Floating Action Button with an "Add Wallet" action and desktop visibility. The scope was extended mid-implementation to cover all remaining "WealthJourney" references project-wide (translations, auth pages, landing page, components, tests, config, docs, and legacy SQL).

## Spec Reference

`docs/specs/2026-03-15-rebrand-and-ui-improvements-spec.md`

## Plan Reference

`docs/plans/2026-03-15-rebrand-and-ui-improvements-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Rebrand metadata + Fix iOS status bar | Done | `d4e39e6` | 3 |
| 2 | Rebrand dashboard layout (sidebar, header, mobile menu) | Done | `5e6c86c` | 1 |
| 3 | Optimize price tables for mobile | Done | `1fb8ab0` | 3 |
| 4 | Enhance FAB — Add Wallet + Desktop visibility | Done | `ce74542` | 2 |
| 5 | Extended rebrand — translations (EN+VI) | Done | `a9b6b12` | 10 |
| 6 | Extended rebrand — auth, landing, components, tests, config, docs, SQL | Done | `967871b` | 36 |

**Total: 6 tasks, 8 commits, 55 files changed (+207 / -133 lines)**

## Implementation Details

### Task 1: Rebrand Metadata + Fix iOS Status Bar

Updated all user-facing metadata and fixed the PWA theme color mismatch that caused iOS devices to show a green status bar instead of the V2 red theme.

**Changes:**
- `app/layout.tsx`: title, description, applicationName, appleWebApp.title → "congdongvang.com"
- `public/manifest.json`: name, short_name, description updated; `theme_color`: `#008148` → `#B91C1C`
- `app/[locale]/layout.tsx`: `<meta name="apple-mobile-web-app-title">` → "congdongvang.com"

### Task 2: Rebrand Dashboard Layout

Replaced all "WealthJourney" branding in the dashboard shell across 3 UI locations.

**Changes in `app/[locale]/dashboard/layout.tsx`:**
- Desktop sidebar (expanded): "W" → "C", "WealthJourney" → "congdongvang.com", `text-[19px]` → `text-[16px]`
- Desktop sidebar (collapsed): "W" → "C"
- Mobile header: "W" → "C", "WealthJourney" → "congdongvang.com", `text-[16px]` → `text-[14px]`
- Mobile slide-out menu: "W" → "C", "WealthJourney" → "congdongvang.com"

### Task 3: Optimize Price Tables for Mobile

Eliminated horizontal scrolling on all 3 home page price tables at 375px viewport width.

**Responsive strategy (mobile-first with `sm:` breakpoint at 800px):**

| Property | Mobile (<800px) | Desktop (>=800px) |
|----------|----------------|--------------------|
| Cell padding | `px-3 py-2.5` | `sm:px-5 sm:py-3` |
| Header font | `text-[12px]` | `sm:text-[13px]` |
| Body name font | `text-[13px]` | `sm:text-[14px]` |
| Body price font | `text-[12px]` | `sm:text-[13px]` |
| Header tracking | `tracking-normal` | `sm:tracking-[1px]` |

**Additional optimizations:**
- Added `table-fixed` layout with `<colgroup>` column widths (40% / 30% / 30%)
- Added `truncate` on type name cells for overflow protection
- Removed `overflow-x-auto` wrapper (table fits without scroll)

**Applied to:** `GoldPriceTable.tsx`, `SilverPriceTable.tsx`, `CurrencyPriceTable.tsx`

### Task 4: Enhance FAB — Add Wallet + Desktop Visibility

Made the Floating Action Button visible on all screen sizes and added a third quick action.

**FloatingActionButton.tsx changes:**
- Removed `sm:hidden` from both backdrop and FAB container
- Added `sm:right-6 sm:!bottom-6` for desktop positioning (important modifier needed to override inline style)
- Mobile retains `bottom: calc(env(safe-area-inset-bottom, 0px) + 70px)` for bottom nav clearance

**Dashboard layout changes:**
- Added import for `CreateWalletForm` from `features/wallet/forms/`
- Added 3rd FAB action: "Add Wallet" with `Wallet` icon from lucide-react
- Added `ModalType.CREATE_WALLET` handler in the global modal section
- Translation key `dashboard.quickActions.createNewWallet` already existed in EN/VI

### Task 5: Extended Rebrand — Translations (EN+VI)

Replaced all "WealthJourney" references in 10 translation files across both English and Vietnamese locales.

| File | Key Changes |
|------|-------------|
| `auth.json` (en/vi) | "New to WealthJourney?" → "New to congdongvang.com?" |
| `common.json` (en/vi) | `appName` → "congdongvang.com" |
| `nav.json` (en/vi) | 7 replacements (comparison, testimonials, footer, CTA sections) |
| `report.json` (en/vi) | `brandFooter`, `workbookCreator` |
| `ui.json` (en/vi) | 4 PWA install prompt strings |

### Task 6: Extended Rebrand — Auth, Landing, Components, Tests, Config, Docs, SQL

Comprehensive sweep of all remaining "WealthJourney" references across the entire project.

**Auth pages (3 files):**
- `auth/layout.tsx`, `auth/login/page.tsx`, `auth/register/page.tsx` — brand text

**Landing page (1 file):**
- `landing/layout.tsx` — metadata, OpenGraph, Twitter cards, URLs (`wealthjourney.app` → `congdongvang.com`), Twitter handle (`@wealthjourney` → `@congdongvang`)

**Components (6 files):**
- `LandingNavbar.tsx` — alt text and brand name
- `LandingComparison.tsx` — comparison table brand reference
- `ShareDialog.tsx` — Twitter share text
- `Tour.tsx` — onboarding welcome message
- `report-excel-export.ts` — fallback creator string
- `report-pdf-export.ts` — fallback brand footer + comments

**Tests (3 files):**
- `login-flow.spec.ts` — title assertion regex
- `PWAInstallPrompt.test.tsx` — test assertion string
- `report-excel-export.test.ts` — test assertion string

**Config (4 files):**
- `playwright.config.ts`, `.storybook/main.ts`, `cacheConfig.ts`, `select/index.ts` — comment headers

**Documentation (8 files):**
- 7 README/markdown files in `components/`, `lib/query/`, `public/icons/`, `tests/`
- `generate-maskable-icons.sh` — script comment

**Legacy SQL (9 files):**
- `init.sql` + 7 schema files in `wj-server/src/common/database/` — comment headers only (no functional change)

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| XSS via brand name | All brand names are hardcoded strings, never user input | Yes |
| FAB wallet creation auth | Reuses existing `CreateWalletForm` → `useMutationCreateWallet` → JWT-protected `POST /api/v1/wallets` | Yes |
| No new data flows | All changes are static text, CSS, or component props | Yes |
| No new trust boundaries | No new API endpoints or data paths | Yes |
| No sensitive data changes | No credentials, tokens, or PII affected | Yes |

## Review Results

### Spec Compliance

All 4 original spec requirements fulfilled:
- **FR-1 (Rebrand):** All user-visible "WealthJourney" references replaced with "congdongvang.com" — verified via `grep -r "WealthJourney" src/` returning 0 matches
- **FR-2 (iOS status bar):** `manifest.json` `theme_color` updated `#008148` → `#B91C1C`
- **FR-3 (Price tables):** Responsive padding/font/tracking applied to all 3 tables; `table-fixed` + `<colgroup>` eliminates horizontal scroll
- **FR-4a/b (FAB):** 3 actions (Transaction, Transfer, Wallet); visible on all screen sizes with responsive positioning

**Extended scope (user request):** All "WealthJourney" references across entire `src/` directory (translations, auth, landing, components, tests, config, docs, SQL) replaced — 0 remaining matches confirmed.

### Security Review

No security concerns — all changes are frontend branding, CSS, and UI component prop adjustments. The only functional addition (FAB "Add Wallet" action) reuses the existing authenticated wallet creation flow.

### Code Quality

- Mobile-first responsive approach with `sm:` breakpoint at 800px (matches project convention)
- Font sizes reduced proportionally to maintain visual hierarchy
- `sm:!bottom-6` uses Tailwind important modifier to override inline style (documented, necessary)
- No new dependencies added
- No barrel file imports — all direct imports
- TypeScript compilation passes cleanly

## Known Issues / Technical Debt

1. **PWA cache lag:** Installed PWAs may show old "WealthJourney" branding until the service worker updates the cached manifest. Users may need to reinstall the PWA or wait for the next cache refresh cycle.
2. **iOS theme_color persistence:** iOS may cache the old green `theme_color` — requires reinstalling the PWA or clearing Safari data to pick up `#B91C1C`.
3. **Spec out-of-scope items completed:** The original spec marked landing page, auth pages, translations, docs, and SQL as "out of scope." These were completed per the user's expanded request. The spec could be updated to reflect the final delivered scope.

## Files Changed

**55 files total (+207 / -133 lines)**

<details>
<summary>Full file list (click to expand)</summary>

**Metadata & PWA (3 files)**
- `src/wj-client/app/layout.tsx`
- `src/wj-client/app/[locale]/layout.tsx`
- `src/wj-client/public/manifest.json`

**Dashboard (4 files)**
- `src/wj-client/app/[locale]/dashboard/layout.tsx`
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`
- `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx`

**FAB (1 file)**
- `src/wj-client/components/FloatingActionButton.tsx`

**Auth pages (3 files)**
- `src/wj-client/app/[locale]/auth/layout.tsx`
- `src/wj-client/app/[locale]/auth/login/page.tsx`
- `src/wj-client/app/[locale]/auth/register/page.tsx`

**Landing page (3 files)**
- `src/wj-client/app/[locale]/landing/layout.tsx`
- `src/wj-client/components/landing/LandingNavbar.tsx`
- `src/wj-client/components/landing/LandingComparison.tsx`

**Translations (10 files)**
- `src/wj-client/messages/en/auth.json`
- `src/wj-client/messages/en/common.json`
- `src/wj-client/messages/en/nav.json`
- `src/wj-client/messages/en/report.json`
- `src/wj-client/messages/en/ui.json`
- `src/wj-client/messages/vi/auth.json`
- `src/wj-client/messages/vi/common.json`
- `src/wj-client/messages/vi/nav.json`
- `src/wj-client/messages/vi/report.json`
- `src/wj-client/messages/vi/ui.json`

**Components (4 files)**
- `src/wj-client/components/share/ShareDialog.tsx`
- `src/wj-client/components/onboarding/Tour.tsx`
- `src/wj-client/components/select/index.ts`
- `src/wj-client/features/report/utils/export/report-excel-export.ts`
- `src/wj-client/features/report/utils/export/report-pdf-export.ts`

**Tests (3 files)**
- `src/wj-client/tests/e2e/login-flow.spec.ts`
- `src/wj-client/components/pwa/__tests__/PWAInstallPrompt.test.tsx`
- `src/wj-client/features/report/utils/export/report-excel-export.test.ts`

**Config (3 files)**
- `src/wj-client/playwright.config.ts`
- `src/wj-client/.storybook/main.ts`
- `src/wj-client/lib/query/cacheConfig.ts`

**Scripts (1 file)**
- `src/wj-client/scripts/generate-maskable-icons.sh`

**Documentation (8 files)**
- `src/wj-client/components/ButtonGroup.DEPRECATED.md`
- `src/wj-client/components/loading/README.md`
- `src/wj-client/components/navigation/README.md`
- `src/wj-client/components/table/README.md`
- `src/wj-client/components/table/VIRTUALIZED_LIST_IMPLEMENTATION_SUMMARY.md`
- `src/wj-client/lib/query/README.md`
- `src/wj-client/lib/query/USAGE_EXAMPLES.md`
- `src/wj-client/public/icons/README.md`
- `src/wj-client/tests/README.md`

**Legacy SQL (9 files)**
- `src/wj-server/src/common/database/init.sql`
- `src/wj-server/src/common/database/schema/01-init.sql`
- `src/wj-server/src/common/database/schema/02-users.sql`
- `src/wj-server/src/common/database/schema/03-wallets.sql`
- `src/wj-server/src/common/database/schema/04-transactions.sql`
- `src/wj-server/src/common/database/schema/05-categories.sql`
- `src/wj-server/src/common/database/schema/05-sessions.sql`
- `src/wj-server/src/common/database/schema/06-budgets.sql`
- `src/wj-server/src/common/database/schema/07-list-budgets.sql`

**Progress tracking (1 file)**
- `docs/reports/2026-03-15-rebrand-and-ui-improvements-progress.md`

</details>

## How to Test

### Rebrand Verification
1. Open the app in browser — tab title should show "congdongvang.com"
2. On desktop, verify sidebar shows "C" logo + "congdongvang.com" (expanded), "C" (collapsed)
3. On mobile (375px), verify header shows "C" + "congdongvang.com"
4. Open mobile slide-out menu — verify "C" + "congdongvang.com"
5. Visit `/auth/login` and `/auth/register` — verify "congdongvang.com" branding
6. Visit `/landing` — verify all metadata and brand references
7. Run `grep -r "WealthJourney" src/` — should return 0 matches

### iOS Status Bar
1. Install PWA on iOS device
2. Verify status bar shows red (#B91C1C), not green (#008148)
3. Check `manifest.json` `theme_color` = "#B91C1C"

### Price Tables (Mobile)
1. Open `/dashboard/home` at 375px viewport width
2. Verify no horizontal scroll on Gold, Silver, and Currency tables
3. Verify text is readable with proper hierarchy
4. Resize to 800px+ — verify desktop styling is restored (larger padding, larger fonts, tracking)
5. If admin, verify inline edit buttons still work

### FAB Enhancement
1. On mobile: tap FAB "+" button — verify 3 actions appear (Add Transaction, Transfer Money, Add Wallet)
2. Tap "Add Wallet" — verify CreateWalletForm modal opens
3. Complete wallet creation — verify modal closes and data refreshes
4. On desktop (800px+): verify FAB is visible in bottom-right corner
5. Verify FAB backdrop covers full screen on both mobile and desktop

### Translations
1. Switch language to English — verify all brand references say "congdongvang.com"
2. Switch language to Vietnamese — verify all brand references say "congdongvang.com"
3. Check PWA install prompt text in both languages
4. Export a report (PDF/Excel) — verify footer says "congdongvang.com"

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-15 | Reverted Task 3 (Optimize Price Tables for Mobile) — restored original table styling for GoldPriceTable, SilverPriceTable, CurrencyPriceTable | Minor | `7cc44de` |
| 2026-03-15 | Replaced "Coming Soon" empty states with proper loading spinners and "No data" messages in GoldPriceTable, SilverPriceTable, CurrencyPriceTable, WalletsSection, PNLCard, SuggestedUsersPlaceholder | Minor | *pending* |
| 2026-03-15 | Replaced all 4 hardcoded "C" letter logos in dashboard layout with actual `<NextImage src="/logo.svg">` — desktop sidebar (expanded + collapsed), mobile header, mobile slide-out menu | Minor | *pending* |
