# Mi Hong Design Overhaul — Implementation Report

**Branch:** `feat/mihong-design-overhaul`
**Date:** 2026-03-20
**Scope:** Frontend-only visual redesign (no backend/API changes)
**Total:** 200 files changed, 3,776 insertions, 2,462 deletions across 12 commits

---

## Executive Summary

Complete visual redesign of the WealthJourney frontend to match mihong.vn's traditional Vietnamese gold shop aesthetic. The app was migrated from a light-themed green/white fintech palette to a permanently dark maroon background with gold accents, Roboto fonts, and ornate decorative elements. All 22 planned tasks were completed with zero build errors.

---

## Commits

| # | Commit | Description |
|---|--------|-------------|
| 1 | `a032ede` | docs(architecture): note mihong.vn design system migration in C4 frontend diagram |
| 2 | `4b32cab` | feat(theme): migrate Tailwind color palette to mihong.vn maroon/gold theme |
| 3 | `21e2327` | feat(theme): migrate fonts to Roboto and update globals.css for mihong.vn dark maroon theme |
| 4 | `111e667` | refactor(theme): remove ThemeProvider and ThemeToggle (permanent dark maroon theme) |
| 5 | `2d9c40c` | refactor(theme): strip all dark: prefixed Tailwind classes (101 files) |
| 6 | `0e63108` | feat(components): restyle BaseCard and Button for mihong.vn maroon/gold theme |
| 7 | `15d659b` | feat(forms): restyle all form components for mihong.vn maroon/gold theme |
| 8 | `391e889` | feat(ui): restyle modals, toasts, feedback, and skeleton loaders for mihong.vn theme |
| 9 | `ecc9656` | feat(nav): restyle navigation, search, and select components for mihong.vn theme |
| 10 | `9357d16` | feat(layout): restyle dashboard layout for mihong.vn maroon/gold theme |
| 11 | `56183a9` | docs: update progress — Tasks 8-11 done (forms, modals, nav, layout) |
| 12 | `371707c` | feat(pages): restyle all pages, charts, and components for mihong.vn maroon/gold theme |

---

## Task Completion Summary

### Phase 1: Foundation (Tasks 0-5)

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 0 | Update C4 architecture documentation | 1 | Done |
| 1 | Migrate Tailwind color palette — new maroon/gold/cream color system with v2-* tokens | 1 | Done |
| 2 | Font migration — Jakarta Sans/Vietnam Pro to Roboto; JetBrains Mono to Roboto Mono | 3 | Done |
| 3 | Update globals.css — base styles, CSS variables, remove dark mode CSS | 2 | Done |
| 4 | Remove ThemeProvider and ThemeToggle — permanent dark theme | 4 | Done |
| 5 | Strip all `dark:` prefixed Tailwind classes | 101 | Done |

### Phase 2: Core Components (Tasks 6-10)

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 6 | Restyle BaseCard — maroon bg, gold border, dark shadows | 1 | Done |
| 7 | Restyle Button — gold primary, maroon secondary, outline variants | 1 | Done |
| 8 | Restyle Form components — dark inputs, gold focus rings, white text | 8 | Done |
| 9 | Restyle Modals, Toast, Feedback, Skeleton loaders | 10 | Done |
| 10 | Restyle Navigation — sidebar, bottom nav, active states | 5 | Done |

### Phase 3: Layout & Pages (Tasks 11-18)

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 11 | Restyle Dashboard layout — maroon sidebar, gold accents | 3 | Done |
| 12 | Restyle Landing page components — hero, features, testimonials, CTA, navbar, price tables | 13 | Done |
| 13 | Restyle Auth pages — login, register, password forms | 8 | Done |
| 14 | Restyle Dashboard Home — total balance, PNL, wallets, price tables, charts | 11 | Done |
| 15 | Restyle Prices page & market data components | 2 | Done |
| 16 | Restyle Transaction, Wallets, Portfolio pages | 12 | Done |
| 17 | Restyle Budget, Report pages | 11 | Done |
| 18 | Restyle Settings, Admin, Import pages | 15 | Done |

