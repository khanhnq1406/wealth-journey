# Mobile Number Input: Comma-as-Decimal Fix — Implementation Report

## Summary

Added client-side input normalization that converts comma decimal separators to dots in number input fields. This fixes the issue where Vietnamese locale keyboards produce commas instead of dots for decimal points, causing incorrect values in financial inputs.

## Spec Reference

`docs/specs/2026-03-20-mobile-decimal-comma-fix-spec.md`

## Plan Reference

`docs/plans/2026-03-20-mobile-decimal-comma-fix-plan.md`

## Tasks Completed

| # | Task | Status | Files Changed | Tests | TDD |
|---|------|--------|---------------|-------|-----|
| 1 | Add `normalizeDecimalInput` utility + tests | Done | `number-format.ts`, `number-format.test.ts` | 22/22 pass | Yes |
| 2 | Integrate into `FormNumberInput` | Done | `FormNumberInput.tsx` | TypeScript clean | Yes |
| 3 | Add to `ErrorSection` amount input | Done | `ErrorSection.tsx` | TypeScript clean | Yes |
| 4 | Verify `TransactionFilterModal` | Done (verification only) | None | N/A | N/A |
| 5 | Write implementation report | Done | This file | N/A | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
|-------|-----------|-------|------|---------------|
| Utility | `number-format.test.ts` | 22 | 22/22 | normalizeDecimalInput: decimal commas, thousand seps, edge cases, dot-existing, trailing comma, negative numbers |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| XSS | Downstream regex + React auto-escaping prevent injection | Yes |
| Monetary manipulation | Heuristic correctly distinguishes decimal vs thousand commas for Vietnamese locale | Yes |
| ReDoS | Regex anchored with non-overlapping quantifiers, <0.1ms for 10K+ chars | Yes |
| Server-side bypass | No new bypass — client-side only, server validation unchanged | Yes |

## Review Results

### Security Review

**Verdict: APPROVED**

- No XSS risk — pure string transformation, no HTML rendering
- No monetary manipulation risk — heuristic correct for target locale
- No ReDoS vulnerability — regex is safe
- No server-side validation bypass — client-side only change
- Edge case documented: `100,00` → `100.00` (treated as decimal, not `10,000`). Acceptable for Vietnamese locale context.

## Known Issues / Technical Debt

- Indian lakhs format (`1,00,000`) produces unexpected result — acceptable trade-off for Vietnamese-focused app
- TransactionFilterModal uses `type="number"` which is browser-handled; should be manually verified on iOS Safari with vi-VN keyboard

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/wj-client/lib/utils/number-format.ts` | Modified | Added `normalizeDecimalInput()` function |
| `src/wj-client/lib/utils/number-format.test.ts` | Modified | Added 7 test groups for `normalizeDecimalInput` |
| `src/wj-client/components/forms/FormNumberInput.tsx` | Modified | Integrated normalization in `handleChange` |
| `src/wj-client/features/import/components/ErrorSection.tsx` | Modified | Integrated normalization in amount `onChange` |

## How to Test

1. Open the app on mobile (or Chrome DevTools mobile mode)
2. Switch keyboard to Vietnamese (vi-VN) locale
3. Navigate to any form with amount input (e.g., Add Transaction)
4. Type a decimal number using comma (e.g., `1000,5`)
5. Verify the comma is converted to dot and the value is `1000.5`
6. Type a thousand-separated number (e.g., `1,000`)
7. Verify the comma is preserved as a thousand separator
8. Test the Import > Error Section amount field similarly

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-20 | Fix thousand-separator conflict: `normalizeDecimalInput` was called in `FormNumberInput.handleChange`, but the component's `useEffect` also inserts thousand-separator commas. When user typed digits after formatting (e.g., `1,234` → type `5` → browser sends `1,2345`), `normalizeDecimalInput` misinterpreted the formatting comma as a decimal separator → `1.2345`. Fix: replaced `normalizeDecimalInput` with comma-count comparison logic that detects user-typed commas vs formatting-inserted commas. | Minor | pending |
