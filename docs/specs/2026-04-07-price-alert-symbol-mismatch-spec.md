# Price Alert Symbol/TypeCode Mismatch Specification

## Summary

The user price alert system has a fundamental mismatch between the symbol identifiers used across three layers: the `AssetDisplayConfig.TypeCode` (what the frontend sends), the `asset_price.TypeCode` (raw keys from price source APIs), and the bridge between them (`asset_config_fetch_code`). This causes two bugs: (1) alert creation fails for gold/silver types whose display TypeCode does not exactly match any `asset_price.type_code` row, and (2) even for alerts that were successfully created, the scheduler's price evaluation silently skips them when the symbol doesn't exactly match `asset_price.type_code`. This makes the entire user price alert feature unreliable for gold/silver assets.

## User Stories

- As a user, I want to select a gold/silver type from the displayed list and create a price alert without getting a backend validation error.
- As a user, I want my active gold/silver price alerts to be evaluated on schedule and trigger notifications when my target price is reached.
- As a user, I want the current price shown when creating an alert to be accurate (resolved via the same display config priority logic as the price page).

## Root Cause Analysis

### The Three-Layer TypeCode Architecture

```
Layer 1: AssetDisplayConfig.TypeCode  (e.g., "SJC", "Nhẫn SJC 9999", "SJC Tự Do")
         ↕ bridged by asset_config_fetch_code (priority-ordered fetch codes)
Layer 2: asset_config_fetch_code.TypeCode  (e.g., "SJC", "SJC_1L10", "Nhẫn SJC 9999", "SJC_NHAN_999")
         ↕ exact match
Layer 3: asset_price.TypeCode  (raw from price sources, e.g., "SJC", "SJC_1L10", "Nhẫn Doji 9999")
```

**What the frontend sends**: `AssetDisplayConfig.TypeCode` (Layer 1)

**What the backend validates/evaluates against**: `asset_price.TypeCode` (Layer 3) via `GetPriceByTypeCode()`

**The gap**: Layer 1 ≠ Layer 3 for display configs whose TypeCode doesn't happen to exactly match a raw `asset_price.type_code`. Examples:
- `"SJC"` → happens to match (same in both layers) ✓
- `"SJC Tự Do"` → Layer 3 only has `"SJC TD"` (from VangToday) ✗
- `"Nhẫn SJC 9999"` → fetch code maps to `"SJC_NHAN_999"` ✗

The correct bridge is the `ResolvePrice` algorithm in `AssetDisplayConfigService`, which uses `asset_config_fetch_code` to find the best-available non-stale price from Layer 3.

### Bug 1: Alert Creation Failure

In `user_price_alert_service.CreateAlert()` (lines 149–169):
```go
dto, lookupErr := s.assetPriceSvc.GetPriceByTypeCode(validateCtx, symbol)
// WRONG: scans asset_price.TypeCode directly — misses fetch code bridge
```

Should instead use `assetDisplayConfigSvc.ResolvePrice(ctx, symbol, assetTypeName)` which traverses fetch codes.

### Bug 2: Evaluation Silent Skip

In `user_price_alert_service.EvaluateAlerts()` price map building:
```go
goldByCode[p.TypeCode] = p  // keyed by raw asset_price.TypeCode
...
if gp, ok := goldByCode[a.Symbol]; ok {  // lookup by alert.Symbol (display TypeCode)
```

Same mismatch — if `alert.Symbol = "SJC Tự Do"` but `asset_price.TypeCode = "SJC TD"`, the lookup returns no match, the alert is silently skipped every evaluation cycle and never triggers.

### Note on System PriceAlertJob

The `PriceAlertJob` calls `PriceAlertService.CheckAndAlert()` — this is the **system-level** alert (price movement detection), separate from user-defined alerts. The user's report may be referring to this but the primary bugs are in `UserPriceAlertService`. The system alert is out of scope for this fix unless confirmed broken.

## Functional Requirements

### FR-1: Alert Creation Uses Resolved Price (Not Raw TypeCode Match)

**Description:** When creating a gold/silver alert, the service must validate and retrieve the current price using the `AssetDisplayConfigService.ResolvePrice` method (which uses fetch code priority), not the raw `GetPriceByTypeCode` scan.

