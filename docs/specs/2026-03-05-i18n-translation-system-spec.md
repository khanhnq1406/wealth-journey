# i18n Translation System Specification

**Date:** 2026-03-05
**Status:** Draft
**Author:** WealthJourney Team

---

## Summary

Add a full internationalization (i18n) system to the WealthJourney frontend using **next-intl** with URL-based locale routing. The app currently has all UI strings hardcoded in English across ~69 source files and ~635+ string instances. This feature adds Vietnamese (`vi`) as a second supported language alongside English (`en`), with the user's language preference stored in their backend profile and surfaced through a toggle in the Settings page.

The locale is encoded in the URL (`/vi/dashboard/home`, `/en/dashboard/home`), which is the canonical next-intl pattern for Next.js App Router. A new middleware layer handles locale detection from the user's stored cookie, with fallback to browser `Accept-Language` header. Date and number formatting will also follow the active locale.

---

## User Stories

- As a Vietnamese-speaking user, I want the entire app to display in Vietnamese, so that I can understand financial information in my native language.
- As a user, I want to switch languages from the Settings page, so that my preference persists across sessions and devices.
- As a user switching language, I want my URL to reflect the active locale (e.g., `/vi/dashboard/home`), so that browser history and bookmarks work correctly.
- As an existing user, I want to be redirected to `/vi/...` by default (Vietnamese), as the app primarily targets Vietnamese users.
- As a developer, I want all UI strings in type-safe message catalogs, so that missing translations are caught at build time.

---

## Functional Requirements

### FR-1: Locale-Prefixed URL Routing

All application routes are prefixed with the active locale segment:

- `/en/landing`, `/vi/landing`
- `/en/auth/login`, `/vi/auth/login`
- `/en/dashboard/home`, `/vi/dashboard/home`
- Root `/` and locale-less URLs redirect to `/{defaultLocale}/...`

**Acceptance criteria:**

- [ ] Visiting `/` redirects to `/vi/` (default locale)
- [ ] Visiting `/dashboard/home` (no locale) redirects to `/vi/dashboard/home`
- [ ] Visiting `/vi/dashboard/home` renders the Vietnamese version
- [ ] All `<Link>` components and `router.push()` calls use locale-aware paths
- [ ] `<html lang="...">` attribute is dynamic and matches the active locale

### FR-2: Middleware Locale Detection

A Next.js middleware reads the active locale in this priority order:

1. Locale from URL path segment (`/vi/...` → `vi`)
2. User preference cookie (`wj-locale` cookie set by Settings toggle)
3. Browser `Accept-Language` header
4. Default: `vi`

**Acceptance criteria:**

- [ ] Middleware runs on all routes except `_next/static`, `_next/image`, `favicon.ico`, and API routes
- [ ] Setting the `wj-locale` cookie to `vi` causes middleware to route to `/vi/...`
- [ ] Browser with `Accept-Language: vi` is routed to `/vi/...` on first visit
- [ ] Unsupported locale in URL falls back to default locale (`vi`)

### FR-3: Language Settings Toggle

A language selector is added to the Settings page (or a new settings subsection):

- Shows current active language
- Allows switching between English and Vietnamese
- On switch: saves preference to backend (`PUT /api/v1/users/preferences`) + sets `wj-locale` cookie + redirects to same page under new locale

**Acceptance criteria:**

- [ ] Language selector visible in `/dashboard/settings` (new settings page or existing section)
- [ ] Switching language calls `UpdatePreferences` with `language: "vi"` or `"en"`
- [ ] After save, the `wj-locale` cookie is set and the user is redirected to the equivalent page under the new locale
- [ ] Preference persists across sessions (loaded from backend user profile on login)
- [ ] Both language names shown in their own language: "English" and "Tiếng Việt"

### FR-4: Backend Language Preference Storage

The backend stores the user's language preference alongside their currency preference.

**Acceptance criteria:**

