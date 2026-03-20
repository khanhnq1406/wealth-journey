# Mobile Number Input: Comma-as-Decimal Fix

## Summary

On iPhone Safari with Vietnamese locale (vi-VN), the `inputMode="decimal"` keyboard shows `,` (comma) as the decimal separator instead of `.` (dot). When users type a decimal like `1000,50`, the app treats the comma as a thousand separator and produces `100050` instead of `1000.50`. This fix auto-converts typed commas to dots in number input components so the existing formatting/parsing logic works correctly.

## User Stories

- As a user with a Vietnamese locale phone, I want to type decimal amounts using the comma key on my keyboard, so that `1000,50` is correctly interpreted as `1000.50`.

## Functional Requirements

### FR-1: Auto-convert comma to dot during input in FormNumberInput

When a user types a `,` character in a `FormNumberInput`, it should be automatically converted to `.` before validation and parsing.

**Acceptance criteria:**
- [ ] Typing `1000,50` results in display value `1000.50` and form value `1000.5`
- [ ] Typing `1000.50` still works as before (dot passthrough)
- [ ] Thousand separator formatting on blur still works (`1000.50` → `1,000.50`)
- [ ] Only the first comma/dot is treated as decimal — subsequent ones are rejected by existing validation
- [ ] Empty input, negative numbers, and whole numbers still work correctly

### FR-2: Auto-convert comma to dot in other decimal input locations

Other inputs using `inputMode="decimal"` or `type="number"` should also handle comma-as-decimal for consistency.

**Affected components:**
1. `FormNumberInput` (primary — `components/forms/FormNumberInput.tsx`)
2. `ErrorSection` import amount input (`features/import/components/ErrorSection.tsx`)
3. `TransactionFilterModal` min/max amount inputs (`app/[locale]/dashboard/transaction/TransactionFilterModal.tsx`)

**Note:** `type="number"` inputs (InlinePriceEdit, UpdateInvestmentPriceForm, PriceAlertConfigForm, ChangeRateModal) are browser-handled — the browser itself may handle locale-aware decimal input for `type="number"`. These are lower priority but should be verified.

**Acceptance criteria:**
- [ ] All `inputMode="decimal"` text inputs convert comma to dot
- [ ] `type="number"` inputs are tested on iPhone Safari vi-VN to confirm browser behavior

## Non-Functional Requirements

- Performance: No measurable impact (single string replace operation)
- Security: No security implications — this is a display/parsing fix only

## Architecture Changes (C4)

No architecture changes needed. This is a bug fix in existing components.

## Runtime Flow Diagrams

No new flow diagrams needed. Simple input handling change.

## Data Model Changes

None.

## API Changes

None.

## UI/UX Changes

### Behavior Change

| Before | After |
|--------|-------|
| User types `,` on vi-VN keyboard → comma appears in input → treated as thousand separator | User types `,` on vi-VN keyboard → dot appears in input → treated as decimal separator |
| `1000,50` → form value `100050` (wrong) | `1000,50` → display `1000.50` → form value `1000.5` (correct) |

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Number input with formatting | FormNumberInput | `components/forms/FormNumberInput.tsx` |
| General form input | FormInput | `components/forms/FormInput.tsx` |
| Number formatting utilities | number-format.ts | `lib/utils/number-format.ts` |

### New Components

None needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User keyboard | Numeric characters | No | Input element | Client-side only |
| 2 | Input element | Display string | No | React state | Character replacement |
| 3 | React state | Numeric value | No | Form state (RHF) | parseFloat conversion |

### Trust Boundaries

No trust boundaries crossed. This is entirely client-side input normalization.

### Threats Identified

| # | Threat | Severity | Mitigation |
|---|--------|----------|------------|
| T-1 | Input manipulation via non-numeric characters | Low | Existing regex validation unchanged — still rejects non-numeric input |

### Authorization Rules

N/A — no server interaction.

### Input Validation Rules

Existing validation regex `/^-?[\d,]*\.?\d*$/` remains unchanged. The comma-to-dot conversion happens **before** this regex check, so the regex only ever sees dots as decimal separators.

### External Dependency Risks

None.

### Sensitive Data Handling

No sensitive data involved.

### Issues & Risks Summary

1. Minor visual mismatch: keyboard shows `,` but input shows `.` — acceptable trade-off
2. Users who intentionally type comma as thousand separator during input will now get a dot instead — mitigated because thousand separators are auto-applied on blur anyway

## Edge Cases & Error Handling

| Case | Current Behavior | Expected After Fix |
|------|-----------------|-------------------|
| Type `1000,50` | Form value: 100050 | Form value: 1000.5 |
| Type `1,000` (thousand sep) | Form value: 1000 | Form value: 1 (then `.000` = `1.000` = 1) |
| Type `1000.50` (dot) | Form value: 1000.5 | Form value: 1000.5 (unchanged) |
| Type `1000,,50` (double comma) | Rejected by regex | Second comma → dot, rejected by regex (already has dot) |
| Type `1000,` (trailing comma) | Accepted as-is | Becomes `1000.` — accepted (existing behavior for trailing dot) |
| Paste `1,000,000` | Form value: 1000000 | Commas converted to dots → `1.000.000` → rejected by regex |

**Paste concern:** The paste case for `1,000,000` would break. Need to handle paste separately — only convert the **last** comma to a dot if the pasted value looks like it uses comma as decimal (i.e., comma is NOT at a thousand-separator position).

**Simpler approach:** Only convert comma to dot if the input doesn't already contain a dot and the comma is not in a thousand-separator position (not followed by exactly 3 digits at end of string).

## Dependencies & Assumptions

- Assumes the app consistently uses `.` (dot) as the decimal separator internally
- Assumes thousand separators are only applied on blur via `formatNumberWithCommas`

## Out of Scope

- Full locale-aware number formatting (e.g., displaying `1.000,50` for vi-VN locale)
- Changes to the AmountKeypad component (it already has its own `.` button)
- Changes to `type="number"` browser inputs (browser handles locale natively)
