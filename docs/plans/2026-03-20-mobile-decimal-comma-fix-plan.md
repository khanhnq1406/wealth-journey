# Mobile Number Input: Comma-as-Decimal Fix — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Auto-convert comma (`,`) to dot (`.`) in number inputs so Vietnamese locale keyboards produce correct decimal values.
**Spec:** `docs/specs/2026-03-20-mobile-decimal-comma-fix-spec.md`
**Architecture:** Purely client-side input normalization. A utility function `normalizeDecimalInput` will be added to `number-format.ts` and consumed by `FormNumberInput`, `ErrorSection`, and `TransactionFilterModal`. No backend or API changes.
**Tech Stack:** React, TypeScript, Next.js

## Security Implementation Notes

- No server interaction — entirely client-side display/parsing fix
- No new attack surface — existing regex validation unchanged
- No authorization or data model changes

## C4 Architecture Diagram Updates

None required. Bug fix in existing components.

## Runtime Flow Diagrams

None required. Simple input handling change.

---

### Task 1: Add `normalizeDecimalInput` utility function + tests

**Files:**
- Modify: `src/wj-client/lib/utils/number-format.ts`
- Modify: `src/wj-client/lib/utils/number-format.test.ts`

**Security notes:** Pure string transformation, no security concerns.

**Step 1: Write the failing tests**

Add to `number-format.test.ts`:

```typescript
describe("normalizeDecimalInput", () => {
  test("converts comma to dot for decimal input", () => {
    expect(normalizeDecimalInput("1000,50")).toBe("1000.50");
    expect(normalizeDecimalInput("100,5")).toBe("100.5");
  });

  test("leaves dot-based input unchanged", () => {
    expect(normalizeDecimalInput("1000.50")).toBe("1000.50");
    expect(normalizeDecimalInput("100")).toBe("100");
  });

  test("does not convert comma that looks like thousand separator", () => {
    // Comma followed by exactly 3 digits at end = thousand separator
    expect(normalizeDecimalInput("1,000")).toBe("1,000");
    expect(normalizeDecimalInput("10,000")).toBe("10,000");
    expect(normalizeDecimalInput("1,000,000")).toBe("1,000,000");
  });

  test("converts comma that does NOT look like thousand separator", () => {
    // Comma NOT followed by exactly 3 digits = decimal separator
    expect(normalizeDecimalInput("1000,5")).toBe("1000.5");
    expect(normalizeDecimalInput("1000,50")).toBe("1000.50");
    expect(normalizeDecimalInput("1000,1234")).toBe("1000.1234");
    expect(normalizeDecimalInput("0,5")).toBe("0.5");
  });

  test("handles input that already has a dot", () => {
    // If there's already a dot, don't convert commas (they're thousand seps)
    expect(normalizeDecimalInput("1,000.50")).toBe("1,000.50");
  });

  test("handles edge cases", () => {
    expect(normalizeDecimalInput("")).toBe("");
    expect(normalizeDecimalInput("0")).toBe("0");
    expect(normalizeDecimalInput("-1000,5")).toBe("-1000.5");
    expect(normalizeDecimalInput(",5")).toBe(".5");
  });

  test("handles trailing comma", () => {
    // Trailing comma = user starting to type decimal
    expect(normalizeDecimalInput("1000,")).toBe("1000.");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd src/wj-client && npx jest lib/utils/number-format.test.ts --no-coverage
```

**Step 3: Implement `normalizeDecimalInput`**

Add to `number-format.ts`:

```typescript
/**
 * Normalize decimal input by converting comma to dot when the comma
 * is used as a decimal separator (common on Vietnamese locale keyboards).
 *
 * Heuristic: A comma is treated as a thousand separator if it is followed
 * by exactly 3 digits (and possibly more ",NNN" groups) until end-of-string.
 * Otherwise it is treated as a decimal separator and converted to a dot.
 *
 * If the string already contains a dot, commas are left as-is (they must
 * be thousand separators).
 *
 * @param value - Raw input string from the user
 * @returns String with decimal comma converted to dot
 */
export function normalizeDecimalInput(value: string): string {
  if (!value) return value;

  // If there's already a dot, commas are thousand separators — leave as-is
  if (value.includes(".")) return value;

  // If there's no comma, nothing to do
  if (!value.includes(",")) return value;

  // Find the last comma in the string
  const lastCommaIndex = value.lastIndexOf(",");
  const afterComma = value.substring(lastCommaIndex + 1);

  // If the part after the last comma is exactly 3 digits AND
  // the entire string matches a thousand-separated pattern, leave as-is
  if (/^-?\d{1,3}(,\d{3})*$/.test(value)) {
    return value;
  }

  // Otherwise, treat the last comma as a decimal separator
  const beforeLastComma = value.substring(0, lastCommaIndex);
  return beforeLastComma + "." + afterComma;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd src/wj-client && npx jest lib/utils/number-format.test.ts --no-coverage
```

