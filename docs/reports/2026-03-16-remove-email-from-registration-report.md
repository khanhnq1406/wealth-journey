# Remove Email from Password Registration — Implementation Report

## Summary

Removed the email field from password-based registration. Users now register with just username, display name, and password. Email becomes nullable in the database (NULL for password-only users, still populated for Google OAuth users). The entire session system was migrated from email-keyed to userID-keyed Redis keys.

## References

- **Spec:** `docs/specs/2026-03-16-remove-email-from-registration-spec.md`
- **Plan:** `docs/plans/2026-03-16-remove-email-from-registration-plan.md`
- **Progress:** `docs/reports/2026-03-16-remove-email-from-registration-progress.md`
- **Branch:** `feat/username-password-auth`

## Tasks Completed (13/13)

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Database Migration — Make Email Nullable | 5de621c | Migration script drops NOT NULL, creates partial unique index; `User.Email` changed to `*string` |
| 2 | Fix All Email *string Type Propagation | 7007279 | Added `getUserEmail()` helper; fixed 12+ files for `*string` compatibility |
| 3 | Migrate Redis Session Functions | 7493b36 | `SessionKey` changed from `session:<email>` to `session:user:<userID>` |
| 4 | Update All Redis Session Callers | 7493b36 | All callers in auth, session handlers, session cleanup, cmd/ scripts migrated to userID |
| 5 | GetAuth — Email to UserID | 653479a | `GetAuth` now takes `userID int32`; gRPC endpoint deprecated |
| 6 | Proto — Remove Email Field | 10f39c9 | `RegisterWithPasswordRequest.email` removed, `reserved 1` added, code regenerated |
| 7 | Backend Registration Logic | 20430a6 | Removed email validation, email uniqueness check; user created with nil email |
| 8 | Update Auth Tests | c51dc1a | Fixed `*string` email in integration tests; `GetUserSessions` uses userID |
| 9 | Frontend — RegisterPasswordForm | df8ba97 | Removed email from Zod schema; converted 2-step wizard to single-step form |
| 10 | Frontend — Register Page Layout | df8ba97 | Changed expand button icon from email to user |
| 11 | Frontend — i18n Translations | c8bc104 | Removed email keys; updated button text in EN + VI |
| 12 | Architecture Diagrams | 00e4525 | Updated flow-auth.md Redis keys and registration flow; c4-component-backend.md |
| 13 | Final Verification | 5c48409 | Go build + all tests pass; TypeScript type check passes |

## Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| `User.Email` is now `*string` | All code accessing `user.Email` must handle nil | `getUserEmail()` helper added |
| Redis session key format changed | `session:<email>` → `session:user:<userID>` | Existing sessions invalidated (users re-login) |
| `GetAuth` takes `userID int32` instead of `email string` | gRPC endpoint deprecated | REST endpoint uses JWT middleware userID |
| `ChangePassword` signature lost `email` param | Callers must remove email arg | Updated in handler |
| `RegisterWithPasswordRequest` lost `email` field | Frontend must not send email | Proto regenerated, form updated |

## Security Assessment

| Concern | Status |
|---------|--------|
| Email partial unique index (`WHERE email IS NOT NULL`) | Prevents duplicate emails for Google users |
| Password-only users have NULL email | No email enumeration possible |
| Session keys use userID (immutable) not email (mutable) | More robust session management |
| Login still supports email OR username as identifier | Backward compatible for existing users |
| No user data leaked through registration errors | Only "username already taken" exposed |

## Files Changed

### Backend (Go) — 14 files

| File | Change |
|------|--------|
| `domain/auth/auth.go` | `RegisterWithPassword` removed email logic; `getUserEmail()` helper; all session calls use userID |
| `domain/auth/auth_integration_test.go` | Fixed `*string` email, `GetUserSessions(user.ID)` |
| `domain/grpcserver/auth.go` | `GetAuth` returns `Unimplemented` (deprecated) |
| `domain/models/user.go` | `Email` changed from `string` to `*string` |
| `domain/service/mapper.go` | Handles nil email dereference |
| `domain/service/user_service.go` | `&email` pointer for Create/Update |
| `domain/service/import_duplicate_strategies_test.go` | `&email` in test |
| `handlers/auth.go` | Removed `Email` from RegisterWithPassword body; `GetAuth` uses userID |
| `handlers/auth_integration_test.go` | `GetAuth` mock takes `userID int32` |
| `handlers/session.go` | All 3 session handlers use `handler.GetUserID(c)` |
| `pkg/redis/redis.go` | All 5 session functions take `userID int32` |
| `pkg/redis/redis_test.go` | Updated `TestSessionKey` |
| `pkg/jobs/session_cleanup.go` | Uses `session.UserID` directly |
| `cmd/migrate-email-nullable/main.go` | New migration script |
| `cmd/migrate-default-categories/main.go` | `userEmail()` helper for `*string` |
| `cmd/set-admin/main.go` | `userEmail()` helper for `*string` |
| `cmd/snapshot-portfolio/main.go` | `userEmail()` helper for `*string` |

### Proto — 1 file

| File | Change |
|------|--------|
| `api/protobuf/v1/auth.proto` | `RegisterWithPasswordRequest` removed email, added `reserved 1` |

### Frontend (TypeScript/React) — 5 files

| File | Change |
|------|--------|
| `features/auth/forms/RegisterPasswordForm.tsx` | Removed email field; single-step form |
| `features/auth/utils/error-mapper.ts` | Removed email error mappings |
| `app/[locale]/auth/register/page.tsx` | User icon instead of email icon |
| `messages/en/auth.json` | Removed email keys, updated button text |
| `messages/vi/auth.json` | Removed email keys, updated button text |

### Architecture Docs — 2 files

| File | Change |
|------|--------|
| `docs/architecture/flow-auth.md` | Redis keys updated; registration flow updated; ChangePassword signature updated |
| `docs/architecture/c4-component-backend.md` | Auth description: "email/password" → "username/password" |

## Database Migration

Run before deploying:

```bash
task backend:migrate-email-nullable
```

This migration:
1. Drops `NOT NULL` constraint on `email` column
2. Drops existing unique index on `email`
3. Creates partial unique index: `CREATE UNIQUE INDEX idx_user_email_unique ON "user" (email) WHERE email IS NOT NULL`

## Deployment Notes

- **Session invalidation**: Changing Redis key format from `session:<email>` to `session:user:<userID>` means all existing sessions become invalid. Users will need to re-login after deployment.
- **Migration order**: Run `task backend:migrate-email-nullable` before deploying the new backend code.
- **Backward compatibility**: Login still accepts email as identifier for existing users who have one.

## Verification Results

```
Go build:      PASS (0 errors)
Go tests:      PASS (all packages)
TypeScript:    PASS (tsc --noEmit)
```
