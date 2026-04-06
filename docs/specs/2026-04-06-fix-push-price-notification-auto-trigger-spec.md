# Fix Push Price Notification Auto-Trigger Specification

## Summary

The scheduled push price notification (`PriceAlertJob`, runs every 15 minutes) stopped firing automatically in production after the Apr 3 2026 commit `7da688f3` which introduced `buildEnabledSet` filtering. The filter compares `asset_price.type_code` (internal source codes from price fetcher clients, e.g. `"DOJI_AVPL_BAN_LE"`, `"SJC_VANG_SJC_1L_10L_1KG"`) against `asset_display_config.type_code` (admin display names, e.g. `"Doji_24K"`, `"SJC TD"`). These two namespaces are different — the filtering always evaluates to false for most entries, silently suppressing all alert logic. Manual force-trigger works because it uses `force=true` which bypasses the threshold check but still hits the same filter — the only reason force-trigger delivers notifications is that `force=true` includes ALL movers regardless, but the mover list is still filtered to only matching type codes. The handful of exactly-matching codes (`"SJC"` from mihong source, `"Mihong_999"`) happen to match, so those still fire.

## Confirmed Root Cause

**Type code namespace mismatch in `buildEnabledSet`.**

- `asset_price.type_code` is set by price fetcher clients (e.g. `"DOJI_AVPL_BAN_LE"`, `"SJC_VANG_SJC_1L_10L_1KG"`, `"Mihong_999"`)
- `asset_display_config.type_code` is set by admin when creating display configs (e.g. `"Doji_24K"`, `"SJC TD"`, `"Mi hồng"`, `"BTMC"`)
- `buildEnabledSet` constructs a set from `asset_display_config.type_code` values, then checks `enabledGold[p.TypeCode]` where `p.TypeCode` is from `asset_price`
- Since the two namespaces don't match, `enabledGold[p.TypeCode]` is almost always `false` → all prices filtered → no movers → no alerts

**Evidence from production DB:**
- Notifications fired normally Mar 19 – Apr 2 (before the filtering commit)
- 3-day gap Apr 3–5 exactly matches the deploy of commit `7da688f3`
- `asset_display_config` has 9 gold configs with type codes like `"BTMC"`, `"Doji_24K"`, `"Mi hồng"` — none match `asset_price` type codes except `"SJC"` and `"Mihong_999"`
- Apr 6 alert fired only for `gold_vnd` and `silver_vnd` — the two categories that happen to have matching codes

## User Stories

- As a subscriber, I want to receive push notifications automatically when gold/silver prices move significantly, so that I don't need admin to manually trigger them.
- As an admin, I want the price alert filtering to respect the admin-configured display configs, so that only enabled assets trigger alerts.

## Functional Requirements

### FR-1: Fix Type Code Matching in `buildEnabledSet`

The `buildEnabledSet` function in `price_alert_service.go` must be updated so that the enabled set is keyed by the type codes that actually appear in `asset_price`, not the display-level type codes from `asset_display_config`.

**The correct approach:** Use `asset_config_fetch_code` — the existing join table that maps each `asset_display_config` to its `asset_price` source codes (fetch codes). The fetch codes ARE the `asset_price.type_code` values (e.g. `"DOJI_AVPL_BAN_LE"`). An `asset_display_config` should be considered "enabled" for alert purposes if it is enabled AND has at least one fetch code. The alert should fire for any `asset_price` row whose `type_code` appears as a fetch code of any enabled display config.

**Acceptance criteria:**
- [ ] `buildEnabledSet("gold")` returns a set keyed by `asset_price.type_code` values (fetch codes), not display config type codes
- [ ] An `asset_price` row is included in alert evaluation if and only if its `type_code` matches a fetch code belonging to an enabled `asset_display_config`
- [ ] The alert notification name/label uses the `asset_display_config.DisplayName` for the matched config (not the raw type code)
- [ ] If an `asset_display_config` has no fetch codes configured, it is excluded from alert evaluation (same as before)
- [ ] If `asset_display_config` table is empty (cold start), `buildEnabledSet` returns empty map (same as before — no alerts on cold start)
- [ ] Alerts fire automatically without manual force-trigger after the fix is deployed