- [ ] `user.proto` `UserPreferences` message gains a `language` field (string, ISO 639-1 code)
- [ ] `User` GORM model gains a `PreferredLanguage` column (`varchar(5)`, default `'vi'`)
- [ ] `UpdatePreferences` handler updates the new column
- [ ] `GetUser` / `GetAuth` response includes the `language` field
- [ ] Frontend reads `language` from auth response on login to set initial locale

### FR-5: Full App Translation Coverage

All user-facing strings in the app are extracted to translation message catalogs:

- `messages/en.json` — English (base language, the current hardcoded strings)
- `messages/vi.json` — Vietnamese translations

Scope covers:

- Landing page (all 8 components)
- Auth pages (login, register)
- Dashboard layout (navigation labels)
- All dashboard pages (home, transaction, wallets, portfolio, budget, report, prices)
- All feature forms (transaction, wallet, budget, investment, import)
- Shared components (EmptyState, ErrorState, modals, ConfirmationDialog)
- Settings pages

**Acceptance criteria:**

- [ ] No hardcoded UI strings remain in any `.tsx`/`.ts` source file (all replaced with `t('key')`)
- [ ] `messages/en.json` is the authoritative base; `messages/vi.json` covers 100% of keys
- [ ] TypeScript type-checking via `next-intl`'s `createTranslator` catches missing keys at compile time
- [ ] Server components use `getTranslations()`, client components use `useTranslations()`

### FR-6: Locale-Aware Date and Number Formatting

Date and number formatting utilities respect the active locale:

- `lib/utils/date.ts` helpers accept an optional locale parameter, defaulting to the active locale
- `date-fns` locale imports added for `vi` and `en-US`
- `Intl.DateTimeFormat` calls use the active locale instead of hardcoded `"en-US"`

**Acceptance criteria:**

- [ ] Dates shown as "15 tháng 1, 2025" in Vietnamese, "Jan 15, 2025" in English
- [ ] `formatDistanceToNow` uses `date-fns` `vi` locale when active language is Vietnamese
- [ ] Number separators: `1.000.000` style for `vi-VN`, `1,000,000` for `en-US` (note: currency formatting already uses `vi-VN` for VND — this applies to non-currency numbers)

---

## Non-Functional Requirements

- **Performance:** Translation message catalogs are loaded per-locale; next-intl handles code-splitting automatically. No additional bundle size for unused locales.
- **Type safety:** All translation keys are typed via next-intl's TypeScript integration (`global.d.ts` augmentation). Missing keys cause TypeScript errors.
- **Fallback:** If a Vietnamese translation key is missing, fall back to English silently (next-intl fallback locale). Default locale is `vi`.
- **SEO:** `<html lang>` attribute set correctly per locale. Landing page `/vi/landing` and `/en/landing` are separately indexable.
- **Accessibility:** Language switching via Settings (not automatic) — users are in control. Language is announced via `<html lang>`.
- **Security:** Language input is validated to the allowlist `["en", "vi"]` on the backend before saving.

---

## Architecture Changes (C4)

### Diagrams to Update

**`docs/architecture/c4-component-backend.md` (L3 Backend):**

- Update `UserHandler` component description to note it now handles `language` field in `UpdatePreferences`
- No new components needed

**`docs/architecture/c4-component-frontend.md` (L3 Frontend):**