**Acceptance criteria:**
- [ ] Creating an alert with `symbol = "SJC Tự Do"` (a valid display config TypeCode) succeeds without validation error
- [ ] The `currentPriceAtCreation` stored in the alert reflects the buy or sell price as resolved by `ResolvePrice`
- [ ] If `ResolvePrice` returns `isStale=true`, alert is still created with the stale price (non-fatal)
- [ ] If `ResolvePrice` returns NotFound (no display config for the symbol), alert creation fails with a clear validation error
- [ ] Unit tests cover: valid symbol with fresh price, valid symbol with stale price, unknown symbol returns error

### FR-2: Alert Evaluation Uses Resolved Price (Not Raw TypeCode Map)

**Description:** In `EvaluateAlerts`, when looking up the current price for a gold/silver alert, resolve via `AssetDisplayConfigService.ResolvePrice(alert.Symbol, assetTypeName)` instead of building a `goldByCode` map keyed by raw `asset_price.TypeCode`.

**Acceptance criteria:**
- [ ] Alert with `symbol = "SJC Tự Do"` is evaluated (not silently skipped) during the scheduler cycle
- [ ] Price comparison uses the resolved buy or sell price based on `alert.PriceSide`
- [ ] If `ResolvePrice` fails for a specific alert (stale/not found), that alert is skipped with a log warning — other alerts continue
- [ ] No regression on alerts with symbols that already matched `asset_price.TypeCode` directly

### FR-3: Service Interface Update

**Description:** `UserPriceAlertService` needs access to `AssetDisplayConfigService` to call `ResolvePrice`. This must be injected at construction time per ADR-002.

**Acceptance criteria:**
- [ ] `UserPriceAlertService` receives `AssetDisplayConfigService` as constructor parameter
- [ ] No circular dependency introduced (display config service does not reference alert service)
- [ ] DI wiring updated in `internal/app/providers.go`

## Non-Functional Requirements

- **Performance:** `ResolvePrice` calls during evaluation should be efficient — a single batch fetch of `asset_price` rows per asset type is preferable over N individual DB calls (one per alert). Consider passing the pre-loaded price map to a helper that does the fetch-code resolution.
- **Resilience:** Individual alert resolution failure must not abort the entire evaluation batch.
- **Backward compatibility:** Existing alerts stored with symbols that happen to already match `asset_price.TypeCode` directly must continue to work.

## Architecture Changes (C4)

### Diagrams to Update

- **c4-component-backend.md** (L3): Add dependency arrow from `UserPriceAlertService` → `AssetDisplayConfigService`

### New Diagrams

None needed — this is a service dependency wiring fix.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **flow-investment.md**: Update the "User Price Alert Evaluation" sequence to show the path through `AssetDisplayConfigService.ResolvePrice` with fetch code resolution, instead of direct `asset_price.TypeCode` map lookup.

### New Flow Diagrams

None — modify existing alert evaluation flow.

## Data Model Changes

