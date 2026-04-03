# Cancel Google Connection Specification

## Summary

Allow users to unlink their Google account from the Security settings page. This gives users full control over their connected authentication methods. Unlinking is only permitted when the user has a password set (ensuring they cannot be locked out). Upon disconnect, all sessions except the current one are revoked.

## User Stories

- As a user with both Google and password linked, I want to disconnect my Google account so that I can use password-only login going forward.
- As a user with only Google linked (no password set), I want to see a clear explanation of why I cannot disconnect Google yet, so I know what to do next.

## Functional Requirements

### FR-1: Guard — Password Required Before Unlink

Before the "Disconnect Google" action is available, the system must verify the user has a password set (`hasPassword === true`). If not, the disconnect button is disabled and a tooltip/hint explains: "Set a password before disconnecting Google."

**Acceptance criteria:**
- [ ] Disconnect button is disabled when `hasPassword === false`
- [ ] Disabled state shows a hint: "Set a password first to disconnect Google"
- [ ] Disconnect button is enabled when `hasPassword === true`

### FR-2: Confirmation Dialog

Clicking the enabled "Disconnect Google" button opens a confirmation dialog before any action is taken.

**Dialog content:**
- Title: "Disconnect Google?"
- Body: "Your Google account will be unlinked. All other active sessions will be signed out. You can reconnect Google at any time."
- Actions: "Cancel" (secondary) and "Disconnect" (destructive/red)

**Acceptance criteria:**
- [ ] Dialog appears on button click
- [ ] Cancel closes the dialog with no changes
- [ ] Confirm triggers the unlink API call

### FR-3: Unlink Google API

A new `UnlinkGoogle` RPC strips `google` from the user's `AuthProvider` field and revokes all sessions except the current one.

**Backend logic:**
1. Verify user is authenticated
2. Load user — confirm `AuthProvider` contains `"google"`
3. Confirm user has a password set (`PasswordHash != ""`) — return error if not
4. Strip `"google"` (and `"+"` separator) from `AuthProvider`:
   - `"google"` → reject (no password set, guard in step 3)
   - `"google+password"` → `"password"`
   - `"password+google"` → `"password"`
5. Save updated user
6. Revoke all sessions for this user except the current session ID (reuse existing `RevokeAllSessionsExceptCurrent` logic)
7. Return success

**Acceptance criteria:**
- [ ] `POST /api/v1/auth/unlink-google` endpoint exists and requires auth
- [ ] Returns 400 if user does not have Google linked
- [ ] Returns 400 if user has no password set
- [ ] `AuthProvider` is updated correctly in DB
- [ ] All sessions except current are revoked
- [ ] Returns success response

### FR-4: Frontend Success State

After successful unlink:
- Confirmation dialog closes
- Success toast: "Google account disconnected"
- `AuthMethodsCard` refreshes — Google row shows "Not linked" status and the Link Google button reappears

**Acceptance criteria:**
- [ ] Toast shown on success
- [ ] `useQueryGetAuthMethods` cache invalidated so card refreshes
- [ ] Google row reflects new "Not linked" state without page reload

### FR-5: Error Handling

If the API call fails:
- Dialog stays open
- Error message shown inside the dialog body
- "Disconnect" button re-enables

**Acceptance criteria:**
- [ ] Network/server errors surface as inline message in dialog
- [ ] User can retry or cancel

## Non-Functional Requirements

- **Performance:** Unlink + session revocation completes in < 500ms
- **Security:** Endpoint requires `AuthMiddleware`. Server-side guard enforces password-required rule — client-side guard is UX only.
- **Audit:** Unlink action should be logged (same level as `LinkGoogle`)

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-backend.md` (L3 Backend):** Add `UnlinkGoogle` to the AuthHandler component description
- **`c4-component-frontend.md` (L3 Frontend):** No structural change — `AuthMethodsCard` gains a new action but no new module

### New Diagrams

None — this feature does not introduce a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-auth.md`:** Add a new sequence diagram: "Unlink Google" — covers the confirmation dialog → API call → session revocation → UI refresh flow.

### New Flow Diagrams

None needed beyond the update above.

## Data Model Changes

No new tables or columns. The existing `auth_provider` string field on the `users` table is updated in place.

| Table | Field | Change |
|-------|-------|--------|
| `users` | `auth_provider` | Value stripped: `"google+password"` → `"password"` |

## API Changes

### New RPC: `UnlinkGoogle`

**Proto** (`api/protobuf/v1/auth.proto`):

```protobuf
rpc UnlinkGoogle(UnlinkGoogleRequest) returns (UnlinkGoogleResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/unlink-google"
    body: "*"
  };
}

message UnlinkGoogleRequest {}

message UnlinkGoogleResponse {
  bool success = 1;
  string message = 2;
  int64 timestamp = 3;
}
```

**Handler:** `POST /api/v1/auth/unlink-google` — protected by `AuthMiddleware`

**Error responses:**

| Case | HTTP | Message |
|------|------|---------|
| Google not linked | 400 | `"Google account is not linked"` |
| No password set | 400 | `"Please set a password before disconnecting Google"` |
| Internal error | 500 | generic |

## UI/UX Changes

### Security Settings Page (`settings/security/page.tsx`)

Add `"disconnect-google"` to the `FormView` union type. Pass `onDisconnectGoogle` callback to `AuthMethodsCard`.

### AuthMethodsCard (`features/auth/components/AuthMethodsCard.tsx`)

