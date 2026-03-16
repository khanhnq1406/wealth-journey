# Username & Password Authentication — Implementation Report

## Summary

Added username/password authentication alongside existing Google OAuth. Users can now register and login with email/username + password, link a password to their Google-only account, and change their password from security settings. All 23 planned tasks completed.

## Spec Reference

`docs/specs/2026-03-16-username-password-auth-spec.md`

## Plan Reference

`docs/plans/2026-03-16-username-password-auth-plan.md`

## Tasks Completed

| # | Task | Status | Commit | Key Files |
|---|------|--------|--------|-----------|
| 1 | Database Migration | Done | 76f3978 | models/user.go, migrate-password-auth/main.go |
| 2 | Validators | Done | fa4905b | pkg/validator/validator.go |
| 3 | Proto API Definitions | Done | df668e9 | api/protobuf/v1/auth.proto |
| 4 | User Repository | Done | 348ad7a | repository/interfaces.go, user_repository.go |
| 5 | Auth Service | Done | 5b76224 | domain/auth/auth.go |
| 6 | Auth Handlers | Done | df2ed25 | handlers/auth.go |
| 7 | Route Registration | Done | e693eef | handlers/routes.go |
| 8 | Google OAuth Update | Done | e35fc9d | domain/auth/auth.go |
| 9 | i18n Translations | Done | a505f64 | messages/en/*.json, messages/vi/*.json |
| 10-11 | PasswordInput + StrengthIndicator | Done | e2796f5 | features/auth/components/ |
| 12-13 | RegisterPasswordForm + LoginPasswordForm | Done | 150fde9 | features/auth/forms/ |
| 14-15 | Login + Register Page Updates | Done | bd7e215 | app/[locale]/auth/ |
| 16-17 | LinkPasswordForm + ChangePasswordForm | Done | 43f4394 | features/auth/forms/ |
| 18-20 | AuthMethodsCard + Security Page + Nav | Done | 1ed3179 | features/auth/components/, settings/security/ |
| 21-22 | Architecture Diagrams | Done | 525f9bb | docs/architecture/ |
| 23 | Build Verification | Done | — | go build + next build pass |

## Security Implementation Summary

| Concern | Implementation | Verified |
|---------|---------------|----------|
| Password hashing | bcrypt cost 12 | Yes |
| No user enumeration | Generic "Invalid credentials" for all login failures | Yes |
| Password never in responses | `json:"-"` GORM tag on PasswordHash | Yes |
| Authorization | Link/change/methods endpoints require AuthMiddleware | Yes |
| Input validation | Server-side: email, username regex, password 10-72 chars | Yes |
| Session invalidation | Password change removes all other Redis + DB sessions | Yes |
| Client-side validation | Zod schemas mirror server rules | Yes |

## Architecture Updates

- **C4 Backend**: Auth Handler + Auth Service descriptions updated for dual auth
- **C4 Frontend**: Auth pages, Auth feature, Settings pages descriptions updated
- **Flow Auth**: 4 new sequence diagrams (password register, login, link, change)
- **Unprotected routes list**: Updated with register-password and login-password

## New API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register-password | Public | Register with email/username/password |
| POST | /api/v1/auth/login-password | Public | Login with email or username + password |
| POST | /api/v1/auth/link-password | Protected | Link password to Google-only account |
| POST | /api/v1/auth/change-password | Protected | Change existing password |
| GET | /api/v1/auth/methods | Protected | Get auth methods for current user |

## New Frontend Components

| Component | Location |
|-----------|----------|
| PasswordInput | features/auth/components/PasswordInput.tsx |
| PasswordStrengthIndicator | features/auth/components/PasswordStrengthIndicator.tsx |
| AuthMethodsCard | features/auth/components/AuthMethodsCard.tsx |
| LoginPasswordForm | features/auth/forms/LoginPasswordForm.tsx |
| RegisterPasswordForm | features/auth/forms/RegisterPasswordForm.tsx |
| LinkPasswordForm | features/auth/forms/LinkPasswordForm.tsx |
| ChangePasswordForm | features/auth/forms/ChangePasswordForm.tsx |
| SecuritySettingsPage | app/[locale]/dashboard/settings/security/page.tsx |

## Files Changed (Complete List)

### Backend (Go)
- `src/go-backend/domain/models/user.go` — Added Username, PasswordHash, AuthProvider fields
- `src/go-backend/cmd/migrate-password-auth/main.go` — New migration
- `src/go-backend/pkg/validator/validator.go` — Added Username + StrongPassword validators
- `src/go-backend/domain/repository/interfaces.go` — Added GetByUsername to UserRepository
- `src/go-backend/domain/repository/user_repository.go` — Implemented GetByUsername
- `src/go-backend/domain/auth/auth.go` — 5 new methods + bcrypt helpers + Google OAuth update
- `src/go-backend/handlers/auth.go` — 5 new handler methods
- `src/go-backend/handlers/routes.go` — 5 new routes (2 public, 3 protected)

### Proto
- `api/protobuf/v1/auth.proto` — 5 RPCs, 10+ message types, User fields

### Frontend (TypeScript/React)
- `src/wj-client/features/auth/components/PasswordInput.tsx` — New
- `src/wj-client/features/auth/components/PasswordStrengthIndicator.tsx` — New
- `src/wj-client/features/auth/components/AuthMethodsCard.tsx` — New
- `src/wj-client/features/auth/forms/LoginPasswordForm.tsx` — New
- `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx` — New
- `src/wj-client/features/auth/forms/LinkPasswordForm.tsx` — New
- `src/wj-client/features/auth/forms/ChangePasswordForm.tsx` — New
- `src/wj-client/app/[locale]/auth/login/page.tsx` — Added password form + OR divider
- `src/wj-client/app/[locale]/auth/register/page.tsx` — Added password form + OR divider
- `src/wj-client/app/[locale]/dashboard/settings/security/page.tsx` — New page
- `src/wj-client/app/[locale]/dashboard/settings/page.tsx` — Added security nav link

### i18n
- `src/wj-client/messages/en/auth.json` — Login + register password keys
- `src/wj-client/messages/vi/auth.json` — Login + register password keys
- `src/wj-client/messages/en/settings.json` — Security + password strength keys
- `src/wj-client/messages/vi/settings.json` — Security + password strength keys

### Architecture Docs
- `docs/architecture/c4-component-backend.md` — Updated Auth descriptions
- `docs/architecture/c4-component-frontend.md` — Updated Auth + Settings descriptions
- `docs/architecture/flow-auth.md` — 4 new sequence diagrams + updated unprotected routes

### Other
- `Taskfile.yml` — Added migrate-password-auth task

## How to Test

### Database Migration
```bash
task backend:migrate-password-auth
```

### Manual Testing
1. **Register**: Go to `/auth/register`, fill in email/username/display name/password, submit
2. **Login**: Go to `/auth/login`, enter email or username + password, submit
3. **Google + Password**: Login with Google, go to Settings > Security, click "Set Password"
4. **Change Password**: From Security settings, click "Change Password", enter current + new
5. **Session Invalidation**: After changing password, verify other sessions are logged out

### Build Verification
```bash
cd src/go-backend && go build ./...
cd src/wj-client && npx next build
```

## Fix History

| Date | Fix | Severity | Commit |
|------|-----|----------|--------|
| 2026-03-16 | Register page overload: Google OAuth now primary action with expandable password form; password form split into 2-step wizard (identity fields → password fields); logo header hidden on desktop for both auth pages | Minor | See commit |
| 2026-03-16 | Add missing `GetByUsername` method to `MockUserRepository` in investment service tests — interface was extended by password auth feature but test mock was not updated | Minor | See commit |
| 2026-03-16 | Proto JSON tag mismatch: `protoc-gen-go` generates snake_case `json` struct tags (e.g., `json:"display_name"`) but frontend sends camelCase (e.g., `displayName`). Fixed `RegisterWithPassword` and `ChangePassword` handlers to use local request structs with correct camelCase JSON tags instead of binding directly to proto-generated structs | Minor | See commit |