### Phase 4: Polish (Tasks 19-21)

| Task | Description | Files | Status |
|------|-------------|-------|--------|
| 19 | Create decorative components (OrnateHeading, OrnateDivider) | 2 new | Done |
| 20 | Apply decorative elements to prices, home, and landing pages | 3 | Done |
| 21 | Chart color updates & visual audit — gold/red/cream palette, bg-white cleanup (64 → 11) | 49 | Done |

---

## Key Changes

### Color System

| Token | Old Value | New Value | Usage |
|-------|-----------|-----------|-------|
| `v2-maroon-700` | — | `#5F0202` | Primary background |
| `v2-maroon-800` | — | `#580202` | Surface/card background |
| `v2-maroon-900` | — | `#3D0101` | Input/dropdown background |
| `v2-gold-primary` | — | `#D78B1C` | Primary CTA, borders, accents |
| `v2-gold-accent` | — | `#F1BD61` | Secondary gold, headings |
| `v2-gold-light` | — | `#F5D38E` | Highlights, hover states |
| `v2-cream-100` | — | `#FFF8EC` | Body text alternative |
| `v2-red-primary` | — | `#9B0111` | Brand red, danger states |
| `bg` (old green) | `#008148` | `#9B0111` | Legacy alias redirected |

### Typography

| Before | After |
|--------|-------|
| Plus Jakarta Sans | Roboto (400, 500, 700, 900) |
| Be Vietnam Pro | Roboto (consolidated) |
| JetBrains Mono | Roboto Mono (400, 500, 600, 700) |

Font aliases (`font-vietnam`, `font-jakarta`, `font-jetbrains`) preserved for backward compatibility — all resolve to Roboto/Roboto Mono.

### Dark Mode Removal

- Removed `ThemeProvider` component and `ThemeToggle` button
- Removed `darkMode: "class"` from Tailwind config
- Stripped `dark:` prefixed classes from 101 files
- Removed `.dark` CSS rules from globals.css
- App is now permanently dark-themed (no toggle)

### Chart Colors

| Component | Before | After |
|-----------|--------|-------|
| Line/Bar charts | Green fintech palette, light grid | Gold lines, dark maroon grid, cream axes |
| Donut charts | Green/teal segments | Gold/red/cream segments |
| Sparklines | Green up / red down | Gold up / maroon-red down |
| TradingView | Light theme | Dark theme with maroon bg, gold/red candles |
| Tooltips | White bg, gray border | Maroon bg, gold border |
| Chart constants | `chartColors` = green palette | `chartColors` = gold/red/cream palette |

### Decorative Elements

Two new components created in `components/decorative/`:

- **OrnateHeading** — renders `——◆—— HEADING TEXT ——◆——` with gold gradient lines and diamond accents (sizes: sm, md, lg)
- **OrnateDivider** — gold horizontal divider with 3 variants: `simple` (gradient line), `diamond` (line-diamond-line), `ornate` (double diamond with short center line)

Applied to:
- Prices page: OrnateHeading on "Market Prices" title
- Dashboard home: OrnateDividers between PNL/charts/wallets sections
- Landing page: OrnateDividers between gold/silver/currency sections

### Visual Audit Results

`bg-white` occurrences reduced from **64 files → 11 files**. All 11 remaining are intentional:
- `bg-white/10`, `bg-white/20` — transparent overlays on gradient wallet cards
- Toggle switch knobs (PeriodSelector)
- Progress bar indicators on dark overlays (ImageUpload)

---

## Files Changed by Category

