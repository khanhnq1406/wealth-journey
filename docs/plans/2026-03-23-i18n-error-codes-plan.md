# i18n Error Code Mapping Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Replace generic error codes (e.g., `VALIDATION_ERROR`) with granular, domain-specific error codes (e.g., `WALLET_ID_REQUIRED`) across the entire backend so the frontend can map them to i18n translation keys and display errors in the user's chosen language.

**Spec:** `docs/specs/2026-03-23-i18n-error-codes-spec.md`

**Architecture:** Cross-cutting concern touching all backend handlers/services (error code changes) and the frontend error display pipeline (i18n translation lookup). No new endpoints, no data model changes. The existing `AppError` interface and `APIResponse` envelope remain unchanged — only the `code` field values change from generic categories to granular codes.

**Tech Stack:** Go 1.23 (error code registry + constructors), TypeScript 5 / next-intl (frontend translation), JSON (translation files)

## Security Implementation Notes

- **Authentication:** No change — error codes do not affect auth flow
- **Authorization:** No change — same JWT + ownership checks
- **Input validation:** Server-side validation continues as-is; error codes are output, not input
- **Data sanitization:** Error codes are string constants generated server-side. The `message` field continues to use `GetErrorMessage()` which strips internal details for non-AppError types. Frontend `sanitizeErrorMessage()` remains as defense-in-depth.
- **Information disclosure:** Review all granular code names to ensure they describe user-facing concepts, not implementation internals (e.g., `WALLET_CREATE_INITIAL_TX_FAILED` → keep for 500s since the frontend already sanitizes these)

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `ApiRequestError` | `utils/api-client.ts` | Already has `code` field — no changes needed |
| `sanitizeErrorMessage()` | `lib/utils/error-sanitizer.ts` | Continues as fallback defense-in-depth |
| `useNotification()` / toast | `contexts/NotificationContext.tsx` | Toast error display remains unchanged |
| `ErrorState` / `ErrorStatePreset` | `components/feedback/ErrorState.tsx` | Full-page error display remains unchanged |
| next-intl message infrastructure | `i18n/request.ts` + `messages/{locale}/` | Add new `errors` message group |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `getTranslatedError()` utility | `lib/utils/error-translator.ts` | New utility function mapping error codes to i18n keys. No existing equivalent. |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-backend.md`: Add `ErrorCodes Registry` component in `pkg/errors/` showing dependency from handlers/services → error codes
- Update `docs/architecture/c4-component-frontend.md`: Add `Error Translation Layer` in shared utilities showing: API Client → Error Translation → i18n → UI Components

---

### Task 0: Update C4 Architecture Diagrams

**Files:**

- Modify: `docs/architecture/c4-component-backend.md`
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Update backend L3 diagram: add `ErrorCodes Registry` component in `pkg/errors/` with arrows from handlers & services
2. Update frontend L3 diagram: add `Error Translation Layer` in shared utilities showing flow from API Client → Error Translation → i18n → UI Components
3. Commit diagram changes

---

### Task 1: Create Granular Error Code Registry (Backend)

**Files:**

- Create: `src/go-backend/pkg/errors/codes.go`
- Test: `src/go-backend/pkg/errors/codes_test.go`

**Security notes:** Error code names must describe user-facing concepts, not implementation internals. Review each code for information disclosure.

**Step 1: Write the failing test**

Create `codes_test.go` that:
- Verifies all error code constants are non-empty strings
- Verifies no two constants have the same value (uniqueness check using reflection)
- Verifies all codes follow the `DOMAIN_ACTION_REASON` naming convention (regex match)

**Step 2: Run test to verify it fails**

```bash
cd src/go-backend && go test ./pkg/errors/ -run TestErrorCodes -v
```

**Step 3: Write the error code registry**

Create `codes.go` with all ~120+ error codes as string constants organized by domain. Group by:
- General / Request Body (`REQUEST_BODY_*`)
- Wallet (`WALLET_*`)
- Transaction (`TRANSACTION_*`)
- Category (`CATEGORY_*`)
- Budget (`BUDGET_*`)
- Investment (`INVESTMENT_*`)
- Import (`IMPORT_*`)
- Session (`SESSION_*`)
- User (`USER_*`)
- FX Rate (`FX_*`)
- Market Prices / Charts (`CHART_*`)
- Price Override (`PRICE_OVERRIDE_*`)
- Site Settings (`SETTINGS_*`)
- Community (`COMMUNITY_*`)
- Gold Sentiment (`SENTIMENT_*`)
- Analysis (`ANALYSIS_*`)
- Auth (`AUTH_*`)
- Internal (`INTERNAL_ERROR`, `*_FAILED` codes)

Use the complete catalog from the spec (docs/specs/2026-03-23-i18n-error-codes-spec.md § Complete Error Code Catalog).

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test ./pkg/errors/ -run TestErrorCodes -v
```

