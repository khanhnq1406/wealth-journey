# Investment Form Enhancements — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Enhance AddInvestmentForm with reordered types (merged gold/silver + CASH/FOREIGN_CURRENCY), optional purchase date, aligned gold/silver labels, and price-per-unit with auto-fetch.
**Spec:** `docs/specs/2026-03-16-investment-form-enhancements-spec.md`
**Architecture:** Changes span 3 layers: (1) proto: add CASH/FOREIGN_CURRENCY enums + purchase_date field; (2) backend: use purchase_date for initial transaction date; (3) frontend: reorder type dropdown, merge gold/silver brands, add date field, replace total cost with price-per-unit + auto-fetch.
**Tech Stack:** Go 1.23 (Gin, GORM), Next.js 15 (React 19, TypeScript), Protocol Buffers, Tailwind CSS

## Security Implementation Notes

- **Authentication:** No changes — JWT middleware on all endpoints
- **Authorization:** No changes — user ownership checks remain in investment service
- **Input validation:** Backend validates `purchase_date` (0 or positive Unix timestamp ≤ now), new type enum values (12, 13) accepted by proto deserialization. Frontend uses `max={today}` on date input.
- **Data sanitization:** No new user-generated text fields. Existing symbol/name validation unchanged.
- **Financial integrity:** `totalCost = quantity × pricePerUnit` calculated on frontend, sent as `initialCostDecimal`. Backend's existing `initialCostDecimal → int64` conversion handles monetary precision.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-frontend.md` — Update AddInvestmentForm description to reflect merged gold/silver type grouping, purchase date field, and price-per-unit UX

## Runtime Flow Diagram Updates

- Update `docs/architecture/flow-investment.md` — Minor update to "Create Investment" flow: add optional `purchase_date` parameter that sets initial transaction date

---

### Task 1: Proto — Add CASH/FOREIGN_CURRENCY enums and purchase_date field

**Files:**
- Modify: `api/protobuf/v1/investment.proto`

**Security notes:** New enum values are additive — old clients see them as UNRECOGNIZED (safe). `purchase_date` validated server-side.

**Step 1: Add new enum values and purchase_date field**

In `investment.proto`, add to `InvestmentType` enum after `SILVER_USD = 11`:
```protobuf
INVESTMENT_TYPE_CASH = 12;              // Cash/savings tracking
INVESTMENT_TYPE_FOREIGN_CURRENCY = 13;  // Foreign currency holdings
```

In `CreateInvestmentRequest`, add field (field numbers 11 and 12 are available):
```protobuf
int64 purchase_date = 11 [json_name = "purchaseDate"];  // Optional: Unix timestamp (0 = not set, use current time)
```

**Step 2: Generate code**
```bash
task proto:all
```

**Step 3: Verify generated TypeScript types include new enum values**

Check `src/wj-client/gen/protobuf/v1/investment.ts` for `INVESTMENT_TYPE_CASH = 12` and `INVESTMENT_TYPE_FOREIGN_CURRENCY = 13`.

**Step 4: Verify Go backend compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 5: Commit**
```
feat(proto): add CASH, FOREIGN_CURRENCY investment types and purchase_date field
```

---

### Task 2: Backend — Use purchase_date for initial transaction and lot

**Files:**
- Modify: `src/go-backend/domain/service/investment_service.go` (lines 205-231)

**Security notes:** Validate `purchase_date`: if > 0, must be ≤ current time. Reject future dates.

**Step 1: Add purchase_date validation and usage in CreateInvestment**

In `investment_service.go`, after the wallet ownership check (line ~153), add purchase_date validation:
```go
// Validate purchase_date if provided
if req.PurchaseDate > 0 {
    purchaseTime := time.Unix(req.PurchaseDate, 0)
    if purchaseTime.After(time.Now()) {
        return nil, apperrors.NewValidationError("purchase date cannot be in the future")
    }
}
```

