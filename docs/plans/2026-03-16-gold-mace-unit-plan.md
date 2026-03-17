# Gold Mace (Chỉ) Unit Conversion — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace tael (lượng, 37.5g) with mace (chỉ, 3.75g) as the display unit for VND gold across the entire system.
**Spec:** `docs/specs/2026-03-16-gold-mace-unit-spec.md`
**Architecture:** Display/calculation-only change. Internal storage remains grams × 10000. No DB migration, no API schema changes, no new endpoints. Backend `pkg/gold/` constants + converter updated; frontend gold-calculator + portfolio helpers + forms updated; architecture docs updated.
**Tech Stack:** Go 1.23 (backend gold package), TypeScript/React (frontend), Protobuf comments

## Security Implementation Notes

- **No new attack surface** — this is a constant/display change only
- **No new inputs, endpoints, or authorization changes**
- **Monetary integrity preserved** — storage format unchanged (grams × 10000), only display multiplier changes (×3.75 instead of ×37.5)
- **Server-side validation unchanged** — quantity remains int64, unit string validated against allowed set

## Scope

**Changes required across 3 layers:**

| Layer | Files | Nature |
|-------|-------|--------|
| Backend `pkg/gold/` | types.go, converter.go, converter_test.go, types_test.go | Replace UnitTael→UnitMace, GramsPerTael→GramsPerMace, update registry |
| Backend handlers/services | handlers/investment.go, service/market_data_service.go, database/database.go, integration test | Update display unit + comments |
| Frontend core | gold-calculator.ts, gold-calculator.test.ts | Replace GRAMS_PER_TAEL→GRAMS_PER_MACE, GoldUnit type, options, labels |
| Frontend display | portfolio/helpers.tsx | Change multiplier 37.5→3.75, unit labels |
| Frontend forms | AddInvestmentForm.tsx, AddInvestmentTransactionForm.tsx | Default unit "mace", placeholders |
| Frontend i18n | en/investment.json, vi/investment.json, en/nav.json, vi/nav.json | Update labels |
| Architecture docs | c4-code-investment.md, flow-investment.md | Update tael→mace references |
| Proto comments | investment.proto | Update comment strings (no schema change) |

**Out of scope:** Silver (keeps tael), USD gold (keeps ounce), market prices page (keeps lượng display), DB migration.

---

### Task 0: Update C4 Architecture Diagrams & Flow Diagrams

**Files:**
- Modify: `docs/architecture/c4-code-investment.md` (line ~215, ~225)
- Modify: `docs/architecture/flow-investment.md` (lines ~98, ~349, ~386)

**Security notes:** Documentation-only. No code impact.

**Step 1: Update c4-code-investment.md**
- Line 215: Change `per tael (convert)` → `per mace (convert)` in GOLD_VND row
- Line 225: Change `from per-tael to per-gram` → `from per-lượng to per-gram` (this describes the raw API→storage conversion, which is still per lượng from vang.today)

**Step 2: Update flow-investment.md**
- Line 98: Change `75g (2 taels) = 750,000` → `75g (20 chỉ) = 750,000`
- Line 349: Change `Price per tael →` → `Price per lượng →` (describes raw API data, still per lượng)
- Line 386: Change `tael-to-gram normalization` → `lượng-to-gram normalization` (describes raw API data)

**Step 3: Commit**

---

### Task 1: Backend — Replace tael with mace in `pkg/gold/types.go`

**Files:**
- Modify: `src/go-backend/pkg/gold/types.go`
- Test: `src/go-backend/pkg/gold/types_test.go`

**Security notes:** Constant-only change. No security impact.

**Step 1: Update constants**
```go
// Replace:
const GramsPerTael = 37.5       // → GramsPerMace = 3.75
const UnitTael GoldUnit = "tael" // → UnitMace GoldUnit = "mace"

// Add comment for clarity:
// GramsPerMace is the conversion factor for Vietnamese mace (chỉ) to grams
// 1 mace (chỉ) = 3.75 grams (1 tael/lượng = 10 mace = 37.5g)
const GramsPerMace = 3.75
```

