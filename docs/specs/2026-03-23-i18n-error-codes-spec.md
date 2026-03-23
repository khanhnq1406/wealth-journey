# i18n Error Code Mapping Specification

## Summary

Currently, error messages from the Go backend are English strings that get displayed directly in the frontend UI, bypassing the i18n translation system (next-intl). When a Vietnamese user triggers an error like `"wallet_id is required"`, they see the raw English string instead of a translated message. This feature introduces granular error codes for every backend error so the frontend can map them to i18n translation keys and display errors in the user's chosen language.

## User Stories

- As a Vietnamese user, I want to see error messages in Vietnamese when something goes wrong, so that I can understand and fix the issue without reading English.
- As a developer, I want every backend error to have a unique, stable error code, so that I can map it to translation keys without parsing error message strings.
- As a developer, I want a single error code registry (Go constants), so that error codes are discoverable, consistent, and never duplicated.

## Functional Requirements

### FR-1: Granular Error Code Registry (Backend)

Create a centralized error code registry in `pkg/errors/codes.go` containing every error code as a Go constant. Error codes follow the pattern `DOMAIN_ACTION_REASON` (e.g., `WALLET_ID_REQUIRED`, `TRANSACTION_INSUFFICIENT_BALANCE`).

**Acceptance criteria:**

- [ ] All ~120 existing error messages are mapped to unique granular codes
- [ ] Error codes are string constants in `pkg/errors/codes.go`
- [ ] Each code has a comment describing when it's returned
- [ ] No two different error situations share the same code
- [ ] Existing generic codes (`VALIDATION_ERROR`, `NOT_FOUND`, etc.) remain as HTTP-level categories; granular codes replace them in the `code` field of the response

### FR-2: Backend Returns Granular Codes in Error Responses

Every error returned by handlers and services uses its granular code instead of the generic category code. The response format remains the same:

```json
{
  "success": false,
  "error": {
    "code": "WALLET_ID_REQUIRED",
    "message": "wallet_id is required"
  },
  "timestamp": "2026-03-23T10:15:30Z"
}
```

The `message` field remains the English developer-readable fallback. The `code` field becomes the machine-readable key the frontend uses for i18n lookup.

**Acceptance criteria:**

- [ ] Every `apperrors.NewValidationError("...")` call in handlers uses a granular code via a new constructor (e.g., `apperrors.NewValidationErrorWithCode(codes.WALLET_ID_REQUIRED, "wallet_id is required")`)
- [ ] Every `handler.BadRequest`, `handler.NotFound`, `handler.Unauthorized`, etc. returns the granular code
- [ ] Raw `gin.H{}` error responses in gold_chart.go, silver_chart.go, price_override.go, site_settings.go, community.go (websocket), import.go (ListBankTemplates) are migrated to use the standard error system with granular codes
- [ ] Auth middleware and admin middleware use the standard error response format
- [ ] The `message` field still contains a readable English string (developer fallback)

### FR-3: Frontend Error Code → i18n Key Mapping

The frontend maps `error.code` to an i18n translation key and displays the translated message. If no mapping exists for a code, fall back to `error.message` (current behavior).

**Acceptance criteria:**

- [ ] New translation files: `messages/en/errors.json` and `messages/vi/errors.json` containing all ~120 error codes
- [ ] New utility function `getErrorMessage(error: ApiRequestError, t: TranslationFunction): string` that:
  1. Checks if `error.code` exists
  2. Looks up `errors.<code>` in translations
  3. Returns translated string if found
  4. Falls back to `error.message` if no translation exists
- [ ] All `onError` callbacks in forms updated to use `getErrorMessage()` instead of `error.message || t("fallback")`
- [ ] Error messages are displayed in the user's current locale (vi or en)

### FR-4: Normalize Inconsistent Error Responses

All handlers that bypass the standard error system are migrated to use `handler.BadRequest()`, `handler.HandleError()`, etc.

**Affected files:**

