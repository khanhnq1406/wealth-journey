# V2 Color Migration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Migrate all remaining old green color tokens (brand green `#008148` and semantic gain greens `text-green-*`) to the V2 Crimson & Gold design system tokens across ~61 files.

**Spec:** `docs/specs/2026-03-09-v2-color-migration-spec.md`

**Architecture:** Pure CSS/Tailwind class migration — no component restructuring, no API changes, no new behavior. Each file is migrated in-place by replacing old class strings and hardcoded hex values with V2 token equivalents. V2 tokens are already fully defined in `tailwind.config.ts`.

**Tech Stack:** Tailwind CSS 3.4 (V2 tokens already live), Next.js 15, TypeScript

---

## Security Implementation Notes

Pure CSS migration — no security surface. No new inputs, no new API calls, no authentication changes. The only risk is visual regression (wrong token context) and test assertion breakage, both addressed in tasks below.

## C4 Architecture Diagram Updates

None required — this is a pure styling migration with no structural changes to components or pages.

---

## Color Mapping Reference

Use this as the authoritative lookup table during implementation:

### Brand Green → V2 Red (Primary Action)

| Old | New Tailwind Class | Hex |
|-----|-------------------|-----|
| `bg-bg` | `bg-v2-red-primary` | `#B91C1C` |
| `text-bg` | `text-v2-red-primary` | `#B91C1C` |
| `border-bg` | `border-v2-red-primary` | `#B91C1C` |
| `accent-bg` | `accent-v2-red-primary` | `#B91C1C` |
| `hover:bg-hgreen` | `hover:bg-v2-red-dark` | `#7F1D1D` |
| `bg-[#008148]` | `bg-v2-red-primary` | — |
| `text-[#008148]` | `text-v2-red-primary` | — |
| `border-[#008148]` | `border-v2-red-primary` | — |
| `ring-[#008148]` / `ring-[#008148]/10` | `ring-v2-red-primary` / `ring-v2-red-primary/10` | — |
| `focus:ring-green-500` | `focus:ring-v2-red-primary` | — |
| `focus:ring-green-600` | `focus:ring-v2-red-primary` | — |
| `focus:ring-primary-500` | `focus:ring-v2-red-primary` | — |
| `focus:ring-primary-600` | `focus:ring-v2-red-primary` | — |
| `border-green-500` (selection state) | `border-v2-red-primary` | — |
| `bg-primary-600` | `bg-v2-red-primary` | — |
| `#008148` (inline/hex) | `#B91C1C` | — |
| `#006638` (inline/hex) | `#7F1D1D` | — |

### Financial Gain Green → V2 Green Semantic

| Old | New Tailwind Class | Hex |
|-----|-------------------|-----|
| `text-green-600` | `text-v2-green-positive` | `#15803D` |
| `text-green-700` | `text-v2-green-positive` | `#15803D` |
| `text-green-800` | `text-v2-green-positive` | `#15803D` |
| `bg-green-50` | `bg-v2-green-light` | `#F0FDF4` |
| `bg-green-100` | `bg-v2-green-light` | `#F0FDF4` |
| `bg-green-500` | `bg-v2-green-positive` | `#15803D` |
| `border-green-200` | `border-v2-border` | `#DDD8D0` |
| `border-green-500` (gain context) | `border-v2-green-positive` | `#15803D` |
| `#16A34A`, `#22C55E` (gain hex) | `#15803D` | — |

