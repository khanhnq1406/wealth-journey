# Price Table Dividers & VND Price Formatting — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add row/column dividers to all price tables and divide VND prices by 100 with "(x100₫)" header labels.
**Spec:** `docs/specs/2026-03-17-price-table-dividers-and-formatting-spec.md`
**Architecture:** Frontend-only changes. No backend, API, or data model modifications. Changes affect 3 layers: (1) the shared `formatPriceValue` helper, (2) 6 native `<table>` components (3 home + 3 landing), and (3) the prices page column builders for TanStack/Mobile tables. i18n keys updated for unit labels.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS, next-intl

## Security Implementation Notes

No security concerns — this is a purely cosmetic frontend change:
- No user input involved
- No API changes
- No data persistence changes
- No authorization changes
- Division is a deterministic display transform

---

### Task 1: Update `formatPriceValue` to divide VND by 100 and remove ₫ symbol

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/helpers.ts`

**What to do:**

1. Add a `VND_DIVISOR = 100` constant
2. In `formatPriceValue`, for VND: divide `value` by `VND_DIVISOR`, then format as plain number (no currency symbol) using `Intl.NumberFormat("vi-VN")` with `maximumFractionDigits: 0`
3. The `formatChangeValue` function already delegates to `formatPriceValue`, so change values will automatically be divided too

**Current code:**
```typescript
const USD_DIVISOR = 100;

export function formatPriceValue(
  value: number | null | undefined,
  currency: string,
): string {
  if (value === null || value === undefined) return "-";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return `$${(value / USD_DIVISOR).toFixed(2)}`;
}
```

**New code:**
```typescript
const USD_DIVISOR = 100;
const VND_DIVISOR = 100;

export function formatPriceValue(
  value: number | null | undefined,
  currency: string,
): string {
  if (value === null || value === undefined) return "-";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(value / VND_DIVISOR);
  }
  return `$${(value / USD_DIVISOR).toFixed(2)}`;
}
```

Key changes:
- Removed `style: "currency"` and `currency: "VND"` — this removes the ₫ symbol
- Added `/ VND_DIVISOR` — divides by 100
- `formatChangeValue` automatically benefits since it calls `formatPriceValue`

**Commit:** `feat(prices): divide VND prices by 100 and remove ₫ symbol from cells`

---

### Task 2: Add i18n keys for Buy/Sell unit labels "(x100₫)"

**Files:**
- Modify: `src/wj-client/messages/en/investment.json` — `prices.table.buy` and `prices.table.sell`
- Modify: `src/wj-client/messages/vi/investment.json` — `prices.table.buy` and `prices.table.sell`
- Modify: `src/wj-client/messages/en/ui.json` — `dashboard.home.buy` and `dashboard.home.sell`
- Modify: `src/wj-client/messages/vi/ui.json` — `dashboard.home.buy` and `dashboard.home.sell`
- Modify: `src/wj-client/messages/en/nav.json` — `landing.priceTeaser.buy` and `landing.priceTeaser.sell`
- Modify: `src/wj-client/messages/vi/nav.json` — `landing.priceTeaser.buy` and `landing.priceTeaser.sell`

**What to do:**

Add a new `buyUnit` and `sellUnit` key next to the existing `buy`/`sell` keys in each namespace. Keep the existing `buy`/`sell` keys unchanged (they're used as the main header text). The unit label will be rendered separately with smaller/lighter styling.

**Changes per file:**

`messages/en/investment.json` — inside `"prices" > "table"`:
```json
"buy": "Buy",
"buyUnit": "(x100₫)",
"sell": "Sell",
"sellUnit": "(x100₫)",
```

`messages/vi/investment.json` — inside `"prices" > "table"`:
```json
"buy": "Mua",
"buyUnit": "(x100₫)",
"sell": "Bán",
"sellUnit": "(x100₫)",
```

`messages/en/ui.json` — inside `"dashboard" > "home"`:
```json
"buy": "BUY",
"buyUnit": "(x100₫)",
"sell": "SELL",
"sellUnit": "(x100₫)",
```

`messages/vi/ui.json` — inside `"dashboard" > "home"`:
```json
"buy": "MUA",
"buyUnit": "(x100₫)",
"sell": "BÁN",
"sellUnit": "(x100₫)",
```

`messages/en/nav.json` — inside `"landing" > "priceTeaser"`:
```json
"buy": "BUY",
"buyUnit": "(x100₫)",
"sell": "SELL",
"sellUnit": "(x100₫)",
```

`messages/vi/nav.json` — inside `"landing" > "priceTeaser"`:
```json
"buy": "MUA",
"buyUnit": "(x100₫)",
"sell": "BÁN",
"sellUnit": "(x100₫)",
```

**Commit:** `feat(i18n): add buyUnit/sellUnit keys for VND price table headers`

---

### Task 3: Add dividers and unit labels to Home dashboard price tables

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/home/GoldPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/SilverPriceTable.tsx`
- Modify: `src/wj-client/app/[locale]/dashboard/home/CurrencyPriceTable.tsx`

