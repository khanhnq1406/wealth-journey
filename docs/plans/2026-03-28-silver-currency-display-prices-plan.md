# Silver & Currency Display Prices Migration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Migrate silver and currency price tables on landing page and home page from `usePublicMarketTypes`/`useQueryGetMarketPrices` to `useQueryGetAssetDisplayPrices` — matching how gold already works.
**Spec:** `docs/specs/2026-03-28-silver-currency-display-prices-spec.md`
**Architecture:** Pure frontend data-source migration. No backend, no proto, no DB changes. Four components become self-fetching; two parent pages simplified by removing unused state.
**Tech Stack:** React 19, Next.js App Router, React Query v5, TypeScript, `useQueryGetAssetDisplayPrices` hook (generated), `AssetDisplayPrice` type from `gen/protobuf/v1/investment.ts`

## Security Implementation Notes

- No auth required — `GetPublicAssetDisplayPrices` is a public endpoint (same as existing gold calls)
- `assetType` strings hardcoded in hooks — no user input involved
- No monetary values manipulated — display only
- No PII — public market data only

## Component Reuse Inventory

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `useQueryGetAssetDisplayPrices` | `utils/generated/hooks.ts` | Self-fetch in silver/currency table components |
| `AssetDisplayPrice` type | `gen/protobuf/v1/investment.ts` | Replace `MarketTypeItem` / `PriceItem` props |
| `useAuth` | `features/auth/hooks/useAuth.ts` | Derive `isAdmin` inside SilverPriceTable / CurrencyPriceTable |
| `formatUpdateTimestamp` | `features/market-prices/utils/format-update-time.ts` | Derive update time from `prices` array |
| `InlinePriceEdit`, `OverrideIndicator` | `features/market-prices/components/InlinePriceEdit.tsx` | Keep for admin inline edit (use `item.typeCode` from `AssetDisplayPrice`) |
| `formatPriceValue` | `../prices/helpers` | Keep for buy/sell formatting — no change needed |

**New components needed:** None.

## C4 Architecture Diagram Updates

`c4-component-frontend.md` — minor update to note `LandingSilverPriceTable` and `LandingCurrencyPriceTable` now depend on `AssetDisplayPrices Hook` directly (same as `LandingGoldPriceTable`). `LandingContent` no longer depends on `usePublicMarketTypes` for silver/currency.

---

### Task 0: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**
1. Find the Landing page section in the diagram — update `LandingSilverPriceTable` and `LandingCurrencyPriceTable` to show they use `AssetDisplayPrices Hook` (same as `LandingGoldPriceTable`)
2. Remove or update the `usePublicMarketTypes` dependency arrow from `LandingContent` if present
3. Commit

**Note:** No new flows needed in `flow-cross-cutting.md` — the `GetPublicAssetDisplayPrices` endpoint is already documented there.

---

### Task 1: Migrate `LandingSilverPriceTable` — Self-Fetch via `useQueryGetAssetDisplayPrices`

**Files:**
- Modify: `src/wj-client/components/landing/LandingSilverPriceTable.tsx`

**Security notes:** Public endpoint, no auth, no user input. No security changes needed.

**Context:** Currently accepts `types: MarketTypeItem[]`, `isLoading?`, `updatedTime?` props from parent. Gold equivalent (`LandingGoldPriceTable`) is already self-fetching. This task mirrors that pattern exactly.

**Step 1: Write failing test**