### FR-2: Name Resolution for Movers

Currently `mover.Name` is set from `asset_price.Name`. After the fix, when a price matches via fetch code, the mover name should come from `asset_display_config.DisplayName` of the matched config — this is what users recognize (e.g. `"Vàng SJC"` not `"SJC_VANG_SJC_1L_10L_1KG"`).

**Acceptance criteria:**
- [ ] `mover.Name` is set from `asset_display_config.DisplayName` when a fetch-code match exists
- [ ] Falls back to `asset_price.Name` if no display config match (defensive)

### FR-3: Deduplication Within a Display Config

Multiple fetch codes may belong to the same `asset_display_config` (e.g. multiple SJC sources). The alert should use one representative price per display config (highest priority fetch code that is non-stale), not fire once per fetch code.

**Acceptance criteria:**
- [ ] At most one `priceMover` is generated per `asset_display_config` entry
- [ ] The price used is from the highest-priority non-stale fetch code for that config (consistent with `ResolvePrice` algorithm)

## Non-Functional Requirements

- **Performance:** `buildEnabledSet` adds one DB query per asset type per job run (every 15 min). Fetching fetch codes for all enabled configs for one asset type is a single JOIN query — negligible overhead.
- **Correctness:** The fix must not change the cooldown, baseline, or threshold logic — only the filtering step.
- **No migration needed:** All required tables (`asset_display_config`, `asset_config_fetch_code`, `asset_price`) already exist in production.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3):** No structural changes — `PriceAlertService` already depends on `AssetDisplayConfigService`. The data flow within the service changes but no new components.

### New Diagrams

None required.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md`** — update the price alert scheduler flow to show the corrected fetch-code-based filtering step:

- Current: `buildEnabledSet` → reads `asset_display_config.type_code` → checks against `asset_price.type_code` (BROKEN)
- Fixed: `buildEnabledSet` → reads fetch codes from `asset_config_fetch_code` → checks `asset_price.type_code` against fetch codes (CORRECT)

## Data Model Changes

No schema changes. The fix uses existing tables:

| Table | Role in fix |
|-------|-------------|
| `asset_display_config` | Source of enabled/disabled state and `DisplayName` |
| `asset_config_fetch_code` | Maps display configs to `asset_price.type_code` values |
| `asset_price` | Source of current prices for comparison |

## API Changes

None. This is a backend-only fix to the scheduler job logic.

## UI/UX Changes

None. The fix is invisible to users except that they start receiving push notifications automatically again.

## Implementation Approach

In `price_alert_service.go`, replace the current `buildEnabledSet` implementation:

**Current (broken):**
```go
// Reads asset_display_config.type_code — different namespace from asset_price.type_code
configs, err := s.configSvc.ListAll(ctx, assetType)
enabled[c.TypeCode] = true  // c.TypeCode is a display name like "Doji_24K"
// Then checks: enabledGold[p.TypeCode]  where p.TypeCode is "DOJI_AVPL_BAN_LE" → never matches
```

**Fixed approach:**
```go
// 1. Get all enabled display configs for this asset type
configs, err := s.configSvc.ListAll(ctx, assetType)

