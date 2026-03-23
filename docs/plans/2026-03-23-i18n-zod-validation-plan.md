# i18n Zod Validation Translation — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Translate all ~70 hardcoded Zod validation messages to support en/vi using domain-specific translation keys.
**Spec:** `docs/specs/2026-03-23-i18n-zod-validation-spec.md`
**Architecture:** Frontend-only change. Zod schemas use key identifiers instead of English strings. RHF wrapper components (`RHFFormInput`, `RHFFormSelect`, `FormNumberInput`) translate keys via `useTranslations('validation')` before rendering. Falls back to raw message if key not found.
**Tech Stack:** next-intl, Zod, react-hook-form, TypeScript

## Security Implementation Notes

- No authentication/authorization changes
- No API or data model changes
- No new dependencies
- Translation keys are static strings — no injection risk
- next-intl escapes output by default — no XSS risk

## Component Reuse Inventory

**Existing components to modify:**

| Component | Location | Modification |
|-----------|----------|-------------|
| `RHFFormInput` | `components/forms/RHFFormInput.tsx` | Add `useTranslations`, translate `error?.message` |
| `RHFFormSelect` | `components/forms/RHFFormSelect.tsx` | Add `useTranslations`, translate `error?.message` |
| `FormNumberInput` | `components/forms/FormNumberInput.tsx` | Add `useTranslations`, translate `error.message` |

**New components needed:** None

## C4 Architecture Diagram Updates

Minor — add a note to `c4-component-frontend.md` about validation i18n in the Shared Component Library section. Bundled into the final documentation task.

---

### Task 0: Create Validation Translation Files (en + vi)

**Files:**

- Create: `src/wj-client/messages/en/validation.json`
- Create: `src/wj-client/messages/vi/validation.json`
- Modify: `src/wj-client/i18n/request.ts`

**Security notes:** None — static translation files only.

**Steps:**

1. Create `messages/en/validation.json` with all domain-specific keys mapped to current English messages
2. Create `messages/vi/validation.json` with Vietnamese translations
3. Add `'validation'` to `messageGroups` array in `i18n/request.ts`
4. Verify frontend build succeeds: `cd src/wj-client && npm run build`

**Translation Key Catalog:**

```
# Common
COMMON_NAME_MIN          "Name must be at least 2 characters"
COMMON_NAME_MAX          "Name must not exceed 50 characters"
COMMON_AMOUNT_NUMBER     "Amount must be a number"
COMMON_AMOUNT_POSITIVE   "Amount must be positive"
COMMON_AMOUNT_MIN        "Amount must be at least 0.01"
COMMON_AMOUNT_MAX        "Amount exceeds maximum allowed"
COMMON_DATE_VALID        "Must be a valid date"
COMMON_TIMESTAMP_VALID   "Must be a valid timestamp"
COMMON_DATE_POSITIVE     "Date must be valid"
COMMON_DATE_MIN          "Date must be after January 1, 2000"
COMMON_DATE_MAX          "Date must be before January 1, 2100"
COMMON_NOTE_MAX          "Note must not exceed 500 characters"
COMMON_WALLET_ID         "Invalid wallet ID"
COMMON_CATEGORY_ID       "Invalid category ID"

# Wallet
WALLET_NAME_EXISTS       "A wallet with this name already exists"
WALLET_TYPE_INVALID      "Invalid wallet type"
WALLET_ADJUST_AMOUNT_MIN "Adjustment amount must be at least 0.01"
WALLET_ADJUST_TYPE       "Please select whether to add or remove funds"
WALLET_ADJUST_REASON_MAX "Reason must be less than 200 characters"

# Transfer
TRANSFER_SOURCE_REQUIRED "Source wallet is required"
TRANSFER_SAME_WALLET     "Source and destination wallets must be different"
TRANSFER_INSUFFICIENT    "Insufficient balance in source wallet"

# Transaction
TRANSACTION_WALLET       "Wallet is required"
TRANSACTION_CATEGORY     "Category is required"
TRANSACTION_DATE         "Date is required"

# Investment
INVESTMENT_SYMBOL_REQUIRED    "Symbol is required"
INVESTMENT_SYMBOL_MAX         "Symbol must be 50 characters or less"
INVESTMENT_NAME_REQUIRED      "Name is required"
INVESTMENT_NAME_MAX           "Name must be 100 characters or less"
INVESTMENT_QUANTITY_POSITIVE  "Quantity must be positive"
INVESTMENT_PRICE_MIN          "Price per unit must be 0 or greater"
INVESTMENT_COST_MIN           "Initial cost must be 0 or greater"
INVESTMENT_DATE_REQUIRED      "Purchase date is required"
INVESTMENT_CURRENCY_LENGTH    "Currency must be a 3-letter ISO code"
INVESTMENT_CURRENCY_FORMAT    "Currency must be 3 uppercase letters"
INVESTMENT_QUANTITY_GT_ZERO   "Quantity must be greater than 0"
INVESTMENT_SYMBOL_FORMAT      "Symbol should contain only letters, numbers, dots, underscores, and hyphens"
INVESTMENT_PRICE_NON_NEGATIVE "Price must be non-negative"
INVESTMENT_FEES_NON_NEGATIVE  "Fees must be non-negative"
INVESTMENT_TX_DATE_REQUIRED   "Transaction date is required"

# Feedback
FEEDBACK_SUBJECT_REQUIRED "Subject is required"
FEEDBACK_SUBJECT_MAX      "Subject must be 200 characters or less"
FEEDBACK_MESSAGE_REQUIRED "Message is required"
FEEDBACK_MESSAGE_MAX      "Message must be 2000 characters or less"

# Community
COMMUNITY_CONTENT_REQUIRED    "Content is required"
COMMUNITY_CONTENT_MAX         "Maximum 2000 characters"
COMMUNITY_COMMENT_REQUIRED    "Comment is required"
COMMUNITY_COMMENT_MAX         "Maximum 500 characters"
COMMUNITY_BIO_MAX             "Bio must be 200 characters or less"
COMMUNITY_REASON_REQUIRED     "Please select a reason"
COMMUNITY_COMMENT_EMPTY       "Comment cannot be empty"
COMMUNITY_COMMENT_LENGTH_MAX  "Comment must be 500 characters or less"
COMMUNITY_LOCATION_MAX        "Location must be 100 characters or less"
COMMUNITY_URL_INVALID         "Must be a valid URL"
COMMUNITY_CHAR_MAX_200        "Maximum 200 characters"

# Auth
AUTH_FIELD_REQUIRED       "Required"
AUTH_USERNAME_MIN         "Min 3 characters"
AUTH_USERNAME_MAX         "Max 30 characters"
AUTH_USERNAME_FORMAT      "Letters, numbers, and underscores only"
AUTH_EMAIL_MAX            "Max 100 characters"
AUTH_PASSWORD_MIN         "Min 10 characters"
AUTH_PASSWORD_MAX         "Max 72 characters"
AUTH_PASSWORD_MATCH       "Passwords do not match"
```