**What to do (same pattern for all 3 files):**

**Step 1: Add `border-collapse` to the `<table>` element**

Change:
```tsx
<table className="w-full">
```
To:
```tsx
<table className="w-full border-collapse">
```

**Step 2: Add column dividers to header `<th>` elements**

Add `border-x border-white/30` to each `<th>` (using semi-transparent white so the divider blends with the colored header background). Use `first:border-l-0 last:border-r-0` to avoid double borders at table edges.

For buy/sell headers, also add the unit label below the main text:

Change (for buy header, example from GoldPriceTable):
```tsx
<th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-gold-dark">
  {t("buy")}
</th>
```
To:
```tsx
<th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-gold-dark border-x border-white/30 first:border-l-0 last:border-r-0">
  <div>{t("buy")}</div>
  <div className="font-normal text-[10px] tracking-normal opacity-70">{t("buyUnit")}</div>
</th>
```

Same pattern for sell header with `t("sellUnit")`.

For the type column header (first column), add `border-x border-white/30 first:border-l-0`:
```tsx
<th className="text-left px-5 py-3.5 font-vietnam font-bold text-[14px] tracking-normal text-v2-gold-dark border-x border-white/30 first:border-l-0">
```

For admin column (if present), add `last:border-r-0`.

**Step 3: Add row dividers to body `<tr>` elements**

Add `border-b border-v2-border-light` to each body `<tr>`:

Change:
```tsx
<tr
  key={item.typeCode || index}
  className={index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}
>
```
To:
```tsx
<tr
  key={item.typeCode || index}
  className={`border-b border-v2-border-light ${index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}`}
>
```

**Step 4: Add column dividers to body `<td>` elements**

Add `border-x border-v2-border-light first:border-l-0 last:border-r-0` to each body `<td>`:

For example:
```tsx
<td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-lred border-x border-v2-border-light first:border-l-0 last:border-r-0">
```

Apply to all `<td>` elements (name, buy, sell, admin columns).

**Color variants per table:**
- GoldPriceTable: header text `text-v2-gold-dark`
- SilverPriceTable: header text `text-v2-silver-dark`
- CurrencyPriceTable: header text `text-v2-currency-dark`

**Commit:** `feat(prices): add dividers and unit labels to home dashboard price tables`

---

### Task 4: Add dividers and unit labels to Landing page price tables

**Files:**
- Modify: `src/wj-client/components/landing/LandingGoldPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingSilverPriceTable.tsx`
- Modify: `src/wj-client/components/landing/LandingCurrencyPriceTable.tsx`

**What to do:**

Same divider pattern as Task 3, but:
- Landing tables use `useTranslations("landing.priceTeaser")` instead of `"dashboard.home"`
- Landing tables show login prompts instead of prices in buy/sell cells — the dividers still apply
- Buy/sell headers still get the unit label (even though cells show login prompt — this tells users what the numbers will look like after they log in)

**Apply the same 4 steps from Task 3** (border-collapse, header column dividers with unit labels, row dividers on `<tr>`, column dividers on `<td>`).

**Additional fix for LandingSilverPriceTable:** Change `<BaseCard className="... !p-0">` to `<BaseCard padding="none" className="...">` for consistency with other tables (remove the `!p-0` override).

**Commit:** `feat(prices): add dividers and unit labels to landing price tables`

