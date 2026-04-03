# Terms of Service & Privacy Policy Pages Specification

## Summary

Add two static public pages — Terms of Service and Privacy Policy — to the WealthJourney application. These pages are accessible from the landing page footer, the auth pages (login/register), and the settings hub for authenticated users. The Terms of Service must include a Disclaimer of Liability section addressing investments and money. No backend, database, or protobuf changes are required — this is a purely frontend implementation using existing Next.js static page patterns.

## User Stories

- As a visitor, I want to read the Terms of Service before signing up, so that I understand my rights and responsibilities when using the platform.
- As a visitor, I want to read the Privacy Policy before signing up, so that I understand how my data is handled.
- As a user on the login/register page, I want to click the ToS/Privacy links in the footer, so that they actually navigate to the correct pages (currently broken/non-existent).
- As an authenticated user, I want to access legal pages from the settings hub, so that I can review the terms at any time.

## Functional Requirements

### FR-1: Terms of Service Page

A public static page at `/terms-of-service` (i18n route: `/[locale]/terms-of-service`).

**Content sections:**
1. Introduction — what the service is, who operates it
2. Acceptance of Terms — by using the service you agree
3. User Responsibilities — account security, accurate information
4. **Disclaimer of Liability (Investment & Financial)** — the app does not provide financial advice; investment decisions are the user's sole responsibility; the platform is not liable for financial losses incurred through use of the app
5. Intellectual Property — ownership of content
6. Termination — right to suspend/terminate accounts
7. Changes to Terms — notification of updates
8. Governing Law — applicable jurisdiction
9. Contact Information

**Acceptance criteria:**
- [ ] Page renders at `/[locale]/terms-of-service` (vi and en locales)
- [ ] Disclaimer of Liability section is present and clearly visible
- [ ] Page has proper SEO metadata (title, description, canonical)
- [ ] Page is accessible without authentication
- [ ] Links from landing footer, auth pages, and settings hub navigate here correctly

### FR-2: Privacy Policy Page

A public static page at `/privacy-policy` (i18n route: `/[locale]/privacy-policy`).

**Content sections:**
1. Introduction — who we are and scope of policy
2. Information We Collect — account data, financial data, usage data
3. How We Use Your Information — app functionality, analytics, communications
4. Data Storage & Security — Supabase/PostgreSQL, Redis, security measures
5. Data Sharing — we do not sell data; third-party service disclosures (Google OAuth, Supabase)
6. User Rights — access, correction, deletion (right to be forgotten)
7. Cookies & Local Storage — JWT token storage, session management
8. Changes to Policy — notification of updates
9. Contact Information

**Acceptance criteria:**
- [ ] Page renders at `/[locale]/privacy-policy` (vi and en locales)
- [ ] Third-party services (Google OAuth, Supabase) disclosed
- [ ] JWT/localStorage usage disclosed
- [ ] Page has proper SEO metadata
- [ ] Page is accessible without authentication
- [ ] Links from landing footer, auth pages, and settings hub navigate here correctly

### FR-3: Landing Footer Links

Update `LandingFooter.tsx` to include links to both pages.

**Acceptance criteria:**
- [ ] Footer shows "Terms of Service" and "Privacy Policy" links
- [ ] Links use existing i18n keys: `landing.footer.termsOfService` and `landing.footer.privacyPolicy`
- [ ] Links use v2 styling consistent with footer design
- [ ] Links are accessible on both mobile and desktop

### FR-4: Auth Page Links (Fix Broken Links)

The login and register pages already render ToS/Privacy footer links that point to non-existent routes. Update them to point to the new pages.

**Acceptance criteria:**
- [ ] Login page footer links navigate to `/terms-of-service` and `/privacy-policy`
- [ ] Register page footer links navigate to `/terms-of-service` and `/privacy-policy`

### FR-5: Settings Hub Link

Add links to both legal pages from the settings hub page.

**Acceptance criteria:**
- [ ] Settings hub (`/dashboard/settings`) shows a "Legal" section or two individual links
- [ ] Links navigate to the correct pages
- [ ] Consistent styling with other settings items

## Non-Functional Requirements

- **Performance**: Static pages — no data fetching, no API calls. Should load instantly.
- **SEO**: Each page has unique title, description meta, and canonical URL. Pages are indexable (`robots: index, follow`).
- **i18n**: Both pages support `vi` and `en` locales via next-intl. Content can start in English only (static strings) but must be i18n-ready (using translation keys or static content components).
- **Accessibility**: Semantic HTML (`<article>`, `<section>`, `<h1>`–`<h3>`), sufficient color contrast with v2 tokens.
- **Mobile-first**: Readable on small screens with appropriate padding and font sizes.

## Architecture Changes (C4)

### Diagrams to Update

- **`c4-component-frontend.md`** (L3 Frontend): Add `TermsPage` and `PrivacyPolicyPage` as new page components under the public pages section. No new feature module needed — these are standalone static pages.

### New Diagrams

None needed — these are simple static pages with no service or repository layer involvement.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None required — simple static page navigation, no multi-step business logic, no branching, no API calls.

## Data Model Changes

None — purely frontend static content.

## API Changes

None — no backend changes required.

## UI/UX Changes

### New Pages

**1. `/[locale]/terms-of-service/`**
- `page.tsx` — Server component entry point
- `layout.tsx` — `generateMetadata()` for SEO + optional JsonLd WebPage schema
- `TermsContent.tsx` — Static content component with semantic HTML

