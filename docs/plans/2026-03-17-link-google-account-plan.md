# Link Google Account from Security Settings — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add a "Connect Google" button to the Security Settings page so password-only users can link their Google account without leaving the settings page.

**Spec:** `docs/specs/2026-03-17-link-google-account-spec.md`

**Architecture:** New protected endpoint `POST /api/v1/auth/link-google` validates a Google ID token and links it to the authenticated user. Frontend adds a GoogleLogin button to the AuthMethodsCard when `hasGoogle` is false, wrapped in a scoped GoogleOAuthProvider. On success, the auth methods query is invalidated to refresh the display.

**Tech Stack:** Go (Gin handler, idtoken validation), TypeScript/React (@react-oauth/google), Protocol Buffers

## Security Implementation Notes

- **Authentication:** Endpoint requires AuthMiddleware (JWT)
- **Authorization:** User can only link Google to their own account (user ID from JWT)
- **Account takeover prevention:** If the Google email belongs to a different user, reject with clear error
- **Email mismatch handling:** If user already has a different email, reject
- **Token validation:** Server-side `idtoken.Validate()` — never trust client-provided email
- **No token storage:** Google ID token used transiently, never persisted

---

### Task 1: Proto — Add LinkGoogle RPC and Messages

**Files:**
- Modify: `api/protobuf/v1/auth.proto`

**Security notes:** Request only needs the Google token. No additional fields to prevent injection.

**Steps:**

1. Add `LinkGoogle` RPC to `AuthService`:
```protobuf
// Link Google account to existing user (authenticated)
rpc LinkGoogle(LinkGoogleRequest) returns (LinkGoogleResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/link-google"
    body: "*"
  };
}
```

2. Add request/response messages:
```protobuf
// LinkGoogle request (authenticated)
message LinkGoogleRequest {
  string token = 1 [json_name = "token"];
}

// LinkGoogle response
message LinkGoogleResponse {
  bool success = 1 [json_name = "success"];
  string message = 2 [json_name = "message"];
  string timestamp = 3 [json_name = "timestamp"];
}
```

3. Run `task proto:all` to generate Go + TypeScript code

4. Verify build: `cd src/go-backend && go build ./...`

5. Commit: `feat(proto): add LinkGoogle RPC for linking Google account to existing user`

---

### Task 2: Backend — Auth Service LinkGoogle Method

**Files:**
- Modify: `src/go-backend/domain/auth/auth.go`

**Security notes:**
- Validate Google token server-side (idtoken.Validate)
- Check email collision — Google email must not belong to a different user
- Check user doesn't already have Google linked
- Handle null email and email mismatch cases

**Steps:**

1. Add `LinkGoogle` method to `auth.Server` (after `GetAuthMethods`):

```go
// LinkGoogle links a Google account to an existing user
func (s *Server) LinkGoogle(ctx context.Context, userID int32, googleToken string) (*authv1.LinkGoogleResponse, error) {
	// Verify Google token
	payload, err := idtoken.Validate(ctx, googleToken, s.cfg.Google.ClientID)
	if err != nil {
		return nil, apperrors.NewUnauthorizedError("invalid Google token")
	}

	// Extract Google user info
	googleEmail := payload.Claims["email"].(string)
	googlePicture, _ := payload.Claims["picture"].(string)

	// Get current user
	var user models.User
	if err := s.db.DB.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Check if user already has Google linked
	if strings.Contains(user.AuthProvider, "google") {
		return nil, apperrors.NewValidationError("Google account is already linked")
	}

	// Check if another user already has this Google email
	var existingUser models.User
	result := s.db.DB.Where("email = ?", googleEmail).First(&existingUser)
	if result.Error == nil && existingUser.ID != userID {
		return nil, apperrors.NewValidationError("this Google account is linked to a different user")
	}

	// If user has an email set, verify it matches Google email
	if user.Email != nil && *user.Email != "" && *user.Email != googleEmail {
		return nil, apperrors.NewValidationError("Google email does not match your account email")
	}

	// Build updates
	updates := map[string]interface{}{
		"auth_provider": user.AuthProvider + "+google",
	}

	// Set email from Google if user has no email
	if user.Email == nil || *user.Email == "" {
		updates["email"] = googleEmail
	}

	// Update picture from Google if currently empty
	if user.Picture == "" {
		updates["picture"] = googlePicture
	}

	if err := s.db.DB.Model(&user).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return &authv1.LinkGoogleResponse{
		Success:   true,
		Message:   "Google account linked successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}
```

2. Verify build: `cd src/go-backend && go build ./...`