| File | Current Pattern | Migration |
|------|----------------|-----------|
| `handlers/gold_chart.go` | `gin.H{"error": "..."}` | Use `handler.BadRequest(c, apperrors.NewValidationErrorWithCode(...))` |
| `handlers/silver_chart.go` | `gin.H{"error": "..."}` | Use `handler.BadRequest(c, apperrors.NewValidationErrorWithCode(...))` |
| `handlers/price_override.go` | `gin.H{"success": false, "error": "..."}` | Use `handler.BadRequest/InternalError/HandleError` |
| `handlers/site_settings.go` | `gin.H{"success": false, "message": "..."}` | Use `handler.BadRequest/InternalError` |
| `handlers/community.go` (WS) | `gin.H{"error": "..."}` | Use `handler.Unauthorized/HandleError` |
| `handlers/import.go` (ListBankTemplates) | `gin.H{"success": false, "message": "...", "error": err.Error()}` | Use `handler.InternalError` |
| `handlers/middleware.go` (AuthMiddleware) | `gin.H{"error": "unauthorized", "message": "..."}` | Use `handler.Unauthorized` |
| `handlers/middleware.go` (AdminMiddleware) | `gin.H{"success": false, "message": "..."}` | Use `handler.Forbidden` |

**Acceptance criteria:**

- [ ] All error responses use the standard `APIResponse` format with `{success, error: {code, message}, timestamp}`
- [ ] No raw `gin.H{}` error responses remain
- [ ] Frontend error parsing logic works consistently for all endpoints

## Non-Functional Requirements

- **Backward compatibility**: The `message` field still contains readable English text. Any frontend code that relies on `error.message` continues to work as a fallback.
- **Performance**: No measurable performance impact — codes are string constants, translation lookup is O(1) in next-intl.
- **Maintainability**: Adding a new error requires: (1) add code to `codes.go`, (2) add translations to `en/errors.json` and `vi/errors.json`, (3) use the code in the handler/service.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Backend (`c4-component-backend.md`)**: Add `ErrorCodes Registry` component in `pkg/errors/` showing dependency from handlers/services → error codes.
- **L3 Frontend (`c4-component-frontend.md`)**: Add `Error Translation Layer` in shared utilities showing: API Client → Error Translation → i18n → UI Components.

### New Diagrams

No new L4 diagrams needed — this is a cross-cutting concern, not a new bounded context.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- **`flow-cross-cutting.md`**: Add a new sequence diagram for "Error Response Translation Flow" showing:
  1. Handler returns error with granular code
  2. Standard error middleware serializes response
  3. Frontend API client parses response and extracts `code`
  4. Error translation utility maps code → i18n key
  5. Component displays translated message

### New Flow Diagrams

None needed — this fits in the existing cross-cutting flows file.

## Data Model Changes

None. This feature only changes error response format (adding granular codes to existing `code` field) and frontend translation files.

## API Changes

No new endpoints. The existing error response format is preserved with one semantic change:

