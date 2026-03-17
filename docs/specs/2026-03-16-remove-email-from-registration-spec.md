# Remove Email from Password Registration — Specification

## Summary

Remove the email field from password registration. Users register with username + display name + password only. Email becomes nullable in the database — password-only users have no email until they link a Google account via the Security page. As a prerequisite, the entire session system must be migrated from email-keyed to userID-keyed, since password-only users won't have an email to key sessions on.

## User Stories

- As a new user, I want to register with just a username and password, so that I can start using the app without needing an email address.
- As a password-only user, I want to optionally link my Google account later, so that I get an email associated with my account and can use Google OAuth login.
- As an existing Google user, I want my session to keep working after this refactor, so that nothing breaks for me.

## Functional Requirements

### FR-1: Remove Email from Registration Form
The password registration form becomes a single-step form with 4 fields: username, display name, password, confirm password. No email field.

**Acceptance criteria:**
- [ ] Register form has no email field
- [ ] Form is a single step (no wizard)
- [ ] Form validates: username (3-30 chars, alphanumeric + underscore), display name (required, max 100), password (10-72 chars), confirm password (must match)
- [ ] Successful registration logs user in and redirects to dashboard

### FR-2: Make Email Nullable in Database
Email becomes optional (`*string`, nullable, unique if present).

**Acceptance criteria:**
- [ ] Migration removes NOT NULL constraint from email column
- [ ] Unique index on email only applies to non-NULL values (partial index)
- [ ] Existing users with email are unaffected
- [ ] New password-only users have NULL email

### FR-3: Migrate Session System from Email to UserID
All Redis session keys and JWT-based lookups switch from email to userID.

**Acceptance criteria:**
- [ ] Redis session key pattern changes from `session:<email>` to `session:user:<userID>`
- [ ] All Redis session functions use `userID int32` instead of `email string`
- [ ] JWT claims keep UserID as primary identifier (email becomes optional)
- [ ] VerifyAuth looks up user by ID, not email
- [ ] Logout, session list, session revoke all use userID
- [ ] Session cleanup job uses userID
- [ ] Existing sessions are invalidated (users must re-login after deployment — acceptable for this migration)

### FR-4: Update Backend Registration Endpoint
Remove email from `RegisterWithPasswordRequest` proto message and all backend handlers/services.

**Acceptance criteria:**
- [ ] Proto message has no email field
- [ ] Handler does not expect email in request body
- [ ] Auth service creates user with NULL email
- [ ] Username uniqueness check still works
- [ ] Auth provider set to "password"

### FR-5: Login Behavior for Password-Only Users
Password-only users log in with username only. The identifier field still accepts email for Google-linked users.

**Acceptance criteria:**
- [ ] Login with username + password works for password-only users
- [ ] Login with email + password still works for users who have an email (Google-linked or legacy)
- [ ] Login form label/placeholder updated to reflect "Username" as primary (currently says "Email or Username")

### FR-6: Update i18n Translations
Remove email-related registration keys, update login hints.

**Acceptance criteria:**
- [ ] `auth.register.email` and `auth.register.emailPlaceholder` removed from EN and VI
- [ ] `auth.register.errors.emailAlreadyRegistered` removed
- [ ] No broken translation references

## Non-Functional Requirements

- **Performance**: No impact — userID lookups are indexed (primary key). Redis key change is transparent.
- **Security**: No regression — bcrypt hashing, generic error messages, authorization checks all preserved.
- **Backwards Compatibility**: Existing Google OAuth users unaffected. All active sessions will be invalidated by the Redis key migration (acceptable one-time cost).
- **Migration Safety**: Database migration must be idempotent and safe for rollback.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** — Update Auth Service description: "Supports username/password registration (no email required) and Google OAuth. Sessions keyed by userID."
2. **`docs/architecture/flow-auth.md`** — Update "Password Register" sequence diagram to remove email from the flow. Update "Password Login" to note username-only for password users.

### New Diagrams
None needed — no new components or domains.

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-auth.md`** — "Password Register" sequence: remove email validation and email uniqueness check steps. "Password Login" sequence: clarify username-first lookup for password users.

### New Flow Diagrams
None needed.

## Data Model Changes

### User Model (`models/user.go`)
```go
// Before:
Email string `gorm:"uniqueIndex;size:100;not null" json:"email"`

// After:
Email *string `gorm:"size:100;uniqueIndex" json:"email,omitempty"`
```

The unique index must be a partial index (only enforces uniqueness on non-NULL values), same pattern used for Username.

### Migration
```sql
-- Remove NOT NULL constraint
ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL;

-- Replace unique index with partial unique index
DROP INDEX IF EXISTS idx_user_email;
CREATE UNIQUE INDEX idx_user_email ON "user" (email) WHERE email IS NOT NULL;
```

## API Changes

### Proto: `RegisterWithPasswordRequest`
```protobuf
// Before:
message RegisterWithPasswordRequest {
  string email = 1 [json_name = "email"];
  string username = 2 [json_name = "username"];
  string password = 3 [json_name = "password"];
  string display_name = 4 [json_name = "displayName"];
}

