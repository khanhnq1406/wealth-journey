# Price Alert Status Filter Bug Specification

## Summary

The status filter tabs on the Price Alerts screen ("Tất cả", "Đang hoạt động", "Đã kích hoạt") appear to work visually (tab highlights correctly) but do not actually filter the displayed alerts. All three tabs always show the same full list of alerts. The root cause is a Gin query-binding failure: the backend's `ListAlerts` handler uses `c.ShouldBindQuery(&req)` on the proto-generated `ListUserPriceAlertsRequest` struct, but the struct has no `form:""` tags — so Gin cannot bind the `status_filter` query parameter from the URL, leaving it always at 0 (UNSPECIFIED = all records returned).

## User Stories

- As a user with many price alerts, I want to filter by "Đang hoạt động" so I can see only actively monitoring alerts.
- As a user with triggered alerts, I want to filter by "Đã kích hoạt" so I can review and clean up alerts that fired.
- As a user, I want "Tất cả" to show all alerts regardless of status.

## Functional Requirements

### FR-1: Filter Tabs Must Actually Filter

The three filter tabs must correctly change which alerts are displayed.

- "Tất cả" (`ALERT_STATUS_UNSPECIFIED` = 0): shows all alerts
- "Đang hoạt động" (`ALERT_STATUS_ACTIVE` = 1): shows only active alerts
- "Đã kích hoạt" (`ALERT_STATUS_TRIGGERED` = 2): shows only triggered alerts

**Acceptance criteria:**
- [ ] Clicking "Đang hoạt động" shows only alerts with status=active
- [ ] Clicking "Đã kích hoạt" shows only alerts with status=triggered
- [ ] Clicking "Tất cả" shows all alerts
- [ ] Each tab switch triggers a fresh query (or uses client-side filter)
- [ ] Empty state is shown when a filter results in no matching alerts

### FR-2: No Regression on Related Features

The fix must not break: alert creation, toggle (pause/activate), delete, all-triggered hint banner.

**Acceptance criteria:**
- [ ] Creating a new alert still appears in the list
- [ ] Toggle mutation still works
- [ ] Delete mutation still works
- [ ] All-triggered hint logic still works correctly

## Non-Functional Requirements

- **Performance**: Filter should not cause extra backend calls beyond what the current design already makes per tab switch
- **Security**: No change to authorization model — users only see their own alerts

## Architecture Changes (C4)

### Diagrams to Update

None. This is a bug fix with no structural changes to components or services.

## Runtime Flow Diagrams

### Flow Diagrams to Update

No flow diagram changes needed — the flow itself is correct conceptually. The bug is an implementation-level binding issue.

## Data Model Changes

None.

## API Changes

None to the proto definition. The fix approach (chosen below) operates at the handler level.

## Root Cause Analysis

### What the frontend sends

In `src/wj-client/utils/generated/api.ts:2147`:
```typescript
const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
// statusFilter → status_filter
```
URL sent: `GET /api/v1/price-alerts?status_filter=1&pagination.page=1&...`

### What the backend receives

In `src/go-backend/handlers/user_price_alert.go:55`:
```go
var req v1.ListUserPriceAlertsRequest
if err := c.ShouldBindQuery(&req); err != nil { ... }
```

Proto-generated struct (`investment.pb.go:5255`):
```go
StatusFilter AlertStatus `protobuf:"..." json:"status_filter,omitempty"`
Pagination   *PaginationParams `protobuf:"..." json:"pagination,omitempty"`
```

**`ShouldBindQuery` uses `form:""` tags, not `json:""` tags.** No `form:` tag exists on the proto struct. Gin silently ignores `status_filter=1`, leaving `StatusFilter = 0` (UNSPECIFIED), which returns all alerts.

### Why it compiles and runs without error

`ShouldBindQuery` only returns an error on malformed input, not on unrecognized query params. The filter silently has no effect.

## Proposed Fix Approach

**Approach A — Backend: parse `status_filter` manually in the handler (CHOSEN)**

In `ListAlerts` handler, read `status_filter` from the query string directly using `c.Query("status_filter")`, parse it to an int, and pass to the service. This avoids any proto struct binding issues.

**Why chosen:** Clean, surgical fix entirely in the backend handler (~5 lines). No frontend changes. No proto regeneration needed. No client-side filtering workaround.

**Approach B — Frontend: client-side filter**

Fetch all alerts, then filter `data?.alerts` locally by status. Simpler but wasteful — always fetches all N alerts from the backend, and the query key no longer changes on filter switch.

**Why not chosen:** Breaks the intent of server-side filtering; wastes bandwidth for users with many alerts; changes the query key semantics.

**Approach C — Add `form:` tags to proto struct**

