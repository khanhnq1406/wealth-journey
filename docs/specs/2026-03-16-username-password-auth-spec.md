# Username & Password Authentication Specification

## Summary

Add username/password authentication as an **additional** login method alongside the existing Google OAuth. Users can register with an email, choose a custom username, and set a strong password. Existing Google OAuth users can link a username/password to their account via Settings. Users can log in with either their email or username plus password.

## User Stories

- As a new user, I want to register with my email, username, and password so that I don't need a Google account to use WealthJourney.
- As a registered user, I want to log in with my email or username and password so that I have a familiar auth experience.
- As an existing Google OAuth user, I want to add a username and password to my account so that I have an alternative login method.
- As a user, I want to see which auth methods are linked to my account so that I know how I can log in.

## Functional Requirements

### FR-1: User Registration (Email/Password)

Users can create a new account by providing:
- **Email** (required, unique, valid format)
- **Username** (required, unique, 3–30 chars, alphanumeric + underscore only)
- **Password** (required, strong: min 10 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
- **Display Name** (required, 1–50 chars)

**Acceptance criteria:**
- [ ] Registration form validates all fields client-side before submission
- [ ] Server-side validation rejects invalid email format, weak password, duplicate email/username
- [ ] Password is hashed with bcrypt (cost 12) before storage — never stored in plaintext
- [ ] On success, user is auto-logged in (JWT issued, session created)
- [ ] On success, default categories are created (same as Google OAuth flow)
- [ ] Duplicate email returns clear error: "Email already registered"
- [ ] Duplicate username returns clear error: "Username already taken"

### FR-2: User Login (Email/Password)

Users can log in with either email or username plus password.

**Acceptance criteria:**
- [ ] Login form accepts an "Email or Username" field + password field
- [ ] Backend identifies whether input is email (contains `@`) or username
- [ ] On match, verifies bcrypt password hash
- [ ] On success, issues JWT token and creates session (same flow as Google OAuth login)
- [ ] On failure, returns generic error: "Invalid credentials" (no distinction between wrong email/username vs wrong password)
- [ ] Failed login does not reveal whether the email/username exists

### FR-3: Account Linking (Google OAuth → Password)

Existing Google OAuth users can add a username and password to their account.

**Acceptance criteria:**
- [ ] "Security" section in Settings page (`/dashboard/settings/security`)
- [ ] Shows current auth methods (Google OAuth linked: yes/no, Password set: yes/no)
- [ ] "Set Username & Password" form: username + password + confirm password
- [ ] If user already has a username, show it as read-only (cannot change username after setting)
- [ ] If user already has a password, show "Change Password" instead (current password + new password + confirm)
- [ ] Server validates password strength and username uniqueness
- [ ] On success, user can now log in with either method

### FR-4: Password Change

Users who have a password set can change it.

**Acceptance criteria:**
- [ ] Requires current password for verification
- [ ] New password must meet strength requirements
- [ ] New password must differ from current password
- [ ] On success, all other sessions are invalidated (security measure)
- [ ] On success, current session remains active with new token

### FR-5: Login/Register Page Updates

Update existing login and register pages to support both methods.

**Acceptance criteria:**
- [ ] Login page: Add email/password form ABOVE Google OAuth button, with "OR" divider
- [ ] Register page: Add email/password registration form ABOVE Google OAuth button, with "OR" divider
- [ ] Both pages are fully translated (EN/VI)
- [ ] Mobile-first responsive design maintained
- [ ] Password field has show/hide toggle

## Non-Functional Requirements

- **Security**: Passwords hashed with bcrypt (cost factor 12). No plaintext storage. Generic error messages to prevent user enumeration.
- **Performance**: bcrypt hashing adds ~250ms per login/register — acceptable for auth operations.
- **Compatibility**: Existing Google OAuth users unaffected. No migration required for existing accounts.

## Architecture Changes (C4)

### Diagrams to Update

1. **`docs/architecture/c4-component-backend.md`** (L3 Backend):
   - Update Auth Handler component to show dual auth support (Google OAuth + Password)
   - Add note about bcrypt password hashing in Auth Service

2. **`docs/architecture/c4-component-frontend.md`** (L3 Frontend):
   - Update Auth feature module to include password-based login/register forms
   - Add Settings Security page component

### New Diagrams

No new L4 code diagram needed — the auth domain is not complex enough (no new models with 3+ relationships).

## Runtime Flow Diagrams

### Flow Diagrams to Update

1. **`docs/architecture/flow-auth.md`**:
   - Add sequence diagram: "Password Registration Flow" — user submits form → handler validates → bcrypt hash → create user → create session → return JWT
   - Add sequence diagram: "Password Login Flow" — user submits email/username + password → handler resolves user → bcrypt compare → create session → return JWT
   - Add sequence diagram: "Account Linking Flow" — authenticated user → set username/password → handler validates → bcrypt hash → update user
   - Add sequence diagram: "Password Change Flow" — authenticated user → verify current password → bcrypt hash new → update user → invalidate other sessions

### New Flow Diagrams

None — all flows belong in the existing `flow-auth.md`.

## Data Model Changes

### User Model (Modify existing)

Add new fields to `src/go-backend/domain/models/user.go`:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `Username` | `string` | `size:30;uniqueIndex`, nullable | Custom username (alphanumeric + underscore, 3–30 chars) |
| `PasswordHash` | `string` | `size:255`, nullable | bcrypt hash of password |
| `AuthProvider` | `string` | `size:20;default:'google';not null` | Auth method: "google", "password", "google+password" |

**Notes:**
- `Username` and `PasswordHash` are nullable because existing Google OAuth users won't have them initially
- `AuthProvider` tracks which methods are linked — useful for UI display and login logic
- `Email` already exists and is unique — no changes needed
- No new table required — extend existing `User` model
- `PasswordHash` is excluded from JSON serialization (`json:"-"`) — never sent to frontend

### Database Migration

- Add `username` column (varchar(30), unique index, nullable)
- Add `password_hash` column (varchar(255), nullable)
- Add `auth_provider` column (varchar(20), default 'google', not null)
- Update existing users: set `auth_provider = 'google'`

## API Changes

### Proto Changes (`api/protobuf/v1/auth.proto`)

#### New RPCs

```protobuf
// Register with email/username/password
rpc RegisterWithPassword(RegisterWithPasswordRequest) returns (RegisterWithPasswordResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/register-password"
    body: "*"
  };
}

// Login with email-or-username + password
rpc LoginWithPassword(LoginWithPasswordRequest) returns (LoginWithPasswordResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/login-password"
    body: "*"
  };
}

// Link username/password to existing account (authenticated)
rpc LinkPassword(LinkPasswordRequest) returns (LinkPasswordResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/link-password"
    body: "*"
  };
}

// Change password (authenticated)
rpc ChangePassword(ChangePasswordRequest) returns (ChangePasswordResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/change-password"
    body: "*"
  };
}

// Get auth methods for current user (authenticated)
rpc GetAuthMethods(GetAuthMethodsRequest) returns (GetAuthMethodsResponse) {
  option (google.api.http) = {
    get: "/api/v1/auth/methods"
  };
}
```

#### New Messages

```protobuf
message RegisterWithPasswordRequest {
  string email = 1;
  string username = 2;
  string password = 3;
  string display_name = 4;
}

message RegisterWithPasswordResponse {
  bool success = 1;
  string message = 2;
  LoginData data = 3;
  string timestamp = 4;
}

message LoginWithPasswordRequest {
  string identifier = 1; // email or username
  string password = 2;
}

message LoginWithPasswordResponse {
  bool success = 1;
  string message = 2;
  LoginData data = 3;
  string timestamp = 4;
}

message LinkPasswordRequest {
  string username = 1;
  string password = 2;
}

message LinkPasswordResponse {
  bool success = 1;
  string message = 2;
  string timestamp = 3;
}

message ChangePasswordRequest {
  string current_password = 1;
  string new_password = 2;
}

message ChangePasswordResponse {
  bool success = 1;
  string message = 2;
  string timestamp = 3;
}

message GetAuthMethodsRequest {}

message GetAuthMethodsResponse {
  bool success = 1;
  string message = 2;
  AuthMethods data = 3;
  string timestamp = 4;
}

message AuthMethods {
  bool has_google = 1;
  bool has_password = 2;
  string username = 3; // empty if no username set
  string email = 4;
}
```

### Updated User Proto (`api/protobuf/v1/auth.proto`)

Add `username` and `auth_provider` to the existing `User` message:

```protobuf
message User {
  int32 id = 1;
  string email = 2;
  string name = 3;
  string picture = 4;
  int64 createdAt = 5;
  int64 updatedAt = 6;
  string preferredCurrency = 7;
  bool conversionInProgress = 8;
  string preferredLanguage = 9;
  bool isAdmin = 10;
  string username = 11;        // NEW: custom username (may be empty)
  string authProvider = 12;    // NEW: "google", "password", "google+password"
}
```

### API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register-password` | Public | Register with email/username/password |
| POST | `/api/v1/auth/login-password` | Public | Login with email-or-username + password |
| POST | `/api/v1/auth/link-password` | Required | Link password to existing account |
| POST | `/api/v1/auth/change-password` | Required | Change existing password |
| GET | `/api/v1/auth/methods` | Required | Get linked auth methods |

## UI/UX Changes

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Text input fields | `FormInput` | `components/forms/FormInput.tsx` |
| Password input with toggle | **NEW** — `PasswordInput` | `features/auth/components/PasswordInput.tsx` |
| Form validation | Zod + react-hook-form | Already used across app |
| Submit button | `Button` | `components/Button.tsx` |
| Error display | Inline error styling | Already used in login/register pages |
| Success feedback | `Success` component | `components/modals/Success.tsx` |
| Loading spinner | `LoadingSpinner` | `components/loading/LoadingSpinner.tsx` |
| Base modal | `BaseModal` | `components/modals/BaseModal.tsx` |
| Settings page layout | Existing settings pages | `app/[locale]/dashboard/settings/` |

### New Components

| Component | Location | Justification |
|-----------|----------|---------------|
| `PasswordInput` | `features/auth/components/PasswordInput.tsx` | Wraps `FormInput` with show/hide toggle and strength indicator. Reusable across login, register, link, and change password forms. |
| `PasswordStrengthIndicator` | `features/auth/components/PasswordStrengthIndicator.tsx` | Visual strength meter (weak/medium/strong/very strong). Used in registration and password change forms. |
| `RegisterPasswordForm` | `features/auth/forms/RegisterPasswordForm.tsx` | Registration form with email, username, display name, password, confirm password. |
| `LoginPasswordForm` | `features/auth/forms/LoginPasswordForm.tsx` | Login form with identifier (email/username) + password. |
| `LinkPasswordForm` | `features/auth/forms/LinkPasswordForm.tsx` | Form for linking password to existing Google account. |
| `ChangePasswordForm` | `features/auth/forms/ChangePasswordForm.tsx` | Form for changing existing password. |
| `AuthMethodsCard` | `features/auth/components/AuthMethodsCard.tsx` | Displays linked auth methods (Google, Password) with link/change actions. |
| `SecuritySettings` | `app/[locale]/dashboard/settings/security/page.tsx` | Settings page for security (auth methods, password management). |

### Page Changes

#### Login Page (`app/[locale]/auth/login/page.tsx`)

**Layout (top to bottom):**
1. Title: "Welcome back" / "Chào mừng trở lại"
2. Subtitle: "Sign in to continue your financial journey"
3. **NEW**: `LoginPasswordForm` (email/username + password fields + submit button)
4. **NEW**: "OR" divider line
5. **EXISTING**: Google OAuth button
6. "New to congdongvang.com?" → Create account link
7. Terms & Privacy footer

#### Register Page (`app/[locale]/auth/register/page.tsx`)

**Layout (top to bottom):**
1. Title: "Start your journey" / "Bắt đầu hành trình"
2. Subtitle: "Create your free account in seconds"
3. **NEW**: `RegisterPasswordForm` (email, username, display name, password, confirm password + submit button)
4. **NEW**: "OR" divider line
5. **EXISTING**: Google OAuth button
6. Feature highlights (Free Forever, Bank-Level Security, No Credit Card)
7. "Already have an account?" → Sign in link
8. Terms & Privacy footer

#### Settings Security Page (`app/[locale]/dashboard/settings/security/page.tsx`) — NEW

**Layout:**
1. Page title: "Security" / "Bảo mật"
2. `AuthMethodsCard` showing:
   - Google OAuth: linked (green badge) / not linked (gray)
   - Password: set (green badge) / not set → "Set Password" button
   - Username: displayed if set
3. If password not set: `LinkPasswordForm` in a section
4. If password set: `ChangePasswordForm` accessible via "Change Password" button

### Translations (i18n)

New keys needed in `messages/{locale}/auth.json`:

```json
{
  "auth": {
    "login": {
      "emailOrUsername": "Email or Username",
      "emailOrUsernamePlaceholder": "Enter your email or username",
      "password": "Password",
      "passwordPlaceholder": "Enter your password",
      "signIn": "Sign In",
      "orDivider": "OR",
      "invalidCredentials": "Invalid email/username or password",
      "forgotPassword": "Forgot password?"
    },
    "register": {
      "email": "Email",
      "emailPlaceholder": "Enter your email",
      "username": "Username",
      "usernamePlaceholder": "Choose a username",
      "displayName": "Display Name",
      "displayNamePlaceholder": "Enter your display name",
      "password": "Password",
      "passwordPlaceholder": "Create a password",
      "confirmPassword": "Confirm Password",
      "confirmPasswordPlaceholder": "Re-enter your password",
      "createAccount": "Create Account",
      "orDivider": "OR",
      "emailTaken": "Email already registered",
      "usernameTaken": "Username already taken",
      "passwordRequirements": "Min 10 characters: 1 uppercase, 1 lowercase, 1 number, 1 special character",
      "passwordsDoNotMatch": "Passwords do not match"
    },
    "security": {
      "title": "Security",
      "authMethods": "Authentication Methods",
      "googleLinked": "Google Account Linked",
      "passwordSet": "Password Set",
      "notSet": "Not Set",
      "setPassword": "Set Password",
      "changePassword": "Change Password",
      "username": "Username",
      "currentPassword": "Current Password",
      "newPassword": "New Password",
      "confirmNewPassword": "Confirm New Password",
      "passwordChanged": "Password changed successfully",
      "passwordLinked": "Password and username set successfully",
      "allSessionsRevoked": "All other sessions have been logged out for security"
    },
    "passwordStrength": {
      "weak": "Weak",
      "medium": "Medium",
      "strong": "Strong",
      "veryStrong": "Very Strong"
    }
  }
}
```

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | Registration form (email, username, password, displayName) | Yes: Internet → App | Auth Handler | Untrusted input, password in plaintext over TLS |
| 2 | User (browser) | Login form (identifier, password) | Yes: Internet → App | Auth Handler | Untrusted input, password in plaintext over TLS |
| 3 | Auth Handler | Validated email/username | No (same tier) | Auth Service | Validated by handler |
| 4 | Auth Service | bcrypt hash operation | No (same tier) | bcrypt library | CPU-bound, ~250ms |
| 5 | Auth Service | User model (with password_hash) | Yes: App → DB | PostgreSQL | GORM parameterized query |
| 6 | Auth Service | Session data | Yes: App → Redis | Redis | Session token storage |
| 7 | Auth Handler | JWT + user data | Yes: App → Internet | User (browser) | Response over TLS |
| 8 | User (browser) | Link/Change password form | Yes: Internet → App | Auth Handler | Requires existing JWT auth |
| 9 | Auth Service | Invalidate sessions (password change) | Yes: App → Redis | Redis | Delete all other session keys |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → Application | Registration/login requests | Input validation, bcrypt hashing, TLS |
| Internet → Application | Link/change password requests | JWT auth + input validation |
| Application → Database | User queries/inserts | GORM parameterized queries, ownership check |
| Application → Redis | Session storage/deletion | Redis auth, TLS connection |
| Application → Internet | JWT response | Signed JWT, no password_hash in response |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1, 2 | Internet → App | Spoofing | Attacker uses stolen credentials | High | bcrypt slow hashing, generic error messages prevent enumeration |
| T-2 | 1, 2 | Internet → App | Tampering | Attacker modifies request body | Medium | TLS encryption, server-side validation |
| T-3 | 1, 2 | Internet → App | Repudiation | User denies registration/login | Low | Session audit trail in DB, timestamps |
| T-4 | 1, 2 | Internet → App | Info Disclosure | Error messages reveal user existence | High | Generic "Invalid credentials" message for all login failures |
| T-5 | 1, 2 | Internet → App | DoS | Brute force login attempts | Medium | User chose no rate limiting — document as accepted risk |
| T-6 | 1, 2 | Internet → App | Elevation | Attacker registers with admin email | Medium | Admin flag is DB-only, cannot be set via registration |
| T-7 | 5 | App → DB | Tampering | SQL injection in email/username | Low | GORM parameterized queries |
| T-8 | 5 | App → DB | Info Disclosure | Password hash leaked via query | Medium | `json:"-"` tag on PasswordHash, never include in API responses |
| T-9 | 7 | App → Internet | Info Disclosure | JWT contains sensitive data | Low | JWT only contains userID, email, sessionID — no password data |
| T-10 | 8 | Internet → App | Spoofing | Attacker uses stolen JWT to link password | Medium | JWT validation + session check |
| T-11 | 9 | App → Redis | Tampering | Attacker prevents session invalidation | Low | Redis auth required, server-side only |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated |
|-----------|-------|------------|-----------------|
| Register (password) | N/A | N/A | Allowed |
| Login (password) | N/A | N/A | Allowed |
| Link password | Allowed (self only) | Denied | Denied |
| Change password | Allowed (self only) | Denied | Denied |
| Get auth methods | Allowed (self only) | Denied | Denied |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|-------------|----------------------|
| email | string | Valid email format, max 100 chars | Required, regex, unique check |
| username | string | 3–30 chars, `^[a-zA-Z0-9_]+$` | Required, regex, unique check |
| password | string | Min 10 chars, 1 upper, 1 lower, 1 digit, 1 special | Required, complexity check |
| display_name | string | 1–50 chars | Required, trimmed, max length |
| identifier | string | Email or username format | Required, max 100 chars |
| current_password | string | Non-empty | Required for password change |
| new_password | string | Same as password rules | Required, must differ from current |

### External Dependency Risks

| Dependency | Version | Risk | Mitigation |
|------------|---------|------|------------|
| `golang.org/x/crypto/bcrypt` | Latest | Well-maintained, Go standard extended library | Pin version in go.mod |
| No new npm packages | N/A | N/A | Reuse existing form/UI components |

### Sensitive Data Handling

| Data | Classification | Protection |
|------|---------------|------------|
| Password (plaintext) | Restricted | Never stored, hashed immediately with bcrypt cost 12 |
| Password hash | Confidential | Stored in DB, excluded from all API responses (`json:"-"`) |
| Username | Internal | Stored in DB, visible to account owner only |
| Email | Internal | Already exists in system, no change |

### Data Classification

| Data Field | Sensitivity | Protection Required |
|------------|------------|-------------------|
| `password` (input) | Restricted | TLS in transit, hash immediately, never log |
| `password_hash` | Confidential | DB-only, `json:"-"`, never in API response |
| `username` | Internal | Unique constraint, visible to owner only |
| `auth_provider` | Internal | Read-only for frontend display |

### Accepted Risks

| Risk | Severity | Justification |
|------|----------|---------------|
| No rate limiting on login | Medium | User explicitly chose no rate limiting. Can be added later. Document in README. |
| No email verification | Low | User explicitly chose no verification for now. Account is immediately active. |
| No password reset | Low | User explicitly deferred. Users who forget password can still login via Google OAuth if linked. |

### Issues & Risks Summary

1. **No brute force protection** — Without rate limiting, attackers can attempt unlimited password guesses. Accepted risk per user decision.
2. **No email verification** — Accounts created with unverified emails. Low risk since no email-dependent features.
3. **No password reset** — Users who forget password and don't have Google linked are locked out. Accepted deferral.
4. **bcrypt timing** — ~250ms per hash. Under high load, registration/login could be slow. Acceptable for auth operations.
5. **Username immutability** — Once set, username cannot be changed. This is by design to prevent confusion.

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| Register with existing email | Return "Email already registered" error |
| Register with existing username | Return "Username already taken" error |
| Login with non-existent email/username | Return generic "Invalid credentials" (no enumeration) |
| Login with wrong password | Return generic "Invalid credentials" |
| Link password when already linked | Return "Password already set. Use change password instead." |
| Change password with wrong current password | Return "Current password is incorrect" |
| Change password to same as current | Return "New password must differ from current password" |
| Google OAuth login with email that has password account | Normal Google login — auth_provider updated to "google+password" |
| Password register with email that has Google account | Return "Email already registered. Login with Google and link a password in Settings." |
| Username with special characters | Reject with validation error |
| Empty/whitespace-only inputs | Reject with validation error |
| Very long password (>72 chars) | bcrypt truncates at 72 bytes — accept but warn user that only first 72 chars are used |

## Dependencies & Assumptions

- **bcrypt**: Using `golang.org/x/crypto/bcrypt` — well-maintained, Go standard extended library
- **No new frontend packages needed** — reuse existing form components and validation (Zod + react-hook-form)
- **Existing session infrastructure** — JWT + Redis sessions work identically for password-based auth
- **Database migration** — Adding nullable columns to existing `user` table, no data loss
- **TLS** — Assumes all connections are over HTTPS (Railway + Vercel deployment)

## Out of Scope

- Password reset / "Forgot password" flow (deferred)
- Email verification (deferred)
- Rate limiting on auth endpoints (user decision)
- Two-factor authentication (2FA)
- OAuth providers other than Google (Facebook, GitHub, etc.)
- Username change after initial set
- Account merging (if someone registers with password using same email as existing Google account)
