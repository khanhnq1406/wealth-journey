# Fix: Zod Validation Errors Not Translated by i18n

## Original Feature

- Spec: `docs/specs/2026-03-23-i18n-error-codes-spec.md`
- Plan: `docs/plans/2026-03-23-i18n-error-codes-plan.md`
- Report: `docs/reports/2026-03-23-i18n-error-codes-report.md`

## Summary

Zod validation error messages are hardcoded English strings (e.g., `"Name must be at least 2 characters"`). When users set their language to Vietnamese, API errors display in Vietnamese (via the i18n error codes feature), but client-side validation errors remain in English. This fix translates all ~70 Zod validation messages using domain-specific translation keys, consistent with the existing `DOMAIN_ACTION_REASON` error code pattern.

## Issues to Fix

| #   | Issue | Source | Severity |
| --- | ----- | ------ | -------- |
| 1   | Zod schema messages are hardcoded English strings | User report | Medium |
| 2   | RHF wrapper components pass `error?.message` directly without translation | Code review | Medium |

## Root Cause Analysis

The i18n error codes feature (Task 14-16) only addressed **API errors** — server returns error codes, frontend translates them via `getTranslatedError()`. Client-side **Zod validation** was out of scope because Zod schemas define messages at schema-creation time, before any React/i18n context is available.

## User Stories

- As a Vietnamese-speaking user, I want form validation errors to display in Vietnamese, so that the entire app experience is in my language.
- As a user switching languages, I want validation messages to update when I change language settings, consistent with API error messages.

## Functional Requirements

### FR-1: Validation Translation Keys

Create domain-specific translation keys for all ~70 Zod validation messages in both `en` and `vi` translation files.

**Acceptance criteria:**

- [ ] New `messages/en/validation.json` and `messages/vi/validation.json` files created
- [ ] Keys follow `DOMAIN_ACTION_REASON` naming convention (e.g., `WALLET_NAME_MIN`, `AUTH_PASSWORD_MATCH`)
- [ ] All hardcoded Zod messages have corresponding translation keys
- [ ] `validation` message group registered in `i18n/request.ts`

### FR-2: Zod Schemas Use Translation Keys Instead of English Strings

Replace hardcoded English strings in all Zod schemas with translation key identifiers that can be resolved at display time.

**Acceptance criteria:**

- [ ] All 13 schema files updated to use translation keys as message strings
- [ ] Keys are plain string identifiers (not translated text) — e.g., `"WALLET_NAME_MIN"` instead of `"Name must be at least 2 characters"`
- [ ] Schema validation behavior unchanged — same rules, same field mappings

### FR-3: RHF Wrapper Components Translate Error Messages

Update `RHFFormInput`, `RHFFormSelect`, and `FormNumberInput` RHF wrappers to translate Zod error messages before rendering.

**Acceptance criteria:**

- [ ] `RHFFormInput` translates `error?.message` using validation translations before passing to `FormInput`
- [ ] `RHFFormSelect` translates `error?.message` using validation translations before passing to `FormSelect`
- [ ] `FormNumberInput` (if it uses useController directly) translates error messages
- [ ] Fallback: if translation key not found, display the raw message (backward compatible)
- [ ] No changes needed to base `FormInput`/`FormSelect` components (translation happens in RHF wrappers)

## Non-Functional Requirements

- **Performance**: Translation lookup is O(1) via next-intl's message map — no measurable impact
- **Backward compatibility**: If a Zod message doesn't have a translation key, the raw message displays (graceful fallback)
- **Maintainability**: New Zod validations only need to add a key to `validation.json` files

## Architecture Changes (C4)

### Diagrams to Update

- `docs/architecture/c4-component-frontend.md` — Add note that RHF wrappers now perform validation message translation via the `validation` message namespace

### New Diagrams

None needed — this is a display-layer change within existing frontend components.

## Runtime Flow Diagrams

### Flow Diagrams to Update

- `docs/architecture/flow-cross-cutting.md` — Update the "Frontend API Lifecycle" or add a brief note about client-side validation i18n flow

### New Flow Diagrams

None needed — simple translation lookup, no multi-step business logic.

## Data Model Changes

None — frontend-only change.

## API Changes

None — frontend-only change.

## UI/UX Changes

No visual changes. Error messages display identically but in the user's chosen language.

### Existing Component Inventory

| Need | Existing Component | Location |
| --- | --- | --- |
| RHF input wrapper | `RHFFormInput` | `components/forms/RHFFormInput.tsx` |
| RHF select wrapper | `RHFFormSelect` | `components/forms/RHFFormSelect.tsx` |
| Number input | `FormNumberInput` | `components/forms/FormNumberInput.tsx` |
| Error translation utility | `getTranslatedError` (API errors) | `lib/utils/error-translator.ts` |

