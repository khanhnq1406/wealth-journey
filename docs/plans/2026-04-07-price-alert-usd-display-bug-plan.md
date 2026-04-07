# Price Alert USD Display Bug — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix `formatPrice()` in `PriceAlertList.tsx` to divide raw `int64` backend values by the currency decimal multiplier before display, so USD prices show correctly (e.g., `6847203` cents → `$68,472.03`).

**Spec:** `docs/specs/2026-04-07-price-alert-usd-display-bug-spec.md`

**Architecture:** Pure frontend display fix. No backend, proto, or API changes. The `formatPrice()` helper function in `PriceAlertList.tsx` currently passes the raw `int64` (cents) directly to `Intl.NumberFormat` without dividing by the currency's decimal multiplier, causing a 100× display error for USD and other 2-decimal currencies. The fix adds a `CURRENCY_DIVISORS` map and applies the divisor before formatting.

**Tech Stack:** TypeScript, React 19, Jest (unit tests), Playwright (E2E)

---

## Security Implementation Notes

- **Authentication:** No change — display-only fix, all data is the authenticated user's own alerts.
- **Authorization:** No change — no new endpoints or data access.
- **Input validation:** No user input involved in this fix.
- **Data sanitization:** `Intl.NumberFormat` is XSS-safe; no `dangerouslySetInnerHTML` involved.

---

## Component Reuse Inventory

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `formatPrice()` | `features/price-alert/components/PriceAlertList.tsx:39` | Existing helper — fix in place |

**New components needed:** None. The fix modifies the existing `formatPrice()` function and adds supporting constants (`CURRENCY_DIVISORS`, `getCurrencyDivisor`) in the same file.

---

## C4 Architecture Diagram Updates

No diagrams to update — this is a pure frontend display bug fix with no structural changes.

---

## Task Ordering

Tasks are sequential (Task 1 must complete before Task 2):
- **Task 1** fixes and tests `formatPrice()` (core fix)
- **Task 2** audits `CreatePriceAlertForm` to confirm no proto int64 is displayed (verification)
- **Task 3** runs E2E tests to confirm the fix passes end-to-end

---

### Task 1: Fix `formatPrice()` with currency divisor + unit tests

**Files:**

- Modify: `src/wj-client/features/price-alert/components/PriceAlertList.tsx:39-54`
- Create: `src/wj-client/features/price-alert/__tests__/formatPrice.test.ts`

**Security notes:** Display-only change. `Intl.NumberFormat` is a safe browser API. No XSS risk.

**Step 0: Component inventory check**

- [x] No existing shared `formatCurrency` utility covers this case (checked `lib/utils/number-format.ts` — only `formatNumberWithCommas` and `parseNumberWithCommas`, no int64 → display conversion)
- [x] No cross-feature import needed — fix stays in `features/price-alert/`
- Reusing: existing `formatPrice()` function signature (fix in place)
- Creating new: `CURRENCY_DIVISORS` constant and `getCurrencyDivisor()` helper (inline in same file)

**Step 1: Write the failing test**

Create `src/wj-client/features/price-alert/__tests__/formatPrice.test.ts`:

```typescript
/**
 * Unit tests for formatPrice() in PriceAlertList.tsx
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
 */

// Import the helper via a named export (see Step 3 — we'll export it)
import { formatPrice } from "../components/PriceAlertList";

describe("formatPrice", () => {
  describe("USD (2 decimal places, divisor 100)", () => {
    it("formats BTC price correctly: 6847203 → $68,472.03", () => {
      expect(formatPrice(6847203, "USD")).toBe("$68,472.03");
    });

    it("formats AAPL price correctly: 17550 → $175.50", () => {
      expect(formatPrice(17550, "USD")).toBe("$175.50");
    });

    it("formats small USD price correctly: 100 → $1.00", () => {
      expect(formatPrice(100, "USD")).toBe("$1.00");
    });
  });

  describe("VND (0 decimal places, divisor 1)", () => {
    it("formats VND price correctly: 1500000 → 1.500.000 ₫", () => {
      const result = formatPrice(1500000, "VND");
      // vi-VN locale uses . as thousand separator
      expect(result).toContain("1.500.000");
      expect(result).toContain("₫");
    });

    it("formats small VND price correctly: 85000 → 85.000 ₫", () => {
      const result = formatPrice(85000, "VND");
      expect(result).toContain("85.000");
    });
  });

  describe("KWD (3 decimal places, divisor 1000)", () => {
    it("formats KWD price correctly: 1234 → 1.234 KWD", () => {
      // KWD uses 3 decimal places; divisor = 1000
      // 1234 / 1000 = 1.234
      const result = formatPrice(1234, "KWD");
      expect(result).toContain("1.234");
    });
  });

  describe("Zero / edge cases", () => {
    it("returns '-' for price = 0", () => {
      expect(formatPrice(0, "USD")).toBe("-");
    });

    it("returns '-' for price = 0 in VND", () => {
      expect(formatPrice(0, "VND")).toBe("-");
    });

    it("handles unknown currency (defaults to divisor 100)", () => {
      // SGD not in the explicit map → defaults to 100 (2 decimal places)
      const result = formatPrice(10000, "SGD");
      // 10000 / 100 = 100.00 SGD
      expect(result).toContain("100");
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
```

