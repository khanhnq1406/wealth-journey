# V2 Color System Migration Specification

## Summary

The WealthJourney application was built with a legacy fintech-green brand palette (`#008148` as primary). The new V2 design system — "Crimson & Gold" — replaces green with red as the brand primary and gold as the secondary accent. Green is retained only as a semantic financial signal for gains/profits. This spec covers a full codebase migration of all old green color patterns (~275 occurrences across 61 files) to the V2 design token system already defined in `tailwind.config.ts`.

---

## User Stories

- As a user, I want the app UI to feel consistent with the new Crimson & Gold brand identity, so that the experience feels polished and premium.
- As a developer, I want all color usage to reference semantic V2 tokens, so that future theme changes require updating only the token definitions.

---

## Functional Requirements

### FR-1: Replace Brand Green with V2 Red for Action/Interactive Elements

All UI elements using green as the primary action color must be migrated to `v2-red-primary`.

**Targets:**
- Primary buttons (class `bg-bg`, `bg-primary-600`, `bg-[#008148]`, `hgreen`)
- Form focus rings (`focus:ring-green-*`, `ring-[#008148]`)
- Active/selected navigation states
- Progress step indicators (`StepProgress.tsx`)
- Checkbox and radio accent colors (`accent-bg`)
- Border highlights on selected states (`border-bg`, `border-green-*` for selection)

**Acceptance criteria:**
- [ ] No occurrence of `bg-bg`, `text-bg`, `border-bg`, `accent-bg` Tailwind token classes remain
- [ ] No hardcoded `#008148`, `#006638` hex values remain in TSX/TS files
- [ ] Form focus rings use `focus:ring-v2-red-primary` (or equivalent CSS variable)
- [ ] Active nav items use `text-v2-red-primary` instead of green
- [ ] StepProgress completed/active states use `bg-v2-red-primary`

### FR-2: Replace Semantic Financial Gain Green with `v2-green-positive`

All `text-green-*` and `bg-green-*` classes used for positive PNL, gains, income, and budget surplus must be migrated to the V2 semantic green token.