**Step 2: Update all 19 VND gold type registry entries**
Change every VND gold type from:
```go
Unit: UnitTael, UnitWeight: GramsPerTael
```
to:
```go
Unit: UnitMace, UnitWeight: GramsPerMace
```

**Step 3: Update `GetPriceUnitForMarketData()`**
Change return value for GOLD_VND from `UnitTael` → `UnitMace`

**Step 4: Run tests and verify**
```bash
cd src/go-backend && go test ./pkg/gold/...
```
Tests will fail — expected. Fix in Task 2.

**Step 5: Commit**

---

### Task 2: Backend — Update `pkg/gold/converter.go` and tests

**Files:**
- Modify: `src/go-backend/pkg/gold/converter.go`
- Modify: `src/go-backend/pkg/gold/converter_test.go`
- Modify: `src/go-backend/pkg/gold/types_test.go`

**Security notes:** Conversion logic change. Must preserve storage-level accuracy.

**Step 1: Update ConvertQuantity()**
Replace all `case UnitTael:` with `case UnitMace:` and replace `GramsPerTael` with `GramsPerMace`:
```go
case UnitMace:
    inGrams = quantity * GramsPerMace  // was GramsPerTael
// ...
case UnitMace:
    return inGrams / GramsPerMace  // was GramsPerTael
```

**Step 2: Update ConvertPricePerUnit()**
Same pattern — replace all `UnitTael` → `UnitMace`, `GramsPerTael` → `GramsPerMace`.

**Step 3: Update CalculateDisplayQuantity()**
Change VND gold display unit from `UnitTael` → `UnitMace`:
```go
case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
    displayUnit = UnitMace  // was UnitTael
```

**Step 4: Update ProcessMarketPrice()**
`GetPriceUnitForMarketData()` now returns `UnitMace` for VND gold. But the market API returns prices per lượng (= 10 mace). The storage conversion must still divide by 37.5 grams per lượng to get per-gram price.

**Critical:** `ProcessMarketPrice` uses `GetPriceUnitForMarketData()` to determine the market unit, then calls `ConvertPricePerUnit()` to convert to per-gram. If we change `GetPriceUnitForMarketData()` to return `UnitMace`, then `ConvertPricePerUnit(price, UnitMace, UnitGram)` would divide by 3.75 instead of 37.5 — this would be **wrong** because the API price is per lượng (37.5g), not per chỉ (3.75g).

**Resolution:** `GetPriceUnitForMarketData()` describes what unit the **market API** returns prices in. The vang.today API returns prices per lượng. We should NOT change this function — or we need a separate concept.

**Approach:** Keep `GetPriceUnitForMarketData()` returning a unit that accurately represents the market data. Since the market prices are per lượng (not per mace), we have two options:

**Option A (Recommended):** Add a new constant `UnitLuong` (or keep `UnitTael` as an internal-only alias for the market price unit) and distinguish between "display unit" (mace) and "market price unit" (lượng). This is the safest approach.

**Actually, re-reading the spec more carefully:**

> **FR-5**: Market prices page unchanged — keeps per lượng display
> **FR-6**: `GetPriceUnitForMarketData()` returns `UnitMace` for GOLD_VND

The spec says `GetPriceUnitForMarketData()` should return `UnitMace`. But `ProcessMarketPrice()` uses this to know what unit the market price is in — and the API price is per lượng (10 mace), not per mace.

**The spec has a logical conflict here.** `ProcessMarketPrice()` needs to know the market API returns per-lượng prices. If `GetPriceUnitForMarketData()` returns `UnitMace`, the conversion will be wrong.

**Resolution:** We need to decouple:
1. **Market API unit** — what unit the API returns prices in (lượng = 37.5g) — used by `ProcessMarketPrice()`
2. **Display unit** — what unit to show to users (mace = 3.75g) — used by `CalculateDisplayQuantity()`