Then update lines 214 and 231 to use purchase_date:
```go
// Determine transaction date
txDate := time.Now()
if req.PurchaseDate > 0 {
    txDate = time.Unix(req.PurchaseDate, 0)
}

// In the transaction creation (line ~214):
TransactionDate: txDate,

// In the lot creation (line ~231):
PurchasedAt: txDate,
```

**Step 2: Verify Go compiles**
```bash
cd src/go-backend && go build ./...
```

**Step 3: Commit**
```
feat(backend): use purchase_date for initial investment transaction date
```

---

### Task 3: Frontend — Update i18n messages (en + vi)

**Files:**
- Modify: `src/wj-client/messages/en/investment.json`
- Modify: `src/wj-client/messages/vi/investment.json`

**Security notes:** None — display text only.

**Step 1: Add new i18n keys to both language files**

Add to `investment.form` section in English:
```json
"purchaseDate": "Purchase Date",
"purchaseDateHint": "Optional — defaults to today",
"pricePerUnitLabel": "Price per unit",
"refreshPrice": "Current price",
"refreshingPrice": "Loading...",
"totalCostSummary": "Total cost: {amount}",
"priceUnavailable": "Unable to fetch price"
```

Add to `investment.typeOptions` section in English:
```json
"gold": "Gold",
"silver": "Silver",
"cash": "Cash",
"foreignCurrency": "Foreign Currency"
```

Add to `investment.typeLabels` section in English:
```json
"cash": "Cash",
"foreignCurrency": "Foreign Currency"
```

Vietnamese equivalents:
```json
"purchaseDate": "Ngày mua",
"purchaseDateHint": "Tùy chọn — mặc định là hôm nay",
"pricePerUnitLabel": "Đơn giá",
"refreshPrice": "Giá hiện tại",
"refreshingPrice": "Đang tải...",
"totalCostSummary": "Tổng chi phí: {amount}",
"priceUnavailable": "Không thể lấy giá"
```

```json
"gold": "Vàng",
"silver": "Bạc",
"cash": "Tiền mặt",
"foreignCurrency": "Ngoại tệ"
```

```json
"cash": "Tiền mặt",
"foreignCurrency": "Ngoại tệ"
```

**Step 2: Commit**
```
feat(i18n): add investment form enhancement translations (en + vi)
```

---

### Task 4: Frontend — Update gold-calculator labels to match price table

**Files:**
- Modify: `src/wj-client/features/investment/utils/gold-calculator.ts` (lines 33-53)

**Security notes:** None — display label changes only.

**Step 1: Update GOLD_VND_OPTIONS labels to match GOLD_TABLE_FILTER displayNames**

Update these specific entries in `GOLD_VND_OPTIONS`:

| value | Current label | New label |
|-------|--------------|-----------|
| `"SJC"` | `"SJC 9999"` | `"SJC"` |
| `"Mi hồng"` | `"Mi Hồng Gold"` | `"SJC Mi Hồng"` |
| `"BTMC"` | `"Bảo Tín SJC"` | `"SJC BTMC"` |
| `"Doji_24K"` | `"DOJI 24K"` | `"Nhẫn Doji 9999"` |
| `"BTMC_24K"` | `"Bảo Tín 24K"` | `"Nhẫn BTMC"` |
| `"Mihong_999"` | `"Mi Hồng 999"` | `"Nhẫn Mi Hồng 9999"` |

Also add the missing "Vàng nhẫn SJC" type that exists in the price table but not in the form:
```typescript
{ value: "Vàng nhẫn SJC", label: "Nhẫn SJC 9999", unit: "tael" as GoldUnit, currency: "VND", unitWeight: GRAMS_PER_TAEL, type: 8 },
```

This makes GOLD_VND_OPTIONS 18 items (was 17) + 1 USD = 19 total.

**Step 2: Commit**
```
feat(gold): align gold type dropdown labels with price table display names
```

---

### Task 5: Frontend — Update investment-schema for new types

**Files:**
- Modify: `src/wj-client/features/investment/utils/investment-schema.ts`

**Security notes:** Schema validation is frontend-only (defense in depth). Backend validates independently.

**Step 1: Add CASH and FOREIGN_CURRENCY to allowed types in schema**