### Special: No Change Needed
- `#15803D` — already equals `v2-green-positive`, no change
- `text-red-*`, `bg-red-*` — already V2-aligned (lred = #DC2626 = v2-red-negative)

---

## Task Dependency Overview

```
Task 1: Shared Form Components      ─┐
Task 2: Shared UI & Other Components ─┤─ All independent (different files)
Task 3: Import Feature Components   ─┤
Task 4: Portfolio Components        ─┤
Task 5: Transaction Components      ─┤
Task 6: Report Components           ─┤
Task 7: Budget Components           ─┤
Task 8: Auth & Wallet Pages         ─┤
Task 9: Landing Components          ─┘
Task 10: Config & Assets (tailwind, CSS, SVGs)  ─ Independent
Task 11: Export Utilities & Tests               ─ Independent
Task 12: Investment Forms                       ─ Independent
Task 13: Final Cleanup & Verification           ─ After all above
```

**All Tasks 1–12 are file-disjoint and can run in parallel.**
Task 13 depends on all previous tasks being committed.

---

### Task 1: Shared Form Components

**Files:**
- Modify: `src/wj-client/components/forms/FormSelect.tsx`
- Modify: `src/wj-client/components/forms/FormDatePicker.tsx`
- Modify: `src/wj-client/components/forms/CategoryQuickSelect.tsx`
- Modify: `src/wj-client/components/forms/AmountKeypad.tsx`
- Modify: `src/wj-client/components/forms/NumberSuggestions.tsx`
- Modify: `src/wj-client/components/forms/MarketPriceDisplay.tsx`
- Modify: `src/wj-client/components/forms/FormField.tsx`
- Modify: `src/wj-client/components/forms/FormWizard.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormInput.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormSelect.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormDatePicker.tsx`
- Modify: `src/wj-client/components/forms/enhanced/FormField.tsx`

**Security notes:** None — pure CSS class replacement.

**Step 1: Migrate brand green tokens in all shared form components**

For each file, apply the brand green → V2 red mapping:
- `focus:ring-green-*` → `focus:ring-v2-red-primary`
- `focus:ring-primary-*` → `focus:ring-v2-red-primary`
- `border-green-500` (selection state only) → `border-v2-red-primary`
- `bg-[#008148]` → `bg-v2-red-primary`
- `#008148` in inline styles → `#B91C1C`

For financial semantic greens in these form files:
- `text-green-600/700` (e.g., positive amount display) → `text-v2-green-positive`
- `bg-green-50/100` (success/positive backgrounds) → `bg-v2-green-light`
- `border-green-200` → `border-v2-border`

**Step 2: Verify no brand green remains**
```bash
grep -n "focus:ring-green\|focus:ring-primary\|bg-bg\|text-bg\|#008148\|bg-hgreen\|hover:bg-hgreen\|bg-primary-600" \
  src/wj-client/components/forms/FormSelect.tsx \
  src/wj-client/components/forms/FormDatePicker.tsx \
  src/wj-client/components/forms/CategoryQuickSelect.tsx \
  src/wj-client/components/forms/AmountKeypad.tsx \
  src/wj-client/components/forms/NumberSuggestions.tsx \
  src/wj-client/components/forms/MarketPriceDisplay.tsx \
  src/wj-client/components/forms/FormField.tsx \
  src/wj-client/components/forms/FormWizard.tsx \
  src/wj-client/components/forms/enhanced/FormInput.tsx \
  src/wj-client/components/forms/enhanced/FormSelect.tsx \
  src/wj-client/components/forms/enhanced/FormDatePicker.tsx \
  src/wj-client/components/forms/enhanced/FormField.tsx
```
Expected: zero output.

**Step 3: Commit**
```
fix(v2-colors): migrate shared form components to V2 color tokens
```

---

### Task 2: Shared UI & Other Components

**Files:**
- Modify: `src/wj-client/components/Button.tsx`
- Modify: `src/wj-client/components/ButtonGroup.tsx`
- Modify: `src/wj-client/components/FloatingActionButton.tsx`
- Modify: `src/wj-client/components/Notification.tsx`
- Modify: `src/wj-client/components/PerformanceMonitor.tsx`
- Modify: `src/wj-client/components/export/ExportDialog.tsx`
- Modify: `src/wj-client/components/modals/BaseModal.tsx`
- Modify: `src/wj-client/components/table/MobileTable.tsx`
- Modify: `src/wj-client/components/ui/Toast.tsx`
- Modify: `src/wj-client/components/ui/StatCard.tsx`
- Modify: `src/wj-client/components/ui/TransactionCard.tsx`
- Modify: `src/wj-client/components/ui/WealthCard.tsx`
- Modify: `src/wj-client/components/notifications/Toast.tsx`
- Modify: `src/wj-client/components/onboarding/Tour.tsx`

**Security notes:** None.

**Step 1: Apply brand green → V2 red for interactive elements**

In `Button.tsx`:
- `bg-primary-600` → `bg-v2-red-primary`
- `hover:bg-primary-700` → `hover:bg-v2-red-dark`
- `focus:ring-primary-500` → `focus:ring-v2-red-primary`
- Any `#008148` → `#B91C1C`

In `ButtonGroup.tsx`, `FloatingActionButton.tsx`:
- Same brand green → red mapping

In `BaseModal.tsx`:
- `focus:ring-green-*` or `focus:ring-primary-*` → `focus:ring-v2-red-primary`

In `MobileTable.tsx`:
- Any active/selected state with `border-green-*` → `border-v2-red-primary`

In `ui/Toast.tsx`, `notifications/Toast.tsx`:
- `bg-green-*` (success toast) → `bg-v2-green-positive` or `bg-v2-green-light`
- `text-green-*` → `text-v2-green-positive`

In `ui/StatCard.tsx`, `ui/TransactionCard.tsx`, `ui/WealthCard.tsx`:
- `text-green-*` → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`

**Step 2: Verify**
```bash
grep -rn "focus:ring-primary\|focus:ring-green\|bg-primary-600\|#008148\|bg-bg\|text-bg\|bg-hgreen\|hover:bg-hgreen" \
  src/wj-client/components/Button.tsx \
  src/wj-client/components/ButtonGroup.tsx \
  src/wj-client/components/FloatingActionButton.tsx \
  src/wj-client/components/Notification.tsx \
  src/wj-client/components/PerformanceMonitor.tsx \
  src/wj-client/components/export/ExportDialog.tsx \
  src/wj-client/components/modals/BaseModal.tsx \
  src/wj-client/components/table/MobileTable.tsx \
  src/wj-client/components/ui/ \
  src/wj-client/components/notifications/ \
  src/wj-client/components/onboarding/
```
Expected: zero output.

**Step 3: Commit**
```
fix(v2-colors): migrate shared UI and modal components to V2 color tokens
```

---

### Task 3: Import Feature Components

**Files:**
- Modify: `src/wj-client/features/import/components/StepProgress.tsx`
- Modify: `src/wj-client/features/import/components/TransactionReviewTable.tsx`
- Modify: `src/wj-client/features/import/components/ReadyToImportSection.tsx`
- Modify: `src/wj-client/features/import/components/ErrorSummary.tsx`
- Modify: `src/wj-client/features/import/components/WalletSelectionStep.tsx`
- Modify: `src/wj-client/features/import/components/DuplicateReviewModal.tsx`
- Modify: `src/wj-client/features/import/components/DuplicateSection.tsx`

**Security notes:** None.

**Step 1: Migrate StepProgress (7 hardcoded #008148 occurrences)**

`StepProgress.tsx` has all 7 occurrences as hardcoded `#008148` hex values in inline class strings:

Replace each occurrence:
```
"bg-[#008148]"       → "bg-v2-red-primary"
"border-[#008148]"   → "border-v2-red-primary"
"ring-[#008148]/10"  → "ring-v2-red-primary/10"
"text-[#008148]"     → "text-v2-red-primary"
```

Specific patterns found:
```
className="bg-[#008148] h-2 rounded-full ..."   → bg-v2-red-primary
"bg-[#008148] border-[#008148]"                 → bg-v2-red-primary border-v2-red-primary
"bg-white border-[#008148] ring-4 ring-[#008148]/10"  → border-v2-red-primary ring-4 ring-v2-red-primary/10
isCurrent ? "text-[#008148]" : "text-gray-400"  → "text-v2-red-primary"
isCompleted ? "bg-[#008148]" : "bg-gray-300"    → "bg-v2-red-primary"
```

**Step 2: Migrate other import components**

In `TransactionReviewTable.tsx`, `ReadyToImportSection.tsx`:
- `bg-green-*` (ready/success states) → `bg-v2-green-light` (if financial success indicator)
- `text-green-*` → `text-v2-green-positive`
- Any brand green (`bg-bg`, `#008148`) → V2 red equivalents

In `ErrorSummary.tsx`, `WalletSelectionStep.tsx`, `DuplicateReviewModal.tsx`, `DuplicateSection.tsx`:
- `focus:ring-green-*` → `focus:ring-v2-red-primary`
- `border-green-500` (selected state) → `border-v2-red-primary`
- `bg-green-*` → appropriate V2 green token

**Step 3: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|focus:ring-green\|bg-hgreen" \
  src/wj-client/features/import/
```
Expected: zero output.

**Step 4: Commit**
```
fix(v2-colors): migrate import feature components to V2 color tokens
```

---

### Task 4: Portfolio Components

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/helpers.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentCardEnhanced.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/InvestmentList.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/Banners.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioAnalytics.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummary.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/components/PortfolioSummaryEnhanced.tsx`

**Security notes:** None — financial gain colors are intentionally kept green (semantic convention).

**Step 1: Apply financial gain green → V2 green-positive**

**Critical context note:** ALL green color usage in portfolio components represents financial gains/positive PNL. These must map to `v2-green-positive`, NOT to red.

In all portfolio files:
- `text-green-600` → `text-v2-green-positive`
- `text-green-700` → `text-v2-green-positive`
- `text-green-800` → `text-v2-green-positive`
- `bg-green-50` → `bg-v2-green-light`
- `bg-green-100` → `bg-v2-green-light`
- `bg-green-500` → `bg-v2-green-positive`
- `border-green-200` → `border-v2-border`
- `#16A34A`, `#22C55E` (hardcoded gain hex in charts/styles) → `#15803D`

In `helpers.tsx` — color helper functions for PNL display:
- Update any returned class strings that include `text-green-*` → `text-v2-green-positive`
- Update `bg-green-*` → `bg-v2-green-light`

**Step 2: Verify no brand green remains**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|bg-hgreen\|hover:bg-hgreen\|text-green-[0-9]\|bg-green-[0-9]\|border-green-[0-9]" \
  src/wj-client/app/[locale]/dashboard/portfolio/
```
Expected: zero output.

**Step 3: Commit**
```
fix(v2-colors): migrate portfolio components to V2 color tokens
```

---

### Task 5: Transaction Components

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionItem.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionFilter.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionGroup.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/QuickFilterChips.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/page.tsx`
- Modify: `src/wj-client/components/cards/TransactionCard.tsx`
- Modify: `src/wj-client/components/cards/WealthCard.tsx`

**Security notes:** None.

**Step 1: Apply financial gain green → V2 green-positive**

In `TransactionItem.tsx` (income amounts are green):
- `text-green-600/700` → `text-v2-green-positive`
- `bg-green-50/100` → `bg-v2-green-light`

In `TransactionFilter.tsx`:
- `bg-[#008148]` or `focus:ring-green-*` (active filter chip) → `bg-v2-red-primary` / `focus:ring-v2-red-primary`

In `TransactionGroup.tsx`:
- `text-green-*` (income group totals) → `text-v2-green-positive`

In `TransactionCard.tsx`, `QuickFilterChips.tsx`, `page.tsx`:
- Brand green → V2 red (active states, CTAs)
- Semantic gain green → V2 green-positive

In `components/cards/TransactionCard.tsx`, `components/cards/WealthCard.tsx`:
- `text-green-*` → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`
- `#008148` → `#B91C1C`

**Step 2: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|text-green-[0-9]\|bg-green-[0-9]\|focus:ring-green\|focus:ring-primary\|bg-primary-600" \
  src/wj-client/app/[locale]/dashboard/transaction/ \
  src/wj-client/components/cards/
```
Expected: zero output.

**Step 3: Commit**
```
fix(v2-colors): migrate transaction and card components to V2 color tokens
```

---

### Task 6: Report Components

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/report/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/SummaryCards.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/ExpandableTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/ReportControls.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/report/data-utils.ts`

**Security notes:** None.

**Step 1: Migrate `data-utils.ts` chart color palette**

`data-utils.ts` has a `GREEN_COLORS` array used for category pie/bar chart colors and contains `#008148` as one entry.

Replace the brand green entry `#008148` → `#B91C1C` (V2 red-primary).

For any income/gain category color entries using `#16A34A`, `#22C55E`:
→ Replace with `#15803D` (V2 green-positive)

Do NOT change the overall chart color logic — only update the hex values that map to old brand/gain greens.

**Step 2: Migrate `page.tsx`**

`page.tsx` has 2 occurrences of `#008148` in chart color arrays:
→ Replace with `#B91C1C`

**Step 3: Migrate `SummaryCards.tsx` and `ExpandableTable.tsx`**

- `text-green-600/700` (income, surplus amounts) → `text-v2-green-positive`
- `bg-green-50/100` → `bg-v2-green-light`
- `border-green-200` → `border-v2-border`

**Step 4: Migrate `ReportControls.tsx`**

- `focus:ring-primary-*` → `focus:ring-v2-red-primary`
- `#008148` (1 occurrence in focus ring) → `#B91C1C`

**Step 5: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|text-green-[0-9]\|bg-green-[0-9]\|focus:ring-green\|focus:ring-primary\|bg-primary-600" \
  src/wj-client/app/[locale]/dashboard/report/
```
Expected: zero output.

**Step 6: Commit**
```
fix(v2-colors): migrate report components and chart color palette to V2 tokens
```

---

### Task 7: Budget Components

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/budget/BudgetCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/budget/BudgetProgressCard.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/budget/CategoryBreakdown.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/budget/CircularProgress.tsx`

**Security notes:** None.

**Step 1: Migrate `CircularProgress.tsx`**

`CircularProgress.tsx` has 1 occurrence of `#008148` as an SVG `stroke` color for the progress indicator.

Budget context: The progress ring color depends on budget status:
- Under budget (good): this should be `#15803D` (v2-green-positive) — financial gain semantic
- Over budget (bad): already using red

Replace `#008148` → `#15803D` (since it's a positive budget indicator, not a brand CTA)

**Step 2: Migrate `BudgetCard.tsx`, `BudgetProgressCard.tsx`, `CategoryBreakdown.tsx`**

- `text-green-*` (surplus, under-budget states) → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`
- `border-green-*` → `border-v2-border` or `border-v2-green-positive`
- Any `bg-bg`, `text-bg` (action buttons) → `bg-v2-red-primary`, `text-v2-red-primary`

**Step 3: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|text-green-[0-9]\|bg-green-[0-9]\|border-green-[0-9]\|focus:ring-green" \
  src/wj-client/app/[locale]/dashboard/budget/
```
Expected: zero output.

**Step 4: Commit**
```
fix(v2-colors): migrate budget components to V2 color tokens
```

---

### Task 8: Auth, Wallet, Prices, Settings Pages

**Files:**
- Modify: `src/wj-client/app/[locale]/auth/login/page.tsx`
- Modify: `src/wj-client/app/[locale]/auth/register/page.tsx`
- Modify: `src/wj-client/app/[locale]/auth/layout.tsx`
- Modify: `src/wj-client/app/[locale]/layout.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/wallets/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/wallets/WalletListView.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/settings/sessions/page.tsx`
- Modify: `src/wj-client/features/wallet/components/DeleteWalletModal.tsx`
- Modify: `src/wj-client/features/wallet/forms/EditWalletForm.tsx`
- Modify: `src/wj-client/features/settings/components/LanguageSelector.tsx`

**Security notes:** None.

**Step 1: Migrate auth pages**

In `login/page.tsx`, `register/page.tsx`, `auth/layout.tsx`:
- `bg-[#008148]` (auth header/background) → `bg-v2-red-primary`
- `text-[#008148]` (links, highlights) → `text-v2-red-primary`
- `focus:ring-green-*` → `focus:ring-v2-red-primary`
- `border-green-*` (focused input) → `border-v2-red-primary`

**Step 2: Migrate `app/[locale]/layout.tsx`**

`layout.tsx` has 1 occurrence of `#008148` — likely in theme color metadata or msapplication-TileColor.
→ Replace with `#B91C1C` (V2 red-primary)

**Step 3: Migrate wallet pages**

In `wallets/page.tsx`, `WalletListView.tsx`:
- `bg-bg`, `text-bg`, `border-bg` (selected wallet, active states) → V2 red equivalents
- `text-green-*` (positive balance indicators) → `text-v2-green-positive`

In `DeleteWalletModal.tsx`, `EditWalletForm.tsx`:
- `focus:ring-green-*` → `focus:ring-v2-red-primary`
- `bg-bg` → `bg-v2-red-primary`

**Step 4: Migrate prices page**

In `prices/page.tsx`:
- `text-green-*` (positive price change) → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`

**Step 5: Migrate settings and LanguageSelector**

In `sessions/page.tsx`:
- `text-green-*` (active session indicator) → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`

In `LanguageSelector.tsx`:
- `border-bg` → `border-v2-red-primary`
- `accent-bg` → `accent-v2-red-primary`

**Step 6: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|accent-bg\|text-green-[0-9]\|bg-green-[0-9]\|focus:ring-green\|focus:ring-primary\|bg-primary-600" \
  src/wj-client/app/[locale]/auth/ \
  src/wj-client/app/[locale]/layout.tsx \
  src/wj-client/app/[locale]/dashboard/wallets/ \
  src/wj-client/app/[locale]/dashboard/prices/ \
  src/wj-client/app/[locale]/dashboard/settings/ \
  src/wj-client/features/wallet/ \
  src/wj-client/features/settings/
```
Expected: zero output.

**Step 7: Commit**
```
fix(v2-colors): migrate auth, wallet, prices, and settings to V2 color tokens
```

---

### Task 9: Landing Components

**Files:**
- Modify: `src/wj-client/components/landing/LandingCTA.tsx`
- Modify: `src/wj-client/components/landing/LandingHero.tsx` *(partially done — verify)*
- Modify: `src/wj-client/components/landing/LandingFeatures.tsx`
- Modify: `src/wj-client/components/landing/LandingNavbar.tsx`
- Modify: `src/wj-client/components/landing/LandingErrorBoundary.tsx`
- Modify: `src/wj-client/components/landing/LandingBankImport.tsx`
- Modify: `src/wj-client/components/landing/LandingInvestmentFeatures.tsx`
- Modify: `src/wj-client/components/landing/LandingComparison.tsx`
- Modify: `src/wj-client/components/landing/LandingHowItWorks.tsx`

**Security notes:** None — landing page is public/unauthenticated, pure display.

**Step 1: Apply brand green → V2 red for landing CTAs**

Landing components use brand green for hero background, CTA buttons, feature highlights:
- `bg-bg`, `bg-[#008148]` → `bg-v2-red-primary`
- `text-bg`, `text-[#008148]` → `text-v2-red-primary`
- `hover:bg-hgreen` → `hover:bg-v2-red-dark`
- `focus:ring-green-*`, `focus:ring-primary-*` → `focus:ring-v2-red-primary`
- `border-green-*` (landing form focus) → `border-v2-red-primary`

`LandingHero.tsx` was partially migrated in commit `20ccd65` — verify by reading the file first and only fixing any remaining occurrences.

**Step 2: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|hover:bg-hgreen\|bg-hgreen\|focus:ring-green\|focus:ring-primary\|bg-primary-600" \
  src/wj-client/components/landing/
```
Expected: zero output.

**Step 3: Commit**
```
fix(v2-colors): migrate landing page components to V2 color tokens
```

---

### Task 10: Config, CSS Assets & SVGs

**Files:**
- Modify: `src/wj-client/tailwind.config.ts`
- Modify: `src/wj-client/app/globals.css`
- Modify: `src/wj-client/app/constants.tsx`
- Modify: `src/wj-client/components/success/successAnimation.css`
- Modify: `public/login-stock.svg`
- Modify: `public/dashboard.svg`
- Modify: `public/report.svg`
- Modify: `public/portfolio.svg`
- Modify: `public/budget.svg`
- Modify: `public/transaction.svg`
- Modify: `public/home.svg`

**Security notes:** None.

**Step 1: Update `tailwind.config.ts` — deprecate legacy tokens**

After all components are migrated:
- Change `bg: "#008148"` → `bg: "#B91C1C"` (alias to V2 red-primary for backward compat, so any missed occurrences still render red not green)
- Change `hgreen: "#006638"` → `hgreen: "#7F1D1D"` (alias to V2 red-dark)

Do NOT remove the `bg`/`hgreen` keys yet — removal is deferred to after full migration verification.

Add `border-v2-green-positive` token to the `v2` group if not already present:
```typescript
"green-border": "#15803D",  // for border-v2-green-border usage
```

**Step 2: Update `globals.css` — clean CSS variables**

Add a comment to mark old variables as deprecated:
```css
/* DEPRECATED: Use V2 tokens instead */
--btn-green: #B91C1C;        /* aliased to v2-red-primary */
--btn-green-hover: #7F1D1D;  /* aliased to v2-red-dark */
```

Update the `.custom-btn` class:
```css
.custom-btn {
  background-color: #B91C1C;  /* V2 red-primary (was: var(--btn-green)) */
}
```

Update the focus-visible outline if it references old green:
```css
*:focus-visible {
  outline: 2px solid #B91C1C; /* V2 red-primary */
}
```

**Step 3: Update `constants.tsx` chart colors**

Find any chart color array that uses `#008148`:
```typescript
// Before:
const chartColors = [..., "#008148", ...]
// After:
const chartColors = [..., "#B91C1C", ...]  // V2 red-primary
```

**Step 4: Update `successAnimation.css`**

Replace green hex values with V2 green-positive:
- `#008148`, `#16A34A`, `#22C55E` → `#15803D` (v2-green-positive)

Financial success is semantically green — use green-positive, not red.

**Step 5: Update SVG assets**

For each SVG file in `/public/`, apply the following hex replacements:
- `#008148` → `#B91C1C` (brand green → V2 red-primary)
- `#16A34A` → `#B91C1C` (light brand green → V2 red-primary for decorative elements)
- `#22C55E` → `#B91C1C` (success green used decoratively → V2 red-primary)

**Exception:** If a green hex appears in a context clearly depicting financial gain/income (e.g., an upward arrow or a checkmark in a financial success state), use `#15803D` instead.

**SVG review procedure for each file:**
1. Open the SVG and look at how each green hex is used
2. If it's part of the brand illustration background/decoration → `#B91C1C`
3. If it's a semantic gain indicator → `#15803D`
4. Apply replacement with a simple sed-style find/replace

Approximate counts (from spec): login-stock.svg (29), dashboard.svg (5), report.svg (5), portfolio.svg (7), budget.svg (4), transaction.svg (4), home.svg (3)

**Step 6: Verify SVGs**
```bash
grep -c "#008148\|#16A34A\|#22C55E" public/login-stock.svg public/dashboard.svg public/report.svg public/portfolio.svg public/budget.svg public/transaction.svg public/home.svg
```
Expected: all zeros.

**Step 7: Commit**
```
fix(v2-colors): update tailwind config, CSS variables, animations, and SVG assets
```

---

### Task 11: Export Utilities & Test Files

**Files:**
- Modify: `src/wj-client/features/report/utils/export/report-excel-export.ts`
- Modify: `src/wj-client/features/report/utils/export/report-pdf-export.ts`
- Modify: `src/wj-client/tests/integration/portfolio-calculations.test.ts`
- Modify: `src/wj-client/app/[locale]/dashboard/report/export-utils.test.ts`

**Security notes:** None.

**Step 1: Update `report-excel-export.ts`**

This file uses ARGB color format for Excel cell colors. Find the green ARGB value:
- `FF008148` (opaque #008148) → `FFB91C1C` (opaque #B91C1C = V2 red-primary)
- Any gain/positive color (`FF16A34A`, `FF22C55E`) → `FF15803D` (V2 green-positive)

**Step 2: Update `report-pdf-export.ts`**

This file uses RGB triplets for PDF color. Find the green RGB:
- `RGB(0, 129, 72)` or similar → `RGB(185, 28, 28)` (V2 red-primary)
- Income/gain colors → `RGB(21, 128, 61)` (V2 green-positive)

**Step 3: Update test assertion in `portfolio-calculations.test.ts`**

Find the 1 occurrence of a green class assertion:
```typescript
// Before: expects text-green-600
expect(element).toHaveClass('text-green-600');
// After: expects v2 green positive
expect(element).toHaveClass('text-v2-green-positive');
```

**Step 4: Update test assertions in `export-utils.test.ts`**

Find the 2 occurrences of hardcoded green hex in test expectations:
```typescript
// Before: expects #008148 in export output
expect(result.color).toBe('#008148');
// After:
expect(result.color).toBe('#B91C1C');  // or #15803D if it's an income color
```

Read the test context carefully to determine correct replacement (brand CTA → red, income → green-positive).

**Step 5: Run tests to verify they pass**
```bash
cd src/wj-client && npx jest tests/integration/portfolio-calculations.test.ts --no-coverage
cd src/wj-client && npx jest app/[locale]/dashboard/report/export-utils.test.ts --no-coverage
```
Expected: all tests pass.

**Step 6: Commit**
```
fix(v2-colors): update export utilities and test assertions for V2 color system
```

---

### Task 12: Investment Forms

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- Modify: `src/wj-client/features/investment/forms/AddInvestmentTransactionForm.tsx`
- Modify: `src/wj-client/features/transaction/forms/AddTransactionForm.tsx`
- Modify: `src/wj-client/features/transaction/forms/EditTransactionForm.tsx`

**Security notes:** None.

**Step 1: Migrate `AddInvestmentForm.tsx`**

This file has both brand green AND gain green:
- `bg-bg` → `bg-v2-red-primary`
- `text-bg` → `text-v2-red-primary`
- `text-green-*` (gain display) → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`
- `focus:ring-green-*` → `focus:ring-v2-red-primary`

**Step 2: Migrate `AddInvestmentTransactionForm.tsx`**

- `text-green-*` (buy confirmation, gain amounts) → `text-v2-green-positive`
- `bg-green-*` → `bg-v2-green-light`
- `border-green-*` (buy type selected state) → `border-v2-red-primary`

**Step 3: Migrate transaction forms**

In `AddTransactionForm.tsx`, `EditTransactionForm.tsx`:
- `text-green-*` (income type, positive amounts) → `text-v2-green-positive`
- `bg-green-*` (income category background) → `bg-v2-green-light`
- `border-green-*` (income type selection) — check context:
  - If it's the "income" type selector → `border-v2-green-positive` (semantic)
  - If it's a focus ring → `border-v2-red-primary`
- `focus:ring-green-*` → `focus:ring-v2-red-primary`

**Step 4: Verify**
```bash
grep -rn "#008148\|#006638\|bg-bg\|text-bg\|border-bg\|text-green-[0-9]\|bg-green-[0-9]\|border-green-[0-9]\|focus:ring-green\|focus:ring-primary\|bg-primary-600" \
  src/wj-client/features/investment/ \
  src/wj-client/features/transaction/
```
Expected: zero output.

**Step 5: Commit**
```
fix(v2-colors): migrate investment and transaction forms to V2 color tokens
```

---

### Task 13: Final Verification & Cleanup

**Files:**
- Read-only scan, then targeted fixes if any are found

**Security notes:** None.

**Step 1: Global scan for any remaining old green tokens**

```bash
# Brand green — should be zero
grep -rn "bg-bg\|text-bg\|border-bg\|accent-bg\|hover:bg-hgreen\|bg-hgreen\|bg-primary-600\|#008148\|#006638\|focus:ring-green-\|focus:ring-primary-" \
  src/wj-client/ --include="*.tsx" --include="*.ts" --include="*.css" \
  --exclude-dir=".next" --exclude-dir="node_modules"

# Financial gain green — should be zero
grep -rn "text-green-[0-9]\|bg-green-[0-9]\|border-green-[0-9]" \
  src/wj-client/ --include="*.tsx" --include="*.ts" \
  --exclude-dir=".next" --exclude-dir="node_modules"

# SVGs — should be zero
grep -rn "#008148\|#16A34A\|#22C55E" public/ --include="*.svg"
```

Expected: zero output on all commands.

**Step 2: Fix any stragglers found in Step 1**

Apply the same mapping rules as in Tasks 1-12.

**Step 3: Verify build compiles**
```bash
cd src/wj-client && npx next build 2>&1 | tail -20
```
Expected: successful build with no errors.

**Step 4: Run all tests**
```bash
cd src/wj-client && npx jest --no-coverage 2>&1 | tail -20
```
Expected: all tests pass.

**Step 5: Final commit**
```
fix(v2-colors): final cleanup — all legacy green tokens migrated to V2 design system
```

---

## Summary of All Files Changed

### By Task

| Task | Description | File Count | Key Files |
|------|-------------|-----------|-----------|
| 1 | Shared Form Components | 12 | FormSelect, FormInput (enhanced & base), FormDatePicker, CategoryQuickSelect |
| 2 | Shared UI & Other | 14 | Button, ButtonGroup, BaseModal, MobileTable, Toast (×2), StatCard, WealthCard |
| 3 | Import Feature | 7 | StepProgress (7 hardcoded #008148), TransactionReviewTable, ReadyToImport |
| 4 | Portfolio | 8 | PortfolioAnalytics, InvestmentCard, InvestmentList, helpers.tsx |
| 5 | Transaction & Cards | 8 | TransactionItem, TransactionGroup, TransactionFilter, cards/ |
| 6 | Report | 5 | data-utils.ts (chart colors), SummaryCards, ExpandableTable, ReportControls |
| 7 | Budget | 4 | CircularProgress (SVG stroke), BudgetCard, BudgetProgressCard, CategoryBreakdown |
| 8 | Auth/Wallet/Prices/Settings | 11 | auth pages, layout.tsx (TileColor), WalletListView, prices/page, LanguageSelector |
| 9 | Landing | 9 | LandingCTA, LandingHero, LandingNavbar, all Landing* components |
| 10 | Config, CSS, SVGs | 11 | tailwind.config.ts, globals.css, successAnimation.css, 7 SVG files |
| 11 | Exports & Tests | 4 | report-excel-export.ts, report-pdf-export.ts, 2 test files |
| 12 | Investment & Transaction Forms | 4 | AddInvestmentForm, AddInvestmentTransactionForm, AddTransactionForm, EditTransactionForm |
| 13 | Final Verification | 0 new | Global scan + fix stragglers |
| **Total** | | **~97 file operations** | |

### Parallelization

Tasks 1-12 are all file-disjoint and can run in parallel. Task 13 must run after all others complete.

---

## Verification Commands

```bash
# After all tasks complete — expect zero output:
grep -rn "bg-bg\|text-bg\|border-bg\|accent-bg\|hover:bg-hgreen\|bg-primary-600\|focus:ring-green\|focus:ring-primary-[0-9]" \
  src/wj-client/ --include="*.tsx" --include="*.ts" --include="*.css" \
  --exclude-dir=".next" --exclude-dir="node_modules"

grep -rn "#008148\|#006638" \
  src/wj-client/ --include="*.tsx" --include="*.ts" \
  --exclude-dir=".next" --exclude-dir="node_modules"

grep -rn "text-green-[0-9]\|bg-green-[0-9]\|border-green-[0-9]" \
  src/wj-client/ --include="*.tsx" --include="*.ts" \
  --exclude-dir=".next" --exclude-dir="node_modules"

grep -rn "#008148\|#16A34A\|#22C55E" public/ --include="*.svg"

# Build must succeed:
cd src/wj-client && npx next build

# Tests must pass:
cd src/wj-client && npx jest --no-coverage
```

## Risk Notes

1. **CircularProgress.tsx** — The `#008148` there represents a positive/under-budget state → use `#15803D` (green), NOT red
2. **SVG files** — Review each SVG individually before bulk-replacing. Some `#16A34A` may be in leaf/plant decorations, not financial indicators
3. **Export utilities** — ARGB and RGB formats are non-standard hex; use the format-specific equivalents
4. **`border-green-*` in form type selectors** — Check context: income type selection border should stay green-positive, focus ring border should go red
5. **Skipped files from spec** — The spec lists 61 files but search reveals additional files (auth pages, landing components). Include all found files.
