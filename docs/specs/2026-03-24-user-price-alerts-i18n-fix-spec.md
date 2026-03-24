# Fix: User Price Alerts — Missing i18n

## Original Feature

- Spec: `docs/specs/2026-03-24-user-price-alerts-spec.md`
- Plan: `docs/plans/2026-03-24-user-price-alerts-plan.md`
- Report: `docs/reports/2026-03-24-user-price-alerts-report.md`

## Issues to Fix

| #   | Issue | Source | Severity |
| --- | ----- | ------ | -------- |
| 1   | All UI strings in `alerts/page.tsx`, `PriceAlertList.tsx`, `AlertStatusBadge.tsx`, `CreatePriceAlertForm.tsx` are hardcoded English — no `useTranslations()` calls | User report | Major |
| 2   | No `priceAlerts` i18n namespace exists in `messages/en/investment.json` or `messages/vi/investment.json` | Code review | Major |

## Root Cause Analysis

The original implementation omitted i18n from all price-alert frontend components. All other settings pages (`sessions/page.tsx`, `security/page.tsx`, `import-templates/page.tsx`) use `useTranslations()` from `next-intl`. The price-alerts feature skipped this — no message keys were added to the investment JSON files, and no `useTranslations()` calls were added to any component.

## Fix Approach

### Step 1: Add message keys to JSON files

Add a `priceAlerts` namespace under the root of `messages/en/investment.json` and `messages/vi/investment.json`.

**Strings to extract:**

| Component | String | Key |
| --------- | ------ | --- |
| alerts/page.tsx | "Price Alerts" (heading) | `priceAlerts.title` |
| alerts/page.tsx | "Create Alert" (button) | `priceAlerts.createAlert` |
| alerts/page.tsx | "All" (filter tab) | `priceAlerts.filterAll` |
| alerts/page.tsx | "Active" (filter tab) | `priceAlerts.filterActive` |
| alerts/page.tsx | "Triggered" (filter tab) | `priceAlerts.filterTriggered` |
| alerts/page.tsx | "Create Price Alert" (modal title) | `priceAlerts.modalTitle` |
| PriceAlertList | "Symbol" (table header) | `priceAlerts.colSymbol` |
| PriceAlertList | "Direction & Target" (table header) | `priceAlerts.colDirectionTarget` |
| PriceAlertList | "Current Price" (table header) | `priceAlerts.colCurrentPrice` |
| PriceAlertList | "Trigger" (table header) | `priceAlerts.colTrigger` |
| PriceAlertList | "Status" (table header) | `priceAlerts.colStatus` |
| PriceAlertList | "Actions" (table header) | `priceAlerts.colActions` |
| PriceAlertList | "No alerts yet" (empty title) | `priceAlerts.emptyTitle` |
| PriceAlertList | "Create a price alert to get notified" (empty description) | `priceAlerts.emptyDescription` |
| PriceAlertList | "Delete" (button title) | `priceAlerts.deleteLabel` |
| PriceAlertList | "Pause" (toggle label) | `priceAlerts.pauseLabel` |
| PriceAlertList | "Activate" (toggle label) | `priceAlerts.activateLabel` |
| PriceAlertList | `Pause alert for {symbol}` (aria-label) | `priceAlerts.pauseAlertAria` |
| PriceAlertList | `Activate alert for {symbol}` (aria-label) | `priceAlerts.activateAlertAria` |
| PriceAlertList | `Delete alert for {symbol}` (aria-label) | `priceAlerts.deleteAlertAria` |
| PriceAlertList | "Delete Alert" (confirm dialog title) | `priceAlerts.deleteDialogTitle` |
| PriceAlertList | `Are you sure you want to delete the price alert for {symbol}? This action cannot be undone.` | `priceAlerts.deleteDialogMessage` |
| PriceAlertList | "Delete" (confirm button text) | `priceAlerts.deleteConfirmButton` |
| PriceAlertList | "Above" (direction label) | `priceAlerts.directionAbove` |
| PriceAlertList | "Below" (direction label) | `priceAlerts.directionBelow` |
| PriceAlertList | "Once" (trigger mode label) | `priceAlerts.triggerOnce` |
| PriceAlertList | "Repeat" (trigger mode label) | `priceAlerts.triggerRepeat` |
| PriceAlertList | "Details" (expand button) | `priceAlerts.expandDetails` |
| PriceAlertList | "Less" (collapse button) | `priceAlerts.collapseDetails` |
| AlertStatusBadge | "Active" | `priceAlerts.statusActive` |
| AlertStatusBadge | "Triggered" | `priceAlerts.statusTriggered` |
| AlertStatusBadge | "Paused" | `priceAlerts.statusPaused` |
| AlertStatusBadge | "Unknown" | `priceAlerts.statusUnknown` |
| CreatePriceAlertForm | "Asset Category" (label) | `priceAlerts.assetCategory` |
| CreatePriceAlertForm | "Gold" | `priceAlerts.categoryGold` |
| CreatePriceAlertForm | "Silver" | `priceAlerts.categorySilver` |
| CreatePriceAlertForm | "Other" | `priceAlerts.categoryOther` |
| CreatePriceAlertForm | "Gold Type" (label) | `priceAlerts.goldTypeLabel` |
| CreatePriceAlertForm | "Select gold type" (placeholder) | `priceAlerts.goldTypePlaceholder` |
| CreatePriceAlertForm | "Silver Type" (label) | `priceAlerts.silverTypeLabel` |
| CreatePriceAlertForm | "Select silver type" (placeholder) | `priceAlerts.silverTypePlaceholder` |
| CreatePriceAlertForm | "Symbol" (label) | `priceAlerts.symbolLabel` |
| CreatePriceAlertForm | "Search for stocks, ETFs, crypto..." (placeholder) | `priceAlerts.symbolPlaceholder` |
| CreatePriceAlertForm | "Type at least 2 characters to search" | `priceAlerts.symbolHint` |
| CreatePriceAlertForm | "Price Side" (label) | `priceAlerts.priceSideLabel` |
| CreatePriceAlertForm | "Direction" (label) | `priceAlerts.directionLabel` |
| CreatePriceAlertForm | "Target Price" (label) | `priceAlerts.targetPriceLabel` |
| CreatePriceAlertForm | "Enter the price that will trigger this alert" | `priceAlerts.targetPriceHint` |
| CreatePriceAlertForm | "Trigger Mode" (label) | `priceAlerts.triggerModeLabel` |
| CreatePriceAlertForm | "Cooldown (hours)" (label) | `priceAlerts.cooldownLabel` |
| CreatePriceAlertForm | "Minimum 2 hours, maximum 168 hours (1 week)" | `priceAlerts.cooldownHint` |
| CreatePriceAlertForm | "Note" (label) | `priceAlerts.noteLabel` |
| CreatePriceAlertForm | "Optional note..." (placeholder) | `priceAlerts.notePlaceholder` |
| CreatePriceAlertForm | "Failed to create alert. Please try again." | `priceAlerts.createError` |
| CreatePriceAlertForm | "Create Alert" (button) | `priceAlerts.createButton` |
| CreatePriceAlertForm | "Your price alert has been created." (success) | `priceAlerts.successMessage` |

