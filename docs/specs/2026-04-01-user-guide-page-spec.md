# User Guide Page Specification

## Summary

Create a public (no auth) user guide page at `/[locale]/guide` that teaches new users how to use congdongvang.com. The page is a single scrollable page with a sticky table-of-contents sidebar, covering three main sections: Homepage, Investment Portfolio, and Community. Content uses text instructions with decorative icons/illustrations per section. Supports both Vietnamese and English via next-intl from the start.

## User Stories

- As a **new visitor**, I want to read a guide on how to use the website, so that I can understand its features before signing up.
- As an **existing user**, I want to reference the guide when using an unfamiliar feature, so that I can learn without trial and error.
- As a **Vietnamese user**, I want to read the guide in Vietnamese, so that I understand the instructions clearly.

## Functional Requirements

### FR-1: Public Guide Page at `/[locale]/guide`

The guide page must be accessible without authentication, at the route `/vi/guide` (Vietnamese) and `/en/guide` (English).

**Acceptance criteria:**
- [ ] Page is accessible without login (no `AuthCheck` wrapper)
- [ ] Page renders under `app/[locale]/guide/` route
- [ ] URL follows next-intl locale pattern (`/vi/guide`, `/en/guide`)
- [ ] Page has its own layout with SEO metadata (title, description, OG tags)
- [ ] Robots meta allows indexing (`index: true, follow: true`)

### FR-2: Sticky Table of Contents (TOC)

A sidebar (desktop) or collapsible top nav (mobile) showing section anchors for quick navigation.

**Acceptance criteria:**
- [ ] Desktop: sticky left sidebar with section links, highlights active section on scroll
- [ ] Mobile: collapsible TOC at top of page, or horizontal scrollable pill nav
- [ ] Clicking a TOC item smooth-scrolls to the section
- [ ] Active section is visually indicated (gold highlight)
- [ ] TOC includes all three main sections plus sub-sections

### FR-3: Homepage Guide Section

Explains the dashboard home page features: net worth display, wallets, gold/silver/currency price tables, PNL card.

**Acceptance criteria:**
- [ ] Covers: net worth overview, wallet management (create, transfer), price tables, PNL tracking
- [ ] Step-by-step instructions for key actions (create wallet, add transaction, transfer money)
- [ ] Decorative icons per sub-section (wallet icon, chart icon, etc.)
- [ ] Content translated in both `vi` and `en`

### FR-4: Investment Portfolio Guide Section

Explains portfolio management: adding investments, asset types (stocks, gold, silver, crypto), FIFO accounting, price alerts.

**Acceptance criteria:**
- [ ] Covers: adding investments (symbol search, custom investments), transaction types (buy/sell/dividend), portfolio summary, price staleness indicator
- [ ] Explains FIFO cost basis concept in simple terms
- [ ] Covers gold/silver specific features (unit conversions, VND vs USD gold)
- [ ] Covers price alerts setup
- [ ] Decorative icons per sub-section
- [ ] Content translated in both `vi` and `en`

### FR-5: Community Guide Section

Explains community features: creating posts, following users, hashtags, saved posts, sentiment voting.

**Acceptance criteria:**
- [ ] Covers: creating posts, commenting, liking, following users, hashtag filtering
- [ ] Covers saved posts and notification panel
- [ ] Covers gold/silver sentiment voting
- [ ] Decorative icons per sub-section
- [ ] Content translated in both `vi` and `en`

### FR-6: Navigation to Guide

Users should be able to find the guide from the landing page and from within the dashboard.

**Acceptance criteria:**
- [ ] Landing page navbar includes a "Guide" link
- [ ] Dashboard sidebar includes a "Guide" link (opens in same tab, navigates away from dashboard)
- [ ] Guide page has a "Back to Home" / "Go to Dashboard" CTA at the bottom

## Non-Functional Requirements

- **Performance**: Page is static content — should achieve Lighthouse performance > 95. Use server components where possible. No API calls needed.
- **SEO**: Full metadata, JSON-LD (HowTo schema), canonical URLs, sitemap inclusion.
- **Accessibility**: Proper heading hierarchy (h1 > h2 > h3), landmark regions, skip-to-content link, focus management for TOC navigation.
- **Mobile-first**: Content readable on 320px screens. TOC collapses on mobile.

## Architecture Changes (C4)

### Diagrams to Update

- **L3 Frontend Components** (`c4-component-frontend.md`): Add `GuidePage` under the public pages section (peer of `LandingPage`).

### New Diagrams

None needed — this is a simple static content page with no new services or data flows.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no API calls, no backend logic, pure static content rendering.

### New Flow Diagrams

None needed.

## Data Model Changes

None — no database tables, no new models.