No schema changes required. The `user_price_alert.Symbol` column continues to store `AssetDisplayConfig.TypeCode` (correct semantics — it's the user-visible asset identifier, not a raw price source code).

## API Changes

No API changes. `CreateUserPriceAlertRequest.symbol` continues to accept `AssetDisplayConfig.TypeCode` values. The validation error message may improve to be less confusing (no longer suggests using internal type codes like "SJ9999").

## UI/UX Changes

No frontend changes required. The form already correctly sends `typeCode` from `AssetDisplayConfig`. The fix is entirely in the backend service layer.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Authenticated user | `CreateUserPriceAlertRequest { symbol, assetType, targetPrice, ... }` | Yes: Internet → App (JWT validated) | `UserPriceAlertService.CreateAlert` | |
| 2 | `UserPriceAlertService` | `symbol` string | No | `AssetDisplayConfigService.ResolvePrice` | Same process, internal |
| 3 | `AssetDisplayConfigService` | fetch codes list | No | `AssetPriceRepository.ListAll` | DB read, no user data written |
| 4 | `AssetPriceRepository` | `asset_price` rows | No | `UserPriceAlertService` | Returns current price for threshold |
| 5 | Scheduler (background) | All active alerts | No | `UserPriceAlertService.EvaluateAlerts` | No user input at this layer |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Alert create/update/delete/list requests | JWT `AuthMiddleware`, user_id from token |
| App → DB | All repository calls | GORM parameterized queries; no raw SQL |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|---------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Tampering | User sends malicious symbol string to trigger SQL injection | Low | GORM parameterized queries; symbol pattern validation (`^[\p{L}\p{N}.\-_ ]+$`) |
| T-2 | 1 | Internet → App | Tampering | User sends symbol for another user's asset to read their price context | Low | No cross-user data leak — price lookup is public price data, not user-specific |
| T-3 | 1 | Internet → App | Elevation | User creates alerts for assets they don't own, to spam notifications | Low | Per-user alert limit (30 active max) enforced in `CountActiveByUserID` |
| T-4 | 3 | App → DB | Info Disclosure | Error message reveals internal type_code naming conventions | Low | New error message should say "asset type not available" without exposing internal codes |

### Authorization Rules

- Alert CRUD operations: require authenticated user (JWT); user_id injected from token, not request body
- Evaluation: background scheduler — no user input; all active alerts evaluated regardless of who created them
- `ResolvePrice` reads public price data — no per-user access control needed

### Input Validation Rules

| Field | Current Validation | Change Required? |
|-------|-------------------|-----------------|
| `symbol` | Pattern `^[\p{L}\p{N}.\-_ ]+$`, length 1–50 | No change to pattern; update error message |
| `targetPrice` | int64, must be > 0 | No change |
| `assetType` | Proto enum validation | No change |
| `priceSide` | "buy" or "sell" | No change |

The error message from validation failure should change from:
- Old: `"symbol 'X' does not match any known price code — use the internal type code (e.g. SJ9999, DOHCML)"`
- New: `"asset type 'X' is not available or has no current price data"` (does not expose internal codes)

### External Dependency Risks

- `AssetDisplayConfigService.ResolvePrice` calls `AssetPriceRepository.ListAll` — already used in alert service via `GetPriceByTypeCode`, so no new DB dependency. DB failure → alert creation fails with 500, evaluation skips (same as current).
- No new external services introduced.

### Sensitive Data Handling

- `targetPrice` is a financial threshold the user set; not sensitive beyond user ownership (already enforced)
- Price data from `ResolvePrice` is public market data — not sensitive

### Issues & Risks Summary

1. **Performance risk in evaluation**: Calling `ResolvePrice` N times (once per active alert) could be slow since each call does `ListAll` DB scan. Mitigation: pre-load `asset_price` rows once per evaluation run, pass the pre-loaded slice to a resolution helper.
2. **Circular dependency risk**: `AssetDisplayConfigService` must not be imported by `UserPriceAlertService` if it already imports the former. Check DI graph — currently no circular dep.
3. **Stale alert symbols**: Alerts created before this fix may have symbols like "SJ9999" (old internal codes, from the old error message hint). These will fail `ResolvePrice` if no display config exists with TypeCode = "SJ9999". These alerts will be silently skipped — acceptable since they were already broken.

## Edge Cases & Error Handling

| Scenario | Current Behavior | Expected After Fix |
|----------|-----------------|-------------------|
| Symbol matches display config but all prices stale | Validation passes (stale price fetched), alert created | Same — stale price stored, alert created |
| Symbol matches display config, no fetch codes configured | 400 validation error | 400 error: "asset type not available" |
| Symbol not in display config at all | 400 validation error (no asset_price row) | 400 error: "asset type not available" |
| During evaluation, symbol's resolved price is stale | Alert triggers (uses stale price) | Alert is skipped with log warning (consistent with current behavior for `IsStale` checks) |
| During evaluation, `ResolvePrice` fails (DB error) | Alert silently skipped (not in map) | Alert skipped, log `WARN` with alert ID and error |
| Alert symbol = "SJC" (direct match in both layers) | Works correctly | Must continue to work (no regression) |

## Dependencies & Assumptions

- `AssetDisplayConfigService.ResolvePrice` is already available as a service interface method — no new methods needed
- `AssetDisplayConfigService` can be injected into `UserPriceAlertService` via constructor (ADR-002)
- DI wiring in `internal/app/providers.go` and `handlers/builder.go` must be updated
- The `assetTypeName` (string: "gold" / "silver") can be derived from `v1.InvestmentType` proto enum using existing helpers `gold.IsGoldType`, `silver.IsSilverType` (already used in the service)

## Out of Scope

- Fixing `PriceAlertJob` / `PriceAlertService.CheckAndAlert` (system-level price movement alerts) — separate service, separate bug report needed if confirmed broken
- Migrating/fixing existing user alerts with old-style internal type codes (one-time data cleanup, separate task if needed)
- Frontend changes (the form is already correct)
- Changing the `user_price_alert.Symbol` DB column — semantics are correct (stores display TypeCode)
