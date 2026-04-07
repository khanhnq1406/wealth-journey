# Fix: Price Alert Cannot Use Home Page Prices — Specification

## Summary

The home page displays market prices (gold, silver) via `GoldPriceTable` and `SilverPriceTable`, but users have no way to create a price alert directly from those rows. When this is done through external means (e.g. a developer wiring up a pre-fill), the `CreatePriceAlertForm` further silently excludes items that lack `showInInvestment = true` — a filter designed for the investment portfolio feature, not price alerts. The fix has two parts: (1) remove the wrong `showInInvestment` filter from `CreatePriceAlertForm` and replace it with `enabled`, and (2) add a "Set Alert" bell icon to each row in `GoldPriceTable` and `SilverPriceTable` that opens the form pre-filled with the correct `typeCode` (not `displayName`).

## User Stories

- As a user, I want to tap a bell icon on a gold/silver price row to quickly create an alert for that price, so that I don't have to manually find and type the price code in the alerts settings page.
- As a user, I want the alert form dropdown to show all gold/silver prices that I can see on the home page, so that the two views are consistent.

## Functional Requirements

### FR-1: Fix `showInInvestment` filter in `CreatePriceAlertForm`

Replace `.filter((p) => p.showInInvestment)` with `.filter((p) => p.enabled)` for both `goldSelectOptions` and `silverSelectOptions` in `CreatePriceAlertForm.tsx` (lines 112–124).

**Why this is the bug:** `showInInvestment` was designed to control which price types appear in the investment portfolio add/edit form. It has no semantic relationship to price alerts. The home page shows all `enabled` prices; the alert form must match.

**Acceptance criteria:**
- [ ] `goldSelectOptions` includes all prices where `enabled === true`, regardless of `showInInvestment`
- [ ] `silverSelectOptions` includes all prices where `enabled === true`, regardless of `showInInvestment`
- [ ] Existing tests updated to cover `showInInvestment: false` items appearing in the dropdown
- [ ] No regression: disabled prices (`enabled: false`) still excluded

### FR-2: "Set Alert" bell button on `GoldPriceTable` rows

Add a small bell icon button as a fourth column on each gold price row. Clicking opens a `BaseModal` on the home page with `CreatePriceAlertForm` pre-filled:
- `defaultCategory="gold"`
- `defaultSymbol={item.typeCode}` — critical: `typeCode`, NOT `displayName`
- `defaultName={item.displayName}`
- `defaultAssetType={InvestmentType.INVESTMENT_TYPE_GOLD_VND}`
- `defaultCurrency="VND"`

**Acceptance criteria:**
- [ ] Bell icon column added to `GoldPriceTable`, visible to all authenticated users (not admin-only)
- [ ] Clicking the bell opens a modal with `CreatePriceAlertForm` pre-filled correctly
- [ ] `symbol` submitted to backend is `typeCode` (e.g. `"DOHCML"`), not `displayName` (e.g. `"Doji_24K"`)
- [ ] Stale rows: bell button still shows but form opens normally (stale state is display-only)
- [ ] Modal closes on success or dismiss

### FR-3: "Set Alert" bell button on `SilverPriceTable` rows

Same as FR-2 but for silver:
- `defaultCategory="silver"`
- `defaultAssetType={InvestmentType.INVESTMENT_TYPE_SILVER_VND}`
- `defaultCurrency="VND"`

**Acceptance criteria:**
- [ ] Bell icon column added to `SilverPriceTable`
- [ ] Same correctness checks as FR-2

### FR-4: No bell button on `CurrencyPriceTable`

Currency type codes (e.g. `"USD_VCB"`) are not supported as alert symbols — the backend alert service has no currency asset type validation path and would route them to Yahoo Finance market data, which won't find a match.

**Acceptance criteria:**
- [ ] `CurrencyPriceTable` is unchanged (no bell column added)

## Non-Functional Requirements

