# Authentication Domain — Runtime Flows

Authentication and session management flows covering Google OAuth, JWT token lifecycle, and multi-device session tracking. Redis is the source of truth for active sessions; PostgreSQL serves as an audit trail.

## Table of Contents

- [Google OAuth Register/Login](#1-google-oauth-registerlogin)
- [JWT Validation Middleware Chain](#2-jwt-validation-middleware-chain)
- [Session Lifecycle](#3-session-lifecycle)

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
        Auth->>Redis: SAdd(session:{email}, sessionID)
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

    J --> K["Redis: SIsMember\n(session:{email}, sessionID)"]
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
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
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
session:<email>             → Redis Set of session IDs (TTL: 7d)
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
