# SEO Enhancement Specification

## Summary

Implement comprehensive SEO improvements for congdongvang.com based on a full-site SEO audit. The site currently scores ~35/100 on SEO fundamentals — missing robots.txt, sitemap.xml, structured data, hreflang tags, and serving English metadata to a Vietnamese audience. This feature addresses Phases 1-3 (13 items) to dramatically improve Google discoverability, crawl efficiency, and rich result eligibility. Phase 4 (long-term strategy) is documented for future implementation.

**Target keywords:** "giá vàng hôm nay", "cộng đồng vàng", "cộng đồng đầu tư", "quản lý tài chính cá nhân"
**Target audience:** Vietnamese users searching for gold prices and personal finance tools
**Canonical domain:** `https://www.congdongvang.com`

## User Stories

- As a **Vietnamese user searching "giá vàng hôm nay"**, I want congdongvang.com to appear in Google results, so that I can find live gold prices quickly.
- As a **potential user**, I want to see a rich, informative preview when the site is shared on Facebook/Zalo/LinkedIn, so that I understand what the site offers before clicking.
- As the **site owner**, I want Google to efficiently crawl only public pages and not waste crawl budget on authenticated dashboard pages, so that the landing page ranks faster.
- As the **site owner**, I want structured data (JSON-LD) so that Google can show rich results (organization info, app details, FAQs) in search listings.
- As a **search engine crawler**, I want a sitemap.xml with all public URLs in both vi/en locales, so that I can discover and index all pages.

## Functional Requirements

### FR-1: Create robots.txt

Create a dynamic `robots.txt` via Next.js App Router that:
- Allows crawling of public landing pages for all locales
- Disallows crawling of `/*/dashboard/` and `/*/auth/` paths
- References the sitemap URL

**Acceptance criteria:**
- [ ] `https://www.congdongvang.com/robots.txt` returns valid robots.txt
- [ ] Dashboard and auth paths are disallowed for all user agents
- [ ] Sitemap URL is referenced
- [ ] File is generated via `app/robots.ts` (not static file)

### FR-2: Create sitemap.xml

Create a dynamic sitemap via Next.js App Router that:
- Lists all public pages in both `vi` and `en` locales
- Includes `lastModified` dates
- Includes `changeFrequency` and `priority` values
- Excludes dashboard and auth pages

**Public URLs to include:**
- `/vi/landing` (priority: 1.0, daily)
- `/en/landing` (priority: 0.8, daily)
- Root `/` redirect page (priority: 0.5, monthly)

**Acceptance criteria:**
- [ ] `https://www.congdongvang.com/sitemap.xml` returns valid XML sitemap
- [ ] Both vi and en locale URLs included
- [ ] No dashboard/auth URLs present
- [ ] Valid against sitemap schema

### FR-3: Fix Title and Description to Vietnamese

Update the landing page metadata (both fallback and dynamic) to use Vietnamese as the primary language with target keywords.

**New fallback title:** `"Giá Vàng Hôm Nay | Cộng Đồng Vàng - Quản Lý Tài Chính Cá Nhân"`
**New fallback description:** `"Theo dõi giá vàng SJC, DOJI, giá bạc, ngoại tệ trực tiếp. Quản lý tài chính cá nhân, theo dõi danh mục đầu tư vàng, cổ phiếu, crypto miễn phí tại congdongvang.com"`

**Acceptance criteria:**
- [ ] Vietnamese title and description rendered in HTML `<head>`
- [ ] OpenGraph title/description updated to Vietnamese
- [ ] Twitter card title/description updated to Vietnamese
- [ ] Keywords updated to include Vietnamese target keywords
- [ ] Dynamic admin override still works (via site-settings API)

### FR-4: Fix Canonical URL

Update all canonical references from `https://congdongvang.com` to `https://www.congdongvang.com`.

**Acceptance criteria:**
- [ ] Canonical tag in landing page uses `https://www.congdongvang.com`
- [ ] OpenGraph URL uses `https://www.congdongvang.com`
- [ ] Fallback and dynamic metadata both use `www` prefix

### FR-5: Add Hreflang Tags

Add `alternates.languages` to landing page metadata for proper international SEO.

**Hreflang mapping:**
- `vi` → `https://www.congdongvang.com/vi/landing`
- `en` → `https://www.congdongvang.com/en/landing`
- `x-default` → `https://www.congdongvang.com/vi/landing`