**Implementation:**
- Rename `GetPriceUnitForMarketData()` → keep returning a value that represents the lượng unit for correct market price conversion
- Add `GetDisplayUnit()` returning `UnitMace` for user-facing display
- `ProcessMarketPrice()` needs to continue dividing by 37.5 (per-lượng → per-gram)

**Simplest approach:** Keep `GramsPerTael = 37.5` as a **private** constant (unexported, `gramsPerLuong = 37.5`) used only inside `ProcessMarketPrice()` for the API-to-storage conversion. The public constant becomes `GramsPerMace = 3.75`. The `GetPriceUnitForMarketData()` function returns a new internal marker (or we hardcode the conversion factor in `ProcessMarketPrice()`).

**Final design:**
```go
const (
    GramsPerMace  = 3.75      // Public: 1 mace (chỉ) = 3.75g
    GramsPerOunce = 31.1034768

    // gramsPerLuong is used internally for market price normalization.
    // The vang.today API returns VND gold prices per lượng (= 10 mace = 37.5g).
    gramsPerLuong = 37.5
)

type GoldUnit string
const (
    UnitGram  GoldUnit = "gram"
    UnitMace  GoldUnit = "mace"
    UnitOunce GoldUnit = "oz"
)
```

For `ProcessMarketPrice()`, hardcode the lượng→gram conversion using the private constant:
```go
func (c *GoldConverter) ProcessMarketPrice(marketPrice int64, marketCurrency string, investmentType investmentv1.InvestmentType) int64 {
    // vang.today API returns VND gold prices per lượng (37.5g)
    // Convert to per-gram for storage
    if investmentType == investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND {
        priceFloat := float64(marketPrice)
        pricePerGram := priceFloat / gramsPerLuong
        return int64(math.Round(pricePerGram))
    }
    // USD gold: already per ounce, no conversion needed
    return marketPrice
}
```

And `GetPriceUnitForMarketData()` can return `UnitMace` since it's used for display context, or we remove it if it's only used by ProcessMarketPrice (check callers).

**Step 5: Update converter_test.go**
Update all test cases:
- Change `'tael'` → `'mace'` in unit parameters
- Change expected values: `convertQuantity(2, 'mace', 'gram')` → `7.5` (not 75)
- Change price test: `convertPricePerUnit(8500000, 'mace', 'gram')` → `2,266,667` (8.5M / 3.75)
- Update storage tests: `NormalizeQuantityForStorage(20, UnitMace, GOLD_VND)` → 750000 (20 × 3.75g × 10000)
- Update display tests: `DenormalizeQuantityForDisplay(750000, GOLD_VND, UnitMace)` → 20.0

**Step 6: Update types_test.go**
Verify gold type entries have `UnitMace` and `GramsPerMace`.

**Step 7: Run all gold package tests**
```bash
cd src/go-backend && go test -v ./pkg/gold/...
```

**Step 8: Commit**

---

### Task 3: Backend — Update handlers and services

**Files:**
- Modify: `src/go-backend/handlers/investment.go` (lines ~969, ~977, ~992-1005)
- Modify: `src/go-backend/domain/service/market_data_service.go` (comments only)
- Modify: `src/go-backend/pkg/database/database.go` (line ~228)
- Modify: `src/go-backend/domain/service/gold_investment_integration_test.go`

**Security notes:** `getDisplayUnitForType()` determines what unit string is sent to the client. Must return `"mace"` for GOLD_VND.

**Step 1: Update `getDisplayUnitForType()` in handlers/investment.go**
```go
case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
    return "mace"  // was "tael"
```