The current schema uses `z.nativeEnum(InvestmentType)` which automatically includes new enum values after proto generation. No code change needed for type validation.

However, update `GOLD_SILVER_TYPES` set comment to clarify it's for gold/silver-specific symbol validation bypass:
```typescript
// Gold/silver/cash/foreign currency types allow any symbol format
const FLEXIBLE_SYMBOL_TYPES = new Set<InvestmentType>([
  InvestmentType.INVESTMENT_TYPE_GOLD_VND,
  InvestmentType.INVESTMENT_TYPE_GOLD_USD,
  InvestmentType.INVESTMENT_TYPE_SILVER_VND,
  InvestmentType.INVESTMENT_TYPE_SILVER_USD,
  InvestmentType.INVESTMENT_TYPE_CASH,
  InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY,
]);
```

Update the refine function to use the new set name.

**Step 2: Commit**
```
feat(schema): allow flexible symbol format for CASH and FOREIGN_CURRENCY types
```

---

### Task 6: Frontend — Rewrite AddInvestmentForm with all enhancements

This is the main task. It implements all 4 FRs in one cohesive rewrite of the form.

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`

**Security notes:** `purchase_date` sent as Unix timestamp (seconds). Price auto-fill is from cached market data (read-only). User can override price (by design — actual purchase price may differ from market).

**Sub-step 6A: Reorder type dropdown (FR-1)**

Replace `investmentTypeOptions` (lines 70-82) with new 11-item list using merged gold/silver:

```typescript
const GOLD_UI_TYPE = "GOLD_MERGED";
const SILVER_UI_TYPE = "SILVER_MERGED";

const investmentTypeOptions = useMemo<SelectOption[]>(() => [
  { value: GOLD_UI_TYPE, label: t("typeOptions.gold") },
  { value: SILVER_UI_TYPE, label: t("typeOptions.silver") },
  { value: String(InvestmentType.INVESTMENT_TYPE_CASH), label: t("typeOptions.cash") },
  { value: String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY), label: t("typeOptions.foreignCurrency") },
  { value: String(InvestmentType.INVESTMENT_TYPE_STOCK), label: t("typeOptions.stock") },
  { value: String(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY), label: t("typeOptions.cryptocurrency") },
  { value: String(InvestmentType.INVESTMENT_TYPE_ETF), label: t("typeOptions.etf") },
  { value: String(InvestmentType.INVESTMENT_TYPE_BOND), label: t("typeOptions.bond") },
  { value: String(InvestmentType.INVESTMENT_TYPE_COMMODITY), label: t("typeOptions.commodity") },
  { value: String(InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND), label: t("typeOptions.mutualFund") },
  { value: String(InvestmentType.INVESTMENT_TYPE_OTHER), label: t("typeOptions.other") },
], [t]);
```

The type dropdown now uses `GOLD_MERGED` / `SILVER_MERGED` as UI-only values. The actual proto `type` field is NOT set from this dropdown for gold/silver — it's determined from brand selection.

**Key state changes:**
- Add `selectedUIType` state (string) to track the main dropdown selection
- Remove direct use of `investmentType` for gold/silver detection in the dropdown
- `isGoldInvestment` = `selectedUIType === GOLD_UI_TYPE`
- `isSilverInvestment` = `selectedUIType === SILVER_UI_TYPE`
- `isCashOrForeignCurrency` = type is CASH or FOREIGN_CURRENCY

**When user selects "Vàng":**
1. Brand dropdown shows ALL gold types (18 VND + 1 USD = 19 items)
2. When brand is selected, `setValue("type", brand.type)` sets the actual proto type (GOLD_VND=8 or GOLD_USD=9)
3. Currency auto-set from brand

**When user selects "Bạc":**
1. Brand dropdown shows ALL silver types (10 VND + 1 USD = 11 items)
2. When brand is selected, actual proto type auto-determined

**When user selects "Tiền mặt" or "Ngoại tệ":**
1. Behave like custom investments (manual symbol/name/currency)
2. `isCustomInvestment` auto-set to true

**Gold/silver type options update:**
- `goldTypeOptions` now shows ALL gold options (no currency filter):
```typescript
const goldTypeOptions = useMemo(() => {
  if (!isGoldInvestment) return [];
  return getGoldTypeOptions(); // No currency filter — show all 19
}, [isGoldInvestment]);
```

- Same for silver: show all 11 options

**Sub-step 6B: Add purchase date field (FR-2)**

Add state and date input between quantity and price:
```typescript
const [purchaseDate, setPurchaseDate] = useState<string>(
  new Date().toISOString().split("T")[0] // Today in YYYY-MM-DD
);
```

Render:
```tsx
<div>
  <Label htmlFor="purchaseDate">{t("form.purchaseDate")}</Label>
  <input
    type="date"
    id="purchaseDate"
    value={purchaseDate}
    onChange={(e) => setPurchaseDate(e.target.value)}
    max={new Date().toISOString().split("T")[0]}
    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-bg focus:border-bg text-sm"
    disabled={isSubmitting}
  />
  <p className="text-xs text-gray-500 mt-1 ml-1">{t("form.purchaseDateHint")}</p>
