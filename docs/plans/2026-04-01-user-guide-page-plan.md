# User Guide Page Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Create a public, i18n-enabled user guide page at `/[locale]/guide` with sticky TOC, three content sections (Homepage, Investment Portfolio, Community), and navigation links from landing page and dashboard sidebar.

**Spec:** `docs/specs/2026-04-01-user-guide-page-spec.md`

**Architecture:** Frontend-only feature. A new Next.js route under `app/[locale]/guide/` with its own layout for SEO metadata and JSON-LD. Reuses existing `LandingNavbar` and `LandingFooter` for public page chrome. All content is static translations — no API calls, no backend changes.

**Tech Stack:** Next.js 16.2 (App Router), next-intl, Tailwind CSS (v2 tokens), Lucide React icons, Intersection Observer API for scroll spy.

## Security Implementation Notes

- **Authentication**: None required — public page, no auth wrapper
- **Authorization**: N/A — no user data accessed
- **Input validation**: N/A — no user input, all content is static translations
- **Data sanitization**: N/A — no dynamic content from external sources; translations are developer-authored

## Component Reuse Inventory (Frontend Tasks)

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `LandingNavbar` | `components/landing/LandingNavbar.tsx` | Top navigation bar (already auth-aware) |
| `LandingFooter` | `components/landing/LandingFooter.tsx` | Page footer |
| `LandingErrorBoundary` | `components/landing/LandingErrorBoundary.tsx` | Error boundary wrapper |
| `OrnateHeading` | `components/decorative/OrnateHeading.tsx` | Section headings with gold diamond motif |
| `OrnateDivider` | `components/decorative/OrnateDivider.tsx` | Section dividers |
| `BaseCard` | `components/BaseCard.tsx` | Tip/callout cards within content |
| `JsonLd` | `components/seo/JsonLd.tsx` | JSON-LD structured data in layout |
| Lucide icons | `lucide-react` | Section icons (Wallet, TrendingUp, Users, etc.) |

**New components needed (with justification):**

| Component | Location | Justification |
|-----------|----------|---------------|
| `GuideContent` | `app/[locale]/guide/GuideContent.tsx` | Page-specific client component — handles scroll spy for TOC active state via Intersection Observer. No shared component provides scroll-spy behavior. |
| `GuideTOC` | `app/[locale]/guide/GuideTOC.tsx` | Table of contents with scroll-spy active state. Desktop: sticky sidebar. Mobile: horizontal scrollable pill bar. No existing TOC component exists. |
| `GuideSection` | `app/[locale]/guide/GuideSection.tsx` | Thin wrapper: icon + anchor ID + heading + content. Keeps JSX DRY across 15+ sub-sections. Could be inline but would create excessive repetition. |

## C4 Architecture Diagram Updates

- Update `docs/architecture/c4-component-frontend.md`: Add `GuidePage` under public pages section (peer of `LandingPage`).
- No new L4 code diagram needed — simple static content page.
- No runtime flow diagrams needed — no API calls, no backend logic.

---

### Task 0: Update C4 Architecture Diagram

**Files:**

- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read the current frontend component diagram
2. Add `GuidePage` component in the public pages section alongside `LandingPage`
3. Show it depends on `LandingNavbar`, `LandingFooter`, `OrnateHeading`, `OrnateDivider`
4. Commit diagram changes

**Security notes:** None — documentation only.

---

### Task 1: Add i18n Translation Files for Guide Content

**Files:**

- Create: `src/wj-client/messages/vi/guide.json`
- Create: `src/wj-client/messages/en/guide.json`
- Modify: `src/wj-client/i18n/request.ts` (add `'guide'` to `messageGroups` array)
- Modify: `src/wj-client/messages/vi/nav.json` (add `guide` nav label)
- Modify: `src/wj-client/messages/en/nav.json` (add `guide` nav label)

**Security notes:** Translation files are static JSON authored by developers — no XSS risk. Ensure no user-generated content is interpolated.

**Step 1: Write the failing test**

Create a test that imports the guide translation files and verifies:
- Both `vi` and `en` files exist and are valid JSON
- Both files have the same set of top-level keys
- Key sections exist: `title`, `homepage`, `investment`, `community`, `toc`

```
Test file: src/wj-client/__tests__/guide-translations.test.ts
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="guide-translations" --no-coverage
```

**Step 3: Write the translation files**

Create `messages/vi/guide.json` and `messages/en/guide.json` with full content covering:

- `title` — Page title
- `subtitle` — Page subtitle
- `toc` — TOC labels for all sections
- `homepage` — Net worth, wallets (create, transfer), price tables, PNL tracking
- `investment` — Adding investments, symbol search, custom investments, FIFO explanation, buy/sell/dividend, portfolio summary, gold/silver features, price alerts
- `community` — Creating posts, commenting, liking, following, hashtags, saved posts, sentiment voting