**Acceptance criteria:**
- [ ] Hreflang tags rendered in HTML `<head>` for both locales
- [ ] `x-default` points to Vietnamese version
- [ ] Tags match actual locale routing structure

### FR-6: Add JSON-LD Structured Data

Add structured data to the landing page layout for rich result eligibility.

**Schemas to implement:**
1. **Organization** — Brand name "Cộng Đồng Vàng", logo, URL
2. **WebSite** — Site name, URL, language
3. **SoftwareApplication** — App name, category "FinanceApplication", price "0", currency "VND"
4. **FAQPage** — From the comparison section ("Tại sao chọn congdongvang.com?")
5. **FinancialProduct** — Gold/silver price tracking service description

**Acceptance criteria:**
- [ ] All 5 JSON-LD scripts rendered in `<head>` as `<script type="application/ld+json">`
- [ ] Valid against Google Rich Results Test
- [ ] Data is accurate and matches site content
- [ ] Implemented as a server component (not client-rendered)

### FR-7: Design and Create OG Image

Design a proper OG image (1200x630 PNG) using Pencil MCP that:
- Features the congdongvang.com brand colors (gold `#d2a74b`, dark red `#5F0202`)
- Includes the brand name and tagline in Vietnamese
- Is visually compelling for social sharing (Facebook, Zalo, LinkedIn)

**Acceptance criteria:**
- [ ] PNG file at `/public/og-image.png` (1200x630)
- [ ] Metadata references updated from `.svg` to `.png`
- [ ] Image displays correctly when shared on social media
- [ ] File size optimized (< 500KB)

### FR-8: Add noindex to Dashboard and Auth Pages

Add `robots: { index: false, follow: false }` metadata to dashboard and auth layouts.

**Dashboard layout:** Currently `"use client"` — need to add metadata export in a parent server layout or use `<meta>` tags directly.
**Auth layout:** Server component — can add `metadata` export directly.

**Acceptance criteria:**
- [ ] Dashboard pages return `<meta name="robots" content="noindex, nofollow">` in HTML
- [ ] Auth pages return `<meta name="robots" content="noindex, nofollow">` in HTML
- [ ] robots.txt also disallows these paths (belt-and-suspenders)
- [ ] Landing page is NOT affected (remains indexable)

### FR-9: Convert Landing Page to SSR with ISR

Remove `"use client"` from the landing page and fetch price data server-side with ISR (5-minute revalidation). Charts remain client-side.

**Current flow:** `page.tsx` ("use client") → `usePublicMarketTypes()` (React Query) → client fetch
**New flow:** `page.tsx` (server) → `fetch()` with `revalidate: 300` → pass data as props → child chart components remain "use client"

**Acceptance criteria:**
- [ ] Landing page HTML includes price table data in initial response (view-source visible)
- [ ] Price data refreshes every 5 minutes via ISR
- [ ] Charts still render client-side with interactivity
- [ ] No regression in visual layout or functionality
- [ ] Sentiment cards and error states still work

### FR-10: Replace H1 with Keyword-Rich Version

Update the H1 text in i18n messages.

**New H1 (vi):** `"congdongvang.com - Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính"`
**New H1 (en):** `"congdongvang.com - A Community for Sharing Knowledge About Financial Investment Markets"`

**Acceptance criteria:**
- [ ] H1 updated in `messages/vi/nav.json` under `landing.hero.title`
- [ ] H1 updated in `messages/en/nav.json` under `landing.hero.title`
- [ ] Visual rendering is acceptable (may need font size adjustment for longer text)

### FR-11: Improve Image Alt Texts

Update image alt texts in landing components to be descriptive and in Vietnamese.

**Changes:**
- Logo: `"congdongvang.com"` → `"Logo congdongvang.com - Cộng đồng đầu tư tài chính"`
- Dashboard preview: `"dashboard"` → `"Bảng điều khiển quản lý tài chính congdongvang.com"`
- Add aria-labels to chart components

**Acceptance criteria:**
- [ ] All images have descriptive Vietnamese alt text
- [ ] Chart components have appropriate aria-labels
- [ ] Alt texts include relevant keywords naturally

### FR-12: Add Preconnect to API Domain

Add `<link rel="preconnect">` to the API domain in the locale layout head.

**Acceptance criteria:**
- [ ] Preconnect link present in HTML `<head>`
- [ ] Targets the backend API domain
- [ ] Only added if API URL is configured

### FR-13: Document Phase 4 Roadmap

Document long-term SEO initiatives in the spec for future implementation.