**Step 5: Commit**

---

### Task 2: Add `NewValidationErrorWithCode` and `NewErrorWithCode` Constructors

**Files:**

- Modify: `src/go-backend/pkg/errors/errors.go`
- Test: `src/go-backend/pkg/errors/errors_test.go` (extend existing tests)

**Security notes:** New constructors must use the same safe message handling as existing ones. The `code` parameter must be a constant from `codes.go`, not user input.

**Step 1: Write the failing test**

Add tests for new constructors:
- `NewValidationErrorWithCode(code, message)` — returns error with custom code instead of generic `VALIDATION_ERROR`
- `NewNotFoundErrorWithCode(code, message)` — returns error with custom code instead of generic `NOT_FOUND`
- `NewConflictErrorWithCode(code, message)` — returns error with custom code instead of generic `CONFLICT`
- `NewInternalErrorWithCode(code, message)` — returns error with custom code instead of generic `INTERNAL_ERROR`
- `NewForbiddenErrorWithCode(code, message)` — returns error with custom code instead of generic `FORBIDDEN`
- `NewUnauthorizedErrorWithCode(code, message)` — returns error with custom code instead of generic `UNAUTHORIZED`
- `NewServiceUnavailableErrorWithCode(code, message)` — returns error with custom code instead of generic `SERVICE_UNAVAILABLE`
- `NewRateLimitErrorWithCode(code, message)` — returns error with custom code instead of generic `RATE_LIMIT_EXCEEDED`

Each test verifies `.Code()` returns the custom code and `.Error()` returns the message.

**Step 2: Run tests to verify they fail**

```bash
cd src/go-backend && go test ./pkg/errors/ -v
```

**Step 3: Implement the constructors**

Add `WithCode` variants for each error type. Example:

```go
func NewValidationErrorWithCode(code, message string) ValidationError {
    return ValidationError{
        BaseError: NewError(code, message, http.StatusBadRequest),
    }
}
```

Keep existing constructors (`NewValidationError`) unchanged for backward compatibility during migration.

**Step 4: Run tests to verify they pass**

```bash
cd src/go-backend && go test ./pkg/errors/ -v
```

**Step 5: Commit**

---

### Task 3: Migrate Handler Error Responses — Wallet Domain

**Files:**

- Modify: `src/go-backend/handlers/wallet_v2.go`
- Modify: `src/go-backend/domain/service/wallet_service.go`

**Security notes:** Ensure error codes don't leak internal wallet IDs or balance amounts. Keep the `message` field as-is for backward compatibility.

**Step 1: Write the failing test**

Add handler test that verifies the response `error.code` field contains granular codes (e.g., `WALLET_ID_INVALID`) instead of generic `VALIDATION_ERROR` for known validation scenarios.

**Step 2: Run test to verify it fails**

**Step 3: Replace all `apperrors.NewValidationError("...")` calls with `apperrors.NewValidationErrorWithCode(codes.WALLET_*, "...")`**