File: `src/wj-client/components/landing/__tests__/LandingSilverPriceTable.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { LandingSilverPriceTable } from "../LandingSilverPriceTable";
import { useQueryGetAssetDisplayPrices } from "@/utils/generated/hooks";

jest.mock("@/utils/generated/hooks");
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockUseQuery = useQueryGetAssetDisplayPrices as jest.Mock;

describe("LandingSilverPriceTable", () => {
  it("calls useQueryGetAssetDisplayPrices with assetType=silver", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<LandingSilverPriceTable />);
    expect(mockUseQuery).toHaveBeenCalledWith({ assetType: "silver" });
  });

  it("shows loading state when fetching", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<LandingSilverPriceTable />);
    expect(screen.getByText("loadingTypes")).toBeInTheDocument();
  });

  it("shows displayName from AssetDisplayPrice", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: { prices: [{ typeCode: "AGS", displayName: "Silver 999 (AGS)", buy: 1000, sell: 1100, isStale: false, updatedAt: 0 }] },
    });
    render(<LandingSilverPriceTable />);
    expect(screen.getByText("Silver 999 (AGS)")).toBeInTheDocument();
  });

  it("accepts no props — is self-fetching", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    // Should render without any props
    expect(() => render(<LandingSilverPriceTable />)).not.toThrow();
  });
});
```

**Step 2: Run test — verify it fails** (component still takes props)
```bash
cd src/wj-client && npm test -- --testPathPattern="LandingSilverPriceTable"
```
Expected: fails (component accepts props, not self-fetching)

**Step 3: Implement**

Replace `LandingSilverPriceTable.tsx` entirely:
- Remove `LandingSilverPriceTableProps` interface
- Remove props parameter
- Add `useQueryGetAssetDisplayPrices({ assetType: "silver" })` call
- Derive `updatedTime` from `prices.find(p => p.updatedAt > 0)?.updatedAt`
- Replace `item.name || item.code` with `item.displayName`
- Keep login prompt in buy/sell cells (same as before)
- Add loading skeleton matching `LandingGoldPriceTable` pattern

**Step 4: Run test — verify passes**
```bash
cd src/wj-client && npm test -- --testPathPattern="LandingSilverPriceTable"
```

**Step 5: Commit**
```
feat(landing): migrate LandingSilverPriceTable to self-fetch via asset-display-prices API
```

---

### Task 2: Migrate `LandingCurrencyPriceTable` — Self-Fetch via `useQueryGetAssetDisplayPrices`

**Files:**
- Modify: `src/wj-client/components/landing/LandingCurrencyPriceTable.tsx`

**Security notes:** Same as Task 1.

**Step 1: Write failing test**

File: `src/wj-client/components/landing/__tests__/LandingCurrencyPriceTable.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { LandingCurrencyPriceTable } from "../LandingCurrencyPriceTable";
import { useQueryGetAssetDisplayPrices } from "@/utils/generated/hooks";

jest.mock("@/utils/generated/hooks");
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children }: any) => children }));

const mockUseQuery = useQueryGetAssetDisplayPrices as jest.Mock;

describe("LandingCurrencyPriceTable", () => {
  it("calls useQueryGetAssetDisplayPrices with assetType=currency", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<LandingCurrencyPriceTable />);
    expect(mockUseQuery).toHaveBeenCalledWith({ assetType: "currency" });
  });

  it("shows displayName from AssetDisplayPrice", () => {
    mockUseQuery.mockReturnValue({
      isLoading: false,
      data: { prices: [{ typeCode: "USD", displayName: "USD (VangSaiGon)", buy: 24000, sell: 25000, isStale: false, updatedAt: 0 }] },
    });
    render(<LandingCurrencyPriceTable />);
    expect(screen.getByText("USD (VangSaiGon)")).toBeInTheDocument();
  });
});
```

**Step 2:** Run to verify fails
```bash
cd src/wj-client && npm test -- --testPathPattern="LandingCurrencyPriceTable"
```

**Step 3:** Implement — mirror Task 1 pattern exactly but for `assetType: "currency"`. Currency header is `text-white` (not `text-v2-maroon-900`). Keep existing visual styling.

**Step 4:** Run to verify passes

**Step 5: Commit**
```
feat(landing): migrate LandingCurrencyPriceTable to self-fetch via asset-display-prices API
```

---

### Task 3: Clean Up `LandingContent` — Remove `usePublicMarketTypes`

**Files:**
- Modify: `src/wj-client/app/[locale]/landing/LandingContent.tsx`
- Modify: `src/wj-client/app/[locale]/landing/page.tsx`

**Security notes:** None. SSR cleanup only.

**Steps:**

