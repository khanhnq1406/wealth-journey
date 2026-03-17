# Link Google Account — Implementation Report

## Summary

Implemented the "Connect Google" feature for Security Settings, allowing password-only users to link their Google account from the settings page. This mirrors the existing "Set Password" flow (Google-only users adding a password) and completes bidirectional auth-method linking.

## Spec Reference

`docs/specs/2026-03-17-link-google-account-spec.md`

## Plan Reference

`docs/plans/2026-03-17-link-google-account-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Files Changed |
|---|------|--------|--------|---------------|
| 1 | Proto — Add LinkGoogle RPC and Messages | Done | e951cf9 | auth.proto, generated Go+TS code |
| 2 | Backend — Auth Service LinkGoogle Method | Done | c6df7ab | domain/auth/auth.go |
| 3 | Backend — LinkGoogle Handler + Route | Done | 97c38fb | handlers/auth.go, handlers/routes.go |
| 4 | Frontend — i18n + Error Mappings | Done | 389fdea | messages/en+vi/settings.json, error-mapper.ts |
| 5 | Frontend — Connect Google Button | Done | 33ca545 | AuthMethodsCard.tsx |
| 6 | Architecture Diagrams | Done | 3025c77 | flow-auth.md |
| 7 | Build Verification + Report | Done | — | This file |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Authentication | AuthMiddleware (JWT) on /link-google route | Yes — authProtected group |
| Authorization | user_id from JWT context, can only link to own account | Yes |
| Token validation | Server-side `idtoken.Validate()` with client ID | Yes |
| Account takeover prevention | Email collision check — rejects if email belongs to different user | Yes |
| Email mismatch | Rejects if user has email set and Google email differs | Yes |
| No token storage | Google ID token used transiently, never persisted | Yes |
| Input validation | `binding:"required"` on token field in handler | Yes |
| Error sanitization | Validation errors use `apperrors.NewValidationError` (passes through to client) | Yes |

## Architecture Diagram Updates

- **`docs/architecture/flow-auth.md`** — Added section 8 "Link Google (Account Linking)" with full sequence diagram, key invariants, and error paths table

## Files Changed

### Created
- `docs/reports/2026-03-17-link-google-account-progress.md`
- `docs/reports/2026-03-17-link-google-account-report.md`

### Modified
- `api/protobuf/v1/auth.proto` — Added LinkGoogle RPC, LinkGoogleRequest, LinkGoogleResponse
- `src/go-backend/domain/auth/auth.go` — Added LinkGoogle method (~60 lines)
- `src/go-backend/handlers/auth.go` — Added LinkGoogle handler
- `src/go-backend/handlers/routes.go` — Added POST /link-google route
- `src/wj-client/features/auth/components/AuthMethodsCard.tsx` — Added GoogleLogin button, mutation, error handling
- `src/wj-client/features/auth/utils/error-mapper.ts` — Added LINK_GOOGLE_ERROR_MAP and mapLinkGoogleError
- `src/wj-client/messages/en/settings.json` — Added connectGoogle, error keys
- `src/wj-client/messages/vi/settings.json` — Added Vietnamese translations
- `docs/architecture/flow-auth.md` — Added section 8 with sequence diagram
- Generated code (auto): Go protobuf types, TypeScript types, React Query hooks

## How to Test

### Backend (manual)
1. Start the backend server
2. Login as a password-only user (get JWT)
3. Get a Google ID token (from the Google consent flow)
4. `POST /api/v1/auth/link-google` with `Authorization: Bearer <jwt>` and body `{"token": "<google_id_token>"}`
5. Verify response: `{"success": true, "message": "Google account linked successfully", ...}`
6. `GET /api/v1/auth/methods` — verify `hasGoogle: true`

### Frontend (manual)
1. Login with username/password
2. Navigate to Settings > Security
3. In the "Authentication Methods" card, verify the Google row shows "Not Set" badge + Google Sign-In button
4. Click the Google button, complete consent
5. Verify the badge updates to "Linked" and the Google button disappears
6. Test error cases: try linking when already linked, try with a Google account that belongs to another user

### Error scenarios to verify
- Already linked → "Google account is already linked"
- Email belongs to different user → "This Google account is already used by another user"
- Email mismatch → "The Google account email doesn't match your account email"
- Invalid/expired token → "Google authentication failed. Please try again."

## Known Issues / Technical Debt

None. This is a clean, focused feature with no deferred work.