- Add `next-intl Middleware` as a new infrastructure component in the frontend container
- Add `Translation Catalogs` as a data store (`messages/en.json`, `messages/vi.json`)
- Add `LanguageContext` (or note that locale comes from next-intl's built-in context)
- Update `SettingsPage` component to include language toggle

### New Diagrams

No new L4 code diagram is needed — this is infrastructure/configuration work, not a new complex domain.

---

## Runtime Flow Diagrams

### Flow Diagrams to Update

**`docs/architecture/flow-auth.md`** — Update the login flow to include:

- After successful login: read `language` from auth response → set `wj-locale` cookie → redirect to `/{language}/dashboard/home`

### New Flow Diagrams

**New: "Locale Detection & Language Switch" flow** — add to a new `flow-i18n.md`:

1. **First visit flow** (sequenceDiagram): Browser → Middleware → locale detection priority → redirect
2. **Language switch flow** (sequenceDiagram): User toggles → Settings → PUT preferences → set cookie → redirect to same page under new locale

---

## Data Model Changes

### Backend: `user` table

Add column to existing `user` table:

| Column               | Type         | Default | Constraint |
| -------------------- | ------------ | ------- | ---------- |
| `preferred_language` | `varchar(5)` | `'vi'`  | NOT NULL   |

### Backend: `user.proto` — `UserPreferences` message

```protobuf
message UserPreferences {
  string preferredCurrency = 1 [json_name = "preferredCurrency"];
  string language = 2 [json_name = "language"];  // ISO 639-1: "en", "vi"
}
```

### Frontend: `messages/` directory (new)

```
src/wj-client/
├── messages/
│   ├── en.json   # ~635 English strings, organized by namespace
│   └── vi.json   # Vietnamese translations of all keys
```

Message catalog structure (namespace-organized):

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Error",
    "retry": "Try again"
  },
  "nav": {
    "home": "Home",
    "transactions": "Transactions",
    "wallets": "Wallets",
    "portfolio": "Portfolio",
    "prices": "Prices",
    "report": "Reports",
    "budget": "Budget",
    "logout": "Logout"
  },
  "landing": { ... },
  "auth": { ... },
  "dashboard": { ... },
  "transaction": { ... },
  "wallet": { ... },
  "investment": { ... },
  "budget": { ... },
  "report": { ... },
  "prices": { ... },
  "settings": { ... },
  "feedback": {
    "emptyState": { ... },
    "errorState": { ... }
  },
  "modals": { ... }
}
```

### Frontend: Route structure change

The `app/` directory is restructured to wrap all routes under a `[locale]` dynamic segment:

```
Before:
app/
├── layout.tsx
├── page.tsx
├── landing/
├── auth/
└── dashboard/

After:
app/
├── [locale]/
│   ├── layout.tsx        ← moved here, reads locale param for <html lang>
│   ├── page.tsx          ← moved here
│   ├── landing/
│   ├── auth/
│   └── dashboard/
└── (no layout at root — only middleware redirect)
```

---

## API Changes

### Modified: `PUT /api/v1/users/preferences`

**Request** (extended):

```json
{
  "preferences": {
    "preferredCurrency": "VND",
    "language": "vi"
  }
}
```

**Response** — same structure, but the returned `User` object now includes `language`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "preferredCurrency": "VND",
    "language": "vi"
  }
}
```

### Modified: `GET /api/v1/users/me` and `GET /api/v1/auth/verify`

Response `User` object gains `language` field, used by frontend on login to set initial locale cookie.

---

## UI/UX Changes

### New: Language Selector in Settings

A language selector component added to the Settings page (either `/dashboard/settings` if it exists as a page, or a new `/dashboard/settings/language` page):

- Shows flag + language name for current active language
- Dropdown or radio toggle with two options:
  - 🇬🇧 English
  - 🇻🇳 Tiếng Việt
- Save button triggers API call + cookie + redirect
- Loading state while saving

### Modified: All pages/components

All hardcoded English strings replaced with `t('key')` calls. The visual appearance of all pages stays identical for English users (same strings, same layout). Vietnamese users see translated strings in the same layout.

### Modified: `<html lang>` attribute

`app/[locale]/layout.tsx` sets `<html lang={locale}>` dynamically.

**REQUIRED for any frontend/UI work:**

- Follow **mobile-first design** — use `responsive-design` skill for Tailwind breakpoints
- Follow **ui-ux-pro-max** skill for design system, color palette, typography, and accessibility
- This app uses `sm:` at 800px (custom breakpoint) — always verify against `tailwind.config.ts`

---

## Security & Risk Assessment

### Data Flow Diagram