**Before:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "wallet_id is required" } }
```

**After:**
```json
{ "error": { "code": "WALLET_ID_REQUIRED", "message": "wallet_id is required" } }
```

The `code` field changes from generic HTTP-level categories to granular error codes. The `message` field remains unchanged.

## UI/UX Changes

No visual changes. Error messages display in the same UI components (inline divs, toast notifications, ErrorState) but now show translated text in the user's language.

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|-------------------|----------|
| Inline form error display | Existing `<div className="bg-v2-red-primary/10 ...">` pattern | Various form files |
| Toast notifications | `useNotification()` / `toast.error()` | `contexts/NotificationContext.tsx` |
| Error state pages | `ErrorState` / `ErrorStatePreset` | `components/feedback/ErrorState.tsx` |
| Error sanitization | `sanitizeErrorMessage()` | `lib/utils/error-sanitizer.ts` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `getTranslatedError()` utility | `lib/utils/error-translator.ts` | New utility function, not a component. Maps error codes to i18n keys. No existing equivalent. |

## Complete Error Code Catalog

### Validation Errors (HTTP 400)

#### General / Request Body

| Code | Message | Source |
|------|---------|--------|
| `REQUEST_BODY_INVALID` | invalid request body | handlers/auth.go, handler/response.go |
| `REQUEST_BODY_FORMAT_INVALID` | invalid request body format | handler/response.go (BindAndValidate) |
| `REQUEST_BODY_READ_FAILED` | failed to read request body | handler/response.go (BindAndValidate) |

#### Wallet Domain

| Code | Message | Source |
|------|---------|--------|
| `WALLET_ID_REQUIRED` | wallet_id is required | handlers/transaction.go |
| `WALLET_ID_INVALID` | invalid wallet ID / invalid walletId parameter / Invalid walletId parameter | handlers/investment.go, handlers/wallet_v2.go |
| `WALLET_INITIAL_BALANCE_NEGATIVE` | initial balance cannot be negative | service/wallet_service.go |
| `WALLET_DELETE_TARGET_REQUIRED` | target wallet required for transfer option | service/wallet_service.go |
| `WALLET_DELETE_CURRENCY_MISMATCH` | target wallet must have same currency | service/wallet_service.go |
| `WALLET_DELETE_OPTION_INVALID` | invalid deletion option | service/wallet_service.go |
| `WALLET_AMOUNT_POSITIVE` | amount must be positive | service/wallet_service.go (AddFunds, WithdrawFunds, TransferMoney) |
| `WALLET_CURRENCY_MISMATCH` | currency mismatch / currency mismatch with source wallet / wallets must have the same currency | service/wallet_service.go |
| `WALLET_INSUFFICIENT_BALANCE` | Insufficient balance | service/wallet_service.go (WithdrawFunds, TransferMoney) |
| `WALLET_TRANSFER_SAME` | source and destination wallets cannot be the same | service/wallet_service.go |
| `WALLET_ADJUST_AMOUNT_POSITIVE` | adjustment amount must be positive | service/wallet_service.go |
| `WALLET_ADJUST_TYPE_REQUIRED` | adjustment type must be specified | service/wallet_service.go |
| `WALLET_ADJUST_INSUFFICIENT` | Insufficient balance for this adjustment | service/wallet_service.go |

#### Transaction Domain

| Code | Message | Source |
|------|---------|--------|
| `TRANSACTION_AMOUNT_REQUIRED` | amount is required | handlers/transaction.go, service/transaction_service.go |
| `TRANSACTION_TYPE_REQUIRED` | type is required (Income or Expense) / transaction type is required | handlers/category.go, handlers/investment.go |
| `TRANSACTION_INSUFFICIENT_BALANCE` | Insufficient balance for this transaction | service/transaction_service.go |
| `TRANSACTION_UPDATE_INSUFFICIENT` | Insufficient balance for this transaction update | service/transaction_service.go |
| `TRANSACTION_TARGET_INSUFFICIENT` | Insufficient balance in target wallet | service/transaction_service.go |
| `TRANSACTION_YEAR_REQUIRED` | year parameter is required | handlers/transaction.go |
| `TRANSACTION_YEAR_INVALID` | invalid year format / Invalid year | handlers/transaction.go, service/transaction_service.go |
| `TRANSACTION_WALLET_IDS_INVALID` | invalid wallet_ids format | handlers/transaction.go |
| `TRANSACTION_START_DATE_REQUIRED` | start_date parameter is required | handlers/transaction.go |
| `TRANSACTION_START_DATE_INVALID` | invalid start_date format | handlers/transaction.go |
| `TRANSACTION_END_DATE_REQUIRED` | end_date parameter is required | handlers/transaction.go |
| `TRANSACTION_END_DATE_INVALID` | invalid end_date format | handlers/transaction.go |
| `TRANSACTION_CATEGORY_TYPE_INVALID` | invalid category_type format | handlers/transaction.go |
| `TRANSACTION_DATE_RANGE_INVALID` | start_date must be less than or equal to end_date | service/transaction_service.go |
| `TRANSACTION_START_DATE_POSITIVE` | start_date must be greater than 0 | service/transaction_service.go |
| `TRANSACTION_END_DATE_POSITIVE` | end_date must be greater than 0 | service/transaction_service.go |

#### Category Domain

| Code | Message | Source |
|------|---------|--------|
| `CATEGORY_NAME_REQUIRED` | name is required / category name is required | handlers/category.go, service/category_service.go |
| `CATEGORY_NAME_TOO_LONG` | category name must be 100 characters or less | service/category_service.go |
| `CATEGORY_TYPE_INVALID` | invalid category type | service/category_service.go |

#### Budget Domain

| Code | Message | Source |
|------|---------|--------|
| `BUDGET_NAME_REQUIRED` | budget name is required | handlers/budget.go, service/budget_service.go |
| `BUDGET_NAME_TOO_LONG` | budget name cannot exceed 100 characters | service/budget_service.go |
| `BUDGET_ITEM_NAME_REQUIRED` | budget item name is required | handlers/budget.go, service/budget_service.go |
| `BUDGET_ITEM_NAME_TOO_LONG` | budget item name cannot exceed 100 characters | service/budget_service.go |
| `BUDGET_AMOUNT_NEGATIVE` | amount cannot be negative | service/budget_service.go (ValidateBudgetAmount, ValidateItemAmount) |

#### Investment Domain

| Code | Message | Source |
|------|---------|--------|
| `INVESTMENT_SYMBOL_REQUIRED` | symbol is required | handlers/investment.go, service/investment_service.go |
| `INVESTMENT_NAME_REQUIRED` | name is required | handlers/investment.go, service/investment_service.go |
| `INVESTMENT_TYPE_REQUIRED` | investment type is required | handlers/investment.go |
| `INVESTMENT_TYPE_FILTER_INVALID` | invalid typeFilter parameter | handlers/investment.go |
| `INVESTMENT_QUANTITY_POSITIVE` | quantity must be positive / initialQuantity must be positive | handlers/investment.go, service/investment_service.go |
| `INVESTMENT_PRICE_POSITIVE` | price must be positive / initialCost must be positive | handlers/investment.go, service/investment_service.go |
| `INVESTMENT_FEES_NEGATIVE` | fees cannot be negative | handlers/investment.go |
| `INVESTMENT_TX_TYPE_REQUIRED` | transaction type must be specified | service/investment_service.go |
| `INVESTMENT_TX_DATE_FUTURE` | transaction date cannot be in the future / purchase date cannot be in the future | service/investment_service.go |
| `INVESTMENT_DUPLICATE` | Investment {symbol} already exists with currency {currency} | service/investment_service.go |
| `INVESTMENT_QUERY_REQUIRED` | query parameter is required / query is required | handlers/investment.go, service/investment_service.go |
| `INVESTMENT_QUERY_TOO_LONG` | search query must be 100 characters or less | handlers/investment.go |
| `INVESTMENT_SYMBOL_CURRENCY_REQUIRED` | symbol and currency are required | handlers/investment.go |
| `INVESTMENT_TYPE_INVALID` | invalid type parameter | handlers/investment.go |

#### Import Domain

| Code | Message | Source |
|------|---------|--------|
| `IMPORT_FILE_REQUIRED` | file is required | handlers/import.go |
| `IMPORT_FILENAME_REQUIRED` | fileName is required | handlers/import.go |
| `IMPORT_FILE_ID_REQUIRED` | fileId is required / file ID is required | handlers/import.go, service/import_service.go |
| `IMPORT_FILE_NOT_FOUND` | uploaded file not found | handlers/import.go, service/import_service.go |
| `IMPORT_FILE_TYPE_UNSUPPORTED` | unsupported file type: {format}. Supported: Excel (.xlsx, .xls), PDF | handlers/import.go |
| `IMPORT_WALLET_ID_REQUIRED` | walletId is required | handlers/import.go |
| `IMPORT_TRANSACTIONS_EMPTY` | transactions list cannot be empty | handlers/import.go |
| `IMPORT_BATCH_ID_REQUIRED` | import batch ID is required | handlers/import.go |
| `IMPORT_JOB_ID_REQUIRED` | job ID is required | handlers/import.go, service/import_service.go |
| `IMPORT_TEMPLATE_ID_INVALID` | invalid template ID | handlers/import.go, service/import_service.go |
| `IMPORT_TEMPLATE_NAME_REQUIRED` | template name is required | service/import_service.go |
| `IMPORT_TEMPLATE_COLUMN_MAPPING_REQUIRED` | column mapping is required | service/import_service.go |
| `IMPORT_TEMPLATE_DATE_FORMAT_REQUIRED` | date format is required | service/import_service.go |
| `IMPORT_TEMPLATE_CURRENCY_REQUIRED` | currency is required | service/import_service.go |
| `IMPORT_TEMPLATE_COLUMN_MAPPING_INVALID` | invalid column mapping: {error} / invalid column mapping format: {error} | service/import_service.go |
| `IMPORT_TEMPLATE_FILE_FORMATS_INVALID` | invalid file formats: {error} | service/import_service.go |
| `IMPORT_MAX_TRANSACTIONS_EXCEEDED` | exceeded maximum transactions per import (10,000) | service/import_service.go |
| `IMPORT_TX_DATE_FUTURE` | transaction date cannot be in the future | service/import_service.go |
| `IMPORT_TX_DATE_TOO_OLD` | transaction date too old (max 10 years) | service/import_service.go |
| `IMPORT_NO_VALID_TRANSACTIONS` | No valid transactions to import | service/import_service.go |
| `IMPORT_UNDO_NOT_ALLOWED` | This import cannot be undone | service/import_service.go |
| `IMPORT_ALREADY_UNDONE` | This import has already been undone | service/import_service.go |
| `IMPORT_UNDO_EXPIRED` | Undo window has expired (24 hours) | service/import_service.go |
| `IMPORT_FILE_NOT_EXCEL` | file is not an Excel file (.xlsx or .xls) | service/import_service.go |
| `IMPORT_NO_SHEETS` | no visible sheets found in Excel file / no sheets available for detection | service/import_service.go |

#### Session Domain

| Code | Message | Source |
|------|---------|--------|
| `SESSION_ID_REQUIRED` | session_id is required | handlers/session.go |
| `SESSION_REVOKE_CURRENT` | Cannot revoke current session. Use logout instead. | handlers/session.go |

#### User Domain

| Code | Message | Source |
|------|---------|--------|
| `USER_CURRENCY_UNSUPPORTED` | unsupported currency: {currency} | service/user_service.go |
| `USER_CURRENCY_CONVERSION_FAILED` | cannot get exchange rate from {old} to {new}: {error} | service/user_service.go |
| `USER_EXCHANGE_RATE_INVALID` | invalid exchange rate returned | service/user_service.go |
| `USER_LANGUAGE_UNSUPPORTED` | unsupported language; valid values: en, vi | service/user_service.go |

#### FX Rate Domain

| Code | Message | Source |
|------|---------|--------|
| `FX_CURRENCY_EMPTY` | currency codes cannot be empty | service/fx_rate_service.go |
| `FX_FROM_CURRENCY_UNSUPPORTED` | unsupported from currency: {currency} | service/fx_rate_service.go |
| `FX_TO_CURRENCY_UNSUPPORTED` | unsupported to currency: {currency} | service/fx_rate_service.go |

#### Market Prices / Charts Domain

| Code | Message | Source |
|------|---------|--------|
| `CHART_MARKET_INVALID` | invalid market parameter | handlers/gold_chart.go, handlers/silver_chart.go |
| `CHART_PERIOD_INVALID` | invalid period parameter | handlers/gold_chart.go |
| `CHART_GOLD_CODE_INVALID` | invalid goldCode parameter | handlers/gold_chart.go |
| `CHART_DAYS_INVALID` | invalid days parameter | handlers/silver_chart.go |
| `CHART_TYPE_INVALID` | invalid type parameter | handlers/silver_chart.go |

#### Price Override Domain (Admin)

| Code | Message | Source |
|------|---------|--------|
| `PRICE_OVERRIDE_REQUEST_INVALID` | Invalid request: {error} | handlers/price_override.go |
| `PRICE_OVERRIDE_CATEGORY_INVALID` | Invalid category. Must be one of: gold, silver, currency, stock | handlers/price_override.go |
| `PRICE_OVERRIDE_TYPE_CODE_TOO_LONG` | TypeCode must be 50 characters or less | handlers/price_override.go |
| `PRICE_OVERRIDE_CURRENCY_INVALID` | Currency must be a valid 3-letter ISO 4217 code | handlers/price_override.go |
| `PRICE_OVERRIDE_PRICE_POSITIVE` | Buy and sell must be positive values | handlers/price_override.go |
| `PRICE_OVERRIDE_NAME_TOO_LONG` | Name must be 100 characters or less | handlers/price_override.go |
| `PRICE_OVERRIDE_FILTER_INVALID` | Invalid category filter | handlers/price_override.go |

#### Site Settings Domain (Admin)

| Code | Message | Source |
|------|---------|--------|
| `SETTINGS_REQUEST_INVALID` | Invalid request body | handlers/site_settings.go |
| `SETTINGS_EMPTY` | No settings provided | handlers/site_settings.go |

#### Community Domain

| Code | Message | Source |
|------|---------|--------|
| `COMMUNITY_EDIT_OWN_POST_ONLY` | you can only edit your own posts | service/community_service.go |
| `COMMUNITY_DELETE_OWN_POST_ONLY` | you can only delete your own posts | service/community_service.go |
| `COMMUNITY_DELETE_OWN_COMMENT_ONLY` | you can only delete your own comments | service/community_service.go, service/gold_sentiment_service.go |
| `COMMUNITY_EDIT_OWN_COMMENT_ONLY` | you can only edit your own comments | service/community_service.go |
| `COMMUNITY_POST_ALREADY_LIKED` | post already liked | service/community_service.go |
| `COMMUNITY_ALREADY_FOLLOWING` | already following this user | service/community_service.go |
| `COMMUNITY_ALREADY_REPORTED` | you have already reported this content | service/community_service.go |

#### Gold Sentiment Domain

| Code | Message | Source |
|------|---------|--------|
| `SENTIMENT_DIRECTION_INVALID` | direction must be BULLISH (1) or BEARISH (2) | service/gold_sentiment_service.go |
| `SENTIMENT_COMMENT_REQUIRED` | comment content is required | service/gold_sentiment_service.go |
| `SENTIMENT_COMMENT_TOO_LONG` | comment content must be at most {max} characters | service/gold_sentiment_service.go |
| `SENTIMENT_COMMENT_LIMIT_REACHED` | maximum {max} comments per day reached | service/gold_sentiment_service.go |

#### Analysis Domain

| Code | Message | Source |
|------|---------|--------|
| `ANALYSIS_YEAR_INVALID` | Invalid year parameter | handlers/wallet_v2.go |
| `ANALYSIS_MONTH_INVALID` | Invalid month parameter | handlers/wallet_v2.go |
| `ANALYSIS_MONTH_RANGE` | Month must be between 0 and 12 (0 for not specified) | handlers/wallet_v2.go |

### Authentication Errors (HTTP 401)

| Code | Message | Source |
|------|---------|--------|
| `AUTH_INVALID_CREDENTIALS` | invalid credentials | pkg/errors/errors.go |
| `AUTH_TOKEN_FAILED` | token {operation} failed | pkg/errors/errors.go |
| `AUTH_NO_TOKEN` | No token provided | handlers/auth.go |
| `AUTH_TOKEN_EXPIRED` | Invalid or expired token | handlers/middleware.go |
| `AUTH_MISSING_TOKEN` | missing token | handlers/community.go (WS) |
| `AUTH_INVALID_TOKEN` | invalid token | handlers/community.go (WS) |
| `AUTH_LOGIN_FAILED` | login failed | pkg/errors/errors.go |
| `AUTH_LOGOUT_FAILED` | logout failed | pkg/errors/errors.go |
| `AUTH_REGISTRATION_FAILED` | registration failed | pkg/errors/errors.go |

### Forbidden Errors (HTTP 403)

| Code | Message | Source |
|------|---------|--------|
| `AUTH_ADMIN_REQUIRED` | Admin access required | handlers/middleware.go |
| `ADMIN_CANNOT_MODIFY_OWN_ROLE` | cannot modify your own admin role | service/admin_service.go |
| (Community forbidden codes listed above in Validation section) | | |

### Not Found Errors (HTTP 404)

| Code | Message | Source |
|------|---------|--------|
| `WALLET_NOT_FOUND` | wallet not found | Generic via NewNotFoundError("wallet") |
| `USER_NOT_FOUND` | user not found. Please register first | domain/auth/auth.go |
| `TRANSACTION_NOT_FOUND` | transaction not found | Generic via NewNotFoundError("transaction") |
| `CATEGORY_NOT_FOUND` | category not found | Generic via NewNotFoundError("category") |
| `BUDGET_NOT_FOUND` | budget not found | Generic via NewNotFoundError("budget") |
| `BUDGET_ITEM_NOT_FOUND` | budget item not found | Generic via NewNotFoundError("budget item") |
| `INVESTMENT_NOT_FOUND` | investment not found | Generic via NewNotFoundError("investment") |
| `SESSION_NOT_FOUND` | Session not found | handlers/session.go |
| `IMPORT_BATCH_NOT_FOUND` | import batch not found | service/import_service.go |
| `IMPORT_JOB_NOT_FOUND` | job not found | service/import_service.go |
| `IMPORT_TEMPLATE_NOT_FOUND` | bank template not found | Generic |
| `RESOURCE_NOT_FOUND` | The requested resource was not found | pkg/errors/user_messages.go |

### Conflict Errors (HTTP 409)

| Code | Message | Source |
|------|---------|--------|
| `USER_EMAIL_EXISTS` | user with this email already exists | service/user_service.go |
| `USER_EMAIL_IN_USE` | email already in use | service/user_service.go |
| `USER_CURRENCY_CONVERSION_IN_PROGRESS` | currency conversion already in progress | service/user_service.go |
| `COMMUNITY_POST_ALREADY_LIKED` | (see above) | |
| `COMMUNITY_ALREADY_FOLLOWING` | (see above) | |
| `COMMUNITY_ALREADY_REPORTED` | (see above) | |

### Rate Limit Errors (HTTP 429)

| Code | Message | Source |
|------|---------|--------|
| `FEEDBACK_RATE_LIMITED` | Maximum 10 feedback submissions per hour. Please try again later. | service/feedback_service.go |
| `IMPORT_RATE_LIMITED` | You've made too many import requests. Please wait a moment before trying again. | pkg/errors/user_messages.go |

### Internal Server Errors (HTTP 500)

| Code | Message | Source |
|------|---------|--------|
| `INTERNAL_ERROR` | An unexpected error occurred | pkg/handler/response.go (generic fallback) |
| `SESSION_LIST_FAILED` | Failed to retrieve sessions | handlers/session.go |
| `SESSION_VERIFY_FAILED` | Failed to verify session | handlers/session.go |
| `SESSION_REVOKE_FAILED` | Failed to revoke session | handlers/session.go |
| `WALLET_CREATE_INITIAL_TX_FAILED` | failed to create initial balance transaction | service/wallet_service.go |
| `WALLET_BALANCE_UPDATE_FAILED` | failed to update wallet balance | service/wallet_service.go |
| `WALLET_TRANSFER_CATEGORY_FAILED` | failed to get outgoing/incoming transfer category | service/wallet_service.go |
| `WALLET_TRANSFER_TX_FAILED` | failed to create outgoing/incoming transaction | service/wallet_service.go |
| `WALLET_ADJUST_CATEGORY_FAILED` | failed to get balance adjustment category | service/wallet_service.go |
| `WALLET_ADJUST_TX_FAILED` | failed to create adjustment transaction | service/wallet_service.go |
| `BUDGET_ITEM_CREATE_FAILED` | failed to create budget item | service/budget_service.go |
| `BUDGET_ITEMS_DELETE_FAILED` | failed to delete budget items | service/budget_service.go |
| `IMPORT_BALANCE_VERIFICATION_FAILED` | wallet balance update verification failed | service/import_service.go |
| `IMPORT_CURRENCY_CONVERSION_UNAVAILABLE` | currency conversion service not available | service/import_service.go |
| `SETTINGS_FETCH_FAILED` | Failed to fetch settings | handlers/site_settings.go |
| `SETTINGS_UPDATE_FAILED` | Failed to update settings | handlers/site_settings.go |
| `PRICE_OVERRIDE_SAVE_FAILED` | Failed to save price override | handlers/price_override.go |
| `PRICE_OVERRIDE_LIST_FAILED` | Failed to list price overrides | handlers/price_override.go |
| `PRICE_OVERRIDE_DELETE_FAILED` | Failed to delete price override | handlers/price_override.go |
| `SENTIMENT_VOTE_COUNT_FAILED` | failed to get vote counts / failed to get updated counts | service/gold_sentiment_service.go |
| `IMPORT_TEMPLATES_FETCH_FAILED` | Failed to fetch bank templates | handlers/import.go |

### Service Unavailable Errors (HTTP 503)

| Code | Message | Source |
|------|---------|--------|
| `AUTH_SERVICE_UNAVAILABLE` | auth service unavailable | handlers/community.go (WS) |
| `STREAMING_UNAVAILABLE` | streaming not available | handlers/community.go (WS) |

### User-Friendly Wrapper Codes (from user_messages.go)

These codes are returned when `WrapWithUserMessage()` wraps technical errors:

| Code | Triggered By |
|------|-------------|
| `DB_CONNECTION_ERROR` | Database connection/timeout errors |
| `FILE_PARSE_ERROR` | File parsing failures |
| `EMPTY_FILE_ERROR` | Empty file uploads |
| `INSUFFICIENT_BALANCE` | Balance-related errors |
| `FILE_TOO_LARGE` | File size exceeded |
| `UNSUPPORTED_FILE_TYPE` | Invalid file type |
| `DUPLICATE_DETECTED` | Duplicate transaction detection |
| `EXCHANGE_RATE_ERROR` | Currency conversion failures |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | Go Handler | Error code + English message | No (same tier) | Error Response Serializer | Internal |
| 2 | Error Response Serializer | JSON `{code, message}` | Yes: Server → Internet | Frontend API Client | Error codes are public-facing |
| 3 | Frontend API Client | Error code string | No (same tier) | Error Translation Utility | In-browser |
| 4 | Error Translation Utility | i18n key lookup | No (same tier) | UI Component | In-browser |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|------------------|
| Server → Internet | Error response JSON | Error codes must NOT leak internal details (stack traces, DB names, query text) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2 | Server → Internet | Information Disclosure | Granular codes could reveal internal system structure (e.g., `WALLET_INITIAL_BALANCE_CATEGORY_FAILED` exposes internal concept of "initial balance category") | Low | Review all code names to ensure they describe user-facing concepts, not implementation details. Internal errors use generic `INTERNAL_ERROR` code. |
| T-2 | 2 | Server → Internet | Information Disclosure | The `message` field (English fallback) could leak internal details if not sanitized | Low | Existing: error-sanitizer.ts on frontend, `GetErrorMessage()` on backend already strips internal details for non-AppError types. No change needed. |
| T-3 | 2 | Server → Internet | Spoofing | Attacker could enumerate error codes to discover valid endpoints/parameters | Low | Error codes describe validation rules, not system internals. No mitigation needed beyond existing rate limiting. |

### Authorization Rules

No change — error codes do not affect authorization. Same JWT + ownership checks apply.

### Input Validation Rules

No new user input. Error codes are generated server-side only.

### External Dependency Risks

No new external dependencies. `next-intl` is already installed and in use.

### Sensitive Data Handling

- Error codes must NOT contain user data (email, wallet name, etc.)
- Internal server error codes (`WALLET_CREATE_INITIAL_TX_FAILED`, etc.) should be reviewed — if they expose internal architecture, consider using a generic `INTERNAL_ERROR` code for 500s and keeping granular codes only for 4xx errors

**Decision:** For 500 errors, keep granular codes for developer debugging. The frontend already sanitizes error messages via `error-sanitizer.ts`, and error codes alone don't leak exploitable information.

### Issues & Risks Summary

1. **Risk: Code name leaking internals** — Low severity. Mitigated by reviewing all code names during implementation.
2. **Risk: Missing translation for new code** — Low severity. Fallback to `error.message` ensures users always see something. CI check can verify all codes have translations.
3. **Risk: Breaking frontend error parsing** — Medium severity. Mitigated by keeping the response format identical (only the `code` value changes). The `message` field is unchanged.

## Edge Cases & Error Handling

1. **Unknown error code on frontend**: If the backend returns a code not in the translation file (e.g., new code added to backend but not yet translated), the utility falls back to `error.message`.
2. **Empty error code**: If `error.code` is undefined/empty, fall back to `error.message` (current behavior).
3. **Dynamic parameters in error messages**: Some errors contain dynamic values (e.g., `"Investment AAPL already exists with currency USD"`). The granular code `INVESTMENT_DUPLICATE` is static; the translation uses interpolation: `t("errors.INVESTMENT_DUPLICATE", { symbol: "AAPL", currency: "USD" })`. This requires the backend to also return parameters — add optional `params` field to error response.

## Dependencies & Assumptions

- `next-intl` v4.8.3 is already installed and configured with `vi` and `en` locales
- The existing `APIError` struct in `pkg/types/response.go` is the single error response type
- The `ApiRequestError` class in `utils/api-client.ts` already exposes `code` field

## Out of Scope

- Adding new languages beyond vi/en
- Client-side validation error i18n (Zod schema messages) — handled separately by existing Zod + next-intl integration
- Error logging/monitoring (Sentry, etc.)
- Error retry UX improvements
- Changing error HTTP status codes
- Adding error `params` field for dynamic interpolation (can be added as a follow-up; for now, fallback to `error.message` for parameterized errors)
