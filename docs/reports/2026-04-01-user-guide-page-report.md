# User Guide Page Implementation Report

## Summary

A public, i18n-enabled user guide page was implemented at `/[locale]/guide` with sticky TOC (desktop sidebar + mobile horizontal pills), scroll spy via IntersectionObserver, three content sections (Homepage, Investment Portfolio, Community) covering 15 sub-sections, SEO metadata with HowTo JSON-LD schema, and navigation links from the landing page navbar and dashboard sidebar.

## Spec Reference

`docs/specs/2026-04-01-user-guide-page-spec.md`

## Plan Reference

`docs/plans/2026-04-01-user-guide-page-plan.md`

## Tasks Completed

| #   | Task                                             | Status | Files Changed | Tests     | TDD |
| --- | ------------------------------------------------ | ------ | ------------- | --------- | --- |
| 0   | Update C4 Architecture Diagram                   | Done   | 1             | N/A (docs)| N/A |
| 1   | Add i18n Translation Files for Guide Content     | Done   | 6             | 88 pass   | Yes |
| 2   | Add /guide Route to Constants                    | Done   | 2             | 2 pass    | Yes |
| 3   | Create Guide Page Layout with SEO Metadata       | Done   | 2             | 15 pass   | Yes |
| 4   | Create GuideTOC Component                        | Done   | 2             | 16 pass   | Yes |
| 5   | Create GuideSection Component                    | Done   | 2             | 15 pass   | Yes |
| 6   | Create GuideContent Client Component + page.tsx  | Done   | 3             | 31 pass   | Yes |
| 7   | Add Guide Link to Landing Page Navbar            | Done   | 4             | 2 pass    | Yes |
| 8   | Add Guide Link to Dashboard Sidebar              | Done   | 2             | 2 pass    | Yes |
| 9   | Frontend Lint & Build Verification               | Done   | 0             | 673 pass  | N/A |
| 10  | Playwright E2E Test for Guide Page               | Done   | 5             | 19 E2E    | Yes |

## Test Coverage Summary

| Layer              | Test File                                               | Tests | Pass  | Coverage Area                                          |
| ------------------ | ------------------------------------------------------- | ----- | ----- | ------------------------------------------------------ |
| i18n translations  | `__tests__/guide-translations.test.ts`                  | 88    | 88/88 | File existence, key parity vi/en, all section keys     |
| Route constant     | `__tests__/constants-guide-route.test.ts`               | 2     | 2/2   | routes.guide value and type                            |
| Layout/SEO         | `app/[locale]/guide/__tests__/layout.test.tsx`          | 15    | 15/15 | generateMetadata, JSON-LD HowTo, OG, robots, children  |
| GuideTOC           | `app/[locale]/guide/__tests__/GuideTOC.test.tsx`        | 16    | 16/16 | Render, active state, scroll, a11y, responsive layout  |
| GuideSection       | `app/[locale]/guide/__tests__/GuideSection.test.tsx`    | 15    | 15/15 | id attr, heading levels, OrnateHeading/Divider, children |
| GuideContent       | `app/[locale]/guide/__tests__/GuideContent.test.tsx`    | 31    | 31/31 | All 15 sections, scroll spy, layout, CTAs, headings    |
| LandingNavbar      | `components/landing/__tests__/LandingNavbar-guide.test.tsx` | 2  | 2/2   | Guide link href and presence                           |
| DashboardLayout    | `app/[locale]/dashboard/__tests__/DashboardLayout-guide.test.tsx` | 2 | 2/2 | Guide link desktop + mobile                         |
| E2E                | `tests/e2e/guide-page.spec.ts`                          | 19    | 19/19 | Vi/En locales, TOC, sections, CTAs, navbar, mobile     |

**Total unit tests: 171 | Total including full suite: 673 | E2E: 19**

## Security Implementation Summary

| Concern             | Implementation                                         | Verified |
| ------------------- | ------------------------------------------------------ | -------- |
| Authentication      | None required — public page, no auth wrapper           | Yes      |
| Authorization       | N/A — no user data accessed                            | Yes      |
| Input validation    | N/A — no user input, all content is static translations| Yes      |
| XSS                 | No dangerouslySetInnerHTML; translations are developer-authored | Yes |
| Data exposure       | No API calls; JSON-LD uses static content only         | Yes      |
| External data       | IntersectionObserver watches DOM elements only         | Yes      |

## Review Results

### Spec Compliance

All 11 tasks passed spec compliance review. One issue was found and fixed during review:
- **Task 6**: `OrnateHeading` was imported but not used in the h1 — fixed to wrap the page title in `<OrnateHeading size="lg">`.

### Security Review

All stages APPROVED. No security concerns — this is a fully static public page with no user input, no API calls, and no auth requirements.

### Code Quality

All stages APPROVED. Key quality highlights:
- Dual-render CSS responsive approach (lg:hidden/hidden lg:flex) avoids SSR hydration mismatch
- IntersectionObserver correctly cleaned up on unmount (one observer per section, all disconnected)
- v2-* Tailwind tokens used throughout — no hardcoded colors
- `"use client"` applied only to components that need it (GuideContent, GuideTOC)
- `t.raw()` used for translation arrays (steps, benefits) per next-intl semantics

### Issues Found and Fixed

1. **Task 6 review**: `OrnateHeading` imported but not rendered in h1 — fixed immediately
2. **Task 10 discovery**: `guide.json` files missing `"guide"` namespace wrapper — files were missing the required namespace key for `useTranslations("guide")`. Fixed by wrapping content, then updated `guide-translations.test.ts` to access content via the namespace key.

