# Authentication Domain — Runtime Flows

Authentication and session management flows covering Google OAuth, JWT token lifecycle, and multi-device session tracking. Redis is the source of truth for active sessions; PostgreSQL serves as an audit trail.

## Table of Contents

- [Google OAuth Register/Login](#1-google-oauth-registerlogin)
- [JWT Validation Middleware Chain](#2-jwt-validation-middleware-chain)
- [Session Lifecycle](#3-session-lifecycle)
- [Password Registration](#4-password-registration)
- [Password Login](#5-password-login)
- [Link Password (Account Linking)](#6-link-password-account-linking)
- [Change Password](#7-change-password)
- [Link Google (Account Linking)](#8-link-google-account-linking)

---

## 1. Google OAuth Register/Login

**Trigger:** User clicks "Sign in with Google" in the SPA
**Endpoint:** `POST /api/v1/auth/register` or `POST /api/v1/auth/login`
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Handler as AuthHandler
    participant Google as Google OAuth API
    participant Auth as AuthService
    participant UserRepo as UserRepository
    participant CatSvc as CategoryService
    participant Redis
    participant DB as PostgreSQL

    Browser->>SPA: Click "Sign in with Google"
    SPA->>Google: OAuth consent flow
    Google-->>SPA: Google ID token

    SPA->>Handler: POST /api/v1/auth/register<br/>{token: "google_id_token"}
    Handler->>Handler: ExtractDeviceInfo(c)<br/>User-Agent, IP address

    activate Auth
    Handler->>Auth: RegisterWithDevice(ctx, token, deviceInfo)
    Auth->>Google: idtoken.Validate(token, clientID)

    alt Invalid token
        Google-->>Auth: Error
        Auth-->>Handler: "invalid Google token"
        Handler-->>SPA: 400 Bad Request
    end

    Google-->>Auth: Claims: email, name, picture
    Auth->>UserRepo: GetByEmail(email)

    alt User exists (redirect to login)
        UserRepo-->>Auth: User found
        Auth->>Auth: generateLoginResponse(user, deviceInfo)
    else User not found (new registration)
        UserRepo-->>Auth: ErrRecordNotFound
        Auth->>UserRepo: Create(User{email, name, picture})
        UserRepo-->>Auth: Created user

        opt CategoryService available
            Auth->>CatSvc: CreateDefaultCategories(userID)
            Note over Auth,CatSvc: Failure logged as warning,<br/>does not block registration
        end

        Auth->>Auth: generateLoginResponse(user, deviceInfo)
    end

    Note over Auth: Generate session

    Auth->>Auth: sessionID = UUID.New()
    Auth->>Auth: JWT{userID, email, sessionID, exp: +7d}
    Auth->>Auth: jwt.Sign(claims, HS256, secret)

    par Store in Redis (source of truth)
        Auth->>Redis: SAdd(session:user:{userID}, sessionID)
        Auth->>Redis: Set(session_meta:{sessionID}, metadata, 7d)
        Auth->>Redis: Set(session_token:{sessionID}, jwt, 7d)
    and Store in PostgreSQL (audit trail)
        Auth->>DB: Create(Session{sessionID, userID, device...})
        Note over Auth,DB: DB failure logged as warning,<br/>does not block response
    end

    deactivate Auth

    Auth-->>Handler: {accessToken, email, name, picture}
    Handler-->>SPA: 200 OK + accessToken
    SPA->>Browser: Store token in localStorage<br/>Redirect to dashboard
```

### Key Invariants

- Google token is validated against the configured `clientID` — tokens from other apps are rejected
- If a user already exists during registration, the flow silently redirects to login (no error)
- Redis is the authoritative session store; PostgreSQL is best-effort backup
- Session TTL is 7 days from creation (both Redis keys and JWT expiration)
- Default categories are created for new users but failures don't block registration

### Locale Sync After Login

After the SPA receives the auth response and stores the JWT token, the client performs locale synchronization:

1. Client reads `preferredLanguage` from the auth response
2. Client sets the `wj-locale` cookie to the user's `preferredLanguage`
3. If the current URL locale does not match `preferredLanguage`, the client redirects to `/{preferredLanguage}/dashboard/home`

This ensures the UI language matches the user's stored preference immediately after login. See [i18n Flows](flow-i18n.md) for the full locale detection and language switch diagrams.

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing/empty token in body | 400 Bad Request | None |
| Invalid Google token (expired/wrong audience) | 400 error | None |
| Database error on user lookup | 500 Internal | None |
| Failed to create new user | 500 Internal | None |
| JWT signing failure | 500 Internal | None |
| Redis session storage failure | 500 Internal | User created but no session |
| PostgreSQL session insert failure | Warning logged | Redis session still valid |

---

## 2. JWT Validation Middleware Chain

**Trigger:** Any request to a protected route passes through `AuthMiddleware`
**Source:** `pkg/middleware/auth.go`, `domain/auth/auth.go`

```mermaid
flowchart TD
    A["Incoming HTTP Request\n(Protected Route)"] --> B["Extract Authorization header"]
    B --> C{Header present?}
    C -- No --> D["401 Unauthorized\nc.Abort()"]:::error
    C -- Yes --> E{"Starts with\n'Bearer '?"}
    E -- No --> D
    E -- Yes --> F["Extract token string"]

    F --> G["jwt.ParseWithClaims(token, secret)"]
    G --> H{Signature valid?\nNot expired?}
    H -- No --> I["401 Invalid token\nc.Abort()"]:::error
    H -- Yes --> J["Extract: userID, email, sessionID"]

    J --> K["Redis: SIsMember\n(session:user:{userID}, sessionID)"]
    K --> L{Session exists\nin Redis?}
    L -- No --> M["401 Session expired/revoked\nc.Abort()"]:::error
    L -- Yes --> N["Redis: Get\n(session_token:{sessionID})"]

    N --> O{Token matches\nstored token?}
    O -- No --> P["401 Token mismatch\nc.Abort()"]:::error
    O -- Yes --> Q["Update lastActiveAt\nin Redis (async)"]

    Q --> R["Fetch user from DB"]
    R --> S{User exists?}
    S -- No --> T["401 User not found\nc.Abort()"]:::error
    S -- Yes --> U["Set context:\nuser_id, user_email, user_name"]
    U --> V["c.Next()\nContinue to handler"]

    classDef error fill:#fee,stroke:#c00,color:#900
```

### Key Invariants

- Multi-layer validation: JWT signature + Redis session existence + exact token match + user existence
- Token mismatch detection prevents replay of old tokens after re-login (new login generates new token for same session ID)
- `lastActiveAt` update is best-effort — failure doesn't block the request
- Middleware sets `user_id`, `user_email`, and `user_name` in the Gin context for downstream handlers

### Unprotected Routes

These routes skip the middleware entirely:
- `POST /api/v1/auth/register` (Google OAuth)
- `POST /api/v1/auth/login` (Google OAuth)
- `POST /api/v1/auth/register-password` (username/password)
- `POST /api/v1/auth/login-password` (username or email/password)
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/verify` (uses header OR query param)

---

## 3. Session Lifecycle

**Trigger:** Login creates a session; logout/revoke/expiration destroys it
**Source:** `handlers/session.go`, `domain/auth/auth.go`

```mermaid
stateDiagram-v2
    [*] --> Created: Login/Register<br/>POST /auth/login

    Created --> Active: First request with token<br/>Middleware validates

    Active --> Active: Subsequent requests<br/>lastActiveAt updated

    Active --> RevokedByUser: DELETE /sessions/:id<br/>User revokes from another device

    Active --> RevokedBulk: DELETE /sessions<br/>Revoke all except current

    Active --> LoggedOut: POST /auth/logout<br/>User explicitly logs out

    Active --> Expired: Redis TTL (7 days)<br/>No activity within window

    RevokedByUser --> [*]
    RevokedBulk --> [*]
    LoggedOut --> [*]
    Expired --> [*]

    note right of Created
        Redis: session set + metadata + token
        PostgreSQL: Session row (audit)
    end note

    note right of RevokedByUser
        Guard: cannot revoke own current session
        Must use logout instead
    end note

    note left of Active
        Multi-layer validation on every request:
        1. JWT signature
        2. Redis session exists
        3. Token matches stored token
        4. User exists in DB
    end note
```

### Session Operations

| Operation | Endpoint | Self-Session? | Effect |
|-----------|----------|---------------|--------|
| **List** | `GET /sessions` | Marked with `isCurrent: true` | Read-only, returns all active sessions |
| **Revoke one** | `DELETE /sessions/:id` | Blocked (400 error) | Removes from Redis; DB best-effort |
| **Revoke all** | `DELETE /sessions` | Preserved (kept active) | Removes all others; partial failure logged |
| **Logout** | `POST /auth/logout` | Yes (self only) | Removes current session from Redis + DB |

### Redis Data Structures

```
session:user:<userID>       → Redis Set of session IDs (TTL: 7d)
session_meta:<sessionID>    → JSON {deviceName, deviceType, ip, createdAt, lastActiveAt, expiresAt} (TTL: 7d)
session_token:<sessionID>   → JWT string for exact-match validation (TTL: 7d)
```

### Error Paths

| Condition | Response | Recovery |
|-----------|----------|----------|
| Revoke own current session | 400 "Use logout instead" | User uses logout endpoint |
| Session not found / not owned | 404 "Session not found" | Stale UI; refresh session list |
| Redis removal partially fails | Error returned | Session may remain active |
| Revoke-all: some sessions fail | Warning logged per session | Successful count returned |
| DB delete fails on logout | Warning logged | Redis removal still succeeds |

---

## 4. Password Registration

**Trigger:** User submits the registration form with username, display name, and password
**Endpoint:** `POST /api/v1/auth/register-password`
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Handler as AuthHandler
    participant Auth as AuthService
    participant UserRepo as UserRepository
    participant CatSvc as CategoryService
    participant Redis
    participant DB as PostgreSQL

    Browser->>SPA: Submit registration form
    SPA->>Handler: POST /api/v1/auth/register-password<br/>{username, password, displayName}
    Handler->>Handler: ExtractDeviceInfo(c)

    activate Auth
    Handler->>Auth: RegisterWithPassword(ctx, req, deviceInfo)
    Auth->>Auth: Validate username, password, displayName
    alt Validation fails
        Auth-->>Handler: 400 Validation error
        Handler-->>SPA: Error message
    end

    Auth->>UserRepo: GetByUsername(username)
    alt Username exists
        UserRepo-->>Auth: User found
        Auth-->>Handler: 409 "Username already taken"
    end

    Auth->>Auth: bcrypt.GenerateFromPassword(password, cost=12)
    Auth->>UserRepo: Create(User{name, username, passwordHash, authProvider="password"})
    Note over Auth: Email is NULL for password-only users

    opt CategoryService available
        Auth->>CatSvc: CreateDefaultCategories(userID)
    end

    Auth->>Auth: generateLoginResponse(user, deviceInfo)
    Auth->>Redis: Store session (same as Google OAuth)
    Auth->>DB: Create Session record
    deactivate Auth

    Auth-->>Handler: {accessToken, email, name, picture}
    Handler-->>SPA: 200 OK + accessToken
    SPA->>Browser: Store token, redirect to dashboard
```

### Key Invariants

- Password is hashed with bcrypt cost 12 before storage
- Email is not required — password-only users have NULL email
- Username uniqueness checked before creation
- Username is case-sensitive, 3-30 chars, alphanumeric + underscore only
- Password requires 10-72 chars (72 is bcrypt limit)
- Same session creation flow as Google OAuth

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Invalid username/password format | 400 Validation error | None |
| Username already taken | 409 Conflict | None |
| bcrypt hashing failure | 500 Internal | None |
| Database error on user creation | 500 Internal | None |

---

## 5. Password Login

**Trigger:** User submits login form with email/username and password
**Endpoint:** `POST /api/v1/auth/login-password`
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Handler as AuthHandler
    participant Auth as AuthService
    participant UserRepo as UserRepository
    participant Redis
    participant DB as PostgreSQL

    Browser->>SPA: Submit login form
    SPA->>Handler: POST /api/v1/auth/login-password<br/>{identifier, password}
    Handler->>Handler: ExtractDeviceInfo(c)

    activate Auth
    Handler->>Auth: LoginWithPassword(ctx, req, deviceInfo)

    Auth->>Auth: Determine: identifier contains '@'?
    alt Email login
        Auth->>UserRepo: GetByEmail(identifier)
    else Username login
        Auth->>UserRepo: GetByUsername(identifier)
    end

    alt User not found
        UserRepo-->>Auth: nil
        Auth-->>Handler: 401 "Invalid credentials"
        Note over Auth: Generic error — no user enumeration
    end

    Auth->>Auth: Check user.PasswordHash != ""
    alt No password set
        Auth-->>Handler: 401 "Invalid credentials"
        Note over Auth: Generic error — no enumeration
    end

    Auth->>Auth: bcrypt.CompareHashAndPassword(hash, password)
    alt Password mismatch
        Auth-->>Handler: 401 "Invalid credentials"
        Note over Auth: Generic error — no enumeration
    end

    Auth->>Auth: generateLoginResponse(user, deviceInfo)
    Auth->>Redis: Store session
    Auth->>DB: Create Session record
    deactivate Auth

    Auth-->>Handler: {accessToken, email, name, picture}
    Handler-->>SPA: 200 OK + accessToken
    SPA->>Browser: Store token, redirect to dashboard
```

### Key Invariants

- **No user enumeration**: All failure cases return the same generic "Invalid credentials" error
- Identifier is treated as email if it contains `@`, otherwise as username
- Users with Google-only auth (no password) get the same generic error
- No timing oracle: bcrypt comparison is constant-time

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Missing identifier or password | 400 Bad Request | None |
| User not found (any reason) | 401 "Invalid credentials" | None |
| Password not set on account | 401 "Invalid credentials" | None |
| Password mismatch | 401 "Invalid credentials" | None |

---

## 6. Link Password (Account Linking)

**Trigger:** Google-only user sets a username and password from security settings
**Endpoint:** `POST /api/v1/auth/link-password` (authenticated)
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Handler as AuthHandler
    participant AuthMW as AuthMiddleware
    participant Auth as AuthService
    participant UserRepo as UserRepository
    participant DB as PostgreSQL

    Browser->>SPA: Submit link password form
    SPA->>Handler: POST /api/v1/auth/link-password<br/>{username, password}
    Handler->>AuthMW: Validate JWT
    AuthMW-->>Handler: user_id from context

    activate Auth
    Handler->>Auth: LinkPassword(ctx, userID, req)

    Auth->>UserRepo: GetByID(userID)
    Auth->>Auth: Check user.PasswordHash == ""
    alt Password already set
        Auth-->>Handler: 400 "Password already set"
    end

    Auth->>Auth: Validate username and password
    Auth->>UserRepo: GetByUsername(username)
    alt Username taken
        Auth-->>Handler: 409 "Username already taken"
    end

    Auth->>Auth: bcrypt.GenerateFromPassword(password, cost=12)
    Auth->>UserRepo: Update user {username, passwordHash, authProvider: "google+password"}
    deactivate Auth

    Auth-->>Handler: {success: true}
    Handler-->>SPA: 200 OK
    SPA->>Browser: Show success, refresh auth methods
```

### Key Invariants

- Only users without an existing password can link one
- AuthProvider is updated from "google" to "google+password"
- Username uniqueness is enforced
- Existing sessions remain valid (no invalidation needed)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Not authenticated | 401 Unauthorized | None |
| Password already set | 400 "Password already set" | None |
| Invalid username/password | 400 Validation error | None |
| Username already taken | 409 Conflict | None |

---

## 7. Change Password

**Trigger:** User with existing password changes it from security settings
**Endpoint:** `POST /api/v1/auth/change-password` (authenticated)
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Handler as AuthHandler
    participant AuthMW as AuthMiddleware
    participant Auth as AuthService
    participant UserRepo as UserRepository
    participant Redis
    participant DB as PostgreSQL

    Browser->>SPA: Submit change password form
    SPA->>Handler: POST /api/v1/auth/change-password<br/>{currentPassword, newPassword}
    Handler->>AuthMW: Validate JWT
    AuthMW-->>Handler: user_id, sessionID

    activate Auth
    Handler->>Auth: ChangePassword(ctx, userID, req, sessionID)

    Auth->>UserRepo: GetByID(userID)
    Auth->>Auth: Check user.PasswordHash != ""
    alt No password set
        Auth-->>Handler: 400 "No password set"
    end

    Auth->>Auth: bcrypt.CompareHashAndPassword(hash, currentPassword)
    alt Wrong current password
        Auth-->>Handler: 401 "Invalid credentials"
    end

    Auth->>Auth: Validate new password strength
    Auth->>Auth: Check new != current
    alt Same password
        Auth-->>Handler: 400 "New password must differ"
    end

    Auth->>Auth: bcrypt.GenerateFromPassword(newPassword, cost=12)
    Auth->>UserRepo: Update user {passwordHash}

    Note over Auth,Redis: Invalidate all OTHER sessions
    Auth->>Redis: SMembers(session:user:{userID})
    loop Each session except current
        Auth->>Redis: SRem(session:user:{userID}, sessionID)
        Auth->>Redis: Del(session_meta:{sessionID})
        Auth->>Redis: Del(session_token:{sessionID})
    end
    Auth->>DB: Delete sessions WHERE user_id=? AND session_id != currentSessionID
    deactivate Auth

    Auth-->>Handler: {success: true}
    Handler-->>SPA: 200 OK
    SPA->>Browser: Show success + "All other sessions logged out"
```

### Key Invariants

- Current password must be verified before allowing change
- New password must differ from current password
- All other sessions are invalidated (Redis + DB) — only the current session survives
- The current session's JWT remains valid (no re-authentication needed)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Not authenticated | 401 Unauthorized | None |
| No password set on account | 400 "No password set" | None |
| Wrong current password | 401 "Invalid credentials" | None |
| Weak new password | 400 Validation error | None |
| New password same as current | 400 "New password must differ" | None |
| Partial Redis session cleanup failure | Warning logged | Some sessions may remain active |

---

## 8. Link Google (Account Linking)

**Trigger:** Password-only user clicks "Connect Google" in Security Settings
**Endpoint:** `POST /api/v1/auth/link-google` (authenticated)
**Source:** `domain/auth/auth.go`, `handlers/auth.go`

```mermaid
sequenceDiagram
    participant Browser
    participant SPA as Next.js SPA
    participant Google as Google OAuth
    participant Handler as AuthHandler
    participant AuthMW as AuthMiddleware
    participant Auth as AuthService
    participant GV as Google Validator
    participant DB as PostgreSQL

    Browser->>SPA: Click "Connect Google"
    SPA->>Google: Open consent popup
    Google-->>SPA: ID token (JWT)
    SPA->>Handler: POST /api/v1/auth/link-google<br/>{token}
    Handler->>AuthMW: Validate JWT
    AuthMW-->>Handler: user_id from context

    activate Auth
    Handler->>Auth: LinkGoogle(ctx, userID, token)
    Auth->>GV: idtoken.Validate(token, clientID)

    alt Invalid token
        GV-->>Auth: Error
        Auth-->>Handler: 401 "Invalid Google token"
        Handler-->>SPA: 401 Error
    end

    GV-->>Auth: Claims {email, picture}
    Auth->>DB: SELECT * FROM user WHERE id = userID
    DB-->>Auth: User record

    Auth->>Auth: Check AuthProvider contains "google"
    alt Google already linked
        Auth-->>Handler: 400 "Google account is already linked"
    end

    Auth->>DB: SELECT * FROM user WHERE email = googleEmail
    alt Email belongs to different user
        DB-->>Auth: Different user found
        Auth-->>Handler: 400 "Linked to a different user"
    end

    alt User has email and it doesn't match Google email
        Auth-->>Handler: 400 "Email mismatch"
    end

    Auth->>DB: UPDATE user SET auth_provider, email?, picture?
    DB-->>Auth: OK
    deactivate Auth

    Auth-->>Handler: {success: true}
    Handler-->>SPA: 200 OK
    SPA->>SPA: Invalidate auth methods query
    SPA-->>Browser: Badge updates to "Linked"
```

### Key Invariants

- Google token must be validated server-side (never trust client email)
- Google email must not belong to a different user (prevents account takeover)
- If user has an email set, it must match the Google email
- AuthProvider is updated from "password" to "password+google"
- Email is set from Google if user has no email (password-only registration)
- Picture is updated from Google if currently empty
- Existing sessions remain valid (no invalidation needed)

### Error Paths

| Condition | Response | Rollback |
|-----------|----------|----------|
| Not authenticated | 401 Unauthorized | None |
| Invalid/expired Google token | 401 "Invalid Google token" | None |
| Google already linked | 400 "Google account is already linked" | None |
| Email belongs to different user | 400 "Linked to a different user" | None |
| Email mismatch (user has different email) | 400 "Email mismatch" | None |
| Database error | 500 Internal Error | None (no partial state) |
