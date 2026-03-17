# Gold Mace (Chỉ) Unit Conversion Specification

## Summary

Change the VND gold investment unit from tael (lượng, 37.5g) to mace (chỉ, 3.75g) across the entire system. This affects display, input, price formatting, and backend calculations for all VND gold investments (Type 8: `INVESTMENT_TYPE_GOLD_VND`). Internal storage remains in grams × 10000 — no database migration needed. The market prices page (`/dashboard/prices`) retains per-lượng display since it reflects raw market data.

## User Stories

- As a user, I want to see my gold holdings displayed in chỉ (mace) so that quantities match common Vietnamese gold trading units.
- As a user, I want to enter gold purchases in chỉ so the input feels natural.
- As a user, I want gold prices in my portfolio shown per chỉ so I can quickly assess value.

## Functional Requirements

### FR-1: Replace tael with mace as the VND gold unit

**Description:** All references to `tael` / `lượng` for VND gold are replaced with `mace` / `chỉ`. The internal identifier is `"mace"`. The display label is `"chỉ"` (Vietnamese) / `"Mace"` (English).

**Acceptance criteria:**
- [ ] `GoldUnit` type includes `'mace'` instead of `'tael'` (both frontend and backend)
- [ ] `GRAMS_PER_MACE = 3.75` replaces `GRAMS_PER_TAEL = 37.5`
- [ ] All 21 VND gold type options use `unit: "mace"` instead of `unit: "tael"`
- [ ] Unit conversion functions handle `'mace'` ↔ `'gram'` ↔ `'oz'`
- [ ] `getGoldUnitLabel('mace')` returns `'chỉ'` (vi) / `'mace'` (en)
- [ ] Default gold quantity unit for new VND gold investments is `'mace'`
- [ ] USD gold (Type 9) is completely unaffected — remains in ounces

### FR-2: Update quantity display

**Description:** All gold quantity displays convert from grams to mace instead of taels.

**Acceptance criteria:**
- [ ] Portfolio page shows gold quantities in chỉ (e.g., `20.0000 chỉ` instead of `2.0000 lượng`)
- [ ] Investment detail modal shows quantities in chỉ
- [ ] Transaction history shows quantities in chỉ
- [ ] `formatGoldQuantity(750000, GOLD_VND)` returns `"20.0000 chỉ"` (75g ÷ 3.75 = 20 chỉ)

### FR-3: Update price display in portfolio/investment pages

**Description:** Gold prices in portfolio and investment pages display per chỉ instead of per lượng.

**Acceptance criteria:**
- [ ] Portfolio page shows prices as `₫8,500,000/chỉ` (was `₫85,000,000/lượng`)
- [ ] Investment detail shows average cost per chỉ
- [ ] Price conversion: `per-gram price × 3.75 = per-chỉ price` (was `× 37.5`)
- [ ] PNL calculations unchanged (storage-based, unit-agnostic)

### FR-4: Update input forms

**Description:** Gold investment creation/transaction forms default to mace input.

**Acceptance criteria:**
- [ ] AddInvestmentForm defaults `goldQuantityUnit` to `'mace'`
- [ ] Quantity input shows `chỉ` as the unit suffix
- [ ] Price input shows `per chỉ` labeling
- [ ] Gold type selector options display mace-based descriptions
- [ ] Form calculations use `GRAMS_PER_MACE` for conversions

### FR-5: Market prices page unchanged

**Description:** The market prices page (`/dashboard/prices`) continues to show raw market data per lượng as received from vang.today API.

**Acceptance criteria:**
- [ ] Gold price table on prices page still shows per lượng
- [ ] No conversion applied to market prices page data
- [ ] Only portfolio/investment pages use chỉ

### FR-6: Backend unit system update

**Description:** Backend gold package replaces tael with mace.

**Acceptance criteria:**
- [ ] `UnitMace = "mace"` replaces `UnitTael = "tael"` in `pkg/gold/types.go`
- [ ] `GramsPerMace = 3.75` replaces `GramsPerTael = 37.5`
- [ ] All VND gold types in registry use `UnitMace` and `UnitWeight: GramsPerMace`
- [ ] `ConvertQuantity()` handles `'mace'` conversions
- [ ] `ConvertPricePerUnit()` handles `'mace'` conversions
- [ ] `GetPriceUnitForMarketData()` returns `UnitMace` for GOLD_VND
- [ ] `ProcessMarketPrice()` converts per-tael API prices to per-gram correctly (÷ 37.5, unchanged since storage is gram-based)
- [ ] `CalculateDisplayQuantity()` returns mace for VND gold

## Non-Functional Requirements

- **Performance**: No impact — same number of calculations, just different constants
- **Security**: No new attack surface — this is a display/calculation change only
- **Backwards compatibility**: Existing stored data works without migration (gram-based storage is unit-agnostic)
- **Accuracy**: `GRAMS_PER_MACE = 3.75` must be exact (1 tael = 10 mace = 37.5g, so 1 mace = 3.75g)