**Acceptance criteria:**
- [ ] Phase 4 items documented with rationale
- [ ] No code changes needed for this requirement

## Non-Functional Requirements

- **Performance:** SSR landing page should not increase TTFB beyond 500ms. ISR revalidation happens in the background (no user-facing latency).
- **SEO compliance:** All changes must validate against Google's webmaster guidelines. JSON-LD must pass Google Rich Results Test.
- **Accessibility:** Alt text changes improve screen reader experience. No accessibility regressions.
- **Caching:** ISR revalidation at 5 minutes. External API failures should serve stale data gracefully.
- **Backwards compatibility:** Admin SEO settings panel must still override defaults. Dynamic metadata from site-settings API takes precedence.

## Architecture Changes (C4)

### Diagrams to Update

**L3 Frontend (c4-component-frontend.md):**
- No structural changes — no new pages or feature modules. Only modifications to existing landing layout/page and addition of utility files (robots.ts, sitemap.ts).

### New Diagrams

None required — this feature doesn't add new bounded contexts or complex domain models.

## Runtime Flow Diagrams

### Flow Diagrams to Update

None — no new multi-step business logic or API endpoints.

### New Flow Diagrams

None — this is a frontend-only enhancement with no new request-response flows.

## Data Model Changes

None — no database changes required.

## API Changes

None — uses existing public endpoints:
- `GET /api/v1/public/market-types` (already exists, used for SSR fetch)
- `GET /api/v1/public/site-settings` (already exists, used for dynamic metadata)

## UI/UX Changes

### Landing Page Changes
1. **H1 text** — Longer, keyword-rich text may need responsive font sizing adjustment
2. **Image alt texts** — No visual change, accessibility improvement
3. **OG image** — New social sharing preview (designed via Pencil MCP)
4. **SSR rendering** — Page loads with content visible immediately (no loading spinner for price tables on initial load)

### Dashboard/Auth Changes
1. **Meta tags only** — `noindex, nofollow` added. No visual changes.

### Existing Component Inventory (REQUIRED)

| Need | Existing Component | Location |
|------|--------------------|----------|
| Price tables (landing) | `LandingGoldPriceTable`, `LandingSilverPriceTable`, `LandingCurrencyPriceTable` | `components/landing/` |
| Price charts (landing) | `LandingGoldPriceChart`, `LandingSilverPriceChart`, `LandingDollarIndexChart` | `components/landing/` |
| Sentiment card | `SentimentCard` | `components/GoldSentimentCard` |
| Navbar | `LandingNavbar` | `components/landing/` |
| Footer | `LandingFooter` | `components/landing/` |
| Hero section | `LandingHero` (contains H1) | `components/landing/` |
| Divider | `OrnateDivider` | `components/decorative/` |

### New Components (if any)

| Component | Location | Justification |
|-----------|----------|---------------|
| `JsonLd` | `components/seo/JsonLd.tsx` | Server component to render JSON-LD scripts. Keeps structured data logic separate from layout. Reusable across pages. |

## Security & Risk Assessment

### Data Flow Diagram

| # | Source | Data | Trust Boundary Crossed? | Destination | Notes |
|---|--------|------|-------------------------|-------------|-------|
| 1 | Google crawler (external) | HTTP request to landing page | Yes: Internet → App | Next.js server | Public page, no auth needed |
| 2 | Next.js server | Fetch market types | Yes: App → External API | Go backend (public endpoint) | Server-side fetch with ISR |
| 3 | Go backend | Price data (JSON) | Yes: External API → App | Next.js server | Untrusted response, validate structure |
| 4 | Next.js server | SSR HTML with prices | Yes: App → Internet | Google crawler / User | Public data, no sensitive info |
| 5 | Next.js server | Fetch site-settings | Yes: App → External API | Go backend (public endpoint) | Admin-configured SEO metadata |
| 6 | Admin (browser) | SEO settings form | Yes: Internet → App | Go backend (admin endpoint) | Requires admin auth |

### Trust Boundaries

| Boundary | Crossed By | Security Control |
|----------|-----------|------------------|
| Internet → App | Crawler/user requests to landing | No auth required (public page) |
| App → Backend API | Server-side ISR fetch | No auth (public endpoint), validate response |
| Internet → App (admin) | Admin updating SEO settings | JWT auth + admin role check (existing) |

### Threats Identified (STRIDE per boundary crossing)