| #   | Source             | Data                                 | Trust Boundary Crossed? | Destination            | Notes                                       |
| --- | ------------------ | ------------------------------------ | ----------------------- | ---------------------- | ------------------------------------------- |
| 1   | Browser URL        | Locale segment (`/vi/...`)           | No                      | Next.js Middleware     | URL segment parsed, not echoed to user      |
| 2   | Browser            | `wj-locale` cookie                   | No (same origin)        | Next.js Middleware     | HttpOnly not required — not a session token |
| 3   | Browser            | `Accept-Language` header             | Yes: Internet → App     | Next.js Middleware     | Read-only, not trusted for auth             |
| 4   | Authenticated user | `{ language: "vi" }` in request body | Yes: Internet → App     | Go Backend Handler     | Must be validated against allowlist         |
| 5   | Go Backend         | `language` column                    | No                      | PostgreSQL             | Stored as `varchar(5)` with constraint      |
| 6   | Go Backend         | User object with `language` field    | Yes: App → Browser      | Frontend Redux store   | Returned in auth response                   |
| 7   | Frontend           | Locale string                        | No                      | `next-intl` runtime    | Used to select message catalog              |
| 8   | Frontend           | `messages/vi.json`                   | No                      | React component render | Static file, no user input                  |

### Trust Boundaries

