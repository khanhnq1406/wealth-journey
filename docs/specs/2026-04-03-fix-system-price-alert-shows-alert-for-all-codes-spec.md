# Fix: System Price Alert Fires for All Asset Codes Spec

## Summary

The system price alert job (`PriceAlertJob`) currently evaluates **every** type code stored in the `asset_price` table, regardless of whether that code is enabled in the admin `asset_display_config`. This means the system sends notifications for gold/silver codes that the admin has explicitly excluded from display (disabled or never configured). The fix is to filter prices in `priceAlertService.doCheckAndAlert` so only type codes enabled in `asset_display_config` are evaluated for alerts.

## User Stories

- As an admin, I want price alerts to fire only for asset codes I have enabled in the admin config, so that users aren't notified about prices they never see on the platform.
- As a user, I want price alert notifications to be relevant — matching the assets shown on the prices page.

## Functional Requirements

### FR-1: Filter alert evaluation to admin-enabled type codes

When `doCheckAndAlert` fetches gold or silver prices via `GetPricesByAssetType`, it must filter the resulting list to only include type codes that are:
1. Present in `asset_display_config` with `enabled = true`
2. For the matching `asset_type` (gold or silver)

**Acceptance criteria:**

- [ ] A type code present in `asset_price` but absent or disabled in `asset_display_config` is never evaluated for alerts
- [ ] A type code enabled in `asset_display_config` and present in `asset_price` is evaluated as before
- [ ] The filter applies to both normal (`CheckAndAlert`) and force (`ForceCheckAndAlert`) modes
- [ ] If `asset_display_config` returns an error, the alert job logs the error and skips that asset type gracefully (same behavior as today for a price fetch error)
- [ ] Existing alert behavior (baseline, threshold, cooldown, notification dispatch) is unchanged for codes that pass the filter

### FR-2: No changes to notification content or delivery

The alert content, templates, push delivery, SSE publish, and cooldown logic must remain identical. Only the set of type codes evaluated changes.

**Acceptance criteria:**

- [ ] Existing unit tests in `price_alert_service_test.go` continue to pass
- [ ] New unit tests verify that type codes disabled in admin config are excluded

## Non-Functional Requirements

- **Performance**: `ListForInvestment` (or `ListAll`) is called once per asset type per job run (not per type code) — two extra DB reads per 15-minute cycle, negligible overhead.
- **Correctness**: The filter must be applied before baseline/threshold evaluation to avoid storing baselines for codes that should be ignored.
- **No behavioral regression**: Force mode, cooldown, top-movers cap, push notifications — all unchanged.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3 Backend)**: `PriceAlertService` now depends on `AssetDisplayConfigService` (or `AssetDisplayConfigRepository`). Add a dependency arrow.

### New Diagrams

None required — the change is within existing components.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-cross-cutting.md`**: The "background scheduler" section or price alert flow should note that enabled type codes are fetched from `asset_display_config` before price evaluation.

### Description of Updated Flow

```
PriceAlertJob (15m)
  → priceAlertService.doCheckAndAlert
      → AssetDisplayConfigService.ListAll(ctx, "gold") → get enabled TypeCodes set
      → AssetPriceService.GetPricesByAssetType(ctx, "gold") → all gold prices
      → filter: keep only prices whose TypeCode is in enabled set
      → [existing baseline/threshold/cooldown/notify logic]
      → repeat for "silver"