**Step 2: Update `convertPriceForDisplay()` in handlers/investment.go**
This function has a hardcoded `gramsPerTael = 37.5`. For GOLD_VND, it converts per-gram storage price to per-display-unit price. Since display unit is now mace (3.75g), the multiplier changes:
```go
const gramsPerMace = 3.75  // was gramsPerTael = 37.5
// ...
case investmentv1.InvestmentType_INVESTMENT_TYPE_GOLD_VND:
    return int64(float64(storagePrice) * gramsPerMace)  // was gramsPerTael
```
Update comments accordingly.

**Note:** Silver VND `"tael"` cases remain unchanged (silver stays on tael).

**Step 3: Update database.go backfill SQL**
```go
// Gold VND (type 8): default to mace display
SET purchase_unit = 'mace'  // was 'tael'
```
Note: This backfill is idempotent — it only affects records where purchase_unit IS NULL or 'gram'. Records already set to 'tael' will display correctly because the frontend always uses mace for VND gold regardless of stored purchaseUnit.

**Step 4: Update market_data_service.go comments**
Replace "per tael" → "per lượng" in comments (lines ~261, ~286). These describe the raw API data format.

**Step 5: Update integration test**
Update `gold_investment_integration_test.go`:
- Change test case names: "2 taels" → "20 mace"
- Change test data: `quantity: 20.0` (20 mace instead of 2 taels)
- Change `quantityUnit: "mace"` (was "tael")
- Change `pricePerUnit: 8500000` (8.5M VND per mace instead of 85M per tael)
- Change comments: "20 mace = 75 grams" (same storage)
- The hardcoded `grams := tc.quantity * 37.5` → `grams := tc.quantity * 3.75`

**Step 6: Build and test**
```bash
cd src/go-backend && go build ./... && go test -short ./...
```

**Step 7: Commit**

---

### Task 4: Update protobuf comments

**Files:**
- Modify: `api/protobuf/v1/investment.proto` (comments only, 4 locations)

**Security notes:** No schema change. Comments only.

**Step 1: Update proto comments**
- Line 36: `"tael"` → `"mace"` in purchaseUnit comment
- Line 176: `"tael"` → `"mace"` in unit comment
- Line 263: `"tael"` → `"mace"` in displayUnit comment
- Line 527: `"tael"` → `"mace"` in purchaseUnit comment

**Step 2: Regenerate code**
```bash
task proto:all
```
This updates `investment.pb.go` and `gen/protobuf/v1/investment.ts` with new comments.

**Step 3: Verify build**
```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Commit**

---

### Task 5: Frontend — Update gold-calculator.ts and tests

**Files:**
- Modify: `src/wj-client/features/investment/utils/gold-calculator.ts`
- Modify: `src/wj-client/features/investment/utils/gold-calculator.test.ts`

**Security notes:** Client-side calculation change. Server validates independently.

**Step 1: Update constants and types**
```typescript
// Replace:
export type GoldUnit = 'mace' | 'gram' | 'oz';  // was 'tael'
export const GRAMS_PER_MACE = 3.75;  // was GRAMS_PER_TAEL = 37.5
```

**Step 2: Update all VND gold options**
Change all 9 entries from `unit: "tael", unitWeight: GRAMS_PER_TAEL` → `unit: "mace", unitWeight: GRAMS_PER_MACE`.

**Step 3: Update conversion functions**
Replace all `case 'tael':` → `case 'mace':` and `GRAMS_PER_TAEL` → `GRAMS_PER_MACE`.

**Step 4: Update label functions**
```typescript
// getGoldUnitLabel:
case 'mace': return 'chỉ';  // was case 'tael': return 'lượng'

// getGoldUnitLabelFull:
case 'mace': return 'Mace (chỉ)';  // was case 'tael': return 'Tael (lượng)'
```

**Step 5: Update display functions**
```typescript
// formatGoldQuantityDisplay:
displayUnit = 'mace' as GoldUnit;  // was 'tael'