| Boundary       | Crossed By                         | Security Control                                         |
| -------------- | ---------------------------------- | -------------------------------------------------------- |
| Internet → App | Language preference update (DF#4)  | JWT authentication + allowlist validation                |
| Internet → App | Accept-Language header (DF#3)      | Read-only, no side effects; allowlist applied before use |
| App → Browser  | User object with `language` (DF#6) | Existing JWT auth; `language` is non-sensitive           |

### Threats Identified (STRIDE per boundary crossing)

| #   | Data Flow                 | Boundary       | STRIDE                 | Threat                                                                                                       | Severity | Mitigation                                                                                                                                                          |
| --- | ------------------------- | -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1 | DF#4 — language update    | Internet → App | Tampering              | User sends `language: "../../etc/passwd"` or arbitrary string to inject into DB or cause unexpected behavior | Medium   | Backend validates `language` against strict allowlist `["en", "vi"]`, rejects with 400 if not in list                                                               |
| T-2 | DF#1 — locale in URL      | No boundary    | Tampering              | User manually edits URL to `/fr/dashboard/home` (unsupported locale)                                         | Low      | Middleware checks locale against allowlist; unsupported locales redirect to `/vi/` (default)                                                                        |
| T-3 | DF#2 — `wj-locale` cookie | No boundary    | Tampering              | User edits cookie to unsupported value                                                                       | Low      | Middleware validates cookie value against allowlist before use; falls back to `vi` (default)                                                                        |
| T-4 | DF#6 — auth response      | App → Browser  | Information Disclosure | `language` field leaks sensitive info                                                                        | Low      | Language preference is non-sensitive (it's the UI language). No PII involved.                                                                                       |
| T-5 | DF#7 — translation keys   | No boundary    | Spoofing               | Malicious translation string injects HTML/JS                                                                 | Medium   | next-intl uses React's default XSS protection (JSX escaping). Never use `dangerouslySetInnerHTML` with translation strings. Only use `t()` in JSX text positions.   |
| T-6 | DF#3 — Accept-Language    | Internet → App | Denial of Service      | Extremely long Accept-Language header                                                                        | Low      | Next.js middleware parses the header with `@formatjs/intl-localematcher` which handles malformed values gracefully; header size limits apply at reverse proxy level |
| T-7 | DF#4 — language update    | Internet → App | Elevation of Privilege | Unauthenticated user calls `PUT /api/v1/users/preferences`                                                   | High     | Existing JWT middleware already protects this endpoint; no new auth surface                                                                                         |

### Authorization Rules

| Operation                  | Who can perform it                   | Control location                                                     |
| -------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Update language preference | Authenticated user, own profile only | Existing JWT middleware + user ID from token (not from request body) |
| Read language preference   | Authenticated user                   | Returned in `GetAuth` response — user can only get their own profile |

### Input Validation Rules

| Input                             | Location           | Validation Rule                                                                                                      |
| --------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `language` in `UpdatePreferences` | Go service layer   | Strict allowlist: must be one of `["en", "vi"]`. Return `apperrors.NewValidationError("invalid language")` otherwise |
| Locale URL segment                | Next.js middleware | Check against `locales` array from next-intl config; redirect if not found                                           |
| `wj-locale` cookie value          | Next.js middleware | Check against `locales` array; ignore and fall back if invalid                                                       |

### External Dependency Risks

| Dependency                     | Trust Level                           | Failure Mode                       | Mitigation                                                                           |
| ------------------------------ | ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| `next-intl` npm package        | High (actively maintained, 5k+ stars) | API change, security vulnerability | Pin exact version, monitor CVEs                                                      |
| `@formatjs/intl-localematcher` | High (by Intl team)                   | Locale matching error              | Used only for Accept-Language parsing in middleware; safe fallback to default locale |
| `date-fns` (already installed) | High                                  | Breaking change in locale API      | Already installed at v4.1.0; only adding locale imports                              |

### Sensitive Data Handling

- The `language` preference (`"en"` or `"vi"`) is **non-sensitive** — it is a UI configuration value with no PII or financial data
- Translation message catalogs are static files with no user data
- The `wj-locale` cookie is non-sensitive and does not need `HttpOnly` or `Secure` flags beyond what Next.js sets by default (though `SameSite=Lax` should be set to prevent CSRF on the cookie)

---

## Edge Cases & Error Handling

| Scenario                                                             | Handling                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| User visits `/vi/dashboard/home` but is not authenticated            | Existing `AuthCheck` component redirects to `/vi/auth/login` (preserves locale)                                     |
| User logs in on `/en/auth/login` but has `language: "vi"` in profile | After login, read `language` from auth response → redirect to `/vi/dashboard/home`                                  |
| Backend returns unknown `language` value                             | Frontend falls back to `"vi"` as default                                                                            |
| Translation key is missing in `vi.json`                              | next-intl falls back to `en.json` value (configured via `onError: "ignore"` or fallback locale)                     |
| User switches language mid-session                                   | Cookie set → redirect to same page under new locale → all queries refetch (locale change in URL triggers re-render) |
| `messages/vi.json` is incomplete (key missing)                       | next-intl falls back to English for that key — no crash                                                             |
| `date-fns` `vi` locale import fails to load                          | Date utilities fall back to no locale (English) — non-blocking                                                      |
| Unsupported locale in URL (e.g., `/fr/`)                             | Middleware redirects to `/vi/`                                                                                      |

---

## Dependencies & Assumptions

- **next-intl** will be installed at latest stable version (currently `^3.x`)
- **`@formatjs/intl-localematcher`** and **`negotiator`** are peer dependencies of next-intl middleware (may need explicit install)
- The existing `routes` constants object in `app/constants.tsx` will be updated to use `useRouter()` from next-intl (locale-aware) instead of Next.js default
- The backend `UpdatePreferences` endpoint is already protected by JWT middleware — no new auth work needed for the backend endpoint
- A database migration is needed to add `preferred_language` column to the `user` table
- All frontend strings will be extracted manually (not using automated tooling like `i18next-parser` in this phase)
- The Vietnamese translations will be written by a Vietnamese-speaking team member or reviewed before shipping
- Existing `CurrencyContext` continues to work unchanged — it manages `preferredCurrency`, not locale

## Out of Scope

- RTL language support (Arabic, Hebrew, etc.)
- More than 2 languages in this phase (additional languages can be added by creating a new `messages/<locale>.json`)
- Automated translation via machine translation APIs
- Locale-in-subdomain routing (`vi.wealthjourney.app`) — URL path prefix only
- Per-component lazy loading of translation strings (next-intl loads per-locale catalog at route level)
- Pluralization rules beyond what ICU message format supports (next-intl supports ICU natively if needed)
- Translation management platform (Lokalise, Crowdin, etc.) integration
- Right-to-left layout changes