**Step 5: Commit**

```
feat(number-format): add normalizeDecimalInput for comma-as-decimal fix
```

---

### Task 2: Integrate `normalizeDecimalInput` into `FormNumberInput`

**Files:**
- Modify: `src/wj-client/components/forms/FormNumberInput.tsx`

**Security notes:** No new attack surface. The normalization runs before existing regex validation.

**Step 1: Write the failing test**

Create `src/wj-client/components/forms/__tests__/FormNumberInput.test.tsx`:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormNumberInput } from "../FormNumberInput";
import { useForm, FormProvider } from "react-hook-form";

// Wrapper component for React Hook Form
function TestWrapper({
  defaultValues = { amount: "" },
  children,
}: {
  defaultValues?: Record<string, any>;
  children: (control: any) => React.ReactNode;
}) {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children(methods.control)}</FormProvider>;
}

describe("FormNumberInput comma-to-dot conversion", () => {
  test("converts comma to dot when typing decimal", () => {
    render(
      <TestWrapper>
        {(control) => (
          <FormNumberInput name="amount" control={control} label="Amount" />
        )}
      </TestWrapper>
    );

    const input = screen.getByLabelText("Amount");
    // Simulate typing "1000,5" — the comma should become a dot
    fireEvent.change(input, { target: { value: "1000,5" } });
    expect(input).toHaveValue("1000.5");
  });

  test("preserves dot-based input", () => {
    render(
      <TestWrapper>
        {(control) => (
          <FormNumberInput name="amount" control={control} label="Amount" />
        )}
      </TestWrapper>
    );

    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "1000.5" } });
    expect(input).toHaveValue("1000.5");
  });

  test("preserves thousand-separator commas (1,000)", () => {
    render(
      <TestWrapper>
        {(control) => (
          <FormNumberInput name="amount" control={control} label="Amount" />
        )}
      </TestWrapper>
    );

    const input = screen.getByLabelText("Amount");
    fireEvent.change(input, { target: { value: "1,000" } });
    expect(input).toHaveValue("1,000");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest components/forms/__tests__/FormNumberInput.test.tsx --no-coverage
```

**Step 3: Modify `FormNumberInput.handleChange`**

In `FormNumberInput.tsx`, import the new utility and apply it at the top of `handleChange`:

```typescript
import {
  formatNumberWithCommas,
  parseNumberWithCommas,
  isValidNumberInput,
  normalizeDecimalInput,
} from "@/lib/utils/number-format";
```

Update `handleChange`:

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  let inputValue = e.target.value;

  // Allow empty value
  if (inputValue === "") {
    setDisplayValue("");
    onChange("");
    return;
  }

  // Normalize comma-as-decimal (e.g., vi-VN keyboard types "1000,5")
  inputValue = normalizeDecimalInput(inputValue);

  // Basic validation: only allow digits, decimal point, comma, and minus
  if (!/^-?[\d,]*\.?\d*$/.test(inputValue)) {
    return;
  }

  // Parse and update form value (numeric)
  const cleanValue = parseNumberWithCommas(inputValue);
  const numValue = parseFloat(cleanValue);

  if (!isNaN(numValue) || inputValue.endsWith(".")) {
    setDisplayValue(inputValue);
    onChange(numValue);
  }
};
```

**Step 4: Run tests to verify they pass**

```bash
cd src/wj-client && npx jest components/forms/__tests__/FormNumberInput.test.tsx --no-coverage
```

**Step 5: Commit**

```
feat(FormNumberInput): integrate comma-to-dot decimal normalization
```

---

### Task 3: Add comma-to-dot handling in `ErrorSection` amount input

**Files:**
- Modify: `src/wj-client/features/import/components/ErrorSection.tsx`

**Security notes:** No new attack surface. The normalization only affects client-side display before the existing `parseAmount` function.

**Step 1: Write the failing test**

Check if there's an existing test file for ErrorSection:

```bash
find src/wj-client/features/import -name "*test*" -o -name "*spec*"
```

Create or update `src/wj-client/features/import/components/__tests__/ErrorSection.test.tsx` to add a test for comma handling in the amount field:

```typescript
// Add to existing test file or create new one
describe("ErrorSection comma-to-dot in amount input", () => {
  test("converts comma to dot in amount input", () => {
    // Render ErrorSection with an error transaction, click "Fix",
    // type "1000,5" in amount field, verify the parseAmount receives "1000.5"
    // (This test depends on the existing test setup for ErrorSection)
  });
});
```

**Note:** If writing a full component test for ErrorSection is complex (it has many props and i18n dependencies), a simpler approach is to verify the utility function is called correctly. The key change is small and the utility is already tested in Task 1.

**Step 2: Implement the fix**

In `ErrorSection.tsx`, import `normalizeDecimalInput` and use it in the amount input's `onChange`:

```typescript
import { normalizeDecimalInput } from "@/lib/utils/number-format";
```

Update the amount `FormInput` onChange (around line 132):

```tsx
<FormInput
  label={t("amount").replace(":", "")}
  type="text"
  inputMode="decimal"
  value={formatAmount(tx.amount?.amount || 0, tx.amount?.currency || currency)}
  onChange={(e) => {
    const normalized = normalizeDecimalInput(e.target.value);
    onTransactionUpdate(tx.rowNumber, {
      amount: { amount: parseAmount(normalized), currency },
    });
  }}
  error={getFieldError(tx.validationErrors, "amount")}
  placeholder="1,000,000"
  size="sm"
/>
```

**Step 3: Run existing ErrorSection tests (if any) to verify no regressions**

```bash
cd src/wj-client && npx jest features/import --no-coverage
```

**Step 4: Commit**

```
feat(import): add comma-to-dot decimal normalization in ErrorSection amount input
```

---

### Task 4: Add comma-to-dot handling in `TransactionFilterModal` amount inputs

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/transaction/TransactionFilterModal.tsx`

**Security notes:** No new attack surface. Filter values are already parsed as numbers before being sent to the API.

**Step 1: Implement the fix**

The TransactionFilterModal uses `type="number"` with `inputMode="decimal"`. The spec notes that `type="number"` inputs are browser-handled. However, the current implementation uses `Number(e.target.value)` which fails with commas.

Two options:
- **Option A (minimal):** Change `type="number"` to `type="text"` and add `normalizeDecimalInput` — but this changes keyboard behavior and loses native number validation.
- **Option B (recommended):** Keep `type="number"` but add a fallback: if `Number(e.target.value)` returns 0 or NaN and the raw value looks like it has a comma, normalize it. However, `type="number"` inputs don't expose non-numeric characters in `e.target.value` on most browsers.

**Decision:** The spec says `type="number"` inputs are out of scope and should only be "verified." Since these are `type="number"`, the browser's native number handling should manage locale-specific decimal separators. The vi-VN keyboard's comma may already work with `type="number"` on Safari because the browser itself interprets the comma.

**Action:** Mark this as a verification task rather than a code change. If verification on iPhone Safari vi-VN shows the issue exists with `type="number"`, we'll convert these to `type="text"` with `inputMode="decimal"` + `normalizeDecimalInput`.

**Step 2: Add a comment documenting the verification need**

No code change needed. Document in the implementation report that this was verified (or needs manual verification).

**Step 3: Commit (if any changes)**

Skip commit if no code changes. Include verification result in the implementation report.

---

### Task 5: Update the regex validation in `FormNumberInput` to accept comma input before normalization

**Files:**
- Modify: `src/wj-client/components/forms/FormNumberInput.tsx` (potentially)

**Security notes:** No change to validation strength — the regex still rejects non-numeric characters.

**Analysis:** Looking at the current flow in `handleChange`:

1. `normalizeDecimalInput(inputValue)` converts `1000,5` → `1000.5`
2. The regex `/^-?[\d,]*\.?\d*$/` is then checked against `1000.5` — this passes because it allows digits and a single dot.

For the thousand-separator case (`1,000`), `normalizeDecimalInput` returns `1,000` unchanged, and the regex passes it.

**Conclusion:** No regex change needed. The normalization happens before the regex check, so the regex only sees properly formatted strings. This task is a no-op after analysis.

**Step 1: Verify by running all number-format and FormNumberInput tests**

```bash
cd src/wj-client && npx jest lib/utils/number-format.test.ts components/forms/__tests__/FormNumberInput.test.tsx --no-coverage
```

**No code changes. No commit needed.**

---

### Summary

| Task | Description | Files Changed | Estimated Effort |
|------|-------------|---------------|-----------------|
| 1 | Add `normalizeDecimalInput` utility + tests | `number-format.ts`, `number-format.test.ts` | 5 min |
| 2 | Integrate into `FormNumberInput` + tests | `FormNumberInput.tsx`, `FormNumberInput.test.tsx` (new) | 5 min |
| 3 | Add to `ErrorSection` amount input | `ErrorSection.tsx` | 3 min |
| 4 | Verify `TransactionFilterModal` (type="number") | None (verification only) | 2 min |
| 5 | Verify regex compatibility (analysis) | None | 1 min |

**Total: 3 files modified, 1 new test file, ~16 min of work.**