**2. `/[locale]/privacy-policy/`**
- `page.tsx` — Server component entry point
- `layout.tsx` — `generateMetadata()` for SEO + optional JsonLd WebPage schema
- `PrivacyContent.tsx` — Static content component with semantic HTML

### Updated Files

- `components/landing/LandingFooter.tsx` — add ToS + Privacy links
- `app/[locale]/auth/login/page.tsx` — fix broken link hrefs
- `app/[locale]/auth/register/page.tsx` — fix broken link hrefs
- `app/[locale]/dashboard/settings/page.tsx` — add Legal section/links

### Layout & Styling

- Wrap content in `max-w-4xl mx-auto px-4 sm:px-6 py-8` container
- Page background: `bg-v2-bg-primary`
- Card/content area: `bg-v2-bg-surface` with `rounded-lg p-6 shadow-card`
- Headings: `text-v2-gold-accent` for h1/h2, `text-v2-text-tertiary` for h3
- Body text: `text-v2-text-secondary`
- Section dividers: `border-v2-border-light`
- Links within content: `text-v2-gold-accent underline`
- Disclaimer section: visually prominent — `border-l-4 border-v2-red-negative bg-v2-red-light/10 p-4 rounded`

### Mobile-First

- Single column layout
- `text-sm` on mobile → `text-base` on `sm:`
- Navigation back to landing/home via navbar (reuse `LandingNavbar` or a simple back link)

### Existing Component Inventory

| Need | Existing Component | Location |
|------|--------------------|----------|
| Page container/card | BaseCard or direct div | `components/BaseCard.tsx` |
| Landing navbar (for legal pages) | `LandingNavbar` | `components/landing/LandingNavbar.tsx` |
| Landing footer | `LandingFooter` | `components/landing/LandingFooter.tsx` |
| Back/home link | `ActiveLink` or Next.js `Link` | `components/navigation/` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `TermsContent.tsx` | `app/[locale]/terms-of-service/TermsContent.tsx` | Co-located static content — not reusable enough for `components/` |
| `PrivacyContent.tsx` | `app/[locale]/privacy-policy/PrivacyContent.tsx` | Same — co-located with its page |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | User browser | HTTP GET `/terms-of-service` | Yes: Internet → App (Vercel CDN) | Next.js static page | Read-only, no user data sent |
| 2 | User browser | HTTP GET `/privacy-policy` | Yes: Internet → App (Vercel CDN) | Next.js static page | Read-only, no user data sent |
| 3 | Auth pages | User click on ToS/Privacy link | No | Browser navigation | Purely client-side link navigation |
| 4 | Settings hub | User click on legal links | No | Browser navigation | Purely client-side link navigation |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | GET requests for static pages | Vercel CDN serves static HTML; no auth required; no sensitive data returned |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|-----------|
| T-1 | 1, 2 | Internet → App | Tampering | Malicious content injection if pages were dynamic | Low | Pages are fully static — no user input, no server-side data processing |
| T-2 | 1, 2 | Internet → App | Info Disclosure | Sensitive internal info accidentally in content | Low | Content is manually authored static text — review before deploy |
| T-3 | 1, 2 | Internet → App | DoS | Page scraping / excessive requests | Very Low | Vercel CDN handles edge caching; no DB or API behind these pages |
| T-4 | 3, 4 | N/A | Tampering | Open redirect if link hrefs are user-controllable | None | Hrefs are hardcoded strings, not user input |

### Authorization Rules

- Pages are **public** — no authentication required
- No user-specific data rendered — same content for all visitors
- Settings hub links are visible to all authenticated users (no role restriction needed)

### Input Validation Rules

None — these are read-only static pages with no form inputs.

### External Dependency Risks

None — no external API calls from these pages.

### Sensitive Data Handling

The Privacy Policy page must accurately disclose:
- JWT stored in `localStorage` (key: `LOCAL_STORAGE_TOKEN_NAME`)
- Google OAuth via Google's OAuth 2.0 service
- Data stored in Supabase (PostgreSQL 16) and Redis 7
- No financial data is rendered on these pages themselves

### Issues & Risks Summary

1. **Broken links on auth pages** — Login/register currently link to non-existent ToS/Privacy routes. This is a pre-existing bug that this feature fixes.
2. **Content accuracy** — The Privacy Policy must remain up to date as the app evolves (new third-party integrations, data collection changes). This is an ongoing maintenance concern.
3. **i18n content** — Full Vietnamese translation of legal content requires human review; initial implementation can use English content in both locales with a note to translate.

## Edge Cases & Error Handling

- **Direct URL access**: Both pages must render correctly when navigated to directly (not just via links) — ensured by Next.js static page routing.
- **Unknown locale**: next-intl middleware handles unknown locales; no special handling needed on these pages.
- **No layout shared with dashboard**: These pages are public (pre-login), so they should use the landing layout (with `LandingNavbar`) rather than the dashboard layout.

## Dependencies & Assumptions

- next-intl routing is already configured for `[locale]` segment — new pages just need to be placed under `app/[locale]/`
- Translation keys `landing.footer.termsOfService` and `landing.footer.privacyPolicy` already exist in `messages/vi/nav.json` and `messages/en/nav.json`
- Auth pages already have the link UI rendered — only the `href` values need fixing
- Legal content (text) will be written as part of implementation; no CMS or external content source

## Out of Scope

- Backend API endpoints for legal content (content is static, not DB-driven)
- Admin CMS to edit legal content at runtime
- Cookie consent banner / GDPR compliance modal
- Version history or changelog for terms
- User "accept terms" checkbox flow (not required per spec)
- Full Vietnamese translation of legal text (initial implementation: English content in both locales)