// After:
message RegisterWithPasswordRequest {
  string username = 2 [json_name = "username"];
  string password = 3 [json_name = "password"];
  string display_name = 4 [json_name = "displayName"];
}
```

Field number 1 is removed (reserved in proto3 — does not break wire compatibility).

### Redis Session Key Pattern
```
// Before: session:<email>
// After:  session:user:<userID>
```

### JWT Claims
```go
// Email field becomes optional (empty string for password-only users)
// UserID remains the primary identifier (already present)
```

## UI/UX Changes

### Register Page
- Password form becomes single-step (was 2-step wizard)
- Fields: username, display name, password, confirm password
- No email field
- Google OAuth remains primary registration method (unchanged)

### Login Page
- No changes needed — identifier field already accepts both email and username
- Update placeholder text from "Email or Username" to "Username" since password-only users won't have email login

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Form inputs | FormInput | `components/forms/FormInput.tsx` |
| Password input | PasswordInput | `features/auth/components/PasswordInput.tsx` |
| Password strength | PasswordStrengthIndicator | `features/auth/components/PasswordStrengthIndicator.tsx` |
| Register form | RegisterPasswordForm (MODIFY) | `features/auth/forms/RegisterPasswordForm.tsx` |
| Login form | LoginPasswordForm (MODIFY placeholder only) | `features/auth/forms/LoginPasswordForm.tsx` |

### New Components
None — all changes are modifications to existing components.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Browser | username, displayName, password | Yes: Internet → App | RegisterWithPassword handler | No email in payload |
| 2 | Handler | validated fields | No | Auth Service | Internal |
| 3 | Auth Service | username, passwordHash | No | PostgreSQL | User creation with NULL email |
| 4 | Auth Service | userID, sessionID | No | Redis | Session keyed by userID |
| 5 | Redis/JWT | userID, sessionID | No | VerifyAuth | User lookup by ID |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Registration request | Input validation (username regex, password strength) |
| App → Database | User creation | Parameterized queries, bcrypt hash, unique constraint |
| App → Redis | Session creation | UserID from DB (trusted), session ID generated server-side |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | Spoofing | Attacker registers with someone else's username | Low | Username uniqueness enforced at DB level |
| T-2 | 1 | Internet → App | Tampering | Bypass client-side validation | Low | Server-side validation in auth service |
| T-3 | 4 | App → Redis | Info Disclosure | Redis key pattern reveals userID | Low | UserID is already in JWT (not secret) |
| T-4 | 5 | Redis → App | Elevation | Session for wrong user | Low | SessionID is cryptographically random; verified against userID set |

### Authorization Rules
- Registration: Public (no auth required)
- Login: Public (no auth required)
- Link Google: Requires auth (existing user only)
- All session operations: Require auth, scoped to authenticated user's ID

### Input Validation Rules
- Username: 3-30 chars, `^[a-zA-Z0-9_]+$`, unique (server-side)
- Display name: 1-100 chars (server-side)
- Password: 10-72 chars, strength requirements (server-side)
- No email validation needed for registration

### Sensitive Data Handling
- Password: bcrypt hashed (cost 12), never stored in plaintext, never in responses (`json:"-"`)
- No change to existing security measures

### Issues & Risks Summary
1. **Redis key migration**: All existing sessions will be invalidated. Users must re-login after deployment. Acceptable one-time cost.
2. **Email-based lookups in auth service**: `VerifyAuth` and `GetAuth` currently do `WHERE email = ?`. Must change to `WHERE id = ?`. If email is NULL, email-based lookup would fail.
3. **NULL email in JWT claims**: `generateLoginResponse` puts `user.Email` in JWT. For password-only users this will be empty string. All code using `claims.Email` must handle this.
4. **Session cleanup job**: Currently looks up user by ID to get email, then removes Redis session by email. Must switch to userID-based removal.

## Edge Cases & Error Handling

1. **Password-only user tries email login**: Login with `@` in identifier triggers email lookup → user not found (NULL email) → generic "Invalid credentials" error. Correct behavior.
2. **Google user links password, then tries username login**: Works — username is set during LinkPassword. The `@`-detection routes to email lookup for email identifiers and username lookup for non-email identifiers.
3. **Two password-only users**: Both have NULL email. Partial unique index allows multiple NULLs. Username uniqueness prevents collision.
4. **Password-only user links Google**: Email gets populated via Google OAuth. User can now log in with email too.
5. **Migration rollback**: If migration fails, email stays NOT NULL. No data loss.

## Dependencies & Assumptions

- Assumes all active sessions can be invalidated (one-time migration cost)
- Assumes the `user_id` field already exists in middleware context (`c.Set("user_id", ...)` confirmed)
- Assumes proto field number removal (field 1) is safe in proto3 (it is — proto3 ignores unknown fields)

## Out of Scope

- Email verification flow (not currently implemented, not adding)
- "Forgot password" / password reset (would need email — deferred until email linking is more common)
- Migrating existing whitelist functions (dead code — can clean up separately)
- Changing the `GetAuth` endpoint behavior (will adapt to use userID instead of email)