---

### Task 1: Update RHF Wrapper Components to Translate Errors

**Files:**

- Modify: `src/wj-client/components/forms/RHFFormInput.tsx`
- Modify: `src/wj-client/components/forms/RHFFormSelect.tsx`
- Modify: `src/wj-client/components/forms/FormNumberInput.tsx`

**Security notes:** Translation keys are static strings. Fallback to raw message ensures no breakage.

**Steps:**

1. In each component, add `import { useTranslations } from "next-intl";`
2. Add `const tValidation = useTranslations("validation");` inside the component
3. Create a helper to translate error messages:
   ```typescript
   const translatedError = error?.message
     ? (() => {
         try {
           const key = `validation.${error.message}`;
           const translated = tValidation(error.message);
           return translated !== key ? translated : error.message;
         } catch {
           return error.message;
         }
       })()
     : undefined;
   ```
4. Pass `translatedError` instead of `error?.message` to the base component
5. Verify frontend build: `cd src/wj-client && npm run build`

---

### Task 2: Update Common Validation Schemas

**Files:**

- Modify: `src/wj-client/lib/validation/common.ts`

**Security notes:** Validation rules (min, max, regex) unchanged — only display strings change.

**Steps:**

1. Replace all hardcoded message strings with corresponding translation keys
2. Example: `.min(2, "Name must be at least 2 characters")` → `.min(2, "COMMON_NAME_MIN")`
3. Verify all schemas referencing common schemas still work: `cd src/wj-client && npm run build`

---

### Task 3: Update Wallet Schemas

**Files:**

- Modify: `src/wj-client/features/wallet/utils/wallet.schema.ts`
- Modify: `src/wj-client/features/wallet/utils/transfer.schema.ts`

**Steps:**

1. Replace hardcoded messages with `WALLET_*` and `TRANSFER_*` keys
2. Build verify

---

### Task 4: Update Transaction Schema

**Files:**

- Modify: `src/wj-client/features/transaction/utils/transaction.schema.ts`

**Steps:**

1. Replace hardcoded messages with `TRANSACTION_*` keys
2. Build verify

---

### Task 5: Update Investment Schema

**Files:**

- Modify: `src/wj-client/features/investment/utils/investment-schema.ts`

**Steps:**

1. Replace hardcoded messages with `INVESTMENT_*` keys
2. Build verify

---

### Task 6: Update Feedback Schema

**Files:**

- Modify: `src/wj-client/features/feedback/utils/feedback-schema.ts`

**Steps:**

1. Replace hardcoded messages with `FEEDBACK_*` keys
2. Build verify

---

### Task 7: Update Community Schema

**Files:**

- Modify: `src/wj-client/features/community/utils/community.schema.ts`

**Steps:**

1. Replace hardcoded messages with `COMMUNITY_*` keys
2. Build verify

---

### Task 8: Update Auth Form Schemas

**Files:**

- Modify: `src/wj-client/features/auth/forms/LoginPasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/RegisterPasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/ChangePasswordForm.tsx`
- Modify: `src/wj-client/features/auth/forms/LinkPasswordForm.tsx`

**Steps:**

1. Replace hardcoded messages with `AUTH_*` keys in each form's inline Zod schema
2. Build verify

---

### Task 9: Build Verification & Documentation

**Files:**

- Modify: `docs/reports/2026-03-23-i18n-error-codes-report.md` — Append fix history entry
- Modify: `docs/architecture/c4-component-frontend.md` — Add validation i18n note (if warranted)

**Steps:**

1. Run full frontend build: `cd src/wj-client && npm run build`
2. Verify no TypeScript errors
3. Append fix history entry to the i18n error codes report
4. Update architecture docs if needed

---

## Task Dependency Graph

```
Task 0 (translation files + i18n config)
  ↓
Task 1 (RHF wrappers — translate at display)
  ↓
Tasks 2-8 (schema updates — can run in PARALLEL)
  ↓
Task 9 (build verification + docs)
```

Tasks 2-8 are independent of each other but depend on Tasks 0 and 1 being done first.

## Success Criteria

1. `npm run build` passes with zero errors
2. All Zod validation messages display in Vietnamese when locale is `vi`
3. All Zod validation messages display in English when locale is `en`
4. If a translation key is missing, the raw key string displays (graceful fallback)
5. No changes to validation rules — same fields, same constraints, same behavior