Add `'guide'` to the `messageGroups` array in `i18n/request.ts`.

Add `"guide": "Hướng dẫn"` to `messages/vi/nav.json` under `"nav"` key, and `"guide": "Guide"` to `messages/en/nav.json`.

**Step 4: Run test to verify it passes**

```bash
cd src/wj-client && npx jest --testPathPattern="guide-translations" --no-coverage
```

**Step 5: Commit**

---

### Task 2: Add `/guide` Route to Constants

**Files:**

- Modify: `src/wj-client/app/constants.tsx` (add `guide` to `routes` object)

**Security notes:** None — static route string.

**Step 1: Write the failing test**

Test that `routes.guide` is defined and equals `"/guide"`.

```
Test file: src/wj-client/__tests__/constants-guide-route.test.ts
```

**Step 2: Run test to verify it fails**

```bash
cd src/wj-client && npx jest --testPathPattern="constants-guide-route" --no-coverage
```

**Step 3: Add route constant**

In `app/constants.tsx`, add to the `routes` object:
```typescript
guide: "/guide",
```

Note: This is `/guide` (no `/dashboard` prefix) since it's a public page. The locale prefix is added by next-intl automatically.

**Step 4: Run test to verify it passes**

**Step 5: Commit**

---

### Task 3: Create Guide Page Layout with SEO Metadata

**Files:**

- Create: `src/wj-client/app/[locale]/guide/layout.tsx`

**Security notes:** No user input in metadata. All strings are hardcoded or from translations. JSON-LD uses static content only.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `JsonLd` from `@/components/seo/JsonLd`
- Pattern: Follow `app/[locale]/landing/layout.tsx` structure

**Step 1: Write the failing test**

Test the layout renders children and includes expected metadata structure.

```
Test file: src/wj-client/app/[locale]/guide/__tests__/layout.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Write the layout**

The layout should:
- Export `generateMetadata()` with guide-specific SEO:
  - Title: "Hướng dẫn sử dụng | congdongvang.com" (vi) / "User Guide | congdongvang.com" (en)
  - Description: Guide-specific description
  - OG tags with guide-specific content
  - `robots: { index: true, follow: true }`
  - Canonical URLs: `/vi/guide`, `/en/guide`
  - Alternate language links
- Include JSON-LD with `HowTo` schema type (per spec NFR)
- Render children

**Step 4: Run test to verify it passes**

**Step 5: Commit**

---

### Task 4: Create GuideTOC Component

**Files:**

- Create: `src/wj-client/app/[locale]/guide/GuideTOC.tsx`

**Security notes:** No user input. Anchor IDs are hardcoded strings (no dynamic content in href).

**Step 0: Component inventory check (MANDATORY)**

- No existing TOC component in `components/`
- Reusing: Tailwind v2 tokens for active state styling
- Creating new: `GuideTOC` — justified because no scroll-spy TOC exists in the codebase

**Step 1: Write the failing test**

Test:
- Renders all section links
- Active section has gold highlight class
- Clicking a link calls smooth scroll
- Desktop: renders as vertical sidebar
- Mobile: renders as horizontal scrollable pill bar

```
Test file: src/wj-client/app/[locale]/guide/__tests__/GuideTOC.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Write the GuideTOC component**

Props:
```typescript
interface GuideTOCProps {
  sections: { id: string; label: string }[];
  activeSection: string;
}
```

Behavior:
- Desktop (`lg:` and up): Vertical list, sticky positioning (`sticky top-20`)
- Mobile: Horizontal scrollable pill bar, pinned below navbar
- Active section: `bg-v2-gold-primary text-v2-bg-dark` pill/highlight
- Inactive: `text-v2-text-tertiary hover:text-v2-gold-accent`
- Clicking a section: `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })`
- Min touch target: `min-h-[44px]`
- Focus ring: `focus-visible:ring-2 focus-visible:ring-v2-gold-primary`

**Step 4: Run test to verify it passes**

**Step 5: Responsive check**

- Mobile (375px): Horizontal pills scroll, no overflow
- Desktop (1024px+): Vertical sticky sidebar

**Step 6: Commit**

---

### Task 5: Create GuideSection Component

**Files:**

- Create: `src/wj-client/app/[locale]/guide/GuideSection.tsx`

**Security notes:** None — renders static translated content.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `OrnateHeading` for section titles, Lucide icons for section icons
- Creating new: `GuideSection` — thin wrapper for consistent section structure

**Step 1: Write the failing test**

Test:
- Renders heading with correct text
- Renders icon
- Sets correct `id` attribute for anchor linking
- Renders children content

