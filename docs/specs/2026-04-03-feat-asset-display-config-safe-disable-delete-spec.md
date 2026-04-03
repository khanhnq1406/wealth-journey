# Asset Display Config Safe Disable/Delete Specification

## Summary

Admins can currently disable or delete an `AssetDisplayConfig` record even when users have active investments whose `Symbol` matches that config's `TypeCode`. Doing so breaks the portfolio view for affected users — the `ResolvePrice` algorithm skips disabled configs, and soft-deleted configs are excluded entirely, leaving those investments without a price source. This feature adds a guard at the service layer: before executing a disable (update with `enabled=false`) or a delete, check whether any non-deleted investments reference that `TypeCode`, and if so, return a clear error with the affected investment count.

## User Stories

- As an admin, I want to be prevented from disabling an asset display config that active users depend on, so that I don't accidentally break their portfolio views.
- As an admin, I want a clear error message telling me how many investments would be affected, so I understand the impact before taking action.
- As an admin, I want to still be able to rename, reorder, or change `ShowInInvestment` on a config that has active investments (non-breaking changes), so my admin tools remain useful.

## Functional Requirements

### FR-1: Block Disable When Active Investments Exist

When an admin calls `PUT /api/v1/admin/asset-display-config/:id` and the payload sets `enabled=false` while the current config has `enabled=true`, the service must:

1. Fetch the existing config by ID.
2. Count active (non-deleted) investments where `symbol = config.TypeCode`.
3. If count > 0 → return a `400 Bad Request` error: `"Cannot disable: N active investment(s) use asset type <TypeCode>"`.
4. If count = 0 → proceed with the update normally.

**Acceptance criteria:**

- [ ] Attempting to disable a config with ≥1 active investments returns HTTP 400 with a descriptive message including the count and TypeCode.
- [ ] Attempting to disable a config with 0 active investments succeeds (HTTP 200).
- [ ] Changing only `displayName`, `displayOrder`, or `showInInvestment` on a config that has active investments is NOT blocked (only blocked when `enabled` flips from true → false).
- [ ] A config already disabled (`enabled=false`) can be updated freely (no re-check needed for already-disabled configs).

### FR-2: Block Delete When Active Investments Exist

When an admin calls `DELETE /api/v1/admin/asset-display-config/:id`, the service must:

1. Fetch the existing config by ID.
2. Count active (non-deleted) investments where `symbol = config.TypeCode`.
3. If count > 0 → return a `400 Bad Request` error: `"Cannot delete: N active investment(s) use asset type <TypeCode>"`.
4. If count = 0 → proceed with soft-delete normally.

**Acceptance criteria:**

- [ ] Attempting to delete a config with ≥1 active investments returns HTTP 400 with a descriptive message including the count and TypeCode.
- [ ] Attempting to delete a config with 0 active investments succeeds (HTTP 204 / success).
- [ ] The error message distinguishes disable vs delete ("Cannot disable" vs "Cannot delete").

### FR-3: New Repository Method — CountBySymbol

Add a `CountBySymbol(ctx context.Context, symbol string) (int64, error)` method to `InvestmentRepository` to efficiently count active investments by symbol without loading full records.

**Acceptance criteria:**

- [ ] Method returns correct count of non-deleted investments with `symbol = ?`.
- [ ] Method uses a SQL `COUNT(*)` query (not fetching all rows and counting in Go).
- [ ] GORM soft-delete scope is applied automatically (only counts where `deleted_at IS NULL`).

## Non-Functional Requirements

- **Performance**: The count query must use the existing `symbol` index on the `investment` table. No full table scans.
- **Security**: Operation is admin-only; no new public endpoints introduced.
- **No breaking changes**: Existing behavior for configs with zero active investments is unchanged.

## Architecture Changes (C4)

### Diagrams to Update

**`c4-component-backend.md` (L3 Backend):** No structural changes — no new handler, service, or repository is added. Only a new method on the existing `InvestmentRepository` interface and guard logic in `AssetDisplayConfigService`. No diagram update needed.

### New Diagrams

None needed — this is a guard addition to existing CRUD, not a new domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`flow-cross-cutting.md` or a new `flow-admin.md`**: Add a flowchart showing the disable/delete guard decision logic. Since no existing flow file covers admin asset display config operations, create a new entry in a suitable file.

### New Flow Diagrams

**Target file:** `docs/architecture/flow-admin.md` (new file)
**Diagram type:** `flowchart TD`
**Flow description:**

```
Admin calls Disable or Delete
  → Fetch config by ID (if not found → 404)
  → Count active investments by symbol
  → If count > 0 → return 400 with "Cannot disable/delete: N active investments use <TypeCode>"
  → If count = 0 → proceed with update/soft-delete
```

Include both paths (disable and delete) with their distinct error messages.

## Data Model Changes

**No schema changes.** The guard uses the existing `investment.symbol` field (already indexed) and the existing `asset_display_config.type_code` field. No new tables, columns, or migrations required.

## API Changes

### Modified: PUT /api/v1/admin/asset-display-config/:id

**Behavior change (non-breaking):** When `enabled` flips from `true` → `false` and active investments exist, returns:

```json
HTTP 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cannot disable: 3 active investment(s) use asset type SJL1L10"
  },
  "timestamp": "..."
}
```

No request/response shape changes.

### Modified: DELETE /api/v1/admin/asset-display-config/:id

