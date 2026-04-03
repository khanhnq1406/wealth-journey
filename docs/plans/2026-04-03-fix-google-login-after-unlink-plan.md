# Fix: Google Login Allowed After Unlink — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Prevent users from logging in via Google OAuth after they have explicitly disconnected their Google account via `UnlinkGoogle`.

**Spec:** `docs/specs/2026-04-03-fix-google-login-after-unlink-spec.md`

**Architecture:** Backend-only fix. Two surgical changes to `domain/auth/auth.go`: (1) add an `AuthProvider` guard in `LoginWithDeviceInfo`, (2) remove the silent auto-re-link block in `RegisterWithDevice`. No proto changes, no frontend changes.

**Tech Stack:** Go 1.25, GORM, JWT, Google ID Token validation

---

## Security Implementation Notes

- **Authentication:** `LoginWithDeviceInfo` must check `AuthProvider` contains `"google"` before issuing a session
- **Authorization:** No cross-user access; fix is about per-user provider state
- **Input validation:** No new input — guard checks existing DB field
- **Error message:** Use `apperrors.NewUnauthorizedError(...)` — does not reveal account existence or `AuthProvider` value

---

## Component Reuse Inventory

Backend-only fix. No frontend components involved.

---

## C4 Architecture Diagram Updates

No new components. The auth service behavior changes internally — no diagram structural update needed.

---

### Task 1: Add AuthProvider guard to `LoginWithDeviceInfo`

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (LoginWithDeviceInfo, ~line 290)
- Modify: `src/go-backend/domain/auth/auth_unlink_google_test.go` (add test)

**Security notes:** Error must not reveal `AuthProvider` value or whether account exists for a given email. Use the same generic error pattern as `LoginWithPassword` (variable `genericErr`).

**Step 1: Write the failing test**

Add this test to `src/go-backend/domain/auth/auth_unlink_google_test.go` (or new `auth_google_login_test.go`):

```go
func TestLoginWithDeviceInfo_BlockedAfterUnlink(t *testing.T) {
    // Setup: user with AuthProvider = "password" (unlinked Google)
    // Call LoginWithDeviceInfo with a Google token whose email matches
    // Expect: error returned, no session created
    //
    // Use sqlmock to return a user with AuthProvider = "password"
    // and a valid email match.
    // Verify error is non-nil and no session stored in Redis.
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestLoginWithDeviceInfo_BlockedAfterUnlink ./domain/auth/... -v
```
Expected: FAIL (no guard exists yet).

**Step 3: Write minimal implementation**

In `auth.go`, after finding the user by email in `LoginWithDeviceInfo` (after line 295 in current code):

```go
// Guard: Google must be an active auth provider
if !strings.Contains(user.AuthProvider, "google") {
    return nil, apperrors.NewUnauthorizedError("Google login is not enabled for this account")
}
```

Insert between the `result.Error` check and the `generateLoginResponse` call.

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestLoginWithDeviceInfo_BlockedAfterUnlink ./domain/auth/... -v
```
Expected: PASS.

**Step 5: Run full auth test suite to confirm no regressions**
```bash
cd src/go-backend && go test ./domain/auth/... -v
```
All existing tests must pass.

**Step 6: Commit**
```
fix(auth): block Google login when AuthProvider does not contain google