- **Performance:** The bell button triggers no new API calls on the home page — `CreatePriceAlertForm` already fetches its own display prices on mount.
- **Accessibility:** Bell button must have `aria-label="Set alert for {displayName}"`, minimum touch target `min-h-[44px] min-w-[44px]`.
- **Mobile-first:** Bell column width is minimal (`w-10`), consistent with the existing admin `InlinePriceEdit` column pattern in `SilverPriceTable` and `CurrencyPriceTable`.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md` (L3):** Add a note that `GoldPriceTable` and `SilverPriceTable` now interact with `CreatePriceAlertForm` via home page modal state. No new components — the arrow from `dashboard/home` to `features/price-alert` already exists conceptually.

### New Diagrams

None required — this is a UI interaction fix, not a new domain or data flow.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no new backend endpoints, no new multi-step business logic. The existing `CreatePriceAlert` flow in `flow-investment.md` (if documented) remains unchanged.

### New Flow Diagrams

None needed — simple UI open/submit pattern, no branching or multi-service coordination beyond what already exists.

## Data Model Changes

None. No backend changes required.

## API Changes

None. The existing `POST /api/v1/user-price-alerts` endpoint is unchanged. The fix is entirely frontend.

## UI/UX Changes

### `CreatePriceAlertForm.tsx`

- Lines 112–115: `goldSelectOptions` — change `.filter((p) => p.showInInvestment)` → `.filter((p) => p.enabled)`
- Lines 119–122: `silverSelectOptions` — same change

### `GoldPriceTable.tsx`

1. Accept optional `onSetAlert?: (item: AssetDisplayPrice) => void` prop
2. Add a `<th className="w-10" />` header column (matches `SilverPriceTable`/`CurrencyPriceTable` admin column pattern)
3. Add bell icon `<button>` cell per row, calls `onSetAlert(item)`
4. Bell button: `aria-label={`Set alert for ${item.displayName}`}`, `min-h-[44px] min-w-[44px]`

### `SilverPriceTable.tsx`

Same prop + column changes as `GoldPriceTable`.

### `home/page.tsx`

1. Add modal state: `alertPrefill: { item: AssetDisplayPrice; category: "gold" | "silver" } | null`
2. Render `<BaseModal>` for alert creation alongside existing modals
3. Pass `onSetAlert` to `GoldPriceTable` and `SilverPriceTable`

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Modal container | `BaseModal` | `components/modals/BaseModal.tsx` |
| Price alert form | `CreatePriceAlertForm` | `features/price-alert/forms/CreatePriceAlertForm.tsx` |
| Bell icon | `BellIcon` (or lucide-react `Bell`) | Check `components/icons/` first |
| Touch-target button | `<button>` with Tailwind | Inline |

### New Components

None — all required components already exist.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Home page price table (client) | `item.typeCode`, `item.displayName` | No — stays in browser | `CreatePriceAlertForm` props | Pre-fill only; not sent to backend yet |
| 2 | `CreatePriceAlertForm` (client) | `{ symbol: typeCode, name, assetType, ... }` | Yes — browser → backend REST API | `POST /api/v1/user-price-alerts` | Auth JWT required |
| 3 | Backend handler | Validated alert data | No | PostgreSQL | Server-side validation on symbol/typeCode |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | POST create alert | JWT auth + server-side symbol validation |
| Client DOM | Pre-fill data from API response | Data originates from the same `useQueryGetAssetDisplayPrices` call; no user-controlled input at pre-fill step |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1 | None (same origin) | Tampering | User manually edits form field after pre-fill to submit a `displayName` | Low | Backend already validates symbol against `asset_price.type_code`; error is user-visible |
| T-2 | 2 | Internet → App | Spoofing | Unauthenticated call to create alert | Medium | `AuthMiddleware` enforces JWT on all alert endpoints |
| T-3 | 2 | Internet → App | Tampering | Client sends `displayName` as symbol | Low | Backend `GetPriceByTypeCode` lookup fails → `VALIDATION_ERROR` returned, no DB write |

### Authorization Rules

- Authenticated users only — existing `AuthMiddleware` on alert endpoints is unchanged.
- No admin-only gate: the bell button is visible to all authenticated users (same as the alert settings page).

### Input Validation Rules

- `typeCode` is sourced from the API response (admin-configured) — not free-form user input at the pre-fill step.
- All form fields are validated by existing Zod schema + backend service before any DB write.
- No new validation rules needed.

### External Dependency Risks

None — this fix adds no new external dependencies.

### Sensitive Data Handling

Price type codes and display names are public market data. No PII involved.

### Issues & Risks Summary

1. **Wrong filter risk (primary bug):** `showInInvestment` filter silently drops prices visible on the home page — fixed by FR-1.
2. **Pre-fill symbol correctness:** If `typeCode` and `displayName` are accidentally swapped in the prop pass-through, the backend will reject the alert. Mitigated by clear prop naming (`defaultSymbol={item.typeCode}`) and test coverage.
3. **Column layout shift:** Adding a bell column to `GoldPriceTable` changes the column count. The `colSpan` on the empty state row must be updated from 3 → 4.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| `goldSelectOptions` is empty (API loading) | Bell opens modal; form shows "Loading..." in dropdown (existing behavior) |
| Price row is stale (`item.isStale === true`) | Bell still opens form; no special handling needed (stale = display "--", alert can still be created) |
| `defaultSymbol` passed to form not found in `goldSelectOptions` | `useEffect` falls back to `goldSelectOptions[0]` (existing fallback) — now less likely since `enabled` filter is broader |
| User dismisses modal without submitting | Modal closes, no state persists (normal modal dismiss) |
| `GoldPriceTable` receives no `onSetAlert` prop | Bell column not rendered (prop is optional) |

## Dependencies & Assumptions

- `AssetDisplayPrice` proto type already includes `typeCode`, `displayName`, `enabled`, `assetType` fields — confirmed from proto definition.
- `InvestmentType.INVESTMENT_TYPE_GOLD_VND` and `INVESTMENT_TYPE_SILVER_VND` are the correct enum values for gold/silver alerts — confirmed from backend `IsGoldType`/`IsSilverType` checks.
- Bell icon available in `components/icons/` or via lucide-react — verify before implementation.
- `BaseModal` supports being used multiple times on one page with independent open states — confirmed from existing home page pattern.

## Out of Scope

- Currency price alerts (no backend support for currency `typeCode` validation)
- Adding alert shortcut from the `/dashboard/prices` market prices page
- Backend changes of any kind
- `showInInvestment` flag semantics in the admin UI