| Category | Count | Examples |
|----------|-------|---------|
| Dashboard pages | 35 | home, transaction, wallets, portfolio, budget, report, prices, settings, admin |
| Landing components | 13 | Hero, Features, Testimonials, CTA, Navbar, price tables/charts |
| Auth pages & forms | 8 | Login, Register, password forms, AuthMethodsCard |
| Shared components | 30 | BaseCard, Button, forms, modals, charts, navigation, select, loading, feedback |
| Feature modules | 28 | Import wizard (9), community (18), market-prices (1) |
| Chart components | 8 | LineChart, BarChart, DonutChart, DonutChartSVG, Sparkline, TradingView, ChartWrapper, constants |
| Config/infrastructure | 6 | tailwind.config.ts, globals.css, layout.tsx, ThemeProvider (deleted), ThemeToggle (deleted) |
| Documentation | 4 | C4 diagram, spec, plan, progress |
| New components | 2 | OrnateHeading, OrnateDivider |

---

## Build Verification

- `next build` passes with **zero errors** on all 21 routes
- All routes render as dynamic (server-rendered on demand) except `/_not-found` (static)
- No TypeScript compilation errors

---

## Architecture Notes

- **Frontend-only change** — no backend, API, database, or protobuf modifications
- **Component structure preserved** — only Tailwind classes and CSS variables changed
- **No new dependencies** — Roboto loaded via existing `next/font/google` (self-hosted at build time)
- **Backward-compatible font aliases** — `font-vietnam`, `font-jakarta`, `font-jetbrains` still work
- **No security impact** — no new data flows, APIs, or user inputs

---

## Review Verdict: ISSUES FOUND

**Reviewed:** 2026-03-20

### Spec Compliance: FAIL (2 issues)

FR-1 through FR-4, FR-6, FR-7: **PASS** — color system, fonts, dark mode removal, decorative elements, auth pages, dashboard layout all correctly implemented.

**FR-5 (Landing Page): FAIL** — 5 landing sub-components retain `bg-white` with `text-gray-*` colors, violating the "no white/light backgrounds" requirement:
- `LandingHowItWorks.tsx` — `bg-white` step cards
- `LandingComparison.tsx` — `bg-white` comparison table/cards
- `LandingInvestmentFeatures.tsx` — `bg-white` feature cards
- `LandingBankImport.tsx` — `bg-white` stat cards
- `LandingHero.tsx` — `bg-white` browser mockup (cosmetic, lower priority)

**FR-9 (Component Library): MINOR FAIL** — `LoadingSpinner.tsx` uses `text-primary-500` (red) instead of gold per spec requirement "Loading states use gold colors".

### Security Audit: PASS

All 7 checks passed:
- No backend/API changes
- No new dependencies added
- Fonts self-hosted via `next/font/google`
- No XSS risk in decorative components (no `dangerouslySetInnerHTML`)
- No secrets/credentials leaked
- No auth/middleware changes
- CSP compatible (no inline styles or external URLs)

### Integration Review: FAIL (1 critical issue)

- **Build:** PASS (zero errors, 21 routes)
- **TypeScript:** PASS (zero errors)
- **Deleted component cleanup:** PASS (no ThemeProvider/ThemeToggle references remain)
- **`dark:` class removal:** PASS (zero remaining)
- **Color token consistency: FAIL** — 5 token families used in 50+ files but **undefined** in `tailwind.config.ts`:
  - `v2-maroon-600`, `v2-maroon-700`, `v2-maroon-800`, `v2-maroon-900`
  - `v2-cream-100`

  These classes silently produce no CSS output in Tailwind 3.x — elements using `bg-v2-maroon-800` or `text-v2-cream-100` have **no styling applied**. This is a visual bug that does not break the build.

### Architecture Diagrams: PASS

C4 frontend component diagram updated with mihong.vn design migration note.

### Dependency Impact: SKIPPED — no GitNexus index

### Issues

| # | Severity | Category | Description | Files |
|---|----------|----------|-------------|-------|
| 1 | Critical | Integration | 5 undefined color tokens (`v2-maroon-600/700/800/900`, `v2-cream-100`) used in 50+ files but missing from `tailwind.config.ts` — produces no CSS output | `tailwind.config.ts` + 50+ component files |
| 2 | Major | Spec Compliance | 5 landing sub-components retain `bg-white` with `text-gray-*` colors — violates FR-5 | `LandingHowItWorks.tsx`, `LandingComparison.tsx`, `LandingInvestmentFeatures.tsx`, `LandingBankImport.tsx`, `LandingHero.tsx` |
| 3 | Minor | Spec Compliance | `LoadingSpinner` uses red (`text-primary-500`) instead of gold per FR-9 | `LoadingSpinner.tsx` |
| 4 | Minor | Spec Compliance | Auth layout wrapper uses `bg-neutral-50` (near-white) | `app/[locale]/auth/layout.tsx:29` |