Expected failure: `Cannot find module '../components/PriceAlertList' export 'formatPrice'` (because `formatPrice` is not yet exported).

**Step 3: Write minimal implementation**

In `src/wj-client/features/price-alert/components/PriceAlertList.tsx`, replace lines 39–54:

```typescript
// ---------------------------------------------------------------------------
// Currency divisors — matches backend GetCurrencyDecimalPlaces
// ---------------------------------------------------------------------------

/** Maps currency to its decimal-place divisor. Default = 100 (2 decimals: USD, EUR, GBP, etc.) */
const CURRENCY_DIVISORS: Record<string, number> = {
  // 0 decimal places → divisor 1
  VND: 1,
  JPY: 1,
  KRW: 1,
  // 3 decimal places → divisor 1000
  KWD: 1000,
  BHD: 1000,
  OMR: 1000,
  // All others → 100 (2 decimal places)
};

function getCurrencyDivisor(currency: string): number {
  return CURRENCY_DIVISORS[currency] ?? 100;
}

export function formatPrice(rawInt64: number, currency: string): string {
  if (!rawInt64) return "-";
  const divisor = getCurrencyDivisor(currency);
  const price = rawInt64 / divisor;
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(price);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
```

**Note:** `export` is added to `formatPrice` so the test file can import it directly. The rest of the file is unchanged.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
```

Expected: All tests green.

**Step 5: Run existing PriceAlertList tests to verify no regression**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="PriceAlertList"
```

Expected: All existing tests still pass (no behavior change for VND test data).

**Step 6: Run full frontend lint**

```bash
cd src/wj-client && npm run lint
```

Expected: No new lint errors.

**Step 7: Commit**

```
fix(price-alert): divide int64 price by currency divisor before display

formatPrice() in PriceAlertList was passing raw int64 cents directly to
Intl.NumberFormat, causing USD prices to appear 100x too large.
Added CURRENCY_DIVISORS map (matches backend GetCurrencyDecimalPlaces)
and getCurrencyDivisor() helper. VND/JPY/KRW: divisor=1; KWD/BHD/OMR:
divisor=1000; all others: divisor=100 (USD, EUR, GBP, etc.).
Exported formatPrice() for direct unit testing.
```

---

### Task 2: Audit `CreatePriceAlertForm` step-3 (verify no fix needed)

**Files:**

- Read: `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx`

**Security notes:** Read-only audit. No changes expected.

**Step 1: Verify the finding**

From codebase exploration: `CreatePriceAlertForm.tsx` is a **single-page form** (not 3 separate screens). The `targetPrice` field uses `FormNumberInput` which stores the user's entered value (e.g., `68472.03`) in form state — it is **not** a proto int64 value from the API. On submit, `data.targetPrice` (user's form value) is sent directly to the mutation; no proto int64 is displayed back to the user.

**Acceptance criteria check:**
- [x] FR-3: Step-3 confirmation in `CreatePriceAlertForm.tsx` — **no separate step-3 confirmation view exists**. The form submits and shows a `<Success>` component which only displays a success message string (`t("successMessage")`), not any price value. **No fix required.**

**Step 2: Add a comment in the test file if no test exists for this**

No new test needed — `CreatePriceAlertForm.test.tsx` already covers submission flow. The FR-3 audit is complete; document the finding as a comment in the plan.

**No commit needed for this task** — read-only verification.

---

### Task 3: Playwright E2E Audit

**Files:**

- Read/Update: `src/wj-client/tests/e2e/price-alerts-settings-flow.spec.ts`

**Step 1: Run existing E2E spec**

```bash
cd src/wj-client && npx playwright test tests/e2e/price-alerts-settings-flow.spec.ts --reporter=list
```

**Step 2: Check if E2E tests cover price display**

Review the spec for any assertions on displayed price values. If price display assertions exist with hardcoded expected values for USD prices, update them to use the corrected values.

**Step 3: Confirm green or update**

If tests pass without changes → done.
If tests fail due to the fix correcting previously incorrect expected values → update the expected values to the correct ones and re-run.

**Step 4: Commit if E2E tests were updated**

```
test(price-alert): update E2E expected price values to reflect USD divisor fix
```

---

## Success Criteria Checklist

- [ ] `formatPrice(6847203, "USD")` → `"$68,472.03"` (was `"$6,847,203.00"`)
- [ ] `formatPrice(17550, "USD")` → `"$175.50"` (was `"$175.50"` only coincidentally for small values — verify)
- [ ] `formatPrice(1500000, "VND")` → `"1.500.000 ₫"` (unchanged — divisor=1)
- [ ] `formatPrice(0, "USD")` → `"-"`
- [ ] `formatPrice(1234, "KWD")` → `"1.234 KWD"` (3 decimal places)
- [ ] All unit tests in `formatPrice.test.ts` pass
- [ ] All existing `PriceAlertList.test.tsx` tests still pass
- [ ] ESLint reports no new errors
- [ ] E2E tests pass (or are updated to correct expected values)
