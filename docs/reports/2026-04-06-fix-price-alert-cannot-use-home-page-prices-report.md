# Fix: Price Alert Cannot Use Home Page Prices — Implementation Report

## Summary

Changed the gold and silver type dropdown filters in `CreatePriceAlertForm` from `p.showInInvestment` to `p.enabled`, aligning the price alert form with the home page's display logic. Updated existing mock data with the `enabled` field and added a TDD test that verifies the correct inclusion/exclusion behavior.

## Spec Reference

`docs/specs/2026-04-06-fix-price-alert-cannot-use-home-page-prices-spec.md`

## Plan Reference

`docs/plans/2026-04-06-fix-price-alert-cannot-use-home-page-prices-plan.md`

## Tasks Completed

| #   | Task                                                | Status | Files Changed                            | Tests    | TDD |
| --- | --------------------------------------------------- | ------ | ---------------------------------------- | -------- | --- |
| 1   | Fix showInInvestment filter in CreatePriceAlertForm | Done   | CreatePriceAlertForm.tsx, .test.tsx      | 29/29 ✓  | Yes |

## Test Coverage Summary

| Layer              | Test File                                            | Tests | Pass | Coverage Area                         |
| ------------------ | ---------------------------------------------------- | ----- | ---- | ------------------------------------- |
| Frontend Component | `features/price-alert/__tests__/CreatePriceAlertForm.test.tsx` | 29  | 29/29 | Filter behavior (enabled vs showInInvestment), dropdown options, category selection, form submission, pre-fill, accessibility |

## Security Implementation Summary

| Concern          | Implementation                                            | Verified |
| ---------------- | --------------------------------------------------------- | -------- |
| Input validation | Unchanged — backend validates symbols independently       | N/A      |
| Authorization    | Unchanged — existing AuthMiddleware unchanged             | N/A      |
| XSS              | No user content changes; dropdown renders admin data only | Yes      |

## Review Results

### Spec Compliance

PASS — both filter predicates changed as specified, new TDD test added, existing mock data updated with `enabled` field.

### Security Review

APPROVED — client-side display filter change only. No auth, validation, monetary, or data exposure concerns.

### Code Quality

APPROVED — minimal 2-line fix, correct `useMemo` dependencies, new test directly asserts behavior (option presence/absence).

## Known Issues / Technical Debt

None.

## Files Changed

- `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx` — lines 113, 121: `.filter((p) => p.showInInvestment)` → `.filter((p) => p.enabled)`
- `src/wj-client/features/price-alert/__tests__/CreatePriceAlertForm.test.tsx` — added `enabled: true` to existing mock items; added "Gold type dropdown — enabled filter" test group

## How to Test

### Unit & Integration Tests

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="price-alert"
# Expected: 67 tests pass across 4 test suites
```

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed.

`goldSelectOptions` and `silverSelectOptions` are both computed within `CreatePriceAlertForm` and not exported. The only callers are the `BasicFormSelect` option prop in the same file. No upstream dependents outside the component.

### Manual Testing Steps

#### Scenario: Gold price with enabled=true but showInInvestment=false appears in alert form

**Preconditions:** Logged in; admin has configured a gold price type with `enabled=true` and `showInInvestment=false` (e.g., Doji 24K)

1. Navigate to `/dashboard/settings/alerts`
2. Click "Create Alert" button → Expected: alert creation modal opens
3. Gold category is pre-selected → Expected: Gold Type dropdown shows Doji 24K in the list
4. Previously it would NOT appear (was filtered by showInInvestment)

#### Scenario: Disabled price type does not appear

**Preconditions:** Admin has configured a gold price type with `enabled=false`

1. Navigate to `/dashboard/settings/alerts` → Create Alert
2. Open Gold Type dropdown → Expected: the disabled price type does not appear in the list

#### Scenario: Existing enabled+showInInvestment prices still appear

**Preconditions:** Admin has gold price types with both `enabled=true` and `showInInvestment=true` (e.g., SJC)

1. Open the alert creation form → Expected: SJC and other standard gold types still appear normally