3. Commit: `feat(auth): add LinkGoogle service method with email collision prevention`

---

### Task 3: Backend — LinkGoogle Handler + Route

**Files:**
- Modify: `src/go-backend/handlers/auth.go`
- Modify: `src/go-backend/handlers/routes.go`

**Security notes:** Use `handler.GetUserID(c)` (correct int32 assertion). Bind token as required.

**Steps:**

1. Add handler in `auth.go` (after `GetAuthMethods`):

```go
// LinkGoogle handles linking a Google account to an existing user
func (h *AuthHandlers) LinkGoogle(c *gin.Context) {
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.UnauthorizedWithPath(c, "User not authenticated")
		return
	}

	var body struct {
		Token string `json:"token" binding:"required"`
	}
	if !bindJSON(c, &body) {
		return
	}

	result, err := h.authSrv.LinkGoogle(c.Request.Context(), userID, body.Token)
	if err != nil {
		log.Printf("[AUTH] Link Google failed: %v", err)
		handler.HandleError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}
```

2. Register route in `routes.go` — add to the `authProtected` group (line ~91):

```go
authProtected.POST("/link-google", h.Auth.LinkGoogle)
```

3. Verify build: `cd src/go-backend && go build ./...`

4. Commit: `feat(auth): add LinkGoogle handler and route`

---

### Task 4: Frontend — Generate Hooks + Add i18n

**Files:**
- Modify: `src/wj-client/messages/en/settings.json`
- Modify: `src/wj-client/messages/vi/settings.json`
- Modify: `src/wj-client/features/auth/utils/error-mapper.ts`

**Security notes:** None — translation/config only.

**Steps:**

1. Run `task proto:all` (if not already done in Task 1) to generate `useMutationLinkGoogle` hook

2. Add i18n keys to `en/settings.json` under `security`:
```json
"connectGoogle": "Connect Google",
"googleLinked": "Google Account Linked",
"googleLinkedSuccess": "Google account linked successfully",
"linkGoogleFailed": "Failed to link Google account. Please try again."
```

3. Add i18n keys to `vi/settings.json` under `security`:
```json
"connectGoogle": "Kết nối Google",
"googleLinked": "Đã liên kết Google",
"googleLinkedSuccess": "Liên kết tài khoản Google thành công",
"linkGoogleFailed": "Liên kết Google thất bại. Vui lòng thử lại."
```

4. Add error mappings to `error-mapper.ts`:
```typescript
const LINK_GOOGLE_ERROR_MAP: Record<string, string> = {
  "google account is already linked": "googleAlreadyLinked",
  "this google account is linked to a different user": "googleEmailTaken",
  "google email does not match your account email": "googleEmailMismatch",
  "invalid google token": "invalidGoogleToken",
};

export function mapLinkGoogleError(serverMessage: string | undefined): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return LINK_GOOGLE_ERROR_MAP[lower] ?? null;
}
```

5. Add corresponding error i18n keys to both `en/settings.json` and `vi/settings.json`:
```json
// en
"googleAlreadyLinked": "Google account is already linked to this account",
"googleEmailTaken": "This Google account is already used by another user",
"googleEmailMismatch": "The Google account email doesn't match your account email",
"invalidGoogleToken": "Google authentication failed. Please try again."

// vi
"googleAlreadyLinked": "Tài khoản Google đã được liên kết",
"googleEmailTaken": "Tài khoản Google này đã được sử dụng bởi người dùng khác",
"googleEmailMismatch": "Email Google không khớp với email tài khoản của bạn",
"invalidGoogleToken": "Xác thực Google thất bại. Vui lòng thử lại."
```

6. Commit: `feat(i18n): add link Google translations and error mappings`

---

### Task 5: Frontend — Add Connect Google Button to AuthMethodsCard

**Files:**
- Modify: `src/wj-client/features/auth/components/AuthMethodsCard.tsx`

**Security notes:** GoogleOAuthProvider must be scoped to this component. Token is sent to server for validation — never trust it client-side.

**Steps:**

1. Add imports:
```typescript
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useMutationLinkGoogle, EVENT_AuthGetAuthMethods } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { mapLinkGoogleError } from "@/features/auth/utils/error-mapper";
```

2. Add `onLinkGoogleSuccess` callback prop to `AuthMethodsCardProps`:
```typescript
interface AuthMethodsCardProps {
  onSetPassword?: () => void;
  onChangePassword?: () => void;
  onLinkGoogleSuccess?: () => void;
}
```