**Behavior change (non-breaking):** When active investments exist, returns:

```json
HTTP 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cannot delete: 3 active investment(s) use asset type SJL1L10"
  },
  "timestamp": "..."
}
```

## UI/UX Changes

No frontend changes required. The frontend admin components (`AssetDisplayConfigTable.tsx`, `AssetDisplayConfigForm.tsx`) already handle API errors via `onError` callbacks and display error messages from the server response. The `400` error message will surface naturally through the existing error handling pattern.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|-------------------|----------|
| Display error from failed admin action | Existing error state in `AssetDisplayConfigForm.tsx` | `features/admin/components/` |

No new components needed.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Admin browser | DELETE/PUT request with config ID | Yes: Internet → App | Auth + Admin Middleware | JWT + admin role required |
| 2 | Auth Middleware | Validated admin identity | No | `AssetDisplayConfigHandler` | Same tier |
| 3 | Handler | config ID (int32) | No | `AssetDisplayConfigService.Delete/Update` | Parsed and validated |
| 4 | Service | `symbol = config.TypeCode` | Yes: App → DB | `InvestmentRepository.CountBySymbol` | Parameterized query |
| 5 | Service | `id` | Yes: App → DB | `AssetDisplayConfigRepository.Delete/Update` | Parameterized query, only if count = 0 |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Admin PUT/DELETE requests | JWT auth + AdminMiddleware role check |
| App → DB | Count query + delete/update query | GORM parameterized queries, soft delete |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Non-admin pretends to be admin | High | JWT + AdminMiddleware already enforced |
| T-2 | 1 | Internet → App | Tampering | Attacker sends crafted config ID to delete critical config | Medium | Guard now prevents deleting configs with active investments; admin-only endpoint |
| T-3 | 1 | Internet → App | Elevation | Regular user calls admin endpoint | High | AdminMiddleware blocks; existing control |
| T-4 | 4 | App → DB | Injection | Malicious `symbol` value in count query | Low | GORM parameterized queries prevent SQL injection |
| T-5 | 1 | Internet → App | DoS | Repeated disable/delete attempts to hammer DB count query | Low | Count query uses index; no external API call; very fast |
| T-6 | 1 | Internet → App | Info Disclosure | Error message leaks internal state | Low | Message only reveals count + TypeCode — appropriate for admin context |

### Authorization Rules

| Operation | Admin | Regular User | Unauthenticated |
|-----------|-------|-------------|-----------------|
| Disable config (PUT enabled=false) | Allowed if no active investments | Blocked (403) | Blocked (401) |
| Delete config (DELETE) | Allowed if no active investments | Blocked (403) | Blocked (401) |
| Other config updates (rename/reorder) | Always allowed | Blocked (403) | Blocked (401) |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| `:id` path param | int32 | > 0 | Parsed by Gin; 404 if config not found |
| `enabled` field | bool | — | Type-safe proto field; guard applied when `enabled=false` |

### External Dependency Risks

None. This feature adds no new external API calls or packages. Only new DB queries against existing tables.

### Sensitive Data Handling

The count query returns an integer. No user PII or financial data is exposed in the error response — only the count and the TypeCode (which is a market symbol, not user data).

### Issues & Risks Summary

1. **Race condition (low risk)**: Between the count check and the delete/disable, a user could delete their investment. This results in a false block — the admin sees "1 active investment" but it's deleted by the time they retry. Acceptable: the admin can simply retry; the second attempt will succeed.
2. **TypeCode case sensitivity**: Ensure the `CountBySymbol` query is case-insensitive or matches the exact casing stored in `investment.symbol`. Since all symbols are uppercase by convention, this is low risk but should be documented.
3. **Soft-deleted configs**: If a config was previously soft-deleted and re-created with the same TypeCode, investments with old symbols might be inadvertently counted. Since soft-deleted investments are excluded, this is not an issue.

## Edge Cases & Error Handling

| Case | Behavior |
|------|----------|
| Config not found by ID | 404 Not Found (existing behavior, no change) |
| `enabled` stays `true` in update payload | No count check performed |
| `enabled` already `false`, update sets `false` again | No count check (already disabled) |
| Delete on config with zero investments | Proceeds normally, 200/204 |
| Count query DB error | Propagate as 500 Internal Server Error |
| Config has fetch codes but no investments | Delete proceeds (fetch codes are cascade-deleted) |
| Investment exists but is soft-deleted | Not counted (GORM scope excludes `deleted_at IS NOT NULL`) |

## Dependencies & Assumptions

- Depends on existing `InvestmentRepository` — adds one new method `CountBySymbol`.
- Assumes `Investment.Symbol` stores the same string value as `AssetDisplayConfig.TypeCode` for gold/silver assets.
- Assumes GORM's soft-delete scope (`deleted_at IS NULL`) is correctly applied — verified in codebase.
- No protobuf changes required (error messages use existing error response format).
- No frontend changes required.

## Out of Scope

- Cascading updates: automatically re-assigning investments to a different config when one is disabled (too complex, not requested).
- Warning on `showInInvestment=false` change (hides from investment creation dropdown, but doesn't affect existing investment prices — harmless).
- Blocking deletion of fetch codes when the parent config has active investments (fetch codes affect price resolution quality, not existence — lower risk).
- Undo/restore functionality for soft-deleted configs.
- Admin notification or audit log entry for blocked operations (good future feature, not in scope).
