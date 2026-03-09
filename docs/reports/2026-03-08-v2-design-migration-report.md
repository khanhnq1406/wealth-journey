# V2 Design Migration Implementation Report

## Summary

Migrated the WealthJourney frontend dashboard from the green-based (#008148) theme to the "Crimson & Gold" (#B91C1C) design system. This is a frontend-only visual redesign touching the Tailwind color system, typography (Sora + IBM Plex Mono), dashboard layout (sidebar, top bar, mobile header, bottom nav), and the entire home page with 6 new V2 components.

## Spec Reference

`docs/specs/2026-03-08-v2-design-migration-spec.md`

## Plan Reference

`docs/plans/2026-03-08-v2-design-migration-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Color System Migration | Done | tailwind.config.ts, globals.css, constants.tsx, layout.tsx | 141f170 |
| 2 | Typography Migration | Done | [locale]/layout.tsx, tailwind.config.ts, globals.css | 8f739f0 |
| 3 | i18n Translation Keys | Done | messages/vi/ui.json, messages/en/ui.json | 72f63d2 |
| 4 | Desktop Sidebar Redesign | Done | NavItem.tsx, SidebarToggle.tsx, dashboard/layout.tsx | 5232329 |
| 5 | Desktop Top Bar | Done | dashboard/layout.tsx | 5232329 |
| 6 | Mobile Header & Bottom Nav | Done | BottomNav.tsx, dashboard/layout.tsx | 5232329 |
| 7 | Net Worth & PNL Components | Done | NetWorthDisplay.tsx, PNLCard.tsx (new) | 3023983 |
| 8 | Gold Price Table | Done | GoldPriceTable.tsx (new) | 3023983 |
| 9 | Gold Price Chart | Done | GoldPriceChart.tsx (new) | 3023983 |
| 10 | Silver Price Table | Done | SilverPriceTable.tsx (new) | 3023983 |
| 11 | Silver Price Chart | Done | SilverPriceChart.tsx (new) | 3023983 |
| 12 | Wallets Section | Done | WalletsSection.tsx (new) | 3023983 |
| 13 | Home Page Assembly | Done | home/page.tsx | 8ad98f3 |
| 14 | C4 Architecture Diagrams | Done | c4-component-frontend.md | 526d1e6 |
| 15 | Build Verification | Done | home/page.tsx (type fixes) | 526d1e6 |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| No backend changes | Frontend-only visual redesign | Yes |
| No new API endpoints | Reuses existing hooks | Yes |
| No auth/data changes | Same data flow, new presentation | Yes |
| XSS prevention | No raw HTML, React JSX escaping | Yes |

## Build Verification

TypeScript compilation passes cleanly after fixing 3 type errors:
1. `useQueryGetAggregatedPortfolioSummary` required `walletId` and `typeFilter` params
2. `w.balance` is `Money | undefined` — needed `w.balance?.amount`
3. `user.fullname` is `string | null` — needed `?? undefined` coercion

## Files Changed (Complete List)

### Modified
- `src/wj-client/tailwind.config.ts` — V2 colors, fonts, shadows
- `src/wj-client/app/globals.css` — V2 CSS vars, typography classes
- `src/wj-client/app/constants.tsx` — V2 chart colors
- `src/wj-client/app/layout.tsx` — Theme color
- `src/wj-client/app/[locale]/layout.tsx` — Sora + IBM Plex Mono fonts
- `src/wj-client/app/[locale]/dashboard/layout.tsx` — Sidebar, top bar, mobile header
- `src/wj-client/app/[locale]/dashboard/home/page.tsx` — V2 home layout
- `src/wj-client/components/navigation/NavItem.tsx` — V2 styling
- `src/wj-client/components/navigation/BottomNav.tsx` — V2 colors
- `src/wj-client/components/navigation/SidebarToggle.tsx` — V2 colors
- `src/wj-client/messages/vi/ui.json` — V2 dashboard keys
- `src/wj-client/messages/en/ui.json` — V2 dashboard keys
- `docs/architecture/c4-component-frontend.md` — Updated dashboard description

### Created (New Components)
- `src/wj-client/app/[locale]/dashboard/home/NetWorthDisplay.tsx`
- `src/wj-client/app/[locale]/dashboard/home/PNLCard.tsx`
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- `src/wj-client/app/[locale]/dashboard/home/GoldPriceChart.tsx`
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`
- `src/wj-client/app/[locale]/dashboard/home/SilverPriceChart.tsx`
- `src/wj-client/app/[locale]/dashboard/home/WalletsSection.tsx`

### Dependencies Added
- `lucide-react@0.577.0` (icon library, installed with --legacy-peer-deps)

## Known Issues / Technical Debt

1. **Chart placeholders** — Gold/Silver chart components show "Coming soon" placeholder. Real charting (e.g., recharts) to be added in a future task.
2. **PNL data reuse** — Today/7D/30D PNL all use the same `totalPnl` value from portfolio summary. Backend needs separate time-range PNL endpoints for accurate period breakdowns.
3. **Non-migrated pages** — Only dashboard home and navigation are migrated. Other pages (transactions, wallets, portfolio, budget, report, prices) still use the old green theme.
4. **lucide-react peer deps** — Installed with `--legacy-peer-deps` due to React 19 peer dependency conflict.

## How to Test

1. `cd src/wj-client && npm run dev`
2. Navigate to `/dashboard/home`
3. Verify:
   - Sidebar shows white background with red "W" logo mark and lucide icons
   - Top bar shows greeting, date, search, and bell icon
   - Mobile header shows red accent line with compact logo
   - Bottom nav uses V2 red active state
   - Home page shows: Net Worth → PNL → Gold Table → Gold Chart → Silver Table → Silver Chart → Wallets
   - Desktop layout: 4-row grid with proper responsive behavior
   - All fonts render correctly (Sora for headings, IBM Plex Mono for data)