Migrate all wallet-related errors in `wallet_v2.go` and `wallet_service.go` per the spec's Wallet Domain table.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

---

### Task 4: Migrate Handler Error Responses — Transaction Domain

**Files:**

- Modify: `src/go-backend/handlers/transaction.go`
- Modify: `src/go-backend/domain/service/transaction_service.go`

**Security notes:** Same as Task 3.

**Step 1-5:** Same TDD pattern. Migrate all transaction-related errors per the spec's Transaction Domain table.

---

### Task 5: Migrate Handler Error Responses — Category Domain

**Files:**

- Modify: `src/go-backend/handlers/category.go`
- Modify: `src/go-backend/domain/service/category_service.go`

**Step 1-5:** Same TDD pattern. Migrate all category-related errors per the spec's Category Domain table.

---

### Task 6: Migrate Handler Error Responses — Budget Domain

**Files:**

- Modify: `src/go-backend/handlers/budget.go`
- Modify: `src/go-backend/domain/service/budget_service.go`

**Step 1-5:** Same TDD pattern. Migrate all budget-related errors per the spec's Budget Domain table.

---

### Task 7: Migrate Handler Error Responses — Investment Domain

**Files:**

- Modify: `src/go-backend/handlers/investment.go`
- Modify: `src/go-backend/domain/service/investment_service.go`

**Step 1-5:** Same TDD pattern. Migrate all investment-related errors per the spec's Investment Domain table.

---

### Task 8: Migrate Handler Error Responses — Import Domain

**Files:**

- Modify: `src/go-backend/handlers/import.go`
- Modify: `src/go-backend/domain/service/import_service.go`

**Security notes:** The existing `ListBankTemplates` handler leaks `err.Error()` in the response — this must be fixed during migration.

**Step 1-5:** Same TDD pattern. Migrate all import-related errors per the spec's Import Domain table. Fix the error leak in `ListBankTemplates`.

---

### Task 9: Migrate Handler Error Responses — Session, User, FX, Analysis Domains

**Files:**

- Modify: `src/go-backend/handlers/session.go`
- Modify: `src/go-backend/domain/service/user_service.go`
- Modify: `src/go-backend/domain/service/fx_rate_service.go`
- Modify: `src/go-backend/handlers/wallet_v2.go` (analysis endpoints)

**Step 1-5:** Same TDD pattern. Migrate all errors per the spec's Session, User, FX Rate, and Analysis Domain tables.

---

### Task 10: Migrate Handler Error Responses — Auth Domain

**Files:**

- Modify: `src/go-backend/handlers/auth.go`
- Modify: `src/go-backend/domain/auth/auth.go`
- Modify: `src/go-backend/pkg/errors/errors.go` (update auth error constructors to use granular codes)

**Security notes:** Auth error codes must remain generic enough to not reveal whether username or password was wrong. `AUTH_INVALID_CREDENTIALS` is intentionally vague — keep it.

**Step 1-5:** Same TDD pattern. Migrate auth-related errors per the spec's Authentication Errors table.

---

### Task 11: Migrate Handler Error Responses — Community & Gold Sentiment Domains

**Files:**

- Modify: `src/go-backend/handlers/community.go`
- Modify: `src/go-backend/domain/service/community_service.go`
- Modify: `src/go-backend/domain/service/gold_sentiment_service.go`

**Step 1-5:** Same TDD pattern. Migrate all community and sentiment errors per the spec tables.

---

### Task 12: Normalize Inconsistent Error Responses (FR-4)

**Files:**

- Modify: `src/go-backend/handlers/gold_chart.go`
- Modify: `src/go-backend/handlers/silver_chart.go`
- Modify: `src/go-backend/handlers/price_override.go`
- Modify: `src/go-backend/handlers/site_settings.go`
- Modify: `src/go-backend/handlers/community.go` (WebSocket section)
- Modify: `src/go-backend/handlers/import.go` (ListBankTemplates)
- Modify: `src/go-backend/handlers/middleware.go` (AuthMiddleware, AdminMiddleware)