</div>
```

In `onSubmit`, convert to Unix timestamp:
```typescript
const purchaseDateTs = purchaseDate
  ? Math.floor(new Date(purchaseDate).getTime() / 1000)
  : 0;
```

Add `purchaseDate: purchaseDateTs` to all `createInvestmentMutation.mutate()` calls.

**Sub-step 6C: Replace Total Cost with Price Per Unit + Auto-Fetch (FR-4)**

Replace the "Total Initial Cost" section (lines 799-832) with:

1. **Price per unit input** with label "Đơn giá ({unit})"
2. **"Giá hiện tại" refresh button** next to the price input
3. **Read-only total cost summary** below: "Tổng chi phí: {formatted}"

State changes:
- Replace `initialCost` form field with `pricePerUnit` (but keep `initialCost` in the schema as computed)
- Add `pricePerUnit` state for the actual price input
- Total cost = `quantity × pricePerUnit`, computed in real-time
- On submit: `initialCostDecimal = quantity × pricePerUnit`

**Auto-fill behavior:**
- For gold/silver: When brand is selected and `goldPriceQuery.data` is available, auto-fill `pricePerUnit` from market price
- For stocks/crypto/ETF: When `MarketPriceDisplay` gets data, extract price and auto-fill
- User can always manually override

**Refresh button:**
```tsx
<button
  type="button"
  onClick={() => {
    // Refetch the appropriate price query
    if (isGoldInvestment) goldPriceQuery.refetch();
    else if (isSilverInvestment) silverPriceQuery.refetch();
    // For symbols, the MarketPriceDisplay handles its own refresh
  }}
  disabled={isRefreshing}
  className="px-3 py-2 text-sm font-medium text-bg bg-green-50 border border-bg rounded-md hover:bg-green-100 disabled:opacity-50 flex items-center gap-1"
>
  {isRefreshing ? t("form.refreshingPrice") : t("form.refreshPrice")}
</button>
```

**Total cost summary:**
```tsx
{quantity > 0 && pricePerUnit > 0 && (
  <p className="text-sm font-medium text-gray-700 mt-2">
    {t("form.totalCostSummary", {
      amount: formatCurrency(quantity * pricePerUnit, currency)
    })}
  </p>
)}
```

**Sub-step 6D: Update onSubmit for all cases**

All three submit paths (gold, silver, standard) need to:
1. Calculate `totalCost = quantity × pricePerUnit` (instead of using `initialCost` directly)
2. Include `purchaseDate: purchaseDateTs`
3. For gold/silver, the price-per-unit approach changes the calculation:
   - Current: `pricePerUnit: data.initialCost / data.initialQuantity` (line 330)
   - New: use the actual `pricePerUnit` state directly

For gold:
```typescript
const goldCalculation = calculateGoldFromUserInput({
  quantity: data.initialQuantity,
  quantityUnit: goldQuantityUnit,
  pricePerUnit: pricePerUnit,  // Direct from state
  priceCurrency: formData.currency,
  priceUnit: goldQuantityUnit,
  investmentType: formData.type,
  walletCurrency: formData.currency,
  fxRate: 1,
});