```
Test file: src/wj-client/app/[locale]/guide/__tests__/GuideSection.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Write the GuideSection component**

```typescript
interface GuideSectionProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  level?: "h2" | "h3";
  children: React.ReactNode;
}
```

- `h2` sections get `OrnateHeading` treatment + `OrnateDivider` above
- `h3` sub-sections get smaller heading + icon inline
- `id` attribute for anchor linking
- `scroll-mt-20` for proper scroll offset (accounting for fixed navbar + mobile TOC)

**Step 4: Run test to verify it passes**

**Step 5: Commit**

---

### Task 6: Create GuideContent Client Component (Main Page Content + Scroll Spy)

**Files:**

- Create: `src/wj-client/app/[locale]/guide/GuideContent.tsx`
- Create: `src/wj-client/app/[locale]/guide/page.tsx`

**Security notes:** Intersection Observer watches DOM elements only — no external data. All content from translations.

**Step 0: Component inventory check (MANDATORY)**

- Reusing: `LandingNavbar`, `LandingFooter`, `LandingErrorBoundary`, `BaseCard` (for tips), `OrnateHeading`, `OrnateDivider`
- Using: `GuideTOC`, `GuideSection` (created in Tasks 4-5)

**Step 1: Write the failing test**

Test:
- Page renders with h1 title
- All three main sections render (Homepage, Investment, Community)
- TOC is present
- CTA buttons render at bottom ("Go to Dashboard" / "Get Started")
- Proper heading hierarchy (h1 > h2 > h3)

```
Test file: src/wj-client/app/[locale]/guide/__tests__/GuideContent.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Write GuideContent component**

`"use client"` component that:

1. Uses `useTranslations("guide")` for all content
2. Defines section list for TOC:
   ```
   - homepage (h2)
     - net-worth (h3)
     - wallets (h3)
     - price-tables (h3)
     - pnl-tracking (h3)
   - investment (h2)
     - adding-investments (h3)
     - transaction-types (h3)
     - fifo-accounting (h3)
     - gold-silver (h3)
     - price-alerts (h3)
   - community (h2)
     - creating-posts (h3)
     - interactions (h3)
     - sentiment-voting (h3)
   ```
3. Implements scroll spy with `IntersectionObserver`:
   - Observes all section elements by ID
   - Updates `activeSection` state on intersection
   - `threshold: 0.3`, `rootMargin: "-80px 0px -60% 0px"` (tune for navbar offset)
4. Layout:
   - Desktop: `flex` with `w-64` sidebar (TOC) + `flex-1` content
   - Mobile: TOC as horizontal bar + full-width content
5. Structure:
   ```
   <LandingErrorBoundary>
     <LandingNavbar />
     <main id="main-content" className="bg-v2-bg-primary min-h-screen pt-16">
       <div className="max-w-6xl mx-auto px-4 py-8">
         <h1> OrnateHeading: "User Guide" </h1>
         <p> subtitle </p>
         <div className="flex gap-8">
           <aside className="hidden lg:block w-64 shrink-0">
             <GuideTOC ... />
           </aside>
           <div className="lg:hidden sticky top-14 z-40 bg-v2-bg-primary">
             <GuideTOC ... /> (mobile variant)
           </div>
           <article className="flex-1 min-w-0">
             <GuideSection id="homepage" ...>
               <GuideSection id="net-worth" level="h3" ...> ... </GuideSection>
               <GuideSection id="wallets" level="h3" ...> ... </GuideSection>
               ...
             </GuideSection>
             ...
             <div> CTA buttons </div>
           </article>
         </div>
       </div>
     </main>
     <LandingFooter />
   </LandingErrorBoundary>
   ```
6. CTA at bottom: Two buttons — "Go to Dashboard" (if authenticated) / "Get Started Free" (if not)

**Step 4: Write `page.tsx`**

Simple server component that renders `<GuideContent />`. Minimal — just the page entry point.

**Step 5: Run tests to verify they pass**

```bash
cd src/wj-client && npx jest --testPathPattern="guide" --no-coverage
```

**Step 6: Responsive & accessibility check**

- Mobile (375px): TOC horizontal pills, content full-width, no horizontal scroll
- Desktop (1024px+): Sticky sidebar TOC, content with `max-w-6xl`
- Heading hierarchy: h1 > h2 > h3 (verified in test)
- Skip-to-content: LandingNavbar already has this
- Focus management: TOC links have focus ring
- Landmark regions: `<main>`, `<nav>` (TOC), `<aside>`, `<article>`

**Step 7: Commit**

---

### Task 7: Add Guide Link to Landing Page Navbar

**Files:**

- Modify: `src/wj-client/components/landing/LandingNavbar.tsx`
- Modify: `src/wj-client/messages/vi/nav.json` (already done in Task 1 — verify)
- Modify: `src/wj-client/messages/en/nav.json` (already done in Task 1 — verify)