**Security notes:**
- The `import.go` `ListBankTemplates` handler currently leaks `err.Error()` — replace with safe error message.
- Middleware errors must use standard `handler.Unauthorized()` / `handler.Forbidden()` with granular codes.
- WebSocket errors in `community.go` must use standard error format.

**Step 1: Write tests for each handler**

Verify that each handler returns the standard `APIResponse` format with `{success: false, error: {code, message}, timestamp}` instead of raw `gin.H{}`.

**Step 2: Run tests to verify they fail**

**Step 3: Migrate each handler**

Replace all raw `gin.H{}` error responses with `handler.BadRequest()`, `handler.HandleError()`, `handler.Unauthorized()`, `handler.Forbidden()`, `handler.InternalError()` using granular error codes.

Specific migrations per the spec's FR-4 table:

| File | Current Pattern | Migration |
|------|----------------|-----------|
| `handlers/gold_chart.go` | `gin.H{"success": false, "message": "..."}` | `handler.BadRequest(c, apperrors.NewValidationErrorWithCode(codes.CHART_MARKET_INVALID, "..."))` |
| `handlers/silver_chart.go` | `gin.H{"success": false, "message": "..."}` | Same pattern |
| `handlers/price_override.go` | `gin.H{"success": false, "error": "..."}` | `handler.BadRequest/InternalError/HandleError` |
| `handlers/site_settings.go` | `gin.H{"success": false, "message": "..."}` | `handler.BadRequest/InternalError` |
| `handlers/community.go` (WS) | `gin.H{"error": "..."}` | `handler.Unauthorized/HandleError` |
| `handlers/import.go` (ListBankTemplates) | `gin.H{"success": false, "message": "...", "error": err.Error()}` | `handler.InternalError` (stops leaking err.Error()) |
| `handlers/middleware.go` (AuthMiddleware) | `gin.H{"error": "unauthorized", "message": "..."}` | `handler.Unauthorized(c, "Invalid or expired token")` with code `AUTH_TOKEN_EXPIRED` |
| `handlers/middleware.go` (AdminMiddleware) | `gin.H{"success": false, "message": "..."}` | `handler.Forbidden(c, "Admin access required")` with code `AUTH_ADMIN_REQUIRED` |

**Note for middleware:** Since `handler.Unauthorized()` and `handler.Forbidden()` accept a string message (not an error), we need to either:
- Add `UnauthorizedWithCode(c, code, message)` and `ForbiddenWithCode(c, code, message)` variants to `pkg/handler/response.go`, OR
- Have middleware create `apperrors.NewUnauthorizedErrorWithCode()` and use `handler.HandleError()`

Decision: Add `WithCode` variants to `response.go` for cleaner middleware code.

**Step 4: Run tests to verify they pass**

**Step 5: Verify no remaining raw `gin.H{}` error responses**

```bash
cd src/go-backend && grep -rn 'gin\.H{' handlers/ | grep -v '_test.go' | grep -v 'success.*true'
```

Any remaining matches should be success responses only (those can stay as `gin.H{}` for now if they work correctly).

**Step 6: Commit**

---

### Task 13: Add `WithCode` Variants to `handler/response.go`

**Files:**

- Modify: `src/go-backend/pkg/handler/response.go`
- Test: `src/go-backend/pkg/handler/response_test.go`

**Security notes:** Same safe message handling as existing functions.

**Step 1: Write failing tests**

Test `UnauthorizedWithCode(c, code, message)`, `ForbiddenWithCode(c, code, message)`, `NotFoundWithCode(c, code, message)`, `ConflictWithCode(c, code, message)`.

**Step 2: Implement**

```go
func UnauthorizedWithCode(c *gin.Context, code, message string) {
    c.JSON(http.StatusUnauthorized, types.NewErrorResponse(types.APIError{
        Code:       code,
        Message:    message,
        StatusCode: http.StatusUnauthorized,
    }))
}
```