3. Inside the component, add state and mutation:
```typescript
const queryClient = useQueryClient();
const [linkGoogleError, setLinkGoogleError] = useState<string | null>(null);
const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);

const linkGoogle = useMutationLinkGoogle({
  onSuccess() {
    setIsLinkingGoogle(false);
    setLinkGoogleError(null);
    queryClient.invalidateQueries({ queryKey: [EVENT_AuthGetAuthMethods] });
  },
  onError(error: any) {
    setIsLinkingGoogle(false);
    const i18nKey = mapLinkGoogleError(error.message);
    setLinkGoogleError(i18nKey ? t(`errors.${i18nKey}`) : error.message || t("errors.linkGoogleFailed"));
  },
});

const handleGoogleLink = async (credentialResponse: any) => {
  setIsLinkingGoogle(true);
  setLinkGoogleError(null);
  linkGoogle.mutate({ token: credentialResponse.credential });
};
```

4. In the Google OAuth row, when `!methods?.hasGoogle`, add the GoogleLogin button wrapped in GoogleOAuthProvider:
```tsx
{!methods?.hasGoogle && (
  <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
    <GoogleLogin
      onSuccess={handleGoogleLink}
      onError={() => setLinkGoogleError(t("errors.linkGoogleFailed"))}
      size="small"
      text="continue_with"
      shape="rectangular"
      theme="outline"
    />
  </GoogleOAuthProvider>
)}
```

5. Add error display below the Google row:
```tsx
{linkGoogleError && (
  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{linkGoogleError}</p>
)}
```

6. Verify frontend build: `cd src/wj-client && npx next build`

7. Commit: `feat(auth): add Connect Google button to AuthMethodsCard in security settings`

---

### Task 6: Architecture Diagrams — Update Auth Flow

**Files:**
- Modify: `docs/architecture/flow-auth.md`

**Steps:**

1. Add a new sequence diagram section "Link Google to Existing Account":

```markdown
### Link Google to Existing Account

**Trigger:** User clicks "Connect Google" in Security Settings
**Endpoint:** `POST /api/v1/auth/link-google`
**Source:** `domain/auth/auth.go` → `LinkGoogle()`

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant FE as Settings Page
    participant G as Google OAuth
    participant BE as Auth Handler
    participant AS as Auth Service
    participant GV as Google Validator
    participant DB as PostgreSQL

    U->>FE: Click "Connect Google"
    FE->>G: Open consent popup
    G-->>FE: ID token (JWT)
    FE->>BE: POST /api/v1/auth/link-google {token}
    BE->>BE: Verify JWT (AuthMiddleware)
    BE->>AS: LinkGoogle(userID, token)
    AS->>GV: idtoken.Validate(token, clientID)
    GV-->>AS: Claims {email, picture}
    AS->>DB: SELECT * FROM user WHERE id = userID
    DB-->>AS: User record
    alt Google already linked
        AS-->>BE: Error: already linked
        BE-->>FE: 400 "Google account is already linked"
    else Check email collision
        AS->>DB: SELECT * FROM user WHERE email = googleEmail
        alt Email belongs to different user
            AS-->>BE: Error: different user
            BE-->>FE: 400 "linked to a different user"
        else Email matches or user has no email
            AS->>DB: UPDATE user SET auth_provider, email?, picture?
            DB-->>AS: OK
            AS-->>BE: Success
            BE-->>FE: 200 "Google account linked successfully"
            FE->>FE: Invalidate auth methods query
            FE-->>U: Badge updates to "Linked"
        end
    end
\`\`\`

**Key Invariants:**
- Google token must be validated server-side (never trust client email)
- Google email must not belong to a different user
- If user has an email, it must match the Google email

**Error Paths:**
| Condition | Response | Rollback |
|-----------|----------|----------|
| Invalid Google token | 401 Unauthorized | None |
| Google already linked | 400 Validation Error | None |
| Email belongs to different user | 400 Validation Error | None |
| Email mismatch | 400 Validation Error | None |
| Database error | 500 Internal Error | None (no partial state) |
```

2. Update the "Unprotected Routes" section if it exists — `link-google` is protected, so no change needed there.

3. Commit: `docs(arch): add link Google sequence diagram to auth flow`

---

### Task 7: Build Verification + Report

**Steps:**

1. Run backend build: `cd src/go-backend && go build ./...`
2. Run frontend build: `cd src/wj-client && npx next build`
3. Write implementation report to `docs/reports/2026-03-17-link-google-account-report.md`
4. Append fix entry to original report at `docs/reports/2026-03-16-username-password-auth-report.md`
5. Commit: `docs: add link Google implementation report`