| # | Data Flow | Boundary | STRIDE | Threat | Severity | Mitigation |
|---|-----------|----------|--------|--------|----------|------------|
| T-1 | 2 | App → Backend | Tampering | Manipulated price data injected into SSR HTML | Low | Prices are public data with no financial impact on landing page (display only). Backend already validates from source APIs. |
| T-2 | 5 | App → Backend | Tampering | Admin SEO settings modified to inject malicious scripts | Medium | Existing admin auth protects settings endpoint. SEO fields are text-only (no HTML execution in meta tags). Next.js escapes meta content by default. |
| T-3 | 6 | Internet → App | Spoofing | Non-admin user modifies SEO settings | Medium | Existing admin role check on `/api/v1/admin/site-settings` endpoint. No changes needed. |
| T-4 | 1 | Internet → App | DoS | Excessive crawler traffic | Low | ISR caching means most requests serve cached HTML. Vercel/hosting handles DDoS. |
| T-5 | 4 | App → Internet | Info Disclosure | SSR HTML leaks sensitive data | Low | Only public market prices rendered. No user data, no auth tokens. |

### OWASP Top 10 Relevance

| # | Vulnerability | Relevant? | Notes |
|---|--------------|-----------|-------|
| A01 | Broken Access Control | No | No new auth-protected endpoints. Dashboard noindex is additive protection. |
| A02 | Cryptographic Failures | No | No new sensitive data handling. |
| A03 | Injection | Low | JSON-LD content is hardcoded or from admin settings (validated). Next.js escapes `<script>` content. |
| A04 | Insecure Design | No | No new business logic. |
| A05 | Security Misconfiguration | Low | robots.txt misconfiguration could accidentally block important pages. Mitigated by explicit allow rules. |
| A06 | Vulnerable Components | No | No new dependencies added. |
| A07 | Authentication Failures | No | No changes to auth flow. |
| A08 | Data Integrity Failures | No | No financial data modifications. |
| A09 | Logging Failures | No | No new security-relevant operations. |
| A10 | SSRF | No | Server-side fetch targets hardcoded internal API URL (not user-supplied). |

### Authorization Rules

| Operation | Owner | Other User | Unauthenticated | Notes |
|-----------|-------|------------|-----------------|-------|
| View landing page | N/A | N/A | Allowed | Public page |
| View robots.txt | N/A | N/A | Allowed | Public file |
| View sitemap.xml | N/A | N/A | Allowed | Public file |
| Update SEO settings | Admin only | Denied | Denied | Existing admin endpoint |

### Input Validation Rules

| Input | Type | Constraints | Server-side Validation |
|-------|------|------------|----------------------|
| Admin SEO title | string | max 70 chars | Existing validation in admin handler |
| Admin SEO description | string | max 160 chars | Existing validation in admin handler |
| Admin SEO keywords | JSON array | max 20 items, each max 50 chars | Existing validation |

No new user input fields introduced by this feature.

### External Dependency Risks

| External Service | Data Exchanged | Trust Level | Failure Impact | Mitigation |
|-----------------|----------------|-------------|----------------|------------|
| Go backend (public/market-types) | Gold/silver/currency price data | High (own service) | Landing page shows stale prices | ISR serves cached version; error boundary shows retry button |
| Go backend (public/site-settings) | Admin SEO configuration | High (own service) | Landing page uses hardcoded fallback metadata | Fallback metadata defined in code |

### Sensitive Data Handling

No sensitive data involved. All data rendered on the landing page is public:
- Market prices (publicly available)
- SEO metadata (intentionally public)
- Brand information (public)

### Issues & Risks Summary

1. **Low risk — ISR cache stale data:** If the backend is down, ISR serves stale HTML. Acceptable for a landing page — prices update every 5 min anyway.
2. **Low risk — robots.txt misconfiguration:** Could accidentally block the landing page from Google. Mitigated by explicit testing.
3. **Low risk — JSON-LD validation:** Invalid structured data won't cause errors but will miss rich results. Mitigated by testing with Google Rich Results Test.
4. **Medium risk — SSR refactor regression:** Converting landing page from CSR to SSR could break interactivity (charts, sentiment cards, error states). Mitigated by keeping interactive components as `"use client"` children.

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|---------|
| Backend API down during ISR revalidation | Next.js serves stale cached HTML. Price data may be up to revalidate interval + API downtime stale. |
| Admin sets empty SEO title/description | Fallback to hardcoded Vietnamese defaults in code |
| Google crawls during deployment | ISR ensures cached version is always available |
| OG image file missing/broken | Social platforms show default unfurling (no image). Metadata still renders. |
| New locale added in future | robots.txt and sitemap.ts patterns use dynamic locale list — auto-included |
| `NEXT_PUBLIC_API_URL` not set | Server-side fetch falls back to empty string (relative URL). Handled by existing pattern in `fetchSiteSettings`. |