**Step 3: Run tests**

**Step 4: Commit**

**Note:** This task must be done BEFORE Task 12 (middleware migration depends on these functions).

---

### Task 14: Create Frontend Error Translation Utility

**Files:**

- Create: `src/wj-client/lib/utils/error-translator.ts`
- Test: `src/wj-client/lib/utils/error-translator.test.ts`

**Security notes:** The translation utility must never expose internal error codes to the UI — only translated messages. If no translation exists, fall back to `error.message` (already sanitized by the API client).

**Step 1: Write the failing test**

```typescript
// Tests:
// 1. Known error code returns translated message
// 2. Unknown error code falls back to error.message
// 3. Empty/undefined code falls back to error.message
// 4. Works with both 'en' and 'vi' locales
```

**Step 2: Implement `getTranslatedError()`**

```typescript
import { useTranslations } from 'next-intl';

/**
 * Maps API error codes to translated messages.
 * Falls back to error.message if no translation exists.
 */
export function getTranslatedError(
  error: { code?: string; message: string },
  t: (key: string) => string
): string {
  if (!error.code) return error.message;

  try {
    const translated = t(`errors.${error.code}`);
    // next-intl returns the key path if not found — check for that
    if (translated && translated !== `errors.${error.code}`) {
      return translated;
    }
  } catch {
    // Translation key not found — fall back
  }

  return error.message;
}
```

**Step 3: Run tests**

**Step 4: Commit**

---

### Task 15: Create Error Translation Files (en + vi)

**Files:**

- Create: `src/wj-client/messages/en/errors.json`
- Create: `src/wj-client/messages/vi/errors.json`
- Modify: `src/wj-client/i18n/request.ts` (add 'errors' to messageGroups)

**Security notes:** Translation messages must be user-friendly and not reveal internal system details.

**Step 1: Write failing test**

Test that the `errors` message group is loaded by next-intl.

**Step 2: Create `messages/en/errors.json`**

Map all ~120+ error codes to English user-facing messages. Group by domain. Example:

```json
{
  "errors": {
    "REQUEST_BODY_INVALID": "Invalid request. Please try again.",
    "WALLET_ID_REQUIRED": "Please select a wallet.",
    "WALLET_ID_INVALID": "Invalid wallet selected.",
    "WALLET_INITIAL_BALANCE_NEGATIVE": "Initial balance cannot be negative.",
    "WALLET_INSUFFICIENT_BALANCE": "Insufficient balance.",
    "TRANSACTION_AMOUNT_REQUIRED": "Please enter an amount.",
    "...": "..."
  }
}
```

**Step 3: Create `messages/vi/errors.json`**

Vietnamese translations for all codes.

**Step 4: Add 'errors' to messageGroups in `i18n/request.ts`**

```typescript
const messageGroups = [
  'common', 'nav', 'auth', 'transaction', 'wallet', 'investment',
  'budget', 'report', 'finance', 'import', 'settings', 'feedback',
  'admin', 'ui', 'errors'  // <-- add this
] as const;
```

**Step 5: Run frontend build to verify no errors**

```bash
cd src/wj-client && npm run build
```

**Step 6: Commit**

---

### Task 16: Integrate Error Translation in Frontend Forms

**Files:**

- Modify: All form components with `onError` callbacks across `features/*/`

**Security notes:** The `getTranslatedError()` utility preserves the existing sanitization pipeline — it only adds i18n lookup before display.

**Step 1: Write failing test**

Component test that verifies a form displays translated error message when API returns a known error code.

**Step 2: Update onError callbacks**

Replace the current pattern:
```typescript
onError: (error: any) => {
  setErrorMessage(error.message || t("failedToCreate"));
}
```