createInvestmentMutation.mutate({
  walletId: 0,
  symbol: selectedGoldType.value,
  name: selectedGoldType.label,
  type: formData.type,
  initialQuantityDecimal: goldCalculation.storedQuantity / 10000,
  initialCostDecimal: data.initialQuantity * pricePerUnit,  // quantity × price
  currency: formData.currency,
  purchaseUnit: goldQuantityUnit,
  purchaseDate: purchaseDateTs,
  initialQuantity: 0,
  initialCost: 0,
  isCustom: false,
});
```

Similar pattern for silver and standard investments.

**Sub-step 6E: Handle CASH/FOREIGN_CURRENCY types**

When `selectedUIType` is CASH or FOREIGN_CURRENCY:
- Auto-enable custom investment mode (show symbol/name/currency inputs)
- No SymbolAutocomplete — use manual input
- No market price auto-fetch
- Behave exactly like `isCustomInvestment = true` + `type = OTHER`

**Step 2: Commit**
```
feat(investment-form): reorder types, add purchase date, price-per-unit with auto-fetch
```

---

### Task 7: Frontend — Update portfolio page type labels for new types

**Files:**
- Modify: `src/wj-client/app/dashboard/portfolio/page.tsx` or helpers (check for type label mapping)

**Security notes:** None — display only.

**Step 1: Add CASH and FOREIGN_CURRENCY to type label maps**

Search for any type label mapping that uses the `InvestmentType` enum and add entries for:
- `INVESTMENT_TYPE_CASH` → "Cash" / "Tiền mặt"
- `INVESTMENT_TYPE_FOREIGN_CURRENCY` → "Foreign Currency" / "Ngoại tệ"

Also update the type filter dropdown if it exists on the portfolio page.

**Step 2: Commit**
```
feat(portfolio): add CASH and FOREIGN_CURRENCY type labels and filters
```

---

### Task 8: Update Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`
- Modify: `docs/architecture/flow-investment.md`

**Step 1: Update C4 frontend component diagram**

Update the AddInvestmentForm component description to mention:
- Merged gold/silver type selection with brand auto-detection
- Optional purchase date field
- Price-per-unit input with market price auto-fetch

**Step 2: Update flow-investment.md**

Add `purchase_date` parameter to the "Create Investment" sequence diagram. Show the branching:
- If `purchase_date > 0`: use as transaction date
- Else: use `time.Now()`

**Step 3: Commit**
```
docs: update C4 frontend and investment flow diagrams for form enhancements
```

---

## Task Dependency Graph

```
Task 1 (Proto) ──→ Task 2 (Backend)
     │
     └──→ Task 3 (i18n)     ──┐
     │                         │
     └──→ Task 4 (Gold labels) ├──→ Task 6 (Main form rewrite)──→ Task 7 (Portfolio labels)
     │                         │
     └──→ Task 5 (Schema)    ──┘
                                                                      ↓
                                                              Task 8 (Docs)
```

**Parallel groups:**
- Tasks 3, 4, 5 can run in parallel (after Task 1)
- Task 6 depends on Tasks 1, 3, 4, 5
- Task 7 depends on Task 1 (new enum values generated)
- Task 8 runs last (after all implementation)

## Estimated Task Summary

| # | Task | Files Changed | Complexity |
|---|------|---------------|------------|
| 1 | Proto: enums + purchase_date | 1 proto file + generated | Low |
| 2 | Backend: purchase_date usage | 1 Go file | Low |
| 3 | i18n: new translations | 2 JSON files | Low |
| 4 | Gold labels alignment | 1 TS file | Low |
| 5 | Schema: flexible symbol types | 1 TS file | Low |
| 6 | Main form rewrite | 1 TSX file (major) | High |
| 7 | Portfolio type labels | 1-2 TSX files | Low |
| 8 | Architecture docs | 2 MD files | Low |
