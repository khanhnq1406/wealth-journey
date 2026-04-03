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

---

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-04-03 | Block Google login/register after unlink; remove silent auto-relink; stop leaking internal error messages; add `AUTH_GOOGLE_NOT_LINKED` error code with i18n (EN+VI) on login and register pages | Major | `974dc864` |
| 2026-04-03 | Update VI `googleNotLinked` copy to past tense ("đã bị huỷ liên kết") in both login and register namespaces | Minor | pending |
| 2026-04-03 | Fix first-time Google sign-in: `Login` handler now calls `RegisterWithDevice` (auto-register + login) instead of `LoginWithDeviceInfo` (login-only); new users no longer get 401 | Minor | `ad3e85dd` |
| 2026-04-03 | Fix second Google login after auto-register: `CreateUser` (UserService path) did not set `AuthProvider`, causing `GoogleNotLinkedError` on next login. Now explicitly updates `auth_provider="google"` after creation in `RegisterWithDevice` | Minor | `c902f9ff` |

### Fix Details (commit `974dc864`)

**Root causes fixed:**

1. `LoginWithDeviceInfo` never checked `AuthProvider` — after unlink, Google OAuth still issued a session. Fixed: added `!strings.Contains(user.AuthProvider, "google")` guard returning `NewGoogleNotLinkedError()`.
2. `RegisterWithDevice` auto-relinked Google when `AuthProvider == "password"` — silently undid the unlink. Fixed: removed the auto-relink block; same guard applied.
3. "user not found. Please register first" leaked through handler's `NewLoginErrorWithCause` wrapper. Fixed: replaced with generic `apperrors.NewUnauthorizedError("invalid credentials")`.
4. Login/Register handlers wrapped `UnauthorizedError` in generic 500 error, discarding the specific code. Fixed: handlers now pass `UnauthorizedError` through directly.

**UX choice (Option C):** When a user tries Google sign-in/register after unlinking, instead of a generic 401, they receive a specific `AUTH_GOOGLE_NOT_LINKED` code. The frontend maps this to a localized message:
- 🇬🇧 "Google sign-in is not linked to this account. Please sign in with your password instead."
- 🇻🇳 "Tài khoản Google chưa được liên kết. Vui lòng đăng nhập bằng mật khẩu."

**Files changed:**
- `src/go-backend/pkg/errors/codes.go` — added `AuthGoogleNotLinked`
- `src/go-backend/pkg/errors/errors.go` — added `NewGoogleNotLinkedError()`
- `src/go-backend/domain/auth/auth.go` — fixed `LoginWithDeviceInfo` + `RegisterWithDevice`
- `src/go-backend/handlers/auth.go` — fixed Login/Register handlers
- `src/wj-client/messages/en/auth.json` — added `googleNotLinked` in `login` + `register` namespaces
- `src/wj-client/messages/vi/auth.json` — same in Vietnamese
- `src/wj-client/features/auth/utils/error-mapper.ts` — added `mapGoogleLoginError()` (code-based)
- `src/wj-client/app/[locale]/auth/login/page.tsx` — uses mapper
- `src/wj-client/app/[locale]/auth/register/page.tsx` — uses mapper

### Fix Details (commit `ad3e85dd`)

**Root cause:** Commit `974dc864` hardened `LoginWithDeviceInfo` to return `NewUnauthorizedError("invalid credentials")` when the user is not found (to prevent leaking user existence info). This was correct for the unlink guard scenario, but it also broke first-time Google sign-in: new users attempting to login via Google received 401 instead of being auto-registered.

**Fix:** `handlers/auth.go` `Login` handler now calls `RegisterWithDevice` instead of `LoginWithDeviceInfo`. `RegisterWithDevice` is the canonical Google OAuth entry point — it handles both cases in one function:
- New user (not found) → creates account with `AuthProvider="google"`, creates default categories, issues JWT session
- Existing user → checks unlink guard (`strings.Contains(user.AuthProvider, "google")`), then issues JWT session

The unlink guard is fully preserved: users who unlinked Google still receive `AUTH_GOOGLE_NOT_LINKED` (401).

**Files changed:**
- `src/go-backend/handlers/auth.go` — `Login` calls `RegisterWithDevice` (was `LoginWithDeviceInfo`)
- `src/go-backend/handlers/auth_login_test.go` — 3 new handler tests (new user 200, unlinked 401, missing token 400)
