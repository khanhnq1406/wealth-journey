# i18n Error Code Mapping — Implementation Report

## Summary

Replaced generic error codes (e.g., `VALIDATION_ERROR`, `NOT_FOUND`) with ~150 granular, domain-specific error codes (e.g., `WALLET_ID_REQUIRED`, `TRANSACTION_INSUFFICIENT_BALANCE`) across the entire backend. Added frontend error translation utility and complete en/vi translation files so error messages display in the user's chosen language.

## Spec Reference

`docs/specs/2026-03-23-i18n-error-codes-spec.md`

## Plan Reference

`docs/plans/2026-03-23-i18n-error-codes-plan.md`

## Tasks Completed

| #   | Task | Status | Files Changed | Tests | TDD |
| --- | ---- | ------ | ------------- | ----- | --- |
| 0   | Update C4 Architecture Diagrams | Done | 4 docs | N/A | N/A |
| 1   | Create Error Code Registry | Done | 2 | 4/4 pass | Yes |
| 2   | Add WithCode Constructors | Done | 2 | 9/9 pass | Yes |
| 13  | Add WithCode Handler Variants | Done | 1 | N/A (build verified) | N/A |
| 3-12 | Migrate All Domain Errors | Done | 20 handlers/services | Existing tests pass | N/A |
| 14  | Error Translation Utility | Done | 1 | N/A | N/A |
| 15  | Translation Files (en + vi) | Done | 3 | Build verified | N/A |
| 16  | Integrate in Frontend Forms | Done | 29 forms | Build verified | N/A |
| 17  | Runtime Flow Diagrams | Done | 1 | N/A | N/A |
| 18  | Backend Build Verification | Done | 0 | All pass | N/A |
| 19  | Frontend Build Verification | Done | 0 | Build clean | N/A |

## Test Coverage Summary

| Layer | Test File | Tests | Pass | Coverage Area |
| ----- | --------- | ----- | ---- | ------------- |
| Backend Error Package | `pkg/errors/codes_test.go` | 4 | 4/4 | Uniqueness, naming convention, non-empty |
| Backend Error Package | `pkg/errors/errors_test.go` | 14 | 14/14 | All WithCode constructors, auth errors, GetErrorMessage |
| Backend Handlers | `handlers/admin_test.go` | existing | pass | Handler tests pass |

## Security Implementation Summary

| Concern | Implementation | Verified |
| ------- | -------------- | -------- |
| Error code naming | All codes describe user-facing concepts, not internals | Yes |
| Information disclosure | `err.Error()` leak in ListBankTemplates fixed | Yes |
| Auth error codes | `AUTH_INVALID_CREDENTIALS` intentionally vague | Yes |
| Middleware normalization | AuthMiddleware/AdminMiddleware use standard format | Yes |
| Frontend sanitization | `getTranslatedError()` falls back to `error.message` (already sanitized) | Yes |
| Error response format | All handlers use standard `{success, error: {code, message}, timestamp}` | Yes |

## Review Results

### Spec Compliance

- FR-1: Error code registry created with ~150 codes in `pkg/errors/codes.go`
- FR-2: All handler/service errors use granular codes; `HandleError` preserves codes
- FR-3: Translation files created for en/vi; `getTranslatedError()` utility created; 29 forms updated
- FR-4: All `gin.H{}` error responses normalized to standard format

### Security Review

- No error codes leak internal system details
- Auth error codes remain intentionally vague
- `err.Error()` leak in ListBankTemplates fixed
- Middleware errors now use standard error response format

### Code Quality

- Error codes follow consistent `DOMAIN_ACTION_REASON` naming convention
- Uniqueness enforced by test (reflection-based)
- Backward compatible — `message` field unchanged, frontend falls back to it

## Known Issues / Technical Debt

1. **Remaining generic `NewValidationError()` calls**: ~70 calls in validator.go, admin_service.go, community handler generics, auth domain, and repository layers still use generic codes. These were intentionally out of scope (not mapped in the spec catalog). A follow-up ticket can address them.
2. **Limited dynamic parameter interpolation**: The `params` field and ICU message format are now supported end-to-end (backend `ParamError` → API `params` field → frontend `getTranslatedError` → next-intl `t(key, params)`). Currently only `INVESTMENT_DUPLICATE` uses it. Other error codes with embedded values can be migrated incrementally.
3. **No CI check for missing translations**: A follow-up can add a test verifying all codes in `codes.go` have corresponding entries in both translation files.

## Files Changed

### Backend (31 files)
- **New**: `pkg/errors/codes.go`, `pkg/errors/codes_test.go`
- **Modified**: `pkg/errors/errors.go`, `pkg/errors/errors_test.go`, `pkg/handler/response.go`
- **Modified handlers**: `auth.go`, `budget.go`, `category.go`, `community.go`, `gold_chart.go`, `import.go`, `investment.go`, `middleware.go`, `price_override.go`, `session.go`, `silver_chart.go`, `site_settings.go`, `transaction.go`, `wallet_v2.go`
- **Modified services**: `budget_service.go`, `category_service.go`, `community_service.go`, `feedback_service.go`, `fx_rate_service.go`, `gold_sentiment_service.go`, `import_service.go`, `investment_service.go`, `transaction_service.go`, `user_service.go`, `wallet_service.go`

### Frontend (34 files)
- **New**: `lib/utils/error-translator.ts`, `messages/en/errors.json`, `messages/vi/errors.json`
- **Modified**: `i18n/request.ts`
- **Modified forms** (29 files): All form components across wallet, transaction, budget, investment, import, community, auth, feedback, market-prices, settings features

### Documentation (5 files)
- **New**: `docs/reports/2026-03-23-i18n-error-codes-progress.md`, `docs/reports/2026-03-23-i18n-error-codes-report.md`
- **Modified**: `docs/architecture/c4-component-backend.md`, `docs/architecture/c4-component-frontend.md`, `docs/architecture/flow-cross-cutting.md`, `docs/architecture/README.md`

## How to Test

### Unit & Integration Tests

```bash
# Backend
cd src/go-backend && go build ./... && go test -short ./...

# Frontend
cd src/wj-client && npm run build
```

### Manual Testing Steps

1. Set language to Vietnamese in app settings
2. Trigger a validation error (e.g., create wallet with empty name)
3. Verify error message displays in Vietnamese
4. Switch to English, trigger same error
5. Verify error message displays in English
6. Trigger an error for a code not in translations — verify fallback to English message

## Fix History

| Date       | Fix                                                                                                  | Severity | Commit        |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------- | ------------- |
| 2026-03-23 | Added i18n param interpolation for INVESTMENT_DUPLICATE — symbol & currency now translated in en/vi | Minor    | pending       |
| 2026-03-23 | Translated ~70 Zod validation messages via domain-specific keys (DOMAIN_ACTION_REASON pattern) in en/vi. Updated RHF wrappers to translate at display time. | Major    | pending       |
| 2026-03-23 | Migrated ~20 community domain errors from generic `VALIDATION_ERROR`/`NOT_FOUND` to 15 granular `COMMUNITY_*` codes with en/vi translations. Also fixed 2 `err.Error()` leaks in image upload. | Minor    | pending       |
| 2026-03-23 | Fixed 5 community forms showing raw Zod validation keys (e.g., `COMMUNITY_CONTENT_REQUIRED`) instead of translated messages. Added `translateValidationMessage()` wrapper to 7 error renders across CreatePostForm, EditPostForm, SharePostForm, ProfileEditModal, EditCommentForm. | Minor    | pending       |