## Files Changed

### New Files Created

| File | Description |
|------|-------------|
| `docs/architecture/c4-component-frontend.md` | Updated (GuidePage added) |
| `src/wj-client/messages/vi/guide.json` | Vietnamese guide translations |
| `src/wj-client/messages/en/guide.json` | English guide translations |
| `src/wj-client/app/[locale]/guide/layout.tsx` | SEO metadata, JSON-LD HowTo schema |
| `src/wj-client/app/[locale]/guide/GuideTOC.tsx` | TOC component — scroll spy, responsive |
| `src/wj-client/app/[locale]/guide/GuideSection.tsx` | Section wrapper — h2/h3 variants |
| `src/wj-client/app/[locale]/guide/GuideContent.tsx` | Main page client component |
| `src/wj-client/app/[locale]/guide/page.tsx` | Route entry point (server component) |
| `src/wj-client/tests/e2e/guide-page.spec.ts` | 19 Playwright E2E tests |
| `src/wj-client/__tests__/guide-translations.test.ts` | 88 translation tests |
| `src/wj-client/__tests__/constants-guide-route.test.ts` | 2 route constant tests |
| `src/wj-client/app/[locale]/guide/__tests__/layout.test.tsx` | 15 layout tests |
| `src/wj-client/app/[locale]/guide/__tests__/GuideTOC.test.tsx` | 16 TOC tests |
| `src/wj-client/app/[locale]/guide/__tests__/GuideSection.test.tsx` | 15 section tests |
| `src/wj-client/app/[locale]/guide/__tests__/GuideContent.test.tsx` | 31 content tests |
| `src/wj-client/components/landing/__tests__/LandingNavbar-guide.test.tsx` | 2 navbar tests |
| `src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-guide.test.tsx` | 2 sidebar tests |

### Modified Files

| File | Change |
|------|--------|
| `src/wj-client/app/constants.tsx` | Added `guide: "/guide"` to routes |
| `src/wj-client/i18n/request.ts` | Added `'guide'` to messageGroups |
| `src/wj-client/messages/vi/nav.json` | Added `landing.navbar.guide` + `nav.guide` labels |
| `src/wj-client/messages/en/nav.json` | Added `landing.navbar.guide` + `nav.guide` labels |
| `src/wj-client/components/landing/LandingNavbar.tsx` | Added Guide link (desktop + mobile) |
| `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx` | Added Guide link (BookOpen icon) |

## How to Test

### Unit & Integration Tests

```bash
# All guide-related unit tests
cd src/wj-client && npx jest --testPathPattern="guide" --no-coverage

# Full test suite (verify no regressions)
cd src/wj-client && npx jest --no-coverage
```

Expected: 171 guide tests pass, 673 total pass.

### Dependency Impact Verification (GitNexus)

GitNexus not available — manual blast radius review performed:

| Changed File | Dependents | Tested? | Notes |
|---|---|---|---|
| `constants.tsx` | Any component using `routes.*` | Yes | Only added new key, no existing refs changed |
| `LandingNavbar.tsx` | Landing page, auth pages | Yes | Additive change, existing tests still pass |
| `DashboardLayout.tsx` | All dashboard pages | Yes | Additive change, animationDelay adjusted by +30ms |
| `nav.json` | Any component using nav translations | Yes | Additive keys only |
| `i18n/request.ts` | All pages using message groups | Yes | Additive change |

### Manual Testing Steps

#### Scenario: Happy path — Vietnamese guide page
**Preconditions:** Not logged in
1. Navigate to `/vi/guide` → Expected: Page loads with title "HƯỚNG DẪN SỬ DỤNG" (OrnateHeading decorative style)
2. See landing navbar with Guide link highlighted → Expected: Guide link is visible
3. See horizontal TOC pills on mobile (375px) → Expected: TOC renders as scrollable pills
4. Click TOC "Portfolio" button → Expected: Page scrolls to investment section
5. Scroll down to bottom → Expected: "Get Started Free" CTA button links to `/auth/register`

#### Scenario: English guide page
**Preconditions:** Not logged in
1. Navigate to `/en/guide` → Expected: Page loads with English title "USER GUIDE"
2. Verify content is in English → Expected: "Homepage Features", "Investment Portfolio", "Community"

#### Scenario: Dashboard sidebar link
**Preconditions:** Logged in as any user
1. Navigate to dashboard → Expected: BookOpen icon "Guide" link in sidebar footer (between Settings and Admin)
2. Click Guide link → Expected: Navigates to `/guide` (exits dashboard, loads guide page)

#### Scenario: Mobile viewport (375px)
**Preconditions:** Browser/devtools set to 375px wide
1. Navigate to `/vi/guide` → Expected: No horizontal overflow
2. See TOC → Expected: Horizontal scrollable pill bar pinned below navbar (not vertical sidebar)
3. Tap any TOC pill → Expected: Page scrolls to section smoothly

#### Scenario: Empty state / cold start
N/A — static content page, no API calls that could be empty.

#### Scenario: Authorization boundary
N/A — public page, no auth required. Any user (including unauthenticated) can access `/guide`.

## Fix History

| Date       | Fix                                                                                        | Severity | Tests  |
| ---------- | ------------------------------------------------------------------------------------------ | -------- | ------ |
| 2026-04-01 | Removed wallet type selection step from `createWallet.steps` in vi/en guide.json — investment wallet type is hidden in the UI | Minor | 4 new |
