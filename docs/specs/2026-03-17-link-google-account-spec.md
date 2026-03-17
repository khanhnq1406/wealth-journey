# Link Google Account from Security Settings — Specification

## Summary

Add a "Connect Google Account" action to the Security Settings page so that password-only users can link their Google account directly from settings, rather than having to discover the auto-link behavior on the login page. This mirrors the existing "Set Password" flow (which lets Google-only users add a password) and completes the bidirectional auth-method linking.

## User Stories

- As a password-only user, I want to link my Google account from Security Settings, so that I can sign in with either method.
- As a user viewing my auth methods, I want to see a "Connect Google" action when Google is not linked, so that I know it's possible.

## Functional Requirements

### FR-1: Backend — LinkGoogle Endpoint

A new **protected** endpoint `POST /api/v1/auth/link-google` receives a Google ID token (from the frontend Google OAuth flow) and links it to the currently authenticated user.

**Acceptance criteria:**
- [ ] Validates the Google ID token via `idtoken.Validate`
- [ ] Extracts email from the token and verifies it does not belong to a *different* user (prevents account takeover)
- [ ] If the user's `Email` field is nil (password-only user who registered without email), sets it from the Google token
- [ ] If the user already has an email, verifies it matches the Google email (or the user has no email set)
- [ ] Updates `AuthProvider` to include `"google"` (e.g., `"password"` → `"google+password"`)
- [ ] Updates the user's `Picture` from Google if currently empty
- [ ] Returns success response
- [ ] Returns clear error if Google is already linked (`AuthProvider` already contains `"google"`)
- [ ] Returns clear error if the Google email belongs to another user

### FR-2: Frontend — Connect Google Button in AuthMethodsCard

When `hasGoogle` is `false`, show a "Connect Google" action button in the AuthMethodsCard.

**Acceptance criteria:**
- [ ] Button triggers Google OAuth consent popup (using `@react-oauth/google` GoogleLogin component)
- [ ] On consent success, sends the Google credential token to the new `link-google` endpoint
- [ ] On success, invalidates `EVENT_AuthGetAuthMethods` query to refresh the card
- [ ] On error, displays user-friendly translated error message
- [ ] Loading state shown while request is in progress
- [ ] GoogleOAuthProvider wraps the component (scoped, not global)

### FR-3: i18n Translations

**Acceptance criteria:**
- [ ] English and Vietnamese translations for: button label, success message, error messages
- [ ] Follows existing patterns in `settings.json` under `security` namespace

## Non-Functional Requirements

- **Security**: The endpoint MUST be protected (AuthMiddleware). Google token MUST be validated server-side. Email collision MUST be checked to prevent account takeover.
- **Performance**: No impact — single API call, no new background jobs.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Update Auth Handler description to include `LinkGoogle` endpoint
2. **`docs/architecture/flow-auth.md`** — Add sequence diagram for "Link Google to Password Account" flow

### New Diagrams

None — no new complex domain.

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-auth.md`** — Add a new sequence diagram:

**Link Google to Existing Account:**
- Trigger: User clicks "Connect Google" in Security Settings
- Flow: Frontend → GoogleLogin popup → credential token → `POST /api/v1/auth/link-google` → validate token → check email collision → update auth_provider → return success

## Data Model Changes

No schema changes. The existing `User` model already supports:
- `AuthProvider` field with values like `"google+password"`
- `Email` as nullable `*string`
- `Picture` field

Only field *values* change (e.g., `auth_provider` from `"password"` to `"google+password"`).

## API Changes

### New Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/link-google` | Protected | Link Google account to current user |

**Request:**
```json
{
  "token": "eyJhbGciOi..."
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Google account linked successfully",
  "timestamp": "2026-03-17T..."
}
```

**Error Responses:**
- `400` — Google already linked: `"Google account is already linked"`
- `400` — Email belongs to another user: `"This Google account is linked to a different user"`
- `401` — Invalid/expired Google token: `"Invalid Google token"`

## UI/UX Changes

### AuthMethodsCard Update

Current state (Google row when not linked):
```
[Google Icon] Google Account Linked    [Not Set badge]
```

New state (Google row when not linked):
```
[Google Icon] Google Account Linked    [Not Set badge]  [Connect Google button]
```

When linked:
```
[Google Icon] Google Account Linked    [Linked badge]
```