With:
```typescript
import { getTranslatedError } from '@/lib/utils/error-translator';

const tErrors = useTranslations();

onError: (error: any) => {
  setErrorMessage(getTranslatedError(error, tErrors));
}
```

**Affected forms (organized by feature):**

- `features/wallet/forms/CreateWalletForm.tsx`
- `features/wallet/forms/EditWalletForm.tsx`
- `features/wallet/forms/TransferForm.tsx` (or similar)
- `features/transaction/forms/AddTransactionForm.tsx`
- `features/transaction/forms/EditTransactionForm.tsx`
- `features/budget/forms/AddBudgetForm.tsx`
- `features/budget/forms/EditBudgetForm.tsx`
- `features/investment/forms/AddInvestmentForm.tsx`
- `features/import/forms/ImportTransactionsForm.tsx`
- Any other forms with `onError` callbacks

**Step 3: Run frontend build + existing tests**

**Step 4: Commit**

---

### Task 17: Create/Update Runtime Flow Diagrams

**Files:**

- Modify: `docs/architecture/flow-cross-cutting.md` (create if doesn't exist)
- Modify: `docs/architecture/README.md` (update if new file created)

**Steps:**

1. Read the implemented error translation code to trace the actual runtime flow
2. Create a `sequenceDiagram` showing:
   - Handler returns error with granular code
   - Standard error response serialization
   - Frontend API client parses response and extracts `code`
   - Error translation utility maps code → i18n key
   - Component displays translated message
3. Add "Key Invariants" section: fallback chain, sanitization guarantees
4. Add "Error Paths" table (no translation found → fallback to message, etc.)
5. Update `docs/architecture/README.md` if new file was created
6. Commit

**When to skip:** Do not skip — this is a cross-cutting flow that affects all error handling.

---

### Task 18: Backend Build Verification

**Files:** None (verification only)

**Steps:**

1. Run full Go build: `cd src/go-backend && go build ./...`
2. Run existing tests: `cd src/go-backend && go test -short ./...`
3. Verify no regressions
4. Fix any issues found

---

### Task 19: Frontend Build Verification

**Files:** None (verification only)

**Steps:**

1. Run full frontend build: `cd src/wj-client && npm run build`
2. Run existing tests: `cd src/wj-client && npm test`
3. Verify no regressions
4. Fix any issues found

---

## Task Dependency Graph

```
Task 1 (codes.go) ──────────────┐
                                 │
Task 2 (constructors) ──────────┤
                                 │
Task 13 (handler WithCode) ─────┤
                                 │
    ┌────────────────────────────┴───────────────────────────┐
    │  Tasks 3-12: Domain error migrations (parallelizable)  │
    │  3: Wallet  4: Transaction  5: Category  6: Budget     │
    │  7: Investment  8: Import  9: Session/User/FX          │
    │  10: Auth  11: Community  12: Normalize gin.H{}        │
    └────────────────────────────┬───────────────────────────┘
                                 │
Task 14 (error-translator.ts) ──┤  (independent of backend)
                                 │
Task 15 (translation files) ────┤  (independent of backend)
                                 │
Task 16 (integrate in forms) ───┤  (depends on 14, 15)
                                 │
    ┌────────────────────────────┴──────────┐
    │  Tasks 0, 17: Diagrams (any time)    │
    └────────────────────────────┬──────────┘
                                 │
    ┌────────────────────────────┴──────────┐
    │  Tasks 18, 19: Build verification     │
    └───────────────────────────────────────┘
```

**Execution order:**
1. Tasks 1, 2, 13 (foundation — sequential, each depends on prior)
2. Tasks 3-12 (domain migrations — can be parallelized via subagents)
3. Tasks 14-15 (frontend — can run in parallel with backend tasks 3-12)
4. Task 16 (frontend integration — depends on 14+15 and backend tasks completing)
5. Tasks 0, 17 (diagrams — can be done anytime)
6. Tasks 18, 19 (final verification)

## Estimated Task Count: 20 tasks (Tasks 0-19)
