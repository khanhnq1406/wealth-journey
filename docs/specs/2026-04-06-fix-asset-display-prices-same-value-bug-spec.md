# Fix Asset Display Prices Same-Value Bug — Specification

## Summary

The public endpoint `GET /api/v1/public/asset-display-prices` returns gold prices for **all** asset type queries (silver, currency) because the backend handler reads the query parameter as `assetType` (camelCase) while the generated API client sends it as `asset_type` (snake_case). When the parameter name doesn't match, `c.Query("assetType")` returns `""`, the handler defaults to `"gold"`, and every caller — regardless of which tab they're viewing — receives gold prices. This is a naming mismatch bug, not a data or business-logic bug. The fix is a one-line change in the backend handler (add snake_case fallback), consistent with how other handlers in the same codebase already handle this pattern.

## Root Cause (Confirmed via Live Testing)

**Client sends:** `?asset_type=silver` (camelCase→snake_case conversion in `utils/generated/api.ts` `toQueryParams()`)
**Backend reads:** `c.Query("assetType")` → returns `""` → defaults to `"gold"`

Proof from live test:
```
GET ?asset_type=silver  → returns 9 GOLD items (SJC, Vàng nhẫn SJC, ...)  ← BUG
GET ?assetType=silver   → returns 9 SILVER items (PH_QU_THI_1L, ...)       ← correct
```

**Existing pattern in the same codebase** (`handlers/investment.go` lines 713–729):
```go
walletIDStr := c.Query("walletId")
if walletIDStr == "" {
    walletIDStr = c.Query("wallet_id") // Fallback to snake_case
}
```

## User Stories

- As a user viewing the home dashboard, I want the Silver Price Table to show actual silver prices, not gold prices.
- As a user viewing the home dashboard, I want the Currency Price Table to show exchange rates, not gold prices.
- As a user on the landing page, I want all three price tables to show their respective asset types correctly.

## Functional Requirements

### FR-1: Backend handler reads both camelCase and snake_case `assetType`

The `GetDisplayPrices`, `ListAll`, and `ListAvailableTypeCodes` handlers in `asset_display_config.go` must accept the `assetType` query parameter in both forms.

**Acceptance criteria:**
- [ ] `GET ?assetType=silver` returns silver prices
- [ ] `GET ?asset_type=silver` returns silver prices (same result)
- [ ] `GET ?assetType=currency` returns currency prices
- [ ] `GET ?asset_type=currency` returns currency prices
- [ ] `GET` (no param) still defaults to `"gold"`
- [ ] All 3 handlers (`GetDisplayPrices`, `ListAll`, `ListAvailableTypeCodes`) use the dual-read pattern

### FR-2: Existing generated client remains unchanged

No changes to `utils/generated/api.ts` — it is auto-generated from protobuf and should not be hand-edited. The fix lives entirely in the backend.

**Acceptance criteria:**
- [ ] `utils/generated/api.ts` is not modified
- [ ] `utils/generated/hooks.ts` is not modified
- [ ] Proto files are not modified

## Non-Functional Requirements

- **Performance:** No additional DB queries — the fix is purely in query-parameter reading before any DB access.
- **Backward compatibility:** Callers using `assetType` (camelCase) continue to work unchanged.
- **Consistency:** The fix matches the existing dual-read pattern already present in `handlers/investment.go`.

## Architecture Changes (C4)

### Diagrams to Update

None. This is a one-line handler fix with no architectural change — no new components, services, or data flows are added or removed.

## Runtime Flow Diagrams

### Flow Diagrams to Update

No new diagrams needed. The fix resolves a query-parameter mismatch before any business logic runs; the existing flow for `GetDisplayPrices` is not altered.

## Data Model Changes

None. No schema changes.

## API Changes

No API contract changes. The endpoint URL, response shape, and proto definition are unchanged. The fix only corrects which query parameter name the handler reads on the server side.

**Affected handlers (internal implementation only):**

| Handler | File | Line | Change |
|---------|------|------|--------|
| `GetDisplayPrices` | `handlers/asset_display_config.go` | ~115 | Add snake_case fallback |
| `ListAll` | `handlers/asset_display_config.go` | ~149 | Add snake_case fallback |
| `ListAvailableTypeCodes` | `handlers/asset_display_config.go` | ~354 | Add snake_case fallback |

**Pattern to apply (3 occurrences):**
```go
// Before (broken):
assetType := c.Query("assetType")
if assetType == "" {
    assetType = "gold"
}

// After (fixed):
assetType := c.Query("assetType")
if assetType == "" {
    assetType = c.Query("asset_type") // Fallback: generated client sends snake_case
}
if assetType == "" {
    assetType = "gold"
}
```

## UI/UX Changes

