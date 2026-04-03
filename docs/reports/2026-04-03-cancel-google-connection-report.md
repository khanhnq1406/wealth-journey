# Cancel Google Connection — Implementation Report

## Metadata

- **Feature:** Cancel Google Connection (UnlinkGoogle)
- **Branch:** `feat/cancel-google-connection`
- **Plan file:** `docs/plans/2026-04-03-cancel-google-connection-plan.md`
- **Spec file:** `docs/specs/2026-04-03-cancel-google-connection-spec.md`
- **Progress file:** `docs/reports/2026-04-03-cancel-google-connection-progress.md`
- **Completed:** 2026-04-03
- **Status:** complete

---

## Summary

Implemented the ability for authenticated users to unlink their Google account from the security settings page. A server-side guard requires the user to have a password set before unlinking, preventing account lockout.

---

## Changes by Task

### Task 0 — C4 Architecture Diagrams (commit `ddf4b4a8`)

- `docs/architecture/c4-component-backend.md`: Added `UnlinkGoogle` to AuthHandler component
- `docs/architecture/c4-component-frontend.md`: Added `DisconnectGoogleDialog` note to AuthMethodsCard entry

### Task 1 — Proto: UnlinkGoogle RPC (commit `d52ea534`)

- `api/protobuf/v1/auth.proto`: Added `UnlinkGoogle` RPC, `UnlinkGoogleRequest` (empty), `UnlinkGoogleResponse {success, message, timestamp}`
- `api/protobuf/v1/investment.proto`: Restored missing `GetAssetDisplayPrices` RPC that was causing TypeScript compile failures
- `task proto:all` generated `useMutationUnlinkGoogle` hook in `utils/generated/hooks.ts`

### Task 2 — Backend Service Method (commit `80b2a85d`)

- `src/go-backend/domain/auth/auth.go`: Added `UnlinkGoogle(ctx, userID, currentSessionID)` method
  - Guard: `strings.Contains(user.AuthProvider, "google")` → 400 if not linked
  - Guard: `user.PasswordHash != ""` → 400 if no password set
  - Strips `"google"` (and any `+` separator) from `AuthProvider`
  - DB update first, then `invalidateOtherSessions` (best-effort, consistent with `ChangePassword`)
- `src/go-backend/domain/auth/auth_unlink_google_test.go`: 5 unit tests (sqlmock + miniredis)

### Task 3 — Backend Handler + Route (commit `0d9b4777`)

- `src/go-backend/handlers/auth.go`: Added `UnlinkGoogle` handler — extracts `userID` from JWT context, `sessionID` from `ParseToken`, delegates to service, uses `handler.Success()`
- `src/go-backend/handlers/routes.go`: Registered `POST /api/v1/auth/unlink-google` in `authProtected` group
- `src/go-backend/handlers/auth_unlink_google_test.go`: 3 handler tests (401 unauthorized, 400 no password, 200 success)

### Task 4+5 — i18n Keys + Error Mapper (commit `9371d23f`)

- `messages/en/settings.json` + `messages/vi/settings.json`: Added 9 keys under `settings.security` and `settings.security.errors`
  - `disconnectGoogle`, `disconnectGoogleTitle`, `disconnectGoogleMessage`, `disconnectGoogleConfirm`, `disconnectGoogleSuccess`, `disconnectGoogleHint`
  - `errors.googleNotLinked`, `errors.unlinkGoogleFailed`, `errors.disconnectRequiresPassword`
- `features/auth/utils/error-mapper.ts`: Added `UNLINK_GOOGLE_ERROR_MAP` and `mapUnlinkGoogleError`
- `features/auth/utils/__tests__/error-mapper.test.ts`: 13 tests (all 5 mapper functions)

### Task 6+7 — DisconnectGoogleDialog + AuthMethodsCard (commit `8244dede`)

- `features/auth/components/DisconnectGoogleDialog.tsx`: New component
  - Wraps `ConfirmationDialog` with `variant="danger"`
  - Uses `useMutationUnlinkGoogle` with success (cache invalidation + toast + close) and error (mapped i18n key) handlers
  - Shows inline error message within dialog
- `features/auth/components/AuthMethodsCard.tsx`: Added Disconnect button
  - Visible only when `methods?.hasGoogle`
  - Disabled (with tooltip hint) when `!methods?.hasPassword`
  - Fixed pre-existing color violation: `bg-green-500/20 text-green-400` → `bg-v2-green-light text-v2-green-positive`
  - Fixed new color violation: `hover:text-red-400 active:text-red-500` → `hover:text-v2-red-negative/80 active:text-v2-red-negative/60`
- `components/__tests__/DisconnectGoogleDialog.test.tsx`: 5 tests
- `components/__tests__/AuthMethodsCard.test.tsx`: 3 tests

### Task 8 — Runtime Flow Diagram (commit `6231ee11`)

- `docs/architecture/flow-auth.md`: Added §9 Unlink Google — full mermaid sequence diagram, key invariants, error paths table

---

## Test Summary

| Layer | Tests | Result |
|-------|-------|--------|
| Backend service unit tests | 5 | Pass |
| Backend handler tests | 3 | Pass |
| Frontend error-mapper tests | 13 | Pass |
| Frontend DisconnectGoogleDialog tests | 5 | Pass |
| Frontend AuthMethodsCard tests | 3 | Pass |
| **Total** | **29** | **All pass** |

TypeScript: 0 errors (`npx tsc --noEmit`)

---

## Security Notes

- `userID` always from JWT context — never from request body
- Server-side password guard is authoritative; client-side disabled button is UX only
- DB update committed BEFORE session revocation — no inconsistent state on partial Redis failure
- Session revocation is best-effort (same as `ChangePassword` pattern)
- Current session preserved — user stays logged in after disconnecting Google
- No internal error details leaked to frontend

---

## Notable Decisions

1. **Pre-existing bug fix (Task 1):** `GetAssetDisplayPrices` RPC was missing from `InvestmentService` in `investment.proto`, causing `task proto:all` to drop the `useQueryGetAssetDisplayPrices` hook and break TypeScript compilation. Restored the RPC as part of this task.

2. **Auth domain direct DB access:** `domain/auth/auth.go` uses `s.db.DB` (GORM) directly — this is intentional and matches the existing pattern in this file (exception to the repository pattern for the auth domain).

3. **Color token fixes (Task 6+7):** Reviewer caught two color violations. Both fixed before commit — pre-existing `bg-green-500/20 text-green-400` and newly introduced `hover:text-red-400 active:text-red-500`.
