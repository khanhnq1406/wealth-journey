# Fix: Price Alert Cannot Use Home Page Prices — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Fix the wrong `showInInvestment` filter in `CreatePriceAlertForm` — replace with `enabled` so the alert dropdown matches what the home page shows.
**Spec:** `docs/specs/2026-04-06-fix-price-alert-cannot-use-home-page-prices-spec.md`
**Architecture:** Pure frontend, single-file fix. The form's two `useMemo` filter conditions change from `showInInvestment` to `enabled` in `CreatePriceAlertForm.tsx`. No bell buttons, no modal wiring, no home page changes.
**Tech Stack:** React 19, TypeScript, React Hook Form, Jest + Testing Library.

---

## Security Implementation Notes

- **Authentication:** No change — existing `AuthMiddleware` on all alert endpoints is unchanged.
- **Authorization:** No change — alert form is already accessible to all authenticated users.
- **Input validation:** Existing Zod schema + backend validation unchanged.
- **No new attack surface** — this is a display filter change only.

---

## Component Reuse Inventory

No new components needed. Only `CreatePriceAlertForm.tsx` and its test file are modified.

---

## C4 Architecture Diagram Updates

None — no structural changes to components or data flows.

---

### Task 1: Fix `showInInvestment` filter in `CreatePriceAlertForm`

**Files:**
- Modify: `src/wj-client/features/price-alert/forms/CreatePriceAlertForm.tsx` (lines 113 and 121)
- Modify: `src/wj-client/features/price-alert/__tests__/CreatePriceAlertForm.test.tsx`

**Security notes:** Client-side display filter only. Backend already validates symbols independently.

**Step 1: Write the failing test**

In `CreatePriceAlertForm.test.tsx`, update the mock and add a test verifying that a price with `showInInvestment: false, enabled: true` appears in the gold dropdown.

```typescript
// 1. Update the existing mock data to add enabled: true to existing items:
//    { typeCode: "SJC", displayName: "SJC", showInInvestment: true, enabled: true }
//    { typeCode: "BTMC", displayName: "SJC BTMC", showInInvestment: true, enabled: true }
//    { typeCode: "PH_QU_THI_1L", displayName: "Phú Quý thỏi 1L", showInInvestment: true, enabled: true }

// 2. Add a new test (e.g. after existing tests):
it("includes gold prices with enabled=true even when showInInvestment=false", async () => {
  const { useQueryGetAssetDisplayPrices } = require("@/utils/generated/hooks");
  useQueryGetAssetDisplayPrices.mockImplementation((req: { assetType: string }) => {
    if (req.assetType === "gold") {
      return {
        data: {
          prices: [
            { typeCode: "SJC", displayName: "SJC", showInInvestment: true, enabled: true },
            { typeCode: "DOJI_24K", displayName: "Doji 24K", showInInvestment: false, enabled: true },
            { typeCode: "DISABLED", displayName: "Disabled Item", showInInvestment: true, enabled: false },
          ],
        },
        isLoading: false,
        error: null,
      };
    }
    return { data: null, isLoading: false, error: null };
  });

  render(<CreatePriceAlertForm defaultCategory="gold" />, { wrapper: TestWrapper });

  // Advance to step 2 (symbol selection)
  const goldButton = screen.getByRole("button", { name: /gold/i });
  fireEvent.click(goldButton);
  const nextButton = screen.getByRole("button", { name: /next/i });
  fireEvent.click(nextButton);

  // Doji 24K (showInInvestment: false, enabled: true) must appear
  expect(screen.getByText("Doji 24K")).toBeInTheDocument();
  // Disabled Item (enabled: false) must NOT appear
  expect(screen.queryByText("Disabled Item")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="CreatePriceAlertForm" 2>&1 | tail -20
# Expected: "Doji 24K" not found → test fails (showInInvestment filter excludes it)
```

**Step 3: Write minimal implementation**

In `CreatePriceAlertForm.tsx`, change lines 113 and 121:

```typescript
// BEFORE (line 113):
      .filter((p) => p.showInInvestment)

// AFTER (line 113):
      .filter((p) => p.enabled)

// BEFORE (line 121):
      .filter((p) => p.showInInvestment)

// AFTER (line 121):
      .filter((p) => p.enabled)
```

Full context (lines 110–124) after the fix:

```typescript
const goldSelectOptions = useMemo<SelectOption[]>(
  () =>
    (goldQuery.data?.prices ?? [])
      .filter((p) => p.enabled)
      .map((p) => ({ value: p.typeCode, label: p.displayName })),
  [goldQuery.data]
);

const silverSelectOptions = useMemo<SelectOption[]>(
  () =>
    (silverQuery.data?.prices ?? [])
      .filter((p) => p.enabled)
      .map((p) => ({ value: p.typeCode, label: p.displayName })),
  [silverQuery.data]
);
```

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="CreatePriceAlertForm" 2>&1 | tail -20
# Expected: all tests pass
```

**Step 5: Run full price-alert test suite to confirm no regressions**

```bash
cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="price-alert" 2>&1 | tail -30
```

**Step 6: Run lint + TypeScript check**

```bash
cd src/wj-client && npm run lint 2>&1 | grep -E "error" | head -10
cd src/wj-client && npx tsc --noEmit 2>&1 | head -10
```

**Step 7: Commit**

```
fix(price-alert): use enabled filter instead of showInInvestment in CreatePriceAlertForm

showInInvestment controls which prices appear in the investment portfolio form.
It has no semantic relationship to price alerts. The home page shows all enabled
prices; the alert form dropdown now matches.
```