## API Changes

None — this is a frontend-only, static content page. No backend endpoints needed.

## UI/UX Changes

### Page Layout

```
┌─────────────────────────────────────────────┐
│  Navbar (LandingNavbar reuse)               │
├──────────┬──────────────────────────────────┤
│  TOC     │  Content                         │
│  (sticky)│                                  │
│          │  # User Guide (h1)               │
│  ● Home  │                                  │
│  ● Invest│  ## Homepage (h2)                │
│  ● Commun│    ### Net Worth (h3)            │
│          │    [icon] description...          │
│          │    ### Wallets (h3)               │
│          │    [icon] step-by-step...         │
│          │                                  │
│          │  ## Investment Portfolio (h2)     │
│          │    ### Adding Investments (h3)    │
│          │    ...                            │
│          │                                  │
│          │  ## Community (h2)               │
│          │    ### Creating Posts (h3)        │
│          │    ...                            │
│          │                                  │
│          │  [CTA: Go to Dashboard]          │
├──────────┴──────────────────────────────────┤
│  Footer (LandingFooter reuse)               │
└─────────────────────────────────────────────┘
```

**Mobile layout**: TOC becomes a horizontal scrollable pill bar pinned below navbar. Content is full-width.

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Page navbar | `LandingNavbar` | `components/landing/LandingNavbar` |
| Page footer | `LandingFooter` | `components/landing/LandingFooter` |
| Section dividers | `OrnateDivider` | `components/decorative/OrnateDivider` |
| Section headings | `OrnateHeading` | `components/decorative/OrnateHeading` |
| Icons | Lucide React icons | `lucide-react` |
| Cards for tips/callouts | `BaseCard` | `components/BaseCard` |
| Error boundary | `LandingErrorBoundary` | `components/landing/LandingErrorBoundary` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `GuideContent` | `app/[locale]/guide/GuideContent.tsx` | Page-specific content component (client, handles scroll spy) |
| `GuideTOC` | `app/[locale]/guide/GuideTOC.tsx` | Table of contents with scroll-spy active state |
| `GuideSection` | `app/[locale]/guide/GuideSection.tsx` | Reusable section wrapper with icon + anchor |

No new shared components needed — all new components are page-specific, co-located with the route.

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|------------------------|-------------|-------|
| 1 | User (browser) | HTTP GET `/guide` | Yes: Internet → App | Next.js server | Static page render, no user input |

This is a **static content page with no user input, no API calls, no authentication, and no data persistence**. The security surface is minimal.

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|-----------------|
| Internet → App | Page request | Standard Next.js serving, CSP headers |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 1 | Internet → App | DoS | High traffic to static page | Low | CDN caching (Vercel edge), static generation |
| T-2 | 1 | Internet → App | Info Disclosure | Error pages leaking stack traces | Low | Next.js production mode hides internals |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated | Notes |
|-----------|-------|------------|-----------------|-------|
| Read guide | N/A | N/A | Allowed | Public page, no auth required |

### Input Validation Rules

None — the page accepts no user input. All content is static translations.

### External Dependency Risks

No new external dependencies. Uses existing `lucide-react` for icons.

### Sensitive Data Handling

No sensitive data involved. Page content is public documentation.

### Issues & Risks Summary

1. **Low risk**: Page content may become outdated as features change — mitigate with periodic review.
2. **Low risk**: Translation keys must be maintained in sync between `vi.json` and `en.json`.
3. **No security risks**: Static content page with no user input, no API calls, no data access.

## Edge Cases & Error Handling

- **Missing translations**: If a translation key is missing, next-intl falls back to the default locale (Vietnamese). Ensure all keys exist in both locale files.
- **Deep linking**: Users may share links with `#section-id` anchors — ensure anchor IDs are stable and don't change between deploys.
- **Scroll spy accuracy**: Intersection Observer thresholds need tuning so the TOC highlights the correct section, especially for short sections.

## Dependencies & Assumptions

- `LandingNavbar` and `LandingFooter` are reusable outside the landing page (they don't assume landing-specific context).
- next-intl translation infrastructure is already set up with `messages/vi.json` and `messages/en.json`.
- Lucide React is already installed as a dependency.
- The guide content is static — no CMS or admin editing capability.

## Out of Scope

- **Video tutorials** — text + icons only for v1.
- **Interactive demos** — no live widget previews or sandbox mode.
- **Search within guide** — can be added later if the guide grows.
- **CMS/admin editing** — content is hardcoded in translation files.
- **Sections beyond Homepage, Investment, Community** — other features (wallets detail, budget, import, settings) can be added later.
- **Real screenshots** — using decorative icons/illustrations instead, to avoid maintenance burden when UI changes.