1. In `LandingContent.tsx`:
   - Remove `usePublicMarketTypes` import and call
   - Remove `effectiveData`, `silverTypes`, `currencyTypes`, `silverUpdatedTime`, `currencyUpdatedTime` variables
   - Remove `initialData` prop and `PublicMarketTypesResponse` import
   - Remove props from `<LandingSilverPriceTable>` and `<LandingCurrencyPriceTable>` — they now accept none
   - Keep error state block? → Remove (it was based on `usePublicMarketTypes` error; no longer applicable since tables self-handle errors)

2. In `page.tsx`:
   - Remove `fetchMarketTypes()` function
   - Remove `PublicMarketTypesResponse` import
   - Remove SSR data fetch call
   - Make `LandingPage` a simple sync component that renders `<LandingContent />`

**Step: Run TypeScript compiler check**
```bash
cd src/wj-client && npx tsc --noEmit
```
Expected: 0 errors

**Step: Commit**
```
refactor(landing): remove usePublicMarketTypes — silver/currency tables now self-fetch
```

---

### Task 4: Migrate `SilverPriceTable` (Home) — Self-Fetch via `useQueryGetAssetDisplayPrices`

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`

**Security notes:** `isAdmin` now derived from `useAuth()` inside component rather than passed as prop. Same auth state — no security impact.

**Context:** Currently accepts `prices: PriceItem[]`, `updatedTime?`, `isAdmin?`, `isLoading?` props. `GoldPriceTable` in the same directory is already self-fetching from `useQueryGetAssetDisplayPrices` — mirror that pattern.

**Step 1: Write failing test**

File: `src/wj-client/app/[locale]/dashboard/home/__tests__/SilverPriceTable.test.tsx` (next to existing `GoldPriceTable.test.tsx`)

```tsx
import { render, screen } from "@testing-library/react";
import { SilverPriceTable } from "../SilverPriceTable";
import { useQueryGetAssetDisplayPrices } from "@/utils/generated/hooks";
import { useAuth } from "@/features/auth/hooks/useAuth";

jest.mock("@/utils/generated/hooks");
jest.mock("@/features/auth/hooks/useAuth");
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("SilverPriceTable", () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
  });

  it("calls useQueryGetAssetDisplayPrices with assetType=silver", () => {
    (useQueryGetAssetDisplayPrices as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    render(<SilverPriceTable />);
    expect(useQueryGetAssetDisplayPrices).toHaveBeenCalledWith(
      { assetType: "silver" },
      expect.any(Object),
    );
  });

  it("shows -- for stale prices", () => {
    (useQueryGetAssetDisplayPrices as jest.Mock).mockReturnValue({
      isLoading: false,
      data: { prices: [{ typeCode: "AGS", displayName: "Silver 999", buy: 100, sell: 110, isStale: true, updatedAt: 0 }] },
    });
    render(<SilverPriceTable />);
    expect(screen.getAllByText("--")).toHaveLength(2); // buy and sell
  });

  it("shows prices for non-stale entries", () => {
    (useQueryGetAssetDisplayPrices as jest.Mock).mockReturnValue({
      isLoading: false,
      data: { prices: [{ typeCode: "AGS", displayName: "Silver 999", buy: 100000, sell: 110000, isStale: false, currency: "VND", updatedAt: 0 }] },
    });
    render(<SilverPriceTable />);
    expect(screen.queryAllByText("--")).toHaveLength(0);
  });

  it("accepts no external props", () => {
    (useQueryGetAssetDisplayPrices as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    expect(() => render(<SilverPriceTable />)).not.toThrow();
  });
});
```

**Step 2:** Run to verify fails

**Step 3: Implement `SilverPriceTable.tsx`**

Replace the component:
- Remove props interface and parameters
- Add `useQueryGetAssetDisplayPrices({ assetType: "silver" }, { staleTime: 5 * 60 * 1000 })` call
- Add `const { user } = useAuth(); const isAdmin = user?.isAdmin ?? false;`
- Replace `prices.map(item => ...)` — use `item.displayName` (not `item.name || item.typeCode`)
- Add stale indicator: `item.isStale ? "--" : formatPriceValue(item.buy, item.currency || "VND")`
- Derive `updatedTime` from `formatUpdateTimestamp(getLatestTimestamp(prices))` (same as current GoldPriceTable)
- Keep `InlinePriceEdit` / `OverrideIndicator` for admin (use `item.typeCode` from `AssetDisplayPrice`)
- Note: `OverrideIndicator` and `InlinePriceEdit` accept `PriceItem` — check if `AssetDisplayPrice` is compatible or needs adapter. If not compatible, cast/adapt.

**Compatibility check needed:** Read `InlinePriceEdit` to verify prop types.

**Step 4:** Run to verify passes

**Step 5: Commit**
```
feat(home): migrate SilverPriceTable to self-fetch via asset-display-prices API
```

---

### Task 5: Migrate `CurrencyPriceTable` (Home) — Self-Fetch via `useQueryGetAssetDisplayPrices`

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx`