### Step 2: Wire `useTranslations` in each component

**`alerts/page.tsx`** — `"use client"`, add `useTranslations("priceAlerts")` call.

**`PriceAlertList.tsx`** — `"use client"`, add `useTranslations("priceAlerts")`, replace all hardcoded strings.

**`AlertStatusBadge.tsx`** — `"use client"`, add `useTranslations("priceAlerts")`, replace status labels.

**`CreatePriceAlertForm.tsx`** — `"use client"`, add `useTranslations("priceAlerts")`, replace all hardcoded strings.

## Regression Risks

| Risk | Likelihood | Mitigation |
| ---- | ---------- | ---------- |
| Missing key in vi.json causes runtime error in Vietnamese locale | High if keys differ | Write both en and vi keys together |
| TypeScript `useTranslations` type inference breaks if key is not in messages | Medium | Ensure all keys are present before wiring |
| Existing tests that assert hardcoded English text may fail | Medium | Update test assertions to use translation keys or mock `useTranslations` |
| `AlertStatusBadge` now needs `"use client"` already present — no structural change needed | None | Already `"use client"` |

## Affected Files

### Frontend components (5 files)
1. `src/wj-client/features/price-alert/components/AlertStatusBadge.tsx`
2. `src/wj-client/features/price-alert/components/PriceAlertList.tsx`
3. `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx`
4. `src/wj-client/app/[locale]/dashboard/settings/alerts/page.tsx`

### i18n message files (2 files)
5. `src/wj-client/messages/en/investment.json`
6. `src/wj-client/messages/vi/investment.json`

### Test files to update (4 files)
7. `src/wj-client/features/price-alert/__tests__/AlertStatusBadge.test.tsx`
8. `src/wj-client/features/price-alert/__tests__/PriceAlertList.test.tsx`
9. `src/wj-client/features/price-alert/__tests__/CreatePriceAlertForm.test.tsx`
10. `src/wj-client/app/[locale]/dashboard/prices/__tests__/PricesPage.test.tsx` (if it asserts "Create Price Alert")

## Security Assessment

No security implications. This is a pure UI string externalization:
- No API changes
- No backend changes
- No authorization changes
- No data model changes
- XSS: next-intl uses safe interpolation (no `dangerouslySetInnerHTML`)

## Out of Scope

- Backend i18n (error messages from server are not localized — deferred, consistent with rest of codebase)
- Adding new locales beyond `en` and `vi`
- Extracting i18n keys from validation error messages in `price-alert-validation.ts` (Zod error strings)
