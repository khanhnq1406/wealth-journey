# Remove Email from Password Registration — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Remove email from password registration, make email nullable in the database, and migrate the entire session system from email-keyed to userID-keyed Redis storage.

**Spec:** `docs/specs/2026-03-16-remove-email-from-registration-spec.md`

**Architecture:** The session system currently keys all Redis sets by email (`session:<email>`). Since password-only users have no email, we must migrate to `session:user:<userID>`. This is a cross-cutting change touching Redis functions, auth service, session handler, session cleanup job, middleware (indirectly via VerifyAuth), and the ChangePassword flow. The database migration makes email nullable with a partial unique index.

**Tech Stack:** Go 1.23 (auth service, Redis, GORM migration), Protocol Buffers, Next.js/React (forms, i18n), Redis (session key pattern)

## Security Implementation Notes

- **Authentication**: No change to JWT signing/verification. UserID remains the primary claim.
- **Authorization**: Session ownership verified via `session:user:<userID>` set membership (was email-based).
- **Input validation**: Server-side validation for username, password, displayName. Email validation removed from RegisterWithPassword.
- **Data sanitization**: No new user-facing fields. Existing XSS protections unchanged.
- **Session migration**: All existing sessions invalidated on deployment (one-time cost). Users must re-login. This is acceptable and documented in the spec.

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Auth Service description to note "Sessions keyed by userID" and "Password registration without email"
- Update `docs/architecture/flow-auth.md`: Password Register sequence (remove email), session key patterns

---

### Task 1: Database Migration — Make Email Nullable

**Files:**
- Create: `src/go-backend/cmd/migrate-email-nullable/main.go`
- Modify: `src/go-backend/domain/models/user.go:12` (Email field GORM tags)

**Security notes:** Migration must be idempotent and safe for rollback. Partial unique index prevents duplicate non-NULL emails while allowing multiple NULLs.

**Step 1: Create the migration script**

Create `src/go-backend/cmd/migrate-email-nullable/main.go` following the pattern from `migrate-password-auth/main.go`:

```go
package main

import (
	"log"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.New(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	log.Println("Starting email nullable migration...")

	// Step 1: Remove NOT NULL constraint from email
	log.Println("Removing NOT NULL constraint from email...")
	if err := db.DB.Exec(`ALTER TABLE "user" ALTER COLUMN email DROP NOT NULL`).Error; err != nil {
		log.Fatalf("Failed to drop NOT NULL on email: %v", err)
	}
	log.Println("✓ email NOT NULL constraint removed")

	// Step 2: Drop existing unique index on email (GORM-generated)
	log.Println("Dropping existing email unique index...")
	if err := db.DB.Exec(`DROP INDEX IF EXISTS idx_users_email`).Error; err != nil {
		log.Printf("Note: idx_users_email not found, trying uni_user_email...")
	}
	// Try alternate GORM index names
	db.DB.Exec(`DROP INDEX IF EXISTS uni_user_email`)
	db.DB.Exec(`DROP INDEX IF EXISTS idx_user_email`)
	log.Println("✓ old email indexes dropped")

	// Step 3: Create partial unique index (only enforces uniqueness on non-NULL values)
	log.Println("Creating partial unique index on email...")
	if err := db.DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user" (email) WHERE email IS NOT NULL`).Error; err != nil {
		log.Fatalf("Failed to create partial email index: %v", err)
	}
	log.Println("✓ idx_user_email partial index created")

	// Verify
	var count int64
	db.DB.Raw(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'email' AND is_nullable = 'YES'`).Scan(&count)
	if count == 1 {
		log.Println("✓ email column verified as nullable")
	} else {
		log.Fatalf("Verification failed: email column is not nullable")
	}

	log.Println("✓ Email nullable migration completed successfully!")
}
```

**Step 2: Update User model GORM tags**

In `src/go-backend/domain/models/user.go`, change line 12:

```go
// Before:
Email string `gorm:"uniqueIndex;size:100;not null" json:"email"`

// After:
Email *string `gorm:"size:100;uniqueIndex" json:"email,omitempty"`
```

**Step 3: Add Taskfile entry**

Add to `Taskfile.yml` under backend tasks:

```yaml
backend:migrate-email-nullable:
  desc: "Make email nullable for password-only users"
  dir: src/go-backend
  cmds:
    - go run cmd/migrate-email-nullable/main.go
```

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

This will reveal all places where `user.Email` (now `*string`) needs updating — fix each one before proceeding.

**Step 5: Commit**

---

### Task 2: Fix All Email *string Type Propagation

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (multiple functions reference `user.Email`)
- Modify: `src/go-backend/domain/service/user_service.go` (CreateUser may set email)
- Modify: `src/go-backend/pkg/jobs/session_cleanup.go` (reads `user.Email`)
- Modify: Any other files that fail compilation from Task 1

**Security notes:** Every place that dereferences `user.Email` must handle the NULL/nil case. Password-only users will have `nil` email.

**Step 1: Add a helper function in auth.go**

```go
// getUserEmail safely dereferences user email, returning empty string for nil
func getUserEmail(user models.User) string {
	if user.Email != nil {
		return *user.Email
	}
	return ""
}
```

**Step 2: Update all `user.Email` references in auth.go**

Key locations (non-exhaustive — use compiler errors as guide):
- `generateLoginResponse()`: `user.Email` → `getUserEmail(user)` for JWT claims and LoginData
- `RegisterWithDevice()`: `user.Email` → email from Google payload (always set for Google users)
- `LoginWithDeviceInfo()`: email from Google payload
- `VerifyAuth()`: `user.Email` → `getUserEmail(user)` for UserData
- `GetAuth()`: `user.Email` → `getUserEmail(user)`
- `RegisterWithPassword()`: set `user.Email` to `nil` (no email for password users)
- `LoginWithPassword()`: email lookup uses `WHERE email = ?` — still works with nullable column
- `Logout()`: `claims.Email` from JWT — will be empty string for password users
- `invalidateOtherSessions()`: email parameter — will be empty for password users
- `GetAuthMethods()`: `user.Email` → `getUserEmail(user)`

**Step 3: Update session cleanup job**

In `pkg/jobs/session_cleanup.go:56`: `user.Email` → needs nil-safe dereference.

**Step 4: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 5: Run existing tests**

```bash
cd src/go-backend && go test -short ./domain/auth/... ./handlers/... ./pkg/jobs/...
```

**Step 6: Commit**

---

### Task 3: Migrate Redis Session Functions from Email to UserID

**Files:**
- Modify: `src/go-backend/pkg/redis/redis.go` (all session functions)

**Security notes:** Session ownership is now verified by userID (int32) instead of email (string). The userID comes from JWT claims (trusted, signed) or database lookups (trusted). This is actually MORE secure than email-based keying since userID is the primary key and cannot be NULL.

**Step 1: Update `SessionKey` function**

```go
// Before:
func SessionKey(email string) string {
	return fmt.Sprintf("session:%s", email)
}

// After:
func SessionKey(userID int32) string {
	return fmt.Sprintf("session:user:%d", userID)
}
```

**Step 2: Update all session function signatures from `email string` to `userID int32`**

Change these function signatures:
- `AddSession(email string, ...)` → `AddSession(userID int32, ...)`
- `GetUserSessions(email string)` → `GetUserSessions(userID int32)`
- `RemoveSession(email string, ...)` → `RemoveSession(userID int32, ...)`
- `RemoveAllSessions(email string)` → `RemoveAllSessions(userID int32)`
- `SessionExists(email string, ...)` → `SessionExists(userID int32, ...)`

Update all internal calls to `SessionKey()` accordingly.

**Step 3: Verify compilation fails (callers not yet updated)**

This is expected — callers will be updated in Task 4.

**Step 4: Commit** (this task can be committed independently since callers will update in next task)

---

### Task 4: Update All Redis Session Callers to Use UserID

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (generateLoginResponse, Logout, VerifyAuth, invalidateOtherSessions)
- Modify: `src/go-backend/handlers/session.go` (ListSessions, RevokeSession, RevokeAllSessions)
- Modify: `src/go-backend/pkg/jobs/session_cleanup.go` (Run)

**Security notes:** Every caller must pass `userID` (from JWT claims or database) instead of `email`. The `user_id` is already available in middleware context and JWT claims.

**Step 1: Update auth.go — generateLoginResponse**

```go
// Change: s.rdb.AddSession(user.Email, sessionID, tokenString, sessionData)
// To:     s.rdb.AddSession(user.ID, sessionID, tokenString, sessionData)
```

**Step 2: Update auth.go — Logout**

```go
// Change: s.rdb.RemoveSession(claims.Email, claims.SessionID)
// To:     s.rdb.RemoveSession(claims.UserID, claims.SessionID)
```

**Step 3: Update auth.go — VerifyAuth**

```go
// Change: s.rdb.SessionExists(claims.Email, claims.SessionID)
// To:     s.rdb.SessionExists(claims.UserID, claims.SessionID)

// Change: result := s.db.DB.Where("email = ?", claims.Email).First(&user)
// To:     result := s.db.DB.First(&user, claims.UserID)
```

**Step 4: Update auth.go — invalidateOtherSessions**

Change signature from `(email string, keepSessionID string)` to `(userID int32, keepSessionID string)`:

```go
func (s *Server) invalidateOtherSessions(userID int32, keepSessionID string) {
	sessionIDs, err := s.rdb.GetUserSessions(userID)
	// ...
	for _, sessionID := range sessionIDs {
		if sessionID != keepSessionID {
			if err := s.rdb.RemoveSession(userID, sessionID); err != nil {
				// ...
			}
		}
	}
	// DB cleanup: use userID directly
	if err := s.db.DB.Where("user_id = ? AND session_id != ?", userID, keepSessionID).Delete(&models.Session{}).Error; err != nil {
		// ...
	}
}
```

Update `ChangePassword()` call site: `s.invalidateOtherSessions(email, currentSessionID)` → `s.invalidateOtherSessions(userID, currentSessionID)`

**Step 5: Update ChangePassword handler to pass userID instead of email**

In `handlers/auth.go`, the `ChangePassword` handler currently passes `email` to `auth.Server.ChangePassword()`. Update the `ChangePassword` auth service method signature to take `userID` only (remove `email` param):

```go
// Before: func (s *Server) ChangePassword(ctx, userID int32, email string, req, currentSessionID string)
// After:  func (s *Server) ChangePassword(ctx, userID int32, req, currentSessionID string)
```

And in the handler, remove the email extraction:
```go
// Remove: email, ok := handler.GetUserEmail(c)
// Change: h.authSrv.ChangePassword(ctx, userID, email, req, claims.SessionID)
// To:     h.authSrv.ChangePassword(ctx, userID, req, claims.SessionID)
```

**Step 6: Update session handler — ListSessions**

Replace email-based lookups with userID:

```go
// Change: get "user_email" from context → get "user_id" from context
userID, exists := handler.GetUserID(c)
// Change: h.rdb.GetUserSessions(email) → h.rdb.GetUserSessions(userID)
```

**Step 7: Update session handler — RevokeSession**

```go
// Change: get "user_email" → get "user_id"
userID, exists := handler.GetUserID(c)
// Change: h.rdb.SessionExists(email, sessionID) → h.rdb.SessionExists(userID, sessionID)
// Change: h.rdb.RemoveSession(email, sessionID) → h.rdb.RemoveSession(userID, sessionID)
```

**Step 8: Update session handler — RevokeAllSessions**

```go
// Change: get "user_email" → get "user_id"
userID, exists := handler.GetUserID(c)
// Change: h.rdb.GetUserSessions(email) → h.rdb.GetUserSessions(userID)
// Change: h.rdb.RemoveSession(email, sessionID) → h.rdb.RemoveSession(userID, sessionID)
```

**Step 9: Update session cleanup job**

```go
// Before: j.rdb.RemoveSession(user.Email, session.SessionID)
// After:  j.rdb.RemoveSession(int32(session.UserID), session.SessionID)
// (UserID is already available on the session model, no need to look up user)
```

Actually, simplify the cleanup — remove the user lookup entirely since we have `session.UserID`:

```go
func (j *SessionCleanupJob) Run(ctx context.Context) error {
	var expiredSessions []models.Session
	if err := j.db.DB.Where("expires_at < ?", time.Now()).Find(&expiredSessions).Error; err != nil {
		return err
	}
	for _, session := range expiredSessions {
		// No need to look up user — use session.UserID directly
		if err := j.rdb.RemoveSession(session.UserID, session.SessionID); err != nil {
			log.Printf("[JOB] Error removing session from Redis: %v", err)
		}
		if err := j.db.DB.Delete(&session).Error; err != nil {
			log.Printf("[JOB] Error deleting session from database: %v", err)
		}
	}
	return nil
}
```

**Step 10: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 11: Run all tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 12: Commit**

---

### Task 5: Update GetAuth to Use UserID Instead of Email

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (`GetAuth` function)
- Modify: `src/go-backend/handlers/auth.go` (`GetAuth` handler)

**Security notes:** `GetAuth` currently looks up user by email (from middleware context). Since password-only users have no email, this endpoint must use userID instead.

**Step 1: Change `GetAuth` service method signature**

```go
// Before: func (s *Server) GetAuth(ctx context.Context, email string) (*authv1.GetAuthResponse, error)
// After:  func (s *Server) GetAuth(ctx context.Context, userID int32) (*authv1.GetAuthResponse, error)
```

Change internal lookup from `WHERE email = ?` to `db.First(&user, userID)`.

**Step 2: Update the handler**

```go
// Before: userEmail, exists := c.Get("user_email"); email := userEmail.(string); authSrv.GetAuth(ctx, email)
// After:  userID, ok := handler.GetUserID(c); authSrv.GetAuth(ctx, userID)
```

**Step 3: Verify compilation and run tests**

```bash
cd src/go-backend && go build ./... && go test -short ./...
```

**Step 4: Commit**

---

### Task 6: Update Proto and Regenerate — Remove Email from RegisterWithPasswordRequest

**Files:**
- Modify: `api/protobuf/v1/auth.proto` (RegisterWithPasswordRequest, service comments)
- Regenerate: `src/go-backend/protobuf/v1/` and `src/wj-client/gen/protobuf/v1/` and `src/wj-client/utils/generated/hooks.ts`

**Security notes:** Removing field 1 (email) from `RegisterWithPasswordRequest` is safe in proto3 — unknown fields are ignored. Reserve the field number to prevent accidental reuse.

**Step 1: Update `auth.proto`**

```protobuf
// RegisterWithPassword request
message RegisterWithPasswordRequest {
  reserved 1;  // was email, removed — password-only users have no email
  string username = 2 [json_name = "username"];
  string password = 3 [json_name = "password"];
  string display_name = 4 [json_name = "displayName"];
}
```

Also update the service comment:
```protobuf
// Register with username/password (no email required)
rpc RegisterWithPassword(RegisterWithPasswordRequest) returns (RegisterWithPasswordResponse) {
```

**Step 2: Regenerate code**

```bash
task proto:all
```

**Step 3: Verify compilation**

```bash
cd src/go-backend && go build ./...
```

**Step 4: Commit**

---

### Task 7: Update Backend Registration Logic — Remove Email Handling

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go` (`RegisterWithPassword` function)
- Modify: `src/go-backend/handlers/auth.go` (`RegisterWithPassword` handler)

**Security notes:** No email validation or uniqueness check needed. Username uniqueness is the sole identity constraint for password users.

**Step 1: Update the handler — remove email from body binding**

```go
func (h *AuthHandlers) RegisterWithPassword(c *gin.Context) {
	var body struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"displayName"`
	}
	if !bindJSON(c, &body) {
		return
	}

	req := &authv1.RegisterWithPasswordRequest{
		Username:    body.Username,
		Password:    body.Password,
		DisplayName: body.DisplayName,
	}
	// ... rest unchanged
}
```

**Step 2: Update the auth service — remove email validation and uniqueness check**

In `RegisterWithPassword()`:

```go
func (s *Server) RegisterWithPassword(ctx context.Context, req *authv1.RegisterWithPasswordRequest, deviceInfo *redis.SessionData) (*authv1.RegisterWithPasswordResponse, error) {
	// Validate inputs (NO email validation)
	if err := validator.Username(req.Username); err != nil {
		return nil, err
	}
	if err := validator.StrongPassword(req.Password); err != nil {
		return nil, err
	}
	if err := validator.NameWithConstraints(req.DisplayName, 1, 100); err != nil {
		return nil, apperrors.NewValidationError("display name is required")
	}

	// Check username uniqueness ONLY (no email check)
	var existingUser models.User
	result := s.db.DB.Where("username = ?", req.Username).First(&existingUser)
	if result.Error == nil {
		return nil, apperrors.NewValidationError("username already taken")
	} else if result.Error != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("database error: %w", result.Error)
	}

	// Hash password
	passwordHash, err := hashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to process password: %w", err)
	}

	// Create user with NULL email
	username := req.Username
	user := models.User{
		// Email is nil (pointer type, zero value for *string is nil)
		Name:         req.DisplayName,
		Username:     &username,
		PasswordHash: passwordHash,
		AuthProvider: "password",
	}

	if err := s.db.DB.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create default categories
	if s.categorySvc != nil {
		if err := s.categorySvc.CreateDefaultCategories(ctx, user.ID); err != nil {
			log.Printf("Warning: Failed to create default categories for user %d: %v", user.ID, err)
		}
	}

	// Generate login response
	resp, err := s.generateLoginResponse(ctx, user, deviceInfo)
	if err != nil {
		return nil, err
	}

	return &authv1.RegisterWithPasswordResponse{
		Success:   true,
		Message:   "User registered successfully",
		Data:      resp.Data,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

**Step 3: Verify compilation and run tests**

```bash
cd src/go-backend && go build ./... && go test -short ./...
```

**Step 4: Commit**

---

### Task 8: Update Existing Auth Tests

**Files:**
- Modify: `src/go-backend/domain/auth/auth_test.go`
- Modify: `src/go-backend/handlers/auth_integration_test.go`
- Modify: `src/go-backend/pkg/jobs/session_cleanup_test.go`
- Modify: `src/go-backend/pkg/redis/redis_test.go`
- Modify: `src/go-backend/handlers/session_test.go`

**Security notes:** Tests must verify that password-only users work with NULL email and userID-keyed sessions.

**Step 1: Update redis_test.go**

Update any tests that call `AddSession(email, ...)` → `AddSession(userID, ...)`, `GetUserSessions(email)` → `GetUserSessions(userID)`, etc.

**Step 2: Update auth_test.go**

Update `TestJWTClaims_WithSessionID` — email field may be empty string for password-only users. Add a test case with empty email.

**Step 3: Update session_cleanup_test.go**

Update to use `session.UserID` instead of looking up user email.

**Step 4: Update any integration tests**

Fix compilation errors in `auth_integration_test.go` and `session_test.go`.

**Step 5: Run all tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 6: Commit**

---

### Task 9: Frontend — Update RegisterPasswordForm (Remove Email, Single Step)

**Files:**
- Modify: `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx`

**Security notes:** Client-side validation for username, display name, password, confirm password. No email validation. All validations are mirrored server-side.

**Step 1: Remove email from Zod schema**

```typescript
const schema = z.object({
  username: z.string()
    .min(3, t("auth.register.errors.usernameMinLength"))
    .max(30, t("auth.register.errors.usernameMaxLength"))
    .regex(/^[a-zA-Z0-9_]+$/, t("auth.register.errors.usernameInvalidChars")),
  displayName: z.string()
    .min(1, t("auth.register.errors.displayNameRequired"))
    .max(100),
  password: z.string()
    .min(10, t("auth.register.errors.passwordMinLength"))
    .max(72, t("auth.register.errors.passwordMaxLength")),
  confirmPassword: z.string().min(1),
}).refine((data) => data.password === data.confirmPassword, {
  // ... password match validation
});
```

**Step 2: Convert from 2-step wizard to single-step form**

Remove step state management (`currentStep`, step navigation buttons). Render all fields in a single form:

1. Username
2. Display Name
3. Password (with PasswordStrengthIndicator)
4. Confirm Password

**Step 3: Remove email from mutation call**

```typescript
// Before: mutation.mutate({ email, username, password, displayName })
// After:  mutation.mutate({ username, password, displayName })
```

**Step 4: Update error mapper — remove email errors**

In `features/auth/utils/error-mapper.ts`, remove email-related entries from `REGISTER_ERROR_MAP`:
- Remove: `emailRequired`, `emailTooLong`, `invalidEmailFormat`, `emailAlreadyRegistered`

**Step 5: Verify the form compiles and renders**

```bash
cd src/wj-client && npm run build
```

**Step 6: Commit**

---

### Task 10: Frontend — Update Register Page Layout

**Files:**
- Modify: `src/wj-client/app/[locale]/auth/register/page.tsx`

**Security notes:** No security-sensitive changes. UI text update only.

**Step 1: Update the expandable button text**

Change "Create with email & password" to "Create with username & password" (or similar).

**Step 2: Verify the page renders correctly**

```bash
cd src/wj-client && npm run build
```

**Step 3: Commit**

---

### Task 11: Frontend — Update LoginPasswordForm Placeholder

**Files:**
- Modify: `src/wj-client/features/auth/forms/LoginPasswordForm.tsx`

**Security notes:** No security-sensitive changes. Label/placeholder update only.

**Step 1: Update placeholder text**

The identifier field currently uses `auth.login.emailOrUsername` / `auth.login.emailOrUsernamePlaceholder`. Since password-only users won't have email, update the primary hint to emphasize username while keeping email support for Google-linked users.

Update the form label and placeholder translations (done in Task 12).

**Step 2: Commit**

---

### Task 12: Frontend — Update i18n Translations

**Files:**
- Modify: `src/wj-client/messages/en/auth.json`
- Modify: `src/wj-client/messages/vi/auth.json`

**Security notes:** No security changes. Translation file cleanup only.

**Step 1: English translations**

Remove from `auth.register`:
- `email`
- `emailPlaceholder`

Remove from `auth.register.errors`:
- `emailRequired`
- `emailTooLong`
- `invalidEmailFormat`
- `emailAlreadyRegistered`

Update `auth.register.createWithPassword` (or add new key): "Create with username & password"

Update `auth.login.emailOrUsername` → "Username or Email"
Update `auth.login.emailOrUsernamePlaceholder` → "Enter your username or email"

(Keep "or Email" since Google-linked users can still log in with email.)

**Step 2: Vietnamese translations**

Same changes as English, in Vietnamese:
- Remove email keys from `auth.register`
- Update login identifier labels

**Step 3: Verify no broken translation references**

```bash
cd src/wj-client && npm run build
```

**Step 4: Commit**

---

### Task 13: Update Architecture Diagrams

**Files:**
- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/flow-auth.md`

**Step 1: Update `c4-component-backend.md`**

Update Auth Service component description to reflect:
- "Supports username/password registration (no email required) and Google OAuth"
- "Sessions keyed by userID in Redis"

**Step 2: Update `flow-auth.md`**

- **Password Register** sequence: Remove email validation step, remove email uniqueness check step, note user created with NULL email
- **Password Login** sequence: Clarify username-first lookup for password users
- **Session Management** diagrams: Update Redis key pattern from `session:<email>` to `session:user:<userID>`

**Step 3: Commit**

---

### Task 14: Final Verification — Build and Test Everything

**Files:** None (verification only)

**Step 1: Run full backend build**

```bash
cd src/go-backend && go build ./...
```

**Step 2: Run all backend tests**

```bash
cd src/go-backend && go test -short ./...
```

**Step 3: Run frontend build**

```bash
cd src/wj-client && npm run build
```

**Step 4: Manual verification checklist**

- [ ] Registration form has no email field
- [ ] Registration form is single-step
- [ ] Login form shows "Username or Email" placeholder
- [ ] Proto has `reserved 1` in `RegisterWithPasswordRequest`
- [ ] Redis key pattern is `session:user:<userID>`
- [ ] User model has `Email *string` (nullable)
- [ ] Session cleanup uses `session.UserID` directly
- [ ] No remaining references to `user.Email` without nil-safety

**Step 5: Commit final state**