After UnlinkGoogle sets AuthProvider = "password", LoginWithDeviceInfo
was still issuing sessions for Google OAuth. Add AuthProvider guard
before generateLoginResponse.
```

---

### Task 2: Remove auto-re-link in `RegisterWithDevice`

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (RegisterWithDevice, ~line 141-145)
- Modify: `src/go-backend/domain/auth/auth_unlink_google_test.go` (add test)

**Security notes:** After this change, the only way to re-link Google is via the explicit `LinkGoogle` endpoint. This is correct — it requires an authenticated session, making it a deliberate user action.

**Step 1: Write the failing test**

Add test that:
1. Creates a user with `AuthProvider = "password"` (simulating post-unlink state)
2. Calls `RegisterWithDevice` with a Google token whose email matches
3. Asserts that `AuthProvider` is NOT updated to `"google+password"` in the DB
4. (Since Task 1's guard now blocks login, this test also asserts a 401 is returned — no session issued)

```go
func TestRegisterWithDevice_DoesNotRelinkAfterUnlink(t *testing.T) {
    // User exists with email="test@example.com", AuthProvider="password"
    // Google token has email="test@example.com"
    // Call RegisterWithDevice
    // Assert: auth_provider NOT updated to "google+password"
    // Assert: error returned (because Task 1 guard blocks the login)
}
```

**Step 2: Run test to verify it fails**
```bash
cd src/go-backend && go test -run TestRegisterWithDevice_DoesNotRelinkAfterUnlink ./domain/auth/... -v
```
Expected: FAIL (auto-link still runs).

**Step 3: Write minimal implementation**

In `RegisterWithDevice`, remove lines 141-145 in current code:

```go
// REMOVE this block entirely:
if user.AuthProvider == "password" {
    s.db.DB.Model(&user).Update("auth_provider", "google+password")
}
```

After removal, the "user exists" branch becomes:
```go
result := s.db.DB.Where("email = ?", email).First(&user)
if result.Error == nil {
    // User exists — do NOT auto-link. Just attempt login (AuthProvider guard in generateLoginResponse path will block if needed).
    return s.generateLoginResponse(ctx, user, deviceInfo)
}
```

Wait — with Task 1's guard in `LoginWithDeviceInfo`, this goes through `generateLoginResponse` directly (bypassing the guard). We must apply the same AuthProvider guard here too, OR call through `LoginWithDeviceInfo`.

**Revised approach for Task 2:** Also add the AuthProvider guard in `RegisterWithDevice` existing-user path:

```go
result := s.db.DB.Where("email = ?", email).First(&user)
if result.Error == nil {
    // Guard: Google must be an active auth provider for this user
    if !strings.Contains(user.AuthProvider, "google") {
        return nil, apperrors.NewUnauthorizedError("Google login is not enabled for this account")
    }
    return s.generateLoginResponse(ctx, user, deviceInfo)
}
```

This is cleaner than relying on Task 1's guard (which is in a different function). Defense-in-depth.

**Step 4: Run test to verify it passes**
```bash
cd src/go-backend && go test -run TestRegisterWithDevice_DoesNotRelinkAfterUnlink ./domain/auth/... -v
```
Expected: PASS.

**Step 5: Run full auth test suite**
```bash
cd src/go-backend && go test ./domain/auth/... -v
```
All tests must pass.

**Step 6: Run lint**
```bash
cd src/go-backend && task ci:backend-lint
```

**Step 7: Commit**
```
fix(auth): remove Google auto-re-link and guard RegisterWithDevice

Remove the unconditional auto-link block that set AuthProvider back to
"google+password" when an existing password-only user hit the Google
register endpoint. Also add AuthProvider guard in RegisterWithDevice
existing-user path for defense-in-depth.
```

---

### Task 3: Update Runtime Flow Diagrams

**Files:**
- Modify: `docs/architecture/flow-auth.md`

**Steps:**

1. Read `docs/architecture/flow-auth.md` to find §1 (Google Login), §2 (Register), §9 (Unlink Google)
2. Update §1 and §2 sequence diagrams to show the new AuthProvider guard with `alt` block for 401 path
3. Update §9 Key Invariants to add: "Subsequent Google login/register blocked until re-linked via LinkGoogle"
4. Commit diagram changes

**Step 1 (no test needed — docs only):** Read current flow-auth.md

**Step 2:** Update diagrams

**Step 3: Commit**
```
docs(flow): update flow-auth to reflect Google auth provider guard

Add AuthProvider guard step to §1 (Login with Google) and §2 (Register
with Google) sequence diagrams. Update §9 (Unlink Google) key invariants
to note that subsequent Google auth is blocked until explicitly re-linked.
```

---

## Test Coverage Summary

| Test | File | Covers |
|------|------|--------|
| `TestLoginWithDeviceInfo_BlockedAfterUnlink` | `auth_unlink_google_test.go` | Bug 1: 401 after unlink via Login flow |
| `TestRegisterWithDevice_DoesNotRelinkAfterUnlink` | `auth_unlink_google_test.go` | Bug 2: no re-link + 401 after unlink via Register flow |
| Existing unlink tests (5) | `auth_unlink_google_test.go` | Regression: UnlinkGoogle still works |
| Full auth suite | `domain/auth/...` | No regressions |