// getGoldMarketPriceUnit:
return 'mace' as GoldUnit;  // was 'tael'
```

**Step 6: Update test file**
All test cases need updating:
- Import `GRAMS_PER_MACE` instead of `GRAMS_PER_TAEL`
- Change all `'tael'` → `'mace'` in unit parameters
- Change expected values:
  - `convertGoldQuantity(20, 'mace', 'gram')` → `75` (20 × 3.75 = 75)
  - `convertGoldQuantity(75, 'gram', 'mace')` → `20` (75 / 3.75 = 20)
  - `convertGoldPricePerUnit(8500000, 'mace', 'gram')` → `2,266,667` (8.5M / 3.75)
  - Storage: `20 mace @ 8.5M/mace` → stored as 750000
  - Display: `750000 stored → 20 mace`
- Update `getGoldMarketPriceUnit(8)` → expects `'mace'`

**Step 7: Run tests**
```bash
cd src/wj-client && npx jest features/investment/utils/gold-calculator.test.ts
```

**Step 8: Commit**

---

### Task 6: Frontend — Update portfolio helpers.tsx

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/portfolio/helpers.tsx`

**Security notes:** Display-only change. No data mutation.

**Step 1: Update formatGoldPrice()**
Change hardcoded multiplier from `37.5` → `3.75`:
```typescript
// VND gold: price per gram × 3.75 = price per mace
priceForDisplay = price * 3.75;  // was * 37.5
// ...
// VND gold with backend currency conversion to USD
priceForDisplay = pricePerGramInDollars * 3.75;  // was * 37.5
```

**Step 2: Update unit type and default**
```typescript
let unit: 'mace' | 'oz' = 'mace';  // was 'tael' | 'oz' = 'tael'
```

**Step 3: Update getInvestmentUnitLabelFull()**
```typescript
case 'mace':
    return 'Mace (chỉ)';  // was case 'tael': return 'Tael (lượng)'
```

**Step 4: Update comments**
Update all comments referencing tael to mace/chỉ.

**Step 5: Commit**

---

### Task 7: Frontend — Update forms

**Files:**
- Modify: `src/wj-client/features/investment/forms/AddInvestmentForm.tsx`
- Modify: `src/wj-client/features/investment/forms/AddInvestmentTransactionForm.tsx`

**Security notes:** Form defaults change only. Server validates independently.

**Step 1: Update AddInvestmentForm.tsx**
```typescript
// Default gold unit state:
const [goldQuantityUnit, setGoldQuantityUnit] = useState<GoldUnit>("mace");  // was "tael"

// Placeholder conditionals:
goldQuantityUnit === "mace" ? "20" : "100"  // was "tael" ? "2.5" : "100"

// Unit label conditional:
unit === "mace" ? t("form.maceUnit") : ...  // was unit === "tael"
```

Note: Silver remains `"tael"` — no changes to silver state or conditionals.

**Step 2: Update AddInvestmentTransactionForm.tsx**
```typescript
// Default unit for gold VND:
? ("mace" as const)  // was "tael"

// Unit validation includes:
["mace", "kg", "gram", "oz"].includes(purchaseUnit)  // was "tael"

// Conditionals:
goldDisplayUnit === "mace"  // was "tael"
```

Note: Silver `"tael"` references remain unchanged.

**Step 3: Commit**

---

### Task 8: Frontend — Update i18n files

**Files:**
- Modify: `src/wj-client/messages/en/investment.json`
- Modify: `src/wj-client/messages/vi/investment.json`
- Modify: `src/wj-client/messages/en/nav.json`
- Modify: `src/wj-client/messages/vi/nav.json`

**Security notes:** String-only. No code impact.

**Step 1: Update en/investment.json**
```json
"taelUnit" → rename to "maceUnit": "Mace (chỉ)"
"taelUnitLong" → rename to "maceUnitLong": "mace (chỉ)"
```

**Step 2: Update vi/investment.json**
```json
"taelUnit" → rename to "maceUnit": "Chỉ"
"taelUnitLong" → rename to "maceUnitLong": "chỉ"
```