### New Components

None — modifying existing RHF wrappers only.

## Security & Risk Assessment

### Data Flow Diagram

| #   | Source | Data | Trust Boundary Crossed? | Destination | Notes |
| --- | ------ | ---- | ----------------------- | ----------- | ----- |
| 1   | Zod schema | Validation key string | No | RHF wrapper | Internal, same process |
| 2   | RHF wrapper | Key string | No | next-intl `t()` | In-memory lookup |
| 3   | next-intl | Translated string | No | DOM | React rendering |

### Trust Boundaries

No trust boundaries crossed. All data flows are client-side, in-memory, between React components.

### Threats Identified (STRIDE per boundary crossing)

No boundary crossings — STRIDE not applicable.

### OWASP Top 10 Relevance

| # | Vulnerability | Relevant? | Notes |
|---|--------------|-----------|-------|
| A01 | Broken Access Control | No | No access control changes |
| A02 | Cryptographic Failures | No | No crypto changes |
| A03 | Injection | No | Translation keys are static strings, not user input. next-intl escapes output by default |
| A04 | Insecure Design | No | Display-only change |
| A05-A10 | All others | No | No server, auth, data, or dependency changes |

### Financial-Specific Concerns

None — no monetary logic, no data model changes, no API changes.

### Authorization Rules

No changes — display-only.

### Input Validation Rules

No changes to validation logic — only the display language of error messages changes.

### External Dependency Risks

None — no new dependencies. Uses existing `next-intl` already in the project.

### Sensitive Data Handling

None — validation messages contain no sensitive data.

### Issues & Risks Summary

1. **Low risk**: If a translation key is misspelled in a schema, the user sees the key string instead of a translated message. Mitigated by fallback behavior and build-time verification.
2. **Low risk**: Existing `validation` namespace in `common.json` has ~10 generic keys that overlap with the new domain-specific keys. These can be deprecated in a follow-up but don't conflict.

## Edge Cases & Error Handling

1. **Missing translation key**: RHF wrapper falls back to raw message string (the Zod key identifier). Acceptable degradation.
2. **New schema added without translation**: Works identically to today (English message) until translation is added.
3. **Auth forms with inline schemas**: Same pattern applies — the RHF wrappers handle translation regardless of where the schema is defined.

## Dependencies & Assumptions

- `next-intl` is already configured with per-locale message loading
- `useTranslations` hook is available in all "use client" components
- The `i18n/request.ts` message group system supports adding new groups

## Out of Scope

1. **`lib/validation/form-validation.ts`** — Legacy validation rules/messages (non-Zod). Will be addressed separately if needed.
2. **`features/investment/utils/investment-validation.ts`** — Non-Zod validation functions. Separate concern.
3. **Existing generic `validation` keys in `common.json`** — Keep as-is, deprecate later.
4. **Dynamic parameter interpolation in Zod messages** — Zod's `.min(2, "...")` doesn't support runtime params natively. The translated messages can include hardcoded numbers since each key is domain-specific (e.g., `WALLET_NAME_MIN` = "Wallet name must be at least 2 characters").

## Files to Change

### Translation Files (New)

- `messages/en/validation.json` — ~70 domain-specific validation keys (English)
- `messages/vi/validation.json` — ~70 domain-specific validation keys (Vietnamese)

### i18n Config

- `i18n/request.ts` — Add `'validation'` to `messageGroups` array

### RHF Wrapper Components (3 files)

- `components/forms/RHFFormInput.tsx` — Add `useTranslations('validation')`, translate `error?.message`
- `components/forms/RHFFormSelect.tsx` — Same pattern
- `components/forms/FormNumberInput.tsx` — Same pattern (if uses useController)

### Zod Schema Files (13 files)

- `lib/validation/common.ts` — Replace ~14 message strings with keys
- `features/wallet/utils/wallet.schema.ts` — Replace ~5 messages
- `features/wallet/utils/transfer.schema.ts` — Replace ~3 messages
- `features/transaction/utils/transaction.schema.ts` — Replace ~3 messages
- `features/budget/utils/budget.schema.ts` — No changes (uses common schemas)
- `features/investment/utils/investment-schema.ts` — Replace ~15 messages
- `features/feedback/utils/feedback-schema.ts` — Replace ~4 messages
- `features/community/utils/community.schema.ts` — Replace ~11 messages
- `features/auth/forms/LoginPasswordForm.tsx` — Replace ~2 messages
- `features/auth/forms/RegisterPasswordForm.tsx` — Replace ~8 messages
- `features/auth/forms/ChangePasswordForm.tsx` — Replace ~5 messages
- `features/auth/forms/LinkPasswordForm.tsx` — Replace ~7 messages

### Documentation

- `docs/reports/2026-03-23-i18n-error-codes-report.md` — Append fix history entry