## Architecture Changes (C4)

### Diagrams to Update

- **`docs/architecture/c4-code-investment.md`**: Update any references to tael in the Investment domain class diagram (line ~215)

### New Diagrams

None needed — this is a unit constant change, not an architectural change.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`docs/architecture/flow-investment.md`**: Update references from tael to mace in:
  - Gold buy/sell flow descriptions (~line 98, 349, 386)
  - Unit conversion examples

### New Flow Diagrams

None needed — no new business logic flows.

## Data Model Changes

**None.** Storage format (grams × 10000) is unchanged. The `purchaseUnit` field for new records will store `"mace"` instead of `"tael"`. Existing records with `"tael"` are ignored since we always display in mace for VND gold.

## API Changes

**None.** The API accepts and returns quantities in the existing int64 storage format. The `purchaseUnit` field value changes from `"tael"` to `"mace"` for new records, but this is a string value — no proto schema changes needed.

## UI/UX Changes

### Affected Pages

| Page | Change |
|------|--------|
| Portfolio (`/dashboard/portfolio`) | Quantity display: `20.0000 chỉ` instead of `2.0000 lượng`. Price display: `₫8,500,000/chỉ` instead of `₫85,000,000/lượng` |
| Investment Detail Modal | Same quantity and price changes |
| Add Investment Form | Default unit `mace`, labels show `chỉ` |
| Add Transaction Form (in modal) | Quantity input in `chỉ` |
| Market Prices (`/dashboard/prices`) | **No change** — keeps per lượng |

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Gold calculator | gold-calculator.ts | `features/investment/utils/` — **MODIFY** |
| Portfolio helpers | helpers.tsx | `app/[locale]/dashboard/portfolio/` — **MODIFY** |
| Add investment form | AddInvestmentForm.tsx | `features/investment/forms/` — **MODIFY** |
| i18n labels | investment.json | `messages/vi/`, `messages/en/` — **MODIFY** |

### New Components

None — all changes are to existing files.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User | Gold quantity (mace) | No (client-side) | Gold calculator | Input validation unchanged |
| 2 | Gold calculator | Stored quantity (grams × 10000) | Yes: Client → Server | Backend API | Same format as before |
| 3 | Backend | Stored quantity | No (server-side) | Database | No schema change |
| 4 | vang.today API | Price per tael | Yes: External → Server | Gold price service | Conversion to per-gram unchanged |
| 5 | Backend | Quantity + price | Yes: Server → Client | Portfolio display | Display converts grams to mace |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Client → Server | Gold quantity (int64) | Server-side validation (unchanged) |
| External API → Server | Market prices | Rate limiting, caching (unchanged) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2 | Client → Server | Tampering | User sends manipulated quantity | Low | Server validates int64 range — unchanged |
| T-2 | 4 | External → Server | Spoofing | Fake market prices | Low | Existing caching + validation — unchanged |

**Risk level: Very Low** — This feature changes display constants, not security boundaries. No new inputs, no new API endpoints, no new authorization requirements.

### Authorization Rules

No changes — existing user-owns-investment checks remain.

### Input Validation Rules

No new validation needed. The quantity input is already validated as a positive number. The unit string `"mace"` is validated against the allowed set.

### External Dependency Risks

No new dependencies. vang.today API integration unchanged.

### Sensitive Data Handling

No change — monetary values continue using int64 storage.

### Issues & Risks Summary

1. **Risk: Existing "tael" purchaseUnit in DB** — Mitigated: display always uses mace for VND gold regardless of stored purchaseUnit value
2. **Risk: Market price conversion accuracy** — The per-gram storage price is unchanged; only the display multiplier changes (×3.75 instead of ×37.5). No precision loss.
3. **Risk: Frontend-backend constant mismatch** — Both must use 3.75 exactly. Covered by existing test suites.

## Edge Cases & Error Handling

1. **Existing investments with `purchaseUnit: "tael"`** — Display ignores `purchaseUnit` for VND gold and always shows mace
2. **Unit selector in forms** — If user somehow selects "tael" (shouldn't be possible after change), the calculator should still work since gram-based storage is unit-agnostic
3. **Large quantities** — 100 lượng = 1000 chỉ = 3750g. All within int64 range (3750 × 10000 = 37,500,000). No overflow risk.
4. **Fractional mace** — 0.5 chỉ = 1.875g. Stored as 18,750 (1.875 × 10000). 4 decimal precision sufficient.

## Dependencies & Assumptions

- vang.today API continues providing prices per tael — backend converts to per-gram for storage (unchanged)
- 1 mace (chỉ) = 3.75 grams exactly (standard Vietnamese gold measurement)
- 1 tael (lượng) = 10 mace (chỉ) = 37.5 grams

## Out of Scope

- Database migration of existing `purchaseUnit` values
- Changes to USD gold (Type 9) — remains in ounces
- Changes to silver investments — remains in current units
- Changes to market prices page — keeps per lượng display
- Adding user-selectable unit preference (always mace for VND gold)