**Step 3: Update en/nav.json**
- Line 72: `"automatic tael/gram/ounce conversions"` → `"automatic mace/gram/ounce conversions"`
- Line 105: `"taelGramOunce": "Tael/Gram/Ounce"` → `"maceGramOunce": "Mace/Gram/Ounce"`
- Line 234: `"automatically converts between Vietnamese tael and international ounces"` → `"automatically converts between Vietnamese mace (chỉ) and international ounces"`

**Step 4: Update vi/nav.json**
- Line 72: `"chuyển đổi lượng/gram/ounce tự động"` → `"chuyển đổi chỉ/gram/ounce tự động"`
- Line 105: `"taelGramOunce": "Lượng/Gram/Ounce"` → `"maceGramOunce": "Chỉ/Gram/Ounce"`
- Line 234: `"tự động chuyển đổi giữa lượng vàng Việt Nam và ounce quốc tế"` → `"tự động chuyển đổi giữa chỉ vàng Việt Nam và ounce quốc tế"`

**Step 5: Update any i18n key references in components**
Search for `taelUnit`, `taelUnitLong`, `taelGramOunce` in TSX files and update to new keys.

**Step 6: Commit**

---

### Task 9: Frontend — Update LandingInvestmentFeatures.tsx

**Files:**
- Modify: `src/wj-client/components/landing/LandingInvestmentFeatures.tsx`

**Security notes:** UI text only.

**Step 1: Update i18n key reference**
Change `t("investmentFeatures.taelGramOunce")` → `t("investmentFeatures.maceGramOunce")` (or whatever the updated nav.json key name is).

**Step 2: Commit**

---

### Task 10: Verify full build and run all tests

**Files:** None (verification only)

**Step 1: Build backend**
```bash
cd src/go-backend && go build ./...
```

**Step 2: Run backend tests**
```bash
cd src/go-backend && go test -short ./...
```

**Step 3: Build frontend**
```bash
cd src/wj-client && npx tsc --noEmit
```

**Step 4: Run frontend tests**
```bash
cd src/wj-client && npx jest
```

**Step 5: Verify no remaining tael references in gold context**
```bash
# Should only find silver-related tael references and market prices page
grep -rn "tael" src/go-backend/pkg/gold/ || echo "Clean"
grep -rn "GRAMS_PER_TAEL" src/wj-client/ || echo "Clean"
grep -rn "'tael'" src/wj-client/features/investment/utils/gold-calculator.ts || echo "Clean"
```

**Step 6: Finalize progress file and write implementation report**

**Step 7: Commit**

---

## Task Dependency Graph

```
Task 0 (docs)        ← independent
Task 1 (backend types) ← first backend change
Task 2 (backend converter) ← depends on Task 1
Task 3 (backend handlers) ← depends on Task 1
Task 4 (proto comments) ← independent
Task 5 (frontend calculator) ← independent of backend
Task 6 (frontend helpers) ← depends on Task 5
Task 7 (frontend forms) ← depends on Task 5
Task 8 (frontend i18n) ← independent
Task 9 (frontend landing) ← depends on Task 8
Task 10 (verification) ← depends on all
```

**Parallel execution opportunities:**
- Tasks 0, 1, 4, 5, 8 can start in parallel
- Tasks 2, 3 after Task 1
- Tasks 6, 7 after Task 5
- Task 9 after Task 8
- Task 10 after all others

## Critical Design Decision: ProcessMarketPrice Handling

The vang.today API returns VND gold prices **per lượng** (37.5g). After this change, the display unit is **mace** (3.75g), but the API doesn't change. The `ProcessMarketPrice()` function must continue dividing by 37.5 to convert per-lượng API prices to per-gram storage prices.

**Solution:** Keep `gramsPerLuong = 37.5` as an unexported constant in `pkg/gold/types.go`, used exclusively by `ProcessMarketPrice()`. The public `GramsPerMace = 3.75` is used for all user-facing conversions. This cleanly separates "what the API gives us" from "what we show the user".