```

## Data Model Changes

No schema changes required. The fix is entirely in the service layer.

## API Changes

No API changes. `PriceAlertJob` is a background scheduler job — no endpoints are added or modified.

## UI/UX Changes

No frontend changes required.

## Security & Risk Assessment

### Data Flow Diagram

This fix operates entirely within the backend scheduler — no user-facing trust boundary crossings are added or modified.

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Scheduler timer | Job trigger | No | `PriceAlertJob.Run` | Internal |
| 2 | `PriceAlertJob` | assetType string | No | `AssetDisplayConfigService.ListAll` | Internal service call |
| 3 | `AssetDisplayConfigService` | enabled TypeCodes | No (App → DB) | PostgreSQL | GORM parameterized query |
| 4 | PostgreSQL | asset_display_config rows | No | Service layer | Read-only |
| 5 | `PriceAlertJob` | assetType string | No | `AssetPriceService.GetPricesByAssetType` | Internal service call |
| 6 | PostgreSQL | asset_price rows | No | Service layer | Read-only |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| App → DB | Config lookup, price lookup | GORM parameterized queries; read-only access |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 3 | App → DB | Injection | SQL injection via assetType string | Low | Hardcoded literals `"gold"`, `"silver"` — no user input flows here |
| T-2 | 6 | App → DB | Info Disclosure | Leaking asset price data to logs | Low | Existing log statements already present; no new PII logged |

No new trust boundary crossings. No user input reaches this code path. Risk profile is minimal.

### Authorization Rules

- No user-facing authorization changes. The scheduler runs as the application process itself.
- `AssetDisplayConfigService.ListAll` is already used by admin endpoints — reusing it in the scheduler does not expand attack surface.

### Input Validation Rules

No new external input. The only new values processed are `"gold"` and `"silver"` literals and `AssetDisplayConfig.TypeCode` strings from the DB (already stored/validated at write time).

### External Dependency Risks

No new external dependencies. The fix reuses existing service interfaces.

### Sensitive Data Handling

No sensitive financial data (balances, transactions) is involved. Asset prices are considered public market data.

### Issues & Risks Summary

1. **Cold-start risk**: If `asset_display_config` table is empty (no admin configuration yet), the enabled set is empty → zero alerts fire. This is **safer** behavior than the current bug (alerting for all codes). The log should emit a warning in this case.
2. **Decoupling approach**: Injecting `AssetDisplayConfigService` into `priceAlertService` adds a dependency. Alternative: inject only `AssetDisplayConfigRepository` directly. Either is valid; using the service is cleaner and consistent with DI patterns.
3. **Test coverage gap**: Existing tests mock `GetPricesByAssetType` directly and don't test the enabled-code filter. New tests are required.

## Implementation Approach

### Approach: Inject `AssetDisplayConfigService` into `priceAlertService`

**How:**
1. Add `configSvc AssetDisplayConfigService` field to `priceAlertService` struct.
2. Update `NewPriceAlertService` constructor to accept `AssetDisplayConfigService`.
3. In `doCheckAndAlert`, before processing gold prices, call `s.configSvc.ListAll(ctx, "gold")` and build a `map[string]bool` of enabled type codes. Filter `goldPrices` to only those in the map.
4. Repeat for silver.
5. Update `providers.go` to pass `AssetDisplayConfigService` when constructing `PriceAlertService`.
6. Update tests: add mock for `AssetDisplayConfigService`, add test case for disabled code exclusion.

**Trade-off:** Adds one dependency to `priceAlertService`. Minimal — both services are already constructed and available in the DI provider.

## Edge Cases & Error Handling

| Edge Case | Behavior |
|-----------|----------|
| `asset_display_config` table empty | Enabled set is empty → all prices filtered out → no alerts fire. Log a warning: "price alert: no enabled configs for gold/silver". |
| `ListAll` returns error | Log the error, skip that asset type (same as current behavior when `GetPricesByAssetType` fails). |
| TypeCode in `asset_price` but disabled in config | Excluded from evaluation. No baseline stored, no alert fired. |
| TypeCode enabled in config but not in `asset_price` | Already handled: `GetPricesByAssetType` won't return it. No change. |
| Config enabled but stale price | Already handled: stale prices are skipped at line 91/129. No change. |

## Dependencies & Assumptions

- `AssetDisplayConfigService` is already constructed in `internal/app/providers.go` — just needs to be threaded into `NewPriceAlertService`.
- `ListAll(ctx, assetType)` returns all configs (including disabled) — we filter client-side with `cfg.Enabled`. Alternatively, use a repository method that only returns enabled; but `ListAll` is already available, avoiding a new repository method.
- The `asset_display_config` table is managed by admins via the existing admin panel — no migration needed.

## Out of Scope

- Currency price alerts (the alert job currently only evaluates gold and silver — currency is not in scope).
- User price alerts (`UserPriceAlertService`) — separate service, separate evaluation path, not affected by this bug.
- Admin UI changes — no frontend work needed.
- Changes to `ThresholdPct`, cooldown, notification templates, or push delivery.