**Mapping:**
- `text-green-600`, `text-green-700` → `text-v2-green-positive`
- `text-green-800` → `text-v2-green-positive` (same token, it's dark enough)
- `bg-green-50`, `bg-green-100` → `bg-v2-green-light`
- `border-green-*` (gain context) → `border-v2-green-positive` (if token exists) or `border-v2-border`

**Acceptance criteria:**
- [ ] Transaction income amounts use `text-v2-green-positive`
- [ ] PNL positive values use `text-v2-green-positive`
- [ ] Budget surplus indicators use `text-v2-green-positive` and `bg-v2-green-light`
- [ ] Portfolio gain badges use V2 green tokens

### FR-3: Update Tailwind Config to Remove Legacy Tokens

After component migration, legacy tokens in `tailwind.config.ts` must be deprecated/removed.

**Targets:**
- Remove/deprecate: `bg` (`#008148`), `hgreen` (`#006638`), `lred` (already aligned with `v2-red-negative`)
- Clean CSS variables: `--btn-green`, `--btn-green-hover`, `--primary-green`, `--accent-green` in `globals.css`
- Clean `.custom-btn` class using `var(--btn-green)` in `globals.css`

**Acceptance criteria:**
- [ ] `bg` color token removed or aliased to `v2-red-primary`
- [ ] `hgreen` token removed from tailwind config
- [ ] CSS variables for old green removed from globals.css
- [ ] `custom-btn` class updated or removed

### FR-4: Update SVG Illustration Assets

Public SVG files containing hardcoded green hex values must be updated to use the new crimson brand color.

**Affected SVGs (in `/public/`):**
- `login-stock.svg` (29 occurrences of green)
- `dashboard.svg` (5 occurrences)
- `report.svg` (5 occurrences)
- `portfolio.svg` (7 occurrences)
- `budget.svg` (4 occurrences)
- `transaction.svg` (4 occurrences)
- `home.svg` (3 occurrences)

**Mapping for SVGs:**
- `#008148`, `#16A34A`, `#22C55E` (brand/decorative green) → `#B91C1C` (v2-red-primary)
- `#15803D` (if used as gain indicators in SVG) → keep as is or `#15803D` (v2-green-positive)

**Acceptance criteria:**
- [ ] All public SVG files have 0 occurrences of `#008148`, `#006638`, `#22C55E` as brand colors
- [ ] SVG illustrations visually align with the Crimson & Gold brand

### FR-5: Update CSS Animation and Success States

The `successAnimation.css` file uses green hex values for success animations.

**Decision:** Success animations can use `v2-green-positive` (#15803D) since financial success (completed transaction) is semantically green.

**Acceptance criteria:**
- [ ] `successAnimation.css` uses `#15803D` or CSS variable for V2 green-positive

### FR-6: Update Test Files

Test files referencing green color classes as assertions must be updated.

**Affected:**
- `tests/integration/portfolio-calculations.test.ts` (1 occurrence)
- `export-utils.test.ts` (2 occurrences of hardcoded green hex)

---

## Non-Functional Requirements

- **Performance:** No additional CSS bundle size increase — this is a token rename, not new classes
- **Consistency:** All color usage must reference V2 tokens via `text-v2-*` / `bg-v2-*` / `border-v2-*` Tailwind classes
- **No regressions:** All existing UI functionality must remain intact
- **Mobile parity:** All color changes apply identically on mobile and desktop

---

## Color Migration Mapping Reference

### Old Green → New V2 Token

| Old Class / Hex | Context | New Class / Value |
|----------------|---------|------------------|
| `bg-bg` | Brand/CTA | `bg-v2-red-primary` |
| `text-bg` | Brand text | `text-v2-red-primary` |
| `border-bg` | Selected border | `border-v2-red-primary` |
| `accent-bg` | Form accent | `accent-v2-red-primary` |
| `hgreen`, `hover:bg-hgreen` | Hover state | `hover:bg-v2-red-dark` |
| `bg-[#008148]` | Hardcoded brand | `bg-v2-red-primary` |
| `text-[#008148]` | Hardcoded brand text | `text-v2-red-primary` |
| `border-[#008148]` | Hardcoded brand border | `border-v2-red-primary` |
| `ring-[#008148]` | Focus ring | `ring-v2-red-primary` or `focus:ring-v2-red-primary` |
| `focus:ring-green-500` | Form focus | `focus:ring-v2-red-primary` |
| `focus:ring-green-600` | Form focus | `focus:ring-v2-red-primary` |
| `border-green-500` (selected state) | Selection | `border-v2-red-primary` |
| `bg-primary-600` (old primary) | CTA | `bg-v2-red-primary` |
| **Financial gain green** | | |
| `text-green-600` | Gain/income | `text-v2-green-positive` |
| `text-green-700` | Gain/income | `text-v2-green-positive` |
| `text-green-800` | Gain/income | `text-v2-green-positive` |
| `bg-green-50` | Gain bg | `bg-v2-green-light` |
| `bg-green-100` | Gain bg | `bg-v2-green-light` |
| `bg-green-500` | Gain indicator | `bg-v2-green-positive` |
| `border-green-200` | Gain border | `border-v2-border-light` |
| **Hardcoded financial green hex** | | |
| `#15803D` | Gain color | `#15803D` (= v2-green-positive, no change) |
| `#16A34A` | Success/gain | `#15803D` (v2-green-positive) |
| `#22C55E` | Success/gain | `#15803D` (v2-green-positive) |

---

## Architecture Changes (C4)

### Diagrams to Update

**L3 Frontend Component diagram** (`c4-component-frontend.md`): No structural changes — this is a styling migration only. No new components or pages. No diagram update needed.

### New Diagrams

None required — this is a pure styling migration with no new behavioral components.

---

## Runtime Flow Diagrams

No new runtime flows — color migration does not affect data flows or business logic.

---

## Data Model Changes

None.

---

## API Changes

None.

---

## UI/UX Changes

### Visual Changes

- **Navigation**: Active nav items turn crimson red instead of green
- **Primary buttons**: Red CTAs replace green (matches branding)
- **Form focus rings**: Red outline on focused inputs
- **Progress steps**: Active/completed steps use red
- **Financial gains**: Remain green (semantic, conventional)
- **SVG illustrations**: Brand illustrations shift from green to crimson palette

### Files Affected (61 total, grouped by domain)

**Dashboard & Home:**
- `app/[locale]/dashboard/home/page.tsx`
- `app/[locale]/dashboard/home/NetWorthDisplay.tsx`

**Budget:**
- `app/[locale]/dashboard/budget/BudgetCard.tsx`
- `app/[locale]/dashboard/budget/BudgetProgressCard.tsx`
- `app/[locale]/dashboard/budget/CategoryBreakdown.tsx`

**Portfolio:**
- `app/[locale]/dashboard/portfolio/helpers.tsx`
- `app/[locale]/dashboard/portfolio/components/InvestmentCard.tsx`
- `app/[locale]/dashboard/portfolio/components/InvestmentCardEnhanced.tsx`
- `app/[locale]/dashboard/portfolio/components/InvestmentList.tsx`
- `app/[locale]/dashboard/portfolio/components/Banners.tsx`
- `app/[locale]/dashboard/portfolio/components/PortfolioAnalytics.tsx`
- `app/[locale]/dashboard/portfolio/components/PortfolioSummary.tsx`
- `app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`

**Report:**
- `app/[locale]/dashboard/report/page.tsx`
- `app/[locale]/dashboard/report/SummaryCards.tsx`
- `app/[locale]/dashboard/report/ExpandableTable.tsx`
- `app/[locale]/dashboard/report/ReportControls.tsx`
- `app/[locale]/dashboard/report/data-utils.ts`

**Transaction:**
- `app/[locale]/dashboard/transaction/TransactionItem.tsx`
- `app/[locale]/dashboard/transaction/TransactionFilter.tsx`
- `app/[locale]/dashboard/transaction/TransactionGroup.tsx`

**Prices:**
- `app/[locale]/dashboard/prices/page.tsx`

**Settings:**
- `app/[locale]/dashboard/settings/sessions/page.tsx`

**Features:**
- `features/import/components/StepProgress.tsx`
- `features/import/components/TransactionReviewTable.tsx`
- `features/import/components/ReadyToImportSection.tsx`
- `features/investment/forms/AddInvestmentForm.tsx`
- `features/investment/forms/AddInvestmentTransactionForm.tsx`
- `features/settings/components/LanguageSelector.tsx`
- `features/transaction/forms/AddTransactionForm.tsx`
- `features/transaction/forms/EditTransactionForm.tsx`
- `features/wallet/forms/EditWalletForm.tsx`

**Shared Components:**
- `components/cards/TransactionCard.tsx`
- `components/cards/WealthCard.tsx`
- `components/feedback/EmptyState.tsx`
- `components/feedback/ErrorState.tsx`
- `components/forms/enhanced/FormInput.tsx`
- `components/forms/enhanced/FormSelect.tsx`
- `components/forms/enhanced/FormDatePicker.tsx`
- `components/forms/enhanced/FormField.tsx`
- `components/forms/FormField.tsx`
- `components/forms/NumberSuggestions.tsx`
- `components/forms/CategoryQuickSelect.tsx`
- `components/forms/MarketPriceDisplay.tsx`
- `components/landing/LandingCTA.tsx`
- `components/landing/LandingHero.tsx`
- `components/PerformanceMonitor.tsx`
- `components/ui/Toast.tsx`
- `components/ui/TransactionCard.tsx`
- `components/ui/WealthCard.tsx`
- `components/ui/StatCard.tsx`

**Config & Assets:**
- `tailwind.config.ts`
- `app/globals.css`
- `app/constants.tsx`
- `components/success/successAnimation.css`
- `public/login-stock.svg`
- `public/dashboard.svg`
- `public/report.svg`
- `public/portfolio.svg`
- `public/budget.svg`
- `public/transaction.svg`
- `public/home.svg`

**Tests:**
- `tests/integration/portfolio-calculations.test.ts`
- `app/[locale]/dashboard/report/export-utils.test.ts`

---

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Developer | CSS class changes | No | Browser DOM | Static asset change only |

### Threats Identified (STRIDE)

None. This is a pure CSS/styling migration with no API changes, no data model changes, and no authentication/authorization implications.

### Issues & Risks Summary

1. **Visual regression risk (Medium):** Incorrect token mapping (e.g., replacing semantic gain green with red) would break financial UI conventions. Mitigation: careful per-context classification before replacement.
2. **Token naming gaps:** The `border-v2-green-positive` token may not exist in Tailwind config — need to verify and add if required. Mitigation: check config before implementing border replacements.
3. **SVG replacement risk (Low):** SVG files use multiple shades of green; bulk find/replace may affect non-brand green values (e.g., leaf decorations vs. brand). Mitigation: review SVG content individually.
4. **CSS variable cleanup (Low):** Some components may use CSS variables via `style={{}}` prop or inline styles referencing `--btn-green`. These won't be caught by class-based search. Mitigation: grep for `--btn-green` and `var(--btn-green)` patterns separately.
5. **Test assertion breakage (Low):** Tests asserting specific green class names will fail after migration. Mitigation: update test assertions as part of the migration.

---

## Edge Cases & Error Handling

- Some `text-green-*` classes may be used in SVG/icon components where color is controlled differently — handle with `fill-v2-green-positive` or inline style
- The `hgreen` token is used with `hover:bg-hgreen` — this requires replacing both the Tailwind class AND the token definition
- `accent-bg` is a CSS property shorthand — replace with `accent-v2-red-primary` in Tailwind or set explicitly via CSS

---

## Dependencies & Assumptions

- V2 tokens are already defined in `tailwind.config.ts` — no new token definitions needed (except possibly `border-v2-green-positive` if border on green context is needed)
- Migration is pure styling — no backend changes, no proto changes, no API changes
- The `green-positive` semantic color (#15803D) is intentionally preserved for financial gain indicators per the V2 design spec

---

## Out of Scope

- Dark mode variants — dark mode color adjustments are a separate concern
- Adding new V2 components — this migrates existing components only
- Migrating the old `primary-*` / `success-*` / `danger-*` scale references (these are separate from the `green-*` scale and already partially correct)
- Node.js legacy backend (`wj-server`) — frontend only
