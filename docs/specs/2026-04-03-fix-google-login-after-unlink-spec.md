# Fix: Google Login Allowed After Unlink — Specification

## Summary

After a user disconnects their Google account via `UnlinkGoogle`, they can still authenticate using Google OAuth. Two separate bugs allow this: `LoginWithDeviceInfo` never checks `AuthProvider`, and `RegisterWithDevice` auto-re-links Google whenever an email match is found with `AuthProvider = "password"`. Both bugs bypass the intent of `UnlinkGoogle` and expose an authorization gap.

## Original Feature

- Report: `docs/reports/2026-04-03-cancel-google-connection-report.md`
- Spec: `docs/specs/2026-04-03-cancel-google-connection-spec.md`
- Plan: `docs/plans/2026-04-03-cancel-google-connection-plan.md`

## Issues to Fix

| #   | Issue | Source | Severity |
| --- | ----- | ------ | -------- |
| 1   | `LoginWithDeviceInfo` does not check `AuthProvider` — allows Google login after unlink | Bug report | Critical |
| 2   | `RegisterWithDevice` auto-re-links Google when `AuthProvider = "password"` — silently re-connects the disconnected provider | Bug report | Critical |

## Root Cause Analysis

### Bug 1 — `LoginWithDeviceInfo` (auth.go:279)

```go
// Current code: no AuthProvider check
result := s.db.DB.Where("email = ?", email).First(&user)
if result.Error == gorm.ErrRecordNotFound {
    return nil, fmt.Errorf("user not found. Please register first")
}
// Proceeds to generateLoginResponse — no check that Google is linked
```

After `UnlinkGoogle`, `user.AuthProvider = "password"`. The email is still stored in the DB. When the user tries Google login, the token is verified by Google, the email is found in DB, and the session is issued — Google OAuth is effectively never revoked.

### Bug 2 — `RegisterWithDevice` (auth.go:141-145)

```go
// Current code: unconditionally re-links Google
if user.AuthProvider == "password" {
    s.db.DB.Model(&user).Update("auth_provider", "google+password")
}
```

When a user who has unlinked Google tries to "register" again with Google OAuth, the server finds the existing account by email, sees `AuthProvider = "password"`, and silently sets it back to `"google+password"` — re-linking Google without user consent.

## Fix Approach

### Fix 1 — Add AuthProvider guard to `LoginWithDeviceInfo`

After loading the user by email, check that `user.AuthProvider` contains `"google"` before issuing a session. If not, return a 401 unauthorized error that mirrors `genericErr` (no sensitive detail leaked).

```go
// After finding user, add:
if !strings.Contains(user.AuthProvider, "google") {
    return nil, apperrors.NewUnauthorizedError("Google login is not enabled for this account")
}
```

### Fix 2 — Remove auto-re-link from `RegisterWithDevice`

Delete the unconditional re-link block (lines 143-145). A user who has intentionally unlinked Google should **not** have it re-linked by logging in again. If the user wants to re-link, they must explicitly use the `LinkGoogle` endpoint.

```go
// Remove this block entirely:
if user.AuthProvider == "password" {
    s.db.DB.Model(&user).Update("auth_provider", "google+password")
}
```

**Side-effect analysis:** This block was meant to auto-link Google for users who registered with password first and then use Google OAuth. This use case is still supported by the explicit `LinkGoogle` endpoint (`POST /api/v1/auth/link-google`). Removing the silent auto-link is the correct behavior.

## Functional Requirements

### FR-1: Google login blocked after unlink

**Description:** After `UnlinkGoogle` is called, any subsequent Google OAuth login attempt must be rejected with 401.

**Acceptance criteria:**
- [ ] `LoginWithDeviceInfo` returns error when `AuthProvider` does not contain `"google"`
- [ ] Error message does not reveal internal state (generic auth error)
- [ ] Existing tests for `LoginWithDeviceInfo` still pass
- [ ] New test: Google login returns 401 after `UnlinkGoogle`

### FR-2: Google OAuth does not silently re-link after unlink

**Description:** Calling the Register/Google-login flow after unlink must NOT restore the Google link.

**Acceptance criteria:**
- [ ] `RegisterWithDevice` does NOT update `auth_provider` when user already exists
- [ ] Existing user with `AuthProvider = "password"` attempting Google login gets a 401 (covered by FR-1 fix)
- [ ] `LinkGoogle` endpoint remains the only way to re-link Google
- [ ] New test: Register flow does not re-link Google after unlink