Would require modifying the generated proto Go file or adding a post-generation hook. Generated files should not be manually edited — fragile.

**Why not chosen:** Violates the "proto files are generated" contract.

## Implementation Detail (Approach A)

Modify `handlers/user_price_alert.go`, `ListAlerts` function:

```go
func (h *UserPriceAlertHandlers) ListAlerts(c *gin.Context) {
    userID, ok := handler.GetUserID(c)
    if !ok {
        handler.Unauthorized(c, "User not authenticated")
        return
    }

    // Parse status_filter manually (ShouldBindQuery cannot bind proto enums without form tags)
    var req v1.ListUserPriceAlertsRequest
    if statusStr := c.Query("status_filter"); statusStr != "" {
        if statusInt, err := strconv.Atoi(statusStr); err == nil {
            req.StatusFilter = v1.AlertStatus(statusInt)
        }
    }

    // Parse pagination manually if needed, or use a separate struct
    // (Pagination sub-struct binding may also be affected — verify)
    if err := c.ShouldBindQuery(&req); err != nil {
        handler.BadRequest(c, err)
        return
    }

    result, err := h.alertService.ListAlerts(c.Request.Context(), userID, &req)
    if err != nil {
        handler.HandleError(c, err)
        return
    }

    handler.Success(c, result)
}
```

**Note on pagination binding:** The `Pagination` field is a nested protobuf message. The frontend sends `pagination.page=1&pagination.page_size=100`. Gin's `ShouldBindQuery` with no `form:` tags on nested proto messages may also fail to bind pagination. Need to verify whether pagination is actually bound correctly — if not, it should also be parsed manually.

## UI/UX Changes

None — the filter tabs UI is already correct. Only the backend-side effect of clicking them needs to work.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | `GET /api/v1/price-alerts?status_filter=N` | Yes: Internet → App | Gin handler | JWT in header authenticates user |
| 2 | Handler | `userID` + `statusFilter` | No | Service | Internal call |
| 3 | Service | SQL query with `WHERE status = ?` | No | PostgreSQL | Parameterized GORM query |
| 4 | DB | Alert rows | No | Service → Handler → Response | Filtered list |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Filter request | JWT auth via `GetUserID` middleware |
| App → DB | GORM query | Parameterized queries, user_id scoping |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1 | Internet → App | Tampering | User sends `status_filter=99` (invalid enum value) | Low | `alertStatusToString` returns `""` for unknown values → returns all; no crash |
| T-2 | 1 | Internet → App | Elevation | User sends another user's alerts by spoofing userID | Low | `GetUserID` extracts from JWT — not from query param |
| T-3 | 1 | Internet → App | DoS | User hammers filter endpoint | Low | Rate limiting applies at infra level |

### Authorization Rules

- Handler calls `GetUserID(c)` from JWT — users can only filter their own alerts.
- No change to authorization model.

### Input Validation Rules

- `status_filter` value: parse with `strconv.Atoi`, cast to `v1.AlertStatus`. Unknown values map to `""` (all) via `alertStatusToString` — safe.
- No new validation needed beyond what already exists.

### External Dependency Risks

None. Fix is entirely internal.

### Sensitive Data Handling

Alert data (symbol, price targets) is user-private. Already scoped by `userID` in repository query — no change.

### Issues & Risks Summary

1. **Pagination binding may also be broken** — the `Pagination` nested proto message may not bind correctly via `ShouldBindQuery`. Need to verify in testing. If broken, fix together.
2. **No test coverage** for the filter parameter parsing — add a unit/integration test for the handler.
3. **Silent failure** — Gin does not error on unrecognized query params, so similar binding issues in other handlers could exist undetected.

## Edge Cases & Error Handling

- `status_filter` missing from URL → `c.Query("status_filter")` returns `""` → skip assignment → `StatusFilter` stays 0 (UNSPECIFIED) → returns all alerts. Correct.
- `status_filter=abc` (non-numeric) → `strconv.Atoi` fails → skip assignment → returns all alerts. Safe.
- `status_filter=0` (UNSPECIFIED) → cast to 0 → `alertStatusToString` returns `""` → returns all alerts. Correct.
- `status_filter=3` (PAUSED) → currently not a filter tab in the UI, but the backend should handle it correctly → returns only paused alerts. Correct by `alertStatusToString`.

## Dependencies & Assumptions

- The repository `ListByUserID` already correctly filters by status string — no change needed there.
- The service `alertStatusToString` already handles all enum values correctly — no change needed there.
- `strconv` is already imported in `handlers/user_price_alert.go`.

## Out of Scope

- Adding a "Paused" filter tab to the UI (not requested).
- Fixing similar query binding issues in other handlers (tracked separately if found).
- Adding pagination to the filter tabs UI.