The "Connect Google" button triggers the Google consent popup inline — no separate form view needed (unlike password which has a full form). On success, the badge updates to "Linked".

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Auth methods display | AuthMethodsCard | `features/auth/components/AuthMethodsCard.tsx` |
| Google OAuth | GoogleLogin from `@react-oauth/google` | Already a dependency |
| Success feedback | Toast/inline status | Use badge update (no modal needed) |
| Error display | Inline error message | Pattern from LinkPasswordForm |
| Button | Button component | `components/Button.tsx` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| None | — | The Google OAuth button can be embedded directly in AuthMethodsCard — no separate form needed since there are no input fields |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | Click "Connect Google" | No | Google OAuth popup | Triggers consent |
| 2 | Google | ID token (JWT) | Yes: Google → Browser | Browser | Contains email, name, picture |
| 3 | Browser | ID token | Yes: Internet → Backend | Backend `/api/v1/auth/link-google` | JWT forwarded |
| 4 | Backend | ID token | Yes: Backend → Google | Google token validator | Server-side validation |
| 5 | Backend | User record | No | PostgreSQL | Update auth_provider, email, picture |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Backend | User request with Google token | AuthMiddleware (JWT) + Google token validation |
| Backend → Google | Token validation API call | TLS, Google client ID verification |
| Backend → Database | User update | Parameterized GORM queries |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 3 | Internet → Backend | Spoofing | Attacker sends fake Google token | High | `idtoken.Validate()` verifies signature + audience |
| T-2 | 3 | Internet → Backend | Tampering | Attacker modifies token email | High | Token is cryptographically signed by Google |
| T-3 | 3 | Internet → Backend | Elevation | Link someone else's Google email to own account | High | Check email doesn't belong to different user |
| T-4 | 3 | Internet → Backend | Repudiation | User claims they didn't link Google | Low | Standard server logging |
| T-5 | 5 | Backend → DB | Information Disclosure | Google token stored in DB | Medium | Don't store the token — only extract claims |

### Authorization Rules

- User MUST be authenticated (AuthMiddleware)
- User can only link Google to their own account (user ID from JWT)
- Cannot link if Google is already linked (idempotency guard)
- Cannot link a Google email that belongs to a different user (account takeover prevention)

### Input Validation Rules

| Field | Validation | Location |
|-------|-----------|----------|
| `token` | Required, non-empty string | Backend handler (binding:"required") |
| Google email | Must not belong to another user | Backend service |
| AuthProvider | Must not already contain "google" | Backend service |

### External Dependency Risks

| Dependency | Risk | Mitigation |
|-----------|------|-----------|
| Google OAuth / `idtoken.Validate` | Google API unavailable | Return clear error to user, no retry loop |
| `@react-oauth/google` | NPM package already in use | No new dependency — already trusted |

### Sensitive Data Handling

- Google ID token: Used transiently for validation, never stored
- Email: May be set on user record if previously nil
- Picture URL: May be updated from Google profile

### Issues & Risks Summary

1. **Account takeover via email collision** — MUST verify Google email doesn't belong to a different user before linking
2. **Race condition** — Two concurrent link requests could theoretically both succeed; mitigated by checking `AuthProvider` contains "google" before updating (database-level conflict unlikely given single-user operation)
3. **Email mismatch** — If user has email set and Google email differs, need clear policy (reject with error)

## Edge Cases & Error Handling

| Case | Handling |
|------|---------|
| Google already linked | Return 400 "Google account is already linked" |
| Google email belongs to different user | Return 400 "This Google account is linked to a different user" |
| User has email, Google email differs | Return 400 "Google email does not match your account email" |
| User has no email (password-only, no email) | Set email from Google token |
| Google token expired/invalid | Return 401 "Invalid Google token" |
| User closes Google popup without consenting | No request sent, no error shown |
| Network error during link request | Frontend shows generic error |

## Dependencies & Assumptions

- `@react-oauth/google` package is already installed
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env variable is already configured
- Google `idtoken.Validate` is already used in the codebase (same validation as login/register)
- AuthMiddleware is already applied to protected routes

## Out of Scope

- Unlinking Google account (removing Google from auth methods)
- Unlinking password (removing password from auth methods)
- Supporting other OAuth providers (GitHub, Facebook, etc.)
- Changing the linked Google account to a different Google account
