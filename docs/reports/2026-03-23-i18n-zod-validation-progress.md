# i18n Zod Validation Translation — Implementation Progress

## Metadata

- **Feature:** i18n Zod validation translation
- **Plan file:** `docs/plans/2026-03-23-i18n-zod-validation-plan.md`
- **Spec file:** `docs/specs/2026-03-23-i18n-zod-validation-spec.md`
- **Started:** 2026-03-23
- **Last updated:** 2026-03-23
- **Current state:** completed
- **Current task:** done

## Task Progress

| #   | Task Name | Status | Commit | Summary |
| --- | --------- | ------ | ------ | ------- |
| 1   | Create validation translation files (en + vi) | done | pending | Created en/vi validation.json with ~70 keys, registered in i18n config |
| 2   | Update RHF wrapper components | done | pending | RHFFormInput, RHFFormSelect, FormNumberInput now translate via useTranslations('validation') |
| 3   | Update common validation schemas | done | pending | 14 messages replaced with COMMON_* keys |
| 4   | Update wallet schemas | done | pending | wallet.schema.ts + transfer.schema.ts updated with WALLET_*/TRANSFER_* keys |
| 5   | Update transaction schema | done | pending | 3 messages replaced with TRANSACTION_* keys |
| 6   | Update investment schema | done | pending | 15 messages replaced with INVESTMENT_* keys |
| 7   | Update feedback schema | done | pending | 4 messages replaced with FEEDBACK_* keys |
| 8   | Update community schema | done | pending | 11 messages replaced with COMMUNITY_* keys |
| 9   | Update auth form schemas | done | pending | 4 auth forms updated with AUTH_* keys + translateValidationMessage helper |
| 10  | Build verification + docs | done | pending | npm run build clean, report updated |

## Notes

- Auth forms use `useForm` + `formState: { errors }` directly (not RHF wrappers), so needed `translateValidationMessage()` utility added to `error-translator.ts`
- Build passes cleanly with all changes