// 2. For each enabled config, get its fetch codes
// 3. Build two maps:
//    fetchCodeToConfigID: asset_price.type_code → display config ID
//    configIDToName:      display config ID → DisplayName
// 4. In the price loop: if fetchCodeToConfigID[p.TypeCode] exists → include this price
// 5. Set mover.Name from configIDToName[matchedConfigID]
// 6. Dedup: one mover per config ID (keep highest priority / first non-stale)
```

This requires `AssetDisplayConfigService` to expose a method that returns fetch codes grouped by config, or `PriceAlertService` to call the fetch code repository directly. The cleanest approach: add a `GetFetchCodesByAssetType(ctx, assetType) (map[string]AssetDisplayConfig, error)` method to `AssetDisplayConfigService` that returns a map of `fetchCode → config`. This keeps the repository calls inside the service layer.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | `asset_price` table | Price rows (type_code, buy, sell, is_stale) | No (App → DB, existing) | `PriceAlertService` | Read-only, no user input |
| 2 | `asset_display_config` table | Enabled configs, display names | No (App → DB, existing) | `PriceAlertService` | Read-only, admin-set data |
| 3 | `asset_config_fetch_code` table | Fetch codes per config | No (App → DB, existing) | `PriceAlertService` | Read-only, admin-set data |
| 4 | `PriceAlertService` | Push notification payload | Yes: App → External (push endpoints) | FCM / Apple Push | Existing flow, no change |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| App → DB | DB reads for configs and prices | GORM parameterized queries, no user input in queries |
| App → Push endpoints | Outbound push notifications | VAPID keys, existing subscription validation |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1–3 | App → DB | Tampering | Admin sets malicious fetch codes to trigger alerts for unrelated price codes | Low | Admin-only endpoint already protected by `AdminMiddleware`; fetch codes are validated on creation |
| T-2 | 4 | App → Push | DoS | Fix causes too many movers → large push payload burst | Low | `TopMoversCount` cap (default 5) already limits movers per category; deduplication (FR-3) further limits |
| T-3 | 4 | App → Push | Info Disclosure | Push payload exposes internal price data to wrong users | Low | `SendToAll` sends to all subscribers — no per-user data, same as current behavior |

### Authorization Rules

- No new endpoints — this is a scheduler job fix
- Admin controls which configs are enabled via existing admin endpoints (unchanged)

### Input Validation Rules

- No user input in this flow — all data comes from DB tables maintained by admin
- Fetch codes are validated when created via admin endpoint (existing)

### External Dependency Risks

- No new external dependencies
- Existing push delivery (FCM/Apple) unchanged

### Sensitive Data Handling

- Push notification payloads contain price movement data (public market data) — not sensitive
- No PII or financial user data in push payloads

### Issues & Risks Summary

1. **Low risk of over-alerting:** Fix may cause more alerts to fire than during the broken period. This is expected and correct — the cooldown mechanism (Redis, 120 min default) prevents spam.
2. **Deduplication logic (FR-3) must be correct:** If multiple fetch codes for the same display config all have price movements, we must not double-count. Test coverage required.
3. **Cold-start behavior:** On first run after deploy with empty `asset_price` table, `GetPricesByAssetType` returns empty → no movers → no alerts. This is acceptable (same as before the bug).

## Edge Cases & Error Handling

| Edge Case | Expected Behavior |
|-----------|------------------|
| `asset_config_fetch_code` table empty for a config | That config is excluded from alert evaluation (no fetch codes = can't resolve price) |
| `asset_display_config` table empty | `buildEnabledSet` returns empty map → no alerts (cold start) |
| Fetch code exists in config but no matching `asset_price` row | Price lookup returns nothing → config skipped silently |
| All fetch codes for a config are stale | Config skipped (stale prices excluded from alert evaluation, same as current) |
| Multiple fetch codes for one config, some stale | Use first non-stale fetch code's price |
| `configSvc.GetFetchCodesByAssetType` fails (DB error) | Log error, skip asset type (same as current `buildEnabledSet` error path) |

## Dependencies & Assumptions

- `asset_display_config` and `asset_config_fetch_code` tables are populated in production (confirmed: 9 gold, 13 silver configs with fetch codes)
- `AssetDisplayConfigService` already has access to `fetchCodeRepo` (confirmed in constructor)
- The cooldown and baseline logic in Redis is working correctly (confirmed: force-trigger delivers push)
- No changes to proto, frontend, or DB schema needed

## Out of Scope

- Redis baseline staleness on deploy (a separate, lower-priority issue — the cooldown resets but this only causes a 15-min delay on first post-deploy alert, not a multi-day gap)
- Stale FCM push subscriptions (the 2 legacy FCM endpoints from March 2026 — separate cleanup task)
- User price alert push notifications (`UserPriceAlertService.EvaluateAlerts`) — no active alerts in production, not reported as broken