### Recommendation

Fix issues and re-review. Issue #1 (missing color tokens) is critical — dozens of components are silently unstyled. Issue #2 (landing page `bg-white`) is a visible regression against the spec. Both should be fixed before merging.

---

## Fix History

| Date | Fix | Severity | Files Changed |
|------|-----|----------|---------------|
| 2026-03-20 | Added 5 missing color tokens (`v2-maroon-600/700/800/900`, `v2-cream-100`) to `tailwind.config.ts` — fixes 50+ files with silently unstyled classes | Critical | `tailwind.config.ts` |
| 2026-03-20 | Replaced `bg-white` + `text-gray-*` with maroon/gold theme classes in 5 landing components (`LandingHowItWorks`, `LandingComparison`, `LandingInvestmentFeatures`, `LandingBankImport`, `LandingHero`) | Major | 5 landing component files |
| 2026-03-20 | Changed `LoadingSpinner` from `text-primary-500` (red) to `text-v2-gold-primary` per FR-9 spec | Minor | `LoadingSpinner.tsx` |
| 2026-03-20 | Changed auth layout wrapper from `bg-neutral-50` to `bg-v2-maroon-900` | Minor | `app/[locale]/auth/layout.tsx` |
| 2026-03-21 | Consolidated all fonts to Roboto only — removed `Roboto_Mono` import, deleted `font-vietnam`/`font-jakarta`/`font-jetbrains`/`font-roboto-mono` aliases from Tailwind config, replaced all 53 component file references with `font-roboto`, updated `v2-data-*` CSS classes to use `--font-roboto` | Minor | `tailwind.config.ts`, `layout.tsx`, `globals.css` + 53 component files |
| 2026-03-21 | Restyled all price tables to mihong.vn gold shop aesthetic — gradient header bars (gold/silver/blue per asset type), warm cream/parchment alternating row backgrounds (`v2-cream-200` #F5E6C8, `v2-cream-300` #EDD9B5), dark maroon text on type column, red buy / green sell price colors, clean cell borders. Added 2 new Tailwind color tokens and CSS overrides for TanStackTable price variant. | Minor | `tailwind.config.ts`, `globals.css`, `LandingGoldPriceTable.tsx`, `LandingSilverPriceTable.tsx`, `LandingCurrencyPriceTable.tsx`, `home/GoldPriceTable.tsx`, `home/SilverPriceTable.tsx`, `home/CurrencyPriceTable.tsx`, `prices/page.tsx` (9 files) |
| 2026-03-21 | Added `rounded-b-lg` to inner `overflow-x-auto` table wrapper in all 6 price table components — fixes bottom border radius not clipping due to nested overflow context | Minor | `home/GoldPriceTable.tsx`, `home/SilverPriceTable.tsx`, `home/CurrencyPriceTable.tsx`, `LandingGoldPriceTable.tsx`, `LandingSilverPriceTable.tsx`, `LandingCurrencyPriceTable.tsx` (6 files) |
| 2026-03-21 | Changed all main body text from white (#FFFFFF) to gold (#F1BD61) — updated CSS `--foreground` variable, Tailwind `v2-text-primary`/`v2-text-on-dark` tokens, and replaced `text-white` with `text-v2-gold-accent` in ~80 component files. Preserved `text-white` on colored button/badge/gradient surfaces. | Minor | `globals.css`, `tailwind.config.ts` + ~80 component files |

| 2026-03-21 | Replaced all `neutral-*` Tailwind CSS classes with mihong.vn v2 maroon/gold theme tokens across 9 portfolio page files (~85 occurrences) — dark text → `text-v2-gold-accent`, labels → `text-v2-text-secondary`, muted → `text-v2-text-tertiary`, backgrounds → `bg-v2-maroon-800/900`, borders → `border-v2-border-light` | Minor | `page.tsx`, `InvestmentCard.tsx`, `InvestmentCardEnhanced.tsx`, `PortfolioSummary.tsx`, `PortfolioAnalytics.tsx`, `PortfolioSummaryEnhanced.tsx`, `PullToRefreshIndicator.tsx`, `EmptyStates.tsx`, `WalletCashBalanceCard.tsx` (9 files) |

| 2026-03-21 | Restyled NetWorthDisplay card to mihong.vn gold shop aesthetic — gold metallic gradient background (linear-gradient from #F5D38E to #B8862D), dragon watermark SVG overlay on right side via `next/image`, dark brown text on gold surface, frosted glass PnL badge. Removed BaseCard dependency, both mobile and desktop variants updated. Created `/public/dragon-watermark.svg` (6.6KB traditional Vietnamese dragon). | Minor | `NetWorthDisplay.tsx`, `public/dragon-watermark.svg` (2 files) |

| 2026-03-21 | Fixed skeleton/loading components retaining light/white color patterns — `Skeleton` base: `bg-neutral-200` → `bg-v2-maroon-900`, shimmer: `via-white/40` → `via-v2-gold-primary/20`, line chart stroke: `text-neutral-200` → `text-v2-gold-primary/30`, warning box: `bg-danger-50` → `bg-v2-red-light`. `FullPageLoading`: `bg-neutral-50` → `bg-v2-maroon-700`, spinner/text: `text-primary-500` → `text-v2-gold-primary`. | Minor | `Skeleton.tsx`, `FullPageLoading.tsx` (2 files) |

| 2026-03-21 | Replaced `text-gray-600/700` and `bg-red-50`/`hover:bg-red-100` with mihong.vn v2 theme tokens in AddInvestmentTransactionForm — success message: `text-v2-text-secondary`, price label: `text-v2-gold-accent`, refresh button: `text-v2-gold-primary bg-v2-maroon-900 hover:bg-v2-maroon-800` | Minor | `AddInvestmentTransactionForm.tsx` (1 file) |

| 2026-03-21 | Full theme migration of InvestmentDetailModal — replaced all `text-gray-*`, `bg-gray-*`, `bg-red-50`, `bg-blue-50`, `bg-yellow-50`, `text-primary-*`, `text-secondary-*`, `text-red-600`, `text-danger-600` with v2 tokens. Labels → `text-v2-text-secondary`, muted text → `text-v2-text-tertiary`, positive values → `text-v2-green-positive`, negative → `text-v2-red-negative`, tabs active → `text-v2-gold-primary`, delete button → `bg-v2-maroon-900`, icon buttons → `hover:bg-v2-maroon-800`, freshness indicators → green/gold/red v2 tokens. | Minor | `InvestmentDetailModal.tsx` (1 file) |

| 2026-03-21 | Migrated all border colors to gold — updated `v2-border-light` token from red `rgba(155,1,17,0.2)` to gold `rgba(215,139,28,0.3)` and `v2-border` from `#9B0111` to `#D78B1C` in tailwind.config.ts. Replaced all remaining non-gold `border-neutral-*`, `border-gray-*`, `border-primary-*`, `border-white/*`, `border-bg`, `border-[hex]`, `divide-*`, `ring-*`, and `focus:ring-*` classes with v2 gold tokens across 70 component files. Semantic borders (danger→`v2-red-negative`, success→`v2-green-positive`, warning→`v2-gold-accent`) preserved with theme-appropriate v2 equivalents. Social media brand hex colors kept. | Minor | `tailwind.config.ts` + 70 component files |

**Build verification:** `next build` passes with zero errors on all 21 routes after fixes.
**Security review:** APPROVED — all changes are CSS-only class replacements, no security impact.