## Non-Functional Requirements

- **Security:** Error message must not reveal `AuthProvider` value or account existence details
- **Backward compatibility:** The `LinkGoogle` endpoint is the correct re-link path — no behavior change needed there

## Architecture Changes (C4)

No new components. The fix modifies logic inside existing `AuthService` (`domain/auth/auth.go`).

**`flow-auth.md` update required:** The "Unlink Google" sequence diagram (§9) should note that subsequent Google OAuth attempts return 401. The "Google Login" sequence (§1/§2) should note the new AuthProvider guard.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`docs/architecture/flow-auth.md`**:
  - Update §1 (Login with Google) and §2 (Register with Google) to show the new `AuthProvider` guard step with a `401` error path when `AuthProvider` does not contain `"google"`.
  - Update §9 (Unlink Google) to add a note under "Key Invariants" confirming that subsequent Google login/register is blocked.

## Data Model Changes

None. No schema changes required.

## API Changes

None. No proto changes required. The fix is purely behavioral.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Google OAuth | ID token | Yes: Internet → App | `LoginWithDeviceInfo` | Token verified by `idtoken.Validate` |
| 2 | `LoginWithDeviceInfo` | email from token | No | PostgreSQL | Email used to find user |
| 3 | PostgreSQL | `User{AuthProvider}` | No | `LoginWithDeviceInfo` | **NEW: must check before issuing session** |
| 4 | `LoginWithDeviceInfo` | JWT + session | No | Redis + PostgreSQL | Written on success |
| 5 | Google OAuth | ID token | Yes: Internet → App | `RegisterWithDevice` | Same as flow 1 |
| 6 | `RegisterWithDevice` | `auth_provider` update | No | PostgreSQL | **BUG: auto-re-link removed** |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| Internet → App | Google OAuth token | `idtoken.Validate` (Google PKI) |
| App → DB | User lookup | Parameterized GORM query |
| App → Redis | Session write | Only after AuthProvider guard passes |

### Threats Identified (STRIDE)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1→3 | Internet → App | Elevation of Privilege | Unlinked user re-gains Google access | Critical | Add AuthProvider check in `LoginWithDeviceInfo` |
| T-2 | 5→6 | Internet → App | Tampering | Silent re-link restores removed access | Critical | Remove auto-re-link in `RegisterWithDevice` |
| T-3 | Error response | App → Internet | Information Disclosure | Error message reveals account state | Low | Use generic `NewUnauthorizedError` |

### Authorization Rules

- Google login is only allowed when `strings.Contains(user.AuthProvider, "google")` is true
- Re-linking Google requires explicit call to `LinkGoogle` endpoint (authenticated)

### Input Validation Rules

No new input validation needed. The fix is an authorization check on existing data.

### Sensitive Data Handling

- Error message must not reveal whether the account exists or what `AuthProvider` is set to
- Use `apperrors.NewUnauthorizedError("Google login is not enabled for this account")` — does not confirm account existence

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|------------------|
| User unlinks Google, tries Google login | `LoginWithDeviceInfo` returns 401 |
| User unlinks Google, tries Google register again | `RegisterWithDevice` falls through to "user not found" → creates NEW account (different email? impossible — email stays). Actually: same email found, no provider, returns 401 via Fix 1 |
| User never linked Google, tries Google login | Same 401 path via Fix 1 |
| User has `AuthProvider = "google+password"`, logs in via Google | Still works (contains "google") |
| User has `AuthProvider = "google"`, logs in via Google | Still works |
| User with password-only, wants to link Google | Must use explicit `LinkGoogle` endpoint |

## Regression Risks

| Risk | Affected Code | Mitigation |
|------|--------------|------------|
| Removing auto-link breaks first-time Google login for new users | `RegisterWithDevice` new-user path still creates `AuthProvider = "google"` | Not affected — only the existing-user auto-link block is removed |
| Fix 1 blocks valid Google logins | Only blocked when `AuthProvider` doesn't contain `"google"` | Existing unit tests verify valid path |

## Out of Scope

- Removing the Google email from `user.email` column on unlink (would require migration + impact on login flows)
- Force-expiring the current session on unlink (current behavior: current session kept, others revoked — unchanged)