---

### Task 5: Add unit labels to Prices page column headers (TanStack + Mobile)

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/prices/page.tsx`

**What to do:**

**Step 1: Update `buildTanstackColumns` buy/sell headers**

The current buy header:
```tsx
columnHelper.accessor("buy", {
  header: () => (
    <span className="text-base font-bold">{t("table.buy")}</span>
  ),
  ...
})
```

Change to:
```tsx
columnHelper.accessor("buy", {
  header: () => (
    <div>
      <span className="text-base font-bold">{t("table.buy")}</span>
      <div className="font-normal text-[10px] text-gray-400">{t("table.buyUnit")}</div>
    </div>
  ),
  ...
})
```

Same for sell header with `t("table.sellUnit")`.

**Step 2: Update `buildMobileColumns` buy/sell headers**

The current buy header:
```tsx
{
  id: "buy",
  header: <span className="text-base">{t("table.buy")}</span>,
  ...
}
```

Change to:
```tsx
{
  id: "buy",
  header: (
    <div>
      <span className="text-base">{t("table.buy")}</span>
      <span className="text-[10px] text-gray-400 ml-1">{t("table.buyUnit")}</span>
    </div>
  ),
  ...
}
```

Same for sell header.

**Note:** TanStackTable already has row dividers (`border-b border-gray-200`). The spec calls for column dividers too — but since TanStackTable is a shared component used elsewhere, we should NOT modify it globally. Instead, we can add column borders via the column cell/header class. However, TanStackTable hardcodes `<td>` and `<th>` classes. The simplest approach is to add the column divider styling via cell wrapper `<span>` padding or let TanStack handle it. Given TanStackTable is reused, the pragmatic approach is to **not add column dividers to TanStackTable** since it already has clean row borders, and only add column dividers to the native `<table>` components (home + landing). The MobileTable is card-based (not a table), so column dividers don't apply there either.

**Commit:** `feat(prices): add unit labels to prices page column headers`

---

### Task 6: Visual verification

**Files:** None (read-only verification)

**What to do:**

1. Run `cd src/wj-client && npm run build` to verify no TypeScript errors
2. Visually verify:
   - Landing page gold/silver/currency tables have dividers
   - Home dashboard gold/silver/currency tables have dividers
   - Prices page Buy/Sell headers show "(x100₫)" unit label
   - VND prices are shorter (divided by 100, no ₫ symbol)
   - USD prices unchanged
   - Zebra striping preserved alongside dividers
   - Unit label is smaller and lighter than main header text

**Commit:** No commit (verification only)

---

## Summary of All Changes

| # | File | Change |
|---|------|--------|
| 1 | `app/[locale]/dashboard/prices/helpers.ts` | Divide VND by 100, remove ₫ symbol |
| 2 | `messages/en/investment.json` | Add `buyUnit`, `sellUnit` to `prices.table` |
| 3 | `messages/vi/investment.json` | Add `buyUnit`, `sellUnit` to `prices.table` |
| 4 | `messages/en/ui.json` | Add `buyUnit`, `sellUnit` to `dashboard.home` |
| 5 | `messages/vi/ui.json` | Add `buyUnit`, `sellUnit` to `dashboard.home` |
| 6 | `messages/en/nav.json` | Add `buyUnit`, `sellUnit` to `landing.priceTeaser` |
| 7 | `messages/vi/nav.json` | Add `buyUnit`, `sellUnit` to `landing.priceTeaser` |
| 8 | `app/[locale]/dashboard/home/GoldPriceTable.tsx` | Dividers + unit labels |
| 9 | `app/[locale]/dashboard/home/SilverPriceTable.tsx` | Dividers + unit labels |
| 10 | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` | Dividers + unit labels |
| 11 | `components/landing/LandingGoldPriceTable.tsx` | Dividers + unit labels |
| 12 | `components/landing/LandingSilverPriceTable.tsx` | Dividers + unit labels + fix !p-0 |
| 13 | `components/landing/LandingCurrencyPriceTable.tsx` | Dividers + unit labels |
| 14 | `app/[locale]/dashboard/prices/page.tsx` | Unit labels on TanStack/Mobile headers |

**Total: 14 files, 6 tasks**