None. The frontend components are already correct — they pass the right logical value (`"silver"`, `"currency"`) and the generated client converts it. The fix is entirely backend.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Display silver prices | `SilverPriceTable` (exists, already correct) | `app/[locale]/dashboard/home/SilverPriceTable.tsx` |
| Display currency prices | `CurrencyPriceTable` (exists, already correct) | `app/[locale]/dashboard/home/CurrencyPriceTable.tsx` |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | `?asset_type=silver` (query param) | Yes: Internet → App | `GetDisplayPrices` handler | Untrusted input; no auth required (public endpoint) |
| 2 | Handler | `assetType` string | No | `AssetDisplayConfigService.GetDisplayPrices()` | Validated: empty → default "gold" |
| 3 | Service | enabled configs for assetType | No | `AssetDisplayConfigRepository` | GORM parameterized WHERE |
| 4 | Repository | `[]*AssetDisplayConfig` | No | Service (ResolvePrice) | Read-only, no user data |
| 5 | Service | resolved price DTOs | No | Handler (JSON response) | Public price data, no PII |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Query param `assetType`/`asset_type` | Value validated: only used as DB filter string with parameterized query (GORM) |
| App → DB | `WHERE asset_type = ?` | GORM parameterized query prevents SQL injection |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Injection | Attacker passes malicious `asset_type` value to exploit DB | Low | GORM parameterized query; value is a string passed to `WHERE asset_type = ?` — injection impossible |
| T-2 | 1 | Internet → App | DoS | High-frequency polling of public endpoint | Low | No auth required; same rate exposure as before the fix — no new surface introduced |
| T-3 | 1 | Internet → App | Info Disclosure | Unexpected `asset_type` value reveals internal error messages | Low | No asset_type found → empty result `[]`, not an error; no internal details leaked |

### Authorization Rules

| Operation | Unauthenticated | Authenticated User | Admin |
|-----------|----------------|-------------------|-------|
| `GET /api/v1/public/asset-display-prices` | **Allowed** (public endpoint) | Allowed | Allowed |
| `GET /api/v1/admin/asset-display-config` | Denied | Denied | **Allowed** |
| `GET /api/v1/admin/asset-price-type-codes` | Denied | Denied | **Allowed** |

The `ListAll` and `ListAvailableTypeCodes` admin handlers also have the same snake_case bug but are protected by `AdminMiddleware` — no unauthorized access risk. Still fixing for consistency.

### Input Validation Rules

| Input | Validation | Location |
|-------|-----------|----------|
| `assetType`/`asset_type` query param | Empty → default `"gold"`. Any other value is passed as-is to `WHERE asset_type = ?` via GORM parameterized query. Unknown values return empty `[]` (not an error). | Handler |

No additional validation needed. Unknown asset types gracefully return empty arrays.

### External Dependency Risks

None. This fix touches only query-parameter reading — no new external services, packages, or APIs.

### Sensitive Data Handling

The endpoint returns public gold/silver/currency prices. No PII, no user-specific data. No sensitivity concerns.

### Issues & Risks Summary

1. **Root cause is a naming mismatch** — `toQueryParams()` in `api.ts` converts camelCase to snake_case; handler reads camelCase only. The fix must be in the backend (not the generated client).
2. **Three handler locations need the same fix** — `GetDisplayPrices`, `ListAll`, `ListAvailableTypeCodes`. Missing any one leaves a stale code smell.
3. **No data corruption** — the bug causes wrong data to be _returned_, not wrong data to be _stored_. No DB remediation needed.

## Edge Cases & Error Handling

| Case | Expected Behavior |
|------|------------------|
| `?assetType=gold` | Returns gold prices (existing behavior, unchanged) |
| `?asset_type=gold` | Returns gold prices (new: fallback reads snake_case) |
| `?assetType=silver` | Returns silver prices (existing behavior, unchanged) |
| `?asset_type=silver` | Returns silver prices (new: fallback — was returning gold before) |
| No param | Defaults to gold (unchanged) |
| `?assetType=unknown` | Returns empty `prices: []` (graceful, unchanged) |
| Both params present | `c.Query("assetType")` wins (Gin reads first match); snake_case not checked when camelCase is non-empty |

## Dependencies & Assumptions

- The generated `api.ts` `toQueryParams()` function consistently converts camelCase to snake_case for all query parameters. This is confirmed by reading the source.
- Other endpoints using the same generated client pattern (e.g., `walletId` → `wallet_id` in `investment.go`) have already been fixed with the same dual-read approach.
- No proto or code generation changes are needed.

## Out of Scope

- Fixing the `toQueryParams()` conversion in `api.ts` — it's auto-generated and changing it could break other endpoints.
- Adding rate limiting to the public endpoint — existing exposure is unchanged.
- Adding `assetType` validation (reject unknown values) — current graceful empty-return behavior is acceptable.
- Auditing other handlers for the same snake_case issue — only the three in `asset_display_config.go` are confirmed affected by this bug report.