## Dependencies & Assumptions

- **Next.js App Router** supports `robots.ts` and `sitemap.ts` file conventions (confirmed in Next.js 14+)
- **ISR** (`revalidate`) works on the deployment platform (Vercel — confirmed)
- **Public API endpoints** (`/api/v1/public/market-types`, `/api/v1/public/site-settings`) are accessible from the Next.js server at build/revalidation time
- **Admin SEO settings panel** already exists and will continue to work after metadata defaults are updated
- **Pencil MCP** is available for OG image design

## Out of Scope

- **No backend changes** — All work is frontend + static files
- **No new API endpoints** — Uses existing public endpoints
- **No database migrations** — No schema changes
- **No new authentication flows** — Only additive noindex metadata
- **Blog/content strategy** — Documented in Phase 4 for future
- **Google Search Console setup** — Documented in Phase 4 for future
- **Coc Coc Webmaster Tools** — Documented in Phase 4 for future
- **Backlink building** — Documented in Phase 4 for future
- **Performance optimization beyond SSR** — Core Web Vitals improvements are separate

## Phase 4 Roadmap (Future Implementation)

### P4-1: Google Search Console Setup
- Register and verify `www.congdongvang.com` in GSC
- Submit sitemap.xml
- Monitor indexation status and fix any reported issues
- Set up email alerts for indexation drops

### P4-2: Coc Coc Webmaster Tools
- Register site with Coc Coc (Vietnam's second-largest search engine, ~6% market share)
- Submit sitemap
- Monitor Coc Coc-specific indexation

### P4-3: Backlink Strategy
- Submit to Vietnamese finance directories
- Engage with Vietnamese investment communities (forums, Facebook groups)
- Create shareable content (infographics, gold price analysis)
- Partner with Vietnamese finance bloggers for guest posts

### P4-4: Blog Content Strategy
Target long-tail Vietnamese keywords:
- "cách đầu tư vàng SJC" (how to invest in SJC gold)
- "so sánh vàng SJC và vàng nhẫn" (compare SJC gold bar vs ring)
- "giá vàng dự đoán" (gold price prediction)
- "quản lý tài chính cá nhân cho người mới" (personal finance for beginners)
- "đầu tư crypto cho người Việt" (crypto investment for Vietnamese)

**Implementation:** Add a `/blog` route with MDX support, proper heading structure, and internal linking to landing page features.

### P4-5: Core Web Vitals Monitoring
- Set up Lighthouse CI in GitHub Actions
- Monitor LCP, INP, CLS scores
- Address any regressions from SSR migration

### P4-6: Local SEO (if physical presence added)
- Google Business Profile
- NAP consistency
- Local schema markup

## Implementation Summary

| # | Item | Phase | Priority | Files Affected |
|---|------|-------|----------|----------------|
| 1 | robots.txt | 1 | Critical | `app/robots.ts` (new) |
| 2 | sitemap.xml | 1 | Critical | `app/sitemap.ts` (new) |
| 3 | Vietnamese title/description | 1 | Critical | `app/[locale]/landing/layout.tsx` |
| 4 | Canonical URL fix | 1 | Critical | `app/[locale]/landing/layout.tsx` |
| 5 | Hreflang tags | 2 | High | `app/[locale]/landing/layout.tsx` |
| 6 | JSON-LD structured data | 2 | High | `components/seo/JsonLd.tsx` (new), `app/[locale]/landing/layout.tsx` |
| 7 | OG image (Pencil MCP) | 2 | High | `public/og-image.png` (new), metadata refs |
| 8 | noindex dashboard/auth | 2 | High | `app/[locale]/dashboard/layout.tsx`, `app/[locale]/auth/layout.tsx` |
| 9 | SSR landing page with ISR | 3 | High | `app/[locale]/landing/page.tsx`, landing components |
| 10 | H1 keyword optimization | 3 | Medium | `messages/vi/nav.json`, `messages/en/nav.json` |
| 11 | Image alt text improvements | 3 | Medium | Landing components |
| 12 | Preconnect to API | 3 | Low | `app/[locale]/layout.tsx` |
| 13 | Phase 4 documentation | Doc | N/A | This spec file |