**Security notes:** Same as Task 4.

**Steps:** Mirror Task 4 exactly for `assetType: "currency"`. Currency prices use `{ divide: false }` option in `formatPriceValue` — preserve this.

**Test file:** `src/wj-client/app/[locale]/dashboard/home/__tests__/CurrencyPriceTable.test.tsx`

**Commit:**
```
feat(home): migrate CurrencyPriceTable to self-fetch via asset-display-prices API
```

---

### Task 6: Clean Up `home/page.tsx` — Remove `useQueryGetMarketPrices` for Silver/Currency

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/page.tsx`

**Steps:**

1. Remove `useQueryGetMarketPrices` from import and from the hook calls
2. Remove `marketPrices`, `marketPricesLoading` variables
3. Remove `silverPrices`, `currencyPrices`, `silverUpdatedTime`, `currencyUpdatedTime` variables
4. Remove all props from `<SilverPriceTable>` and `<CurrencyPriceTable>` occurrences (4 total — mobile + desktop for each)
5. Remove `isAdmin` prop from those components (they now source it internally)
6. Run TypeScript check

**Step: TypeScript check**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step: Lint check**
```bash
cd src/wj-client && npm run lint
```

**Step: Commit**
```
refactor(home): remove useQueryGetMarketPrices for silver/currency — tables now self-fetch
```

---

### Task 7: Verification — Build + Tests

**Steps:**

1. Run all Jest tests:
```bash
cd src/wj-client && npm test -- --passWithNoTests
```
Expected: all pass

2. TypeScript build check:
```bash
cd src/wj-client && npx tsc --noEmit
```
Expected: 0 errors

3. Next.js production build:
```bash
cd src/wj-client && npm run build
```
Expected: successful build, 0 errors

4. Lint:
```bash
cd src/wj-client && npm run lint
```
Expected: 0 errors

---

## Dependency Impact Notes

| Changed Symbol | d=1 Dependents | Notes |
|---|---|---|
| `LandingSilverPriceTable` props (removed) | `LandingContent.tsx` | Task 3 removes props from caller |
| `LandingCurrencyPriceTable` props (removed) | `LandingContent.tsx` | Task 3 removes props from caller |
| `SilverPriceTable` props (removed) | `home/page.tsx` (2 usages) | Task 6 removes props from caller |
| `CurrencyPriceTable` props (removed) | `home/page.tsx` (2 usages) | Task 6 removes props from caller |
| `useQueryGetMarketPrices` | Removed from `home/page.tsx` | Verify no other usage in home page |
| `usePublicMarketTypes` | Removed from `LandingContent` and `page.tsx` | Verify no other usage in landing |

## InlinePriceEdit Compatibility Note (Task 4/5)

Before implementing Tasks 4 and 5, read `src/wj-client/features/market-prices/components/InlinePriceEdit.tsx` to check if `OverrideIndicator` and `InlinePriceEdit` accept `PriceItem` or a more generic type. If they only accept `PriceItem`, create a thin adapter object `{ typeCode, name, buy, sell, currency }` from `AssetDisplayPrice` to pass to those components.