Add to the Google row:
- When `methods?.hasGoogle === true` AND `methods?.hasPassword === true`: show enabled "Disconnect" button (destructive style)
- When `methods?.hasGoogle === true` AND `methods?.hasPassword === false`: show disabled "Disconnect" button with tooltip hint

Add `DisconnectGoogleDialog` inline or as a separate component in `features/auth/components/`.

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Confirmation dialog | `ConfirmationDialog` | `components/modals/ConfirmationDialog.tsx` |
| Success toast | `Toast` / `useNotification` | `contexts/NotificationContext.tsx` |
| Disabled button with hint | `Button` (disabled prop) | `components/Button.tsx` |
| Error display in dialog | Inline `div` (existing pattern in `AuthMethodsCard`) | — |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `DisconnectGoogleDialog` | `features/auth/components/DisconnectGoogleDialog.tsx` | Encapsulates the confirmation + mutation + error state for disconnect; keeps `AuthMethodsCard` clean |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Browser | `POST /api/v1/auth/unlink-google` + JWT | Yes: Internet → App | Go backend AuthHandler | JWT validated by AuthMiddleware |
| 2 | AuthHandler | userID | No | AuthService | Internal call |
| 3 | AuthService | Updated `auth_provider` | No | PostgreSQL (users table) | Parameterized query via GORM |
| 4 | AuthService | Session revocation | No | PostgreSQL + Redis (sessions) | Reuses existing revoke logic |
| 5 | Backend | `UnlinkGoogleResponse` | Yes: App → Browser | Browser | No sensitive data in response |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|------------|-----------------|
| Internet → App | Unlink request | JWT `AuthMiddleware` — userID extracted from validated token |
| App → DB | `auth_provider` update | GORM parameterized query — no SQL injection risk |
| App → Redis | Session revocation | Existing `RevokeAllSessionsExceptCurrent` — already hardened |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker forges request to unlink victim's Google | High | JWT `AuthMiddleware` — only authenticated user can call; userID from token, never from request body |
| T-2 | 1 | Internet → App | Tampering | Attacker replays unlink request | Low | Idempotent: if Google already unlinked, returns 400 gracefully |
| T-3 | 1 | Internet → App | Elevation of Privilege | User without password tries to unlink to create lockout | Medium | Server-side guard: `PasswordHash != ""` checked before proceeding |
| T-4 | 4 | App → Redis/DB | Denial of Service | Flood unlink endpoint to hammer session revocation | Low | Auth required — attacker must have valid JWT; rate limiting on auth endpoints (existing) |
| T-5 | 5 | App → Browser | Information Disclosure | Error response leaks internal user state | Low | Use generic error messages for unexpected failures; specific messages only for known 400 cases |

### Authorization Rules

- Only the authenticated user can unlink their own Google account — `userID` is always extracted from the JWT, never from the request body or URL params.
- No admin-level unlink on behalf of users (out of scope).

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| JWT token | Validated by `AuthMiddleware` | Handler layer |
| userID | Extracted from validated JWT — no user input | Handler layer |
| No request body fields | `UnlinkGoogleRequest` is empty | — |

### External Dependency Risks

- **Google OAuth:** No call to Google APIs needed for unlink — the system does not store OAuth tokens, only validates them at login time. Unlink is purely a DB operation.
- **Redis:** Session revocation uses Redis. If Redis is unavailable, revocation fails — return 500 and do NOT proceed with the `auth_provider` update (atomic: both must succeed or neither).

### Sensitive Data Handling

- No OAuth tokens are stored or transmitted in this flow.
- `auth_provider` field is internal — not returned in error messages.
- Session IDs are internal — not exposed in the unlink response.

### Issues & Risks Summary

1. **Atomicity risk:** `auth_provider` update and session revocation must both succeed or both fail. If session revocation fails, the auth_provider update must be rolled back (or not applied). Use a transaction or apply unlink only after successful revocation.
2. **Race condition:** Two simultaneous unlink requests from the same user. Second call should return 400 ("Google not linked") gracefully — idempotent design handles this.
3. **Client-side guard bypass:** Users can call the API directly even if the button is disabled. Server-side `PasswordHash != ""` check is the authoritative guard.

## Edge Cases & Error Handling

| Case | Expected Behavior |
|------|------------------|
| User has only Google (no password) | Server returns 400. Client-side button disabled. Server is authoritative guard. |
| User calls API twice in quick succession | Second call returns 400 `"Google account is not linked"` — idempotent |
| Redis unavailable during session revocation | Return 500, do NOT update `auth_provider` — user retries |
| User cancels the confirmation dialog | No API call made, state unchanged |
| Network error during API call | Error shown inline in dialog, button re-enables |

## Dependencies & Assumptions

- Existing `RevokeAllSessionsExceptCurrent(ctx, userID, currentSessionID)` logic in `SessionService` can be called from `AuthService` — or the session revocation is done via the session repository directly
- `AuthMiddleware` provides `userID` and current `sessionID` via `gin.Context`
- The `AuthProvider` field format is always one of: `"google"`, `"password"`, `"google+password"`, `"password+google"` — no other values exist in production
- i18n keys for new strings need to be added to both `en` and `vi` locale files

## Out of Scope

- Unlinking password (removing password auth method) — separate future task
- Admin unlinking Google on behalf of a user
- Notifying the user via email when Google is unlinked
- Revoking the Google OAuth grant on Google's side (not needed — tokens are not stored)
- Deleting the user account