**Security notes:** None — static link addition.

**Step 1: Write the failing test**

Test that LandingNavbar renders a "Guide" link pointing to `/guide`.

```
Test file: src/wj-client/components/landing/__tests__/LandingNavbar-guide.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Add Guide link to navbar**

In `LandingNavbar.tsx`:
- Add a "Guide" link in the desktop navigation (before the auth buttons):
  ```tsx
  <Link
    href="/guide"
    className="text-v2-gold-accent hover:text-v2-gold-primary transition-colors duration-200 font-medium focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 rounded-md px-2 py-1 min-h-[44px] flex items-center"
  >
    {t("navbar.guide")}
  </Link>
  ```
- Add the same link in the mobile menu (with animation and onClick close)
- Translation key: `landing.navbar.guide` — add to both `nav.json` files under the `landing.navbar` section

**Step 4: Run test to verify it passes**

**Step 5: Commit**

---

### Task 8: Add Guide Link to Dashboard Sidebar

**Files:**

- Modify: `src/wj-client/app/[locale]/dashboard/DashboardLayout.tsx`

**Security notes:** None — static link. The guide link navigates away from the authenticated dashboard to a public page — this is intentional per spec.

**Step 1: Write the failing test**

Test that DashboardLayout renders a "Guide" link.

```
Test file: src/wj-client/app/[locale]/dashboard/__tests__/DashboardLayout-guide.test.tsx
```

**Step 2: Run test to verify it fails**

**Step 3: Add Guide link to sidebar**

In `DashboardLayout.tsx`:
- Add a "Guide" link in the sidebar footer section (near Settings/Logout), using `BookOpen` icon from lucide-react
- The link should point to `/guide` (public route, navigates away from dashboard)
- Add to both desktop sidebar and mobile slide-out `navigationItems`
- Use existing `ActiveLink` pattern if applicable, or plain `Link` since it navigates outside dashboard

**Step 4: Run test to verify it passes**

**Step 5: Commit**

---

### Task 9: Frontend Lint & Build Verification

**Files:**

- No new files — verification only

**Security notes:** Lint catches potential issues.

**Step 1: Run ESLint**

```bash
cd src/wj-client && npm run lint
```

Fix any lint errors introduced by the new files.

**Step 2: Run full test suite**

```bash
cd src/wj-client && npx jest --no-coverage
```

Verify no regressions.

**Step 3: Run Next.js build**

```bash
cd src/wj-client && npm run build
```

Verify the guide page builds successfully (static generation).

**Step 4: Commit any lint/build fixes**

---

### Task 10: Playwright E2E Test for Guide Page

**Files:**

- Create: `src/wj-client/tests/e2e/guide-page.spec.ts`

**Security notes:** E2E test verifies the page is accessible without auth.

**Step 1: Write E2E test**

Test scenarios:
- Navigate to `/vi/guide` — page loads without auth
- Navigate to `/en/guide` — page loads with English content
- TOC section links scroll to correct sections
- All three main sections are visible
- CTA buttons are present
- Landing navbar is visible
- Mobile viewport: TOC switches to horizontal pills
- Heading hierarchy is correct

**Step 2: Run E2E test**

```bash
cd src/wj-client && npx playwright test tests/e2e/guide-page.spec.ts --reporter=list
```

**Step 3: Fix any failures**

**Step 4: Commit**

---

## Task Dependency Order

```
Task 0 (C4 diagram) — independent, can run first or in parallel
Task 1 (i18n translations) — prerequisite for all UI tasks
Task 2 (route constant) — prerequisite for Tasks 7, 8
  ↓
Task 3 (layout + SEO) — depends on Task 1
Task 4 (GuideTOC) — depends on Task 1
Task 5 (GuideSection) — depends on Task 1
  ↓
Task 6 (GuideContent + page) — depends on Tasks 3, 4, 5
  ↓
Task 7 (navbar link) — depends on Tasks 1, 2
Task 8 (sidebar link) — depends on Task 2
  ↓
Task 9 (lint/build) — depends on all above
Task 10 (E2E) — depends on all above
```

**Parallel-safe groups:**
- Group A: Tasks 0, 1, 2 (all independent)
- Group B: Tasks 3, 4, 5 (all depend only on Task 1, independent of each other)
- Group C: Task 6 (depends on Group B)
- Group D: Tasks 7, 8 (depend on Tasks 1+2, independent of each other)
- Group E: Tasks 9, 10 (sequential, after everything else)

## Runtime Flow Diagrams

**Skipped** — per spec: "None needed — no API calls, no backend logic, pure static content rendering." This is a simple static content page with no multi-service coordination.
