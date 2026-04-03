# Terms & Privacy Pages — Implementation Report

## Metadata

- **Feature:** terms-and-privacy
- **Branch:** `feat/terms-and-privacy`
- **Plan file:** `docs/plans/2026-04-03-terms-and-privacy-plan.md`
- **Spec file:** `docs/specs/2026-04-03-terms-and-privacy-spec.md`
- **Completed:** 2026-04-03
- **Status:** done

## Commits

| Commit | Tasks | Summary |
|--------|-------|---------|
| `a84cf8b7` | 0+1 | Register legal i18n namespace; create en/legal.json and vi/legal.json with 9 terms + 9 privacy sections |
| `9b733f17` | 2 | Create shared legal layout with SEO metadata (canonical, hreflang, robots) |
| `67ec5fd2` | 3+4 | Create Terms of Service and Privacy Policy pages with content components, unit tests, E2E spec |
| `29e22a41` | 5+6+7 | Fix auth page broken links; add legal links to LandingFooter; add Legal section to Settings Hub |
| `32e18034` | 8 | Update C4 frontend diagram with TermsPage and PrivacyPolicyPage nodes |

## What Was Built

### New Pages

| Route | File | Description |
|-------|------|-------------|
| `/legal/terms` | `app/[locale]/legal/terms/` | Terms of Service — 9 sections, disclaimer highlighted |
| `/legal/privacy` | `app/[locale]/legal/privacy/` | Privacy Policy — 9 sections, uniform styling |

Both pages are:
- Fully public — no auth required, `robots: index, follow`
- Server component layouts with SEO metadata (canonical + hreflang vi/en, openGraph)
- Client component content using `useTranslations("legal")`
- Wrapped in `LandingNavbar` + `LandingFooter`
- Styled with v2 Tailwind tokens throughout

### Modified Entry Points

| File | Change |
|------|--------|
| `app/[locale]/auth/login/page.tsx` | `#terms` → `/legal/terms`, `#privacy` → `/legal/privacy` |
| `app/[locale]/auth/register/page.tsx` | Same href fixes |
| `components/landing/LandingFooter.tsx` | Added ToS + Privacy links |
| `app/[locale]/dashboard/settings/page.tsx` | Added Legal section with two links and inline SVG icons |

### i18n

- New namespace: `legal` (registered in `i18n/request.ts`)
- 18 new message keys (9 terms sections × 2 fields + 9 privacy sections × 2 fields)
- New settings keys: `settings.legal.title`, `settings.legal.terms`, `settings.legal.privacy`
- Landing footer keys were already present in `messages/en/nav.json` and `messages/vi/nav.json`

### Tests

- Unit tests for `TermsContent` and `PrivacyContent` (4 tests each)
- Unit test for shared legal layout
- E2E spec `legal-pages-flow.spec.ts` covering:
  - Terms page structure (9 sections, disclaimer)
  - Privacy page structure
  - Auth page legal links (login + register)
  - Landing footer links (desktop + 375px mobile viewport)
  - Settings Hub legal section links

## Design Decisions

1. **Client component for content, server component for layout** — `page.tsx` and `layout.tsx` are server components (SEO metadata); `TermsContent.tsx` and `PrivacyContent.tsx` are client components because `useTranslations` requires a client boundary.

2. **Inline SVG icons in settings** — The settings page uses inline SVG paths throughout; `lucide-react` imports were not used to match the existing pattern.

3. **Shared legal layout** — A parent `app/[locale]/legal/layout.tsx` provides shared SEO base; each sub-route has its own layout for page-specific metadata.

4. **Disclaimer styling** — The Terms disclaimer section uses `border-l-4 border-v2-red-negative bg-v2-red-light/10` to draw attention to the "not financial advice" clause.

## Non-Issues Noted During Review

- `OrnateHeading` uses `size` prop (not `level`) — plan spec suggested `level`; implementer corrected after reading the actual component
- `LandingNavbar`/`LandingFooter` are default exports — test mocks adjusted accordingly
- Settings page imports `Link` from `@/lib/navigation` (not `next/link`) — implementer report inaccuracy, code was correct
