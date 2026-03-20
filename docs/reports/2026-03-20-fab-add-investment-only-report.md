# FAB Add Investment Only — Implementation Report

## Summary

Replaced the 3-action FAB (Add Transaction, Transfer Money, Create Wallet) in the dashboard layout with a single "Add Investment" action. The FAB now opens the existing AddInvestmentForm in a layout-level BaseModal. No backend, API, or protobuf changes.

## Spec Reference

`docs/specs/2026-03-20-fab-add-investment-only-spec.md`

## Plan Reference

`docs/plans/2026-03-20-fab-add-investment-only-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Commit |
|---|------|--------|---------------|--------|
| 1 | Update i18n messages | Done | `messages/en/ui.json`, `messages/vi/ui.json` | e14a2c7 |
| 2 | Update dashboard layout | Done | `app/[locale]/dashboard/layout.tsx` | aafe027 |
| 3 | Verification checklist | Done | This report | — |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | No change — AddInvestmentForm uses authenticated API client | Yes |
| Authorization | No change — backend verifies user ownership | Yes |
| Input validation | No change — existing Zod + Go validators | Yes |
| Data sanitization | No change — same form component reused | Yes |

No new attack surface introduced. The same AddInvestmentForm component is reused from `features/investment/forms/AddInvestmentForm.tsx` via the existing lazy import in `components/lazy/OptimizedComponents.tsx`.

## Build Verification

Next.js build passes successfully with all routes compiled.

## Files Changed

| File | Change |
|------|--------|
| `src/wj-client/messages/en/ui.json` | Replaced `quickActions` with `addInvestment` key |
| `src/wj-client/messages/vi/ui.json` | Replaced `quickActions` with `addInvestment` key |
| `src/wj-client/app/[locale]/dashboard/layout.tsx` | Replaced 3 form imports with lazy `AddInvestmentForm`, added `TrendingUp` icon, replaced FAB actions and modal content |

## How to Test

1. **FAB renders** — Navigate to any dashboard page, confirm FAB shows a single "Add Investment" action on expand
2. **Modal opens** — Tap "Add Investment" on the FAB, confirm AddInvestmentForm renders in BaseModal with title "Add Investment"
3. **Form works** — Fill out the form and submit (or cancel), confirm identical behavior to portfolio page version
4. **Portfolio page inline button** — Navigate to `/dashboard/portfolio`, confirm the existing "Add Investment" button in PortfolioSummaryEnhanced still works independently
5. **Both access points** — On portfolio page, both inline button and FAB should work without conflict
6. **Mobile** — Test on mobile viewport (375px), confirm FAB positioning is correct
7. **i18n** — Switch to Vietnamese locale, confirm FAB action label shows "Thêm khoản đầu tư"
